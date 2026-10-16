<?php
// api/chat_helpers.php
require_once 'db_connect.php';
require_once 'notification_helper.php';

function logAIChat($visitorId, $propertyId, $action, $status, $details = '')
{
    // [SECURITY] Production hardening: Sanitize logs to prevent PII leakage
    $logDir = __DIR__ . '/logs';
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0777, true);
    }
    $logFile = $logDir . '/ai_debug.log';
    $time = date('Y-m-d H:i:s');
    
    // Mask potential emails and phone numbers in details
    $sanitizedDetails = preg_replace('/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/', '[EMAIL]', $details);
    $sanitizedDetails = preg_replace('/(\+?\d{10,12})/', '[PHONE]', $sanitizedDetails);
    
    // Truncate to prevent disk exhaustion and excessive data exposure
    if (strlen($sanitizedDetails) > 500) {
        $sanitizedDetails = substr($sanitizedDetails, 0, 500) . '... [TRUNCATED]';
    }

    $msg = "[$time] [$visitorId] [$propertyId] ACTION: $action | STATUS: $status | $sanitizedDetails" . PHP_EOL;
    file_put_contents($logFile, $msg, FILE_APPEND);
}

function logGeminiCall($type, $status, $details = '')
{
    logAIChat('SYSTEM', 'GEMINI', $type, $status, $details);
}

function logChatError($details)
{
    logAIChat('SYSTEM', 'ERROR', 'ERROR', 'CHAT_ERROR', $details);
}

