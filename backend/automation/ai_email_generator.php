<?php
// backend/automation/ai_email_generator.php — Enterprise AI Email Block Generator
// Calls Gemini to produce a rich, valid EmailBlock[] JSON structure
// compatible with MYERP's Email Editor canvas & HTML compiler.

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

$_base = __DIR__;
if (!file_exists($_base . '/db_connect.php')) {
    $_base = dirname(__DIR__) . '/api';
}
require_once $_base . '/db_connect.php';
require_once $_base . '/auth_middleware.php';
require_once $_base . '/chat_gemini.php';

$hasAuth = !empty($GLOBALS['current_admin_id'])
    || !empty($_SESSION['user_id'])
    || !empty($_SESSION['org_user_id'])
    || !empty($_SERVER['HTTP_AUTHORIZATION']);

if (!$hasAuth) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

/**
 * Resolve Gemini API Key across mkt_system_settings, MYERP system_settings, and .env
 */
function getGeminiKey($pdo, $workspace_id = 0): string
{
    try {
        $stmt = $pdo->prepare("SELECT `value` FROM mkt_system_settings WHERE workspace_id IN (0, ?) AND `key` = 'gemini_api_key' AND `value` != '' ORDER BY workspace_id DESC LIMIT 1");
        $stmt->execute([$workspace_id]);
        $val = $stmt->fetchColumn();
        if (!empty($val) && is_string($val)) {
            return trim($val);
        }
    } catch (\Throwable $e) {
        // Ignore if table doesn't exist
    }

    try {
        $stmtSys = $pdo->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'gemini_api_key' AND setting_value != '' LIMIT 1");
        $stmtSys->execute();
        $sysVal = $stmtSys->fetchColumn();
        if (!empty($sysVal) && is_string($sysVal)) {
            return trim($sysVal);
        }
    } catch (\Throwable $e) {
        // Ignore if table doesn't exist
    }

    $envKey = $_ENV['GEMINI_API_KEY'] ?? getenv('GEMINI_API_KEY') ?: '';
    if (!empty($envKey)) {
        return trim((string)$envKey);
    }

    // Fallback: parse backend/.env directly
    $envPaths = [
        dirname(__DIR__) . '/.env',
        dirname(__DIR__, 2) . '/.env',
    ];
    foreach ($envPaths as $envFile) {
        if (is_file($envFile) && is_readable($envFile)) {
            $lines = @file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
            foreach ($lines as $line) {
                $line = trim($line);
                if ($line === '' || $line[0] === '#') continue;
                if (preg_match('/^GEMINI_API_KEY\s*=\s*(.+)$/i', $line, $m)) {
                    return trim($m[1], " \t\n\r\0\x0B\"'");
                }
            }
        }
    }

    return '';
}

/**
 * Extract brand colors from existing blocks
 */
function extractBrandColors($blocks, &$colors = []): void
{
    if (!is_array($blocks)) return;
    foreach ($blocks as $block) {
        if (!is_array($block)) continue;
        $style = $block['style'] ?? [];
        $colorFields = ['backgroundColor', 'contentBackgroundColor', 'color', 'borderColor', 'surveyAccentColor'];
        foreach ($colorFields as $f) {
            if (!empty($style[$f]) && is_string($style[$f])) {
                $c = strtolower(trim($style[$f]));
                if ($c !== '#ffffff' && $c !== '#fff' && $c !== 'transparent' && $c !== '' && strpos($c, '#') === 0) {
                    $colors[$c] = ($colors[$c] ?? 0) + 1;
                }
            }
        }
        if (!empty($block['content']) && is_string($block['content'])) {
            preg_match_all('/color:\s*(#[0-9a-fA-F]{3,6})/', $block['content'], $m);
            foreach ($m[1] as $c) {
                $c = strtolower($c);
                if ($c !== '#ffffff' && $c !== '#fff') {
                    $colors[$c] = ($colors[$c] ?? 0) + 1;
                }
            }
            preg_match_all('/background(?:-color)?:\s*(#[0-9a-fA-F]{3,6})/', $block['content'], $m);
            foreach ($m[1] as $c) {
                $c = strtolower($c);
                $colors[$c] = ($colors[$c] ?? 0) + 1;
            }
        }
        if (!empty($block['children']) && is_array($block['children'])) {
            extractBrandColors($block['children'], $colors);
        }
    }
}

