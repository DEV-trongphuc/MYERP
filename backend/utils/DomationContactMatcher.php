<?php
/**
 * backend/utils/DomationContactMatcher.php
 * ============================================================
 * Match-Only Identity Resolution Engine between DOMATION Marketing
 * tables (`subscribers`, `web_visitors`, `survey_responses`,
 * `voucher_codes`, `zalo_subscribers`, `meta_subscribers`,
 * `domation_ai_conversations`, etc.) and `MYERP.contacts`.
 *
 * STRICT "3 KHÔNG" MANDATE:
 *   1. KHÔNG TẠO CONTACT MỚI: Do not create new rows in `contacts`. Only match
 *      existing `MYERP.contacts` (`WHERE deleted_at IS NULL`) by normalized
 *      9-digit phone (`phone_norm9`) or normalized email (`email_norm`).
 *      Unmatched subscribers stay in `subscribers` with `contact_id = NULL`.
 *   2. KHÔNG CHIA LEAD / KHÔNG ĐỔI OWNER / STAGE / UPDATED_AT: Never modify
 *      `owner_id`, `collaborator_ids`, `team_id`, `status`, `lead_status`,
 *      `pipeline_status`, `stage_id`, or `updated_at` on `MYERP.contacts`.
 *   3. KHÔNG GỬI THÔNG BÁO: Do not create rows in `notifications` or trigger
 *      any alerts/emails/chat messages during identity matching or sync.
 * ============================================================
 */

class DomationContactMatcher
{
    /**
     * Normalize a phone number to its trailing 9 digits.
     * Strips all non-digits; if length >= 9, returns last 9 digits, else ''.
     */
    public static function normalizePhone9(?string $phone): string
    {
        if ($phone === null || $phone === '') {
            return '';
        }
        $digits = preg_replace('/[^0-9]/', '', $phone);
        if ($digits === null || strlen($digits) < 9) {
            return '';
        }
        return substr($digits, -9);
    }

    /**
     * Normalize an email address for identity matching.
     * Lowercases and trims; returns '' if empty or synthetic placeholder domain.
     */
    public static function normalizeEmail(?string $email): string
    {
        if ($email === null) {
            return '';
        }
        $norm = strtolower(trim($email));
        if ($norm === '') {
            return '';
        }
        $ignoredSuffixes = [
            '@no-email.domation',
            '@zalo-oa.vn',
            '@facebook.com',
        ];
        foreach ($ignoredSuffixes as $suffix) {
            if (substr($norm, -strlen($suffix)) === $suffix || strpos($norm, $suffix) !== false) {
                return '';
            }
        }
        return $norm;
    }

    /**
     * Find an existing active MYERP contact (`contacts.deleted_at IS NULL`)
     * by normalized 9-digit phone (against `phone`, `mobile`, `phone2`, `zalo_phone`)
     * or normalized email (`LOWER(TRIM(email))`).
     *
     * STRICT MANDATE: NEVER inserts into `contacts`!
     */
    public static function findExistingContactId(PDO $db, ?string $email, ?string $phone, int $tenantId = 1): ?int
    {
        $emailNorm = self::normalizeEmail($email);
        $phone9    = self::normalizePhone9($phone);

        if ($emailNorm === '' && $phone9 === '') {
            return null;
        }

        $conds  = [];
        $params = [];

        if ($emailNorm !== '') {
            $conds[]  = "LOWER(TRIM(c.email)) = ?";
            $params[] = $emailNorm;
        }

        if ($phone9 !== '') {
            $conds[]  = "(
                RIGHT(REGEXP_REPLACE(COALESCE(c.phone, ''), '[^0-9]', ''), 9) = ?
                OR RIGHT(REGEXP_REPLACE(COALESCE(c.mobile, ''), '[^0-9]', ''), 9) = ?
                OR RIGHT(REGEXP_REPLACE(COALESCE(c.phone2, ''), '[^0-9]', ''), 9) = ?
                OR RIGHT(REGEXP_REPLACE(COALESCE(c.zalo_phone, ''), '[^0-9]', ''), 9) = ?
            )";
            $params[] = $phone9;
            $params[] = $phone9;
            $params[] = $phone9;
            $params[] = $phone9;
        }

        $whereOr = implode(' OR ', $conds);
        $orderParams = [];
        $orderSql = "c.id DESC";
        if ($tenantId > 0) {
            $orderSql = "(c.tenant_id = ?) DESC, c.id DESC";
            $orderParams[] = $tenantId;
        }

        $sql = "SELECT c.id
                FROM contacts c
                WHERE c.deleted_at IS NULL
                  AND ({$whereOr})
                ORDER BY {$orderSql}
                LIMIT 1";

