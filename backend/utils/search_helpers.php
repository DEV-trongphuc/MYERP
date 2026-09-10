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
 * Extract phone variants (e.g. tail digits, 0938..., 938..., 84938...)
 * Supports partial matching, tail numbers (1 vài số đuôi, e.g. 43, 643, 3643, 23643)
 */
function getPhoneSearchVariants(string $search): array {
    // If search contains @, it is an email, not a phone query
    if (str_contains($search, '@')) {
        return [];
    }

    $trimmed = trim($search);
    $clean = preg_replace('/[^0-9]/', '', $trimmed);

    // If query has letters (e.g. "đuôi 643", "sđt 3643", "haodiep92"), only treat as phone if digits >= 3
    $hasLetters = preg_match('/[a-zA-Z\x{00C0}-\x{1EF9}]/u', $trimmed);
    if ($hasLetters && strlen($clean) < 3) {
        return [];
    }

    // Allow pure digit sequences of at least 2 digits (e.g. tail numbers "43", "88", "92", "643")
    if (strlen($clean) < 2) {
        return [];
    }

    $variants = [$clean];
    if (str_starts_with($clean, '84') && strlen($clean) > 8) {
        $no84 = substr($clean, 2);
        $variants[] = $no84;
        $variants[] = '0' . $no84;
    } elseif (str_starts_with($clean, '0') && strlen($clean) >= 9) {
        $variants[] = substr($clean, 1);
    } elseif (!str_starts_with($clean, '0') && strlen($clean) === 9) {
        $variants[] = '0' . $clean;
    }

    return array_values(array_unique($variants));
}

/**
 * Build search WHERE clause & params for Contacts / Leads
 * 
 * Supports:
 * - Accented and unaccented Vietnamese names (multi-word, any order)
 * - Phone numbers: full number, tail numbers (1 vài số đuôi), with/without leading 0, +84, spaces, dots, dashes, parentheses
 * - Email: exact, partial username, tail numbers (e.g. 92 in haodiep92@gmail.com, 0584 in trangnguyen0584@gmail.com), fuzzy without dots/spaces
 * - Exact ID, person_id
 */
function buildContactSearchClause(string $search, string $prefix = 'c.'): array {
    $search = trim($search);
    if ($search === '') {
        return ['clause' => '', 'params' => []];
    }

    $tableRef = rtrim($prefix, '.') ?: 'contacts';
    $conds = [];
    $params = [];

    // 1. Email check (case-insensitive, fuzzy/partial matching)
    // 1.1 Direct LIKE
    $conds[] = "LOWER({$prefix}email) LIKE LOWER(?)";
    $params[] = "%$search%";

    // 1.2 Normalized email without spaces, dots, hyphens, underscores (e.g. trangnguyen -> trang.nguyen@...)
    $cleanEmailQuery = str_replace([' ', '.', '-', '_'], '', strtolower($search));
    if (strlen($cleanEmailQuery) >= 2 && $cleanEmailQuery !== strtolower($search)) {
        $conds[] = "REPLACE(REPLACE(REPLACE(REPLACE(LOWER(IFNULL({$prefix}email, '')), '.', ''), '-', ''), '_', ''), ' ', '') LIKE ?";
        $params[] = "%$cleanEmailQuery%";
    }

    // 1.3 If user typed Vietnamese accents without spaces (e.g. "hảo diệp" or "trang nguyễn") -> match email "haodiep..." / "trangnguyen..."
    $unaccentedNoSpaces = removeVietnameseAccents($cleanEmailQuery);
    if (strlen($unaccentedNoSpaces) >= 3 && $unaccentedNoSpaces !== $cleanEmailQuery) {
        $conds[] = "REPLACE(REPLACE(REPLACE(REPLACE(LOWER(IFNULL({$prefix}email, '')), '.', ''), '-', ''), '_', ''), ' ', '') LIKE ?";
        $params[] = "%$unaccentedNoSpaces%";
    }

    // 1.4 Also search contact_emails table
    $conds[] = "EXISTS (SELECT 1 FROM contact_emails ce WHERE ce.contact_id = {$tableRef}.id AND LOWER(ce.email) LIKE LOWER(?))";
    $params[] = "%$search%";

    // 1.5 Also search linked leads table by person_id
    $conds[] = "({$tableRef}.person_id IS NOT NULL AND {$tableRef}.person_id > 0 AND EXISTS (SELECT 1 FROM leads l_e WHERE l_e.person_id = {$tableRef}.person_id AND LOWER(l_e.email) LIKE LOWER(?)))";
    $params[] = "%$search%";

    // 2. Exact ID / Person ID check if numeric
    if (is_numeric($search) && strlen($search) <= 10) {
        $conds[] = "{$prefix}id = ?";
        $params[] = (int)$search;
        $conds[] = "{$prefix}person_id = ?";
        $params[] = (int)$search;
    }

    // 3. Phone number variants check (Tail digits, partial, normalized across all phone fields)
    $phoneVariants = getPhoneSearchVariants($search);
    if (!empty($phoneVariants)) {
        $cleanPhoneFn = function($field) {
            return "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(IFNULL($field, ''), ' ', ''), '.', ''), '-', ''), '+', ''), '(', ''), ')', '')";
        };

        foreach ($phoneVariants as $pv) {
            // Direct LIKE on all phone columns
            $conds[] = "{$prefix}phone LIKE ?";
            $params[] = "%$pv%";
            $conds[] = "{$prefix}mobile LIKE ?";
            $params[] = "%$pv%";
            $conds[] = "{$prefix}phone2 LIKE ?";
            $params[] = "%$pv%";
            $conds[] = "{$prefix}zalo_phone LIKE ?";
            $params[] = "%$pv%";

            // Normalized format (strips spaces, dots, hyphens, plus, parentheses)
            $conds[] = $cleanPhoneFn("{$prefix}phone") . " LIKE ?";
            $params[] = "%$pv%";
            $conds[] = $cleanPhoneFn("{$prefix}mobile") . " LIKE ?";
            $params[] = "%$pv%";
            $conds[] = $cleanPhoneFn("{$prefix}phone2") . " LIKE ?";
            $params[] = "%$pv%";
            $conds[] = $cleanPhoneFn("{$prefix}zalo_phone") . " LIKE ?";
            $params[] = "%$pv%";

            // Check contact_phones table
            $conds[] = "EXISTS (SELECT 1 FROM contact_phones cp WHERE cp.contact_id = {$tableRef}.id AND " . $cleanPhoneFn("cp.phone") . " LIKE ?)";
            $params[] = "%$pv%";

            // Check linked leads by person_id
            $conds[] = "({$tableRef}.person_id IS NOT NULL AND {$tableRef}.person_id > 0 AND EXISTS (SELECT 1 FROM leads l_p WHERE l_p.person_id = {$tableRef}.person_id AND " . $cleanPhoneFn("l_p.phone") . " LIKE ?))";
            $params[] = "%$pv%";
        }
    }

    // 4. Name check: Standard LIKE for exact substring
    $conds[] = "{$prefix}full_name LIKE ?";
    $params[] = "%$search%";

    // 5. Multi-word Regex for Vietnamese unaccented/accented support
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
