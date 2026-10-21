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
        if (!$pdo->inTransaction()) {
            $pdo->exec("CREATE TABLE IF NOT EXISTS segment_exclusions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                workspace_id INT DEFAULT 1,
                segment_id VARCHAR(50) NOT NULL,
                subscriber_id CHAR(36) NOT NULL,
                excluded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_exclusion (workspace_id, segment_id, subscriber_id),
                INDEX idx_seg_exclusions_seg (workspace_id, segment_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        }
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

if (!function_exists('getCrmPipelineStageCatalog')) {
    /**
     * Load and cache the ordered catalog of pipeline stages with both DB `id`
     * and 1-based `step_number` (1..14) for accurate stage range resolution.
     */
    function getCrmPipelineStageCatalog(?PDO $pdo = null): array
    {
        static $catalog = null;
        if ($catalog !== null) {
            return $catalog;
        }
        if (!$pdo) {
            $pdo = $GLOBALS['pdo'] ?? null;
        }
        if (!$pdo) {
            return [];
        }
        try {
            $stmt = $pdo->query("SELECT id, name, order_index, system_slug, is_won, is_lost FROM pipeline_stages ORDER BY order_index ASC, id ASC");
            $rows = $stmt ? ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];
            $result = [];
            foreach ($rows as $idx => $r) {
                $name = trim((string)($r['name'] ?? ''));
                if (preg_match('/^0?(\d{1,2})\b/', $name, $m)) {
                    $stepNum = (int)$m[1];
                } else {
                    $stepNum = $idx + 1;
                }
                $result[] = [
                    'id'          => (int)$r['id'],
                    'name'        => $name,
                    'order_index' => (int)($r['order_index'] ?? $idx),
                    'step_number' => $stepNum,
                    'system_slug' => trim((string)($r['system_slug'] ?? '')),
                    'is_won'      => (int)($r['is_won'] ?? 0),
                    'is_lost'     => (int)($r['is_lost'] ?? 0),
                ];
            }
            $catalog = $result;
            return $catalog;
        } catch (Throwable $e) {
            $catalog = [];
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
        $GLOBALS['pdo'] = $pdo;
        if (!class_exists('DomationContactMatcher') && file_exists(__DIR__ . '/../utils/DomationContactMatcher.php')) {
            require_once __DIR__ . '/../utils/DomationContactMatcher.php';
        }
        if (class_exists('DomationContactMatcher') && method_exists('DomationContactMatcher', 'ensureColumns')) {
            DomationContactMatcher::ensureColumns($pdo);
        }

        // 1a. Link existing unlinked subscribers to contacts by domation_subscriber_id
        $pdo->prepare("
            UPDATE subscribers s
            INNER JOIN contacts c
                ON c.deleted_at IS NULL
               AND c.domation_subscriber_id = s.id
            SET s.contact_id = c.id
            WHERE s.workspace_id = ?
              AND (s.contact_id IS NULL OR s.contact_id = 0)
        ")->execute([$wsId]);

        // 1b. Link existing unlinked subscribers to contacts by indexed email
        $pdo->prepare("
            UPDATE subscribers s
            INNER JOIN contacts c
                ON c.deleted_at IS NULL
               AND c.email IS NOT NULL
               AND c.email != ''
               AND s.email = c.email
            SET s.contact_id = c.id
            WHERE s.workspace_id = ?
              AND (s.contact_id IS NULL OR s.contact_id = 0)
        ")->execute([$wsId]);

        // 2. Link existing unlinked subscribers to contacts by indexed phone
        $pdo->prepare("
            UPDATE subscribers s
            INNER JOIN contacts c
                ON c.deleted_at IS NULL
               AND c.phone IS NOT NULL
               AND c.phone != ''
               AND s.phone_number = c.phone
            SET s.contact_id = c.id
            WHERE s.workspace_id = ?
              AND (s.contact_id IS NULL OR s.contact_id = 0)
        ")->execute([$wsId]);

        // 3. Batch-insert any remaining CRM contacts that do not yet have a subscriber row
        $pdo->prepare("
            INSERT IGNORE INTO subscribers (
                id, workspace_id, contact_id, email, email_norm,
                first_name, last_name, phone_number, phone, phone_norm9,
                city, country, job_title, company_name,
                stage_id, pipeline_status, lead_status, program, owner_id, salesperson,
                status, source, joined_at, created_at, updated_at
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
                    WHEN c.status = 'customer' OR c.pipeline_status IN ('enrolled', 'hoc_vien') OR ps.is_won = 1 THEN 'customer'
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
                s.pipeline_status = COALESCE(NULLIF(c.pipeline_status, ''), ps.system_slug, s.pipeline_status, 'new_lead'),
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

        // 5. Backfill contacts.domation_subscriber_id where missing (preserve updated_at)
        $pdo->prepare("
            UPDATE contacts c
            INNER JOIN subscribers s ON s.contact_id = c.id AND s.workspace_id = ?
            SET c.domation_subscriber_id = s.id,
                c.updated_at = c.updated_at
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

        // Optimization: If top-level logic is OR and all groups are single-condition positive crm_stage_id/stage_id filters,
        // collapse them into one group with comma-separated values so MySQL executes a single IN(...) + EXISTS clause.
        if ($topLogic === 'OR' && count($groups) > 1) {
            $canCollapseStageGroups = true;
            $collapsedStageVals = [];
            foreach ($groups as $gCheck) {
                $gConds = $gCheck['conditions'] ?? [];
                if (!is_array($gConds) || count($gConds) !== 1) {
                    $canCollapseStageGroups = false;
                    break;
                }
                $c0 = $gConds[0];
                $f0 = trim((string)($c0['field'] ?? ''));
                $op0 = trim((string)($c0['operator'] ?? 'is'));
                $v0 = $c0['value'] ?? '';
                if (is_array($v0)) {
                    $v0 = implode(',', array_map('strval', $v0));
                } else {
                    $v0 = trim((string)$v0);
                }
                if (
                    !in_array($f0, ['crm_stage_id', 'crm_stage', 'stage_id', 'pipeline_status', 'crm_pipeline_status'], true) ||
                    !in_array($op0, ['is', 'equals', 'contains', 'in'], true) ||
                    $v0 === ''
                ) {
                    $canCollapseStageGroups = false;
                    break;
                }
                $collapsedStageVals[] = $v0;
            }
            if ($canCollapseStageGroups && !empty($collapsedStageVals)) {
                $groups = [[
                    'id' => $groups[0]['id'] ?? 'grp_collapsed_stages',
                    'logic' => 'AND',
                    'conditions' => [[
                        'id' => 'c_collapsed_stages',
                        'field' => 'crm_stage_id',
                        'operator' => 'is',
                        'value' => implode(',', $collapsedStageVals)
                    ]]
                ]];
            }
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
                        $rawTokens = array_values(array_filter(array_map('trim', explode(',', $val)), fn($t) => $t !== ''));
                        // Expand range tokens like "1-2", "3-12", "13-14", "31-32", "33-42", "43-44"
                        $tokens = [];
                        foreach ($rawTokens as $rt) {
                            if (preg_match('/^(\d{1,3})\s*-\s*(\d{1,3})$/', $rt, $rm)) {
                                $rStart = (int)$rm[1];
                                $rEnd = (int)$rm[2];
                                if ($rStart <= $rEnd && ($rEnd - $rStart) <= 50) {
                                    for ($rIdx = $rStart; $rIdx <= $rEnd; $rIdx++) {
                                        $tokens[] = (string)$rIdx;
                                    }
                                    continue;
                                }
                            }
                            $tokens[] = $rt;
                        }

                        $stageCatalog = getCrmPipelineStageCatalog($pdo);
                        $matchedStageIds = [];
                        $matchedStageNums = [];
                        $matchedSlugs = [];
                        $fallbackTokens = [];

                        foreach ($tokens as $tok) {
                            $tokLow = strtolower(trim($tok));
                            if (is_numeric($tok)) {
                                $num = (int)$tok;
                                if (isset($stageCatalog['by_id'][$num])) {
                                    $stMeta = $stageCatalog['by_id'][$num];
                                    $matchedStageIds[] = (int)$stMeta['id'];
                                    $matchedStageNums[] = (int)$stMeta['stage_num'];
                                    if (!empty($stMeta['slug'])) {
                                        $matchedSlugs[] = (string)$stMeta['slug'];
                                    }
                                } elseif (isset($stageCatalog['by_num'][$num])) {
                                    $stMeta = $stageCatalog['by_num'][$num];
                                    $matchedStageIds[] = (int)$stMeta['id'];
                                    $matchedStageNums[] = (int)$stMeta['stage_num'];
                                    if (!empty($stMeta['slug'])) {
                                        $matchedSlugs[] = (string)$stMeta['slug'];
                                    }
                                } else {
                                    $matchedStageIds[] = $num;
                                    if ($num >= 1 && $num <= 14) {
                                        $matchedStageNums[] = $num;
                                    }
                                }
                            } elseif (isset($stageCatalog['by_slug'][$tokLow])) {
                                $stMeta = $stageCatalog['by_slug'][$tokLow];
                                $matchedStageIds[] = (int)$stMeta['id'];
                                $matchedStageNums[] = (int)$stMeta['stage_num'];
                                $matchedSlugs[] = (string)$stMeta['slug'];
                            } else {
                                // Match by stage number prefix (e.g. "01 – New Lead") or name substring
                                $foundInCat = false;
                                if (preg_match('/^0?(\d{1,2})\b/', $tokLow, $nm) && isset($stageCatalog['by_num'][(int)$nm[1]])) {
                                    $stMeta = $stageCatalog['by_num'][(int)$nm[1]];
                                    $matchedStageIds[] = (int)$stMeta['id'];
                                    $matchedStageNums[] = (int)$stMeta['stage_num'];
                                    if (!empty($stMeta['slug'])) {
                                        $matchedSlugs[] = (string)$stMeta['slug'];
                                    }
                                    $foundInCat = true;
                                }
                                if (!$foundInCat) {
                                    foreach ($stageCatalog['by_id'] as $stMeta) {
                                        if (strpos($stMeta['name_lc'], $tokLow) !== false) {
                                            $matchedStageIds[] = (int)$stMeta['id'];
                                            $matchedStageNums[] = (int)$stMeta['stage_num'];
                                            if (!empty($stMeta['slug'])) {
                                                $matchedSlugs[] = (string)$stMeta['slug'];
                                            }
                                            $foundInCat = true;
                                        }
                                    }
                                }
                                if (!$foundInCat) {
                                    $fallbackTokens[] = $tok;
                                }
                            }
                        }

                        // Include both actual DB stage IDs (e.g. 31..44) and 1-based stage numbers (1..14) if legacy rows stored stage_num
                        $allCandidateStageIds = array_values(array_unique(array_filter(
                            array_merge($matchedStageIds, $matchedStageNums),
                            fn($v) => (int)$v > 0
                        )));
                        $matchedStageNums = array_values(array_unique($matchedStageNums));
                        $matchedSlugs = array_values(array_unique(array_filter($matchedSlugs, fn($v) => $v !== '')));

                        $includesStep1 = in_array(1, $matchedStageNums, true);
                        $includesQualifiedRange = count(array_intersect($matchedStageNums, [3, 4, 5, 6, 7, 8, 9, 10, 11, 12])) > 0;
                        $includesStep13 = in_array(13, $matchedStageNums, true);
                        $includesStep14 = in_array(14, $matchedStageNums, true);

                        if ($includesQualifiedRange && in_array(6, $matchedStageNums, true)) {
                            $matchedSlugs[] = 'nop_ho_so';
                        }
                        if ($includesStep13) {
                            $matchedSlugs = array_merge($matchedSlugs, ['deposit_tuition_payment', 'dong_le_phi_ho_so', 'dat_coc', 'won']);
                        }
                        if ($includesStep14) {
                            $matchedSlugs = array_merge($matchedSlugs, ['enrolled', 'hoc_vien']);
                        }
                        $matchedSlugs = array_values(array_unique(array_filter($matchedSlugs, fn($v) => $v !== '')));

                        $subDirectOrs = [];
                        $subDirectParams = [];
                        $contactSubOrs = [];
                        $contactSubParams = [];

                        if (!empty($allCandidateStageIds)) {
                            $phIds = implode(',', array_fill(0, count($allCandidateStageIds), '?'));
                            $subDirectOrs[] = "s.stage_id IN ($phIds)";
                            $subDirectParams = array_merge($subDirectParams, $allCandidateStageIds);

                            $contactSubOrs[] = "c_st.stage_id IN ($phIds)";
                            $contactSubParams = array_merge($contactSubParams, $allCandidateStageIds);
                        }

                        if (!empty($matchedSlugs)) {
                            $phSlugs = implode(',', array_fill(0, count($matchedSlugs), '?'));
                            $subDirectOrs[] = "((s.stage_id IS NULL OR s.stage_id = 0) AND s.pipeline_status IN ($phSlugs))";
                            $subDirectParams = array_merge($subDirectParams, $matchedSlugs);

                            $contactSubOrs[] = "((c_st.stage_id IS NULL OR c_st.stage_id = 0) AND c_st.pipeline_status IN ($phSlugs))";
                            $contactSubParams = array_merge($contactSubParams, $matchedSlugs);
                        }

                        // Step 01 – New Lead is the default stage for CRM leads that haven't been assigned a stage_id yet
                        if ($includesStep1) {
                            $contactSubOrs[] = "((c_st.stage_id IS NULL OR c_st.stage_id = 0) AND COALESCE(c_st.pipeline_status, '') IN ('', 'new_lead', 'contact_attempted') AND COALESCE(c_st.status, '') != 'customer')";
                        }

                        // Step 14 – Enrolled also includes official students / customers (`status = 'customer'`)
                        if ($includesStep14) {
                            $subDirectOrs[] = "s.status = 'customer'";
                            $contactSubOrs[] = "c_st.status = 'customer'";
                        }

                        foreach ($fallbackTokens as $fbTok) {
                            $likeFb = '%' . $fbTok . '%';
                            $subDirectOrs[] = "(s.pipeline_status = ? OR s.pipeline_status LIKE ?)";
                            array_push($subDirectParams, $fbTok, $likeFb);

                            $contactSubOrs[] = "(c_st.pipeline_status = ? OR c_st.pipeline_status LIKE ?)";
                            array_push($contactSubParams, $fbTok, $likeFb);
                        }

                        $finalStageBranches = [];
                        if (!empty($subDirectOrs)) {
                            $finalStageBranches[] = '(' . implode(' OR ', $subDirectOrs) . ')';
                            $allParams = array_merge($allParams, $subDirectParams);
                        }
                        if (!empty($contactSubOrs)) {
                            $finalStageBranches[] = "EXISTS (SELECT 1 FROM contacts c_st WHERE c_st.id = s.contact_id AND c_st.deleted_at IS NULL AND (" . implode(' OR ', $contactSubOrs) . "))";
                            $allParams = array_merge($allParams, $contactSubParams);
                        }

                        if (!empty($finalStageBranches)) {
                            $combined = '(' . implode(' OR ', $finalStageBranches) . ')';
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
                        $uColsBr = getCrmTableColumnsCache($pdo, 'users');
                        $cColsBr = getCrmTableColumnsCache($pdo, 'contacts');
                        if (isset($cColsBr['branch_id'])) {
                            $sqlBr = "EXISTS (SELECT 1 FROM contacts c_br WHERE c_br.id = s.contact_id AND c_br.deleted_at IS NULL AND c_br.branch_id = ?)";
                            $condSqls[] = $isNeg ? "NOT $sqlBr" : $sqlBr;
                            $allParams[] = (int)$val;
                        } elseif (isset($uColsBr['branch_id'])) {
                            $sqlBr = "EXISTS (SELECT 1 FROM contacts c_br JOIN users u_br ON u_br.id = c_br.owner_id WHERE c_br.id = s.contact_id AND c_br.deleted_at IS NULL AND u_br.branch_id = ?)";
                            $condSqls[] = $isNeg ? "NOT $sqlBr" : $sqlBr;
                            $allParams[] = (int)$val;
                        } else {
                            $sqlBr = "EXISTS (SELECT 1 FROM contacts c_br LEFT JOIN users u_br ON u_br.id = c_br.owner_id WHERE c_br.id = s.contact_id AND c_br.deleted_at IS NULL AND (c_br.company_id = ? OR u_br.team_id = ?))";
                            $condSqls[] = $isNeg ? "NOT $sqlBr" : $sqlBr;
                            $allParams[] = (int)$val;
                            $allParams[] = (int)$val;
                        }
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
                              AND (inv.status = 'overdue' OR (inv.due_date IS NOT NULL AND inv.due_date < CURDATE() AND COALESCE(inv.total, 0) > 0))
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
                              AND COALESCE(inv.total, 0) > 0
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

        return ['sql' => $sql, 'params' => array_values($allParams)];
    } catch (Throwable $e) {
        error_log("buildSegmentWhereClause Error: " . $e->getMessage());
        return ['sql' => '1=0', 'params' => []];
    }
}

/**
 * Compatibility helper for callers that expect buildSegmentSql($pdo, $workspaceId, $conditionsJson, $segmentId).
 */
function buildSegmentSql(PDO $pdo, int $workspaceId, $conditionsJson, ?string $segmentId = null): array
{
    return buildSegmentWhereClause($conditionsJson, $workspaceId, $segmentId);
}

/**
 * Idempotently ensures the `segments` table has both `criteria` and `conditions`
 * columns (plus `description` and `phone_count`) so all endpoints (`segments.php`,
 * `subscribers.php`, `campaigns.php`, `flows.php`) work without 1054 Unknown column errors.
 */
function ensureSegmentsTableSchema(PDO $pdo): void
{
    static $checked = false;
    if ($checked) {
        return;
    }
    $checked = true;

    try {
        $cols = [];
        $stmt = $pdo->query("SHOW COLUMNS FROM `segments`");
        if ($stmt) {
            while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
                if (!empty($r['Field'])) {
                    $cols[$r['Field']] = true;
                }
            }
        }
        if (empty($cols) || $pdo->inTransaction()) {
            return;
        }
        if (!isset($cols['description'])) {
            $pdo->exec("ALTER TABLE `segments` ADD COLUMN `description` TEXT NULL AFTER `name`");
        }
        if (!isset($cols['criteria'])) {
            $pdo->exec("ALTER TABLE `segments` ADD COLUMN `criteria` LONGTEXT NULL AFTER `name`");
        }
        if (!isset($cols['conditions'])) {
            $pdo->exec("ALTER TABLE `segments` ADD COLUMN `conditions` LONGTEXT NULL");
        }
        if (!isset($cols['phone_count'])) {
            $pdo->exec("ALTER TABLE `segments` ADD COLUMN `phone_count` INT DEFAULT 0 AFTER `subscriber_count`");
        }
        // Keep criteria and conditions mirrored for any pre-existing rows
        $pdo->exec("UPDATE `segments` SET `criteria` = `conditions` WHERE (`criteria` IS NULL OR `criteria` = '') AND `conditions` IS NOT NULL AND `conditions` != ''");
        $pdo->exec("UPDATE `segments` SET `conditions` = `criteria` WHERE (`conditions` IS NULL OR `conditions` = '') AND `criteria` IS NOT NULL AND `criteria` != ''");
    } catch (Throwable $e) {
        error_log("ensureSegmentsTableSchema warning: " . $e->getMessage());
    }
}

/**
 * Ensures the 4 core CRM Pipeline dynamic segments exist in `segments` for the given workspace:
 * 1. "Chưa tương tác được" (Pipeline Stage 01 -> 02)
 * 2. "Qualified"           (Pipeline Stage 03 -> 12)
 * 3. "Won"                 (Pipeline Stage 13 -> 14)
 * 4. "Học viên chính thức" (Pipeline Stage 14)
 *
 * Idempotent: Only inserts missing default segments (never overwrites user-customized rules unless empty),
 * and refreshes cached subscriber_count and phone_count when needed.
 */
function ensureDefaultPipelineSegments(PDO $pdo, int $workspaceId = 1, bool $forceSync = false): array
{
    static $seededWorkspaces = [];
    $wsId = $workspaceId > 0 ? $workspaceId : 1;
    if (!$forceSync && !empty($seededWorkspaces[$wsId])) {
        return $seededWorkspaces[$wsId];
    }

    try {
        $GLOBALS['pdo'] = $pdo;
        ensureSegmentsTableSchema($pdo);
        if (!class_exists('DomationContactMatcher') && file_exists(__DIR__ . '/../utils/DomationContactMatcher.php')) {
            require_once __DIR__ . '/../utils/DomationContactMatcher.php';
        }
        if (class_exists('DomationContactMatcher') && method_exists('DomationContactMatcher', 'ensureColumns')) {
            DomationContactMatcher::ensureColumns($pdo);
        }

        $catalog = getCrmPipelineStageCatalog($pdo);
        $buildStageGroups = function (array $stageNums) use ($catalog): array {
            $groups = [];
            foreach ($stageNums as $num) {
                $stageId = isset($catalog['by_num'][$num]) ? (int)$catalog['by_num'][$num]['id'] : (int)$num;
                $groups[] = [
                    'id' => 'grp_pipeline_stage_' . $num,
                    'logic' => 'AND',
                    'conditions' => [
                        [
                            'id' => 'cond_pipeline_stage_' . $num,
                            'field' => 'crm_stage_id',
                            'operator' => 'is',
                            'value' => (string)$stageId
                        ]
                    ]
                ];
            }
            return $groups;
        };

        $defaultDefs = [
            [
                'id' => $wsId === 1 ? 'seg_pipeline_uncontacted_01_02' : ('seg_pipeline_uncontacted_01_02_ws' . $wsId),
                'name' => 'Chưa tương tác được',
                'description' => 'Pipeline: 01 – New Lead → 02 – Contact Attempted',
                'stage_nums' => [1, 2],
                'created_at' => '2026-01-01 08:00:04'
            ],
            [
                'id' => $wsId === 1 ? 'seg_pipeline_qualified_03_12' : ('seg_pipeline_qualified_03_12_ws' . $wsId),
                'name' => 'Qualified',
                'description' => 'Pipeline: 03 – Connected → 12 – Offer / Scholarship Accepted',
                'stage_nums' => [3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
                'created_at' => '2026-01-01 08:00:03'
            ],
            [
                'id' => $wsId === 1 ? 'seg_pipeline_won_13_14' : ('seg_pipeline_won_13_14_ws' . $wsId),
                'name' => 'Won',
                'description' => 'Pipeline: 13 – Deposit / Tuition Payment → 14 – Enrolled',
                'stage_nums' => [13, 14],
                'created_at' => '2026-01-01 08:00:02'
            ],
            [
                'id' => $wsId === 1 ? 'seg_pipeline_enrolled_14' : ('seg_pipeline_enrolled_14_ws' . $wsId),
                'name' => 'Học viên chính thức',
                'description' => 'Pipeline: 14 – Enrolled',
                'stage_nums' => [14],
                'created_at' => '2026-01-01 08:00:01'
            ],
        ];

        $stmtCheck = $pdo->prepare("SELECT id, name, COALESCE(NULLIF(criteria, ''), conditions) AS criteria, subscriber_count, phone_count FROM segments WHERE workspace_id = ?");
        $stmtCheck->execute([$wsId]);
        $existingRows = $stmtCheck->fetchAll(PDO::FETCH_ASSOC);

        $existingById = [];
        $existingByName = [];
        foreach ($existingRows as $er) {
            $existingById[(string)$er['id']] = $er;
            $existingByName[mb_strtolower(trim((string)$er['name']), 'UTF-8')] = $er;
        }

        $needsSync = $forceSync;
        foreach ($defaultDefs as $def) {
            $nameKey = mb_strtolower($def['name'], 'UTF-8');
            $matched = $existingById[$def['id']] ?? $existingByName[$nameKey] ?? null;
            if (!$matched || (int)($matched['subscriber_count'] ?? 0) === 0) {
                $needsSync = true;
                break;
            }
        }

        if ($needsSync) {
            ensureAllCrmContactsSyncedForFilter($pdo, $wsId);
        }

        $results = [];
        foreach ($defaultDefs as $def) {
            $nameKey = mb_strtolower($def['name'], 'UTF-8');
            $matchedRow = $existingById[$def['id']] ?? $existingByName[$nameKey] ?? null;
            $groups = $buildStageGroups($def['stage_nums']);
            $conditionsJson = json_encode($groups, JSON_UNESCAPED_UNICODE);

            if (!$matchedRow) {
                $segId = $def['id'];
                $whereClause = buildSegmentWhereClause($groups, $wsId, $segId);
                $cStmt = $pdo->prepare("
                    SELECT
                        COUNT(*),
                        COUNT(CASE WHEN (s.phone_number IS NOT NULL AND s.phone_number != '') OR (s.phone IS NOT NULL AND s.phone != '') THEN 1 END)
                    FROM subscribers s
                    WHERE s.status IN ('active', 'lead', 'customer')
                      AND s.workspace_id = ?
                      AND (" . $whereClause['sql'] . ")
                ");
                $cStmt->execute(array_values(array_merge([$wsId], $whereClause['params'])));
                [$cnt, $phoneCnt] = $cStmt->fetch(PDO::FETCH_NUM) ?: [0, 0];

                $insStmt = $pdo->prepare("
                    INSERT INTO segments (id, workspace_id, name, description, criteria, conditions, subscriber_count, phone_count, auto_cleanup_days, notify_on_join, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
                ");
                $insStmt->execute([$segId, $wsId, $def['name'], $def['description'], $conditionsJson, $conditionsJson, (int)$cnt, (int)$phoneCnt, $def['created_at']]);
                $results[$def['name']] = ['id' => $segId, 'count' => (int)$cnt, 'phone_count' => (int)$phoneCnt, 'action' => 'inserted'];
            } else {
                $segId = (string)$matchedRow['id'];
                $currConds = trim((string)($matchedRow['criteria'] ?? ''));
                $useConds = ($forceSync || $currConds === '' || $currConds === '[]') ? $conditionsJson : $currConds;

                if ($forceSync || $currConds === '' || $currConds === '[]' || (int)($matchedRow['subscriber_count'] ?? 0) === 0) {
                    $whereClause = buildSegmentWhereClause($useConds, $wsId, $segId);
                    $cStmt = $pdo->prepare("
                        SELECT
                            COUNT(*),
                            COUNT(CASE WHEN (s.phone_number IS NOT NULL AND s.phone_number != '') OR (s.phone IS NOT NULL AND s.phone != '') THEN 1 END)
                        FROM subscribers s
                        WHERE s.status IN ('active', 'lead', 'customer')
                          AND s.workspace_id = ?
                          AND (" . $whereClause['sql'] . ")
                    ");
                    $cStmt->execute(array_values(array_merge([$wsId], $whereClause['params'])));
                    [$cnt, $phoneCnt] = $cStmt->fetch(PDO::FETCH_NUM) ?: [0, 0];

                    $updStmt = $pdo->prepare("
                        UPDATE segments
                        SET description = COALESCE(NULLIF(description, ''), ?),
                            criteria = ?,
                            conditions = ?,
                            subscriber_count = ?,
                            phone_count = ?
                        WHERE id = ? AND workspace_id = ?
                    ");
                    $updStmt->execute([$def['description'], $useConds, $useConds, (int)$cnt, (int)$phoneCnt, $segId, $wsId]);
                    $results[$def['name']] = ['id' => $segId, 'count' => (int)$cnt, 'phone_count' => (int)$phoneCnt, 'action' => 'updated'];
                } else {
                    $results[$def['name']] = [
                        'id' => $segId,
                        'count' => (int)$matchedRow['subscriber_count'],
                        'phone_count' => (int)($matchedRow['phone_count'] ?? 0),
                        'action' => 'kept'
                    ];
                }
            }
        }

        $seededWorkspaces[$wsId] = $results;
        return $results;
    } catch (Throwable $e) {
        error_log("ensureDefaultPipelineSegments warning: " . $e->getMessage());
        return [];
    }
}
?>
