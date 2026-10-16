<?php
/**
 * AgentTaskProjectTools.php - Pillar 1: Task, Subtask, Task Group, Approval, Dependency, Focus & Project 100% Schema AI Engine
 * Provides comprehensive Gemini Function Declarations, Multi-Tier Filters, 360° Enrichment, and Zero-Trust Executors
 * for `activities`, `activity_comments`, `activity_dependencies`, `task_focus_logs`, `task_groups`, `task_whiteboards`,
 * `task_hidden_users`, `task_muted_notifications`, `projects`, `project_roster`, and `project_documents`.
 */

class AgentTaskProjectTools {

    /**
     * All 29 production columns of `activities` whitelisted for custom_rules & schema validation
     */
    public const ACTIVITIES_COLUMNS = [
        'id', 'tenant_id', 'user_id', 'task_group_id', 'created_by', 'type', 'subject', 'body',
        'status', 'priority', 'start_date', 'due_date', 'done_at', 'related_type', 'related_id',
        'contact_id', 'tags', 'participant_ids', 'progress', 'require_approval', 'approver_id',
        'approval_status', 'link', 'created_at', 'updated_at', 'deleted_at', 'edit_history',
        'conversation_id', 'chat_message_id'
    ];

    /**
     * All 23 production columns of `projects` (NOTE: `projects` has NO `deleted_at` column)
     */
    public const PROJECTS_COLUMNS = [
        'id', 'tenant_id', 'name', 'code', 'description', 'status', 'location', 'developer',
        'document_ids', 'campaign_ids', 'progress_percent', 'construction_status', 'legal_status',
        'scale_block_count', 'scale_unit_count', 'handover_year', 'manager_ids', 'folder_path',
        'reference_url', 'created_by', 'created_at', 'updated_at', 'campaign_sharing_mode'
    ];

