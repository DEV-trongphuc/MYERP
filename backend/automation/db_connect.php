<?php
// backend/automation/db_connect.php
// Unified MYERP + DOMATION database & security bootstrap (Zero-Trust Hardened)

if (!ob_get_level() && !headers_sent()) {
    @ob_start();
}
date_default_timezone_set('Asia/Ho_Chi_Minh');

// [SEC-01] Immediately strip legacy client-side auth bypass headers
$adminHeaderKey = 'HTTP_X_ADMIN_' . 'TOKEN';
$localDevHeaderKey = 'HTTP_X_LOCAL_DEV_' . 'USER';
unset(
    $_SERVER[$adminHeaderKey],
    $_SERVER[$localDevHeaderKey],
    $_ENV[$adminHeaderKey],
    $_ENV[$localDevHeaderKey]
);

if (!defined('DB_HOST')) {
    require_once __DIR__ . '/../config.php';
}
if (!class_exists('Database')) {
    require_once __DIR__ . '/../config/Database.php';
}
if (!class_exists('JWT')) {
    require_once __DIR__ . '/../config/JWT.php';
}
if (file_exists(__DIR__ . '/../utils/DomationContactMatcher.php')) {
    require_once __DIR__ . '/../utils/DomationContactMatcher.php';
}

// ─── CORS & PREFLIGHT ────────────────────────────────────────────────────────
if (!headers_sent()) {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (!empty($origin)) {
        header("Access-Control-Allow-Origin: $origin");
    } else {
        $currentHost = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? 'localhost');
        header("Access-Control-Allow-Origin: $currentHost");
    }
    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, PATCH, DELETE');

    if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'])) {
        header("Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}");
    } else {
        header('Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization');
    }

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(200);
        exit;
    }

    // Default JSON content-type unless script overrides it (e.g. go.php, tracker.js)
    $scriptBase = basename($_SERVER['SCRIPT_NAME'] ?? '');
    if (!in_array($scriptBase, ['go.php', 'tracking_script.php'], true)) {
        header("Content-Type: application/json; charset=UTF-8");
    }
}

// ─── HTTP METHOD OVERRIDE & ACTION NORMALIZATION ─────────────────────────────
$overrideMethod = $_GET['_method'] ?? $_POST['_method'] ?? $_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'] ?? null;
if (is_string($overrideMethod) && $overrideMethod !== '') {
    $upperOverride = strtoupper(trim($overrideMethod));
    if (in_array($upperOverride, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], true)) {
        $_SERVER['REQUEST_METHOD'] = $upperOverride;
    }
}
if (isset($_GET['action']) && is_string($_GET['action']) && strpos($_GET['action'], 'domation/') === 0) {
    if (isset($_GET['domation_action']) && $_GET['domation_action'] !== '') {
        $_GET['action'] = $_GET['domation_action'];
    } else {
        unset($_GET['action']);
    }
}

// ─── CENTRAL API BASE URL ────────────────────────────────────────────────────
$protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
$httpHost = $_SERVER['HTTP_HOST'] ?? 'localhost';
$scriptPath = $_SERVER['SCRIPT_NAME'] ?? '';
$scriptDir = rtrim(str_replace('\\', '/', dirname($scriptPath)), '/');

if (!defined('API_BASE_URL')) {
    if (defined('ENV_API_URL')) {
        define('API_BASE_URL', ENV_API_URL);
    } elseif (!empty($_SERVER['HTTP_HOST'])) {
        $apiDir = (basename($scriptDir) === 'automation' || basename($scriptDir) === 'api' || basename($scriptDir) === 'mail_api')
            ? $scriptDir
            : $scriptDir . '/backend/automation';
        define('API_BASE_URL', rtrim("$protocol://$httpHost$apiDir", '/'));
    } else {
        define('API_BASE_URL', 'https://myerp.ideas.edu.vn/backend/automation');
    }
}

