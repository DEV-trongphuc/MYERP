<?php
require_once 'db_connect.php';
require_once 'auth_middleware.php';
header('Content-Type: application/json');

require_once 'ai_org_middleware.php';

// [SECURITY] Enforce AISpace Authentication
$currentOrgUser = requireAISpaceAuth();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$period = $_GET['period'] ?? 'month'; // month, week, day

// Helpers
function getRange($period)
{
    if ($period === 'week')
        return [date('Y-m-d', strtotime('-7 days')), date('Y-m-d')];
    if ($period === 'day')
        return [date('Y-m-d', strtotime('-1 day')), date('Y-m-d')];
    if (!empty($_GET['start_date']) && !empty($_GET['end_date']))
        return [$_GET['start_date'], $_GET['end_date']];
    return [date('Y-m-01'), date('Y-m-t')]; // Default month
}

list($start, $end) = getRange($period);
$property_id = $_GET['property_id'] ?? '';

if (empty($property_id)) {
    jsonResponse(false, null, 'Missing property_id');
}

// [SECURITY] Verify organizational access to this property
requireCategoryAccess($property_id, $currentOrgUser);

$propFilterConvs = " AND property_id = ?";
$propFilterMsgs = " AND conversation_id IN (SELECT id FROM domation_ai_conversations WHERE property_id = ?)";

