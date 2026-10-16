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

// ─── DOMATION CONTACT MATCHER FALLBACK & SAFE HELPER ("3 KHÔNG" MANDATE) ─────
if (!class_exists('DomationContactMatcher')) {
    class DomationContactMatcher {
        public static function normalizePhone9(?string $phone): string {
            if (!$phone) return '';
            $digits = preg_replace('/[^0-9]/', '', $phone);
            if ($digits === '') return '';
            if (strpos($digits, '84') === 0 && strlen($digits) >= 11) {
                $digits = substr($digits, 2);
            }
            if (strpos($digits, '0') === 0 && strlen($digits) >= 10) {
                $digits = substr($digits, 1);
            }
            if (strlen($digits) > 9) {
                $digits = substr($digits, -9);
            }
            return strlen($digits) >= 8 ? $digits : '';
        }

        public static function syncSubscriberMatchOnly(PDO $pdo, $subscriberId): array {
            if (empty($subscriberId)) {
                return ['matched' => false, 'contact_id' => null];
            }
            try {
                $stmtSub = $pdo->prepare("SELECT * FROM subscribers WHERE id = ? LIMIT 1");
                $stmtSub->execute([$subscriberId]);
                $sub = $stmtSub->fetch(PDO::FETCH_ASSOC);
                if (!$sub) {
                    return ['matched' => false, 'contact_id' => null];
                }

                $email = strtolower(trim((string)($sub['email'] ?? '')));
                if ($email !== '' && strpos($email, '@no-email.domation') !== false) {
                    $email = '';
                }
                $phoneRaw = trim((string)($sub['phone'] ?? ''));
                $phone9 = self::normalizePhone9($phoneRaw);

                $contactId = !empty($sub['myerp_contact_id']) ? (int)$sub['myerp_contact_id'] : 0;
                if ($contactId > 0) {
                    $chk = $pdo->prepare("SELECT id FROM contacts WHERE id = ? AND deleted_at IS NULL LIMIT 1");
                    $chk->execute([$contactId]);
                    if (!$chk->fetchColumn()) {
                        $contactId = 0;
                    }
                }

                if ($contactId <= 0 && ($email !== '' || $phone9 !== '')) {
                    $conds = [];
                    $params = [];
                    if ($email !== '') {
                        $conds[] = "LOWER(TRIM(c.email)) = ?";
                        $params[] = $email;
                    }
                    if ($phone9 !== '') {
                        $conds[] = "(RIGHT(REGEXP_REPLACE(COALESCE(c.phone,''), '[^0-9]', ''), 9) = ? OR RIGHT(REGEXP_REPLACE(COALESCE(c.mobile,''), '[^0-9]', ''), 9) = ?)";
                        $params[] = $phone9;
                        $params[] = $phone9;
                    }
                    $sqlFind = "SELECT c.id FROM contacts c WHERE c.deleted_at IS NULL AND (" . implode(' OR ', $conds) . ") ORDER BY c.id DESC LIMIT 1";
                    try {
                        $stmtFind = $pdo->prepare($sqlFind);
                        $stmtFind->execute($params);
                        $contactId = (int)($stmtFind->fetchColumn() ?: 0);
                    } catch (\Throwable $eRegex) {
                        // Fallback if MySQL REGEXP_REPLACE not supported
                        $condsFb = [];
                        $paramsFb = [];
                        if ($email !== '') {
                            $condsFb[] = "LOWER(TRIM(c.email)) = ?";
                            $paramsFb[] = $email;
                        }
                        if ($phone9 !== '') {
                            $condsFb[] = "(c.phone LIKE ? OR c.mobile LIKE ?)";
                            $paramsFb[] = '%' . $phone9;
                            $paramsFb[] = '%' . $phone9;
                        }
                        $stmtFind = $pdo->prepare("SELECT c.id FROM contacts c WHERE c.deleted_at IS NULL AND (" . implode(' OR ', $condsFb) . ") ORDER BY c.id DESC LIMIT 1");
                        $stmtFind->execute($paramsFb);
                        $contactId = (int)($stmtFind->fetchColumn() ?: 0);
                    }
                }

                // STRICT "3 KHÔNG": NEVER INSERT INTO contacts, NEVER change owner_id/stage/status, NEVER notify!
                if ($contactId <= 0) {
                    return ['matched' => false, 'contact_id' => null];
                }

                // Link subscriber and child tables to $contactId
                try {
                    $pdo->prepare("UPDATE subscribers SET myerp_contact_id = ? WHERE id = ?")->execute([$contactId, $subscriberId]);
                } catch (\Throwable $e) {}

                $childTablesBySub = [
                    'web_visitors' => 'subscriber_id',
                    'web_sessions' => 'subscriber_id',
                    'web_page_views' => 'subscriber_id',
                    'web_form_submissions' => 'subscriber_id',
                    'survey_responses' => 'subscriber_id',
                    'voucher_codes' => 'assigned_to_subscriber_id',
                    'voucher_claims' => 'subscriber_id',
                    'domation_ai_conversations' => 'subscriber_id',
                    'meta_conversations' => 'subscriber_id',
                    'zalo_followers' => 'subscriber_id',
                ];
                foreach ($childTablesBySub as $tbl => $col) {
                    try {
                        $pdo->prepare("UPDATE `$tbl` SET myerp_contact_id = ? WHERE `$col` = ? AND (myerp_contact_id IS NULL OR myerp_contact_id = 0)")
                            ->execute([$contactId, $subscriberId]);
                    } catch (\Throwable $e) {}
                }

                self::refreshContactStats($pdo, $contactId);
                return ['matched' => true, 'contact_id' => $contactId];
            } catch (\Throwable $e) {
                error_log("[DomationContactMatcher::syncSubscriberMatchOnly] " . $e->getMessage());
                return ['matched' => false, 'contact_id' => null];
            }
        }

        public static function syncContactMatchOnly(PDO $pdo, int $contactId): array {
            if ($contactId <= 0) return ['matched' => false, 'subscriber_id' => null];
            try {
                $stmtC = $pdo->prepare("SELECT id, email, phone, mobile, domation_subscriber_id FROM contacts WHERE id = ? AND deleted_at IS NULL LIMIT 1");
                $stmtC->execute([$contactId]);
                $contact = $stmtC->fetch(PDO::FETCH_ASSOC);
                if (!$contact) return ['matched' => false, 'subscriber_id' => null];

                $email = strtolower(trim((string)($contact['email'] ?? '')));
                $phone9 = self::normalizePhone9($contact['phone'] ?? '') ?: self::normalizePhone9($contact['mobile'] ?? '');

                $subId = (int)($contact['domation_subscriber_id'] ?? 0);
                if ($email !== '' || $phone9 !== '') {
                    $conds = ["myerp_contact_id = ?"];
                    $params = [$contactId];
                    if ($email !== '') {
                        $conds[] = "LOWER(TRIM(email)) = ?";
                        $params[] = $email;
                    }
                    if ($phone9 !== '') {
                        $conds[] = "phone LIKE ?";
                        $params[] = '%' . $phone9;
                    }
                    $stmtS = $pdo->prepare("SELECT id FROM subscribers WHERE " . implode(' OR ', $conds) . " ORDER BY updated_at DESC, id DESC LIMIT 1");
                    $stmtS->execute($params);
                    $foundSubId = (int)($stmtS->fetchColumn() ?: 0);
                    if ($foundSubId > 0) {
                        $subId = $foundSubId;
                        $pdo->prepare("UPDATE subscribers SET myerp_contact_id = ? WHERE id = ?")->execute([$contactId, $subId]);
                    }

                    // Also match conversations/responses by email or phone9
                    if ($email !== '') {
                        foreach (['survey_responses' => 'respondent_email', 'voucher_claims' => 'email', 'domation_ai_conversations' => 'visitor_email'] as $t => $c) {
                            try {
                                $pdo->prepare("UPDATE `$t` SET myerp_contact_id = ? WHERE LOWER(TRIM(`$c`)) = ? AND (myerp_contact_id IS NULL OR myerp_contact_id = 0)")
                                    ->execute([$contactId, $email]);
                            } catch (\Throwable $e) {}
                        }
                    }
                    if ($phone9 !== '') {
                        foreach (['voucher_claims' => 'phone', 'domation_ai_conversations' => 'visitor_phone', 'meta_conversations' => 'extracted_phone', 'zalo_followers' => 'phone'] as $t => $c) {
                            try {
                                $pdo->prepare("UPDATE `$t` SET myerp_contact_id = ? WHERE `$c` LIKE ? AND (myerp_contact_id IS NULL OR myerp_contact_id = 0)")
                                    ->execute([$contactId, '%' . $phone9]);
                            } catch (\Throwable $e) {}
                        }
                    }
                }

                if ($subId > 0) {
                    self::syncSubscriberMatchOnly($pdo, $subId);
                } else {
                    self::refreshContactStats($pdo, $contactId);
                }
                return ['matched' => $subId > 0, 'subscriber_id' => $subId ?: null];
            } catch (\Throwable $e) {
                return ['matched' => false, 'subscriber_id' => null];
            }
        }

        public static function refreshContactStats(PDO $pdo, int $contactId): void {
            if ($contactId <= 0) return;
            try {
                $stmtSub = $pdo->prepare("SELECT * FROM subscribers WHERE myerp_contact_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1");
                $stmtSub->execute([$contactId]);
                $sub = $stmtSub->fetch(PDO::FETCH_ASSOC);
                $subId = $sub ? (int)$sub['id'] : null;

                $activeFlowsCount = 0;
                $completedFlowsCount = 0;
                $activeFlowNames = null;
                if ($subId) {
                    $stmtF = $pdo->prepare("
                        SELECT sfs.status, f.name
                        FROM subscriber_flow_states sfs
                        LEFT JOIN flows f ON f.id = sfs.flow_id
                        WHERE sfs.subscriber_id = ?
                    ");
                    $stmtF->execute([$subId]);
                    $fRows = $stmtF->fetchAll(PDO::FETCH_ASSOC) ?: [];
                    $names = [];
                    foreach ($fRows as $fr) {
                        $st = strtolower((string)($fr['status'] ?? ''));
                        if (in_array($st, ['active', 'waiting', 'paused', 'processing'], true)) {
                            $activeFlowsCount++;
                            if (!empty($fr['name'])) $names[] = $fr['name'];
                        } elseif (in_array($st, ['completed', 'finished'], true)) {
                            $completedFlowsCount++;
                        }
                    }
                    if (!empty($names)) {
                        $activeFlowNames = implode(', ', array_unique($names));
                    }
                }

                // Web sessions & pageviews
                $webSessions = 0;
                $webPageviews = 0;
                $lastWebVisitAt = $sub['last_visit_at'] ?? null;
                try {
                    $stmtWS = $pdo->prepare("SELECT COUNT(*), COALESCE(SUM(page_count),0), MAX(started_at) FROM web_sessions WHERE myerp_contact_id = ?" . ($subId ? " OR subscriber_id = " . (int)$subId : ""));
                    $stmtWS->execute([$contactId]);
                    $wsRow = $stmtWS->fetch(PDO::FETCH_NUM);
                    if ($wsRow) {
                        $webSessions = max((int)($sub['visit_count'] ?? 0), (int)$wsRow[0]);
                        $webPageviews = max((int)($sub['total_pageviews'] ?? 0), (int)$wsRow[1]);
                        if (!empty($wsRow[2]) && (!$lastWebVisitAt || $wsRow[2] > $lastWebVisitAt)) {
                            $lastWebVisitAt = $wsRow[2];
                        }
                    }
                } catch (\Throwable $e) {}

                // Surveys
                $surveyCount = 0;
                try {
                    $stmtSR = $pdo->prepare("SELECT COUNT(*) FROM survey_responses WHERE myerp_contact_id = ?" . ($subId ? " OR subscriber_id = " . (int)$subId : ""));
                    $stmtSR->execute([$contactId]);
                    $surveyCount = (int)$stmtSR->fetchColumn();
                } catch (\Throwable $e) {}

                // Vouchers
                $voucherCount = 0;
                $activeVoucherCode = null;
                try {
                    $stmtVC = $pdo->prepare("SELECT code, status FROM voucher_codes WHERE myerp_contact_id = ?" . ($subId ? " OR assigned_to_subscriber_id = " . (int)$subId : "") . " ORDER BY assigned_at DESC, id DESC");
                    $stmtVC->execute([$contactId]);
                    $vcRows = $stmtVC->fetchAll(PDO::FETCH_ASSOC) ?: [];
                    $voucherCount = count($vcRows);
                    foreach ($vcRows as $vcr) {
                        if (($vcr['status'] ?? '') === 'assigned' && !$activeVoucherCode) {
                            $activeVoucherCode = $vcr['code'];
                        }
                    }
                } catch (\Throwable $e) {}

                // Zalo & Meta IDs
                $zaloUserId = null;
                $metaPsid = null;
                try {
                    $stmtZ = $pdo->prepare("SELECT user_id FROM zalo_followers WHERE myerp_contact_id = ?" . ($subId ? " OR subscriber_id = " . (int)$subId : "") . " LIMIT 1");
                    $stmtZ->execute([$contactId]);
                    $zaloUserId = $stmtZ->fetchColumn() ?: null;
                } catch (\Throwable $e) {}
                try {
                    $stmtM = $pdo->prepare("SELECT psid FROM meta_conversations WHERE myerp_contact_id = ?" . ($subId ? " OR subscriber_id = " . (int)$subId : "") . " LIMIT 1");
                    $stmtM->execute([$contactId]);
                    $metaPsid = $stmtM->fetchColumn() ?: null;
                } catch (\Throwable $e) {}

                $pdo->prepare("
                    UPDATE contacts SET
                        domation_subscriber_id = ?,
                        domation_engagement_score = ?,
                        domation_temperature = ?,
                        domation_marketing_status = ?,
                        domation_email_sent = ?,
                        domation_email_opened = ?,
                        domation_email_clicked = ?,
                        domation_last_email_open_at = ?,
                        domation_last_email_click_at = ?,
                        domation_web_sessions = ?,
                        domation_web_pageviews = ?,
                        domation_last_web_visit_at = ?,
                        domation_active_flows_count = ?,
                        domation_active_flow_names = ?,
                        domation_completed_flows_count = ?,
                        domation_survey_completed_count = ?,
                        domation_voucher_count = ?,
                        domation_active_voucher_code = ?,
                        domation_zalo_user_id = COALESCE(?, domation_zalo_user_id),
                        domation_meta_psid = COALESCE(?, domation_meta_psid),
                        domation_last_synced_at = NOW()
                    WHERE id = ?
                ")->execute([
                    $subId,
                    (int)($sub['engagement_score'] ?? 0),
                    $sub['temperature'] ?? 'Cold',
                    $sub['status'] ?? 'active',
                    (int)($sub['stats_sent'] ?? 0),
                    (int)($sub['stats_opened'] ?? 0),
                    (int)($sub['stats_clicked'] ?? 0),
                    $sub['last_open_at'] ?? null,
                    $sub['last_click_at'] ?? null,
                    $webSessions,
                    $webPageviews,
                    $lastWebVisitAt,
                    $activeFlowsCount,
                    $activeFlowNames,
                    $completedFlowsCount,
                    $surveyCount,
                    $voucherCount,
                    $activeVoucherCode,
                    $zaloUserId,
                    $metaPsid,
                    $contactId
                ]);
            } catch (\Throwable $e) {
                // Silent ignore if columns are still migrating
            }
        }

        public static function runBulkMatchAndRefresh(PDO $pdo): array {
            $matchedCount = 0;
            try {
                $stmt = $pdo->query("SELECT id FROM subscribers ORDER BY id DESC LIMIT 5000");
                $subIds = $stmt ? $stmt->fetchAll(PDO::FETCH_COLUMN) : [];
                foreach ($subIds as $sid) {
                    $res = self::syncSubscriberMatchOnly($pdo, (int)$sid);
                    if (!empty($res['matched'])) {
                        $matchedCount++;
                    }
                }
            } catch (\Throwable $e) {
            }
            return ['matched_subscribers' => $matchedCount];
        }
    }
}