/**
 * Compact reference blocks before sending to Gemini to keep token count small & fast
 */
function compactBlocksForReference($blocks, int $depth = 0): array
{
    if (!is_array($blocks) || $depth > 5) return [];
    $result = [];
    foreach (array_slice($blocks, 0, 12) as $b) {
        if (!is_array($b) || empty($b['type'])) continue;
        $item = [
            'type' => $b['type'],
        ];
        if (!empty($b['content']) && is_string($b['content'])) {
            $cleanContent = preg_replace('/data:image\/[^;]+;base64,[a-zA-Z0-9+\/=]+/', '[IMAGE_DATA]', $b['content']);
            $item['content'] = mb_substr($cleanContent, 0, 280);
        }
        if (!empty($b['url']) && is_string($b['url']) && strpos($b['url'], 'data:') !== 0) {
            $item['url'] = mb_substr($b['url'], 0, 180);
        }
        if (!empty($b['style']) && is_array($b['style'])) {
            $keepStyleKeys = [
                'backgroundColor', 'contentBackgroundColor', 'color', 'fontFamily', 'fontSize',
                'fontWeight', 'textAlign', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
                'borderRadius', 'borderColor', 'width', 'height',
                'surveyAccentColor', 'surveyCardBgColor', 'surveyBorderColor', 'surveyBadgeText', 'surveyTitle', 'surveyButtonText'
            ];
            $filteredStyle = [];
            foreach ($keepStyleKeys as $k) {
                if (isset($b['style'][$k]) && $b['style'][$k] !== '') {
                    $filteredStyle[$k] = $b['style'][$k];
                }
            }
            if (!empty($filteredStyle)) {
                $item['style'] = $filteredStyle;
            }
        }
        if (!empty($b['children']) && is_array($b['children'])) {
            $item['children'] = compactBlocksForReference($b['children'], $depth + 1);
        }
        $result[] = $item;
    }
    return $result;
}

/**
 * Sanitize and enrich AI-generated blocks so CanvasBlock & htmlCompiler never encounter missing fields
 */
