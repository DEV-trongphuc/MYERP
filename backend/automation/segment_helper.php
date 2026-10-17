<?php
// api/segment_helper.php

// [PERF FIX] Removed: ALTER TABLE segment_exclusions CONVERT TO CHARACTER SET
// That DDL statement ran on EVERY request that included segment_helper.php
// (campaigns, flows, lists, triggers, cron jobs) and acquired a per-request
// metadata lock → blocked concurrent reads/writes. It was a one-time migration
// for installations that created the table with the wrong collation.
// The migration is now in: api/db_indexes_audit.sql (run once on production).
//
// We still CREATE TABLE IF NOT EXISTS on each boot so new installations work.
if (isset($pdo) && function_exists('domationEnsureSchemaOnce')) {
    domationEnsureSchemaOnce('segment_exclusions_schema', function () use ($pdo) {
        $pdo->exec("CREATE TABLE IF NOT EXISTS segment_exclusions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            workspace_id INT DEFAULT 1,
            segment_id VARCHAR(50) NOT NULL,
            subscriber_id CHAR(36) NOT NULL,
            excluded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_exclusion (workspace_id, segment_id, subscriber_id),
            INDEX idx_seg_exclusions_seg (workspace_id, segment_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    });
}

if (!function_exists('getCrmTableColumnsCache')) {
    function getCrmTableColumnsCache(?PDO $pdo, string $table): array
    {
        static $cache = [];
        if (array_key_exists($table, $cache)) {
            return $cache[$table];
        }
        if (!$pdo) {
            $pdo = $GLOBALS['pdo'] ?? null;
        }
        if (!$pdo) {
            return [];
        }
        try {
            $stmt = $pdo->query("SHOW COLUMNS FROM `{$table}`");
            $cols = [];
            if ($stmt) {
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    if (!empty($row['Field'])) {
                        $cols[$row['Field']] = true;
                    }
                }
            }
            $cache[$table] = $cols;
            return $cols;
        } catch (Throwable $e) {
            $cache[$table] = [];
            return [];
        }
    }
}

/**
 * Fast batch synchronization of all active MYERP `/contacts` rows into `subscribers`
 * so Segment/List filter queries, estimates, previews, and campaign dispatches
 * always cover 100% of CRM contacts with up-to-date pipeline stage, lead status,
 * program, owner, and normalized email/phone fields.
 */
function ensureAllCrmContactsSyncedForFilter(PDO $pdo, int $workspaceId = 1): void
{
    static $syncedWorkspaces = [];
    $wsId = $workspaceId > 0 ? $workspaceId : 1;
    if (!empty($syncedWorkspaces[$wsId])) {
        return;
    }
    $syncedWorkspaces[$wsId] = true;

    try {
        if (!class_exists('DomationContactMatcher') && file_exists(__DIR__ . '/../utils/DomationContactMatcher.php')) {
            require_once __DIR__ . '/../utils/DomationContactMatcher.php';
        }
        if (class_exists('DomationContactMatcher')) {
            DomationContactMatcher::ensureSchema($pdo);
        }

        // 1. Link existing unlinked subscribers to contacts by exact normalized email
        $pdo->prepare("
            UPDATE subscribers s
            INNER JOIN contacts c
                ON c.deleted_at IS NULL
               AND c.email IS NOT NULL
               AND TRIM(c.email) != ''
               AND s.email = LOWER(TRIM(c.email))
            SET s.contact_id = c.id
            WHERE s.workspace_id = ?
              AND (s.contact_id IS NULL OR s.contact_id = 0)
        ")->execute([$wsId]);

        // 2. Link existing unlinked subscribers to contacts by phone
        $pdo->prepare("
            UPDATE subscribers s
            INNER JOIN contacts c
                ON c.deleted_at IS NULL
               AND c.phone IS NOT NULL
               AND TRIM(c.phone) != ''
               AND (s.phone_number = c.phone OR s.phone = c.phone)
            SET s.contact_id = c.id
            WHERE s.workspace_id = ?
              AND (s.contact_id IS NULL OR s.contact_id = 0)
        ")->execute([$wsId]);

        // 3. Batch-insert any remaining CRM contacts that do not yet have a subscriber row
        $pdo->prepare("
            INSERT IGNORE INTO subscribers (
                id, workspace_id, contact_id, email, email_norm,
                first_name, last_name, phone_number, phone, phone_norm9,
                city, country, job_title, company,
                stage_id, pipeline_status, lead_status, program, owner_id, salesperson,
                status, source_type, joined_at, created_at, updated_at
            )
            SELECT
                CONCAT('crm_', c.id),
                ?,
                c.id,
                CASE
                    WHEN c.email IS NOT NULL AND TRIM(c.email) != '' THEN LOWER(TRIM(c.email))
                    ELSE CONCAT('crm_', c.id, '@no-email.domation')
                END,
                CASE
                    WHEN c.email IS NOT NULL AND TRIM(c.email) != '' THEN LOWER(TRIM(c.email))
                    ELSE NULL
                END,
                COALESCE(NULLIF(TRIM(c.full_name), ''), 'Khách hàng'),
                '',
                COALESCE(NULLIF(TRIM(c.phone), ''), NULLIF(TRIM(c.mobile), '')),
                COALESCE(NULLIF(TRIM(c.phone), ''), NULLIF(TRIM(c.mobile), '')),
                CASE
                    WHEN LENGTH(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(COALESCE(NULLIF(c.phone, ''), NULLIF(c.mobile, ''), '')), ' ', ''), '-', ''), '.', ''), '+', '')) >= 9
                    THEN RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(COALESCE(NULLIF(c.phone, ''), NULLIF(c.mobile, ''), '')), ' ', ''), '-', ''), '.', ''), '+', ''), 9)
                    ELSE NULL
                END,
                c.city,
                c.country,
                c.job_title,
                c.company,
                c.stage_id,
                COALESCE(NULLIF(c.pipeline_status, ''), ps.system_slug, 'new_lead'),
                COALESCE(NULLIF(c.lead_status, ''), 'active'),
                c.program,
                c.owner_id,
                u.full_name,
                CASE
                    WHEN c.status = 'customer' OR c.pipeline_status IN ('enrolled', 'hoc_vien') THEN 'customer'
                    ELSE 'active'
                END,
                COALESCE(NULLIF(c.source, ''), 'crm_sync'),
                COALESCE(c.created_at, NOW()),
                COALESCE(c.created_at, NOW()),
                NOW()
            FROM contacts c
            LEFT JOIN users u ON u.id = c.owner_id
            LEFT JOIN pipeline_stages ps ON ps.id = c.stage_id
            WHERE c.deleted_at IS NULL
              AND (
                  (c.email IS NOT NULL AND TRIM(c.email) != '')
                  OR (c.phone IS NOT NULL AND TRIM(c.phone) != '')
                  OR (c.mobile IS NOT NULL AND TRIM(c.mobile) != '')
              )
              AND NOT EXISTS (
                  SELECT 1 FROM subscribers s2
                  WHERE s2.contact_id = c.id AND s2.workspace_id = ?
              )
        ")->execute([$wsId, $wsId]);

        // 4. Sync CRM state (stage_id, pipeline_status, lead_status, program, owner_id, salesperson, city) onto linked subscribers
        $pdo->prepare("
            UPDATE subscribers s
            INNER JOIN contacts c ON c.id = s.contact_id AND c.deleted_at IS NULL
            LEFT JOIN users u ON u.id = c.owner_id
            LEFT JOIN pipeline_stages ps ON ps.id = c.stage_id
            SET
                s.stage_id = c.stage_id,
                s.pipeline_status = COALESCE(NULLIF(c.pipeline_status, ''), ps.system_slug, s.pipeline_status),
                s.lead_status = COALESCE(NULLIF(c.lead_status, ''), s.lead_status, 'active'),
                s.program = COALESCE(NULLIF(c.program, ''), s.program),
                s.owner_id = c.owner_id,
                s.salesperson = COALESCE(u.full_name, s.salesperson),
                s.city = COALESCE(NULLIF(c.city, ''), s.city)
            WHERE s.workspace_id = ?
              AND (
                  NOT (s.stage_id <=> c.stage_id)
                  OR NOT (s.owner_id <=> c.owner_id)
                  OR (c.program IS NOT NULL AND c.program != '' AND (s.program IS NULL OR s.program != c.program))
                  OR (c.lead_status IS NOT NULL AND c.lead_status != '' AND (s.lead_status IS NULL OR s.lead_status != c.lead_status))
              )
        ")->execute([$wsId]);

        // 5. Backfill contacts.domation_subscriber_id where missing
        $pdo->prepare("
            UPDATE contacts c
            INNER JOIN subscribers s ON s.contact_id = c.id AND s.workspace_id = ?
            SET c.domation_subscriber_id = s.id
            WHERE c.deleted_at IS NULL
              AND (c.domation_subscriber_id IS NULL OR c.domation_subscriber_id = '')
        ")->execute([$wsId]);
    } catch (Throwable $e) {
        error_log("ensureAllCrmContactsSyncedForFilter warning: " . $e->getMessage());
    }
}