    /**
     * 1. Return Gemini Function Declarations for Task/Subtask Management and Project Query/Management
     */
    public static function getToolDeclarations(): array {
        return [
            [
                'name' => 'smart_manage_tasks_and_subtasks',
                'description' => 'Công cụ thông minh toàn diện để tạo mới, giao việc, sửa đổi, cập nhật tiến độ, gia hạn deadline, chuyển người phụ trách/phối hợp, phê duyệt/từ chối công việc, quản lý subtask (checklist), bình luận, thiết lập phụ thuộc (dependencies), ghi nhận thời gian tập trung (Pomodoro focus) và quản lý nhóm công việc (task_groups) trên 100% trường dữ liệu của bảng activities. Tự động kiểm tra phân quyền RBAC.',
                'parameters' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'action' => [
                            'type' => 'STRING',
                            'enum' => [
                                'create_or_delegate',
                                'update_task',
                                'batch_update',
                                'approve_task',
                                'reject_task',
                                'request_approval',
                                'add_subtasks',
                                'update_subtask',
                                'toggle_subtask',
                                'delete_subtask',
                                'add_comment',
                                'manage_dependencies',
                                'log_focus',
                                'manage_task_groups',
                                'delete_task'
                            ],
                            'description' => 'Hành động cần thực hiện trên công việc, subtask, phụ thuộc, tập trung hoặc nhóm việc.'
                        ],
                        'task_id' => [
                            'type' => 'INTEGER',
                            'description' => 'Mã ID công việc (activities.id).'
                        ],
                        'task_ids' => [
                            'type' => 'ARRAY',
                            'items' => ['type' => 'INTEGER'],
                            'description' => 'Danh sách các mã ID công việc dùng cho batch_update.'
                        ],
                        'task_title' => [
                            'type' => 'STRING',
                            'description' => 'Tiêu đề công việc để tìm kiếm mờ (fuzzy lookup) nếu không có task_id.'
                        ],
                        'subject' => [
                            'type' => 'STRING',
                            'description' => 'Tiêu đề công việc khi tạo mới hoặc đổi tên công việc.'
                        ],
                        'description' => [
                            'type' => 'STRING',
                            'description' => 'Mô tả chi tiết nội dung công việc (lưu trong body.erp_task.description).'
                        ],
                        'type' => [
                            'type' => 'STRING',
                            'enum' => ['task', 'meeting', 'call', 'note', 'email'],
                            'description' => 'Loại hoạt động (mặc định: task).'
                        ],
                        'priority' => [
                            'type' => 'STRING',
                            'enum' => ['low', 'medium', 'high', 'urgent'],
                            'description' => 'Mức độ ưu tiên của công việc.'
                        ],
                        'status' => [
                            'type' => 'STRING',
                            'enum' => ['planned', 'in_progress', 'done', 'cancelled'],
                            'description' => 'Trạng thái công việc.'
                        ],
                        'progress' => [
                            'type' => 'INTEGER',
                            'description' => 'Phần trăm tiến độ hoàn thành (0..100).'
                        ],
                        'start_date' => [
                            'type' => 'STRING',
                            'description' => 'Thời gian bắt đầu (YYYY-MM-DD hoặc YYYY-MM-DD HH:MM:SS).'
                        ],
                        'due_date' => [
                            'type' => 'STRING',
                            'description' => 'Hạn chót hoàn thành (YYYY-MM-DD hoặc YYYY-MM-DD HH:MM:SS).'
                        ],
                        'assignee_name' => [
                            'type' => 'STRING',
                            'description' => 'Tên người thực hiện chính (user_id) để tự động tra cứu.'
                        ],
                        'user_id' => [
                            'type' => 'INTEGER',
                            'description' => 'Mã ID người thực hiện chính (activities.user_id).'
                        ],
                        'collaborator_names' => [
                            'type' => 'STRING',
                            'description' => 'Danh sách tên người phối hợp (ngăn cách bởi dấu phẩy).'
                        ],
                        'participant_ids' => [
                            'type' => 'STRING',
                            'description' => 'Danh sách ID người phối hợp ngăn cách bởi dấu phẩy (VD: "5,12,18").'
                        ],
                        'require_approval' => [
                            'type' => 'BOOLEAN',
                            'description' => 'Công việc có yêu cầu phê duyệt khi hoàn thành 100% hay không.'
                        ],
                        'approver_name' => [
                            'type' => 'STRING',
                            'description' => 'Tên người phê duyệt công việc.'
                        ],
                        'approver_id' => [
                            'type' => 'INTEGER',
                            'description' => 'Mã ID người phê duyệt (activities.approver_id).'
                        ],
                        'approval_status' => [
                            'type' => 'STRING',
                            'enum' => ['pending', 'approved', 'rejected'],
                            'description' => 'Trạng thái phê duyệt công việc.'
                        ],
                        'feedback_note' => [
                            'type' => 'STRING',
                            'description' => 'Ghi chú nhận xét khi phê duyệt, từ chối hoặc yêu cầu duyệt.'
                        ],
                        'task_group_id' => [
                            'type' => 'INTEGER',
                            'description' => 'Mã ID nhóm công việc (task_groups.id).'
                        ],
                        'task_group_name' => [
                            'type' => 'STRING',
                            'description' => 'Tên nhóm công việc (dùng để gán nhóm hoặc tạo/sửa nhóm trong manage_task_groups).'
                        ],
                        'group_color' => [
                            'type' => 'STRING',
                            'description' => 'Mã màu nhóm công việc (VD: #BD1D2D, #3B82F6).'
                        ],
                        'group_icon' => [
                            'type' => 'STRING',
                            'description' => 'Icon của nhóm công việc (VD: Folder, Star, Briefcase).'
                        ],
                        'is_shared' => [
                            'type' => 'BOOLEAN',
                            'description' => 'Nhóm công việc có chia sẻ chung hay không.'
                        ],
                        'is_pinned' => [
                            'type' => 'BOOLEAN',
                            'description' => 'Ghim nhóm công việc lên đầu danh sách.'
                        ],
                        'related_type' => [
                            'type' => 'STRING',
                            'enum' => ['contact', 'lead', 'project', 'deal', 'company', 'team', 'personal'],
                            'description' => 'Loại thực thể liên kết với công việc (nếu là personal sẽ tự gắn tag personal_task).'
                        ],
                        'related_id' => [
                            'type' => 'INTEGER',
                            'description' => 'Mã ID thực thể liên kết (activities.related_id).'
                        ],
                        'related_name' => [
                            'type' => 'STRING',
                            'description' => 'Tên thực thể liên kết (khách hàng, dự án, cơ hội, công ty, đội nhóm) để tự động phân giải ID.'
                        ],
                        'contact_id' => [
                            'type' => 'INTEGER',
                            'description' => 'Mã ID khách hàng/học viên liên kết trực tiếp (activities.contact_id).'
                        ],
                        'tags' => [
                            'type' => 'STRING',
                            'description' => 'Các nhãn phân loại công việc ngăn cách bởi dấu phẩy.'
                        ],
                        'link' => [
                            'type' => 'STRING',
                            'description' => 'Đường dẫn tài liệu hoặc liên kết ngoài đính kèm vào công việc.'
                        ],
                        'subtasks' => [
                            'type' => 'ARRAY',
                            'description' => 'Danh sách các mục công việc con (checklist items) cần thêm hoặc cập nhật.',
                            'items' => [
                                'type' => 'OBJECT',
                                'properties' => [
                                    'subtask_id' => ['type' => 'STRING', 'description' => 'ID của subtask (VD: chk_1...)'],
                                    'title' => ['type' => 'STRING', 'description' => 'Tiêu đề nội dung subtask'],
                                    'assignee_name' => ['type' => 'STRING', 'description' => 'Tên người phụ trách subtask'],
                                    'due_date' => ['type' => 'STRING', 'description' => 'Hạn hoàn thành subtask (YYYY-MM-DD)'],
                                    'done' => ['type' => 'BOOLEAN', 'description' => 'Trạng thái hoàn thành của subtask']
                                ]
                            ]
                        ],
                        'subtask_keyword' => [
                            'type' => 'STRING',
                            'description' => 'Từ khóa hoặc số thứ tự của subtask cần toggle/cập nhật/xóa.'
                        ],
                        'complete_all' => [
                            'type' => 'BOOLEAN',
                            'description' => 'Đánh dấu hoàn thành tất cả các subtask trong công việc.'
                        ],
                        'comment_content' => [
                            'type' => 'STRING',
                            'description' => 'Nội dung bình luận thêm vào công việc hoặc subtask.'
                        ],
                        'subtask_id' => [
                            'type' => 'STRING',
                            'description' => 'Mã ID của subtask (VD: chk_...) khi bình luận vào subtask hoặc cập nhật subtask cụ thể.'
                        ],
                        'parent_comment_id' => [
                            'type' => 'INTEGER',
                            'description' => 'Mã ID bình luận cha nếu trả lời (reply) bình luận.'
                        ],
                        'predecessor_task_id' => [
                            'type' => 'INTEGER',
                            'description' => 'Mã ID công việc tiền nhiệm (predecessor) trong thiết lập phụ thuộc.'
                        ],
                        'dependency_type' => [
                            'type' => 'STRING',
                            'enum' => ['FS', 'SS', 'FF', 'SF'],
                            'description' => 'Loại quan hệ phụ thuộc (FS: Finish-to-Start, SS: Start-to-Start, FF: Finish-to-Finish, SF: Start-to-Finish).'
                        ],
                        'lag_days' => [
                            'type' => 'INTEGER',
                            'description' => 'Số ngày trễ/đệm (lag days) giữa công việc tiền nhiệm và công việc hiện tại.'
                        ],
                        'cascade_reschedule' => [
                            'type' => 'BOOLEAN',
                            'description' => 'Tự động dời lịch dây chuyền các công việc phụ thuộc phía sau khi đổi hạn chót.'
                        ],
                        'focus_duration_minutes' => [
                            'type' => 'INTEGER',
                            'description' => 'Số phút tập trung Pomodoro cần ghi nhận vào task_focus_logs (mặc định 25 phút).'
                        ]
                    ],
                    'required' => ['action']
                ]
            ],
            [
                'name' => 'query_and_manage_projects',
                'description' => 'Tra cứu 100% trường dữ liệu dự án/chương trình đào tạo (projects), thành viên dự án (project_roster), tài liệu (project_documents), thống kê khách hàng/doanh thu/công việc theo dự án, và cập nhật thông tin dự án hoặc thành viên.',
                'parameters' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'action' => [
                            'type' => 'STRING',
                            'enum' => ['list', 'detail', 'stats', 'update_project', 'manage_roster', 'add_comment'],
                            'description' => 'Hành động cần thực hiện với dự án/chương trình đào tạo (mặc định: list).'
                        ],
                        'project_id' => [
                            'type' => 'INTEGER',
                            'description' => 'Mã ID dự án (projects.id).'
                        ],
                        'project_name_or_code' => [
                            'type' => 'STRING',
                            'description' => 'Tên hoặc mã dự án/chương trình đào tạo (VD: MBA, DBA, EMBA, Swiss UMEF...).'
                        ],
                        'status' => [
                            'type' => 'STRING',
                            'enum' => ['active', 'completed', 'draft', 'all'],
                            'description' => 'Trạng thái dự án cần lọc hoặc cập nhật.'
                        ],
                        'progress_percent' => [
                            'type' => 'INTEGER',
                            'description' => 'Tiến độ hoàn thành dự án (0..100).'
                        ],
                        'construction_status' => [
                            'type' => 'STRING',
                            'description' => 'Tình trạng triển khai / xây dựng chương trình của dự án.'
                        ],
                        'legal_status' => [
                            'type' => 'STRING',
                            'description' => 'Tình trạng pháp lý / kiểm định của dự án.'
                        ],
                        'description' => [
                            'type' => 'STRING',
                            'description' => 'Mô tả chi tiết dự án.'
                        ],
                        'location' => [
                            'type' => 'STRING',
                            'description' => 'Địa điểm / cơ sở đào tạo của dự án.'
                        ],
                        'developer' => [
                            'type' => 'STRING',
                            'description' => 'Đơn vị phát triển / đối tác trường đại học quốc tế.'
                        ],
                        'member_names_to_add' => [
                            'type' => 'STRING',
                            'description' => 'Danh sách tên nhân sự cần thêm vào project_roster (ngăn cách bởi dấu phẩy).'
                        ],
                        'member_names_to_remove' => [
                            'type' => 'STRING',
                            'description' => 'Danh sách tên nhân sự cần gỡ khỏi project_roster (ngăn cách bởi dấu phẩy).'
                        ],
                        'comment_body' => [
                            'type' => 'STRING',
                            'description' => 'Nội dung thảo luận/bình luận cần thêm vào dự án.'
                        ]
                    ]
                ]
            ]
        ];
    }

    /**
     * 2. Apply extended multi-tier filters for `activities` queries (100% schema coverage & Zero-Trust isolation)
     */
    public static function applyExtendedTaskMultiTierFilters(
        PDO $db,
        string $alias,
        array $args,
        array &$where,
        array &$params,
        int $tid,
        int $uid,
        bool $isAdminOrMgr
    ): void {
        $a = $alias !== '' ? (str_ends_with($alias, '.') ? $alias : $alias . '.') : '';

        // 1. Always exclude tasks hidden by the current user on Workspace
        $where[] = "NOT EXISTS (SELECT 1 FROM task_hidden_users thu WHERE thu.task_id = {$a}id AND thu.user_id = ?)";
        $params[] = $uid;

        // 2. Always exclude other users' personal tasks (even for Admin/Manager)
        $where[] = "(NOT (IFNULL({$a}tags, '') LIKE '%personal_task%' OR IFNULL({$a}tags, '') LIKE '%ca_nhan%') OR {$a}user_id = ? OR {$a}created_by = ?)";
        $params[] = $uid;
        $params[] = $uid;

        // 3. department_or_team filter
        $deptOrTeam = trim((string)($args['department_or_team'] ?? ''));
        if ($deptOrTeam !== '' && strtolower($deptOrTeam) !== 'all') {
            $dtTokens = array_filter(array_map('trim', explode(',', $deptOrTeam)));
            if (!empty($dtTokens)) {
                $dtOrs = [];
                foreach ($dtTokens as $dt) {
                    if (is_numeric($dt)) {
                        $dtOrs[] = "EXISTS (SELECT 1 FROM users u_dt WHERE u_dt.id = {$a}user_id AND u_dt.team_id = ?)";
                        $params[] = (int)$dt;
                    } else {
                        $likeDt = '%' . $dt . '%';
                        $dtOrs[] = "EXISTS (
                            SELECT 1 FROM users u_dt
                            LEFT JOIN teams tm_dt ON u_dt.team_id = tm_dt.id
                            WHERE u_dt.id = {$a}user_id
                              AND (u_dt.department LIKE ? OR tm_dt.name LIKE ? OR tm_dt.branch LIKE ?)
                        )";
                        array_push($params, $likeDt, $likeDt, $likeDt);
                    }
                }
                if (!empty($dtOrs)) {
                    $where[] = '(' . implode(' OR ', $dtOrs) . ')';
                }
            }
        }

        // 4. participation_role filter
        $partRole = strtolower(trim((string)($args['participation_role'] ?? '')));
        if ($partRole !== '' && $partRole !== 'all') {
            if ($partRole === 'primary_only') {
                $where[] = "{$a}user_id = ?";
                $params[] = $uid;
            } elseif ($partRole === 'collaborator_only') {
                $where[] = "FIND_IN_SET(?, REPLACE(COALESCE({$a}participant_ids, ''), ' ', '')) > 0";
                $params[] = (string)$uid;
            } elseif ($partRole === 'created_by_me') {
                $where[] = "{$a}created_by = ?";
                $params[] = $uid;
            } elseif ($partRole === 'my_approvals') {
                $where[] = "{$a}require_approval = 1 AND {$a}approver_id = ? AND COALESCE({$a}approval_status, 'pending') = 'pending'";
                $params[] = $uid;
            }
        }

        // 5. approval_filter
        $approvalFilter = strtolower(trim((string)($args['approval_filter'] ?? '')));
        if ($approvalFilter !== '' && $approvalFilter !== 'all') {
            if ($approvalFilter === 'require_approval') {
                $where[] = "{$a}require_approval = 1";
            } elseif ($approvalFilter === 'pending_approval') {
                $where[] = "{$a}require_approval = 1 AND COALESCE({$a}approval_status, 'pending') = 'pending'";
            } elseif ($approvalFilter === 'approved') {
                $where[] = "{$a}approval_status = 'approved'";
            } elseif ($approvalFilter === 'rejected') {
                $where[] = "{$a}approval_status = 'rejected'";
            } elseif ($approvalFilter === 'my_approvals') {
                $where[] = "{$a}require_approval = 1 AND {$a}approver_id = ? AND COALESCE({$a}approval_status, 'pending') = 'pending'";
                $params[] = $uid;
            }
        }

        // 6. approver_name filter
        $approverName = trim((string)($args['approver_name'] ?? ''));
        if ($approverName !== '' && strtolower($approverName) !== 'all') {
            $matchedApproverIds = self::findUserIdsByFuzzyName($db, $tid, $approverName);
            if (!empty($matchedApproverIds)) {
                $ph = implode(',', array_fill(0, count($matchedApproverIds), '?'));
                $where[] = "{$a}approver_id IN ({$ph})";
                foreach ($matchedApproverIds as $aid) {
                    $params[] = $aid;
                }
            } else {
                $where[] = "1 = 0";
            }
        }

        // 7. collaborator_name filter
        $collabName = trim((string)($args['collaborator_name'] ?? ''));
        if ($collabName !== '' && strtolower($collabName) !== 'all') {
            $matchedCollabIds = self::findUserIdsByFuzzyName($db, $tid, $collabName);
            if (!empty($matchedCollabIds)) {
                $cOrs = [];
                foreach ($matchedCollabIds as $cid) {
                    $cOrs[] = "FIND_IN_SET(?, REPLACE(COALESCE({$a}participant_ids, ''), ' ', '')) > 0";
                    $params[] = (string)$cid;
                }
                $where[] = '(' . implode(' OR ', $cOrs) . ')';
            } else {
                $where[] = "1 = 0";
            }
        }

        // 8. tags filter (comma-separated)
        $tagsArg = trim((string)($args['tags'] ?? $args['tag'] ?? ''));
        if ($tagsArg !== '' && strtolower($tagsArg) !== 'all') {
            $tagList = array_filter(array_map('trim', explode(',', $tagsArg)));
            if (!empty($tagList)) {
                $tagOrs = [];
                foreach ($tagList as $tg) {
                    $tagOrs[] = "{$a}tags LIKE ?";
                    $params[] = '%' . $tg . '%';
                }
                $where[] = '(' . implode(' OR ', $tagOrs) . ')';
            }
        }

        // 9. subtask_filter
        $subtaskFilter = strtolower(trim((string)($args['subtask_filter'] ?? '')));
        if ($subtaskFilter !== '' && $subtaskFilter !== 'all') {
            if ($subtaskFilter === 'has_subtasks') {
                $where[] = "{$a}body LIKE '%\"checklist\":[{%'";
            } elseif ($subtaskFilter === 'no_subtasks') {
                $where[] = "({$a}body IS NULL OR {$a}body NOT LIKE '%\"checklist\":[{%')";
            } elseif ($subtaskFilter === 'incomplete_subtasks') {
                $where[] = "{$a}body LIKE '%\"done\":false%'";
            } elseif ($subtaskFilter === 'all_subtasks_done') {
                $where[] = "({$a}body LIKE '%\"checklist\":[{%' AND {$a}body NOT LIKE '%\"done\":false%')";
            }
        }

        // 10. dependency_filter
        $depFilter = strtolower(trim((string)($args['dependency_filter'] ?? '')));
        if ($depFilter !== '' && $depFilter !== 'all') {
            if ($depFilter === 'blocked') {
                $where[] = "EXISTS (
                    SELECT 1 FROM activity_dependencies ad
                    JOIN activities pred ON ad.predecessor_id = pred.id
                    WHERE ad.activity_id = {$a}id
                      AND pred.deleted_at IS NULL
                      AND (pred.status IS NULL OR pred.status NOT IN ('done', 'completed', 'cancelled'))
                      AND COALESCE(pred.progress, 0) < 100
                )";
            } elseif ($depFilter === 'blocking') {
                $where[] = "EXISTS (
                    SELECT 1 FROM activity_dependencies ad
                    JOIN activities succ ON ad.activity_id = succ.id
                    WHERE ad.predecessor_id = {$a}id
                      AND succ.deleted_at IS NULL
                )";
            } elseif ($depFilter === 'has_dependencies') {
                $where[] = "EXISTS (
                    SELECT 1 FROM activity_dependencies ad
                    WHERE ad.activity_id = {$a}id OR ad.predecessor_id = {$a}id
                )";
            }
        }

        // 11. has_whiteboard filter
        if (isset($args['has_whiteboard']) && $args['has_whiteboard'] !== '' && $args['has_whiteboard'] !== null) {
            $wantWb = filter_var($args['has_whiteboard'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($wantWb === true || $args['has_whiteboard'] === 1 || $args['has_whiteboard'] === '1') {
                $where[] = "EXISTS (SELECT 1 FROM task_whiteboards twb WHERE twb.task_id = {$a}id AND twb.tenant_id = {$a}tenant_id)";
            } elseif ($wantWb === false || $args['has_whiteboard'] === 0 || $args['has_whiteboard'] === '0') {
                $where[] = "NOT EXISTS (SELECT 1 FROM task_whiteboards twb WHERE twb.task_id = {$a}id AND twb.tenant_id = {$a}tenant_id)";
            }
        }

        // 12. min_focus_minutes filter
        if (isset($args['min_focus_minutes']) && is_numeric($args['min_focus_minutes']) && (int)$args['min_focus_minutes'] > 0) {
            $where[] = "(SELECT COALESCE(SUM(tfl.duration_minutes), 0) FROM task_focus_logs tfl WHERE tfl.task_id = {$a}id) >= ?";
            $params[] = (int)$args['min_focus_minutes'];
        }

        // 13. min_progress & max_progress filters
        if (isset($args['min_progress']) && is_numeric($args['min_progress'])) {
            $where[] = "COALESCE({$a}progress, 0) >= ?";
            $params[] = max(0, min(100, (int)$args['min_progress']));
        }
        if (isset($args['max_progress']) && is_numeric($args['max_progress'])) {
            $where[] = "COALESCE({$a}progress, 0) <= ?";
            $params[] = max(0, min(100, (int)$args['max_progress']));
        }

        // 14. stale_days filter
        if (isset($args['stale_days']) && is_numeric($args['stale_days']) && (int)$args['stale_days'] > 0) {
            $staleDays = (int)$args['stale_days'];
            $where[] = "({$a}status IS NULL OR {$a}status NOT IN ('done', 'completed', 'cancelled')) AND {$a}updated_at < DATE_SUB(NOW(), INTERVAL ? DAY)";
            $params[] = $staleDays;
        }

        // 15. related_entity_name filter
        $relEntityName = trim((string)($args['related_entity_name'] ?? ''));
        if ($relEntityName !== '') {
            $likeRel = '%' . $relEntityName . '%';
            $where[] = "(
                EXISTS (SELECT 1 FROM contacts c_rel WHERE (c_rel.id = {$a}contact_id OR ({$a}related_type IN ('contact', 'lead') AND c_rel.id = {$a}related_id)) AND c_rel.deleted_at IS NULL AND c_rel.full_name LIKE ?)
                OR EXISTS (SELECT 1 FROM projects p_rel WHERE {$a}related_type = 'project' AND p_rel.id = {$a}related_id AND (p_rel.name LIKE ? OR p_rel.code LIKE ?))
                OR EXISTS (SELECT 1 FROM deals d_rel WHERE {$a}related_type = 'deal' AND d_rel.id = {$a}related_id AND d_rel.deleted_at IS NULL AND d_rel.title LIKE ?)
                OR EXISTS (SELECT 1 FROM companies comp_rel WHERE {$a}related_type = 'company' AND comp_rel.id = {$a}related_id AND comp_rel.deleted_at IS NULL AND comp_rel.name LIKE ?)
                OR EXISTS (SELECT 1 FROM teams tm_rel WHERE {$a}related_type = 'team' AND tm_rel.id = {$a}related_id AND tm_rel.name LIKE ?)
            )";
            array_push($params, $likeRel, $likeRel, $likeRel, $likeRel, $likeRel, $likeRel);
        }

        // 16. custom_rules filter (whitelisted against all 29 columns of `activities`)
        if (!empty($args['custom_rules'])) {
            $rules = is_string($args['custom_rules'])
                ? (json_decode($args['custom_rules'], true) ?: [])
                : (is_array($args['custom_rules']) ? $args['custom_rules'] : []);

            if (is_array($rules)) {
                foreach ($rules as $rule) {
                    if (!is_array($rule)) continue;
                    $field = strtolower(trim((string)($rule['field'] ?? '')));
                    $op = strtolower(trim((string)($rule['operator'] ?? '=')));
                    $val = $rule['value'] ?? null;
                    $valTo = $rule['valueTo'] ?? ($rule['value_to'] ?? null);

                    if (!in_array($field, self::ACTIVITIES_COLUMNS, true)) {
                        continue;
                    }
                    // Prevent overriding tenant_id or deleted_at security guards
                    if (in_array($field, ['tenant_id', 'deleted_at'], true)) {
                        continue;
                    }

                    $colExpr = "{$a}{$field}";
                    switch ($op) {
                        case '=':
                        case 'eq':
                        case 'equals':
                            $where[] = "{$colExpr} = ?";
                            $params[] = $val;
                            break;
                        case '!=':
                        case '<>':
                        case 'neq':
                        case 'not_equals':
                            $where[] = "({$colExpr} IS NULL OR {$colExpr} != ?)";
                            $params[] = $val;
                            break;
                        case '>':
                        case 'gt':
                            $where[] = "{$colExpr} > ?";
                            $params[] = $val;
                            break;
                        case '>=':
                        case 'gte':
                            $where[] = "{$colExpr} >= ?";
                            $params[] = $val;
                            break;
                        case '<':
                        case 'lt':
                            $where[] = "{$colExpr} < ?";
                            $params[] = $val;
                            break;
                        case '<=':
                        case 'lte':
                            $where[] = "{$colExpr} <= ?";
                            $params[] = $val;
                            break;
                        case 'contains':
                        case 'like':
                            $where[] = "{$colExpr} LIKE ?";
                            $params[] = '%' . (string)$val . '%';
                            break;
                        case 'not_contains':
                        case 'not_like':
                            $where[] = "({$colExpr} IS NULL OR {$colExpr} NOT LIKE ?)";
                            $params[] = '%' . (string)$val . '%';
                            break;
                        case 'in':
                            $inVals = is_array($val) ? $val : array_filter(array_map('trim', explode(',', (string)$val)));
                            if (!empty($inVals)) {
                                $ph = implode(',', array_fill(0, count($inVals), '?'));
                                $where[] = "{$colExpr} IN ({$ph})";
                                foreach ($inVals as $iv) {
                                    $params[] = $iv;
                                }
                            }
                            break;
                        case 'between':
                            if ($val !== null && $valTo !== null && $val !== '' && $valTo !== '') {
                                $where[] = "{$colExpr} BETWEEN ? AND ?";
                                $params[] = $val;
                                $params[] = $valTo;
                            }
                            break;
                        case 'is_empty':
                        case 'is_null':
                            $where[] = "({$colExpr} IS NULL OR {$colExpr} = '')";
                            break;
                        case 'is_not_empty':
                        case 'is_not_null':
                            $where[] = "({$colExpr} IS NOT NULL AND {$colExpr} != '')";
                            break;
                    }
                }
            }
        }
    }

    /**
     * 3. Enrich a single task with 360° metadata across all related tables
     */
    public static function enrichTaskDetail360(PDO $db, array $task, int $tid, int $uid): array {
        $taskId = (int)($task['id'] ?? 0);
        if ($taskId <= 0) {
            return $task;
        }

        // 1. Resolve approver_name if not already present
        if (empty($task['approver_name']) && !empty($task['approver_id'])) {
            $stmtApp = $db->prepare("SELECT full_name FROM users WHERE id = ? AND tenant_id = ? LIMIT 1");
            $stmtApp->execute([(int)$task['approver_id'], $tid]);
            $task['approver_name'] = $stmtApp->fetchColumn() ?: null;
        }

        // 2. Resolve task_group_name if not already present
        if (empty($task['task_group_name']) && !empty($task['task_group_id'])) {
            $stmtTg = $db->prepare("SELECT name, color, icon FROM task_groups WHERE id = ? AND tenant_id = ? LIMIT 1");
            $stmtTg->execute([(int)$task['task_group_id'], $tid]);
            $tgRow = $stmtTg->fetch(PDO::FETCH_ASSOC);
            if ($tgRow) {
                $task['task_group_name'] = $tgRow['name'];
                $task['task_group_color'] = $tgRow['color'] ?? '#BD1D2D';
                $task['task_group_icon'] = $tgRow['icon'] ?? 'Folder';
            }
        }

        // 3. Resolve related_entity_name
        $relatedEntityName = $task['related_entity_name'] ?? '';
        $relType = strtolower(trim((string)($task['related_type'] ?? '')));
        $relId = (int)($task['related_id'] ?? 0);
        $contactId = (int)($task['contact_id'] ?? 0);

        if ($relatedEntityName === '') {
            if (($relType === 'contact' || $relType === 'lead') && $relId > 0) {
                $stmtC = $db->prepare("SELECT full_name FROM contacts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1");
                $stmtC->execute([$relId, $tid]);
                $relatedEntityName = (string)($stmtC->fetchColumn() ?: '');
            } elseif ($relType === 'project' && $relId > 0) {
                $stmtP = $db->prepare("SELECT name, code FROM projects WHERE id = ? AND tenant_id = ? LIMIT 1");
                $stmtP->execute([$relId, $tid]);
                $pRow = $stmtP->fetch(PDO::FETCH_ASSOC);
                if ($pRow) {
                    $relatedEntityName = $pRow['name'] . (!empty($pRow['code']) ? " ({$pRow['code']})" : '');
                }
            } elseif ($relType === 'deal' && $relId > 0) {
                $stmtD = $db->prepare("SELECT title FROM deals WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1");
                $stmtD->execute([$relId, $tid]);
                $relatedEntityName = (string)($stmtD->fetchColumn() ?: '');
            } elseif ($relType === 'company' && $relId > 0) {
                $stmtCo = $db->prepare("SELECT name FROM companies WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1");
                $stmtCo->execute([$relId, $tid]);
                $relatedEntityName = (string)($stmtCo->fetchColumn() ?: '');
            } elseif ($relType === 'team' && $relId > 0) {
                $stmtTm = $db->prepare("SELECT name FROM teams WHERE id = ? LIMIT 1");
                $stmtTm->execute([$relId]);
                $relatedEntityName = (string)($stmtTm->fetchColumn() ?: '');
            } elseif ($contactId > 0) {
                $stmtC = $db->prepare("SELECT full_name FROM contacts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1");
                $stmtC->execute([$contactId, $tid]);
                $relatedEntityName = (string)($stmtC->fetchColumn() ?: '');
            }
        }
        $task['related_entity_name'] = $relatedEntityName ?: null;

        // 4. Parse checklist & resolve subtask assignee_name + subtask_comment_counts
        $subtaskCommentStmt = $db->prepare("
            SELECT subtask_id, COUNT(*) as cnt
            FROM activity_comments
            WHERE activity_id = ? AND tenant_id = ? AND subtask_id IS NOT NULL AND subtask_id != ''
            GROUP BY subtask_id
        ");
        $subtaskCommentStmt->execute([$taskId, $tid]);
        $subtaskCommentCounts = [];
        foreach ($subtaskCommentStmt->fetchAll(PDO::FETCH_ASSOC) as $scRow) {
            $subtaskCommentCounts[(string)$scRow['subtask_id']] = (int)$scRow['cnt'];
        }
        $task['subtask_comment_counts'] = $subtaskCommentCounts;

        $bodyData = self::decodeTaskBody($task['body'] ?? null);
        $checklist = $bodyData['erp_task']['checklist'] ?? [];
        $subAssigneeIds = [];
        foreach ($checklist as $chkItem) {
            if (!empty($chkItem['assignee_id'])) {
                foreach (self::parseUserIds($chkItem['assignee_id']) as $suid) {
                    $subAssigneeIds[] = $suid;
                }
            }
        }
        $subUserMap = !empty($subAssigneeIds) ? AgentToolRegistry::resolveUserNames($db, $subAssigneeIds, $tid) : [];
        $enrichedChecklist = [];
        foreach ($checklist as $chkItem) {
            $chkId = (string)($chkItem['id'] ?? '');
            $aIds = self::parseUserIds($chkItem['assignee_id'] ?? null);
            $aNames = [];
            foreach ($aIds as $aid) {
                if (isset($subUserMap[$aid])) {
                    $aNames[] = $subUserMap[$aid];
                }
            }
            $isDone = !empty($chkItem['done']) || !empty($chkItem['checked']);
            $enrichedChecklist[] = [
                'id' => $chkId,
                'title' => (string)($chkItem['title'] ?? ($chkItem['text'] ?? '')),
                'done' => $isDone,
                'assignee_id' => $chkItem['assignee_id'] ?? null,
                'assignee_name' => !empty($aNames) ? implode(', ', $aNames) : null,
                'due_date' => $chkItem['due_date'] ?? null,
                'comment_count' => $chkId !== '' ? ($subtaskCommentCounts[$chkId] ?? 0) : 0
            ];
        }
        $task['enriched_checklist'] = $enrichedChecklist;
        $task['links'] = $bodyData['erp_task']['links'] ?? [];

        // 5. Resolve predecessors & successors from `activity_dependencies`
        $stmtPred = $db->prepare("
            SELECT ad.id, ad.predecessor_id as task_id, ad.dependency_type, ad.lag_days,
                   a.subject, a.status, a.progress, a.start_date, a.due_date, u.full_name as assignee_name
            FROM activity_dependencies ad
            JOIN activities a ON ad.predecessor_id = a.id
            LEFT JOIN users u ON a.user_id = u.id
            WHERE ad.activity_id = ? AND a.tenant_id = ? AND a.deleted_at IS NULL
        ");
        $stmtPred->execute([$taskId, $tid]);
        $task['predecessors'] = $stmtPred->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $stmtSucc = $db->prepare("
            SELECT ad.id, ad.activity_id as task_id, ad.dependency_type, ad.lag_days,
                   a.subject, a.status, a.progress, a.start_date, a.due_date, u.full_name as assignee_name
            FROM activity_dependencies ad
            JOIN activities a ON ad.activity_id = a.id
            LEFT JOIN users u ON a.user_id = u.id
            WHERE ad.predecessor_id = ? AND a.tenant_id = ? AND a.deleted_at IS NULL
        ");
        $stmtSucc->execute([$taskId, $tid]);
        $task['successors'] = $stmtSucc->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // 6. Resolve focus_summary from `task_focus_logs`
        $stmtFocus = $db->prepare("
            SELECT COUNT(*) as sessions_count, COALESCE(SUM(duration_minutes), 0) as total_minutes
            FROM task_focus_logs
            WHERE task_id = ? AND tenant_id = ?
        ");
        $stmtFocus->execute([$taskId, $tid]);
        $focusRow = $stmtFocus->fetch(PDO::FETCH_ASSOC) ?: [];
        $task['focus_summary'] = [
            'sessions_count' => (int)($focusRow['sessions_count'] ?? 0),
            'total_minutes' => (int)($focusRow['total_minutes'] ?? 0)
        ];

        // 7. Resolve whiteboard from `task_whiteboards`
        try {
            $stmtWb = $db->prepare("
                SELECT id, title, node_count, version, updated_at
                FROM task_whiteboards
                WHERE task_id = ? AND tenant_id = ?
                LIMIT 1
            ");
            $stmtWb->execute([$taskId, $tid]);
            $wbRow = $stmtWb->fetch(PDO::FETCH_ASSOC);
            $task['whiteboard'] = $wbRow ?: null;
        } catch (\Throwable $e) {
            $task['whiteboard'] = null;
        }

        // 8. Check mute & hide status for current user
        $stmtMuted = $db->prepare("SELECT 1 FROM task_muted_notifications WHERE task_id = ? AND user_id = ? LIMIT 1");
        $stmtMuted->execute([$taskId, $uid]);
        $task['is_muted'] = (bool)$stmtMuted->fetchColumn();

        return $task;
    }

    /**
     * 4. Execute `smart_manage_tasks_and_subtasks` with Zero-Trust RBAC, Subtask Engine, Approval Machine, Dependency Graph & Notifications
     */
    public static function executeSmartManageTasks(PDO $db, array $args, array $auth): array {
        $uid = (int)($auth['user_id'] ?? 0);
        $tid = (int)($auth['tenant_id'] ?? 1);
        $role = strtolower(trim((string)($auth['role'] ?? 'user')));
        $actorName = (string)($auth['full_name'] ?? ($auth['username'] ?? 'Đồng nghiệp'));

        if ($role === 'viewer') {
            return ['success' => false, 'message' => 'Tài khoản Viewer chỉ có quyền xem, không có quyền tạo hoặc chỉnh sửa công việc.'];
        }

        $isAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'general_director', 'sale_director', 'ceo'], true);
        $isManager = in_array($role, ['manager', 'truong_phong', 'leader', 'team_lead'], true);
        $isAdminOrMgr = $isAdmin || $isManager;

        $action = strtolower(trim((string)($args['action'] ?? 'create_or_delegate')));

        // ==========================================
        // ACTION A: MANAGE TASK GROUPS
        // ==========================================
        if ($action === 'manage_task_groups') {
            return self::handleManageTaskGroups($db, $args, $tid, $uid, $isAdmin);
        }

        // ==========================================
        // ACTION B: CREATE OR DELEGATE TASK
        // ==========================================
        if ($action === 'create_or_delegate') {
            $subject = trim((string)($args['subject'] ?? ($args['task_title'] ?? '')));
            if ($subject === '') {
                return ['success' => false, 'message' => 'Vui lòng cung cấp tiêu đề công việc (subject).'];
            }
            $subject = self::sanitizeSubject($subject);

            $type = strtolower(trim((string)($args['type'] ?? 'task')));
            if (!in_array($type, ['task', 'meeting', 'call', 'note', 'email'], true)) {
                $type = 'task';
            }

            $priority = strtolower(trim((string)($args['priority'] ?? 'medium')));
            if (!in_array($priority, ['low', 'medium', 'high', 'urgent'], true)) {
                $priority = 'medium';
            }

            // Resolve primary assignee
            $targetUserId = !empty($args['user_id']) ? (int)$args['user_id'] : $uid;
            if (!empty($args['assignee_name'])) {
                $resolvedUid = self::resolveSingleUserId($db, $tid, (string)$args['assignee_name']);
                if ($resolvedUid > 0) {
                    $targetUserId = $resolvedUid;
                }
            }

            // Resolve collaborators / participant_ids
            $pids = self::parseUserIds($args['participant_ids'] ?? '');
            if (!empty($args['collaborator_names'])) {
                foreach (explode(',', (string)$args['collaborator_names']) as $cName) {
                    $cName = trim($cName);
                    if ($cName !== '') {
                        $cUid = self::resolveSingleUserId($db, $tid, $cName);
                        if ($cUid > 0 && $cUid !== $targetUserId && !in_array($cUid, $pids, true)) {
                            $pids[] = $cUid;
                        }
                    }
                }
            }

            // Resolve approver
            $requireApproval = !empty($args['require_approval']) ? 1 : 0;
            $approverId = !empty($args['approver_id']) ? (int)$args['approver_id'] : null;
            if (!empty($args['approver_name'])) {
                $resAppId = self::resolveSingleUserId($db, $tid, (string)$args['approver_name']);
                if ($resAppId > 0) {
                    $approverId = $resAppId;
                    $requireApproval = 1;
                }
            }

            // Resolve task group
            $taskGroupId = !empty($args['task_group_id']) ? (int)$args['task_group_id'] : null;
            if (!$taskGroupId && !empty($args['task_group_name'])) {
                $taskGroupId = self::resolveOrCreateTaskGroup($db, $tid, $uid, (string)$args['task_group_name']);
            }

            // Resolve related entity
            [$relType, $relId, $contactId, $extraTag] = self::resolveRelatedEntity(
                $db,
                $tid,
                $args['related_type'] ?? null,
                isset($args['related_id']) ? (int)$args['related_id'] : null,
                $args['related_name'] ?? null,
                isset($args['contact_id']) ? (int)$args['contact_id'] : null
            );

            $tags = trim((string)($args['tags'] ?? ''));
            if ($extraTag !== '') {
                $tags = $tags !== '' ? ($tags . ', ' . $extraTag) : $extraTag;
            }

            // Build structured JSON body (`erp_task`)
            $description = trim((string)($args['description'] ?? ''));
            $checklistItems = [];
            $maxSubDueDate = null;
            if (!empty($args['subtasks']) && is_array($args['subtasks'])) {
                foreach ($args['subtasks'] as $idx => $sub) {
                    if (!is_array($sub)) continue;
                    $subTitle = trim((string)($sub['title'] ?? ($sub['text'] ?? '')));
                    if ($subTitle === '') continue;
                    $subAssigneeId = !empty($sub['assignee_id']) ? (int)$sub['assignee_id'] : null;
                    if (!$subAssigneeId && !empty($sub['assignee_name'])) {
                        $subAssigneeId = self::resolveSingleUserId($db, $tid, (string)$sub['assignee_name']) ?: null;
                    }
                    $subDue = !empty($sub['due_date']) ? substr(trim((string)$sub['due_date']), 0, 10) : null;
                    if ($subDue && (!$maxSubDueDate || $subDue > $maxSubDueDate)) {
                        $maxSubDueDate = $subDue;
                    }
                    $subDone = !empty($sub['done']) || !empty($sub['checked']);
                    $checklistItems[] = [
                        'id' => !empty($sub['subtask_id']) ? (string)$sub['subtask_id'] : ('chk_' . time() . '_' . ($idx + 1) . '_' . mt_rand(100, 999)),
                        'title' => $subTitle,
                        'text' => $subTitle,
                        'done' => $subDone,
                        'checked' => $subDone,
                        'assignee_id' => $subAssigneeId ? (string)$subAssigneeId : null,
                        'due_date' => $subDue
                    ];
                }
            }

            $links = [];
            if (!empty($args['link'])) {
                $links[] = [
                    'title' => (string)$args['link'],
                    'url' => (string)$args['link'],
                    'is_image' => false
                ];
            }

            $bodyJson = json_encode([
                'erp_task' => [
                    'description' => $description,
                    'checklist' => $checklistItems,
                    'links' => $links
                ]
            ], JSON_UNESCAPED_UNICODE);

            $startDate = !empty($args['start_date']) ? self::normalizeDateTime((string)$args['start_date'], '08:00:00') : date('Y-m-d H:i:s');
            $dueDate = !empty($args['due_date']) ? self::normalizeDueDate((string)$args['due_date']) : null;
            if ($maxSubDueDate) {
                $currDueDay = $dueDate ? substr($dueDate, 0, 10) : null;
                if (!$currDueDay || $maxSubDueDate > $currDueDay) {
                    $dueDate = $maxSubDueDate . ' 18:00:00';
                }
            }

            $status = strtolower(trim((string)($args['status'] ?? 'planned')));
            if (!in_array($status, ['planned', 'in_progress', 'done', 'cancelled'], true)) {
                $status = 'planned';
            }
            $progress = isset($args['progress']) ? max(0, min(100, (int)$args['progress'])) : 0;
            if (!empty($checklistItems) && !isset($args['progress'])) {
                $doneCnt = count(array_filter($checklistItems, fn($it) => !empty($it['done'])));
                $progress = (int)round(($doneCnt / count($checklistItems)) * 100);
            }

            $approvalStatus = null;
            $doneAt = null;
            if ($status === 'done' || $progress >= 100) {
                $progress = 100;
                $isCallerApprover = ($approverId && $approverId === $uid) || $isAdminOrMgr;
                if ($requireApproval === 1 && !$isCallerApprover) {
                    $status = 'in_progress';
                    $approvalStatus = 'pending';
                    $doneAt = null;
                } else {
                    $status = 'done';
                    $approvalStatus = $requireApproval === 1 ? 'approved' : null;
                    $doneAt = date('Y-m-d H:i:s');
                }
            }

            $participantIdsStr = !empty($pids) ? implode(',', $pids) : null;
            $linkStr = !empty($args['link']) ? trim((string)$args['link']) : null;

            $stmtIns = $db->prepare("
                INSERT INTO activities (
                    tenant_id, user_id, task_group_id, created_by, type, subject, body,
                    status, priority, start_date, due_date, done_at,
                    related_type, related_id, contact_id, tags, participant_ids,
                    progress, require_approval, approver_id, approval_status, link,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ");
            $stmtIns->execute([
                $tid, $targetUserId, $taskGroupId, $uid, $type, $subject, $bodyJson,
                $status, $priority, $startDate, $dueDate, $doneAt,
                $relType, $relId, $contactId, $tags !== '' ? $tags : null, $participantIdsStr,
                $progress, $requireApproval, $approverId, $approvalStatus, $linkStr
            ]);
            $newTaskId = (int)$db->lastInsertId();

            // Optional dependency setup on create
            if (!empty($args['predecessor_task_id']) && (int)$args['predecessor_task_id'] > 0) {
                $predId = (int)$args['predecessor_task_id'];
                $depType = in_array($args['dependency_type'] ?? 'FS', ['FS', 'SS', 'FF', 'SF'], true) ? $args['dependency_type'] : 'FS';
                $lagDays = (int)($args['lag_days'] ?? 0);
                if (!self::hasCircularDependency($db, $newTaskId, $predId)) {
                    $db->prepare("INSERT INTO activity_dependencies (activity_id, predecessor_id, dependency_type, lag_days) VALUES (?, ?, ?, ?)")
                       ->execute([$newTaskId, $predId, $depType, $lagDays]);
                }
            }

            // Notifications
            $taskUrl = "/workspace?task_id={$newTaskId}";
            if ($targetUserId > 0 && $targetUserId !== $uid) {
                self::insertNotification(
                    $db,
                    $tid,
                    $targetUserId,
                    'Bạn có nhiệm vụ mới được giao',
                    "{$actorName} đã giao nhiệm vụ \"{$subject}\" cho bạn.",
                    'task_assignment',
                    $taskUrl
                );
            }
            foreach ($pids as $pid) {
                if ($pid !== $uid && $pid !== $targetUserId) {
                    self::insertNotification(
                        $db,
                        $tid,
                        $pid,
                        'Bạn được thêm vào danh sách người phối hợp',
                        "{$actorName} đã thêm bạn phối hợp trong công việc \"{$subject}\".",
                        'task_participant',
                        $taskUrl
                    );
                }
            }
            if ($requireApproval === 1 && $approverId && $approverId !== $uid && $approvalStatus === 'pending') {
                self::insertNotification(
                    $db,
                    $tid,
                    $approverId,
                    'Yêu cầu phê duyệt hoàn thành công việc',
                    "{$actorName} đã gửi yêu cầu phê duyệt công việc \"{$subject}\".",
                    'approval_request',
                    $taskUrl
                );
            }

            if (function_exists('logActivity')) {
                logActivity($db, $tid, $uid, 'CREATE', 'activity', $newTaskId, json_encode(['subject' => $subject, 'type' => $type]));
            }

            $smartCard = AgentToolRegistry::buildEntitySmartCard('task', [
                'id' => $newTaskId,
                'title' => $subject,
                'subtitle' => "Tiến độ: {$progress}% • Ưu tiên: {$priority}",
                'status' => $status,
                'direct_url' => $taskUrl,
                'action_label' => 'Mở công việc'
            ]);

            return [
                'success' => true,
                'action' => 'create_or_delegate',
                'task_id' => $newTaskId,
                'subject' => $subject,
                'status' => $status,
                'priority' => $priority,
                'progress' => $progress,
                'due_date' => $dueDate,
                'user_id' => $targetUserId,
                'subtasks_count' => count($checklistItems),
                'url' => $taskUrl,
                'smart_card' => $smartCard,
                'summary' => "Đã tạo thành công công việc #{$newTaskId} (\"{$subject}\")" . (count($checklistItems) > 0 ? " kèm " . count($checklistItems) . " công việc con." : ".")
            ];
        }

        // ==========================================
        // ACTION C: BATCH UPDATE TASKS
        // ==========================================
        if ($action === 'batch_update') {
            $taskIds = [];
            if (!empty($args['task_ids']) && is_array($args['task_ids'])) {
                $taskIds = array_values(array_unique(array_filter(array_map('intval', $args['task_ids']), fn($id) => $id > 0)));
            } elseif (!empty($args['task_id'])) {
                $taskIds = [(int)$args['task_id']];
            }
            if (empty($taskIds)) {
                return ['success' => false, 'message' => 'Vui lòng cung cấp danh sách task_ids cần cập nhật hàng loạt.'];
            }

            $updatedIds = [];
            $skippedIds = [];
            foreach ($taskIds as $tidItem) {
                $singleArgs = $args;
                $singleArgs['action'] = 'update_task';
                $singleArgs['task_id'] = $tidItem;
                unset($singleArgs['task_ids']);
                $res = self::executeSmartManageTasks($db, $singleArgs, $auth);
                if (!empty($res['success'])) {
                    $updatedIds[] = $tidItem;
                } else {
                    $skippedIds[] = ['task_id' => $tidItem, 'reason' => $res['message'] ?? 'Không có quyền hoặc không tìm thấy'];
                }
            }

            return [
                'success' => count($updatedIds) > 0,
                'action' => 'batch_update',
                'updated_count' => count($updatedIds),
                'updated_task_ids' => $updatedIds,
                'skipped' => $skippedIds,
                'summary' => 'Đã cập nhật hàng loạt ' . count($updatedIds) . '/' . count($taskIds) . ' công việc.'
            ];
        }

        // ==========================================
        // RESOLVE SINGLE TARGET TASK FOR REMAINING ACTIONS
        // ==========================================
        $resolved = self::resolveTargetTaskWithRbac($db, $tid, $uid, $auth, $args);
        if (empty($resolved['success'])) {
            return $resolved;
        }
        $task = $resolved['task'];
        $taskId = (int)$task['id'];
        $taskUrl = "/workspace?task_id={$taskId}";

        // ==========================================
        // ACTION D: DELETE TASK (SOFT DELETE)
        // ==========================================
        if ($action === 'delete_task') {
            $canDelete = $isAdminOrMgr || (int)$task['user_id'] === $uid || (int)$task['created_by'] === $uid;
            if (!$canDelete) {
                return ['success' => false, 'message' => "Bạn không có quyền xóa công việc #{$taskId}."];
            }
            $db->prepare("UPDATE activities SET deleted_at = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ?")
               ->execute([$taskId, $tid]);
            if (function_exists('logActivity')) {
                logActivity($db, $tid, $uid, 'DELETE', 'activity', $taskId);
            }
            return [
                'success' => true,
                'action' => 'delete_task',
                'task_id' => $taskId,
                'subject' => $task['subject'],
                'summary' => "Đã xóa công việc #{$taskId} (\"{$task['subject']}\")."
            ];
        }

        // ==========================================
        // ACTION E: LOG FOCUS (POMODORO)
        // ==========================================
        if ($action === 'log_focus') {
            $duration = isset($args['focus_duration_minutes']) ? max(1, min(480, (int)$args['focus_duration_minutes'])) : 25;
            $db->prepare("
                INSERT INTO task_focus_logs (tenant_id, task_id, user_id, duration_minutes, completed_at)
                VALUES (?, ?, ?, ?, NOW())
            ")->execute([$tid, $taskId, $uid, $duration]);

            $stmtSum = $db->prepare("SELECT COUNT(*) as sessions_count, COALESCE(SUM(duration_minutes), 0) as total_minutes FROM task_focus_logs WHERE task_id = ? AND tenant_id = ?");
            $stmtSum->execute([$taskId, $tid]);
            $sumRow = $stmtSum->fetch(PDO::FETCH_ASSOC) ?: [];

            $smartCard = AgentToolRegistry::buildEntitySmartCard('task', [
                'id' => $taskId,
                'title' => $task['subject'],
                'subtitle' => "Tổng thời gian tập trung: " . (int)($sumRow['total_minutes'] ?? $duration) . " phút",
                'status' => (string)$task['status'],
                'direct_url' => $taskUrl,
                'action_label' => 'Mở công việc'
            ]);

            return [
                'success' => true,
                'action' => 'log_focus',
                'task_id' => $taskId,
                'added_minutes' => $duration,
                'focus_summary' => [
                    'sessions_count' => (int)($sumRow['sessions_count'] ?? 1),
                    'total_minutes' => (int)($sumRow['total_minutes'] ?? $duration)
                ],
                'url' => $taskUrl,
                'smart_card' => $smartCard,
                'summary' => "Đã ghi nhận {$duration} phút tập trung cho công việc #{$taskId} (\"{$task['subject']}\"). Tổng tích lũy: " . (int)($sumRow['total_minutes'] ?? $duration) . " phút."
            ];
        }

        // ==========================================
        // ACTION F: ADD COMMENT (TASK OR SUBTASK)
        // ==========================================
        if ($action === 'add_comment') {
            $commentContent = trim((string)($args['comment_content'] ?? ($args['feedback_note'] ?? '')));
            if ($commentContent === '') {
                return ['success' => false, 'message' => 'Vui lòng nhập nội dung bình luận (comment_content).'];
            }
            $subtaskId = !empty($args['subtask_id']) ? trim((string)$args['subtask_id']) : null;
            $parentCommentId = !empty($args['parent_comment_id']) ? (int)$args['parent_comment_id'] : null;

            $stmtCmt = $db->prepare("
                INSERT INTO activity_comments (tenant_id, activity_id, user_id, content, attachments, created_at, parent_id, subtask_id)
                VALUES (?, ?, ?, ?, NULL, NOW(), ?, ?)
            ");
            $stmtCmt->execute([$tid, $taskId, $uid, $commentContent, $parentCommentId, $subtaskId]);
            $commentId = (int)$db->lastInsertId();

            // Notify task assignee and creator if different from commenter
            $notifyTargets = array_unique(array_filter([(int)$task['user_id'], (int)$task['created_by']]));
            foreach ($notifyTargets as $ntUid) {
                if ($ntUid > 0 && $ntUid !== $uid) {
                    self::insertNotification(
                        $db,
                        $tid,
                        $ntUid,
                        'Bình luận mới trong công việc',
                        "{$actorName} đã bình luận trong công việc \"{$task['subject']}\": " . mb_substr($commentContent, 0, 100),
                        'comment',
                        $taskUrl . "&highlight_comment_id={$commentId}" . ($subtaskId ? "&subtask_id={$subtaskId}" : '')
                    );
                }
            }

            $smartCard = AgentToolRegistry::buildEntitySmartCard('task', [
                'id' => $taskId,
                'title' => $task['subject'],
                'subtitle' => "Bình luận mới: " . mb_substr($commentContent, 0, 60),
                'status' => (string)$task['status'],
                'direct_url' => $taskUrl,
                'action_label' => 'Xem bình luận'
            ]);

            return [
                'success' => true,
                'action' => 'add_comment',
                'task_id' => $taskId,
                'comment_id' => $commentId,
                'subtask_id' => $subtaskId,
                'url' => $taskUrl,
                'smart_card' => $smartCard,
                'summary' => "Đã thêm bình luận vào công việc #{$taskId} (\"{$task['subject']}\")."
            ];
        }

        // ==========================================
        // ACTION G: MANAGE DEPENDENCIES
        // ==========================================
        if ($action === 'manage_dependencies') {
            $predId = (int)($args['predecessor_task_id'] ?? 0);
            if ($predId <= 0 || $predId === $taskId) {
                return ['success' => false, 'message' => 'Vui lòng cung cấp predecessor_task_id hợp lệ và khác với task_id hiện tại.'];
            }
            $chkPred = $db->prepare("SELECT id, subject, due_date FROM activities WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1");
            $chkPred->execute([$predId, $tid]);
            $predRow = $chkPred->fetch(PDO::FETCH_ASSOC);
            if (!$predRow) {
                return ['success' => false, 'message' => "Không tìm thấy công việc tiền nhiệm ID #{$predId}."];
            }
            if (self::hasCircularDependency($db, $taskId, $predId)) {
                return ['success' => false, 'message' => "Không thể thiết lập phụ thuộc tuần hoàn (circular dependency) giữa công việc #{$taskId} và #{$predId}."];
            }

            $depType = strtoupper(trim((string)($args['dependency_type'] ?? 'FS')));
            if (!in_array($depType, ['FS', 'SS', 'FF', 'SF'], true)) {
                $depType = 'FS';
            }
            $lagDays = (int)($args['lag_days'] ?? 0);

            // Upsert dependency
            $db->prepare("DELETE FROM activity_dependencies WHERE activity_id = ? AND predecessor_id = ?")->execute([$taskId, $predId]);
            $db->prepare("
                INSERT INTO activity_dependencies (activity_id, predecessor_id, dependency_type, lag_days, created_at)
                VALUES (?, ?, ?, ?, NOW())
            ")->execute([$taskId, $predId, $depType, $lagDays]);

            if (!empty($args['cascade_reschedule']) && !empty($predRow['due_date'])) {
                $visited = [$predId => true];
                self::cascadeReschedule($db, $tid, $predId, (string)$predRow['due_date'], $visited);
            }

            $smartCard = AgentToolRegistry::buildEntitySmartCard('task', [
                'id' => $taskId,
                'title' => $task['subject'],
                'subtitle' => "Phụ thuộc ({$depType}) vào #{$predId}: {$predRow['subject']}",
                'status' => (string)$task['status'],
                'direct_url' => $taskUrl,
                'action_label' => 'Mở công việc'
            ]);

            return [
                'success' => true,
                'action' => 'manage_dependencies',
                'task_id' => $taskId,
                'predecessor_task_id' => $predId,
                'dependency_type' => $depType,
                'lag_days' => $lagDays,
                'url' => $taskUrl,
                'smart_card' => $smartCard,
                'summary' => "Đã thiết lập phụ thuộc {$depType} (độ trễ {$lagDays} ngày): Công việc #{$taskId} phụ thuộc vào công việc #{$predId} (\"{$predRow['subject']}\")."
            ];
        }

        // ==========================================
        // ACTION H: SUBTASK OPERATIONS (add_subtasks, update_subtask, toggle_subtask, delete_subtask)
        // ==========================================
        if (in_array($action, ['add_subtasks', 'update_subtask', 'toggle_subtask', 'delete_subtask'], true)) {
            return self::handleSubtaskOperations($db, $task, $args, $auth, $action, $tid, $uid, $isAdminOrMgr, $actorName);
        }

        // ==========================================
        // ACTION I: APPROVAL WORKFLOW (approve_task, reject_task, request_approval)
        // ==========================================
        if (in_array($action, ['approve_task', 'reject_task', 'request_approval'], true)) {
            return self::handleTaskApprovalWorkflow($db, $task, $args, $auth, $action, $tid, $uid, $isAdminOrMgr, $actorName);
        }

        // ==========================================
        // ACTION J: UPDATE TASK (COMPREHENSIVE 29-COLUMN UPDATE)
        // ==========================================
        return self::handleUpdateTask($db, $task, $args, $auth, $tid, $uid, $isAdminOrMgr, $actorName);
    }

    /**
     * 5. Execute `query_and_manage_projects` with 100% `projects` (23 cols, NO `deleted_at`), `project_roster`, `project_documents` & CRM/Task stats
     */
    public static function executeQueryAndManageProjects(PDO $db, array $args, array $auth): array {
        $uid = (int)($auth['user_id'] ?? 0);
        $tid = (int)($auth['tenant_id'] ?? 1);
        $role = strtolower(trim((string)($auth['role'] ?? 'user')));
        $actorName = (string)($auth['full_name'] ?? ($auth['username'] ?? 'Đồng nghiệp'));

        $isAdminOrDirector = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'general_director', 'sale_director', 'ceo', 'marketing', 'academic', 'hoc_vu'], true);
        $isManager = in_array($role, ['manager', 'truong_phong', 'leader', 'team_lead'], true);
        $isRosterRestricted = in_array($role, ['sale', 'sales', 'manager'], true);

        $action = strtolower(trim((string)($args['action'] ?? 'list')));

        // 1. LIST PROJECTS
        if (in_array($action, ['list', 'query_projects', 'list_projects', 'search_projects', 'get_projects'], true)) {
            $where = ['p.tenant_id = ?'];
            $params = [$tid];

            if ($isRosterRestricted && !$isAdminOrDirector) {
                $where[] = "(
                    EXISTS (SELECT 1 FROM project_roster pr WHERE pr.project_id = p.id AND pr.user_id = ?)
                    OR FIND_IN_SET(?, IFNULL(p.manager_ids, '')) > 0
                    OR p.created_by = ?
                )";
                array_push($params, $uid, (string)$uid, $uid);
            }

            $statusFilter = strtolower(trim((string)($args['status'] ?? 'all')));
            if ($statusFilter !== '' && $statusFilter !== 'all') {
                $where[] = 'p.status = ?';
                $params[] = $statusFilter;
            }

            $kw = trim((string)($args['project_name_or_code'] ?? ''));
            if ($kw !== '') {
                $likeKw = '%' . $kw . '%';
                $where[] = '(p.name LIKE ? OR p.code LIKE ? OR p.developer LIKE ? OR p.location LIKE ?)';
                array_push($params, $likeKw, $likeKw, $likeKw, $likeKw);
            }

            $whereSql = implode(' AND ', $where);
            $stmt = $db->prepare("
                SELECT p.*,
                       (SELECT COUNT(*) FROM project_roster pr WHERE pr.project_id = p.id) as roster_count,
                       (SELECT COUNT(*) FROM project_documents pd WHERE pd.project_id = p.id) as doc_count,
                       (SELECT COUNT(*) FROM activities a WHERE a.related_type = 'project' AND a.related_id = p.id AND a.deleted_at IS NULL) as task_count
                FROM projects p
                WHERE {$whereSql}
                ORDER BY p.created_at DESC
                LIMIT 30
            ");
            $stmt->execute($params);
            $projects = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            return [
                'success' => true,
                'action' => 'list',
                'total_count' => count($projects),
                'projects' => $projects,
                'summary' => 'Tìm thấy ' . count($projects) . ' dự án/chương trình đào tạo.'
            ];
        }

        // Resolve target project for detail / stats / update_project / manage_roster / add_comment
        $project = self::resolveTargetProject($db, $tid, (int)($args['project_id'] ?? 0), (string)($args['project_name_or_code'] ?? ''));
        if (!$project) {
            return ['success' => false, 'message' => 'Không tìm thấy dự án/chương trình đào tạo phù hợp.'];
        }
        $projectId = (int)$project['id'];

        // Verify project read access
        if (!self::hasProjectAccess($db, $project, $uid, $role, $isAdminOrDirector)) {
            return ['success' => false, 'message' => 'Bạn không thuộc danh sách thành viên (project_roster) của dự án này.'];
        }

        // 2. PROJECT DETAIL & STATS
        if ($action === 'detail' || $action === 'stats') {
            $stmtRoster = $db->prepare("
                SELECT u.id, u.full_name, u.email, u.role, u.department
                FROM users u
                JOIN project_roster pr ON u.id = pr.user_id
                WHERE pr.project_id = ?
                ORDER BY u.full_name ASC
            ");
            $stmtRoster->execute([$projectId]);
            $roster = $stmtRoster->fetchAll(PDO::FETCH_ASSOC) ?: [];

            $stmtDocs = $db->prepare("
                SELECT pd.id, pd.name, pd.file_path, pd.file_size, pd.mime_type, pd.created_at, u.full_name as uploaded_by_name
                FROM project_documents pd
                LEFT JOIN users u ON pd.uploaded_by = u.id
                WHERE pd.project_id = ?
                ORDER BY pd.created_at DESC
            ");
            $stmtDocs->execute([$projectId]);
            $documents = $stmtDocs->fetchAll(PDO::FETCH_ASSOC) ?: [];

            // Task statistics linked to this project
            $stmtTaskStats = $db->prepare("
                SELECT COUNT(*) as total_tasks,
                       COALESCE(SUM(CASE WHEN status IN ('done', 'completed') OR COALESCE(progress, 0) >= 100 THEN 1 ELSE 0 END), 0) as completed_tasks,
                       COALESCE(SUM(CASE WHEN due_date IS NOT NULL AND due_date < NOW() AND (status IS NULL OR status NOT IN ('done', 'completed', 'cancelled')) AND COALESCE(progress, 0) < 100 THEN 1 ELSE 0 END), 0) as overdue_tasks
                FROM activities
                WHERE tenant_id = ? AND related_type = 'project' AND related_id = ? AND deleted_at IS NULL
            ");
            $stmtTaskStats->execute([$tid, $projectId]);
            $taskStats = $stmtTaskStats->fetch(PDO::FETCH_ASSOC) ?: [];

            // Lead & Revenue statistics matching project name or code
            $pName = trim((string)$project['name']);
            $pCode = trim((string)($project['code'] ?? ''));
            $stmtLeadStats = $db->prepare("
                SELECT COUNT(*) as total_leads
                FROM contacts
                WHERE tenant_id = ? AND deleted_at IS NULL
                  AND (program LIKE ? OR (? != '' AND program LIKE ?))
            ");
            $stmtLeadStats->execute([$tid, '%' . $pName . '%', $pCode, '%' . $pCode . '%']);
            $totalLeads = (int)$stmtLeadStats->fetchColumn();

            $stmtRevStats = $db->prepare("
                SELECT COUNT(d.id) as deposit_count,
                       COALESCE(SUM(CASE WHEN d.status IN ('approved', 'completed', 'paid') THEN d.amount ELSE 0 END), 0) as approved_revenue
                FROM deposits d
                LEFT JOIN contacts c ON d.contact_id = c.id AND c.deleted_at IS NULL
                WHERE d.tenant_id = ? AND d.deleted_at IS NULL
                  AND (d.program LIKE ? OR (? != '' AND d.program LIKE ?) OR c.program LIKE ?)
            ");
            $stmtRevStats->execute([$tid, '%' . $pName . '%', $pCode, '%' . $pCode . '%', '%' . $pName . '%']);
            $revStats = $stmtRevStats->fetch(PDO::FETCH_ASSOC) ?: [];

            $projectUrl = "/projects?id={$projectId}";
            $smartCard = AgentToolRegistry::buildEntitySmartCard('project', [
                'id' => $projectId,
                'title' => $project['name'] . (!empty($project['code']) ? " ({$project['code']})" : ''),
                'subtitle' => "Tiến độ: " . (int)($project['progress_percent'] ?? 0) . "% • Thành viên: " . count($roster) . " • Tài liệu: " . count($documents),
                'status' => (string)($project['status'] ?? 'active'),
                'direct_url' => $projectUrl,
                'action_label' => 'Mở dự án'
            ]);

            return [
                'success' => true,
                'action' => $action,
                'project' => $project,
                'roster' => $roster,
                'documents' => $documents,
                'stats' => [
                    'roster_count' => count($roster),
                    'documents_count' => count($documents),
                    'total_leads' => $totalLeads,
                    'deposit_count' => (int)($revStats['deposit_count'] ?? 0),
                    'approved_revenue' => (float)($revStats['approved_revenue'] ?? 0),
                    'total_tasks' => (int)($taskStats['total_tasks'] ?? 0),
                    'completed_tasks' => (int)($taskStats['completed_tasks'] ?? 0),
                    'overdue_tasks' => (int)($taskStats['overdue_tasks'] ?? 0)
                ],
                'url' => $projectUrl,
                'smart_card' => $smartCard,
                'summary' => "Chi tiết dự án \"{$project['name']}\" (#{$projectId}): Tiến độ {$project['progress_percent']}%, " . count($roster) . " thành viên, " . count($documents) . " tài liệu, {$totalLeads} khách hàng quan tâm."
            ];
        }

        // 3. UPDATE PROJECT
        if ($action === 'update_project') {
            if (!self::canEditProject($db, $project, $uid, $role, $isAdminOrDirector, $isManager)) {
                return ['success' => false, 'message' => 'Bạn không có quyền chỉnh sửa thông tin dự án này.'];
            }

            $sets = [];
            $params = [];
            $updatableFields = [
                'status', 'progress_percent', 'construction_status', 'legal_status',
                'description', 'location', 'developer'
            ];
            foreach ($updatableFields as $field) {
                if (isset($args[$field]) && $args[$field] !== '') {
                    $sets[] = "{$field} = ?";
                    $params[] = $field === 'progress_percent' ? max(0, min(100, (int)$args[$field])) : trim((string)$args[$field]);
                }
            }
            if (empty($sets)) {
                return ['success' => false, 'message' => 'Không có trường dữ liệu nào cần cập nhật cho dự án.'];
            }

            $sets[] = "updated_at = NOW()";
            $params[] = $projectId;
            $params[] = $tid;
            $db->prepare("UPDATE projects SET " . implode(', ', $sets) . " WHERE id = ? AND tenant_id = ?")
               ->execute($params);

            $projectUrl = "/projects?id={$projectId}";
            $smartCard = AgentToolRegistry::buildEntitySmartCard('project', [
                'id' => $projectId,
                'title' => $project['name'],
                'subtitle' => 'Đã cập nhật thông tin dự án',
                'status' => (string)($args['status'] ?? $project['status']),
                'direct_url' => $projectUrl,
                'action_label' => 'Mở dự án'
            ]);

            return [
                'success' => true,
                'action' => 'update_project',
                'project_id' => $projectId,
                'url' => $projectUrl,
                'smart_card' => $smartCard,
                'summary' => "Đã cập nhật thông tin dự án \"{$project['name']}\" (#{$projectId})."
            ];
        }

        // 4. MANAGE ROSTER
        if ($action === 'manage_roster') {
            if (!self::canEditProject($db, $project, $uid, $role, $isAdminOrDirector, $isManager)) {
                return ['success' => false, 'message' => 'Bạn không có quyền quản lý danh sách thành viên (roster) của dự án này.'];
            }

            $addedNames = [];
            $removedNames = [];

            if (!empty($args['member_names_to_add'])) {
                foreach (explode(',', (string)$args['member_names_to_add']) as $rawName) {
                    $rawName = trim($rawName);
                    if ($rawName === '') continue;
                    $mUid = self::resolveSingleUserId($db, $tid, $rawName);
                    if ($mUid > 0) {
                        $chk = $db->prepare("SELECT 1 FROM project_roster WHERE project_id = ? AND user_id = ? LIMIT 1");
                        $chk->execute([$projectId, $mUid]);
                        if (!$chk->fetchColumn()) {
                            $db->prepare("INSERT INTO project_roster (project_id, user_id) VALUES (?, ?)")->execute([$projectId, $mUid]);
                            self::insertNotification(
                                $db,
                                $tid,
                                $mUid,
                                'Bạn được thêm vào dự án mới',
                                "{$actorName} đã thêm bạn vào danh sách thành viên dự án \"{$project['name']}\".",
                                'project_roster',
                                "/projects?id={$projectId}"
                            );
                        }
                        $addedNames[] = $rawName;
                    }
                }
            }

            if (!empty($args['member_names_to_remove'])) {
                foreach (explode(',', (string)$args['member_names_to_remove']) as $rawName) {
                    $rawName = trim($rawName);
                    if ($rawName === '') continue;
                    $mUid = self::resolveSingleUserId($db, $tid, $rawName);
                    if ($mUid > 0) {
                        $db->prepare("DELETE FROM project_roster WHERE project_id = ? AND user_id = ?")->execute([$projectId, $mUid]);
                        $removedNames[] = $rawName;
                    }
                }
            }

            return [
                'success' => true,
                'action' => 'manage_roster',
                'project_id' => $projectId,
                'added' => $addedNames,
                'removed' => $removedNames,
                'url' => "/projects?id={$projectId}",
                'summary' => "Đã cập nhật thành viên dự án \"{$project['name']}\""
                    . (!empty($addedNames) ? " (Thêm: " . implode(', ', $addedNames) . ")" : "")
                    . (!empty($removedNames) ? " (Gỡ: " . implode(', ', $removedNames) . ")" : "") . "."
            ];
        }

        // 5. ADD PROJECT COMMENT
        if ($action === 'add_comment') {
            $commentBody = trim((string)($args['comment_body'] ?? ''));
            if ($commentBody === '') {
                return ['success' => false, 'message' => 'Vui lòng cung cấp nội dung bình luận dự án (comment_body).'];
            }
            $stmtIns = $db->prepare("
                INSERT INTO comments (tenant_id, entity_type, entity_id, user_id, body, created_at)
                VALUES (?, 'project', ?, ?, ?, NOW())
            ");
            $stmtIns->execute([$tid, $projectId, $uid, $commentBody]);
            $commentId = (int)$db->lastInsertId();

            return [
                'success' => true,
                'action' => 'add_comment',
                'project_id' => $projectId,
                'comment_id' => $commentId,
                'url' => "/projects?id={$projectId}",
                'summary' => "Đã thêm bình luận vào dự án \"{$project['name']}\" (#{$projectId})."
            ];
        }

        return ['success' => false, 'message' => "Hành động '{$action}' không hợp lệ trong query_and_manage_projects."];
    }

    // =========================================================================
    // INTERNAL HELPER METHODS (RBAC, SUBTASKS, APPROVALS, DEPENDENCIES, PARSERS)
    // =========================================================================

    private static function handleManageTaskGroups(PDO $db, array $args, int $tid, int $uid, bool $isAdmin): array {
        $groupId = !empty($args['task_group_id']) ? (int)$args['task_group_id'] : 0;
        $groupName = trim((string)($args['task_group_name'] ?? ($args['subject'] ?? '')));
        $color = trim((string)($args['group_color'] ?? '#BD1D2D'));
        $icon = trim((string)($args['group_icon'] ?? 'Folder'));
        $isPinned = !empty($args['is_pinned']) ? 1 : 0;
        $isShared = !empty($args['is_shared']) ? 1 : 0;

        if ($groupId > 0) {
            $stmtChk = $db->prepare("SELECT * FROM task_groups WHERE id = ? AND tenant_id = ? LIMIT 1");
            $stmtChk->execute([$groupId, $tid]);
            $grp = $stmtChk->fetch(PDO::FETCH_ASSOC);
            if (!$grp) {
                return ['success' => false, 'message' => "Không tìm thấy nhóm công việc ID #{$groupId}."];
            }
            if ((int)$grp['user_id'] !== $uid && !$isAdmin) {
                return ['success' => false, 'message' => "Bạn không có quyền chỉnh sửa nhóm công việc #{$groupId}."];
            }

            $updates = [];
            $params = [];
            if ($groupName !== '') {
                $updates[] = "name = ?";
                $params[] = $groupName;
            }
            if (!empty($args['group_color'])) {
                $updates[] = "color = ?";
                $params[] = $color;
            }
            if (!empty($args['group_icon'])) {
                $updates[] = "icon = ?";
                $params[] = $icon;
            }
            if (isset($args['is_pinned'])) {
                $updates[] = "is_pinned = ?";
                $params[] = $isPinned;
            }
            if (isset($args['is_shared'])) {
                $updates[] = "is_shared = ?";
                $params[] = $isShared;
            }
            if (!empty($updates)) {
                $updates[] = "updated_at = NOW()";
                $params[] = $groupId;
                $params[] = $tid;
                try {
                    $db->prepare("UPDATE task_groups SET " . implode(', ', $updates) . " WHERE id = ? AND tenant_id = ?")
                       ->execute($params);
                } catch (\Throwable $e) {
                    // Fallback if is_shared column is absent on legacy instance
                    $db->prepare("UPDATE task_groups SET name = ?, color = ?, icon = ?, is_pinned = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?")
                       ->execute([$groupName ?: $grp['name'], $color, $icon, $isPinned, $groupId, $tid]);
                }
            }
            return [
                'success' => true,
                'action' => 'manage_task_groups',
                'task_group_id' => $groupId,
                'name' => $groupName ?: $grp['name'],
                'summary' => "Đã cập nhật nhóm công việc #{$groupId}."
            ];
        }

        if ($groupName !== '') {
            try {
                $stmtIns = $db->prepare("
                    INSERT INTO task_groups (tenant_id, user_id, name, color, icon, order_index, is_pinned, is_shared, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, 0, ?, ?, NOW(), NOW())
                ");
                $stmtIns->execute([$tid, $uid, $groupName, $color, $icon, $isPinned, $isShared]);
            } catch (\Throwable $e) {
                $stmtIns = $db->prepare("
                    INSERT INTO task_groups (tenant_id, user_id, name, color, icon, order_index, is_pinned, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, 0, ?, NOW(), NOW())
                ");
                $stmtIns->execute([$tid, $uid, $groupName, $color, $icon, $isPinned]);
            }
            $newGroupId = (int)$db->lastInsertId();
            return [
                'success' => true,
                'action' => 'manage_task_groups',
                'task_group_id' => $newGroupId,
                'name' => $groupName,
                'summary' => "Đã tạo nhóm công việc mới \"{$groupName}\" (#{$newGroupId})."
            ];
        }

        // Otherwise list task groups of current user
        $stmtList = $db->prepare("
            SELECT tg.id, tg.name, tg.color, tg.icon, tg.is_pinned,
                   COUNT(a.id) as total_tasks,
                   COALESCE(SUM(CASE WHEN a.status IN ('done', 'completed') OR COALESCE(a.progress, 0) >= 100 THEN 1 ELSE 0 END), 0) as completed_tasks
            FROM task_groups tg
            LEFT JOIN activities a ON a.task_group_id = tg.id AND a.deleted_at IS NULL
            WHERE tg.tenant_id = ? AND (tg.user_id = ? OR COALESCE(tg.is_shared, 0) = 1)
            GROUP BY tg.id
            ORDER BY tg.is_pinned DESC, tg.order_index ASC, tg.id ASC
        ");
        $stmtList->execute([$tid, $uid]);
        $groups = $stmtList->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return [
            'success' => true,
            'action' => 'manage_task_groups',
            'groups' => $groups,
            'summary' => 'Danh sách ' . count($groups) . ' nhóm công việc của bạn.'
        ];
    }

    private static function handleSubtaskOperations(
        PDO $db,
        array $task,
        array $args,
        array $auth,
        string $action,
        int $tid,
        int $uid,
        bool $isAdminOrMgr,
        string $actorName
    ): array {
        $taskId = (int)$task['id'];
        $taskUrl = "/workspace?task_id={$taskId}";
        $bodyData = self::decodeTaskBody($task['body'] ?? null);
        $checklist = $bodyData['erp_task']['checklist'] ?? [];

        if ($action === 'add_subtasks') {
            $newSubtasks = $args['subtasks'] ?? [];
            if (empty($newSubtasks) && !empty($args['subtask_keyword'])) {
                $newSubtasks = [['title' => (string)$args['subtask_keyword']]];
            }
            if (empty($newSubtasks) || !is_array($newSubtasks)) {
                return ['success' => false, 'message' => 'Vui lòng cung cấp danh sách subtasks cần thêm.'];
            }

            $addedCount = 0;
            $maxSubDue = null;
            foreach ($newSubtasks as $idx => $sub) {
                $subTitle = is_array($sub) ? trim((string)($sub['title'] ?? ($sub['text'] ?? ''))) : trim((string)$sub);
                if ($subTitle === '') continue;

                $subAssigneeId = null;
                if (is_array($sub)) {
                    if (!empty($sub['assignee_id'])) {
                        $subAssigneeId = (int)$sub['assignee_id'];
                    } elseif (!empty($sub['assignee_name'])) {
                        $subAssigneeId = self::resolveSingleUserId($db, $tid, (string)$sub['assignee_name']) ?: null;
                    }
                }
                $subDue = (is_array($sub) && !empty($sub['due_date'])) ? substr(trim((string)$sub['due_date']), 0, 10) : null;
                if ($subDue && (!$maxSubDue || $subDue > $maxSubDue)) {
                    $maxSubDue = $subDue;
                }
                $subDone = is_array($sub) && (!empty($sub['done']) || !empty($sub['checked']));
                $subId = (is_array($sub) && !empty($sub['subtask_id']))
                    ? (string)$sub['subtask_id']
                    : ('chk_' . time() . '_' . (count($checklist) + $idx + 1) . '_' . mt_rand(100, 999));

                $checklist[] = [
                    'id' => $subId,
                    'title' => $subTitle,
                    'text' => $subTitle,
                    'done' => $subDone,
                    'checked' => $subDone,
                    'assignee_id' => $subAssigneeId ? (string)$subAssigneeId : null,
                    'due_date' => $subDue
                ];
                $addedCount++;

                if ($subAssigneeId && $subAssigneeId !== $uid) {
                    self::insertNotification(
                        $db,
                        $tid,
                        $subAssigneeId,
                        'Bạn được giao công việc con mới',
                        "{$actorName} đã giao việc con \"{$subTitle}\" cho bạn trong nhiệm vụ \"{$task['subject']}\".",
                        'task_assignment',
                        "{$taskUrl}&subtask_id={$subId}"
                    );
                }
            }

            if ($addedCount === 0) {
                return ['success' => false, 'message' => 'Không có subtask hợp lệ nào để thêm.'];
            }
        } elseif ($action === 'toggle_subtask' || $action === 'update_subtask') {
            $completeAll = !empty($args['complete_all']);
            $keyword = trim((string)($args['subtask_keyword'] ?? ($args['subtask_id'] ?? '')));

            if ($completeAll) {
                foreach ($checklist as &$item) {
                    $item['done'] = true;
                    $item['checked'] = true;
                }
                unset($item);
            } elseif (!empty($args['subtasks']) && is_array($args['subtasks'])) {
                foreach ($args['subtasks'] as $subUpd) {
                    if (!is_array($subUpd)) continue;
                    $targetKey = trim((string)($subUpd['subtask_id'] ?? ($subUpd['title'] ?? '')));
                    foreach ($checklist as &$item) {
                        $itemText = trim((string)($item['title'] ?? ($item['text'] ?? '')));
                        if (($targetKey !== '' && ($item['id'] ?? '') === $targetKey) || ($targetKey !== '' && stripos($itemText, $targetKey) !== false)) {
                            if (isset($subUpd['title']) && trim((string)$subUpd['title']) !== '') {
                                $item['title'] = trim((string)$subUpd['title']);
                                $item['text'] = trim((string)$subUpd['title']);
                            }
                            if (isset($subUpd['done'])) {
                                $item['done'] = (bool)$subUpd['done'];
                                $item['checked'] = (bool)$subUpd['done'];
                            }
                            if (!empty($subUpd['due_date'])) {
                                $item['due_date'] = substr(trim((string)$subUpd['due_date']), 0, 10);
                            }
                            if (!empty($subUpd['assignee_name'])) {
                                $rUid = self::resolveSingleUserId($db, $tid, (string)$subUpd['assignee_name']);
                                if ($rUid > 0) {
                                    $item['assignee_id'] = (string)$rUid;
                                }
                            }
                            break;
                        }
                    }
                    unset($item);
                }
            } elseif ($keyword !== '') {
                $matched = false;
                $targetIdx = is_numeric($keyword) ? ((int)$keyword - 1) : -1;
                foreach ($checklist as $idx => &$item) {
                    $itemText = trim((string)($item['title'] ?? ($item['text'] ?? '')));
                    $itemId = (string)($item['id'] ?? '');
                    if (($itemId !== '' && $itemId === $keyword) || ($targetIdx >= 0 && $idx === $targetIdx) || ($targetIdx < 0 && stripos($itemText, $keyword) !== false)) {
                        $nextDone = isset($args['status']) ? ($args['status'] === 'done') : (empty($item['done']) && empty($item['checked']));
                        $item['done'] = $nextDone;
                        $item['checked'] = $nextDone;
                        $matched = true;
                        break;
                    }
                }
                unset($item);
                if (!$matched) {
                    return ['success' => false, 'message' => "Không tìm thấy subtask nào khớp với '{$keyword}' trong công việc #{$taskId}."];
                }
            } else {
                return ['success' => false, 'message' => 'Vui lòng cung cấp subtask_keyword, subtask_id hoặc complete_all.'];
            }
        } elseif ($action === 'delete_subtask') {
            $keyword = trim((string)($args['subtask_keyword'] ?? ($args['subtask_id'] ?? '')));
            if ($keyword === '') {
                return ['success' => false, 'message' => 'Vui lòng cung cấp subtask_keyword hoặc subtask_id cần xóa.'];
            }
            $targetIdx = is_numeric($keyword) ? ((int)$keyword - 1) : -1;
            $newList = [];
            $deleted = false;
            foreach ($checklist as $idx => $item) {
                $itemText = trim((string)($item['title'] ?? ($item['text'] ?? '')));
                $itemId = (string)($item['id'] ?? '');
                if (!$deleted && (($itemId !== '' && $itemId === $keyword) || ($targetIdx >= 0 && $idx === $targetIdx) || ($targetIdx < 0 && stripos($itemText, $keyword) !== false))) {
                    $deleted = true;
                    continue;
                }
                $newList[] = $item;
            }
            if (!$deleted) {
                return ['success' => false, 'message' => "Không tìm thấy subtask nào khớp với '{$keyword}' để xóa."];
            }
            $checklist = $newList;
        }

        // Recalculate progress & apply approval state machine
        $bodyData['erp_task']['checklist'] = $checklist;
        $newBodyJson = json_encode($bodyData, JSON_UNESCAPED_UNICODE);

        $totalChk = count($checklist);
        $doneChk = count(array_filter($checklist, fn($it) => !empty($it['done']) || !empty($it['checked'])));
        $newProgress = $totalChk > 0 ? (int)round(($doneChk / $totalChk) * 100) : (int)($task['progress'] ?? 0);

        $reqApproval = (int)($task['require_approval'] ?? 0);
        $approverId = (int)($task['approver_id'] ?? 0);
        $isCallerApprover = ($approverId > 0 && $approverId === $uid) || $isAdminOrMgr;

        $newStatus = (string)($task['status'] ?? 'planned');
        $newApprovalStatus = $task['approval_status'] ?? null;
        $newDoneAt = $task['done_at'] ?? null;

        if ($newProgress >= 100) {
            $newProgress = 100;
            if ($reqApproval === 1 && !$isCallerApprover && $newApprovalStatus !== 'approved') {
                $newStatus = 'in_progress';
                $newApprovalStatus = 'pending';
                $newDoneAt = null;
                if ($approverId > 0 && $approverId !== $uid) {
                    self::insertNotification(
                        $db,
                        $tid,
                        $approverId,
                        'Yêu cầu phê duyệt hoàn thành công việc',
                        "{$actorName} đã hoàn thành 100% checklist của công việc \"{$task['subject']}\" và đang chờ bạn phê duyệt.",
                        'approval_request',
                        $taskUrl
                    );
                }
            } else {
                $newStatus = 'done';
                if ($reqApproval === 1) {
                    $newApprovalStatus = 'approved';
                }
                $newDoneAt = $newDoneAt ?: date('Y-m-d H:i:s');
            }
        } elseif ($newProgress < 100 && $newStatus === 'done') {
            $newStatus = 'in_progress';
            $newDoneAt = null;
        }

        $db->prepare("
            UPDATE activities
            SET body = ?, progress = ?, status = ?, approval_status = ?, done_at = ?, updated_at = NOW()
            WHERE id = ? AND tenant_id = ?
        ")->execute([$newBodyJson, $newProgress, $newStatus, $newApprovalStatus, $newDoneAt, $taskId, $tid]);

        $smartCard = AgentToolRegistry::buildEntitySmartCard('task', [
            'id' => $taskId,
            'title' => $task['subject'],
            'subtitle' => "Checklist: {$doneChk}/{$totalChk} hoàn thành ({$newProgress}%)",
            'status' => $newStatus,
            'direct_url' => $taskUrl,
            'action_label' => 'Mở công việc'
        ]);

        return [
            'success' => true,
            'action' => $action,
            'task_id' => $taskId,
            'subject' => $task['subject'],
            'status' => $newStatus,
            'progress' => $newProgress,
            'approval_status' => $newApprovalStatus,
            'checklist_summary' => "{$doneChk}/{$totalChk} mục hoàn thành",
            'url' => $taskUrl,
            'smart_card' => $smartCard,
            'summary' => "Đã cập nhật checklist cho công việc #{$taskId} (\"{$task['subject']}\"): {$doneChk}/{$totalChk} mục hoàn thành ({$newProgress}%)."
        ];
    }

    private static function handleTaskApprovalWorkflow(
        PDO $db,
        array $task,
        array $args,
        array $auth,
        string $action,
        int $tid,
        int $uid,
        bool $isAdminOrMgr,
        string $actorName
    ): array {
        $taskId = (int)$task['id'];
        $taskUrl = "/workspace?task_id={$taskId}";
        $approverId = (int)($task['approver_id'] ?? 0);
        $isApprover = ($approverId > 0 && $approverId === $uid) || $isAdminOrMgr;
        $feedbackNote = trim((string)($args['feedback_note'] ?? ($args['comment_content'] ?? '')));

        if ($action === 'request_approval') {
            $newApproverId = !empty($args['approver_id']) ? (int)$args['approver_id'] : $approverId;
            if (!empty($args['approver_name'])) {
                $rAppId = self::resolveSingleUserId($db, $tid, (string)$args['approver_name']);
                if ($rAppId > 0) {
                    $newApproverId = $rAppId;
                }
            }
            $db->prepare("
                UPDATE activities
                SET require_approval = 1, approver_id = ?, progress = 100, status = 'in_progress', approval_status = 'pending', done_at = NULL, updated_at = NOW()
                WHERE id = ? AND tenant_id = ?
            ")->execute([$newApproverId ?: null, $taskId, $tid]);

            if ($newApproverId > 0 && $newApproverId !== $uid) {
                self::insertNotification(
                    $db,
                    $tid,
                    $newApproverId,
                    'Yêu cầu phê duyệt hoàn thành công việc',
                    "{$actorName} đã gửi yêu cầu phê duyệt công việc \"{$task['subject']}\".",
                    'approval_request',
                    $taskUrl
                );
            }

            $smartCard = AgentToolRegistry::buildEntitySmartCard('task', [
                'id' => $taskId,
                'title' => $task['subject'],
                'subtitle' => 'Đang chờ phê duyệt (100%)',
                'status' => 'in_progress',
                'direct_url' => $taskUrl,
                'action_label' => 'Mở công việc'
            ]);

            return [
                'success' => true,
                'action' => 'request_approval',
                'task_id' => $taskId,
                'status' => 'in_progress',
                'progress' => 100,
                'approval_status' => 'pending',
                'approver_id' => $newApproverId,
                'url' => $taskUrl,
                'smart_card' => $smartCard,
                'summary' => "Đã gửi yêu cầu phê duyệt hoàn thành cho công việc #{$taskId} (\"{$task['subject']}\")."
            ];
        }

        if (!$isApprover) {
            return ['success' => false, 'message' => "Bạn không có quyền phê duyệt hoặc từ chối công việc #{$taskId} (chỉ Người duyệt được chỉ định hoặc Quản lý/Admin mới có quyền)."];
        }

        if ($action === 'approve_task') {
            $db->prepare("
                UPDATE activities
                SET status = 'done', progress = 100, approval_status = 'approved', done_at = COALESCE(done_at, NOW()), updated_at = NOW()
                WHERE id = ? AND tenant_id = ?
            ")->execute([$taskId, $tid]);

            if ($feedbackNote !== '') {
                $db->prepare("INSERT INTO activity_comments (tenant_id, activity_id, user_id, content, created_at) VALUES (?, ?, ?, ?, NOW())")
                   ->execute([$tid, $taskId, $uid, "[Phê duyệt hoàn thành]: " . $feedbackNote]);
            }

            $assigneeId = (int)($task['user_id'] ?? 0);
            if ($assigneeId > 0 && $assigneeId !== $uid) {
                self::insertNotification(
                    $db,
                    $tid,
                    $assigneeId,
                    'Nhiệm vụ được phê duyệt hoàn thành',
                    "Công việc \"{$task['subject']}\" của bạn đã được phê duyệt hoàn thành bởi {$actorName}.",
                    'approval_status',
                    $taskUrl
                );
            }

            $smartCard = AgentToolRegistry::buildEntitySmartCard('task', [
                'id' => $taskId,
                'title' => $task['subject'],
                'subtitle' => "Đã phê duyệt hoàn thành bởi {$actorName}",
                'status' => 'done',
                'direct_url' => $taskUrl,
                'action_label' => 'Mở công việc'
            ]);

            return [
                'success' => true,
                'action' => 'approve_task',
                'task_id' => $taskId,
                'status' => 'done',
                'progress' => 100,
                'approval_status' => 'approved',
                'url' => $taskUrl,
                'smart_card' => $smartCard,
                'summary' => "Đã phê duyệt hoàn thành công việc #{$taskId} (\"{$task['subject']}\")."
            ];
        }

        // reject_task
        $nextProgress = isset($args['progress']) ? max(0, min(99, (int)$args['progress'])) : min(90, (int)($task['progress'] ?? 80));
        $db->prepare("
            UPDATE activities
            SET status = 'in_progress', progress = ?, approval_status = 'rejected', done_at = NULL, updated_at = NOW()
            WHERE id = ? AND tenant_id = ?
        ")->execute([$nextProgress, $taskId, $tid]);

        if ($feedbackNote !== '') {
            $db->prepare("INSERT INTO activity_comments (tenant_id, activity_id, user_id, content, created_at) VALUES (?, ?, ?, ?, NOW())")
               ->execute([$tid, $taskId, $uid, "[Từ chối phê duyệt]: " . $feedbackNote]);
        }

        $assigneeId = (int)($task['user_id'] ?? 0);
        if ($assigneeId > 0 && $assigneeId !== $uid) {
            self::insertNotification(
                $db,
                $tid,
                $assigneeId,
                'Yêu cầu hoàn thành nhiệm vụ bị từ chối',
                "Yêu cầu duyệt công việc \"{$task['subject']}\" đã bị từ chối bởi {$actorName}" . ($feedbackNote !== '' ? ": {$feedbackNote}" : "."),
                'approval_status',
                $taskUrl
            );
        }

        $smartCard = AgentToolRegistry::buildEntitySmartCard('task', [
            'id' => $taskId,
            'title' => $task['subject'],
            'subtitle' => "Từ chối duyệt • Tiến độ: {$nextProgress}%",
            'status' => 'in_progress',
            'direct_url' => $taskUrl,
            'action_label' => 'Mở công việc'
        ]);

        return [
            'success' => true,
            'action' => 'reject_task',
            'task_id' => $taskId,
            'status' => 'in_progress',
            'progress' => $nextProgress,
            'approval_status' => 'rejected',
            'url' => $taskUrl,
            'smart_card' => $smartCard,
            'summary' => "Đã từ chối phê duyệt công việc #{$taskId} (\"{$task['subject']}\") và chuyển về trạng thái Đang thực hiện ({$nextProgress}%)."
        ];
    }

    private static function handleUpdateTask(
        PDO $db,
        array $task,
        array $args,
        array $auth,
        int $tid,
        int $uid,
        bool $isAdminOrMgr,
        string $actorName
    ): array {
        $taskId = (int)$task['id'];
        $taskUrl = "/workspace?task_id={$taskId}";
        $sets = [];
        $params = [];

        if (!empty($args['subject'])) {
            $newSubj = self::sanitizeSubject((string)$args['subject']);
            if ($newSubj !== '') {
                $sets[] = "subject = ?";
                $params[] = $newSubj;
                $task['subject'] = $newSubj;
            }
        }

        if (!empty($args['type']) && in_array($args['type'], ['task', 'meeting', 'call', 'note', 'email'], true)) {
            $sets[] = "type = ?";
            $params[] = $args['type'];
        }

        if (!empty($args['priority']) && in_array($args['priority'], ['low', 'medium', 'high', 'urgent'], true)) {
            $sets[] = "priority = ?";
            $params[] = $args['priority'];
        }

        // Assignee update
        $newAssigneeId = !empty($args['user_id']) ? (int)$args['user_id'] : 0;
        if (!$newAssigneeId && !empty($args['assignee_name'])) {
            $newAssigneeId = self::resolveSingleUserId($db, $tid, (string)$args['assignee_name']);
        }
        if ($newAssigneeId > 0 && $newAssigneeId !== (int)$task['user_id']) {
            $sets[] = "user_id = ?";
            $params[] = $newAssigneeId;
            $db->prepare("DELETE FROM task_hidden_users WHERE task_id = ? AND user_id = ?")->execute([$taskId, $newAssigneeId]);
            if ($newAssigneeId !== $uid) {
                self::insertNotification(
                    $db,
                    $tid,
                    $newAssigneeId,
                    'Bạn có nhiệm vụ được chuyển giao',
                    "Nhiệm vụ \"{$task['subject']}\" đã được chuyển giao cho bạn bởi {$actorName}.",
                    'task_assignment',
                    $taskUrl
                );
            }
        }

        // Collaborators update
        if (isset($args['participant_ids']) || !empty($args['collaborator_names'])) {
            $pids = isset($args['participant_ids'])
                ? self::parseUserIds($args['participant_ids'])
                : self::parseUserIds($task['participant_ids'] ?? '');
            if (!empty($args['collaborator_names'])) {
                foreach (explode(',', (string)$args['collaborator_names']) as $cName) {
                    $cName = trim($cName);
                    if ($cName !== '') {
                        $cUid = self::resolveSingleUserId($db, $tid, $cName);
                        if ($cUid > 0 && !in_array($cUid, $pids, true)) {
                            $pids[] = $cUid;
                        }
                    }
                }
            }
            $sets[] = "participant_ids = ?";
            $params[] = !empty($pids) ? implode(',', $pids) : null;
        }

        // Task Group update
        if (isset($args['task_group_id']) || !empty($args['task_group_name'])) {
            $tgId = !empty($args['task_group_id']) ? (int)$args['task_group_id'] : null;
            if (!$tgId && !empty($args['task_group_name'])) {
                $tgId = self::resolveOrCreateTaskGroup($db, $tid, $uid, (string)$args['task_group_name']);
            }
            $sets[] = "task_group_id = ?";
            $params[] = $tgId;
        }

        // Dates update
        if (!empty($args['start_date'])) {
            $sets[] = "start_date = ?";
            $params[] = self::normalizeDateTime((string)$args['start_date'], '08:00:00');
        }
        $newDueDate = null;
        if (!empty($args['due_date'])) {
            $newDueDate = self::normalizeDueDate((string)$args['due_date']);
            $sets[] = "due_date = ?";
            $params[] = $newDueDate;
        }

        // Related entity update
        if (!empty($args['related_type']) || !empty($args['related_id']) || !empty($args['related_name']) || !empty($args['contact_id'])) {
            [$relType, $relId, $contactId, $extraTag] = self::resolveRelatedEntity(
                $db,
                $tid,
                $args['related_type'] ?? ($task['related_type'] ?? null),
                isset($args['related_id']) ? (int)$args['related_id'] : (isset($task['related_id']) ? (int)$task['related_id'] : null),
                $args['related_name'] ?? null,
                isset($args['contact_id']) ? (int)$args['contact_id'] : (isset($task['contact_id']) ? (int)$task['contact_id'] : null)
            );
            $sets[] = "related_type = ?";
            $params[] = $relType;
            $sets[] = "related_id = ?";
            $params[] = $relId;
            $sets[] = "contact_id = ?";
            $params[] = $contactId;
            if ($extraTag !== '' && empty($args['tags'])) {
                $args['tags'] = trim(($task['tags'] ?? '') . ', ' . $extraTag, ', ');
            }
        }

        if (isset($args['tags'])) {
            $sets[] = "tags = ?";
            $params[] = trim((string)$args['tags']) !== '' ? trim((string)$args['tags']) : null;
        }
        if (isset($args['link'])) {
            $sets[] = "link = ?";
            $params[] = trim((string)$args['link']) !== '' ? trim((string)$args['link']) : null;
        }

        // Description / Subtasks update in JSON body
        if (isset($args['description']) || (!empty($args['subtasks']) && is_array($args['subtasks']))) {
            $bodyData = self::decodeTaskBody($task['body'] ?? null);
            if (isset($args['description'])) {
                $bodyData['erp_task']['description'] = trim((string)$args['description']);
            }
            if (!empty($args['subtasks']) && is_array($args['subtasks'])) {
                foreach ($args['subtasks'] as $idx => $sub) {
                    if (!is_array($sub)) continue;
                    $subTitle = trim((string)($sub['title'] ?? ($sub['text'] ?? '')));
                    if ($subTitle === '') continue;
                    $subAssigneeId = !empty($sub['assignee_id']) ? (int)$sub['assignee_id'] : null;
                    if (!$subAssigneeId && !empty($sub['assignee_name'])) {
                        $subAssigneeId = self::resolveSingleUserId($db, $tid, (string)$sub['assignee_name']) ?: null;
                    }
                    $subDone = !empty($sub['done']) || !empty($sub['checked']);
                    $bodyData['erp_task']['checklist'][] = [
                        'id' => !empty($sub['subtask_id']) ? (string)$sub['subtask_id'] : ('chk_' . time() . '_' . ($idx + 1) . '_' . mt_rand(100, 999)),
                        'title' => $subTitle,
                        'text' => $subTitle,
                        'done' => $subDone,
                        'checked' => $subDone,
                        'assignee_id' => $subAssigneeId ? (string)$subAssigneeId : null,
                        'due_date' => !empty($sub['due_date']) ? substr(trim((string)$sub['due_date']), 0, 10) : null
                    ];
                }
            }
            $sets[] = "body = ?";
            $params[] = json_encode($bodyData, JSON_UNESCAPED_UNICODE);
        }

        // Approval & Status / Progress state machine
        $reqApproval = isset($args['require_approval']) ? (!empty($args['require_approval']) ? 1 : 0) : (int)($task['require_approval'] ?? 0);
        $approverId = isset($args['approver_id']) ? (int)$args['approver_id'] : (int)($task['approver_id'] ?? 0);
        if (!empty($args['approver_name'])) {
            $rApp = self::resolveSingleUserId($db, $tid, (string)$args['approver_name']);
            if ($rApp > 0) {
                $approverId = $rApp;
                $reqApproval = 1;
            }
        }
        if (isset($args['require_approval']) || isset($args['approver_id']) || !empty($args['approver_name'])) {
            $sets[] = "require_approval = ?";
            $params[] = $reqApproval;
            $sets[] = "approver_id = ?";
            $params[] = $approverId > 0 ? $approverId : null;
        }

        $nextStatus = isset($args['status']) ? strtolower(trim((string)$args['status'])) : (string)($task['status'] ?? 'planned');
        $nextProgress = isset($args['progress']) ? max(0, min(100, (int)$args['progress'])) : (int)($task['progress'] ?? 0);
        $nextApprovalStatus = $args['approval_status'] ?? ($task['approval_status'] ?? null);

        if ($nextStatus === 'done' && $nextProgress < 100) {
            $nextProgress = 100;
        }

        $isCallerApprover = ($approverId > 0 && $approverId === $uid) || $isAdminOrMgr;
        $doneAt = $task['done_at'] ?? null;

        if ($nextProgress >= 100 || $nextStatus === 'done') {
            $nextProgress = 100;
            if ($reqApproval === 1 && !$isCallerApprover && $nextApprovalStatus !== 'approved') {
                // CRITICAL RBAC APPROVAL RULE: Non-approver marking a require_approval=1 task as done -> set status='in_progress', progress=100, approval_status='pending'
                $nextStatus = 'in_progress';
                $nextApprovalStatus = 'pending';
                $doneAt = null;
                if ($approverId > 0 && $approverId !== $uid) {
                    self::insertNotification(
                        $db,
                        $tid,
                        $approverId,
                        'Yêu cầu phê duyệt hoàn thành công việc',
                        "{$actorName} đã hoàn thành công việc \"{$task['subject']}\" (100%) và đang chờ bạn phê duyệt.",
                        'approval_request',
                        $taskUrl
                    );
                }
            } else {
                $nextStatus = 'done';
                if ($reqApproval === 1) {
                    $nextApprovalStatus = 'approved';
                }
                $doneAt = $doneAt ?: date('Y-m-d H:i:s');
            }
        } elseif ($nextProgress < 100 && $nextStatus === 'done') {
            $nextStatus = 'in_progress';
            $doneAt = null;
        } elseif ($nextStatus !== 'done') {
            $doneAt = null;
        }

        if (isset($args['status']) || isset($args['progress']) || isset($args['approval_status']) || isset($args['require_approval'])) {
            $sets[] = "status = ?";
            $params[] = $nextStatus;
            $sets[] = "progress = ?";
            $params[] = $nextProgress;
            $sets[] = "approval_status = ?";
            $params[] = $nextApprovalStatus;
            $sets[] = "done_at = ?";
            $params[] = $doneAt;
        }

        if (!empty($sets)) {
            $sets[] = "updated_at = NOW()";
            $params[] = $taskId;
            $params[] = $tid;
            $db->prepare("UPDATE activities SET " . implode(', ', $sets) . " WHERE id = ? AND tenant_id = ?")
               ->execute($params);
        }

        // Cascade reschedule if due_date changed
        if ($newDueDate && $newDueDate !== ($task['due_date'] ?? null) && (!isset($args['cascade_reschedule']) || !empty($args['cascade_reschedule']))) {
            $visited = [$taskId => true];
            self::cascadeReschedule($db, $tid, $taskId, $newDueDate, $visited);
        }

        // Optional comment/feedback note along with update
        $feedbackNote = trim((string)($args['feedback_note'] ?? ($args['comment_content'] ?? '')));
        if ($feedbackNote !== '') {
            $db->prepare("INSERT INTO activity_comments (tenant_id, activity_id, user_id, content, created_at) VALUES (?, ?, ?, ?, NOW())")
               ->execute([$tid, $taskId, $uid, $feedbackNote]);
        }

        $smartCard = AgentToolRegistry::buildEntitySmartCard('task', [
            'id' => $taskId,
            'title' => $task['subject'],
            'subtitle' => "Tiến độ: {$nextProgress}% • Trạng thái: {$nextStatus}" . ($nextApprovalStatus ? " ({$nextApprovalStatus})" : ""),
            'status' => $nextStatus,
            'direct_url' => $taskUrl,
            'action_label' => 'Mở công việc'
        ]);

        return [
            'success' => true,
            'action' => 'update_task',
            'task_id' => $taskId,
            'subject' => $task['subject'],
            'status' => $nextStatus,
            'progress' => $nextProgress,
            'approval_status' => $nextApprovalStatus,
            'due_date' => $newDueDate ?? ($task['due_date'] ?? null),
            'url' => $taskUrl,
            'smart_card' => $smartCard,
            'summary' => "Đã cập nhật công việc #{$taskId} (\"{$task['subject']}\"): Trạng thái [{$nextStatus}], Tiến độ [{$nextProgress}%]"
                . ($nextApprovalStatus === 'pending' ? " (Đang chờ phê duyệt)." : ".")
        ];
    }

    /**
     * Resolve target task by `task_id` or `task_title` with strict Zero-Trust RBAC & personal_task isolation
     */
    private static function resolveTargetTaskWithRbac(PDO $db, int $tid, int $uid, array $auth, array $args): array {
        $role = strtolower(trim((string)($auth['role'] ?? 'user')));
        $isAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'general_director', 'sale_director', 'ceo'], true);
        $isManager = in_array($role, ['manager', 'truong_phong', 'leader', 'team_lead'], true);

        $taskId = (int)($args['task_id'] ?? 0);
        $taskTitle = trim((string)($args['task_title'] ?? ($args['subject'] ?? '')));

        if ($taskId <= 0 && $taskTitle === '') {
            return ['success' => false, 'message' => 'Vui lòng cung cấp mã ID công việc (task_id) hoặc tên công việc (task_title).'];
        }

        if ($taskId > 0) {
            $stmt = $db->prepare("SELECT * FROM activities WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1");
            $stmt->execute([$taskId, $tid]);
            $task = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$task) {
                return ['success' => false, 'message' => "Không tìm thấy công việc ID #{$taskId}."];
            }
        } else {
            // Fuzzy lookup by task_title respecting personal_task isolation
            $stmt = $db->prepare("
                SELECT * FROM activities
                WHERE tenant_id = ? AND deleted_at IS NULL
                  AND (NOT (IFNULL(tags, '') LIKE '%personal_task%' OR IFNULL(tags, '') LIKE '%ca_nhan%') OR user_id = ? OR created_by = ?)
                  AND subject LIKE ?
                ORDER BY
                  CASE WHEN LOWER(subject) = LOWER(?) THEN 0 WHEN user_id = ? THEN 1 ELSE 2 END ASC,
                  id DESC
                LIMIT 1
            ");
            $stmt->execute([$tid, $uid, $uid, '%' . $taskTitle . '%', $taskTitle, $uid]);
            $task = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$task) {
                return ['success' => false, 'message' => "Không tìm thấy công việc nào khớp với '{$taskTitle}'."];
            }
        }

        // Strict Personal Task Isolation: NEVER allow accessing another user's personal_task
        $tagsStr = strtolower((string)($task['tags'] ?? ''));
        $isPersonal = str_contains($tagsStr, 'personal_task') || str_contains($tagsStr, 'ca_nhan');
        if ($isPersonal && (int)$task['user_id'] !== $uid && (int)$task['created_by'] !== $uid) {
            return ['success' => false, 'message' => 'Đây là công việc cá nhân riêng tư của người khác, bạn không có quyền truy cập.'];
        }

        // RBAC check: user_id, created_by, approver_id, collaborator in participant_ids, or Admin/Director/Manager
        $pids = self::parseUserIds($task['participant_ids'] ?? '');
        $isParticipant = (int)$task['user_id'] === $uid
            || (int)$task['created_by'] === $uid
            || (int)($task['approver_id'] ?? 0) === $uid
            || in_array($uid, $pids, true);

        if (!$isParticipant && !$isAdmin) {
            if ($isManager) {
                // Check if task assignee or creator belongs to manager's team
                $stmtTeam = $db->prepare("
                    SELECT 1 FROM users
                    WHERE id IN (?, ?)
                      AND team_id IN (
                          SELECT id FROM teams WHERE leader_id = ? OR FIND_IN_SET(?, COALESCE(co_leader_ids, '')) > 0
                      )
                    LIMIT 1
                ");
                $stmtTeam->execute([(int)$task['user_id'], (int)$task['created_by'], $uid, (string)$uid]);
                if (!$stmtTeam->fetchColumn()) {
                    return ['success' => false, 'message' => "Bạn không có quyền thao tác trên công việc #{$task['id']}."];
                }
            } else {
                return ['success' => false, 'message' => "Bạn không có quyền thao tác trên công việc #{$task['id']}."];
            }
        }

        return ['success' => true, 'task' => $task];
    }

    private static function findUserIdsByFuzzyName(PDO $db, int $tid, string $nameQuery): array {
        $params = [$tid];
        $fuzzyClause = AgentToolRegistry::buildVietnameseFuzzyNameWhere('full_name', $nameQuery, $params);
        $stmt = $db->prepare("SELECT id, full_name FROM users WHERE tenant_id = ? AND {$fuzzyClause} LIMIT 10");
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        return array_values(array_map(fn($r) => (int)$r['id'], $rows));
    }

    private static function resolveSingleUserId(PDO $db, int $tid, string $nameQuery): int {
        $nameQuery = trim($nameQuery);
        if ($nameQuery === '') return 0;
        if (is_numeric($nameQuery)) return (int)$nameQuery;

        $params = [$tid];
        $fuzzyClause = AgentToolRegistry::buildVietnameseFuzzyNameWhere('full_name', $nameQuery, $params);
        $stmt = $db->prepare("SELECT id, full_name FROM users WHERE tenant_id = ? AND is_active = 1 AND {$fuzzyClause} LIMIT 10");
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        if (empty($rows)) return 0;

        $bestId = (int)$rows[0]['id'];
        $bestScore = -1;
        foreach ($rows as $r) {
            $score = AgentToolRegistry::scoreFuzzyNameMatch((string)$r['full_name'], $nameQuery);
            if ($score > $bestScore) {
                $bestScore = $score;
                $bestId = (int)$r['id'];
            }
        }
        return $bestId;
    }

    private static function resolveOrCreateTaskGroup(PDO $db, int $tid, int $uid, string $groupName): ?int {
        $groupName = trim($groupName);
        if ($groupName === '') return null;

        $stmt = $db->prepare("SELECT id FROM task_groups WHERE tenant_id = ? AND user_id = ? AND LOWER(name) = LOWER(?) LIMIT 1");
        $stmt->execute([$tid, $uid, $groupName]);
        $existingId = (int)$stmt->fetchColumn();
        if ($existingId > 0) {
            return $existingId;
        }

        $stmtIns = $db->prepare("
            INSERT INTO task_groups (tenant_id, user_id, name, color, icon, order_index, is_pinned, created_at, updated_at)
            VALUES (?, ?, ?, '#BD1D2D', 'Folder', 0, 0, NOW(), NOW())
        ");
        $stmtIns->execute([$tid, $uid, $groupName]);
        return (int)$db->lastInsertId() ?: null;
    }

    private static function resolveRelatedEntity(
        PDO $db,
        int $tid,
        ?string $relType,
        ?int $relId,
        ?string $relName,
        ?int $contactId
    ): array {
        $relType = $relType ? strtolower(trim($relType)) : null;
        $relName = $relName ? trim($relName) : '';
        $extraTag = '';

        if ($relType === 'personal') {
            return [null, null, $contactId ?: null, 'personal_task'];
        }
        if ($relType === 'lead') {
            $relType = 'contact';
        }

        if (!$relId && $relName !== '') {
            if ($relType === 'contact' || !$relType) {
                $stmtC = $db->prepare("SELECT id FROM contacts WHERE tenant_id = ? AND deleted_at IS NULL AND full_name LIKE ? ORDER BY id DESC LIMIT 1");
                $stmtC->execute([$tid, '%' . $relName . '%']);
                $cid = (int)$stmtC->fetchColumn();
                if ($cid > 0) {
                    $relType = 'contact';
                    $relId = $cid;
                    $contactId = $contactId ?: $cid;
                }
            }
            if (!$relId && ($relType === 'project' || !$relType)) {
                $stmtP = $db->prepare("SELECT id FROM projects WHERE tenant_id = ? AND (name LIKE ? OR code LIKE ?) ORDER BY id DESC LIMIT 1");
                $stmtP->execute([$tid, '%' . $relName . '%', '%' . $relName . '%']);
                $pid = (int)$stmtP->fetchColumn();
                if ($pid > 0) {
                    $relType = 'project';
                    $relId = $pid;
                }
            }
            if (!$relId && ($relType === 'deal' || !$relType)) {
                $stmtD = $db->prepare("SELECT id FROM deals WHERE tenant_id = ? AND deleted_at IS NULL AND title LIKE ? ORDER BY id DESC LIMIT 1");
                $stmtD->execute([$tid, '%' . $relName . '%']);
                $did = (int)$stmtD->fetchColumn();
                if ($did > 0) {
                    $relType = 'deal';
                    $relId = $did;
                }
            }
            if (!$relId && ($relType === 'company' || !$relType)) {
                $stmtCo = $db->prepare("SELECT id FROM companies WHERE tenant_id = ? AND deleted_at IS NULL AND name LIKE ? ORDER BY id DESC LIMIT 1");
                $stmtCo->execute([$tid, '%' . $relName . '%']);
                $coid = (int)$stmtCo->fetchColumn();
                if ($coid > 0) {
                    $relType = 'company';
                    $relId = $coid;
                }
            }
            if (!$relId && ($relType === 'team' || !$relType)) {
                $stmtTm = $db->prepare("SELECT id FROM teams WHERE name LIKE ? ORDER BY id DESC LIMIT 1");
                $stmtTm->execute(['%' . $relName . '%']);
                $tmid = (int)$stmtTm->fetchColumn();
                if ($tmid > 0) {
                    $relType = 'team';
                    $relId = $tmid;
                }
            }
        }

        if ($relType === 'contact' && $relId && !$contactId) {
            $contactId = $relId;
        }

        return [$relType ?: null, $relId ?: null, $contactId ?: null, $extraTag];
    }

    private static function decodeTaskBody(?string $rawBody): array {
        $default = [
            'erp_task' => [
                'description' => '',
                'checklist' => [],
                'links' => []
            ]
        ];
        if (empty($rawBody)) {
            return $default;
        }
        $trimmed = trim($rawBody);
        if (str_starts_with($trimmed, '{') && str_ends_with($trimmed, '}')) {
            $decoded = json_decode($trimmed, true);
            if (is_array($decoded)) {
                if (isset($decoded['erp_task']) && is_array($decoded['erp_task'])) {
                    $decoded['erp_task']['description'] = (string)($decoded['erp_task']['description'] ?? '');
                    $decoded['erp_task']['checklist'] = is_array($decoded['erp_task']['checklist'] ?? null) ? $decoded['erp_task']['checklist'] : [];
                    $decoded['erp_task']['links'] = is_array($decoded['erp_task']['links'] ?? null) ? $decoded['erp_task']['links'] : [];
                    return $decoded;
                }
                return [
                    'erp_task' => [
                        'description' => (string)($decoded['description'] ?? ''),
                        'checklist' => is_array($decoded['checklist'] ?? null) ? $decoded['checklist'] : [],
                        'links' => is_array($decoded['links'] ?? null) ? $decoded['links'] : []
                    ]
                ];
            }
        }
        $default['erp_task']['description'] = $rawBody;
        return $default;
    }

    private static function parseUserIds($raw): array {
        if (empty($raw)) return [];
        if (is_array($raw)) {
            return array_values(array_unique(array_filter(array_map('intval', $raw), fn($id) => $id > 0)));
        }
        if (is_string($raw)) {
            $raw = trim($raw);
            if (str_starts_with($raw, '[') && str_ends_with($raw, ']')) {
                $decoded = json_decode($raw, true);
                if (is_array($decoded)) {
                    return array_values(array_unique(array_filter(array_map('intval', $decoded), fn($id) => $id > 0)));
                }
            }
            return array_values(array_unique(array_filter(array_map('intval', explode(',', $raw)), fn($id) => $id > 0)));
        }
        if (is_numeric($raw)) {
            $id = (int)$raw;
            return $id > 0 ? [$id] : [];
        }
        return [];
    }

    private static function sanitizeSubject(string $subject): string {
        $clean = html_entity_decode(strip_tags($subject), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $clean = str_replace(["\xc2\xa0", "&nbsp;"], ' ', $clean);
        return trim((string)preg_replace('/\s+/', ' ', $clean));
    }

    private static function normalizeDueDate(?string $raw): ?string {
        if (empty($raw)) return null;
        $trimmed = trim($raw);
        if ($trimmed === '' || $trimmed === 'null') return null;
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $trimmed)) {
            return $trimmed . ' 23:59:59';
        }
        if (preg_match('/^(\d{4}-\d{2}-\d{2})[T ]00:00(?::00)?$/', $trimmed, $m)) {
            return $m[1] . ' 23:59:59';
        }
        $ts = strtotime($trimmed);
        return $ts !== false ? date('Y-m-d H:i:s', $ts) : $trimmed;
    }

    private static function normalizeDateTime(?string $raw, string $defaultTime = '08:00:00'): ?string {
        if (empty($raw)) return null;
        $trimmed = trim($raw);
        if ($trimmed === '' || $trimmed === 'null') return null;
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $trimmed)) {
            return $trimmed . ' ' . $defaultTime;
        }
        $ts = strtotime($trimmed);
        return $ts !== false ? date('Y-m-d H:i:s', $ts) : $trimmed;
    }

    private static function hasCircularDependency(PDO $db, int $taskId, int $predecessorId): bool {
        $visited = [];
        return self::detectCycle($db, $predecessorId, $taskId, $visited);
    }

    private static function detectCycle(PDO $db, int $currentId, int $targetId, array &$visited): bool {
        if ($currentId === $targetId) return true;
        if (isset($visited[$currentId])) return false;
        $visited[$currentId] = true;

        $stmt = $db->prepare("SELECT predecessor_id FROM activity_dependencies WHERE activity_id = ?");
        $stmt->execute([$currentId]);
        $preds = $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
        foreach ($preds as $predId) {
            if (self::detectCycle($db, (int)$predId, $targetId, $visited)) {
                return true;
            }
        }
        return false;
    }

    private static function cascadeReschedule(PDO $db, int $tid, int $taskId, string $newDueDate, array &$visited): void {
        $stmt = $db->prepare("
            SELECT d.activity_id, d.lag_days, a.start_date, a.due_date, a.user_id, a.subject
            FROM activity_dependencies d
            JOIN activities a ON d.activity_id = a.id
            WHERE d.predecessor_id = ? AND a.tenant_id = ? AND a.deleted_at IS NULL
        ");
        $stmt->execute([$taskId, $tid]);
        $deps = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        foreach ($deps as $dep) {
            $depId = (int)$dep['activity_id'];
            if (isset($visited[$depId])) continue;
            $visited[$depId] = true;

            $lagDays = (int)$dep['lag_days'];
            $startTimePart = !empty($dep['start_date']) ? date('H:i:s', strtotime((string)$dep['start_date'])) : '08:00:00';
            $dueTimePart = !empty($dep['due_date']) ? date('H:i:s', strtotime((string)$dep['due_date'])) : '17:00:00';

            $durationDays = 0;
            if (!empty($dep['start_date']) && !empty($dep['due_date'])) {
                $durationDays = max(0, (int)round((strtotime(date('Y-m-d', strtotime((string)$dep['due_date']))) - strtotime(date('Y-m-d', strtotime((string)$dep['start_date'])))) / 86400));
            }

            $newStartDateOnly = date('Y-m-d', strtotime($newDueDate) + ($lagDays * 86400));
            $newStartDate = $newStartDateOnly . ' ' . $startTimePart;
            $newDueDateOnly = date('Y-m-d', strtotime($newStartDateOnly) + ($durationDays * 86400));
            $newDueDateVal = $newDueDateOnly . ' ' . $dueTimePart;

            $db->prepare("UPDATE activities SET start_date = ?, due_date = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?")
               ->execute([$newStartDate, $newDueDateVal, $depId, $tid]);

            if (!empty($dep['user_id'])) {
                self::insertNotification(
                    $db,
                    $tid,
                    (int)$dep['user_id'],
                    'Thay đổi lịch trình công việc phụ thuộc',
                    "Công việc \"{$dep['subject']}\" đã được tự động dời lịch (Hạn mới: " . date('d/m/Y H:i', strtotime($newDueDateVal)) . ") do thay đổi từ công việc tiền nhiệm.",
                    'task_reschedule',
                    "/workspace?task_id={$depId}"
                );
            }

            self::cascadeReschedule($db, $tid, $depId, $newDueDateVal, $visited);
        }
    }

    private static function insertNotification(PDO $db, int $tid, int $targetUserId, string $title, string $body, string $type, string $link): void {
        if ($targetUserId <= 0) return;
        try {
            $stmt = $db->prepare("
                INSERT INTO notifications (user_id, tenant_id, title, body, type, link, is_read, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 0, NOW())
            ");
            $stmt->execute([$targetUserId, $tid, $title, $body, $type, $link]);
        } catch (\Throwable $e) {
            error_log("AgentTaskProjectTools notification error: " . $e->getMessage());
        }
    }

    private static function resolveTargetProject(PDO $db, int $tid, int $projectId, string $nameOrCode): ?array {
        if ($projectId > 0) {
            $stmt = $db->prepare("SELECT * FROM projects WHERE id = ? AND tenant_id = ? LIMIT 1");
            $stmt->execute([$projectId, $tid]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) return $row;
        }
        $nameOrCode = trim($nameOrCode);
        if ($nameOrCode !== '') {
            $stmt = $db->prepare("
                SELECT * FROM projects
                WHERE tenant_id = ? AND (LOWER(code) = LOWER(?) OR LOWER(name) = LOWER(?) OR name LIKE ? OR code LIKE ?)
                ORDER BY CASE WHEN LOWER(code) = LOWER(?) THEN 0 WHEN LOWER(name) = LOWER(?) THEN 1 ELSE 2 END ASC, id DESC
                LIMIT 1
            ");
            $like = '%' . $nameOrCode . '%';
            $stmt->execute([$tid, $nameOrCode, $nameOrCode, $like, $like, $nameOrCode, $nameOrCode]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) return $row;
        }
        return null;
    }

    private static function hasProjectAccess(PDO $db, array $project, int $uid, string $role, bool $isAdminOrDirector): bool {
        if ($isAdminOrDirector) return true;
        if (!empty($project['created_by']) && (int)$project['created_by'] === $uid) return true;
        if (!empty($project['manager_ids'])) {
            $mIds = self::parseUserIds($project['manager_ids']);
            if (in_array($uid, $mIds, true)) return true;
        }
        $isRosterRestricted = in_array($role, ['sale', 'sales', 'manager'], true);
        if (!$isRosterRestricted) return true;

        $stmt = $db->prepare("SELECT 1 FROM project_roster WHERE project_id = ? AND user_id = ? LIMIT 1");
        $stmt->execute([(int)$project['id'], $uid]);
        return (bool)$stmt->fetchColumn();
    }

    private static function canEditProject(PDO $db, array $project, int $uid, string $role, bool $isAdminOrDirector, bool $isManager): bool {
        if ($isAdminOrDirector) return true;
        if (!empty($project['created_by']) && (int)$project['created_by'] === $uid) return true;
        if (!empty($project['manager_ids'])) {
            $mIds = self::parseUserIds($project['manager_ids']);
            if (in_array($uid, $mIds, true)) return true;
        }
        if ($isManager) {
            $stmt = $db->prepare("SELECT 1 FROM project_roster WHERE project_id = ? AND user_id = ? LIMIT 1");
            $stmt->execute([(int)$project['id'], $uid]);
            if ($stmt->fetchColumn()) return true;
        }
        return false;
    }
}
