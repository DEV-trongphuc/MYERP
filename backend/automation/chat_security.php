<?php
// api/chat_security.php – RESTORED FULL LOGIC

function isIpBlocked($pdo, $ip)
{
    if (!$ip || $ip === 'unknown')
        return false;

    // Cache result for 10 minutes (600s)
    return apcu_fetch_or_callback("ip_blocked_$ip", function() use ($pdo, $ip) {
        $stmt = $pdo->prepare("SELECT 1 FROM web_blacklist WHERE ip_address = ? LIMIT 1");
        $stmt->execute([$ip]);
        return (bool) $stmt->fetch();
    }, 600);
}

function checkSpam($pdo, $visitorUuid, $clientIp, $userMsg)
{
    if (!$visitorUuid || $visitorUuid === 'unknown' || strpos($visitorUuid, 'meta_') !== false || strpos($visitorUuid, 'zalo_') !== false) {
        return ['spam' => false];
    }

    // [PERF] Use APCu counters for rate limiting (0ms DB hits)
    if (is_callable('apcu_inc')) {
        $key1m = "spam_1m_$visitorUuid";
        $key1h = "spam_1h_$visitorUuid";

        $count1m = @apcu_inc($key1m, 1, $success1m, 60);
        $count1h = @apcu_inc($key1h, 1, $success1h, 3600);

        if ($count1m > 15) {
            return ['spam' => true, 'message' => 'Hệ thống nhận diện bạn đang chat quá nhanh! Vui lòng chờ 1 phút trước khi tiếp tục.'];
        }
        if ($count1h > 50) {
            return ['spam' => true, 'message' => 'Hệ thống AI đang quá tải với phiên làm việc của bạn. Vui lòng để lại số điện thoại hoặc gọi Hotline để được hỗ trợ trực tiếp.'];
        }
        return ['spam' => false];
    }

    // Fallback to DB if APCu is missing
    try {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM domation_ai_messages m JOIN domation_ai_conversations c ON c.id = m.conversation_id WHERE c.visitor_id = ? AND m.sender = 'visitor' AND m.created_at >= NOW() - INTERVAL 1 MINUTE");
        $stmt->execute([$visitorUuid]);
        if ((int)$stmt->fetchColumn() >= 15) return ['spam' => true, 'message' => 'Chat quá nhanh!'];

        $stmtH = $pdo->prepare("SELECT COUNT(*) FROM domation_ai_messages m JOIN domation_ai_conversations c ON c.id = m.conversation_id WHERE c.visitor_id = ? AND m.sender = 'visitor' AND m.created_at >= NOW() - INTERVAL 1 HOUR");
        $stmtH->execute([$visitorUuid]);
        if ((int)$stmtH->fetchColumn() >= 50) return ['spam' => true, 'message' => 'Vượt hạn mức chat/giờ.'];
    } catch (Exception $e) {}

    return ['spam' => false];
}
