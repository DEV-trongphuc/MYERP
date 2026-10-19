<?php
/**
 * backend/cron_ai_proactive_agent.php
 * ---------------------------------------------------------------------------
 * Hệ thống Cronjob AI Agent Chủ Động (Proactive Role-Based AI Assistant - SI IDEAS)
 * Tự động phân tích dữ liệu thực tế theo Vị trí (Job Title), Cấp độ (Level: C-Level /
 * Manager / Specialist) & Vai trò (Role) của từng nhân sự để gửi thông điệp điều hành,
 * nhắc việc, cảnh báo SLA và gợi ý hành động thông minh trực tiếp vào hộp chat SI IDEAS.
 *
 * Tuân thủ 100% Hiến chương MYERP (AGENTS.md):
 * - Zero Mock Data: 100% số liệu truy vấn trực tiếp từ MySQL thực tế.
 * - Zero Spam: Chỉ gửi tối đa 1 bản tin/khung giờ/ngày qua bảng `sent_notifications`,
 *   tự động bỏ qua nhân sự đang nghỉ phép (`vacation_mode`, `hrm_leave_requests`) hoặc ngày lễ.
 * - 100% NULL-safe SQL (`NOT EXISTS`, không dùng `NOT IN (NULL)`).
 */

require_once __DIR__ . '/config.php';