function syncLead($pdo, $visitorId, $propertyId, $email = null, $phone = null)
{
    $email = $email ? trim($email) : null;
    $phone = $phone ? trim($phone) : null;

    if (!$email && !$phone)
        return;

    try {
        $stmt = $pdo->prepare("SELECT id, subscriber_id FROM web_visitors WHERE id = ? AND property_id = ? LIMIT 1");
        $stmt->execute([$visitorId, $propertyId]);
        $vis = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$vis)
            return;

        $subId = $vis['subscriber_id'] ?? null;
        if (!$subId) {
            $subId = bin2hex(random_bytes(16));
            $pdo->prepare("INSERT INTO subscribers (id, property_id, email, phone, status, source) VALUES (?, ?, ?, ?, 'customer', 'ai_chat')")
                ->execute([$subId, $propertyId, $email, $phone]);

            $pdo->prepare("UPDATE web_visitors SET subscriber_id = ?, email = ?, phone = ? WHERE id = ? AND property_id = ?")
                ->execute([$subId, $email, $phone, $visitorId, $propertyId]);

            $pdo->prepare("INSERT INTO web_events (visitor_id, property_id, event_type, target_text) VALUES (?, ?, 'form', ?)")
                ->execute([$visitorId, $propertyId, "Lead captured via AI Chat: " . ($email ?: $phone)]);

            dispatchQueueJob($pdo, 'default', [
                'action' => 'notify_captured_lead',
                'property_id' => $propertyId,
                'lead_data' => [
                    'Email' => $email,
                    'Số điện thoại' => $phone,
                    'Nguồn' => 'AI ChatBot',
                    'ID Trình duyệt' => $visitorId
                ],
                'source' => 'Hội thoại AI'
            ]);
        } else {
            $pdo->prepare("UPDATE subscribers SET 
                email = COALESCE(?, email), 
                phone = COALESCE(?, phone), 
                updated_at = NOW() 
                WHERE id = ? AND property_id = ?")
                ->execute([$email, $phone, $subId, $propertyId]);

            $pdo->prepare("UPDATE web_visitors SET 
                email = COALESCE(?, email), 
                phone = COALESCE(?, phone) 
                WHERE id = ? AND property_id = ?")
                ->execute([$email, $phone, $visitorId, $propertyId]);

            // Notify on significant updates
            dispatchQueueJob($pdo, 'default', [
                'action' => 'notify_captured_lead',
                'property_id' => $propertyId,
                'lead_data' => [
                    'Email' => $email,
                    'Số điện thoại' => $phone,
                    'Nguồn' => 'AI ChatBot (Update)',
                    'ID Trình duyệt' => $visitorId
                ],
                'source' => 'Hội thoại AI'
            ]);
        }
    } catch (Exception $e) {
        logChatError("SyncLead Error: " . $e->getMessage());
    }
}

function enforceChatLimits($pdo, $visitorUuid, $tableName = 'domation_ai_conversations')
{
    if (!$visitorUuid)
        return;
    try {
        $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM $tableName WHERE visitor_id = ?");
        $stmtCount->execute([$visitorUuid]);
        if ($stmtCount->fetchColumn() >= 30) {
            $pdo->prepare("DELETE FROM $tableName WHERE visitor_id = ? AND status = 'closed' ORDER BY created_at ASC LIMIT 1")
                ->execute([$visitorUuid]);
        }
    } catch (Exception $e) {
    }
}

function handleFirstChatPoints($pdo, $visitorUuid, $propertyId, $tableName = 'domation_ai_conversations')
{
    if (!$visitorUuid)
        return;
    try {
        $stmtTotal = $pdo->prepare("SELECT COUNT(*) FROM $tableName WHERE visitor_id = ?");
        $stmtTotal->execute([$visitorUuid]);
        if ($stmtTotal->fetchColumn() == 1) {
            require_once __DIR__ . '/db_connect.php';
            $LSC = function_exists('getGlobalLeadScoreConfig') ? getGlobalLeadScoreConfig($pdo) : [];
            $botSc = $LSC['leadscore_ai_chat'] ?? 5;
            $pdo->prepare("INSERT INTO web_events (visitor_id, property_id, event_type, target_text) VALUES (?, ?, 'form', 'Bắt đầu chat với AI (+$botSc points)')")
                ->execute([$visitorUuid, $propertyId]);
            $pdo->prepare("UPDATE subscribers s JOIN web_visitors v ON s.id = v.subscriber_id SET s.lead_score = s.lead_score + ? WHERE v.id = ? AND s.property_id = ?")
                ->execute([$botSc, $visitorUuid, $propertyId]);
        }
    } catch (Exception $e) {
    }
}

function getVisitorContext($pdo, $visitorId, $currentUrl = '')
{
    $activityLines = [];
    if ($currentUrl) {
        $activityLines[] = "TRANG HIỆN TẠI: $currentUrl";
    }

    try {
        // 1. Lấy 3 trang xem gần nhất
        $stmtPage = $pdo->prepare("SELECT title as item, loaded_at FROM web_page_views WHERE visitor_id = ? ORDER BY loaded_at DESC LIMIT 3");
        $stmtPage->execute([$visitorId]);
        while ($row = $stmtPage->fetch(PDO::FETCH_ASSOC)) {
            $activityLines[] = [
                'time' => strtotime($row['loaded_at']),
                'text' => "XEM: " . $row['item']
            ];
        }

        // 2. Lấy 3 hành động click/canvas có nghĩa (có chữ, không vô nghĩa)
        $stmtEvt = $pdo->prepare("
            SELECT event_type, target_text as item, created_at 
            FROM web_events 
            WHERE visitor_id = ? 
            AND event_type IN ('click', 'canvas_click', 'form') 
            AND event_type NOT IN ('scroll')
            AND target_text IS NOT NULL 
            AND target_text NOT IN ('', 'Unknown', 'undefined', 'null', 'unknown')
            AND LENGTH(target_text) > 1
            ORDER BY created_at DESC LIMIT 3
        ");
        $stmtEvt->execute([$visitorId]);
        while ($row = $stmtEvt->fetch(PDO::FETCH_ASSOC)) {
            $label = ($row['event_type'] === 'click') ? "CLICK" : (($row['event_type'] === 'form') ? "FORM" : "NHẤN VÙNG");
            $activityLines[] = [
                'time' => strtotime($row['created_at']),
                'text' => "$label: " . $row['item']
            ];
        }

        // 3. Gộp, sắp xếp theo thời gian và chỉ lấy đúng 3 cái mới nhất
        $finalJourney = [];
        $header = "";
        foreach ($activityLines as $line) {
            if (is_string($line))
                $header = $line;
            else
                $finalJourney[] = $line;
        }

        usort($finalJourney, function ($a, $b) {
            return $b['time'] - $a['time'];
        });
        $top3 = array_slice($finalJourney, 0, 3);
        // Đảo ngược lại để AI đọc theo thứ tự thời gian xuôi
        $top3 = array_reverse($top3);

        $outputText = "HÀNH TRÌNH KHÁCH (3 bước gần nhất):\n";
        if ($header)
            $outputText .= "- $header\n";
        foreach ($top3 as $item) {
            $outputText .= "- " . $item['text'] . "\n";
        }

        return $outputText;
    } catch (Exception $e) {
        return "HÀNH TRÌNH: (Không có dữ liệu)";
    }
}

function updateConversationStats($pdo, $convId, $lastMsg, $tableName = 'domation_ai_conversations')
{
    try {
        // Truncate for storage efficiency in conversation list
        $shortMsg = mb_substr($lastMsg, 0, 150);
        if (mb_strlen($lastMsg) > 150)
            $shortMsg .= "...";

        $stmt = $pdo->prepare("UPDATE $tableName SET last_message = ?, last_message_at = NOW(), updated_at = NOW() WHERE id = ?");
        $stmt->execute([$shortMsg, $convId]);
    } catch (Exception $e) {
        logChatError("UpdateConvStats Error: " . $e->getMessage());
    }
}
