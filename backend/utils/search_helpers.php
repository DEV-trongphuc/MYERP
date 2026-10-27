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
 * Inspect and cache table columns per request + persistent disk cache (1-hour TTL)
 * so queries never reference missing columns and `SHOW COLUMNS` runs at most once per deployment/hour.
 */
function getCrmTableColumnsCache(?PDO $db, string $table = 'contacts'): array {
    static $cache = null;
    static $cacheFile = null;
    static $dirty = false;

    if ($cache === null) {
        $cache = [];
        $cacheFile = rtrim(sys_get_temp_dir(), '/\\') . '/myerp_crm_schema_cols_v4_' . substr(md5(__DIR__), 0, 12) . '.json';
        if (is_file($cacheFile)) {
            $mtime = @filemtime($cacheFile);
            if ($mtime && (time() - $mtime) < 3600) {
                $raw = @file_get_contents($cacheFile);
                if (is_string($raw) && $raw !== '') {
                    $decoded = @json_decode($raw, true);
                    if (is_array($decoded)) {
                        $cache = $decoded;
                    }
                }
            }
        }
    }

    if (isset($cache[$table]) && is_array($cache[$table])) {
        return $cache[$table];
    }

    if ($db instanceof PDO) {
        try {
            $safeTable = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
            $stmt = $db->query("SHOW COLUMNS FROM `{$safeTable}`");
            if ($stmt) {
                $cols = [];
                foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                    if (!empty($row['Field'])) {
                        $cols[$row['Field']] = true;
                    }
                }
                if (!empty($cols)) {
                    $cache[$table] = $cols;
                    if ($cacheFile) {
                        @file_put_contents($cacheFile, json_encode($cache, JSON_UNESCAPED_UNICODE), LOCK_EX);
                    }
                    return $cols;
                }
            }
        } catch (\Throwable $e) {
            // Fallback to known schema below
        }
    }
    if ($table === 'contacts') {
        $defaultCols = [
            'id', 'tenant_id', 'person_id', 'full_name', 'phone', 'mobile', 'phone2', 'zalo_phone',
            'email', 'gender', 'birthday', 'dob', 'citizen_id', 'passport', 'address', 'ward',
            'district', 'city', 'preferred_location', 'company_id', 'company', 'job_title',
            'department', 'industry', 'tax_code', 'customer_type', 'owner_id', 'collaborator_ids',
            'created_by', 'status', 'stage_id', 'pipeline_status', 'lead_status', 'temperature',
            'lead_temperature', 'lead_score', 'win_probability', 'ttl1_completed', 'next_action',
            'next_followup_date', 'expected_decision_date', 'nurture_reason', 'lost_reason',
            'project_id', 'program', 'expected_intake', 'admission_date', 'student_id',
            'study_status', 'source', 'campaign_id', 'platform', 'form_name', 'utm_source',
            'utm_campaign', 'utm_medium', 'utm_content', 'utm_term', 'tags', 'notes',
            'expected_revenue', 'budget', 'budget_range', 'last_contact', 'created_at',
            'updated_at', 'deleted_at',
            'domation_subscriber_id', 'marketing_status', 'engagement_score',
            'stats_email_sent', 'stats_email_opened', 'stats_email_clicked',
            'last_email_open_at', 'last_email_click_at', 'last_web_visit_at',
            'web_pageviews_count', 'max_scroll_depth', 'active_flow_count',
            'active_flow_names', 'active_voucher_code', 'survey_completed_count',
            'zalo_user_id', 'meta_psid'
        ];
        $cache[$table] = array_fill_keys($defaultCols, true);
        return $cache[$table];
    }
    $cache[$table] = [];
    return [];
}

/**
 * Build search WHERE clause & params for Contacts / Leads
 * 
 * Supports:
 * - Accented and unaccented Vietnamese names (multi-word, any order)
 * - Phone numbers: full number, tail numbers (1 vài số đuôi), with/without leading 0, +84, spaces, dots, dashes, parentheses
 * - Email: exact, partial username, tail numbers (e.g. 92 in haodiep92@gmail.com, 0584 in trangnguyen0584@gmail.com), fuzzy without dots/spaces
 * - Exact ID, person_id
 * - student_id, citizen_id, company, job_title
 */
function buildContactSearchClause(string $search, string $prefix = 'c.'): array {
    $search = trim($search);
    if ($search === '') {
        return ['clause' => '', 'params' => []];
    }

    $trimmedPrefix = trim($prefix);
    $a = $trimmedPrefix === '' ? '' : (str_ends_with($trimmedPrefix, '.') ? $trimmedPrefix : $trimmedPrefix . '.');
    $tableRef = rtrim($a, '.') ?: 'contacts';
    $conds = [];
    $params = [];

    // 1. Email check (case-insensitive, fuzzy/partial matching)
    // 1.1 Direct LIKE
    $conds[] = "LOWER({$a}email) LIKE LOWER(?)";
    $params[] = "%$search%";

    // 1.2 Normalized email without spaces, dots, hyphens, underscores (e.g. trangnguyen -> trang.nguyen@...)
    $cleanEmailQuery = str_replace([' ', '.', '-', '_'], '', strtolower($search));
    if (strlen($cleanEmailQuery) >= 2 && $cleanEmailQuery !== strtolower($search)) {
        $conds[] = "REPLACE(REPLACE(REPLACE(REPLACE(LOWER(IFNULL({$a}email, '')), '.', ''), '-', ''), '_', ''), ' ', '') LIKE ?";
        $params[] = "%$cleanEmailQuery%";
    }

    // 1.3 If user typed Vietnamese accents without spaces (e.g. "hảo diệp" or "trang nguyễn") -> match email "haodiep..." / "trangnguyen..."
    $unaccentedNoSpaces = removeVietnameseAccents($cleanEmailQuery);
    if (strlen($unaccentedNoSpaces) >= 3 && $unaccentedNoSpaces !== $cleanEmailQuery) {
        $conds[] = "REPLACE(REPLACE(REPLACE(REPLACE(LOWER(IFNULL({$a}email, '')), '.', ''), '-', ''), '_', ''), ' ', '') LIKE ?";
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
        $conds[] = "{$a}id = ?";
        $params[] = (int)$search;
        $conds[] = "{$a}person_id = ?";
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
            $conds[] = "{$a}phone LIKE ?";
            $params[] = "%$pv%";
            $conds[] = "{$a}mobile LIKE ?";
            $params[] = "%$pv%";
            $conds[] = "{$a}phone2 LIKE ?";
            $params[] = "%$pv%";
            $conds[] = "{$a}zalo_phone LIKE ?";
            $params[] = "%$pv%";

            // Normalized format (strips spaces, dots, hyphens, plus, parentheses)
            $conds[] = $cleanPhoneFn("{$a}phone") . " LIKE ?";
            $params[] = "%$pv%";
            $conds[] = $cleanPhoneFn("{$a}mobile") . " LIKE ?";
            $params[] = "%$pv%";
            $conds[] = $cleanPhoneFn("{$a}phone2") . " LIKE ?";
            $params[] = "%$pv%";
            $conds[] = $cleanPhoneFn("{$a}zalo_phone") . " LIKE ?";
            $params[] = "%$pv%";

            // Check contact_phones table
            $conds[] = "EXISTS (SELECT 1 FROM contact_phones cp WHERE cp.contact_id = {$tableRef}.id AND " . $cleanPhoneFn("cp.phone") . " LIKE ?)";
            $params[] = "%$pv%";

            // Check linked leads by person_id
            $conds[] = "({$tableRef}.person_id IS NOT NULL AND {$tableRef}.person_id > 0 AND EXISTS (SELECT 1 FROM leads l_p WHERE l_p.person_id = {$tableRef}.person_id AND " . $cleanPhoneFn("l_p.phone") . " LIKE ?))";
            $params[] = "%$pv%";
        }
    }

    // 4. Name & Extended Identity/B2B fields: full_name, student_id, citizen_id, company, job_title
    $conds[] = "{$a}full_name LIKE ?";
    $params[] = "%$search%";
    $conds[] = "{$a}student_id LIKE ?";
    $params[] = "%$search%";
    $conds[] = "{$a}citizen_id LIKE ?";
    $params[] = "%$search%";
    $conds[] = "{$a}company LIKE ?";
    $params[] = "%$search%";
    $conds[] = "{$a}job_title LIKE ?";
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
                    $wordRegexClauses[] = "{$a}full_name REGEXP ?";
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

/**
 * Parse a multi-value filter parameter (array or comma-separated string),
 * ignoring 'all' / 'tat_ca' sentinel tokens.
 */
function parseCrmMultiFilterValues($raw): array {
    if ($raw === null || $raw === '' || $raw === false) {
        return [];
    }
    $items = [];
    if (is_array($raw)) {
        foreach ($raw as $v) {
            if (is_scalar($v)) {
                foreach (explode(',', (string)$v) as $part) {
                    $t = trim($part);
                    if ($t !== '' && !in_array(strtolower($t), ['all', 'tat_ca', 'tất cả'], true)) {
                        $items[] = $t;
                    }
                }
            }
        }
    } elseif (is_scalar($raw)) {
        foreach (explode(',', (string)$raw) as $part) {
            $t = trim($part);
            if ($t !== '' && !in_array(strtolower($t), ['all', 'tat_ca', 'tất cả'], true)) {
                $items[] = $t;
            }
        }
    }
    return array_values(array_unique($items));
}

/**
 * Resolve fuzzy staff names or emails against `users` table (accent-insensitive) into user IDs.
 */
function resolveStaffUserIdsByFuzzyName(PDO $db, string $nameOrEmail): array {
    static $usersCache = null;
    if ($usersCache === null) {
        try {
            $stmt = $db->query("SELECT id, full_name, username, email FROM users");
            $usersCache = $stmt ? ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];
        } catch (\Throwable $e) {
            $usersCache = [];
        }
    }

    $needle = mb_strtolower(trim($nameOrEmail), 'UTF-8');
    $needleUnaccent = mb_strtolower(removeVietnameseAccents($needle), 'UTF-8');
    if ($needle === '') {
        return [];
    }

    $matchedIds = [];
    foreach ($usersCache as $u) {
        $uid = (int)($u['id'] ?? 0);
        if ($uid <= 0) continue;
        $fn = mb_strtolower((string)($u['full_name'] ?? ''), 'UTF-8');
        $fnUnaccent = mb_strtolower(removeVietnameseAccents($fn), 'UTF-8');
        $un = mb_strtolower((string)($u['username'] ?? ''), 'UTF-8');
        $em = mb_strtolower((string)($u['email'] ?? ''), 'UTF-8');

        if (
            ($fn !== '' && str_contains($fn, $needle))
            || ($fnUnaccent !== '' && $needleUnaccent !== '' && str_contains($fnUnaccent, $needleUnaccent))
            || ($un !== '' && str_contains($un, $needleUnaccent))
            || ($em !== '' && str_contains($em, $needle))
        ) {
            $matchedIds[] = $uid;
        }
    }
    return array_values(array_unique($matchedIds));
}

/**
 * Apply Multi-Stage filter (`stage_id`, `stages`, `stage_ids`, `stage_slug` + `stage_op` = 'in' | 'not_in').
 * Supports comma-separated stage IDs, 1-based ranges (e.g. `1-4`), stage slugs, or stage names (`pipeline_stages`).
 */
function applyCrmStageMultiFilter(PDO $db, string $alias, array $input, array &$where, array &$params): void {
    $trimmedAlias = trim($alias);
    $a = $trimmedAlias === '' ? '' : (str_ends_with($trimmedAlias, '.') ? $trimmedAlias : $trimmedAlias . '.');

    $stageTokens = array_values(array_unique(array_merge(
        parseCrmMultiFilterValues($input['stage_id'] ?? null),
        parseCrmMultiFilterValues($input['stages'] ?? null),
        parseCrmMultiFilterValues($input['stage_ids'] ?? null)
    )));
    $stageSlug = trim((string)($input['stage_slug'] ?? ''));
    if (empty($stageTokens) && $stageSlug !== '' && strtolower($stageSlug) !== 'all') {
        $stageTokens[] = $stageSlug;
    }
    if (empty($stageTokens)) {
        return;
    }

    $stageOp = strtolower(trim((string)($input['stage_op'] ?? 'in')));
    $stageIds = [];
    $orderIndexes = [];
    $stageNamesOrSlugs = [];
    $hasUncontactedToken = false;

    foreach ($stageTokens as $part) {
        $lowPart = strtolower(trim((string)$part));
        if (in_array($lowPart, ['not_contacted', 'uncontacted', 'chua_lien_he', 'no_activity'], true)) {
            $hasUncontactedToken = true;
            continue;
        }
        if (preg_match('/^(?:pipeline|pipieline|giai\s*đoạn|giai\s*doan|stage|bước|buoc)?\s*0*(\d{1,2})\s*-\s*0*(\d{1,2})$/iu', $part, $rm)) {
            $minR = (int)$rm[1];
            $maxR = (int)$rm[2];
            if ($minR > 0 && $maxR >= $minR && ($maxR - $minR) <= 50) {
                for ($r = $minR; $r <= $maxR; $r++) {
                    if ($r >= 1 && $r <= 14) {
                        $orderIndexes[] = $r - 1;
                    }
                    $stageIds[] = $r;
                }
            }
        } elseif (is_numeric($part) || preg_match('/^(?:pipeline|pipieline|giai\s*đoạn|giai\s*doan|stage|bước|buoc)\s*0*(\d{1,2})\b/iu', $part, $mStageNum) || preg_match('/^0*(\d{1,2})\s*[-–]/u', $part, $mStageNum)) {
            $n = is_numeric($part) ? (int)$part : (int)$mStageNum[1];
            if ($n >= 1 && $n <= 14) {
                $orderIndexes[] = $n - 1;
            }
            $stageIds[] = $n;
        } else {
            $stageNamesOrSlugs[] = $part;
        }
    }

    $stageIds = array_values(array_unique($stageIds));
    $orderIndexes = array_values(array_unique($orderIndexes));
    $stageNamesOrSlugs = array_values(array_unique($stageNamesOrSlugs));

    $uncontactedSql = "(
        ({$a}last_contact IS NULL OR {$a}last_contact = '')
        AND NOT EXISTS (SELECT 1 FROM activities act_nc1 WHERE act_nc1.contact_id = {$a}id AND act_nc1.deleted_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM activities act_nc2 WHERE act_nc2.related_type IN ('contact', 'lead') AND act_nc2.related_id = {$a}id AND act_nc2.deleted_at IS NULL)
        AND NOT EXISTS (
            SELECT 1 FROM notes n_nc
            WHERE n_nc.entity_type = 'contact' AND n_nc.entity_id = {$a}id
              AND n_nc.body NOT LIKE '[Tự động]%'
              AND n_nc.body NOT LIKE '[Phân bổ]%'
              AND n_nc.body NOT LIKE '[Giao data]%'
              AND n_nc.body NOT LIKE '[Auto]%'
              AND n_nc.body NOT LIKE '[Import]%'
              AND n_nc.body NOT LIKE '[Tái phân bổ]%'
              AND n_nc.body NOT LIKE 'Tái phân bổ%'
              AND n_nc.body NOT LIKE 'Giao lại%'
        )
    )";

    if ($stageOp === 'not_in') {
        $notConds = [];
        if ($hasUncontactedToken) {
            $notConds[] = "NOT {$uncontactedSql}";
        }
        if (!empty($stageIds)) {
            $ph = implode(',', array_fill(0, count($stageIds), '?'));
            $notConds[] = "({$a}stage_id NOT IN ($ph) OR {$a}stage_id IS NULL)";
            foreach ($stageIds as $sid) {
                $params[] = (int)$sid;
            }
            if (count($stageIds) === 1 && $stageSlug !== '') {
                $notConds[] = "({$a}pipeline_status IS NULL OR {$a}pipeline_status != ?)";
                $params[] = $stageSlug;
            }
        }
        if (!empty($orderIndexes)) {
            $phOrd = implode(',', array_fill(0, count($orderIndexes), '?'));
            $notConds[] = "({$a}stage_id IS NULL OR NOT EXISTS (SELECT 1 FROM pipeline_stages ps_ni WHERE ps_ni.id = {$a}stage_id AND ps_ni.order_index IN ($phOrd)))";
            foreach ($orderIndexes as $oi) {
                $params[] = (int)$oi;
            }
        }
        foreach ($stageNamesOrSlugs as $sn) {
            $notConds[] = "(({$a}pipeline_status IS NULL OR {$a}pipeline_status NOT LIKE ?) AND ({$a}stage_id IS NULL OR NOT EXISTS (SELECT 1 FROM pipeline_stages ps_ns WHERE ps_ns.id = {$a}stage_id AND (ps_ns.system_slug = ? OR ps_ns.name LIKE ?))))";
            $params[] = '%' . $sn . '%';
            $params[] = $sn;
            $params[] = '%' . $sn . '%';
        }
        if (!empty($notConds)) {
            $where[] = '(' . implode(' AND ', $notConds) . ')';
        }
    } else {
        $orConds = [];
        if ($hasUncontactedToken) {
            $orConds[] = $uncontactedSql;
        }
        if (!empty($stageIds)) {
            $ph = implode(',', array_fill(0, count($stageIds), '?'));
            $orConds[] = "{$a}stage_id IN ($ph)";
            foreach ($stageIds as $sid) {
                $params[] = (int)$sid;
            }
            if (count($stageIds) === 1) {
                $singleSid = (int)$stageIds[0];
                $orConds[] = "({$a}stage_id IS NULL AND {$a}pipeline_status = (SELECT ps_fb1.system_slug FROM pipeline_stages ps_fb1 WHERE ps_fb1.id = ? LIMIT 1))";
                $params[] = $singleSid;
                if ($stageSlug !== '') {
                    $orConds[] = "{$a}pipeline_status = ?";
                    $params[] = $stageSlug;
                    $orConds[] = "{$a}stage_id = (SELECT ps_fb2.id FROM pipeline_stages ps_fb2 WHERE ps_fb2.system_slug = ? LIMIT 1)";
                    $params[] = $stageSlug;
                }
            }
        }
        if (!empty($orderIndexes)) {
            $phOrd = implode(',', array_fill(0, count($orderIndexes), '?'));
            $orConds[] = "{$a}stage_id IN (SELECT ps_oi.id FROM pipeline_stages ps_oi WHERE ps_oi.order_index IN ($phOrd))";
            foreach ($orderIndexes as $oi) {
                $params[] = (int)$oi;
            }
        }
        foreach ($stageNamesOrSlugs as $sn) {
            $orConds[] = "({$a}pipeline_status LIKE ? OR {$a}status LIKE ? OR {$a}stage_id IN (SELECT ps_s.id FROM pipeline_stages ps_s WHERE ps_s.system_slug = ? OR ps_s.name LIKE ?))";
            $params[] = '%' . $sn . '%';
            $params[] = '%' . $sn . '%';
            $params[] = $sn;
            $params[] = '%' . $sn . '%';
        }
        if (!empty($orConds)) {
            $where[] = '(' . implode(' OR ', $orConds) . ')';
        }
    }
}

