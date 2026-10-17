<?php
// api/survey_public.php — Public Survey API (No Auth Required)
// Rate limited: 10 submissions per IP per hour
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once 'db_connect.php';
require_once 'flow_helpers.php';

$slug   = $_GET['slug'] ?? '';
$action = $_GET['action'] ?? 'schema';
$input  = json_decode(file_get_contents('php://input'), true) ?? [];

if (empty($slug)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Slug is required']);
    exit;
}

try {
    // [BUG-FSV-04] Fetch survey by slug OR id so QR codes redirecting to /s/{survey_id} work 100%
    $stmt = $pdo->prepare("SELECT * FROM surveys WHERE (slug = ? OR id = ?) LIMIT 1");
    $stmt->execute([$slug, $slug]);
    $survey = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$survey) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'SURVEY_NOT_FOUND']);
        exit;
    }

    // ─── GET SCHEMA ──────────────────────────────────────────────────────────
    if ($action === 'schema') {
        // Check if survey is accessible
        $status = $survey['status'];
        $isPreview = !empty($_GET['preview']);

        if (!$isPreview) {
            if ($status === 'draft') {
                echo json_encode(['success' => false, 'error' => 'SURVEY_NOT_PUBLISHED', 'status' => $status]);
                exit;
            }
            if (in_array($status, ['paused', 'closed'])) {
                echo json_encode(['success' => false, 'error' => 'SURVEY_CLOSED', 'status' => $status]);
                exit;
            }

            // Check close_at
            if (!empty($survey['close_at']) && strtotime($survey['close_at']) < time()) {
                $pdo->prepare("UPDATE surveys SET status = 'closed' WHERE id = ?")->execute([$survey['id']]);
                echo json_encode(['success' => false, 'error' => 'SURVEY_EXPIRED']);
                exit;
            }

            // Check response_limit
            if (!empty($survey['response_limit'])) {
                $countStmt = $pdo->prepare("SELECT COUNT(*) FROM survey_responses WHERE survey_id = ?");
                $countStmt->execute([$survey['id']]);
                if ((int)$countStmt->fetchColumn() >= (int)$survey['response_limit']) {
                    echo json_encode(['success' => false, 'error' => 'SURVEY_LIMIT_REACHED']);
                    exit;
                }
            }
        }

        // [PREFILL LOOKUP] Look up subscriber if sid, email, or uid is passed in query
        $prefill = null;
        $querySid = trim((string)($_GET['sid'] ?? ''));
        $queryEmail = filter_var($_GET['email'] ?? ($_GET['uid'] ?? ''), FILTER_VALIDATE_EMAIL) ?: '';
        $queryName = trim((string)($_GET['name'] ?? ''));
        $queryPhone = trim((string)($_GET['phone'] ?? ''));
        $querySig = trim((string)($_GET['sig'] ?? ''));
        $isSignedSid = !empty($querySid) && !empty($querySig) && hash_equals(hash_hmac('sha256', $querySid, defined('JWT_SECRET') ? JWT_SECRET : 'domation_sig'), $querySig);
        
        $sub = null;
        if (!empty($querySid)) {
            $stmtSub = $pdo->prepare("SELECT id, email, first_name, last_name, phone_number, company_name FROM subscribers WHERE id = ? LIMIT 1");
            $stmtSub->execute([$querySid]);
            $sub = $stmtSub->fetch(PDO::FETCH_ASSOC);
        }
        if (!$sub && !empty($queryEmail) && $isSignedSid) {
            $stmtSub = $pdo->prepare("SELECT id, email, first_name, last_name, phone_number, company_name FROM subscribers WHERE email = ? LIMIT 1");
            $stmtSub->execute([$queryEmail]);
            $sub = $stmtSub->fetch(PDO::FETCH_ASSOC);
        }
        
        if ($sub) {
            $fullName = trim(($sub['first_name'] ?? '') . ' ' . ($sub['last_name'] ?? ''));
            $rawEmail = (string)($sub['email'] ?? ($queryEmail ?: ''));
            if (strpos($rawEmail, '@no-email.domation') !== false) {
                $rawEmail = '';
            }
            $rawPhone = (string)($sub['phone_number'] ?: $queryPhone);
            // [SEC-06] Mask PII (email, phone) when prefilling by sid unless signed
            if (!$isSignedSid) {
                $maskedEmail = $rawEmail !== '' ? preg_replace('/^(.)(.*)(@.*)$/', '$1***$3', $rawEmail) : '';
                $maskedPhone = $rawPhone !== '' ? preg_replace('/^(\d{2,3})\d+(\d{2})$/', '$1*****$2', $rawPhone) : '';
            } else {
                $maskedEmail = $rawEmail;
                $maskedPhone = $rawPhone;
            }
            $prefill = [
                'subscriber_id' => $sub['id'],
                'email'         => $maskedEmail,
                'first_name'    => $sub['first_name'] ?: $queryName,
                'last_name'     => $sub['last_name'] ?? '',
                'full_name'     => $fullName ?: ($sub['first_name'] ?: ($queryName ?: '')),
                'phone_number'  => $maskedPhone,
                'company_name'  => $sub['company_name'] ?? ''
            ];
        } elseif (!empty($queryEmail) || !empty($queryName) || !empty($queryPhone) || !empty($querySid)) {
            // Prefill directly from URL query params (e.g. from Mailflow email link)
            $prefill = [
                'subscriber_id' => $querySid,
                'email'         => $queryEmail,
                'first_name'    => $queryName,
                'last_name'     => '',
                'full_name'     => $queryName,
                'phone_number'  => $queryPhone,
                'company_name'  => ''
            ];
        }

        $rawBlocks = json_decode($survey['blocks_json'] ?? '[]', true);
        $normBlocks = normalizePublicSurveyBlocks(is_array($rawBlocks) ? $rawBlocks : []);
        $coverStyle = json_decode($survey['cover_style'] ?? '{}', true) ?: [];
        if (empty($coverStyle['cardShadow'])) {
            $coverStyle['cardShadow'] = 'none';
        }

        echo json_encode([
            'success' => true,
            'data' => [
                'id'           => $survey['id'],
                'name'         => $survey['name'],
                'slug'         => $survey['slug'],
                'status'       => $survey['status'],
                'blocks'       => $normBlocks,
                'settings'     => json_decode($survey['settings_json'] ?? '{}'),
                'thank_you_page' => json_decode($survey['thank_you_page'] ?? '{}'),
                'cover_style'  => $coverStyle,
                'allow_anonymous' => (bool)$survey['allow_anonymous'],
                'require_login'   => (bool)$survey['require_login'],
                'prefill'      => $prefill,
            ]
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // ─── SUBMIT ──────────────────────────────────────────────────────────────
    if ($action === 'submit' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        // Enforce status and accessibility check
        $status = $survey['status'];
        if ($status === 'draft') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'SURVEY_NOT_PUBLISHED']);
            exit;
        }
        if (in_array($status, ['paused', 'closed'])) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'SURVEY_CLOSED']);
            exit;
        }

        // Check close_at expiration
        if (!empty($survey['close_at']) && strtotime($survey['close_at']) < time()) {
            $pdo->prepare("UPDATE surveys SET status = 'closed' WHERE id = ?")->execute([$survey['id']]);
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'SURVEY_EXPIRED']);
            exit;
        }

        // Check response_limit limit
        if (!empty($survey['response_limit'])) {
            $countStmt = $pdo->prepare("SELECT COUNT(*) FROM survey_responses WHERE survey_id = ?");
            $countStmt->execute([$survey['id']]);
            if ((int)$countStmt->fetchColumn() >= (int)$survey['response_limit']) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'SURVEY_LIMIT_REACHED']);
                exit;
            }
        }

        // Enforce countdown expiration lock
        $themeObj = json_decode($survey['cover_style'] ?? '{}', true);
        if (!empty($themeObj['coverCountdown']) && strtotime($themeObj['coverCountdown']) <= time()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'SURVEY_EXPIRED']);
            exit;
        }

        // High-concurrency Rate limiting by IP hash (1000/hr per IP to support 100s of concurrent respondents at events/shared Wi-Fi)
        $clientIp = '0.0.0.0';
        if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
            $clientIp = $_SERVER['HTTP_CF_CONNECTING_IP'];
        } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
            $clientIp = trim($ips[0]);
        } elseif (!empty($_SERVER['REMOTE_ADDR'])) {
            $clientIp = $_SERVER['REMOTE_ADDR'];
        }
        if (!filter_var($clientIp, FILTER_VALIDATE_IP)) {
            $clientIp = '0.0.0.0';
        }
        $ipHash = hash('sha256', $clientIp);
        $rateLimitStmt = $pdo->prepare("
            SELECT COUNT(*) FROM survey_responses
            WHERE survey_id = ? AND ip_hash = ? AND submitted_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
        ");
        $rateLimitStmt->execute([$survey['id'], $ipHash]);
        if ((int)$rateLimitStmt->fetchColumn() >= 1000) {
            http_response_code(429);
            echo json_encode(['success' => false, 'error' => 'RATE_LIMIT_EXCEEDED']);
            exit;
        }

        // Session token dedup
        $sessionToken = $_SERVER['HTTP_X_SESSION_TOKEN'] ?? ($input['session_token'] ?? '');
        if (empty($sessionToken)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'SESSION_TOKEN_REQUIRED']);
            exit;
        }
        $dedupStmt = $pdo->prepare("SELECT id FROM survey_responses WHERE session_token = ?");
        $dedupStmt->execute([$sessionToken]);
        if ($dedupStmt->fetch()) {
            echo json_encode(['success' => false, 'error' => 'ALREADY_SUBMITTED']);
            exit;
        }

        // [SEC] Sanitize payload to prevent XSS (Strip dangerous tags without corrupting entity chars)
        $sanitizePayload = function($data) use (&$sanitizePayload) {
            if (is_array($data)) {
                $sanitized = [];
                foreach ($data as $k => $v) {
                    $sanitized[$k] = $sanitizePayload($v);
                }
                return $sanitized;
            }
            if (is_scalar($data)) {
                $str = (string)$data;
                $str = strip_tags($str);
                return trim($str);
            }
            return $data;
        };

        $answers = $sanitizePayload($input['answers'] ?? []);
        $submittedEmail = null;
        $rawRespondentEmail = trim((string)($input['respondent_email'] ?? ($input['email'] ?? ($input['uid'] ?? ($_GET['email'] ?? ($_GET['uid'] ?? ''))))));
        if ($rawRespondentEmail !== '' && strpos($rawRespondentEmail, '*') === false && filter_var($rawRespondentEmail, FILTER_VALIDATE_EMAIL)) {
            $submittedEmail = strtolower($rawRespondentEmail);
        }

        if ($survey['one_per_email']) {
            foreach ($answers as $ans) {
                if (($ans['type'] ?? '') === 'email' && !empty($ans['answer_text']) && strpos((string)$ans['answer_text'], '*') === false) {
                    $candidateEmail = strtolower(trim((string)$ans['answer_text']));
                    if (filter_var($candidateEmail, FILTER_VALIDATE_EMAIL)) {
                        $submittedEmail = $candidateEmail;
                    }
                }
            }
            if ($submittedEmail) {
                $emailCheckStmt = $pdo->prepare("
                    SELECT r.id FROM survey_responses r
                    JOIN subscribers s ON s.id = r.subscriber_id
                    WHERE r.survey_id = ? AND s.email = ? AND s.workspace_id = ?
                    LIMIT 1
                ");
                $emailCheckStmt->execute([$survey['id'], $submittedEmail, $survey['workspace_id']]);
                if ($emailCheckStmt->fetch()) {
                    echo json_encode(['success' => false, 'error' => 'EMAIL_ALREADY_RESPONDED']);
                    exit;
                }
            }
        }

        // Detect device
        $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
        $device = 'desktop';
        if (preg_match('/Mobile|Android|iPhone|iPad/i', $ua)) {
            $device = preg_match('/iPad|Tablet/i', $ua) ? 'tablet' : 'mobile';
        }

        // Source channel & UTM detection
        $rawSource = $_SERVER['HTTP_X_SURVEY_SOURCE'] ?? ($input['source_channel'] ?? ($input['utm_source'] ?? ($_GET['src'] ?? ($_GET['utm_source'] ?? ''))));
        $utmMed = strtolower(trim((string)($input['utm_medium'] ?? ($_GET['utm_medium'] ?? ''))));
        $utmSrc = strtolower(trim((string)($input['utm_source'] ?? ($_GET['utm_source'] ?? ''))));
        $rawSourceLower = strtolower(trim((string)$rawSource));

        if (
            $rawSourceLower === 'email' || 
            $rawSourceLower === 'email_embed' || 
            $rawSourceLower === 'mailflow' || 
            $utmMed === 'email' || 
            $utmSrc === 'mailflow' || 
            !empty($input['email']) || 
            !empty($input['respondent_email']) ||
            !empty($_GET['email']) || 
            !empty($input['sid']) || 
            !empty($_GET['sid'])
        ) {
            $sourceChannel = 'email_embed';
        } elseif (in_array($rawSourceLower, ['qr_code', 'widget', 'api'])) {
            $sourceChannel = $rawSourceLower;
        } else {
            $sourceChannel = 'direct_link';
        }

        // Geo Location (from Cloudflare if available)
        $geoCountry = $_SERVER['HTTP_CF_IPCOUNTRY'] ?? null;
        $geoCity = $_SERVER['HTTP_CF_IPCITY'] ?? null;

        $subscriberId = null;
        $submittedName = trim((string)($input['respondent_name'] ?? ($input['name'] ?? ($_GET['name'] ?? ''))));
        $submittedPhone = trim((string)($input['respondent_phone'] ?? ($input['phone'] ?? ($_GET['phone'] ?? ''))));
        if (strpos($submittedPhone, '*') !== false) {
            $submittedPhone = '';
        }
        $submittedCompany = trim((string)($input['company'] ?? ($_GET['company'] ?? '')));
        $npsValue = null;

        // Load blocks map so we can also inspect block labels/types when extracting respondent identity
        $rawBlocks = json_decode($survey['blocks_json'] ?? '[]', true);
        $blocks = normalizePublicSurveyBlocks(is_array($rawBlocks) ? $rawBlocks : []);
        $blocksById = [];
        foreach ($blocks as $blk) {
            if (!empty($blk['id'])) {
                $blocksById[$blk['id']] = $blk;
            }
        }
        
        foreach ($answers as $ans) {
            $bId = $ans['block_id'] ?? ($ans['question_id'] ?? '');
            $blk = $blocksById[$bId] ?? null;
            $ansType = $ans['type'] ?? ($blk['type'] ?? '');
            $ansText = trim((string)($ans['answer_text'] ?? ''));
            $ansLabel = mb_strtolower(trim((string)($ans['label'] ?? ($blk['label'] ?? ($blk['question'] ?? '')))));
            
            if ($ansType === 'nps' && isset($ans['answer_num']) && is_numeric($ans['answer_num'])) {
                $npsValue = (int)$ans['answer_num'];
            }
            if ($ansType === 'email' && !empty($ansText) && strpos($ansText, '*') === false && filter_var($ansText, FILTER_VALIDATE_EMAIL)) {
                $submittedEmail = strtolower($ansText);
            }
            if (($ansType === 'phone' || $ansType === 'phone_number') && !empty($ansText) && strpos($ansText, '*') === false) {
                $submittedPhone = $ansText;
            }
            if ($ansType === 'short_text' && !empty($ansText)) {
                if (empty($submittedEmail) && strpos($ansText, '*') === false && filter_var($ansText, FILTER_VALIDATE_EMAIL)) {
                    $submittedEmail = strtolower($ansText);
                } elseif (strpos($ansLabel, 'tên') !== false || strpos($ansLabel, 'name') !== false || strpos($ansLabel, 'họ') !== false) {
                    $submittedName = $ansText;
                } elseif ((strpos($ansLabel, 'điện thoại') !== false || strpos($ansLabel, 'sđt') !== false || strpos($ansLabel, 'phone') !== false) && strpos($ansText, '*') === false) {
                    $submittedPhone = $ansText;
                } elseif (strpos($ansLabel, 'công ty') !== false || strpos($ansLabel, 'company') !== false || strpos($ansLabel, 'đơn vị') !== false) {
                    $submittedCompany = $ansText;
                }
            }
        }

        // Check UID or email or SID passed from query/input
        $passedSid = trim((string)($input['sid'] ?? ($input['subscriber_id'] ?? ($_GET['sid'] ?? ''))));
        $passedUid = filter_var(trim((string)($input['respondent_email'] ?? ($input['uid'] ?? ($input['email'] ?? ($_GET['uid'] ?? ($_GET['email'] ?? '')))))), FILTER_VALIDATE_EMAIL);
        if (empty($submittedEmail) && $passedUid) {
            $submittedEmail = strtolower($passedUid);
        }

        // [BUG-FSV-03] Normalize phone for phone-only lookups & subscriber creation
        $normPhone9 = class_exists('DomationContactMatcher') ? DomationContactMatcher::normalizePhone9($submittedPhone) : preg_replace('/[^0-9]/', '', $submittedPhone);

        $existSub = null;
        if (!empty($passedSid)) {
            // First search within workspace
            $subStmt = $pdo->prepare("SELECT id, email, phone_number, first_name, last_name, company_name FROM subscribers WHERE id = ? AND workspace_id = ? LIMIT 1");
            $subStmt->execute([$passedSid, $survey['workspace_id']]);
            $existSub = $subStmt->fetch(PDO::FETCH_ASSOC);
            if (!$existSub) {
                // Fallback cross-workspace lookup for campaigns originating from main/shared workspace
                $subStmt = $pdo->prepare("SELECT id, email, phone_number, first_name, last_name, company_name FROM subscribers WHERE id = ? LIMIT 1");
                $subStmt->execute([$passedSid]);
                $existSub = $subStmt->fetch(PDO::FETCH_ASSOC);
            }
        }
        if (!$existSub && !empty($submittedEmail)) {
            $subStmt = $pdo->prepare("SELECT id, email, phone_number, first_name, last_name, company_name FROM subscribers WHERE email = ? AND workspace_id = ? LIMIT 1");
            $subStmt->execute([$submittedEmail, $survey['workspace_id']]);
            $existSub = $subStmt->fetch(PDO::FETCH_ASSOC);
            if (!$existSub) {
                $subStmt = $pdo->prepare("SELECT id, email, phone_number, first_name, last_name, company_name FROM subscribers WHERE email = ? LIMIT 1");
                $subStmt->execute([$submittedEmail]);
                $existSub = $subStmt->fetch(PDO::FETCH_ASSOC);
            }
        }
        if (!$existSub && !empty($normPhone9) && strlen($normPhone9) >= 8) {
            $subStmt = $pdo->prepare("SELECT id, email, phone_number, first_name, last_name, company_name FROM subscribers WHERE phone_number LIKE ? AND workspace_id = ? LIMIT 1");
            $subStmt->execute(['%' . $normPhone9, $survey['workspace_id']]);
            $existSub = $subStmt->fetch(PDO::FETCH_ASSOC);
            if (!$existSub) {
                $subStmt = $pdo->prepare("SELECT id, email, phone_number, first_name, last_name, company_name FROM subscribers WHERE phone_number LIKE ? LIMIT 1");
                $subStmt->execute(['%' . $normPhone9]);
                $existSub = $subStmt->fetch(PDO::FETCH_ASSOC);
            }
        }

        if ($existSub) {
            $subscriberId = $existSub['id'];
            if (empty($submittedEmail) && !empty($existSub['email']) && strpos((string)$existSub['email'], '@no-email.domation') === false) {
                $submittedEmail = $existSub['email'];
            }
            if (empty($submittedPhone) && !empty($existSub['phone_number'])) {
                $submittedPhone = $existSub['phone_number'];
            }
            $updateFields = [];
            $updateParams = [];
            
            // Update missing phone
            if (!empty($submittedPhone) && empty($existSub['phone_number'])) {
                $updateFields[] = "phone_number = ?";
                $updateParams[] = $submittedPhone;
            }
            // Update real email if previously placeholder
            if (!empty($submittedEmail) && (empty($existSub['email']) || strpos((string)$existSub['email'], '@no-email.domation') !== false)) {
                $updateFields[] = "email = ?";
                $updateParams[] = $submittedEmail;
            }
            // Update missing name
            if (!empty($submittedName) && (empty($existSub['first_name']) || $existSub['first_name'] === 'Guest' || $existSub['first_name'] === 'Khách khảo sát')) {
                $updateFields[] = "first_name = ?";
                $updateParams[] = $submittedName;
            }
            // Update missing company
            if (!empty($submittedCompany) && empty($existSub['company_name'])) {
                $updateFields[] = "company_name = ?";
                $updateParams[] = $submittedCompany;
            }
            
            if (!empty($updateFields)) {
                $updateParams[] = $subscriberId;
                try {
                    $pdo->prepare("UPDATE subscribers SET " . implode(', ', $updateFields) . " WHERE id = ?")
                        ->execute($updateParams);
                } catch (Exception $e) {}
            }
        } elseif (!empty($submittedEmail) || !empty($submittedPhone)) {
            // [BUG-FSV-03] Support creating subscriber even when email is empty (using phone@no-email.domation)
            $effectiveEmail = !empty($submittedEmail)
                ? $submittedEmail
                : (preg_replace('/[^0-9]/', '', $submittedPhone) . '@no-email.domation');
            $subscriberId = !empty($passedSid) ? $passedSid : generateUUID();
            try {
                $pdo->prepare("INSERT INTO subscribers (id, email, phone_number, first_name, company_name, source, workspace_id, created_at)
                    VALUES (?, ?, ?, ?, ?, 'survey', ?, NOW())")
                    ->execute([$subscriberId, $effectiveEmail, $submittedPhone, $submittedName ?: 'Khách khảo sát', $submittedCompany ?? '', $survey['workspace_id']]);
            } catch (Exception $e) {
                $subFind = $pdo->prepare("SELECT id FROM subscribers WHERE email = ? LIMIT 1");
                $subFind->execute([$effectiveEmail]);
                $subscriberId = $subFind->fetchColumn() ?: $subscriberId;
            }
        }

        // [MATCH-ONLY ("3 KHÔNG")] Match subscriber with existing MYERP.contacts without creating any new contact or notification
        $contactId = null;
        if ($subscriberId && class_exists('DomationContactMatcher')) {
            $contactId = DomationContactMatcher::syncSubscriberMatchOnly($pdo, (string)$subscriberId);
        } elseif ($subscriberId && function_exists('domationSyncSubscriberMatchOnly')) {
            $contactId = domationSyncSubscriberMatchOnly($pdo, (string)$subscriberId);
        }

        if ($subscriberId) {
            // Add to Target List if configured (explicitly set workspace_id for isolation)
            if (!empty($survey['target_list_id'])) {
                $stmtListIns = $pdo->prepare("INSERT IGNORE INTO subscriber_lists (subscriber_id, list_id, workspace_id) VALUES (?, ?, ?)");
                $stmtListIns->execute([$subscriberId, $survey['target_list_id'], $survey['workspace_id']]);
                if ($stmtListIns->rowCount() > 0) {
                    $pdo->prepare("UPDATE lists SET subscriber_count = (SELECT COUNT(*) FROM subscriber_lists WHERE list_id = ? AND workspace_id = ?) WHERE id = ? AND workspace_id = ?")
                        ->execute([$survey['target_list_id'], $survey['workspace_id'], $survey['target_list_id'], $survey['workspace_id']]);
                }
            }
        }

        // INSERT response
        $responseId = generateUUID();
        
        // [BUG-FSV-01] Decode settings_json before quiz scoring and voucher reward assignment
        $settingsObj = json_decode($survey['settings_json'] ?? '{}', true) ?: [];

        // --- QUIZ ANTI-CHEAT SERVER-SIDE VALIDATION ---
        $totalScore = null;
        $maxScore = null;
        if (!empty($settingsObj['quiz']['enabled'])) {
            $totalScore = 0;
            $maxScore = 0;
            $ansMap = [];
            foreach ($answers as $ans) {
                if (!empty($ans['block_id'])) {
                    $ansMap[$ans['block_id']] = $ans;
                }
            }
            foreach ($blocks as $block) {
                if (!empty($block['quizPoints'])) {
                    $maxScore += (float)$block['quizPoints'];
                    if (isset($ansMap[$block['id']])) {
                        $ans = $ansMap[$block['id']];
                        $matchType = $block['correctAnswerMatch'] ?? 'exact';
                        $correct = $block['correctAnswer'] ?? null;
                        
                        $isCorrect = false;
                        if ($correct !== null) {
                            $type = $ans['type'] ?? '';
                            if (in_array($type, ['single_choice', 'dropdown', 'yes_no', 'short_text', 'number'])) {
                                $val = strtolower((string)($ans['answer_text'] ?? $ans['answer_num'] ?? ''));
                                $target = strtolower((string)$correct);
                                if ($matchType === 'contains' && strpos($val, $target) !== false) $isCorrect = true;
                                else if ($val === $target) $isCorrect = true;
                            } else if ($type === 'multi_choice' && is_array($ans['answer_json'] ?? null) && is_array($correct)) {
                                $arrAns = $ans['answer_json'];
                                $arrCorr = $correct;
                                sort($arrAns);
                                sort($arrCorr);
                                if (json_encode($arrAns) === json_encode($arrCorr)) $isCorrect = true;
                            }
                        }
                        if ($isCorrect) {
                            $totalScore += (float)$block['quizPoints'];
                        }
                    }
                }
            }
        }
        
        $endScreenId = $input['end_screen_id'] ?? 'default';

        $pdo->prepare("
            INSERT INTO survey_responses
              (id, survey_id, subscriber_id, session_token, answers_json, completion_rate,
               time_spent_sec, source_channel, utm_source, utm_medium, utm_campaign,
               ip_hash, user_agent, device_type, referrer_url, geo_country, geo_city,
               total_score, max_score, end_screen_id, workspace_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ")->execute([
            $responseId, $survey['id'], $subscriberId, $sessionToken,
            json_encode($answers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            (int)($input['completion_rate'] ?? 100),
            $input['time_spent_sec'] ?? null,
            $sourceChannel,
            $input['utm_source'] ?? ($_GET['utm_source'] ?? ($sourceChannel === 'email_embed' ? 'mailflow' : null)),
            $input['utm_medium'] ?? ($_GET['utm_medium'] ?? ($sourceChannel === 'email_embed' ? 'email' : null)),
            $input['utm_campaign'] ?? ($_GET['utm_campaign'] ?? null),
            $ipHash, substr($ua, 0, 512), $device,
            substr($_SERVER['HTTP_REFERER'] ?? '', 0, 1024),
            $geoCountry, $geoCity,
            $totalScore, $maxScore, $endScreenId,
            $survey['workspace_id']
        ]);

        // Re-sync after inserting survey_responses so contact_id is propagated onto survey_responses & survey_completed_count is refreshed
        if ($subscriberId && class_exists('DomationContactMatcher')) {
            $syncedCid = DomationContactMatcher::syncSubscriberMatchOnly($pdo, (string)$subscriberId);
            if ($syncedCid) {
                $contactId = $syncedCid;
            }
        }
        if (!$contactId && class_exists('DomationContactMatcher') && (!empty($submittedEmail) || !empty($submittedPhone))) {
            $contactId = DomationContactMatcher::findExistingContactId($pdo, $submittedEmail, $submittedPhone);
            if ($contactId) {
                try {
                    $pdo->prepare("UPDATE survey_responses SET contact_id = ? WHERE id = ? AND contact_id IS NULL")
                        ->execute([$contactId, $responseId]);
                } catch (Throwable $e) {}
            }
        }

        // INSERT answer details
        $detailStmt = $pdo->prepare("
            INSERT INTO survey_answer_details (id, response_id, survey_id, question_id, answer_text, answer_num, answer_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        foreach ($answers as $ans) {
            $qId = $ans['question_id'] ?? ($ans['block_id'] ?? '');
            if (empty($qId)) continue;
            $answerNum  = null;
            $answerJson = null;
            $answerText = $ans['answer_text'] ?? null;
            if (isset($ans['answer_num']) && is_numeric($ans['answer_num'])) $answerNum = (float)$ans['answer_num'];
            if (isset($ans['answer_json'])) $answerJson = json_encode($ans['answer_json'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $detailStmt->execute([generateUUID(), $responseId, $survey['id'], $qId, $answerText, $answerNum, $answerJson]);
        }

        // [NEW] CUSTOM ATTRIBUTE MAPPING
        if ($subscriberId) {
            $stmtMappings = $pdo->prepare("SELECT block_id, target_attribute FROM survey_questions WHERE survey_id = ? AND target_attribute IS NOT NULL AND target_attribute != ''");
            $stmtMappings->execute([$survey['id']]);
            $mappings = $stmtMappings->fetchAll(PDO::FETCH_KEY_PAIR);

            if (!empty($mappings)) {
                $mappedAttrs = [];
                foreach ($answers as $ans) {
                    $bId = $ans['question_id'] ?? ($ans['block_id'] ?? '');
                    if (isset($mappings[$bId])) {
                        $attrName = $mappings[$bId];
                        $val = $ans['answer_text'] ?? ($ans['answer_num'] ?? ($ans['answer_json'] ?? null));
                        if ($val !== null) {
                            $mappedAttrs[$attrName] = $val;
                        }
                    }
                }

                if (!empty($mappedAttrs)) {
                    $pdo->prepare("UPDATE subscribers SET custom_attributes = JSON_MERGE_PATCH(COALESCE(NULLIF(custom_attributes, ''), '{}'), ?) WHERE id = ? AND workspace_id = ?")
                        ->execute([json_encode($mappedAttrs, JSON_UNESCAPED_UNICODE), $subscriberId, $survey['workspace_id']]);
                }
            }
        }

        // VOUCHER REWARD EVALUATION
        $claimedVoucherCode = null;
        if (!empty($settingsObj['voucher_config']['enabled']) && !empty($settingsObj['voucher_config']['campaign_id']) && $subscriberId) {
            $vConfig = $settingsObj['voucher_config'];
            $targetRewardItemId = $vConfig['fallback_reward_item_id'] ?? null;
            
            if (!empty($vConfig['logic_mappings']) && is_array($vConfig['logic_mappings'])) {
                foreach ($vConfig['logic_mappings'] as $mapping) {
                    $cond = $mapping['condition'] ?? null;
                    if (!$cond || empty($cond['question_id'])) continue;
                    
                    $qId = $cond['question_id'];
                    $op = $cond['operator'] ?? 'equals';
                    $val = $cond['value'] ?? '';
                    
                    $ansMatched = null;
                    foreach ($answers as $a) {
                        $bId = $a['question_id'] ?? ($a['block_id'] ?? '');
                        if ($bId === $qId) {
                            $ansMatched = $a;
                            break;
                        }
                    }
                    
                    if (!$ansMatched) {
                        if ($op === 'is_empty') {
                            $targetRewardItemId = $mapping['reward_item_id'] ?? $targetRewardItemId;
                            break;
                        }
                        continue;
                    }
                    
                    $isMatched = false;
                    $actualValue = $ansMatched['answer_text'] ?? $ansMatched['answer_num'] ?? '';
                    
                    if (isset($ansMatched['answer_json']) && is_array($ansMatched['answer_json'])) {
                        $actualValue = implode(', ', $ansMatched['answer_json']);
                    }
                    
                    $actualText = strtolower(trim((string)$actualValue));
                    $expectedText = strtolower(trim((string)$val));
                    
                    if ($op === 'is_answered') {
                        $isMatched = !empty($actualText);
                    } else if ($op === 'is_empty') {
                        $isMatched = empty($actualText);
                    } else if ($op === 'equals') {
                        if (isset($ansMatched['answer_json']) && is_array($ansMatched['answer_json'])) {
                            foreach($ansMatched['answer_json'] as $item) {
                                if (strtolower(trim((string)$item)) === $expectedText) { $isMatched = true; break; }
                            }
                        } else {
                            $isMatched = ($actualText === $expectedText);
                        }
                    } else if ($op === 'not_equals') {
                        $isMatched = ($actualText !== $expectedText);
                    } else if ($op === 'contains' && strpos($actualText, $expectedText) !== false) {
                        $isMatched = true;
                    } else if ($op === 'greater_than' && (float)$actualText > (float)$expectedText) {
                        $isMatched = true;
                    } else if ($op === 'less_than' && (float)$actualText < (float)$expectedText) {
                        $isMatched = true;
                    }
                    
                    if ($isMatched) {
                        $targetRewardItemId = $mapping['reward_item_id'] ?? $targetRewardItemId;
                        break;
                    }
                }
            }
            
            if ($vConfig['campaign_id']) {
                require_once 'voucher_helper.php';
                $claimRes = claimVoucherAtomic($pdo, $vConfig['campaign_id'], $subscriberId, $targetRewardItemId, 'survey', $survey['id'], 'survey_voucher_claimed');
                if ($claimRes['success'] && !empty($claimRes['code'])) {
                    $claimedVoucherCode = $claimRes['code'];
                    $pdo->prepare("UPDATE survey_responses SET claimed_voucher_code = ? WHERE id = ?")
                        ->execute([$claimedVoucherCode, $responseId]);
                }
            }
        }

        // LOG ACTIVITY INTO subscriber_activity & CRM 360 TIMELINE
        $npsScoreText = $npsValue !== null ? " (NPS: {$npsValue})" : '';
        $activityDetails = "Hoàn thành khảo sát: {$survey['name']}{$npsScoreText}";
        if ($subscriberId) {
            $activityExtra = [
                'source' => $sourceChannel,
                'device' => $device,
                'score' => $totalScore,
                'nps_score' => $npsValue,
                'response_id' => $responseId,
            ];
            logActivity($pdo, $subscriberId, 'survey_submit', $survey['id'], $survey['name'], $activityDetails, null, null, $activityExtra, $survey['workspace_id']);

            // Also record 'complete_survey' with contact_id for Customer 360 Journey parity
            try {
                $pdo->prepare("
                    INSERT INTO subscriber_activity
                      (subscriber_id, contact_id, action_type, target_id, target_name, details, ip_address, user_agent, extra_data, workspace_id, created_at)
                    VALUES (?, ?, 'complete_survey', ?, ?, ?, ?, ?, ?, ?, NOW())
                ")->execute([
                    $subscriberId,
                    $contactId ?: null,
                    (string)$survey['id'],
                    (string)$survey['name'],
                    $activityDetails,
                    $clientIp,
                    substr($ua, 0, 512),
                    json_encode($activityExtra, JSON_UNESCAPED_UNICODE),
                    $survey['workspace_id']
                ]);
            } catch (Throwable $e) {
                try {
                    $pdo->prepare("
                        INSERT INTO subscriber_activity
                          (subscriber_id, action_type, target_id, target_name, details, ip_address, user_agent, extra_data, workspace_id, created_at)
                        VALUES (?, 'complete_survey', ?, ?, ?, ?, ?, ?, ?, NOW())
                    ")->execute([
                        $subscriberId,
                        (string)$survey['id'],
                        (string)$survey['name'],
                        $activityDetails,
                        $clientIp,
                        substr($ua, 0, 512),
                        json_encode($activityExtra, JSON_UNESCAPED_UNICODE),
                        $survey['workspace_id']
                    ]);
                } catch (Throwable $e2) {}
            }
        }

        // Log completed note into CRM activities timeline when matched with an existing CRM contact ("3 KHÔNG" compliant)
        if ($contactId && (int)$contactId > 0) {
            try {
                $stmtCt = $pdo->prepare("SELECT tenant_id, owner_id FROM contacts WHERE id = ? AND deleted_at IS NULL LIMIT 1");
                $stmtCt->execute([(int)$contactId]);
                $ctRow = $stmtCt->fetch(PDO::FETCH_ASSOC);
                if ($ctRow) {
                    $summaryLines = [];
                    foreach ($answers as $ansItem) {
                        $bId = $ansItem['block_id'] ?? ($ansItem['question_id'] ?? '');
                        $blk = $blocksById[$bId] ?? null;
                        $qLbl = trim((string)($ansItem['label'] ?? ($blk['label'] ?? ($blk['question'] ?? ''))));
                        $aVal = $ansItem['answer_text'] ?? ($ansItem['answer_num'] ?? (isset($ansItem['answer_json']) ? (is_array($ansItem['answer_json']) ? implode(', ', $ansItem['answer_json']) : (string)$ansItem['answer_json']) : ''));
                        if ($qLbl !== '' && (string)$aVal !== '') {
                            $summaryLines[] = "• {$qLbl}: {$aVal}";
                        }
                        if (count($summaryLines) >= 6) break;
                    }
                    $noteSubject = "Hoàn thành khảo sát: " . ($survey['name'] ?? 'Khảo sát');
                    $noteBody = "Khách hàng đã gửi phản hồi khảo sát \"{$survey['name']}\"" . ($npsValue !== null ? " (NPS: {$npsValue}/10)" : "") . "."
                        . (!empty($summaryLines) ? "\n" . implode("\n", $summaryLines) : "");
                    $ctTenantId = (int)($ctRow['tenant_id'] ?? 1) ?: 1;
                    $ctOwnerId  = !empty($ctRow['owner_id']) ? (int)$ctRow['owner_id'] : null;

                    $pdo->prepare("
                        INSERT INTO activities
                          (tenant_id, user_id, created_by, type, subject, body, status, done_at, related_type, related_id, contact_id, progress, created_at)
                        VALUES (?, ?, ?, 'note', ?, ?, 'done', NOW(), 'contact', ?, ?, 100, NOW())
                    ")->execute([
                        $ctTenantId,
                        $ctOwnerId,
                        $ctOwnerId,
                        $noteSubject,
                        $noteBody,
                        (int)$contactId,
                        (int)$contactId
                    ]);
                }
            } catch (Throwable $e) {
                error_log('[survey_public.php] CRM activity note non-blocking error: ' . $e->getMessage());
            }
        }

        // Flow trigger — priority worker (using centralized WorkerTriggerService)
        if ($subscriberId) {
            try {
                require_once 'WorkerTriggerService.php';
                $apiUrl = defined('API_BASE_URL') ? API_BASE_URL : 'https://automation.ideas.edu.vn/mail_api';
                $workerService = new WorkerTriggerService($pdo, $apiUrl);
                
                // 1. survey_submit trigger
                $workerService->trigger('/worker_priority.php?' . http_build_query([
                    'trigger_type' => 'survey',
                    'target_id'    => $survey['id'],
                    'subscriber_id'=> $subscriberId
                ]));

                // 2. Legacy: specific flow_trigger_id on survey row
                if (!empty($survey['flow_trigger_id'])) {
                    $workerService->trigger('/worker_priority.php?' . http_build_query([
                        'trigger_type'  => 'flow_trigger',
                        'target_id'     => $survey['flow_trigger_id'],
                        'subscriber_id' => $subscriberId
                    ]));
                }
            } catch (Exception $e) {
                error_log('Survey flow trigger error: ' . $e->getMessage());
            }
        }

        // EVENT-DRIVEN WAKEUP FOR SURVEY CONDITIONS
        if (!empty($subscriberId)) {
            require_once 'trigger_helper.php';
            wakeupWaitingSubscribers($pdo, $subscriberId, $survey['workspace_id']);
        }

        // INCREMENT SHORT LINK SUBMIT COUNT
        $slid = $input['slid'] ?? '';
        if (empty($slid) && isset($_SERVER['HTTP_REFERER'])) {
            parse_str(parse_url($_SERVER['HTTP_REFERER'], PHP_URL_QUERY) ?? '', $refQ);
            $slid = $refQ['slid'] ?? '';
        }
        if (!empty($slid)) {
            try {
                $pdo->prepare("UPDATE short_links SET submit_count = submit_count + 1 WHERE id = ?")->execute([$slid]);
            } catch (Exception $e) {}
        }

        $thankYou = json_decode($survey['thank_you_page'] ?? '{}', true);
        echo json_encode([
            'success'      => true,
            'response_id'  => $responseId,
            'contact_id'   => $contactId,
            'thank_you'    => $thankYou,
            'voucher_code' => $claimedVoucherCode,
            'redirect_url' => $thankYou['redirectUrl'] ?? null,
        ]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);

} catch (Exception $e) {
    error_log('Survey Public API Error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error']);
}

function normalizePublicSurveyBlocks(array $blocks): array {
    $normalized = [];
    foreach ($blocks as $idx => $b) {
        if (!is_array($b)) continue;
        if (empty($b['id'])) {
            $b['id'] = generateUUID();
        }
        $label = $b['label'] ?? ($b['title'] ?? ($b['question'] ?? ($b['content'] ?? '')));
        if ($label === '' || $label === 'Untitled Question') {
            $label = !empty($b['question']) ? $b['question'] : (!empty($b['title']) ? $b['title'] : 'Câu hỏi ' . ($idx + 1));
        }
        $b['label'] = $label;
        if (empty($b['title'])) {
            $b['title'] = $label;
        }

        $type = $b['type'] ?? 'short_text';
        if ($type === 'rating') {
            $style = $b['options']['style'] ?? ($b['style']['style'] ?? '');
            $scale = (int)($b['options']['scale'] ?? ($b['scale'] ?? 5));
            if ($style === 'nps' || $scale === 10) {
                $type = 'nps';
                $b['minValue'] = $b['minValue'] ?? 0;
                $b['maxValue'] = $b['maxValue'] ?? 10;
                $b['minLabel'] = $b['minLabel'] ?? 'Rất không hài lòng';
                $b['maxLabel'] = $b['maxLabel'] ?? 'Rất hài lòng';
            } else {
                $type = 'star_rating';
                $b['minValue'] = $b['minValue'] ?? 1;
                $b['maxValue'] = $b['maxValue'] ?? ($scale > 0 ? $scale : 5);
                $b['ratingIcon'] = $b['ratingIcon'] ?? 'star';
            }
            unset($b['options']);
        } elseif ($type === 'multiple_choice') {
            $type = 'single_choice';
        }
        $b['type'] = $type;

        if (isset($b['options']) && is_array($b['options'])) {
            $rawOpts = isset($b['options']['choices']) && is_array($b['options']['choices'])
                ? $b['options']['choices']
                : $b['options'];
            $cleanOpts = [];
            foreach ($rawOpts as $optIdx => $opt) {
                if (is_array($opt)) {
                    $optLabel = (string)($opt['label'] ?? ($opt['value'] ?? ('Lựa chọn ' . ($optIdx + 1))));
                    $optValue = (string)($opt['value'] ?? $optLabel);
                    $cleanOpts[] = [
                        'id'    => !empty($opt['id']) ? (string)$opt['id'] : ('opt-' . ($idx + 1) . '-' . ($optIdx + 1)),
                        'label' => $optLabel,
                        'value' => $optValue,
                    ];
                } elseif (is_scalar($opt)) {
                    $strVal = (string)$opt;
                    $cleanOpts[] = [
                        'id'    => 'opt-' . ($idx + 1) . '-' . ($optIdx + 1),
                        'label' => $strVal,
                        'value' => $strVal,
                    ];
                }
            }
            $b['options'] = $cleanOpts;
        }

        $normalized[] = $b;
    }
    return $normalized;
}

function generateUUID(): string {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff));
}
