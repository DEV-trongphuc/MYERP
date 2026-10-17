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
        require_once __DIR__ . '/../utils/DomationContactMatcher.php';

        $stmt = $pdo->prepare("SELECT id, workspace_id, contact_id, email, phone_number, phone, zalo_user_id, first_name, gender, date_of_birth, avatar FROM subscribers WHERE id = ? LIMIT 1");
        $stmt->execute([$mainSubId]);
        $sub = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$sub)
            return;

        $workspace_id = (int)($sub['workspace_id'] ?? 1);
        $contactId = !empty($sub['contact_id']) ? (int)$sub['contact_id'] : null;
        $email = trim($sub['email'] ?? '');
        if (strpos($email, '@zalo-oa.vn') !== false) {
            $email = '';
        }
        $phone = trim(!empty($sub['phone_number']) ? $sub['phone_number'] : ($sub['phone'] ?? ''));
        $phone9 = DomationContactMatcher::normalizePhone9($phone);
        $zaloUidFromSub = trim($sub['zalo_user_id'] ?? '');

        if (empty($email) && empty($phone) && empty($zaloUidFromSub))
            return;

        // Search Zalo subscribers by subscriber_id, zalo_user_id, email, or phone
        $where = ["subscriber_id = ?"];
        $params = [$mainSubId];
        if (!empty($zaloUidFromSub)) {
            $where[] = "zalo_user_id = ?";
            $params[] = $zaloUidFromSub;
        }
        if (!empty($email)) {
            $where[] = "LOWER(TRIM(manual_email)) = ?";
            $params[] = strtolower($email);
        }
        if (!empty($phone)) {
            $where[] = "phone_number = ?";
            $params[] = $phone;
        }
        if (!empty($phone9)) {
            $where[] = "RIGHT(REGEXP_REPLACE(phone_number, '[^0-9]', ''), 9) = ?";
            $params[] = $phone9;
        }

        $sql = "SELECT id, subscriber_id, contact_id, zalo_user_id, display_name, avatar, gender, birthday, lead_score, manual_email, phone_number FROM zalo_subscribers WHERE (" . implode(" OR ", $where) . ") ORDER BY updated_at DESC LIMIT 1";

        $stmtZ = $pdo->prepare($sql);
        $stmtZ->execute($params);
        $zaloSub = $stmtZ->fetch(PDO::FETCH_ASSOC);

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

            // 2. Update Zalo Subscriber from Main Info & link subscriber_id + contact_id
            $zUpdateCols = ["subscriber_id = ?"];
            $zParams = [$mainSubId];

            if ($contactId) {
                $zUpdateCols[] = "contact_id = ?";
                $zParams[] = $contactId;
            }
            if (!empty($email)) {
                $zUpdateCols[] = "manual_email = ?";
                $zParams[] = $email;
            }
            if (!empty($phone)) {
                $zUpdateCols[] = "phone_number = ?";
                $zParams[] = $phone;
            }
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
                    logActivity($pdo, $mainSubId, 'profile_sync', null, 'Sync Profile', "Linked Zalo ID: $zaloUserId (Main to Zalo sync)", null, null, [], $workspace_id);
                }
            }

            if (function_exists('domationSyncSubscriberMatchOnly')) {
                domationSyncSubscriberMatchOnly($pdo, $mainSubId);
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
        return null;

    try {
        require_once __DIR__ . '/../utils/DomationContactMatcher.php';

        $stmt = $pdo->prepare("SELECT * FROM zalo_subscribers WHERE id = ? OR zalo_user_id = ? LIMIT 1");
        $stmt->execute([$zaloSubId, $zaloSubId]);
        $zs = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$zs)
            return null;

        $realZaloRowId = $zs['id'];
        $zaloUserId = trim($zs['zalo_user_id'] ?? '');
        $wsId = (int)($zs['workspace_id'] ?? 1);
        $email = trim(!empty($zs['manual_email']) ? $zs['manual_email'] : ($zs['email'] ?? ''));
        if (strpos($email, '@zalo-oa.vn') !== false) {
            $email = '';
        }
        $phone = trim($zs['phone_number'] ?? '');
        $phone9 = DomationContactMatcher::normalizePhone9($phone);
        $emailNorm = DomationContactMatcher::normalizeEmail($email);

        // Find main subscriber by subscriber_id, zalo_user_id, phone_norm9/phone_number, or email_norm/email
        $where = [];
        $params = [];
        if (!empty($zs['subscriber_id'])) {
            $where[] = "id = ?";
            $params[] = $zs['subscriber_id'];
        }
        if (!empty($zaloUserId)) {
            $where[] = "zalo_user_id = ?";
            $params[] = $zaloUserId;
        }
        if (!empty($phone9)) {
            $where[] = "phone_norm9 = ?";
            $params[] = $phone9;
        }
        if (!empty($phone)) {
            $where[] = "phone_number = ?";
            $params[] = $phone;
        }
        if (!empty($emailNorm)) {
            $where[] = "(email_norm = ? OR LOWER(TRIM(email)) = ?)";
            $params[] = $emailNorm;
            $params[] = $emailNorm;
        }

        $mainSub = null;
        if (!empty($where)) {
            $sql = "SELECT * FROM subscribers WHERE (" . implode(" OR ", $where) . ") ORDER BY (contact_id IS NOT NULL) DESC, updated_at DESC LIMIT 1";
            $stmtM = $pdo->prepare($sql);
            $stmtM->execute($params);
            $mainSub = $stmtM->fetch(PDO::FETCH_ASSOC);
        }

        $mainSubId = null;
        if ($mainSub) {
            $mainSubId = $mainSub['id'];
            // 1. Update Main Subscriber
            $updateCols = ["verified = 1", "zalo_user_id = ?", "last_activity_at = NOW()"];
            $upParams = [$zaloUserId];

            if (!empty($zs['avatar'])) {
                $updateCols[] = "avatar = ?";
                $upParams[] = $zs['avatar'];
            }
            if ((empty($mainSub['first_name']) || strlen($mainSub['first_name']) < 2 || $mainSub['first_name'] === 'Zalo User') && !empty($zs['display_name']) && $zs['display_name'] !== 'Zalo User') {
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
            if (!empty($phone) && empty($mainSub['phone_number'])) {
                $updateCols[] = "phone_number = ?";
                $upParams[] = $phone;
                if (!empty($phone9)) {
                    $updateCols[] = "phone_norm9 = ?";
                    $upParams[] = $phone9;
                }
            }
            if (!empty($email) && (empty($mainSub['email']) || strpos((string)$mainSub['email'], '@zalo-oa.vn') !== false)) {
                $updateCols[] = "email = ?";
                $upParams[] = $email;
                if (!empty($emailNorm)) {
                    $updateCols[] = "email_norm = ?";
                    $upParams[] = $emailNorm;
                }
            }

            $upParams[] = $mainSubId;
            $pdo->prepare("UPDATE subscribers SET " . implode(', ', $updateCols) . " WHERE id = ?")
                ->execute($upParams);

            // Sync Score and Log Activity if first time linking
            if (empty($mainSub['zalo_user_id'])) {
                if (($zs['lead_score'] ?? 0) > 0) {
                    $pdo->prepare("UPDATE subscribers SET lead_score = lead_score + ? WHERE id = ?")
                        ->execute([$zs['lead_score'], $mainSubId]);
                }

                require_once __DIR__ . '/flow_helpers.php';
                if (function_exists('logActivity')) {
                    $wsIdLog = $mainSub['workspace_id'] ?? $wsId;
                    logActivity($pdo, $mainSubId, 'profile_sync', null, 'Sync Profile', "Linked Zalo ID: {$zaloUserId} (Zalo to Main sync)", null, null, [], $wsIdLog);
                }
            }
        } elseif (!empty($zaloUserId)) {
            // Create a new Main Subscriber if none existed
            $mainSubId = bin2hex(random_bytes(16));
            $subEmail = !empty($email) ? $email : ($zaloUserId . '@zalo-oa.vn');
            $sqlDob = zaloToSqlDate($zs['birthday'] ?? null);
            $pdo->prepare("
                INSERT INTO subscribers (
                    id, workspace_id, email, email_norm, first_name, phone_number, phone_norm9,
                    zalo_user_id, avatar, gender, date_of_birth, source, status,
                    is_zalo_follower, lead_score, verified, joined_at, last_activity_at, created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, 'Zalo OA', 'active',
                    ?, ?, 1, NOW(), NOW(), NOW(), NOW()
                )
            ")->execute([
                $mainSubId,
                $wsId,
                $subEmail,
                !empty($emailNorm) ? $emailNorm : null,
                !empty($zs['display_name']) ? $zs['display_name'] : 'Zalo User',
                !empty($phone) ? $phone : null,
                !empty($phone9) ? $phone9 : null,
                $zaloUserId,
                $zs['avatar'] ?? null,
                $zs['gender'] ?? null,
                $sqlDob,
                (int)($zs['is_follower'] ?? 1),
                (int)($zs['lead_score'] ?? 0)
            ]);
        }

        if ($mainSubId) {
            // Link subscriber_id on zalo_subscribers
            $pdo->prepare("UPDATE zalo_subscribers SET subscriber_id = ? WHERE id = ?")
                ->execute([$mainSubId, $realZaloRowId]);

            // Match-only against MYERP contacts and propagate contact_id
            $matchedContactId = null;
            if (function_exists('domationSyncSubscriberMatchOnly')) {
                $matchedContactId = domationSyncSubscriberMatchOnly($pdo, $mainSubId);
            }
            if (!$matchedContactId) {
                $stmtChkC = $pdo->prepare("SELECT contact_id FROM subscribers WHERE id = ? LIMIT 1");
                $stmtChkC->execute([$mainSubId]);
                $matchedContactId = $stmtChkC->fetchColumn() ?: null;
            }
            if ($matchedContactId) {
                $pdo->prepare("UPDATE zalo_subscribers SET contact_id = ? WHERE id = ?")
                    ->execute([(int)$matchedContactId, $realZaloRowId]);
            }
        }

        return $mainSubId;
    } catch (Exception $e) {
        error_log("Error in syncZaloToMain: " . $e->getMessage());
        return null;
    }
}

