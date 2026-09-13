<?php
// backend/migrations/normalize_activities_body.php
/**
 * Script chuẩn hóa dữ liệu activities.body:
 * 1. Bóc tách và phục hồi nội dung mô tả tiếng Việt (ngắt dòng emoji, từ khóa, dấu câu, ngày tháng).
 * 2. Loại bỏ hoàn toàn chuỗi JSON thô lọt vào nội dung mô tả.
 * 3. Chuyển đổi định dạng mô tả sang HTML đoạn văn sạch (<p>...</p>, <br/>).
 * 4. Bảo toàn 100% cờ SLA (due_sla_notified, subtask_sla_notified), checklist, recurrence, link, project_id.
 * 5. Lưu lại theo đúng chuẩn cấu trúc JSON chuẩn mực của hệ thống MYERP.
 */

$dbConnectPath = file_exists(__DIR__ . '/../db_connect.php') 
    ? __DIR__ . '/../db_connect.php' 
    : '/home/vhvxoigh/myerp.ideas.edu.vn/backend/db_connect.php';
require_once $dbConnectPath;

echo "=== CHUẨN HÓA CƠ SỞ DỮ LIỆU ACTIVITIES.BODY ===\n";

function formatVietnameseDescriptionPhp($text) {
    if (empty($text)) return '';
    $text = trim((string)$text);

    // Giải nén nếu bị JSON.stringify lặp lại nhiều lần
    while (str_starts_with($text, '{') && str_ends_with($text, '}')) {
        $p = json_decode($text, true);
        if (is_array($p)) {
            $cand = $p['erp_task']['description'] ?? $p['description'] ?? $p['body'] ?? null;
            if (is_string($cand)) {
                $text = trim($cand);
            } else {
                break;
            }
        } else {
            break;
        }
    }

    // Loại bỏ các chuỗi JSON thô còn sót lại
    $text = preg_replace('/\{"due_sla_notified":\s*(?:true|false)[^}]*\}/i', '', $text);
    $text = preg_replace('/\{"subtask_sla_notified":\s*(?:true|false)[^}]*\}/i', '', $text);
    $text = str_replace('[MISA_IMPORT]', '', $text);
    $text = preg_replace('/Project:\s*ALL IN ONE\s*-\s*VẬN HÀNH/iu', '', $text);

    // 1. Tách trước các emoji đề mục: 🎯, 📚, 🎥, 👉, 📌, 💡, ❗, 📞, ✅, ❌, ⚠️, 🔹, 🔸, ⭐, 🔥
    $text = preg_replace('/([^\n\r\s])(\s*)([🎯📚🎥👉📌💡❗📞✅❌⚠️🔹🔸⭐🔥])/u', "$1\n\n$3", $text);

    // 2. Tách trước các từ khóa đề mục phổ biến
    $keywords = [
        'Ví dụ:', 'Ví dụ:', 'Lưu ý:', 'Lưu ý:', 'Ghi chú:', 'Ghi chú:',
        'Mục tiêu:', 'Mục tiêu:', 'Nhiệm vụ:', 'Nhiệm vụ:', 'Yêu cầu:', 'Yêu cầu:',
        'Dự định:', 'Dự định:', 'Dùng để:', 'Dùng để:', 'Mà để:', 'Mà để:',
        'Insight chính:', 'Hàm ý:', 'Hàm ý:', 'Quan điểm quan trọng:',
        'Áp dụng cách:', 'Sau đó xem lại:', 'Mỗi người cần:', 'Mỗi người cần:',
        'Nhấn mạnh:', 'Nhán mạnh:', 'Phản ứng từ khách hàng:', 'Thực tế phản hồi:',
        'Tự nhìn lại bản thân:', 'Không phải để:', 'Kỹ năng:', 'Kỹ năng:'
    ];
    foreach ($keywords as $kw) {
        $kwPattern = preg_quote($kw, '/');
        $text = preg_replace('/([^\n\r])(\s*)(' . $kwPattern . ')/u', "$1\n\n$3", $text);
    }

    // 3. Tách sau dấu hai chấm ':' của đề mục nếu dính liền
    $text = preg_replace('/(Ví dụ:|Ví dụ:|Lưu ý:|Lưu ý:|Ghi chú:|Ghi chú:|Dùng để:|Mà để:|Dự định:|Áp dụng cách:|Hàm ý:)([A-ZÀ-ỸĐa-zà-ỹđ0-9🎯📚🎥👉📌💡❗📞])/u', "$1\n$2", $text);

    // 4. Tách ngày tháng năm dính chữ hoa: ví dụ "23/09/2026CHUYẾN ĐI" -> "23/09/2026\nCHUYẾN ĐI"
    $text = preg_replace('/(\b\d{1,2}\/\d{1,2}\/\d{4})([A-ZÀ-ỸĐ])/u', "$1\n$2", $text);

    // 5. Tách sau dấu câu chấm, chấm than, chấm hỏi nếu dính liền chữ hoa
    $text = preg_replace_callback('/([^0-9A-Za-zÀ-ỸĐà-ỹđ]|^|[a-zà-ỹđ]{2,})([.!?])([A-ZÀ-ỸĐ])/u', function($m) {
        $prefix = $m[1];
        $punc = $m[2];
        $nextChar = $m[3];
        $low = mb_strtolower($prefix, 'UTF-8');
        if (str_ends_with($low, 'tp') || str_ends_with($low, 'ths') || str_ends_with($low, 'ts')) {
            return $m[0];
        }
        return $prefix . $punc . "\n" . $nextChar;
    }, $text);

    // 6. Tách sau dấu phẩy dính chữ: ví dụ "chị Nữ,Học viên" -> "chị Nữ, Học viên"
    $text = preg_replace('/([a-zà-ỹđA-ZÀ-ỸĐ0-9]),([a-zà-ỹđA-ZÀ-ỸĐ0-9])/u', '$1, $2', $text);

    // 7. Rút gọn dòng trắng thừa
    $text = preg_replace('/\n{3,}/', "\n\n", $text);

    return trim($text);
}