function sanitizeBlock(&$block, string $brandAccent = '#BD1D2D'): void
{
    if (!is_array($block)) return;
    if (empty($block['id'])) {
        $block['id'] = uniqid('b_');
    }
    if (empty($block['type'])) {
        $block['type'] = 'text';
    }
    if (!isset($block['content']) || !is_string($block['content'])) {
        $block['content'] = '';
    }
    if (!isset($block['style']) || (!is_array($block['style']) && !is_object($block['style']))) {
        $block['style'] = [];
    }
    $styleArr = is_object($block['style']) ? (array)$block['style'] : $block['style'];

    switch ($block['type']) {
        case 'survey_card':
            if (empty($styleArr['surveyAccentColor'])) $styleArr['surveyAccentColor'] = $brandAccent;
            if (empty($styleArr['surveyCardBgColor'])) $styleArr['surveyCardBgColor'] = '#FFFFFF';
            if (empty($styleArr['surveyBorderColor'])) $styleArr['surveyBorderColor'] = '#E2E8F0';
            if (empty($styleArr['surveyButtonTextColor'])) $styleArr['surveyButtonTextColor'] = '#FFFFFF';
            if (!isset($styleArr['surveyBadgeText'])) $styleArr['surveyBadgeText'] = 'KHẢO SÁT NHANH';
            if (empty($styleArr['surveyTitle'])) $styleArr['surveyTitle'] = $block['content'] ?: 'Khảo sát mức độ hài lòng của bạn';
            if (empty($styleArr['surveyDescription'])) $styleArr['surveyDescription'] = 'Ý kiến đóng góp của bạn giúp chúng tôi nâng cao chất lượng chương trình và dịch vụ mỗi ngày.';
            if (empty($styleArr['surveyButtonText'])) $styleArr['surveyButtonText'] = 'Tham gia khảo sát ngay →';
            if (empty($styleArr['borderRadius'])) $styleArr['borderRadius'] = '16px';
            if (empty($styleArr['paddingTop'])) $styleArr['paddingTop'] = '16px';
            if (empty($styleArr['paddingBottom'])) $styleArr['paddingBottom'] = '16px';
            if (empty($styleArr['paddingLeft'])) $styleArr['paddingLeft'] = '24px';
            if (empty($styleArr['paddingRight'])) $styleArr['paddingRight'] = '24px';
            if (empty($block['url'])) $block['url'] = '#';
            break;

        case 'check_list':
            if (empty($block['items']) || !is_array($block['items'])) {
                $block['items'] = [
                    'Chương trình chuẩn quốc tế, ứng dụng thực tiễn cao',
                    'Đội ngũ giảng viên & chuyên gia đầu ngành đồng hành',
                    'Lịch học linh hoạt dành cho nhà quản lý bận rộn'
                ];
            }
            if (empty($styleArr['iconColor'])) $styleArr['iconColor'] = $brandAccent;
            if (empty($styleArr['color'])) $styleArr['color'] = '#1E293B';
            if (empty($styleArr['fontSize'])) $styleArr['fontSize'] = '15px';
            break;

        case 'timeline':
            if (empty($block['timelineItems']) || !is_array($block['timelineItems'])) {
                $block['timelineItems'] = [
                    ['time' => 'Giai đoạn 1', 'title' => 'Đăng ký & Xét duyệt hồ sơ', 'desc' => 'Hoàn thiện hồ sơ ứng tuyển và phỏng vấn định hướng cùng Hội đồng Học thuật.'],
                    ['time' => 'Giai đoạn 2', 'title' => 'Nhập học & Kết nối', 'desc' => 'Tham gia tuần lễ định hướng và kết nối mạng lưới học viên lãnh đạo.'],
                    ['time' => 'Giai đoạn 3', 'title' => 'Hoàn thành & Nhận bằng Quốc tế', 'desc' => 'Bảo vệ đề án thực tiễn và nhận bằng tốt nghiệp được công nhận toàn cầu.']
                ];
            }
            if (empty($styleArr['iconColor'])) $styleArr['iconColor'] = $brandAccent;
            break;

        case 'review':
            if (empty($block['reviewName'])) $block['reviewName'] = 'Anh Nguyễn Minh Tuấn';
            if (empty($block['reviewRole'])) $block['reviewRole'] = 'Giám đốc Điều hành — Cựu Học viên MBA';
            if (empty($block['reviewRating'])) $block['reviewRating'] = 5;
            if (empty($block['content'])) {
                $block['content'] = 'Chương trình mang lại góc nhìn chiến lược sắc bén và hệ thống công cụ quản trị thực chiến giúp doanh nghiệp tôi bứt phá mạnh mẽ.';
            }
            break;

        case 'countdown':
            if (empty($block['countdownTarget'])) {
                $block['countdownTarget'] = date('Y-m-d\TH:i', strtotime('+3 days'));
            }
            if (empty($block['content'])) {
                $block['content'] = 'Thời gian ưu đãi còn lại';
            }
            if (empty($styleArr['contentBackgroundColor'])) $styleArr['contentBackgroundColor'] = $brandAccent;
            break;

        case 'button':
            if (empty($styleArr['contentBackgroundColor'])) $styleArr['contentBackgroundColor'] = $brandAccent;
            if (empty($styleArr['color'])) $styleArr['color'] = '#FFFFFF';
            if (empty($styleArr['borderRadius'])) $styleArr['borderRadius'] = '10px';
            if (empty($styleArr['paddingTop'])) $styleArr['paddingTop'] = '14px';
            if (empty($styleArr['paddingBottom'])) $styleArr['paddingBottom'] = '14px';
            if (empty($styleArr['paddingLeft'])) $styleArr['paddingLeft'] = '32px';
            if (empty($styleArr['paddingRight'])) $styleArr['paddingRight'] = '32px';
            if (empty($block['content'])) $block['content'] = 'Tìm hiểu ngay →';
            if (empty($block['url'])) $block['url'] = '#';
            break;
    }

    $block['style'] = empty($styleArr) ? new stdClass() : $styleArr;

    if (isset($block['children']) && is_array($block['children'])) {
        foreach ($block['children'] as &$child) {
            sanitizeBlock($child, $brandAccent);
        }
    }
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        exit;
    }

    $body = json_decode(file_get_contents('php://input'), true) ?: [];
    $prompt = trim((string)($body['prompt'] ?? ''));
    $existing = $body['existing_blocks'] ?? null;
    $bodyStyle = $body['body_style'] ?? null;
    $improveContent = (bool)($body['improve_content'] ?? true);
    $tone = trim((string)($body['tone'] ?? 'professional'));
    $brandColor = trim((string)($body['brand_color'] ?? 'auto'));
    $includeBlocks = is_array($body['include_blocks'] ?? null) ? $body['include_blocks'] : [];

    if (empty($prompt)) {
        echo json_encode(['success' => false, 'message' => 'Prompt không được để trống.']);
        exit;
    }

    $workspace_id = get_current_workspace_id();
    $apiKey = getGeminiKey($pdo, $workspace_id);
    if (empty($apiKey)) {
        echo json_encode(['success' => false, 'message' => 'Chưa cấu hình Gemini API Key trong hệ thống.']);
        exit;
    }

    $resolvedAccent = ($brandColor !== '' && $brandColor !== 'auto' && strpos($brandColor, '#') === 0)
        ? $brandColor
        : '#BD1D2D';

    $toneMap = [
        'professional' => 'Chuyên nghiệp, chuẩn mực, đáng tin cậy, cấu trúc mạch lạc rõ ràng.',
        'luxury'       => 'Sang trọng, đẳng cấp VIP, ngôn từ tinh tế, tôn vinh vị thế người đọc (nhà lãnh đạo/quản lý cấp cao).',
        'persuasive'   => 'Thuyết phục cao, nhấn mạnh lợi ích cốt lõi, tạo cảm giác cấp thiết và thúc đẩy hành động (CTA mạnh mẽ).',
        'friendly'     => 'Thân thiện, ấm áp, gần gũi, giàu sự kết nối cá nhân hóa ({{first_name}}).',
        'concise'      => 'Cực kỳ tinh gọn, súc tích, đi thẳng vào trọng tâm bằng các gạch đầu dòng ngắn gọn.'
    ];
    $toneInstruction = $toneMap[$tone] ?? $toneMap['professional'];

    $systemPrompt = <<<SYSTEM
