<?php
// api/meta_sync_helpers.php - Bidirectional Sync between Main (Audience) and Meta

/**
 * Sync from Meta Subscriber to Main Subscriber (Audience)
 * Called when a Meta subscriber's info (Email/Phone) is captured.
 */
function syncMetaToMain($pdo, $metaSubId, $workspaceId = null)
{
    if (!$metaSubId)
        return;

    try {
        // 1. Fetch Meta Subscriber Info
        $stmt = $pdo->prepare("SELECT psid, page_id, name, profile_pic, profile_link, gender, locale, timezone, email, phone, lead_score, notes FROM meta_subscribers WHERE id = ?");
        $stmt->execute([$metaSubId]);
        $ms = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$ms)
            return;

        // If workspaceId not provided, try to resolve from Page ID
        if (!$workspaceId) {
            $stmtWs = $pdo->prepare("SELECT workspace_id FROM meta_app_configs WHERE page_id = ? LIMIT 1");
            $stmtWs->execute([$ms['page_id']]);
            $workspaceId = $stmtWs->fetchColumn();
        }
        
        if (!$workspaceId) {
             error_log("syncMetaToMain failed: Could not resolve workspace_id for metaSubId: $metaSubId");
             return;
        }

        $email = trim($ms['email'] ?? '');
        $phone = trim($ms['phone'] ?? '');

        if (empty($email) && empty($phone))
            return;

        // 2. Find main subscriber by email or phone or meta_psid
        $where = ["meta_psid = ?"];
        $params = [$ms['psid']];

        if (!empty($email)) {
            $where[] = "email = ?";
            $params[] = $email;
        }
        if (!empty($phone)) {
            $where[] = "phone_number = ?";
            $params[] = $phone;
        }

        $sql = "SELECT id, email, phone_number, first_name, avatar, meta_psid, lead_score, notes, custom_attributes FROM subscribers 
                WHERE (" . implode(" OR ", $where) . ") AND workspace_id = ? LIMIT 1";
        $params[] = $workspaceId;
        $stmtM = $pdo->prepare($sql);
        $stmtM->execute($params);
        $mainSub = $stmtM->fetch(PDO::FETCH_ASSOC);

        if ($mainSub) {
            // Found existing subscriber - Update them
            $updateCols = ["meta_psid = ?", "last_activity_at = NOW()"];
            $upParams = [$ms['psid']];

            // Only update if current data is empty or shorter
            if (empty($mainSub['avatar']) && !empty($ms['profile_pic'])) {
                $updateCols[] = "avatar = ?";
                $upParams[] = $ms['profile_pic'];
            }
            if ((empty($mainSub['first_name']) || strlen($mainSub['first_name']) < 2) && !empty($ms['name'])) {
                $updateCols[] = "first_name = ?";
                $upParams[] = $ms['name'];
            }
            $isFallbackEmail = (strpos($mainSub['email'] ?? '', '@facebook.com') !== false);
            $newEmailIsReal = (!empty($email) && strpos($email, '@facebook.com') === false);

            if ((empty($mainSub['email']) || $isFallbackEmail) && $newEmailIsReal) {
                $updateCols[] = "email = ?";
                $upParams[] = $email;
            }
            if (empty($mainSub['phone_number']) && !empty($phone)) {
                $updateCols[] = "phone_number = ?";
                $upParams[] = $phone;
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
            if (!empty($metaNotes)) {
                // Start with empty array
                $finalExistingNotes = [];

                // Try decoding
                $decoded = json_decode($mainSub['notes'] ?? '', true);

                if (is_array($decoded)) {
                    $finalExistingNotes = $decoded;
                } elseif (!empty($mainSub['notes'])) {
                    // It's a plain string, preserve it as a note object
                    $finalExistingNotes[] = [
                        'type' => 'manual_note',
                        'content' => $mainSub['notes'],
                        'created_at' => $mainSub['created_at'] ?? date('Y-m-d H:i:s')
                    ];
                }

                // Deduplicate EVERYTHING (Clean existing main notes + merge new)
                $cleanNotes = [];
                $seenHashes = [];

                // 1. Process existing Main notes
                foreach ($finalExistingNotes as $fn) {
                    $content = is_array($fn) ? ($fn['content'] ?? '') : (string) $fn;
                    $h = md5(trim($content));
                    if (!isset($seenHashes[$h]) && !empty($content)) {
                        $seenHashes[$h] = true;
                        $cleanNotes[] = $fn;
                    }
                }

                // 2. Process Meta notes (Merge unique ones)
                foreach ($metaNotes as $mn) {
                    $h = md5(trim($mn['content'] ?? ''));
                    if (!isset($seenHashes[$h]) && !empty($mn['content'])) {
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

            $upParams[] = $mainSub['id'];
            $upParams[] = $workspaceId;
            $pdo->prepare("UPDATE subscribers SET " . implode(', ', $updateCols) . " WHERE id = ? AND workspace_id = ?")->execute($upParams);

            // Sync Lead Score if first time linking
            if (empty($mainSub['meta_psid'])) {
                if ($ms['lead_score'] > 0) {
                    $pdo->prepare("UPDATE subscribers SET lead_score = lead_score + ? WHERE id = ? AND workspace_id = ?")
                        ->execute([$ms['lead_score'], $mainSub['id'], $workspaceId]);
                }

                require_once 'meta_helpers.php';
                logMetaJourney($pdo, $ms['page_id'], $ms['psid'], 'audience_synced', 'Đồng bộ Audience (Liên kết)', ['subscriber_id' => $mainSub['id']]);
            }

            // Auto-tag with "Facebook Verified"
            $tagStmt = $pdo->prepare("SELECT id FROM domation_tags WHERE name = 'Facebook Verified' LIMIT 1");
            $tagStmt->execute();
            $tagId = $tagStmt->fetchColumn();
            if ($tagId) {
                $pdo->prepare("INSERT IGNORE INTO subscriber_tags (subscriber_id, tag_id) VALUES (?, ?)")
                    ->execute([$mainSub['id'], $tagId]);
            }
            return $mainSub['id'];
        } else {
            // Not found - Create NEW subscriber in Audience
            $newId = md5(uniqid('meta_', true));

            $sqlInsert = "INSERT INTO subscribers (id, workspace_id, email, first_name, phone_number, avatar, meta_psid, source, lead_score, joined_at, last_activity_at, notes, custom_attributes, timezone)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?)";

            $stmtInsert = $pdo->prepare($sqlInsert);
            $stmtInsert->execute([
                $newId,
                $workspaceId,
                $email ?: ($ms['psid'] . '@facebook.com'), // Fallback email
                $ms['name'] ?: 'Facebook User',
                $phone ?: NULL,
                $ms['profile_pic'] ?: NULL,
                $ms['psid'],
                $ms['lead_score'] ?: 1,
                $ms['notes'] ?: '[]',
                json_encode(array_filter([
                    'facebook_link' => $ms['profile_link'] ?? null,
                    'language' => $ms['locale'] ?? null
                ])) ?: NULL,
                $ms['timezone'] ?? NULL
            ]);

            // Set gender in the initial insert if we had a column but it's not in the simple INSERT above (Wait, I should add it to SQL)
            $pdo->prepare("UPDATE subscribers SET gender = ? WHERE id = ? AND workspace_id = ?")->execute([$ms['gender'] ?? null, $newId, $workspaceId]);

            require_once 'meta_helpers.php';
            logMetaJourney($pdo, $ms['page_id'], $ms['psid'], 'audience_synced', 'Đồng bộ Audience (Tạo mới)', ['subscriber_id' => $newId]);

            // Auto-tag with "Facebook Verified"
            $tagStmt = $pdo->prepare("SELECT id FROM domation_tags WHERE name = 'Facebook Verified' LIMIT 1");
            $tagStmt->execute();
            $tagId = $tagStmt->fetchColumn();
            if ($tagId) {
                $pdo->prepare("INSERT IGNORE INTO subscriber_tags (subscriber_id, tag_id) VALUES (?, ?)")
                    ->execute([$newId, $tagId]);
            }
            return $newId;
        }
    } catch (Exception $e) {
        error_log("Error in syncMetaToMain: " . $e->getMessage());
        return null;
    }
}
?>