if (!function_exists('ensureIdeasAiConversationForCron')) {
    /**
     * Đảm bảo cuộc trò chuyện 1-1 giữa nhân sự ($uid) và SI IDEAS (9000001) luôn tồn tại
     */
    function ensureIdeasAiConversationForCron(PDO $pdo, int $uid, int $tid = 1): int
    {
        if ($uid <= 0 || $uid === 9000001) {
            return 0;
        }
        try {
            // Đảm bảo tài khoản bot SI IDEAS (9000001) tồn tại
            try {
                $pdo->exec("
                    INSERT INTO users (id, tenant_id, username, email, full_name, role, job_title, avatar_url, is_active, status)
                    VALUES (9000001, 1, 'si_ideas', 'ai@ideas.edu.vn', 'SI IDEAS', 'bot', 'Smart Multi Agent', '/stickers/ideas/ideas_3.webp', 1, 'active')
                    ON DUPLICATE KEY UPDATE
                        full_name = 'SI IDEAS',
                        job_title = 'Smart Multi Agent',
                        role = 'bot',
                        avatar_url = '/stickers/ideas/ideas_3.webp',
                        is_active = 1,
                        status = 'active'
                ");
            } catch (\Throwable $eBot) {
            }

            $stmt = $pdo->prepare("
                SELECT c.id
                FROM chat_conversations c
                JOIN chat_participants p1 ON c.id = p1.conversation_id AND p1.user_id = ?
                JOIN chat_participants p2 ON c.id = p2.conversation_id AND p2.user_id = 9000001
                WHERE (c.tenant_id = ? OR c.tenant_id = 1) AND c.type = 'direct'
                LIMIT 1
            ");
            $stmt->execute([$uid, $tid]);
            $convId = (int)$stmt->fetchColumn();
            if ($convId > 0) {
                return $convId;
            }

            $pdo->beginTransaction();
            $stmtConv = $pdo->prepare("
                INSERT INTO chat_conversations (tenant_id, type, title, avatar_url, created_by, last_message_at, created_at, updated_at)
                VALUES (?, 'direct', 'SI IDEAS', '/stickers/ideas/ideas_3.webp', 9000001, NOW(), NOW(), NOW())
            ");
            $stmtConv->execute([$tid]);
            $convId = (int)$pdo->lastInsertId();

            $stmtP1 = $pdo->prepare("
                INSERT INTO chat_participants (tenant_id, conversation_id, user_id, role, is_pinned, joined_at)
                VALUES (?, ?, ?, 'member', 1, NOW())
            ");
            $stmtP1->execute([$tid, $convId, $uid]);

            $stmtP2 = $pdo->prepare("
                INSERT INTO chat_participants (tenant_id, conversation_id, user_id, role, is_pinned, joined_at)
                VALUES (?, ?, 9000001, 'owner', 0, NOW())
            ");
            $stmtP2->execute([$tid, $convId]);

            $pdo->commit();
            return $convId;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            error_log("ensureIdeasAiConversationForCron error for user {$uid}: " . $e->getMessage());
            return 0;
        }
    }
}

if (!function_exists('classifyUserProactivePersona')) {
    /**
     * Phân loại Persona công việc theo Role, Cấp bậc (Level) và Chức danh (Job Title / Department)
     */
    function classifyUserProactivePersona(array $user, array $ledTeamIds = []): array
    {
        $role = mb_strtolower(trim((string)($user['role'] ?? '')), 'UTF-8');
        $jobTitle = mb_strtolower(trim((string)($user['job_title'] ?? '')), 'UTF-8');
        $dept = mb_strtolower(trim((string)($user['department'] ?? '')), 'UTF-8');
        $combined = $role . ' ' . $jobTitle . ' ' . $dept;

        // 1. C-Level / Ban Giám Đốc / Quản trị cấp cao
        if (
            in_array($role, ['director', 'admin', 'super_admin', 'superadmin'], true) ||
            preg_match('/(giám đốc|tổng giám đốc|ceo|founder|chủ tịch|ban giám đốc)/u', $jobTitle)
        ) {
            return [
                'persona' => 'executive',
                'level' => 'C-Level / Ban Điều Hành',
                'badge' => '👑 Trợ lý Điều hành Cấp cao (Executive Briefing)',
                'greeting_title' => !empty($user['job_title']) ? $user['job_title'] : 'Ban Giám đốc'
            ];
        }

        // 2. Kế toán / Tài chính
        if (
            in_array($role, ['accountant', 'finance'], true) ||
            preg_match('/(kế toán|tài chính|thu ngân|kiểm toán|công nợ)/u', $combined)
        ) {
            $isChief = preg_match('/(trưởng|kế toán trưởng|manager|head|leader)/u', $jobTitle);
            return [
                'persona' => 'finance',
                'level' => $isChief ? 'Kế toán trưởng / Quản lý Tài chính' : 'Chuyên viên Kế toán - Tài chính',
                'badge' => '💰 Trợ lý Tài chính & Đối soát (Finance AI)',
                'greeting_title' => !empty($user['job_title']) ? $user['job_title'] : 'Bộ phận Kế toán'
            ];
        }

        // 3. Hành chính - Nhân sự (HR)
        if (
            in_array($role, ['hr', 'hrm'], true) ||
            preg_match('/(nhân sự|hành chính|tuyển dụng|hr\b|c&b)/u', $combined)
        ) {
            $isManager = preg_match('/(trưởng|manager|head|leader)/u', $jobTitle);
            return [
                'persona' => 'hr',
                'level' => $isManager ? 'Trưởng phòng Nhân sự' : 'Chuyên viên Hành chính - Nhân sự',
                'badge' => '👥 Trợ lý Quản trị Nhân sự (HRM AI)',
                'greeting_title' => !empty($user['job_title']) ? $user['job_title'] : 'Bộ phận Nhân sự'
            ];
        }

        // 4. Marketing & Truyền thông
        if (
            in_array($role, ['marketing'], true) ||
            preg_match('/(marketing|digital|content|ads|truyền thông|thương hiệu|pr\b|seo)/u', $combined)
        ) {
            $isManager = preg_match('/(trưởng|manager|head|leader|cmo)/u', $jobTitle);
            return [
                'persona' => 'marketing',
                'level' => $isManager ? 'Quản lý Marketing (Marketing Lead)' : 'Chuyên viên Marketing & Tăng trưởng',
                'badge' => '📣 Trợ lý Chiến dịch & Phễu Marketing (Growth AI)',
                'greeting_title' => !empty($user['job_title']) ? $user['job_title'] : 'Bộ phận Marketing'
            ];
        }

        // 5. Quản lý Kinh doanh / Team Leader
        if (
            in_array($role, ['manager', 'team_lead', 'sale_leader', 'leader', 'truongphong', 'head_of_department'], true) ||
            !empty($ledTeamIds) ||
            preg_match('/(trưởng phòng kinh doanh|trưởng nhóm|team lead|sales manager|quản lý tuyển sinh)/u', $jobTitle)
        ) {
            return [
                'persona' => 'sales_manager',
                'level' => 'Quản lý Đội ngũ / Team Leader',
                'badge' => '📊 Trợ lý Điều phối Đội ngũ Kinh doanh (Sales Leader AI)',
                'greeting_title' => !empty($user['job_title']) ? $user['job_title'] : 'Quản lý Kinh doanh'
            ];
        }

        // 6. Học vụ / Đào tạo / CSKH
        if (
            in_array($role, ['academic', 'support', 'teacher'], true) ||
            preg_match('/(học vụ|đào tạo|giảng viên|chăm sóc học viên|cskh|student service)/u', $combined)
        ) {
            return [
                'persona' => 'academic',
                'level' => 'Chuyên viên Học vụ & Chăm sóc Học viên',
                'badge' => '🎓 Trợ lý Học vụ & Dịch vụ Học viên (Academic AI)',
                'greeting_title' => !empty($user['job_title']) ? $user['job_title'] : 'Bộ phận Học vụ'
            ];
        }

        // 7. Chuyên viên Tư vấn Tuyển sinh / Kinh doanh (Sales Consultant)
        return [
            'persona' => 'sales_consultant',
            'level' => 'Chuyên viên Tư vấn Tuyển sinh',
            'badge' => '🚀 Trợ lý Tăng tốc Chốt Deal & Chăm sóc Lead (Sales AI)',
            'greeting_title' => !empty($user['job_title']) ? $user['job_title'] : 'Chuyên viên Tư vấn'
        ];
    }
}

if (!function_exists('buildProactiveAiBriefingForUser')) {
    /**
     * Xây dựng nội dung tin nhắn chủ động từ dữ liệu thực tế cho từng vị trí, cấp độ, vai trò
     * Trả về null nếu khung giờ đó không có thông tin cần thiết để tránh làm phiền nhân sự.
     */
    function buildProactiveAiBriefingForUser(PDO $pdo, array $user, string $slot, array $ledTeamIds = []): ?array
    {
        $uid = (int)($user['id'] ?? 0);
        $tid = (int)($user['tenant_id'] ?? 1);
        $fullName = trim((string)($user['full_name'] ?? 'Bạn'));
        $parts = preg_split('/\s+/u', $fullName);
        $shortName = !empty($parts) ? end($parts) : $fullName;

        $personaInfo = classifyUserProactivePersona($user, $ledTeamIds);
        $persona = $personaInfo['persona'];
        $badge = $personaInfo['badge'];
        $levelLabel = $personaInfo['level'];
        $jobTitleLabel = !empty($user['job_title']) ? $user['job_title'] : $levelLabel;

        $todayStart = date('Y-m-d 00:00:00');
        $todayEnd = date('Y-m-d 23:59:59');
        $yesterdayStart = date('Y-m-d 00:00:00', strtotime('-1 day'));
        $yesterdayEnd = date('Y-m-d 23:59:59', strtotime('-1 day'));
        $monthStart = date('Y-m-01 00:00:00');
        $todayDate = date('Y-m-d');

        // Helper truy vấn an toàn
        $safeScalar = function (string $sql, array $params = []) use ($pdo) {
            try {
                $st = $pdo->prepare($sql);
                $st->execute($params);
                return $st->fetchColumn();
            } catch (\Throwable $e) {
                return 0;
            }
        };

        $safeRows = function (string $sql, array $params = []) use ($pdo): array {
            try {
                $st = $pdo->prepare($sql);
                $st->execute($params);
                return $st->fetchAll(PDO::FETCH_ASSOC) ?: [];
            } catch (\Throwable $e) {
                return [];
            }
        };

        // Đếm công việc cá nhân đến hạn hôm nay hoặc quá hạn
        $myTasksDueToday = (int)$safeScalar("
            SELECT COUNT(*) FROM tasks
            WHERE (assigned_to = ? OR created_by = ?)
              AND status NOT IN ('completed', 'done', 'cancelled')
              AND due_date IS NOT NULL AND DATE(due_date) <= ?
        ", [$uid, $uid, $todayDate]);

        $lines = [];
        $actions = [];
        $hasActionableSignal = false;

        // =====================================================================
        // 1. PERSONA: EXECUTIVE (DIRECTOR / CEO / ADMIN / SUPER_ADMIN)
        // =====================================================================
        if ($persona === 'executive') {
            $newLeadsToday = (int)$safeScalar("
                SELECT COUNT(*) FROM contacts
                WHERE tenant_id = ? AND deleted_at IS NULL AND created_at >= ? AND created_at <= ?
            ", [$tid, $todayStart, $todayEnd]);

            $newLeadsYesterday = (int)$safeScalar("
                SELECT COUNT(*) FROM contacts
                WHERE tenant_id = ? AND deleted_at IS NULL AND created_at >= ? AND created_at <= ?
            ", [$tid, $yesterdayStart, $yesterdayEnd]);

            $slaUncontacted = (int)$safeScalar("
                SELECT COUNT(*) FROM contacts c
                WHERE c.tenant_id = ? AND c.deleted_at IS NULL
                  AND c.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
                  AND c.created_at <= DATE_SUB(NOW(), INTERVAL 2 HOUR)
                  AND COALESCE(c.lead_status, '') NOT IN ('lost', 'junk', 'duplicate')
                  AND NOT EXISTS (
                      SELECT 1 FROM activities a
                      WHERE a.contact_id = c.id AND a.deleted_at IS NULL
                  )
            ", [$tid]);

            $monthDepositAmount = (float)$safeScalar("
                SELECT COALESCE(SUM(d.amount), 0)
                FROM deposits d
                LEFT JOIN users u ON d.created_by = u.id
                WHERE (u.tenant_id = ? OR d.created_by IS NULL)
                  AND d.deleted_at IS NULL
                  AND d.status = 'approved'
                  AND d.created_at >= ?
            ", [$tid, $monthStart]);

            $pendingDeposits = (int)$safeScalar("
                SELECT COUNT(*) FROM deposits d
                LEFT JOIN users u ON d.created_by = u.id
                WHERE (u.tenant_id = ? OR d.created_by IS NULL)
                  AND d.deleted_at IS NULL AND d.status = 'pending'
            ", [$tid]);

            $pendingExpenses = (int)$safeScalar("
                SELECT COUNT(*) FROM expenses
                WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'pending'
            ", [$tid]);

            $pendingLeaves = (int)$safeScalar("
                SELECT COUNT(*) FROM hrm_leave_requests lr
                JOIN users u ON lr.user_id = u.id
                WHERE u.tenant_id = ? AND lr.status = 'pending'
            ", [$tid]);

            $pendingAdvances = (int)$safeScalar("
                SELECT COUNT(*) FROM hrm_salary_advances sa
                JOIN users u ON sa.user_id = u.id
                WHERE u.tenant_id = ? AND sa.status = 'pending'
            ", [$tid]);

            $totalPendingApprovals = $pendingDeposits + $pendingExpenses + $pendingLeaves + $pendingAdvances;

            if ($slot === 'midday' && $slaUncontacted === 0 && $totalPendingApprovals === 0) {
                return null; // Không làm phiền buổi trưa nếu mọi chỉ số SLA và phê duyệt đều sạch
            }

            $hasActionableSignal = true;
            $greetingPrefix = $slot === 'morning'
                ? "Chào buổi sáng **{$fullName}** ({$jobTitleLabel})! ☀️"
                : ($slot === 'midday'
                    ? "Cập nhật nhanh giữa ngày gửi **{$fullName}** ({$jobTitleLabel}) ⚡"
                    : "Tổng kết điều hành cuối ngày gửi **{$fullName}** ({$jobTitleLabel}) 🌆");

            $lines[] = "{$greetingPrefix}\n_{$badge}_";
            $lines[] = "📊 **Toàn cảnh Vận hành & Kinh doanh thực tế:**";
            $lines[] = "• **Lead tuyển sinh:** Hôm nay ghi nhận **{$newLeadsToday} Lead mới** (Hôm qua: **{$newLeadsYesterday} Lead**).";
            if ($slaUncontacted > 0) {
                $lines[] = "• ⚠️ **Cảnh báo SLA Chăm sóc:** Hiện có **{$slaUncontacted} Lead mới quá 2 giờ** chưa có lịch sử cuộc gọi/chăm sóc trên CRM.";
            } else {
                $lines[] = "• ✅ **Kỷ luật SLA:** 100% Lead mới trong 14 ngày qua đều đã được đội ngũ tiếp cận.";
            }
            $lines[] = "• 💰 **Doanh số Đặt cọc đã duyệt tháng này:** **" . number_format($monthDepositAmount, 0, ',', '.') . " VNĐ**.";
            if ($totalPendingApprovals > 0) {
                $lines[] = "• 📝 **Hồ sơ chờ phê duyệt ({$totalPendingApprovals} phiếu):** Đặt cọc (**{$pendingDeposits}**), Đề xuất chi (**{$pendingExpenses}**), Đơn nghỉ phép/Tăng ca (**{$pendingLeaves}**), Tạm ứng (**{$pendingAdvances}**).";
            }

            $actions = [
                "Báo cáo tổng hợp điều hành toàn công ty hôm nay",
                "Phân tích các Lead quá hạn SLA chưa chăm sóc",
                "So sánh hiệu suất tuyển sinh tháng này với tháng trước"
            ];
        }

        // =====================================================================
        // 2. PERSONA: SALES MANAGER / TEAM LEADER
        // =====================================================================
        elseif ($persona === 'sales_manager') {
            $teamId = (int)($user['team_id'] ?? 0);
            $allTeamIds = array_values(array_unique(array_filter(array_merge($ledTeamIds, $teamId > 0 ? [$teamId] : []))));

            $teamMemberIds = [$uid];
            if (!empty($allTeamIds)) {
                $inPlaceholders = implode(',', array_fill(0, count($allTeamIds), '?'));
                $memberRows = $safeRows("SELECT id FROM users WHERE team_id IN ($inPlaceholders) AND is_active = 1", $allTeamIds);
                foreach ($memberRows as $mr) {
                    $teamMemberIds[] = (int)$mr['id'];
                }
                $teamMemberIds = array_values(array_unique($teamMemberIds));
            }

            $memPlaceholders = implode(',', array_fill(0, count($teamMemberIds), '?'));
            $teamLeadsToday = (int)$safeScalar(
                "SELECT COUNT(*) FROM contacts WHERE tenant_id = ? AND deleted_at IS NULL AND owner_id IN ($memPlaceholders) AND created_at >= ?",
                array_merge([$tid], $teamMemberIds, [$todayStart])
            );

            $teamLeadsYesterday = (int)$safeScalar(
                "SELECT COUNT(*) FROM contacts WHERE tenant_id = ? AND deleted_at IS NULL AND owner_id IN ($memPlaceholders) AND created_at >= ? AND created_at <= ?",
                array_merge([$tid], $teamMemberIds, [$yesterdayStart, $yesterdayEnd])
            );

            $teamUncontacted = (int)$safeScalar(
                "SELECT COUNT(*) FROM contacts c
                 WHERE c.tenant_id = ? AND c.deleted_at IS NULL
                   AND c.owner_id IN ($memPlaceholders)
                   AND c.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
                   AND c.created_at <= DATE_SUB(NOW(), INTERVAL 2 HOUR)
                   AND COALESCE(c.lead_status, '') NOT IN ('lost', 'junk', 'duplicate')
                   AND NOT EXISTS (SELECT 1 FROM activities a WHERE a.contact_id = c.id AND a.deleted_at IS NULL)",
                array_merge([$tid], $teamMemberIds)
            );

            $teamHotLeads = (int)$safeScalar(
                "SELECT COUNT(*) FROM contacts
                 WHERE tenant_id = ? AND deleted_at IS NULL
                   AND owner_id IN ($memPlaceholders)
                   AND LOWER(COALESCE(temperature, '')) = 'hot'
                   AND COALESCE(lead_status, '') NOT IN ('lost', 'junk', 'converted')",
                array_merge([$tid], $teamMemberIds)
            );

            $pendingTeamLeaves = (int)$safeScalar(
                "SELECT COUNT(*) FROM hrm_leave_requests WHERE approver_id = ? AND status = 'pending'",
                [$uid]
            );

            if ($slot === 'midday' && $teamUncontacted === 0 && $pendingTeamLeaves === 0) {
                return null;
            }

            $hasActionableSignal = true;
            $lines[] = ($slot === 'morning'
                ? "Chào buổi sáng **{$fullName}** ({$jobTitleLabel})! 🎯"
                : ($slot === 'midday' ? "Cảnh báo SLA & Điều phối Đội ngũ giữa ngày ⚡" : "Tổng kết hiệu suất Đội ngũ cuối ngày 📈")) . "\n_{$badge}_";
            $lines[] = "👥 **Chỉ số Đội ngũ Kinh doanh của bạn (" . count($teamMemberIds) . " thành viên):**";
            $lines[] = "• **Lead phân bổ cho Team:** Hôm nay **{$teamLeadsToday} Lead** | Hôm qua **{$teamLeadsYesterday} Lead**.";
            $lines[] = "• 🔥 **Cơ hội Nóng (Hot Leads) của Team đang mở:** **{$teamHotLeads} khách hàng** cần hỗ trợ chốt deal.";
            if ($teamUncontacted > 0) {
                $lines[] = "• 🚨 **Cảnh báo SLA Team:** Có **{$teamUncontacted} Lead quá 2 giờ** chưa được thành viên ghi nhận chăm sóc trên CRM.";
            } else {
                $lines[] = "• ✅ **SLA Chăm sóc:** Toàn bộ Lead mới của Team đều đã được liên hệ đúng hạn.";
            }
            if ($pendingTeamLeaves > 0) {
                $lines[] = "• 📋 **Đơn từ chờ bạn duyệt:** **{$pendingTeamLeaves} đơn** nghỉ phép/giải trình của thành viên.";
            }

            $actions = [
                "Kiểm tra danh sách Lead quá hạn SLA trong Team của tôi",
                "Bảng xếp hạng hiệu suất & tỷ lệ chốt của từng Sale trong Team",
                "Danh sách khách hàng Hot của Team cần hỗ trợ chốt cọc"
            ];
        }

        // =====================================================================
        // 3. PERSONA: SALES CONSULTANT (CHUYÊN VIÊN TƯ VẤN TUYỂN SINH)
        // =====================================================================
        elseif ($persona === 'sales_consultant') {
            $myUncontactedRows = $safeRows("
                SELECT c.id, c.full_name, c.phone, c.program, c.source, c.created_at
                FROM contacts c
                WHERE c.tenant_id = ? AND c.deleted_at IS NULL
                  AND c.owner_id = ?
                  AND c.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                  AND COALESCE(c.lead_status, '') NOT IN ('lost', 'junk', 'duplicate', 'converted')
                  AND NOT EXISTS (
                      SELECT 1 FROM activities a
                      WHERE a.contact_id = c.id AND a.deleted_at IS NULL
                  )
                ORDER BY c.created_at DESC
                LIMIT 5
            ", [$tid, $uid]);

            $myUncontactedCount = (int)$safeScalar("
                SELECT COUNT(*) FROM contacts c
                WHERE c.tenant_id = ? AND c.deleted_at IS NULL
                  AND c.owner_id = ?
                  AND c.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                  AND COALESCE(c.lead_status, '') NOT IN ('lost', 'junk', 'duplicate', 'converted')
                  AND NOT EXISTS (
                      SELECT 1 FROM activities a
                      WHERE a.contact_id = c.id AND a.deleted_at IS NULL
                  )
            ", [$tid, $uid]);

            $myHotCount = (int)$safeScalar("
                SELECT COUNT(*) FROM contacts
                WHERE tenant_id = ? AND deleted_at IS NULL
                  AND owner_id = ?
                  AND LOWER(COALESCE(temperature, '')) = 'hot'
                  AND COALESCE(lead_status, '') NOT IN ('lost', 'junk', 'duplicate', 'converted')
            ", [$tid, $uid]);

            $myLeadsToday = (int)$safeScalar("
                SELECT COUNT(*) FROM contacts
                WHERE tenant_id = ? AND deleted_at IS NULL
                  AND owner_id = ? AND created_at >= ?
            ", [$tid, $uid, $todayStart]);

            $myActivitiesToday = (int)$safeScalar("
                SELECT COUNT(*) FROM activities
                WHERE user_id = ? AND deleted_at IS NULL AND created_at >= ?
            ", [$uid, $todayStart]);

            if ($slot === 'midday' && $myUncontactedCount === 0 && $myTasksDueToday === 0) {
                return null;
            }

            $hasActionableSignal = true;
            $lines[] = ($slot === 'morning'
                ? "Chào buổi sáng **{$shortName}** ({$jobTitleLabel})! Chúc bạn một ngày bùng nổ doanh số 🚀"
                : ($slot === 'midday'
                    ? "Nhắc việc thông minh giữa ngày cho **{$shortName}** ⚡"
                    : "Tổng kết ca làm việc hôm nay của **{$shortName}** 🌟")) . "\n_{$badge}_";

            $lines[] = "📌 **Tiêu điểm Chăm sóc Khách hàng của bạn hôm nay:**";
            if ($myUncontactedCount > 0) {
                $sampleNames = [];
                foreach (array_slice($myUncontactedRows, 0, 3) as $r) {
                    $prog = !empty($r['program']) ? " ({$r['program']})" : "";
                    $sampleNames[] = "**" . ($r['full_name'] ?: 'Khách hàng') . "**{$prog}";
                }
                $sampleText = !empty($sampleNames) ? " — Tiêu biểu: " . implode(', ', $sampleNames) : "";
                $lines[] = "• 📞 **Cần gọi ngay:** Bạn có **{$myUncontactedCount} Lead mới** chưa ghi nhận lịch sử chăm sóc{$sampleText}.";
            } else {
                $lines[] = "• ✅ **Tuyệt vời:** Bạn đã liên hệ 100% Lead mới được phân bổ!";
            }

            $lines[] = "• 🔥 **Khách hàng tiềm năng Nóng (Hot Leads):** **{$myHotCount} hồ sơ** đang mở cần ưu tiên bám sát chốt cọc.";
            $lines[] = "• 📈 **Hoạt động hôm nay:** Nhận mới **{$myLeadsToday} Lead** | Đã ghi nhận **{$myActivitiesToday} tương tác chăm sóc**.";
            if ($myTasksDueToday > 0) {
                $lines[] = "• ⏰ **Công việc / Lịch hẹn đến hạn hôm nay:** **{$myTasksDueToday} đầu việc** cần hoàn tất.";
            }

            $actions = [
                "Liệt kê danh sách Lead mới của tôi chưa được liên hệ",
                "Danh sách khách hàng Hot của tôi cần ưu tiên gọi hôm nay",
                "Gợi ý kịch bản tư vấn chốt học viên MBA & DBA ISTEC Paris"
            ];
        }

        // =====================================================================
        // 4. PERSONA: FINANCE & ACCOUNTANT (KẾ TOÁN - TÀI CHÍNH)
        // =====================================================================
        elseif ($persona === 'finance') {
            $pendingDeposits = (int)$safeScalar("
                SELECT COUNT(*) FROM deposits d
                LEFT JOIN users u ON d.created_by = u.id
                WHERE (u.tenant_id = ? OR d.created_by IS NULL)
                  AND d.deleted_at IS NULL AND d.status = 'pending'
            ", [$tid]);

            $pendingExpenses = (int)$safeScalar("
                SELECT COUNT(*) FROM expenses
                WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'pending'
            ", [$tid]);

            $pendingAdvances = (int)$safeScalar("
                SELECT COUNT(*) FROM hrm_salary_advances sa
                JOIN users u ON sa.user_id = u.id
                WHERE u.tenant_id = ? AND sa.status = 'pending'
            ", [$tid]);

            $approvedMonthTotal = (float)$safeScalar("
                SELECT COALESCE(SUM(d.amount), 0) FROM deposits d
                LEFT JOIN users u ON d.created_by = u.id
                WHERE (u.tenant_id = ? OR d.created_by IS NULL)
                  AND d.deleted_at IS NULL AND d.status = 'approved' AND d.created_at >= ?
            ", [$tid, $monthStart]);

            if ($slot === 'midday' && $pendingDeposits === 0 && $pendingExpenses === 0 && $pendingAdvances === 0) {
                return null;
            }

            $hasActionableSignal = true;
            $lines[] = ($slot === 'morning'
                ? "Chào buổi sáng **{$fullName}** ({$jobTitleLabel})! 💼"
                : "Cập nhật đối soát Tài chính - Kế toán trong ngày ⚡") . "\n_{$badge}_";
            $lines[] = "💳 **Tình hình Chứng từ & Dòng tiền cần lưu ý:**";
            $lines[] = "• 🏦 **Phiếu Đặt cọc / UNC chờ xác nhận:** **{$pendingDeposits} phiếu** đang chờ Kế toán kiểm tra.";
            $lines[] = "• 🧾 **Đề xuất chi & Tạm ứng chờ xử lý:** **{$pendingExpenses} phiếu chi** | **{$pendingAdvances} đề nghị tạm ứng**.";
            $lines[] = "• 📊 **Tổng thu Đặt cọc đã duyệt tháng này:** **" . number_format($approvedMonthTotal, 0, ',', '.') . " VNĐ**.";
            if ($myTasksDueToday > 0) {
                $lines[] = "• ⏰ **Công việc cá nhân đến hạn hôm nay:** **{$myTasksDueToday} đầu việc**.";
            }

            $actions = [
                "Danh sách các phiếu đặt cọc đang chờ Kế toán xác nhận UNC",
                "Tổng hợp các phiếu đề xuất chi đang chờ duyệt",
                "Báo cáo tổng hợp thu chi và đặt cọc tháng này"
            ];
        }

        // =====================================================================
        // 5. PERSONA: HR / HRM (HÀNH CHÍNH - NHÂN SỰ)
        // =====================================================================
        elseif ($persona === 'hr') {
            $checkedInToday = (int)$safeScalar("
                SELECT COUNT(DISTINCT c.user_id) FROM check_ins c
                JOIN users u ON c.user_id = u.id
                WHERE u.tenant_id = ? AND c.check_in_date = ? AND c.check_in_time IS NOT NULL
            ", [$tid, $todayDate]);

            $pendingLeaves = (int)$safeScalar("
                SELECT COUNT(*) FROM hrm_leave_requests lr
                JOIN users u ON lr.user_id = u.id
                WHERE u.tenant_id = ? AND lr.status = 'pending'
            ", [$tid]);

            $pendingCheckIns = (int)$safeScalar("
                SELECT COUNT(*) FROM check_ins c
                JOIN users u ON c.user_id = u.id
                WHERE u.tenant_id = ? AND c.status = 'pending_approval'
            ", [$tid]);

            $onLeaveToday = (int)$safeScalar("
                SELECT COUNT(DISTINCT lr.user_id) FROM hrm_leave_requests lr
                JOIN users u ON lr.user_id = u.id
                WHERE u.tenant_id = ? AND lr.status = 'approved'
                  AND DATE(lr.start_date) <= ? AND DATE(lr.end_date) >= ?
                  AND lr.leave_type NOT IN ('late_early', 'overtime')
            ", [$tid, $todayDate, $todayDate]);

            if ($slot === 'midday' && $pendingLeaves === 0 && $pendingCheckIns === 0) {
                return null;
            }

            $hasActionableSignal = true;
            $lines[] = ($slot === 'morning'
                ? "Chào buổi sáng **{$fullName}** ({$jobTitleLabel})! 🌸"
                : "Báo cáo nhanh Chấm công & Đơn từ Nhân sự ⚡") . "\n_{$badge}_";
            $lines[] = "📋 **Tình hình Nhân sự & Chấm công hôm nay (" . date('d/m/Y') . "):**";
            $lines[] = "• 🕒 **Quân số đi làm:** Đã có **{$checkedInToday} nhân sự** chấm công vào ca | **{$onLeaveToday} nhân sự** nghỉ phép có đơn.";
            $lines[] = "• 📝 **Đơn từ chờ phê duyệt:** **{$pendingLeaves} đơn** nghỉ phép/tăng ca/về sớm | **{$pendingCheckIns} lượt** chấm công chờ duyệt.";
            if ($myTasksDueToday > 0) {
                $lines[] = "• ⏰ **Công việc đến hạn hôm nay:** **{$myTasksDueToday} đầu việc**.";
            }

            $actions = [
                "Tổng hợp danh sách chấm công và đi trễ hôm nay",
                "Danh sách đơn xin nghỉ phép đang chờ phê duyệt",
                "Thống kê nhân sự nghỉ phép và tăng ca trong tháng này"
            ];
        }

        // =====================================================================
        // 6. PERSONA: MARKETING (MARKETING & TRUYỀN THÔNG)
        // =====================================================================
        elseif ($persona === 'marketing') {
            $leadsToday = (int)$safeScalar("
                SELECT COUNT(*) FROM contacts
                WHERE tenant_id = ? AND deleted_at IS NULL AND created_at >= ?
            ", [$tid, $todayStart]);

            $leadsYesterday = (int)$safeScalar("
                SELECT COUNT(*) FROM contacts
                WHERE tenant_id = ? AND deleted_at IS NULL AND created_at >= ? AND created_at <= ?
            ", [$tid, $yesterdayStart, $yesterdayEnd]);

            $hotMonth = (int)$safeScalar("
                SELECT COUNT(*) FROM contacts
                WHERE tenant_id = ? AND deleted_at IS NULL
                  AND created_at >= ? AND LOWER(COALESCE(temperature, '')) = 'hot'
            ", [$tid, $monthStart]);

            $topSourceRow = $safeRows("
                SELECT COALESCE(NULLIF(TRIM(source), ''), 'Chưa rõ nguồn') AS src, COUNT(*) AS cnt
                FROM contacts
                WHERE tenant_id = ? AND deleted_at IS NULL AND created_at >= ?
                GROUP BY src
                ORDER BY cnt DESC
                LIMIT 1
            ", [$tid, $monthStart]);
            $topSourceText = !empty($topSourceRow) ? "{$topSourceRow[0]['src']} ({$topSourceRow[0]['cnt']} Lead)" : "Chưa có dữ liệu";

            if ($slot === 'midday' && $leadsToday === 0 && $myTasksDueToday === 0) {
                return null;
            }

            $hasActionableSignal = true;
            $lines[] = ($slot === 'morning'
                ? "Chào buổi sáng **{$fullName}** ({$jobTitleLabel})! 🎯"
                : "Cập nhật hiệu suất Phễu Marketing & Lead trong ngày 📊") . "\n_{$badge}_";
            $lines[] = "📣 **Chỉ số Thu hút Lead & Chuyển đổi Đa kênh:**";
            $lines[] = "• **Lead thu về:** Hôm nay **{$leadsToday} Lead** | Hôm qua **{$leadsYesterday} Lead**.";
            $lines[] = "• 🔥 **Lead chất lượng cao (Hot) trong tháng:** **{$hotMonth} Lead** | Nguồn dẫn đầu: **{$topSourceText}**.";
            if ($myTasksDueToday > 0) {
                $lines[] = "• ⏰ **Công việc Marketing đến hạn hôm nay:** **{$myTasksDueToday} đầu việc**.";
            }

            $actions = [
                "Phân tích số lượng và chất lượng Lead theo từng nguồn tháng này",
                "Tỷ lệ chuyển đổi từ Lead sang Đặt cọc của các chiến dịch",
                "So sánh hiệu quả thu hút Lead tuần này với tuần trước"
            ];
        }

        // =====================================================================
        // 7. PERSONA: ACADEMIC / SUPPORT / GENERAL SPECIALIST
        // =====================================================================
        else {
            $openTickets = (int)$safeScalar("
                SELECT COUNT(*) FROM support_tickets
                WHERE tenant_id = ? AND deleted_at IS NULL AND status IN ('open', 'in_progress', 'pending')
            ", [$tid]);

            $newStudentsMonth = (int)$safeScalar("
                SELECT COUNT(*) FROM students
                WHERE deleted_at IS NULL AND created_at >= ?
            ", [$monthStart]);

            if ($slot === 'midday' && $openTickets === 0 && $myTasksDueToday === 0) {
                return null;
            }

            $hasActionableSignal = true;
            $lines[] = ($slot === 'morning'
                ? "Chào buổi sáng **{$fullName}** ({$jobTitleLabel})! 🎓"
                : "Nhắc việc Học vụ & Hỗ trợ Học viên trong ngày ⚡") . "\n_{$badge}_";
            $lines[] = "📚 **Tiêu điểm Công việc & Học vụ hôm nay:**";
            $lines[] = "• 🎫 **Phiếu hỗ trợ học viên (Support Tickets) đang mở:** **{$openTickets} phiếu** cần theo dõi xử lý.";
            $lines[] = "• 👨‍🎓 **Học viên mới nhập học trong tháng:** **{$newStudentsMonth} học viên**.";
            $lines[] = "• ⏰ **Công việc cá nhân đến hạn hôm nay:** **{$myTasksDueToday} đầu việc**.";

            $actions = [
                "Danh sách công việc của tôi cần hoàn thành hôm nay",
                "Kiểm tra các phiếu hỗ trợ học viên đang chờ xử lý",
                "Tra cứu thông tin chương trình MBA & DBA ISTEC Paris"
            ];
        }

        if (!$hasActionableSignal || empty($lines)) {
            return null;
        }

        $lines[] = "\n💡 _Bạn có thể bấm nhanh vào một gợi ý bên dưới hoặc nhắn trực tiếp cho **SI IDEAS** để tôi thực thi ngay nhé!_";
        $content = implode("\n", $lines) . "\n<<<NEXT_BEST_ACTIONS:" . json_encode($actions, JSON_UNESCAPED_UNICODE) . ">>>";

        return [
            'persona' => $persona,
            'level' => $levelLabel,
            'slot' => $slot,
            'content' => $content,
            'actions' => $actions
        ];
    }
}

if (!function_exists('buildSituationalNudgeForUser')) {
    /**
     * Kiểm tra các tình huống phát sinh TỨC THỜI trong ngày hôm nay ("các lúc cần trong ngày")
     * Chỉ trả về tin nhắn khi thực sự có sự kiện nóng vừa chạm ngưỡng cần xử lý ngay.
     */
    function buildSituationalNudgeForUser(PDO $pdo, array $user, string $todayStr): ?array
    {
        $uid = (int)($user['id'] ?? 0);
        $tid = (int)($user['tenant_id'] ?? 1);
        $role = mb_strtolower(trim((string)($user['role'] ?? '')), 'UTF-8');
        $jobTitle = mb_strtolower(trim((string)($user['job_title'] ?? '')), 'UTF-8');
        $fullName = trim((string)($user['full_name'] ?? 'Bạn'));
        $parts = preg_split('/\s+/u', $fullName);
        $shortName = !empty($parts) ? end($parts) : $fullName;
        $todayStart = $todayStr . ' 00:00:00';

        $hasSentToday = function (string $notifyType) use ($pdo, $uid, $todayStr): bool {
            try {
                $st = $pdo->prepare("SELECT id FROM sent_notifications WHERE user_id = ? AND notify_type = ? AND notify_date = ? LIMIT 1");
                $st->execute([$uid, $notifyType, $todayStr]);
                return (bool)$st->fetchColumn();
            } catch (\Throwable $e) {
                return true;
            }
        };

        // 1. Tình huống Sale có Lead mới nhận HÔM NAY đã quá 60 phút chưa liên hệ
        if (in_array($role, ['sale', 'sales', 'consultant', 'manager', 'team_lead', 'sale_leader'], true) || preg_match('/(tư vấn|tuyển sinh|kinh doanh|sale)/u', $jobTitle)) {
            $hourBucket = 'ai_rt_sla60_' . (floor((int)date('G') / 3)); // Tối đa nhắc 1 lần mỗi khung 3 tiếng nếu phát sinh lead mới trễ
            if (!$hasSentToday($hourBucket)) {
                try {
                    $stSla = $pdo->prepare("
                        SELECT c.id, c.full_name, c.phone, c.program, c.source,
                               TIMESTAMPDIFF(MINUTE, c.created_at, NOW()) AS wait_mins
                        FROM contacts c
                        WHERE c.tenant_id = ? AND c.deleted_at IS NULL
                          AND c.owner_id = ?
                          AND c.created_at >= ?
                          AND c.created_at <= DATE_SUB(NOW(), INTERVAL 60 MINUTE)
                          AND COALESCE(c.lead_status, '') NOT IN ('lost', 'junk', 'duplicate', 'converted')
                          AND NOT EXISTS (
                              SELECT 1 FROM activities a
                              WHERE a.contact_id = c.id AND a.deleted_at IS NULL
                          )
                        ORDER BY c.created_at ASC
                        LIMIT 3
                    ");
                    $stSla->execute([$tid, $uid, $todayStart]);
                    $urgentLeads = $stSla->fetchAll(PDO::FETCH_ASSOC) ?: [];
                    if (!empty($urgentLeads)) {
                        $leadBullets = [];
                        foreach ($urgentLeads as $ul) {
                            $prog = !empty($ul['program']) ? " — Quan tâm: **{$ul['program']}**" : "";
                            $leadBullets[] = "• **{$ul['full_name']}** (`{$ul['phone']}`){$prog} — Đã chờ **{$ul['wait_mins']} phút**";
                        }
                        $msg = "⚡ **Nhắc nhanh từ SI IDEAS cho {$shortName}:**\n"
                             . "Bạn có **" . count($urgentLeads) . " khách hàng mới trong hôm nay** đã quá 60 phút chưa ghi nhận cuộc gọi/chăm sóc trên CRM:\n"
                             . implode("\n", $leadBullets) . "\n\n"
                             . "💡 _Liên hệ trong khung giờ vàng giúp tăng gấp đôi tỷ lệ bắt máy và chốt hẹn!_\n"
                             . "<<<NEXT_BEST_ACTIONS:" . json_encode([
                                 "Hiển thị chi tiết các Lead mới hôm nay của tôi chưa liên hệ",
                                 "Gợi ý kịch bản mở lời gọi điện cho khách hàng mới",
                                 "Kiểm tra lịch hẹn chăm sóc khách hàng hôm nay của tôi"
                             ], JSON_UNESCAPED_UNICODE) . ">>>";
                        return [
                            'notify_type' => $hourBucket,
                            'slot' => 'realtime_sla',
                            'persona' => 'sales_consultant',
                            'level' => 'Real-Time SLA Alert',
                            'content' => $msg
                        ];
                    }
                } catch (\Throwable $e) {
                }
            }
        }

        // 2. Tình huống Người duyệt / Kế toán / Quản lý có phiếu mới tạo hôm nay chờ quá 45 phút chưa duyệt
        if (in_array($role, ['director', 'admin', 'super_admin', 'superadmin', 'manager', 'accountant', 'finance', 'hr'], true)) {
            $approvalBucket = 'ai_rt_appr_' . (floor((int)date('G') / 4));
            if (!$hasSentToday($approvalBucket)) {
                try {
                    $pendingItems = [];
                    if (in_array($role, ['accountant', 'finance', 'director', 'admin', 'super_admin', 'superadmin'], true)) {
                        $stDep = $pdo->prepare("
                            SELECT COUNT(*) FROM deposits d
                            LEFT JOIN users u ON d.created_by = u.id
                            WHERE (u.tenant_id = ? OR d.created_by IS NULL)
                              AND d.deleted_at IS NULL AND d.status = 'pending'
                              AND d.created_at >= ? AND d.created_at <= DATE_SUB(NOW(), INTERVAL 45 MINUTE)
                        ");
                        $stDep->execute([$tid, $todayStart]);
                        $depCnt = (int)$stDep->fetchColumn();
                        if ($depCnt > 0) {
                            $pendingItems[] = "**{$depCnt} phiếu Đặt cọc / UNC** mới tạo hôm nay đang chờ xác nhận";
                        }

                        $stExp = $pdo->prepare("
                            SELECT COUNT(*) FROM expenses
                            WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'pending'
                              AND created_at >= ? AND created_at <= DATE_SUB(NOW(), INTERVAL 45 MINUTE)
                        ");
                        $stExp->execute([$tid, $todayStart]);
                        $expCnt = (int)$stExp->fetchColumn();
                        if ($expCnt > 0) {
                            $pendingItems[] = "**{$expCnt} phiếu Đề xuất chi** mới trong ngày đang chờ duyệt";
                        }
                    }

                    $stLv = $pdo->prepare("
                        SELECT COUNT(*) FROM hrm_leave_requests
                        WHERE approver_id = ? AND status = 'pending'
                          AND created_at >= ? AND created_at <= DATE_SUB(NOW(), INTERVAL 45 MINUTE)
                    ");
                    $stLv->execute([$uid, $todayStart]);
                    $lvCnt = (int)$stLv->fetchColumn();
                    if ($lvCnt > 0) {
                        $pendingItems[] = "**{$lvCnt} đơn nghỉ phép/giải trình** chỉ định bạn duyệt";
                    }

                    if (!empty($pendingItems)) {
                        $msg = "🔔 **SI IDEAS nhắc duyệt nhanh cho {$shortName}:**\n"
                             . "Hiện có hồ sơ phát sinh mới trong hôm nay đang chờ xử lý hơn 45 phút:\n• "
                             . implode("\n• ", $pendingItems) . "\n\n"
                             . "💡 _Bạn có thể yêu cầu tôi tóm tắt nhanh nội dung từng phiếu để quyết định ngay!_\n"
                             . "<<<NEXT_BEST_ACTIONS:" . json_encode([
                                 "Liệt kê chi tiết các phiếu đang chờ phê duyệt hôm nay",
                                 "Kiểm tra các phiếu đặt cọc đang chờ đối soát UNC",
                                 "Tổng hợp các đề xuất chi phí mới trong ngày"
                             ], JSON_UNESCAPED_UNICODE) . ">>>";
                        return [
                            'notify_type' => $approvalBucket,
                            'slot' => 'realtime_approval',
                            'persona' => 'approver',
                            'level' => 'Real-Time Approval Nudge',
                            'content' => $msg
                        ];
                    }
                } catch (\Throwable $e) {
                }
            }
        }

        // 3. Tình huống Công việc (Tasks) ưu tiên cao đến hạn hôm nay chưa hoàn thành (nhắc lúc 10:00 - 15:30)
        $nowHM = date('H:i');
        if ($nowHM >= '10:00' && $nowHM <= '15:30' && !$hasSentToday('ai_rt_task_deadline_today')) {
            try {
                $stTask = $pdo->prepare("
                    SELECT id, title, priority, due_date
                    FROM tasks
                    WHERE assigned_to = ?
                      AND status NOT IN ('completed', 'done', 'cancelled')
                      AND due_date IS NOT NULL AND DATE(due_date) = ?
                    ORDER BY FIELD(LOWER(COALESCE(priority, 'medium')), 'urgent', 'high', 'medium', 'low') ASC
                    LIMIT 3
                ");
                $stTask->execute([$uid, $todayStr]);
                $dueTasks = $stTask->fetchAll(PDO::FETCH_ASSOC) ?: [];
                if (!empty($dueTasks)) {
                    $tList = [];
                    foreach ($dueTasks as $dt) {
                        $tList[] = "• **" . ($dt['title'] ?: "Công việc #{$dt['id']}") . "** (Hạn: hôm nay)";
                    }
                    $msg = "⏰ **SI IDEAS nhắc lịch công việc đến hạn hôm nay của {$shortName}:**\n"
                         . implode("\n", $tList) . "\n\n"
                         . "<<<NEXT_BEST_ACTIONS:" . json_encode([
                             "Xem danh sách chi tiết công việc đến hạn hôm nay của tôi",
                             "Hỗ trợ lập kế hoạch xử lý nhanh các công việc tồn đọng"
                         ], JSON_UNESCAPED_UNICODE) . ">>>";
                    return [
                        'notify_type' => 'ai_rt_task_deadline_today',
                        'slot' => 'realtime_task_deadline',
                        'persona' => 'specialist',
                        'level' => 'Real-Time Task Reminder',
                        'content' => $msg
                    ];
                }
            } catch (\Throwable $e) {
            }
        }

        return null;
    }
}

if (!function_exists('runProactiveAiAgentBriefings')) {
    /**
     * Hàm chính thực thi trong cron_sync.php hoặc gọi trực tiếp qua API/CLI
     * @param mysqli|null $conn Kết nối mysqli từ cron_sync.php
     * @param PDO|null $pdo Kết nối PDO (nếu đã khởi tạo)
     * @param array $options ['force' => bool, 'slot' => 'morning'|'midday'|'eod'|'realtime', 'target_user_id' => int]
     */
    function runProactiveAiAgentBriefings($conn = null, ?PDO $pdo = null, array $options = []): array
    {
        $force = !empty($options['force']);
        $targetUserId = isset($options['target_user_id']) ? (int)$options['target_user_id'] : 0;
        $forcedSlot = $options['slot'] ?? null;

        if (!$pdo) {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
            ]);
        }

        $todayStr = date('Y-m-d');
        $nowTime = date('H:i');
        $dayOfWeek = (int)date('N'); // 1 (Mon) -> 7 (Sun)

        // Xác định khung giờ hiện tại nếu không truyền $forcedSlot
        $activeSlot = $forcedSlot;
        if (empty($activeSlot)) {
            if ($nowTime >= '07:45' && $nowTime <= '12:15') {
                $activeSlot = 'morning';
            } elseif ($nowTime >= '12:16' && $nowTime <= '16:30') {
                $activeSlot = 'midday';
            } elseif ($nowTime >= '16:31' && $nowTime <= '21:30') {
                $activeSlot = 'eod';
            } else {
                return ['status' => 'skipped_outside_window', 'time' => $nowTime, 'sent_count' => 0];
            }
        }

        // Kiểm tra cài đặt hệ thống (cho phép bật/tắt nếu cần)
        try {
            $stSet = $pdo->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('ai_proactive_agent_enabled', 'global_work_schedule', 'holiday_schedules')");
            $sysSettings = [];
            if ($stSet) {
                while ($r = $stSet->fetch(PDO::FETCH_ASSOC)) {
                    $sysSettings[$r['setting_key']] = $r['setting_value'];
                }
            }
            if (!$force && isset($sysSettings['ai_proactive_agent_enabled']) && (string)$sysSettings['ai_proactive_agent_enabled'] === '0') {
                return ['status' => 'disabled_by_setting', 'sent_count' => 0];
            }
        } catch (\Throwable $e) {
            $sysSettings = [];
        }

        $holidaysJson = $sysSettings['holiday_schedules'] ?? '[]';
        $globalSchedule = $sysSettings['global_work_schedule'] ?? 'monday_to_friday';

        if (!$force && $dayOfWeek === 7 && $globalSchedule !== 'all_week') {
            return ['status' => 'skipped_sunday', 'sent_count' => 0];
        }

        // Lấy map các Team mà từng user làm Leader
        $ledTeamsByUser = [];
        try {
            $stTeams = $pdo->query("SELECT id, leader_id FROM teams WHERE leader_id IS NOT NULL AND leader_id > 0");
            if ($stTeams) {
                while ($tr = $stTeams->fetch(PDO::FETCH_ASSOC)) {
                    $lid = (int)$tr['leader_id'];
                    $ledTeamsByUser[$lid][] = (int)$tr['id'];
                }
            }
        } catch (\Throwable $e) {
        }

        // Truy vấn danh sách nhân sự đang hoạt động
        $userWhere = "u.status = 'active' AND COALESCE(u.is_active, 1) = 1 AND u.id != 9000001 AND LOWER(COALESCE(u.role, '')) != 'bot'";
        $userParams = [];
        if ($targetUserId > 0) {
            $userWhere .= " AND u.id = ?";
            $userParams[] = $targetUserId;
        }

        $stUsers = $pdo->prepare("
            SELECT u.id, COALESCE(u.tenant_id, 1) AS tenant_id, u.full_name, u.email, u.role,
                   u.job_title, u.department, u.team_id,
                   u.use_custom_work_hours, u.work_start_time, u.work_end_time, u.work_schedule,
                   u.vacation_mode, u.leave_start, u.leave_end
            FROM users u
            WHERE {$userWhere}
            ORDER BY u.id ASC
        ");
        $stUsers->execute($userParams);
        $users = $stUsers->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $sentCount = 0;
        $sentDetails = [];

        $stmtCheckSent = $pdo->prepare("
            SELECT id FROM sent_notifications
            WHERE user_id = ? AND notify_type = ? AND notify_date = ?
            LIMIT 1
        ");
        $stmtMarkSent = $pdo->prepare("
            INSERT IGNORE INTO sent_notifications (user_id, notify_type, notify_date)
            VALUES (?, ?, ?)
        ");
        $stmtCheckLeave = $pdo->prepare("
            SELECT id FROM hrm_leave_requests
            WHERE user_id = ? AND status = 'approved'
              AND DATE(start_date) <= ? AND DATE(end_date) >= ?
              AND leave_type NOT IN ('late_early', 'overtime')
            LIMIT 1
        ");
        $stmtInsertMsg = $pdo->prepare("
            INSERT INTO chat_messages (tenant_id, conversation_id, sender_id, message_type, content, metadata, created_at)
            VALUES (?, ?, 9000001, 'text', ?, ?, NOW())
        ");
        $stmtUpdateConv = $pdo->prepare("
            UPDATE chat_conversations
            SET last_message_id = ?, last_message_at = NOW(), updated_at = NOW()
            WHERE id = ?
        ");

        foreach ($users as $u) {
            $uid = (int)$u['id'];
            $tid = (int)($u['tenant_id'] ?? 1);

            if (!$force) {
                // Bỏ qua nếu nhân sự đang bật chế độ nghỉ phép (vacation_mode)
                if (!empty($u['vacation_mode']) && (int)$u['vacation_mode'] === 1) {
                    continue;
                }
                if (!empty($u['leave_start']) && !empty($u['leave_end']) && $todayStr >= $u['leave_start'] && $todayStr <= $u['leave_end']) {
                    continue;
                }

                // Bỏ qua nếu có đơn nghỉ phép cả ngày hôm nay đã được duyệt
                try {
                    $stmtCheckLeave->execute([$uid, $todayStr, $todayStr]);
                    if ($stmtCheckLeave->fetchColumn()) {
                        continue;
                    }
                } catch (\Throwable $eLeave) {
                }

                // Kiểm tra ngày làm việc theo lịch của nhân sự
                if (function_exists('isUserWorkingDayForReminders')) {
                    $uSched = (!empty($u['use_custom_work_hours']) && !empty($u['work_schedule'])) ? $u['work_schedule'] : $globalSchedule;
                    if (!isUserWorkingDayForReminders($uSched, $holidaysJson)) {
                        continue;
                    }
                }
            }

            // Xác định slot cho nhân sự này: nếu đang ở buổi chiều/tối mà hôm nay chưa từng nhận bản tin 'morning',
            // ưu tiên gửi bản tin tổng quan đầu ngày trước để không ai bị bỏ lỡ trong ngày hôm nay!
            $userSlot = $activeSlot;
            $notifyTypeKey = 'ai_agent_' . $userSlot;

            if (!$force) {
                $stmtCheckSent->execute([$uid, $notifyTypeKey, $todayStr]);
                $alreadySentSlot = (bool)$stmtCheckSent->fetchColumn();

                if ($alreadySentSlot) {
                    // Nếu đã nhận bản tin định kỳ của khung giờ này rồi -> Kiểm tra các tình huống phát sinh tức thời ("các lúc cần trong ngày")
                    $situational = buildSituationalNudgeForUser($pdo, $u, $todayStr);
                    if (!$situational || empty($situational['content'])) {
                        continue;
                    }
                    $briefing = $situational;
                    $notifyTypeKey = $situational['notify_type'];
                } else {
                    // Nếu chưa nhận bản tin 'morning' trong hôm nay và hiện tại là buổi trưa, tự động gửi bản tin tổng quan 'morning'
                    if ($userSlot === 'midday') {
                        $stmtCheckSent->execute([$uid, 'ai_agent_morning', $todayStr]);
                        if (!$stmtCheckSent->fetchColumn()) {
                            $userSlot = 'morning';
                            $notifyTypeKey = 'ai_agent_morning';
                        }
                    }
                    $ledTeams = $ledTeamsByUser[$uid] ?? [];
                    $briefing = buildProactiveAiBriefingForUser($pdo, $u, $userSlot, $ledTeams);
                    if (!$briefing || empty($briefing['content'])) {
                        // Fallback kiểm tra tình huống tức thời nếu bản tin định kỳ rỗng
                        $situational = buildSituationalNudgeForUser($pdo, $u, $todayStr);
                        if (!$situational || empty($situational['content'])) {
                            continue;
                        }
                        $briefing = $situational;
                        $notifyTypeKey = $situational['notify_type'];
                    }
                }
            } else {
                $ledTeams = $ledTeamsByUser[$uid] ?? [];
                $briefing = buildProactiveAiBriefingForUser($pdo, $u, $userSlot, $ledTeams);
                if (!$briefing || empty($briefing['content'])) {
                    continue;
                }
            }

            $convId = ensureIdeasAiConversationForCron($pdo, $uid, $tid);
            if ($convId <= 0) {
                continue;
            }

            $metaJson = json_encode([
                'proactive_ai_briefing' => true,
                'slot' => $briefing['slot'] ?? $userSlot,
                'persona' => $briefing['persona'],
                'level' => $briefing['level'],
                'auto_open_chat' => true,
                'generated_at' => date('c')
            ], JSON_UNESCAPED_UNICODE);

            try {
                $stmtInsertMsg->execute([$tid, $convId, $briefing['content'], $metaJson]);
                $msgId = (int)$pdo->lastInsertId();
                if ($msgId > 0) {
                    $stmtUpdateConv->execute([$msgId, $convId]);
                    $stmtMarkSent->execute([$uid, $notifyTypeKey, $todayStr]);
                    $sentCount++;
                    $sentDetails[] = [
                        'user_id' => $uid,
                        'full_name' => $u['full_name'],
                        'role' => $u['role'],
                        'persona' => $briefing['persona'],
                        'slot' => $briefing['slot'] ?? $userSlot,
                        'conversation_id' => $convId,
                        'message_id' => $msgId
                    ];
                }
            } catch (\Throwable $eSend) {
                error_log("Proactive AI message insert error for user {$uid}: " . $eSend->getMessage());
            }
        }

        if ($sentCount > 0 && function_exists('logSync')) {
            logSync("Proactive AI Agent ({$activeSlot}) sent {$sentCount} personalized role-based briefings/nudges into SI IDEAS chat.");
        }

        return [
            'status' => 'completed',
            'slot' => $activeSlot,
            'sent_count' => $sentCount,
            'details' => $sentDetails
        ];
    }
}

// Hỗ trợ chạy độc lập qua CLI: php backend/cron_ai_proactive_agent.php [morning|midday|eod] [--force] [--user=ID]
if (php_sapi_name() === 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    $slotArg = null;
    $forceArg = false;
    $userArg = 0;
    foreach (array_slice($argv ?? [], 1) as $arg) {
        if (in_array($arg, ['morning', 'midday', 'eod'], true)) {
            $slotArg = $arg;
        } elseif ($arg === '--force' || $arg === '-f') {
            $forceArg = true;
        } elseif (strpos($arg, '--user=') === 0) {
            $userArg = (int)substr($arg, 7);
        }
    }
    $result = runProactiveAiAgentBriefings(null, null, [
        'force' => $forceArg,
        'slot' => $slotArg ?: 'morning',
        'target_user_id' => $userArg
    ]);
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;
}