function textToCleanHtmlParagraphsPhp($text) {
    if (empty($text)) return '';
    if (str_contains($text, '<p>') || str_contains($text, '<br>') || str_contains($text, '<br/>')) {
        return $text;
    }
    $paragraphs = preg_split('/\n\s*\n/', $text);
    $htmlParts = [];
    foreach ($paragraphs as $p) {
        $p = trim($p);
        if ($p === '') continue;
        $withBr = str_replace("\n", '<br/>', $p);
        $htmlParts[] = "<p>{$withBr}</p>";
    }
    return implode('', $htmlParts);
}

$sql = "SELECT id, subject, body FROM activities WHERE type = 'task' AND deleted_at IS NULL ORDER BY id ASC";
$res = $conn->query($sql);

if (!$res) {
    echo "Lỗi truy vấn activities: " . $conn->error . "\n";
    exit(1);
}

$totalTasks = $res->num_rows;
echo "Tổng số công việc cần kiểm tra: {$totalTasks}\n";

$updatedCount = 0;
$skippedCount = 0;

$updStmt = $conn->prepare("UPDATE activities SET body = ? WHERE id = ?");

while ($row = $res->fetch_assoc()) {
    $taskId = (int)$row['id'];
    $rawBody = $row['body'];

    if (empty($rawBody)) {
        $skippedCount++;
        continue;
    }

    $rawTrimmed = trim((string)$rawBody);
    $isJson = (str_starts_with($rawTrimmed, '{') && str_ends_with($rawTrimmed, '}'));

    $dueSla = false;
    $subtaskSla = false;
    $desc = '';
    $checklist = [];
    $links = [];
    $internalType = 'task';
    $scope = 'team';
    $recurrence = ['pattern' => 'none', 'weekly_days' => [], 'monthly_day' => 1, 'days_interval' => 3, 'last_generated' => ''];
    $projectId = null;
    $campaignId = null;
    $teamId = null;
    $extraErp = [];

    if ($isJson) {
        $decoded = json_decode($rawTrimmed, true);
        if (is_array($decoded)) {
            // SLA flags
            if (!empty($decoded['due_sla_notified']) || !empty($decoded['erp_task']['due_sla_notified'])) {
                $dueSla = true;
            }
            if (!empty($decoded['subtask_sla_notified']) || !empty($decoded['erp_task']['subtask_sla_notified'])) {
                $subtaskSla = true;
            }

            $erpData = $decoded['erp_task'] ?? $decoded;
            if (is_array($erpData)) {
                $desc = $erpData['description'] ?? '';
                if (!empty($erpData['checklist']) && is_array($erpData['checklist'])) {
                    $checklist = $erpData['checklist'];
                }
                if (!empty($erpData['links']) && is_array($erpData['links'])) {
                    $links = $erpData['links'];
                }
                if (!empty($erpData['internal_type'])) $internalType = $erpData['internal_type'];
                if (!empty($erpData['scope'])) $scope = $erpData['scope'];
                if (!empty($erpData['recurrence'])) $recurrence = $erpData['recurrence'];
                if (isset($erpData['project_id'])) $projectId = $erpData['project_id'];
                if (isset($erpData['campaign_id'])) $campaignId = $erpData['campaign_id'];
                if (isset($erpData['team_id'])) $teamId = $erpData['team_id'];

                // Lưu các thuộc tính đặc thù khác nếu có (misa_stt, ...)
                foreach ($erpData as $k => $v) {
                    if (!in_array($k, ['description', 'checklist', 'links', 'internal_type', 'scope', 'recurrence', 'project_id', 'campaign_id', 'team_id', 'due_sla_notified', 'subtask_sla_notified'])) {
                        $extraErp[$k] = $v;
                    }
                }
            }
        } else {
            $desc = $rawTrimmed;
        }
    } else {
        $desc = $rawTrimmed;
    }

    // Link kèm text thuần
    if (preg_match('/Tài liệu\/Link đính kèm:\s*(.*)$/m', $desc, $mLink)) {
        $extUrl = trim($mLink[1]);
        if (!empty($extUrl)) {
            $hasLink = false;
            foreach ($links as $l) {
                $u = is_array($l) ? ($l['url'] ?? '') : $l;
                if ($u === $extUrl) { $hasLink = true; break; }
            }
            if (!$hasLink) {
                $links[] = ['title' => 'Tài liệu đính kèm', 'url' => $extUrl];
            }
        }
        $desc = preg_replace('/Tài liệu\/Link đính kèm:\s*.*$/m', '', $desc);
    }

    // Phục hồi ngắt dòng và chuyển sang HTML sạch
    $formattedDesc = formatVietnameseDescriptionPhp($desc);
    $htmlDesc = textToCleanHtmlParagraphsPhp($formattedDesc);

    // Chuẩn hóa checklist item
    $normalizedChecklist = [];
    $subtaskIdx = 0;
    foreach ($checklist as $item) {
        if (!is_array($item)) continue;
        $subtaskIdx++;
        $title = $item['title'] ?? $item['text'] ?? '';
        $normalizedChecklist[] = [
            'id' => (!empty($item['id']) ? (string)$item['id'] : "sub_{$taskId}_{$subtaskIdx}"),
            'title' => $title,
            'text' => $title,
            'done' => !empty($item['done']) || !empty($item['checked']),
            'checked' => !empty($item['done']) || !empty($item['checked']),
            'due_date' => $item['due_date'] ?? null,
            'assignee_id' => $item['assignee_id'] ?? null,
            'notified_sla' => !empty($item['notified_sla'])
        ];
    }

    $finalErpMeta = array_merge($extraErp, [
        'description' => $htmlDesc,
        'internal_type' => $internalType,
        'scope' => $scope,
        'recurrence' => $recurrence,
        'checklist' => $normalizedChecklist,
        'links' => $links,
        'project_id' => $projectId,
        'campaign_id' => $campaignId,
        'team_id' => $teamId
    ]);

    $finalPayload = ['erp_task' => $finalErpMeta];
    if ($dueSla) $finalPayload['due_sla_notified'] = true;
    if ($subtaskSla) $finalPayload['subtask_sla_notified'] = true;

    $finalJson = json_encode($finalPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    if ($finalJson !== $rawTrimmed) {
        $updStmt->bind_param("si", $finalJson, $taskId);
        $updStmt->execute();
        $updatedCount++;
    } else {
        $skippedCount++;
    }
}

if ($updStmt) $updStmt->close();

echo "Hoàn tất chuẩn hóa:\n";
echo "- Đã cập nhật chuẩn hóa: {$updatedCount} công việc.\n";
echo "- Đã giữ nguyên (đã chuẩn): {$skippedCount} công việc.\n";