/**
 * Apply SARGable Date Range filter on extended `date_field`
 * (`created_at`, `updated_at`, `last_contact`, `admission_date`, `deposit_date`, `next_followup_date`, `expected_decision_date`, `birthday`)
 * plus `admission_from` / `admission_to`.
 */
function applyCrmDateRangeFilter(PDO $db, string $alias, array $input, array &$where, array &$params): void {
    $trimmedAlias = trim($alias);
    $a = $trimmedAlias === '' ? '' : (str_ends_with($trimmedAlias, '.') ? $trimmedAlias : $trimmedAlias . '.');
    $contactCols = getCrmTableColumnsCache($db, 'contacts');

    $dateField = strtolower(trim((string)($input['date_field'] ?? 'created_at')));
    $allowedDateFields = [
        'created_at', 'updated_at', 'last_contact', 'admission_date',
        'deposit_date', 'next_followup_date', 'expected_decision_date', 'birthday',
        'last_web_visit_at', 'last_email_open_at', 'last_email_click_at'
    ];
    if (!in_array($dateField, $allowedDateFields, true)) {
        $dateField = 'created_at';
    }

    $from = trim((string)($input['from'] ?? ($input['from_date'] ?? '')));
    $to   = trim((string)($input['to'] ?? ($input['to_date'] ?? '')));

    $fromDateOnly = $from !== '' ? substr($from, 0, 10) : '';
    $toDateOnly   = $to !== '' ? substr($to, 0, 10) : '';
    $fromDt       = $fromDateOnly !== '' ? (strlen($from) > 10 ? $from : $fromDateOnly . ' 00:00:00') : '';
    $toDt         = $toDateOnly !== '' ? (strlen($to) > 10 ? $to : $toDateOnly . ' 23:59:59') : '';

    if ($from !== '' || $to !== '') {
        if ($dateField === 'deposit_date') {
            if ($fromDt !== '' && $toDt !== '') {
                $where[] = "EXISTS (SELECT 1 FROM deposits dep_d WHERE dep_d.contact_id = {$a}id AND dep_d.status NOT IN ('cancelled', 'rejected') AND dep_d.created_at >= ? AND dep_d.created_at <= ?)";
                $params[] = $fromDt;
                $params[] = $toDt;
            } elseif ($fromDt !== '') {
                $where[] = "EXISTS (SELECT 1 FROM deposits dep_d WHERE dep_d.contact_id = {$a}id AND dep_d.status NOT IN ('cancelled', 'rejected') AND dep_d.created_at >= ?)";
                $params[] = $fromDt;
            } elseif ($toDt !== '') {
                $where[] = "EXISTS (SELECT 1 FROM deposits dep_d WHERE dep_d.contact_id = {$a}id AND dep_d.status NOT IN ('cancelled', 'rejected') AND dep_d.created_at <= ?)";
                $params[] = $toDt;
            }
        } elseif ($dateField === 'admission_date') {
            $col = isset($contactCols['admission_date']) ? 'admission_date' : 'created_at';
            if ($fromDateOnly !== '') {
                $fromMonthStart = substr($fromDateOnly, 0, 7) . '-01';
                $where[] = "({$a}{$col} >= ? OR (DAY({$a}{$col}) = 1 AND {$a}{$col} >= ?))";
                $params[] = $fromDateOnly;
                $params[] = $fromMonthStart;
            }
            if ($toDateOnly !== '') {
                $where[] = "{$a}{$col} <= ?";
                $params[] = $toDateOnly;
            }
        } elseif ($dateField === 'expected_decision_date') {
            $col = isset($contactCols[$dateField]) ? $dateField : 'created_at';
            if ($fromDateOnly !== '') {
                $where[] = "{$a}{$col} >= ?";
                $params[] = $fromDateOnly;
            }
            if ($toDateOnly !== '') {
                $where[] = "{$a}{$col} <= ?";
                $params[] = $toDateOnly;
            }
        } elseif ($dateField === 'birthday') {
            $bdayExpr = isset($contactCols['dob']) ? "COALESCE({$a}birthday, {$a}dob)" : "{$a}birthday";
            if ($fromDateOnly !== '') {
                $where[] = "{$bdayExpr} >= ?";
                $params[] = $fromDateOnly;
            }
            if ($toDateOnly !== '') {
                $where[] = "{$bdayExpr} <= ?";
                $params[] = $toDateOnly;
            }
        } else {
            $col = isset($contactCols[$dateField]) ? $dateField : 'created_at';
            if ($fromDt !== '') {
                $where[] = "{$a}{$col} >= ?";
                $params[] = $fromDt;
            }
            if ($toDt !== '') {
                $where[] = "{$a}{$col} <= ?";
                $params[] = $toDt;
            }
        }
    }

    $admissionFrom = trim((string)($input['admission_from'] ?? ''));
    $admissionTo   = trim((string)($input['admission_to'] ?? ''));
    if ($admissionFrom !== '') {
        $admFromDate = substr($admissionFrom, 0, 10);
        $admFromMonthStart = substr($admFromDate, 0, 7) . '-01';
        $where[] = "({$a}admission_date >= ? OR (DAY({$a}admission_date) = 1 AND {$a}admission_date >= ?))";
        $params[] = $admFromDate;
        $params[] = $admFromMonthStart;
    }
    if ($admissionTo !== '') {
        $where[] = "{$a}admission_date <= ?";
        $params[] = substr($admissionTo, 0, 10);
    }
}

/**
 * Build word-boundary SQL match clause for a program/project name column so that
 * searching "MBA" or "MBA ST" or "MBA HQ" NEVER false-matches "EMBA" / "EMBA ST" / "EMBA HQ".
 */
function buildCrmProgramColumnMatchSql(string $colExpr, string $token, array &$params): string {
    $pt = trim($token);
    if ($pt === '') {
        return '1=0';
    }
    $ptLower = mb_strtolower($pt, 'UTF-8');
    $regexPattern = '(^|[^a-z0-9])' . preg_quote($ptLower, '/') . '([^a-z0-9]|$)';
    $sql = "(LOWER(TRIM(COALESCE({$colExpr}, ''))) = ? OR LOWER(COALESCE({$colExpr}, '')) REGEXP ?)";
    $params[] = $ptLower;
    $params[] = $regexPattern;

    if (stripos($pt, 'mba') !== false && stripos($pt, 'emba') === false) {
        $sql = "({$sql} AND LOWER(COALESCE({$colExpr}, '')) NOT LIKE '%emba%')";
    }
    return $sql;
}

/**
 * Shared, reusable Multi-Tier CRM Filter Engine for Contacts / Leads / Students.
 * Supports:
 * 1. Multi-Owner (`owner_id`/`owners`), Collaborator (`collaborator_id`/`collaborators`), Creator (`created_by`), Team (`team_id`/`teams`)
 * 2. Multi-Stage (`stage_id`/`stages` + `stage_op` = 'in'|'not_in')
 * 3. Interaction Cadence (`stale_days`, `interacted_within_days`, `interaction_type`, `interaction_status`, `min_call_count`, `max_call_count`, `min_interaction_count`, `max_interaction_count`, `note_keyword`)
 * 4. Demographics & B2B (`gender`, `cities`/`city`/`branches_or_cities`, `districts`/`district`, `age_min`, `age_max`, `birth_year_from`, `birth_year_to`, `birthday_month`, `job_titles`, `companies`, `industries`, `departments`, `education_or_degree`)
 * 5. Academic, Marketing, Lead Quality & Financial (`programs`/`program`/`project_id`, `campaign_id`/`campaigns`/`campaign_or_utm`, `sources`/`source`, `tags`/`tag`+`tag_op`, `temperature`, `score_min`/`score_max`, `study_status`, `student_code`, `expected_intake`, `major`, `missing_document`, `financial_filter`/`deposit_status`, `min_deposit`/`max_deposit`, `min_expected_revenue`/`max_expected_revenue`)
 * 6. Dynamic Schema Rule Builder (`custom_rules` + `custom_rules_logic` = 'AND'|'OR')
 */
function applyCrmStudyStatusFilter(PDO $db, string $alias, array $input, array &$where, array &$params): void {
    $trimmedAlias = trim($alias);
    $a = $trimmedAlias === '' ? '' : (str_ends_with($trimmedAlias, '.') ? $trimmedAlias : $trimmedAlias . '.');
    $contactCols = getCrmTableColumnsCache($db, 'contacts');
    $studyTokens = array_values(array_unique(array_merge(
        parseCrmMultiFilterValues($input['study_status'] ?? null),
        parseCrmMultiFilterValues($input['study_statuses'] ?? null)
    )));
    if (!empty($studyTokens) && isset($contactCols['study_status'])) {
        $studyOrClauses = [];
        $nonStudyingStatuses = [];
        $includesStudying = false;
        foreach ($studyTokens as $stTok) {
            $sLow = mb_strtolower(trim($stTok), 'UTF-8');
            if (in_array($sLow, ['enrolled', 'moi_nhap_hoc', 'nhap_hoc', 'nhập học'], true)) {
                $nonStudyingStatuses = array_merge($nonStudyingStatuses, ['enrolled', 'moi_nhap_hoc', 'nhap_hoc', 'nhập học']);
            } elseif (in_array($sLow, ['training', 'tranning', 'dao_tao', 'đào tạo'], true)) {
                $nonStudyingStatuses = array_merge($nonStudyingStatuses, ['training', 'tranning', 'dao_tao', 'đào tạo']);
            } elseif (in_array($sLow, ['studying', 'dang_hoc', 'đang học', 'active'], true)) {
                $includesStudying = true;
            } elseif (in_array($sLow, ['postpone', 'postponed', 'reserved', 'deferred', 'bao_luu', 'bảo lưu', 'tam_hoan', 'tạm hoãn'], true)) {
                $nonStudyingStatuses = array_merge($nonStudyingStatuses, ['postpone', 'postponed', 'reserved', 'deferred', 'bao_luu', 'bảo lưu', 'tam_hoan', 'tạm hoãn']);
            } elseif (in_array($sLow, ['withdraw', 'withdrawn', 'suspended', 'tam_ngung', 'tạm ngưng', 'pause', 'dropped', 'bo_hoc', 'bỏ học', 'nghi_hoc', 'nghỉ học', 'thoi_hoc', 'thôi học'], true)) {
                $nonStudyingStatuses = array_merge($nonStudyingStatuses, ['withdraw', 'withdrawn', 'suspended', 'tam_ngung', 'tạm ngưng', 'pause', 'dropped', 'bo_hoc', 'bỏ học', 'nghi_hoc', 'nghỉ học', 'thoi_hoc', 'thôi học']);
            } elseif (in_array($sLow, ['completed', 'hoan_thanh', 'hoàn thành'], true)) {
                $nonStudyingStatuses = array_merge($nonStudyingStatuses, ['completed', 'hoan_thanh', 'hoàn thành']);
            } elseif (in_array($sLow, ['graduated', 'tot_nghiep', 'tốt nghiệp'], true)) {
                $nonStudyingStatuses = array_merge($nonStudyingStatuses, ['graduated', 'tot_nghiep', 'tốt nghiệp']);
            } else {
                $nonStudyingStatuses[] = $sLow;
            }
        }
        if ($includesStudying) {
            // Note: contacts.study_status has DEFAULT 'studying', so require actual enrollment/student indicators for 'studying'
            $studyOrClauses[] = "(LOWER(TRIM(COALESCE({$a}study_status, 'studying'))) IN ('studying', 'dang_hoc', 'đang học', '') AND ({$a}status = 'customer' OR {$a}stage_id = 44 OR {$a}pipeline_status IN ('enrolled', 'hoc_vien', 'won') OR ({$a}student_id IS NOT NULL AND TRIM({$a}student_id) != '') OR {$a}admission_date IS NOT NULL))";
        }
        $nonStudyingStatuses = array_values(array_unique($nonStudyingStatuses));
        if (!empty($nonStudyingStatuses)) {
            $phSt = implode(',', array_fill(0, count($nonStudyingStatuses), '?'));
            $studyOrClauses[] = "LOWER(TRIM(COALESCE({$a}study_status, ''))) IN ($phSt)";
            foreach ($nonStudyingStatuses as $es) {
                $params[] = $es;
            }
        }
        if (!empty($studyOrClauses)) {
            $where[] = '(' . implode(' OR ', $studyOrClauses) . ')';
        }
    }
}