Bạn là Principal Email Marketing Designer & Copywriter AI hàng đầu cho hệ thống Enterprise MYERP (Viện Quốc tế IDEAS).
Nhiệm vụ: Thiết kế một mẫu Email HTML chuyên nghiệp dưới dạng cấu trúc JSON `EmailBlock[]` hoàn chỉnh, thẩm mỹ cao, tương thích 100% với Gmail, Outlook, Apple Mail.

=== CẤU TRÚC DỮ LIỆU BẮT BUỘC ===
Trả về một mảng JSON các `section`:
`section` (children: `row[]`) → `row` (children: `column[]`) → `column` (style.width: "100%" | "50%" | "33.33%", children: các khối nội dung).

Các loại khối nội dung (`type`) được hỗ trợ trong `column.children`:
1. `text`: Văn bản HTML (`<h1>`, `<h2>`, `<h3>`, `<p>`, `<strong>`).
   - `content`: Chuỗi HTML có inline style rõ ràng. Có thể dùng biến cá nhân hóa `{{first_name}}` hoặc `{{full_name}}`.
   - `style`: `{"paddingTop":"10px","paddingBottom":"10px","paddingLeft":"24px","paddingRight":"24px","textAlign":"left"|"center","color":"#1e293b"}`
2. `image`: Hình ảnh / Banner.
   - `url`: URL hình ảnh (ưu tiên ảnh từ người dùng hoặc mẫu tham khảo, hoặc ảnh Unsplash chất lượng cao phù hợp chủ đề:
     - Giáo dục/MBA/Lãnh đạo: `https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1000&auto=format&fit=crop&q=80`
     - Hội thảo/Sự kiện: `https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1000&auto=format&fit=crop&q=80`
     - Doanh nghiệp/Chiến lược: `https://images.unsplash.com/photo-1552664730-d307ca884978?w=1000&auto=format&fit=crop&q=80`)
   - `alt`: Mô tả ảnh
   - `style`: `{"width":"100%","borderRadius":"12px","paddingTop":"0px","paddingBottom":"16px","paddingLeft":"0px","paddingRight":"0px"}`
