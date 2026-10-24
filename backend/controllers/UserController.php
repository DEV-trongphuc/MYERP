<?php
class UserController {
    private PDO $db;
    public function __construct(PDO $db) { 
        $this->db = $db; 
    }

    public static function invalidateUserCaches(int $tenantId = 1, int $userId = 0): void {
        $tmpDir = sys_get_temp_dir();
        if ($userId > 0) {
            @unlink($tmpDir . "/myerp_auth_u_{$userId}_{$tenantId}.json");
            @unlink($tmpDir . "/myerp_api_u_{$userId}.json");
        }
        foreach (glob($tmpDir . "/myerp_users_list_t{$tenantId}_*.json") ?: [] as $f) {
            @unlink($f);
        }
        foreach (glob($tmpDir . "/myerp_chat_staff_t{$tenantId}*.json") ?: [] as $f) {
            @unlink($f);
        }
    }

    private function persistInlineBase64Asset(int $userId, string $dataUri, string $subDir, string $prefix): ?string {
        if (strpos($dataUri, 'data:image/') !== 0) return null;
        $commaPos = strpos($dataUri, ',');
        if ($commaPos === false) return null;
        $meta = substr($dataUri, 0, $commaPos);
        $ext = 'png';
        if (preg_match('/^data:image\/([a-zA-Z0-9+.-]+);base64$/', $meta, $m)) {
            $rawExt = strtolower($m[1]);
            if ($rawExt === 'jpeg') $ext = 'jpg';
            elseif (in_array($rawExt, ['png', 'jpg', 'webp', 'gif'], true)) $ext = $rawExt;
        }
        $decoded = base64_decode(substr($dataUri, $commaPos + 1));
        if ($decoded === false || strlen($decoded) < 16) return null;
        $dir = __DIR__ . '/../uploads/' . trim($subDir, '/') . '/';
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        $fileName = $prefix . '_' . $userId . '_' . substr(md5($dataUri), 0, 10) . '.' . $ext;
        $fullPath = $dir . $fileName;
        if (!file_exists($fullPath)) {
            @file_put_contents($fullPath, $decoded);
        }
        if (file_exists($fullPath) && filesize($fullPath) > 0) {
            return 'uploads/' . trim($subDir, '/') . '/' . $fileName;
        }
        return null;
    }