function applyCrmAdvancedMultiTierFilters(PDO $db, string $alias, array $input, array &$where, array &$params): void {
    $trimmedAlias = trim($alias);
    $a = $trimmedAlias === '' ? '' : (str_ends_with($trimmedAlias, '.') ? $trimmedAlias : $trimmedAlias . '.');
    $contactCols = getCrmTableColumnsCache($db, 'contacts');
    $hasCollabCol = isset($contactCols['collaborator_ids']);

    // =========================================================================
    // 1. MULTI-OWNER, COLLABORATOR, CREATOR & TEAM
    // =========================================================================
    $ownerTokens = array_values(array_unique(array_merge(
        parseCrmMultiFilterValues($input['owner_id'] ?? null),
        parseCrmMultiFilterValues($input['owners'] ?? null),
        parseCrmMultiFilterValues($input['assigned_to'] ?? null)
    )));
    if (!empty($input['unassigned']) && in_array(strtolower((string)$input['unassigned']), ['1', 'true', 'yes'], true)) {
        $ownerTokens[] = 'unassigned';
    }

    if (!empty($ownerTokens)) {
        $numericOwnerIds = [];
        $includeUnassigned = false;
        $fuzzyFallbackTokens = [];

        foreach ($ownerTokens as $tok) {
            $lowTok = strtolower(trim($tok));
            if (in_array($lowTok, ['unassigned', 'none', 'null', 'chua_phan_bo', '0'], true)) {
                $includeUnassigned = true;
            } elseif (is_numeric($tok) && (int)$tok > 0) {
                $numericOwnerIds[] = (int)$tok;
            } else {
                $resolvedIds = resolveStaffUserIdsByFuzzyName($db, $tok);
                if (!empty($resolvedIds)) {
                    foreach ($resolvedIds as $rid) {
                        $numericOwnerIds[] = (int)$rid;
                    }
                } else {
                    $fuzzyFallbackTokens[] = $tok;
                }
            }
        }

        if ($includeUnassigned) {
            // Remove strict `owner_id IS NOT NULL` base guard when explicitly filtering for unassigned leads
            $where = array_values(array_filter($where, function ($w) use ($a) {
                return trim($w) !== "{$a}owner_id IS NOT NULL";
            }));
        }

        $numericOwnerIds = array_values(array_unique($numericOwnerIds));
        $ownerOrClauses = [];

        if (!empty($numericOwnerIds)) {
            $phOwners = implode(',', array_fill(0, count($numericOwnerIds), '?'));
            $ownerOrClauses[] = "{$a}owner_id IN ($phOwners)";
            foreach ($numericOwnerIds as $oid) {
                $params[] = (int)$oid;
            }
            if ($hasCollabCol) {
                foreach ($numericOwnerIds as $oid) {
                    $ownerOrClauses[] = "FIND_IN_SET(?, COALESCE({$a}collaborator_ids, '')) > 0";
                    $params[] = (string)(int)$oid;
                }
            }
        }

        foreach ($fuzzyFallbackTokens as $fTok) {
            $regexPat = buildVietnameseWordRegex($fTok);
            $ownMatchSql = $hasCollabCol
                ? "(u_own.id = {$a}owner_id OR FIND_IN_SET(u_own.id, COALESCE({$a}collaborator_ids, '')) > 0)"
                : "u_own.id = {$a}owner_id";
            if ($regexPat !== '') {
                $ownerOrClauses[] = "EXISTS (SELECT 1 FROM users u_own WHERE {$ownMatchSql} AND (u_own.full_name REGEXP ? OR u_own.email LIKE ?))";
                $params[] = $regexPat;
                $params[] = '%' . $fTok . '%';
            } else {
                $ownerOrClauses[] = "EXISTS (SELECT 1 FROM users u_own WHERE {$ownMatchSql} AND (u_own.full_name LIKE ? OR u_own.email LIKE ?))";
                $params[] = '%' . $fTok . '%';
                $params[] = '%' . $fTok . '%';
            }
        }

        if ($includeUnassigned) {
            $ownerOrClauses[] = "({$a}owner_id IS NULL OR {$a}owner_id = 0)";
        }

        if (!empty($ownerOrClauses)) {
            $where[] = '(' . implode(' OR ', $ownerOrClauses) . ')';
        }
    }

    // Collaborator filter (`collaborator_id` / `collaborators`)
    $collabTokens = array_values(array_unique(array_merge(
        parseCrmMultiFilterValues($input['collaborator_id'] ?? null),
        parseCrmMultiFilterValues($input['collaborators'] ?? null)
    )));
    if (!empty($collabTokens) && $hasCollabCol) {
        $collabIds = [];
        foreach ($collabTokens as $ct) {
            if (is_numeric($ct) && (int)$ct > 0) {
                $collabIds[] = (int)$ct;
            } else {
                foreach (resolveStaffUserIdsByFuzzyName($db, $ct) as $rid) {
                    $collabIds[] = (int)$rid;
                }
            }
        }
        $collabIds = array_values(array_unique($collabIds));
        if (!empty($collabIds)) {
            $collabOrs = [];
            foreach ($collabIds as $cid) {
                $collabOrs[] = "FIND_IN_SET(?, COALESCE({$a}collaborator_ids, '')) > 0";
                $params[] = (string)(int)$cid;
            }
            $where[] = '(' . implode(' OR ', $collabOrs) . ')';
        }
    }

    // Creator filter (`created_by`)
    $creatorTokens = parseCrmMultiFilterValues($input['created_by'] ?? null);
    if (!empty($creatorTokens)) {
        $creatorIds = [];
        foreach ($creatorTokens as $crt) {
            if (is_numeric($crt) && (int)$crt > 0) {
                $creatorIds[] = (int)$crt;
            } else {
                foreach (resolveStaffUserIdsByFuzzyName($db, $crt) as $rid) {
                    $creatorIds[] = (int)$rid;
                }
            }
        }
        $creatorIds = array_values(array_unique($creatorIds));
        if (!empty($creatorIds)) {
            $phCr = implode(',', array_fill(0, count($creatorIds), '?'));
            $where[] = "{$a}created_by IN ($phCr)";
            foreach ($creatorIds as $crId) {
                $params[] = (int)$crId;
            }
        }
    }

    // Team filter (`team_id` / `teams`)
    // Exclude non-sales department teams (1=HCNS, 2=Kế toán, 3=Marketing, 5=Học vụ - học thuật, 99983=Ban Giám đốc)
    // that do not own CRM contacts so Academic/Accountant/HR/Marketing users never get 0 results.
    $nonSalesDeptTeamIds = [1, 2, 3, 5, 99983];
    $teamTokens = array_values(array_unique(array_merge(
        parseCrmMultiFilterValues($input['team_id'] ?? null),
        parseCrmMultiFilterValues($input['teams'] ?? null)
    )));
    if (!empty($teamTokens)) {
        $teamIds = [];
        $teamNames = [];
        foreach ($teamTokens as $tt) {
            if (is_numeric($tt) && (int)$tt > 0) {
                $tidInt = (int)$tt;
                if (!in_array($tidInt, $nonSalesDeptTeamIds, true)) {
                    $teamIds[] = $tidInt;
                }
            } else {
                $tLower = mb_strtolower(trim((string)$tt), 'UTF-8');
                if (
                    strpos($tLower, 'học vụ') === false &&
                    strpos($tLower, 'học thuật') === false &&
                    strpos($tLower, 'kế toán') === false &&
                    strpos($tLower, 'nhân sự') === false &&
                    strpos($tLower, 'marketing') === false &&
                    strpos($tLower, 'giám đốc') === false
                ) {
                    $teamNames[] = $tt;
                }
            }
        }
        $tmSubConds = [];
        if (!empty($teamIds)) {
            $phTm = implode(',', array_fill(0, count($teamIds), '?'));
            $tmSubConds[] = "u_tm.team_id IN ($phTm)";
            foreach ($teamIds as $tIdVal) {
                $params[] = (int)$tIdVal;
            }
        }
        foreach ($teamNames as $tName) {
            $tmSubConds[] = "tm.name LIKE ?";
            $params[] = '%' . $tName . '%';
        }
        if (!empty($tmSubConds)) {
            $where[] = "{$a}owner_id IN (SELECT u_tm.id FROM users u_tm LEFT JOIN teams tm ON u_tm.team_id = tm.id WHERE u_tm.tenant_id = {$a}tenant_id AND (" . implode(' OR ', $tmSubConds) . "))";
        }
    }

    // =========================================================================
    // 2. MULTI-STAGE (`stage_id` / `stages` + `stage_op` = 'in' | 'not_in')
    // =========================================================================
    if (empty($input['_defer_stage_filter'])) {
        applyCrmStageMultiFilter($db, $alias, $input, $where, $params);
    }

    // =========================================================================
    // 3. INTERACTION CADENCE & ACTIVITY / NOTE FILTERS
    // =========================================================================
    $staleDays = (int)($input['stale_days'] ?? ($input['inactive_days'] ?? 0));
    if ($staleDays > 0) {
        $where[] = "(
            {$a}created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
            AND ({$a}last_contact IS NULL OR {$a}last_contact < DATE_SUB(NOW(), INTERVAL ? DAY))
            AND NOT EXISTS (
                SELECT 1 FROM activities act_st1
                WHERE act_st1.contact_id = {$a}id AND act_st1.deleted_at IS NULL
                  AND act_st1.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            )
            AND NOT EXISTS (
                SELECT 1 FROM activities act_st2
                WHERE act_st2.related_type IN ('contact', 'lead') AND act_st2.related_id = {$a}id AND act_st2.deleted_at IS NULL
                  AND act_st2.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            )
            AND NOT EXISTS (
                SELECT 1 FROM notes n_st
                WHERE n_st.entity_type = 'contact' AND n_st.entity_id = {$a}id
                  AND n_st.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                  AND n_st.body NOT LIKE '[Tự động]%'
                  AND n_st.body NOT LIKE '[Phân bổ]%'
                  AND n_st.body NOT LIKE '[Giao data]%'
                  AND n_st.body NOT LIKE '[Auto]%'
                  AND n_st.body NOT LIKE '[Import]%'
                  AND n_st.body NOT LIKE '[Tái phân bổ]%'
            )
        )";
        array_push($params, $staleDays, $staleDays, $staleDays, $staleDays, $staleDays);
    }

    $withinDays = (int)($input['interacted_within_days'] ?? ($input['contacted_in_last_days'] ?? 0));
    $intTypes = array_map('strtolower', parseCrmMultiFilterValues($input['interaction_type'] ?? ($input['activity_type'] ?? null)));

    if ($withinDays > 0) {
        if (!empty($intTypes) && !in_array('all', $intTypes, true)) {
            $iwOrs = [];
            $actFilterTypes = array_values(array_unique($intTypes));
            if (!empty($actFilterTypes)) {
                $phActTypes = implode(',', array_fill(0, count($actFilterTypes), '?'));
                $iwOrs[] = "EXISTS (
                    SELECT 1 FROM activities act_iw1
                    WHERE act_iw1.contact_id = {$a}id AND act_iw1.deleted_at IS NULL
                      AND act_iw1.type IN ($phActTypes)
                      AND act_iw1.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                )";
                foreach ($actFilterTypes as $at) {
                    $params[] = $at;
                }
                $params[] = $withinDays;

                $iwOrs[] = "EXISTS (
                    SELECT 1 FROM activities act_iw2
                    WHERE act_iw2.related_type IN ('contact', 'lead') AND act_iw2.related_id = {$a}id AND act_iw2.deleted_at IS NULL
                      AND act_iw2.type IN ($phActTypes)
                      AND act_iw2.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                )";
                foreach ($actFilterTypes as $at) {
                    $params[] = $at;
                }
                $params[] = $withinDays;
            }
            if (array_intersect(['note', 'zalo', 'chat'], $intTypes)) {
                $iwOrs[] = "EXISTS (
                    SELECT 1 FROM notes n_iw
                    WHERE n_iw.entity_type = 'contact' AND n_iw.entity_id = {$a}id
                      AND n_iw.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                      AND n_iw.body NOT LIKE '[Tự động]%'
                      AND n_iw.body NOT LIKE '[Phân bổ]%'
                      AND n_iw.body NOT LIKE '[Giao data]%'
                      AND n_iw.body NOT LIKE '[Auto]%'
                      AND n_iw.body NOT LIKE '[Import]%'
                      AND n_iw.body NOT LIKE '[Tái phân bổ]%'
                )";
                $params[] = $withinDays;
            }
            if (!empty($iwOrs)) {
                $where[] = '(' . implode(' OR ', $iwOrs) . ')';
            }
        } else {
            $where[] = "(
                {$a}last_contact >= DATE_SUB(NOW(), INTERVAL ? DAY)
                OR EXISTS (
                    SELECT 1 FROM activities act_iw1
                    WHERE act_iw1.contact_id = {$a}id AND act_iw1.deleted_at IS NULL
                      AND act_iw1.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                )
                OR EXISTS (
                    SELECT 1 FROM activities act_iw2
                    WHERE act_iw2.related_type IN ('contact', 'lead') AND act_iw2.related_id = {$a}id AND act_iw2.deleted_at IS NULL
                      AND act_iw2.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                )
                OR EXISTS (
                    SELECT 1 FROM notes n_iw
                    WHERE n_iw.entity_type = 'contact' AND n_iw.entity_id = {$a}id
                      AND n_iw.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                      AND n_iw.body NOT LIKE '[Tự động]%'
                      AND n_iw.body NOT LIKE '[Phân bổ]%'
                      AND n_iw.body NOT LIKE '[Giao data]%'
                      AND n_iw.body NOT LIKE '[Auto]%'
                      AND n_iw.body NOT LIKE '[Import]%'
                      AND n_iw.body NOT LIKE '[Tái phân bổ]%'
                )
            )";
            array_push($params, $withinDays, $withinDays, $withinDays, $withinDays);
        }
    } elseif (!empty($intTypes) && !in_array('all', $intTypes, true)) {
        $itOrs = [];
        $standardActTypes = array_values(array_diff($intTypes, ['overdue_task', 'upcoming_task']));
        if (!empty($standardActTypes)) {
            $phActTypes = implode(',', array_fill(0, count($standardActTypes), '?'));
            $itOrs[] = "EXISTS (
                SELECT 1 FROM activities act_it1
                WHERE act_it1.contact_id = {$a}id AND act_it1.deleted_at IS NULL
                  AND act_it1.type IN ($phActTypes)
            )";
            foreach ($standardActTypes as $at) {
                $params[] = $at;
            }
            $itOrs[] = "EXISTS (
                SELECT 1 FROM activities act_it2
                WHERE act_it2.related_type IN ('contact', 'lead') AND act_it2.related_id = {$a}id AND act_it2.deleted_at IS NULL
                  AND act_it2.type IN ($phActTypes)
            )";
            foreach ($standardActTypes as $at) {
                $params[] = $at;
            }
        }
        if (in_array('overdue_task', $intTypes, true)) {
            $itOrs[] = "EXISTS (
                SELECT 1 FROM activities act_ot
                WHERE (act_ot.contact_id = {$a}id OR (act_ot.related_type IN ('contact', 'lead') AND act_ot.related_id = {$a}id))
                  AND act_ot.deleted_at IS NULL
                  AND act_ot.type = 'task'
                  AND COALESCE(act_ot.status, 'pending') NOT IN ('completed', 'done', 'cancelled')
                  AND COALESCE(act_ot.due_date, act_ot.created_at) < NOW()
            )";
        }
        if (in_array('upcoming_task', $intTypes, true)) {
            $itOrs[] = "EXISTS (
                SELECT 1 FROM activities act_ut
                WHERE (act_ut.contact_id = {$a}id OR (act_ut.related_type IN ('contact', 'lead') AND act_ut.related_id = {$a}id))
                  AND act_ut.deleted_at IS NULL
                  AND act_ut.type = 'task'
                  AND COALESCE(act_ut.status, 'pending') NOT IN ('completed', 'done', 'cancelled')
                  AND act_ut.due_date IS NOT NULL
                  AND act_ut.due_date >= NOW()
            )";
        }
        if (array_intersect(['note', 'zalo', 'chat'], $intTypes)) {
            $itOrs[] = "EXISTS (
                SELECT 1 FROM notes n_it
                WHERE n_it.entity_type = 'contact' AND n_it.entity_id = {$a}id
                  AND n_it.body NOT LIKE '[Tự động]%'
                  AND n_it.body NOT LIKE '[Phân bổ]%'
                  AND n_it.body NOT LIKE '[Giao data]%'
                  AND n_it.body NOT LIKE '[Auto]%'
                  AND n_it.body NOT LIKE '[Import]%'
                  AND n_it.body NOT LIKE '[Tái phân bổ]%'
            )";
        }
        if (!empty($itOrs)) {
            $where[] = '(' . implode(' OR ', $itOrs) . ')';
        }
    }

    // Interaction status (`interaction_status` / `activity_status` / `uncontacted`)
    $intStatus = strtolower(trim((string)($input['interaction_status'] ?? ($input['activity_status'] ?? ''))));
    if ($intStatus === '' && !empty($input['uncontacted']) && in_array(strtolower((string)$input['uncontacted']), ['1', 'true', 'yes'], true)) {
        $intStatus = 'uncontacted';
    }
    if (in_array($intStatus, ['uncontacted', 'no_activity', 'not_contacted', 'never'], true)) {
        $where[] = "(
            ({$a}last_contact IS NULL OR {$a}last_contact = '')
            AND NOT EXISTS (
                SELECT 1 FROM activities act_un1
                WHERE act_un1.contact_id = {$a}id AND act_un1.deleted_at IS NULL
            )
            AND NOT EXISTS (
                SELECT 1 FROM activities act_un2
                WHERE act_un2.related_type IN ('contact', 'lead') AND act_un2.related_id = {$a}id AND act_un2.deleted_at IS NULL
            )
            AND NOT EXISTS (
                SELECT 1 FROM notes n_un
                WHERE n_un.entity_type = 'contact' AND n_un.entity_id = {$a}id
                  AND n_un.body NOT LIKE '[Tự động]%'
                  AND n_un.body NOT LIKE '[Phân bổ]%'
                  AND n_un.body NOT LIKE '[Giao data]%'
                  AND n_un.body NOT LIKE '[Auto]%'
                  AND n_un.body NOT LIKE '[Import]%'
                  AND n_un.body NOT LIKE '[Tái phân bổ]%'
                  AND n_un.body NOT LIKE 'Tái phân bổ%'
                  AND n_un.body NOT LIKE 'Giao lại%'
            )
        )";
    } elseif (in_array($intStatus, ['contacted', 'has_activity', 'interacted'], true)) {
        $where[] = "(
            ({$a}last_contact IS NOT NULL AND {$a}last_contact != '')
            OR EXISTS (
                SELECT 1 FROM activities act_ca1
                WHERE act_ca1.contact_id = {$a}id AND act_ca1.deleted_at IS NULL
            )
            OR EXISTS (
                SELECT 1 FROM activities act_ca2
                WHERE act_ca2.related_type IN ('contact', 'lead') AND act_ca2.related_id = {$a}id AND act_ca2.deleted_at IS NULL
            )
            OR EXISTS (
                SELECT 1 FROM notes n_ca
                WHERE n_ca.entity_type = 'contact' AND n_ca.entity_id = {$a}id
                  AND n_ca.body NOT LIKE '[Tự động]%'
                  AND n_ca.body NOT LIKE '[Phân bổ]%'
                  AND n_ca.body NOT LIKE '[Giao data]%'
                  AND n_ca.body NOT LIKE '[Auto]%'
                  AND n_ca.body NOT LIKE '[Import]%'
                  AND n_ca.body NOT LIKE '[Tái phân bổ]%'
                  AND n_ca.body NOT LIKE 'Tái phân bổ%'
                  AND n_ca.body NOT LIKE 'Giao lại%'
            )
        )";
    } elseif ($intStatus === 'has_call_recently') {
        $where[] = "(
            EXISTS (
                SELECT 1 FROM activities act_c1
                WHERE act_c1.contact_id = {$a}id AND act_c1.type = 'call' AND act_c1.deleted_at IS NULL
                  AND act_c1.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            )
            OR EXISTS (
                SELECT 1 FROM activities act_c2
                WHERE act_c2.related_type IN ('contact', 'lead') AND act_c2.related_id = {$a}id AND act_c2.type = 'call' AND act_c2.deleted_at IS NULL
                  AND act_c2.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            )
        )";
    }

    // Call & total interaction count bounds
    if (isset($input['min_call_count']) && $input['min_call_count'] !== '' && is_numeric($input['min_call_count'])) {
        $where[] = "(SELECT COUNT(*) FROM activities act_cc WHERE act_cc.contact_id = {$a}id AND act_cc.type = 'call' AND act_cc.deleted_at IS NULL) >= ?";
        $params[] = (int)$input['min_call_count'];
    }
    if (isset($input['max_call_count']) && $input['max_call_count'] !== '' && is_numeric($input['max_call_count'])) {
        $where[] = "(SELECT COUNT(*) FROM activities act_cc WHERE act_cc.contact_id = {$a}id AND act_cc.type = 'call' AND act_cc.deleted_at IS NULL) <= ?";
        $params[] = (int)$input['max_call_count'];
    }
    if (isset($input['min_interaction_count']) && $input['min_interaction_count'] !== '' && is_numeric($input['min_interaction_count'])) {
        $where[] = "((SELECT COUNT(*) FROM activities act_ic WHERE act_ic.contact_id = {$a}id AND act_ic.deleted_at IS NULL) + (SELECT COUNT(*) FROM notes n_ic WHERE n_ic.entity_type = 'contact' AND n_ic.entity_id = {$a}id AND n_ic.body NOT LIKE '[Tự động]%' AND n_ic.body NOT LIKE '[Phân bổ]%')) >= ?";
        $params[] = (int)$input['min_interaction_count'];
    }
    if (isset($input['max_interaction_count']) && $input['max_interaction_count'] !== '' && is_numeric($input['max_interaction_count'])) {
        $where[] = "((SELECT COUNT(*) FROM activities act_ic WHERE act_ic.contact_id = {$a}id AND act_ic.deleted_at IS NULL) + (SELECT COUNT(*) FROM notes n_ic WHERE n_ic.entity_type = 'contact' AND n_ic.entity_id = {$a}id AND n_ic.body NOT LIKE '[Tự động]%' AND n_ic.body NOT LIKE '[Phân bổ]%')) <= ?";
        $params[] = (int)$input['max_interaction_count'];
    }

    // Note / Activity / Reason keyword (`note_keyword`)
    $noteKeywords = parseCrmMultiFilterValues($input['note_keyword'] ?? null);
    if (!empty($noteKeywords)) {
        $actCols = getCrmTableColumnsCache($db, 'activities');
        $hasNurtureReason = isset($contactCols['nurture_reason']);
        $hasActDesc = isset($actCols['description']);
        $hasActBody = isset($actCols['body']);
        $nkOrs = [];
        foreach ($noteKeywords as $nkw) {
            $kwLike = '%' . $nkw . '%';
            $subParts = [
                "{$a}notes LIKE ?",
                "{$a}lost_reason LIKE ?"
            ];
            $params[] = $kwLike;
            $params[] = $kwLike;
            if ($hasNurtureReason) {
                $subParts[] = "{$a}nurture_reason LIKE ?";
                $params[] = $kwLike;
            }
            $subParts[] = "EXISTS (SELECT 1 FROM notes n_kw WHERE n_kw.entity_type = 'contact' AND n_kw.entity_id = {$a}id AND n_kw.body LIKE ?)";
            $params[] = $kwLike;

            $actTextConds = ["act_kw.subject LIKE ?"];
            $params[] = $kwLike;
            if ($hasActDesc) {
                $actTextConds[] = "act_kw.description LIKE ?";
                $params[] = $kwLike;
            }
            if ($hasActBody) {
                $actTextConds[] = "act_kw.body LIKE ?";
                $params[] = $kwLike;
            }
            $subParts[] = "EXISTS (SELECT 1 FROM activities act_kw WHERE (act_kw.contact_id = {$a}id OR (act_kw.related_type IN ('contact', 'lead') AND act_kw.related_id = {$a}id)) AND act_kw.deleted_at IS NULL AND (" . implode(' OR ', $actTextConds) . "))";
            $nkOrs[] = '(' . implode(' OR ', $subParts) . ')';
        }
        $where[] = '(' . implode(' OR ', $nkOrs) . ')';
    }

    // =========================================================================
    // 4. DEMOGRAPHICS & B2B FILTERS
    // =========================================================================
    // Gender
    $genderTokens = parseCrmMultiFilterValues($input['gender'] ?? null);
    if (!empty($genderTokens)) {
        $genderOrs = [];
        foreach ($genderTokens as $gt) {
            $gLow = mb_strtolower(trim($gt), 'UTF-8');
            if (in_array($gLow, ['male', 'nam', '1', 'trai', 'boy', 'm'], true)) {
                $genderOrs[] = "LOWER(TRIM(COALESCE({$a}gender, ''))) IN ('male', 'nam', '1', 'trai', 'boy')";
            } elseif (in_array($gLow, ['female', 'nu', 'nữ', '0', 'gai', 'girl', 'f'], true)) {
                $genderOrs[] = "(LOWER(TRIM(COALESCE({$a}gender, ''))) IN ('female', 'nu', 'nữ', '0', 'gai', 'girl') OR {$a}gender = 'Nữ')";
            } elseif (in_array($gLow, ['other', 'khac', 'khác', '2'], true)) {
                $genderOrs[] = "LOWER(TRIM(COALESCE({$a}gender, ''))) IN ('other', 'khac', 'khác', '2')";
            } elseif (in_array($gLow, ['unknown', 'empty', 'null', 'chua_ro', 'none'], true)) {
                $genderOrs[] = "({$a}gender IS NULL OR TRIM({$a}gender) = '')";
            } else {
                $genderOrs[] = "{$a}gender = ?";
                $params[] = $gt;
            }
        }
        if (!empty($genderOrs)) {
            $where[] = '(' . implode(' OR ', array_unique($genderOrs)) . ')';
        }
    }

    // Age & Birth Year & Birthday Month (SARGable on COALESCE(birthday, dob))
    $bdayColExpr = isset($contactCols['dob']) ? "COALESCE({$a}birthday, {$a}dob)" : "{$a}birthday";
    if (isset($input['age_min']) && $input['age_min'] !== '' && is_numeric($input['age_min'])) {
        $ageMin = max(0, (int)$input['age_min']);
        if ($ageMin > 0) {
            $where[] = "({$bdayColExpr} IS NOT NULL AND {$bdayColExpr} > '1900-01-01' AND {$bdayColExpr} <= DATE_SUB(CURDATE(), INTERVAL ? YEAR))";
            $params[] = $ageMin;
        }
    }
    if (isset($input['age_max']) && $input['age_max'] !== '' && is_numeric($input['age_max'])) {
        $ageMax = max(0, (int)$input['age_max']);
        if ($ageMax > 0) {
            $where[] = "({$bdayColExpr} IS NOT NULL AND {$bdayColExpr} > '1900-01-01' AND {$bdayColExpr} >= DATE_SUB(CURDATE(), INTERVAL ? YEAR))";
            $params[] = $ageMax + 1;
        }
    }
    if (isset($input['birth_year_from']) && $input['birth_year_from'] !== '' && is_numeric($input['birth_year_from'])) {
        $byFrom = (int)$input['birth_year_from'];
        if ($byFrom >= 1900 && $byFrom <= 2100) {
            $where[] = "{$bdayColExpr} >= ?";
            $params[] = sprintf('%04d-01-01', $byFrom);
        }
    }
    if (isset($input['birth_year_to']) && $input['birth_year_to'] !== '' && is_numeric($input['birth_year_to'])) {
        $byTo = (int)$input['birth_year_to'];
        if ($byTo >= 1900 && $byTo <= 2100) {
            $where[] = "{$bdayColExpr} <= ?";
            $params[] = sprintf('%04d-12-31', $byTo);
        }
    }
    $bdayMonths = parseCrmMultiFilterValues($input['birthday_month'] ?? null);
    if (!empty($bdayMonths)) {
        $validMonths = [];
        foreach ($bdayMonths as $bm) {
            if (is_numeric($bm) && (int)$bm >= 1 && (int)$bm <= 12) {
                $validMonths[] = (int)$bm;
            }
        }
        if (!empty($validMonths)) {
            $phBm = implode(',', array_fill(0, count($validMonths), '?'));
            $where[] = "MONTH({$bdayColExpr}) IN ($phBm)";
            foreach ($validMonths as $mVal) {
                $params[] = $mVal;
            }
        }
    }

    // Cities / Branches (`cities`, `city`, `branches_or_cities`)
    $citySearchCols = array_values(array_filter(
        ['city', 'district', 'ward', 'address'],
        fn($c) => isset($contactCols[$c])
    ));
    if (empty($citySearchCols)) {
        $citySearchCols = ['city', 'address'];
    }

    $cityTokens = array_values(array_unique(array_merge(
        parseCrmMultiFilterValues($input['cities'] ?? null),
        parseCrmMultiFilterValues($input['city'] ?? null),
        parseCrmMultiFilterValues($input['branches_or_cities'] ?? null)
    )));
    if (!empty($cityTokens)) {
        $cityOrs = [];
        foreach ($cityTokens as $cTok) {
            $variants = [$cTok];
            $unacc = removeVietnameseAccents($cTok);
            if ($unacc !== $cTok) {
                $variants[] = $unacc;
            }
            $lowUnacc = strtolower(trim($unacc));
            if (in_array($lowUnacc, ['hcm', 'tphcm', 'tp.hcm', 'tp hcm', 'ho chi minh', 'sai gon', 'saigon'], true)) {
                $variants = array_merge($variants, ['Hồ Chí Minh', 'Ho Chi Minh', 'HCM', 'Sài Gòn', 'TP.HCM']);
            } elseif (in_array($lowUnacc, ['hn', 'ha noi', 'hanoi', 'tp ha noi'], true)) {
                $variants = array_merge($variants, ['Hà Nội', 'Ha Noi']);
            } elseif (in_array($lowUnacc, ['dn', 'da nang', 'danang'], true)) {
                $variants = array_merge($variants, ['Đà Nẵng', 'Da Nang']);
            }
            foreach (array_unique($variants) as $vCity) {
                $likeC = '%' . $vCity . '%';
                $colParts = [];
                foreach ($citySearchCols as $csc) {
                    $colParts[] = "{$a}{$csc} LIKE ?";
                    $params[] = $likeC;
                }
                $cityOrs[] = '(' . implode(' OR ', $colParts) . ')';
            }
        }
        if (!empty($cityOrs)) {
            $where[] = '(' . implode(' OR ', $cityOrs) . ')';
        }
    }

    // Districts (`districts` / `district`)
    $distSearchCols = array_values(array_filter(
        ['district', 'ward', 'address', 'city'],
        fn($c) => isset($contactCols[$c])
    ));
    if (empty($distSearchCols)) {
        $distSearchCols = ['address', 'city'];
    }
    $districtTokens = array_values(array_unique(array_merge(
        parseCrmMultiFilterValues($input['districts'] ?? null),
        parseCrmMultiFilterValues($input['district'] ?? null)
    )));
    if (!empty($districtTokens)) {
        $distOrs = [];
        foreach ($districtTokens as $dTok) {
            $variants = array_unique([$dTok, removeVietnameseAccents($dTok)]);
            foreach ($variants as $vDist) {
                $likeD = '%' . $vDist . '%';
                $colParts = [];
                foreach ($distSearchCols as $dsc) {
                    $colParts[] = "{$a}{$dsc} LIKE ?";
                    $params[] = $likeD;
                }
                $distOrs[] = '(' . implode(' OR ', $colParts) . ')';
            }
        }
        if (!empty($distOrs)) {
            $where[] = '(' . implode(' OR ', $distOrs) . ')';
        }
    }

    // B2B & Professional (`job_titles`, `companies`, `industries`, `departments`, `education_or_degree`)
    $jobTokens = array_values(array_unique(array_merge(
        parseCrmMultiFilterValues($input['job_titles'] ?? null),
        parseCrmMultiFilterValues($input['job_title'] ?? null)
    )));
    if (!empty($jobTokens)) {
        $jtOrs = [];
        $hasPositionCol = isset($contactCols['position']);
        foreach ($jobTokens as $jt) {
            $likeJt = '%' . $jt . '%';
            if ($hasPositionCol) {
                $jtOrs[] = "({$a}job_title LIKE ? OR {$a}position LIKE ?)";
                $params[] = $likeJt;
                $params[] = $likeJt;
            } else {
                $jtOrs[] = "{$a}job_title LIKE ?";
                $params[] = $likeJt;
            }
        }
        $where[] = '(' . implode(' OR ', $jtOrs) . ')';
    }

    $compTokens = array_values(array_unique(array_merge(
        parseCrmMultiFilterValues($input['companies'] ?? null),
        parseCrmMultiFilterValues($input['company'] ?? null),
        parseCrmMultiFilterValues($input['company_id'] ?? null)
    )));
    if (!empty($compTokens)) {
        $cpOrs = [];
        $hasCompanyNameCol = isset($contactCols['company_name']);
        $hasCompanyCol = isset($contactCols['company']);
        foreach ($compTokens as $cp) {
            if (is_numeric($cp) && (int)$cp > 0) {
                $cpOrs[] = "{$a}company_id = ?";
                $params[] = (int)$cp;
            } else {
                $likeCp = '%' . $cp . '%';
                $subCp = [];
                if ($hasCompanyNameCol) {
                    $subCp[] = "{$a}company_name LIKE ?";
                    $params[] = $likeCp;
                }
                if ($hasCompanyCol) {
                    $subCp[] = "{$a}company LIKE ?";
                    $params[] = $likeCp;
                }
                $subCp[] = "EXISTS (SELECT 1 FROM companies comp_f WHERE comp_f.id = {$a}company_id AND comp_f.name LIKE ?)";
                $params[] = $likeCp;
                $cpOrs[] = '(' . implode(' OR ', $subCp) . ')';
            }
        }
        $where[] = '(' . implode(' OR ', $cpOrs) . ')';
    }

    $indTokens = array_values(array_unique(array_merge(
        parseCrmMultiFilterValues($input['industries'] ?? null),
        parseCrmMultiFilterValues($input['industry'] ?? null)
    )));
    if (!empty($indTokens)) {
        $indOrs = [];
        $hasIndustryCol = isset($contactCols['industry']);
        foreach ($indTokens as $ind) {
            $likeInd = '%' . $ind . '%';
            if ($hasIndustryCol) {
                $indOrs[] = "{$a}industry LIKE ?";
                $params[] = $likeInd;
            } else {
                $indOrs[] = "({$a}job_title LIKE ? OR {$a}notes LIKE ?)";
                $params[] = $likeInd;
                $params[] = $likeInd;
            }
        }
        $where[] = '(' . implode(' OR ', $indOrs) . ')';
    }

    $deptTokens = array_values(array_unique(array_merge(
        parseCrmMultiFilterValues($input['departments'] ?? null),
        parseCrmMultiFilterValues($input['department'] ?? null)
    )));
    if (!empty($deptTokens)) {
        $dpOrs = [];
        $hasDeptCol = isset($contactCols['department']);
        foreach ($deptTokens as $dp) {
            $likeDp = '%' . $dp . '%';
            if ($hasDeptCol) {
                $dpOrs[] = "{$a}department LIKE ?";
                $params[] = $likeDp;
            } else {
                $dpOrs[] = "({$a}job_title LIKE ? OR {$a}position LIKE ? OR {$a}notes LIKE ?)";
                array_push($params, $likeDp, $likeDp, $likeDp);
            }
        }
        $where[] = '(' . implode(' OR ', $dpOrs) . ')';
    }

    $eduTokens = parseCrmMultiFilterValues($input['education_or_degree'] ?? null);
    if (!empty($eduTokens)) {
        $edOrs = [];
        $hasMajorCol = isset($contactCols['major']);
        foreach ($eduTokens as $ed) {
            $likeEd = '%' . $ed . '%';
            if ($hasMajorCol) {
                $edOrs[] = "({$a}major LIKE ? OR {$a}job_title LIKE ? OR {$a}notes LIKE ? OR EXISTS (SELECT 1 FROM custom_field_values cfv_ed JOIN custom_fields cf_ed ON cfv_ed.custom_field_id = cf_ed.id WHERE cfv_ed.entity_id = {$a}id AND cf_ed.entity_type = 'contact' AND cfv_ed.value_text LIKE ?))";
                array_push($params, $likeEd, $likeEd, $likeEd, $likeEd);
            } else {
                $edOrs[] = "({$a}job_title LIKE ? OR {$a}notes LIKE ? OR EXISTS (SELECT 1 FROM custom_field_values cfv_ed JOIN custom_fields cf_ed ON cfv_ed.custom_field_id = cf_ed.id WHERE cfv_ed.entity_id = {$a}id AND cf_ed.entity_type = 'contact' AND cfv_ed.value_text LIKE ?))";
                array_push($params, $likeEd, $likeEd, $likeEd);
            }
        }
        $where[] = '(' . implode(' OR ', $edOrs) . ')';
    }

    // =========================================================================
    // 5. ACADEMIC, MARKETING, LEAD QUALITY & FINANCIAL FILTERS
    // =========================================================================
    // Programs / Project (`programs`, `program`, `project_id`, `projects`)
    $numericProjTokens = array_values(array_unique(array_merge(
        parseCrmMultiFilterValues($input['project_id'] ?? null),
        parseCrmMultiFilterValues($input['projects'] ?? null)
    )));
    $rawProgTokens = array_values(array_unique(array_merge(
        parseCrmMultiFilterValues($input['programs'] ?? null),
        parseCrmMultiFilterValues($input['program'] ?? null)
    )));
    // If numeric project_id is already provided, only keep program tokens if they are distinct from numeric IDs
    $progTokens = !empty($numericProjTokens)
        ? $numericProjTokens
        : $rawProgTokens;

    if (!empty($progTokens)) {
        $progOrs = [];
        foreach ($progTokens as $pt) {
            if (is_numeric($pt) && (int)$pt > 0) {
                $progOrs[] = "({$a}project_id = ? OR (({$a}project_id IS NULL OR {$a}project_id = 0) AND {$a}program IS NOT NULL AND {$a}program != '' AND EXISTS (SELECT 1 FROM projects pr_p WHERE pr_p.id = ? AND LOWER(TRIM({$a}program)) = LOWER(TRIM(pr_p.name)))))";
                $params[] = (int)$pt;
                $params[] = (int)$pt;
            } else {
                $progColMatch = buildCrmProgramColumnMatchSql("{$a}program", (string)$pt, $params);
                $projNameMatch = buildCrmProgramColumnMatchSql("pr_p.name", (string)$pt, $params);
                $progOrs[] = "({$progColMatch} OR {$a}project_id IN (SELECT pr_p.id FROM projects pr_p WHERE {$projNameMatch} OR LOWER(TRIM(COALESCE(pr_p.code, ''))) = LOWER(?)))";
                $params[] = trim((string)$pt);
            }
        }
        $where[] = '(' . implode(' OR ', $progOrs) . ')';
    }

    // Campaigns / UTM (`campaign_id`, `campaigns`, `campaign_or_utm`)
    $campTokens = array_values(array_unique(array_merge(
        parseCrmMultiFilterValues($input['campaign_id'] ?? null),
        parseCrmMultiFilterValues($input['campaigns'] ?? null),
        parseCrmMultiFilterValues($input['campaign_or_utm'] ?? null)
    )));
    if (!empty($campTokens)) {
        $lscaCols = getCrmTableColumnsCache($db, 'lms_student_campaign_allocations');
        $lscaContactCol = isset($lscaCols['contact_id']) ? 'contact_id' : (isset($lscaCols['student_id']) ? 'student_id' : null);
        $hasSourceDetail = isset($contactCols['source_detail']);
        $hasUtmCampaign = isset($contactCols['utm_campaign']);
        $hasUtmSource = isset($contactCols['utm_source']);
        $hasCampaignIdCol = isset($contactCols['campaign_id']);

        $campOrs = [];
        foreach ($campTokens as $ctk) {
            if (is_numeric($ctk) && (int)$ctk > 0) {
                if ($lscaContactCol !== null && $hasCampaignIdCol) {
                    $campOrs[] = "({$a}campaign_id = ? OR EXISTS (SELECT 1 FROM lms_student_campaign_allocations lsca WHERE lsca.{$lscaContactCol} = {$a}id AND lsca.campaign_id = ?))";
                    $params[] = (int)$ctk;
                    $params[] = (int)$ctk;
                } elseif ($hasCampaignIdCol) {
                    $campOrs[] = "{$a}campaign_id = ?";
                    $params[] = (int)$ctk;
                } elseif ($lscaContactCol !== null) {
                    $campOrs[] = "EXISTS (SELECT 1 FROM lms_student_campaign_allocations lsca WHERE lsca.{$lscaContactCol} = {$a}id AND lsca.campaign_id = ?)";
                    $params[] = (int)$ctk;
                }
            } else {
                $likeCamp = '%' . $ctk . '%';
                $campParts = [];
                if ($hasUtmCampaign) {
                    $campParts[] = "{$a}utm_campaign LIKE ?";
                    $params[] = $likeCamp;
                }
                if ($hasUtmSource) {
                    $campParts[] = "{$a}utm_source LIKE ?";
                    $params[] = $likeCamp;
                }
                if ($hasCampaignIdCol) {
                    $campParts[] = "{$a}campaign_id IN (SELECT mc_f.id FROM marketing_campaigns mc_f WHERE mc_f.name LIKE ?)";
                    $params[] = $likeCamp;
                }
                if ($hasSourceDetail) {
                    $campParts[] = "{$a}source_detail LIKE ?";
                    $params[] = $likeCamp;
                }
                if ($lscaContactCol !== null) {
                    $campParts[] = "EXISTS (SELECT 1 FROM lms_student_campaign_allocations lsca JOIN marketing_campaigns mc_l ON lsca.campaign_id = mc_l.id WHERE lsca.{$lscaContactCol} = {$a}id AND mc_l.name LIKE ?)";
                    $params[] = $likeCamp;
                }
                if (empty($campParts)) {
                    $campParts[] = "{$a}source LIKE ?";
                    $params[] = $likeCamp;
                }
                $campOrs[] = '(' . implode(' OR ', $campParts) . ')';
            }
        }
        if (!empty($campOrs)) {
            $where[] = '(' . implode(' OR ', $campOrs) . ')';
        }
    }

    // Sources (`sources` / `source` / `source_type`)
    $srcTokens = array_values(array_unique(array_merge(
        parseCrmMultiFilterValues($input['sources'] ?? null),
        parseCrmMultiFilterValues($input['source'] ?? null),
        parseCrmMultiFilterValues($input['source_type'] ?? null)
    )));
    if (!empty($srcTokens)) {
        $srcOrs = [];
        $hasSourceDetail = isset($contactCols['source_detail']);
        $hasUtmSource = isset($contactCols['utm_source']);
        foreach ($srcTokens as $st) {
            $stLow = mb_strtolower(trim($st), 'UTF-8');
            $expandedSrcs = [$st];
            if ($stLow === 'facebook' || $stLow === 'facebook ads') {
                $expandedSrcs = array_merge($expandedSrcs, ['Facebook Ads', 'Facebook', 'fb', 'Social Media']);
            } elseif ($stLow === 'google' || $stLow === 'google ads') {
                $expandedSrcs = array_merge($expandedSrcs, ['Google Ads', 'Google', 'gg']);
            } elseif ($stLow === 'tiktok') {
                $expandedSrcs = array_merge($expandedSrcs, ['TikTok', 'Tiktok Ads']);
            } elseif ($stLow === 'zalo') {
                $expandedSrcs = array_merge($expandedSrcs, ['Zalo', 'Zalo OA']);
            } elseif ($stLow === 'ca_nhan') {
                $expandedSrcs = array_merge($expandedSrcs, ['ca_nhan', 'Nhân viên kinh doanh tự tìm kiếm']);
            } elseif ($stLow === 'gioi_thieu') {
                $expandedSrcs = array_merge($expandedSrcs, ['gioi_thieu', 'Referral', 'ref', 'Giới thiệu']);
            } elseif ($stLow === 'hoi_thao') {
                $expandedSrcs = array_merge($expandedSrcs, ['hoi_thao', 'Hội thảo', 'Sự kiện', 'Event', 'Workshop']);
            } elseif ($stLow === 'website') {
                $expandedSrcs = array_merge($expandedSrcs, ['Website', 'Web', 'Landing Page']);
            }
            foreach (array_unique($expandedSrcs) as $eSrc) {
                $likeSrc = '%' . $eSrc . '%';
                $srcColParts = ["{$a}source LIKE ?"];
                $params[] = $likeSrc;
                if ($hasSourceDetail) {
                    $srcColParts[] = "{$a}source_detail LIKE ?";
                    $params[] = $likeSrc;
                }
                if ($hasUtmSource) {
                    $srcColParts[] = "{$a}utm_source LIKE ?";
                    $params[] = $likeSrc;
                }
                $srcOrs[] = count($srcColParts) > 1 ? '(' . implode(' OR ', $srcColParts) . ')' : $srcColParts[0];
            }
        }
        $where[] = '(' . implode(' OR ', $srcOrs) . ')';
    }

    // Tags (`tags` / `tag` + `tag_op` = 'any' | 'all' | 'not')
    $tagTokens = array_values(array_unique(array_merge(
        parseCrmMultiFilterValues($input['tags'] ?? null),
        parseCrmMultiFilterValues($input['tag'] ?? null)
    )));
    if (!empty($tagTokens)) {
        $tagOp = strtolower(trim((string)($input['tag_op'] ?? 'any')));
        $tagConds = [];
        if (in_array($tagOp, ['not', 'not_in', 'none'], true)) {
            foreach ($tagTokens as $tg) {
                $tagConds[] = "({$a}tags IS NULL OR {$a}tags NOT LIKE ?)";
                $params[] = '%' . $tg . '%';
            }
            $where[] = '(' . implode(' AND ', $tagConds) . ')';
        } elseif (in_array($tagOp, ['all', 'and'], true)) {
            foreach ($tagTokens as $tg) {
                $tagConds[] = "{$a}tags LIKE ?";
                $params[] = '%' . $tg . '%';
            }
            $where[] = '(' . implode(' AND ', $tagConds) . ')';
        } else {
            foreach ($tagTokens as $tg) {
                $tagConds[] = "{$a}tags LIKE ?";
                $params[] = '%' . $tg . '%';
            }
            $where[] = '(' . implode(' OR ', $tagConds) . ')';
        }
    }

    // Temperature (`temperature` / `temperatures` / `lead_temperature`)
    $tempTokens = array_values(array_unique(array_merge(
        parseCrmMultiFilterValues($input['temperature'] ?? null),
        parseCrmMultiFilterValues($input['temperatures'] ?? null),
        parseCrmMultiFilterValues($input['lead_temperature'] ?? null)
    )));
    if (!empty($tempTokens)) {
        $tempVals = [];
        foreach ($tempTokens as $tt) {
            $tLow = mb_strtolower(trim($tt), 'UTF-8');
            if (in_array($tLow, ['hot', 'nong', 'nóng'], true)) {
                $tempVals = array_merge($tempVals, ['hot', 'nong', 'nóng']);
            } elseif (in_array($tLow, ['warm', 'am', 'ấm'], true)) {
                $tempVals = array_merge($tempVals, ['warm', 'am', 'ấm']);
            } elseif (in_array($tLow, ['cold', 'lanh', 'lạnh'], true)) {
                $tempVals = array_merge($tempVals, ['cold', 'lanh', 'lạnh']);
            } else {
                $tempVals[] = $tLow;
            }
        }
        $tempVals = array_values(array_unique($tempVals));
        if (!empty($tempVals)) {
            $phTemp = implode(',', array_fill(0, count($tempVals), '?'));
            if (isset($contactCols['lead_temperature'])) {
                $where[] = "(LOWER(TRIM(COALESCE({$a}temperature, ''))) IN ($phTemp) OR LOWER(TRIM(COALESCE({$a}lead_temperature, ''))) IN ($phTemp))";
                foreach ($tempVals as $tv) $params[] = $tv;
                foreach ($tempVals as $tv) $params[] = $tv;
            } else {
                $where[] = "LOWER(TRIM(COALESCE({$a}temperature, ''))) IN ($phTemp)";
                foreach ($tempVals as $tv) $params[] = $tv;
            }
        }
    }

    // Lead Score bounds (`score_min` / `min_lead_score` & `score_max` / `max_lead_score`)
    $scoreMinRaw = $input['score_min'] ?? ($input['min_lead_score'] ?? null);
    if ($scoreMinRaw !== null && $scoreMinRaw !== '' && is_numeric($scoreMinRaw)) {
        $where[] = "COALESCE({$a}lead_score, 0) >= ?";
        $params[] = (int)$scoreMinRaw;
    }
    $scoreMaxRaw = $input['score_max'] ?? ($input['max_lead_score'] ?? null);
    if ($scoreMaxRaw !== null && $scoreMaxRaw !== '' && is_numeric($scoreMaxRaw)) {
        $where[] = "COALESCE({$a}lead_score, 0) <= ?";
        $params[] = (int)$scoreMaxRaw;
    }

    // Study Status (`study_status` / `study_statuses`)
    if (empty($input['_defer_study_status_filter'])) {
        applyCrmStudyStatusFilter($db, $a, $input, $where, $params);
    }

    // Student Code (`student_code`)
    $studentCode = trim((string)($input['student_code'] ?? ''));
    if ($studentCode !== '' && strtolower($studentCode) !== 'all' && isset($contactCols['student_id'])) {
        $scLow = strtolower($studentCode);
        if ($scLow === 'has_code') {
            $where[] = "({$a}student_id IS NOT NULL AND TRIM({$a}student_id) != '')";
        } elseif ($scLow === 'no_code') {
            $where[] = "({$a}student_id IS NULL OR TRIM({$a}student_id) = '')";
        } else {
            $where[] = "{$a}student_id LIKE ?";
            $params[] = '%' . $studentCode . '%';
        }
    }

    // Expected Intake / Intake & Major
    $intakeTokens = array_values(array_unique(array_merge(
        parseCrmMultiFilterValues($input['intake'] ?? null),
        parseCrmMultiFilterValues($input['intakes'] ?? null),
        parseCrmMultiFilterValues($input['expected_intake'] ?? null),
        parseCrmMultiFilterValues($input['expected_intakes'] ?? null)
    )));
    if (!empty($intakeTokens)) {
        $inOrs = [];
        $hasIntakeCol = isset($contactCols['intake']);
        $hasExpectedIntakeCol = isset($contactCols['expected_intake']);
        $hasAdmissionDateCol = isset($contactCols['admission_date']);
        foreach ($intakeTokens as $itk) {
            $likeItk = '%' . $itk . '%';
            $itkParts = [];
            if ($hasIntakeCol) {
                $itkParts[] = "{$a}intake LIKE ?";
                $params[] = $likeItk;
            }
            if ($hasExpectedIntakeCol) {
                $itkParts[] = "{$a}expected_intake LIKE ?";
                $params[] = $likeItk;
            }
            if ($hasAdmissionDateCol) {
                $itkParts[] = "DATE_FORMAT({$a}admission_date, '%m/%Y') LIKE ?";
                $itkParts[] = "DATE_FORMAT({$a}admission_date, '%c/%Y') LIKE ?";
                $itkParts[] = "DATE_FORMAT({$a}admission_date, '%Y-%m') LIKE ?";
                $itkParts[] = "CAST({$a}admission_date AS CHAR) LIKE ?";
                array_push($params, $likeItk, $likeItk, $likeItk, $likeItk);
            }
            $itkParts[] = "{$a}program LIKE ?";
            $itkParts[] = "{$a}notes LIKE ?";
            array_push($params, $likeItk, $likeItk);
            $inOrs[] = '(' . implode(' OR ', $itkParts) . ')';
        }
        $where[] = '(' . implode(' OR ', $inOrs) . ')';
    }

    $majorTokens = array_values(array_unique(array_merge(
        parseCrmMultiFilterValues($input['major'] ?? null),
        parseCrmMultiFilterValues($input['majors'] ?? null)
    )));
    if (!empty($majorTokens)) {
        $mjOrs = [];
        $hasMajor = isset($contactCols['major']);
        foreach ($majorTokens as $mj) {
            if ($hasMajor) {
                $mjOrs[] = "({$a}major LIKE ? OR {$a}program LIKE ?)";
                $params[] = '%' . $mj . '%';
                $params[] = '%' . $mj . '%';
            } else {
                $mjOrs[] = "{$a}program LIKE ?";
                $params[] = '%' . $mj . '%';
            }
        }
        $where[] = '(' . implode(' OR ', $mjOrs) . ')';
    }

    // Missing Document (`missing_document` / `document_status`) via `cloud_files`
    $docTokens = array_values(array_unique(array_merge(
        parseCrmMultiFilterValues($input['missing_document'] ?? null),
        parseCrmMultiFilterValues($input['document_status'] ?? null)
    )));
    if (!empty($docTokens)) {
        $idCardExistsSql = "EXISTS (SELECT 1 FROM cloud_files cf_id WHERE cf_id.contact_id = {$a}id AND (LOWER(cf_id.name) REGEXP 'cccd|cmnd|căn cước|can cuoc|chứng minh|chung minh|id_card|id card|passport|hộ chiếu|ho chieu' OR LOWER(COALESCE(cf_id.category, '')) REGEXP 'cccd|cmnd|id_card|personal|ca_nhan|cá nhân'))";
        $degreeExistsSql = "EXISTS (SELECT 1 FROM cloud_files cf_dg WHERE cf_dg.contact_id = {$a}id AND (LOWER(cf_dg.name) REGEXP 'bằng|bang|degree|diploma|bảng điểm|bang diem|transcript|học bạ|hoc ba' OR LOWER(COALESCE(cf_dg.category, '')) REGEXP 'bằng|bang|degree|academic|hoc_tap|học tập'))";
        $transExistsSql  = "EXISTS (SELECT 1 FROM cloud_files cf_tr WHERE cf_tr.contact_id = {$a}id AND (LOWER(cf_tr.name) REGEXP 'dịch|dich|translation|notar|công chứng|cong chung' OR LOWER(COALESCE(cf_tr.category, '')) REGEXP 'dịch|dich|translation'))";
        $contractExistsSql = "EXISTS (SELECT 1 FROM cloud_files cf_ct WHERE cf_ct.contact_id = {$a}id AND (LOWER(cf_ct.name) REGEXP 'hợp đồng|hop dong|contract|application|đơn nhập học|don nhap hoc|offer' OR LOWER(COALESCE(cf_ct.category, '')) REGEXP 'hợp đồng|hop dong|contract|đơn hàng|don hang'))";
        $idCardField = isset($contactCols['id_card']) ? 'id_card' : (isset($contactCols['citizen_id']) ? 'citizen_id' : null);

        $docOrs = [];
        foreach ($docTokens as $dtk) {
            $dLow = strtolower(trim($dtk));
            if ($dLow === 'id_card' || $dLow === 'cccd') {
                if ($idCardField !== null) {
                    $docOrs[] = "(NOT {$idCardExistsSql} AND ({$a}{$idCardField} IS NULL OR TRIM({$a}{$idCardField}) = ''))";
                } else {
                    $docOrs[] = "NOT {$idCardExistsSql}";
                }
            } elseif ($dLow === 'degree' || $dLow === 'bang_cap') {
                $docOrs[] = "NOT {$degreeExistsSql}";
            } elseif ($dLow === 'translation' || $dLow === 'ban_dich') {
                $docOrs[] = "NOT {$transExistsSql}";
            } elseif ($dLow === 'contract' || $dLow === 'hop_dong') {
                $docOrs[] = "NOT {$contractExistsSql}";
            } elseif ($dLow === 'incomplete') {
                $docOrs[] = "(NOT {$idCardExistsSql} OR NOT {$degreeExistsSql})";
            } elseif ($dLow === 'complete') {
                $docOrs[] = "({$idCardExistsSql} AND {$degreeExistsSql})";
            }
        }
        if (!empty($docOrs)) {
            $where[] = '(' . implode(' OR ', $docOrs) . ')';
        }
    }

    // Financial & Deposit Status Filters (`financial_filter` / `deposit_status` + min/max deposit & expected_revenue)
    $finTokens = array_values(array_unique(array_merge(
        parseCrmMultiFilterValues($input['financial_filter'] ?? null),
        parseCrmMultiFilterValues($input['deposit_status'] ?? null)
    )));
    if (!empty($finTokens)) {
        $dmCols = getCrmTableColumnsCache($db, 'deposit_milestones');
        $finOrs = [];
        foreach ($finTokens as $ft) {
            $fLow = strtolower(trim($ft));
            if ($fLow === 'has_deposit') {
                $finOrs[] = "EXISTS (SELECT 1 FROM deposits dep_f WHERE dep_f.contact_id = {$a}id AND dep_f.status NOT IN ('cancelled', 'rejected'))";
            } elseif ($fLow === 'approved_deposit' || $fLow === 'has_approved_deposit') {
                $finOrs[] = "EXISTS (SELECT 1 FROM deposits dep_f WHERE dep_f.contact_id = {$a}id AND dep_f.status IN ('approved', 'completed'))";
            } elseif ($fLow === 'pending_deposit') {
                $finOrs[] = "EXISTS (SELECT 1 FROM deposits dep_f WHERE dep_f.contact_id = {$a}id AND dep_f.status = 'pending')";
            } elseif ($fLow === 'no_deposit') {
                $finOrs[] = "NOT EXISTS (SELECT 1 FROM deposits dep_f WHERE dep_f.contact_id = {$a}id AND dep_f.status NOT IN ('cancelled', 'rejected'))";
            } elseif ($fLow === 'has_so') {
                $finOrs[] = "({$a}stage_id IN (SELECT id FROM pipeline_stages WHERE order_index >= 12) OR {$a}status = 'customer' OR {$a}pipeline_status IN ('deposit_tuition_payment', 'dong_le_phi_ho_so', 'enrolled', 'hoc_vien'))";
            } elseif ($fLow === 'high_value_deposit') {
                $finOrs[] = "EXISTS (SELECT 1 FROM deposits dep_f WHERE dep_f.contact_id = {$a}id AND dep_f.price >= 10000000 AND dep_f.status NOT IN ('cancelled', 'rejected'))";
            } elseif ($fLow === 'overdue_milestone') {
                if (!empty($dmCols)) {
                    $finOrs[] = "EXISTS (SELECT 1 FROM deposits dep_om JOIN deposit_milestones dm_om ON dm_om.deposit_id = dep_om.id WHERE dep_om.contact_id = {$a}id AND dep_om.status NOT IN ('cancelled', 'rejected') AND dm_om.status NOT IN ('paid', 'approved', 'completed', 'cancelled', 'rejected') AND dm_om.expected_pay_date IS NOT NULL AND dm_om.expected_pay_date < CURDATE())";
                } else {
                    $finOrs[] = "EXISTS (SELECT 1 FROM deposits dep_om WHERE dep_om.contact_id = {$a}id AND dep_om.status = 'pending' AND dep_om.created_at < DATE_SUB(NOW(), INTERVAL 7 DAY))";
                }
            } elseif ($fLow === 'has_revenue') {
                $finOrs[] = "(EXISTS (SELECT 1 FROM deposits dep_rv WHERE dep_rv.contact_id = {$a}id AND dep_rv.status IN ('approved', 'completed') AND dep_rv.price > 0) OR EXISTS (SELECT 1 FROM invoices inv_rv WHERE inv_rv.contact_id = {$a}id AND inv_rv.deleted_at IS NULL AND inv_rv.status IN ('paid', 'partially_paid') AND inv_rv.total > 0))";
            } elseif ($fLow === 'has_commission') {
                $finOrs[] = "EXISTS (SELECT 1 FROM deposits dep_cm WHERE dep_cm.contact_id = {$a}id AND dep_cm.status NOT IN ('cancelled', 'rejected') AND COALESCE(dep_cm.expected_commission, 0) > 0)";
            }
        }
        if (!empty($finOrs)) {
            $where[] = '(' . implode(' OR ', $finOrs) . ')';
        }
    }

    $minDepositRaw = $input['min_deposit_amount'] ?? ($input['min_deposit'] ?? null);
    if ($minDepositRaw !== null && $minDepositRaw !== '' && is_numeric($minDepositRaw) && (float)$minDepositRaw > 0) {
        $where[] = "(SELECT COALESCE(SUM(dep_min.price), 0) FROM deposits dep_min WHERE dep_min.contact_id = {$a}id AND dep_min.status NOT IN ('cancelled', 'rejected')) >= ?";
        $params[] = (float)$minDepositRaw;
    }
    $maxDepositRaw = $input['max_deposit_amount'] ?? ($input['max_deposit'] ?? null);
    if ($maxDepositRaw !== null && $maxDepositRaw !== '' && is_numeric($maxDepositRaw) && (float)$maxDepositRaw >= 0) {
        $where[] = "(SELECT COALESCE(SUM(dep_max.price), 0) FROM deposits dep_max WHERE dep_max.contact_id = {$a}id AND dep_max.status NOT IN ('cancelled', 'rejected')) <= ?";
        $params[] = (float)$maxDepositRaw;
    }

    if (isset($input['min_expected_revenue']) && $input['min_expected_revenue'] !== '' && is_numeric($input['min_expected_revenue'])) {
        $where[] = "COALESCE({$a}expected_revenue, 0) >= ?";
        $params[] = (float)$input['min_expected_revenue'];
    }
    if (isset($input['max_expected_revenue']) && $input['max_expected_revenue'] !== '' && is_numeric($input['max_expected_revenue'])) {
        $where[] = "COALESCE({$a}expected_revenue, 0) <= ?";
        $params[] = (float)$input['max_expected_revenue'];
    }

    // Optional Date Range Filter (when not explicitly skipped by caller)
    if (empty($input['_skip_date_filter'])) {
        applyCrmDateRangeFilter($db, $alias, $input, $where, $params);
    }

    // Optional Data Type Filter (`data_type`: 'distributed' | 'personal' | 'error_ticket') — 100% synced with DashboardController & ContactController
    if (empty($input['_defer_data_type_filter']) && !empty($input['data_type'])) {
        $dtVal = strtolower(trim((string)$input['data_type']));
        $notClonedCondSql = "(COALESCE({$a}duplicate_flag, 0) = 0 OR {$a}duplicate_with_id IS NULL)";
        $saleRoleCondSql = "EXISTS (SELECT 1 FROM users u_dt WHERE u_dt.id = {$a}owner_id AND LOWER(u_dt.role) IN ('sale', 'sales'))";
        $errorCondSql = "(
            COALESCE({$a}lead_status, '') IN ('error', 'ticket_pending', 'pending', 'approved', 'confirmed', 'bao_loi')
            OR COALESCE({$a}pipeline_status, '') IN ('00_error', 'error', 'bao_loi')
            OR COALESCE({$a}tags, '') LIKE '%\"Báo lỗi\"%'
            OR EXISTS (SELECT 1 FROM tickets tk_dt WHERE tk_dt.contact_id = {$a}id AND tk_dt.status IN ('open', 'in_progress', 'pending', 'approved', 'confirmed'))
            OR EXISTS (
                SELECT 1 FROM data_reports dr_dt
                JOIN leads l_dt ON dr_dt.lead_id = l_dt.id
                WHERE {$a}phone IS NOT NULL AND {$a}phone != '' AND l_dt.phone = {$a}phone AND dr_dt.status IN ('pending', 'approved')
            )
        )";
        $personalCondSql = "(
            COALESCE({$a}lead_status, '') IN ('ca_nhan', 'personal', 'self', 'tu_kiem', 'gioi_thieu', 'referral', 'import', 'imported')
            OR COALESCE({$a}source, '') IN ('ca_nhan', 'gioi_thieu', 'databank', 'referral', 'ref', 'import', 'excel', 'csv')
            OR COALESCE({$a}source, '') LIKE 'ca_nhan%'
            OR COALESCE({$a}source, '') = 'Nhân viên kinh doanh tự tìm kiếm'
            OR ({$a}created_by IS NOT NULL AND {$a}owner_id IS NOT NULL AND {$a}created_by = {$a}owner_id AND {$a}created_by NOT IN (1, 100009) AND LOWER(TRIM(COALESCE({$a}source, ''))) IN ('', 'other', 'ca_nhan', 'gioi_thieu', 'databank', 'referral', 'ref'))
            OR LOWER(COALESCE({$a}source, '')) LIKE '%cá nhân%'
            OR LOWER(COALESCE({$a}source, '')) LIKE '%ca nhan%'
            OR LOWER(COALESCE({$a}source, '')) LIKE '%tự tìm%'
            OR LOWER(COALESCE({$a}source, '')) LIKE '%tu tim%'
            OR LOWER(COALESCE({$a}source, '')) LIKE '%tự kiếm%'
            OR LOWER(COALESCE({$a}source, '')) LIKE '%giới thiệu%'
            OR LOWER(COALESCE({$a}source, '')) LIKE '%gioi thieu%'
            OR LOWER(COALESCE({$a}source, '')) LIKE '%referral%'
            OR LOWER(COALESCE({$a}source, '')) LIKE '%import%'
            OR LOWER(COALESCE({$a}source, '')) LIKE '%nhập%'
            OR LOWER(COALESCE({$a}source, '')) LIKE '%nhap%'
            OR LOWER(COALESCE({$a}source, '')) LIKE '%excel%'
            OR LOWER(COALESCE({$a}source, '')) LIKE '%csv%'
            OR COALESCE({$a}tags, '') LIKE '%\"Cá nhân\"%'
            OR COALESCE({$a}tags, '') LIKE '%\"Giới thiệu\"%'
            OR COALESCE({$a}tags, '') LIKE '%Import%'
            OR COALESCE({$a}notes, '') LIKE '[Import]%'
        )";
        if ($dtVal === 'error_ticket') {
            $where[] = $errorCondSql;
        } elseif ($dtVal === 'personal') {
            $where[] = $notClonedCondSql;
            $where[] = $saleRoleCondSql;
            $where[] = "NOT {$errorCondSql}";
            $where[] = $personalCondSql;
        } elseif ($dtVal === 'distributed') {
            $where[] = $notClonedCondSql;
            $where[] = $saleRoleCondSql;
            $where[] = "NOT {$errorCondSql}";
            $where[] = "NOT {$personalCondSql}";
        }
    }

    // Optional Lead Status Filter (`lead_status` + `lead_status_op`)
    if (empty($input['_defer_lead_status_filter']) && !empty($input['lead_status'])) {
        $lsTokens = parseCrmMultiFilterValues($input['lead_status']);
        $lsOp = strtolower(trim((string)($input['lead_status_op'] ?? 'in')));
        if (!empty($lsTokens)) {
            if (count($lsTokens) === 1 && strtolower($lsTokens[0]) === 'active') {
                if ($lsOp === 'not_in') {
                    $where[] = "({$a}lead_status IN ('lost', 'nurture'))";
                } else {
                    $where[] = "({$a}lead_status = 'active' OR {$a}lead_status IS NULL OR {$a}lead_status = '')";
                }
            } else {
                $phLs = implode(',', array_fill(0, count($lsTokens), '?'));
                if ($lsOp === 'not_in') {
                    $where[] = "({$a}lead_status NOT IN ($phLs) OR {$a}lead_status IS NULL)";
                } else {
                    $where[] = "{$a}lead_status IN ($phLs)";
                }
                foreach ($lsTokens as $lst) {
                    $params[] = $lst;
                }
            }
        }
    }

    // Optional Multi-Program Filter (`multi_program`) — Fast O(N) materialized lookup (avoids MySQL O(N^2) dependent subquery inside OR)
    if (empty($input['_defer_multi_program_filter']) && !empty($input['multi_program']) && in_array(strtolower(trim((string)$input['multi_program'])), ['1', 'true', 'yes'], true)) {
        $mpTenantId = isset($input['tenant_id']) && (int)$input['tenant_id'] > 0 ? (int)$input['tenant_id'] : 1;
        $mpIds = getCrmMultiProgramContactIds($db, $mpTenantId);
        if (!empty($mpIds)) {
            $where[] = "{$a}id IN (" . implode(',', array_map('intval', $mpIds)) . ")";
        } else {
            $where[] = "1 = 0";
        }
    }

    // Optional Omnichannel & Automation 360° Filter (`engagement_status`, `automation_flow`, `voucher_status`, etc.)
    if (empty($input['_skip_omnichannel_filter'])) {
        $omniSubClause = buildContactOmnichannelFilterClause($db, rtrim($alias, '.'), $input, $params);
        if ($omniSubClause !== '') {
            $where[] = $omniSubClause;
        }
    }

    // =========================================================================
    // 6. DYNAMIC SCHEMA RULE BUILDER (`custom_rules` + `custom_rules_logic` = 'AND'|'OR')
    // =========================================================================
    $rawRules = $input['custom_rules'] ?? null;
    if (!empty($rawRules)) {
        $rules = is_string($rawRules) ? (json_decode($rawRules, true) ?: []) : (is_array($rawRules) ? $rawRules : []);
        if (!empty($rules) && is_array($rules)) {
            $whitelistedColumns = [
                'id', 'person_id', 'name', 'full_name', 'phone', 'mobile', 'phone2', 'zalo_phone', 'email',
                'gender', 'birthday', 'dob', 'id_card', 'citizen_id', 'passport', 'address', 'ward', 'district',
                'city', 'preferred_location', 'company_id', 'company_name', 'company', 'job_title', 'position', 'department',
                'industry', 'tax_code', 'customer_type', 'owner_id', 'collaborator_ids', 'created_by',
                'status', 'stage_id', 'pipeline_status', 'lead_status', 'temperature', 'lead_temperature',
                'lead_score', 'win_probability', 'ttl1_completed', 'next_action', 'next_followup_date',
                'expected_decision_date', 'nurture_reason', 'lost_reason', 'project_id', 'program',
                'major', 'expected_intake', 'admission_date', 'student_id', 'study_status', 'source', 'source_detail',
                'campaign_id', 'platform', 'form_name', 'utm_source', 'utm_campaign', 'utm_medium',
                'utm_content', 'utm_term', 'tags', 'notes', 'expected_revenue', 'actual_revenue', 'discount_amount', 'budget', 'budget_range',
                'total_spent', 'order_count', 'last_order_at', 'last_contact', 'created_at', 'updated_at',
                'domation_subscriber_id', 'marketing_status', 'engagement_score',
                'stats_email_sent', 'stats_email_opened', 'stats_email_clicked',
                'last_email_open_at', 'last_email_click_at', 'last_web_visit_at',
                'web_pageviews_count', 'max_scroll_depth', 'active_flow_count',
                'active_flow_names', 'active_voucher_code', 'survey_completed_count',
                'zalo_user_id', 'meta_psid'
            ];
            $whitelistMap = array_fill_keys($whitelistedColumns, true);

            $ruleClauses = [];
            foreach ($rules as $rule) {
                if (!is_array($rule)) continue;
                $field = trim((string)($rule['field'] ?? ($rule['column'] ?? '')));
                $op    = strtolower(trim((string)($rule['operator'] ?? ($rule['op'] ?? 'eq'))));
                $val   = $rule['value'] ?? null;
                $valTo = $rule['valueTo'] ?? ($rule['value_to'] ?? ($rule['value2'] ?? null));

                if ($field === '') continue;

                // Map operator synonyms
                $opMap = [
                    '=' => 'eq', 'equals' => 'eq',
                    '!=' => 'neq', '<>' => 'neq', 'not_equals' => 'neq',
                    'like' => 'contains',
                    'not_like' => 'not_contains',
                    '>' => 'gt', '>=' => 'gte', '<' => 'lt', '<=' => 'lte',
                    'empty' => 'is_empty', 'is_null' => 'is_empty',
                    'not_empty' => 'is_not_empty', 'is_not_null' => 'is_not_empty',
                ];
                if (isset($opMap[$op])) {
                    $op = $opMap[$op];
                }

                // Case A: Custom Field (`cf_<field_key>`)
                if (str_starts_with($field, 'cf_')) {
                    $cfKey = substr($field, 3);
                    if (!preg_match('/^[a-zA-Z0-9_]+$/', $cfKey)) {
                        continue;
                    }
                    $cfValExpr = "COALESCE(cfv_r.value_text, CAST(cfv_r.value_number AS CHAR), CAST(cfv_r.value_date AS CHAR), cfv_r.value_json)";
                    $cfNumExpr = "COALESCE(cfv_r.value_number, CAST(cfv_r.value_text AS DECIMAL(18,4)))";

                    if ($op === 'is_empty') {
                        $ruleClauses[] = "NOT EXISTS (SELECT 1 FROM custom_field_values cfv_r JOIN custom_fields cf_r ON cfv_r.custom_field_id = cf_r.id WHERE cf_r.entity_type = 'contact' AND cf_r.field_key = ? AND cfv_r.entity_id = {$a}id AND TRIM(COALESCE({$cfValExpr}, '')) != '')";
                        $params[] = $cfKey;
                    } elseif ($op === 'is_not_empty') {
                        $ruleClauses[] = "EXISTS (SELECT 1 FROM custom_field_values cfv_r JOIN custom_fields cf_r ON cfv_r.custom_field_id = cf_r.id WHERE cf_r.entity_type = 'contact' AND cf_r.field_key = ? AND cfv_r.entity_id = {$a}id AND TRIM(COALESCE({$cfValExpr}, '')) != '')";
                        $params[] = $cfKey;
                    } elseif ($op === 'eq') {
                        $ruleClauses[] = "EXISTS (SELECT 1 FROM custom_field_values cfv_r JOIN custom_fields cf_r ON cfv_r.custom_field_id = cf_r.id WHERE cf_r.entity_type = 'contact' AND cf_r.field_key = ? AND cfv_r.entity_id = {$a}id AND {$cfValExpr} = ?)";
                        $params[] = $cfKey;
                        $params[] = (string)$val;
                    } elseif ($op === 'neq') {
                        $ruleClauses[] = "NOT EXISTS (SELECT 1 FROM custom_field_values cfv_r JOIN custom_fields cf_r ON cfv_r.custom_field_id = cf_r.id WHERE cf_r.entity_type = 'contact' AND cf_r.field_key = ? AND cfv_r.entity_id = {$a}id AND {$cfValExpr} = ?)";
                        $params[] = $cfKey;
                        $params[] = (string)$val;
                    } elseif ($op === 'contains') {
                        $ruleClauses[] = "EXISTS (SELECT 1 FROM custom_field_values cfv_r JOIN custom_fields cf_r ON cfv_r.custom_field_id = cf_r.id WHERE cf_r.entity_type = 'contact' AND cf_r.field_key = ? AND cfv_r.entity_id = {$a}id AND {$cfValExpr} LIKE ?)";
                        $params[] = $cfKey;
                        $params[] = '%' . (string)$val . '%';
                    } elseif ($op === 'starts_with') {
                        $ruleClauses[] = "EXISTS (SELECT 1 FROM custom_field_values cfv_r JOIN custom_fields cf_r ON cfv_r.custom_field_id = cf_r.id WHERE cf_r.entity_type = 'contact' AND cf_r.field_key = ? AND cfv_r.entity_id = {$a}id AND {$cfValExpr} LIKE ?)";
                        $params[] = $cfKey;
                        $params[] = (string)$val . '%';
                    } elseif ($op === 'ends_with') {
                        $ruleClauses[] = "EXISTS (SELECT 1 FROM custom_field_values cfv_r JOIN custom_fields cf_r ON cfv_r.custom_field_id = cf_r.id WHERE cf_r.entity_type = 'contact' AND cf_r.field_key = ? AND cfv_r.entity_id = {$a}id AND {$cfValExpr} LIKE ?)";
                        $params[] = $cfKey;
                        $params[] = '%' . (string)$val;
                    } elseif ($op === 'not_contains') {
                        $ruleClauses[] = "NOT EXISTS (SELECT 1 FROM custom_field_values cfv_r JOIN custom_fields cf_r ON cfv_r.custom_field_id = cf_r.id WHERE cf_r.entity_type = 'contact' AND cf_r.field_key = ? AND cfv_r.entity_id = {$a}id AND {$cfValExpr} LIKE ?)";
                        $params[] = $cfKey;
                        $params[] = '%' . (string)$val . '%';
                    } elseif (in_array($op, ['gt', 'gte', 'lt', 'lte'], true)) {
                        $sqlOp = $op === 'gt' ? '>' : ($op === 'gte' ? '>=' : ($op === 'lt' ? '<' : '<='));
                        $targetExpr = is_numeric($val) ? $cfNumExpr : $cfValExpr;
                        $ruleClauses[] = "EXISTS (SELECT 1 FROM custom_field_values cfv_r JOIN custom_fields cf_r ON cfv_r.custom_field_id = cf_r.id WHERE cf_r.entity_type = 'contact' AND cf_r.field_key = ? AND cfv_r.entity_id = {$a}id AND {$targetExpr} {$sqlOp} ?)";
                        $params[] = $cfKey;
                        $params[] = is_numeric($val) ? (float)$val : (string)$val;
                    } elseif ($op === 'between') {
                        $bMin = $val;
                        $bMax = $valTo;
                        if (is_array($val) && count($val) >= 2) {
                            $bMin = $val[0];
                            $bMax = $val[1];
                        } elseif (is_string($val) && str_contains($val, ',') && $bMax === null) {
                            [$bMin, $bMax] = array_map('trim', explode(',', $val, 2));
                        }
                        if ($bMin !== null && $bMax !== null) {
                            $targetExpr = (is_numeric($bMin) && is_numeric($bMax)) ? $cfNumExpr : $cfValExpr;
                            $ruleClauses[] = "EXISTS (SELECT 1 FROM custom_field_values cfv_r JOIN custom_fields cf_r ON cfv_r.custom_field_id = cf_r.id WHERE cf_r.entity_type = 'contact' AND cf_r.field_key = ? AND cfv_r.entity_id = {$a}id AND {$targetExpr} >= ? AND {$targetExpr} <= ?)";
                            $params[] = $cfKey;
                            $params[] = is_numeric($bMin) ? (float)$bMin : (string)$bMin;
                            $params[] = is_numeric($bMax) ? (float)$bMax : (string)$bMax;
                        }
                    } elseif ($op === 'in' || $op === 'not_in') {
                        $inItems = parseCrmMultiFilterValues($val);
                        if (!empty($inItems)) {
                            $phIn = implode(',', array_fill(0, count($inItems), '?'));
                            $prefixNot = $op === 'not_in' ? 'NOT ' : '';
                            $ruleClauses[] = "{$prefixNot}EXISTS (SELECT 1 FROM custom_field_values cfv_r JOIN custom_fields cf_r ON cfv_r.custom_field_id = cf_r.id WHERE cf_r.entity_type = 'contact' AND cf_r.field_key = ? AND cfv_r.entity_id = {$a}id AND {$cfValExpr} IN ($phIn))";
                            $params[] = $cfKey;
                            foreach ($inItems as $iv) {
                                $params[] = (string)$iv;
                            }
                        }
                    }
                    continue;
                }

                // Case B: Whitelisted `contacts` column
                if (!isset($whitelistMap[$field])) {
                    continue;
                }

                // Resolve expression for computed/virtual vs physical columns
                if (!isset($contactCols[$field])) {
                    if ($field === 'full_name' && isset($contactCols['name'])) {
                        $colExpr = "{$a}name";
                    } elseif (in_array($field, ['citizen_id', 'id_card', 'passport'], true)) {
                        if (isset($contactCols['id_card'])) {
                            $colExpr = "{$a}id_card";
                        } elseif (isset($contactCols['citizen_id'])) {
                            $colExpr = "{$a}citizen_id";
                        } else {
                            $colExpr = "{$a}notes";
                        }
                    } elseif (in_array($field, ['company', 'company_name'], true)) {
                        if (isset($contactCols['company_name'])) {
                            $colExpr = "{$a}company_name";
                        } elseif (isset($contactCols['company'])) {
                            $colExpr = "{$a}company";
                        } else {
                            $colExpr = "(SELECT comp_r.name FROM companies comp_r WHERE comp_r.id = {$a}company_id LIMIT 1)";
                        }
                    } elseif ($field === 'dob' && isset($contactCols['birthday'])) {
                        $colExpr = "{$a}birthday";
                    } elseif ($field === 'birthday' && isset($contactCols['dob'])) {
                        $colExpr = "{$a}dob";
                    } elseif (in_array($field, ['ward', 'district', 'preferred_location'], true)) {
                        $colExpr = "CONCAT_WS(' ', {$a}address, {$a}city)";
                    } elseif (in_array($field, ['platform', 'form_name', 'utm_source', 'utm_campaign', 'utm_medium', 'utm_content', 'utm_term'], true)) {
                        $platCols = ["{$a}source"];
                        if (isset($contactCols['source_detail'])) $platCols[] = "{$a}source_detail";
                        if (isset($contactCols['utm_source'])) $platCols[] = "{$a}utm_source";
                        if (isset($contactCols['utm_campaign'])) $platCols[] = "{$a}utm_campaign";
                        if (isset($contactCols['utm_medium'])) $platCols[] = "{$a}utm_medium";
                        $colExpr = count($platCols) > 1 ? "CONCAT_WS(' ', " . implode(', ', $platCols) . ")" : $platCols[0];
                    } elseif (in_array($field, ['department', 'industry', 'tax_code', 'customer_type'], true)) {
                        $colExpr = "CONCAT_WS(' ', {$a}job_title, {$a}notes)";
                    } elseif (in_array($field, ['major', 'expected_intake'], true)) {
                        $colExpr = "CONCAT_WS(' ', {$a}program, {$a}notes)";
                    } elseif ($field === 'nurture_reason') {
                        $colExpr = "CONCAT_WS(' ', {$a}lost_reason, {$a}notes)";
                    } elseif (in_array($field, ['mobile', 'phone2', 'zalo_phone'], true)) {
                        $colExpr = "{$a}phone";
                    } elseif ($field === 'budget' || $field === 'budget_range') {
                        $colExpr = "{$a}expected_revenue";
                    } elseif ($field === 'total_spent') {
                        $colExpr = "(SELECT COALESCE(SUM(dep_ts.price), 0) FROM deposits dep_ts WHERE dep_ts.contact_id = {$a}id AND dep_ts.status IN ('approved', 'completed'))";
                    } elseif ($field === 'order_count') {
                        $colExpr = "(SELECT COUNT(*) FROM deposits dep_oc WHERE dep_oc.contact_id = {$a}id AND dep_oc.status NOT IN ('cancelled', 'rejected'))";
                    } elseif ($field === 'last_order_at') {
                        $colExpr = "(SELECT MAX(dep_lo.created_at) FROM deposits dep_lo WHERE dep_lo.contact_id = {$a}id AND dep_lo.status NOT IN ('cancelled', 'rejected'))";
                    } elseif (isset($contactCols['custom_fields'])) {
                        $colExpr = "JSON_UNQUOTE(JSON_EXTRACT({$a}custom_fields, '$.{$field}'))";
                    } else {
                        $colExpr = "{$a}notes";
                    }
                } else {
                    $colExpr = "{$a}{$field}";
                }

                if ($op === 'is_empty') {
                    $ruleClauses[] = "({$colExpr} IS NULL OR TRIM(CAST({$colExpr} AS CHAR)) = '')";
                } elseif ($op === 'is_not_empty') {
                    $ruleClauses[] = "({$colExpr} IS NOT NULL AND TRIM(CAST({$colExpr} AS CHAR)) != '')";
                } elseif ($op === 'eq') {
                    $ruleClauses[] = "{$colExpr} = ?";
                    $params[] = (string)$val;
                } elseif ($op === 'neq') {
                    $ruleClauses[] = "({$colExpr} IS NULL OR {$colExpr} != ?)";
                    $params[] = (string)$val;
                } elseif ($op === 'contains') {
                    $ruleClauses[] = "{$colExpr} LIKE ?";
                    $params[] = '%' . (string)$val . '%';
                } elseif ($op === 'starts_with') {
                    $ruleClauses[] = "{$colExpr} LIKE ?";
                    $params[] = (string)$val . '%';
                } elseif ($op === 'ends_with') {
                    $ruleClauses[] = "{$colExpr} LIKE ?";
                    $params[] = '%' . (string)$val;
                } elseif ($op === 'not_contains') {
                    $ruleClauses[] = "({$colExpr} IS NULL OR {$colExpr} NOT LIKE ?)";
                    $params[] = '%' . (string)$val . '%';
                } elseif (in_array($op, ['gt', 'gte', 'lt', 'lte'], true)) {
                    $sqlOp = $op === 'gt' ? '>' : ($op === 'gte' ? '>=' : ($op === 'lt' ? '<' : '<='));
                    $ruleClauses[] = "{$colExpr} {$sqlOp} ?";
                    $params[] = is_numeric($val) ? ($val + 0) : (string)$val;
                } elseif ($op === 'between') {
                    $bMin = $val;
                    $bMax = $valTo;
                    if (is_array($val) && count($val) >= 2) {
                        $bMin = $val[0];
                        $bMax = $val[1];
                    } elseif (is_string($val) && str_contains($val, ',') && $bMax === null) {
                        [$bMin, $bMax] = array_map('trim', explode(',', $val, 2));
                    }
                    if ($bMin !== null && $bMax !== null && $bMin !== '' && $bMax !== '') {
                        $ruleClauses[] = "({$colExpr} >= ? AND {$colExpr} <= ?)";
                        $params[] = is_numeric($bMin) ? ($bMin + 0) : (string)$bMin;
                        $params[] = is_numeric($bMax) ? ($bMax + 0) : (string)$bMax;
                    }
                } elseif ($op === 'in') {
                    $inItems = parseCrmMultiFilterValues($val);
                    if (!empty($inItems)) {
                        $phIn = implode(',', array_fill(0, count($inItems), '?'));
                        $ruleClauses[] = "{$colExpr} IN ($phIn)";
                        foreach ($inItems as $iv) {
                            $params[] = (string)$iv;
                        }
                    }
                } elseif ($op === 'not_in') {
                    $inItems = parseCrmMultiFilterValues($val);
                    if (!empty($inItems)) {
                        $phIn = implode(',', array_fill(0, count($inItems), '?'));
                        $ruleClauses[] = "({$colExpr} IS NULL OR {$colExpr} NOT IN ($phIn))";
                        foreach ($inItems as $iv) {
                            $params[] = (string)$iv;
                        }
                    }
                }
            }

            if (!empty($ruleClauses)) {
                $logic = strtoupper(trim((string)($input['custom_rules_logic'] ?? 'AND'))) === 'OR' ? 'OR' : 'AND';
                $where[] = '(' . implode(" {$logic} ", $ruleClauses) . ')';
            }
        }
    }
}