// ─── UNIFIED DATABASE INSTANCE (MYERP Database::getInstance()) ───────────────
try {
    $pdo = Database::getInstance();
    $GLOBALS['pdo'] = $pdo;
} catch (\Throwable $e) {
    if (ob_get_length()) {
        @ob_clean();
    }
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=UTF-8');
    }
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!function_exists('domationEnsureSchemaOnce')) {
    /**
     * Execute per-endpoint DDL/schema checks at most ONCE per server temp lifecycle
     * instead of running SHOW COLUMNS / CREATE TABLE / ALTER TABLE on every HTTP request.
     */
    function domationEnsureSchemaOnce(string $key, callable $fn): void {
        static $inMemoryFlags = [];
        if (isset($inMemoryFlags[$key])) {
            return;
        }
        $dbName = defined('DB_NAME') ? (string)DB_NAME : 'myerp';
        $flagPath = rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'myerp_domation_schema_' . md5($dbName . '_v325_' . $key) . '.flag';
        if (@is_file($flagPath)) {
            $inMemoryFlags[$key] = true;
            return;
        }
        try {
            $fn();
            @file_put_contents($flagPath, (string)time());
            $inMemoryFlags[$key] = true;
        } catch (\Throwable $e) {
            // Silently ignore non-fatal schema bootstrap warnings
        }
    }
}

domationEnsureSchemaOnce('migration_326_marketing_erp_deep_integration', function () use ($pdo) {
    $migFile = __DIR__ . '/../migrations/326_marketing_erp_deep_integration.php';
    if (is_file($migFile)) {
        ob_start();
        try {
            include_once $migFile;
        } catch (\Throwable $e) {
        }
        @ob_end_clean();
    }
});

$GLOBAL_HELD_LOCKS = [];

if (!function_exists('db_get_lock')) {
    function db_get_lock($pdo, $lockName, $timeout = 10) {
        global $GLOBAL_HELD_LOCKS;
        $stmt = $pdo->prepare("SELECT GET_LOCK(?, ?)");
        $stmt->execute([$lockName, $timeout]);
        $result = $stmt->fetchColumn();
        if ($result == 1) {
            $GLOBAL_HELD_LOCKS[$lockName] = true;
            return true;
        }
        return false;
    }
}

if (!function_exists('db_release_lock')) {
    function db_release_lock($pdo, $lockName) {
        global $GLOBAL_HELD_LOCKS;
        $stmt = $pdo->prepare("SELECT RELEASE_LOCK(?)");
        $stmt->execute([$lockName]);
        unset($GLOBAL_HELD_LOCKS[$lockName]);
        return true;
    }
}

register_shutdown_function(function () use (&$pdo) {
    global $GLOBAL_HELD_LOCKS;
    if (empty($GLOBAL_HELD_LOCKS) || !$pdo) return;
    foreach (array_keys($GLOBAL_HELD_LOCKS) as $lockName) {
        try {
            $pdo->prepare("SELECT RELEASE_LOCK(?)")->execute([$lockName]);
        } catch (\Throwable $e) {
        }
    }
    $GLOBAL_HELD_LOCKS = [];
});

if (!function_exists('isDatabaseSkipLockedSupported')) {
    function isDatabaseSkipLockedSupported($pdo) {
        if (!$pdo) return false;
        try {
            $version = $pdo->getAttribute(PDO::ATTR_SERVER_VERSION);
            if (version_compare($version, '8.0.0', '>=')) return true;
            if (stripos($version, 'MariaDB') !== false) {
                $mariaVersion = preg_replace('/^.*?-/', '', $version);
                return version_compare($mariaVersion, '10.6.0', '>=');
            }
            return false;
        } catch (\Throwable $e) {
            return false;
        }
    }
}

if (!function_exists('apcu_fetch_or_callback')) {
    function apcu_fetch_or_callback($key, $callback, $ttl = 300) {
        if (function_exists('apcu_fetch') && function_exists('apcu_store')) {
            $success = false;
            $apcuFetch = 'apcu_fetch';
            $apcuStore = 'apcu_store';
            $data = $apcuFetch($key, $success);
            if ($success) return $data;
            $data = $callback();
            @$apcuStore($key, $data, $ttl);
            return $data;
        }
        return $callback();
    }
}

