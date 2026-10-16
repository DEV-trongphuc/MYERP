<?php
// api/zalo_sync_helpers.php - Bidirectional Sync between Main and Zalo

/**
 * Helper to convert Zalo birthday string (DD/MM/YYYY) to SQL Date (YYYY-MM-DD)
 */
function zaloToSqlDate($zaloDate)
{
    if (!$zaloDate)
        return null;
    // Format: 15/10/1997
    if (preg_match('/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/', $zaloDate, $matches)) {
        return sprintf('%04d-%02d-%02d', $matches[3], $matches[2], $matches[1]);
    }
    // If only DD/MM, we can't fully sync to a DATE column reliably without a year
    return null;
}

/**
 * Helper to convert SQL Date (YYYY-MM-DD) to Zalo birthday string (DD/MM/YYYY)
 */
function sqlToZaloDate($sqlDate)
{
    if (!$sqlDate)
        return null;
    $timestamp = strtotime($sqlDate);
    if (!$timestamp)
        return null;
    return date('d/m/Y', $timestamp);
}

/**
 * Sync from Main Subscriber to Zalo Subscriber
 * Called when a main subscriber is created or updated.
 */
function syncMainToZalo($pdo, $mainSubId)
{
    if (!$mainSubId)
        return;

    try {
        $stmt = $pdo->prepare("SELECT email, phone_number, zalo_user_id, first_name, gender, date_of_birth, avatar FROM subscribers WHERE id = ?");
        $stmt->execute([$mainSubId]);
        $sub = $stmt->fetch();
        if (!$sub)
            return;

        $email = trim($sub['email'] ?? '');
        $phone = trim($sub['phone_number'] ?? '');

        if (empty($email) && empty($phone))
            return;

        // Search Zalo subscribers
        $where = [];
        $params = [];
        if (!empty($email)) {
            $where[] = "manual_email = ?";
            $params[] = $email;
        }
        if (!empty($phone)) {
            $where[] = "phone_number = ?";
            $params[] = $phone;
        }

        if (empty($where))
            return;
        $sql = "SELECT id, zalo_user_id, display_name, avatar, gender, birthday, lead_score FROM zalo_subscribers WHERE " . implode(" OR ", $where) . " LIMIT 1";

        $stmtZ = $pdo->prepare($sql);
        $stmtZ->execute($params);
        $zaloSub = $stmtZ->fetch();

        if ($zaloSub) {
            $zaloUserId = $zaloSub['zalo_user_id'];

            // 1. Update Main Subscriber from Zalo Info if Main is missing data
            $updateCols = ["verified = 1", "zalo_user_id = ?", "last_activity_at = NOW()"];
            $upParams = [$zaloUserId];

            if (empty($sub['avatar']) && !empty($zaloSub['avatar'])) {
                $updateCols[] = "avatar = ?";
                $upParams[] = $zaloSub['avatar'];
            }
            if (empty($sub['first_name']) && !empty($zaloSub['display_name']) && $zaloSub['display_name'] !== 'Zalo User') {
                $updateCols[] = "first_name = ?";
                $upParams[] = $zaloSub['display_name'];
            }
            if (empty($sub['gender']) && !empty($zaloSub['gender'])) {
                $updateCols[] = "gender = ?";
                $upParams[] = $zaloSub['gender'];
            }
            if (empty($sub['date_of_birth']) && !empty($zaloSub['birthday'])) {
                $sqlDob = zaloToSqlDate($zaloSub['birthday']);
                if ($sqlDob) {
                    $updateCols[] = "date_of_birth = ?";
                    $upParams[] = $sqlDob;
                }
            }

            $upParams[] = $mainSubId;
            $pdo->prepare("UPDATE subscribers SET " . implode(', ', $updateCols) . " WHERE id = ?")->execute($upParams);

            // 2. Update Zalo Subscriber from Main Info
            $zUpdateCols = ["manual_email = ?", "phone_number = ?"];
            $zParams = [$email ?: null, $phone ?: null];

            if (empty($zaloSub['gender']) && !empty($sub['gender'])) {
                $zUpdateCols[] = "gender = ?";
                $zParams[] = $sub['gender'];
            }
            if (empty($zaloSub['birthday']) && !empty($sub['date_of_birth'])) {
                $zBirthday = sqlToZaloDate($sub['date_of_birth']);
                if ($zBirthday) {
                    $zUpdateCols[] = "birthday = ?";
                    $zParams[] = $zBirthday;
                }
            }
            if ((empty($zaloSub['display_name']) || $zaloSub['display_name'] === 'Zalo User') && !empty($sub['first_name'])) {
                $zUpdateCols[] = "display_name = ?";
                $zParams[] = $sub['first_name'];
            }

            $zParams[] = $zaloSub['id'];
            $pdo->prepare("UPDATE zalo_subscribers SET " . implode(', ', $zUpdateCols) . " WHERE id = ?")->execute($zParams);

            // 3. Sync Lead Score and Log Activity if first time linking
            if (empty($sub['zalo_user_id'])) {
                if ($zaloSub['lead_score'] > 0) {
                    $pdo->prepare("UPDATE subscribers SET lead_score = lead_score + ? WHERE id = ?")
                        ->execute([$zaloSub['lead_score'], $mainSubId]);
                }

                require_once __DIR__ . '/flow_helpers.php';
                if (function_exists('logActivity')) {
                    // [FIX AUDIT-17] Include workspace_id
                    logActivity($pdo, $mainSubId, 'profile_sync', null, 'Sync Profile', "Linked Zalo ID: $zaloUserId (Main to Zalo sync)", null, null, [], $workspace_id);
                }
            }
        }
    } catch (Exception $e) {
        error_log("Error in syncMainToZalo: " . $e->getMessage());
    }
}