3. `button`: Nút kêu gọi hành động (CTA).
   - `content`: Nhãn nút bấm ngắn gọn, mạnh mẽ (VD: "Đăng ký nhận tư vấn ngay →", "Xác nhận tham dự VIP →").
   - `url`: "#" hoặc URL đích
   - `style`: `{"contentBackgroundColor":"{$resolvedAccent}","color":"#ffffff","borderRadius":"10px","paddingTop":"14px","paddingBottom":"14px","paddingLeft":"32px","paddingRight":"32px","textAlign":"center","fontWeight":"700","fontSize":"15px"}`
4. `check_list`: Danh sách lợi ích có icon dấu tích nổi bật.
   - `items`: Mảng chuỗi ngắn gọn `["Lợi ích 1...", "Lợi ích 2...", "Lợi ích 3..."]`
   - `style`: `{"iconColor":"{$resolvedAccent}","color":"#1e293b","fontSize":"15px","paddingTop":"12px","paddingBottom":"12px","paddingLeft":"28px","paddingRight":"28px"}`
5. `timeline`: Lịch trình sự kiện hoặc Lộ trình các bước.
   - `timelineItems`: Mảng object `[{"time":"Bước 1 / 08:30","title":"Tiêu đề ngắn","desc":"Mô tả 1 câu ngắn gọn"}]`
   - `style`: `{"iconColor":"{$resolvedAccent}","paddingTop":"16px","paddingBottom":"16px","paddingLeft":"28px","paddingRight":"28px"}`
6. `review`: Khối cảm nhận / Đánh giá thực tế từ Học viên / Khách hàng.
   - `content`: Câu trích dẫn đánh giá ngắn gọn, chân thực (1–2 câu).
   - `reviewName`: Họ tên người đánh giá
   - `reviewRole`: Chức vụ / Học viên khóa...
   - `reviewRating`: `5`
   - `style`: `{"paddingTop":"16px","paddingBottom":"16px","paddingLeft":"24px","paddingRight":"24px","backgroundColor":"#f8fafc","borderRadius":"14px"}`
7. `survey_card`: Thẻ Khảo sát nhanh tương tác cao.
   - `content`: Tiêu đề khảo sát
   - `url`: "#"
   - `style`: `{"surveyBadgeText":"KHẢO SÁT NHANH","surveyTitle":"Khảo sát mức độ hài lòng của bạn","surveyDescription":"Ý kiến của bạn giúp chúng tôi nâng cao chất lượng dịch vụ mỗi ngày.","surveyButtonText":"Tham gia khảo sát ngay →","surveyAccentColor":"{$resolvedAccent}","surveyCardBgColor":"#FFFFFF","surveyBorderColor":"#E2E8F0","surveyButtonTextColor":"#FFFFFF","borderRadius":"16px","paddingTop":"16px","paddingBottom":"16px","paddingLeft":"24px","paddingRight":"24px","textAlign":"center"}`
8. `countdown`: Đồng hồ đếm ngược thời gian ưu đãi/sự kiện.
   - `content`: Nhãn đếm ngược (VD: "Thời gian đăng ký ưu đãi còn lại")
   - `countdownTarget`: Chuỗi ISO ngày giờ tương lai
   - `style`: `{"contentBackgroundColor":"{$resolvedAccent}","color":"#ffffff","paddingTop":"16px","paddingBottom":"16px","textAlign":"center"}`
9. `quote`: Câu trích dẫn nổi bật.
   - `content`: Nội dung trích dẫn
   - `quoteAuthor`: Tác giả / Nguồn
   - `style`: `{"borderColor":"{$resolvedAccent}","paddingTop":"12px","paddingBottom":"12px","paddingLeft":"24px","paddingRight":"24px"}`
10. `divider`: Đường kẻ phân cách (`style`: `{"borderColor":"#e2e8f0","paddingTop":"16px","paddingBottom":"16px","paddingLeft":"24px","paddingRight":"24px"}`)
11. `spacer`: Khoảng trống (`style`: `{"height":"20px"}`)
12. `footer`: Chân trang chuẩn quốc tế có chứa `{{unsubscribe_url}}`.