/**
 * 360° Omnichannel Engagement Filters for Contacts (DOMATION Sync & Tracking)
 *
 * Returns a standalone SQL condition string (without leading AND, or '' if empty)
 * and appends bound parameters to $outParams.
 */
function buildContactOmnichannelFilterClause(PDO $db, string $alias, array $paramsInput, array &$outParams): string {
    // Fast-path early exit when no omnichannel filter parameter is provided
    $omnichannelKeys = [
        'engagement_status', 'engagement_level', 'min_engagement_score', 'max_engagement_score',
        'email_engagement', 'web_behavior', 'automation_flow', 'automation_flow_filter',
        'voucher_status', 'voucher_filter', 'survey_filter', 'marketing_status', 'channel_reachability'
    ];
    $hasAnyFilter = false;
    foreach ($omnichannelKeys as $k) {
        if (isset($paramsInput[$k]) && $paramsInput[$k] !== '' && strtolower(trim((string)$paramsInput[$k])) !== 'all') {
            $hasAnyFilter = true;
            break;
        }
    }
    if (!$hasAnyFilter) {
        return '';
    }

    $contactCols = getCrmTableColumnsCache($db, 'contacts');
    if (empty($contactCols['engagement_score'])) {
        return '';
    }

    $a = rtrim(trim($alias), '.');
    if ($a === '') {
        $a = 'contacts';
    }

    $subCols = getCrmTableColumnsCache($db, 'subscribers');
    $sfsCols = getCrmTableColumnsCache($db, 'subscriber_flow_states');
    $vcCols  = getCrmTableColumnsCache($db, 'voucher_codes');
    $srCols  = getCrmTableColumnsCache($db, 'survey_responses');

    $clauses = [];

    // 0. Unified `engagement_status` from ContactsPage Card 5B
    $engagementStatus = strtolower(trim((string)($paramsInput['engagement_status'] ?? '')));
    if ($engagementStatus === 'email_opened') {
        if (!empty($subCols)) {
            $clauses[] = "({$a}.stats_email_opened > 0 OR EXISTS (SELECT 1 FROM subscribers s_eo WHERE s_eo.contact_id = {$a}.id AND COALESCE(s_eo.stats_opened, 0) > 0))";
        } else {
            $clauses[] = "{$a}.stats_email_opened > 0";
        }
    } elseif ($engagementStatus === 'email_clicked') {
        if (!empty($subCols)) {
            $clauses[] = "({$a}.stats_email_clicked > 0 OR EXISTS (SELECT 1 FROM subscribers s_ec WHERE s_ec.contact_id = {$a}.id AND COALESCE(s_ec.stats_clicked, 0) > 0))";
        } else {
            $clauses[] = "{$a}.stats_email_clicked > 0";
        }
    } elseif ($engagementStatus === 'web_visited_7d') {
        $clauses[] = "{$a}.last_web_visit_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
    } elseif ($engagementStatus === 'survey_completed') {
        if (!empty($subCols) && !empty($srCols)) {
            $clauses[] = "({$a}.survey_completed_count > 0 OR EXISTS (SELECT 1 FROM subscribers s_sv JOIN survey_responses sr_sv ON sr_sv.subscriber_id = s_sv.id WHERE s_sv.contact_id = {$a}.id))";
        } else {
            $clauses[] = "{$a}.survey_completed_count > 0";
        }
    } elseif ($engagementStatus === 'voucher_issued') {
        if (!empty($vcCols) && isset($vcCols['contact_id'])) {
            $clauses[] = "(({$a}.active_voucher_code IS NOT NULL AND {$a}.active_voucher_code != '') OR EXISTS (SELECT 1 FROM voucher_codes dv WHERE dv.contact_id = {$a}.id))";
        } else {
            $clauses[] = "({$a}.active_voucher_code IS NOT NULL AND {$a}.active_voucher_code != '')";
        }
    }

    // 1. Engagement Score & Tier (`engagement_level`, `min_engagement_score`, `max_engagement_score`)
    $engagementLevel = strtolower(trim((string)($paramsInput['engagement_level'] ?? '')));
    if ($engagementLevel === 'hot_engaged') {
        $clauses[] = "{$a}.engagement_score >= 50";
    } elseif ($engagementLevel === 'warm_engaged') {
        $clauses[] = "({$a}.engagement_score >= 20 AND {$a}.engagement_score < 50)";
    } elseif ($engagementLevel === 'cold_engaged') {
        $clauses[] = "({$a}.engagement_score IS NULL OR {$a}.engagement_score = 0)";
    }

    if (isset($paramsInput['min_engagement_score']) && $paramsInput['min_engagement_score'] !== '' && is_numeric($paramsInput['min_engagement_score'])) {
        $clauses[] = "COALESCE({$a}.engagement_score, 0) >= ?";
        $outParams[] = (int)$paramsInput['min_engagement_score'];
    }
    if (isset($paramsInput['max_engagement_score']) && $paramsInput['max_engagement_score'] !== '' && is_numeric($paramsInput['max_engagement_score'])) {
        $clauses[] = "COALESCE({$a}.engagement_score, 0) <= ?";
        $outParams[] = (int)$paramsInput['max_engagement_score'];
    }

    // 2. Email Engagement (`email_engagement`)
    $emailEngagement = strtolower(trim((string)($paramsInput['email_engagement'] ?? '')));
    if ($emailEngagement === 'opened_any') {
        $clauses[] = "{$a}.stats_email_opened > 0";
    } elseif ($emailEngagement === 'clicked_any') {
        $clauses[] = "{$a}.stats_email_clicked > 0";
    } elseif ($emailEngagement === 'sent_not_opened') {
        $clauses[] = "({$a}.stats_email_sent > 0 AND COALESCE({$a}.stats_email_opened, 0) = 0)";
    } elseif ($emailEngagement === 'opened_not_clicked') {
        $clauses[] = "({$a}.stats_email_opened > 0 AND COALESCE({$a}.stats_email_clicked, 0) = 0)";
    } elseif ($emailEngagement === 'never_emailed') {
        $clauses[] = "COALESCE({$a}.stats_email_sent, 0) = 0";
    } elseif ($emailEngagement === 'bounced_or_unsub') {
        $clauses[] = "{$a}.marketing_status IN ('unsubscribed', 'bounced', 'complained')";
    }

    // 3. Website Tracking (`web_behavior`)
    $webBehavior = strtolower(trim((string)($paramsInput['web_behavior'] ?? '')));
    if ($webBehavior === 'visited_any') {
        $clauses[] = "{$a}.web_pageviews_count > 0";
    } elseif ($webBehavior === 'visited_7d') {
        $clauses[] = "{$a}.last_web_visit_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
    } elseif ($webBehavior === 'visited_30d') {
        $clauses[] = "{$a}.last_web_visit_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
    } elseif ($webBehavior === 'high_intent_3plus') {
        $clauses[] = "{$a}.web_pageviews_count >= 3";
    } elseif ($webBehavior === 'deep_scroll_70') {
        $clauses[] = "{$a}.max_scroll_depth >= 70";
    } elseif ($webBehavior === 'never_visited') {
        $clauses[] = "COALESCE({$a}.web_pageviews_count, 0) = 0";
    }

    // 4. Automation Flow Filter (`automation_flow` / `automation_flow_filter`)
    $flowFilter = trim((string)($paramsInput['automation_flow'] ?? ($paramsInput['automation_flow_filter'] ?? '')));
    if ($flowFilter !== '' && strtolower($flowFilter) !== 'all') {
        $flowFilterLower = strtolower($flowFilter);
        if (in_array($flowFilterLower, ['in_active_flow', 'active_any'], true)) {
            if (!empty($subCols) && !empty($sfsCols)) {
                $clauses[] = "({$a}.active_flow_count > 0 OR EXISTS (SELECT 1 FROM subscribers s_af JOIN subscriber_flow_states dfe ON dfe.subscriber_id = s_af.id WHERE s_af.contact_id = {$a}.id AND dfe.status IN ('active','waiting','processing')))";
            } else {
                $clauses[] = "{$a}.active_flow_count > 0";
            }
        } elseif ($flowFilterLower === 'completed_any') {
            if (!empty($subCols) && !empty($sfsCols)) {
                $clauses[] = "EXISTS (SELECT 1 FROM subscribers s_cf JOIN subscriber_flow_states dfe ON dfe.subscriber_id = s_cf.id WHERE s_cf.contact_id = {$a}.id AND dfe.status IN ('completed','finished','done'))";
            } else {
                $clauses[] = "{$a}.active_flow_count > 0";
            }
        } elseif (in_array($flowFilterLower, ['not_in_flow', 'none'], true)) {
            if (!empty($subCols) && !empty($sfsCols)) {
                $clauses[] = "(COALESCE({$a}.active_flow_count, 0) = 0 AND NOT EXISTS (SELECT 1 FROM subscribers s_nf JOIN subscriber_flow_states dfe ON dfe.subscriber_id = s_nf.id WHERE s_nf.contact_id = {$a}.id))";
            } else {
                $clauses[] = "COALESCE({$a}.active_flow_count, 0) = 0";
            }
        } else {
            $clauses[] = "{$a}.active_flow_names LIKE ?";
            $outParams[] = '%' . $flowFilter . '%';
        }
    }

    // 5. Voucher Filter (`voucher_status` / `voucher_filter`)
    $voucherFilter = trim((string)($paramsInput['voucher_status'] ?? ($paramsInput['voucher_filter'] ?? '')));
    if ($voucherFilter !== '' && strtolower($voucherFilter) !== 'all') {
        $voucherFilterLower = strtolower($voucherFilter);
        $hasVcContactId = !empty($vcCols) && isset($vcCols['contact_id']);
        if (in_array($voucherFilterLower, ['has_active_voucher', 'has_active'], true)) {
            if ($hasVcContactId) {
                $clauses[] = "(({$a}.active_voucher_code IS NOT NULL AND {$a}.active_voucher_code != '') OR EXISTS (SELECT 1 FROM voucher_codes dv WHERE dv.contact_id = {$a}.id AND dv.status IN ('unused','available','active')))";
            } else {
                $clauses[] = "({$a}.active_voucher_code IS NOT NULL AND {$a}.active_voucher_code != '')";
            }
        } elseif (in_array($voucherFilterLower, ['used_voucher', 'redeemed'], true)) {
            if ($hasVcContactId) {
                $clauses[] = "EXISTS (SELECT 1 FROM voucher_codes dv WHERE dv.contact_id = {$a}.id AND dv.status IN ('used','redeemed'))";
            } else {
                $clauses[] = "1 = 0";
            }
        } elseif ($voucherFilterLower === 'expired_unredeemed') {
            if ($hasVcContactId) {
                $clauses[] = "EXISTS (SELECT 1 FROM voucher_codes dv WHERE dv.contact_id = {$a}.id AND dv.status IN ('unused','available','active') AND dv.expires_at < NOW())";
            } else {
                $clauses[] = "1 = 0";
            }
        } elseif (in_array($voucherFilterLower, ['no_voucher', 'none'], true)) {
            if ($hasVcContactId) {
                $clauses[] = "(({$a}.active_voucher_code IS NULL OR {$a}.active_voucher_code = '') AND NOT EXISTS (SELECT 1 FROM voucher_codes dv WHERE dv.contact_id = {$a}.id))";
            } else {
                $clauses[] = "({$a}.active_voucher_code IS NULL OR {$a}.active_voucher_code = '')";
            }
        } else {
            if ($hasVcContactId) {
                $clauses[] = "({$a}.active_voucher_code LIKE ? OR EXISTS (SELECT 1 FROM voucher_codes dv WHERE dv.contact_id = {$a}.id AND dv.code LIKE ?))";
                $outParams[] = '%' . $voucherFilter . '%';
                $outParams[] = '%' . $voucherFilter . '%';
            } else {
                $clauses[] = "{$a}.active_voucher_code LIKE ?";
                $outParams[] = '%' . $voucherFilter . '%';
            }
        }
    }

    // 6. Survey Completion (`survey_filter`)
    $surveyFilter = strtolower(trim((string)($paramsInput['survey_filter'] ?? '')));
    if ($surveyFilter === 'completed_any') {
        $clauses[] = "{$a}.survey_completed_count > 0";
    } elseif ($surveyFilter === 'not_completed') {
        $clauses[] = "COALESCE({$a}.survey_completed_count, 0) = 0";
    }

    // 7. Marketing Subscription Status (`marketing_status`)
    $marketingStatus = strtolower(trim((string)($paramsInput['marketing_status'] ?? '')));
    if (in_array($marketingStatus, ['subscribed', 'unsubscribed', 'bounced', 'complained'], true)) {
        $clauses[] = "{$a}.marketing_status = ?";
        $outParams[] = $marketingStatus;
    }

    // 8. Channel Reachability (`channel_reachability`)
    $channelReachability = trim((string)($paramsInput['channel_reachability'] ?? ''));
    $channelReachabilityLower = strtolower($channelReachability);
    if ($channelReachabilityLower === 'has_zalo') {
        $clauses[] = "({$a}.zalo_user_id IS NOT NULL AND {$a}.zalo_user_id != '')";
    } elseif ($channelReachabilityLower === 'has_fb_psid') {
        $clauses[] = "({$a}.meta_psid IS NOT NULL AND {$a}.meta_psid != '')";
    } elseif ($channelReachability === 'has_email_Valid' || $channelReachabilityLower === 'has_email_valid') {
        $clauses[] = "({$a}.email IS NOT NULL AND {$a}.email != '' AND COALESCE({$a}.marketing_status, 'subscribed') = 'subscribed')";
    } elseif ($channelReachabilityLower === 'omnichannel_ready') {
        $clauses[] = "({$a}.email IS NOT NULL AND {$a}.email != '' AND {$a}.phone IS NOT NULL AND {$a}.phone != '')";
    }

    if (empty($clauses)) {
        return '';
    }

    return '(' . implode(' AND ', $clauses) . ')';
}