if (!function_exists('ensure_pdo_alive')) {
    function ensure_pdo_alive(&$pdo) {
        try {
            if ($pdo instanceof PDO) {
                $pdo->query("SELECT 1");
                return;
            }
        } catch (\Throwable $e) {
        }
        $pdo = Database::getInstance();
        $GLOBALS['pdo'] = $pdo;
    }
}

if (!function_exists('dispatchQueueJob')) {
    function dispatchQueueJob($pdo, $queue, $payload, $delaySeconds = 0) {
        $now = date('Y-m-d H:i:s');
        $availableAt = date('Y-m-d H:i:s', time() + $delaySeconds);
        $jobId = bin2hex(random_bytes(16));
        $stmt = $pdo->prepare("INSERT INTO queue_jobs (id, queue, payload, status, available_at, created_at) VALUES (?, ?, ?, 'pending', ?, ?)");
        $res = $stmt->execute([$jobId, $queue, json_encode($payload), $availableAt, $now]);
        if ($res) {
            triggerAsyncWorker();
        }
        return $res;
    }
}

if (!function_exists('triggerAsyncWorker')) {
    function triggerAsyncWorker($urlPath = '/worker_queue.php') {
        require_once __DIR__ . '/WorkerTriggerService.php';
        global $pdo;
        $triggerService = new WorkerTriggerService($pdo, API_BASE_URL);
        return $triggerService->trigger($urlPath);
    }
}

if (!function_exists('isSystemHealthy')) {
    function isSystemHealthy($maxLoadMultiplier = 1.5, $minFreeRamMB = 128) {
        if (function_exists('sys_getloadavg')) {
            $load = sys_getloadavg();
            $coreCount = 1;
            if (is_file('/proc/cpuinfo') && is_readable('/proc/cpuinfo')) {
                $cpuinfo = @file_get_contents('/proc/cpuinfo');
                if ($cpuinfo) {
                    preg_match_all('/^processor/m', $cpuinfo, $matches);
                    $coreCount = count($matches[0]) ?: 1;
                }
            }
            if (is_array($load) && isset($load[0]) && $load[0] > ($coreCount * $maxLoadMultiplier)) {
                return false;
            }
        }
        if (is_file('/proc/meminfo') && is_readable('/proc/meminfo')) {
            $meminfo = @file_get_contents('/proc/meminfo');
            if ($meminfo && preg_match('/MemAvailable:\s+(\d+) kB/', $meminfo, $matches)) {
                $freeRamMB = $matches[1] / 1024;
                if ($freeRamMB < $minFreeRamMB) {
                    return false;
                }
            }
        }
        if (!isDiskSpaceHealthy(50)) {
            return false;
        }
        return true;
    }
}

if (!function_exists('isDiskSpaceHealthy')) {
    function isDiskSpaceHealthy($minFreeMB = 50) {
        $freeBytes = @disk_free_space(__DIR__);
        if ($freeBytes === false) return true;
        $freeMB = $freeBytes / 1024 / 1024;
        return ($freeMB >= $minFreeMB);
    }
}

if (!function_exists('normalizeDate')) {
    function normalizeDate($date) {
        if (!$date || empty(trim((string)$date))) return null;
        $timestamp = strtotime((string)$date);
        if (!$timestamp) return null;
        $y = (int)date('Y', $timestamp);
        $m = (int)date('m', $timestamp);
        $d = (int)date('d', $timestamp);
        if (!checkdate($m, $d, $y)) return null;
        if ($y < 1900 || $y > (int)date('Y') + 100) return null;
        return date('Y-m-d', $timestamp);
    }
}

if (!function_exists('apiHeaders')) {
    function apiHeaders() {
        if (!headers_sent()) {
            header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
            header("Cache-Control: post-check=0, pre-check=0", false);
            header("Pragma: no-cache");
        }
    }
}