        try {
            $stmt = $db->prepare($sql);
            $stmt->execute(array_merge($params, $orderParams));
            $foundId = (int)($stmt->fetchColumn() ?: 0);
            return $foundId > 0 ? $foundId : null;
        } catch (\Throwable $e) {
            // Fallback for older MySQL/MariaDB engines or missing optional phone columns
            try {
                $fbConds  = [];
                $fbParams = [];
                if ($emailNorm !== '') {
                    $fbConds[]  = "LOWER(TRIM(c.email)) = ?";
                    $fbParams[] = $emailNorm;
                }
                if ($phone9 !== '') {
                    $fbConds[]  = "(c.phone LIKE ? OR c.mobile LIKE ?)";
                    $fbParams[] = '%' . $phone9;
                    $fbParams[] = '%' . $phone9;
                }
                $fbSql = "SELECT c.id
                          FROM contacts c
                          WHERE c.deleted_at IS NULL
                            AND (" . implode(' OR ', $fbConds) . ")
                          ORDER BY c.id DESC
                          LIMIT 1";
                $stmtFb = $db->prepare($fbSql);
                $stmtFb->execute($fbParams);
                $foundId = (int)($stmtFb->fetchColumn() ?: 0);
                return $foundId > 0 ? $foundId : null;
            } catch (\Throwable $e2) {
                return null;
            }
        }
    }

    /**
     * Match a single DOMATION subscriber against existing MYERP contacts.
     * - Looks up `subscribers WHERE id = ?`.
     * - If `contact_id` is NULL (or points to a deleted/missing contact), calls `findExistingContactId()`.
     * - If matched to `$contactId`, updates `subscribers.contact_id = $contactId`, propagates `$contactId`
     *   to all related DOMATION tables, and calls `refreshContactOmnichannelStats($db, $contactId)`.
     * - NEVER creates a contact, NEVER assigns leads, NEVER creates notifications!
     */
    public static function syncSubscriberMatchOnly(PDO $db, string $subscriberId): ?int
    {
        $subscriberId = trim($subscriberId);
        if ($subscriberId === '' || $subscriberId === '0') {
            return null;
        }

        try {
            $stmt = $db->prepare("SELECT * FROM subscribers WHERE id = ? LIMIT 1");
            $stmt->execute([$subscriberId]);
            $sub = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$sub) {
                return null;
            }

            $rawEmail  = isset($sub['email']) ? (string)$sub['email'] : null;
            $rawPhone  = !empty($sub['phone_number']) ? (string)$sub['phone_number'] : (isset($sub['phone']) ? (string)$sub['phone'] : null);
            $phone9    = self::normalizePhone9($rawPhone);
            $emailNorm = self::normalizeEmail($rawEmail);

            // Keep normalized helper columns on subscribers up to date
            if (
                (array_key_exists('phone_norm9', $sub) && ($sub['phone_norm9'] ?? '') !== $phone9) ||
                (array_key_exists('email_norm', $sub) && ($sub['email_norm'] ?? '') !== $emailNorm)
            ) {
                try {
                    $db->prepare("UPDATE subscribers SET phone_norm9 = ?, email_norm = ?, updated_at = updated_at WHERE id = ?")
                       ->execute([$phone9 !== '' ? $phone9 : null, $emailNorm !== '' ? $emailNorm : null, $subscriberId]);
                } catch (\Throwable $eNorm) {
                }
            }

            $contactId = !empty($sub['contact_id']) ? (int)$sub['contact_id'] : 0;
            if ($contactId > 0) {
                $chk = $db->prepare("SELECT id FROM contacts WHERE id = ? AND deleted_at IS NULL LIMIT 1");
                $chk->execute([$contactId]);
                if (!$chk->fetchColumn()) {
                    $contactId = 0;
                }
            }

            if ($contactId <= 0) {
                $found = self::findExistingContactId($db, $rawEmail, $rawPhone);
                $contactId = $found ?? 0;
            }

            // STRICT "3 KHÔNG": Unmatched subscribers stay in `subscribers` with `contact_id = NULL`
            if ($contactId <= 0) {
                if (!empty($sub['contact_id'])) {
                    try {
                        $db->prepare("UPDATE subscribers SET contact_id = NULL, updated_at = updated_at WHERE id = ?")
                           ->execute([$subscriberId]);
                    } catch (\Throwable $eClr) {
                    }
                }
                return null;
            }

            // Update subscribers.contact_id
            if ((int)($sub['contact_id'] ?? 0) !== $contactId) {
                try {
                    $db->prepare("UPDATE subscribers SET contact_id = ?, updated_at = updated_at WHERE id = ?")
                       ->execute([$contactId, $subscriberId]);
                } catch (\Throwable $eUpdSub) {
                }
            }

            // Propagate $contactId to child tables linked by subscriber_id
            $subscriberChildTables = [
                'subscriber_activity',
                'subscriber_flow_states',
                'web_visitors',
                'survey_responses',
                'voucher_codes',
                'voucher_claims',
            ];
            foreach ($subscriberChildTables as $tbl) {
                try {
                    $db->prepare("UPDATE `{$tbl}` SET contact_id = ? WHERE subscriber_id = ? AND (contact_id IS NULL OR contact_id = 0)")
                       ->execute([$contactId, $subscriberId]);
                } catch (\Throwable $eChild) {
                }
            }

            // Propagate to zalo_subscribers (by subscriber_id or zalo_user_id)
            try {
                $zaloUid = trim((string)($sub['zalo_user_id'] ?? ''));
                if ($zaloUid !== '') {
                    $db->prepare("UPDATE zalo_subscribers SET contact_id = ? WHERE (subscriber_id = ? OR zalo_user_id = ?) AND (contact_id IS NULL OR contact_id = 0)")
                       ->execute([$contactId, $subscriberId, $zaloUid]);
                } else {
                    $db->prepare("UPDATE zalo_subscribers SET contact_id = ? WHERE subscriber_id = ? AND (contact_id IS NULL OR contact_id = 0)")
                       ->execute([$contactId, $subscriberId]);
                }
            } catch (\Throwable $eZalo) {
            }

            // Propagate to meta_subscribers & meta_conversations (by psid / email / phone)
            try {
                $metaPsid = trim((string)($sub['meta_psid'] ?? ''));
                if ($metaPsid !== '') {
                    $db->prepare("UPDATE meta_subscribers SET contact_id = ? WHERE psid = ? AND (contact_id IS NULL OR contact_id = 0)")
                       ->execute([$contactId, $metaPsid]);
                    $db->prepare("UPDATE meta_conversations SET contact_id = ? WHERE psid = ? AND (contact_id IS NULL OR contact_id = 0)")
                       ->execute([$contactId, $metaPsid]);
                }
                if ($emailNorm !== '') {
                    $db->prepare("UPDATE meta_subscribers SET contact_id = ? WHERE LOWER(TRIM(email)) = ? AND (contact_id IS NULL OR contact_id = 0)")
                       ->execute([$contactId, $emailNorm]);
                }
            } catch (\Throwable $eMeta) {
            }

            // Propagate to domation_ai_conversations via web_visitors
            try {
                $db->prepare("
                    UPDATE domation_ai_conversations dac
                    JOIN web_visitors wv ON wv.visitor_id = dac.visitor_id
                    SET dac.contact_id = ?, dac.updated_at = dac.updated_at
                    WHERE wv.subscriber_id = ? AND (dac.contact_id IS NULL OR dac.contact_id = 0)
                ")->execute([$contactId, $subscriberId]);
            } catch (\Throwable $eAi) {
            }

            self::refreshContactOmnichannelStats($db, $contactId);
            return $contactId;
        } catch (\Throwable $e) {
            error_log("[DomationContactMatcher::syncSubscriberMatchOnly] " . $e->getMessage());
            return null;
        }
    }

    /**
     * Recompute and silently update denormalized omnichannel columns on `MYERP.contacts`
     * for a specific `$contactId`, strictly preserving `contacts.updated_at` and all
     * CRM ownership/pipeline columns ("3 KHÔNG").
     */
    public static function refreshContactOmnichannelStats(PDO $db, int $contactId): void
    {
        if ($contactId <= 0) {
            return;
        }

        try {
            // 1. Primary subscriber record for this contact
            $stmtSub = $db->prepare("
                SELECT *
                FROM subscribers
                WHERE contact_id = ?
                ORDER BY updated_at DESC, joined_at DESC
                LIMIT 1
            ");
            $stmtSub->execute([$contactId]);
            $sub = $stmtSub->fetch(PDO::FETCH_ASSOC) ?: null;

            $domationSubscriberId = $sub ? (string)$sub['id'] : null;
            $rawStatus            = strtolower(trim((string)($sub['status'] ?? 'subscribed')));
            if (in_array($rawStatus, ['unsubscribed', 'bounced', 'complained'], true)) {
                $marketingStatus = $rawStatus;
            } else {
                $marketingStatus = 'subscribed';
            }

            $engagementScore   = (int)($sub['lead_score'] ?? 0);
            $statsEmailSent    = (int)($sub['stats_sent'] ?? 0);
            $statsEmailOpened  = (int)($sub['stats_opened'] ?? 0);
            $statsEmailClicked = (int)($sub['stats_clicked'] ?? 0);
            $lastEmailOpenAt   = !empty($sub['last_open_at']) ? $sub['last_open_at'] : null;
            $lastEmailClickAt  = !empty($sub['last_click_at']) ? $sub['last_click_at'] : null;
            $zaloUserId        = !empty($sub['zalo_user_id']) ? (string)$sub['zalo_user_id'] : null;
            $metaPsid          = !empty($sub['meta_psid']) ? (string)$sub['meta_psid'] : null;

            // If multiple subscribers link to the same contact, aggregate email stats & max score
            try {
                $stmtAggSub = $db->prepare("
                    SELECT
                        MAX(COALESCE(lead_score, 0)) AS max_score,
                        SUM(COALESCE(stats_sent, 0)) AS total_sent,
                        SUM(COALESCE(stats_opened, 0)) AS total_opened,
                        SUM(COALESCE(stats_clicked, 0)) AS total_clicked,
                        MAX(last_open_at) AS max_open_at,
                        MAX(last_click_at) AS max_click_at
                    FROM subscribers
                    WHERE contact_id = ?
                ");
                $stmtAggSub->execute([$contactId]);
                $aggSub = $stmtAggSub->fetch(PDO::FETCH_ASSOC);
                if ($aggSub && $aggSub['max_score'] !== null) {
                    $engagementScore   = max($engagementScore, (int)$aggSub['max_score']);
                    $statsEmailSent    = max($statsEmailSent, (int)$aggSub['total_sent']);
                    $statsEmailOpened  = max($statsEmailOpened, (int)$aggSub['total_opened']);
                    $statsEmailClicked = max($statsEmailClicked, (int)$aggSub['total_clicked']);
                    if (!empty($aggSub['max_open_at'])) {
                        $lastEmailOpenAt = $aggSub['max_open_at'];
                    }
                    if (!empty($aggSub['max_click_at'])) {
                        $lastEmailClickAt = $aggSub['max_click_at'];
                    }
                }
            } catch (\Throwable $eAggSub) {
            }

            // 2. Active flows (`subscriber_flow_states` joined with `flows`)
            $activeFlowCount = 0;
            $activeFlowNames = null;
            try {
                if ($domationSubscriberId !== null) {
                    $stmtFlows = $db->prepare("
                        SELECT DISTINCT sfs.flow_id, f.name
                        FROM subscriber_flow_states sfs
                        LEFT JOIN flows f ON f.id = sfs.flow_id
                        WHERE (sfs.contact_id = ? OR sfs.subscriber_id = ?)
                          AND sfs.status IN ('waiting', 'processing')
                    ");
                    $stmtFlows->execute([$contactId, $domationSubscriberId]);
                } else {
                    $stmtFlows = $db->prepare("
                        SELECT DISTINCT sfs.flow_id, f.name
                        FROM subscriber_flow_states sfs
                        LEFT JOIN flows f ON f.id = sfs.flow_id
                        WHERE sfs.contact_id = ?
                          AND sfs.status IN ('waiting', 'processing')
                    ");
                    $stmtFlows->execute([$contactId]);
                }
                $flowRows = $stmtFlows->fetchAll(PDO::FETCH_ASSOC) ?: [];
                $activeFlowCount = count($flowRows);
                $names = [];
                foreach ($flowRows as $fr) {
                    $fName = trim((string)($fr['name'] ?? ''));
                    if ($fName !== '') {
                        $names[] = $fName;
                    }
                }
                if (!empty($names)) {
                    $joinedNames = implode(', ', array_unique($names));
                    $activeFlowNames = function_exists('mb_substr')
                        ? mb_substr($joinedNames, 0, 500)
                        : substr($joinedNames, 0, 500);
                }
            } catch (\Throwable $eFlows) {
            }

            // 3. Web behavior (`web_visitors` & `web_page_views`)
            $lastWebVisitAt    = null;
            $webPageviewsCount = 0;
            $maxScrollDepth    = 0;
            try {
                if ($domationSubscriberId !== null) {
                    $stmtWv = $db->prepare("
                        SELECT
                            MAX(COALESCE(wv.last_seen_at, wv.last_visit_at)) AS last_visit,
                            COALESCE(SUM(wv.visit_count), 0) AS total_visits
                        FROM web_visitors wv
                        WHERE wv.contact_id = ? OR wv.subscriber_id = ?
                    ");
                    $stmtWv->execute([$contactId, $domationSubscriberId]);
                } else {
                    $stmtWv = $db->prepare("
                        SELECT
                            MAX(COALESCE(wv.last_seen_at, wv.last_visit_at)) AS last_visit,
                            COALESCE(SUM(wv.visit_count), 0) AS total_visits
                        FROM web_visitors wv
                        WHERE wv.contact_id = ?
                    ");
                    $stmtWv->execute([$contactId]);
                }
                $wvRow = $stmtWv->fetch(PDO::FETCH_ASSOC);
                if ($wvRow) {
                    $lastWebVisitAt    = !empty($wvRow['last_visit']) ? $wvRow['last_visit'] : null;
                    $webPageviewsCount = (int)($wvRow['total_visits'] ?? 0);
                }

                // Detailed pageviews & max scroll depth from web_page_views joined via web_visitors
                if ($domationSubscriberId !== null) {
                    $stmtPv = $db->prepare("
                        SELECT
                            COUNT(wpv.id) AS pv_count,
                            COALESCE(MAX(wpv.scroll_depth), 0) AS max_scroll,
                            MAX(wpv.loaded_at) AS last_loaded
                        FROM web_page_views wpv
                        JOIN web_visitors wv ON (wv.id = wpv.visitor_id OR wv.visitor_id = wpv.visitor_id)
                        WHERE wv.contact_id = ? OR wv.subscriber_id = ?
                    ");
                    $stmtPv->execute([$contactId, $domationSubscriberId]);
                } else {
                    $stmtPv = $db->prepare("
                        SELECT
                            COUNT(wpv.id) AS pv_count,
                            COALESCE(MAX(wpv.scroll_depth), 0) AS max_scroll,
                            MAX(wpv.loaded_at) AS last_loaded
                        FROM web_page_views wpv
                        JOIN web_visitors wv ON (wv.id = wpv.visitor_id OR wv.visitor_id = wpv.visitor_id)
                        WHERE wv.contact_id = ?
                    ");
                    $stmtPv->execute([$contactId]);
                }
                $pvRow = $stmtPv->fetch(PDO::FETCH_ASSOC);
                if ($pvRow) {
                    $pvCount = (int)($pvRow['pv_count'] ?? 0);
                    if ($pvCount > $webPageviewsCount) {
                        $webPageviewsCount = $pvCount;
                    }
                    $maxScrollDepth = min(100, max(0, (int)($pvRow['max_scroll'] ?? 0)));
                    if (!empty($pvRow['last_loaded']) && ($lastWebVisitAt === null || $pvRow['last_loaded'] > $lastWebVisitAt)) {
                        $lastWebVisitAt = $pvRow['last_loaded'];
                    }
                }
            } catch (\Throwable $eWeb) {
            }

            // 4. Active voucher (`voucher_codes`)
            $activeVoucherCode = null;
            try {
                if ($domationSubscriberId !== null) {
                    $stmtVc = $db->prepare("
                        SELECT code
                        FROM voucher_codes
                        WHERE (contact_id = ? OR subscriber_id = ?)
                          AND status = 'unused'
                          AND (expires_at IS NULL OR expires_at >= NOW())
                        ORDER BY COALESCE(claimed_at, sent_at, created_at) DESC
                        LIMIT 1
                    ");
                    $stmtVc->execute([$contactId, $domationSubscriberId]);
                } else {
                    $stmtVc = $db->prepare("
                        SELECT code
                        FROM voucher_codes
                        WHERE contact_id = ?
                          AND status = 'unused'
                          AND (expires_at IS NULL OR expires_at >= NOW())
                        ORDER BY COALESCE(claimed_at, sent_at, created_at) DESC
                        LIMIT 1
                    ");
                    $stmtVc->execute([$contactId]);
                }
                $vcCode = $stmtVc->fetchColumn();
                if ($vcCode !== false && $vcCode !== '') {
                    $activeVoucherCode = (string)$vcCode;
                }
            } catch (\Throwable $eVc) {
            }

            // 5. Survey completion (`survey_responses`)
            $surveyCompletedCount = 0;
            try {
                if ($domationSubscriberId !== null) {
                    $stmtSr = $db->prepare("
                        SELECT COUNT(*)
                        FROM survey_responses
                        WHERE contact_id = ? OR subscriber_id = ?
                    ");
                    $stmtSr->execute([$contactId, $domationSubscriberId]);
                } else {
                    $stmtSr = $db->prepare("
                        SELECT COUNT(*)
                        FROM survey_responses
                        WHERE contact_id = ?
                    ");
                    $stmtSr->execute([$contactId]);
                }
                $surveyCompletedCount = (int)$stmtSr->fetchColumn();
            } catch (\Throwable $eSr) {
            }

            // 6. Fallback Zalo & Meta IDs from dedicated subscriber tables
            if ($zaloUserId === null) {
                try {
                    $stmtZs = $db->prepare("
                        SELECT zalo_user_id
                        FROM zalo_subscribers
                        WHERE (contact_id = ? OR (? IS NOT NULL AND subscriber_id = ?))
                          AND zalo_user_id IS NOT NULL AND zalo_user_id != ''
                        ORDER BY updated_at DESC
                        LIMIT 1
                    ");
                    $stmtZs->execute([$contactId, $domationSubscriberId, $domationSubscriberId]);
                    $zUid = $stmtZs->fetchColumn();
                    if ($zUid) {
                        $zaloUserId = (string)$zUid;
                    }
                } catch (\Throwable $eZs) {
                }
            }

            if ($metaPsid === null) {
                try {
                    $stmtMs = $db->prepare("
                        SELECT psid
                        FROM meta_subscribers
                        WHERE contact_id = ?
                          AND psid IS NOT NULL AND psid != ''
                        ORDER BY updated_at DESC
                        LIMIT 1
                    ");
                    $stmtMs->execute([$contactId]);
                    $mPsid = $stmtMs->fetchColumn();
                    if ($mPsid) {
                        $metaPsid = (string)$mPsid;
                    }
                } catch (\Throwable $eMs) {
                }
            }

            // 7. Silent UPDATE on contacts preserving `updated_at` ("3 KHÔNG")
            $stmtUpd = $db->prepare("
                UPDATE contacts SET
                    domation_subscriber_id = ?,
                    marketing_status       = ?,
                    engagement_score       = ?,
                    stats_email_sent       = ?,
                    stats_email_opened     = ?,
                    stats_email_clicked    = ?,
                    last_email_open_at     = ?,
                    last_email_click_at    = ?,
                    last_web_visit_at      = ?,
                    web_pageviews_count    = ?,
                    max_scroll_depth       = ?,
                    active_flow_count      = ?,
                    active_flow_names      = ?,
                    active_voucher_code    = ?,
                    survey_completed_count = ?,
                    zalo_user_id           = COALESCE(?, zalo_user_id),
                    meta_psid              = COALESCE(?, meta_psid),
                    updated_at             = updated_at
                WHERE id = ?
            ");
            $stmtUpd->execute([
                $domationSubscriberId,
                $marketingStatus,
                $engagementScore,
                $statsEmailSent,
                $statsEmailOpened,
                $statsEmailClicked,
                $lastEmailOpenAt,
                $lastEmailClickAt,
                $lastWebVisitAt,
                max(0, $webPageviewsCount),
                min(100, max(0, $maxScrollDepth)),
                min(65535, max(0, $activeFlowCount)),
                $activeFlowNames,
                $activeVoucherCode,
                min(65535, max(0, $surveyCompletedCount)),
                $zaloUserId,
                $metaPsid,
                $contactId,
            ]);
        } catch (\Throwable $e) {
            error_log("[DomationContactMatcher::refreshContactOmnichannelStats] " . $e->getMessage());
        }
    }

    /**
     * Backwards-compatible alias for refreshContactOmnichannelStats.
     */
    public static function refreshContactStats(PDO $db, int $contactId): void
    {
        self::refreshContactOmnichannelStats($db, $contactId);
    }

    /**
     * Match a single MYERP contact against existing DOMATION subscribers (Match-Only).
     */
    public static function syncContactMatchOnly(PDO $db, int $contactId): array
    {
        if ($contactId <= 0) {
            return ['matched' => false, 'subscriber_id' => null];
        }
        try {
            $stmtC = $db->prepare("SELECT id, email, phone, mobile, phone2, zalo_phone, domation_subscriber_id FROM contacts WHERE id = ? AND deleted_at IS NULL LIMIT 1");
            $stmtC->execute([$contactId]);
            $contact = $stmtC->fetch(PDO::FETCH_ASSOC);
            if (!$contact) {
                return ['matched' => false, 'subscriber_id' => null];
            }

            $emailNorm = self::normalizeEmail($contact['email'] ?? null);
            $phones9   = array_values(array_unique(array_filter([
                self::normalizePhone9($contact['phone'] ?? null),
                self::normalizePhone9($contact['mobile'] ?? null),
                self::normalizePhone9($contact['phone2'] ?? null),
                self::normalizePhone9($contact['zalo_phone'] ?? null),
            ])));

            $conds  = ["contact_id = ?"];
            $params = [$contactId];

            if ($emailNorm !== '') {
                $conds[]  = "email_norm = ? OR LOWER(TRIM(email)) = ?";
                $params[] = $emailNorm;
                $params[] = $emailNorm;
            }
            foreach ($phones9 as $p9) {
                $conds[]  = "phone_norm9 = ? OR phone_number LIKE ? OR phone LIKE ?";
                $params[] = $p9;
                $params[] = '%' . $p9;
                $params[] = '%' . $p9;
            }

            $stmtS = $db->prepare("SELECT id FROM subscribers WHERE (" . implode(') OR (', $conds) . ") ORDER BY updated_at DESC, joined_at DESC LIMIT 1");
            $stmtS->execute($params);
            $subId = $stmtS->fetchColumn();

            if ($subId !== false && $subId !== '') {
                $subIdStr = (string)$subId;
                $db->prepare("UPDATE subscribers SET contact_id = ?, updated_at = updated_at WHERE id = ?")
                   ->execute([$contactId, $subIdStr]);
                self::syncSubscriberMatchOnly($db, $subIdStr);
                return ['matched' => true, 'subscriber_id' => $subIdStr];
            }

            self::refreshContactOmnichannelStats($db, $contactId);
            return ['matched' => false, 'subscriber_id' => null];
        } catch (\Throwable $e) {
            return ['matched' => false, 'subscriber_id' => null];
        }
    }

    /**
     * Bulk copy data from `$sourceDomationDb` (if present on the same MySQL server),
     * execute set-based Match-Only identity resolution (`tmp_myerp_contact_lookup`),
     * and bulk-refresh all denormalized omnichannel columns on `MYERP.contacts`.
     *
     * STRICT "3 KHÔNG":
     *   - NEVER inserts into `contacts`
     *   - NEVER modifies `owner_id`, `collaborator_ids`, `team_id`, `status`, `stage_id`, or `updated_at` on `contacts`
     *   - NEVER inserts into `notifications`
     */
    public static function runBulkMatchAndRefresh(PDO $db, ?string $sourceDomationDb = 'vhvxoigh_mail_auto'): array
    {
        $summary = [
            'source_db_found'     => false,
            'copied_tables'       => 0,
            'matched_subscribers' => 0,
            'matched_contacts'    => 0,
        ];

        // 1. Copy data from $sourceDomationDb if it exists on the MySQL server
        if ($sourceDomationDb !== null && preg_match('/^[a-zA-Z0-9_]+$/', $sourceDomationDb)) {
            try {
                $stmtSchema = $db->prepare("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ? LIMIT 1");
                $stmtSchema->execute([$sourceDomationDb]);
                $schemaExists = (bool)$stmtSchema->fetchColumn();

                $currentDb = (string)($db->query("SELECT DATABASE()")->fetchColumn() ?: '');
                if ($schemaExists && strcasecmp($sourceDomationDb, $currentDb) !== 0) {
                    $summary['source_db_found'] = true;

                    // Map source table name in DOMATION -> destination table name in MYERP
                    $tableCopyMap = [
                        'workspaces'                => 'workspaces',
                        'system_settings'           => 'mkt_system_settings',
                        'tags'                      => 'domation_tags',
                        'subscribers'               => 'subscribers',
                        'subscriber_activity'       => 'subscriber_activity',
                        'subscriber_flow_states'    => 'subscriber_flow_states',
                        'subscriber_lists'          => 'subscriber_lists',
                        'subscriber_tags'           => 'subscriber_tags',
                        'subscriber_notes'          => 'subscriber_notes',
                        'flows'                     => 'flows',
                        'flow_snapshots'            => 'flow_snapshots',
                        'flow_enrollments'          => 'flow_enrollments',
                        'flow_event_queue'          => 'flow_event_queue',
                        'campaigns'                 => 'campaigns',
                        'campaign_reminders'        => 'campaign_reminders',
                        'templates'                 => 'templates',
                        'template_groups'           => 'template_groups',
                        'email_sections'            => 'email_sections',
                        'mail_delivery_logs'        => 'mail_delivery_logs',
                        'lists'                     => 'lists',
                        'segments'                  => 'segments',
                        'segment_exclusions'        => 'segment_exclusions',
                        'segment_count_update_queue'=> 'segment_count_update_queue',
                        'forms'                     => 'forms',
                        'surveys'                   => 'surveys',
                        'survey_questions'          => 'survey_questions',
                        'survey_responses'          => 'survey_responses',
                        'survey_answer_details'     => 'survey_answer_details',
                        'voucher_campaigns'         => 'voucher_campaigns',
                        'voucher_codes'             => 'voucher_codes',
                        'voucher_claims'            => 'voucher_claims',
                        'short_links'               => 'short_links',
                        'link_clicks'               => 'link_clicks',
                        'otp_profiles'              => 'otp_profiles',
                        'otp_codes'                 => 'otp_codes',
                        'web_properties'            => 'web_properties',
                        'web_tracking_sites'        => 'web_tracking_sites',
                        'web_visitors'              => 'web_visitors',
                        'web_sessions'              => 'web_sessions',
                        'web_page_views'            => 'web_page_views',
                        'web_events'                => 'web_events',
                        'web_form_submissions'      => 'web_form_submissions',
                        'web_heatmap_data'          => 'web_heatmap_data',
                        'web_daily_stats'           => 'web_daily_stats',
                        'web_analytics_summary'     => 'web_analytics_summary',
                        'web_blacklist'             => 'web_blacklist',
                        'custom_events'             => 'custom_events',
                        'purchase_events'           => 'purchase_events',
                        'lead_scoring_rules'        => 'lead_scoring_rules',
                        'verified_senders'          => 'verified_senders',
                        'qa_emails'                 => 'qa_emails',
                        'zalo_oa_configs'           => 'zalo_oa_configs',
                        'zalo_templates'            => 'zalo_templates',
                        'zalo_lists'                => 'zalo_lists',
                        'zalo_subscribers'          => 'zalo_subscribers',
                        'zalo_subscriber_activity'  => 'zalo_subscriber_activity',
                        'zalo_user_messages'        => 'zalo_user_messages',
                        'zalo_broadcasts'           => 'zalo_broadcasts',
                        'zalo_broadcast_tracking'   => 'zalo_broadcast_tracking',
                        'zalo_delivery_logs'        => 'zalo_delivery_logs',
                        'zalo_automation_scenarios' => 'zalo_automation_scenarios',
                        'zalo_activity_buffer'      => 'zalo_activity_buffer',
                        'zalo_message_queue'        => 'zalo_message_queue',
                        'meta_app_configs'          => 'meta_app_configs',
                        'meta_subscribers'          => 'meta_subscribers',
                        'meta_conversations'        => 'meta_conversations',
                        'meta_message_logs'         => 'meta_message_logs',
                        'meta_customer_journey'     => 'meta_customer_journey',
                        'meta_automation_scenarios' => 'meta_automation_scenarios',
                        'ai_chatbots'               => 'ai_chatbots',
                        'ai_chatbot_categories'     => 'ai_chatbot_categories',
                        'ai_chatbot_settings'       => 'ai_chatbot_settings',
                        'ai_chatbot_scenarios'      => 'ai_chatbot_scenarios',
                        'ai_chatbot_meta_settings'  => 'ai_chatbot_meta_settings',
                        'ai_conversations'          => 'domation_ai_conversations',
                        'ai_messages'               => 'domation_ai_messages',
                        'ai_training_docs'          => 'domation_ai_training_docs',
                        'ai_training_chunks'        => 'domation_ai_training_chunks',
                        'ai_chat_queries'           => 'ai_chat_queries',
                        'ai_feedback'               => 'ai_feedback',
                        'ai_pdf_chunk_results'      => 'ai_pdf_chunk_results',
                        'ai_suggested_links'        => 'ai_suggested_links',
                        'ai_term_stats'             => 'ai_term_stats',
                        'ai_usage_analytics'        => 'ai_usage_analytics',
                        'ai_usage_logs'             => 'ai_usage_logs',
                        'ai_allowed_emails'         => 'ai_allowed_emails',
                        'ai_group_members'          => 'ai_group_members',
                        'ai_group_permissions'      => 'ai_group_permissions',
                        'ai_group_audit_logs'       => 'ai_group_audit_logs',
                        'ai_org_users'              => 'ai_org_users',
                        'ai_org_user_categories'    => 'ai_org_user_categories',
                        'ai_org_conversations'      => 'ai_org_conversations',
                        'ai_org_messages'           => 'ai_org_messages',
                        'ai_org_access_tokens'      => 'ai_org_access_tokens',
                        'ai_org_refresh_tokens'     => 'ai_org_refresh_tokens',
                        'ai_org_user_activity_logs' => 'ai_org_user_activity_logs',
                        'ai_user_drive_permissions' => 'ai_user_drive_permissions',
                        'ai_workspace_files'        => 'ai_workspace_files',
                        'ai_workspace_versions'     => 'ai_workspace_versions',
                        'webhooks'                  => 'webhooks',
                        'webhook_logs'              => 'webhook_logs',
                        'automation_logs'           => 'automation_logs',
                        'sheet_sync_configs'        => 'sheet_sync_configs',
                        'activity_buffer'           => 'activity_buffer',
                        'stats_update_buffer'       => 'stats_update_buffer',
                        'timestamp_buffer'          => 'timestamp_buffer',
                        'tracking_unique_cache'     => 'tracking_unique_cache',
                        'raw_event_buffer'          => 'raw_event_buffer',
                        'global_assets'             => 'global_assets',
                        'integrations'              => 'integrations',
                        'queue_jobs'                => 'queue_jobs',
                        'queue_throttle'            => 'queue_throttle',
                        'spam_cooldown'             => 'spam_cooldown',
                        'geoip_blocks'              => 'geoip_blocks',
                        'system_audit_logs'         => 'system_audit_logs',
                        'system_logs'               => 'system_logs',
                        'workspace_users'           => 'workspace_users',
                    ];

                    foreach ($tableCopyMap as $srcTable => $destTable) {
                        try {
                            $srcColsStmt  = $db->query("SHOW COLUMNS FROM `{$sourceDomationDb}`.`{$srcTable}`");
                            $destColsStmt = $db->query("SHOW COLUMNS FROM `{$destTable}`");
                            if (!$srcColsStmt || !$destColsStmt) {
                                continue;
                            }
                            $srcCols = [];
                            while ($r = $srcColsStmt->fetch(PDO::FETCH_ASSOC)) {
                                $extra = strtoupper((string)($r['Extra'] ?? ''));
                                if (strpos($extra, 'GENERATED') === false) {
                                    $srcCols[] = $r['Field'];
                                }
                            }
                            $destCols = [];
                            while ($r = $destColsStmt->fetch(PDO::FETCH_ASSOC)) {
                                $extra = strtoupper((string)($r['Extra'] ?? ''));
                                if (strpos($extra, 'GENERATED') === false) {
                                    $destCols[] = $r['Field'];
                                }
                            }

                            $commonCols = array_values(array_intersect($destCols, $srcCols));
                            if (empty($commonCols)) {
                                continue;
                            }

                            $quotedCols = implode(', ', array_map(static fn($c) => "`{$c}`", $commonCols));
                            $copySql = "INSERT IGNORE INTO `{$destTable}` ({$quotedCols}) SELECT {$quotedCols} FROM `{$sourceDomationDb}`.`{$srcTable}`";
                            $db->exec($copySql);
                            $summary['copied_tables']++;
                        } catch (\Throwable $eCopy) {
                            // Continue copying remaining tables
                        }
                    }
                }
            } catch (\Throwable $eSchema) {
            }
        }

        // 2. Populate normalized phone_norm9 and email_norm on subscribers
        try {
            $db->exec("
                UPDATE subscribers
                SET
                    phone_norm9 = CASE
                        WHEN CHAR_LENGTH(REGEXP_REPLACE(COALESCE(NULLIF(TRIM(phone_number), ''), TRIM(phone), ''), '[^0-9]', '')) >= 9
                        THEN RIGHT(REGEXP_REPLACE(COALESCE(NULLIF(TRIM(phone_number), ''), TRIM(phone), ''), '[^0-9]', ''), 9)
                        ELSE NULL
                    END,
                    email_norm = CASE
                        WHEN email IS NOT NULL
                             AND TRIM(email) != ''
                             AND LOWER(TRIM(email)) NOT LIKE '%@no-email.domation'
                             AND LOWER(TRIM(email)) NOT LIKE '%@zalo-oa.vn'
                             AND LOWER(TRIM(email)) NOT LIKE '%@facebook.com'
                        THEN LOWER(TRIM(email))
                        ELSE NULL
                    END,
                    updated_at = updated_at
                WHERE phone_norm9 IS NULL OR email_norm IS NULL
            ");
        } catch (\Throwable $eNormSql) {
            // Fallback in PHP batch if REGEXP_REPLACE is unavailable
            try {
                $stmtSubs = $db->query("SELECT id, email, phone_number, phone FROM subscribers WHERE phone_norm9 IS NULL OR email_norm IS NULL LIMIT 50000");
                $updNorm  = $db->prepare("UPDATE subscribers SET phone_norm9 = ?, email_norm = ?, updated_at = updated_at WHERE id = ?");
                while ($row = $stmtSubs->fetch(PDO::FETCH_ASSOC)) {
                    $p9 = self::normalizePhone9(!empty($row['phone_number']) ? $row['phone_number'] : ($row['phone'] ?? null));
                    $en = self::normalizeEmail($row['email'] ?? null);
                    $updNorm->execute([$p9 !== '' ? $p9 : null, $en !== '' ? $en : null, $row['id']]);
                }
            } catch (\Throwable $eNormPhp) {
            }
        }

        // 3. Build temporary indexed lookup tables from MYERP.contacts (WHERE deleted_at IS NULL)
        try {
            $db->exec("DROP TEMPORARY TABLE IF EXISTS tmp_myerp_phone_map");
            $db->exec("DROP TEMPORARY TABLE IF EXISTS tmp_myerp_email_map");

            $db->exec("
                CREATE TEMPORARY TABLE tmp_myerp_phone_map (
                    phone_norm9 VARCHAR(15) NOT NULL PRIMARY KEY,
                    contact_id INT NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
            $db->exec("
                CREATE TEMPORARY TABLE tmp_myerp_email_map (
                    email_norm VARCHAR(191) NOT NULL PRIMARY KEY,
                    contact_id INT NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            // Populate email lookup (1-to-1 deduplicated by MAX(id) to prevent Cartesian fanout)
            $db->exec("
                INSERT IGNORE INTO tmp_myerp_email_map (email_norm, contact_id)
                SELECT LOWER(TRIM(c.email)) AS email_norm, MAX(c.id) AS contact_id
                FROM contacts c
                WHERE c.deleted_at IS NULL
                  AND c.email IS NOT NULL
                  AND TRIM(c.email) != ''
                GROUP BY LOWER(TRIM(c.email))
            ");

            // Populate phone lookup across phone, mobile, phone2, zalo_phone
            try {
                $db->exec("
                    INSERT IGNORE INTO tmp_myerp_phone_map (phone_norm9, contact_id)
                    SELECT p.phone_norm9, MAX(p.contact_id) AS contact_id
                    FROM (
                        SELECT RIGHT(REGEXP_REPLACE(phone, '[^0-9]', ''), 9) AS phone_norm9, id AS contact_id
                        FROM contacts WHERE deleted_at IS NULL AND phone IS NOT NULL AND CHAR_LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '')) >= 9
                        UNION ALL
                        SELECT RIGHT(REGEXP_REPLACE(mobile, '[^0-9]', ''), 9) AS phone_norm9, id AS contact_id
                        FROM contacts WHERE deleted_at IS NULL AND mobile IS NOT NULL AND CHAR_LENGTH(REGEXP_REPLACE(mobile, '[^0-9]', '')) >= 9
                        UNION ALL
                        SELECT RIGHT(REGEXP_REPLACE(phone2, '[^0-9]', ''), 9) AS phone_norm9, id AS contact_id
                        FROM contacts WHERE deleted_at IS NULL AND phone2 IS NOT NULL AND CHAR_LENGTH(REGEXP_REPLACE(phone2, '[^0-9]', '')) >= 9
                        UNION ALL
                        SELECT RIGHT(REGEXP_REPLACE(zalo_phone, '[^0-9]', ''), 9) AS phone_norm9, id AS contact_id
                        FROM contacts WHERE deleted_at IS NULL AND zalo_phone IS NOT NULL AND CHAR_LENGTH(REGEXP_REPLACE(zalo_phone, '[^0-9]', '')) >= 9
                    ) p
                    WHERE p.phone_norm9 IS NOT NULL AND CHAR_LENGTH(p.phone_norm9) = 9
                    GROUP BY p.phone_norm9
                ");
            } catch (\Throwable $ePhoneMapSql) {
                $stmtC = $db->query("SELECT id, phone, mobile, phone2, zalo_phone FROM contacts WHERE deleted_at IS NULL");
                $insP  = $db->prepare("INSERT INTO tmp_myerp_phone_map (phone_norm9, contact_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE contact_id = GREATEST(contact_id, VALUES(contact_id))");
                while ($cr = $stmtC->fetch(PDO::FETCH_ASSOC)) {
                    $cid = (int)$cr['id'];
                    foreach (['phone', 'mobile', 'phone2', 'zalo_phone'] as $pCol) {
                        $p9 = self::normalizePhone9($cr[$pCol] ?? null);
                        if ($p9 !== '') {
                            $insP->execute([$p9, $cid]);
                        }
                    }
                }
            }

            // 4. Set-based Match-Only linking on `subscribers`
            $db->exec("
                UPDATE subscribers s
                JOIN tmp_myerp_phone_map pm ON s.phone_norm9 = pm.phone_norm9
                SET s.contact_id = pm.contact_id, s.updated_at = s.updated_at
                WHERE s.contact_id IS NULL AND s.phone_norm9 IS NOT NULL
            ");
            $db->exec("
                UPDATE subscribers s
                JOIN tmp_myerp_email_map em ON s.email_norm = em.email_norm
                SET s.contact_id = em.contact_id, s.updated_at = s.updated_at
                WHERE s.contact_id IS NULL AND s.email_norm IS NOT NULL
            ");

            // Propagate contact_id from matched subscribers to child tables
            $childTables = [
                'subscriber_activity',
                'subscriber_flow_states',
                'web_visitors',
                'survey_responses',
                'voucher_codes',
                'voucher_claims',
            ];
            foreach ($childTables as $tbl) {
                try {
                    $db->exec("
                        UPDATE `{$tbl}` t
                        JOIN subscribers s ON t.subscriber_id = s.id
                        SET t.contact_id = s.contact_id
                        WHERE s.contact_id IS NOT NULL AND t.contact_id IS NULL
                    ");
                } catch (\Throwable $eProp) {
                }
            }

            // Direct match on web_visitors by email/phone when subscriber_id is null
            try {
                $db->exec("
                    UPDATE web_visitors wv
                    JOIN tmp_myerp_email_map em ON LOWER(TRIM(wv.email)) = em.email_norm
                    SET wv.contact_id = em.contact_id
                    WHERE wv.contact_id IS NULL AND wv.email IS NOT NULL AND wv.email != ''
                ");
                $db->exec("
                    UPDATE web_visitors wv
                    JOIN tmp_myerp_phone_map pm ON RIGHT(REGEXP_REPLACE(wv.phone, '[^0-9]', ''), 9) = pm.phone_norm9
                    SET wv.contact_id = pm.contact_id
                    WHERE wv.contact_id IS NULL AND wv.phone IS NOT NULL AND CHAR_LENGTH(REGEXP_REPLACE(wv.phone, '[^0-9]', '')) >= 9
                ");
            } catch (\Throwable $eWvDirect) {
            }

            // Propagate & match zalo_subscribers
            try {
                $db->exec("
                    UPDATE zalo_subscribers zs
                    JOIN subscribers s ON zs.subscriber_id = s.id
                    SET zs.contact_id = s.contact_id, zs.updated_at = zs.updated_at
                    WHERE s.contact_id IS NOT NULL AND zs.contact_id IS NULL
                ");
                $db->exec("
                    UPDATE zalo_subscribers zs
                    JOIN tmp_myerp_phone_map pm ON RIGHT(REGEXP_REPLACE(zs.phone_number, '[^0-9]', ''), 9) = pm.phone_norm9
                    SET zs.contact_id = pm.contact_id, zs.updated_at = zs.updated_at
                    WHERE zs.contact_id IS NULL AND zs.phone_number IS NOT NULL AND CHAR_LENGTH(REGEXP_REPLACE(zs.phone_number, '[^0-9]', '')) >= 9
                ");
            } catch (\Throwable $eZsMatch) {
            }

            // Propagate & match meta_subscribers and meta_conversations
            try {
                $db->exec("
                    UPDATE meta_subscribers ms
                    JOIN tmp_myerp_email_map em ON LOWER(TRIM(ms.email)) = em.email_norm
                    SET ms.contact_id = em.contact_id
                    WHERE ms.contact_id IS NULL AND ms.email IS NOT NULL AND ms.email != ''
                ");
                $db->exec("
                    UPDATE meta_subscribers ms
                    JOIN tmp_myerp_phone_map pm ON RIGHT(REGEXP_REPLACE(ms.phone, '[^0-9]', ''), 9) = pm.phone_norm9
                    SET ms.contact_id = pm.contact_id
                    WHERE ms.contact_id IS NULL AND ms.phone IS NOT NULL AND CHAR_LENGTH(REGEXP_REPLACE(ms.phone, '[^0-9]', '')) >= 9
                ");
                $db->exec("
                    UPDATE meta_conversations mc
                    JOIN meta_subscribers ms ON mc.page_id = ms.page_id AND mc.psid = ms.psid
                    SET mc.contact_id = ms.contact_id
                    WHERE ms.contact_id IS NOT NULL AND mc.contact_id IS NULL
                ");
            } catch (\Throwable $eMetaMatch) {
            }

            // Propagate to domation_ai_conversations via web_visitors
            try {
                $db->exec("
                    UPDATE domation_ai_conversations dac
                    JOIN web_visitors wv ON wv.visitor_id = dac.visitor_id
                    SET dac.contact_id = wv.contact_id, dac.updated_at = dac.updated_at
                    WHERE wv.contact_id IS NOT NULL AND dac.contact_id IS NULL
                ");
            } catch (\Throwable $eAiMatch) {
            }

            // 5. Bulk-update denormalized omnichannel columns on MYERP.contacts (preserving updated_at)
            // 5a. Email & Subscriber core stats
            try {
                $db->exec("
                    UPDATE contacts c
                    JOIN (
                        SELECT
                            s.contact_id,
                            SUBSTRING_INDEX(GROUP_CONCAT(s.id ORDER BY s.updated_at DESC, s.joined_at DESC SEPARATOR ','), ',', 1) AS domation_subscriber_id,
                            CASE
                                WHEN SUBSTRING_INDEX(GROUP_CONCAT(LOWER(TRIM(COALESCE(s.status, 'subscribed'))) ORDER BY s.updated_at DESC SEPARATOR ','), ',', 1) IN ('unsubscribed', 'bounced', 'complained')
                                THEN SUBSTRING_INDEX(GROUP_CONCAT(LOWER(TRIM(COALESCE(s.status, 'subscribed'))) ORDER BY s.updated_at DESC SEPARATOR ','), ',', 1)
                                ELSE 'subscribed'
                            END AS marketing_status,
                            MAX(COALESCE(s.lead_score, 0)) AS engagement_score,
                            SUM(COALESCE(s.stats_sent, 0)) AS stats_email_sent,
                            SUM(COALESCE(s.stats_opened, 0)) AS stats_email_opened,
                            SUM(COALESCE(s.stats_clicked, 0)) AS stats_email_clicked,
                            MAX(s.last_open_at) AS last_email_open_at,
                            MAX(s.last_click_at) AS last_email_click_at,
                            MAX(NULLIF(TRIM(s.zalo_user_id), '')) AS zalo_user_id,
                            MAX(NULLIF(TRIM(s.meta_psid), '')) AS meta_psid
                        FROM subscribers s
                        WHERE s.contact_id IS NOT NULL
                        GROUP BY s.contact_id
                    ) sub_agg ON c.id = sub_agg.contact_id
                    SET
                        c.domation_subscriber_id = sub_agg.domation_subscriber_id,
                        c.marketing_status       = sub_agg.marketing_status,
                        c.engagement_score       = sub_agg.engagement_score,
                        c.stats_email_sent       = sub_agg.stats_email_sent,
                        c.stats_email_opened     = sub_agg.stats_email_opened,
                        c.stats_email_clicked    = sub_agg.stats_email_clicked,
                        c.last_email_open_at     = sub_agg.last_email_open_at,
                        c.last_email_click_at    = sub_agg.last_email_click_at,
                        c.zalo_user_id           = COALESCE(sub_agg.zalo_user_id, c.zalo_user_id),
                        c.meta_psid              = COALESCE(sub_agg.meta_psid, c.meta_psid),
                        c.updated_at             = c.updated_at
                    WHERE c.deleted_at IS NULL
                ");
            } catch (\Throwable $eBulkSub) {
            }

            // 5b. Active flows stats
            try {
                $db->exec("
                    UPDATE contacts c
                    JOIN (
                        SELECT
                            sfs.contact_id,
                            COUNT(DISTINCT sfs.flow_id) AS active_flow_count,
                            LEFT(GROUP_CONCAT(DISTINCT f.name ORDER BY f.name SEPARATOR ', '), 500) AS active_flow_names
                        FROM subscriber_flow_states sfs
                        LEFT JOIN flows f ON f.id = sfs.flow_id
                        WHERE sfs.contact_id IS NOT NULL
                          AND sfs.status IN ('waiting', 'processing')
                        GROUP BY sfs.contact_id
                    ) flow_agg ON c.id = flow_agg.contact_id
                    SET
                        c.active_flow_count = LEAST(65535, flow_agg.active_flow_count),
                        c.active_flow_names = flow_agg.active_flow_names,
                        c.updated_at        = c.updated_at
                    WHERE c.deleted_at IS NULL
                ");
            } catch (\Throwable $eBulkFlow) {
            }

            // 5c. Web visitor & pageview stats
            try {
                $db->exec("
                    UPDATE contacts c
                    JOIN (
                        SELECT
                            wv.contact_id,
                            MAX(COALESCE(wv.last_seen_at, wv.last_visit_at)) AS last_web_visit_at,
                            COALESCE(SUM(wv.visit_count), 0) AS visit_count
                        FROM web_visitors wv
                        WHERE wv.contact_id IS NOT NULL
                        GROUP BY wv.contact_id
                    ) wv_agg ON c.id = wv_agg.contact_id
                    SET
                        c.last_web_visit_at   = wv_agg.last_web_visit_at,
                        c.web_pageviews_count = GREATEST(c.web_pageviews_count, wv_agg.visit_count),
                        c.updated_at          = c.updated_at
                    WHERE c.deleted_at IS NULL
                ");

                $db->exec("
                    UPDATE contacts c
                    JOIN (
                        SELECT
                            wv.contact_id,
                            COUNT(wpv.id) AS pv_count,
                            LEAST(100, COALESCE(MAX(wpv.scroll_depth), 0)) AS max_scroll_depth,
                            MAX(wpv.loaded_at) AS last_pv_at
                        FROM web_page_views wpv
                        JOIN web_visitors wv ON (wv.id = wpv.visitor_id OR wv.visitor_id = wpv.visitor_id)
                        WHERE wv.contact_id IS NOT NULL
                        GROUP BY wv.contact_id
                    ) pv_agg ON c.id = pv_agg.contact_id
                    SET
                        c.web_pageviews_count = GREATEST(c.web_pageviews_count, pv_agg.pv_count),
                        c.max_scroll_depth    = GREATEST(c.max_scroll_depth, pv_agg.max_scroll_depth),
                        c.last_web_visit_at   = COALESCE(GREATEST(COALESCE(c.last_web_visit_at, pv_agg.last_pv_at), pv_agg.last_pv_at), c.last_web_visit_at, pv_agg.last_pv_at),
                        c.updated_at          = c.updated_at
                    WHERE c.deleted_at IS NULL
                ");
            } catch (\Throwable $eBulkWeb) {
            }

            // 5d. Active voucher code
            try {
                $db->exec("
                    UPDATE contacts c
                    JOIN (
                        SELECT
                            vc.contact_id,
                            SUBSTRING_INDEX(GROUP_CONCAT(vc.code ORDER BY COALESCE(vc.claimed_at, vc.sent_at, vc.created_at) DESC SEPARATOR ','), ',', 1) AS active_voucher_code
                        FROM voucher_codes vc
                        WHERE vc.contact_id IS NOT NULL
                          AND vc.status = 'unused'
                          AND (vc.expires_at IS NULL OR vc.expires_at >= NOW())
                        GROUP BY vc.contact_id
                    ) vc_agg ON c.id = vc_agg.contact_id
                    SET
                        c.active_voucher_code = vc_agg.active_voucher_code,
                        c.updated_at          = c.updated_at
                    WHERE c.deleted_at IS NULL
                ");
            } catch (\Throwable $eBulkVc) {
            }

            // 5e. Survey completed count
            try {
                $db->exec("
                    UPDATE contacts c
                    JOIN (
                        SELECT
                            sr.contact_id,
                            COUNT(*) AS survey_completed_count
                        FROM survey_responses sr
                        WHERE sr.contact_id IS NOT NULL
                        GROUP BY sr.contact_id
                    ) sr_agg ON c.id = sr_agg.contact_id
                    SET
                        c.survey_completed_count = LEAST(65535, sr_agg.survey_completed_count),
                        c.updated_at             = c.updated_at
                    WHERE c.deleted_at IS NULL
                ");
            } catch (\Throwable $eBulkSr) {
            }

            // 5f. Zalo & Meta IDs from zalo_subscribers and meta_subscribers
            try {
                $db->exec("
                    UPDATE contacts c
                    JOIN (
                        SELECT contact_id, MAX(zalo_user_id) AS zalo_user_id
                        FROM zalo_subscribers
                        WHERE contact_id IS NOT NULL AND zalo_user_id IS NOT NULL AND zalo_user_id != ''
                        GROUP BY contact_id
                    ) zs_agg ON c.id = zs_agg.contact_id
                    SET
                        c.zalo_user_id = COALESCE(c.zalo_user_id, zs_agg.zalo_user_id),
                        c.updated_at   = c.updated_at
                    WHERE c.deleted_at IS NULL
                ");
                $db->exec("
                    UPDATE contacts c
                    JOIN (
                        SELECT contact_id, MAX(psid) AS meta_psid
                        FROM meta_subscribers
                        WHERE contact_id IS NOT NULL AND psid IS NOT NULL AND psid != ''
                        GROUP BY contact_id
                    ) ms_agg ON c.id = ms_agg.contact_id
                    SET
                        c.meta_psid  = COALESCE(c.meta_psid, ms_agg.meta_psid),
                        c.updated_at = c.updated_at
                    WHERE c.deleted_at IS NULL
                ");
            } catch (\Throwable $eBulkChannel) {
            }

            $summary['matched_subscribers'] = (int)($db->query("SELECT COUNT(*) FROM subscribers WHERE contact_id IS NOT NULL")->fetchColumn() ?: 0);
            $summary['matched_contacts']    = (int)($db->query("SELECT COUNT(DISTINCT contact_id) FROM subscribers WHERE contact_id IS NOT NULL")->fetchColumn() ?: 0);

            $db->exec("DROP TEMPORARY TABLE IF EXISTS tmp_myerp_phone_map");
            $db->exec("DROP TEMPORARY TABLE IF EXISTS tmp_myerp_email_map");
        } catch (\Throwable $eBulk) {
            error_log("[DomationContactMatcher::runBulkMatchAndRefresh] " . $eBulk->getMessage());
        }

        return $summary;
    }
}

if (!function_exists('domationSyncSubscriberMatchOnly')) {
    /**
     * Global helper for DOMATION automation scripts to trigger Match-Only sync
     * while preserving UUID subscriber IDs (`CHAR(36)`).
     */
    function domationSyncSubscriberMatchOnly(PDO $pdo, $subscriberId): void
    {
        if ($subscriberId === null || $subscriberId === '') {
            return;
        }
        try {
            DomationContactMatcher::syncSubscriberMatchOnly($pdo, (string)$subscriberId);
        } catch (\Throwable $e) {
            error_log("[domationSyncSubscriberMatchOnly] " . $e->getMessage());
        }
    }
}
