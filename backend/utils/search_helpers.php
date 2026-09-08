<?php
// backend/utils/search_helpers.php

/**
 * Remove Vietnamese accents from string
 */
function removeVietnameseAccents(string $str): string {
    $unicode = [
        'a' => 'á|à|ả|ã|ạ|ă|ắ|ặ|ằ|ẳ|ẵ|â|ấ|ầ|ẩ|ẫ|ậ',
        'd' => 'đ',
        'e' => 'é|è|ẻ|ẽ|ẹ|ê|ề|ế|ể|ễ|ệ',
        'i' => 'í|ì|ỉ|ĩ|ị',
        'o' => 'ó|ò|ỏ|õ|ọ|ô|ố|ồ|ổ|ỗ|ộ|ơ|ớ|ờ|ở|ỡ|ợ',
        'u' => 'ú|ù|ủ|ũ|ụ|ư|ứ|ừ|ử|ữ|ự',
        'y' => 'ý|ỳ|ỷ|ỹ|ỵ',
        'A' => 'Á|À|Ả|Ã|Ạ|Ă|Ắ|Ặ|Ằ|Ẳ|Ẵ|Â|Ấ|Ầ|Ẩ|Ẫ|Ậ',
        'D' => 'Đ',
        'E' => 'É|È|Ẻ|Ẽ|Ẹ|Ê|Ế|Ề|Ể|Ễ|Ệ',
        'I' => 'Í|Ì|Ỉ|Ĩ|Ị',
        'O' => 'Ó|Ò|Ỏ|Õ|Ọ|Ô|Ố|Ồ|Ổ|Ỗ|Ộ|Ơ|Ớ|Ờ|Ở|Ỡ|Ợ',
        'U' => 'Ú|Ù|Ủ|Ũ|Ụ|Ư|Ứ|Ừ|Ử|Ữ|Ự',
        'Y' => 'Ý|Ỳ|Ỷ|Ỹ|Ỵ',
    ];
    foreach ($unicode as $nonAccent => $accent) {
        $str = preg_replace("/($accent)/iu", $nonAccent, $str);
    }
    return $str;
}

/**
 * Build regex pattern for a single Vietnamese word matching (covers all accents and d/đ)
 */
function buildVietnameseWordRegex(string $word): string {
    $map = [
        'a' => '[aàáảãạăằắẳẵặâầấẩẫậ]',
        'e' => '[eèéẻẽẹêềếểễệ]',
        'i' => '[iìíỉĩị]',
        'o' => '[oòóỏõọôồốổỗộơờớởỡợ]',
        'u' => '[uùúủũụưừứửữự]',
        'y' => '[yỳýỷỹỵ]',
        'd' => '[dđ]',
    ];

    $unaccented = removeVietnameseAccents($word);
    $chars = mb_str_split(mb_strtolower($unaccented, 'UTF-8'));
    $pattern = '';
    foreach ($chars as $c) {
        if (isset($map[$c])) {
            $pattern .= $map[$c];
        } else {
            $pattern .= preg_quote($c, '/');
        }
    }
    return $pattern;
}

/**
 * Extract phone variants (e.g. 0938..., 938..., 84938...)
 * Only extracts if query looks like a phone number and not an email
 */
function getPhoneSearchVariants(string $search): array {
    // If search contains @, it is an email, not a phone
    if (str_contains($search, '@')) {
        return [];
    }

    // Check if query is composed of phone number characters or contains an isolated phone number
    $trimmed = trim($search);
    $clean = preg_replace('/[^0-9]/', '', $trimmed);
    
    // If there are letters in the query and clean digits < 7, don't treat as phone
    if (preg_match('/[a-zA-Z]/', $trimmed) && strlen($clean) < 7) {
        return [];
    }

    if (strlen($clean) < 3) return [];

    $variants = [$clean];
    if (str_starts_with($clean, '84') && strlen($clean) > 8) {
        $no84 = substr($clean, 2);
        $variants[] = $no84;
        $variants[] = '0' . $no84;
    } elseif (str_starts_with($clean, '0')) {
        $variants[] = substr($clean, 1);
    } else {
        $variants[] = '0' . $clean;
    }
    return array_values(array_unique($variants));
}

/**
 * Build search WHERE clause & params for Contacts / Leads
 * 
 * Supports:
 * - Accented and unaccented Vietnamese names (multi-word, any order)
 * - Phone numbers with/without leading 0, +84, spaces, dots, dashes
 * - Email, exact ID, person_id
 */
function buildContactSearchClause(string $search, string $prefix = 'c.'): array {
    $search = trim($search);
    if ($search === '') {
        return ['clause' => '', 'params' => []];
    }

    $conds = [];
    $params = [];

    // 1. Email check
    $conds[] = "{$prefix}email LIKE ?";
    $params[] = "%$search%";

    // 2. Exact ID / Person ID check if numeric
    if (is_numeric($search) && strlen($search) <= 10) {
        $conds[] = "{$prefix}id = ?";
        $params[] = (int)$search;
        $conds[] = "{$prefix}person_id = ?";
        $params[] = (int)$search;
    }

    // 3. Phone number variants check
    $phoneVariants = getPhoneSearchVariants($search);
    if (!empty($phoneVariants)) {
        foreach ($phoneVariants as $pv) {
            $conds[] = "{$prefix}phone LIKE ?";
            $params[] = "%$pv%";
            $conds[] = "{$prefix}mobile LIKE ?";
            $params[] = "%$pv%";
            $conds[] = "REPLACE(REPLACE(REPLACE(REPLACE({$prefix}phone, ' ', ''), '.', ''), '-', ''), '+', '') LIKE ?";
            $params[] = "%$pv%";
        }
    }

    // 4. Name check: Standard LIKE for exact substring
    $conds[] = "{$prefix}full_name LIKE ?";
    $params[] = "%$search%";

    // 5. Multi-word Regex for Vietnamese unaccented/accented support
    // Only apply regex if search is not a pure phone number or email
    if (!str_contains($search, '@') && preg_match('/[a-zA-Z\x{00C0}-\x{1EF9}]/u', $search)) {
        $words = array_filter(explode(' ', $search), fn($w) => trim($w) !== '');
        if (!empty($words) && count($words) <= 6) {
            $wordRegexClauses = [];
            $wordRegexParams = [];
            foreach ($words as $w) {
                $pattern = buildVietnameseWordRegex($w);
                if (!empty($pattern)) {
                    $wordRegexClauses[] = "{$prefix}full_name REGEXP ?";
                    $wordRegexParams[] = $pattern;
                }
            }
            if (!empty($wordRegexClauses)) {
                $conds[] = "(" . implode(' AND ', $wordRegexClauses) . ")";
                foreach ($wordRegexParams as $wp) {
                    $params[] = $wp;
                }
            }
        }
    }

    return [
        'clause' => '(' . implode(' OR ', $conds) . ')',
        'params' => $params
    ];
}