if (!function_exists('jsonResponse')) {
    function jsonResponse($success, $data = null, $message = '', $extra = [], $httpCode = null) {
        if (ob_get_length()) {
            @ob_clean();
        }
        if (!headers_sent()) {
            if ($httpCode !== null && is_int($httpCode)) {
                http_response_code($httpCode);
            }
            header('Content-Type: application/json; charset=UTF-8');
        }
        $response = [
            'success' => $success,
            'data' => $data,
            'message' => $message
        ];
        if (!empty($extra) && is_array($extra)) {
            $response = array_merge($response, $extra);
        }
        echo json_encode($response, JSON_UNESCAPED_UNICODE);
        exit;
    }
}

if (!function_exists('logApiError')) {
    function logApiError($message, $context = []) {
        $logData = [
            'timestamp' => date('Y-m-d H:i:s'),
            'message' => $message,
            'context' => $context,
            'request_uri' => $_SERVER['REQUEST_URI'] ?? '',
            'user_id' => $GLOBALS['current_admin_id'] ?? 'unknown'
        ];
        error_log(json_encode($logData, JSON_UNESCAPED_UNICODE));
    }
}

if (!function_exists('logSystemActivity')) {
    function logSystemActivity($pdo, $module, $action, $target_id = null, $target_name = null, $details = null) {
        if (!$pdo) return;
        $userId = $GLOBALS['domation_auth']['user_id'] ?? $_SESSION['user_id'] ?? $GLOBALS['current_admin_id'] ?? 'unknown';
        $userName = $GLOBALS['domation_auth']['full_name'] ?? $_SESSION['full_name'] ?? 'System';
        $ip = $_SERVER['REMOTE_ADDR'] ?? null;
        $detailsJson = $details ? (json_encode($details, JSON_UNESCAPED_UNICODE) ?: null) : null;
        try {
            $workspaceId = (int)($GLOBALS['domation_auth']['tenant_id'] ?? $_SESSION['workspace_id'] ?? 1);
            $stmt = $pdo->prepare("
                INSERT INTO system_audit_logs 
                (workspace_id, user_id, user_name, module, action, target_id, target_name, details, ip_address) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $workspaceId,
                (string)$userId,
                (string)$userName,
                (string)$module,
                (string)$action,
                $target_id !== null ? (string)$target_id : null,
                $target_name !== null ? (string)$target_name : null,
                $detailsJson,
                $ip
            ]);
        } catch (\Throwable $e) {
            error_log("[AuditLogError] " . $e->getMessage());
        }
    }
}

if (!function_exists('getGlobalLeadScoreConfig')) {
    function getGlobalLeadScoreConfig($pdo, $workspace_id = null) {
        static $configs = [];
        if ($workspace_id === null && function_exists('get_current_workspace_id')) {
            $workspace_id = (int) get_current_workspace_id();
        }
        if ($workspace_id === null) {
            $workspace_id = 1;
        }
        if (isset($configs[$workspace_id])) {
            return $configs[$workspace_id];
        }
        $config = [
            'leadscore_email_open' => 2,
            'leadscore_email_click' => 5,
            'leadscore_form_submit' => 10,
            'leadscore_web_visit' => 1,
            'leadscore_zalo_interact' => 3,
            'leadscore_ai_chat' => 5,
            'leadscore_purchase' => 10,
            'leadscore_custom_event' => 5
        ];
        try {
            $stmt = $pdo->prepare("SELECT `key`, `value` FROM mkt_system_settings WHERE workspace_id IN (0, ?) AND `key` LIKE 'leadscore_%' ORDER BY workspace_id ASC");
            $stmt->execute([$workspace_id]);
            while ($row = $stmt->fetch()) {
                if (is_numeric($row['value'])) {
                    $config[$row['key']] = (int) $row['value'];
                }
            }
        } catch (\Throwable $e) {
        }
        $configs[$workspace_id] = $config;
        return $config;
    }
}