if ($method === 'GET' && $action === 'summary') {
    try {
        // 1. Total Conversations
        $paramConvs = [$start, $end . ' 23:59:59'];
        if (!empty($property_id))
            $paramConvs[] = $property_id;

        $sqlTotal = "SELECT COUNT(*) FROM domation_ai_conversations WHERE created_at BETWEEN ? AND ?" . $propFilterConvs;
        $stmt = $pdo->prepare($sqlTotal);
        $stmt->execute($paramConvs);
        $totalConvs = $stmt->fetchColumn();

        // 2. AI Replies
        $paramMsgs = [$start, $end . ' 23:59:59'];
        if (!empty($property_id))
            $paramMsgs[] = $property_id;

        $sqlAI = "SELECT COUNT(*) FROM domation_ai_messages WHERE sender='ai' AND created_at BETWEEN ? AND ?" . $propFilterMsgs;
        $stmt = $pdo->prepare($sqlAI);
        $stmt->execute($paramMsgs);
        $aiReplies = $stmt->fetchColumn();

        // 3. Human Handovers (Conversations that have at least one human reply)
        $sqlHandover = "SELECT COUNT(DISTINCT conversation_id) FROM domation_ai_messages WHERE sender='human' AND created_at BETWEEN ? AND ?" . $propFilterMsgs;
        $stmt = $pdo->prepare($sqlHandover);
        $stmt->execute($paramMsgs);
        $handovers = $stmt->fetchColumn();

        // 4. Unanswered (Visitor sent last message > 2 hours ago)
        $unanswered = 0; // Placeholder for optimization

        echo json_encode([
            'success' => true,
            'data' => [
                'total_conversations' => $totalConvs,
                'ai_replies' => $aiReplies,
                'human_handovers' => $handovers,
                'unanswered' => $unanswered
            ]
        ]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
    }
}

if ($method === 'GET' && $action === 'chart') {
    try {
        $format = '%Y-%m-%d';
        if ($period === 'month' && ((strtotime($end) - strtotime($start)) > 32 * 86400))
            $format = '%Y-%m';

        $sql = "SELECT DATE_FORMAT(created_at, '$format') as date, 
                SUM(CASE WHEN sender = 'ai' THEN 1 ELSE 0 END) as ai_count,
                SUM(CASE WHEN sender = 'visitor' THEN 1 ELSE 0 END) as visitor_count,
                SUM(CASE WHEN sender = 'human' THEN 1 ELSE 0 END) as human_count
                FROM domation_ai_messages 
                WHERE created_at BETWEEN ? AND ?" . $propFilterMsgs . " 
                GROUP BY date 
                ORDER BY date ASC";

        $stmt = $pdo->prepare($sql);
        $paramChart = [$start, $end . ' 23:59:59'];
        if (!empty($property_id))
            $paramChart[] = $property_id;
        $stmt->execute($paramChart);
        $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'data' => $data]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
    }
}
if ($method === 'GET' && $action === 'detailed_ai_insights') {
    require_once 'chat_gemini.php';
    try {
        $days = isset($_GET['days']) ? (int) $_GET['days'] : 7;

        $paramDates = [$start, $end . ' 23:59:59'];
        $paramMsgs = [$start, $end . ' 23:59:59'];
        if (!empty($property_id)) {
            $paramDates[] = $property_id;
            $paramMsgs[] = $property_id;
        }

        // 1. Total Convs & Visitors
        $sqlC = "SELECT COUNT(DISTINCT id) as total_convs, COUNT(DISTINCT visitor_id) as total_visitors FROM domation_ai_conversations WHERE created_at BETWEEN ? AND ?" . $propFilterConvs;
        $stmt = $pdo->prepare($sqlC);
        $stmt->execute($paramDates);
        $stats = $stmt->fetch(PDO::FETCH_ASSOC);

        // 2. Hourly Distribution
        $sqlH = "SELECT HOUR(created_at) as hr, COUNT(*) as count FROM domation_ai_messages WHERE created_at BETWEEN ? AND ?" . $propFilterMsgs . " GROUP BY hr ORDER BY hr ASC";
        $stmtH = $pdo->prepare($sqlH);
        $stmtH->execute($paramMsgs);
        $hourly = $stmtH->fetchAll(PDO::FETCH_ASSOC);

        // 3. Messages Total
        $sqlM = "SELECT COUNT(*) FROM domation_ai_messages WHERE created_at BETWEEN ? AND ?" . $propFilterMsgs;
        $stmtM = $pdo->prepare($sqlM);
        $stmtM->execute($paramMsgs);
        $totalMsgs = $stmtM->fetchColumn();

        // 4. Time chart formatting
        $chartData = array_fill(0, 24, ['hr' => 0, 'count' => 0]);
        for ($i = 0; $i < 24; $i++) {
            $chartData[$i]['hr'] = $i;
        }
        foreach ($hourly as $h) {
            $chartData[(int) $h['hr']]['count'] = (int) $h['count'];
        }

        // 5. Build AI Prompt
        $statsText = "Tổng lượng khách: " . $stats['total_visitors'] . "\n" .
            "Tổng hội thoại: " . $stats['total_convs'] . "\n" .
            "Tổng tin nhắn: " . $totalMsgs . "\n" .
            "Tải phân bổ theo giờ: \n";
        foreach ($chartData as $c) {
            $statsText .= $c['hr'] . "h: " . $c['count'] . " tin nhắn\n";
        }

        $globalKey = getenv('GEMINI_API_KEY') ?: '';
        $aiReport = "";

        if (!empty($globalKey)) {
            $prompt = "Bạn là chuyên gia phân tích dữ liệu AI Chatbot. Dưới đây là thống kê 7 ngày gần nhất của một Chatbot bán hàng/CSKH: \n" .
                $statsText .
                "\nHãy viết một đoạn báo cáo phân tích thật chuyên sâu bằng tiếng Việt (Format Markdown siêu đẹp, KHÔNG DÙNG header h1 h2, chỉ dùng in đậm, in nghiêng, list, blockquote). Đánh giá về traffic, chỉ ra giờ cao điểm thực sự (peak hours) khách hàng tương tác nhiều nhất để bộ phận marketing biết đường tung khuyến mãi. Nhận xét ngắn gọn, ấn tượng, chuyên nghiệp.";

            $contents = [
                ["role" => "user", "parts" => [["text" => $prompt]]]
            ];
            $systemInst = "Bạn là AI phân tích dữ liệu xuất sắc nhất.";
            try {
                $aiReport = generateResponse($contents, $systemInst, $globalKey, 'gemini-3.5-flash-lite', 0.7);
            } catch (Throwable $e) {
                $aiReport = "Lỗi khi gọi AI: " . $e->getMessage();
            }
        } else {
            $aiReport = "Vui lòng cấu hình GEMINI_API_KEY để sử dụng tính năng phân tích tự động.";
        }

        echo json_encode([
            'success' => true,
            'stats' => [
                'visitors' => (int) $stats['total_visitors'],
                'conversations' => (int) $stats['total_convs'],
                'messages' => (int) $totalMsgs
            ],
            'chart' => $chartData,
            'ai_report' => $aiReport
        ]);

    } catch (Throwable $e) {
        error_log("AI Report Fatal: " . $e->getMessage());
        echo json_encode(['success' => false, 'message' => "Lỗi truy xuất: " . $e->getMessage()]);
    }
}
?>