/**
 * Sync from Zalo Subscriber to Main Subscriber
 * Called when a Zalo subscriber is created or updated.
 */
function syncZaloToMain($pdo, $zaloSubId)
{
    if (!$zaloSubId)
        return;

    try {
        $stmt = $pdo->prepare("SELECT zalo_user_id, manual_email, phone_number, display_name, avatar, gender, birthday, lead_score FROM zalo_subscribers WHERE id = ?");
        $stmt->execute([$zaloSubId]);
        $zs = $stmt->fetch();
        if (!$zs)
            return;

        $email = trim($zs['manual_email'] ?? '');
        $phone = trim($zs['phone_number'] ?? '');

        if (empty($email) && empty($phone))
            return;

        // Find main subscriber
        $where = [];
        $params = [];
        if (!empty($email)) {
            $where[] = "email = ?";
            $params[] = $email;
        }
        if (!empty($phone)) {
            $where[] = "phone_number = ?";
            $params[] = $phone;
        }

        if (empty($where))
            return;
        $sql = "SELECT id, zalo_user_id, first_name, gender, date_of_birth, lead_score FROM subscribers WHERE " . implode(" OR ", $where) . " LIMIT 1";

        $stmtM = $pdo->prepare($sql);
        $stmtM->execute($params);
        $mainSub = $stmtM->fetch();

        if ($mainSub) {
            // 1. Update Main Subscriber
            $updateCols = ["verified = 1", "zalo_user_id = ?", "last_activity_at = NOW()"];
            $upParams = [$zs['zalo_user_id']];

            if ($zs['avatar']) {
                $updateCols[] = "avatar = ?";
                $upParams[] = $zs['avatar'];
            }
            if ((empty($mainSub['first_name']) || strlen($mainSub['first_name']) < 2) && !empty($zs['display_name']) && $zs['display_name'] !== 'Zalo User') {
                $updateCols[] = "first_name = ?";
                $upParams[] = $zs['display_name'];
            }
            if (empty($mainSub['gender']) && !empty($zs['gender'])) {
                $updateCols[] = "gender = ?";
                $upParams[] = $zs['gender'];
            }
            if (empty($mainSub['date_of_birth']) && !empty($zs['birthday'])) {
                $sqlDob = zaloToSqlDate($zs['birthday']);
                if ($sqlDob) {
                    $updateCols[] = "date_of_birth = ?";
                    $upParams[] = $sqlDob;
                }
            }

            $upParams[] = $mainSub['id'];
            $pdo->prepare("UPDATE subscribers SET " . implode(', ', $updateCols) . " WHERE id = ?")
                ->execute($upParams);

            // 2. Link them in Zalo table (ensure email/phone are synced)
            // (already done in callers or can be added here if needed)

            // 3. Sync Score and Log Activity if first time linking
            if (empty($mainSub['zalo_user_id'])) {
                if ($zs['lead_score'] > 0) {
                    $pdo->prepare("UPDATE subscribers SET lead_score = lead_score + ? WHERE id = ?")
                        ->execute([$zs['lead_score'], $mainSub['id']]);
                }

                require_once __DIR__ . '/flow_helpers.php';
                if (function_exists('logActivity')) {
                    // [FIX AUDIT-17] Include workspace_id
                    $wsId = $mainSub['workspace_id'] ?? 1;
                    logActivity($pdo, $mainSub['id'], 'profile_sync', null, 'Sync Profile', "Linked Zalo ID: {$zs['zalo_user_id']} (Zalo to Main sync)", null, null, [], $wsId);
                }
            }
        }
    } catch (Exception $e) {
        error_log("Error in syncZaloToMain: " . $e->getMessage());
    }
}
