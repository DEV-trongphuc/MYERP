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

function buildSegmentWhereClause($criteriaJson, $workspaceId, $segmentId = null)
{
    global $pdo;
    try {
        if (empty($criteriaJson)) {
            return ['sql' => '1=1', 'params' => []];
        }

        $groups = json_decode($criteriaJson, true);
        if (!$groups || !is_array($groups)) {
            return ['sql' => '1=1', 'params' => []];
        }

        $groupSqls = [];
        $allParams = [];

        foreach ($groups as $group) {
            if (empty($group['conditions']) || !is_array($group['conditions']))
                continue;

            $condSqls = [];
            foreach ($group['conditions'] as $cond) {
                $field = $cond['field'] ?? '';
                $op = $cond['operator'] ?? '';
                $val = $cond['value'] ?? '';

                // Map frontend fields to DB columns
                $colName = '';
                $isJsonTags = false;

                if (strpos($field, 'stats.') === 0) {
                    $statKey = str_replace('stats.', '', $field);
                    if ($statKey == 'emailsOpened')
                        $colName = 's.stats_opened';
                    else if ($statKey == 'linksClicked')
                        $colName = 's.stats_clicked';
                    else
                        continue; // Unknown stat
                } else if ($field === 'tags') {
                    // 10M UPGRADE: Using relational table JOIN instead of JSON_CONTAINS
                    if ($op === 'contains') {
                        $condSqls[] = "s.id IN (SELECT st.subscriber_id FROM subscriber_tags st JOIN domation_tags t_sub ON st.tag_id = t_sub.id WHERE st.workspace_id = ? AND t_sub.workspace_id = ? AND t_sub.name = ?)";
                        $allParams[] = $workspaceId;
                        $allParams[] = $workspaceId;
                        $allParams[] = $val;
                    } else if ($op === 'not_contains') {
                        $condSqls[] = "s.id NOT IN (SELECT st.subscriber_id FROM subscriber_tags st JOIN domation_tags t_sub ON st.tag_id = t_sub.id WHERE st.workspace_id = ? AND t_sub.workspace_id = ? AND t_sub.name = ?)";
                        $allParams[] = $workspaceId;
                        $allParams[] = $workspaceId;
                        $allParams[] = $val;
                    }
                    continue;
                } else if ($field === 'lastActivityDays') {
                    $days = (int) $val;
                    if ($op === 'greater_than' || $op === 'greater_than_or_equal') {
                        $condSqls[] = "(s.last_activity_at < DATE_SUB(NOW(), INTERVAL ? DAY) OR (s.last_activity_at IS NULL AND s.joined_at < DATE_SUB(NOW(), INTERVAL ? DAY)))";
                        $allParams[] = $days;
                        $allParams[] = $days;
                    } else {
                        $condSqls[] = "(s.last_activity_at >= DATE_SUB(NOW(), INTERVAL ? DAY) OR (s.last_activity_at IS NULL AND s.joined_at >= DATE_SUB(NOW(), INTERVAL ? DAY)))";
                        $allParams[] = $days;
                        $allParams[] = $days;
                    }
                    continue;
                } else if ($field === 'web_activity') {
                    $condSqls[] = "s.id IN (SELECT sa.subscriber_id FROM subscriber_activity sa WHERE sa.workspace_id = ? AND sa.type LIKE 'web_%' AND (sa.details LIKE ? OR sa.reference_name LIKE ?))";
                    $allParams[] = $workspaceId;
                    $allParams[] = '%' . $val . '%';
                    $allParams[] = '%' . $val . '%';
                    continue;
                } else {
                    // Map camelCase to snake_case columns
                    $map = [
                        'firstName' => 's.first_name',
                        'lastName' => 's.last_name',
                        'email' => 's.email',
                        'phoneNumber' => 's.phone_number',
                        'companyName' => 's.company_name',
                        'jobTitle' => 's.job_title',
                        'gender' => 's.gender',
                        'country' => 's.country',
                        'city' => 's.city',
                        'address' => 's.address',
                        'status' => 's.status',
                        'source' => 's.source',
                        'dateOfBirth' => 's.date_of_birth',
                        'anniversaryDate' => 's.anniversary_date',
                        'joinedAt' => 's.joined_at',
                        'leadScore' => 's.lead_score',
                        'verified' => 's.verified',
                        'salesperson' => 's.salesperson',
                        'lastActivityAt' => 's.last_activity_at',
                        'last_activity_at' => 's.last_activity_at',
                        'os' => 's.last_os',
                        'device' => 's.last_device',
                        'browser' => 's.last_browser',
                        'phone_number' => 's.phone_number',
                        'company_name' => 's.company_name',
                        'job_title' => 's.job_title',
                        'date_of_birth' => 's.date_of_birth',
                        'anniversary_date' => 's.anniversary_date',
                        'joined_at' => 's.joined_at',
                        'lead_score' => 's.lead_score',
                        'first_name' => 's.first_name',
                        'last_name' => 's.last_name',
                        'meta_psid' => 's.meta_psid'
                    ];
                    $colName = $map[$field] ?? null;

                    // If not a standard column, check if it's a custom attribute
                    if (!$colName) {
                        // Using JSON_UNQUOTE(JSON_EXTRACT(...)) for MySQL 5.7+ compatibility
                        // [BUG-L1 FIX] Whitelist field name: only allow alphanumeric + underscore.
                        // $colName is interpolated directly into SQL, so injection must be prevented here.
                        if (!preg_match('/^[a-zA-Z0-9_]+$/', $field)) {
                            continue; // Reject field names with SQL metacharacters
                        }
                        $colName = "JSON_UNQUOTE(JSON_EXTRACT(s.custom_attributes, '$.$field'))";
                    }
                }

                if (!$colName)
                    continue; // Skip invalid fields

                // (Logic for tags handled above by direct subquery for performance)
                switch ($op) {
                    case 'contains':
                        $condSqls[] = "$colName LIKE ?";
                        $allParams[] = '%' . $val . '%';
                        break;
                    case 'not_contains':
                        $condSqls[] = "$colName NOT LIKE ?";
                        $allParams[] = '%' . $val . '%';
                        break;
                    case 'equals':
                    case 'is':
                        $condSqls[] = "$colName = ?";
                        $allParams[] = $val;
                        break;
                    case 'is_not':
                        $condSqls[] = "$colName != ?";
                        $allParams[] = $val;
                        break;
                    case 'starts_with':
                        $condSqls[] = "$colName LIKE ?";
                        $allParams[] = $val . '%';
                        break;
                    case 'greater_than':
                        $condSqls[] = "$colName > ?";
                        $allParams[] = $val;
                        break;
                    case 'less_than':
                        $condSqls[] = "$colName < ?";
                        $allParams[] = $val;
                        break;
                    case 'after':
                        $condSqls[] = "$colName > ?";
                        $allParams[] = $val;
                        break;
                    case 'before':
                        $condSqls[] = "$colName < ?";
                        $allParams[] = $val;
                        break;
                    case 'on':
                        $condSqls[] = "DATE($colName) = ?";
                        $allParams[] = $val;
                        break;
                    case 'is_not_empty':
                        $condSqls[] = "($colName IS NOT NULL AND TRIM($colName) != '')";
                        break;
                    case 'is_empty':
                        $condSqls[] = "($colName IS NULL OR TRIM($colName) = '')";
                        break;
                }
            } // End conditions loop
            if (!empty($condSqls)) {
                $groupSqls[] = "(" . implode(' AND ', $condSqls) . ")";
            }
        } // End groups loop

        if (empty($groupSqls)) {
            $sql = '1=1';
        } else {
            $sql = '(' . implode(' OR ', $groupSqls) . ')';
        }

        // Append exclusion logic if segmentId is provided - USE PREPARED STATEMENT
        if ($segmentId) {
            $sql .= " AND s.id NOT IN (SELECT subscriber_id FROM segment_exclusions WHERE workspace_id = ? AND segment_id = ?)";
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