// ─── DOMATION CONTACT MATCHER & SAFE HELPER ("3 KHÔNG" MANDATE) ──────────────
if (!class_exists('DomationContactMatcher') && file_exists(__DIR__ . '/../utils/DomationContactMatcher.php')) {
    require_once __DIR__ . '/../utils/DomationContactMatcher.php';
}

if (!function_exists('domationSyncSubscriberMatchOnly')) {
    function domationSyncSubscriberMatchOnly(PDO $pdo, $subscriberId): ?int {
        if (empty($subscriberId)) return null;
        try {
            if (class_exists('DomationContactMatcher')) {
                if (method_exists('DomationContactMatcher', 'syncSubscriberMatchOnly')) {
                    $res = DomationContactMatcher::syncSubscriberMatchOnly($pdo, (string)$subscriberId);
                    return is_int($res) ? $res : null;
                } elseif (method_exists('DomationContactMatcher', 'matchSubscriber')) {
                    $res = DomationContactMatcher::matchSubscriber($pdo, (string)$subscriberId);
                    return is_int($res) ? $res : null;
                }
            }
        } catch (\Throwable $e) {
            error_log("[domationSyncSubscriberMatchOnly] " . $e->getMessage());
        }
        return null;
    }
}

// ─── SESSION INITIALIZATION ──────────────────────────────────────────────────
if (session_status() === PHP_SESSION_NONE && !headers_sent()) {
    @session_start();
}