=== QUY TẮC THIẾT KẾ & BỐ CỤC ĐẲNG CẤP ===
1. ĐỘ TƯƠNG PHẢN MÀU SẮC (CONTRAST TUYỆT ĐỐI):
   - Nền tối (`#0f172a`, `#1e293b`, `{$resolvedAccent}`): Chữ BẮT BUỘC màu trắng (`#ffffff` hoặc `#f8fafc`).
   - Nền sáng (`#ffffff`, `#f8fafc`): Chữ BẮT BUỘC màu tối (`#0f172a`, `#1e293b`, `#334155`).
   - Tuyệt đối không đặt chữ trắng trên nền sáng hoặc chữ tối trên nền tối!
2. CẮT GỌN VĂN BẢN (SCANNABLE COPYWRITING):
   - Tiêu đề chính (H1/H2): Dưới 10 từ, ấn tượng, súc tích.
   - Mỗi đoạn văn (`<p>`): Không quá 2–3 câu ngắn. Ưu tiên dùng khối `check_list`, `timeline`, chia 2 cột (`50%` - `50%`) hoặc 3 cột để trình bày thông tin thoáng đãng.
3. PHONG CÁCH GIỌNG VĂN: {$toneInstruction}
4. OUTPUT: Chỉ trả về DUY NHẤT mảng JSON `[...]` hợp lệ, không bọc markdown, không giải thích.
SYSTEM;

    // ── Fetch style references from selected or recent templates ──────────
    $recentStyleHint = "";
    try {
        $refTemplateIds = $body['reference_template_ids'] ?? [];
        $recentTemplates = [];

        if (!empty($refTemplateIds) && is_array($refTemplateIds)) {
            $cleanRefIds = array_values(array_filter(array_map('strval', $refTemplateIds), function ($id) {
                return $id !== '' && strpos($id, 'sys_') !== 0;
            }));
            if (!empty($cleanRefIds)) {
                $placeholders = implode(',', array_fill(0, count($cleanRefIds), '?'));
                $sql = "SELECT name, blocks, body_style FROM templates WHERE workspace_id = ? AND id IN ($placeholders) AND blocks IS NOT NULL AND blocks != '' AND blocks != '[]' LIMIT 3";
                $stmtTpl = $pdo->prepare($sql);
                $stmtTpl->execute(array_merge([$workspace_id], $cleanRefIds));
                $recentTemplates = $stmtTpl->fetchAll(PDO::FETCH_ASSOC);
            }
        }

        if (empty($recentTemplates)) {
            $stmtTpl = $pdo->prepare("SELECT name, blocks, body_style FROM templates WHERE workspace_id = ? AND blocks IS NOT NULL AND blocks != '' AND blocks != '[]' ORDER BY updated_at DESC LIMIT 2");
            $stmtTpl->execute([$workspace_id]);
            $recentTemplates = $stmtTpl->fetchAll(PDO::FETCH_ASSOC);
        }

        if (!empty($recentTemplates)) {
            $styleExcerpts = [];
            foreach ($recentTemplates as $idx => $tpl) {
                $blocksArr = json_decode($tpl['blocks'], true);
                if (!is_array($blocksArr) || empty($blocksArr) || !is_array($blocksArr[0] ?? null)) {
                    continue;
                }
                $compacted = compactBlocksForReference($blocksArr);
                $bodyStyleArr = json_decode($tpl['body_style'] ?? '{}', true) ?: [];
                unset($bodyStyleArr['accessConfig'], $bodyStyleArr['creator']);

                $styleExcerpts[] = "Mẫu tham khảo " . ($idx + 1) . ": \"" . $tpl['name'] . "\"\n"
                    . "- bodyStyle: " . json_encode($bodyStyleArr, JSON_UNESCAPED_UNICODE) . "\n"
                    . "- blocks: " . json_encode($compacted, JSON_UNESCAPED_UNICODE);
            }

            if (!empty($styleExcerpts)) {
                $recentStyleHint = "\n\n=== PHONG CÁCH & CẤU TRÚC MẪU THAM KHẢO TỪ HỆ THỐNG ===\n"
                    . "Hãy kế thừa tinh thần bố cục (header/logo, cách phối màu nền xen kẽ, fontFamily, cỡ chữ, bo góc, footer) từ các mẫu dưới đây:\n\n"
                    . implode("\n\n", $styleExcerpts) . "\n======================================\n";
            }
        }
    } catch (\Throwable $eTpl) {
        // Ignore reference fetch error
    }

    // ── Build user message ────────────────────────────────────────────────
    $userMsg = "YÊU CẦU THIẾT KẾ EMAIL:\n" . $prompt;

    if ($brandColor !== '' && $brandColor !== 'auto') {
        $userMsg .= "\n\nMÀU CHỦ ĐẠO (BRAND COLOR BẮT BUỘC): Hãy sử dụng màu `{$brandColor}` làm màu điểm nhấn chính cho nút bấm CTA, tiêu đề phụ, badge và viền trang trí.";
    }

    if (!empty($includeBlocks)) {
        $blockNames = implode(', ', array_map('strval', $includeBlocks));
        $userMsg .= "\n\nCÁC KHỐI THÀNH PHẦN BẮT BUỘC CÓ TRONG EMAIL: Hãy thiết kế bố cục có bao gồm các loại block sau: {$blockNames}.";
    }

    if (is_array($existing) && !empty($existing) && is_array($existing[0] ?? null)) {
        $compactedExisting = compactBlocksForReference($existing);
        $existingJson = json_encode($compactedExisting, JSON_UNESCAPED_UNICODE);

        $brandColors = [];
        extractBrandColors($existing, $brandColors);
        arsort($brandColors);
        $topColors = array_slice(array_keys($brandColors), 0, 5);
        $brandHint = !empty($topColors)
            ? "\n\nMÀU BRAND PHÁT HIỆN TỪ EMAIL GỐC (ưu tiên sử dụng): " . implode(', ', $topColors)
            : '';

        if ($improveContent) {
            $userMsg .= "\n\nCHẾ ĐỘ REDESIGN: Cải thiện toàn diện bố cục (layout, spacing, typography) VÀ biên tập lại nội dung văn bản cho súc tích, cuốn hút hơn.";
        } else {
            $userMsg .= "\n\nCHẾ ĐỘ REDESIGN: Nâng cấp layout, spacing, typography, màu sắc hiện đại hơn nhưng GIỮ NGUYÊN ý chính văn bản.";
        }
        $userMsg .= $brandHint;
        $userMsg .= "\n\nCấu trúc email gốc cần redesign:\n" . $existingJson;
    }

    if (!empty($recentStyleHint)) {
        $userMsg .= $recentStyleHint;
    }

    $contents = [
        ['role' => 'user', 'parts' => [['text' => $userMsg]]]
    ];

    // ── Call Gemini ───────────────────────────────────────────────────────
    $raw = generateResponse(
        $contents,
        $systemPrompt,
        $apiKey,
        'gemini-3.5-flash-lite',
        0.35,
        32768
    );

    // ── Clean & parse JSON ────────────────────────────────────────────────
    $cleaned = trim((string)$raw);
    $cleaned = preg_replace('/^```(?:json)?\s*/i', '', $cleaned);
    $cleaned = preg_replace('/\s*```$/', '', $cleaned);
    $cleaned = trim($cleaned);

    $blocks = json_decode($cleaned, true);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($blocks)) {
        if (preg_match('/\[[\s\S]*\]/m', $cleaned, $m)) {
            $blocks = json_decode($m[0], true);
        }
    }

    if (!is_array($blocks) || empty($blocks)) {
        echo json_encode([
            'success' => false,
            'message' => 'AI không trả về cấu trúc block hợp lệ. Hãy thử lại với mô tả chi tiết hơn.',
            'raw' => mb_substr($raw, 0, 500)
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    foreach ($blocks as &$block) {
        sanitizeBlock($block, $resolvedAccent);
    }
    unset($block);

    echo json_encode([
        'success' => true,
        'data' => $blocks,
        'message' => 'Đã tạo mẫu email bằng AI thành công!'
    ], JSON_UNESCAPED_UNICODE);

} catch (\Throwable $e) {
    if (function_exists('logChatError')) {
        logChatError("AI Email Generator Error: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine());
    }
    echo json_encode([
        'success' => false,
        'message' => 'Lỗi hệ thống khi tạo email AI: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