if (!function_exists('domationSyncSubscriberMatchOnly')) {
    function domationSyncSubscriberMatchOnly(PDO $pdo, $subscriberId): void {
        if (empty($subscriberId)) return;
        try {
            if (class_exists('DomationContactMatcher')) {
                if (method_exists('DomationContactMatcher', 'syncSubscriberMatchOnly')) {
                    DomationContactMatcher::syncSubscriberMatchOnly($pdo, (int)$subscriberId);
                } elseif (method_exists('DomationContactMatcher', 'matchSubscriber')) {
                    DomationContactMatcher::matchSubscriber($pdo, (int)$subscriberId);
                }
            }
        } catch (\Throwable $e) {
            error_log("[domationSyncSubscriberMatchOnly] " . $e->getMessage());
        }
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
            $stmt = $pdo->prepare("SELECT id, tenant_id, role, full_name, email, permissions_json, is_active FROM users WHERE id = ? AND is_active = 1 LIMIT 1");
            $stmt->execute([$userId]);
            $dbUser = $stmt->fetch(PDO::FETCH_ASSOC);
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
                'permissions' => !empty($dbUser['permissions_json']) ? json_decode($dbUser['permissions_json'], true) : null,
            ];
            $GLOBALS['domation_auth'] = $authData;
            return $authData;
        } catch (\Throwable $e) {
            return null;
        }
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
    $_SESSION['is_admin'] = in_array($_domationAuth['role'], ['admin', 'superadmin', 'super_admin', 'director', 'marketing'], true);
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
    $allowedRoles = ['admin', 'superadmin', 'super_admin', 'director', 'marketing', 'manager', 'leader', 'sale_admin', 'saleadmin', 'sale', 'sales'];
    if (!in_array($_domationAuth['role'], $allowedRoles, true)) {
        jsonResponse(false, null, 'Forbidden: Bạn không có quyền truy cập phân hệ Marketing Automation.', [], 403);
    }
}

$GLOBALS['db_needs_migration'] = false;