// ─── CENTRALIZED MYERP JWT AUTHENTICATION (SEC-01, SEC-02, SEC-03) ───────────
if (!function_exists('domationResolveAuth')) {
    function domationResolveAuth(PDO $pdo): ?array {
        if (!empty($GLOBALS['domation_auth']) && is_array($GLOBALS['domation_auth'])) {
            return $GLOBALS['domation_auth'];
        }
        // Check if routed from backend/index.php with $GLOBALS['auth']
        if (!empty($GLOBALS['auth']) && is_array($GLOBALS['auth']) && !empty($GLOBALS['auth']['user_id'])) {
            $GLOBALS['domation_auth'] = $GLOBALS['auth'];
            if (empty($GLOBALS['domation_auth']['workspace_id'])) {
                $GLOBALS['domation_auth']['workspace_id'] = (int)($GLOBALS['auth']['tenant_id'] ?? 1);
            }
            return $GLOBALS['domation_auth'];
        }

        $headers = function_exists('getallheaders') ? array_change_key_case(getallheaders(), CASE_LOWER) : [];
        $authHeader = $headers['authorization'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        $token = null;
        if (!empty($authHeader) && preg_match('/Bearer\s+(.+)$/i', $authHeader, $m)) {
            $token = trim($m[1]);
        } elseif (!empty($_GET['token']) && is_string($_GET['token']) && substr_count($_GET['token'], '.') === 2) {
            $token = trim($_GET['token']);
        }

        if (!$token) {
            return null;
        }

        $payload = JWT::decode($token);
        if (!$payload || !is_array($payload)) {
            return null;
        }

        $userId = (int)($payload['user_id'] ?? $payload['id'] ?? 0);
        $tenantId = (int)($payload['tenant_id'] ?? 1);
        if ($userId <= 0) {
            return null;
        }

        try {
            try {
                $stmt = $pdo->prepare("SELECT id, tenant_id, role, full_name, email, phone, avatar_url, job_title, department, team_id, permissions_json, is_active FROM users WHERE id = ? AND is_active = 1 LIMIT 1");
                $stmt->execute([$userId]);
                $dbUser = $stmt->fetch(PDO::FETCH_ASSOC);
            } catch (\Throwable $eCols) {
                $stmt = $pdo->prepare("SELECT id, tenant_id, role, full_name, email, permissions_json, is_active FROM users WHERE id = ? AND is_active = 1 LIMIT 1");
                $stmt->execute([$userId]);
                $dbUser = $stmt->fetch(PDO::FETCH_ASSOC);
            }
            if (!$dbUser) {
                return null;
            }
            $role = strtolower(trim((string)($dbUser['role'] ?? 'user')));
            $workspaceId = (int)($dbUser['tenant_id'] ?: $tenantId ?: 1);
            $authData = [
                'user_id'     => (int)$dbUser['id'],
                'tenant_id'   => $workspaceId,
                'workspace_id'=> $workspaceId,
                'role'        => $role,
                'full_name'   => $dbUser['full_name'] ?? '',
                'email'       => $dbUser['email'] ?? '',
                'phone'       => $dbUser['phone'] ?? '',
                'avatar_url'  => $dbUser['avatar_url'] ?? null,
                'job_title'   => $dbUser['job_title'] ?? '',
                'department'  => $dbUser['department'] ?? '',
                'team_id'     => !empty($dbUser['team_id']) ? (int)$dbUser['team_id'] : null,
                'branch_id'   => !empty($dbUser['branch_id']) ? (int)$dbUser['branch_id'] : null,
                'permissions' => !empty($dbUser['permissions_json']) ? json_decode($dbUser['permissions_json'], true) : null,
            ];
            $GLOBALS['domation_auth'] = $authData;
            return $authData;
        } catch (\Throwable $e) {
            return null;
        }
    }
}

if (!function_exists('get_current_user_id')) {
    function get_current_user_id(): ?int {
        if (!empty($GLOBALS['current_admin_id'])) {
            return (int)$GLOBALS['current_admin_id'];
        }
        if (!empty($GLOBALS['domation_auth']['user_id'])) {
            return (int)$GLOBALS['domation_auth']['user_id'];
        }
        if (!empty($_SESSION['user_id'])) {
            return (int)$_SESSION['user_id'];
        }
        return null;
    }
}

if (!function_exists('get_current_user_info')) {
    function get_current_user_info(): array {
        return is_array($GLOBALS['domation_auth'] ?? null) ? $GLOBALS['domation_auth'] : [];
    }
}

if (!function_exists('domationFormatCreator')) {
    function domationFormatCreator(?array $row): ?array {
        if (!$row) {
            return null;
        }
        $creatorId = (int)($row['creator_id'] ?? $row['created_by'] ?? 0);
        if ($creatorId <= 0) {
            return null;
        }
        return [
            'id'         => $creatorId,
            'name'       => $row['creator_name'] ?? '',
            'email'      => $row['creator_email'] ?? '',
            'avatar_url' => $row['creator_avatar'] ?? null,
            'role'       => $row['creator_role'] ?? '',
        ];
    }
}

if (!function_exists('domationIsPublicOrInternalEndpoint')) {
    function domationIsPublicOrInternalEndpoint(): bool {
        if (php_sapi_name() === 'cli' || defined('DOMATION_INTERNAL_WORKER')) {
            return true;
        }
        $script = basename($_SERVER['SCRIPT_NAME'] ?? '');
        $publicScripts = [
            'track.php',
            'go.php',
            'survey_public.php',
            'voucher_claim.php',
            'identify_visitor.php',
            'otp.php',
            'tracking_script.php',
            'chat_feedback.php',
            'webhook.php',
            'ses_webhook.php',
            'meta_webhook.php',
            'zalo_webhook.php',
            'zalo_oauth_callback.php',
            'zalo_track.php',
        ];
        if (in_array($script, $publicScripts, true) || preg_match('/^webhook.*\.php$/i', $script)) {
            return true;
        }

        // forms.php public routes: route=submit or action=embed or route=embed
        if ($script === 'forms.php') {
            $route = $_GET['route'] ?? '';
            $action = $_GET['action'] ?? '';
            if ($route === 'submit' || $action === 'embed' || $route === 'embed') {
                return true;
            }
        }

        // website_tracking.php public script generation
        if ($script === 'website_tracking.php' && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET' && !empty($_GET['property_id'])) {
            return true;
        }

        // ai_chatbot.php public widget endpoints
        if ($script === 'ai_chatbot.php') {
            $action = $_GET['action'] ?? '';
            if (in_array($action, ['chat', 'init', 'history', 'lead_capture', 'feedback', 'ping'], true)) {
                return true;
            }
        }

        // Internal background worker / cron scripts triggered via localhost or X-Cron-Secret
        if (preg_match('/^(worker_|orchestrator_|cron_|tracking_processor\.php|web_tracking_processor\.php|meta_inbound_processor\.php|zalo_inbound_processor\.php)/i', $script)) {
            $remoteIp = $_SERVER['REMOTE_ADDR'] ?? '';
            $cronSecret = $_SERVER['HTTP_X_CRON_SECRET'] ?? ($_GET['cron_secret'] ?? '');
            $expectedCronSecret = getenv('CRON_SECRET') ?: 'autoflow_cron_2026';
            if (in_array($remoteIp, ['127.0.0.1', '::1', 'localhost'], true) || ($cronSecret !== '' && hash_equals($expectedCronSecret, $cronSecret))) {
                return true;
            }
        }

        return false;
    }
}

$_domationAuth = domationResolveAuth($pdo);
if ($_domationAuth) {
    $current_admin_id = (int)$_domationAuth['user_id'];
    $GLOBALS['current_admin_id'] = $current_admin_id;
    $_SESSION['user_id'] = (int)$_domationAuth['user_id'];
    $_SESSION['org_user_id'] = (int)$_domationAuth['user_id'];
    $_SESSION['role'] = $_domationAuth['role'];
    $_SESSION['full_name'] = $_domationAuth['full_name'];
    $_SESSION['status'] = 'approved';
    $_SESSION['current_workspace_id'] = (int)$_domationAuth['tenant_id'];
    $_SESSION['workspace_id'] = (int)$_domationAuth['tenant_id'];
    $_deptOrTitle = strtolower(trim(($_domationAuth['department'] ?? '') . ' ' . ($_domationAuth['job_title'] ?? '')));
    $_isMktStaff = in_array($_domationAuth['role'], ['marketing', 'mkt', 'digital_marketing', 'content', 'ads'], true)
        || (int)($_domationAuth['team_id'] ?? 0) === 3
        || strpos($_deptOrTitle, 'marketing') !== false
        || strpos($_deptOrTitle, 'mkt') !== false;
    if ($_isMktStaff && !in_array($_domationAuth['role'], ['admin', 'superadmin', 'super_admin', 'director'], true)) {
        $_domationAuth['role'] = 'marketing';
        $GLOBALS['domation_auth']['role'] = 'marketing';
        $_SESSION['role'] = 'marketing';
    }
    $_SESSION['is_admin'] = in_array($_domationAuth['role'], ['admin', 'superadmin', 'super_admin', 'director', 'marketing', 'mkt', 'digital_marketing', 'manager'], true) || $_isMktStaff;
} else {
    $current_admin_id = null;
    $GLOBALS['current_admin_id'] = null;
    unset($_SESSION['user_id'], $_SESSION['org_user_id'], $_SESSION['is_admin'], $_SESSION['af_is_admin']);
}

if (session_status() === PHP_SESSION_ACTIVE) {
    @session_write_close();
}

// Enforce JWT authentication immediately on all non-public, non-worker endpoints
if (!domationIsPublicOrInternalEndpoint()) {
    if (!$_domationAuth) {
        jsonResponse(false, null, 'Unauthorized: Token không hợp lệ hoặc đã hết hạn.', [], 401);
    }
    $allowedRoles = ['admin', 'superadmin', 'super_admin', 'director', 'marketing', 'mkt', 'digital_marketing', 'content', 'ads', 'manager', 'leader', 'team_leader', 'sale_admin', 'saleadmin', 'sale', 'sales'];
    if (!in_array($_domationAuth['role'], $allowedRoles, true)) {
        jsonResponse(false, null, 'Forbidden: Bạn không có quyền truy cập phân hệ Marketing Automation.', [], 403);
    }
}

$GLOBALS['db_needs_migration'] = false;
