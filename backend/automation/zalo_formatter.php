<?php
/**
 * Zalo Text Formatter
 * Strip tất cả Markdown và ký tự đặc biệt để phù hợp với Zalo/Meta
 */

class ZaloFormatter
{
    /**
     * Convert Markdown text to Zalo-friendly plain text
     */
    public static function format($text)
    {
        if (empty($text))
            return $text;

        return formatZaloMessage($text);
    }
}

/**
 * Strip toàn bộ Markdown formatting → plain text phù hợp Zalo/Meta
 */
function formatZaloMessage($text)
{
    if (empty($text))
        return $text;

    // 1. Strip [ACTIONS:...], [SHOW_LEAD_FORM], [IMAGE_REQUEST:...] tags
    $text = preg_replace('/\[(?:ACTIONS|ACTION|BUTTONS|BUTTON|OPTIONS|SHOW_LEAD_FORM|IMAGE_REQUEST)[^\]]*\]/iu', '', $text);

    // 2. Strip Markdown bold/italic (** __ * _)
    $text = preg_replace('/\*\*(.*?)\*\*/su', '$1', $text);   // **bold** → plain
    $text = preg_replace('/__(.*?)__/su', '$1', $text);        // __bold__ → plain
    $text = preg_replace('/~~(.*?)~~/su', '$1', $text);        // ~~strike~~ → plain
    $text = preg_replace('/`{1,3}(.*?)`{1,3}/su', '$1', $text); // `code` → plain

    // 3. Strip italic * và _ (chỉ khi không phải bullet đơn hoặc line break)
    // Xử lý *italic* carefully (không bắt bullet points)
    $text = preg_replace('/(?<!\n)\*(.*?)\*(?!\*)/su', '$1', $text);
    $text = preg_replace('/(?<!\w)_(.*?)_(?!\w)/su', '$1', $text);

    // 4. Convert bullet lists (* hoặc -) sang • 
    $text = preg_replace('/^[\s]*[\*\-][\s]+/m', '• ', $text);

    // 5. Convert headers (### Header) → plain text (không in hoa, giữ nguyên)
    $text = preg_replace('/^[\s]*#{1,6}[\s]+([^\n]+)/m', '$1', $text);

    // 6. Strip blockquotes (> text)
    $text = preg_replace('/^>\s+/m', '', $text);

    // 7. Strip numbered lists format (1. 2. etc) → keep text
    $text = preg_replace('/^\d+\.\s+/m', '', $text);

    // 8. Convert [text](url) markdown links → just "text (url)" hoặc chỉ text
    $text = preg_replace('/\[([^\]]+)\]\(([^)]+)\)/', '$1', $text);

    // 9. Strip toàn bộ dấu * do request từ người dùng "bỏ hết mấy cái dấu *"
    $text = str_replace('*', '', $text);

    // 10. Giảm khoảng trắng thừa (max 2 dòng trống liên tiếp)
    $text = preg_replace('/\n{3,}/', "\n\n", $text);

    return trim($text);
}

/**
 * Chia tin nhắn dài thành các đoạn nhỏ hơn giới hạn ký tự
 * Zalo giới hạn ~1000 ký tự / tin nhắn CS API
 * 
 * @param string $text  Nội dung cần chia
 * @param int    $limit Giới hạn ký tự mỗi đoạn (default 900 để an toàn)
 * @return array Mảng các đoạn tin nhắn
 */
function splitLongMessage($text, $limit = 900)
{
    $text = trim($text);
    if (mb_strlen($text) <= $limit) {
        return [$text];
    }

    $parts = [];
    $paragraphs = preg_split('/\n\n+/', $text);

    $current = '';
    foreach ($paragraphs as $para) {
        $para = trim($para);
        if (empty($para))
            continue;

        // Nếu đoạn hiện tại + paragraph mới vẫn trong giới hạn
        $candidate = $current ? $current . "\n\n" . $para : $para;

        if (mb_strlen($candidate) <= $limit) {
            $current = $candidate;
        } else {
            // Flush đoạn hiện tại
            if ($current !== '')
                $parts[] = trim($current);

            // Nếu 1 paragraph đơn vẫn quá dài → chia theo câu
            if (mb_strlen($para) > $limit) {
                $sentences = preg_split('/(?<=[.!?。])\s+/u', $para);
                $current = '';
                foreach ($sentences as $s) {
                    $s = trim($s);
                    if (empty($s)) continue;
                    $candidate = $current ? $current . ' ' . $s : $s;
                    if (mb_strlen($candidate) <= $limit) {
                        $current = $candidate;
                    } else {
                        if ($current !== '')
                            $parts[] = trim($current);
                        // Câu vẫn dài → cắt cứng
                        if (mb_strlen($s) > $limit) {
                            $chunks = mb_str_split($s, $limit - 10);
                            foreach ($chunks as $chunk) {
                                $parts[] = trim($chunk);
                            }
                            $current = '';
                        } else {
                            $current = $s;
                        }
                    }
                }
            } else {
                $current = $para;
            }
        }
    }

    if ($current !== '')
        $parts[] = trim($current);

    // Lọc đoạn rỗng
    return array_values(array_filter($parts, fn($p) => mb_strlen(trim($p)) > 0));
}
