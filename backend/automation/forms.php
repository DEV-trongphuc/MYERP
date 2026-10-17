<?php
// api/forms.php - VERSION V28.1 (ACTIVITY LOGGING WITH FLOW/CAMPAIGN ID)
require_once 'db_connect.php';
require_once 'flow_helpers.php';
require_once 'tracking_helper.php';
require_once 'auth_middleware.php';

/** @var \PDO $pdo */

apiHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$path = isset($_GET['id']) ? $_GET['id'] : null;
$route = $_GET['route'] ?? '';
$admin_workspace_id = get_current_workspace_id();

try {
    if ($method === 'POST' && $route === 'submit') {
        try {
            $data = json_decode(file_get_contents("php://input"), true);
            require_once __DIR__ . '/db_connect.php';
            $scoring = function_exists('getGlobalLeadScoreConfig') ? getGlobalLeadScoreConfig($pdo) : [];
            $pForm = $scoring['leadscore_form_submit'] ?? 10;
            if (!$data)
                $data = $_POST;

            $email = strtolower(trim($data['email'] ?? ''));
            $rawPhone = trim($data['phoneNumber'] ?? $data['phone_number'] ?? $data['phone'] ?? '');
            if ($rawPhone !== '' && empty($data['phoneNumber'])) {
                $data['phoneNumber'] = $rawPhone;
            }
            $formId = trim($data['form_id'] ?? '');

            $hasValidEmail = ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL));
            $digitsPhone = preg_replace('/[^0-9]/', '', $rawPhone);
            $hasValidPhone = (strlen($digitsPhone) >= 8);

            if (!$hasValidEmail && !$hasValidPhone) {
                jsonResponse(false, null, 'Vui lòng nhập Email hợp lệ hoặc Số điện thoại');
            }
            if (!$hasValidEmail && $hasValidPhone) {
                $email = $digitsPhone . '@no-email.domation';
            }

            // [FIX P0] Named Lock: was using raw string interpolation inside query()
            // which broke on emails with apostrophes (e.g. o'brien@...) and is
            // inconsistent with the GET_LOCK fix already applied in track.php.
            $lockName = "sub_email_" . md5($email ?: $digitsPhone);
            $pdo->prepare("SELECT GET_LOCK(?, 5)")->execute([$lockName]);

            $pdo->beginTransaction();

            $stmtF = $pdo->prepare("SELECT name, status, target_list_id, workspace_id, fields_json, notification_enabled, notification_emails, notification_cc_emails, notification_subject FROM forms WHERE id = ?");
            $stmtF->execute([$formId]);
            $formData = $stmtF->fetch();

            if (!$formData) {
                if ($pdo->inTransaction())
                    $pdo->rollBack();
                jsonResponse(false, null, 'Biểu mẫu không tồn tại');
            }
            // [GUARD] Block submission if form is inactive
            if (($formData['status'] ?? 'active') === 'inactive') {
                if ($pdo->inTransaction()) $pdo->rollBack();
                jsonResponse(false, null, 'Biểu mẫu này hiện đã được vô hiệu hoá');
            }

            $targetListId = $formData['target_list_id'] ?? null;
            $formName = $formData['name'] ?? 'Form';

            // Parse custom fields from form definition
            $formFieldsDef = json_decode($formData['fields_json'] ?? '[]', true) ?: [];
            $customFieldKeys = []; // ['customKey' => 'label']
            foreach ($formFieldsDef as $fieldDef) {
                if (!empty($fieldDef['isCustom']) && !empty($fieldDef['customKey'])) {
                    $customFieldKeys[$fieldDef['customKey']] = $fieldDef['label'] ?? $fieldDef['customKey'];
                }
            }

            $form_ws_id = $formData['workspace_id'] ?? 1;
            $emailNorm = $hasValidEmail
                ? (class_exists('DomationContactMatcher') ? DomationContactMatcher::normalizeEmail($email) : strtolower(trim($email)))
                : null;
            $phoneNorm9 = $hasValidPhone
                ? (class_exists('DomationContactMatcher') ? DomationContactMatcher::normalizePhone9($rawPhone) : (strlen($digitsPhone) >= 9 ? substr($digitsPhone, -9) : null))
                : null;

            $sub = false;
            if ($hasValidEmail) {
                $stmtCheck = $pdo->prepare("SELECT id, status, first_name, last_name, phone_number, job_title, company_name, country, city, gender, date_of_birth, anniversary_date, tags, custom_attributes FROM subscribers WHERE (email = ? OR email_norm = ?) AND workspace_id = ? LIMIT 1");
                $stmtCheck->execute([$email, $emailNorm ?? $email, $form_ws_id]);
                $sub = $stmtCheck->fetch();
            }
            if (!$sub && $hasValidPhone) {
                $phoneTail = $phoneNorm9 ?: (strlen($digitsPhone) >= 9 ? substr($digitsPhone, -9) : $digitsPhone);
                $stmtCheckPhone = $pdo->prepare("SELECT id, status, first_name, last_name, phone_number, job_title, company_name, country, city, gender, date_of_birth, anniversary_date, tags, custom_attributes FROM subscribers WHERE (email = ? OR phone_norm9 = ? OR RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(phone_number,''), ' ', ''), '-', ''), '.', ''), '+', ''), 9) = ?) AND workspace_id = ? LIMIT 1");
                $stmtCheckPhone->execute([$email, $phoneTail, $phoneTail, $form_ws_id]);
                $sub = $stmtCheckPhone->fetch();
            }

            $formFieldsMap = [
                'firstName' => 'first_name',
                // 'lastName' intentionally excluded: merged into first_name below to avoid display duplication
                'phoneNumber' => 'phone_number',
                'jobTitle' => 'job_title',
                'companyName' => 'company_name',
                'country' => 'country',
                'city' => 'city',
                'gender' => 'gender',
                'dateOfBirth' => 'date_of_birth',
                'anniversaryDate' => 'anniversary_date',
                'tags' => 'tags',
            ];

            // Merge firstName + lastName → store as single first_name
            // This prevents display duplication (e.g. "y khoan mlô khoan mlô")
            $rawFirst = trim($data['firstName'] ?? $data['first_name'] ?? '');
            $rawLast  = trim($data['lastName'] ?? $data['last_name'] ?? '');
            if ($rawFirst && $rawLast) {
                $data['firstName'] = trim($rawFirst . ' ' . $rawLast);
                unset($data['lastName'], $data['last_name']);
            } elseif ($rawLast && !$rawFirst) {
                // only last name provided → use as first_name
                $data['firstName'] = $rawLast;
                unset($data['lastName'], $data['last_name']);
            }

            // [VALIDATION] Normalize date fields to prevent SQL errors
            if (isset($data['dateOfBirth'])) $data['dateOfBirth'] = normalizeDate($data['dateOfBirth']);
            if (isset($data['anniversaryDate'])) $data['anniversaryDate'] = normalizeDate($data['anniversaryDate']);
            if (isset($data['date_of_birth'])) $data['date_of_birth'] = normalizeDate($data['date_of_birth']);
            if (isset($data['anniversary_date'])) $data['anniversary_date'] = normalizeDate($data['anniversary_date']);

            // Build custom attributes from submitted data (từ form definition)
            $newCustomAttrs = [];
            foreach ($customFieldKeys as $customKey => $label) {
                if (isset($data[$customKey]) && $data[$customKey] !== '' && $data[$customKey] !== null) {
                    $newCustomAttrs[$customKey] = $data[$customKey];
                }
            }

            // [FIX] Tự động thu thập TẤT CẢ field lạ từ payload vào custom_attributes
            // Không hardcode — landing page có thể truyền bất kỳ key nào (hoc_van, tieng_anh, chuong_trinh, v.v.)
            $knownStandardKeys = [
                'email', 'form_id', 'tags', 'visitor_id',
                // camelCase → db field mapping
                'firstName', 'lastName', 'phoneNumber', 'jobTitle',
                'companyName', 'country', 'city', 'gender',
                'dateOfBirth', 'anniversaryDate',
                // snake_case versions
                'first_name', 'last_name', 'phone_number', 'job_title',
                'company_name', 'date_of_birth', 'anniversary_date',
            ];
            foreach ($data as $inKey => $inVal) {
                // Bỏ qua field chuẩn, field rỗng, và field đã được xử lý từ form definition
                if (in_array($inKey, $knownStandardKeys)) continue;
                if (isset($customFieldKeys[$inKey])) continue; // đã xử lý ở trên
                if ($inVal === '' || $inVal === null) continue;
                if (is_array($inVal)) continue; // bỏ qua nested object/array

                $newCustomAttrs[$inKey] = $inVal;
            }

            if ($sub) {
                $sid = $sub['id'];

                $updateSqlParts = [];
                // [FIX P0] Initialize $updateValues ONCE here — previously it was reset to []
                // at the foreach loop below, wiping lead_score and source params added above.
                // This caused PDO param-count mismatch → UPDATE executed with wrong bindings.
                $updateValues = [];

                // [FIX] Chỉ upgrade status, không downgrade.
                $currentStatus = $sub['status'] ?? '';
                if (!in_array($currentStatus, ['active', 'lead', 'customer'])) {
                    $updateSqlParts[] = "status = 'lead'";
                }
                $updateSqlParts[] = "lead_score = lead_score + ?";
                $updateValues[] = (int)$pForm;

                if ($emailNorm) {
                    $updateSqlParts[] = "email_norm = ?";
                    $updateValues[] = $emailNorm;
                }
                if ($phoneNorm9) {
                    $updateSqlParts[] = "phone_norm9 = ?";
                    $updateValues[] = $phoneNorm9;
                }

                // [FIX P1] source update: parameterized (not interpolated)
                $currentSource = $sub['source'] ?? '';
                if (in_array($currentSource, ['website_tracking', '', null])) {
                    $updateSqlParts[] = "source = ?";
                    $updateValues[] = "Form: " . $formName;
                }

                foreach ($formFieldsMap as $dataKey => $dbField) {
                    if (isset($data[$dataKey]) && $data[$dataKey] !== '' && $data[$dataKey] !== null) {
                        if ($dbField === 'tags') {
                            // Handle tags after the main UPDATE below
                        } elseif ($dbField === 'first_name' || $dbField === 'last_name') {
                            $updateSqlParts[] = "$dbField = IF(COALESCE($dbField, '') = '', ?, $dbField)";
                            $updateValues[] = $data[$dataKey];
                        } else {
                            $updateSqlParts[] = "$dbField = ?";
                            $updateValues[] = $data[$dataKey];
                        }
                    }
                }
                if (!empty($updateSqlParts)) {
                    $pdo->prepare("UPDATE subscribers SET " . implode(', ', $updateSqlParts) . " WHERE id = ? AND workspace_id = ?")->execute(array_merge($updateValues, [$sid, $form_ws_id]));
                }

                // Merge custom attributes atomically to prevent race condition data loss (Vòng 93)
                if (!empty($newCustomAttrs)) {
                    $pdo->prepare("UPDATE subscribers SET custom_attributes = JSON_MERGE_PATCH(COALESCE(custom_attributes, '{}'), ?) WHERE id = ? AND workspace_id = ?")->execute([json_encode($newCustomAttrs, JSON_UNESCAPED_UNICODE), $sid, $form_ws_id]);
                }

                // [FIX] Tag N+1 eliminated: bulk-lookup all submitted tags in ONE query,
                // then only INSERT the ones that don't exist yet.
                $submittedTagsRaw = isset($data['tags']) ? (is_array($data['tags']) ? $data['tags'] : array_map('trim', explode(',', $data['tags']))) : [];
                $submittedTags = array_values(array_filter(array_map('trim', $submittedTagsRaw)));

                if (!empty($submittedTags)) {
                    $tagPh = implode(',', array_fill(0, count($submittedTags), '?'));
                    // [FIX BUG-FORMS-1] workspace_id filter prevents cross-workspace tag reuse
                    // [FIX BUG-FORMS-2] SELECT name,id for FETCH_KEY_PAIR {name=>id} map
                    $stmtExistingTags = $pdo->prepare("SELECT name, id, status FROM domation_tags WHERE name IN ($tagPh) AND workspace_id = ?");
                    $stmtExistingTags->execute(array_merge($submittedTags, [$form_ws_id]));
                    $existingTagsData = $stmtExistingTags->fetchAll(PDO::FETCH_ASSOC);
                    $existingTagMap = [];
                    $inactiveTags = [];
                    foreach ($existingTagsData as $et) {
                        $existingTagMap[$et['name']] = $et['id'];
                        if ($et['status'] === 'inactive') $inactiveTags[] = $et['name'];
                    }

                    // Create missing tags first (rare — only new tag names)
                    foreach ($submittedTags as $tagName) {
                        if (empty($tagName) || isset($existingTagMap[$tagName])) continue;
                        $tagId = bin2hex(random_bytes(8));
                        $pdo->prepare("INSERT INTO domation_tags (id, name, workspace_id) VALUES (?, ?, ?)")->execute([$tagId, $tagName, $form_ws_id]);
                        $existingTagMap[$tagName] = $tagId;
                    }

                    // [PERF FIX] Batch INSERT IGNORE all tags in one query instead of N prepare/execute
                    $batchPairs = [];
                    $batchParams = [];
                    foreach ($submittedTags as $tagName) {
                        if (empty($tagName) || !isset($existingTagMap[$tagName])) continue;
                        $batchPairs[] = "(?, ?, ?)";
                        $batchParams[] = $form_ws_id;
                        $batchParams[] = $sid;
                        $batchParams[] = $existingTagMap[$tagName];
                    }
                    if (!empty($batchPairs)) {
                        $stmtBatch = $pdo->prepare("INSERT IGNORE INTO subscriber_tags (workspace_id, subscriber_id, tag_id) VALUES " . implode(',', $batchPairs));
                        $stmtBatch->execute($batchParams);
                        if ($stmtBatch->rowCount() > 0) {
                            foreach ($submittedTags as $tagName) {
                                if (!empty($tagName) && isset($existingTagMap[$tagName]) && !in_array($tagName, $inactiveTags)) {
                                    dispatchFlowWorker($pdo, 'flows', ['trigger_type' => 'tag', 'target_id' => $tagName, 'subscriber_id' => $sid]);
                                }
                            }
                        }
                    }
                }
            } else {
                // [FIX] Race condition: use INSERT...ON DUPLICATE KEY UPDATE instead of
                // SELECT-then-INSERT. Two simultaneous requests for same email would both
                // see $sub=false and both try INSERT → Duplicate entry crash.
                // UPSERT handles both new and existing emails atomically in one SQL.
                $sid = bin2hex(random_bytes(16));
                $upsertFields = 'workspace_id, id, email, email_norm, phone_norm9, status, source, joined_at, lead_score';
                $upsertValues = [$form_ws_id, $sid, $email, $emailNorm, $phoneNorm9, 'active', "Form: " . $formName, date('Y-m-d H:i:s'), $pForm];
                $upsertSet = "lead_score = lead_score + VALUES(lead_score),
                               email_norm = COALESCE(VALUES(email_norm), email_norm),
                               phone_norm9 = COALESCE(VALUES(phone_norm9), phone_norm9),
                               source = IF(source IS NULL OR source = '' OR source = 'website_tracking', VALUES(source), source)";

                $extraFields = [];
                foreach ($formFieldsMap as $dataKey => $dbField) {
                    if ($dbField === 'tags')
                        continue;
                    if (isset($data[$dataKey]) && $data[$dataKey] !== '' && $data[$dataKey] !== null) {
                        $extraFields[] = $dbField;
                        $upsertValues[] = $data[$dataKey];
                        $upsertSet .= ", $dbField = VALUES($dbField)";
                    }
                }
                if (!empty($extraFields)) {
                    $upsertFields .= ', ' . implode(', ', $extraFields);
                }

                if (!empty($newCustomAttrs)) {
                    $upsertFields .= ', custom_attributes';
                    $upsertValues[] = json_encode($newCustomAttrs, JSON_UNESCAPED_UNICODE);
                    $upsertSet .= ", custom_attributes = JSON_MERGE_PATCH(COALESCE(custom_attributes, '{}'), VALUES(custom_attributes))";
                }

                $phList = implode(', ', array_fill(0, count($upsertValues), '?'));
                $stmtUpsert = $pdo->prepare(
                    "INSERT INTO subscribers ($upsertFields) VALUES ($phList)
                     ON DUPLICATE KEY UPDATE
                       id = LAST_INSERT_ID(id),
                       $upsertSet,
                       status = IF(status IN ('active','lead','customer'), status, 'lead')"
                );
                $stmtUpsert->execute($upsertValues);

                // If email already existed, fetch its real ID
                // (LAST_INSERT_ID returns the existing row's PK on duplicate)
                $lastId = $pdo->lastInsertId();
                if ($lastId && $lastId != $sid) {
                    // Row existed — use the original ID
                    $stmtGetId = $pdo->prepare("SELECT id FROM subscribers WHERE email = ? AND workspace_id = ?");
                    $stmtGetId->execute([$email, $form_ws_id]);
                    $sid = $stmtGetId->fetchColumn() ?: $sid;
                }

                // [FIX] Tag N+1 eliminated for new subscriber path too
                $submittedTagsRaw = isset($data['tags']) ? (is_array($data['tags']) ? $data['tags'] : array_map('trim', explode(',', $data['tags']))) : [];
                $submittedTags = array_values(array_filter(array_map('trim', $submittedTagsRaw)));

                if (!empty($submittedTags)) {
                    $tagPh = implode(',', array_fill(0, count($submittedTags), '?'));
                    // [FIX BUG-FORMS-1] Add workspace_id filter to prevent cross-workspace tag reuse
                    // [FIX BUG-FORMS-2] FETCH_KEY_PAIR maps col0=>col1, so SELECT name,id (not id,name)
                    $stmtExistingTags = $pdo->prepare("SELECT name, id, status FROM domation_tags WHERE name IN ($tagPh) AND workspace_id = ?");
                    $stmtExistingTags->execute(array_merge($submittedTags, [$form_ws_id]));
                    $existingTagsData = $stmtExistingTags->fetchAll(PDO::FETCH_ASSOC);
                    $existingTagMap = [];
                    $inactiveTags = [];
                    foreach ($existingTagsData as $et) {
                        $existingTagMap[$et['name']] = $et['id'];
                        if ($et['status'] === 'inactive') $inactiveTags[] = $et['name'];
                    }

                    // [PERF FIX] Batch INSERT IGNORE instead of per-tag prepare/execute
                    foreach ($submittedTags as $tagName) {
                        if (empty($tagName)) continue;
                        if (!isset($existingTagMap[$tagName])) {
                            $tagId = bin2hex(random_bytes(8));
                            // [FIX BUG-FORMS-1] Include workspace_id in new tag creation
                            $pdo->prepare("INSERT INTO domation_tags (id, name, workspace_id) VALUES (?, ?, ?)")->execute([$tagId, $tagName, $form_ws_id]);
                            $existingTagMap[$tagName] = $tagId;
                        }
                    }
                    $batchPairs = [];
                    $batchParams = [];
                    foreach ($submittedTags as $tagName) {
                        if (empty($tagName) || !isset($existingTagMap[$tagName])) continue;
                        $batchPairs[] = "(?, ?, ?)";
                        $batchParams[] = $form_ws_id;
                        $batchParams[] = $sid;
                        $batchParams[] = $existingTagMap[$tagName];
                    }
                    if (!empty($batchPairs)) {
                        $stmtBatch = $pdo->prepare("INSERT IGNORE INTO subscriber_tags (workspace_id, subscriber_id, tag_id) VALUES " . implode(',', $batchPairs));
                        $stmtBatch->execute($batchParams);
                        if ($stmtBatch->rowCount() > 0) {
                            foreach ($submittedTags as $tagName) {
                                if (!empty($tagName) && !in_array($tagName, $inactiveTags)) {
                                    dispatchFlowWorker($pdo, 'flows', ['trigger_type' => 'tag', 'target_id' => $tagName, 'subscriber_id' => $sid]);
                                }
                            }
                        }
                    }
                }
            }

            if (function_exists('domationSyncSubscriberMatchOnly')) {
                domationSyncSubscriberMatchOnly($pdo, $sid);
            }

            if ($targetListId) {
                $pdo->prepare("INSERT IGNORE INTO subscriber_lists (workspace_id, subscriber_id, list_id) VALUES (?, ?, ?)")->execute([$form_ws_id, $sid, $targetListId]);
            }

            // [FIX] IP detection: removed spoofable HTTP_CLIENT_IP and duplicate X_FORWARDED_FOR.
            // Priority: Cloudflare real IP → standard reverse-proxy header → direct connection.
            // HTTP_CLIENT_IP is trivially spoofable by any client and must never be trusted.
            $ip = $_SERVER['HTTP_CF_CONNECTING_IP']
                ?? ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ($_SERVER['REMOTE_ADDR'] ?? 'Unknown'));
            if (strpos($ip, ',') !== false) {
                // X-Forwarded-For may contain chain: "client, proxy1, proxy2" — take first
                $ip = trim(explode(',', $ip)[0]);
            }
            $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
            $deviceInfo = getDeviceDetails($ua);
            $location = getLocationFromIP($ip);

            $extra = [
                'ip' => $ip,
                'user_agent' => $ua,
                'device_type' => $deviceInfo['device'],
                'os' => $deviceInfo['os'],
                'browser' => $deviceInfo['browser'],
                'location' => $location
            ];

            // [FIX P43-A1] Form Attribution: link this submission back to the email/flow click that brought the user here.
            // Two-layer approach:
            //   Layer 1 (preferred): frontend embeds utm_campaign, mc_cid, mc_fid from URL params into form payload.
            //   Layer 2 (fallback): query web_sessions via _mf_vid cookie for last email session within 2 hours.
            $attrCampaignId = $data['mc_cid']     // Our internal campaign tracker (appended to email links)
                           ?? $data['campaign_id'] // Explicit from smart embeds
                           ?? $data['utm_campaign'] // Generic UTM
                           ?? null;
            $attrFlowId = $data['mc_fid'] ?? $data['flow_id'] ?? null;
            $attrSource  = $data['utm_source']  ?? null;
            $attrMedium  = $data['utm_medium']  ?? null;

            // Layer 2: fallback via visitor cookie → web_sessions
            if (!$attrCampaignId && !$attrFlowId) {
                $visitorCookieId = $_COOKIE['_mf_vid'] ?? $_COOKIE['_mfp_vid'] ?? null;
                if ($visitorCookieId) {
                    try {
                        $stmtSess = $pdo->prepare(
                            "SELECT utm_campaign, utm_source, utm_medium, utm_content
                             FROM web_sessions
                             WHERE visitor_id = ?
                               AND utm_source IN ('email', 'zns', 'flow')
                               AND started_at > DATE_SUB(NOW(), INTERVAL 2 HOUR)
                             ORDER BY id DESC LIMIT 1"
                        );
                        $stmtSess->execute([$visitorCookieId]);
                        $sessRow = $stmtSess->fetch(PDO::FETCH_ASSOC);
                        if ($sessRow) {
                            $attrCampaignId = $sessRow['utm_campaign'] ?: null; // mc_cid stored here
                            $attrSource     = $sessRow['utm_source']   ?: null;
                            $attrMedium     = $sessRow['utm_medium']   ?: null;
                        }
                    } catch (Exception $eAttr) {
                        // Non-fatal: attribution best-effort
                        error_log("Form attribution lookup failed: " . $eAttr->getMessage());
                    }
                }
            }

            // Merge attribution into extra payload
            if ($attrCampaignId) $extra['attributed_campaign_id'] = $attrCampaignId;
            if ($attrFlowId)     $extra['attributed_flow_id']     = $attrFlowId;
            if ($attrSource)     $extra['utm_source']             = $attrSource;
            if ($attrMedium)     $extra['utm_medium']             = $attrMedium;

            logActivity($pdo, $sid, 'form_submit', $formId, $formName, "Điền Form (+$pForm điểm)", null, null, $extra, $form_ws_id);

            // [POKE] Immediate Flow Interruption check
            // [FIX] Don't force NOW() here, just let the worker_priority call below re-evaluate.
            // This prevents skipping intentional Wait nodes.

            $pdo->commit();

            $pdo->prepare("SELECT RELEASE_LOCK(?)")->execute([$lockName]);

            if (function_exists('domationSyncSubscriberMatchOnly')) {
                domationSyncSubscriberMatchOnly($pdo, $sid);
            }

            // [OPTIMIZED - UX FAST RESPONSE]
            if (ob_get_length()) ob_clean();
            header("Content-Type: application/json; charset=UTF-8");
            $outJson = json_encode(['success' => true, 'data' => ['id' => $sid], 'message' => 'Đăng ký thành công!']);
            header("Connection: close");
            header("Content-Length: " . strlen($outJson));
            echo $outJson;
            
            if (function_exists('fastcgi_finish_request')) {
                fastcgi_finish_request();
            } else {
                @ob_flush();
                @flush();
            }

            // --- BACKGROUND EXECUTION --- (Does not block webhook response)

            // Identify visitor via API
            $visitorId = $_COOKIE['_mf_vid'] ?? null;
            if ($visitorId) {
                try {
                    $phone = $data['phoneNumber'] ?? null;
                    $identifyUrl = API_BASE_URL . "/identify_visitor.php";
                    $ch = curl_init();
                    curl_setopt($ch, CURLOPT_URL, $identifyUrl);
                    curl_setopt($ch, CURLOPT_POST, true);
                    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['visitor_id' => $visitorId, 'email' => $email, 'phone' => $phone]));
                    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
                    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($ch, CURLOPT_TIMEOUT, 2);
                    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
                    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2); // [FIX P34-F1] Added hostname verification
                    curl_exec($ch);
                    curl_close($ch);
                } catch (Exception $e) {
                    error_log("Visitor identification failed: " . $e->getMessage());
                }
            }

            // Priority trigger worker (Direct local execution to bypass WAF/firewall 403 blocks)
            try {
                $cronSecret = getenv('CRON_SECRET') ?: 'autoflow_cron_2026';
                $_GET['trigger_type'] = 'form';
                $_GET['target_id'] = $formId;
                $_GET['subscriber_id'] = $sid;
                $_GET['secret'] = $cronSecret;
                
                $backupMailer = isset($mailer) ? $mailer : null;
                require __DIR__ . '/worker_priority.php';
                if ($backupMailer) {
                    $mailer = $backupMailer;
                }
            } catch (Exception $ePriority) {
                error_log("Form Priority Trigger Local Error: " . $ePriority->getMessage());
            }

            // (Moved fast flush and release lock to top of background execution block)

            // ---- [NOTIFICATION EMAIL] Gửi thông báo khi có leads mới (CHẠY THỰC THI NGẦM) ----
            if (!empty($formData['notification_enabled']) && !empty($formData['notification_emails'])) {
                try {
                    require_once 'Mailer.php';
                    $mailer = new Mailer($pdo);

                    $notifEmails = array_filter(array_map('trim',
                        preg_split('/[,\n;]+/', $formData['notification_emails'])
                    ), fn($e) => filter_var($e, FILTER_VALIDATE_EMAIL));

                    $subject = $formData['notification_subject'] ?: "[" . $formData['name'] . "] Lead mới cần xử lý";

                    // Build data rows for email template
                    $standardLabels = [
                        'email'           => 'Email',
                        'firstName'       => 'Tên',
                        'lastName'        => 'Họ',
                        'phoneNumber'     => 'Số điện thoại',
                        'jobTitle'        => 'Chức danh',
                        'companyName'     => 'Công ty',
                        'country'         => 'Quốc gia',
                        'city'            => 'Thành phố',
                        'dateOfBirth'     => 'Ngày sinh',
                        'anniversaryDate' => 'Ngày đặc biệt',
                    ];
                    $knownSkip = array_merge(
                        array_keys($standardLabels),
                        ['form_id', 'tags', 'visitor_id', 'first_name', 'last_name',
                         'phone_number', 'job_title', 'company_name', 'date_of_birth', 'anniversary_date']
                    );

                    $rows = '';
                    // Standard fields first
                    foreach ($standardLabels as $key => $label) {
                        if (!empty($data[$key])) {
                            $val = htmlspecialchars($data[$key], ENT_QUOTES, 'UTF-8');
                            $rows .= "
                            <tr>
                              <td style='padding:10px 16px;font-size:13px;font-weight:600;color:#64748b;background:#f8fafc;width:38%;border-bottom:1px solid #e2e8f0;white-space:nowrap'>" . htmlspecialchars($label) . "</td>
                              <td style='padding:10px 16px;font-size:13px;color:#0f172a;border-bottom:1px solid #e2e8f0'>$val</td>
                            </tr>";
                        }
                    }
                    // Custom / extra fields
                    foreach ($data as $k => $v) {
                        if (in_array($k, $knownSkip)) continue;
                        if ($v === '' || $v === null || is_array($v)) continue;
                        $label = ucwords(str_replace(['_', '-'], ' ', $k));
                        $val   = htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
                        $rows .= "
                            <tr>
                              <td style='padding:10px 16px;font-size:13px;font-weight:600;color:#64748b;background:#f8fafc;width:38%;border-bottom:1px solid #e2e8f0;white-space:nowrap'>$label</td>
                              <td style='padding:10px 16px;font-size:13px;color:#0f172a;border-bottom:1px solid #e2e8f0'>$val</td>
                            </tr>";
                    }

                    $now   = date('H:i:s d/m/Y');
                    $ipStr = htmlspecialchars($ip ?? 'N/A');
                    $locStr = htmlspecialchars(($location['city'] ?? '') . ', ' . ($location['country'] ?? ''));

                    $html = "
<!DOCTYPE html>
<html lang='vi'>
<head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'></head>
<body style='margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif'>
  <table width='100%' cellpadding='0' cellspacing='0' style='background:#f1f5f9;padding:32px 16px'>
    <tr><td align='center'>
      <table width='600' cellpadding='0' cellspacing='0' style='max-width:600px;width:100%'>

        <!-- HEADER -->
        <tr><td style='background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);border-radius:16px 16px 0 0;padding:28px 32px;text-align:center'>
          <div style='display:inline-flex;align-items:center;gap:10px'>
            <div style='width:40px;height:40px;background:#f97316;border-radius:10px;display:inline-flex;align-items:center;justify-content:center'>
              <span style='font-size:20px'>📩</span>
            </div>
            <div style='text-align:left'>
              <div style='color:#f97316;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase'>AUTOFLOW</div>
              <div style='color:#ffffff;font-size:18px;font-weight:800'>Lead mới vừa đến!</div>
            </div>
          </div>
        </td></tr>

        <!-- BODY -->
        <tr><td style='background:#ffffff;padding:28px 32px'>
          <p style='margin:0 0 6px;font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px'>Biểu mẫu</p>
          <p style='margin:0 0 24px;font-size:20px;font-weight:800;color:#0f172a'>" . htmlspecialchars($formName) . "</p>

          <div style='background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:12px 16px;margin-bottom:24px;display:flex;align-items:center;gap:10px'>
            <span style='font-size:18px'>⚡</span>
            <span style='font-size:13px;font-weight:600;color:#c2410c'>Lead được gửi vào lúc <strong>$now</strong></span>
          </div>

          <!-- DATA TABLE -->
          <table width='100%' cellpadding='0' cellspacing='0' style='border-radius:12px;overflow:hidden;border:1px solid #e2e8f0'>
            $rows
          </table>

          <!-- IP / Location -->
          <table width='100%' cellpadding='0' cellspacing='0' style='margin-top:16px;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0'>
            <tr>
              <td style='padding:10px 16px;font-size:12px;color:#64748b;background:#f8fafc;border-right:1px solid #e2e8f0;width:140px'>
                🌏 Địa điểm
              </td>
              <td style='padding:10px 16px;font-size:12px;color:#475569'>$locStr &nbsp;|&nbsp; IP: $ipStr</td>
            </tr>
          </table>

          <div style='margin-top:24px;text-align:center'>
            <a href='" . API_BASE_URL . "/../#/subscribers/" . urlencode($sid) . "'
               style='display:inline-block;background:#0f172a;color:#ffffff;font-size:12px;font-weight:700;padding:14px 28px;border-radius:10px;text-decoration:none;letter-spacing:1px;text-transform:uppercase'>
              👤 Xem hồ sơ lead
            </a>
          </div>
        </td></tr>

        <!-- FOOTER -->
        <tr><td style='background:#f8fafc;border-top:1px solid #e2e8f0;border-radius:0 0 16px 16px;padding:16px 32px;text-align:center'>
          <p style='margin:0;font-size:11px;color:#94a3b8'>Thông báo tự động • AUTOFLOW &bull; Đặt lại cài đặt trong mục Biểu mẫu</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>";

                    // Tách CC Emails
                    $ccEmails = [];
                    if (!empty($formData['notification_cc_emails'])) {
                        $ccEmails = array_filter(array_map('trim', preg_split('/[,\n;]+/', $formData['notification_cc_emails'])), fn($e) => filter_var($e, FILTER_VALIDATE_EMAIL));
                    }
                    
                    $notifyPayload = [
                        'emails' => array_values($notifEmails),
                        'cc_emails' => array_values($ccEmails),
                        'subject' => $subject,
                        'html' => $html,
                        'workspace_id' => $form_ws_id
                    ];

                    error_log("TRACE: Form notification trigger started. Recipients: " . implode(',', $notifEmails));
                    // Direct local execution of worker_notify.php to bypass loopback firewall 403 blocks
                    try {
                        $data = $notifyPayload;
                        $backupMailer = isset($mailer) ? $mailer : null;
                        
                        require __DIR__ . '/worker_notify.php';
                        
                        if ($backupMailer) {
                            $mailer = $backupMailer;
                        }
                        error_log("TRACE: Form notification local require SUCCESS.");
                    } catch (Exception $eNotifyLocal) {
                        error_log("TRACE: Form notification local require FAILED. Error: " . $eNotifyLocal->getMessage());
                    }
                } catch (Exception $eNotif) {
                    error_log("Form Notification Error: " . $eNotif->getMessage());
                }
            }
            
            exit; // Must end here since jsonResponse was bypassed
        } catch (Exception $e) {
            if (isset($pdo) && $pdo->inTransaction())
                $pdo->rollBack();
            if (isset($lockName)) {
                $pdo->prepare("SELECT RELEASE_LOCK(?)")->execute([$lockName]);
            }
            jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
        }
    }

    // ---- Gửi email notification (sau khi already responded) ----
    // NOTE: PHP sẽ tiếp tục chạy đoạn này sau jsonResponse() vì jsonResponse() dùng exit()
    // Nhưng thực ra chúng ta cần đặt notification logic TRƯỚC jsonResponse.
    // Sử dụng fire-and-forget qua worker_notify.php

    // --- CÁC METHOD KHÁC (GET/PUT/DELETE) GIỮ NGUYÊN ---
    switch ($method) {
        case 'GET':
            // [PERF] Release session lock immediately unless we need to write to it.
            // This prevents "Pending" requests in browser DevTools when multiple API calls
            // are fired at once (e.g. on page mount).
            if (session_id()) session_write_close();

            try {
                if (($_GET['action'] ?? '') === 'embed' && $path) {
                    $stmt = $pdo->prepare("SELECT id, name, status, fields_json FROM forms WHERE id = ? LIMIT 1");
                    $stmt->execute([$path]);
                    $form = $stmt->fetch(PDO::FETCH_ASSOC);
                    if ($form && ($form['status'] ?? 'active') === 'active') {
                        $form['fields'] = json_decode($form['fields_json'] ?? '[]');
                        unset($form['fields_json']);
                        jsonResponse(true, $form);
                    } else {
                        jsonResponse(false, null, 'Không tìm thấy Form hoặc Form đã ngừng hoạt động');
                    }
                } elseif ($path) {
                    $stmt = $pdo->prepare("
                        SELECT f.*,
                               u_creator.id AS creator_id,
                               u_creator.full_name AS creator_name,
                               u_creator.email AS creator_email,
                               u_creator.avatar_url AS creator_avatar,
                               u_creator.role AS creator_role
                        FROM forms f
                        LEFT JOIN users u_creator ON u_creator.id = f.created_by
                        WHERE f.id = ? AND f.workspace_id = ?
                    ");
                    $stmt->execute([$path, $admin_workspace_id]);
                    $form = $stmt->fetch(PDO::FETCH_ASSOC);
                    if ($form) {
                        $form['fields'] = json_decode($form['fields_json'] ?? '[]');
                        $form['targetListId'] = $form['target_list_id'];
                        $form['notificationEnabled'] = (bool)($form['notification_enabled'] ?? false);
                        $form['notificationEmails'] = $form['notification_emails'] ?? '';
                        $form['notificationCcEmails'] = $form['notification_cc_emails'] ?? '';
                        $form['notificationSubject'] = $form['notification_subject'] ?? '';
                        $form['creator'] = function_exists('domationFormatCreator') ? domationFormatCreator($form) : null;
                        // Use specialized index for count
                        $stmtS = $pdo->prepare("SELECT COUNT(*) FROM subscriber_activity WHERE type='form_submit' AND reference_id = ? AND workspace_id = ?");
                        $stmtS->execute([$path, $admin_workspace_id]);
                        $form['stats'] = ['submissions' => (int) $stmtS->fetchColumn()];
                        unset($form['fields_json'], $form['target_list_id'], $form['notification_enabled'], $form['notification_emails'], $form['notification_cc_emails'], $form['notification_subject']);
                        jsonResponse(true, $form);
                    } else
                        jsonResponse(false, null, 'Không tìm thấy Form');
                } elseif (!empty($_GET['list_id'])) {
                    // NEW: Check which forms are linked to this list
                    $stmt = $pdo->prepare("SELECT id, name FROM forms WHERE target_list_id = ? AND workspace_id = ?");
                    $stmt->execute([$_GET['list_id'], $admin_workspace_id]);
                    jsonResponse(true, $stmt->fetchAll(PDO::FETCH_ASSOC));
                } else {
                    $stmt = $pdo->prepare(
                        "SELECT f.*,
                                COALESCE(sa_count.cnt, 0) as submission_count,
                                u_creator.id AS creator_id,
                                u_creator.full_name AS creator_name,
                                u_creator.email AS creator_email,
                                u_creator.avatar_url AS creator_avatar,
                                u_creator.role AS creator_role
                         FROM forms f
                         LEFT JOIN (
                             SELECT reference_id, COUNT(*) as cnt
                             FROM subscriber_activity
                             WHERE type = 'form_submit' AND workspace_id = ?
                             GROUP BY reference_id
                         ) sa_count ON sa_count.reference_id = f.id
                         LEFT JOIN users u_creator ON u_creator.id = f.created_by
                         WHERE f.workspace_id = ?
                         ORDER BY f.created_at DESC"
                    );
                    $stmt->execute([$admin_workspace_id, $admin_workspace_id]);
                    $data = array_map(function ($f) {
                        $f['fields'] = json_decode($f['fields_json'] ?? '[]');
                        $f['targetListId'] = $f['target_list_id'];
                        $f['status'] = $f['status'] ?? 'active';
                        $f['notificationEnabled'] = (bool)($f['notification_enabled'] ?? false);
                        $f['notificationEmails'] = $f['notification_emails'] ?? '';
                        $f['notificationCcEmails'] = $f['notification_cc_emails'] ?? '';
                        $f['notificationSubject'] = $f['notification_subject'] ?? '';
                        $f['stats'] = ['submissions' => (int) ($f['submission_count'] ?? 0)];
                        $f['creator'] = function_exists('domationFormatCreator') ? domationFormatCreator($f) : null;
                        unset($f['fields_json'], $f['target_list_id'], $f['submission_count'], $f['notification_enabled'], $f['notification_emails'], $f['notification_cc_emails'], $f['notification_subject']);
                        return $f;
                    }, $stmt->fetchAll(PDO::FETCH_ASSOC));
                    jsonResponse(true, $data);
                }

            } catch (Exception $e) {
                jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
            }
            break;
        case 'POST':
            try {
                $data = json_decode(file_get_contents("php://input"), true);
                $id = $data['id'] ?? bin2hex(random_bytes(16));
                $fields = json_encode($data['fields'] ?? []);
                $notifEnabled = !empty($data['notificationEnabled']) ? 1 : 0;
                $notifEmails  = trim($data['notificationEmails'] ?? '');
                $notifCcEmails = trim($data['notificationCcEmails'] ?? '');
                $notifSubject = trim($data['notificationSubject'] ?? '');
                $actorUserId = function_exists('get_current_user_id') ? get_current_user_id() : null;
                $pdo->prepare("INSERT INTO forms (workspace_id, id, name, status, target_list_id, fields_json, notification_enabled, notification_emails, notification_cc_emails, notification_subject, created_by, updated_by, created_at) VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, NOW())")
                    ->execute([$admin_workspace_id, $id, $data['name'], $data['targetListId'], $fields, $notifEnabled, $notifEmails ?: null, $notifCcEmails ?: null, $notifSubject ?: null, $actorUserId, $actorUserId]);
                jsonResponse(true, ['id' => $id, 'status' => 'active', 'created_by' => $actorUserId, 'updated_by' => $actorUserId]);
            } catch (Exception $e) {
                jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
            }
            break;
        case 'PUT':
            try {
                if (!$path)
                    jsonResponse(false, null, 'ID required');
                $data = json_decode(file_get_contents("php://input"), true);
                $actorUserId = function_exists('get_current_user_id') ? get_current_user_id() : null;

                // [TOGGLE STATUS] PUT ?route=toggle_status
                if ($route === 'toggle_status') {
                    $stmtCur = $pdo->prepare("SELECT status FROM forms WHERE id = ? AND workspace_id = ?");
                    $stmtCur->execute([$path, $admin_workspace_id]);
                    $curStatus = $stmtCur->fetchColumn();
                    if ($curStatus === false) jsonResponse(false, null, 'Không tìm thấy biểu mẫu');
                    $newStatus = $curStatus === 'active' ? 'inactive' : 'active';
                    $pdo->prepare("UPDATE forms SET status = ?, updated_by = ? WHERE id = ? AND workspace_id = ?")->execute([$newStatus, $actorUserId, $path, $admin_workspace_id]);
                    jsonResponse(true, ['id' => $path, 'status' => $newStatus], 'Đã ' . ($newStatus === 'active' ? 'kích hoạt' : 'vô hiệu hoá') . ' biểu mẫu');
                }

                $fields = json_encode($data['fields'] ?? []);
                $notifEnabled = !empty($data['notificationEnabled']) ? 1 : 0;
                $notifEmails  = trim($data['notificationEmails'] ?? '');
                $notifCcEmails = trim($data['notificationCcEmails'] ?? '');
                $notifSubject = trim($data['notificationSubject'] ?? '');
                $pdo->prepare("UPDATE forms SET name = ?, target_list_id = ?, fields_json = ?, notification_enabled = ?, notification_emails = ?, notification_cc_emails = ?, notification_subject = ?, updated_by = ? WHERE id = ? AND workspace_id = ?")
                    ->execute([$data['name'], $data['targetListId'], $fields, $notifEnabled, $notifEmails ?: null, $notifCcEmails ?: null, $notifSubject ?: null, $actorUserId, $path, $admin_workspace_id]);
                jsonResponse(true, $data);
            } catch (Exception $e) {
                jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
            }
            break;
        case 'DELETE':
            try {
                if (!$path)
                    jsonResponse(false, null, 'ID required');
                $pdo->prepare("DELETE FROM forms WHERE id = ? AND workspace_id = ?")->execute([$path, $admin_workspace_id]);
                // Subscriber activity deletion is secondary and safe
                $pdo->prepare("DELETE FROM subscriber_activity WHERE type = 'form_submit' AND reference_id = ? AND workspace_id = ?")->execute([$path, $admin_workspace_id]);
                jsonResponse(true, ['id' => $path]);
            } catch (Exception $e) {
                jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
            }
            break;
    }
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction())
        $pdo->rollBack();
    jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
}
?>