    public function index(array $auth): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);
        $role = strtolower((string)($auth['role'] ?? ''));
        $teamOnlyFlag = isset($_GET['team_only']) && (string)$_GET['team_only'] === '1';
        $canViewSensitivePii = in_array($role, ['admin', 'super_admin', 'superadmin', 'director', 'hr'], true);
        $cacheKey = sprintf(
            '%s/myerp_users_list_t%d_r%s_to%d_u%d.json',
            sys_get_temp_dir(),
            $tid,
            preg_replace('/[^a-z0-9_]/', '', $role),
            $teamOnlyFlag ? 1 : 0,
            ($teamOnlyFlag || !$canViewSensitivePii) ? $uid : 0
        );
        if (empty($_GET['nocache']) && is_file($cacheKey) && (time() - filemtime($cacheKey)) < 60) {
            $cachedRows = json_decode((string)@file_get_contents($cacheKey), true);
            if (is_array($cachedRows)) {
                respond(200, $cachedRows);
            }
        }
        // Allow all authenticated users to retrieve the active user list based on unified accounts.is_active = 1
        $where = [
            "a.is_active = 1",
            "a.id != 9000001",
            "LOWER(COALESCE(a.role, '')) NOT IN ('bot', 'system')",
            "LOWER(COALESCE(a.email, '')) NOT IN ('turniodev@gmail.com', 'turnlodev@gmail.com', 'ideas.ai@ideas.vn', 'ai@ideas.edu.vn')",
            "LOWER(COALESCE(NULLIF(a.status, ''), 'active')) NOT IN ('inactive', 'locked', 'resigned', 'terminated', 'disabled', 'nghi_viec', 'tam_nghi', 'suspended', 'khoa')"
        ];
        $params = [];
        
        $teamOnly = isset($_GET['team_only']) && (string)$_GET['team_only'] === '1';
        if ($teamOnly) {
            if ($auth['role'] === 'manager') {
                $where[] = "(a.id = ? OR a.team_id IN (SELECT id FROM teams WHERE leader_id = ?) OR a.team_id = (SELECT team_id FROM accounts WHERE id = ?) OR a.role IN ('admin', 'super_admin', 'superadmin', 'director', 'accountant', 'hr'))";
                $params[] = $auth['user_id'];
                $params[] = $auth['user_id'];
                $params[] = $auth['user_id'];
            } else if (in_array($auth['role'], ['sales', 'sale'], true)) {
                $tStmt = $this->db->prepare("SELECT team_id FROM accounts WHERE id = ?");
                $tStmt->execute([$auth['user_id']]);
                $teamRow = $tStmt->fetch();
                $teamId = $teamRow ? $teamRow['team_id'] : null;
                if ($teamId) {
                    $where[] = "(a.role IN ('admin', 'super_admin', 'superadmin', 'director', 'manager', 'accountant', 'hr') OR a.team_id = ?)";
                    $params[] = $teamId;
                } else {
                    $where[] = "(a.role IN ('admin', 'super_admin', 'superadmin', 'director', 'manager', 'accountant', 'hr') OR a.id = ?)";
                    $params[] = $auth['user_id'];
                }
            }
        }

        $fallbackWhereClause = implode(" AND ", $where);
        $fallbackParams = $params;

        $joinWhere = $where;
        $joinParams = $params;
        $joinWhere[] = "(u.tenant_id = ? OR u.tenant_id IS NULL)";
        $joinParams[] = (int)($auth['tenant_id'] ?? 1);
        $joinWhere[] = "(u.is_active = 1 OR u.is_active IS NULL)";
        $joinWhere[] = "LOWER(COALESCE(NULLIF(u.status, ''), NULLIF(a.status, ''), 'active')) NOT IN ('inactive', 'locked', 'resigned', 'terminated', 'disabled', 'nghi_viec', 'tam_nghi', 'suspended', 'khoa')";
        $joinWhere[] = "LOWER(COALESCE(u.role, a.role, '')) NOT IN ('bot', 'system')";
        $delFlagFile = sys_get_temp_dir() . '/myerp_users_has_deleted_at.flag';
        if (is_file($delFlagFile)) {
            if (trim((string)@file_get_contents($delFlagFile)) === '1') {
                $joinWhere[] = "u.deleted_at IS NULL";
            }
        } else {
            try {
                $uCols = $this->db->query("SHOW COLUMNS FROM users LIKE 'deleted_at'")->fetch();
                @file_put_contents($delFlagFile, $uCols ? '1' : '0');
                if ($uCols) {
                    $joinWhere[] = "u.deleted_at IS NULL";
                }
            } catch (Throwable $eCol) {}
        }

        $whereClause = implode(" AND ", $joinWhere);
        
        try {
            $stmt = $this->db->prepare("
                SELECT 
                    a.id,
                    a.email,
                    COALESCE(u.full_name, a.name) as full_name,
                    a.name,
                    a.username,
                    a.role,
                    'active' as status,
                    COALESCE(NULLIF(u.job_title, ''), NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.address, '$.erp_profile.job_title')), ''), '') as job_title,
                    COALESCE(u.department, '') as department,
                    COALESCE(u.avatar_url, a.avatar) as avatar_url,
                    COALESCE(u.avatar_url, a.avatar) as avatar,
                    COALESCE(u.signature_url, a.signature_url) as signature_url,
                    COALESCE(u.phone, a.phone) as phone,
                    1 as is_active,
                    COALESCE(u.last_login_at, a.last_login) as last_login_at,
                    COALESCE(u.created_at, a.created_at) as created_at,
                    COALESCE(u.dob, a.dob) as dob,
                    COALESCE(u.gender, a.gender) as gender,
                    COALESCE(u.citizen_id, a.citizen_id) as citizen_id,
                    COALESCE(u.address, a.address) as address,
                    COALESCE(u.bank_name, a.bank_name) as bank_name,
                    COALESCE(u.bank_account, a.bank_account) as bank_account,
                    COALESCE(a.team_id, u.team_id) as team_id,
                    u.permissions_json,
                    u.bio,
                    u.extra_fields_json,
                    u.manager_behavior_mode
                FROM accounts a
                LEFT JOIN users u ON a.id = u.id
                WHERE $whereClause
                ORDER BY full_name ASC
            ");
            $stmt->execute(array_values($joinParams));
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            $canViewSensitivePii = in_array(strtolower($auth['role'] ?? ''), ['admin', 'super_admin', 'superadmin', 'director', 'hr'], true);
            foreach ($rows as &$r) {
                if (isset($r['role']) && $r['role'] === 'sales') {
                    $r['role'] = 'sale';
                }
                $r['id'] = (int)$r['id'];
                $r['is_active'] = 1;
                if (!empty($r['avatar_url']) && strpos((string)$r['avatar_url'], 'data:image/') === 0) {
                    $savedAvatar = $this->persistInlineBase64Asset($r['id'], (string)$r['avatar_url'], 'avatars', 'avt');
                    if ($savedAvatar) {
                        $r['avatar_url'] = $savedAvatar;
                        $r['avatar'] = $savedAvatar;
                        try {
                            $this->db->prepare("UPDATE users SET avatar_url = ? WHERE id = ?")->execute([$savedAvatar, $r['id']]);
                            $this->db->prepare("UPDATE accounts SET avatar = ? WHERE id = ?")->execute([$savedAvatar, $r['id']]);
                        } catch (Throwable $ignoreAv) {}
                    }
                }
                if (!empty($r['signature_url']) && strpos((string)$r['signature_url'], 'data:image/') === 0) {
                    $savedSig = $this->persistInlineBase64Asset($r['id'], (string)$r['signature_url'], 'signatures', 'sig');
                    if ($savedSig) {
                        $r['signature_url'] = $savedSig;
                        try {
                            $this->db->prepare("UPDATE users SET signature_url = ? WHERE id = ?")->execute([$savedSig, $r['id']]);
                            $this->db->prepare("UPDATE accounts SET signature_url = ? WHERE id = ?")->execute([$savedSig, $r['id']]);
                        } catch (Throwable $ignoreSig) {}
                    }
                }
                // Bảo mật Zero-Trust: Chỉ HR/Admin hoặc chính chủ mới được thấy CCCD, ngân hàng, địa chỉ
                if (!$canViewSensitivePii && (int)$r['id'] !== (int)$auth['user_id']) {
                    unset($r['citizen_id'], $r['bank_name'], $r['bank_account'], $r['address'], $r['dob']);
                }
            }
            @file_put_contents($cacheKey, json_encode($rows, JSON_UNESCAPED_UNICODE));
            respond(200, $rows);
        } catch (Throwable $e) {
            try {
                $stmt = $this->db->prepare("
                    SELECT a.id, a.email, a.name as full_name, a.name, a.role, 'active' as status, '' as department, a.avatar as avatar_url, a.avatar, a.phone, 1 as is_active, a.created_at, a.team_id
                    FROM accounts a
                    WHERE $fallbackWhereClause
                    ORDER BY full_name ASC
                ");
                $stmt->execute(array_values($fallbackParams));
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                foreach ($rows as &$r) {
                    if (isset($r['role']) && $r['role'] === 'sales') {
                        $r['role'] = 'sale';
                    }
                    $r['id'] = (int)$r['id'];
                    $r['is_active'] = 1;
                }
                respond(200, $rows);
            } catch (Throwable $e2) {
                respond(500, null, 'Lỗi nạp danh sách nhân sự: ' . $e2->getMessage(), false);
            }
        }
    }

    public function store(array $auth): void {
        if (!in_array($auth['role'], ['admin', 'super_admin', 'superadmin', 'director', 'hr'], true)) respond(403, null, 'Quyền admin là bắt buộc', false);
        $b=getBody();
        if(empty($b['email'])||empty($b['password'])||empty($b['full_name'])) respond(422,null,'Email, mật khẩu và tên là bắt buộc',false);
        // Check duplicate
        $chk=$this->db->prepare("SELECT id FROM users WHERE email=? AND tenant_id=?");
        $chk->execute([$b['email'],$auth['tenant_id']]);
        if($chk->fetch()) respond(409,null,'Email đã tồn tại trong hệ thống',false);
        $hash=password_hash($b['password'],PASSWORD_BCRYPT,['cost'=>12]);
        $rawRole = $b['role'] ?? 'sales';
        $dbUserRole = ($rawRole === 'sale') ? 'sales' : $rawRole;
        $this->db->prepare("INSERT INTO users (tenant_id,email,password_hash,full_name,role,phone,dob,gender,citizen_id,address,bank_name,bank_account) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
            ->execute([
                $auth['tenant_id'],
                $b['email'],
                $hash,
                $b['full_name'],
                $dbUserRole,
                $b['phone']??null,
                $b['dob']??null,
                $b['gender']??null,
                $b['citizen_id']??null,
                $b['address']??null,
                $b['bank_name']??null,
                $b['bank_account']??null
            ]);
        $newId = (int)$this->db->lastInsertId();
        self::invalidateUserCaches((int)($auth['tenant_id'] ?? 1), $newId);
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'CREATE', 'user', $newId, json_encode(['email' => $b['email'], 'role' => $dbUserRole]));
        $this->show($auth, $newId);
    }
    public function show(array $auth,int $id): void {
        if (!in_array($auth['role'], ['admin', 'super_admin', 'superadmin', 'director', 'manager', 'sales', 'sale', 'assistant', 'viewer', 'hr', 'sale_admin', 'saleadmin', 'accountant', 'marketing', 'academic', 'hoc_vu', 'hoc_thuat', 'dao_tao', 'tro_giang', 'teacher', 'giang_vien', 'giao_vien', 'tutor', 'staff', 'employee'], true)) {
            respond(403, null, 'Quyền truy cập không đủ', false);
        }
        try {
            $stmt=$this->db->prepare("SELECT id,email,full_name,role,job_title,department,avatar_url,signature_url,phone,is_active,last_login_at,created_at,dob,gender,citizen_id,address,bank_name,bank_account,two_factor_enabled,two_factor_type,permissions_json,bio,extra_fields_json,manager_behavior_mode,work_start_time,work_end_time,work_schedule,vacation_mode,overtime_mode,use_custom_work_hours,leave_start,leave_end,team_id FROM users WHERE id=? AND tenant_id=?");
            $stmt->execute([$id,$auth['tenant_id']]); $row=$stmt->fetch();
        } catch (PDOException $e) {
            $stmt=$this->db->prepare("SELECT id,email,full_name,role,avatar_url,signature_url,phone,is_active,last_login_at,created_at FROM users WHERE id=? AND tenant_id=?");
            $stmt->execute([$id,$auth['tenant_id']]); $row=$stmt->fetch();
        }
        if(!$row) respond(404,null,'Không tìm thấy người dùng',false);
        $canViewSensitivePii = in_array(strtolower($auth['role'] ?? ''), ['admin', 'super_admin', 'superadmin', 'director', 'hr'], true);
        if (!$canViewSensitivePii && (int)$row['id'] !== (int)$auth['user_id']) {
            unset($row['citizen_id'], $row['bank_name'], $row['bank_account'], $row['address'], $row['dob']);
        }
        respond(200,$row);
    }
    public function update(array $auth,int $id): void {
        if (!in_array($auth['role'], ['admin', 'super_admin', 'superadmin', 'director', 'hr'], true) && (int)$auth['user_id'] !== (int)$id) respond(403, null, 'Không có quyền cập nhật thông tin người khác', false);
        
        $b = getBody();
        $fields = ['email', 'full_name', 'phone', 'department', 'avatar_url', 'signature_url', 'dob', 'gender', 'citizen_id', 'address', 'bank_name', 'bank_account', 'zalo_chat_id', 'telegram_chat_id', 'bio', 'extra_fields_json'];
        if (in_array($auth['role'], ['admin', 'super_admin', 'superadmin', 'director', 'hr'], true)) {
            $fields[] = 'role';
            $fields[] = 'is_active';
            $fields[] = 'permissions_json';
            $fields[] = 'job_title';
            $fields[] = 'team_id';
            $fields[] = 'manager_behavior_mode';
            $fields[] = 'work_start_time';
            $fields[] = 'work_end_time';
            $fields[] = 'work_schedule';
            $fields[] = 'vacation_mode';
            $fields[] = 'overtime_mode';
            $fields[] = 'use_custom_work_hours';
            $fields[] = 'leave_start';
            $fields[] = 'leave_end';
        }

        // Admin lockout prevention
        if ($auth['user_id'] === $id) {
            if (isset($b['role']) && !in_array($b['role'], ['admin', 'super_admin', 'superadmin', 'director'], true)) {
                respond(403, null, 'Bạn không thể tự tước quyền quản trị của chính mình', false);
            }
            if (isset($b['is_active']) && !$b['is_active']) {
                respond(403, null, 'Bạn không thể tự khóa tài khoản của chính mình', false);
            }
        }

        // Fetch current user row to check for old avatar and signature
        $oldUserStmt = $this->db->prepare("SELECT email, avatar_url, signature_url FROM users WHERE id = ? AND tenant_id = ?");
        $oldUserStmt->execute([$id, $auth['tenant_id']]);
        $oldUser = $oldUserStmt->fetch(PDO::FETCH_ASSOC);

        // Delete old physical signature if new signature URL or base64 is provided
        if (!empty($b['signature_url']) && $oldUser && !empty($oldUser['signature_url']) && $oldUser['signature_url'] !== $b['signature_url']) {
            deleteServerFile($oldUser['signature_url']);
        }

        // Save base64 signature as image file if provided
        if (!empty($b['signature_url']) && strpos($b['signature_url'], 'data:image/') === 0) {
            if (preg_match('/^data:image\/(\w+);base64,/', $b['signature_url'])) {
                $base64Data = substr($b['signature_url'], strpos($b['signature_url'], ',') + 1);
                $decoded = base64_decode($base64Data);
                if ($decoded !== false) {
                    $sigDir = __DIR__ . '/../uploads/signatures/';
                    if (!file_exists($sigDir)) {
                        @mkdir($sigDir, 0755, true);
                    }
                    $sigFileName = 'sig_' . (int)$id . '_' . time() . '_' . substr(md5(uniqid()), 0, 6) . '.png';
                    $sigPath = $sigDir . $sigFileName;
                    
                    require_once __DIR__ . '/../config/ImageHelper.php';
                    if (ImageHelper::saveCleanPngSignature($decoded, $sigPath)) {
                        $b['signature_url'] = 'uploads/signatures/' . $sigFileName;
                    } else {
                        respond(400, null, 'Chữ ký tải lên không đúng định dạng hình ảnh hợp lệ', false);
                    }
                }
            }
        }

        // Delete old physical avatar file if new avatar_url is provided and differs
        if (array_key_exists('avatar_url', $b) && $oldUser && !empty($oldUser['avatar_url']) && $oldUser['avatar_url'] !== $b['avatar_url']) {
            deleteServerFile($oldUser['avatar_url']);
        }

        $sets=[];$params=[];
        foreach($fields as $f){
            if(array_key_exists($f,$b)){
                $val = $b[$f];
                if ($f === 'role') {
                    $val = ($val === 'sale') ? 'sales' : $val;
                } else if (in_array($f, ['dob', 'leave_start', 'leave_end']) && ($val === '' || $val === null || $val === 'null')) {
                    $val = null;
                } else if (in_array($f, ['team_id']) && (empty($val) || $val === 0 || $val === '0' || $val === 'null')) {
                    $val = null;
                } else if (in_array($f, ['permissions_json', 'extra_fields_json', 'work_schedule']) && is_array($val)) {
                    $val = json_encode($val);
                }
                $sets[]="$f=?";
                $params[]=$val;
            }
        }
        if(!empty($b['password'])){$sets[]='password_hash=?';$params[]=password_hash($b['password'],PASSWORD_BCRYPT,['cost'=>12]);}
        if(!$sets) respond(422,null,'Không có dữ liệu',false);
        $params[]=$id;$params[]=$auth['tenant_id'];
        $this->db->prepare("UPDATE users SET ".implode(',',$sets)." WHERE id=? AND tenant_id=?")->execute(array_values($params));

        // Sync matching columns into accounts table so UserController::index() reflects updates immediately
        try {
            $accSets = [];
            $accParams = [];
            $accMap = [
                'full_name' => 'name',
                'email' => 'email',
                'role' => 'role',
                'phone' => 'phone',
                'avatar_url' => 'avatar',
                'signature_url' => 'signature_url',
                'team_id' => 'team_id',
                'dob' => 'dob',
                'gender' => 'gender',
                'citizen_id' => 'citizen_id',
                'address' => 'address',
                'bank_name' => 'bank_name',
                'bank_account' => 'bank_account',
                'is_active' => 'is_active',
            ];
            foreach ($accMap as $uKey => $aCol) {
                if (array_key_exists($uKey, $b) && in_array($uKey, $fields, true)) {
                    $aVal = $b[$uKey];
                    if ($uKey === 'role') {
                        $aVal = ($aVal === 'sales') ? 'sale' : $aVal;
                    } elseif ($uKey === 'dob' && ($aVal === '' || $aVal === null || $aVal === 'null')) {
                        $aVal = null;
                    } elseif ($uKey === 'team_id' && (empty($aVal) || $aVal === 0 || $aVal === '0' || $aVal === 'null')) {
                        $aVal = null;
                    }
                    $accSets[] = "$aCol = ?";
                    $accParams[] = $aVal;
                }
            }
            if (!empty($accSets)) {
                $lookupEmail = $oldUser['email'] ?? ($b['email'] ?? '');
                $accParams[] = $id;
                $accParams[] = $lookupEmail;
                $accParams[] = (int)($auth['tenant_id'] ?? 1);
                $this->db->prepare("UPDATE accounts SET " . implode(', ', $accSets) . " WHERE (id = ? OR (email != '' AND email = ?)) AND (tenant_id = ? OR tenant_id IS NULL)")
                    ->execute(array_values($accParams));
            }
            if (array_key_exists('is_active', $b) && in_array('is_active', $fields, true)) {
                $lookupEmail = $oldUser['email'] ?? ($b['email'] ?? '');
                if ((int)$b['is_active'] === 0) {
                    $this->db->prepare("UPDATE consultants SET status = 'inactive' WHERE id = ? OR (email != '' AND email = ?)")
                        ->execute([$id, $lookupEmail]);
                } else {
                    $this->db->prepare("UPDATE consultants SET status = IF(status = 'inactive' OR status IS NULL OR status = '', 'active', status) WHERE id = ? OR (email != '' AND email = ?)")
                        ->execute([$id, $lookupEmail]);
                }
            }
        } catch (\Throwable $eAcc) {}
        
        // Log changes (Masking password)
        $logData = $b;
        if (isset($logData['password'])) unset($logData['password']);
        self::invalidateUserCaches((int)($auth['tenant_id'] ?? 1), (int)$id);
        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE', 'user', $id, json_encode($logData));
        
        $this->show($auth,$id);
    }
    public function destroy(array $auth, int $id): void {
        if (!in_array($auth['role'], ['admin', 'super_admin', 'superadmin', 'director', 'hr'], true)) respond(403, null, 'Quyền admin là bắt buộc', false);
        if($id===$auth['user_id']) respond(403,null,'Không thể xóa tài khoản của chính mình',false);
        try {
            $hasDeletedAt = false;
            try {
                $uCols = $this->db->query("SHOW COLUMNS FROM users LIKE 'deleted_at'")->fetch();
                if ($uCols) $hasDeletedAt = true;
            } catch (\Throwable $eCol) {}

            if ($hasDeletedAt) {
                $this->db->prepare("UPDATE users SET is_active = 0, deleted_at = NOW() WHERE id = ? AND tenant_id = ?")->execute([$id, $auth['tenant_id']]);
            } else {
                $this->db->prepare("UPDATE users SET is_active = 0 WHERE id = ? AND tenant_id = ?")->execute([$id, $auth['tenant_id']]);
            }

            try {
                $this->db->prepare("UPDATE accounts SET is_active = 0 WHERE id = ? AND (tenant_id = ? OR tenant_id IS NULL)")->execute([$id, $auth['tenant_id']]);
            } catch (\Throwable $eAcc) {}

            try {
                $this->db->prepare("UPDATE consultants SET status = 'inactive' WHERE id = ? OR email = (SELECT email FROM users WHERE id = ? LIMIT 1)")->execute([$id, $id]);
            } catch (\Throwable $eCons) {}

            self::invalidateUserCaches((int)($auth['tenant_id'] ?? 1), (int)$id);
            logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'DELETE', 'user', $id);
            respond(200,null,'Đã xóa người dùng');
        } catch (PDOException $e) {
            respond(500, null, 'Lỗi cơ sở dữ liệu: ' . $e->getMessage(), false);
        }
    }

    public function setup2FA(array $auth): void {
        require_once __DIR__ . '/../utils/TOTP.php';

        $stmt = $this->db->prepare("SELECT email FROM users WHERE id = ? LIMIT 1");
        $stmt->execute([$auth['user_id']]);
        $user = $stmt->fetch();
        if (!$user) respond(404, null, 'Người dùng không tồn tại', false);

        $secret = TOTP::generateSecret();
        $otpauthUrl = TOTP::getOtpAuthUrl($user['email'], $secret, 'Ideas');

        // Generate 5 backup codes
        $backupCodes = [];
        for ($i = 0; $i < 5; $i++) {
            $backupCodes[] = str_pad((string)random_int(10000000, 99999999), 8, '0', STR_PAD_LEFT);
        }

        respond(200, [
            'secret' => $secret,
            'otpauth_url' => $otpauthUrl,
            'backup_codes' => $backupCodes
        ]);
    }

    public function enable2FA(array $auth): void {
        $body = getBody();
        $type = trim($body['type'] ?? 'email');
        $code = trim($body['code'] ?? '');
        $secret = trim($body['secret'] ?? '');
        $backupCodes = $body['backup_codes'] ?? [];

        if (!in_array($type, ['email', 'totp'], true)) {
            respond(422, null, 'Phương thức 2FA không hợp lệ', false);
        }

        if ($type === 'totp') {
            if (!$code || !$secret) {
                respond(422, null, 'Vui lòng quét mã QR và nhập mã xác thực từ app', false);
            }
            require_once __DIR__ . '/../utils/TOTP.php';
            if (!TOTP::verifyCode($secret, $code)) {
                respond(400, null, 'Mã xác thực từ ứng dụng không đúng. Vui lòng thử lại.', false);
            }
        }

        $backupCodesJson = is_array($backupCodes) ? json_encode($backupCodes) : null;

        $this->db->prepare("
            UPDATE users 
            SET two_factor_enabled = 1, two_factor_type = ?, two_factor_secret = ?, two_factor_backup_codes = ? 
            WHERE id = ? AND tenant_id = ?
        ")->execute([$type, $secret ?: null, $backupCodesJson, $auth['user_id'], $auth['tenant_id']]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE', 'user_2fa', $auth['user_id'], "Kích hoạt 2FA loại $type");

        respond(200, [
            'two_factor_enabled' => 1,
            'two_factor_type' => $type
        ], 'Đã bật xác thực 2 yếu tố (2FA) thành công');
    }

    public function disable2FA(array $auth): void {
        $body = getBody();
        $password = trim($body['password'] ?? '');

        if (!$password) {
            respond(422, null, 'Vui lòng nhập mật khẩu hiện tại để tắt 2FA', false);
        }

        $stmt = $this->db->prepare("SELECT password_hash FROM users WHERE id = ? LIMIT 1");
        $stmt->execute([$auth['user_id']]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            respond(400, null, 'Mật khẩu hiện tại không chính xác', false);
        }

        $this->db->prepare("
            UPDATE users 
            SET two_factor_enabled = 0, two_factor_secret = NULL, two_factor_backup_codes = NULL 
            WHERE id = ? AND tenant_id = ?
        ")->execute([$auth['user_id'], $auth['tenant_id']]);

        logActivity($this->db, $auth['tenant_id'], $auth['user_id'], 'UPDATE', 'user_2fa', $auth['user_id'], "Tắt 2FA");

        respond(200, [
            'two_factor_enabled' => 0
        ], 'Đã tắt xác thực 2 yếu tố (2FA)');
    }
}