function buildSegmentWhereClause($criteriaJson, $workspaceId, $segmentId = null)
{
    global $pdo;
    try {
        if (empty($criteriaJson)) {
            return ['sql' => '1=1', 'params' => []];
        }

        $groups = is_array($criteriaJson) ? $criteriaJson : json_decode((string)$criteriaJson, true);
        if (!$groups || !is_array($groups)) {
            return ['sql' => '1=1', 'params' => []];
        }

        // Normalize wrapper `{ logic: 'AND'|'OR', groups: [...] }` or single-group `{ conditions: [...] }`
        $topLogic = 'OR';
        if (isset($groups['groups']) && is_array($groups['groups'])) {
            $topLogic = strtoupper(trim((string)($groups['logic'] ?? 'OR'))) === 'AND' ? 'AND' : 'OR';
            $groups = $groups['groups'];
        } elseif (isset($groups['conditions']) && is_array($groups['conditions'])) {
            $groups = [$groups];
        }

        $groupSqls = [];
        $allParams = [];

        foreach ($groups as $group) {
            if (empty($group['conditions']) || !is_array($group['conditions']))
                continue;

            $groupLogic = strtoupper(trim((string)($group['logic'] ?? 'AND'))) === 'OR' ? 'OR' : 'AND';
            $condSqls = [];
            foreach ($group['conditions'] as $cond) {
                $field = trim((string)($cond['field'] ?? ''));
                $op = trim((string)($cond['operator'] ?? 'is'));
                $val = $cond['value'] ?? '';
                if (is_array($val)) {
                    $val = implode(',', array_map('strval', $val));
                } else {
                    $val = trim((string)$val);
                }

                $colName = '';

                if (strpos($field, 'stats.') === 0) {
                    $statKey = str_replace('stats.', '', $field);
                    if ($statKey == 'emailsOpened')
                        $colName = 's.stats_opened';
                    else if ($statKey == 'linksClicked')
                        $colName = 's.stats_clicked';
                    else if ($statKey == 'emailsSent')
                        $colName = 's.stats_sent';
                    else
                        continue;
                } else if ($field === 'tags' || $field === 'crm_tags' || $field === 'tag') {
                    if ($op === 'contains' || $op === 'equals' || $op === 'is') {
                        $condSqls[] = "(EXISTS (SELECT 1 FROM subscriber_tags st JOIN tags t_sub ON st.tag_id = t_sub.id WHERE st.subscriber_id = s.id AND (t_sub.id = ? OR t_sub.name LIKE ?)) OR EXISTS (SELECT 1 FROM contacts c_tg WHERE c_tg.id = s.contact_id AND c_tg.deleted_at IS NULL AND c_tg.tags LIKE ?))";
                        $allParams[] = $val;
                        $allParams[] = '%' . $val . '%';
                        $allParams[] = '%' . $val . '%';
                    } else if ($op === 'not_contains' || $op === 'is_not') {
                        $condSqls[] = "(NOT EXISTS (SELECT 1 FROM subscriber_tags st JOIN tags t_sub ON st.tag_id = t_sub.id WHERE st.subscriber_id = s.id AND (t_sub.id = ? OR t_sub.name LIKE ?)) AND NOT EXISTS (SELECT 1 FROM contacts c_tg WHERE c_tg.id = s.contact_id AND c_tg.deleted_at IS NULL AND c_tg.tags LIKE ?))";
                        $allParams[] = $val;
                        $allParams[] = '%' . $val . '%';
                        $allParams[] = '%' . $val . '%';
                    } else if ($op === 'is_set' || $op === 'is_not_empty') {
                        $condSqls[] = "(EXISTS (SELECT 1 FROM subscriber_tags st WHERE st.subscriber_id = s.id) OR EXISTS (SELECT 1 FROM contacts c_tg WHERE c_tg.id = s.contact_id AND c_tg.deleted_at IS NULL AND c_tg.tags IS NOT NULL AND c_tg.tags != '' AND c_tg.tags != '[]'))";
                    } else if ($op === 'is_not_set' || $op === 'is_empty') {
                        $condSqls[] = "(NOT EXISTS (SELECT 1 FROM subscriber_tags st WHERE st.subscriber_id = s.id) AND NOT EXISTS (SELECT 1 FROM contacts c_tg WHERE c_tg.id = s.contact_id AND c_tg.deleted_at IS NULL AND c_tg.tags IS NOT NULL AND c_tg.tags != '' AND c_tg.tags != '[]'))";
                    }
                    continue;
                } else if ($field === 'list' || $field === 'list_id') {
                    if ($op === 'not_contains' || $op === 'is_not' || $op === 'not_in_list') {
                        $condSqls[] = "NOT EXISTS (SELECT 1 FROM subscriber_lists ls JOIN lists l_sub ON ls.list_id = l_sub.id WHERE ls.subscriber_id = s.id AND l_sub.workspace_id = ? AND (l_sub.id = ? OR l_sub.name LIKE ?))";
                        $allParams[] = $workspaceId;
                        $allParams[] = $val;
                        $allParams[] = '%' . $val . '%';
                    } else if ($op === 'is_set' || $op === 'is_not_empty') {
                        $condSqls[] = "EXISTS (SELECT 1 FROM subscriber_lists ls WHERE ls.subscriber_id = s.id)";
                    } else if ($op === 'is_not_set' || $op === 'is_empty') {
                        $condSqls[] = "NOT EXISTS (SELECT 1 FROM subscriber_lists ls WHERE ls.subscriber_id = s.id)";
                    } else {
                        $condSqls[] = "EXISTS (SELECT 1 FROM subscriber_lists ls JOIN lists l_sub ON ls.list_id = l_sub.id WHERE ls.subscriber_id = s.id AND l_sub.workspace_id = ? AND (l_sub.id = ? OR l_sub.name LIKE ?))";
                        $allParams[] = $workspaceId;
                        $allParams[] = $val;
                        $allParams[] = '%' . $val . '%';
                    }
                    continue;
                } else if ($field === 'lastActivityDays' || $field === 'last_activity_days') {
                    $days = max(0, (int) $val);
                    if ($op === 'greater_than' || $op === 'greater_than_or_equal') {
                        $condSqls[] = "COALESCE(s.last_activity_at, s.joined_at, s.created_at) < DATE_SUB(NOW(), INTERVAL ? DAY)";
                        $allParams[] = $days;
                    } else {
                        $condSqls[] = "COALESCE(s.last_activity_at, s.joined_at, s.created_at) >= DATE_SUB(NOW(), INTERVAL ? DAY)";
                        $allParams[] = $days;
                    }
                    continue;
                } else if ($field === 'web_activity' || $field === 'web_page_visited') {
                    if ($op === 'not_contains' || $op === 'is_not_set' || $op === 'is_empty' || $op === 'is_not') {
                        $condSqls[] = "NOT EXISTS (SELECT 1 FROM subscriber_activity sa WHERE sa.subscriber_id = s.id AND sa.workspace_id = ? AND sa.type LIKE 'web_%' AND (sa.details LIKE ? OR sa.reference_name LIKE ?))";
                    } else {
                        $condSqls[] = "EXISTS (SELECT 1 FROM subscriber_activity sa WHERE sa.subscriber_id = s.id AND sa.workspace_id = ? AND sa.type LIKE 'web_%' AND (sa.details LIKE ? OR sa.reference_name LIKE ?))";
                    }
                    $allParams[] = $workspaceId;
                    $allParams[] = '%' . $val . '%';
                    $allParams[] = '%' . $val . '%';
                    continue;
                } else if ($field === 'activity_history') {
                    $actType = trim((string)($cond['activity_type'] ?? ($cond['type'] ?? $val)));
                    $refId = trim((string)($cond['reference_id'] ?? ($cond['campaign_id'] ?? ($cond['flow_id'] ?? ''))));
                    $byUserId = (int)($cond['by_user_id'] ?? ($cond['user_id'] ?? 0));
                    $isNeg = in_array($op, ['not_contains', 'is_not', 'is_empty', 'is_not_set', 'has_not_done'], true);

                    $subActSql = "SELECT 1 FROM subscriber_activity sa WHERE sa.subscriber_id = s.id AND sa.workspace_id = ?";
                    $subActParams = [$workspaceId];
                    if ($actType !== '' && $actType !== 'any') {
                        $subActSql .= " AND (sa.type = ? OR sa.reference_name LIKE ? OR sa.details LIKE ?)";
                        $subActParams[] = $actType;
                        $subActParams[] = '%' . $actType . '%';
                        $subActParams[] = '%' . $actType . '%';
                    }
                    if ($refId !== '') {
                        $subActSql .= " AND (sa.reference_id = ? OR sa.campaign_id = ? OR sa.flow_id = ?)";
                        $subActParams[] = $refId;
                        $subActParams[] = $refId;
                        $subActParams[] = $refId;
                    }

                    $crmActSql = "SELECT 1 FROM activities a_h WHERE s.contact_id IS NOT NULL AND (a_h.contact_id = s.contact_id OR (a_h.related_type IN ('contact', 'lead') AND a_h.related_id = s.contact_id)) AND a_h.deleted_at IS NULL";
                    $crmActParams = [];
                    if ($actType !== '' && $actType !== 'any') {
                        $crmActSql .= " AND (a_h.type = ? OR a_h.subject LIKE ? OR a_h.body LIKE ?)";
                        $crmActParams[] = $actType;
                        $crmActParams[] = '%' . $actType . '%';
                        $crmActParams[] = '%' . $actType . '%';
                    }
                    if ($byUserId > 0) {
                        $crmActSql .= " AND (a_h.created_by = ? OR a_h.user_id = ?)";
                        $crmActParams[] = $byUserId;
                        $crmActParams[] = $byUserId;
                    }

                    if ($byUserId > 0) {
                        // Filter specifically on CRM staff interaction
                        $condSqls[] = ($isNeg ? "NOT EXISTS ($crmActSql)" : "EXISTS ($crmActSql)");
                        $allParams = array_merge($allParams, $crmActParams);
                    } else {
                        if ($isNeg) {
                            $condSqls[] = "(NOT EXISTS ($subActSql) AND NOT EXISTS ($crmActSql))";
                        } else {
                            $condSqls[] = "(EXISTS ($subActSql) OR EXISTS ($crmActSql))";
                        }
                        $allParams = array_merge($allParams, $subActParams, $crmActParams);
                    }
                    continue;
                } else if ($field === 'crm_activity_type' || $field === 'interaction_type') {
                    $actVal = strtolower(trim($val));
                    $byUserId = (int)($cond['by_user_id'] ?? ($cond['user_id'] ?? 0));
                    $isNeg = in_array($op, ['not_contains', 'is_not', 'is_empty', 'is_not_set'], true);

                    if ($actVal === 'no_activity' || $actVal === 'uncontacted' || $op === 'is_empty' || $op === 'is_not_set') {
                        $condSqls[] = "(s.contact_id IS NULL OR (NOT EXISTS (SELECT 1 FROM activities a_ca WHERE (a_ca.contact_id = s.contact_id OR (a_ca.related_type IN ('contact','lead') AND a_ca.related_id = s.contact_id)) AND a_ca.deleted_at IS NULL) AND NOT EXISTS (SELECT 1 FROM notes n_ca WHERE n_ca.entity_type = 'contact' AND n_ca.entity_id = s.contact_id AND n_ca.body NOT LIKE '[Tự động]%')))";
                    } else {
                        $userClause = $byUserId > 0 ? " AND (a_ca.created_by = ? OR a_ca.user_id = ?)" : "";
                        if ($actVal === 'note') {
                            $noteUserClause = $byUserId > 0 ? " AND n_ca.user_id = ?" : "";
                            $sqlCheck = "(EXISTS (SELECT 1 FROM activities a_ca WHERE s.contact_id IS NOT NULL AND (a_ca.contact_id = s.contact_id OR (a_ca.related_type IN ('contact','lead') AND a_ca.related_id = s.contact_id)) AND a_ca.deleted_at IS NULL AND a_ca.type = 'note'{$userClause}) OR EXISTS (SELECT 1 FROM notes n_ca WHERE s.contact_id IS NOT NULL AND n_ca.entity_type = 'contact' AND n_ca.entity_id = s.contact_id AND n_ca.body NOT LIKE '[Tự động]%'{$noteUserClause}))";
                            $condSqls[] = $isNeg ? "NOT $sqlCheck" : $sqlCheck;
                            if ($byUserId > 0) {
                                $allParams[] = $byUserId;
                                $allParams[] = $byUserId;
                                $allParams[] = $byUserId;
                            }
                        } else {
                            $sqlCheck = "EXISTS (SELECT 1 FROM activities a_ca WHERE s.contact_id IS NOT NULL AND (a_ca.contact_id = s.contact_id OR (a_ca.related_type IN ('contact','lead') AND a_ca.related_id = s.contact_id)) AND a_ca.deleted_at IS NULL AND a_ca.type = ?{$userClause})";
                            $condSqls[] = $isNeg ? "NOT $sqlCheck" : $sqlCheck;
                            $allParams[] = $actVal;
                            if ($byUserId > 0) {
                                $allParams[] = $byUserId;
                                $allParams[] = $byUserId;
                            }
                        }
                    }
                    continue;
                } else if ($field === 'crm_activity_by' || $field === 'interaction_by') {
                    $isNeg = in_array($op, ['not_contains', 'is_not', 'is_empty', 'is_not_set'], true);
                    if (is_numeric($val) && (int)$val > 0) {
                        $uid = (int)$val;
                        $sqlCheck = "(EXISTS (SELECT 1 FROM activities a_by WHERE s.contact_id IS NOT NULL AND (a_by.contact_id = s.contact_id OR (a_by.related_type IN ('contact','lead') AND a_by.related_id = s.contact_id)) AND a_by.deleted_at IS NULL AND (a_by.created_by = ? OR a_by.user_id = ?)) OR EXISTS (SELECT 1 FROM notes n_by WHERE s.contact_id IS NOT NULL AND n_by.entity_type = 'contact' AND n_by.entity_id = s.contact_id AND n_by.user_id = ?))";
                        $condSqls[] = $isNeg ? "NOT $sqlCheck" : $sqlCheck;
                        array_push($allParams, $uid, $uid, $uid);
                    } else if ($val !== '') {
                        $likeU = '%' . $val . '%';
                        $sqlCheck = "EXISTS (SELECT 1 FROM activities a_by JOIN users u_by ON (u_by.id = a_by.created_by OR u_by.id = a_by.user_id) WHERE s.contact_id IS NOT NULL AND (a_by.contact_id = s.contact_id OR (a_by.related_type IN ('contact','lead') AND a_by.related_id = s.contact_id)) AND a_by.deleted_at IS NULL AND (u_by.full_name LIKE ? OR u_by.email LIKE ?))";
                        $condSqls[] = $isNeg ? "NOT $sqlCheck" : $sqlCheck;
                        array_push($allParams, $likeU, $likeU);
                    }
                    continue;
                } else if ($field === 'has_email') {
                    $wantEmail = ($val === '' || in_array(strtolower($val), ['1', 'true', 'yes'], true)) && !in_array($op, ['is_not', 'is_empty', 'is_not_set'], true);
                    $realEmailCond = "(s.email IS NOT NULL AND TRIM(s.email) != '' AND s.email NOT LIKE '%@no-email.domation' AND s.email NOT LIKE '%@zalo.me' AND s.email NOT LIKE '%@zalo-oa.vn' AND s.email NOT LIKE '%@meta.local' AND s.email NOT LIKE '%@facebook.com')";
                    $condSqls[] = $wantEmail ? $realEmailCond : "NOT $realEmailCond";
                    continue;
                } else if ($field === 'has_phone') {
                    $wantPhone = ($val === '' || in_array(strtolower($val), ['1', 'true', 'yes'], true)) && !in_array($op, ['is_not', 'is_empty', 'is_not_set'], true);
                    $realPhoneCond = "((s.phone_number IS NOT NULL AND TRIM(s.phone_number) != '') OR (s.phone IS NOT NULL AND TRIM(s.phone) != ''))";
                    $condSqls[] = $wantPhone ? $realPhoneCond : "NOT $realPhoneCond";
                    continue;
                } else if ($field === 'crm_stage_id' || $field === 'crm_stage' || $field === 'stage_id' || $field === 'pipeline_status' || $field === 'crm_pipeline_status') {
                    if ($op === 'is_empty' || $op === 'is_not_set') {
                        $condSqls[] = "((s.stage_id IS NULL OR s.stage_id = 0) AND (s.pipeline_status IS NULL OR s.pipeline_status = ''))";
                    } else if ($op === 'is_not_empty' || $op === 'is_set') {
                        $condSqls[] = "((s.stage_id IS NOT NULL AND s.stage_id > 0) OR (s.pipeline_status IS NOT NULL AND s.pipeline_status != ''))";
                    } else if ($val !== '') {
                        $isNeg = in_array($op, ['is_not', 'not_contains', 'not_equals'], true);
                        $tokens = array_values(array_filter(array_map('trim', explode(',', $val)), fn($t) => $t !== ''));
                        $stOrs = [];
                        foreach ($tokens as $tok) {
                            if (is_numeric($tok)) {
                                $sidInt = (int)$tok;
                                $stOrs[] = "(s.stage_id = ? OR EXISTS (SELECT 1 FROM contacts c_st LEFT JOIN pipeline_stages ps_st ON ps_st.id = c_st.stage_id WHERE c_st.id = s.contact_id AND c_st.deleted_at IS NULL AND (c_st.stage_id = ? OR ps_st.order_index = ?)))";
                                array_push($allParams, $sidInt, $sidInt, max(0, $sidInt - 1));
                            } else {
                                $likeSt = '%' . $tok . '%';
                                $stOrs[] = "(s.pipeline_status = ? OR s.pipeline_status LIKE ? OR EXISTS (SELECT 1 FROM contacts c_st LEFT JOIN pipeline_stages ps_st ON ps_st.id = c_st.stage_id WHERE c_st.id = s.contact_id AND c_st.deleted_at IS NULL AND (c_st.pipeline_status = ? OR ps_st.system_slug = ? OR ps_st.name LIKE ?)))";
                                array_push($allParams, $tok, $likeSt, $tok, $tok, $likeSt);
                            }
                        }
                        if (!empty($stOrs)) {
                            $combined = '(' . implode(' OR ', $stOrs) . ')';
                            $condSqls[] = $isNeg ? "NOT $combined" : $combined;
                        }
                    }
                    continue;
                } else if ($field === 'crm_owner_id' || $field === 'owner_id') {
                    if ($op === 'is_empty' || $op === 'is_not_set' || in_array(strtolower($val), ['unassigned', 'none', 'null', '0'], true)) {
                        $condSqls[] = "((s.owner_id IS NULL OR s.owner_id = 0) AND NOT EXISTS (SELECT 1 FROM contacts c_ow WHERE c_ow.id = s.contact_id AND c_ow.deleted_at IS NULL AND c_ow.owner_id IS NOT NULL AND c_ow.owner_id > 0))";
                    } else if ($op === 'is_not_empty' || $op === 'is_set') {
                        $condSqls[] = "((s.owner_id IS NOT NULL AND s.owner_id > 0) OR EXISTS (SELECT 1 FROM contacts c_ow WHERE c_ow.id = s.contact_id AND c_ow.deleted_at IS NULL AND c_ow.owner_id IS NOT NULL AND c_ow.owner_id > 0))";
                    } else if ($val !== '') {
                        $isNeg = in_array($op, ['is_not', 'not_contains', 'not_equals'], true);
                        if (is_numeric($val)) {
                            $oid = (int)$val;
                            $sqlOwn = "(s.owner_id = ? OR EXISTS (SELECT 1 FROM contacts c_ow WHERE c_ow.id = s.contact_id AND c_ow.deleted_at IS NULL AND (c_ow.owner_id = ? OR FIND_IN_SET(?, COALESCE(c_ow.collaborator_ids, '')) > 0)))";
                            $condSqls[] = $isNeg ? "NOT $sqlOwn" : $sqlOwn;
                            array_push($allParams, $oid, $oid, (string)$oid);
                        } else {
                            $likeOwn = '%' . $val . '%';
                            $sqlOwn = "(s.salesperson LIKE ? OR EXISTS (SELECT 1 FROM contacts c_ow JOIN users u_ow ON u_ow.id = c_ow.owner_id WHERE c_ow.id = s.contact_id AND c_ow.deleted_at IS NULL AND (u_ow.full_name LIKE ? OR u_ow.email LIKE ?)))";
                            $condSqls[] = $isNeg ? "NOT $sqlOwn" : $sqlOwn;
                            array_push($allParams, $likeOwn, $likeOwn, $likeOwn);
                        }
                    }
                    continue;
                } else if ($field === 'crm_deposit_status' || $field === 'deposit_status') {
                    $depStatus = strtolower(trim((string)$val));
                    if ($depStatus === 'approved' || $depStatus === 'has_approved_deposit') {
                        $condSqls[] = "EXISTS (SELECT 1 FROM deposits d WHERE d.contact_id = s.contact_id AND d.status IN ('approved', 'completed'))";
                    } else if ($depStatus === 'pending' || $depStatus === 'pending_deposit') {
                        $condSqls[] = "EXISTS (SELECT 1 FROM deposits d WHERE d.contact_id = s.contact_id AND d.status = 'pending')";
                    } else if ($depStatus === 'has_deposit' || $op === 'is_not_empty' || $op === 'is_set') {
                        $condSqls[] = "EXISTS (SELECT 1 FROM deposits d WHERE d.contact_id = s.contact_id AND d.status NOT IN ('cancelled', 'rejected'))";
                    } else if ($depStatus === 'none' || $depStatus === 'no_deposit' || $op === 'is_empty' || $op === 'is_not_set') {
                        $condSqls[] = "(s.contact_id IS NULL OR NOT EXISTS (SELECT 1 FROM deposits d WHERE d.contact_id = s.contact_id AND d.status NOT IN ('cancelled', 'rejected')))";
                    }
                    continue;
                } else if ($field === 'crm_deposit_amount' || $field === 'deposit_amount') {
                    $colName = "(SELECT COALESCE(SUM(d.price), 0) FROM deposits d WHERE d.contact_id = s.contact_id AND d.status IN ('approved', 'completed'))";
                } else if ($field === 'crm_expected_revenue' || $field === 'expected_revenue') {
                    $colName = "(SELECT COALESCE(c.expected_revenue, 0) FROM contacts c WHERE c.id = s.contact_id AND c.deleted_at IS NULL LIMIT 1)";
                } else if ($field === 'crm_temperature' || $field === 'temperature' || $field === 'lead_temperature') {
                    $colName = "(SELECT COALESCE(NULLIF(c.lead_temperature, ''), c.temperature) FROM contacts c WHERE c.id = s.contact_id AND c.deleted_at IS NULL LIMIT 1)";
                } else if ($field === 'crm_lead_status' || $field === 'lead_status') {
                    $colName = "COALESCE(NULLIF(s.lead_status, ''), (SELECT c.lead_status FROM contacts c WHERE c.id = s.contact_id AND c.deleted_at IS NULL LIMIT 1), 'active')";
                } else if ($field === 'crm_program' || $field === 'program') {
                    $colName = "COALESCE(NULLIF(s.program, ''), (SELECT c.program FROM contacts c WHERE c.id = s.contact_id AND c.deleted_at IS NULL LIMIT 1))";
                } else if ($field === 'crm_branch_id' || $field === 'branch_id') {
                    if (is_numeric($val) && (int)$val > 0) {
                        $isNeg = in_array($op, ['is_not', 'not_contains', 'not_equals'], true);
                        $sqlBr = "EXISTS (SELECT 1 FROM contacts c_br JOIN users u_br ON u_br.id = c_br.owner_id WHERE c_br.id = s.contact_id AND c_br.deleted_at IS NULL AND u_br.branch_id = ?)";
                        $condSqls[] = $isNeg ? "NOT $sqlBr" : $sqlBr;
                        $allParams[] = (int)$val;
                        continue;
                    } else {
                        $colName = "COALESCE(NULLIF(s.city, ''), (SELECT c.city FROM contacts c WHERE c.id = s.contact_id AND c.deleted_at IS NULL LIMIT 1))";
                    }
                } elseif ($field === 'erp_is_student') {
                    $vLower = strtolower(trim((string)$val));
                    $wantStudent = in_array($vLower, ['yes', '1', 'true', 'student', 'enrolled', 'hoc_vien'], true);
                    if (in_array($op, ['is_not', 'not_equals'], true)) {
                        $wantStudent = !$wantStudent;
                    }
                    $studentCheckSql = "EXISTS (
                        SELECT 1 FROM contacts c
                        LEFT JOIN pipeline_stages ps ON ps.id = c.stage_id
                        WHERE c.id = s.contact_id AND c.deleted_at IS NULL
                          AND (
                              c.status = 'customer'
                              OR LOWER(COALESCE(c.pipeline_status, '')) IN ('enrolled', 'hoc_vien', 'dong_deal', 'thanh_cong', 'won')
                              OR (c.student_id IS NOT NULL AND TRIM(c.student_id) != '')
                              OR (c.study_status IS NOT NULL AND TRIM(c.study_status) != '')
                              OR ps.system_slug IN ('enrolled', 'hoc_vien')
                              OR ps.is_won = 1
                          )
                    )";
                    $condSqls[] = $wantStudent ? $studentCheckSql : "NOT $studentCheckSql";
                    continue;
                } elseif ($field === 'erp_student_status') {
                    if ($op === 'is_empty') {
                        $condSqls[] = "NOT EXISTS (SELECT 1 FROM contacts c WHERE c.id = s.contact_id AND c.deleted_at IS NULL AND c.study_status IS NOT NULL AND TRIM(c.study_status) != '')";
                        continue;
                    }
                    if ($op === 'is_not_empty') {
                        $condSqls[] = "EXISTS (SELECT 1 FROM contacts c WHERE c.id = s.contact_id AND c.deleted_at IS NULL AND c.study_status IS NOT NULL AND TRIM(c.study_status) != '')";
                        continue;
                    }
                    $vLower = strtolower(trim((string)$val));
                    $negate = in_array($op, ['is_not', 'not_equals'], true);
                    if (in_array($vLower, ['studying', 'dang_hoc', 'active'], true)) {
                        $sqlExpr = "EXISTS (
                            SELECT 1 FROM contacts c
                            LEFT JOIN pipeline_stages ps ON ps.id = c.stage_id
                            WHERE c.id = s.contact_id AND c.deleted_at IS NULL
                              AND (
                                  LOWER(COALESCE(c.study_status, '')) IN ('studying', 'dang_hoc', 'đang học', 'active')
                                  OR (
                                      (c.study_status IS NULL OR TRIM(c.study_status) = '')
                                      AND (
                                          c.status = 'customer'
                                          OR (c.student_id IS NOT NULL AND TRIM(c.student_id) != '')
                                          OR ps.system_slug IN ('enrolled', 'hoc_vien')
                                          OR ps.is_won = 1
                                      )
                                  )
                              )
                        )";
                    } elseif (in_array($vLower, ['completed', 'graduated', 'hoan_thanh', 'tot_nghiep'], true)) {
                        $sqlExpr = "EXISTS (
                            SELECT 1 FROM contacts c
                            WHERE c.id = s.contact_id AND c.deleted_at IS NULL
                              AND LOWER(COALESCE(c.study_status, '')) IN ('completed', 'graduated', 'hoan_thanh', 'hoàn thành', 'tot_nghiep', 'tốt nghiệp')
                        )";
                    } elseif (in_array($vLower, ['reserved', 'deferred', 'bao_luu'], true)) {
                        $sqlExpr = "EXISTS (
                            SELECT 1 FROM contacts c
                            WHERE c.id = s.contact_id AND c.deleted_at IS NULL
                              AND LOWER(COALESCE(c.study_status, '')) IN ('reserved', 'deferred', 'bao_luu', 'bảo lưu')
                        )";
                    } elseif (in_array($vLower, ['suspended', 'tam_ngung'], true)) {
                        $sqlExpr = "EXISTS (
                            SELECT 1 FROM contacts c
                            WHERE c.id = s.contact_id AND c.deleted_at IS NULL
                              AND LOWER(COALESCE(c.study_status, '')) IN ('suspended', 'tam_ngung', 'tạm ngưng')
                        )";
                    } elseif (in_array($vLower, ['dropped', 'bo_hoc', 'nghi_hoc'], true)) {
                        $sqlExpr = "EXISTS (
                            SELECT 1 FROM contacts c
                            WHERE c.id = s.contact_id AND c.deleted_at IS NULL
                              AND LOWER(COALESCE(c.study_status, '')) IN ('dropped', 'bo_hoc', 'bỏ học', 'nghi_hoc', 'nghỉ học')
                        )";
                    } else {
                        $sqlExpr = "EXISTS (
                            SELECT 1 FROM contacts c
                            WHERE c.id = s.contact_id AND c.deleted_at IS NULL
                              AND LOWER(COALESCE(c.study_status, '')) = ?
                        )";
                        $allParams[] = $vLower;
                    }
                    $condSqls[] = $negate ? "NOT $sqlExpr" : $sqlExpr;
                    continue;
                } elseif ($field === 'erp_class_id' || $field === 'erp_class_name') {
                    if ($op === 'is_empty') {
                        $condSqls[] = "((s.program IS NULL OR TRIM(s.program) = '') AND NOT EXISTS (SELECT 1 FROM contacts c WHERE c.id = s.contact_id AND c.deleted_at IS NULL AND ((c.project_id IS NOT NULL AND c.project_id > 0) OR (c.program IS NOT NULL AND TRIM(c.program) != ''))))";
                        continue;
                    }
                    if ($op === 'is_not_empty') {
                        $condSqls[] = "((s.program IS NOT NULL AND TRIM(s.program) != '') OR EXISTS (SELECT 1 FROM contacts c WHERE c.id = s.contact_id AND c.deleted_at IS NULL AND ((c.project_id IS NOT NULL AND c.project_id > 0) OR (c.program IS NOT NULL AND TRIM(c.program) != ''))))";
                        continue;
                    }
                    $negate = in_array($op, ['is_not', 'not_equals', 'not_contains'], true);
                    if (is_numeric($val) && (int)$val > 0) {
                        $pid = (int)$val;
                        $sqlExpr = "(
                            EXISTS (
                                SELECT 1 FROM contacts c
                                LEFT JOIN projects pr ON pr.id = c.project_id
                                WHERE c.id = s.contact_id AND c.deleted_at IS NULL
                                  AND (
                                      c.project_id = ?
                                      OR (c.program IS NOT NULL AND c.program = (SELECT pr2.name FROM projects pr2 WHERE pr2.id = ? LIMIT 1))
                                  )
                            )
                            OR (s.program IS NOT NULL AND s.program = (SELECT pr3.name FROM projects pr3 WHERE pr3.id = ? LIMIT 1))
                        )";
                        $allParams[] = $pid;
                        $allParams[] = $pid;
                        $allParams[] = $pid;
                    } else {
                        $likeVal = '%' . trim((string)$val) . '%';
                        $sqlExpr = "(
                            s.program LIKE ?
                            OR EXISTS (
                                SELECT 1 FROM contacts c
                                LEFT JOIN projects pr ON pr.id = c.project_id
                                WHERE c.id = s.contact_id AND c.deleted_at IS NULL
                                  AND (c.program LIKE ? OR pr.name LIKE ? OR pr.code LIKE ?)
                            )
                        )";
                        $allParams[] = $likeVal;
                        $allParams[] = $likeVal;
                        $allParams[] = $likeVal;
                        $allParams[] = $likeVal;
                    }
                    $condSqls[] = $negate ? "NOT $sqlExpr" : $sqlExpr;
                    continue;
                } elseif ($field === 'erp_tuition_status') {
                    $vLower = strtolower(trim((string)$val));
                    $negate = in_array($op, ['is_not', 'not_equals'], true);
                    $hasMilestonesTable = !empty(getCrmTableColumnsCache($pdo, 'deposit_milestones'));
                    $hasInvoicesTable = !empty(getCrmTableColumnsCache($pdo, 'invoices'));

                    $overdueParts = [];
                    if ($hasMilestonesTable) {
                        $overdueParts[] = "EXISTS (
                            SELECT 1 FROM deposit_milestones dm
                            INNER JOIN deposits dep ON dep.id = dm.deposit_id
                            WHERE dep.contact_id = s.contact_id AND dep.status != 'rejected'
                              AND dm.status NOT IN ('paid', 'approved', 'completed', 'cancelled', 'rejected')
                              AND dm.expected_pay_date IS NOT NULL AND dm.expected_pay_date < CURDATE()
                        )";
                    }
                    if ($hasInvoicesTable) {
                        $overdueParts[] = "EXISTS (
                            SELECT 1 FROM invoices inv
                            WHERE inv.contact_id = s.contact_id AND inv.deleted_at IS NULL
                              AND inv.status NOT IN ('paid', 'cancelled')
                              AND (inv.status = 'overdue' OR (inv.due_date IS NOT NULL AND inv.due_date < CURDATE() AND COALESCE(inv.total, 0) > COALESCE(inv.amount_paid, 0)))
                        )";
                    }
                    $overdueSql = !empty($overdueParts) ? '(' . implode(' OR ', $overdueParts) . ')' : '1=0';

                    $debtParts = [
                        "EXISTS (SELECT 1 FROM deposits dep WHERE dep.contact_id = s.contact_id AND dep.status = 'pending')",
                        "EXISTS (SELECT 1 FROM contacts c WHERE c.id = s.contact_id AND c.deleted_at IS NULL AND COALESCE(c.expected_revenue, 0) > 0 AND COALESCE(c.expected_revenue, 0) > COALESCE(c.total_spent, 0))"
                    ];
                    if ($hasMilestonesTable) {
                        $debtParts[] = "EXISTS (
                            SELECT 1 FROM deposit_milestones dm
                            INNER JOIN deposits dep ON dep.id = dm.deposit_id
                            WHERE dep.contact_id = s.contact_id AND dep.status != 'rejected'
                              AND dm.status NOT IN ('paid', 'approved', 'completed', 'cancelled', 'rejected')
                              AND COALESCE(dm.expected_amount, 0) > COALESCE(dm.actual_amount, 0)
                        )";
                    }
                    if ($hasInvoicesTable) {
                        $debtParts[] = "EXISTS (
                            SELECT 1 FROM invoices inv
                            WHERE inv.contact_id = s.contact_id AND inv.deleted_at IS NULL
                              AND inv.status IN ('unpaid', 'partial', 'partially_paid', 'overdue', 'pending', 'sent')
                              AND COALESCE(inv.total, 0) > COALESCE(inv.amount_paid, 0)
                        )";
                    }
                    $hasDebtSql = '(' . implode(' OR ', $debtParts) . ')';

                    $paidParts = [
                        "EXISTS (SELECT 1 FROM deposits dep WHERE dep.contact_id = s.contact_id AND dep.status IN ('approved', 'completed'))",
                        "EXISTS (SELECT 1 FROM contacts c WHERE c.id = s.contact_id AND c.deleted_at IS NULL AND COALESCE(c.total_spent, 0) > 0 AND COALESCE(c.total_spent, 0) >= COALESCE(c.expected_revenue, 0))"
                    ];
                    if ($hasInvoicesTable) {
                        $paidParts[] = "EXISTS (SELECT 1 FROM invoices inv WHERE inv.contact_id = s.contact_id AND inv.deleted_at IS NULL AND inv.status = 'paid')";
                    }
                    $hasPaidAnySql = '(' . implode(' OR ', $paidParts) . ')';

                    if ($vLower === 'overdue') {
                        $sqlExpr = $overdueSql;
                    } elseif (in_array($vLower, ['has_debt', 'partial', 'debt'], true)) {
                        $sqlExpr = $hasDebtSql;
                    } elseif (in_array($vLower, ['paid', 'paid_full'], true)) {
                        $sqlExpr = "($hasPaidAnySql AND NOT $hasDebtSql)";
                    } else {
                        // unpaid / no_deposit
                        $sqlExpr = "NOT $hasPaidAnySql";
                    }
                    $condSqls[] = $negate ? "NOT ($sqlExpr)" : $sqlExpr;
                    continue;
                } elseif ($field === 'erp_deal_status') {
                    $vLower = strtolower(trim((string)$val));
                    $negate = in_array($op, ['is_not', 'not_equals'], true);
                    if ($vLower === 'won') {
                        $sqlExpr = "EXISTS (
                            SELECT 1 FROM deals d
                            LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
                            WHERE d.contact_id = s.contact_id AND d.deleted_at IS NULL
                              AND (ps.is_won = 1 OR ps.system_slug IN ('enrolled', 'hoc_vien', 'dong_deal', 'thanh_cong', 'won'))
                        )";
                    } elseif ($vLower === 'lost') {
                        $sqlExpr = "EXISTS (
                            SELECT 1 FROM deals d
                            LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
                            WHERE d.contact_id = s.contact_id AND d.deleted_at IS NULL
                              AND (ps.is_lost = 1 OR ps.system_slug IN ('lost', 'rejected', 'churned'))
                        )";
                    } elseif (in_array($vLower, ['no_deal', 'none'], true)) {
                        $sqlExpr = "NOT EXISTS (SELECT 1 FROM deals d WHERE d.contact_id = s.contact_id AND d.deleted_at IS NULL)";
                    } else {
                        // open
                        $sqlExpr = "EXISTS (
                            SELECT 1 FROM deals d
                            LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
                            WHERE d.contact_id = s.contact_id AND d.deleted_at IS NULL
                              AND COALESCE(ps.is_won, 0) = 0
                              AND COALESCE(ps.is_lost, 0) = 0
                              AND COALESCE(ps.system_slug, '') NOT IN ('enrolled', 'hoc_vien', 'dong_deal', 'thanh_cong', 'won', 'lost', 'rejected', 'churned')
                        )";
                    }
                    $condSqls[] = $negate ? "NOT ($sqlExpr)" : $sqlExpr;
                    continue;
                } elseif ($field === 'erp_deal_value') {
                    $colName = "COALESCE((SELECT SUM(d.value) FROM deals d WHERE d.contact_id = s.contact_id AND d.deleted_at IS NULL), 0)";
                } elseif ($field === 'erp_sla_uncontacted_hours') {
                    $hours = max(0, (int)$val);
                    $cmpOp = '>=';
                    if ($op === 'greater_than') {
                        $cmpOp = '>';
                    } elseif ($op === 'less_than') {
                        $cmpOp = '<';
                    } elseif ($op === 'less_than_or_equal') {
                        $cmpOp = '<=';
                    } elseif ($op === 'equals' || $op === 'is') {
                        $cmpOp = '>=';
                    }
                    $condSqls[] = "EXISTS (
                        SELECT 1 FROM contacts c
                        WHERE c.id = s.contact_id AND c.deleted_at IS NULL
                          AND c.last_contact IS NULL
                          AND NOT EXISTS (
                              SELECT 1 FROM activities a
                              WHERE (a.contact_id = c.id OR (a.related_type IN ('contact', 'lead') AND a.related_id = c.id))
                                AND a.deleted_at IS NULL
                          )
                          AND TIMESTAMPDIFF(HOUR, c.created_at, NOW()) $cmpOp ?
                    )";
                    $allParams[] = $hours;
                    continue;
                } elseif ($field === 'erp_ticket_status') {
                    $vLower = strtolower(trim((string)$val));
                    $negate = in_array($op, ['is_not', 'not_equals'], true);
                    if (in_array($vLower, ['has_open_ticket', 'has_open', 'open'], true)) {
                        $sqlExpr = "EXISTS (SELECT 1 FROM tickets tk WHERE tk.contact_id = s.contact_id AND tk.status IN ('open', 'in_progress', 'waiting'))";
                    } elseif ($vLower === 'in_progress') {
                        $sqlExpr = "EXISTS (SELECT 1 FROM tickets tk WHERE tk.contact_id = s.contact_id AND tk.status = 'in_progress')";
                    } elseif (in_array($vLower, ['resolved', 'closed'], true)) {
                        $sqlExpr = "EXISTS (SELECT 1 FROM tickets tk WHERE tk.contact_id = s.contact_id AND tk.status IN ('resolved', 'closed'))";
                    } else {
                        // no_ticket / none
                        $sqlExpr = "NOT EXISTS (SELECT 1 FROM tickets tk WHERE tk.contact_id = s.contact_id)";
                    }
                    $condSqls[] = $negate ? "NOT ($sqlExpr)" : $sqlExpr;
                    continue;
                } elseif ($field === 'erp_has_certificate') {
                    $vLower = strtolower(trim((string)$val));
                    $wantCert = in_array($vLower, ['yes', '1', 'true', 'has_cert', 'issued'], true);
                    if (in_array($op, ['is_not', 'not_equals'], true)) {
                        $wantCert = !$wantCert;
                    }
                    $hasCloudFiles = !empty(getCrmTableColumnsCache($pdo, 'cloud_files'));
                    $cloudSql = $hasCloudFiles
                        ? "OR EXISTS (SELECT 1 FROM cloud_files cf WHERE cf.contact_id = s.contact_id AND (LOWER(cf.name) REGEXP 'chứng chỉ|chung chi|certificate|cert|bằng tốt nghiệp' OR LOWER(COALESCE(cf.category, '')) REGEXP 'certificate|chung_chi|chứng chỉ'))"
                        : "";
                    $certCheckSql = "(
                        (JSON_UNQUOTE(JSON_EXTRACT(s.custom_attributes, '$.cert_no')) IS NOT NULL AND TRIM(JSON_UNQUOTE(JSON_EXTRACT(s.custom_attributes, '$.cert_no'))) != '')
                        OR (JSON_UNQUOTE(JSON_EXTRACT(s.custom_attributes, '$.certificate_code')) IS NOT NULL AND TRIM(JSON_UNQUOTE(JSON_EXTRACT(s.custom_attributes, '$.certificate_code'))) != '')
                        OR EXISTS (
                            SELECT 1 FROM contacts c
                            WHERE c.id = s.contact_id AND c.deleted_at IS NULL
                              AND LOWER(COALESCE(c.study_status, '')) IN ('completed', 'graduated', 'hoan_thanh', 'hoàn thành', 'tot_nghiep', 'tốt nghiệp')
                        )
                        $cloudSql
                    )";
                    $condSqls[] = $wantCert ? $certCheckSql : "NOT $certCheckSql";
                    continue;
                } else {
                    // Map camelCase / CRM keys to snake_case subscriber columns
                    $map = [
                        'firstName' => 's.first_name',
                        'lastName' => 's.last_name',
                        'email' => 's.email',
                        'phoneNumber' => 'COALESCE(NULLIF(s.phone_number, ""), s.phone)',
                        'companyName' => 'COALESCE(NULLIF(s.company_name, ""), s.company)',
                        'jobTitle' => 's.job_title',
                        'gender' => 's.gender',
                        'country' => 's.country',
                        'city' => 'COALESCE(NULLIF(s.city, ""), (SELECT c.city FROM contacts c WHERE c.id = s.contact_id AND c.deleted_at IS NULL LIMIT 1))',
                        'district' => 's.district',
                        'ward' => 's.ward',
                        'address' => 's.address',
                        'status' => 's.status',
                        'source' => 'COALESCE(NULLIF(s.source, ""), s.source_type)',
                        'source_type' => 'COALESCE(NULLIF(s.source_type, ""), s.source)',
                        'dateOfBirth' => 's.date_of_birth',
                        'anniversaryDate' => 's.anniversary_date',
                        'joinedAt' => 's.joined_at',
                        'leadScore' => 's.lead_score',
                        'verified' => 's.verified',
                        'salesperson' => 's.salesperson',
                        'lastActivity' => 'COALESCE(s.last_activity_at, s.joined_at, s.created_at)',
                        'lastActivityAt' => 'COALESCE(s.last_activity_at, s.joined_at, s.created_at)',
                        'last_activity_at' => 'COALESCE(s.last_activity_at, s.joined_at, s.created_at)',
                        'statsSent' => 's.stats_sent',
                        'stats_sent' => 's.stats_sent',
                        'statsOpened' => 's.stats_opened',
                        'stats_opened' => 's.stats_opened',
                        'statsClicked' => 's.stats_clicked',
                        'stats_clicked' => 's.stats_clicked',
                        'os' => 's.last_os',
                        'device' => 's.last_device',
                        'browser' => 's.last_browser',
                        'phone_number' => 'COALESCE(NULLIF(s.phone_number, ""), s.phone)',
                        'phone' => 'COALESCE(NULLIF(s.phone_number, ""), s.phone)',
                        'company_name' => 'COALESCE(NULLIF(s.company_name, ""), s.company)',
                        'job_title' => 's.job_title',
                        'date_of_birth' => 's.date_of_birth',
                        'anniversary_date' => 's.anniversary_date',
                        'joined_at' => 's.joined_at',
                        'lead_score' => 's.lead_score',
                        'first_name' => 's.first_name',
                        'last_name' => 's.last_name',
                        'meta_psid' => 's.meta_psid',
                        'zalo_user_id' => 's.zalo_user_id',
                        'is_zalo_follower' => 's.is_zalo_follower',
                    ];
                    $colName = $map[$field] ?? null;

                    // If not a standard column, check if it's a custom attribute
                    if (!$colName) {
                        $attrKey = ($field === 'custom_field' && !empty($cond['key'])) ? $cond['key'] : $field;
                        if (!preg_match('/^[a-zA-Z0-9_]+$/', $attrKey)) {
                            continue; // Reject field names with SQL metacharacters
                        }
                        $colName = "JSON_UNQUOTE(JSON_EXTRACT(s.custom_attributes, '$.$attrKey'))";
                    }
                }

                if (!$colName)
                    continue; // Skip invalid fields

                switch ($op) {
                    case 'contains':
                        $condSqls[] = "$colName LIKE ?";
                        $allParams[] = '%' . $val . '%';
                        break;
                    case 'not_contains':
                        $condSqls[] = "($colName IS NULL OR $colName NOT LIKE ?)";
                        $allParams[] = '%' . $val . '%';
                        break;
                    case 'equals':
                    case 'is':
                        $condSqls[] = "$colName = ?";
                        $allParams[] = $val;
                        break;
                    case 'not_equals':
                    case 'is_not':
                        $condSqls[] = "($colName IS NULL OR $colName != ?)";
                        $allParams[] = $val;
                        break;
                    case 'starts_with':
                        $condSqls[] = "$colName LIKE ?";
                        $allParams[] = $val . '%';
                        break;
                    case 'ends_with':
                        $condSqls[] = "$colName LIKE ?";
                        $allParams[] = '%' . $val;
                        break;
                    case 'greater_than':
                        $condSqls[] = "$colName > ?";
                        $allParams[] = $val;
                        break;
                    case 'greater_than_or_equal':
                        $condSqls[] = "$colName >= ?";
                        $allParams[] = $val;
                        break;
                    case 'less_than':
                        $condSqls[] = "$colName < ?";
                        $allParams[] = $val;
                        break;
                    case 'less_than_or_equal':
                        $condSqls[] = "$colName <= ?";
                        $allParams[] = $val;
                        break;
                    case 'after':
                    case 'is_after':
                        $condSqls[] = "$colName > ?";
                        $allParams[] = $val;
                        break;
                    case 'before':
                    case 'is_before':
                        $condSqls[] = "$colName < ?";
                        $allParams[] = $val;
                        break;
                    case 'on':
                    case 'is_on':
                        $condSqls[] = "DATE($colName) = ?";
                        $allParams[] = $val;
                        break;
                    case 'in_last_days':
                        $condSqls[] = "$colName >= DATE_SUB(NOW(), INTERVAL ? DAY)";
                        $allParams[] = max(0, (int)$val);
                        break;
                    case 'before_days':
                        $condSqls[] = "$colName < DATE_SUB(NOW(), INTERVAL ? DAY)";
                        $allParams[] = max(0, (int)$val);
                        break;
                    case 'is_today':
                        $condSqls[] = "DATE_FORMAT($colName, '%m-%d') = DATE_FORMAT(NOW(), '%m-%d')";
                        break;
                    case 'is_this_month':
                        $condSqls[] = "MONTH($colName) = MONTH(NOW())";
                        break;
                    case 'is_not_empty':
                    case 'is_set':
                        $condSqls[] = "($colName IS NOT NULL AND TRIM($colName) != '')";
                        break;
                    case 'is_empty':
                    case 'is_not_set':
                        $condSqls[] = "($colName IS NULL OR TRIM($colName) = '')";
                        break;
                }
            } // End conditions loop
            if (!empty($condSqls)) {
                $groupSqls[] = "(" . implode(" $groupLogic ", $condSqls) . ")";
            }
        } // End groups loop

        if (empty($groupSqls)) {
            $sql = '1=1';
        } else {
            $sql = '(' . implode(" $topLogic ", $groupSqls) . ')';
        }

        // Append exclusion logic if segmentId is provided - NULL-safe NOT EXISTS
        if ($segmentId) {
            $sql .= " AND NOT EXISTS (SELECT 1 FROM segment_exclusions se WHERE se.subscriber_id = s.id AND se.workspace_id = ? AND se.segment_id = ?)";
            $allParams[] = $workspaceId;
            $allParams[] = $segmentId;
        }

        return ['sql' => $sql, 'params' => $allParams];
    } catch (Throwable $e) {
        error_log("buildSegmentWhereClause Error: " . $e->getMessage());
        return ['sql' => '1=0', 'params' => []];
    }
}
?>