/**
 * Materialize multi-program / multi-pipeline contact IDs in O(N) time with request-level caching.
 * Avoids MySQL's O(N^2) dependent subquery execution when `IN (SELECT ... GROUP BY ...)` is placed inside an `OR` clause.
 */
function getCrmMultiProgramContactIds(PDO $db, int $tenantId = 1): array {
    static $cache = [];
    if (isset($cache[$tenantId])) {
        return $cache[$tenantId];
    }
    $ids = [];
    try {
        $st1 = $db->prepare("SELECT id, duplicate_with_id FROM contacts WHERE tenant_id = ? AND deleted_at IS NULL AND duplicate_with_id > 0");
        $st1->execute([$tenantId]);
        while ($r = $st1->fetch(PDO::FETCH_ASSOC)) {
            $ids[(int)$r['id']] = true;
            $ids[(int)$r['duplicate_with_id']] = true;
        }

        $st2 = $db->prepare("
            SELECT c.id
            FROM contacts c
            JOIN (
                SELECT person_id
                FROM contacts
                WHERE tenant_id = ? AND deleted_at IS NULL AND person_id > 0
                GROUP BY person_id
                HAVING COUNT(DISTINCT COALESCE(NULLIF(TRIM(program), ''), '__empty__')) >= 2
                    OR COUNT(DISTINCT stage_id) >= 2
            ) mp_p ON c.person_id = mp_p.person_id
            WHERE c.tenant_id = ? AND c.deleted_at IS NULL
        ");
        $st2->execute([$tenantId, $tenantId]);
        foreach ($st2->fetchAll(PDO::FETCH_COLUMN) as $cid) {
            $ids[(int)$cid] = true;
        }

        $st3 = $db->prepare("
            SELECT c.id
            FROM contacts c
            JOIN (
                SELECT phone
                FROM contacts
                WHERE tenant_id = ? AND deleted_at IS NULL AND phone != '' AND phone IS NOT NULL
                GROUP BY phone
                HAVING COUNT(DISTINCT COALESCE(NULLIF(TRIM(program), ''), '__empty__')) >= 2
                    OR COUNT(DISTINCT stage_id) >= 2
            ) mp_ph ON c.phone = mp_ph.phone
            WHERE c.tenant_id = ? AND c.deleted_at IS NULL
        ");
        $st3->execute([$tenantId, $tenantId]);
        foreach ($st3->fetchAll(PDO::FETCH_COLUMN) as $cid) {
            $ids[(int)$cid] = true;
        }
    } catch (\Throwable $e) {
        // Fallback safe empty
    }
    $cache[$tenantId] = array_keys($ids);
    return $cache[$tenantId];
}


