<?php
// api/meta_sync_helpers.php - Bidirectional Sync between Main (Audience) and Meta

/**
 * Sync from Meta Subscriber to Main Subscriber (Audience)
 * Called when a Meta subscriber's info (Email/Phone) is captured.
 */
function syncMetaToMain($pdo, $metaSubId, $workspaceId = null)
{
    if (!$metaSubId)
        return null;

    try {
        require_once __DIR__ . '/../utils/DomationContactMatcher.php';

        // Ensure meta_subscribers has subscriber_id and contact_id columns
        try {
            $msCols = $pdo->query("SHOW COLUMNS FROM `meta_subscribers`")->fetchAll(PDO::FETCH_COLUMN);
            if (!in_array('subscriber_id', $msCols, true)) {
                $pdo->exec("ALTER TABLE `meta_subscribers` ADD COLUMN `subscriber_id` CHAR(36) NULL DEFAULT NULL");
            }
            if (!in_array('contact_id', $msCols, true)) {
                $pdo->exec("ALTER TABLE `meta_subscribers` ADD COLUMN `contact_id` INT NULL DEFAULT NULL");
            }
            if (!in_array('workspace_id', $msCols, true)) {
                $pdo->exec("ALTER TABLE `meta_subscribers` ADD COLUMN `workspace_id` INT NULL DEFAULT 1");
            }
        } catch (\Throwable $eCol) {
        }

        // 1. Fetch Meta Subscriber Info
        $stmt = $pdo->prepare("SELECT * FROM meta_subscribers WHERE id = ? OR psid = ? LIMIT 1");
        $stmt->execute([$metaSubId, $metaSubId]);
        $ms = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$ms)
            return null;

        $realMetaRowId = $ms['id'];

        // If workspaceId not provided, try to resolve from meta_subscribers or Page ID
        if (!$workspaceId && !empty($ms['workspace_id'])) {
            $workspaceId = (int)$ms['workspace_id'];
        }
        if (!$workspaceId && !empty($ms['page_id'])) {
            $stmtWs = $pdo->prepare("SELECT workspace_id FROM meta_app_configs WHERE page_id = ? LIMIT 1");
            $stmtWs->execute([$ms['page_id']]);
            $workspaceId = $stmtWs->fetchColumn();
        }
        if (!$workspaceId) {
            $workspaceId = 1;
        }

        $email = trim($ms['email'] ?? '');
        if (strpos($email, '@facebook.com') !== false) {
            $email = '';
        }
        $phone = trim($ms['phone'] ?? '');
        $phone9 = DomationContactMatcher::normalizePhone9($phone);
        $emailNorm = DomationContactMatcher::normalizeEmail($email);

        // 2. Find main subscriber by subscriber_id, meta_psid, email/email_norm, or phone_number/phone_norm9
        $where = [];
        $params = [];

        if (!empty($ms['subscriber_id'])) {
            $where[] = "id = ?";
            $params[] = $ms['subscriber_id'];
        }
        if (!empty($ms['psid'])) {
            $where[] = "meta_psid = ?";
            $params[] = $ms['psid'];
        }
        if (!empty($emailNorm)) {
            $where[] = "(email_norm = ? OR LOWER(TRIM(email)) = ?)";
            $params[] = $emailNorm;
            $params[] = $emailNorm;
        }
        if (!empty($phone9)) {
            $where[] = "phone_norm9 = ?";
            $params[] = $phone9;
        }
        if (!empty($phone)) {
            $where[] = "phone_number = ?";
            $params[] = $phone;
        }

        $mainSub = null;
        if (!empty($where)) {
            $sql = "SELECT * FROM subscribers WHERE (" . implode(" OR ", $where) . ") AND workspace_id = ? ORDER BY (contact_id IS NOT NULL) DESC, updated_at DESC LIMIT 1";
            $paramsWithWs = array_merge($params, [$workspaceId]);
            $stmtM = $pdo->prepare($sql);
            $stmtM->execute($paramsWithWs);
            $mainSub = $stmtM->fetch(PDO::FETCH_ASSOC);

            if (!$mainSub) {
                $sqlAnyWs = "SELECT * FROM subscribers WHERE (" . implode(" OR ", $where) . ") ORDER BY (contact_id IS NOT NULL) DESC, updated_at DESC LIMIT 1";
                $stmtM2 = $pdo->prepare($sqlAnyWs);
                $stmtM2->execute($params);
                $mainSub = $stmtM2->fetch(PDO::FETCH_ASSOC);
            }
        }

        $mainSubId = null;
        $displayName = trim($ms['name'] ?? '');
        if ($displayName === '') {
            $displayName = trim(($ms['first_name'] ?? '') . ' ' . ($ms['last_name'] ?? ''));
        }
        $avatarPic = !empty($ms['profile_pic']) ? $ms['profile_pic'] : ($ms['avatar_url'] ?? null);

        if ($mainSub) {
            $mainSubId = $mainSub['id'];
            // Found existing subscriber - Update them
            $updateCols = ["meta_psid = ?", "last_activity_at = NOW()"];
            $upParams = [$ms['psid']];

            if (empty($mainSub['avatar']) && !empty($avatarPic)) {
                $updateCols[] = "avatar = ?";
                $upParams[] = $avatarPic;
            }
            if ((empty($mainSub['first_name']) || strlen($mainSub['first_name']) < 2 || $mainSub['first_name'] === 'Facebook User') && !empty($displayName)) {
                $updateCols[] = "first_name = ?";
                $upParams[] = $displayName;
            }
            $isFallbackEmail = (strpos($mainSub['email'] ?? '', '@facebook.com') !== false);
            $newEmailIsReal = (!empty($email) && strpos($email, '@facebook.com') === false);

            if ((empty($mainSub['email']) || $isFallbackEmail) && $newEmailIsReal) {
                $updateCols[] = "email = ?";
                $upParams[] = $email;
                if (!empty($emailNorm)) {
                    $updateCols[] = "email_norm = ?";
                    $upParams[] = $emailNorm;
                }
            }
            if (empty($mainSub['phone_number']) && !empty($phone)) {
                $updateCols[] = "phone_number = ?";
                $upParams[] = $phone;
                if (!empty($phone9)) {
                    $updateCols[] = "phone_norm9 = ?";
                    $upParams[] = $phone9;
                }
            }
            if (empty($mainSub['gender']) && !empty($ms['gender'])) {
                $updateCols[] = "gender = ?";
                $upParams[] = $ms['gender'];
            }
            if (empty($mainSub['timezone']) && !empty($ms['timezone'])) {
                $updateCols[] = "timezone = ?";
                $upParams[] = $ms['timezone'];
            }

            // Sync/Merge Notes
            $metaNotes = json_decode($ms['notes'] ?? '[]', true);
            if (!empty($metaNotes) && is_array($metaNotes)) {
                $finalExistingNotes = [];
                $decoded = json_decode($mainSub['notes'] ?? '', true);

                if (is_array($decoded)) {
                    $finalExistingNotes = $decoded;
                } elseif (!empty($mainSub['notes'])) {
                    $finalExistingNotes[] = [
                        'type' => 'manual_note',
                        'content' => $mainSub['notes'],
                        'created_at' => $mainSub['created_at'] ?? date('Y-m-d H:i:s')
                    ];
                }

                $cleanNotes = [];
                $seenHashes = [];

                foreach ($finalExistingNotes as $fn) {
                    $content = is_array($fn) ? ($fn['content'] ?? '') : (string) $fn;
                    $h = md5(trim($content));
                    if (!isset($seenHashes[$h]) && !empty($content)) {
                        $seenHashes[$h] = true;
                        $cleanNotes[] = $fn;
                    }
                }

                foreach ($metaNotes as $mn) {
                    $content = is_array($mn) ? ($mn['content'] ?? '') : (string) $mn;
                    $h = md5(trim($content));
                    if (!isset($seenHashes[$h]) && !empty($content)) {
                        $cleanNotes[] = $mn;
                        $seenHashes[$h] = true;
                    }
                }

                $updateCols[] = "notes = ?";
                $upParams[] = json_encode($cleanNotes);
            }

            // Sync Custom Attributes (Facebook Link & Language)
            $attrs = json_decode($mainSub['custom_attributes'] ?? '{}', true) ?: [];
            $attrsChanged = false;

            if (!empty($ms['profile_link']) && ($attrs['facebook_link'] ?? '') !== $ms['profile_link']) {
                $attrs['facebook_link'] = $ms['profile_link'];
                $attrsChanged = true;
            }
            if (!empty($ms['locale']) && ($attrs['language'] ?? '') !== $ms['locale']) {
                $attrs['language'] = $ms['locale'];
                $attrsChanged = true;
            }

            if ($attrsChanged) {
                $updateCols[] = "custom_attributes = ?";
                $upParams[] = json_encode($attrs);
            }

            $upParams[] = $mainSubId;
            $pdo->prepare("UPDATE subscribers SET " . implode(', ', $updateCols) . " WHERE id = ?")->execute($upParams);

            // Sync Lead Score if first time linking
            if (empty($mainSub['meta_psid'])) {
                if (($ms['lead_score'] ?? 0) > 0) {
                    $pdo->prepare("UPDATE subscribers SET lead_score = lead_score + ? WHERE id = ?")
                        ->execute([$ms['lead_score'], $mainSubId]);
                }

                if (file_exists(__DIR__ . '/meta_helpers.php')) {
                    require_once __DIR__ . '/meta_helpers.php';
                    if (function_exists('logMetaJourney')) {
                        logMetaJourney($pdo, $ms['page_id'], $ms['psid'], 'audience_synced', 'Đồng bộ Audience (Liên kết)', ['subscriber_id' => $mainSubId]);
                    }
                }
            }

            // Auto-tag with "Facebook Verified"
            $tagStmt = $pdo->prepare("SELECT id FROM domation_tags WHERE name = 'Facebook Verified' LIMIT 1");
            $tagStmt->execute();
            $tagId = $tagStmt->fetchColumn();
            if ($tagId) {
                $pdo->prepare("INSERT IGNORE INTO subscriber_tags (subscriber_id, tag_id) VALUES (?, ?)")
                    ->execute([$mainSubId, $tagId]);
            }
        } else {
            // Not found - Create NEW subscriber in Audience
            $mainSubId = md5(uniqid('meta_', true));

            $sqlInsert = "INSERT INTO subscribers (id, workspace_id, email, email_norm, first_name, phone_number, phone_norm9, avatar, meta_psid, source, gender, lead_score, joined_at, last_activity_at, notes, custom_attributes, timezone)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Facebook Messenger', ?, ?, NOW(), NOW(), ?, ?, ?)";

            $stmtInsert = $pdo->prepare($sqlInsert);
            $stmtInsert->execute([
                $mainSubId,
                $workspaceId,
                $email ?: ($ms['psid'] . '@facebook.com'),
                !empty($emailNorm) ? $emailNorm : null,
                $displayName ?: 'Facebook User',
                $phone ?: null,
                !empty($phone9) ? $phone9 : null,
                $avatarPic ?: null,
                $ms['psid'],
                $ms['gender'] ?? null,
                $ms['lead_score'] ?: 1,
                $ms['notes'] ?: '[]',
                json_encode(array_filter([
                    'facebook_link' => $ms['profile_link'] ?? null,
                    'language' => $ms['locale'] ?? null
                ])) ?: null,
                $ms['timezone'] ?? null
            ]);

            if (file_exists(__DIR__ . '/meta_helpers.php')) {
                require_once __DIR__ . '/meta_helpers.php';
                if (function_exists('logMetaJourney')) {
                    logMetaJourney($pdo, $ms['page_id'], $ms['psid'], 'audience_synced', 'Đồng bộ Audience (Tạo mới)', ['subscriber_id' => $mainSubId]);
                }
            }

            // Auto-tag with "Facebook Verified"
            $tagStmt = $pdo->prepare("SELECT id FROM domation_tags WHERE name = 'Facebook Verified' LIMIT 1");
            $tagStmt->execute();
            $tagId = $tagStmt->fetchColumn();
            if ($tagId) {
                $pdo->prepare("INSERT IGNORE INTO subscriber_tags (subscriber_id, tag_id) VALUES (?, ?)")
                    ->execute([$mainSubId, $tagId]);
            }
        }

        if ($mainSubId) {
            $pdo->prepare("UPDATE meta_subscribers SET subscriber_id = ? WHERE id = ?")
                ->execute([$mainSubId, $realMetaRowId]);

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
                $pdo->prepare("UPDATE meta_subscribers SET contact_id = ? WHERE id = ?")
                    ->execute([(int)$matchedContactId, $realMetaRowId]);
            }
        }

        return $mainSubId;
    } catch (Exception $e) {
        error_log("Error in syncMetaToMain: " . $e->getMessage());
        return null;
    }
}
?>
