<?php
/**
 * AgentToolRegistry.php - Autonomous Tool Registry & Enterprise Executor for SI IDEAS
 * Powers Google Gemini Function Calling (Tools API) across all MYERP modules.
 * Enforces Zero-Trust Server-Side RBAC, Aggregation & Slice Guards against Token Explosion.
 */

class AgentToolRegistry {

    /**
     * Get OpenAPI-compliant tools schema declaration for Google Gemini API
     */
    public static function getGeminiToolsDeclaration(?array $allowedToolNames = null): array {
        $declarations = [
                    [
                        'name' => 'get_my_tasks',
                        'description' => 'Tra cứu công việc/nhiệm vụ của người dùng hiện tại trên Bàn làm việc (Workspace). Trích xuất đầy đủ thông tin: tiêu đề, mô tả chi tiết, hạn chót, tiến độ %, trạng thái, mức độ ưu tiên, người phụ trách, người giao việc, nhóm việc, checklist tóm tắt.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'filter' => [
                                    'type' => 'STRING',
                                    'enum' => ['all_pending', 'overdue', 'today', 'urgent', 'completed'],
                                    'description' => 'Bộ lọc trạng thái công việc (mặc định: all_pending)'
                                ],
                                'limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng việc cần trích xuất (mặc định 5, tối đa 20)'
                                ],
                                'search_keyword' => [
                                    'type' => 'STRING',
                                    'description' => 'Từ khóa tìm kiếm tên việc hoặc nhãn nếu có'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'get_pending_approvals',
                        'description' => 'Tra cứu danh sách các phiếu trong Quy trình & Phê duyệt (Approvals) đang chờ người dùng xử lý (phiếu chi/PO, tạm ứng, đơn nghỉ phép, giải trình công). Tự động đếm tổng hợp theo từng loại và trích xuất TOP các phiếu ưu tiên nhất.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'approval_type' => [
                                    'type' => 'STRING',
                                    'enum' => ['all', 'expense', 'advance', 'leave', 'attendance'],
                                    'description' => 'Loại phê duyệt cần xem (mặc định all)'
                                ],
                                'limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng phiếu cần lấy (mặc định 5, tối đa 10)'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'get_task_detail',
                        'description' => 'Xem chi tiết toàn diện của 1 công việc cụ thể theo mã ID hoặc tên việc (tiêu đề, toàn bộ mô tả chi tiết, danh sách checklist, người phụ trách, người tạo việc, người phối hợp, người duyệt, tiến độ %, hạn chót, liên kết đính kèm).',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'task_id' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Mã ID công việc (ví dụ 57341)'
                                ],
                                'query' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên hoặc từ khóa công việc nếu không nhớ ID'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'search_contacts',
                        'description' => 'Tra cứu thông tin học viên, khách hàng tiềm năng, đối tác trong hệ thống CRM theo số điện thoại, email, họ tên hoặc mã #ID.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'query' => [
                                    'type' => 'STRING',
                                    'description' => 'Số điện thoại, email, họ tên hoặc mã ID khách hàng'
                                ]
                            ],
                            'required' => ['query']
                        ]
                    ],
                    [
                        'name' => 'get_contact_financial_summary',
                        'description' => 'Tra cứu lịch sử tài chính, phiếu thu, đặt cọc, đóng tiền học phí và đơn bán hàng SO của một học viên/khách hàng cụ thể.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'contact_id' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Mã ID của học viên/khách hàng'
                                ],
                                'contact_query' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên hoặc SĐT học viên nếu chưa có ID'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'get_my_payment_proposals',
                        'description' => 'Xem tiến độ phê duyệt và tình trạng giải ngân của các đề xuất thanh toán chi phí hoặc tạm ứng do chính người dùng tạo.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'status' => [
                                    'type' => 'STRING',
                                    'enum' => ['all', 'pending', 'approved', 'rejected'],
                                    'description' => 'Trạng thái đề xuất chi (mặc định all)'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'get_my_attendance_summary',
                        'description' => 'Tra cứu tổng hợp tình hình chấm công cá nhân: số công trong tháng, số lần đi trễ/quên chấm công, số ngày phép năm còn lại.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'month' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Tháng cần xem (1-12, mặc định tháng hiện tại)'
                                ],
                                'year' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Năm cần xem (mặc định năm hiện tại)'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'search_ideas_knowledge',
                        'description' => 'Tra cứu tri thức cốt lõi Viện IDEAS, 12 tình huống sale thực chiến, kiểm định Swiss UMEF & ISTEC Paris, công nhận văn bằng, cẩm nang xử lý từ chối.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'topic' => [
                                    'type' => 'STRING',
                                    'description' => 'Chủ đề hoặc câu hỏi thắc mắc cần tra cứu tri thức'
                                ]
                            ],
                            'required' => ['topic']
                        ]
                    ],
                    [
                        'name' => 'get_program_details',
                        'description' => 'Tra cứu thông tin chi tiết các chương trình đào tạo quốc tế: EMBA, MBA, MSc Applied AI, DBA, Top-up BBA (thời gian, tín chỉ, học phí, điều kiện đầu vào, luận văn).',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'program_code' => [
                                    'type' => 'STRING',
                                    'enum' => ['EMBA', 'MBA', 'MSC_AI', 'DBA', 'TOPUP', 'ALL'],
                                    'description' => 'Mã chương trình đào tạo'
                                ]
                            ],
                            'required' => ['program_code']
                        ]
                    ],
                    [
                        'name' => 'get_my_payslip',
                        'description' => 'Tra cứu phiếu lương cá nhân của người dùng hiện tại (lương cơ bản, phụ cấp, thưởng KPI, các khoản khấu trừ BHXH/đi trễ/tạm ứng, thực nhận net, ngày công thực tế, trạng thái phiếu lương). Tự động lấy tháng gần nhất nếu không chỉ định tháng.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'month' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Tháng cần tra cứu (1-12, mặc định tháng hiện tại hoặc gần nhất có bảng lương)'
                                ],
                                'year' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Năm cần tra cứu (mặc định năm hiện tại)'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'get_executive_morning_brief',
                        'description' => 'Bản tin điều hành đầu ngày & tổng quan trạng thái cá nhân hóa: tổng hợp các việc khẩn cấp cần làm hôm nay, đơn từ chờ duyệt, lead nóng chưa tương tác trong 24h, công việc quá hạn và sự kiện lịch trong ngày.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'focus' => [
                                    'type' => 'STRING',
                                    'enum' => ['overview', 'approvals', 'tasks', 'crm'],
                                    'description' => 'Trọng tâm bản tin: tổng quan (overview), phê duyệt (approvals), công việc (tasks), hoặc CRM (crm).'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'get_my_crm_inbox',
                        'description' => 'Tra cứu hòm thư CRM/tiềm năng của người dùng (dành cho Tư vấn viên/Sales): Thống kê số lượng lead mới hôm nay, số lead chưa liên hệ, tổng lead đang phụ trách và danh sách TOP các tiềm năng mới nhất cần liên hệ chăm sóc.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'filter' => [
                                    'type' => 'STRING',
                                    'enum' => ['today_leads', 'uncontacted', 'all'],
                                    'description' => 'Bộ lọc tiềm năng (mặc định today_leads)'
                                ],
                                'limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng tiềm năng cần lấy (mặc định 5, tối đa 10)'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'get_active_projects_and_campaigns',
                        'description' => 'Tra cứu danh sách các chương trình đào tạo, dự án và chiến dịch marketing đang hoạt động/tuyển sinh trong hệ thống MYERP (EMBA, MBA, MSc AI, DBA, sự kiện...).',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'type' => [
                                    'type' => 'STRING',
                                    'enum' => ['all', 'projects', 'campaigns'],
                                    'description' => 'Loại tra cứu: dự án, chiến dịch hoặc tất cả (mặc định all)'
                                ],
                                'search_keyword' => [
                                    'type' => 'STRING',
                                    'description' => 'Từ khóa tìm kiếm tên dự án hoặc chiến dịch nếu có'
                                ],
                                'limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng kết quả cần lấy (mặc định 5, tối đa 10)'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'get_system_navigation',
                        'description' => 'Chỉ đường, cung cấp link điều hướng trực tiếp và hướng dẫn truy cập nhanh đến bất kỳ phân hệ/chức năng nào trong hệ thống MYERP (Bàn làm việc, Phê duyệt, Phiếu chi PO, Phiếu thu SO, Chấm công, Phiếu lương, Học viên, Khách hàng tiềm năng, Dự báo dòng tiền, Cài đặt).',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'destination' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên hoặc từ khóa tính năng cần truy cập (ví dụ: duyet chi, bang luong, ban lam viec, cham cong, tiem nang, hoc vien, dong tien)'
                                ]
                            ],
                            'required' => ['destination']
                        ]
                    ],
                    [
                        'name' => 'get_financial_overview',
                        'description' => 'Tra cứu tổng quan số liệu tài chính doanh thu, dòng tiền thu chi trong tháng (tổng thu cọc/học phí Sales Orders, tổng chi phí Purchase Orders, số phiếu đang chờ duyệt). Yêu cầu quyền Quản trị viên (Admin/Director) hoặc Kế toán.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'month' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Tháng cần xem (1-12, mặc định tháng hiện tại)'
                                ],
                                'year' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Năm cần xem (mặc định năm hiện tại)'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'draft_action_proposal',
                        'description' => 'Khởi tạo Thẻ Hành Động (Action Proposal Card) trực quan để người dùng xác nhận và lưu vào hệ thống ERP hoặc 1-Click tải file Excel/CSV xuất dữ liệu (tạo việc, tạo đơn nghỉ phép, giải trình công, đề xuất chi/tạm ứng, đặt cọc giữ chỗ, thêm lead, tạo đơn SO, báo giá, ticket CSKH hỗ trợ học viên, cơ hội deal, nhập kho, đổi ca, yêu cầu bổ sung hồ sơ học viên, đề xuất hợp đồng pháp lý, biên bản bàn giao tài sản, chiến dịch marketing, xuất dữ liệu toàn diện export_data).',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'action_type' => [
                                    'type' => 'STRING',
                                    'enum' => ['task', 'leave', 'supplementary', 'expense', 'advance_payment', 'lead', 'sales_order', 'deposit', 'ticket', 'quote', 'deal', 'inventory_receipt', 'shift_swap', 'admission_document_request', 'legal_contract', 'asset_handover', 'marketing_campaign', 'export_data'],
                                    'description' => 'Loại hành động ERP: task (công việc), leave (nghỉ phép), supplementary (bổ sung công), expense (chi phí PO), advance_payment (tạm ứng), lead (học viên mới), sales_order (đơn hàng SO chia đợt), deposit (đặt cọc giữ chỗ), ticket (ticket CSKH hỗ trợ), quote (báo giá), deal (cơ hội tuyển sinh), inventory_receipt (nhập kho), shift_swap (đổi ca/OT), admission_document_request (hồ sơ nhập học), legal_contract (hợp đồng đào tạo), asset_handover (bàn giao tài sản), marketing_campaign (chiến dịch), export_data (xuất file Excel)'
                                ],
                                'title' => [
                                    'type' => 'STRING',
                                    'description' => 'Tiêu đề ngắn gọn của thẻ hành động'
                                ],
                                'summary' => [
                                    'type' => 'STRING',
                                    'description' => 'Tóm tắt nội dung để người dùng kiểm tra nhanh'
                                ],
                                'params_json' => [
                                    'type' => 'STRING',
                                    'description' => 'Chuỗi JSON chứa các tham số điền sẵn của hành động'
                                ]
                            ],
                            'required' => ['action_type', 'title', 'summary', 'params_json']
                        ]
                    ],
                    [
                        'name' => 'approve_or_reject_erp_ticket',
                        'description' => 'Duyệt hoặc từ chối trực tiếp phiếu duyệt ERP (đơn nghỉ phép/WFH/công tác, tạm ứng lương, đề xuất chi phí PO, giải trình chấm công) nếu người dùng có thẩm quyền duyệt.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'ticket_type' => [
                                    'type' => 'STRING',
                                    'enum' => ['leave', 'salary_advance', 'expense', 'check_in'],
                                    'description' => 'Loại phiếu duyệt: leave (nghỉ phép), salary_advance (tạm ứng lương), expense (chi phí/PO), check_in (giải trình công)'
                                ],
                                'ticket_id' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Mã định danh ID của phiếu duyệt cần phê duyệt hoặc từ chối'
                                ],
                                'decision' => [
                                    'type' => 'STRING',
                                    'enum' => ['approved', 'rejected'],
                                    'description' => 'Quyết định phê duyệt: approved (duyệt), rejected (từ chối)'
                                ],
                                'reason' => [
                                    'type' => 'STRING',
                                    'description' => 'Lý do phê duyệt hoặc lý do từ chối (tùy chọn)'
                                ]
                            ],
                            'required' => ['ticket_type', 'ticket_id', 'decision']
                        ]
                    ],
                    [
                        'name' => 'update_task_progress_and_status',
                        'description' => 'Cập nhật trực tiếp tiến độ (%), trạng thái (hoàn thành/đang làm/hủy), hạn chót (deadline) hoặc ghi chú comment cho công việc/task trên Workspace.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'task_id' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Mã định danh ID công việc/task cần cập nhật'
                                ],
                                'status' => [
                                    'type' => 'STRING',
                                    'enum' => ['planned', 'in_progress', 'done', 'cancelled'],
                                    'description' => 'Trạng thái mới của task: planned (chưa làm), in_progress (đang làm), done (đã hoàn thành), cancelled (đã hủy)'
                                ],
                                'progress' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Tiến độ hoàn thành từ 0 đến 100%'
                                ],
                                'note' => [
                                    'type' => 'STRING',
                                    'description' => 'Ghi chú, báo cáo kết quả hoặc lý do cập nhật (sẽ được ghi vào bình luận công việc)'
                                ],
                                'due_date' => [
                                    'type' => 'STRING',
                                    'description' => 'Hạn chót mới (định dạng YYYY-MM-DD hoặc YYYY-MM-DD HH:MM:SS) nếu gia hạn task'
                                ]
                            ],
                            'required' => ['task_id']
                        ]
                    ],
                    [
                        'name' => 'complete_task_checklist_item',
                        'description' => 'Đánh dấu hoàn thành hoặc bỏ tích một mục trong checklist công việc (hạng mục con) của task và tự động tính lại % tiến độ tổng thể của task.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'task_id' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Mã ID công việc/task có checklist'
                                ],
                                'item_index_or_keyword' => [
                                    'type' => 'STRING',
                                    'description' => 'Thứ tự mục (1, 2, 3...) hoặc từ khóa tên hạng mục checklist cần đánh dấu'
                                ],
                                'completed' => [
                                    'type' => 'BOOLEAN',
                                    'description' => 'Trạng thái hoàn thành: true (đã xong - mặc định), false (chưa xong)'
                                ]
                            ],
                            'required' => ['task_id', 'item_index_or_keyword']
                        ]
                    ],
                    [
                        'name' => 'quick_log_crm_activity',
                        'description' => 'Ghi nhận trực tiếp tương tác CRM với học viên/khách hàng (cuộc gọi đã gọi, cuộc họp tư vấn, ghi chú chăm sóc) và tự động cập nhật thời gian liên hệ gần nhất.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'contact_id' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Mã ID của học viên/khách hàng trong CRM'
                                ],
                                'activity_type' => [
                                    'type' => 'STRING',
                                    'enum' => ['call', 'meeting', 'note', 'chat'],
                                    'description' => 'Loại tương tác: call (gọi điện thoại), meeting (hẹn gặp tư vấn), note (ghi chú chăm sóc), chat (nhắn tin)'
                                ],
                                'title' => [
                                    'type' => 'STRING',
                                    'description' => 'Tiêu đề ngắn gọn của tương tác'
                                ],
                                'notes' => [
                                    'type' => 'STRING',
                                    'description' => 'Nội dung chi tiết kết quả cuộc gọi/tư vấn/chăm sóc'
                                ],
                                'duration_minutes' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Thời lượng cuộc gọi hoặc tư vấn (phút)'
                                ],
                                'outcome' => [
                                    'type' => 'STRING',
                                    'enum' => ['connected', 'no_answer', 'busy', 'callback_requested', 'qualified', 'lost'],
                                    'description' => 'Kết quả tương tác: connected (đã nghe máy/tư vấn tốt), no_answer (không nghe máy), busy (máy bận), callback_requested (yêu cầu gọi lại sau), qualified (tiềm năng cao), lost (không có nhu cầu)'
                                ]
                            ],
                            'required' => ['contact_id', 'activity_type', 'title', 'notes']
                        ]
                    ],
                    [
                        'name' => 'reassign_lead_owner',
                        'description' => 'Bàn giao quyền phụ trách học viên/khách hàng (chuyển Lead Owner) cho chuyên viên tư vấn khác dành cho Quản lý / Sale Admin hoặc nhân sự bàn giao.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'contact_id' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Mã ID học viên/khách hàng cần bàn giao'
                                ],
                                'new_owner_id' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Mã ID nhân viên tiếp nhận mới (nếu biết rõ ID)'
                                ],
                                'new_owner_name' => [
                                    'type' => 'STRING',
                                    'description' => 'Họ tên nhân viên tiếp nhận mới để hệ thống tự tra cứu'
                                ],
                                'reassign_reason' => [
                                    'type' => 'STRING',
                                    'description' => 'Lý do bàn giao (vd: Chuyển cơ sở, chuyên viên nghỉ phép, tái phân bổ nguồn lead)'
                                ]
                            ],
                            'required' => ['contact_id']
                        ]
                    ],
                    [
                        'name' => 'get_company_staff_directory',
                        'description' => 'Tra cứu danh bạ tổ chức và nhân sự toàn công ty: Công ty có những ai, ai thuộc phòng ban/team nào, ai là quản lý/trưởng phòng/leader, và danh sách nhân sự đã nghỉ việc/nghỉ hẳn (inactive/resigned) nếu người dùng có quyền.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'department_or_team' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên phòng ban hoặc nhóm cần lọc (ví dụ: Kinh doanh, Nhân sự, Học vụ, Marketing, Kế toán, Ban Giám đốc)'
                                ],
                                'status' => [
                                    'type' => 'STRING',
                                    'enum' => ['active', 'inactive_resigned', 'all'],
                                    'description' => 'Trạng thái nhân sự cần tra cứu: active (đang làm việc - mặc định), inactive_resigned (đã nghỉ việc/off), all (tất cả)'
                                ],
                                'search_name' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên hoặc từ khóa nhân sự cần tìm đích danh nếu có'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'get_company_leave_and_absence',
                        'description' => 'Tra cứu lịch nghỉ phép, vắng mặt toàn viện/công ty: Nay ai nghỉ, ai làm việc từ xa (WFH), ai đi công tác, ai sắp nghỉ trong 7-14 ngày tới, và các đơn nghỉ phép đang chờ duyệt.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'scope' => [
                                    'type' => 'STRING',
                                    'enum' => ['today', 'upcoming_14_days', 'pending_approval', 'all'],
                                    'description' => 'Phạm vi thời gian tra cứu: today (hôm nay ai nghỉ - mặc định), upcoming_14_days (sắp tới ai nghỉ), pending_approval (chờ duyệt), all (tất cả)'
                                ],
                                'department_or_team' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên phòng ban hoặc nhóm cần lọc nếu có'
                                ],
                                'leave_type' => [
                                    'type' => 'STRING',
                                    'enum' => ['all', 'annual', 'remote_work', 'business_trip', 'sick', 'unpaid'],
                                    'description' => 'Loại hình vắng mặt cần lọc (mặc định all)'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'update_contact_pipeline',
                        'description' => 'Cập nhật giai đoạn Pipeline (chuyển bước phễu tuyển sinh) cho học viên/khách hàng, đồng thời tự động lưu ghi chú (note/lịch sử tư vấn) vào hồ sơ CRM.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'target_stage' => [
                                    'type' => 'STRING',
                                    'description' => 'Giai đoạn chuyển đến (ví dụ: "13 – Deposit / Tuition Payment", "13", "deposit_tuition_payment", "14 – Enrolled", "09 – Application Started")'
                                ],
                                'contact_id' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Mã ID học viên/khách hàng'
                                ],
                                'contact_query' => [
                                    'type' => 'STRING',
                                    'description' => 'Số điện thoại hoặc họ tên học viên nếu chưa có ID'
                                ],
                                'note' => [
                                    'type' => 'STRING',
                                    'description' => 'Ghi chú/lý do chuyển giai đoạn hoặc tóm tắt tiến trình tư vấn'
                                ]
                            ],
                            'required' => ['target_stage']
                        ]
                    ],
                    [
                        'name' => 'add_contact_consultation_note',
                        'description' => 'Thêm ghi chú tư vấn, chăm sóc, lịch sử tương tác hoặc ghi chú cập nhật hồ sơ vào trang chi tiết học viên/khách hàng trong CRM.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'content' => [
                                    'type' => 'STRING',
                                    'description' => 'Nội dung ghi chú tư vấn hoặc cập nhật hồ sơ'
                                ],
                                'contact_id' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Mã ID học viên/khách hàng'
                                ],
                                'contact_query' => [
                                    'type' => 'STRING',
                                    'description' => 'Số điện thoại hoặc họ tên nếu chưa có ID'
                                ]
                            ],
                            'required' => ['content']
                        ]
                    ],
                    [
                        'name' => 'attach_files_to_contact',
                        'description' => 'Lưu và đính kèm các tệp tin/hình ảnh/hồ sơ (từ tin nhắn chat gần nhất hoặc danh sách URL) trực tiếp vào kho lưu trữ hồ sơ của học viên/khách hàng trong CRM (cloud_files).',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'contact_query' => [
                                    'type' => 'STRING',
                                    'description' => 'Số điện thoại, họ tên hoặc mã ID của khách hàng/học viên cần lưu hồ sơ'
                                ],
                                'contact_id' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Mã ID khách hàng nếu đã biết'
                                ],
                                'category' => [
                                    'type' => 'STRING',
                                    'enum' => ['Hồ sơ học viên', 'Hợp đồng / Minh chứng', 'Bằng cấp / Chứng chỉ', 'CCCD / Hộ chiếu', 'Biên lai / UNC', 'Tài liệu khác'],
                                    'description' => 'Phân loại tài liệu trong hồ sơ (mặc định: Hồ sơ học viên)'
                                ],
                                'file_urls' => [
                                    'type' => 'ARRAY',
                                    'items' => ['type' => 'STRING'],
                                    'description' => 'Danh sách URL tệp tin cần gắn. Nếu để trống, hệ thống sẽ tự động lấy các tệp đính kèm gần nhất trong đoạn chat hiện tại.'
                                ],
                                'note' => [
                                    'type' => 'STRING',
                                    'description' => 'Ghi chú kèm theo khi lưu tệp vào hồ sơ'
                                ]
                            ],
                            'required' => ['contact_query']
                        ]
                    ],
                    [
                        'name' => 'update_contact_profile',
                        'description' => 'Cập nhật thông tin chi tiết trong hồ sơ khách hàng/học viên CRM (họ tên, số điện thoại, email, địa chỉ, chức vụ, công ty, ghi chú chung).',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'contact_id' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Mã ID học viên/khách hàng'
                                ],
                                'contact_query' => [
                                    'type' => 'STRING',
                                    'description' => 'Số điện thoại hoặc họ tên nếu chưa có ID'
                                ],
                                'full_name' => [
                                    'type' => 'STRING',
                                    'description' => 'Họ và tên học viên mới nếu cần cập nhật'
                                ],
                                'phone' => [
                                    'type' => 'STRING',
                                    'description' => 'Số điện thoại'
                                ],
                                'email' => [
                                    'type' => 'STRING',
                                    'description' => 'Địa chỉ email'
                                ],
                                'job_title' => [
                                    'type' => 'STRING',
                                    'description' => 'Chức danh nghề nghiệp'
                                ],
                                'company_name' => [
                                    'type' => 'STRING',
                                    'description' => 'Đơn vị / Cơ quan công tác'
                                ],
                                'address' => [
                                    'type' => 'STRING',
                                    'description' => 'Địa chỉ liên hệ'
                                ],
                                'notes' => [
                                    'type' => 'STRING',
                                    'description' => 'Ghi chú bổ sung vào hồ sơ'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'check_student_admission_records',
                        'description' => 'Thẩm định hồ sơ học viên trong CRM (CCCD/Hộ chiếu, bằng Đại học, bảng điểm, CV tiếng Anh, dịch thuật công chứng, hợp đồng đào tạo) xem đã nộp những gì và còn thiếu gì so với điều kiện chương trình quốc tế (EMBA, MBA, MSc AI, DBA).',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'contact_id' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Mã ID học viên/khách hàng nếu đã biết'
                                ],
                                'contact_query' => [
                                    'type' => 'STRING',
                                    'description' => 'Số điện thoại hoặc họ tên học viên nếu chưa có ID'
                                ],
                                'program_code' => [
                                    'type' => 'STRING',
                                    'enum' => ['EMBA', 'MBA', 'MSC_AI', 'DBA', 'TOPUP', 'ALL'],
                                    'description' => 'Mã chương trình đào tạo để đối soát chuẩn đầu vào'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'get_inventory_and_asset_status',
                        'description' => 'Tra cứu số lượng tồn kho ấn phẩm, quà tặng tuyển sinh (áo polo, balo, sổ tay, bút ký, giáo trình) hoặc danh sách tài sản công ty (hrm_assets: laptop, thiết bị) được bàn giao cho nhân sự.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'type' => [
                                    'type' => 'STRING',
                                    'enum' => ['all', 'inventory', 'assets'],
                                    'description' => 'Loại tra cứu: inventory (kho ấn phẩm/quà tặng), assets (tài sản/máy tính bàn giao), all (tất cả)'
                                ],
                                'keyword' => [
                                    'type' => 'STRING',
                                    'description' => 'Từ khóa tìm kiếm tên vật tư, ấn phẩm hoặc tên nhân sự được bàn giao'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'get_campaign_marketing_stats',
                        'description' => 'Tra cứu số liệu thống kê hiệu quả các chiến dịch tuyển sinh, nguồn Lead (Facebook Ads, Google Ads, TikTok, Hội thảo EduFair, Giới thiệu) và tỷ lệ chuyển đổi sang bước cọc/SO.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'time_range' => [
                                    'type' => 'STRING',
                                    'enum' => ['this_month', 'last_month', 'last_90_days', 'all'],
                                    'description' => 'Khoảng thời gian thống kê (mặc định: this_month)'
                                ],
                                'campaign_source' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên hoặc nguồn chiến dịch cụ thể nếu có'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'get_executive_financial_pulse',
                        'description' => 'Báo cáo mạch tài chính và sức khỏe doanh nghiệp dành cho Ban Giám đốc (Director/Superadmin): Tổng thu cọc/học phí thực tế, tổng chi phí đã giải ngân, dòng tiền ròng (Net Cashflow), số đơn cọc mới và các khoản chi lớn nhất. Yêu cầu quyền Giám đốc hoặc Kế toán.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'month' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Tháng cần xem (1-12, mặc định tháng hiện tại)'
                                ],
                                'year' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Năm cần xem (mặc định năm hiện tại)'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'get_system_health_status',
                        'description' => 'Kiểm tra trạng thái sức khỏe kỹ thuật của hệ thống: thống kê nhật ký truy vấn AI (ai_query_audit_logs), tiến trình đồng bộ Google Sheets, webhook kết nối và trạng thái vận hành ERP.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'scope' => [
                                    'type' => 'STRING',
                                    'enum' => ['all', 'ai_audit', 'sync_sheets', 'system_info'],
                                    'description' => 'Phạm vi kiểm tra sức khỏe hệ thống (mặc định all)'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'get_contact_360_profile',
                        'description' => 'Tra cứu lịch sử 360 độ toàn diện của khách hàng/học viên khi người dùng hỏi sâu hoặc hỏi tới hỏi tới: Khách vào CRM từ lúc nào (ngày tạo, nguồn marketing, chiến dịch), ai chăm sóc/tư vấn (chuyên viên phụ trách, người cộng tác, chi nhánh), lịch sử ghi chú tư vấn (note cái gì, các lần tương tác), danh mục hồ sơ giấy tờ trong cloud_files (hồ sơ có gì), và thẩm định điều kiện nhập học (chuẩn hết chưa, thiếu giấy tờ gì), kèm tình trạng tài chính đặt cọc/học phí.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'contact_id' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Mã ID của học viên/khách hàng nếu đã biết'
                                ],
                                'contact_query' => [
                                    'type' => 'STRING',
                                    'description' => 'Số điện thoại, email hoặc họ tên học viên'
                                ],
                                'program_code' => [
                                    'type' => 'STRING',
                                    'enum' => ['EMBA', 'MBA', 'MSC_AI', 'DBA', 'TOPUP', 'ALL'],
                                    'description' => 'Mã chương trình để thẩm định chuẩn hồ sơ (mặc định EMBA)'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'get_sales_performance_and_stale_leads',
                        'description' => 'Tra cứu hiệu suất tư vấn CRM, tỷ lệ chuyển đổi tuyển sinh, và phát hiện danh sách khách hàng tiềm năng/học viên (Lead) đang bị "bỏ quên" (quá 3 - 5 ngày không có ghi chú chăm sóc hoặc tương tác), giúp Sale và Quản lý nắm bắt ngay các cơ hội sắp nguội lạnh.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'days_threshold' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số ngày không có ghi chú tương tác để xếp vào diện bỏ quên (mặc định 3 ngày, tối thiểu 1, tối đa 30)'
                                ],
                                'assigned_to' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Mã user ID của nhân viên sale nếu quản lý muốn lọc riêng (để trống nếu xem cá nhân/toàn viện)'
                                ],
                                'limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng lead bỏ quên cần hiển thị mẫu chi tiết (mặc định 5, tối đa 20)'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'get_upcoming_tuition_receivables',
                        'description' => 'Tra cứu các khoản công nợ học phí và đơn hàng bán (sales_orders) còn tồn đọng chưa thanh toán đủ hoặc đang đóng theo đợt (payment_status != paid), trích xuất tổng công nợ phải thu, số tiền đã thu, và danh sách học viên cần đôn đốc thu hồi học phí.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng đơn hàng/khoản phải thu lớn nhất cần hiển thị (mặc định 5, tối đa 20)'
                                ],
                                'contact_id' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Mã ID học viên nếu muốn kiểm tra công nợ của riêng 1 học viên cụ thể'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'trace_approval_blocker',
                        'description' => 'Truy vết nút thắt phê duyệt (Approval Blocker) chuyên sâu: Khi người dùng thắc mắc đơn đề xuất chi tiêu (PO), tạm ứng công tác, hoặc đơn xin nghỉ phép gửi nhiều ngày rồi chưa xong, công cụ chỉ mặt đặt tên chính xác ai là người duyệt hiện tại (cấp 1, cấp 2), chức vụ, phòng ban, và đơn đã nộp bao nhiêu giờ/ngày.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'item_type' => [
                                    'type' => 'STRING',
                                    'enum' => ['all', 'expense', 'advance', 'leave'],
                                    'description' => 'Loại đơn phê duyệt cần truy vết nút thắt (mặc định: all)'
                                ],
                                'item_id' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Mã ID cụ thể của đơn cần tra cứu nút thắt (nếu biết)'
                                ],
                                'limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng đơn kẹt cần phân tích (mặc định 5, tối đa 15)'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'get_ticket_status_and_sla_breaches',
                        'description' => 'Tra cứu tình trạng các ticket khiếu nại, phản ánh và hỗ trợ học viên/nội bộ, tự động phát hiện các ticket bị vi phạm cam kết thời gian phản hồi SLA (Urgent > 12h, High > 24h, Normal > 48h chưa xử lý xong) để điều phối kịp thời.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'status' => [
                                    'type' => 'STRING',
                                    'enum' => ['all_open', 'breached_only', 'all'],
                                    'description' => 'Bộ lọc trạng thái ticket (mặc định: breached_only để bắt các sự cố trễ hạn SLA)'
                                ],
                                'limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng ticket cần hiển thị (mặc định 5, tối đa 15)'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'get_b2b_partner_and_contract_summary',
                        'description' => 'Tra cứu đối tác doanh nghiệp B2B, hợp đồng hợp tác đào tạo và các cơ hội kinh doanh liên kết (deals), kiểm tra ngành nghề, quy mô, đầu mối phụ trách và tình trạng hợp đồng.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'keyword' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên doanh nghiệp, mã số thuế hoặc ngành nghề'
                                ],
                                'limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng doanh nghiệp cần hiển thị (mặc định 5, tối đa 15)'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'get_consultant_shift_and_fairshare_audit',
                        'description' => 'Tra cứu vòng phân bổ lead (rounds), ca trực tư vấn và kiểm toán phân chia cơ hội học viên công bằng (Fair Share Audit) giữa các tư vấn viên trong đội ngũ kinh doanh.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'team_id' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Mã ID nhóm bán hàng hoặc vòng phân bổ (nếu muốn lọc)'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'manage_lead_round_distribution',
                        'description' => 'Thực thi nghiệp vụ Vòng xoay phân bổ Lead: Tra cứu tải thực tế của các vòng (giải đáp "nên giao vòng nào?"), gán số điện thoại/khách hàng trực tiếp vào vòng xoay, bù data cho chuyên viên tư vấn (khi lead trùng/rác) và điều chỉnh ca trực nhận số.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'action' => [
                                    'type' => 'STRING',
                                    'enum' => ['list_rounds', 'get_round_load_audit', 'distribute_lead', 'compensate_consultant', 'toggle_consultant_shift'],
                                    'description' => 'Hành động cần thực thi: "get_round_load_audit" (khảo sát tải để biết nên giao vòng nào), "distribute_lead" (giao khách/SĐT vào vòng), "compensate_consultant" (bù data cho Sale), "toggle_consultant_shift" (bật/tắt ca trực nhận số), "list_rounds" (xem danh sách vòng)'
                                ],
                                'round_id' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Mã ID vòng phân bổ (distribution_rounds.id)'
                                ],
                                'round_name' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên vòng phân bổ gần đúng (vd: "BBA", "IELTS", "Tuyển sinh")'
                                ],
                                'consultant_id' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Mã ID chuyên viên tư vấn / Sale (users.id)'
                                ],
                                'consultant_name' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên gần đúng của chuyên viên tư vấn (vd: "Phúc", "Trần Trọng Phúc")'
                                ],
                                'compensation_count' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng data cần bù (mặc định 1, tối đa 10)'
                                ],
                                'lead_phone' => [
                                    'type' => 'STRING',
                                    'description' => 'Số điện thoại của khách hàng cần giao vào vòng xoay'
                                ],
                                'lead_name' => [
                                    'type' => 'STRING',
                                    'description' => 'Họ tên của khách hàng'
                                ],
                                'lead_email' => [
                                    'type' => 'STRING',
                                    'description' => 'Email của khách hàng nếu có'
                                ],
                                'lead_note' => [
                                    'type' => 'STRING',
                                    'description' => 'Nhu cầu hoặc ghi chú nguồn của Lead'
                                ],
                                'shift_active' => [
                                    'type' => 'BOOLEAN',
                                    'description' => 'Trạng thái ca trực (true: đang trực nhận số, false: tạm dừng)'
                                ],
                                'reason' => [
                                    'type' => 'STRING',
                                    'description' => 'Lý do bù data hoặc thay đổi ca trực (phục vụ Audit Log)'
                                ]
                            ],
                            'required' => ['action']
                        ]
                    ],
                    [
                        'name' => 'schedule_contact_activity',
                        'description' => 'Lên lịch hẹn tư vấn, cuộc gọi nhắc nhở chăm sóc hoặc tác vụ gắn trực tiếp với học viên/lead. Tự động lưu vào bảng activities của học viên và đồng bộ hiển thị lên Lịch làm việc cá nhân (/calendar) của chuyên viên tư vấn.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'contact_id' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Mã ID học viên / lead cần đặt lịch hẹn (Bắt buộc)'
                                ],
                                'type' => [
                                    'type' => 'STRING',
                                    'enum' => ['call', 'meeting', 'task', 'email'],
                                    'description' => 'Loại hoạt động: call (cuộc gọi lại), meeting (lịch hẹn tư vấn/gặp trực tiếp), task (nhiệm vụ cần làm), email (mặc định: call)'
                                ],
                                'subject' => [
                                    'type' => 'STRING',
                                    'description' => 'Tiêu đề cuộc hẹn hoặc nội dung cần nhắc (vd: "Gọi tư vấn học phí EMBA K28", "Hẹn gặp tại Viện IDEAS")'
                                ],
                                'due_date' => [
                                    'type' => 'STRING',
                                    'description' => 'Thời điểm diễn ra hoặc hạn chót, định dạng YYYY-MM-DD HH:mm:ss hoặc YYYY-MM-DD'
                                ],
                                'notes' => [
                                    'type' => 'STRING',
                                    'description' => 'Ghi chú chi tiết cho cuộc hẹn (địa điểm, nội dung trao đổi, chuẩn bị hồ sơ)'
                                ],
                                'priority' => [
                                    'type' => 'STRING',
                                    'enum' => ['low', 'medium', 'high', 'urgent'],
                                    'description' => 'Mức độ ưu tiên (mặc định: medium)'
                                ]
                            ],
                            'required' => ['contact_id', 'subject']
                        ]
                    ],
                    [
                        'name' => 'check_lead_duplicate_and_fairshare_status',
                        'description' => 'Kiểm tra tranh chấp lead và trùng lặp khách hàng theo số điện thoại hoặc email. Trích xuất chuyên viên phụ trách hiện tại, lần tương tác gần nhất và thẩm định quy chế Fair Share: nếu quá 7 ngày không chăm sóc thì được coi là Bị bỏ quên (Stale Lead) và có thể xin chuyển giao.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'phone' => [
                                    'type' => 'STRING',
                                    'description' => 'Số điện thoại của khách hàng / học viên cần kiểm tra'
                                ],
                                'email' => [
                                    'type' => 'STRING',
                                    'description' => 'Email của khách hàng / học viên nếu có'
                                ],
                                'name' => [
                                    'type' => 'STRING',
                                    'description' => 'Họ tên của khách hàng để đối chiếu nếu có'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'lookup_recent_cash_receipts_and_deposits',
                        'description' => 'Tra cứu và đối soát các phiếu thu tiền, phiếu đặt cọc và biến động dòng tiền vào mới nhất để xác nhận học viên đã đóng tiền hay chưa. Tìm kiếm linh hoạt theo số tiền (VND), từ khóa nội dung/tên học viên, trạng thái (đã thu / chờ duyệt) hoặc ngày nộp.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'amount' => [
                                    'type' => 'NUMBER',
                                    'description' => 'Số tiền cần tìm kiếm (VND), ví dụ: 5000000 hoặc 15000000'
                                ],
                                'keyword' => [
                                    'type' => 'STRING',
                                    'description' => 'Từ khóa tìm kiếm: Tên học viên, SĐT, mã phiếu hoặc nội dung chuyển khoản'
                                ],
                                'status' => [
                                    'type' => 'STRING',
                                    'enum' => ['all', 'approved', 'pending'],
                                    'description' => 'Trạng thái phiếu: approved (kế toán đã duyệt/tiền đã vào), pending (đang chờ duyệt), all (tất cả)'
                                ],
                                'limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng giao dịch cần trích xuất (mặc định 5, tối đa 15)'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'get_academic_schedule_and_intakes',
                        'description' => 'Tra cứu lịch học, lịch khai giảng các khóa học (EMBA, MBA, MSc AI, DBA), thông tin giảng viên đứng lớp, phòng học, hình thức học (Zoom/Trực tiếp) và các mốc luận văn tốt nghiệp từ hệ thống đào tạo IDEAS.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'program_keyword' => [
                                    'type' => 'STRING',
                                    'description' => 'Từ khóa tên khóa học hoặc môn học (ví dụ: "EMBA", "MBA", "Chiến lược", "AI", "K28")'
                                ],
                                'limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng lớp hoặc môn học cần trích xuất (mặc định 5, tối đa 15)'
                                ]
                            ]
                        ]
                    ]
                ];

        if ($allowedToolNames !== null && !empty($allowedToolNames)) {
            $essential = [
                'draft_action_proposal',
                'get_system_navigation',
                'get_company_staff_directory',
                'get_my_tasks',
                'get_pending_approvals',
                'approve_or_reject_erp_ticket',
                'update_task_progress_and_status',
                'complete_task_checklist_item',
                'quick_log_crm_activity',
                'reassign_lead_owner',
                'manage_lead_round_distribution'
            ];
            $effectiveAllowed = array_unique(array_merge($allowedToolNames, $essential));

            $filtered = [];
            foreach ($declarations as $dec) {
                if (in_array($dec['name'], $effectiveAllowed, true)) {
                    $filtered[] = $dec;
                }
            }
            if (!empty($filtered)) {
                return [['functionDeclarations' => $filtered]];
            }
        }

        return [['functionDeclarations' => $declarations]];
    }

    /**
     * Parse task body safely, extracting pure text description, checklist items, and links
     */
    public static function parseTaskContent(?string $rawBody): array {
        if (empty($rawBody)) {
            return ['description' => '', 'checklist' => [], 'links' => [], 'checklist_summary' => ''];
        }

        $desc = '';
        $checklist = [];
        $links = [];

        $trimmed = trim($rawBody);
        if ((str_starts_with($trimmed, '{') && str_ends_with($trimmed, '}')) || str_contains($trimmed, '"erp_task"')) {
            try {
                $data = json_decode($trimmed, true);
                if (is_array($data)) {
                    $erp = $data['erp_task'] ?? $data;
                    if (isset($erp['description']) && is_string($erp['description'])) {
                        $desc = $erp['description'];
                    } elseif (isset($data['description']) && is_string($data['description'])) {
                        $desc = $data['description'];
                    }
                    if (isset($erp['checklist']) && is_array($erp['checklist'])) {
                        $checklist = $erp['checklist'];
                    }
                    if (isset($erp['links']) && is_array($erp['links'])) {
                        $links = $erp['links'];
                    }
                }
            } catch (\Throwable $e) {}
        }

        if (empty($desc)) {
            $desc = $rawBody;
        }

        // 1. Sanitize Mentions: <span class="mention"...>...<span>@Name</span></span> -> @Name
        $clean = preg_replace('/<span[^>]*class=["\']mention["\'][^>]*>.*?<span>(@[^<]+)<\/span>.*?<\/span>/is', '$1', $desc);
        // Fallback for general mention spans
        $clean = preg_replace('/<span[^>]*class=["\']mention["\'][^>]*>(.*?)<\/span>/is', '$1', $clean);
        // Replace break lines / paragraph ends with newline
        $clean = preg_replace('/<br\s*\/?>/i', "\n", $clean);
        $clean = preg_replace('/<\/(div|p|li|tr)>/i', "\n", $clean);
        // Strip remaining HTML tags
        $clean = strip_tags($clean);
        // Decode HTML entities (e.g. &nbsp;, &amp;, &quot;)
        $clean = html_entity_decode($clean, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        // Normalize whitespace and multiple newlines
        $clean = preg_replace("/[ \t]+/", ' ', $clean);
        $clean = preg_replace("/\n\s*\n+/", "\n\n", $clean);
        $clean = trim($clean);

        // Parse Checklist
        $parsedChecklist = [];
        $doneCount = 0;
        foreach ($checklist as $item) {
            $text = trim((string)($item['text'] ?? ($item['title'] ?? '')));
            if ($text === '') continue;
            $isDone = !empty($item['checked']) || !empty($item['done']);
            if ($isDone) $doneCount++;
            $parsedChecklist[] = [
                'text' => $text,
                'done' => $isDone
            ];
        }
        $checklistSummary = '';
        if (count($parsedChecklist) > 0) {
            $checklistSummary = "$doneCount/" . count($parsedChecklist) . " mục hoàn thành";
        }

        // Parse Links
        $parsedLinks = [];
        foreach ($links as $link) {
            $url = trim((string)($link['url'] ?? ''));
            if ($url === '') continue;
            $title = trim((string)($link['title'] ?? ($link['name'] ?? $url)));
            $parsedLinks[] = [
                'title' => $title,
                'url' => $url
            ];
        }

        return [
            'description' => $clean,
            'checklist' => $parsedChecklist,
            'checklist_summary' => $checklistSummary,
            'links' => $parsedLinks
        ];
    }

    /**
     * Batch resolve user IDs to full names
     */
    public static function resolveUserNames(PDO $db, array $userIds, int $tenantId): array {
        $cleanIds = array_values(array_unique(array_filter(array_map('intval', $userIds), fn($id) => $id > 0)));
        if (empty($cleanIds)) return [];

        $placeholders = implode(',', array_fill(0, count($cleanIds), '?'));
        $stmt = $db->prepare("SELECT id, full_name FROM users WHERE id IN ($placeholders) AND tenant_id = ?");
        $params = array_merge($cleanIds, [$tenantId]);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $map = [];
        foreach ($rows as $r) {
            $map[(int)$r['id']] = $r['full_name'];
        }
        return $map;
    }

    /**
     * Centralized Safe Executor with Strict Zero-Trust RBAC Guards
     */
    public static function executeTool(PDO $db, string $toolName, array $args, array $auth): array {
        $uid = (int)($auth['user_id'] ?? 0);
        $tid = (int)($auth['tenant_id'] ?? 1);
        $role = strtolower($auth['role'] ?? 'user');
        $userName = $auth['full_name'] ?? ($auth['name'] ?? 'Bạn');

        $isGlobalAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'director'], true);
        $isManager = in_array($role, ['manager', 'truong_phong', 'leader'], true);
        $isAccountant = in_array($role, ['accountant', 'ke_toan'], true);
        $isHR = in_array($role, ['hr', 'nhan_su'], true);
        $isAcademic = in_array($role, ['academic', 'hoc_vu', 'hoc_thuat', 'tro_giang', 'teacher', 'giang_vien'], true);
        $isSale = in_array($role, ['sales', 'sale', 'kinh_doanh', 'sale_admin', 'saleadmin', 'consultant', 'tu_van'], true);
        $canAccessAllContacts = $isGlobalAdmin || $isManager;

        // Zero-Trust Contact RBAC Condition: if not admin/manager, strictly isolate to owner, collaborator, or cooperation slip
        $getContactRbacClause = function(string $alias = 'c') use ($canAccessAllContacts, $uid) {
            if ($canAccessAllContacts) {
                return ['clause' => '1=1', 'params' => []];
            }
            $prefix = $alias ? "{$alias}." : "";
            $clause = "({$prefix}owner_id = ? OR FIND_IN_SET(?, IFNULL({$prefix}collaborator_ids, '')) OR {$prefix}id IN (
                SELECT contact_id FROM cooperation_slips 
                WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE '{}' END), JSON_QUOTE(CAST(? AS CHAR)))
            ))";
            return [
                'clause' => $clause,
                'params' => [$uid, (string)$uid, (string)$uid]
            ];
        };

        try {
            switch ($toolName) {
                // ==========================================
                // 1. GET MY TASKS (WORKSPACE DEFENSE)
                // ==========================================
                case 'get_my_tasks': {
                    $filter = $args['filter'] ?? 'all_pending';
                    $limit = min(20, max(1, (int)($args['limit'] ?? 5)));
                    $searchKeyword = trim($args['search_keyword'] ?? '');

                    // Base Where Clause with Strict User Isolation and Workspace task type
                    $where = "a.tenant_id = ? AND a.deleted_at IS NULL AND a.type IN ('task', 'meeting') AND (a.user_id = ? OR a.created_by = ? OR a.approver_id = ? OR FIND_IN_SET(?, IFNULL(a.participant_ids, '')))";
                    $params = [$tid, $uid, $uid, $uid, (string)$uid];

                    // 1. Calculate Aggregated Statistics (Defense against 100+ tasks)
                    $statSql = "SELECT 
                                    COUNT(1) as total_undone,
                                    SUM(CASE WHEN a.due_date IS NOT NULL AND a.due_date < NOW() THEN 1 ELSE 0 END) as overdue_count,
                                    SUM(CASE WHEN a.priority IN ('urgent', 'high') THEN 1 ELSE 0 END) as urgent_count,
                                    SUM(CASE WHEN a.due_date IS NOT NULL AND DATE(a.due_date) = CURDATE() THEN 1 ELSE 0 END) as today_count
                                FROM activities a
                                WHERE $where AND (a.status IS NULL OR a.status NOT IN ('completed', 'cancelled', 'done', 'hoan_thanh', 'da_xong')) AND (a.progress < 100 OR a.progress IS NULL)";
                    $statStmt = $db->prepare($statSql);
                    $statStmt->execute($params);
                    $stats = $statStmt->fetch(PDO::FETCH_ASSOC) ?: [];
                    $totalUndone = (int)($stats['total_undone'] ?? 0);
                    $overdueCount = (int)($stats['overdue_count'] ?? 0);
                    $urgentCount = (int)($stats['urgent_count'] ?? 0);
                    $todayCount = (int)($stats['today_count'] ?? 0);

                    // 2. Apply requested filter
                    $sliceWhere = $where;
                    $sliceParams = $params;

                    if ($filter === 'completed') {
                        $sliceWhere .= " AND (a.status IN ('completed', 'cancelled', 'done', 'hoan_thanh', 'da_xong') OR a.progress >= 100)";
                    } else {
                        $sliceWhere .= " AND (a.status IS NULL OR a.status NOT IN ('completed', 'cancelled', 'done', 'hoan_thanh', 'da_xong')) AND (a.progress < 100 OR a.progress IS NULL)";
                        if ($filter === 'overdue') {
                            $sliceWhere .= " AND a.due_date IS NOT NULL AND a.due_date < NOW()";
                        } elseif ($filter === 'today') {
                            $sliceWhere .= " AND a.due_date IS NOT NULL AND DATE(a.due_date) = CURDATE()";
                        } elseif ($filter === 'urgent') {
                            $sliceWhere .= " AND a.priority IN ('urgent', 'high')";
                        }
                    }

                    if (!empty($searchKeyword)) {
                        $sliceWhere .= " AND (a.subject LIKE ? OR a.tags LIKE ?)";
                        $sliceParams[] = '%' . $searchKeyword . '%';
                        $sliceParams[] = '%' . $searchKeyword . '%';
                    }

                    // 3. Fetch Top Slice (Ranked by: Overdue -> Urgent -> Near Deadline)
                    $sliceSql = "SELECT a.id, a.type, a.subject, a.status, a.priority, a.progress, a.start_date, a.due_date, a.done_at,
                                        a.body, a.tags, a.participant_ids, a.require_approval, a.approval_status, a.link,
                                        tg.name as task_group_name,
                                        u.full_name as assignee_name, cr.full_name as creator_name, app.full_name as approver_name
                                 FROM activities a
                                 LEFT JOIN users u ON a.user_id = u.id
                                 LEFT JOIN users cr ON a.created_by = cr.id
                                 LEFT JOIN users app ON a.approver_id = app.id
                                 LEFT JOIN task_groups tg ON a.task_group_id = tg.id
                                 WHERE $sliceWhere
                                 ORDER BY 
                                     (CASE WHEN a.due_date IS NOT NULL AND a.due_date < NOW() THEN 0 ELSE 1 END),
                                     (CASE WHEN a.priority = 'urgent' THEN 0 WHEN a.priority = 'high' THEN 1 WHEN a.priority = 'medium' THEN 2 ELSE 3 END),
                                     a.due_date ASC, a.id DESC
                                 LIMIT " . (int)$limit;
                    $sliceStmt = $db->prepare($sliceSql);
                    $sliceStmt->execute($sliceParams);
                    $topTasks = $sliceStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    // Collect participant IDs to resolve names in 1 query
                    $allParticipantIds = [];
                    foreach ($topTasks as $t) {
                        if (!empty($t['participant_ids'])) {
                            foreach (explode(',', (string)$t['participant_ids']) as $pid) {
                                $pid = (int)trim($pid);
                                if ($pid > 0) $allParticipantIds[] = $pid;
                            }
                        }
                    }
                    $userNameMap = self::resolveUserNames($db, $allParticipantIds, $tid);

                    $formattedTasks = [];
                    foreach ($topTasks as $t) {
                        $parsed = self::parseTaskContent($t['body'] ?? '');

                        // Status translation
                        $statusRaw = strtolower(trim((string)($t['status'] ?? '')));
                        $statusText = 'Đang thực hiện';
                        if (in_array($statusRaw, ['done', 'completed'], true) || (int)($t['progress'] ?? 0) >= 100) {
                            $statusText = 'Đã hoàn thành';
                        } elseif ($statusRaw === 'cancelled') {
                            $statusText = 'Đã hủy';
                        }

                        // Priority translation
                        $prioRaw = strtolower(trim((string)($t['priority'] ?? 'medium')));
                        $prioText = match($prioRaw) {
                            'urgent' => 'Khẩn cấp',
                            'high' => 'Cao',
                            'low' => 'Thấp',
                            default => 'Trung bình'
                        };

                        $start = $t['start_date'] ? date('d/m/Y H:i', strtotime($t['start_date'])) : null;
                        $due = $t['due_date'] ? date('d/m/Y H:i', strtotime($t['due_date'])) : 'Không đặt hạn';
                        $isOverdue = (!empty($t['due_date']) && strtotime($t['due_date']) < time() && !in_array($statusRaw, ['done', 'completed'], true) && (int)($t['progress'] ?? 0) < 100) ? ' (⚠️ ĐÃ QUÁ HẠN)' : '';

                        // Resolve collaborators
                        $collabs = [];
                        if (!empty($t['participant_ids'])) {
                            foreach (explode(',', (string)$t['participant_ids']) as $pid) {
                                $pid = (int)trim($pid);
                                if (isset($userNameMap[$pid])) {
                                    $collabs[] = $userNameMap[$pid];
                                }
                            }
                        }

                        $formattedTasks[] = [
                            'id' => (int)$t['id'],
                            'subject' => $t['subject'],
                            'description' => !empty($parsed['description']) ? mb_substr($parsed['description'], 0, 500) : '',
                            'status' => $statusText,
                            'priority' => $prioText,
                            'progress' => (int)($t['progress'] ?? 0) . '%',
                            'group' => $t['task_group_name'] ?: 'Chưa phân nhóm',
                            'start_date' => $start,
                            'due_date' => $due . $isOverdue,
                            'assignee' => $t['assignee_name'] ?: 'Chưa phân công',
                            'creator' => $t['creator_name'] ?: 'Hệ thống',
                            'approver' => !empty($t['require_approval']) ? ($t['approver_name'] ?: 'Chưa chỉ định') : null,
                            'approval_status' => !empty($t['require_approval']) ? ($t['approval_status'] ?: 'Chờ duyệt') : null,
                            'collaborators' => !empty($collabs) ? implode(', ', $collabs) : null,
                            'checklist_summary' => $parsed['checklist_summary'] ?: null,
                            'tags' => $t['tags'] ?: '',
                            'link' => $t['link'] ?: null
                        ];
                    }

                    return [
                        'success' => true,
                        'total_undone' => $totalUndone,
                        'overdue_count' => $overdueCount,
                        'urgent_count' => $urgentCount,
                        'today_count' => $todayCount,
                        'shown_count' => count($formattedTasks),
                        'limit_applied' => $limit,
                        'summary' => "Bạn đang có tổng cộng {$totalUndone} công việc chưa hoàn thành trên Bàn làm việc (trong đó: {$overdueCount} việc quá hạn, {$urgentCount} việc gấp/ưu tiên cao, {$todayCount} việc đến hạn hôm nay). Dưới đây là top {$limit} việc cần ưu tiên nhất:",
                        'top_tasks' => $formattedTasks
                    ];
                }

                // ==========================================
                // 2. GET PENDING APPROVALS (APPROVALS DEFENSE)
                // ==========================================
                case 'get_pending_approvals': {
                    $appType = $args['approval_type'] ?? 'all';
                    $limit = min(10, max(1, (int)($args['limit'] ?? 5)));

                    // A. Count leaves
                    $stmtLv = $db->prepare("
                        SELECT COUNT(1) FROM hrm_leave_requests 
                        WHERE status = 'pending'
                          AND (user_id = ? OR approver_id = ? OR approver_id_2 = ? " . ($isGlobalAdmin ? "OR (approver_id IS NULL OR approver_id = 0)" : "") . ")
                    ");
                    $stmtLv->execute([$uid, $uid, $uid]);
                    $leaveCount = (int)$stmtLv->fetchColumn();

                    // B. Count advances
                    $stmtAdv = $db->prepare("
                        SELECT COUNT(1) FROM hrm_salary_advances 
                        WHERE status = 'pending'
                          AND (user_id = ? OR approver_id = ? OR approver_id_2 = ? " . ($isGlobalAdmin ? "OR (approver_id IS NULL OR approver_id = 0)" : "") . ")
                    ");
                    $stmtAdv->execute([$uid, $uid, $uid]);
                    $advanceCount = (int)$stmtAdv->fetchColumn();

                    // C. Count expenses / PO
                    $stmtExp = $db->prepare("
                        SELECT COUNT(1) FROM expenses 
                        WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'pending'
                          AND (created_by = ? OR approver_id = ? OR approver_id_2 = ? OR approver_id_3 = ? " . ($isGlobalAdmin ? "OR (approver_id IS NULL OR approver_id = 0)" : "") . ")
                    ");
                    $stmtExp->execute([$tid, $uid, $uid, $uid, $uid]);
                    $expenseCount = (int)$stmtExp->fetchColumn();

                    // D. Count checkins & bulks
                    $stmtCi = $db->prepare("
                        SELECT COUNT(1) FROM check_ins 
                        WHERE status = 'pending_approval' " . ($isGlobalAdmin ? "" : " AND user_id = ?") . "
                    ");
                    $stmtCi->execute($isGlobalAdmin ? [] : [$uid]);
                    $checkinCount = (int)$stmtCi->fetchColumn();

                    $totalPending = $leaveCount + $advanceCount + $expenseCount + $checkinCount;

                    // Fetch Top Items depending on type
                    $items = [];

                    if (in_array($appType, ['all', 'expense'], true) && $expenseCount > 0) {
                        $stmtEList = $db->prepare("
                            SELECT e.id, e.title, e.amount, e.vendor_name, e.created_at, u.full_name as creator_name
                            FROM expenses e
                            LEFT JOIN users u ON e.created_by = u.id
                            WHERE e.tenant_id = ? AND e.deleted_at IS NULL AND e.status = 'pending'
                              AND (e.created_by = ? OR e.approver_id = ? OR e.approver_id_2 = ? OR e.approver_id_3 = ? " . ($isGlobalAdmin ? "OR (e.approver_id IS NULL OR e.approver_id = 0)" : "") . ")
                            ORDER BY e.amount DESC, e.id DESC
                            LIMIT " . (int)$limit . "
                        ");
                        $stmtEList->execute([$tid, $uid, $uid, $uid, $uid]);
                        foreach ($stmtEList->fetchAll(PDO::FETCH_ASSOC) as $row) {
                            $amt = number_format((float)$row['amount'], 0, ',', '.') . ' VND';
                            $items[] = [
                                'type' => 'Đề xuất chi / PO',
                                'id' => (int)$row['id'],
                                'title' => $row['title'],
                                'details' => "Số tiền: {$amt} | Chi cho: " . ($row['vendor_name'] ?: 'Nội bộ'),
                                'creator' => $row['creator_name'] ?: 'Nhân sự',
                                'date' => date('d/m/Y', strtotime($row['created_at']))
                            ];
                        }
                    }

                    if (in_array($appType, ['all', 'leave'], true) && $leaveCount > 0 && count($items) < $limit) {
                        $rem = $limit - count($items);
                        $stmtLList = $db->prepare("
                            SELECT l.id, l.leave_type, l.start_date, l.end_date, l.total_days, l.reason, l.created_at, u.full_name as employee_name
                            FROM hrm_leave_requests l
                            JOIN users u ON l.user_id = u.id
                            WHERE l.status = 'pending'
                              AND (l.user_id = ? OR l.approver_id = ? OR l.approver_id_2 = ? " . ($isGlobalAdmin ? "OR (l.approver_id IS NULL OR l.approver_id = 0)" : "") . ")
                            ORDER BY l.id DESC
                            LIMIT " . (int)$rem . "
                        ");
                        $stmtLList->execute([$uid, $uid, $uid]);
                        foreach ($stmtLList->fetchAll(PDO::FETCH_ASSOC) as $row) {
                            $items[] = [
                                'type' => 'Đơn xin nghỉ phép',
                                'id' => (int)$row['id'],
                                'title' => "Nghỉ phép ({$row['total_days']} ngày: " . date('d/m', strtotime($row['start_date'])) . " - " . date('d/m/Y', strtotime($row['end_date'])) . ")",
                                'details' => "Lý do: " . ($row['reason'] ?: 'Việc cá nhân'),
                                'creator' => $row['employee_name'],
                                'date' => date('d/m/Y', strtotime($row['created_at']))
                            ];
                        }
                    }

                    return [
                        'success' => true,
                        'total_pending' => $totalPending,
                        'breakdown' => [
                            'expense_count' => $expenseCount,
                            'leave_count' => $leaveCount,
                            'advance_count' => $advanceCount,
                            'checkin_count' => $checkinCount
                        ],
                        'summary' => "Hiện có tổng cộng {$totalPending} phiếu đang chờ phê duyệt/xử lý trong Quy trình (trong đó: {$expenseCount} phiếu chi/PO, {$leaveCount} đơn nghỉ phép, {$advanceCount} tạm ứng, {$checkinCount} giải trình công). Dưới đây là top {$limit} phiếu ưu tiên nhất:",
                        'top_approvals' => array_slice($items, 0, $limit)
                    ];
                }

                // ==========================================
                // 3. GET TASK DETAIL
                // ==========================================
                case 'get_task_detail': {
                    $taskId = (int)($args['task_id'] ?? 0);
                    $query = trim($args['query'] ?? '');

                    $sql = "SELECT a.*, tg.name as task_group_name,
                                   u.full_name as assignee_name, cr.full_name as creator_name, app.full_name as approver_name
                            FROM activities a
                            LEFT JOIN users u ON a.user_id = u.id
                            LEFT JOIN users cr ON a.created_by = cr.id
                            LEFT JOIN users app ON a.approver_id = app.id
                            LEFT JOIN task_groups tg ON a.task_group_id = tg.id
                            WHERE a.tenant_id = ? AND a.deleted_at IS NULL";
                    $params = [$tid];

                    if ($taskId > 0) {
                        $sql .= " AND a.id = ?";
                        $params[] = $taskId;
                    } elseif (!empty($query)) {
                        $sql .= " AND (a.subject LIKE ? OR a.tags LIKE ?) ORDER BY a.id DESC LIMIT 1";
                        $params[] = '%' . $query . '%';
                        $params[] = '%' . $query . '%';
                    } else {
                        return ['success' => false, 'message' => 'Vui lòng cung cấp mã Task ID hoặc tên công việc cần xem.'];
                    }

                    if (!$isGlobalAdmin && !$isManager) {
                        $sql .= " AND (a.user_id = ? OR a.created_by = ? OR a.approver_id = ? OR FIND_IN_SET(?, IFNULL(a.participant_ids, '')))";
                        $params[] = $uid;
                        $params[] = $uid;
                        $params[] = $uid;
                        $params[] = (string)$uid;
                    }

                    $stmt = $db->prepare($sql);
                    $stmt->execute($params);
                    $task = $stmt->fetch(PDO::FETCH_ASSOC);

                    if (!$task) {
                        return ['success' => false, 'message' => 'Không tìm thấy công việc này hoặc bạn không có quyền truy cập.'];
                    }

                    // Resolve collaborators
                    $collabs = [];
                    if (!empty($task['participant_ids'])) {
                        $pids = [];
                        foreach (explode(',', (string)$task['participant_ids']) as $pid) {
                            $pid = (int)trim($pid);
                            if ($pid > 0) $pids[] = $pid;
                        }
                        if (!empty($pids)) {
                            $map = self::resolveUserNames($db, $pids, $tid);
                            foreach ($pids as $p) {
                                if (isset($map[$p])) $collabs[] = $map[$p];
                            }
                        }
                    }

                    $parsed = self::parseTaskContent($task['body'] ?? '');

                    $statusRaw = strtolower(trim((string)($task['status'] ?? '')));
                    $statusText = 'Đang thực hiện';
                    if (in_array($statusRaw, ['done', 'completed'], true) || (int)($task['progress'] ?? 0) >= 100) {
                        $statusText = 'Đã hoàn thành';
                    } elseif ($statusRaw === 'cancelled') {
                        $statusText = 'Đã hủy';
                    }

                    $prioRaw = strtolower(trim((string)($task['priority'] ?? 'medium')));
                    $prioText = match($prioRaw) {
                        'urgent' => 'Khẩn cấp',
                        'high' => 'Cao',
                        'low' => 'Thấp',
                        default => 'Trung bình'
                    };

                    $start = $task['start_date'] ? date('d/m/Y H:i', strtotime($task['start_date'])) : null;
                    $due = $task['due_date'] ? date('d/m/Y H:i', strtotime($task['due_date'])) : 'Không đặt hạn';
                    $isOverdue = (!empty($task['due_date']) && strtotime($task['due_date']) < time() && !in_array($statusRaw, ['done', 'completed'], true) && (int)($task['progress'] ?? 0) < 100) ? ' (⚠️ ĐÃ QUÁ HẠN)' : '';
                    $doneAt = $task['done_at'] ? date('d/m/Y H:i', strtotime($task['done_at'])) : null;

                    return [
                        'success' => true,
                        'task' => [
                            'id' => (int)$task['id'],
                            'subject' => $task['subject'],
                            'status' => $statusText,
                            'priority' => $prioText,
                            'progress' => (int)($task['progress'] ?? 0) . '%',
                            'group' => $task['task_group_name'] ?: 'Chưa phân nhóm',
                            'start_date' => $start,
                            'due_date' => $due . $isOverdue,
                            'done_at' => $doneAt,
                            'created_at' => date('d/m/Y H:i', strtotime($task['created_at'])),
                            'assignee' => $task['assignee_name'] ?: 'Chưa phân công',
                            'creator' => $task['creator_name'] ?: 'Hệ thống',
                            'approver' => !empty($task['require_approval']) ? ($task['approver_name'] ?: 'Chưa chỉ định') : null,
                            'approval_status' => !empty($task['require_approval']) ? ($task['approval_status'] ?: 'Chờ duyệt') : null,
                            'collaborators' => !empty($collabs) ? implode(', ', $collabs) : null,
                            'tags' => $task['tags'] ?: '',
                            'link' => $task['link'] ?: null,
                            'description' => !empty($parsed['description']) ? mb_substr($parsed['description'], 0, 3000) : '',
                            'checklist' => $parsed['checklist'],
                            'checklist_summary' => $parsed['checklist_summary'] ?: null,
                            'links' => $parsed['links']
                        ]
                    ];
                }

                // ==========================================
                // 4. SEARCH CONTACTS (CRM DEFENSE)
                // ==========================================
                case 'search_contacts': {
                    $q = trim($args['query'] ?? '');
                    if (mb_strlen($q) < 2) {
                        return ['success' => false, 'message' => 'Từ khóa tìm kiếm quá ngắn.'];
                    }

                    $where = [];
                    $params = [$tid];

                    // Check numeric id
                    if (is_numeric($q)) {
                        $where[] = "c.id = ? OR c.phone LIKE ?";
                        $params[] = (int)$q;
                        $params[] = '%' . $q . '%';
                    } else {
                        $where[] = "c.full_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?";
                        $like = '%' . $q . '%';
                        $params[] = $like;
                        $params[] = $like;
                        $params[] = $like;
                    }

                    $sql = "SELECT c.id, c.full_name, c.phone, c.email, c.status, c.stage_id, ps.name as stage_name, ps.order_index as stage_order, u.full_name as owner_name,
                            (
                                SELECT CONCAT('[', DATE_FORMAT(COALESCE(act.created_at, NOW()), '%d/%m/%Y %H:%i'), '] ', COALESCE(u_act.full_name, 'Tư vấn viên'), ' (', act.type, '): ', COALESCE(NULLIF(TRIM(act.body), ''), act.subject, ''))
                                FROM activities act
                                LEFT JOIN users u_act ON act.user_id = u_act.id
                                WHERE ((act.related_id = c.id AND act.related_type IN ('contact', 'lead')) OR act.contact_id = c.id)
                                  AND act.deleted_at IS NULL
                                ORDER BY act.created_at DESC, act.id DESC LIMIT 1
                            ) as latest_interaction
                            FROM contacts c
                            LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
                            LEFT JOIN users u ON c.owner_id = u.id
                            WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND (" . implode(" OR ", $where) . ")";

                    // Zero-Trust Sales & Staff Isolation: Non-admins only see own/collaborated contacts
                    if (!$canAccessAllContacts) {
                        $rbac = $getContactRbacClause('c');
                        $sql .= " AND " . $rbac['clause'];
                        $params = array_merge($params, $rbac['params']);
                    }

                    $sql .= " ORDER BY c.id DESC LIMIT 5";
                    $stmt = $db->prepare($sql);
                    $stmt->execute($params);
                    $contacts = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    if (empty($contacts)) {
                        return ['success' => true, 'count' => 0, 'message' => 'Không tìm thấy học viên/khách hàng phù hợp trong phạm vi quyền hạn của bạn.'];
                    }

                    return [
                        'success' => true,
                        'count' => count($contacts),
                        'contacts' => array_map(function($c) {
                            $stageOrder = !empty($c['stage_order']) ? (int)$c['stage_order'] : 1;
                            $isReadyForSo = ($stageOrder >= 13);
                            $stageName = $c['stage_name'] ?: ($c['status'] ?: 'Mới');
                            return [
                                'id' => (int)$c['id'],
                                'name' => $c['full_name'],
                                'phone' => $c['phone'],
                                'email' => $c['email'],
                                'stage' => $stageName,
                                'stage_id' => !empty($c['stage_id']) ? (int)$c['stage_id'] : null,
                                'stage_order' => $stageOrder,
                                'is_ready_for_so' => $isReadyForSo,
                                'so_readiness_notice' => $isReadyForSo 
                                    ? 'Khách hàng đã ở bước Đóng cọc/Tạo đơn SO (Giai đoạn 13+).' 
                                    : "Khách hàng hiện ở bước {$stageOrder}/14 ('{$stageName}'), CHƯA đến bước tạo SO (Giai đoạn 13 – Deposit / Tuition Payment). Hãy chủ động hỏi người dùng có muốn chuyển Pipeline sang '13 – Deposit / Tuition Payment' kèm ghi chú không!",
                                'owner' => $c['owner_name'] ?: 'Chưa phân công',
                                'latest_interaction' => $c['latest_interaction'] ?: 'Chưa có ghi chú tương tác gần đây'
                            ];
                        }, $contacts)
                    ];
                }

                // ==========================================
                // 5. GET CONTACT FINANCIAL SUMMARY
                // ==========================================
                case 'get_contact_financial_summary': {
                    $contactId = (int)($args['contact_id'] ?? 0);
                    $cQuery = trim($args['contact_query'] ?? '');

                    if ($contactId <= 0 && !empty($cQuery)) {
                        $sParams = [$tid, '%' . $cQuery . '%', '%' . $cQuery . '%'];
                        $sSql = "SELECT c.id FROM contacts c WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND (c.full_name LIKE ? OR c.phone LIKE ?)";
                        if (!$canAccessAllContacts) {
                            $rbac = $getContactRbacClause('c');
                            $sSql .= " AND " . $rbac['clause'];
                            $sParams = array_merge($sParams, $rbac['params']);
                        }
                        $sSql .= " ORDER BY c.id DESC LIMIT 1";
                        $sStmt = $db->prepare($sSql);
                        $sStmt->execute($sParams);
                        $contactId = (int)$sStmt->fetchColumn();
                    }

                    if ($contactId <= 0) {
                        return ['success' => false, 'message' => 'Vui lòng cung cấp mã ID hoặc tên/SĐT học viên cần tra cứu tài chính (trong phạm vi quyền hạn của bạn).'];
                    }

                    // Zero-Trust RBAC check: verify contact belongs to user or user is admin/accountant
                    if (!$canAccessAllContacts && !$isAccountant) {
                        $checkRbac = $getContactRbacClause('');
                        $checkStmt = $db->prepare("SELECT id FROM contacts WHERE id = ? AND tenant_id = ? AND " . $checkRbac['clause']);
                        $checkStmt->execute(array_merge([$contactId, $tid], $checkRbac['params']));
                        if (!$checkStmt->fetchColumn()) {
                            return ['success' => false, 'message' => 'Bạn không có quyền xem thông tin tài chính của khách hàng này (thuộc quyền quản lý của nhân sự khác).'];
                        }
                    }

                    // Query Deposits
                    $stmtDep = $db->prepare("
                        SELECT d.id, d.unit_code, d.price as amount, d.status, d.created_at, c.full_name as contact_name
                        FROM deposits d
                        JOIN contacts c ON d.contact_id = c.id
                        WHERE d.contact_id = ?
                        ORDER BY d.id DESC LIMIT 5
                    ");
                    $stmtDep->execute([$contactId]);
                    $deposits = $stmtDep->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    $formatted = [];
                    foreach ($deposits as $d) {
                        $amt = number_format((float)$d['amount'], 0, ',', '.') . ' VND';
                        $statusText = $d['status'] === 'approved' ? 'Đã duyệt (Đã thu)' : ($d['status'] === 'pending' ? 'Chờ kế toán duyệt' : $d['status']);
                        $formatted[] = [
                            'deposit_id' => (int)$d['id'],
                            'unit_code' => $d['unit_code'] ?: 'Học phí/Cọc',
                            'amount' => $amt,
                            'status' => $statusText,
                            'date' => date('d/m/Y', strtotime($d['created_at']))
                        ];
                    }

                    return [
                        'success' => true,
                        'contact_id' => $contactId,
                        'total_records' => count($formatted),
                        'deposits' => $formatted,
                        'summary' => empty($formatted) ? "Học viên này hiện chưa có bất kỳ phiếu thu hoặc phiếu đặt cọc nào trên hệ thống." : "Học viên có " . count($formatted) . " phiếu thu/cọc ghi nhận trên hệ thống."
                    ];
                }

                // ==========================================
                // 6. GET MY PAYMENT PROPOSALS
                // ==========================================
                case 'get_my_payment_proposals': {
                    $status = $args['status'] ?? 'all';

                    $where = "e.tenant_id = ? AND e.deleted_at IS NULL AND e.created_by = ?";
                    $params = [$tid, $uid];

                    if ($status === 'pending') {
                        $where .= " AND e.status = 'pending'";
                    } elseif ($status === 'approved') {
                        $where .= " AND e.status = 'approved'";
                    } elseif ($status === 'rejected') {
                        $where .= " AND e.status = 'rejected'";
                    }

                    $stmt = $db->prepare("
                        SELECT e.id, e.title, e.amount, e.vendor_name, e.status, e.created_at, e.reject_reason
                        FROM expenses e
                        WHERE $where
                        ORDER BY e.id DESC LIMIT 5
                    ");
                    $stmt->execute($params);
                    $proposals = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    $formatted = [];
                    foreach ($proposals as $p) {
                        $amt = number_format((float)$p['amount'], 0, ',', '.') . ' VND';
                        $st = $p['status'] === 'approved' ? 'Đã phê duyệt' : ($p['status'] === 'pending' ? 'Đang chờ duyệt' : 'Từ chối');
                        $formatted[] = [
                            'id' => (int)$p['id'],
                            'title' => $p['title'],
                            'amount' => $amt,
                            'vendor' => $p['vendor_name'] ?: 'Nội bộ',
                            'status' => $st,
                            'date' => date('d/m/Y', strtotime($p['created_at'])),
                            'reject_reason' => $p['reject_reason'] ?: null
                        ];
                    }

                    return [
                        'success' => true,
                        'count' => count($formatted),
                        'proposals' => $formatted
                    ];
                }

                // ==========================================
                // 7. GET MY ATTENDANCE SUMMARY
                // ==========================================
                case 'get_my_attendance_summary': {
                    $month = min(12, max(1, (int)($args['month'] ?? date('n'))));
                    $year = (int)($args['year'] ?? date('Y'));
                    $period = sprintf('%04d-%02d', $year, $month);

                    // Leave balance from hrm_profiles
                    $stmtP = $db->prepare("SELECT annual_leave_total, annual_leave_used, compensatory_leave_total, compensatory_leave_used FROM hrm_profiles WHERE user_id = ? LIMIT 1");
                    $stmtP->execute([$uid]);
                    $prof = $stmtP->fetch(PDO::FETCH_ASSOC);

                    $annualTotal = (float)($prof['annual_leave_total'] ?? 12.0);
                    $annualUsed = (float)($prof['annual_leave_used'] ?? 0.0);
                    $annualRemain = max(0.0, $annualTotal - $annualUsed);

                    // Attendance count in this month
                    $stmtCi = $db->prepare("SELECT COUNT(1) as total_checkins FROM check_ins WHERE user_id = ? AND check_in_date LIKE ? AND status = 'approved'");
                    $stmtCi->execute([$uid, $period . '-%']);
                    $totalWorkDays = (int)($stmtCi->fetchColumn() ?: 0);

                    return [
                        'success' => true,
                        'month_period' => "Tháng {$month}/{$year}",
                        'worked_days' => $totalWorkDays,
                        'annual_leave_total' => $annualTotal,
                        'annual_leave_used' => $annualUsed,
                        'annual_leave_remaining' => $annualRemain,
                        'summary' => "Trong tháng {$month}/{$year}, bạn đã ghi nhận {$totalWorkDays} ngày công thực tế. Bạn hiện còn {$annualRemain} ngày phép năm có thể sử dụng."
                    ];
                }

                // ==========================================
                // 8. SEARCH IDEAS KNOWLEDGE & PROGRAMS
                // ==========================================
                case 'search_ideas_knowledge':
                case 'get_program_details': {
                    return [
                        'success' => true,
                        'institute' => 'Viện Quản trị & Công nghệ IDEAS (Hơn 15 năm kết nối giáo dục toàn cầu từ 2011, 2.500+ Thạc sĩ/Tiến sĩ tốt nghiệp, 74 khóa đào tạo)',
                        'slogan' => 'Tri thức Nguyên bản - Đồng hành Bản địa (Original Knowledge - Localized Mentorship)',
                        'role' => 'Đối tác hỗ trợ học thuật toàn diện (Academic Support Partner) cho các trường đại học quốc tế hàng đầu Thụy Sĩ, Pháp, Anh, Mỹ.',
                        'partners' => [
                            'Swiss UMEF' => 'Geneva, Thụy Sĩ (thành lập 1984), Kiểm định liên bang SAC cao nhất, Swiss ENIC, VN-NARIC (Bộ GD&ĐT), ACBSP, CHEA, EDUQUA, IACBE, QS Stars 5 Stars Overall.',
                            'ISTEC Paris' => 'Paris, Pháp (thành lập 1961), Hệ thống Grande École danh giá, Top 8 Le Parisien, RNCP Level 7 & 8 (EQF Level 8 cao nhất), WES Earned Doctorate tại Mỹ & Canada.',
                            'ESTIAM & RB College' => 'Chương trình song bằng Dual DBA Pháp & Anh quốc.'
                        ],
                        'lms_learning_ecosystem' => [
                            'url' => 'https://ideas.edu.vn/he-thong-ho-tro-hoc-tap-lms-ideas',
                            'highlights' => '24/7 học tập chủ động; 1.000+ tài liệu Cengage toàn cầu; 100% bổ trợ tiếng Việt chuyên sâu cuối tuần.',
                            'four_pillars' => [
                                '1. LMS Powered by Moodle' => 'Quản lý học tập trực tuyến 24/7, lưu trữ video bài giảng chất lượng cao, tải giáo trình/slide bài giảng, nộp bài tập & theo dõi deadline tự động, nhận feedback trực tiếp từ giảng viên, diễn đàn lớp học.',
                                '2. IDEAS AI Platform' => 'Trợ lý học thuật 4.0 độc quyền tại IDEAS, tích hợp LLM tinh chỉnh cho sau đại học, giải đáp thuật ngữ kinh tế/tài chính tức thì bằng tiếng Việt, tóm tắt tài liệu nghiên cứu hàng trăm trang, gợi ý cấu trúc đề án luận văn (Capstone/Thesis scaffolding), đóng vai trò gia sư công nghệ 24/7. Trải nghiệm tại /dang-ky-tai-khoan-ai.',
                                '3. Global Digital Library (Cengage)' => 'Miễn phí truy cập 1.000+ đầu sách học thuật nguyên bản tiếng Anh chuyên ngành Kinh tế, Quản trị, Marketing, Tài chính cập nhật mới nhất, đọc trực tuyến trên PC, Tablet, Mobile.',
                                '4. Weekend Workshops' => 'Lớp chuyên đề bổ trợ cuối tuần cùng giảng viên & chuyên gia đầu ngành, phân tích cấu trúc bài thi, hướng dẫn làm bài luận chuẩn Châu Âu tránh rủi ro lạc đề/trượt môn, kết nối kiến thức quốc tế với thực tiễn doanh nghiệp Việt.'
                            ],
                            'six_barrier_solutions' => [
                                'Rào cản ngoại ngữ' => 'IDEAS AI dịch & giải nghĩa thuật ngữ tức thì + Lớp Chủ Nhật tiếng Việt.',
                                'Rào cản thời gian' => 'LMS Moodle học 24/7 linh hoạt mọi lúc mọi nơi + EMBA 10 môn không luận văn.',
                                'Rào cản phương pháp' => 'Cố vấn học thuật 1-1 + Hội đồng chuyên môn Final Draft Review.',
                                'Rào cản tài liệu' => 'Thư viện số Cengage Learning 1.000+ đầu sách bản quyền miễn phí.',
                                'Rào cản động lực' => 'Quản lý lớp đôn đốc nhắc nhở deadline + Diễn đàn kết nối học viên.',
                                'Rào cản thực tế' => 'Workshop chuyên đề cùng CEO và chuyên gia đầu ngành phân tích case study tại Việt Nam.'
                            ]
                        ],
                        'programs' => [
                            'Swiss UMEF MBA' => [
                                'name' => 'Online MBA (Thạc sĩ Quản trị Kinh doanh Trực tuyến)',
                                'tuition_fee' => '12.900 CHF',
                                'url' => 'https://ideas.edu.vn/mba',
                                'credits' => '90 ECTS (12 modules + MBA Thesis)',
                                'duration' => '16-18 tháng',
                                'target' => 'Quản lý, chuyên viên, định hướng nghiên cứu, giảng dạy hoặc định cư quốc tế.'
                            ],
                            'Swiss UMEF EMBA' => [
                                'name' => 'Executive MBA (Thạc sĩ Điều hành QTKD)',
                                'tuition_fee' => '12.900 CHF',
                                'url' => 'https://ideas.edu.vn/emba',
                                'credits' => '60 ECTS (10 modules, KHÔNG LÀM LUẬN VĂN)',
                                'duration' => '12-14 tháng',
                                'target' => 'Giám đốc, Founder, Quản lý cấp cao bận rộn; học nhanh nhất, áp dụng ngay vào quản trị; đủ điều kiện học tiếp lên Tiến sĩ (DBA).'
                            ],
                            'Swiss UMEF MSc Applied AI' => [
                                'name' => 'Master AI - MSc Applied AI (Thạc sĩ AI Ứng dụng)',
                                'tuition_fee' => '12.900 CHF',
                                'url' => 'https://ideas.edu.vn/mscai',
                                'credits' => '90 ECTS (12 modules + Capstone Project)',
                                'duration' => '16-18 tháng',
                                'target' => 'Lãnh đạo ứng dụng AI vào quản trị & tự động hóa doanh nghiệp, KHÔNG YÊU CẦU BIẾT VIẾT CODE.'
                            ],
                            'Swiss UMEF MBA in AI' => [
                                'name' => 'MBA in AI (Thạc sĩ QTKD Ứng dụng AI)',
                                'tuition_fee' => '10.970 CHF',
                                'url' => 'https://ideas.edu.vn/mbainai',
                                'duration' => '14-16 tháng'
                            ],
                            'Swiss UMEF BBA' => [
                                'name' => 'Global Online BBA (Cử nhân QTKD Quốc tế)',
                                'tuition_fee' => '13.500 CHF',
                                'url' => 'https://ideas.edu.vn/bba',
                                'target' => 'Đầu tư thông minh cho Cử nhân Quốc tế Thụy Sĩ.'
                            ],
                            'Swiss UMEF Top-up BBA' => [
                                'name' => 'Top-up BBA (Liên thông Cử nhân Quốc tế 12 tháng)',
                                'duration' => '12 tháng',
                                'target' => 'Người tốt nghiệp Cao đẳng hoặc sinh viên đã hoàn thành năm 2-3 Đại học.'
                            ],
                            'MBA ISTEC Paris' => [
                                'name' => 'MBA ISTEC Paris (Leadership & Business Transformation)',
                                'tuition_fee' => '6.500 EUR + 200 EUR lệ phí hồ sơ (Học phí gốc 8.500 EUR)',
                                'credits' => '60 ECTS, chuẩn Pháp RNCP Level 7 (Bac+5)',
                                'duration' => '14-16 tháng',
                                'target' => 'Thạc sĩ chuẩn Pháp Grande École, định hướng Chiến lược & Chuyển đổi số.'
                            ],
                            'DBA ISTEC Paris' => [
                                'name' => 'DBA ISTEC Paris (Tiến sĩ Quản trị Kinh doanh)',
                                'tuition_fee' => '13.000 EUR trọn gói 3 năm',
                                'credits' => '180 ECTS, RNCP Level 8 / EQF Level 8 cao nhất Châu Âu, WES Earned Doctorate tại Mỹ/Canada',
                                'duration' => '03 năm chính quy',
                                'mentorship' => 'Hướng dẫn 1:1 Giáo sư quốc tế + AI Copilot 24/7 + hỗ trợ độc quyền từ IDEAS.'
                            ],
                            'Dual DBA ESTIAM & RB College' => [
                                'name' => 'Dual DBA (Tiến sĩ song bằng Pháp & Anh)',
                                'tuition_fee' => '12.500 EUR (Giảm 3.000 EUR còn 9.500 EUR cho cựu học viên IDEAS)',
                                'duration' => '2.5 - 4 năm',
                                'support' => 'Hội đồng chuyên môn Viện IDEAS thẩm định Final Draft Review hỗ trợ hướng đi luận án.'
                            ]
                        ],
                        'training_systems' => [
                            'Standard' => 'Tự học qua LMS Moodle, Video bài giảng, Lớp bổ trợ Chủ Nhật tiếng Việt và IDEAS AI Platform.',
                            'High Quality (HQ)' => 'Tương tác trực tiếp (Live) với giảng viên Thụy Sĩ, ĐẶC BIỆT bao gồm 2 chuyến đi Thụy Sĩ (Study Trip + Lễ tốt nghiệp).'
                        ],
                        'notes' => 'Bằng cấp nhận được giữa hệ HQ và Standard giống nhau 100%. Bằng online 100% chưa thuộc diện công nhận VN-NARIC cho thi công chức nhưng có uy tín và giá trị thực tiễn vượt trội tại khối Doanh nghiệp Tư nhân và Tập đoàn nước ngoài. Nếu cần công nhận tại VN, học viên chọn chương trình kết hợp 70% trực tiếp Thụy Sĩ - 30% online.'
                    ];
                }

                // ==========================================
                // 9. GET MY PAYSLIP (HRM SST DEFENSE)
                // ==========================================
                case 'get_my_payslip': {
                    $month = isset($args['month']) ? (int)$args['month'] : null;
                    $year = isset($args['year']) ? (int)$args['year'] : (int)date('Y');

                    if ($month !== null && $month >= 1 && $month <= 12) {
                        $period = sprintf('%04d-%02d', $year, $month);
                        $stmt = $db->prepare("SELECT * FROM monthly_payslips WHERE user_id = ? AND month_year = ? LIMIT 1");
                        $stmt->execute([$uid, $period]);
                    } else {
                        // Get the latest payslip for this user
                        $stmt = $db->prepare("SELECT * FROM monthly_payslips WHERE user_id = ? ORDER BY month_year DESC LIMIT 1");
                        $stmt->execute([$uid]);
                    }

                    $ps = $stmt->fetch(PDO::FETCH_ASSOC);
                    if (!$ps) {
                        return [
                            'success' => true,
                            'has_record' => false,
                            'message' => "Hiện tại hệ thống chưa có dữ liệu bảng lương được ghi nhận cho bạn" . ($month ? " trong tháng {$month}/{$year}." : ".") . " Bạn có thể kiểm tra lại tại mục Phiếu lương (/my-payslips) hoặc liên hệ phòng Nhân sự/Kế toán.",
                            'route_url' => '/my-payslips'
                        ];
                    }

                    $stMap = [
                        'draft' => 'Bản nháp (Đang lập)',
                        'pending_approval' => 'Chờ duyệt',
                        'approved' => 'Đã duyệt',
                        'confirmed' => 'Đã xác nhận & ký nhận',
                        'paid' => 'Đã thanh toán',
                        'disputed' => 'Đang có khiếu nại'
                    ];
                    $stText = $stMap[$ps['status']] ?? ($ps['status'] ?: 'Đang xử lý');

                    return [
                        'success' => true,
                        'has_record' => true,
                        'month_year' => $ps['month_year'],
                        'net_salary' => number_format((float)$ps['net_salary'], 0, ',', '.') . ' VND',
                        'basic_salary' => number_format((float)$ps['salary_basic_calculated'], 0, ',', '.') . ' VND',
                        'allowance_total' => number_format((float)$ps['allowance_total'], 0, ',', '.') . ' VND',
                        'kpi_bonus' => number_format((float)$ps['kpi_bonus'], 0, ',', '.') . ' VND',
                        'deductions' => [
                            'insurance_bhxh' => number_format((float)$ps['insurance_bhxh'], 0, ',', '.') . ' VND',
                            'tax_pit' => number_format((float)$ps['tax_pit'], 0, ',', '.') . ' VND',
                            'advance_deduction' => number_format((float)$ps['advance_deduction'], 0, ',', '.') . ' VND',
                            'lateness_penalty' => number_format((float)$ps['lateness_penalty'], 0, ',', '.') . ' VND',
                        ],
                        'work_days_actual' => (float)$ps['work_days_actual'],
                        'work_days_required' => (int)$ps['work_days_required'],
                        'status' => $stText,
                        'is_confirmed' => !empty($ps['confirmed_at']),
                        'route_url' => '/my-payslips',
                        'summary' => "Phiếu lương kỳ {$ps['month_year']} của bạn: Thực nhận " . number_format((float)$ps['net_salary'], 0, ',', '.') . " VND. Số ngày công thực tế: {$ps['work_days_actual']}/{$ps['work_days_required']} ngày. Trạng thái: {$stText}."
                    ];
                }

                // ==========================================
                // 9B. GET EXECUTIVE MORNING BRIEF (PROACTIVE ANTICIPATION)
                // ==========================================
                case 'get_executive_morning_brief': {
                    $focus = $args['focus'] ?? 'overview';

                    // 1. Pending Approvals awaiting current user
                    $pendingApprovalsCount = 0;
                    try {
                        $stmtExp = $db->prepare("SELECT COUNT(*) FROM expenses WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'pending' AND (created_by = ? OR approver_id = ? OR approver_id_2 = ? OR approver_id_3 = ? " . ($isGlobalAdmin ? "OR approver_id IS NULL OR approver_id = 0" : "") . ")");
                        $stmtExp->execute([$tid, $uid, $uid, $uid, $uid]);
                        $expCount = (int)$stmtExp->fetchColumn();

                        $stmtLv = $db->prepare("SELECT COUNT(*) FROM hrm_leave_requests WHERE status = 'pending' AND (user_id = ? OR approver_id = ? OR approver_id_2 = ? " . ($isGlobalAdmin ? "OR approver_id IS NULL OR approver_id = 0" : "") . ")");
                        $stmtLv->execute([$uid, $uid, $uid]);
                        $lvCount = (int)$stmtLv->fetchColumn();

                        $pendingApprovalsCount = $expCount + $lvCount;
                    } catch (\Throwable $e) {}

                    // 2. Urgent / Overdue Tasks assigned to current user
                    $urgentTasks = [];
                    $overdueTasksCount = 0;
                    try {
                        $stmtTask = $db->prepare("
                            SELECT a.id, a.subject, a.due_date, a.priority, a.progress
                            FROM activities a
                            WHERE a.tenant_id = ? AND a.deleted_at IS NULL AND a.type = 'task'
                              AND a.status NOT IN ('done', 'completed', 'cancelled')
                              AND (a.user_id = ? OR FIND_IN_SET(?, IFNULL(a.participant_ids, '')))
                              AND a.due_date IS NOT NULL AND a.due_date <= CURDATE()
                            ORDER BY a.due_date ASC, a.priority DESC
                            LIMIT 5
                        ");
                        $stmtTask->execute([$tid, $uid, (string)$uid]);
                        $tasksRows = $stmtTask->fetchAll(PDO::FETCH_ASSOC) ?: [];
                        $overdueTasksCount = count($tasksRows);
                        foreach ($tasksRows as $tr) {
                            $isOverdue = (strtotime($tr['due_date']) < strtotime(date('Y-m-d')));
                            $urgentTasks[] = [
                                'id' => (int)$tr['id'],
                                'title' => $tr['subject'],
                                'due_date' => date('d/m/Y', strtotime($tr['due_date'])),
                                'is_overdue' => $isOverdue,
                                'progress' => (int)$tr['progress'] . '%'
                            ];
                        }
                    } catch (\Throwable $e) {}

                    // 3. CRM Leads (New today / Stale > 24h)
                    $crmHighlights = [
                        'today_new_leads' => 0,
                        'stale_uncontacted' => 0
                    ];
                    try {
                        $baseCrmWhere = "tenant_id = ? AND deleted_at IS NULL";
                        $baseCrmParams = [$tid];
                        if (!$canAccessAllContacts) {
                            $rbac = $getContactRbacClause('');
                            $baseCrmWhere .= " AND " . $rbac['clause'];
                            $baseCrmParams = array_merge($baseCrmParams, $rbac['params']);
                        }
                        $stmtCrm = $db->prepare("
                            SELECT 
                                SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today_new,
                                SUM(CASE WHEN (status IN ('new', 'chua_lien_he', 'moi') OR stage_id IN (1, 2)) AND created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) as stale_count
                            FROM contacts
                            WHERE $baseCrmWhere
                        ");
                        $stmtCrm->execute($baseCrmParams);
                        $crmRow = $stmtCrm->fetch(PDO::FETCH_ASSOC) ?: [];
                        $crmHighlights['today_new_leads'] = (int)($crmRow['today_new'] ?? 0);
                        $crmHighlights['stale_uncontacted'] = (int)($crmRow['stale_count'] ?? 0);
                    } catch (\Throwable $e) {}

                    // 4. Synthesize Briefing Summary
                    $greetingName = $authContext['clean_name'] ?? ($authContext['name'] ?? 'bạn');
                    $bullets = [];
                    if ($pendingApprovalsCount > 0) {
                        $bullets[] = "⚡ Có {$pendingApprovalsCount} đơn từ / đề xuất chi đang chờ bạn xử lý.";
                    }
                    if ($overdueTasksCount > 0) {
                        $bullets[] = "📌 Có {$overdueTasksCount} công việc quá hạn hoặc cần hoàn thành trong hôm nay.";
                    }
                    if ($crmHighlights['today_new_leads'] > 0 || $crmHighlights['stale_uncontacted'] > 0) {
                        $bullets[] = "🎯 CRM: {$crmHighlights['today_new_leads']} lead mới hôm nay, {$crmHighlights['stale_uncontacted']} lead chưa tương tác quá 24h.";
                    }

                    if (empty($bullets)) {
                        $summaryText = "Dạ {$greetingName} ơi, hôm nay tiến độ công việc của mình rất ổn định, không có phiếu phê duyệt tồn đọng hay công việc khẩn cấp bị quá hạn.";
                    } else {
                        $summaryText = "Dạ {$greetingName} ơi, đây là bản tin điều hành nhanh hôm nay:\n" . implode("\n", $bullets);
                    }

                    return [
                        'success' => true,
                        'date' => date('d/m/Y'),
                        'summary' => $summaryText,
                        'pending_approvals_count' => $pendingApprovalsCount,
                        'overdue_tasks_count' => $overdueTasksCount,
                        'urgent_tasks' => $urgentTasks,
                        'crm_highlights' => $crmHighlights,
                        'recommended_actions' => array_values(array_filter([
                            $pendingApprovalsCount > 0 ? "Xem danh sách {$pendingApprovalsCount} đơn chờ duyệt" : null,
                            $overdueTasksCount > 0 ? "Xử lý các công việc gấp hôm nay" : null,
                            $crmHighlights['stale_uncontacted'] > 0 ? "Chăm sóc lead tồn đọng quá 24h" : null,
                            "Tra cứu bảng lương hoặc chấm công tháng này"
                        ]))
                    ];
                }

                // ==========================================
                // 10. GET MY CRM INBOX (SALES LEADS DEFENSE)
                // ==========================================
                case 'get_my_crm_inbox': {
                    $filter = $args['filter'] ?? 'today_leads';
                    $limit = min(10, max(1, (int)($args['limit'] ?? 5)));

                    // Base RBAC condition
                    $baseWhere = "c.tenant_id = ? AND c.deleted_at IS NULL";
                    $baseParams = [$tid];

                    // Zero-Trust Sales & Staff Isolation
                    if (!$canAccessAllContacts) {
                        $rbac = $getContactRbacClause('c');
                        $baseWhere .= " AND " . $rbac['clause'];
                        $baseParams = array_merge($baseParams, $rbac['params']);
                    }

                    // 1. Aggregated CRM Stats
                    $statSql = "SELECT 
                                    COUNT(1) as total_assigned,
                                    SUM(CASE WHEN DATE(c.created_at) = CURDATE() THEN 1 ELSE 0 END) as today_new,
                                    SUM(CASE WHEN c.status IN ('new', 'chua_lien_he', 'moi') OR c.stage_id IN (1, 2) THEN 1 ELSE 0 END) as uncontacted_count
                                FROM contacts c
                                WHERE $baseWhere";
                    $statStmt = $db->prepare($statSql);
                    $statStmt->execute($baseParams);
                    $stats = $statStmt->fetch(PDO::FETCH_ASSOC) ?: [];

                    $totalAssigned = (int)($stats['total_assigned'] ?? 0);
                    $todayNew = (int)($stats['today_new'] ?? 0);
                    $uncontactedCount = (int)($stats['uncontacted_count'] ?? 0);

                    // 2. Fetch TOP Slice
                    $sliceWhere = $baseWhere;
                    $sliceParams = $baseParams;

                    if ($filter === 'today_leads') {
                        $sliceWhere .= " AND DATE(c.created_at) = CURDATE()";
                    } elseif ($filter === 'uncontacted') {
                        $sliceWhere .= " AND (c.status IN ('new', 'chua_lien_he', 'moi') OR c.stage_id IN (1, 2))";
                    }

                    $sliceSql = "SELECT c.id, c.full_name, c.phone, c.email, c.status, c.created_at, ps.name as stage_name
                                 FROM contacts c
                                 LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
                                 WHERE $sliceWhere
                                 ORDER BY c.id DESC LIMIT $limit";
                    $sliceStmt = $db->prepare($sliceSql);
                    $sliceStmt->execute($sliceParams);
                    $leads = $sliceStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    // Fallback: If filtered returned 0 but total > 0, fetch latest active
                    if (empty($leads) && $totalAssigned > 0 && $filter !== 'all') {
                        $fbSql = "SELECT c.id, c.full_name, c.phone, c.email, c.status, c.created_at, ps.name as stage_name
                                  FROM contacts c
                                  LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
                                  WHERE $baseWhere
                                  ORDER BY c.id DESC LIMIT $limit";
                        $fbStmt = $db->prepare($fbSql);
                        $fbStmt->execute($baseParams);
                        $leads = $fbStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                    }

                    $formattedLeads = [];
                    foreach ($leads as $l) {
                        $formattedLeads[] = [
                            'id' => (int)$l['id'],
                            'name' => $l['full_name'],
                            'phone' => $l['phone'],
                            'email' => $l['email'] ?: null,
                            'stage' => $l['stage_name'] ?: ($l['status'] ?: 'Tiềm năng mới'),
                            'created_date' => date('d/m/Y H:i', strtotime($l['created_at'])),
                            'link' => '/contacts?id=' . $l['id']
                        ];
                    }

                    return [
                        'success' => true,
                        'statistics' => [
                            'total_assigned' => $totalAssigned,
                            'today_new' => $todayNew,
                            'uncontacted' => $uncontactedCount
                        ],
                        'returned_count' => count($formattedLeads),
                        'leads' => $formattedLeads,
                        'summary' => "Hòm thư tiềm năng của bạn: Tổng cộng có {$totalAssigned} khách hàng đang phụ trách ({$todayNew} tiềm năng mới tiếp nhận hôm nay, {$uncontactedCount} khách chưa liên hệ).",
                        'route_url' => '/contacts'
                    ];
                }

                // ==========================================
                // 11. GET ACTIVE PROJECTS & CAMPAIGNS
                // ==========================================
                case 'get_active_projects_and_campaigns': {
                    $type = $args['type'] ?? 'all';
                    $search = trim($args['search_keyword'] ?? '');
                    $limit = min(10, max(1, (int)($args['limit'] ?? 5)));

                    $resProjects = [];
                    $resCampaigns = [];

                    if ($type === 'all' || $type === 'projects') {
                        $pWhere = "p.tenant_id = ? AND p.deleted_at IS NULL AND (p.status = 'active' OR p.status IS NULL OR p.status = '1')";
                        $pParams = [$tid];
                        if (!empty($search)) {
                            $pWhere .= " AND (p.name LIKE ? OR p.code LIKE ?)";
                            $pParams[] = '%' . $search . '%';
                            $pParams[] = '%' . $search . '%';
                        }
                        $pStmt = $db->prepare("SELECT p.id, p.name, p.code, p.developer, p.location FROM projects p WHERE $pWhere ORDER BY p.id DESC LIMIT $limit");
                        $pStmt->execute($pParams);
                        $resProjects = $pStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                    }

                    if ($type === 'all' || $type === 'campaigns') {
                        $cWhere = "c.tenant_id = ? AND (c.status = 'active' OR c.status IS NULL OR c.status = '1')";
                        $cParams = [$tid];
                        if (!empty($search)) {
                            $cWhere .= " AND (c.name LIKE ? OR c.description LIKE ?)";
                            $cParams[] = '%' . $search . '%';
                            $cParams[] = '%' . $search . '%';
                        }
                        $cStmt = $db->prepare("
                            SELECT c.id, c.name, c.description, c.project_id, (SELECT name FROM projects WHERE id = c.project_id) as project_name
                            FROM marketing_campaigns c
                            WHERE $cWhere ORDER BY c.id DESC LIMIT $limit
                        ");
                        $cStmt->execute($cParams);
                        $resCampaigns = $cStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                    }

                    return [
                        'success' => true,
                        'total_projects_found' => count($resProjects),
                        'projects' => array_map(function($p) {
                            return [
                                'id' => (int)$p['id'],
                                'name' => $p['name'],
                                'code' => $p['code'],
                                'partner' => $p['developer'] ?: 'IDEAS'
                            ];
                        }, $resProjects),
                        'total_campaigns_found' => count($resCampaigns),
                        'campaigns' => array_map(function($c) {
                            return [
                                'id' => (int)$c['id'],
                                'name' => $c['name'],
                                'code' => 'CAMP-' . $c['id'],
                                'description' => $c['description'] ?: '',
                                'project_name' => $c['project_name'] ?: 'Chung'
                            ];
                        }, $resCampaigns),
                        'route_url' => '/projects'
                    ];
                }

                // ==========================================
                // 12. GET SYSTEM NAVIGATION & DIRECT LINKS
                // ==========================================
                case 'get_system_navigation': {
                    $dest = mb_strtolower(trim($args['destination'] ?? ''));

                    $navMap = [
                        'workspace' => [
                            'keywords' => ['bàn làm việc', 'cong viec', 'công việc', 'task', 'nhiem vu', 'nhiệm vụ', 'workspace'],
                            'title' => 'Bàn làm việc (Workspace)',
                            'url' => '/workspace',
                            'desc' => 'Nơi quản lý toàn bộ các công việc cá nhân, việc được giao, việc cần phối hợp và tiến độ deadline.'
                        ],
                        'approvals' => [
                            'keywords' => ['quy trình', 'quy trinh', 'phê duyệt', 'phe duyet', 'approval', 'approvals', 'duyet don', 'duyệt đơn', 'phiếu duyệt'],
                            'title' => 'Quy trình & Phê duyệt (Approvals)',
                            'url' => '/approvals',
                            'desc' => 'Khu vực xử lý các yêu cầu phê duyệt tập trung: phiếu chi PO, tạm ứng chi phí, đơn xin nghỉ phép, giải trình chấm công.'
                        ],
                        'expenses' => [
                            'keywords' => ['phiếu chi', 'phieu chi', 'chi phí', 'chi phi', 'po', 'purchase order', 'mua hàng', 'thanh toán', 'đề xuất chi'],
                            'title' => 'Quản lý Chi phí & Purchase Order (PO)',
                            'url' => '/expenses',
                            'desc' => 'Tạo mới, theo dõi trạng thái và kiểm duyệt các phiếu đề xuất chi phí, mua sắm và hóa đơn vendor.'
                        ],
                        'deposits' => [
                            'keywords' => ['sales order', 'so', 'phiếu thu', 'phieu thu', 'đặt cọc', 'dat coc', 'cọc', 'đóng tiền', 'hoc phi', 'học phí'],
                            'title' => 'Quản lý Thu phí & Sales Order (SO)',
                            'url' => '/deposits',
                            'desc' => 'Quản lý toàn bộ các giao dịch đặt cọc, nộp học phí, hợp đồng đào tạo và đối soát kế toán.'
                        ],
                        'contacts' => [
                            'keywords' => ['tiềm năng', 'tiem nang', 'lead', 'leads', 'khách hàng', 'khach hang', 'crm', 'contact', 'contacts'],
                            'title' => 'Quản lý Tiềm năng & Leads (CRM)',
                            'url' => '/contacts',
                            'desc' => 'Quản lý danh sách học viên tiềm năng, phân bổ nguồn lead, nhật ký tư vấn cuộc gọi và cập nhật phễu bán hàng.'
                        ],
                        'pipeline' => [
                            'keywords' => ['pipeline', 'phễu', 'deals', 'co hoi', 'cơ hội', 'ban hang', 'bán hàng'],
                            'title' => 'Phễu Tư Vấn & Pipeline',
                            'url' => '/deals',
                            'desc' => 'Xem và kéo thả học viên qua các giai đoạn tiếp cận, hẹn tư vấn, nộp hồ sơ và chốt học viên.'
                        ],
                        'students' => [
                            'keywords' => ['học viên', 'hoc vien', 'sinh viên', 'sinh vien', 'student', 'students', 'hồ sơ', 'ho so'],
                            'title' => 'Quản lý Học viên & Đào tạo',
                            'url' => '/students',
                            'desc' => 'Theo dõi hồ sơ tuyển sinh, tình trạng học tập, nộp hồ sơ, lệ phí và danh sách học viên chính thức.'
                        ],
                        'attendance' => [
                            'keywords' => ['chấm công', 'cham cong', 'duyệt công', 'duyet cong', 'attendance', 'checkin', 'đi trễ', 'di tre', 'nghỉ phép'],
                            'title' => 'Chấm công & Điểm danh',
                            'url' => '/attendance',
                            'desc' => 'Xem bảng chấm công hàng ngày, giải trình đi trễ/quên chấm công và duyệt công của nhân sự.'
                        ],
                        'payslips' => [
                            'keywords' => ['phiếu lương', 'phieu luong', 'bảng lương', 'bang luong', 'lương', 'luong', 'payslip', 'payslips', 'thu nhập'],
                            'title' => 'Phiếu lương cá nhân (My Payslips)',
                            'url' => '/my-payslips',
                            'desc' => 'Xem chi tiết bảng lương từng tháng, xác nhận/ký điện tử bảng lương và gửi khiếu nại (nếu có).'
                        ],
                        'cash_flow' => [
                            'keywords' => ['dòng tiền', 'dong tien', 'cash flow', 'cashflow', 'dự báo', 'du bao'],
                            'title' => 'Dự báo dòng tiền (Cash Flow)',
                            'url' => '/cash-flow',
                            'desc' => 'Biểu đồ và phân tích dòng tiền vào/ra, cân đối ngân sách và dự báo thanh khoản công ty.'
                        ],
                        'hrm' => [
                            'keywords' => ['nhân sự', 'nhan su', 'hrm', 'nhân viên', 'nhan vien', 'hồ sơ nhân sự', 'phòng ban', 'phong ban'],
                            'title' => 'Quản trị Nhân sự (HRM)',
                            'url' => '/hrm',
                            'desc' => 'Quản lý danh sách nhân viên, hợp đồng lao động, cấu hình phép năm và chính sách đãi ngộ.'
                        ],
                        'projects' => [
                            'keywords' => ['dự án', 'du an', 'chương trình', 'chuong trinh', 'khóa học', 'khoa hoc', 'chiến dịch', 'chien dich', 'project', 'campaign'],
                            'title' => 'Dự án & Khóa học',
                            'url' => '/projects',
                            'desc' => 'Quản lý các chương trình đào tạo quốc tế (EMBA, MBA, MSc AI...) và các chiến dịch tuyển sinh.'
                        ],
                        'settings' => [
                            'keywords' => ['cài đặt', 'cai dat', 'hệ thống', 'he thong', 'cấu hình', 'cau hinh', 'settings', 'config'],
                            'title' => 'Cài đặt hệ thống',
                            'url' => '/settings',
                            'desc' => 'Thiết lập cấu hình chung ERP, thông số email/SMS, tích hợp API và phân quyền quản trị.'
                        ]
                    ];

                    $matched = null;
                    foreach ($navMap as $k => $info) {
                        if ($matched) break;
                        foreach ($info['keywords'] as $kw) {
                            if (mb_stripos($dest, $kw) !== false) {
                                $matched = $info;
                                break;
                            }
                        }
                    }

                    if (!$matched) {
                        $matched = [
                            'title' => 'Tổng quan hệ thống MYERP',
                            'url' => '/workspace',
                            'desc' => 'Bàn làm việc trung tâm chứa danh sách công việc và lối tắt đến các phân hệ.'
                        ];
                    }

                    return [
                        'success' => true,
                        'title' => $matched['title'],
                        'url' => $matched['url'],
                        'description' => $matched['desc'],
                        'guide' => "Bạn có thể truy cập trực tiếp tại: {$matched['url']} hoặc nhấp vào thanh Menu điều hướng bên trái."
                    ];
                }

                // ==========================================
                // 13. GET FINANCIAL OVERVIEW (ADMIN/ACCOUNTANT)
                // ==========================================
                case 'get_financial_overview': {
                    if (!$isGlobalAdmin && !$isAccountant) {
                        return [
                            'success' => false,
                            'message' => 'Tính năng tra cứu số liệu tài chính doanh thu yêu cầu quyền Quản trị viên (Admin/Director) hoặc Kế toán.',
                            'restricted' => true
                        ];
                    }

                    $month = min(12, max(1, (int)($args['month'] ?? date('n'))));
                    $year = (int)($args['year'] ?? date('Y'));
                    $period = sprintf('%04d-%02d', $year, $month);

                    // Sum Approved Deposits (Sales Orders / Cash In)
                    $stmtIn = $db->prepare("
                        SELECT COUNT(1) as total_slips, IFNULL(SUM(price), 0) as total_in
                        FROM deposits
                        WHERE tenant_id = ? AND status = 'approved' AND created_at LIKE ?
                    ");
                    $stmtIn->execute([$tid, $period . '-%']);
                    $inRow = $stmtIn->fetch(PDO::FETCH_ASSOC) ?: [];
                    $totalIn = (float)($inRow['total_in'] ?? 0);
                    $countIn = (int)($inRow['total_slips'] ?? 0);

                    // Sum Approved Expenses (Purchase Orders / Cash Out)
                    $stmtOut = $db->prepare("
                        SELECT COUNT(1) as total_pos, IFNULL(SUM(amount), 0) as total_out
                        FROM expenses
                        WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'approved' AND created_at LIKE ?
                    ");
                    $stmtOut->execute([$tid, $period . '-%']);
                    $outRow = $stmtOut->fetch(PDO::FETCH_ASSOC) ?: [];
                    $totalOut = (float)($outRow['total_out'] ?? 0);
                    $countOut = (int)($outRow['total_pos'] ?? 0);

                    // Pending counts
                    $stmtPendingSO = $db->prepare("SELECT COUNT(1), IFNULL(SUM(price), 0) FROM deposits WHERE tenant_id = ? AND status = 'pending'");
                    $stmtPendingSO->execute([$tid]);
                    [$pendingSOCount, $pendingSOAmount] = $stmtPendingSO->fetch(PDO::FETCH_NUM) ?: [0, 0];

                    $stmtPendingPO = $db->prepare("SELECT COUNT(1), IFNULL(SUM(amount), 0) FROM expenses WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'pending'");
                    $stmtPendingPO->execute([$tid]);
                    [$pendingPOCount, $pendingPOAmount] = $stmtPendingPO->fetch(PDO::FETCH_NUM) ?: [0, 0];

                    return [
                        'success' => true,
                        'period' => "Tháng {$month}/{$year}",
                        'cash_in_approved' => number_format($totalIn, 0, ',', '.') . ' VND (' . $countIn . ' phiếu thu SO)',
                        'cash_out_approved' => number_format($totalOut, 0, ',', '.') . ' VND (' . $countOut . ' phiếu chi PO)',
                        'net_balance' => number_format($totalIn - $totalOut, 0, ',', '.') . ' VND',
                        'pending_approvals' => [
                            'pending_so_count' => (int)$pendingSOCount,
                            'pending_so_amount' => number_format((float)$pendingSOAmount, 0, ',', '.') . ' VND',
                            'pending_po_count' => (int)$pendingPOCount,
                            'pending_po_amount' => number_format((float)$pendingPOAmount, 0, ',', '.') . ' VND',
                        ],
                        'routes' => [
                            'deposits' => '/deposits',
                            'expenses' => '/expenses',
                            'cash_flow' => '/cash-flow'
                        ],
                        'summary' => "Tổng quan tài chính tháng {$month}/{$year}: Đã thu " . number_format($totalIn, 0, ',', '.') . " VND ({$countIn} đơn SO), đã chi " . number_format($totalOut, 0, ',', '.') . " VND ({$countOut} đơn PO). Chênh lệch dòng tiền: " . number_format($totalIn - $totalOut, 0, ',', '.') . " VND."
                    ];
                }

                // ==========================================
                // 14. DRAFT ACTION PROPOSAL (HUMAN-IN-THE-LOOP)
                // ==========================================
                case 'draft_action_proposal': {
                    $actionType = $args['action_type'] ?? 'task';
                    $title = $args['title'] ?? 'Đề xuất hành động ERP';
                    $summary = $args['summary'] ?? '';
                    $params = [];
                    if (isset($args['params']) && is_array($args['params'])) {
                        $params = $args['params'];
                    } elseif (isset($args['params_json']) && is_array($args['params_json'])) {
                        $params = $args['params_json'];
                    } elseif (!empty($args['params_json']) && is_string($args['params_json'])) {
                        $params = json_decode($args['params_json'], true) ?: [];
                    }


                    $ambiguousNotice = null;
                    
                    // Attach sender metadata to all proposal cards
                    if (empty($params['created_by'])) $params['created_by'] = $uid;
                    if (empty($params['created_by_name'])) $params['created_by_name'] = $auth['full_name'] ?? ($auth['user_full_name'] ?? '');
                    if (empty($params['created_by_avatar']) && !empty($auth['avatar_url'])) $params['created_by_avatar'] = $auth['avatar_url'];
                    if (empty($params['created_at'])) $params['created_at'] = date('H:i:s d/m/Y');

                    if ($actionType === 'export_data') {
                        $exportType = $params['export_type'] ?? ($params['type'] ?? 'contact');
                        if (empty($params['download_url'])) {
                            $queryParams = http_build_query(array_filter([
                                'type' => $exportType,
                                'search' => $params['search'] ?? '',
                                'lead_status' => $params['lead_status'] ?? '',
                                'status' => $params['status'] ?? '',
                                'segment' => $params['segment'] ?? '',
                                'from' => $params['from'] ?? '',
                                'to' => $params['to'] ?? '',
                                'date_field' => $params['date_field'] ?? '',
                                'team_id' => $params['team_id'] ?? '',
                                'owner_id' => $params['owner_id'] ?? '',
                                'tag' => $params['tag'] ?? ''
                            ]));
                            $params['download_url'] = '/export?' . $queryParams;
                        }
                        if (empty($params['filename'])) {
                            $params['filename'] = 'export_' . $exportType . '_' . date('Ymd_His') . '.csv';
                        }
                    }

                    if ($actionType === 'task') {
                        // Creator is ALWAYS the current chatting user
                        $params['created_by'] = $uid;
                        $params['created_by_id'] = $uid;
                        $params['created_by_name'] = $auth['full_name'] ?? ($auth['user_full_name'] ?? '');

                        // Smart assignee lookup
                        $targetAssignee = trim($params['assignee_name'] ?? ($params['assignee'] ?? ($params['user_name'] ?? '')));
                        if (empty($params['user_id']) && !empty($targetAssignee)) {
                            $stmtU = $db->prepare("
                                SELECT id, full_name, email, role, job_title 
                                FROM users 
                                WHERE tenant_id = ? 
                                  AND (full_name LIKE ? OR username LIKE ?) 
                                  AND status != 'inactive' 
                                  AND deleted_at IS NULL
                            ");
                            $stmtU->execute([$tid, '%' . $targetAssignee . '%', '%' . $targetAssignee . '%']);
                            $matchedStaff = $stmtU->fetchAll(PDO::FETCH_ASSOC) ?: [];
                            if (count($matchedStaff) === 1) {
                                $params['user_id'] = (int)$matchedStaff[0]['id'];
                                $params['assignee_name'] = $matchedStaff[0]['full_name'];
                            } elseif (count($matchedStaff) > 1) {
                                $params['ambiguous_assignees'] = array_map(fn($s) => [
                                    'id' => (int)$s['id'],
                                    'name' => $s['full_name'],
                                    'role' => $s['role'] ?? '',
                                    'title' => $s['job_title'] ?? ''
                                ], $matchedStaff);
                                $ambiguousNames = array_map(fn($s) => "{$s['full_name']} ({$s['job_title']})", $matchedStaff);
                                $ambiguousNotice = "CẢNH BÁO TRÙNG TÊN: Có " . count($matchedStaff) . " nhân sự tên '{$targetAssignee}': " . implode(', ', $ambiguousNames) . ". Bạn BẮT BUỘC hỏi lại người dùng để xác nhận giao cho ai!";
                            }
                        }

                        // Smart team lookup
                        $targetTeam = trim($params['team_name'] ?? ($params['department'] ?? ''));
                        if (empty($params['team_id']) && !empty($targetTeam)) {
                            $stmtT = $db->prepare("SELECT id, name FROM teams WHERE tenant_id = ? AND name LIKE ? LIMIT 1");
                            $stmtT->execute([$tid, '%' . $targetTeam . '%']);
                            $matchedTeam = $stmtT->fetch(PDO::FETCH_ASSOC);
                            if ($matchedTeam) {
                                $params['team_id'] = (int)$matchedTeam['id'];
                                $params['team_name'] = $matchedTeam['name'];
                            }
                        }
                    }

                    $proposalCard = [
                        'action_type' => $actionType,
                        'title' => $title,
                        'summary' => $summary,
                        'params' => $params
                    ];

                    $cardStr = "<<<ACTION_PROPOSAL: " . json_encode($proposalCard, JSON_UNESCAPED_UNICODE) . ">>>";

                    $instruction = 'Bạn hãy gửi kèm thẻ hành động sau đây ở cuối câu trả lời để người dùng có thể bấm xác nhận hoặc kiểm tra lại ngay trên giao diện: ' . $cardStr;
                    if ($ambiguousNotice) {
                        $instruction .= "\n" . $ambiguousNotice;
                    }

                    return [
                        'success' => true,
                        'action_type' => $actionType,
                        'card_rendered' => $cardStr,
                        'instruction' => $instruction,
                        'ambiguous_assignees' => $params['ambiguous_assignees'] ?? null
                    ];
                }

                // ==========================================
                // 15B. DIRECT TOOL 1: APPROVE OR REJECT ERP TICKET
                // ==========================================
                case 'approve_or_reject_erp_ticket': {
                    $ticketType = strtolower(trim($args['ticket_type'] ?? ''));
                    $ticketId = (int)($args['ticket_id'] ?? 0);
                    $decision = strtolower(trim($args['decision'] ?? 'approved'));
                    $decision = in_array($decision, ['approved', 'rejected'], true) ? $decision : 'approved';
                    $reason = trim($args['reason'] ?? '');

                    if ($ticketId <= 0) {
                        return ['success' => false, 'message' => 'Vui lòng cung cấp mã ID hợp lệ của phiếu duyệt cần xử lý.'];
                    }

                    if (!in_array($ticketType, ['leave', 'salary_advance', 'expense', 'check_in'], true)) {
                        return ['success' => false, 'message' => "Loại phiếu '{$ticketType}' không hợp lệ. Hỗ trợ: leave, salary_advance, expense, check_in."];
                    }

                    $actionVerb = ($decision === 'approved') ? 'phê duyệt' : 'từ chối';

                    if ($ticketType === 'leave') {
                        $db->beginTransaction();
                        try {
                            $q = $db->prepare("SELECT l.*, u.full_name as employee_name FROM hrm_leave_requests l JOIN users u ON l.user_id = u.id WHERE l.id = ? AND u.tenant_id = ? FOR UPDATE");
                            $q->execute([$ticketId, $tid]);
                            $ticket = $q->fetch(PDO::FETCH_ASSOC);
                            if (!$ticket) {
                                $db->rollBack();
                                return ['success' => false, 'message' => "Không tìm thấy đơn nghỉ phép ID #{$ticketId} hoặc không thuộc chi nhánh của bạn."];
                            }

                            if ($ticket['status'] !== 'pending') {
                                $db->rollBack();
                                return ['success' => false, 'message' => "Đơn nghỉ phép #{$ticketId} đã được xử lý trước đó (Trạng thái hiện tại: {$ticket['status']})."];
                            }

                            $isCreator = ((int)$ticket['user_id'] === $uid);
                            if ($isCreator && !$isGlobalAdmin) {
                                $db->rollBack();
                                return ['success' => false, 'message' => 'Người tạo đơn không được tự phê duyệt đề xuất nghỉ phép của chính mình.'];
                            }

                            $isApprover1 = ((int)($ticket['approver_id'] ?? 0) === $uid);
                            $isApprover2 = ((int)($ticket['approver_id_2'] ?? 0) === $uid);
                            $canApprove = $isGlobalAdmin || $isHR || $isManager || $isApprover1 || $isApprover2;
                            if (!$canApprove) {
                                $db->rollBack();
                                return ['success' => false, 'message' => "Bạn không có quyền {$actionVerb} đơn nghỉ phép này."];
                            }

                            if ($isApprover2 && !$isApprover1 && !$isGlobalAdmin) {
                                if (($ticket['status_level_1'] ?? 'pending') === 'pending') {
                                    $db->rollBack();
                                    return ['success' => false, 'message' => 'Cần có phê duyệt Cấp 1 trước khi người phê duyệt Cấp 2 xử lý đơn này.'];
                                }
                            }

                            $empName = $ticket['employee_name'] ?: 'Nhân sự';

                            if ($decision === 'rejected') {
                                $upFields = ["status = 'rejected'", "updated_at = NOW()"];
                                $upParams = [];
                                if ($isApprover1 || $isGlobalAdmin) {
                                    $upFields[] = "status_level_1 = 'rejected'";
                                    $upFields[] = "approved_by = ?";
                                    $upParams[] = $uid;
                                }
                                if ($isApprover2 || $isGlobalAdmin) {
                                    $upFields[] = "status_level_2 = 'rejected'";
                                    $upFields[] = "approved_by_2 = ?";
                                    $upParams[] = $uid;
                                }
                                $upParams[] = $ticketId;
                                $db->prepare("UPDATE hrm_leave_requests SET " . implode(', ', $upFields) . " WHERE id = ?")->execute($upParams);
                                $db->commit();
                                return [
                                    'success' => true,
                                    'ticket_type' => 'leave',
                                    'ticket_id' => $ticketId,
                                    'decision' => $decision,
                                    'employee_name' => $empName,
                                    'summary' => "Đã từ chối đơn xin nghỉ phép #{$ticketId} của {$empName}."
                                ];
                            } else {
                                $hasLevel2 = !empty($ticket['approver_id_2']) && (int)$ticket['approver_id_2'] > 0;
                                $upFields = ["updated_at = NOW()"];
                                $upParams = [];

                                if ($isApprover1 || (!$isApprover2 && ($isGlobalAdmin || $isHR || $isManager))) {
                                    $upFields[] = "status_level_1 = 'approved'";
                                    $upFields[] = "approved_by = ?";
                                    $upParams[] = $uid;
                                    if ($hasLevel2 && !$isGlobalAdmin) {
                                        $upFields[] = "status = 'pending'";
                                        $targetStatus = 'pending (Chờ cấp 2 duyệt)';
                                    } else {
                                        $upFields[] = "status = 'approved'";
                                        $upFields[] = "approved_at = NOW()";
                                        $targetStatus = 'approved';
                                    }
                                } elseif ($isApprover2) {
                                    $upFields[] = "status_level_2 = 'approved'";
                                    $upFields[] = "approved_by_2 = ?";
                                    $upParams[] = $uid;
                                    $upFields[] = "status = 'approved'";
                                    $upFields[] = "approved_at = NOW()";
                                    $targetStatus = 'approved';
                                } else {
                                    $upFields[] = "status = 'approved'";
                                    $upFields[] = "approved_by = ?";
                                    $upParams[] = $uid;
                                    $targetStatus = 'approved';
                                }

                                $upParams[] = $ticketId;
                                $db->prepare("UPDATE hrm_leave_requests SET " . implode(', ', $upFields) . " WHERE id = ?")->execute($upParams);
                                $db->commit();
                                return [
                                    'success' => true,
                                    'ticket_type' => 'leave',
                                    'ticket_id' => $ticketId,
                                    'decision' => $decision,
                                    'employee_name' => $empName,
                                    'summary' => "Đã {$actionVerb} đơn xin nghỉ phép #{$ticketId} của {$empName}. Trạng thái cập nhật: {$targetStatus}."
                                ];
                            }
                        } catch (\Throwable $e) {
                            if ($db->inTransaction()) $db->rollBack();
                            throw $e;
                        }
                    } elseif ($ticketType === 'salary_advance') {
                        $db->beginTransaction();
                        try {
                            $q = $db->prepare("SELECT a.*, u.full_name as employee_name FROM hrm_salary_advances a JOIN users u ON a.user_id = u.id WHERE a.id = ? AND u.tenant_id = ? FOR UPDATE");
                            $q->execute([$ticketId, $tid]);
                            $ticket = $q->fetch(PDO::FETCH_ASSOC);
                            if (!$ticket) {
                                $db->rollBack();
                                return ['success' => false, 'message' => "Không tìm thấy đơn tạm ứng lương ID #{$ticketId} hoặc không thuộc chi nhánh của bạn."];
                            }

                            if ($ticket['status'] !== 'pending') {
                                $db->rollBack();
                                return ['success' => false, 'message' => "Đơn tạm ứng lương #{$ticketId} đã được xử lý trước đó (Trạng thái hiện tại: {$ticket['status']})."];
                            }

                            $isCreator = ((int)$ticket['user_id'] === $uid);
                            if ($isCreator && !$isGlobalAdmin) {
                                $db->rollBack();
                                return ['success' => false, 'message' => 'Người tạo đơn không được tự phê duyệt đơn tạm ứng lương của chính mình.'];
                            }

                            $canApprove = $isGlobalAdmin || $isAccountant || $isHR || $isManager || (int)($ticket['approver_id'] ?? 0) === $uid;
                            if (!$canApprove) {
                                $db->rollBack();
                                return ['success' => false, 'message' => "Bạn không có quyền {$actionVerb} đơn tạm ứng lương này."];
                            }

                            $targetStatus = ($decision === 'approved') ? 'approved' : 'rejected';
                            $up = $db->prepare("UPDATE hrm_salary_advances SET status = ?, approver_id = COALESCE(approver_id, ?), updated_at = NOW() WHERE id = ?");
                            $up->execute([$targetStatus, $uid, $ticketId]);
                            $db->commit();

                            $empName = $ticket['employee_name'] ?: 'Nhân sự';
                            $amountFmt = number_format((float)($ticket['amount'] ?? 0), 0, ',', '.') . ' VND';
                            return [
                                'success' => true,
                                'ticket_type' => 'salary_advance',
                                'ticket_id' => $ticketId,
                                'decision' => $decision,
                                'amount' => $amountFmt,
                                'employee_name' => $empName,
                                'summary' => "Đã {$actionVerb} thành công đơn tạm ứng {$amountFmt} (#{$ticketId}) của {$empName}."
                            ];
                        } catch (\Throwable $e) {
                            if ($db->inTransaction()) $db->rollBack();
                            throw $e;
                        }
                    } elseif ($ticketType === 'expense') {
                        $db->beginTransaction();
                        try {
                            $q = $db->prepare("SELECT e.*, u.full_name as creator_name FROM expenses e LEFT JOIN users u ON e.created_by = u.id WHERE e.id = ? AND e.tenant_id = ? AND e.deleted_at IS NULL FOR UPDATE");
                            $q->execute([$ticketId, $tid]);
                            $ticket = $q->fetch(PDO::FETCH_ASSOC);
                            if (!$ticket) {
                                $db->rollBack();
                                return ['success' => false, 'message' => "Không tìm thấy phiếu chi/đề xuất chi phí ID #{$ticketId}."];
                            }

                            if ($ticket['status'] !== 'pending') {
                                $db->rollBack();
                                return ['success' => false, 'message' => "Phiếu chi #{$ticketId} đã được xử lý trước đó (Trạng thái hiện tại: {$ticket['status']})."];
                            }

                            $isCreator = ((int)$ticket['created_by'] === $uid);
                            if ($isCreator && !$isGlobalAdmin && !$isAccountant && !$isManager) {
                                $db->rollBack();
                                return ['success' => false, 'message' => 'Người tạo đề xuất không được tự phê duyệt chi phí của chính mình.'];
                            }

                            $isApp1 = ((int)($ticket['approver_id'] ?? 0) === $uid);
                            $isApp2 = ((int)($ticket['approver_id_2'] ?? 0) === $uid);
                            $isApp3 = ((int)($ticket['approver_id_3'] ?? 0) === $uid);

                            $canApprove = $isGlobalAdmin || $isAccountant || $isManager || $isApp1 || $isApp2 || $isApp3;
                            if (!$canApprove) {
                                $db->rollBack();
                                return ['success' => false, 'message' => "Bạn không có quyền {$actionVerb} phiếu chi/PO này."];
                            }

                            $currentLevel = 0;
                            if (($ticket['status_level_1'] ?? 'pending') === 'pending') {
                                $currentLevel = 1;
                            } elseif ($ticket['status_level_1'] === 'approved' && ($ticket['status_level_2'] ?? 'pending') === 'pending') {
                                $currentLevel = 2;
                            } elseif ($ticket['status_level_1'] === 'approved' && $ticket['status_level_2'] === 'approved' && ($ticket['status_level_3'] ?? 'pending') === 'pending') {
                                $currentLevel = 3;
                            }
                            if ($currentLevel === 0 && $ticket['status'] === 'pending') {
                                $currentLevel = 1;
                            }

                            $expectedApproverId = 0;
                            if ($currentLevel === 1) $expectedApproverId = (int)($ticket['approver_id'] ?? 0);
                            elseif ($currentLevel === 2) $expectedApproverId = (int)($ticket['approver_id_2'] ?? 0);
                            elseif ($currentLevel === 3) $expectedApproverId = (int)($ticket['approver_id_3'] ?? 0);

                            if ($expectedApproverId > 0 && $expectedApproverId !== $uid && !$isGlobalAdmin) {
                                $db->rollBack();
                                return ['success' => false, 'message' => "Bạn không có quyền duyệt cấp {$currentLevel} hoặc chưa đến lượt phê duyệt của bạn."];
                            }

                            $amountFmt = number_format((float)($ticket['amount'] ?? 0), 0, ',', '.') . ' ' . ($ticket['currency'] ?: 'VND');

                            if ($decision === 'rejected') {
                                $levelStatusField = "status_level_" . max(1, $currentLevel);
                                $levelTimeField = ($currentLevel === 1) ? 'approved_at' : (($currentLevel === 2) ? 'approved_at_2' : 'approved_at_3');
                                $upStmt = $db->prepare("UPDATE expenses SET status = 'rejected', approval_status = 'rejected', {$levelStatusField} = 'rejected', {$levelTimeField} = NOW(), reject_reason = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?");
                                $upStmt->execute([$reason ?: 'Từ chối qua AI Agent', $ticketId, $tid]);
                                $db->commit();
                                return [
                                    'success' => true,
                                    'ticket_type' => 'expense',
                                    'ticket_id' => $ticketId,
                                    'decision' => $decision,
                                    'title' => $ticket['title'],
                                    'amount' => $amountFmt,
                                    'summary' => "Đã từ chối phiếu đề xuất chi phí #{$ticketId} ('{$ticket['title']}')."
                                ];
                            } else {
                                $hasLevel2 = !empty($ticket['approver_id_2']) && ($ticket['status_level_2'] ?? '') !== 'none';
                                $hasLevel3 = !empty($ticket['approver_id_3']) && ($ticket['status_level_3'] ?? '') !== 'none';

                                $levelStatusField = "status_level_" . max(1, $currentLevel);
                                $levelTimeField = ($currentLevel === 1) ? 'approved_at' : (($currentLevel === 2) ? 'approved_at_2' : 'approved_at_3');

                                $isFinalLevel = true;
                                if ($currentLevel === 1 && $hasLevel2) $isFinalLevel = false;
                                if ($currentLevel === 2 && $hasLevel3) $isFinalLevel = false;
                                if ($isGlobalAdmin) $isFinalLevel = true;

                                if ($isFinalLevel) {
                                    $upStmt = $db->prepare("UPDATE expenses SET status = 'approved', approval_status = 'approved', {$levelStatusField} = 'approved', {$levelTimeField} = NOW(), approver_id = COALESCE(approver_id, ?), approved_at = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ?");
                                    $upStmt->execute([$uid, $ticketId, $tid]);
                                    $statusSummary = "Đã phê duyệt hoàn tất (Trạng thái: approved)";
                                } else {
                                    $nextLevel = $currentLevel + 1;
                                    $upStmt = $db->prepare("UPDATE expenses SET status = 'pending', approval_status = 'pending', {$levelStatusField} = 'approved', {$levelTimeField} = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ?");
                                    $upStmt->execute([$ticketId, $tid]);
                                    $statusSummary = "Đã duyệt Cấp {$currentLevel}, đang chuyển sang Cấp {$nextLevel} phê duyệt";
                                }

                                $db->commit();
                                return [
                                    'success' => true,
                                    'ticket_type' => 'expense',
                                    'ticket_id' => $ticketId,
                                    'decision' => $decision,
                                    'title' => $ticket['title'],
                                    'amount' => $amountFmt,
                                    'summary' => "{$statusSummary} phiếu đề xuất chi phí #{$ticketId} ('{$ticket['title']}') trị giá {$amountFmt}."
                                ];
                            }
                        } catch (\Throwable $e) {
                            if ($db->inTransaction()) $db->rollBack();
                            throw $e;
                        }
                    } elseif ($ticketType === 'check_in') {
                        $db->beginTransaction();
                        try {
                            $q = $db->prepare("SELECT c.*, u.full_name as employee_name FROM check_ins c JOIN users u ON c.user_id = u.id WHERE c.id = ? AND u.tenant_id = ? FOR UPDATE");
                            $q->execute([$ticketId, $tid]);
                            $ticket = $q->fetch(PDO::FETCH_ASSOC);
                            if (!$ticket) {
                                $db->rollBack();
                                return ['success' => false, 'message' => "Không tìm thấy bản ghi chấm công/giải trình ID #{$ticketId} hoặc không thuộc chi nhánh của bạn."];
                            }

                            $isCreator = ((int)$ticket['user_id'] === $uid);
                            if ($isCreator && !$isGlobalAdmin) {
                                $db->rollBack();
                                return ['success' => false, 'message' => 'Không được tự phê duyệt giải trình chấm công của chính mình.'];
                            }

                            $canApprove = $isGlobalAdmin || $isHR || $isManager;
                            if (!$canApprove) {
                                $db->rollBack();
                                return ['success' => false, 'message' => "Bạn không có quyền {$actionVerb} bản ghi chấm công này (yêu cầu quyền HR, Quản lý hoặc Giám đốc)."];
                            }

                            $targetStatus = ($decision === 'approved') ? 'approved' : 'rejected';
                            $noteAppend = "[{$targetStatus} bởi {$userName} ({$uid}) lúc " . date('d/m/Y H:i') . ($reason ? ": {$reason}" : "") . "]";
                            $adminNote = trim(($ticket['admin_note'] ?? '') . " " . $noteAppend);

                            $up = $db->prepare("UPDATE check_ins SET status = ?, admin_note = ? WHERE id = ?");
                            $up->execute([$targetStatus, $adminNote, $ticketId]);
                            $db->commit();

                            $empName = $ticket['employee_name'] ?: 'Nhân sự';
                            return [
                                'success' => true,
                                'ticket_type' => 'check_in',
                                'ticket_id' => $ticketId,
                                'decision' => $decision,
                                'employee_name' => $empName,
                                'summary' => "Đã {$actionVerb} giải trình chấm công ngày {$ticket['check_in_date']} (#{$ticketId}) của {$empName}."
                            ];
                        } catch (\Throwable $e) {
                            if ($db->inTransaction()) $db->rollBack();
                            throw $e;
                        }
                    }
                }

                // ==========================================
                // 15C. DIRECT TOOL 2: UPDATE TASK PROGRESS & STATUS
                // ==========================================
                case 'update_task_progress_and_status': {
                    $taskId = (int)($args['task_id'] ?? 0);
                    if ($taskId <= 0) {
                        return ['success' => false, 'message' => 'Vui lòng cung cấp mã ID công việc/task cần cập nhật.'];
                    }

                    $stmt = $db->prepare("SELECT a.*, u.full_name as assignee_name FROM activities a LEFT JOIN users u ON a.user_id = u.id WHERE a.id = ? AND a.tenant_id = ? AND a.deleted_at IS NULL AND a.type IN ('task', 'meeting')");
                    $stmt->execute([$taskId, $tid]);
                    $task = $stmt->fetch(PDO::FETCH_ASSOC);
                    if (!$task) {
                        return ['success' => false, 'message' => "Không tìm thấy công việc ID #{$taskId} trên Workspace."];
                    }

                    $participantList = explode(',', (string)($task['participant_ids'] ?? ''));
                    $isAllowed = $isGlobalAdmin || $isManager || (int)$task['user_id'] === $uid || (int)$task['created_by'] === $uid || (int)$task['approver_id'] === $uid || in_array((string)$uid, $participantList, true);
                    if (!$isAllowed) {
                        return ['success' => false, 'message' => "Bạn không có quyền chỉnh sửa công việc #{$taskId} (chỉ người phụ trách, người tạo hoặc quản lý mới có quyền)."];
                    }

                    $updates = [];
                    $params = [];

                    $newStatus = isset($args['status']) ? strtolower(trim((string)$args['status'])) : null;
                    if ($newStatus && in_array($newStatus, ['planned', 'in_progress', 'done', 'cancelled'], true)) {
                        $updates[] = "status = ?";
                        $params[] = $newStatus;
                        if ($newStatus === 'done') {
                            $updates[] = "progress = 100";
                            $updates[] = "done_at = NOW()";
                        } elseif ($newStatus === 'in_progress' || $newStatus === 'planned') {
                            $updates[] = "done_at = NULL";
                        }
                    }

                    if (isset($args['progress']) && is_numeric($args['progress'])) {
                        $prog = min(100, max(0, (int)$args['progress']));
                        $updates[] = "progress = ?";
                        $params[] = $prog;
                        if ($prog >= 100 && $newStatus !== 'done') {
                            $updates[] = "status = 'done'";
                            $updates[] = "done_at = NOW()";
                        }
                    }

                    $dueDateRaw = trim((string)($args['due_date'] ?? ''));
                    if (!empty($dueDateRaw)) {
                        $ts = strtotime($dueDateRaw);
                        if ($ts !== false) {
                            $updates[] = "due_date = ?";
                            $params[] = date('Y-m-d H:i:s', $ts);
                        }
                    }

                    if (!empty($updates)) {
                        $updates[] = "updated_at = NOW()";
                        $sql = "UPDATE activities SET " . implode(', ', $updates) . " WHERE id = ? AND tenant_id = ?";
                        $params[] = $taskId;
                        $params[] = $tid;
                        $upStmt = $db->prepare($sql);
                        $upStmt->execute($params);
                    }

                    $note = trim((string)($args['note'] ?? ''));
                    if (!empty($note)) {
                        $cmtStmt = $db->prepare("INSERT INTO activity_comments (tenant_id, activity_id, user_id, content, created_at) VALUES (?, ?, ?, ?, NOW())");
                        $cmtStmt->execute([$tid, $taskId, $uid, $note]);
                    }

                    // Refetch updated task
                    $reStmt = $db->prepare("SELECT status, progress, due_date FROM activities WHERE id = ? AND tenant_id = ?");
                    $reStmt->execute([$taskId, $tid]);
                    $fresh = $reStmt->fetch(PDO::FETCH_ASSOC);

                    $statusMap = ['planned' => 'Chưa bắt đầu', 'in_progress' => 'Đang thực hiện', 'done' => 'Đã hoàn thành', 'cancelled' => 'Đã hủy'];
                    $statusText = $statusMap[$fresh['status'] ?? ''] ?? ($fresh['status'] ?? 'Cập nhật');

                    return [
                        'success' => true,
                        'task_id' => $taskId,
                        'subject' => $task['subject'],
                        'status' => $fresh['status'],
                        'status_text' => $statusText,
                        'progress' => (int)($fresh['progress'] ?? 0),
                        'due_date' => $fresh['due_date'],
                        'summary' => "Đã cập nhật công việc #{$taskId} ('{$task['subject']}'): Trạng thái [{$statusText}], Tiến độ [{$fresh['progress']}%]" . ($note ? " kèm bình luận." : ".")
                    ];
                }

                // ==========================================
                // 15D. DIRECT TOOL 3: COMPLETE TASK CHECKLIST ITEM
                // ==========================================
                case 'complete_task_checklist_item': {
                    $taskId = (int)($args['task_id'] ?? 0);
                    $itemTarget = trim((string)($args['item_index_or_keyword'] ?? ''));
                    $isCompleted = isset($args['completed']) ? (bool)$args['completed'] : true;

                    if ($taskId <= 0 || empty($itemTarget)) {
                        return ['success' => false, 'message' => 'Vui lòng cung cấp mã task_id và thứ tự mục/tên mục checklist cần đánh dấu.'];
                    }

                    $stmt = $db->prepare("SELECT a.* FROM activities a WHERE a.id = ? AND a.tenant_id = ? AND a.deleted_at IS NULL");
                    $stmt->execute([$taskId, $tid]);
                    $task = $stmt->fetch(PDO::FETCH_ASSOC);
                    if (!$task) {
                        return ['success' => false, 'message' => "Không tìm thấy công việc ID #{$taskId}."];
                    }

                    $participantList = explode(',', (string)($task['participant_ids'] ?? ''));
                    $isAllowed = $isGlobalAdmin || $isManager || (int)$task['user_id'] === $uid || (int)$task['created_by'] === $uid || (int)$task['approver_id'] === $uid || in_array((string)$uid, $participantList, true);
                    if (!$isAllowed) {
                        return ['success' => false, 'message' => "Bạn không có quyền chỉnh sửa checklist của công việc #{$taskId}."];
                    }

                    $rawBody = $task['body'] ?? '';
                    $targetMatchedText = '';
                    $newProgress = (int)($task['progress'] ?? 0);
                    $newBody = $rawBody;

                    // Case A: JSON ERP Task format
                    $isJson = false;
                    $jsonData = null;
                    $trimmed = trim($rawBody);
                    if ((str_starts_with($trimmed, '{') && str_ends_with($trimmed, '}')) || str_contains($trimmed, '"erp_task"')) {
                        try {
                            $decoded = json_decode($trimmed, true);
                            if (is_array($decoded)) {
                                $jsonData = $decoded;
                                $isJson = true;
                            }
                        } catch (\Throwable $e) {}
                    }

                    if ($isJson && $jsonData) {
                        $erp = &$jsonData;
                        if (isset($jsonData['erp_task']) && is_array($jsonData['erp_task'])) {
                            $erp = &$jsonData['erp_task'];
                        }

                        $checklist = &$erp['checklist'];
                        if (is_array($checklist) && count($checklist) > 0) {
                            $matched = false;
                            $targetIdx = is_numeric($itemTarget) ? (int)$itemTarget - 1 : -1;

                            foreach ($checklist as $idx => &$item) {
                                $text = trim((string)($item['text'] ?? ($item['title'] ?? '')));
                                if ($targetIdx >= 0 && $idx === $targetIdx) {
                                    $item['checked'] = $isCompleted;
                                    $item['done'] = $isCompleted;
                                    $targetMatchedText = $text;
                                    $matched = true;
                                    break;
                                } elseif ($targetIdx < 0 && stripos($text, $itemTarget) !== false) {
                                    $item['checked'] = $isCompleted;
                                    $item['done'] = $isCompleted;
                                    $targetMatchedText = $text;
                                    $matched = true;
                                    break;
                                }
                            }
                            unset($item);

                            if ($matched) {
                                $doneCount = count(array_filter($checklist, fn($it) => !empty($it['checked']) || !empty($it['done'])));
                                $newProgress = (int)round(($doneCount / count($checklist)) * 100);
                                $newBody = json_encode($jsonData, JSON_UNESCAPED_UNICODE);
                            } else {
                                return ['success' => false, 'message' => "Không tìm thấy mục checklist nào khớp với '{$itemTarget}' trong task #{$taskId}."];
                            }
                        } else {
                            return ['success' => false, 'message' => "Công việc #{$taskId} không có danh sách checklist dạng JSON."];
                        }
                    } else {
                        // Case B: Markdown format with - [ ] or - [x]
                        $lines = explode("\n", $rawBody);
                        $matched = false;
                        $chkCount = 0;
                        $doneCount = 0;
                        $targetIdx = is_numeric($itemTarget) ? (int)$itemTarget - 1 : -1;
                        $chkIndex = 0;

                        foreach ($lines as &$line) {
                            if (preg_match('/^\s*[-*]\s*\[([ xX])\]\s*(.*)$/u', $line, $m)) {
                                $isItemDone = (strtolower($m[1]) === 'x');
                                $itemText = trim($m[2]);

                                $isThisOne = false;
                                if ($targetIdx >= 0 && $chkIndex === $targetIdx) {
                                    $isThisOne = true;
                                } elseif ($targetIdx < 0 && stripos($itemText, $itemTarget) !== false) {
                                    $isThisOne = true;
                                }

                                if ($isThisOne) {
                                    $matched = true;
                                    $targetMatchedText = $itemText;
                                    $isItemDone = $isCompleted;
                                    $symbol = $isCompleted ? 'x' : ' ';
                                    $line = preg_replace('/^(\s*[-*]\s*\[)[ xX](\]\s*.*)$/u', '${1}' . $symbol . '${2}', $line);
                                }

                                if ($isItemDone) $doneCount++;
                                $chkCount++;
                                $chkIndex++;
                            }
                        }
                        unset($line);

                        if ($matched && $chkCount > 0) {
                            $newProgress = (int)round(($doneCount / $chkCount) * 100);
                            $newBody = implode("\n", $lines);
                        } else {
                            return ['success' => false, 'message' => "Không tìm thấy mục checklist nào khớp với '{$itemTarget}' trong mô tả công việc."];
                        }
                    }

                    // Update DB
                    $statusUpdate = "";
                    $params = [$newBody, $newProgress];
                    if ($newProgress >= 100) {
                        $statusUpdate = ", status = 'done', done_at = NOW()";
                    } elseif ($task['status'] === 'done' && $newProgress < 100) {
                        $statusUpdate = ", status = 'in_progress', done_at = NULL";
                    }

                    $params[] = $taskId;
                    $params[] = $tid;
                    $upStmt = $db->prepare("UPDATE activities SET body = ?, progress = ? {$statusUpdate}, updated_at = NOW() WHERE id = ? AND tenant_id = ?");
                    $upStmt->execute($params);

                    $actionVerb = $isCompleted ? 'hoàn thành' : 'bỏ chọn';
                    return [
                        'success' => true,
                        'task_id' => $taskId,
                        'item' => $targetMatchedText ?: $itemTarget,
                        'is_completed' => $isCompleted,
                        'new_progress' => $newProgress,
                        'summary' => "Đã đánh dấu {$actionVerb} mục '{$targetMatchedText}' trong task #{$taskId}. Tiến độ công việc hiện tại đạt {$newProgress}%." . ($newProgress >= 100 ? " Toàn bộ task đã hoàn tất 100%!" : "")
                    ];
                }

                // ==========================================
                // 15E. DIRECT TOOL 4: QUICK LOG CRM ACTIVITY
                // ==========================================
                case 'quick_log_crm_activity': {
                    $contactId = (int)($args['contact_id'] ?? 0);
                    $actType = strtolower(trim((string)($args['activity_type'] ?? 'call')));
                    $actType = in_array($actType, ['call', 'meeting', 'note', 'chat'], true) ? $actType : 'call';
                    $title = trim((string)($args['title'] ?? ''));
                    $notes = trim((string)($args['notes'] ?? ''));
                    $duration = (int)($args['duration_minutes'] ?? 0);
                    $outcome = trim((string)($args['outcome'] ?? ''));

                    if ($contactId <= 0 || empty($title) || empty($notes)) {
                        return ['success' => false, 'message' => 'Vui lòng cung cấp contact_id, tiêu đề và nội dung ghi chú tương tác.'];
                    }

                    // Zero-Trust RBAC Check
                    $cStmt = $db->prepare("SELECT id, full_name, phone, owner_id FROM contacts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL");
                    $cStmt->execute([$contactId, $tid]);
                    $contact = $cStmt->fetch(PDO::FETCH_ASSOC);
                    if (!$contact) {
                        return ['success' => false, 'message' => "Không tìm thấy học viên/khách hàng ID #{$contactId}."];
                    }

                    if (!$canAccessAllContacts && (int)$contact['owner_id'] !== $uid) {
                        $collabStmt = $db->prepare("SELECT 1 FROM contacts WHERE id = ? AND FIND_IN_SET(?, IFNULL(collaborator_ids, ''))");
                        $collabStmt->execute([$contactId, (string)$uid]);
                        if (!$collabStmt->fetchColumn()) {
                            return ['success' => false, 'message' => "Bạn không có quyền ghi nhận tương tác trên học viên này (thuộc quyền nhân sự khác)."];
                        }
                    }

                    // Build formatted body
                    $extraMeta = [];
                    if ($duration > 0) $extraMeta[] = "Thời lượng: {$duration} phút";
                    if ($outcome) {
                        $outcomeMap = [
                            'connected' => 'Đã nghe máy / Tư vấn tốt',
                            'no_answer' => 'Không nghe máy',
                            'busy' => 'Máy bận',
                            'callback_requested' => 'Yêu cầu gọi lại sau',
                            'qualified' => 'Rất tiềm năng',
                            'lost' => 'Không có nhu cầu'
                        ];
                        $extraMeta[] = "Kết quả: " . ($outcomeMap[$outcome] ?? $outcome);
                    }
                    $fullBody = $notes;
                    if (!empty($extraMeta)) {
                        $fullBody .= "\n\n[" . implode(' | ', $extraMeta) . "]";
                    }

                    $actStmt = $db->prepare("
                        INSERT INTO activities (
                            tenant_id, user_id, created_by, type, subject, body,
                            status, progress, related_type, related_id, contact_id,
                            done_at, created_at, updated_at
                        ) VALUES (
                            ?, ?, ?, ?, ?, ?,
                            'completed', 100, 'contact', ?, ?,
                            NOW(), NOW(), NOW()
                        )
                    ");
                    $actStmt->execute([$tid, $uid, $uid, $actType, $title, $fullBody, $contactId, $contactId]);
                    $actId = (int)$db->lastInsertId();

                    // Update last contact timestamp on contact
                    $upC = $db->prepare("UPDATE contacts SET last_contact = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ?");
                    $upC->execute([$contactId, $tid]);

                    $typeText = ['call' => 'cuộc gọi', 'meeting' => 'cuộc hẹn', 'note' => 'ghi chú', 'chat' => 'tin nhắn'][$actType] ?? 'tương tác';
                    return [
                        'success' => true,
                        'activity_id' => $actId,
                        'contact_id' => $contactId,
                        'contact_name' => $contact['full_name'],
                        'summary' => "Đã ghi nhận trực tiếp {$typeText} ('{$title}') cho học viên {$contact['full_name']} (#{$contactId}). Thời gian liên hệ gần nhất của học viên đã được tự động làm mới."
                    ];
                }

                // ==========================================
                // 15F. DIRECT TOOL 5: REASSIGN LEAD OWNER
                // ==========================================
                case 'reassign_lead_owner': {
                    $contactId = (int)($args['contact_id'] ?? 0);
                    $newOwnerId = (int)($args['new_owner_id'] ?? 0);
                    $newOwnerName = trim((string)($args['new_owner_name'] ?? ''));
                    $reason = trim((string)($args['reassign_reason'] ?? 'Điều phối nguồn khách hàng'));

                    if ($contactId <= 0) {
                        return ['success' => false, 'message' => 'Vui lòng cung cấp mã contact_id của học viên cần bàn giao.'];
                    }

                    $cStmt = $db->prepare("SELECT c.id, c.full_name, c.phone, c.owner_id, u.full_name as current_owner_name FROM contacts c LEFT JOIN users u ON c.owner_id = u.id WHERE c.id = ? AND c.tenant_id = ? AND c.deleted_at IS NULL");
                    $cStmt->execute([$contactId, $tid]);
                    $contact = $cStmt->fetch(PDO::FETCH_ASSOC);
                    if (!$contact) {
                        return ['success' => false, 'message' => "Không tìm thấy học viên ID #{$contactId}."];
                    }

                    $canReassign = $isGlobalAdmin || $isManager || (int)$contact['owner_id'] === $uid;
                    if (!$canReassign) {
                        return ['success' => false, 'message' => "Bạn không có quyền bàn giao học viên này (chỉ Trưởng phòng, Quản lý hoặc chính người đang phụ trách mới có quyền bàn giao)."];
                    }

                    // Resolve new owner
                    if ($newOwnerId <= 0 && !empty($newOwnerName)) {
                        $uStmt = $db->prepare("SELECT id, full_name, email FROM users WHERE tenant_id = ? AND is_active = 1 AND (full_name LIKE ? OR email LIKE ?)");
                        $uStmt->execute([$tid, '%' . $newOwnerName . '%', '%' . $newOwnerName . '%']);
                        $candidates = $uStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                        if (count($candidates) === 0) {
                            return ['success' => false, 'message' => "Không tìm thấy nhân viên đang hoạt động nào có tên '{$newOwnerName}'. Vui lòng kiểm tra lại danh bạ."];
                        } elseif (count($candidates) > 1) {
                            $candidateList = array_map(fn($c) => "#{$c['id']} - {$c['full_name']} ({$c['email']})", $candidates);
                            return [
                                'success' => false,
                                'ambiguous' => true,
                                'message' => "Tìm thấy " . count($candidates) . " nhân sự trùng tên '{$newOwnerName}': " . implode(', ', $candidateList) . ". Bạn muốn bàn giao cho ai? Vui lòng cung cấp mã ID chính xác."
                            ];
                        }
                        $newOwnerId = (int)$candidates[0]['id'];
                        $resolvedName = $candidates[0]['full_name'];
                    } else {
                        $uStmt = $db->prepare("SELECT id, full_name FROM users WHERE id = ? AND tenant_id = ? AND is_active = 1");
                        $uStmt->execute([$newOwnerId, $tid]);
                        $found = $uStmt->fetch(PDO::FETCH_ASSOC);
                        if (!$found) {
                            return ['success' => false, 'message' => "Nhân viên tiếp nhận mới (ID #{$newOwnerId}) không tồn tại hoặc đã ngừng hoạt động."];
                        }
                        $resolvedName = $found['full_name'];
                    }

                    $oldOwnerName = $contact['current_owner_name'] ?: 'Chưa phân công';

                    // Update contact owner
                    $upStmt = $db->prepare("UPDATE contacts SET owner_id = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?");
                    $upStmt->execute([$newOwnerId, $contactId, $tid]);

                    // Audit trail activity
                    $auditStmt = $db->prepare("
                        INSERT INTO activities (
                            tenant_id, user_id, created_by, type, subject, body,
                            status, progress, related_type, related_id, contact_id,
                            done_at, created_at, updated_at
                        ) VALUES (
                            ?, ?, ?, 'task', ?, ?,
                            'completed', 100, 'contact', ?, ?,
                            NOW(), NOW(), NOW()
                        )
                    ");
                    $auditSubject = "Bàn giao học viên: {$contact['full_name']}";
                    $auditBody = "Chuyển giao quyền phụ trách từ [{$oldOwnerName}] sang [{$resolvedName}].\nNgười thực hiện: {$userName} ({$uid})\nLý do: {$reason}";
                    $auditStmt->execute([$tid, $newOwnerId, $uid, $auditSubject, $auditBody, $contactId, $contactId]);

                    return [
                        'success' => true,
                        'contact_id' => $contactId,
                        'contact_name' => $contact['full_name'],
                        'old_owner' => $oldOwnerName,
                        'new_owner' => $resolvedName,
                        'new_owner_id' => $newOwnerId,
                        'summary' => "Đã bàn giao học viên {$contact['full_name']} (#{$contactId}) từ [{$oldOwnerName}] sang cho [{$resolvedName}] thành công."
                    ];
                }

                // ==========================================
                // 16. GET COMPANY STAFF DIRECTORY (ORG & HR GOVERNANCE)
                // ==========================================
                case 'get_company_staff_directory': {
                    $deptFilter = trim($args['department_or_team'] ?? '');
                    $requestedStatus = $args['status'] ?? 'active';
                    $searchName = trim($args['search_name'] ?? '');

                    // Zero-Trust RBAC: Only Admin, Director, HR, or Manager can query inactive/resigned personnel
                    $canViewInactive = ($isGlobalAdmin || in_array($role, ['hr', 'director', 'manager', 'truong_phong'], true));
                    if (!$canViewInactive && $requestedStatus !== 'active') {
                        $requestedStatus = 'active';
                    }

                    // 1. Fetch departments and their leaders from teams table
                    $teamSql = "SELECT t.id, t.name, t.branch, t.leader_id, u.full_name as leader_name, u.email as leader_email, u.phone as leader_phone
                                FROM teams t
                                LEFT JOIN users u ON t.leader_id = u.id
                                WHERE t.tenant_id = ?
                                ORDER BY t.name ASC";
                    $teamStmt = $db->prepare($teamSql);
                    $teamStmt->execute([$tid]);
                    $teams = $teamStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    $deptLeaders = [];
                    foreach ($teams as $t) {
                        $deptLeaders[$t['name']] = [
                            'team_id' => (int)$t['id'],
                            'leader_name' => $t['leader_name'] ?: 'Chưa phân công',
                            'branch' => $t['branch'] ?: 'Trụ sở chính'
                        ];
                    }

                    // 2. Fetch Staff Roster
                    $whereClauses = ["u.tenant_id = ?"];
                    $params = [$tid];

                    // Status filter
                    if ($requestedStatus === 'active') {
                        $whereClauses[] = "(u.is_active = 1 OR u.is_active IS NULL) AND (u.status = 'active' OR u.status IS NULL)";
                    } elseif ($requestedStatus === 'inactive_resigned') {
                        $whereClauses[] = "(u.is_active = 0 OR u.status IN ('inactive', 'leave'))";
                    }

                    // Name search
                    if (!empty($searchName)) {
                        $whereClauses[] = "(u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)";
                        $params[] = '%' . $searchName . '%';
                        $params[] = '%' . $searchName . '%';
                        $params[] = '%' . $searchName . '%';
                    }

                    $whereSql = implode(' AND ', $whereClauses);

                    $sqlUsers = "SELECT 
                                    u.id, u.full_name, u.email, u.phone, u.job_title, u.role, u.status, u.is_active,
                                    COALESCE(NULLIF(TRIM(t.name), ''), 
                                        CASE 
                                            WHEN u.role IN ('admin', 'superadmin', 'super_admin', 'director') THEN 'Ban Giám đốc'
                                            WHEN u.role = 'hr' THEN 'Phòng Nhân sự'
                                            WHEN u.role = 'accountant' THEN 'Phòng Kế toán'
                                            WHEN u.role = 'marketing' THEN 'Phòng Marketing'
                                            WHEN u.role IN ('sales', 'sale', 'sale_admin', 'saleadmin') THEN 'Phòng Kinh doanh'
                                            ELSE 'Phòng ban khác'
                                        END
                                    ) as department,
                                    t.name as team_name,
                                    t.leader_id,
                                    leader.full_name as leader_name
                                 FROM users u
                                 LEFT JOIN teams t ON u.team_id = t.id
                                 LEFT JOIN users leader ON t.leader_id = leader.id
                                 WHERE $whereSql
                                 ORDER BY department ASC, u.full_name ASC";
                    $stmtUsers = $db->prepare($sqlUsers);
                    $stmtUsers->execute($params);
                    $allUsers = $stmtUsers->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    // Filter by department if requested
                    if (!empty($deptFilter)) {
                        $allUsers = array_values(array_filter($allUsers, function($usr) use ($deptFilter) {
                            return mb_stripos($usr['department'], $deptFilter) !== false || mb_stripos($usr['team_name'] ?? '', $deptFilter) !== false;
                        }));
                    }

                    // Count total active vs inactive across company
                    $countStmt = $db->prepare("SELECT 
                                                    COUNT(1) as total_users,
                                                    SUM(CASE WHEN (is_active = 1 OR is_active IS NULL) AND (status = 'active' OR status IS NULL) THEN 1 ELSE 0 END) as active_count,
                                                    SUM(CASE WHEN is_active = 0 OR status IN ('inactive', 'leave') THEN 1 ELSE 0 END) as inactive_count
                                               FROM users WHERE tenant_id = ?");
                    $countStmt->execute([$tid]);
                    $counts = $countStmt->fetch(PDO::FETCH_ASSOC) ?: [];

                    // Group by department
                    $groupedByDept = [];
                    foreach ($allUsers as $u) {
                        $dName = $u['department'];
                        if (!isset($groupedByDept[$dName])) {
                            $groupedByDept[$dName] = [
                                'department' => $dName,
                                'leader' => $u['leader_name'] ?: ($deptLeaders[$dName]['leader_name'] ?? 'Chưa chỉ định'),
                                'member_count' => 0,
                                'members' => []
                            ];
                        }
                        $groupedByDept[$dName]['member_count']++;
                        if (count($groupedByDept[$dName]['members']) < 15) {
                            $groupedByDept[$dName]['members'][] = [
                                'id' => (int)$u['id'],
                                'name' => $u['full_name'],
                                'job_title' => $u['job_title'] ?: $u['role'],
                                'role' => $u['role'],
                                'status' => ((int)$u['is_active'] === 0 || in_array($u['status'], ['inactive', 'leave'], true)) ? 'Đã nghỉ việc / Inactive' : 'Đang hoạt động',
                                'email' => $u['email'],
                                'phone' => $u['phone']
                            ];
                        }
                    }

                    return [
                        'success' => true,
                        'total_company_active_staff' => (int)($counts['active_count'] ?? 0),
                        'total_company_inactive_staff' => $canViewInactive ? (int)($counts['inactive_count'] ?? 0) : null,
                        'department_count' => count($groupedByDept),
                        'filter_applied' => [
                            'department' => $deptFilter ?: 'Tất cả phòng ban',
                            'status' => $requestedStatus,
                            'search' => $searchName ?: null
                        ],
                        'departments' => array_values($groupedByDept),
                        'instruction' => 'Hãy tóm lược ngắn gọn số lượng nhân sự, danh sách phòng ban và người quản lý/leader từng phòng ban cho người dùng nắm bắt dễ dàng. Nếu người dùng hỏi nhân sự đã nghỉ việc, hãy chỉ ra rõ ràng dựa trên danh sách này.'
                    ];
                }

                // ==========================================
                // 17. GET COMPANY LEAVE & ABSENCE (ATTENDANCE & WFH CALENDAR)
                // ==========================================
                case 'get_company_leave_and_absence': {
                    $scope = $args['scope'] ?? 'today';
                    $deptFilter = trim($args['department_or_team'] ?? '');
                    $leaveTypeFilter = $args['leave_type'] ?? 'all';

                    $typeMap = [
                        'annual' => 'Phép năm',
                        'remote_work' => 'Làm việc từ xa (WFH)',
                        'business_trip' => 'Đi công tác',
                        'sick' => 'Nghỉ ốm',
                        'unpaid' => 'Nghỉ không lương',
                        'maternity' => 'Nghỉ thai sản',
                        'marriage' => 'Nghỉ kết hôn',
                        'funeral' => 'Nghỉ tang chế',
                        'special_paid' => 'Nghỉ nguyên lương',
                        'compensatory' => 'Nghỉ bù',
                        'overtime' => 'Tăng ca OT',
                        'late_early' => 'Đi trễ / Về sớm'
                    ];

                    // Helper to format item
                    $formatLeaveItem = function(array $r) use ($typeMap) {
                        $lType = $r['leave_type'] ?? 'annual';
                        $label = $typeMap[$lType] ?? $lType;
                        $startDate = !empty($r['start_date']) ? date('d/m/Y', strtotime($r['start_date'])) : '';
                        $endDate = !empty($r['end_date']) ? date('d/m/Y', strtotime($r['end_date'])) : '';
                        $dateStr = ($startDate === $endDate || empty($endDate)) ? $startDate : "{$startDate} - {$endDate}";

                        return [
                            'id' => (int)($r['id'] ?? 0),
                            'employee_name' => $r['employee_name'] ?? 'Nhân sự',
                            'department' => $r['department'] ?? 'Chưa rõ',
                            'job_title' => $r['job_title'] ?? '',
                            'leave_type' => $lType,
                            'leave_type_label' => $label,
                            'date_range' => $dateStr,
                            'total_days' => (float)($r['total_days'] ?? 1.0),
                            'status' => $r['status'] ?? 'approved',
                            'is_wfh' => ($lType === 'remote_work'),
                            'is_business_trip' => ($lType === 'business_trip')
                        ];
                    };

                    // 1. Query today's approved leaves from hrm_leave_requests
                    $todaySql = "SELECT l.id, l.user_id, l.leave_type, l.start_date, l.end_date, l.total_days, l.reason, l.status,
                                        u.full_name as employee_name, u.job_title, u.email as employee_email,
                                        COALESCE(NULLIF(TRIM(t.name), ''), 
                                            CASE 
                                                WHEN u.role IN ('admin', 'superadmin', 'super_admin', 'director') THEN 'Ban Giám đốc'
                                                WHEN u.role = 'hr' THEN 'Phòng Nhân sự'
                                                WHEN u.role = 'accountant' THEN 'Phòng Kế toán'
                                                WHEN u.role = 'marketing' THEN 'Phòng Marketing'
                                                WHEN u.role IN ('sales', 'sale') THEN 'Phòng Kinh doanh'
                                                ELSE 'Phòng ban khác'
                                            END
                                        ) as department
                                 FROM hrm_leave_requests l
                                 JOIN users u ON l.user_id = u.id
                                 LEFT JOIN teams t ON u.team_id = t.id
                                 WHERE u.tenant_id = ?
                                   AND l.status = 'approved'
                                   AND CURDATE() BETWEEN DATE(l.start_date) AND DATE(l.end_date)";
                    $todayStmt = $db->prepare($todaySql);
                    $todayStmt->execute([$tid]);
                    $todayRows = $todayStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    // Also check users with vacation_mode = 1 or leave date in users table
                    $vacSql = "SELECT u.id, u.full_name as employee_name, u.job_title, u.email as employee_email,
                                      u.vacation_mode, u.leave_start, u.leave_end,
                                      COALESCE(NULLIF(TRIM(t.name), ''), 'Phòng Kinh doanh') as department
                               FROM users u
                               LEFT JOIN teams t ON u.team_id = t.id
                               WHERE u.tenant_id = ?
                                 AND (u.is_active = 1 OR u.is_active IS NULL)
                                 AND (u.vacation_mode = 1 OR (u.leave_start IS NOT NULL AND CURDATE() BETWEEN u.leave_start AND u.leave_end))";
                    $vacStmt = $db->prepare($vacSql);
                    $vacStmt->execute([$tid]);
                    $vacRows = $vacStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    // Merge vacation mode users if not already in todayRows
                    $seenUserIds = array_map(fn($r) => (int)$r['user_id'], $todayRows);
                    foreach ($vacRows as $vr) {
                        $vUid = (int)$vr['id'];
                        if (!in_array($vUid, $seenUserIds, true)) {
                            $todayRows[] = [
                                'id' => 0,
                                'user_id' => $vUid,
                                'leave_type' => 'annual',
                                'start_date' => $vr['leave_start'] ?: date('Y-m-d'),
                                'end_date' => $vr['leave_end'] ?: date('Y-m-d'),
                                'total_days' => 1.0,
                                'reason' => 'Chế độ nghỉ phép / Vacation mode',
                                'status' => 'approved',
                                'employee_name' => $vr['employee_name'],
                                'job_title' => $vr['job_title'],
                                'department' => $vr['department']
                            ];
                            $seenUserIds[] = $vUid;
                        }
                    }

                    // 2. Query upcoming approved leaves (next 14 days)
                    $upSql = "SELECT l.id, l.user_id, l.leave_type, l.start_date, l.end_date, l.total_days, l.reason, l.status,
                                     u.full_name as employee_name, u.job_title, u.email as employee_email,
                                     COALESCE(NULLIF(TRIM(t.name), ''), 
                                         CASE 
                                             WHEN u.role IN ('admin', 'superadmin', 'super_admin', 'director') THEN 'Ban Giám đốc'
                                             WHEN u.role = 'hr' THEN 'Phòng Nhân sự'
                                             WHEN u.role = 'accountant' THEN 'Phòng Kế toán'
                                             WHEN u.role = 'marketing' THEN 'Phòng Marketing'
                                             WHEN u.role IN ('sales', 'sale') THEN 'Phòng Kinh doanh'
                                             ELSE 'Phòng ban khác'
                                         END
                                     ) as department
                              FROM hrm_leave_requests l
                              JOIN users u ON l.user_id = u.id
                              LEFT JOIN teams t ON u.team_id = t.id
                              WHERE u.tenant_id = ?
                                AND l.status = 'approved'
                                AND DATE(l.start_date) > CURDATE()
                                AND DATE(l.start_date) <= DATE_ADD(CURDATE(), INTERVAL 14 DAY)
                              ORDER BY l.start_date ASC
                              LIMIT 15";
                    $upStmt = $db->prepare($upSql);
                    $upStmt->execute([$tid]);
                    $upcomingRows = $upStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    // 3. Query pending leaves (if manager / hr / admin)
                    $pendingRows = [];
                    if ($isGlobalAdmin || in_array($role, ['hr', 'manager', 'director', 'truong_phong'], true)) {
                        $pendSql = "SELECT l.id, l.user_id, l.leave_type, l.start_date, l.end_date, l.total_days, l.reason, l.status,
                                           u.full_name as employee_name, u.job_title,
                                           COALESCE(NULLIF(TRIM(t.name), ''), 'Khác') as department
                                    FROM hrm_leave_requests l
                                    JOIN users u ON l.user_id = u.id
                                    LEFT JOIN teams t ON u.team_id = t.id
                                    WHERE u.tenant_id = ? AND l.status = 'pending'
                                    ORDER BY l.created_at DESC
                                    LIMIT 5";
                        $pendStmt = $db->prepare($pendSql);
                        $pendStmt->execute([$tid]);
                        $pendingRows = $pendStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                    }

                    // Apply filters if needed
                    if (!empty($deptFilter)) {
                        $todayRows = array_values(array_filter($todayRows, fn($r) => mb_stripos($r['department'], $deptFilter) !== false));
                        $upcomingRows = array_values(array_filter($upcomingRows, fn($r) => mb_stripos($r['department'], $deptFilter) !== false));
                    }
                    if ($leaveTypeFilter !== 'all') {
                        $todayRows = array_values(array_filter($todayRows, fn($r) => $r['leave_type'] === $leaveTypeFilter));
                        $upcomingRows = array_values(array_filter($upcomingRows, fn($r) => $r['leave_type'] === $leaveTypeFilter));
                    }

                    $formattedToday = array_map($formatLeaveItem, $todayRows);
                    $formattedUpcoming = array_map($formatLeaveItem, $upcomingRows);
                    $formattedPending = array_map($formatLeaveItem, $pendingRows);

                    return [
                        'success' => true,
                        'scope' => $scope,
                        'today_absent_count' => count($formattedToday),
                        'today_absences' => $formattedToday,
                        'upcoming_leaves_count' => count($formattedUpcoming),
                        'upcoming_leaves' => $formattedUpcoming,
                        'pending_leaves_count' => count($formattedPending),
                        'pending_leaves' => $formattedPending,
                        'summary' => count($formattedToday) > 0 
                            ? ("Hôm nay có " . count($formattedToday) . " nhân sự đang vắng mặt/nghỉ phép/WFH.")
                            : "Hôm nay toàn bộ nhân sự công ty đi làm đầy đủ, không có ai vắng mặt hoặc đăng ký nghỉ phép/WFH.",
                        'instruction' => 'Hãy báo cáo rõ ràng ai nghỉ hôm nay (loại hình: phép năm, WFH hay công tác) và ai sắp tới sẽ nghỉ trong 7-14 ngày tới để hỗ trợ sắp xếp công việc chu đáo.'
                    ];
                }

                // ==========================================
                // 14. UPDATE CONTACT PIPELINE STAGE & NOTE
                // ==========================================
                case 'update_contact_pipeline': {
                    $contactId = (int)($args['contact_id'] ?? 0);
                    $cQuery = trim($args['contact_query'] ?? '');
                    $targetStageInput = trim($args['target_stage'] ?? '13');
                    $noteText = trim($args['note'] ?? '');

                    // Resolve contact if not provided
                    if ($contactId <= 0 && !empty($cQuery)) {
                        $cleanPhone = preg_replace('/[^0-9]/', '', $cQuery);
                        $sParams = [$tid];
                        $sWhere = [];
                        if (!empty($cleanPhone) && strlen($cleanPhone) >= 8) {
                            $sWhere[] = "c.phone LIKE ?";
                            $sParams[] = '%' . $cleanPhone . '%';
                        }
                        if (is_numeric($cQuery)) {
                            $sWhere[] = "c.id = ?";
                            $sParams[] = (int)$cQuery;
                        }
                        $sWhere[] = "c.full_name LIKE ? OR c.email LIKE ?";
                        $sParams[] = '%' . $cQuery . '%';
                        $sParams[] = '%' . $cQuery . '%';

                        $sSql = "SELECT c.id FROM contacts c WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND (" . implode(" OR ", $sWhere) . ")";
                        if (!$canAccessAllContacts) {
                            $rbac = $getContactRbacClause('c');
                            $sSql .= " AND " . $rbac['clause'];
                            $sParams = array_merge($sParams, $rbac['params']);
                        }
                        $sSql .= " ORDER BY c.id DESC LIMIT 1";

                        $sStmt = $db->prepare($sSql);
                        $sStmt->execute($sParams);
                        $contactId = (int)$sStmt->fetchColumn();
                    }

                    if ($contactId <= 0) {
                        return ['success' => false, 'message' => 'Không tìm thấy học viên/khách hàng phù hợp trong phạm vi quyền hạn của bạn để chuyển giai đoạn Pipeline.'];
                    }

                    // RBAC check
                    if (!$canAccessAllContacts) {
                        $checkRbac = $getContactRbacClause('');
                        $checkStmt = $db->prepare("SELECT id FROM contacts WHERE id = ? AND tenant_id = ? AND " . $checkRbac['clause']);
                        $checkStmt->execute(array_merge([$contactId, $tid], $checkRbac['params']));
                        if (!$checkStmt->fetchColumn()) {
                            return ['success' => false, 'message' => 'Bạn không có quyền chỉnh sửa hồ sơ khách hàng này (thuộc quyền quản lý của nhân sự khác).'];
                        }
                    }

                    // Get current contact info
                    $currStmt = $db->prepare("SELECT c.id, c.full_name, c.phone, c.stage_id, ps.name as current_stage_name, ps.order_index as current_stage_order FROM contacts c LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id WHERE c.id = ? AND c.tenant_id = ?");
                    $currStmt->execute([$contactId, $tid]);
                    $currContact = $currStmt->fetch(PDO::FETCH_ASSOC);
                    if (!$currContact) {
                        return ['success' => false, 'message' => 'Không tìm thấy học viên trên hệ thống.'];
                    }

                    // Resolve target stage in pipeline_stages
                    $targetNum = is_numeric($targetStageInput) ? (int)$targetStageInput : -1;
                    $stageTargetStmt = $db->prepare("
                        SELECT id, name, system_slug, order_index 
                        FROM pipeline_stages 
                        WHERE tenant_id = ? AND (
                            id = ? 
                            OR order_index = ? 
                            OR system_slug = ? 
                            OR name LIKE ?
                        )
                        ORDER BY id ASC LIMIT 1
                    ");
                    $stageTargetStmt->execute([$tid, $targetNum, $targetNum, $targetStageInput, '%' . $targetStageInput . '%']);
                    $targetStage = $stageTargetStmt->fetch(PDO::FETCH_ASSOC);

                    if (!$targetStage) {
                        // Fallback default: if asking for 13 / deposit
                        if (mb_stripos($targetStageInput, '13') !== false || mb_stripos($targetStageInput, 'deposit') !== false || mb_stripos($targetStageInput, 'cọc') !== false) {
                            $stageTargetStmt = $db->prepare("SELECT id, name, system_slug, order_index FROM pipeline_stages WHERE tenant_id = ? AND (order_index = 13 OR system_slug = 'deposit_tuition_payment') LIMIT 1");
                            $stageTargetStmt->execute([$tid]);
                            $targetStage = $stageTargetStmt->fetch(PDO::FETCH_ASSOC);
                        }
                    }

                    if (!$targetStage) {
                        return ['success' => false, 'message' => "Không tìm thấy giai đoạn Pipeline '{$targetStageInput}' trong hệ thống."];
                    }

                    $newStageId = (int)$targetStage['id'];
                    $newStageName = $targetStage['name'];
                    $newSlug = $targetStage['system_slug'];
                    $oldStageName = $currContact['current_stage_name'] ?: 'Chưa phân giai đoạn';

                    $db->beginTransaction();

                    // 1. Update contact
                    $upContactStmt = $db->prepare("UPDATE contacts SET stage_id = ?, pipeline_status = ?, last_contact = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ?");
                    $upContactStmt->execute([$newStageId, $newSlug, $contactId, $tid]);

                    // 2. Insert Note
                    $noteBody = "[Chuyển giai đoạn Pipeline]: {$oldStageName} ➔ {$newStageName}";
                    if (!empty($noteText)) {
                        $noteBody .= "\n• Ghi chú: {$noteText}";
                    }
                    $noteStmt = $db->prepare("
                        INSERT INTO notes (tenant_id, user_id, entity_type, entity_id, body, type, channel, note_type, created_at)
                        VALUES (?, ?, 'contact', ?, ?, 'internal', 'system', 'regular', NOW())
                    ");
                    $noteStmt->execute([$tid, $uid, $contactId, $noteBody]);

                    // 3. Log Activity
                    if (function_exists('logActivity')) {
                        logActivity($db, $tid, $uid, 'UPDATE_PIPELINE_STAGE', 'contact', $contactId, "Chuyển từ {$oldStageName} sang {$newStageName}");
                    }

                    $db->commit();

                    return [
                        'success' => true,
                        'contact_id' => $contactId,
                        'contact_name' => $currContact['full_name'],
                        'phone' => $currContact['phone'],
                        'old_stage' => $oldStageName,
                        'new_stage' => $newStageName,
                        'note_saved' => $noteText ?: 'Không có ghi chú thêm',
                        'message' => "Đã chuyển giai đoạn Pipeline của học viên {$currContact['full_name']} sang '{$newStageName}' và lưu ghi chú hồ sơ thành công!"
                    ];
                }

                // ==========================================
                // 15. ADD CONTACT CONSULTATION NOTE
                // ==========================================
                case 'add_contact_consultation_note': {
                    $contactId = (int)($args['contact_id'] ?? 0);
                    $cQuery = trim($args['contact_query'] ?? '');
                    $content = trim($args['content'] ?? '');

                    if (empty($content)) {
                        return ['success' => false, 'message' => 'Nội dung ghi chú không được để trống.'];
                    }

                    if ($contactId <= 0 && !empty($cQuery)) {
                        $cleanPhone = preg_replace('/[^0-9]/', '', $cQuery);
                        $sParams = [$tid];
                        $sWhere = [];
                        if (!empty($cleanPhone) && strlen($cleanPhone) >= 8) {
                            $sWhere[] = "c.phone LIKE ?";
                            $sParams[] = '%' . $cleanPhone . '%';
                        }
                        if (is_numeric($cQuery)) {
                            $sWhere[] = "c.id = ?";
                            $sParams[] = (int)$cQuery;
                        }
                        $sWhere[] = "c.full_name LIKE ? OR c.email LIKE ?";
                        $sParams[] = '%' . $cQuery . '%';
                        $sParams[] = '%' . $cQuery . '%';

                        $sSql = "SELECT c.id FROM contacts c WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND (" . implode(" OR ", $sWhere) . ")";
                        if (!$canAccessAllContacts) {
                            $rbac = $getContactRbacClause('c');
                            $sSql .= " AND " . $rbac['clause'];
                            $sParams = array_merge($sParams, $rbac['params']);
                        }
                        $sSql .= " ORDER BY c.id DESC LIMIT 1";

                        $sStmt = $db->prepare($sSql);
                        $sStmt->execute($sParams);
                        $contactId = (int)$sStmt->fetchColumn();
                    }

                    if ($contactId <= 0) {
                        return ['success' => false, 'message' => "Không tìm thấy học viên/khách hàng phù hợp trong phạm vi quyền hạn của bạn để thêm ghi chú."];
                    }

                    // RBAC check
                    if (!$canAccessAllContacts) {
                        $checkRbac = $getContactRbacClause('');
                        $checkStmt = $db->prepare("SELECT id FROM contacts WHERE id = ? AND tenant_id = ? AND " . $checkRbac['clause']);
                        $checkStmt->execute(array_merge([$contactId, $tid], $checkRbac['params']));
                        if (!$checkStmt->fetchColumn()) {
                            return ['success' => false, 'message' => 'Bạn không có quyền thêm ghi chú cho khách hàng này (thuộc quyền quản lý của nhân sự khác).'];
                        }
                    }

                    $cStmt = $db->prepare("SELECT full_name, phone FROM contacts WHERE id = ? AND tenant_id = ?");
                    $cStmt->execute([$contactId, $tid]);
                    $contact = $cStmt->fetch(PDO::FETCH_ASSOC);

                    $db->beginTransaction();
                    $noteStmt = $db->prepare("
                        INSERT INTO notes (tenant_id, user_id, entity_type, entity_id, body, type, channel, note_type, created_at)
                        VALUES (?, ?, 'contact', ?, ?, 'internal', 'chat_agent', 'regular', NOW())
                    ");
                    $noteStmt->execute([$tid, $uid, $contactId, $content]);
                    $noteId = (int)$db->lastInsertId();

                    $db->prepare("UPDATE contacts SET last_contact = NOW() WHERE id = ? AND tenant_id = ?")->execute([$contactId, $tid]);

                    if (function_exists('logActivity')) {
                        logActivity($db, $tid, $uid, 'ADD_CONSULTATION_NOTE', 'contact', $contactId, mb_substr($content, 0, 100));
                    }
                    $db->commit();

                    return [
                        'success' => true,
                        'contact_id' => $contactId,
                        'contact_name' => $contact['full_name'],
                        'note_id' => $noteId,
                        'content' => $content,
                        'message' => "Đã lưu ghi chú vào hồ sơ của học viên {$contact['full_name']} thành công!"
                    ];
                }

                // ==========================================
                // 16. ATTACH FILES TO CRM CONTACT PROFILE (cloud_files)
                // ==========================================
                case 'attach_files_to_contact': {
                    $contactId = (int)($args['contact_id'] ?? 0);
                    $cQuery = trim($args['contact_query'] ?? '');
                    $category = trim($args['category'] ?? 'Hồ sơ học viên');
                    $fileUrls = $args['file_urls'] ?? [];
                    $note = trim($args['note'] ?? '');

                    // Resolve contact
                    if ($contactId <= 0 && !empty($cQuery)) {
                        $cleanPhone = preg_replace('/[^0-9]/', '', $cQuery);
                        $sParams = [$tid];
                        $sWhere = [];
                        if (!empty($cleanPhone) && strlen($cleanPhone) >= 8) {
                            $sWhere[] = "c.phone LIKE ?";
                            $sParams[] = '%' . $cleanPhone . '%';
                        }
                        if (is_numeric($cQuery)) {
                            $sWhere[] = "c.id = ?";
                            $sParams[] = (int)$cQuery;
                        }
                        $sWhere[] = "c.full_name LIKE ? OR c.email LIKE ?";
                        $sParams[] = '%' . $cQuery . '%';
                        $sParams[] = '%' . $cQuery . '%';

                        $sSql = "SELECT c.id FROM contacts c WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND (" . implode(" OR ", $sWhere) . ")";
                        if (!$canAccessAllContacts) {
                            $rbac = $getContactRbacClause('c');
                            $sSql .= " AND " . $rbac['clause'];
                            $sParams = array_merge($sParams, $rbac['params']);
                        }
                        $sSql .= " ORDER BY c.id DESC LIMIT 1";

                        $sStmt = $db->prepare($sSql);
                        $sStmt->execute($sParams);
                        $contactId = (int)$sStmt->fetchColumn();
                    }

                    if ($contactId <= 0) {
                        return ['success' => false, 'message' => "Không tìm thấy học viên/khách hàng phù hợp trong phạm vi quyền hạn của bạn với thông tin '{$cQuery}'."];
                    }

                    // RBAC check
                    if (!$canAccessAllContacts) {
                        $checkRbac = $getContactRbacClause('');
                        $checkStmt = $db->prepare("SELECT id FROM contacts WHERE id = ? AND tenant_id = ? AND " . $checkRbac['clause']);
                        $checkStmt->execute(array_merge([$contactId, $tid], $checkRbac['params']));
                        if (!$checkStmt->fetchColumn()) {
                            return ['success' => false, 'message' => 'Bạn không có quyền tải hồ sơ cho khách hàng này (thuộc quyền quản lý của nhân sự khác).'];
                        }
                    }

                    $cStmt = $db->prepare("SELECT id, full_name, phone FROM contacts WHERE id = ? AND tenant_id = ?");
                    $cStmt->execute([$contactId, $tid]);
                    $contact = $cStmt->fetch(PDO::FETCH_ASSOC);

                    // Resolve candidate files
                    $filesToAttach = [];

                    // 1. If explicit file_urls provided
                    if (!empty($fileUrls) && is_array($fileUrls)) {
                        foreach ($fileUrls as $fu) {
                            if (is_string($fu) && !empty(trim($fu))) {
                                $filesToAttach[] = [
                                    'url' => trim($fu),
                                    'name' => basename(parse_url($fu, PHP_URL_PATH) ?: $fu)
                                ];
                            }
                        }
                    }

                    // 2. If no explicit file_urls, automatically harvest from recent chat attachments
                    if (empty($filesToAttach)) {
                        $convId = (int)($auth['conversation_id'] ?? 0);
                        
                        // Check chat_attachments_vault first
                        if ($convId > 0) {
                            $vaultStmt = $db->prepare("
                                SELECT file_name, file_url, file_size, mime_type, category 
                                FROM chat_attachments_vault 
                                WHERE tenant_id = ? AND conversation_id = ? AND uploader_id = ?
                                ORDER BY id DESC LIMIT 5
                            ");
                            $vaultStmt->execute([$tid, $convId, $uid]);
                            $vaultFiles = $vaultStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                            foreach ($vaultFiles as $vf) {
                                $filesToAttach[] = [
                                    'url' => $vf['file_url'],
                                    'name' => $vf['file_name'],
                                    'size' => (int)($vf['file_size'] ?? 0),
                                    'mime' => $vf['mime_type'] ?? ''
                                ];
                            }
                        }

                        // Check last chat messages with metadata
                        if (empty($filesToAttach) && $convId > 0) {
                            $msgStmt = $db->prepare("
                                SELECT id, message_type, content, metadata
                                FROM chat_messages
                                WHERE conversation_id = ? AND sender_id = ? AND deleted_at IS NULL
                                ORDER BY id DESC LIMIT 5
                            ");
                            $msgStmt->execute([$convId, $uid]);
                            $msgs = $msgStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                            foreach ($msgs as $m) {
                                if (!empty($m['metadata'])) {
                                    $meta = is_string($m['metadata']) ? json_decode($m['metadata'], true) : $m['metadata'];
                                    if (!empty($meta['url'])) {
                                        $filesToAttach[] = [
                                            'url' => $meta['url'],
                                            'name' => $meta['file_name'] ?? basename($meta['url']),
                                            'size' => (int)($meta['file_size'] ?? 0),
                                            'mime' => $meta['mime_type'] ?? ''
                                        ];
                                    }
                                }
                            }
                        }

                        // If still empty, check $authContext['metadata'] or $authContext['attached_file']
                        if (empty($filesToAttach) && !empty($authContext['metadata']['url'])) {
                            $filesToAttach[] = [
                                'url' => $authContext['metadata']['url'],
                                'name' => $authContext['metadata']['file_name'] ?? basename($authContext['metadata']['url']),
                                'size' => (int)($authContext['metadata']['file_size'] ?? 0),
                                'mime' => $authContext['metadata']['mime_type'] ?? ''
                            ];
                        }
                    }

                    if (empty($filesToAttach)) {
                        return [
                            'success' => false,
                            'message' => 'Không tìm thấy tệp đính kèm nào vừa gửi trong đoạn chat. Vui lòng gửi kèm file ảnh/tài liệu và yêu cầu lại nhé!'
                        ];
                    }

                    // Deduplicate by URL
                    $uniqueFiles = [];
                    $seenUrls = [];
                    foreach ($filesToAttach as $f) {
                        $uKey = $f['url'];
                        if (!isset($seenUrls[$uKey])) {
                            $seenUrls[$uKey] = true;
                            $uniqueFiles[] = $f;
                        }
                    }

                    $db->beginTransaction();
                    $attachedCount = 0;
                    $attachedFileNames = [];

                    $checkCf = $db->prepare("SELECT id FROM cloud_files WHERE contact_id = ? AND (file_path = ? OR name = ?) LIMIT 1");
                    $insCf = $db->prepare("
                        INSERT INTO cloud_files (tenant_id, contact_id, name, file_path, file_size, mime_type, category, visibility, uploaded_by, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, 'shared', ?, NOW())
                    ");

                    foreach ($uniqueFiles as $fItem) {
                        $rawUrl = $fItem['url'];
                        $cleanPath = parse_url($rawUrl, PHP_URL_PATH) ?: $rawUrl;
                        $relPath = ltrim(preg_replace('#^/?(backend/)?#', '', $cleanPath), '/');

                        $fullPath = __DIR__ . '/../' . $relPath;
                        $fSize = (file_exists($fullPath) && is_file($fullPath)) ? filesize($fullPath) : ($fItem['size'] ?? 0);
                        $ext = strtolower(pathinfo($relPath, PATHINFO_EXTENSION));
                        $fMime = $fItem['mime'] ?? '';
                        if (empty($fMime) && file_exists($fullPath)) {
                            $fMime = mime_content_type($fullPath) ?: '';
                        }
                        $fName = $fItem['name'] ?? basename($relPath);

                        $checkCf->execute([$contactId, $relPath, $fName]);
                        if (!$checkCf->fetchColumn()) {
                            $insCf->execute([
                                $tid,
                                $contactId,
                                $fName,
                                $relPath,
                                $fSize,
                                $fMime ?: ('application/' . $ext),
                                $category,
                                $uid
                            ]);
                            $attachedCount++;
                            $attachedFileNames[] = $fName;
                        } else {
                            $attachedFileNames[] = $fName . " (Đã có sẵn)";
                        }
                    }

                    // Add note to contact profile
                    $noteDesc = "📎 [Đính kèm tài liệu vào hồ sơ ({$category})]: " . implode(', ', $attachedFileNames);
                    if (!empty($note)) {
                        $noteDesc .= "\n• Ghi chú: {$note}";
                    }
                    $noteStmt = $db->prepare("
                        INSERT INTO notes (tenant_id, user_id, entity_type, entity_id, body, type, channel, note_type, created_at)
                        VALUES (?, ?, 'contact', ?, ?, 'internal', 'system', 'regular', NOW())
                    ");
                    $noteStmt->execute([$tid, $uid, $contactId, $noteDesc]);

                    // Update last_contact
                    $db->prepare("UPDATE contacts SET last_contact = NOW() WHERE id = ? AND tenant_id = ?")->execute([$contactId, $tid]);

                    if (function_exists('logActivity')) {
                        logActivity($db, $tid, $uid, 'ATTACH_CONTACT_FILES', 'contact', $contactId, "Lưu " . count($attachedFileNames) . " tệp vào mục '{$category}'");
                    }

                    $db->commit();

                    return [
                        'success' => true,
                        'contact_id' => $contactId,
                        'contact_name' => $contact['full_name'],
                        'phone' => $contact['phone'],
                        'category' => $category,
                        'total_attached' => $attachedCount,
                        'files' => $attachedFileNames,
                        'message' => "Đã lưu thành công " . count($attachedFileNames) . " tệp vào hồ sơ học viên {$contact['full_name']} (mục '{$category}')!"
                    ];
                }

                // ==========================================
                // 17. UPDATE CONTACT PROFILE INFO
                // ==========================================
                case 'update_contact_profile': {
                    $contactId = (int)($args['contact_id'] ?? 0);
                    $cQuery = trim($args['contact_query'] ?? '');
                    
                    if ($contactId <= 0 && !empty($cQuery)) {
                        $cleanPhone = preg_replace('/[^0-9]/', '', $cQuery);
                        $sParams = [$tid];
                        $sWhere = [];
                        if (!empty($cleanPhone) && strlen($cleanPhone) >= 8) {
                            $sWhere[] = "c.phone LIKE ?";
                            $sParams[] = '%' . $cleanPhone . '%';
                        }
                        if (is_numeric($cQuery)) {
                            $sWhere[] = "c.id = ?";
                            $sParams[] = (int)$cQuery;
                        }
                        $sWhere[] = "c.full_name LIKE ? OR c.email LIKE ?";
                        $sParams[] = '%' . $cQuery . '%';
                        $sParams[] = '%' . $cQuery . '%';

                        $sSql = "SELECT c.id FROM contacts c WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND (" . implode(" OR ", $sWhere) . ")";
                        if (!$canAccessAllContacts) {
                            $rbac = $getContactRbacClause('c');
                            $sSql .= " AND " . $rbac['clause'];
                            $sParams = array_merge($sParams, $rbac['params']);
                        }
                        $sSql .= " ORDER BY c.id DESC LIMIT 1";

                        $sStmt = $db->prepare($sSql);
                        $sStmt->execute($sParams);
                        $contactId = (int)$sStmt->fetchColumn();
                    }

                    if ($contactId <= 0) {
                        return ['success' => false, 'message' => "Không tìm thấy học viên/khách hàng phù hợp trong phạm vi quyền hạn của bạn để cập nhật hồ sơ."];
                    }

                    // RBAC check
                    if (!$canAccessAllContacts) {
                        $checkRbac = $getContactRbacClause('');
                        $checkStmt = $db->prepare("SELECT id FROM contacts WHERE id = ? AND tenant_id = ? AND " . $checkRbac['clause']);
                        $checkStmt->execute(array_merge([$contactId, $tid], $checkRbac['params']));
                        if (!$checkStmt->fetchColumn()) {
                            return ['success' => false, 'message' => 'Bạn không có quyền chỉnh sửa thông tin của khách hàng này (thuộc quyền quản lý của nhân sự khác).'];
                        }
                    }

                    $cStmt = $db->prepare("SELECT * FROM contacts WHERE id = ? AND tenant_id = ?");
                    $cStmt->execute([$contactId, $tid]);
                    $curr = $cStmt->fetch(PDO::FETCH_ASSOC);
                    if (!$curr) {
                        return ['success' => false, 'message' => 'Học viên không tồn tại.'];
                    }

                    $upFields = [];
                    $upParams = [];
                    $changes = [];

                    $fieldConfig = [
                        'full_name' => ['col' => 'full_name', 'label' => 'Họ tên'],
                        'phone' => ['col' => 'phone', 'label' => 'Số điện thoại'],
                        'email' => ['col' => 'email', 'label' => 'Email'],
                        'address' => ['col' => 'address', 'label' => 'Địa chỉ'],
                        'job_title' => ['col' => 'job_title', 'label' => 'Chức danh'],
                        'company' => ['col' => 'company', 'label' => 'Công ty'],
                        'company_name' => ['col' => 'company', 'label' => 'Công ty'],
                        'notes' => ['col' => 'notes', 'label' => 'Ghi chú']
                    ];

                    $handledCols = [];
                    foreach ($fieldConfig as $inputKey => $cfg) {
                        $dbCol = $cfg['col'];
                        if (isset($handledCols[$dbCol])) continue;
                        if (isset($args[$inputKey]) && trim((string)$args[$inputKey]) !== '') {
                            $newVal = trim((string)$args[$inputKey]);
                            $oldVal = (string)($curr[$dbCol] ?? '');
                            if ($newVal !== $oldVal) {
                                $upFields[] = "{$dbCol} = ?";
                                $upParams[] = $newVal;
                                $changes[] = "{$cfg['label']}: '{$oldVal}' ➔ '{$newVal}'";
                                $handledCols[$dbCol] = true;
                            }
                        }
                    }

                    if (empty($upFields)) {
                        return ['success' => true, 'message' => 'Không có thông tin mới nào cần thay đổi.', 'contact_name' => $curr['full_name']];
                    }

                    $db->beginTransaction();
                    $upParams[] = $contactId;
                    $upParams[] = $tid;
                    $sqlUp = "UPDATE contacts SET " . implode(', ', $upFields) . ", last_contact = NOW(), updated_at = NOW() WHERE id = ? AND tenant_id = ?";
                    $db->prepare($sqlUp)->execute($upParams);

                    // Insert note
                    $noteDesc = "📝 [Cập nhật hồ sơ học viên]:\n• " . implode("\n• ", $changes);
                    $noteStmt = $db->prepare("
                        INSERT INTO notes (tenant_id, user_id, entity_type, entity_id, body, type, channel, note_type, created_at)
                        VALUES (?, ?, 'contact', ?, ?, 'internal', 'chat_agent', 'regular', NOW())
                    ");
                    $noteStmt->execute([$tid, $uid, $contactId, $noteDesc]);

                    if (function_exists('logActivity')) {
                        logActivity($db, $tid, $uid, 'UPDATE_CONTACT_PROFILE', 'contact', $contactId, implode(', ', $changes));
                    }
                    $db->commit();

                    return [
                        'success' => true,
                        'contact_id' => $contactId,
                        'contact_name' => $curr['full_name'],
                        'changes' => $changes,
                        'message' => "Đã cập nhật hồ sơ học viên {$curr['full_name']} thành công: " . implode('; ', $changes)
                    ];
                }

                // ==========================================
                // 22. CHECK STUDENT ADMISSION RECORDS (AGENT HỒ SƠ & PHÁP LÝ)
                // ==========================================
                case 'check_student_admission_records': {
                    $contactId = (int)($args['contact_id'] ?? 0);
                    $cQuery = trim($args['contact_query'] ?? '');
                    $programCode = strtoupper(trim($args['program_code'] ?? 'EMBA'));

                    // Resolve contact with RBAC
                    if ($contactId <= 0 && !empty($cQuery)) {
                        $cleanPhone = preg_replace('/[^0-9]/', '', $cQuery);
                        $sParams = [$tid];
                        $sWhere = [];
                        if (!empty($cleanPhone) && strlen($cleanPhone) >= 8) {
                            $sWhere[] = "c.phone LIKE ?";
                            $sParams[] = '%' . $cleanPhone . '%';
                        }
                        if (is_numeric($cQuery)) {
                            $sWhere[] = "c.id = ?";
                            $sParams[] = (int)$cQuery;
                        }
                        $sWhere[] = "c.full_name LIKE ? OR c.email LIKE ?";
                        $sParams[] = '%' . $cQuery . '%';
                        $sParams[] = '%' . $cQuery . '%';

                        $sSql = "SELECT c.id FROM contacts c WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND (" . implode(" OR ", $sWhere) . ")";
                        if (!$canAccessAllContacts) {
                            $rbac = $getContactRbacClause('c');
                            $sSql .= " AND " . $rbac['clause'];
                            $sParams = array_merge($sParams, $rbac['params']);
                        }
                        $sSql .= " ORDER BY c.id DESC LIMIT 1";

                        $sStmt = $db->prepare($sSql);
                        $sStmt->execute($sParams);
                        $contactId = (int)$sStmt->fetchColumn();
                    }

                    if ($contactId <= 0) {
                        return ['success' => false, 'message' => "Không tìm thấy học viên/khách hàng phù hợp trong phạm vi quyền hạn để thẩm định hồ sơ."];
                    }

                    // Zero-Trust RBAC Check: Ensure contact belongs to requesting user if not admin/manager/academic
                    if (!$canAccessAllContacts && !$isAcademic) {
                        $checkRbac = $getContactRbacClause('');
                        $checkStmt = $db->prepare("SELECT id FROM contacts WHERE id = ? AND tenant_id = ? AND " . $checkRbac['clause']);
                        $checkStmt->execute(array_merge([$contactId, $tid], $checkRbac['params']));
                        if (!$checkStmt->fetchColumn()) {
                            return ['success' => false, 'message' => 'Bạn không có quyền thẩm định hồ sơ của học viên này (thuộc quyền quản lý của nhân sự khác).'];
                        }
                    }

                    // Contact profile
                    $cStmt = $db->prepare("SELECT id, full_name, phone, email, status, stage_id FROM contacts WHERE id = ? AND tenant_id = ?");
                    $cStmt->execute([$contactId, $tid]);
                    $contact = $cStmt->fetch(PDO::FETCH_ASSOC);

                    // Fetch submitted files from cloud_files
                    $cfStmt = $db->prepare("SELECT name, category, created_at FROM cloud_files WHERE contact_id = ? AND tenant_id = ? ORDER BY id ASC");
                    $cfStmt->execute([$contactId, $tid]);
                    $cloudFiles = $cfStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    $submittedNames = [];
                    foreach ($cloudFiles as $cf) {
                        $submittedNames[] = "{$cf['name']} ({$cf['category']})";
                    }

                    // Standard EMBA/MBA Admission Checklist
                    $requiredChecklist = [
                        'CCCD / Hộ chiếu' => false,
                        'Bằng tốt nghiệp Đại học' => false,
                        'Bảng điểm Đại học' => false,
                        'CV tiếng Anh' => false,
                        'Bản dịch công chứng' => false,
                        'Hợp đồng tư vấn đào tạo' => false
                    ];

                    foreach ($cloudFiles as $cf) {
                        $cat = mb_strtolower($cf['category'] ?? '');
                        $nm = mb_strtolower($cf['name'] ?? '');
                        if (str_contains($cat, 'cccd') || str_contains($cat, 'hộ chiếu') || str_contains($nm, 'cccd') || str_contains($nm, 'passport') || str_contains($nm, 'ho_chieu')) {
                            $requiredChecklist['CCCD / Hộ chiếu'] = true;
                        }
                        if (str_contains($cat, 'bằng') || str_contains($nm, 'bang') || str_contains($nm, 'diploma') || str_contains($nm, 'degree')) {
                            $requiredChecklist['Bằng tốt nghiệp Đại học'] = true;
                        }
                        if (str_contains($nm, 'bang_diem') || str_contains($nm, 'transcript') || str_contains($nm, 'bảng điểm')) {
                            $requiredChecklist['Bảng điểm Đại học'] = true;
                        }
                        if (str_contains($nm, 'cv') || str_contains($nm, 'resume') || str_contains($nm, 'so_yeu_ly_lich')) {
                            $requiredChecklist['CV tiếng Anh'] = true;
                        }
                        if (str_contains($nm, 'dich_thuat') || str_contains($nm, 'cong_chung') || str_contains($nm, 'translation')) {
                            $requiredChecklist['Bản dịch công chứng'] = true;
                        }
                        if (str_contains($cat, 'hợp đồng') || str_contains($nm, 'hop_dong') || str_contains($nm, 'contract')) {
                            $requiredChecklist['Hợp đồng tư vấn đào tạo'] = true;
                        }
                    }

                    $completedCount = count(array_filter($requiredChecklist));
                    $totalRequired = count($requiredChecklist);
                    $missingItems = [];
                    foreach ($requiredChecklist as $item => $isDone) {
                        if (!$isDone) $missingItems[] = $item;
                    }

                    $readiness = ($completedCount === $totalRequired)
                        ? "✅ ĐỦ ĐIỀU KIỆN NHẬP HỌC (Đã nộp đầy đủ {$completedCount}/{$totalRequired} hồ sơ)"
                        : "⚠️ CHƯA ĐỦ ĐIỀU KIỆN (Đã nộp {$completedCount}/{$totalRequired} - Còn thiếu: " . implode(', ', $missingItems) . ")";

                    return [
                        'success' => true,
                        'contact_id' => $contactId,
                        'student_name' => $contact['full_name'],
                        'phone' => $contact['phone'],
                        'program_code' => $programCode,
                        'submitted_files_count' => count($cloudFiles),
                        'submitted_files' => $submittedNames,
                        'checklist_status' => "{$completedCount}/{$totalRequired} mục hoàn thành",
                        'missing_documents' => $missingItems,
                        'admission_readiness' => $readiness,
                        'proposal_action' => count($missingItems) > 0 ? 'Cần gửi yêu cầu bổ sung hồ sơ cho học viên' : 'Hồ sơ đã sẵn sàng xét duyệt học vụ'
                    ];
                }

                // ==========================================
                // 23. GET INVENTORY AND ASSET STATUS (AGENT TÀI SẢN & KHO)
                // ==========================================
                case 'get_inventory_and_asset_status': {
                    $type = $args['type'] ?? 'all';
                    $keyword = trim($args['keyword'] ?? '');

                    $results = [];

                    // 1. Assets from hrm_assets
                    if ($type === 'assets' || $type === 'all') {
                        $assetWhere = ["a.status = 'assigned'", "u.tenant_id = ?"];
                        $assetParams = [$tid];

                        if (!$isGlobalAdmin && !$isHR && !$isManager) {
                            $assetWhere[] = "a.user_id = ?";
                            $assetParams[] = $uid;
                        }

                        if (!empty($keyword)) {
                            $assetWhere[] = "(a.asset_name LIKE ? OR a.asset_code LIKE ? OR u.full_name LIKE ?)";
                            $assetParams[] = '%' . $keyword . '%';
                            $assetParams[] = '%' . $keyword . '%';
                            $assetParams[] = '%' . $keyword . '%';
                        }

                        $assetSql = "SELECT a.id, a.asset_name, a.asset_code, a.given_date, u.full_name as assignee_name, u.job_title
                                     FROM hrm_assets a
                                     JOIN users u ON a.user_id = u.id
                                     WHERE " . implode(' AND ', $assetWhere) . "
                                     ORDER BY a.given_date DESC LIMIT 10";
                        $assetStmt = $db->prepare($assetSql);
                        $assetStmt->execute($assetParams);
                        $assets = $assetStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                        $assetList = [];
                        foreach ($assets as $ast) {
                            $assignee = $ast['assignee_name'] ?: 'Nhân sự';
                            $assetList[] = "• {$ast['asset_name']} [Mã: {$ast['asset_code']}] - Bàn giao cho: {$assignee} ({$ast['job_title']}) ngày {$ast['given_date']}";
                        }
                        $results['assigned_assets'] = [
                            'count' => count($assets),
                            'items' => $assetList
                        ];
                    }

                    // 2. Promotional & Admission Gift Inventory overview (Real MySQL from products & batches)
                    if ($type === 'inventory' || $type === 'all') {
                        $invWhere = ["p.tenant_id = ?"];
                        $invParams = [$tid];

                        if (!empty($keyword)) {
                            $invWhere[] = "(p.name LIKE ? OR p.sku LIKE ? OR p.category LIKE ?)";
                            $invParams[] = '%' . $keyword . '%';
                            $invParams[] = '%' . $keyword . '%';
                            $invParams[] = '%' . $keyword . '%';
                        }

                        $invSql = "SELECT p.id, p.name, p.sku, p.category, p.unit,
                                          COALESCE(SUM(CASE WHEN b.status = 'active' THEN b.current_qty ELSE 0 END), 0) as total_qty
                                   FROM products p
                                   LEFT JOIN batches b ON p.id = b.product_id AND b.tenant_id = ?
                                   WHERE " . implode(' AND ', $invWhere) . "
                                   GROUP BY p.id, p.name, p.sku, p.category, p.unit
                                   ORDER BY total_qty DESC, p.name ASC
                                   LIMIT 15";
                        
                        $invStmt = $db->prepare($invSql);
                        $invStmt->execute(array_merge([$tid], $invParams));
                        $rawProducts = $invStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                        $catalogItems = [];
                        foreach ($rawProducts as $rp) {
                            $qty = (int)$rp['total_qty'];
                            $status = $qty > 10 ? 'Dồi dào' : ($qty > 0 ? 'Sắp hết hàng' : 'Hết hàng');
                            $catalogItems[] = [
                                'name' => $rp['name'] . ($rp['sku'] ? " [Mã: {$rp['sku']}]" : ''),
                                'category' => $rp['category'] ?: 'Học liệu / Quà tặng',
                                'stock_estimate' => "{$qty} " . ($rp['unit'] ?: 'chiếc/bộ'),
                                'status' => $status
                            ];
                        }

                        $results['promotional_inventory'] = [
                            'count' => count($catalogItems),
                            'items' => $catalogItems
                        ];
                    }

                    return [
                        'success' => true,
                        'query_type' => $type,
                        'data' => $results,
                        'message' => 'Đã trích xuất thông tin tồn kho ấn phẩm và tài sản bàn giao thành công.'
                    ];
                }

                // ==========================================
                // 24. GET CAMPAIGN MARKETING STATS (AGENT MARKETING)
                // ==========================================
                case 'get_campaign_marketing_stats': {
                    $timeRange = $args['time_range'] ?? 'this_month';
                    $campaignSource = trim($args['campaign_source'] ?? '');

                    // Zero-Trust RBAC: Accessible to Admin, Director, Manager, Sales, Marketing
                    $canViewMarketing = ($isGlobalAdmin || $isManager || $isSale || in_array($role, ['marketing', 'mkt'], true));
                    if (!$canViewMarketing) {
                        return [
                            'success' => false,
                            'message' => 'Quyền hạn bị từ chối: Chỉ cấp quản lý và nhân sự Marketing/Kinh doanh mới được xem thống kê chiến dịch.'
                        ];
                    }

                    $whereClauses = ["c.tenant_id = ?", "c.deleted_at IS NULL"];
                    $params = [$tid];

                    if ($timeRange === 'this_month') {
                        $whereClauses[] = "MONTH(c.created_at) = MONTH(CURRENT_DATE()) AND YEAR(c.created_at) = YEAR(CURRENT_DATE())";
                    } elseif ($timeRange === 'last_month') {
                        $whereClauses[] = "c.created_at >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 1 MONTH) AND c.created_at < DATE_FORMAT(NOW(), '%Y-%m-01')";
                    } elseif ($timeRange === 'last_90_days') {
                        $whereClauses[] = "c.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)";
                    }

                    if (!empty($campaignSource)) {
                        $whereClauses[] = "c.source LIKE ?";
                        $params[] = '%' . $campaignSource . '%';
                    }

                    $sql = "SELECT 
                                COALESCE(NULLIF(TRIM(c.source), ''), 'Chưa phân loại / Khác') as source_name,
                                COUNT(c.id) as total_leads,
                                SUM(CASE WHEN c.stage_id IN (SELECT id FROM pipeline_stages WHERE order_index >= 13) THEN 1 ELSE 0 END) as converted_deposits
                            FROM contacts c
                            WHERE " . implode(' AND ', $whereClauses) . "
                            GROUP BY source_name
                            ORDER BY total_leads DESC LIMIT 8";
                    $stmt = $db->prepare($sql);
                    $stmt->execute($params);
                    $sources = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    $totalLeads = 0;
                    $totalConverted = 0;
                    $rankedChannels = [];

                    foreach ($sources as $s) {
                        $leads = (int)$s['total_leads'];
                        $conv = (int)$s['converted_deposits'];
                        $totalLeads += $leads;
                        $totalConverted += $conv;
                        $convRate = $leads > 0 ? round(($conv / $leads) * 100, 1) : 0;
                        $rankedChannels[] = "• {$s['source_name']}: {$leads} leads ➔ {$conv} chốt cọc ({$convRate}% chuyển đổi)";
                    }

                    $overallRate = $totalLeads > 0 ? round(($totalConverted / $totalLeads) * 100, 1) : 0;

                    return [
                        'success' => true,
                        'time_range' => $timeRange,
                        'total_new_leads' => $totalLeads,
                        'total_converted_deposits' => $totalConverted,
                        'overall_conversion_rate' => "{$overallRate}%",
                        'channels_ranking' => $rankedChannels,
                        'marketing_summary' => "Trong kỳ ({$timeRange}), hệ thống ghi nhận {$totalLeads} Lead mới, chốt {$totalConverted} đơn cọc (tỷ lệ {$overallRate}%)."
                    ];
                }

                // ==========================================
                // 25. GET EXECUTIVE FINANCIAL PULSE (AGENT TRỢ LÝ BAN GIÁM ĐỐC)
                // ==========================================
                case 'get_executive_financial_pulse': {
                    // Strict Zero-Trust RBAC
                    if (!$isGlobalAdmin && !$isAccountant) {
                        return [
                            'success' => false,
                            'message' => 'Quyền hạn bị từ chối: Báo cáo mạch tài chính P&L và dòng tiền ròng dành riêng cho Ban Giám đốc và Kế toán trưởng.'
                        ];
                    }

                    $month = (int)($args['month'] ?? date('n'));
                    $year = (int)($args['year'] ?? date('Y'));
                    if ($month < 1 || $month > 12) $month = (int)date('n');
                    if ($year < 2020 || $year > 2030) $year = (int)date('Y');

                    // 1. Total revenue collected from Sales Orders in month
                    $soStmt = $db->prepare("
                        SELECT 
                            COALESCE(SUM(total_amount), 0) as total_so_contracted,
                            COALESCE(SUM(paid_amount), 0) as total_so_paid,
                            COALESCE(SUM(debt_amount), 0) as total_so_debt,
                            COUNT(id) as total_so_count
                        FROM sales_orders 
                        WHERE tenant_id = ? AND deleted_at IS NULL 
                          AND MONTH(created_at) = ? AND YEAR(created_at) = ?
                    ");
                    $soStmt->execute([$tid, $month, $year]);
                    $soData = $soStmt->fetch(PDO::FETCH_ASSOC) ?: [];
                    $revenuePaid = (float)($soData['total_so_paid'] ?? 0);
                    $revenueContracted = (float)($soData['total_so_contracted'] ?? 0);
                    $soCount = (int)($soData['total_so_count'] ?? 0);

                    // 2. Total expenses approved / paid in month
                    $expStmt = $db->prepare("
                        SELECT 
                            COALESCE(SUM(amount), 0) as total_expense_disbursed,
                            COUNT(id) as total_expense_count
                        FROM expenses 
                        WHERE tenant_id = ? AND deleted_at IS NULL 
                          AND status IN ('approved', 'paid')
                          AND MONTH(expense_date) = ? AND YEAR(expense_date) = ?
                    ");
                    $expStmt->execute([$tid, $month, $year]);
                    $expData = $expStmt->fetch(PDO::FETCH_ASSOC) ?: [];
                    $expenseDisbursed = (float)($expData['total_expense_disbursed'] ?? 0);

                    // 3. Pending expenses count
                    $pExpStmt = $db->prepare("
                        SELECT COUNT(id) as pending_count, COALESCE(SUM(amount), 0) as pending_amount
                        FROM expenses
                        WHERE tenant_id = ? AND deleted_at IS NULL AND status = 'pending'
                    ");
                    $pExpStmt->execute([$tid]);
                    $pExpData = $pExpStmt->fetch(PDO::FETCH_ASSOC) ?: [];
                    $pendingCount = (int)($pExpData['pending_count'] ?? 0);
                    $pendingAmount = (float)($pExpData['pending_amount'] ?? 0);

                    // Net Cash Flow
                    $netCashflow = $revenuePaid - $expenseDisbursed;

                    return [
                        'success' => true,
                        'period' => "Tháng {$month}/{$year}",
                        'revenue_collected_VND' => number_format($revenuePaid, 0, ',', '.') . ' đ',
                        'revenue_contracted_VND' => number_format($revenueContracted, 0, ',', '.') . ' đ',
                        'new_so_count' => $soCount,
                        'expense_disbursed_VND' => number_format($expenseDisbursed, 0, ',', '.') . ' đ',
                        'net_cashflow_VND' => ($netCashflow >= 0 ? '+' : '') . number_format($netCashflow, 0, ',', '.') . ' đ',
                        'pending_approvals_count' => $pendingCount,
                        'pending_approvals_amount_VND' => number_format($pendingAmount, 0, ',', '.') . ' đ',
                        'health_assessment' => $netCashflow >= 0 ? '🟢 Dòng tiền ròng dương - Sức khỏe tài chính tốt' : '🟡 Dòng tiền ròng âm trong kỳ - Cần thúc đẩy thu hồi công nợ các đợt cọc'
                    ];
                }

                // ==========================================
                // 26. GET SYSTEM HEALTH STATUS (AGENT KỸ THUẬT & IT)
                // ==========================================
                case 'get_system_health_status': {
                    $scope = $args['scope'] ?? 'all';

                    // 1. Audit logs stats
                    $auditStmt = $db->prepare("
                        SELECT 
                            COUNT(id) as today_queries,
                            SUM(CASE WHEN has_action_proposal = 1 THEN 1 ELSE 0 END) as action_cards_count,
                            SUM(CASE WHEN needs_training = 1 THEN 1 ELSE 0 END) as training_gaps_count
                        FROM ai_query_audit_logs 
                        WHERE tenant_id = ? AND created_at >= CURDATE()
                    ");
                    $auditStmt->execute([$tid]);
                    $auditData = $auditStmt->fetch(PDO::FETCH_ASSOC) ?: [];

                    $todayQ = (int)($auditData['today_queries'] ?? 0);
                    $actionQ = (int)($auditData['action_cards_count'] ?? 0);
                    $gapsQ = (int)($auditData['training_gaps_count'] ?? 0);

                    // 2. Active users currently in presence
                    $presStmt = $db->prepare("SELECT COUNT(1) FROM chat_user_presence WHERE tenant_id = ? AND status = 'online' AND last_seen >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)");
                    $presStmt->execute([$tid]);
                    $onlineUsers = (int)$presStmt->fetchColumn();

                    return [
                        'success' => true,
                        'system_status' => '🟢 Hoạt động bình thường (All Systems Operational)',
                        'online_staff_count' => $onlineUsers,
                        'ai_interactions_today' => $todayQ,
                        'action_proposals_generated' => $actionQ,
                        'intent_gaps_flagged' => $gapsQ,
                        'database_engine' => 'MySQL 8.0 with InnoDB Transactions & Zero-Trust RBAC',
                        'ai_model_orchestrator' => 'SI IDEAS Swarm Engine (Gemini Function Calling + 11 Domain Agents)'
                    ];
                }

                // ==========================================
                // 26. GET CONTACT 360 PROFILE (CUSTOMER 360 DEEP-DIVE)
                // ==========================================
                case 'get_contact_360_profile': {
                    $contactId = (int)($args['contact_id'] ?? 0);
                    $cQuery = trim($args['contact_query'] ?? '');
                    $programCode = strtoupper(trim($args['program_code'] ?? 'EMBA'));

                    // 1. Resolve Contact ID
                    if ($contactId <= 0 && !empty($cQuery)) {
                        $cleanPhone = preg_replace('/[^0-9]/', '', $cQuery);
                        $sParams = [$tid];
                        $sWhere = [];
                        if (!empty($cleanPhone) && strlen($cleanPhone) >= 8) {
                            $sWhere[] = "c.phone LIKE ?";
                            $sParams[] = '%' . $cleanPhone . '%';
                        }
                        if (is_numeric($cQuery)) {
                            $sWhere[] = "c.id = ?";
                            $sParams[] = (int)$cQuery;
                        }
                        $sWhere[] = "c.full_name LIKE ? OR c.email LIKE ?";
                        $sParams[] = '%' . $cQuery . '%';
                        $sParams[] = '%' . $cQuery . '%';

                        $sSql = "SELECT c.id FROM contacts c WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND (" . implode(" OR ", $sWhere) . ")";
                        if (!$canAccessAllContacts) {
                            $rbac = $getContactRbacClause('c');
                            $sSql .= " AND " . $rbac['clause'];
                            $sParams = array_merge($sParams, $rbac['params']);
                        }
                        $sSql .= " ORDER BY c.id DESC LIMIT 1";

                        $sStmt = $db->prepare($sSql);
                        $sStmt->execute($sParams);
                        $contactId = (int)$sStmt->fetchColumn();
                    }

                    if ($contactId <= 0) {
                        return [
                            'success' => false,
                            'message' => "Không tìm thấy học viên/khách hàng phù hợp trong phạm vi quyền hạn để tra cứu hồ sơ 360 độ."
                        ];
                    }

                    // Zero-Trust RBAC Check: Ensure contact belongs to requesting user if not admin/manager
                    if (!$canAccessAllContacts) {
                        $checkRbac = $getContactRbacClause('');
                        $checkStmt = $db->prepare("SELECT id FROM contacts WHERE id = ? AND tenant_id = ? AND " . $checkRbac['clause']);
                        $checkStmt->execute(array_merge([$contactId, $tid], $checkRbac['params']));
                        if (!$checkStmt->fetchColumn()) {
                            return [
                                'success' => false,
                                'message' => 'Bạn không có quyền truy cập hồ sơ 360 độ của khách hàng này (thuộc quyền quản lý của nhân sự khác).'
                            ];
                        }
                    }

                    // 2. Fetch Detailed Contact Profile & Ownership
                    $cSql = "SELECT c.id, c.full_name, c.phone, c.email, c.source, c.utm_campaign, c.utm_medium,
                                    c.owner_id, c.collaborator_ids, c.stage_id, c.status, c.pipeline_status,
                                    c.created_at, c.last_contact, c.address, c.job_title, c.company as company_name,
                                    u.full_name as owner_name, u.email as owner_email,
                                    COALESCE(t.branch, 'Hội sở chính') as branch_name,
                                    ps.name as stage_name
                             FROM contacts c
                             LEFT JOIN users u ON c.owner_id = u.id
                             LEFT JOIN teams t ON u.team_id = t.id
                             LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
                             WHERE c.id = ? AND c.tenant_id = ?";
                    $cStmt = $db->prepare($cSql);
                    $cStmt->execute([$contactId, $tid]);
                    $contact = $cStmt->fetch(PDO::FETCH_ASSOC);

                    if (!$contact) {
                        return ['success' => false, 'message' => "Không tìm thấy hồ sơ học viên #{$contactId}."];
                    }

                    // 3. Resolve Collaborators
                    $collaboratorNames = [];
                    if (!empty($contact['collaborator_ids'])) {
                        $collabIds = explode(',', $contact['collaborator_ids']);
                        $resolvedCollabs = self::resolveUserNames($db, $collabIds, $tid);
                        $collaboratorNames = array_values($resolvedCollabs);
                    }

                    // 4. Fetch Full CRM Interactions & Consultation Timeline (Notes, Calls, Pipeline, Meetings from activities & notes tables)
                    $timelineItems = [];

                    // 4a. Fetch from activities table (Primary CRM interactions in MYERP)
                    try {
                        $actStmt = $db->prepare("
                            SELECT a.id, a.type, a.subject, a.body, a.created_at, 
                                   COALESCE(u.full_name, uc.full_name, 'Chuyên viên tư vấn') as author_name
                            FROM activities a
                            LEFT JOIN users u ON a.user_id = u.id
                            LEFT JOIN users uc ON a.created_by = uc.id
                            WHERE (a.tenant_id = ? OR a.tenant_id IS NULL OR a.tenant_id = 0)
                              AND (
                                (a.related_type IN ('contact', 'lead') AND a.related_id = ?)
                                OR a.contact_id = ?
                              )
                              AND a.deleted_at IS NULL
                            ORDER BY a.created_at DESC, a.id DESC
                            LIMIT 30
                        ");
                        $actStmt->execute([$tid, $contactId, $contactId]);
                        $activityRows = $actStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                        // Fetch comments on these activities if any
                        $activityComments = [];
                        if (!empty($activityRows)) {
                            $actIds = array_column($activityRows, 'id');
                            $inActs = implode(',', array_map('intval', $actIds));
                            $cmtStmt = $db->query("
                                SELECT ac.activity_id, ac.content, ac.created_at, COALESCE(u.full_name, 'Người dùng') as author_name
                                FROM activity_comments ac
                                LEFT JOIN users u ON ac.user_id = u.id
                                WHERE ac.activity_id IN ($inActs)
                                ORDER BY ac.id ASC
                            ");
                            if ($cmtStmt) {
                                foreach ($cmtStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $cm) {
                                    $activityComments[(int)$cm['activity_id']][] = $cm;
                                }
                            }
                        }

                        foreach ($activityRows as $ar) {
                            $timeStr = !empty($ar['created_at']) ? date('d/m/Y H:i', strtotime($ar['created_at'])) : 'Vừa xong';
                            $author = $ar['author_name'] ?: 'Chuyên viên tư vấn';
                            $typeLabel = match($ar['type']) {
                                'call' => 'Cuộc gọi',
                                'note' => 'Ghi chú',
                                'meeting' => 'Cuộc hẹn/Lịch gặp',
                                'task' => 'Công việc',
                                default => ucfirst($ar['type'] ?? 'Tương tác')
                            };
                            $subject = trim($ar['subject'] ?? '');
                            $rawBody = !empty($ar['body']) ? $ar['body'] : ($ar['description'] ?? '');
                            $cleanBody = strip_tags(trim($rawBody));

                            $line = "[{$timeStr}] {$author} ({$typeLabel}";
                            if (!empty($subject)) {
                                $line .= " - {$subject}";
                            }
                            $line .= "): {$cleanBody}";

                            // Append comments if any
                            if (!empty($activityComments[(int)$ar['id']])) {
                                foreach ($activityComments[(int)$ar['id']] as $ac) {
                                    $cleanCmt = strip_tags(trim($ac['content'] ?? ''));
                                    $line .= " | [Bình luận của {$ac['author_name']}]: {$cleanCmt}";
                                }
                            }

                            $timelineItems[] = [
                                'timestamp' => strtotime($ar['created_at'] ?? 'now'),
                                'text' => $line
                            ];
                        }
                    } catch (\Throwable $e) {
                        error_log("Error fetching contact activities: " . $e->getMessage());
                    }

                    // 4b. Fetch from notes table (Legacy & quick notes)
                    try {
                        $nStmt = $db->prepare("
                            SELECT n.id, n.body, n.type, n.channel, n.note_type, n.created_at, u.full_name as author_name
                            FROM notes n
                            LEFT JOIN users u ON n.user_id = u.id
                            WHERE n.tenant_id = ? AND n.entity_type = 'contact' AND n.entity_id = ?
                            ORDER BY n.id DESC
                            LIMIT 15
                        ");
                        $nStmt->execute([$tid, $contactId]);
                        $notesRows = $nStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                        foreach ($notesRows as $nr) {
                            $timeStr = !empty($nr['created_at']) ? date('d/m/Y H:i', strtotime($nr['created_at'])) : 'Vừa xong';
                            $author = $nr['author_name'] ?: 'Chuyên viên tư vấn';
                            $cleanBody = strip_tags(trim($nr['body'] ?? ''));
                            $channel = !empty($nr['channel']) ? $nr['channel'] : 'Ghi chú';
                            $timelineItems[] = [
                                'timestamp' => strtotime($nr['created_at'] ?? 'now'),
                                'text' => "[{$timeStr}] {$author} ({$channel}): {$cleanBody}"
                            ];
                        }
                    } catch (\Throwable $e) {
                        error_log("Error fetching contact notes: " . $e->getMessage());
                    }

                    // Sort chronologically descending
                    usort($timelineItems, fn($a, $b) => $b['timestamp'] <=> $a['timestamp']);
                    $notesTimeline = array_map(fn($item) => $item['text'], array_slice($timelineItems, 0, 25));

                    // 5. Fetch Files from cloud_files (Hồ sơ có gì)
                    $cfStmt = $db->prepare("
                        SELECT cf.id, cf.name, cf.category, cf.file_size, cf.created_at, u.full_name as uploader_name
                        FROM cloud_files cf
                        LEFT JOIN users u ON cf.uploaded_by = u.id
                        WHERE cf.contact_id = ? AND cf.tenant_id = ?
                        ORDER BY cf.id DESC
                    ");
                    $cfStmt->execute([$contactId, $tid]);
                    $cloudFiles = $cfStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    $submittedFiles = [];
                    $requiredChecklist = [
                        'CCCD / Hộ chiếu' => false,
                        'Bằng tốt nghiệp Đại học' => false,
                        'Bảng điểm Đại học' => false,
                        'CV tiếng Anh' => false,
                        'Bản dịch công chứng' => false,
                        'Hợp đồng tư vấn đào tạo' => false
                    ];

                    foreach ($cloudFiles as $cf) {
                        $cat = mb_strtolower($cf['category'] ?? '');
                        $nm = mb_strtolower($cf['name'] ?? '');
                        $uploader = $cf['uploader_name'] ? " (Đăng bởi {$cf['uploader_name']})" : "";
                        $dateStr = !empty($cf['created_at']) ? date('d/m/Y', strtotime($cf['created_at'])) : '';
                        $submittedFiles[] = "• {$cf['name']} [Mục: {$cf['category']}] - {$dateStr}{$uploader}";

                        if (str_contains($cat, 'cccd') || str_contains($cat, 'hộ chiếu') || str_contains($nm, 'cccd') || str_contains($nm, 'passport') || str_contains($nm, 'ho_chieu')) {
                            $requiredChecklist['CCCD / Hộ chiếu'] = true;
                        }
                        if (str_contains($cat, 'bằng') || str_contains($nm, 'bang') || str_contains($nm, 'diploma') || str_contains($nm, 'degree')) {
                            $requiredChecklist['Bằng tốt nghiệp Đại học'] = true;
                        }
                        if (str_contains($nm, 'bang_diem') || str_contains($nm, 'transcript') || str_contains($nm, 'bảng điểm')) {
                            $requiredChecklist['Bảng điểm Đại học'] = true;
                        }
                        if (str_contains($nm, 'cv') || str_contains($nm, 'resume') || str_contains($nm, 'so_yeu_ly_lich')) {
                            $requiredChecklist['CV tiếng Anh'] = true;
                        }
                        if (str_contains($nm, 'dich_thuat') || str_contains($nm, 'cong_chung') || str_contains($nm, 'translation')) {
                            $requiredChecklist['Bản dịch công chứng'] = true;
                        }
                        if (str_contains($cat, 'hợp đồng') || str_contains($nm, 'hop_dong') || str_contains($nm, 'contract')) {
                            $requiredChecklist['Hợp đồng tư vấn đào tạo'] = true;
                        }
                    }

                    $completedCount = count(array_filter($requiredChecklist));
                    $totalRequired = count($requiredChecklist);
                    $missingItems = [];
                    foreach ($requiredChecklist as $item => $isDone) {
                        if (!$isDone) $missingItems[] = $item;
                    }

                    $isDossierReady = ($completedCount === $totalRequired);
                    $readinessVerdict = $isDossierReady
                        ? "✅ CHUẨN HOÀN TOÀN: Đã nộp đủ {$completedCount}/{$totalRequired} giấy tờ bắt buộc theo chuẩn tuyển sinh quốc tế ({$programCode}). Sẵn sàng cấp Letter of Acceptance."
                        : "⚠️ CHƯA CHUẨN (Thiếu " . count($missingItems) . " giấy tờ): Đã nộp {$completedCount}/{$totalRequired}. Còn thiếu bắt buộc: " . implode(', ', $missingItems) . ".";

                    // 6. Financial Deposits (Cọc & Học phí)
                    $dStmt = $db->prepare("
                        SELECT id, unit_code, price as amount, status, created_at
                        FROM deposits
                        WHERE contact_id = ? AND tenant_id = ? AND status != 'cancelled'
                        ORDER BY id DESC LIMIT 5
                    ");
                    $dStmt->execute([$contactId, $tid]);
                    $deposits = $dStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    $totalPaid = 0;
                    $depositSummaries = [];
                    foreach ($deposits as $d) {
                        $amt = (float)$d['amount'];
                        if ($d['status'] === 'approved') {
                            $totalPaid += $amt;
                        }
                        $statusLabel = $d['status'] === 'approved' ? 'Đã duyệt' : ($d['status'] === 'pending' ? 'Chờ duyệt' : $d['status']);
                        $depositSummaries[] = "Phiếu #{$d['id']} ({$d['unit_code']}): " . number_format($amt, 0, ',', '.') . " VND [{$statusLabel}]";
                    }

                    // 7. Format Complete 360 Response
                    $createdDateFormatted = !empty($contact['created_at']) ? date('d/m/Y H:i', strtotime($contact['created_at'])) : 'Không rõ';
                    $lastContactFormatted = !empty($contact['last_contact']) ? date('d/m/Y H:i', strtotime($contact['last_contact'])) : 'Chưa có tương tác';

                    return [
                        'success' => true,
                        'contact_id' => $contactId,
                        'full_name' => $contact['full_name'],
                        'phone' => $contact['phone'],
                        'email' => $contact['email'],
                        'timeline' => [
                            'entered_crm_at' => $createdDateFormatted,
                            'source' => $contact['source'] ?: 'Chưa cập nhật',
                            'campaign' => $contact['utm_campaign'] ?: ($contact['utm_source'] ?: 'Không có'),
                            'last_contact' => $lastContactFormatted
                        ],
                        'care_team' => [
                            'owner_name' => $contact['owner_name'] ?: 'Chưa phân bổ',
                            'branch' => $contact['branch_name'] ?: 'Hội sở chính',
                            'collaborators' => !empty($collaboratorNames) ? implode(', ', $collaboratorNames) : 'Không có'
                        ],
                        'notes_history' => [
                            'total_notes' => count($notesTimeline),
                            'latest_notes' => $notesTimeline
                        ],
                        'dossier_and_files' => [
                            'total_files' => count($submittedFiles),
                            'files' => $submittedFiles
                        ],
                        'admission_readiness' => [
                            'program_code' => $programCode,
                            'verdict' => $readinessVerdict,
                            'is_ready' => $isDossierReady,
                            'completed_items' => "{$completedCount}/{$totalRequired}",
                            'missing_items' => $missingItems
                        ],
                        'financial_status' => [
                            'total_paid_approved' => number_format($totalPaid, 0, ',', '.') . ' VND',
                            'deposits_count' => count($deposits),
                            'deposits_list' => $depositSummaries
                        ],
                        'pipeline_stage' => $contact['stage_name'] ?: ($contact['pipeline_status'] ?: 'Lead mới'),
                        'suggested_next_steps' => count($missingItems) > 0
                            ? "Khởi tạo Thẻ Hành Động 'admission_document_request' để nhắc học viên gửi nốt: " . implode(', ', $missingItems)
                            : "Hồ sơ đã đạt chuẩn 100%. Có thể lập đơn SO (sales_order) hoặc chuyển pipeline sang '14 – Enrolled' (Đã nhập học)."
                    ];
                }

                // ==========================================
                // 25. GET SALES PERFORMANCE & STALE LEADS (CRM AUDIT)
                // ==========================================
                case 'get_sales_performance_and_stale_leads': {
                    $daysThreshold = max(1, min(30, (int)($args['days_threshold'] ?? 3)));
                    $limit = max(1, min(20, (int)($args['limit'] ?? 5)));
                    $filterAssigned = isset($args['assigned_to']) ? (int)$args['assigned_to'] : 0;

                    // 1. Base RBAC filter for contacts
                    $baseWhere = "c.tenant_id = ? AND c.deleted_at IS NULL";
                    $baseParams = [$tid];

                    if (!$canAccessAllContacts) {
                        $rbac = $getContactRbacClause('c');
                        $baseWhere .= " AND " . $rbac['clause'];
                        $baseParams = array_merge($baseParams, $rbac['params']);
                    } elseif ($filterAssigned > 0) {
                        $baseWhere .= " AND (c.owner_id = ? OR FIND_IN_SET(?, IFNULL(c.collaborator_ids, '')))";
                        $baseParams[] = $filterAssigned;
                        $baseParams[] = (string)$filterAssigned;
                    }

                    // 2. Aggregate counts: total, active in funnel, enrolled
                    $statSql = "
                        SELECT 
                            COUNT(1) as total_leads,
                            SUM(CASE WHEN (c.stage_id IN (SELECT id FROM pipeline_stages WHERE tenant_id = c.tenant_id AND order_index < 14) OR c.stage_id IS NULL) AND (c.status IS NULL OR c.status != 'inactive') THEN 1 ELSE 0 END) as active_leads,
                            SUM(CASE WHEN (c.stage_id IN (SELECT id FROM pipeline_stages WHERE tenant_id = c.tenant_id AND order_index >= 14) OR c.pipeline_status = 'enrolled') THEN 1 ELSE 0 END) as enrolled_leads
                        FROM contacts c
                        WHERE {$baseWhere}
                    ";
                    $statStmt = $db->prepare($statSql);
                    $statStmt->execute($baseParams);
                    $stats = $statStmt->fetch(PDO::FETCH_ASSOC) ?: ['total_leads' => 0, 'active_leads' => 0, 'enrolled_leads' => 0];

                    // 3. Query Stale Leads (Active in funnel + last note/interaction >= $daysThreshold days)
                    $staleWhere = "{$baseWhere} AND (c.stage_id IN (SELECT id FROM pipeline_stages WHERE tenant_id = c.tenant_id AND order_index < 14) OR c.stage_id IS NULL) AND (c.status IS NULL OR c.status != 'inactive')";
                    
                    $staleSql = "
                        SELECT 
                            c.id, COALESCE(c.full_name, 'Học viên') as customer_name, c.phone, c.email,
                            c.stage_id, ps.name as stage_name,
                            u.full_name as sale_name,
                            COALESCE(t.branch, 'Hội sở chính') as branch_name,
                            c.created_at,
                            last_n.last_note_at,
                            last_n.last_note_content,
                            DATEDIFF(NOW(), COALESCE(last_n.last_note_at, c.created_at)) as days_neglected
                        FROM contacts c
                        LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
                        LEFT JOIN users u ON c.owner_id = u.id
                        LEFT JOIN teams t ON u.team_id = t.id
                        LEFT JOIN (
                            SELECT entity_id as contact_id, MAX(created_at) as last_note_at, SUBSTRING(MAX(body), 1, 100) as last_note_content
                            FROM notes
                            WHERE entity_type = 'contact'
                            GROUP BY entity_id
                        ) last_n ON c.id = last_n.contact_id
                        WHERE {$staleWhere}
                          AND DATEDIFF(NOW(), COALESCE(last_n.last_note_at, c.created_at)) >= ?
                        ORDER BY days_neglected DESC, c.id DESC
                        LIMIT " . (int)$limit . "
                    ";
                    $staleParams = array_merge($baseParams, [$daysThreshold]);
                    $stmtStale = $db->prepare($staleSql);
                    $stmtStale->execute($staleParams);
                    $staleRows = $stmtStale->fetchAll(PDO::FETCH_ASSOC);

                    // Count total stale leads
                    $countStaleSql = "
                        SELECT COUNT(1)
                        FROM contacts c
                        LEFT JOIN (
                            SELECT entity_id as contact_id, MAX(created_at) as last_note_at
                            FROM notes
                            WHERE entity_type = 'contact'
                            GROUP BY entity_id
                        ) last_n ON c.id = last_n.contact_id
                        WHERE {$staleWhere}
                          AND DATEDIFF(NOW(), COALESCE(last_n.last_note_at, c.created_at)) >= ?
                    ";
                    $countParams = array_merge($baseParams, [$daysThreshold]);
                    $countStmt = $db->prepare($countStaleSql);
                    $countStmt->execute($countParams);
                    $totalStaleCount = (int)$countStmt->fetchColumn();

                    $sampleList = [];
                    foreach ($staleRows as $sr) {
                        $phoneMasked = $sr['phone'] ? (substr($sr['phone'], 0, 4) . '***' . substr($sr['phone'], -3)) : 'Chưa có SĐT';
                        $sampleList[] = [
                            'contact_id' => (int)$sr['id'],
                            'name' => $sr['customer_name'],
                            'phone' => $phoneMasked,
                            'current_stage' => $sr['stage_name'] ?: 'Lead mới',
                            'sale_in_charge' => $sr['sale_name'] ?: 'Chưa phân bổ',
                            'branch' => $sr['branch_name'] ?: 'Hồ Chí Minh',
                            'days_neglected' => (int)$sr['days_neglected'] . ' ngày',
                            'last_note' => $sr['last_note_content'] ? (strip_tags(trim($sr['last_note_content'])) . '...') : 'Chưa có ghi chú nào',
                            'suggested_action' => 'Gọi điện hoặc gửi Zalo ZNS chăm sóc ngay'
                        ];
                    }

                    $totalLeads = (int)$stats['total_leads'];
                    $enrolledLeads = (int)$stats['enrolled_leads'];
                    $convRate = $totalLeads > 0 ? round(($enrolledLeads / $totalLeads) * 100, 1) . '%' : '0%';

                    return [
                        'success' => true,
                        'scope' => $canAccessAllContacts ? ($filterAssigned > 0 ? "Nhân sự ID {$filterAssigned}" : "Toàn viện / Chi nhánh") : "Cá nhân {$userName}",
                        'metrics' => [
                            'total_leads' => $totalLeads,
                            'active_in_funnel' => (int)$stats['active_leads'],
                            'enrolled_count' => $enrolledLeads,
                            'conversion_rate' => $convRate,
                            'stale_leads_count' => $totalStaleCount,
                            'stale_criteria' => "Không có tương tác ghi chú >= {$daysThreshold} ngày"
                        ],
                        'stale_leads_sample' => $sampleList,
                        'verdict' => $totalStaleCount > 0 
                            ? "Cảnh báo: Có {$totalStaleCount} cơ hội học viên tiềm năng đang bị gián đoạn chăm sóc quá {$daysThreshold} ngày. Đề xuất liên hệ ngay để tránh rớt phễu."
                            : "Tuyệt vời: Toàn bộ danh sách học viên tiềm năng đều được duy trì chăm sóc định kỳ đều đặn."
                    ];
                }

                // ==========================================
                // 26. GET UPCOMING TUITION RECEIVABLES (FINANCE SO DEBT AUDIT)
                // ==========================================
                case 'get_upcoming_tuition_receivables': {
                    $limit = max(1, min(20, (int)($args['limit'] ?? 5)));
                    $contactId = isset($args['contact_id']) ? (int)$args['contact_id'] : 0;

                    $where = "so.tenant_id = ? AND so.status != 'cancelled' AND so.payment_status != 'paid' AND (so.total - COALESCE(so.paid_amount, 0)) > 0";
                    $params = [$tid];

                    if ($contactId > 0) {
                        $where .= " AND so.contact_id = ?";
                        $params[] = $contactId;
                    }
                    if (!$isGlobalAdmin && !$isManager && !$isAccountant) {
                        // Regular user can only see SOs created by self or contacts owned
                        $where .= " AND (so.created_by = ? OR c.owner_id = ? OR FIND_IN_SET(?, IFNULL(c.collaborator_ids, '')))";
                        $params[] = $uid;
                        $params[] = $uid;
                        $params[] = (string)$uid;
                    }

                    // 1. Calculate Aggregate Financial Pulse
                    $sumSql = "
                        SELECT 
                            COUNT(1) as total_unpaid_orders,
                            COALESCE(SUM(so.total - COALESCE(so.paid_amount, 0)), 0) as total_receivable,
                            COALESCE(SUM(so.total), 0) as total_order_amount,
                            COALESCE(SUM(so.paid_amount), 0) as total_collected
                        FROM sales_orders so
                        LEFT JOIN contacts c ON so.contact_id = c.id
                        WHERE {$where}
                    ";
                    $sumStmt = $db->prepare($sumSql);
                    $sumStmt->execute($params);
                    $summary = $sumStmt->fetch(PDO::FETCH_ASSOC) ?: [
                        'total_unpaid_orders' => 0,
                        'total_receivable' => 0,
                        'total_order_amount' => 0,
                        'total_collected' => 0
                    ];

                    // 2. Query Top Receivables
                    $listSql = "
                        SELECT 
                            so.id, so.so_number, so.total, so.paid_amount,
                            (so.total - COALESCE(so.paid_amount, 0)) as remaining_debt,
                            so.order_date, so.status, so.payment_status,
                            c.id as student_id, COALESCE(c.full_name, 'Học viên') as student_name,
                            c.phone as student_phone,
                            u.full_name as sale_name
                        FROM sales_orders so
                        LEFT JOIN contacts c ON so.contact_id = c.id
                        LEFT JOIN users u ON c.owner_id = u.id
                        WHERE {$where}
                        ORDER BY remaining_debt DESC, so.id DESC
                        LIMIT " . (int)$limit . "
                    ";
                    $listStmt = $db->prepare($listSql);
                    $listStmt->execute($params);
                    $rows = $listStmt->fetchAll(PDO::FETCH_ASSOC);

                    $receivables = [];
                    foreach ($rows as $r) {
                        $phoneMasked = $r['student_phone'] ? (substr($r['student_phone'], 0, 4) . '***' . substr($r['student_phone'], -3)) : 'Chưa có SĐT';
                        $receivables[] = [
                            'so_id' => (int)$r['id'],
                            'so_number' => $r['so_number'] ?: ('SO-' . $r['id']),
                            'student_name' => $r['student_name'],
                            'student_phone' => $phoneMasked,
                            'total_order' => number_format((float)$r['total'], 0, ',', '.') . ' VND',
                            'already_paid' => number_format((float)$r['paid_amount'], 0, ',', '.') . ' VND',
                            'remaining_due' => number_format((float)$r['remaining_debt'], 0, ',', '.') . ' VND',
                            'order_date' => $r['order_date'] ? date('d/m/Y', strtotime($r['order_date'])) : 'Chưa rõ',
                            'sale_in_charge' => $r['sale_name'] ?: 'Nội bộ',
                            'payment_stage' => $r['payment_status'] === 'partial' ? 'Đã đóng 1 phần (Đang theo lịch)' : 'Chưa thanh toán'
                        ];
                    }

                    $totalOrders = (int)$summary['total_unpaid_orders'];
                    $totalReceivableAmt = (float)$summary['total_receivable'];
                    $totalCollectedAmt = (float)$summary['total_collected'];
                    $totalOrderAmt = (float)$summary['total_order_amount'];
                    $collectRate = $totalOrderAmt > 0 ? round(($totalCollectedAmt / $totalOrderAmt) * 100, 1) . '%' : '0%';

                    return [
                        'success' => true,
                        'summary' => [
                            'unpaid_orders_count' => $totalOrders,
                            'total_receivable_due' => number_format($totalReceivableAmt, 0, ',', '.') . ' VND',
                            'total_already_collected' => number_format($totalCollectedAmt, 0, ',', '.') . ' VND',
                            'collection_completion_rate' => $collectRate
                        ],
                        'top_receivables' => $receivables,
                        'recommendation' => $totalOrders > 0 
                            ? "Đề xuất Kế toán và Chuyên viên tư vấn đối soát các khoản nợ học phí lớn nhất để đôn đốc lịch trình thanh toán đợt 2 hoặc xuất phiếu thu."
                            : "Hiện không ghi nhận khoản công nợ học phí nào đang bị tồn đọng chưa thu đủ."
                    ];
                }

                // ==========================================
                // 27. TRACE APPROVAL BLOCKER (MULTI-LEVEL PINPOINTING)
                // ==========================================
                case 'trace_approval_blocker': {
                    $itemType = $args['item_type'] ?? 'all';
                    $itemId = isset($args['item_id']) ? (int)$args['item_id'] : 0;
                    $limit = max(1, min(15, (int)($args['limit'] ?? 5)));

                    $blockers = [];

                    // A. Trace Expenses (PO / Đề xuất chi phí)
                    if (in_array($itemType, ['all', 'expense'], true)) {
                        $eWhere = "e.tenant_id = ? AND e.deleted_at IS NULL AND e.status = 'pending'";
                        $eParams = [$tid];

                        if ($itemId > 0) {
                            $eWhere .= " AND e.id = ?";
                            $eParams[] = $itemId;
                        }
                        if (!$isGlobalAdmin && !$isManager && !$isAccountant) {
                            $eWhere .= " AND (e.created_by = ? OR e.approver_id = ? OR e.approver_id_2 = ? OR e.approver_id_3 = ?)";
                            $eParams = array_merge($eParams, [$uid, $uid, $uid, $uid]);
                        }

                        $eSql = "
                            SELECT 
                                e.id, e.title, e.amount, e.created_at, e.created_by,
                                e.approver_id, e.approver_id_2, e.approver_id_3,
                                e.status_level_1, e.status_level_2,
                                TIMESTAMPDIFF(HOUR, e.created_at, NOW()) as hours_pending,
                                u_c.full_name as creator_name,
                                u_app1.full_name as app1_name, u_app1.job_title as app1_title,
                                u_app2.full_name as app2_name, u_app2.job_title as app2_title
                            FROM expenses e
                            LEFT JOIN users u_c ON e.created_by = u_c.id
                            LEFT JOIN users u_app1 ON e.approver_id = u_app1.id
                            LEFT JOIN users u_app2 ON e.approver_id_2 = u_app2.id
                            WHERE {$eWhere}
                            ORDER BY e.created_at ASC
                            LIMIT " . (int)$limit . "
                        ";
                        $eStmt = $db->prepare($eSql);
                        $eStmt->execute($eParams);

                        foreach ($eStmt->fetchAll(PDO::FETCH_ASSOC) as $er) {
                            $hours = (int)$er['hours_pending'];
                            $days = round($hours / 24, 1);
                            
                            // Determine current blocker
                            if ($er['status_level_1'] !== 'approved') {
                                $blockerName = $er['app1_name'] ?: 'Trưởng phòng / Người duyệt Cấp 1';
                                $blockerTitle = $er['app1_title'] ?: 'Cấp duyệt 1';
                                $currentStep = 'Chờ duyệt Cấp 1';
                            } elseif ($er['approver_id_2'] && $er['status_level_2'] !== 'approved') {
                                $blockerName = $er['app2_name'] ?: 'Ban Giám Đốc / Người duyệt Cấp 2';
                                $blockerTitle = $er['app2_title'] ?: 'Cấp duyệt 2';
                                $currentStep = 'Chờ duyệt Cấp 2 (Ban Giám Đốc)';
                            } else {
                                $blockerName = 'Kế toán giải ngân';
                                $blockerTitle = 'Phòng Kế Toán';
                                $currentStep = 'Chờ chi tiền / Hoàn tất';
                            }

                            $urgency = $hours >= 72 ? 'BÁO ĐỘNG ĐỎ (> 3 ngày)' : ($hours >= 24 ? 'CẦN NHẮC NHỞ (> 24h)' : 'Bình thường');

                            $blockers[] = [
                                'type' => 'Đề xuất chi / PO',
                                'id' => (int)$er['id'],
                                'title' => $er['title'],
                                'amount' => number_format((float)$er['amount'], 0, ',', '.') . ' VND',
                                'creator' => $er['creator_name'] ?: 'Nhân sự',
                                'submitted_at' => date('d/m/Y H:i', strtotime($er['created_at'])),
                                'pending_duration' => "{$hours} giờ ({$days} ngày)",
                                'urgency' => $urgency,
                                'current_step' => $currentStep,
                                'current_blocker' => "{$blockerName} ({$blockerTitle})",
                                'recommended_action' => "Gửi tin nhắn WorkChat hoặc gọi trực tiếp cho {$blockerName} để giải phóng nút thắt."
                            ];
                        }
                    }

                    // B. Trace Leave Requests (Đơn xin nghỉ phép / WFH)
                    if (in_array($itemType, ['all', 'leave'], true) && count($blockers) < $limit) {
                        $rem = $limit - count($blockers);
                        $lWhere = "l.status = 'pending'";
                        $lParams = [];

                        if ($itemId > 0) {
                            $lWhere .= " AND l.id = ?";
                            $lParams[] = $itemId;
                        }
                        if (!$isGlobalAdmin && !$isManager && !$isHR) {
                            $lWhere .= " AND (l.user_id = ? OR l.approver_id = ? OR l.approver_id_2 = ?)";
                            $lParams = array_merge($lParams, [$uid, $uid, $uid]);
                        }

                        $lSql = "
                            SELECT 
                                l.id, l.leave_type, l.total_days, l.reason, l.created_at,
                                l.approver_id, l.approver_id_2,
                                TIMESTAMPDIFF(HOUR, l.created_at, NOW()) as hours_pending,
                                u_c.full_name as creator_name,
                                u_app.full_name as app_name, u_app.job_title as app_title
                            FROM hrm_leave_requests l
                            LEFT JOIN users u_c ON l.user_id = u_c.id
                            LEFT JOIN users u_app ON l.approver_id = u_app.id
                            WHERE {$lWhere}
                            ORDER BY l.created_at ASC
                            LIMIT " . (int)$rem . "
                        ";
                        $lStmt = $db->prepare($lSql);
                        $lStmt->execute($lParams);

                        foreach ($lStmt->fetchAll(PDO::FETCH_ASSOC) as $lr) {
                            $hours = (int)$lr['hours_pending'];
                            $days = round($hours / 24, 1);
                            $blockerName = $lr['app_name'] ?: 'Trưởng bộ phận';
                            $blockerTitle = $lr['app_title'] ?: 'Quản lý';
                            $urgency = $hours >= 48 ? 'BÁO ĐỘNG ĐỎ (> 2 ngày)' : ($hours >= 24 ? 'CẦN NHẮC NHỞ' : 'Bình thường');

                            $blockers[] = [
                                'type' => 'Đơn xin nghỉ phép',
                                'id' => (int)$lr['id'],
                                'title' => "Nghỉ phép {$lr['total_days']} ngày (" . ($lr['leave_type'] ?: 'Nghỉ phép') . ")",
                                'amount' => "{$lr['total_days']} ngày",
                                'creator' => $lr['creator_name'] ?: 'Nhân sự',
                                'submitted_at' => date('d/m/Y H:i', strtotime($lr['created_at'])),
                                'pending_duration' => "{$hours} giờ ({$days} ngày)",
                                'urgency' => $urgency,
                                'current_step' => 'Chờ Quản lý trực tiếp phê duyệt',
                                'current_blocker' => "{$blockerName} ({$blockerTitle})",
                                'recommended_action' => "Báo cho {$blockerName} để duyệt đơn phép không ảnh hưởng chấm công."
                            ];
                        }
                    }

                    return [
                        'success' => true,
                        'total_blocked_proposals' => count($blockers),
                        'blocked_items' => $blockers,
                        'verdict' => count($blockers) > 0 
                            ? "Đã truy vết được " . count($blockers) . " đề xuất đang bị nghẽn quy trình. Mọi thông tin người phê duyệt cấp 1, cấp 2 và số giờ tồn đọng đã được bóc tách chi tiết."
                            : "Hiện không có đơn phê duyệt nào bị ách tắc vượt hạn định."
                    ];
                }

                // ==========================================
                // 28. GET TICKET STATUS & SLA BREACHES (STUDENT & IT SUPPORT)
                // ==========================================
                case 'get_ticket_status_and_sla_breaches': {
                    $statusFilter = $args['status'] ?? 'breached_only';
                    $limit = max(1, min(15, (int)($args['limit'] ?? 5)));

                    $where = "t.tenant_id = ?";
                    $params = [$tid];

                    $isSupportPrivileged = $isGlobalAdmin || $isManager || in_array($role, ['support', 'cskh', 'admin', 'director'], true);
                    $rbacTicketWhere = "";
                    $rbacTicketParams = [];
                    if (!$isSupportPrivileged) {
                        $rbacTicketWhere = " AND (t.created_by = ? OR t.assignee_id = ?)";
                        $rbacTicketParams = [$uid, $uid];
                        $where .= $rbacTicketWhere;
                        $params = array_merge($params, $rbacTicketParams);
                    }

                    if ($statusFilter === 'all_open') {
                        $where .= " AND t.status IN ('open', 'in_progress', 'waiting')";
                    } elseif ($statusFilter === 'breached_only') {
                        $where .= " AND t.status IN ('open', 'in_progress', 'waiting') AND (
                            (t.priority = 'urgent' AND TIMESTAMPDIFF(HOUR, t.created_at, NOW()) > 12)
                            OR (t.priority = 'high' AND TIMESTAMPDIFF(HOUR, t.created_at, NOW()) > 24)
                            OR (TIMESTAMPDIFF(HOUR, t.created_at, NOW()) > 48)
                        )";
                    }

                    // 1. Calculate general ticket metrics
                    $statSql = "
                        SELECT 
                            COUNT(1) as total_open,
                            SUM(CASE WHEN (t.priority = 'urgent' AND TIMESTAMPDIFF(HOUR, t.created_at, NOW()) > 12)
                                       OR (t.priority = 'high' AND TIMESTAMPDIFF(HOUR, t.created_at, NOW()) > 24)
                                       OR (TIMESTAMPDIFF(HOUR, t.created_at, NOW()) > 48) THEN 1 ELSE 0 END) as total_breached,
                            SUM(CASE WHEN t.priority = 'urgent' THEN 1 ELSE 0 END) as urgent_count
                        FROM tickets t
                        WHERE t.tenant_id = ? AND t.status IN ('open', 'in_progress', 'waiting') {$rbacTicketWhere}
                    ";
                    $statStmt = $db->prepare($statSql);
                    $statStmt->execute(array_merge([$tid], $rbacTicketParams));
                    $stats = $statStmt->fetch(PDO::FETCH_ASSOC) ?: ['total_open' => 0, 'total_breached' => 0, 'urgent_count' => 0];

                    // 2. Fetch sample tickets
                    $sql = "
                        SELECT 
                            t.id, t.subject, t.status, t.priority, t.created_at,
                            TIMESTAMPDIFF(HOUR, t.created_at, NOW()) as hours_open,
                            u.full_name as assignee_name,
                            uc.full_name as creator_name
                        FROM tickets t
                        LEFT JOIN users u ON t.assignee_id = u.id
                        LEFT JOIN users uc ON t.created_by = uc.id
                        WHERE {$where}
                        ORDER BY hours_open DESC, t.id DESC
                        LIMIT " . (int)$limit . "
                    ";
                    $stmt = $db->prepare($sql);
                    $stmt->execute($params);
                    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

                    $ticketList = [];
                    foreach ($rows as $r) {
                        $h = (int)$r['hours_open'];
                        $slaLimit = $r['priority'] === 'urgent' ? 12 : ($r['priority'] === 'high' ? 24 : 48);
                        $isBreached = $h > $slaLimit;

                        $ticketList[] = [
                            'ticket_id' => (int)$r['id'],
                            'subject' => $r['subject'],
                            'priority' => strtoupper($r['priority'] ?: 'NORMAL'),
                            'status' => $r['status'],
                            'assignee' => $r['assignee_name'] ?: 'Chưa phân công',
                            'creator' => $r['creator_name'] ?: 'Người dùng / Học viên',
                            'created_at' => date('d/m/Y H:i', strtotime($r['created_at'])),
                            'hours_open' => "{$h} giờ",
                            'sla_limit' => "{$slaLimit} giờ",
                            'sla_status' => $isBreached ? "VI PHẠM SLA (Trễ " . ($h - $slaLimit) . "h)" : "Trong hạn SLA"
                        ];
                    }

                    $totalOpen = (int)$stats['total_open'];
                    $totalBreached = (int)$stats['total_breached'];

                    return [
                        'success' => true,
                        'metrics' => [
                            'total_open_tickets' => $totalOpen,
                            'sla_breached_count' => $totalBreached,
                            'urgent_tickets' => (int)$stats['urgent_count'],
                            'sla_compliance_rate' => $totalOpen > 0 ? round((($totalOpen - $totalBreached) / $totalOpen) * 100, 1) . '%' : '100%'
                        ],
                        'tickets' => $ticketList,
                        'verdict' => $totalBreached > 0 
                            ? "Cảnh báo dịch vụ: Có {$totalBreached} ticket hỗ trợ/khiếu nại đã vượt quá thời gian cam kết SLA. Đề xuất Trưởng bộ phận đốc thúc xử lý ngay."
                            : "Dịch vụ hỗ trợ hoạt động tốt: 100% ticket đang được xử lý trong hạn cam kết SLA."
                    ];
                }

                // ==========================================
                // 29. GET B2B PARTNER & CONTRACT SUMMARY
                // ==========================================
                case 'get_b2b_partner_and_contract_summary': {
                    $keyword = trim($args['keyword'] ?? '');
                    $limit = max(1, min(15, (int)($args['limit'] ?? 5)));

                    $where = "c.tenant_id = ? AND c.deleted_at IS NULL";
                    $params = [$tid];

                    if (!empty($keyword)) {
                        $where .= " AND (c.name LIKE ? OR c.tax_id LIKE ? OR c.industry LIKE ? OR c.city LIKE ?)";
                        $params[] = '%' . $keyword . '%';
                        $params[] = '%' . $keyword . '%';
                        $params[] = '%' . $keyword . '%';
                        $params[] = '%' . $keyword . '%';
                    }

                    // Strict RBAC: Sales can only see their owned companies unless manager/admin
                    if (!$canAccessAllContacts && !$isManager && !$isGlobalAdmin) {
                        $where .= " AND (c.owner_id = ? OR c.created_by = ? OR c.dedicated_rep_id = ?)";
                        $params[] = $uid;
                        $params[] = $uid;
                        $params[] = $uid;
                    }

                    $sql = "
                        SELECT 
                            c.id, c.name, c.tax_id, c.tier, c.industry, c.city, c.phone, c.email,
                            u.full_name as owner_name,
                            (SELECT COUNT(1) FROM deals d WHERE d.company_id = c.id AND d.deleted_at IS NULL) as deals_count,
                            (SELECT COALESCE(SUM(d.value), 0) FROM deals d WHERE d.company_id = c.id AND d.deleted_at IS NULL) as total_deal_value
                        FROM companies c
                        LEFT JOIN users u ON c.owner_id = u.id
                        WHERE {$where}
                        ORDER BY c.id DESC
                        LIMIT " . (int)$limit . "
                    ";
                    $stmt = $db->prepare($sql);
                    $stmt->execute($params);
                    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

                    $companies = [];
                    foreach ($rows as $r) {
                        $companies[] = [
                            'company_id' => (int)$r['id'],
                            'name' => $r['name'],
                            'tax_id' => $r['tax_id'] ?: 'Chưa cập nhật',
                            'tier' => strtoupper($r['tier'] ?: 'STANDARD'),
                            'industry' => $r['industry'] ?: 'Giáo dục / Dịch vụ',
                            'city' => $r['city'] ?: 'Toàn quốc',
                            'owner' => $r['owner_name'] ?: 'Chưa phân bổ',
                            'active_deals' => (int)$r['deals_count'],
                            'total_deal_value' => number_format((float)$r['total_deal_value'], 0, ',', '.') . ' VND'
                        ];
                    }

                    return [
                        'success' => true,
                        'total_found' => count($companies),
                        'companies' => $companies,
                        'recommendation' => count($companies) > 0
                            ? "Đã tìm thấy " . count($companies) . " đối tác doanh nghiệp B2B theo yêu cầu tra cứu."
                            : "Không tìm thấy doanh nghiệp phù hợp với từ khóa tra cứu."
                    ];
                }

                // ==========================================
                // 30. GET CONSULTANT SHIFT & FAIR SHARE AUDIT
                // ==========================================
                case 'get_consultant_shift_and_fairshare_audit': {
                    $teamId = isset($args['team_id']) ? (int)$args['team_id'] : 0;

                    // 1. Fetch rounds / teams
                    $tWhere = "t.tenant_id = ?";
                    $tParams = [$tid];
                    if ($teamId > 0) {
                        $tWhere .= " AND t.id = ?";
                        $tParams[] = $teamId;
                    }

                    $tStmt = $db->prepare("
                        SELECT t.id, t.name, t.leader_id, u.full_name as leader_name
                        FROM teams t
                        LEFT JOIN users u ON t.leader_id = u.id
                        WHERE {$tWhere}
                        ORDER BY t.id ASC
                    ");
                    $tStmt->execute($tParams);
                    $teams = $tStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    $auditResults = [];
                    foreach ($teams as $tm) {
                        $tmId = (int)$tm['id'];
                        // Get members and count of leads assigned this month
                        $mStmt = $db->prepare("
                            SELECT 
                                u.id as user_id, u.full_name, u.is_active,
                                (SELECT COUNT(1) FROM contacts c WHERE c.owner_id = u.id AND c.tenant_id = ? AND c.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as leads_month,
                                (SELECT COUNT(1) FROM contacts c WHERE c.owner_id = u.id AND c.tenant_id = ? AND DATE(c.created_at) = CURDATE()) as leads_today
                            FROM users u
                            WHERE u.team_id = ? AND u.tenant_id = ? AND u.is_active = 1
                            ORDER BY leads_month DESC
                        ");
                        $mStmt->execute([$tid, $tid, $tmId, $tid]);
                        $members = $mStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                        $leadCounts = array_map(fn($m) => (int)$m['leads_month'], $members);
                        $minLeads = !empty($leadCounts) ? min($leadCounts) : 0;
                        $maxLeads = !empty($leadCounts) ? max($leadCounts) : 0;
                        $diff = $maxLeads - $minLeads;

                        $auditResults[] = [
                            'team_id' => $tmId,
                            'team_name' => $tm['name'],
                            'leader' => $tm['leader_name'] ?: 'Chưa phân công',
                            'member_count' => count($members),
                            'fair_share_status' => $diff > 10 ? "Chênh lệch cao (Max: {$maxLeads}, Min: {$minLeads})" : "Phân bổ đồng đều",
                            'members_distribution' => array_map(fn($m) => [
                                'user_id' => (int)$m['user_id'],
                                'name' => $m['full_name'],
                                'leads_today' => (int)$m['leads_today'],
                                'leads_30_days' => (int)$m['leads_month']
                            ], $members)
                        ];
                    }

                    return [
                        'success' => true,
                        'total_teams_audited' => count($auditResults),
                        'teams' => $auditResults,
                        'verdict' => "Báo cáo phân bổ Lead và kiểm toán Fair Share đã được tổng hợp trực tiếp từ bảng cơ sở dữ liệu."
                    ];
                }

                // ==========================================
                // 34. SCHEDULE CONTACT ACTIVITY (CALENDAR & CRM ENGAGEMENT)
                // ==========================================
                case 'schedule_contact_activity': {
                    $contactId = (int)($args['contact_id'] ?? 0);
                    $type = in_array($args['type'] ?? '', ['call', 'meeting', 'task', 'email'], true) ? $args['type'] : 'call';
                    $subject = trim($args['subject'] ?? '');
                    $notes = trim($args['notes'] ?? '');
                    $priority = in_array($args['priority'] ?? '', ['low', 'medium', 'high', 'urgent'], true) ? $args['priority'] : 'medium';
                    $dueDateRaw = trim($args['due_date'] ?? '');

                    if ($contactId <= 0) {
                        return ['success' => false, 'message' => 'Vui lòng cung cấp mã contact_id của học viên cần lên lịch hẹn.'];
                    }
                    if (empty($subject)) {
                        $subject = ($type === 'call' ? 'Gọi điện tư vấn' : ($type === 'meeting' ? 'Lịch hẹn tư vấn' : 'Công việc chăm sóc')) . " học viên";
                    }

                    $dueDate = null;
                    if (!empty($dueDateRaw)) {
                        $ts = strtotime($dueDateRaw);
                        if ($ts !== false) {
                            $dueDate = date('Y-m-d H:i:s', $ts);
                        }
                    }
                    if (!$dueDate) {
                        $dueDate = date('Y-m-d 09:00:00', strtotime('+1 day'));
                    }

                    // Zero-Trust RBAC Check: Ensure contact exists & user has rights
                    $cStmt = $db->prepare("SELECT id, full_name, phone, owner_id FROM contacts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL");
                    $cStmt->execute([$contactId, $tid]);
                    $contact = $cStmt->fetch(PDO::FETCH_ASSOC);
                    if (!$contact) {
                        return ['success' => false, 'message' => "Không tìm thấy học viên hoặc liên hệ có ID #{$contactId} trong hệ thống."];
                    }

                    if (!$canAccessAllContacts && $contact['owner_id'] != $uid) {
                        $collabStmt = $db->prepare("SELECT 1 FROM contacts WHERE id = ? AND FIND_IN_SET(?, IFNULL(collaborator_ids, ''))");
                        $collabStmt->execute([$contactId, (string)$uid]);
                        if (!$collabStmt->fetchColumn()) {
                            return ['success' => false, 'message' => "Bạn không có quyền lên lịch trên học viên này (đang thuộc quyền quản lý của nhân sự khác)."];
                        }
                    }

                    $actStmt = $db->prepare("
                        INSERT INTO activities (
                            tenant_id, user_id, created_by, type, subject, body,
                            status, priority, due_date, related_type, related_id, contact_id,
                            created_at, updated_at
                        ) VALUES (
                            ?, ?, ?, ?, ?, ?,
                            'planned', ?, ?, 'contact', ?, ?,
                            NOW(), NOW()
                        )
                    ");
                    $actStmt->execute([
                        $tid, $uid, $uid, $type, $subject, $notes,
                        $priority, $dueDate, $contactId, $contactId
                    ]);
                    $newActId = (int)$db->lastInsertId();

                    $typeLabel = $type === 'call' ? 'Cuộc gọi lại' : ($type === 'meeting' ? 'Lịch hẹn gặp trực tiếp' : ($type === 'email' ? 'Gửi email' : 'Tác vụ nhắc việc'));
                    $dueFormatted = date('d/m/Y H:i', strtotime($dueDate));

                    return [
                        'success' => true,
                        'activity_id' => $newActId,
                        'contact_id' => $contactId,
                        'contact_name' => $contact['full_name'] ?: 'Học viên',
                        'activity_type' => $typeLabel,
                        'subject' => $subject,
                        'scheduled_at' => $dueFormatted,
                        'notes' => $notes ?: 'Không có ghi chú thêm',
                        'calendar_synced' => true,
                        'summary' => "Đã lên lịch {$typeLabel} thành công cho học viên {$contact['full_name']} lúc {$dueFormatted}. Hoạt động đã được đồng bộ trực tiếp vào Lịch làm việc (/calendar) và Tab Hoạt động của học viên."
                    ];
                }

                // ==========================================
                // 35. CHECK LEAD DUPLICATE & FAIR SHARE STATUS
                // ==========================================
                case 'check_lead_duplicate_and_fairshare_status': {
                    $phone = trim($args['phone'] ?? '');
                    $email = trim($args['email'] ?? '');
                    $name = trim($args['name'] ?? '');

                    $cleanPhone = preg_replace('/\D/', '', $phone);
                    if (strlen($cleanPhone) >= 9) {
                        $cleanPhone = substr($cleanPhone, -9);
                    }

                    if (empty($cleanPhone) && empty($email) && empty($name)) {
                        return ['success' => false, 'message' => 'Vui lòng cung cấp Số điện thoại, Email hoặc Họ tên để kiểm tra trùng lặp.'];
                    }

                    $conditions = [];
                    $params = [$tid];

                    if (!empty($cleanPhone)) {
                        $conditions[] = "REPLACE(REPLACE(REPLACE(c.phone, ' ', ''), '-', ''), '+', '') LIKE ?";
                        $params[] = '%' . $cleanPhone . '%';
                    }
                    if (!empty($email)) {
                        $conditions[] = "c.email = ?";
                        $params[] = $email;
                    }
                    if (empty($cleanPhone) && empty($email) && !empty($name)) {
                        $conditions[] = "c.full_name LIKE ?";
                        $params[] = '%' . $name . '%';
                    }

                    $whereClause = implode(' OR ', $conditions);

                    $sql = "
                        SELECT 
                            c.id, c.full_name, c.phone, c.email, c.stage_id, c.pipeline_status,
                            c.owner_id, c.created_at,
                            u.full_name as owner_name, u.email as owner_email,
                            COALESCE(t.branch, 'Hội sở chính') as branch_name,
                            ps.name as stage_name,
                            (
                                SELECT MAX(n.created_at) FROM notes n WHERE n.entity_type = 'contact' AND n.entity_id = c.id
                            ) as last_note_at,
                            (
                                SELECT MAX(a.created_at) FROM activities a WHERE (a.contact_id = c.id OR (a.related_type = 'contact' AND a.related_id = c.id)) AND a.deleted_at IS NULL
                            ) as last_activity_at
                        FROM contacts c
                        LEFT JOIN users u ON c.owner_id = u.id
                        LEFT JOIN teams t ON u.team_id = t.id
                        LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
                        WHERE c.tenant_id = ? AND c.deleted_at IS NULL AND ({$whereClause})
                        ORDER BY c.id DESC
                        LIMIT 5
                    ";
                    $stmt = $db->prepare($sql);
                    $stmt->execute($params);
                    $matches = $stmt->fetchAll(PDO::FETCH_ASSOC);

                    if (empty($matches)) {
                        return [
                            'success' => true,
                            'is_duplicate' => false,
                            'message' => 'SỐ ĐIỆN THOẠI / HỒ SƠ MỚI HOÀN TOÀN! Khách hàng này chưa từng tồn tại trên hệ thống CRM của Viện IDEAS. Bạn có thể tự tin tiếp nhận, tư vấn và tạo hồ sơ mới ngay.',
                            'recommendation' => 'Sử dụng Thẻ Thêm Học Viên Nhanh (quick add lead) để đưa vào danh bạ chăm sóc.'
                        ];
                    }

                    $leadReports = [];
                    foreach ($matches as $m) {
                        $lastInteract = $m['last_note_at'] ?: ($m['last_activity_at'] ?: $m['created_at']);
                        $daysNeglected = (int)floor((time() - strtotime($lastInteract)) / 86400);

                        $isStale = $daysNeglected >= 7;
                        $isOwnedBySelf = ((int)$m['owner_id'] === $uid);

                        $fairShareVerdict = '';
                        if ($isOwnedBySelf) {
                            $fairShareVerdict = "Học viên này ĐÃ THUỘC VỀ BẠN. Hãy tiếp tục chăm sóc!";
                        } elseif ($isStale) {
                            $fairShareVerdict = "BỊ BỎ QUÊN ({$daysNeglected} ngày không có tương tác). Theo Quy chế Fair Share của IDEAS, bạn CÓ QUYỀN YÊU CẦU TRƯỞNG NHÓM CHUYỂN GIAO để chăm sóc.";
                        } else {
                            $fairShareVerdict = "ĐANG ĐƯỢC CHĂM SÓC TÍCH CỰC bởi {$m['owner_name']} (tương tác {$daysNeglected} ngày trước). Vui lòng không nhận để tránh tranh chấp quyền lợi!";
                        }

                        $phoneMasked = $m['phone'] ? (substr($m['phone'], 0, 4) . '***' . substr($m['phone'], -3)) : 'Chưa có SĐT';

                        $leadReports[] = [
                            'contact_id' => (int)$m['id'],
                            'full_name' => $m['full_name'],
                            'phone_masked' => $phoneMasked,
                            'current_owner' => $m['owner_name'] ?: 'Chưa phân bổ',
                            'branch' => $m['branch_name'] ?: 'Hồ Chí Minh',
                            'stage' => $m['stage_name'] ?: ($m['pipeline_status'] ?: 'Mới nhận'),
                            'last_interaction' => date('d/m/Y', strtotime($lastInteract)) . " ({$daysNeglected} ngày trước)",
                            'is_stale_over_7_days' => $isStale,
                            'fair_share_verdict' => $fairShareVerdict
                        ];
                    }

                    return [
                        'success' => true,
                        'is_duplicate' => true,
                        'total_matches' => count($leadReports),
                        'leads' => $leadReports,
                        'summary' => "Phát hiện " . count($leadReports) . " hồ sơ trùng khớp trên hệ thống CRM. " . $leadReports[0]['fair_share_verdict']
                    ];
                }

                // ==========================================
                // 36. LOOKUP RECENT CASH RECEIPTS & DEPOSITS (BANK RECONCILIATION)
                // ==========================================
                case 'lookup_recent_cash_receipts_and_deposits': {
                    $searchAmount = isset($args['amount']) ? (float)$args['amount'] : 0;
                    $keyword = trim($args['keyword'] ?? '');
                    $statusFilter = in_array($args['status'] ?? '', ['approved', 'pending', 'all'], true) ? $args['status'] : 'all';
                    $limit = max(1, min(15, (int)($args['limit'] ?? 5)));

                    $where = "d.tenant_id = ?";
                    $params = [$tid];

                    if ($statusFilter !== 'all') {
                        $where .= " AND d.status = ?";
                        $params[] = $statusFilter;
                    }

                    if ($searchAmount > 0) {
                        $where .= " AND (d.price BETWEEN ? AND ?)";
                        $params[] = $searchAmount * 0.999;
                        $params[] = $searchAmount * 1.001;
                    }

                    if (!empty($keyword)) {
                        $where .= " AND (c.full_name LIKE ? OR c.phone LIKE ? OR d.unit_code LIKE ? OR d.title LIKE ? OR IFNULL(d.notes, '') LIKE ?)";
                        $kw = '%' . $keyword . '%';
                        $params = array_merge($params, [$kw, $kw, $kw, $kw, $kw]);
                    }

                    // Zero-Trust RBAC: Non-admin/accountant sees only deposits of contacts owned or self-created
                    if (!$isGlobalAdmin && !$isAccountant && !$isManager) {
                        $where .= " AND (d.created_by = ? OR c.owner_id = ? OR FIND_IN_SET(?, IFNULL(c.collaborator_ids, '')))";
                        $params = array_merge($params, [$uid, $uid, (string)$uid]);
                    }

                    $sql = "
                        SELECT 
                            d.id, d.unit_code, COALESCE(p.name, d.unit_code, 'Phiếu thu/cọc học phí') as title, d.price, d.status, d.created_at, d.notes,
                            c.id as contact_id, c.full_name as contact_name, c.phone as contact_phone,
                            u.full_name as creator_name,
                            p.name as project_name
                        FROM deposits d
                        LEFT JOIN contacts c ON d.contact_id = c.id
                        LEFT JOIN users u ON d.created_by = u.id
                        LEFT JOIN projects p ON d.project_id = p.id
                        WHERE {$where}
                        ORDER BY d.id DESC
                        LIMIT " . (int)$limit . "
                    ";
                    $stmt = $db->prepare($sql);
                    $stmt->execute($params);
                    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

                    $slips = [];
                    foreach ($rows as $r) {
                        $statusText = $r['status'] === 'approved' ? 'Đã duyệt thu (Tiền đã vào tài khoản)' : ($r['status'] === 'pending' ? 'Chờ kế toán xác nhận' : $r['status']);
                        $phoneMasked = $r['contact_phone'] ? (substr($r['contact_phone'], 0, 4) . '***' . substr($r['contact_phone'], -3)) : 'Chưa có SĐT';

                        $slips[] = [
                            'deposit_id' => (int)$r['id'],
                            'slip_code' => $r['unit_code'] ?: ('DEP-' . $r['id']),
                            'title' => $r['title'] ?: 'Phiếu thu/cọc học phí',
                            'amount' => number_format((float)$r['price'], 0, ',', '.') . ' VND',
                            'status' => $statusText,
                            'student_name' => $r['contact_name'] ?: 'Khách hàng',
                            'student_phone' => $phoneMasked,
                            'program' => $r['project_name'] ?: 'Chương trình IDEAS',
                            'creator' => $r['creator_name'] ?: 'Nhân viên kinh doanh',
                            'created_at' => date('d/m/Y H:i', strtotime($r['created_at'])),
                            'notes' => $r['notes'] ?: 'Không có ghi chú'
                        ];
                    }

                    return [
                        'success' => true,
                        'total_found' => count($slips),
                        'slips' => $slips,
                        'summary' => empty($slips) 
                            ? "Không tìm thấy giao dịch thu tiền/cọc nào khớp với điều kiện tra cứu." 
                            : "Tìm thấy " . count($slips) . " giao dịch thu/cọc phù hợp. Bạn có thể kiểm tra chi tiết để đối soát."
                    ];
                }

                // ==========================================
                // 37. GET ACADEMIC SCHEDULE & INTAKES (LMS & CLASS TIMETABLE)
                // ==========================================
                case 'get_academic_schedule_and_intakes': {
                    $programKw = trim($args['program_keyword'] ?? '');
                    $limit = max(1, min(15, (int)($args['limit'] ?? 5)));

                    $where = "mc.tenant_id = ? AND mc.status NOT IN ('deleted', 'archived', 'inactive')";
                    $params = [$tid];

                    if (!empty($programKw)) {
                        $where .= " AND (mc.name LIKE ? OR p.name LIKE ? OR p.code LIKE ?)";
                        $kw = '%' . $programKw . '%';
                        $params[] = $kw;
                        $params[] = $kw;
                        $params[] = $kw;
                    }

                    $sql = "
                        SELECT 
                            mc.id, mc.name as cohort_name, mc.project_id, mc.subjects_json, 
                            mc.thesis_milestones_json, mc.status,
                            p.name as program_name, p.code as program_code
                        FROM marketing_campaigns mc
                        INNER JOIN projects p ON mc.project_id = p.id
                        WHERE {$where}
                        ORDER BY mc.id DESC
                        LIMIT " . (int)$limit . "
                    ";
                    $stmt = $db->prepare($sql);
                    $stmt->execute($params);
                    $cohorts = $stmt->fetchAll(PDO::FETCH_ASSOC);

                    $scheduleResults = [];
                    foreach ($cohorts as $c) {
                        $subjects = [];
                        if (!empty($c['subjects_json'])) {
                            $rawSubs = json_decode($c['subjects_json'], true);
                            if (is_array($rawSubs)) {
                                foreach ($rawSubs as $s) {
                                    $sName = $s['name'] ?? ($s['subject_name'] ?? 'Môn học');
                                    $lecturer = $s['lecturer_name'] ?? ($s['instructor'] ?? 'Chưa công bố');
                                    $time = $s['time'] ?? ($s['schedule'] ?? ($s['dates'] ?? 'Theo thông báo đào tạo'));
                                    $room = $s['room'] ?? ($s['location'] ?? 'Viện IDEAS / Trực tuyến');
                                    $subjects[] = [
                                        'subject' => $sName,
                                        'lecturer' => $lecturer,
                                        'schedule_time' => $time,
                                        'location' => $room
                                    ];
                                }
                            }
                        }

                        $milestones = [];
                        if (!empty($c['thesis_milestones_json'])) {
                            $rawMiles = json_decode($c['thesis_milestones_json'], true);
                            if (is_array($rawMiles)) {
                                foreach ($rawMiles as $m) {
                                    $mTitle = $m['title'] ?? ($m['name'] ?? 'Mốc luận văn');
                                    $mDate = $m['deadline'] ?? ($m['date'] ?? 'Chưa ấn định');
                                    $milestones[] = "{$mTitle} (Hạn: {$mDate})";
                                }
                            }
                        }

                        $scheduleResults[] = [
                            'cohort_id' => (int)$c['id'],
                            'cohort_name' => $c['cohort_name'],
                            'program' => $c['program_name'] . ' (' . $c['program_code'] . ')',
                            'total_subjects' => count($subjects),
                            'upcoming_subjects' => array_slice($subjects, 0, 4),
                            'thesis_milestones' => $milestones
                        ];
                    }

                    return [
                        'success' => true,
                        'total_cohorts' => count($scheduleResults),
                        'cohorts' => $scheduleResults,
                        'summary' => empty($scheduleResults)
                            ? "Không tìm thấy lịch học hoặc khóa đào tạo nào khớp với từ khóa '{$programKw}'."
                            : "Tìm thấy " . count($scheduleResults) . " khóa/lớp đào tạo. Dữ liệu lịch học và giảng viên được trích xuất từ phân hệ Quản lý Đào tạo IDEAS."
                    ];
                }

                // ==========================================
                // 38. MANAGE LEAD ROUND DISTRIBUTION & COMPENSATION
                // ==========================================
                case 'manage_lead_round_distribution': {
                    $action = $args['action'] ?? 'get_round_load_audit';
                    $roundId = isset($args['round_id']) ? (int)$args['round_id'] : 0;
                    $roundNameKw = trim($args['round_name'] ?? '');
                    $consultantId = isset($args['consultant_id']) ? (int)$args['consultant_id'] : 0;
                    $consultantNameKw = trim($args['consultant_name'] ?? '');
                    $compCount = isset($args['compensation_count']) ? (int)$args['compensation_count'] : 1;
                    $leadPhone = preg_replace('/[^\d+]/', '', trim($args['lead_phone'] ?? ''));
                    $leadName = trim($args['lead_name'] ?? '');
                    $leadEmail = trim($args['lead_email'] ?? '');
                    $leadNote = trim($args['lead_note'] ?? '');
                    $shiftActive = isset($args['shift_active']) ? (bool)$args['shift_active'] : true;
                    $reason = trim($args['reason'] ?? 'Điều phối tự động qua AI Agent');
                    $canManageRounds = $isGlobalAdmin || $isManager || in_array($role, ['sale_admin', 'saleadmin', 'lead_manager', 'admin', 'director'], true);

                    // Helper: Fuzzy Resolve Round
                    $resolveRound = function() use ($db, $tid, $roundId, $roundNameKw) {
                        if ($roundId > 0) {
                            $stmt = $db->prepare("SELECT id, round_name, is_active, last_assigned_consultant_id FROM distribution_rounds WHERE id = ? AND tenant_id = ? LIMIT 1");
                            $stmt->execute([$roundId, $tid]);
                            $r = $stmt->fetch(PDO::FETCH_ASSOC);
                            if ($r) return ['exact' => $r];
                        }
                        if (!empty($roundNameKw)) {
                            $stmt = $db->prepare("SELECT id, round_name, is_active, last_assigned_consultant_id FROM distribution_rounds WHERE tenant_id = ? AND round_name LIKE ? ORDER BY is_active DESC, id ASC LIMIT 5");
                            $stmt->execute([$tid, "%{$roundNameKw}%"]);
                            $matches = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                            if (count($matches) === 1) return ['exact' => $matches[0]];
                            if (count($matches) > 1) return ['multiple' => $matches];
                        }
                        return null;
                    };

                    // Helper: Fuzzy Resolve Consultant
                    $resolveConsultant = function() use ($db, $tid, $consultantId, $consultantNameKw) {
                        if ($consultantId > 0) {
                            $stmt = $db->prepare("SELECT id, full_name, email, phone, is_active FROM users WHERE id = ? AND tenant_id = ? AND is_active = 1 LIMIT 1");
                            $stmt->execute([$consultantId, $tid]);
                            $u = $stmt->fetch(PDO::FETCH_ASSOC);
                            if ($u) return ['exact' => $u];
                        }
                        if (!empty($consultantNameKw)) {
                            $stmt = $db->prepare("SELECT id, full_name, email, phone, is_active FROM users WHERE tenant_id = ? AND is_active = 1 AND (full_name LIKE ? OR username LIKE ? OR phone LIKE ?) ORDER BY id ASC LIMIT 5");
                            $stmt->execute([$tid, "%{$consultantNameKw}%", "%{$consultantNameKw}%", "%{$consultantNameKw}%"]);
                            $matches = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                            if (count($matches) === 1) return ['exact' => $matches[0]];
                            if (count($matches) > 1) return ['multiple' => $matches];
                        }
                        return null;
                    };

                    switch ($action) {
                        // ----------------------------------------------------
                        // ACTION 1: GET ROUND LOAD AUDIT ("Nên giao vòng nào?")
                        // ----------------------------------------------------
                        case 'get_round_load_audit': {
                            $rStmt = $db->prepare("
                                SELECT id, round_name, description, is_active, last_assigned_consultant_id
                                FROM distribution_rounds
                                WHERE tenant_id = ? AND is_active = 1
                                ORDER BY id ASC
                            ");
                            $rStmt->execute([$tid]);
                            $rounds = $rStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                            if (empty($rounds)) {
                                return [
                                    'success' => true,
                                    'rounds_audited' => 0,
                                    'message' => 'Hiện tại hệ thống chưa kích hoạt vòng phân bổ lead nào (distribution_rounds). Vui lòng kiểm tra lại cấu hình phân bổ.'
                                ];
                            }

                            $auditData = [];
                            $bestCandidate = null;
                            $minAvgLeads = PHP_FLOAT_MAX;
                            $minTotalLeads = PHP_INT_MAX;

                            foreach ($rounds as $r) {
                                $rId = (int)$r['id'];

                                // Get enrolled active consultants
                                $cStmt = $db->prepare("
                                    SELECT rc.consultant_id, rc.is_active as shift_active, rc.compensation_count, rc.receive_ratio,
                                           u.full_name as consultant_name, u.phone as consultant_phone
                                    FROM round_consultants rc
                                    JOIN users u ON rc.consultant_id = u.id
                                    WHERE rc.round_id = ? AND rc.is_active = 1 AND u.is_active = 1
                                    ORDER BY rc.compensation_count DESC, rc.consultant_id ASC
                                ");
                                $cStmt->execute([$rId]);
                                $consultants = $cStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                                // Count leads assigned today in this round
                                $lStmt = $db->prepare("
                                    SELECT COUNT(1) FROM distribution_logs 
                                    WHERE round_id = ? AND DATE(received_at) = CURDATE()
                                ");
                                $lStmt->execute([$rId]);
                                $leadsToday = (int)$lStmt->fetchColumn();

                                // Check consultants with compensation backlog
                                $compQueue = [];
                                foreach ($consultants as $c) {
                                    if ((int)$c['compensation_count'] > 0) {
                                        $compQueue[] = [
                                            'consultant_id' => (int)$c['consultant_id'],
                                            'name' => $c['consultant_name'],
                                            'compensation_count' => (int)$c['compensation_count']
                                        ];
                                    }
                                }

                                $activeCount = count($consultants);
                                $avgLeads = $activeCount > 0 ? round($leadsToday / $activeCount, 1) : 0;

                                $roundItem = [
                                    'round_id' => $rId,
                                    'round_name' => $r['round_name'],
                                    'description' => $r['description'] ?: 'Không có mô tả',
                                    'active_consultants_count' => $activeCount,
                                    'leads_today' => $leadsToday,
                                    'avg_leads_per_consultant' => $avgLeads,
                                    'compensation_backlog_count' => count($compQueue),
                                    'compensation_queue' => $compQueue,
                                    'consultants_on_duty' => array_map(fn($c) => [
                                        'id' => (int)$c['consultant_id'],
                                        'name' => $c['consultant_name'],
                                        'has_compensation' => (int)$c['compensation_count'] > 0
                                    ], $consultants)
                                ];

                                if ($activeCount > 0) {
                                    if ($avgLeads < $minAvgLeads || ($avgLeads == $minAvgLeads && $leadsToday < $minTotalLeads)) {
                                        $minAvgLeads = $avgLeads;
                                        $minTotalLeads = $leadsToday;
                                        $bestCandidate = $roundItem;
                                    }
                                }

                                $auditData[] = $roundItem;
                            }

                            $recommendation = "";
                            if ($bestCandidate) {
                                $recommendation = "Khuyến nghị ưu tiên giao vào Vòng [{$bestCandidate['round_name']}] (ID: {$bestCandidate['round_id']}) vì vòng này hiện có {$bestCandidate['active_consultants_count']} chuyên viên đang trực và tải bình quân hôm nay thấp nhất ({$bestCandidate['avg_leads_per_consultant']} lead/người, tổng {$bestCandidate['leads_today']} lead).";
                            } else {
                                $recommendation = "Các vòng hiện tại chưa có chuyên viên nào bật trạng thái trực nhận số. Cần kiểm tra lại phân công ca trực trước khi giao số.";
                            }

                            return [
                                'success' => true,
                                'total_active_rounds' => count($auditData),
                                'rounds' => $auditData,
                                'recommended_round' => $bestCandidate ? [
                                    'round_id' => $bestCandidate['round_id'],
                                    'round_name' => $bestCandidate['round_name']
                                ] : null,
                                'recommendation_verdict' => $recommendation
                            ];
                        }

                        // ----------------------------------------------------
                        // ACTION 2: COMPENSATE CONSULTANT ("Bù cho Phúc 1 data")
                        // ----------------------------------------------------
                        case 'compensate_consultant': {
                            // RBAC: Only Admin, Director, Manager, or Sale Admin
                            if (!$canManageRounds) {
                                return [
                                    'success' => false,
                                    'error' => "Bạn không có thẩm quyền điều chỉnh hạn mức bù số của vòng xoay phân bổ (Yêu cầu vai trò Quản lý hoặc Quản trị viên/Sale Admin)."
                                ];
                            }

                            if ($compCount <= 0 || $compCount > 10) {
                                return [
                                    'success' => false,
                                    'error' => "Số lượng data cần bù không hợp lệ ({$compCount}). Giá trị cho phép từ 1 đến 10 data/lần."
                                ];
                            }

                            // 1. Resolve Consultant
                            $cRes = $resolveConsultant();
                            if (!$cRes) {
                                return [
                                    'success' => false,
                                    'error' => "Không tìm thấy chuyên viên tư vấn nào khớp với tên hoặc ID '{$consultantNameKw}'. Vui lòng cung cấp chính xác họ tên hoặc mã ID nhân sự."
                                ];
                            }
                            if (isset($cRes['multiple'])) {
                                $names = array_map(fn($m) => "[ID: {$m['id']}] {$m['full_name']} (SĐT: {$m['phone']})", $cRes['multiple']);
                                return [
                                    'success' => false,
                                    'error' => "Tìm thấy nhiều nhân sự khớp với tên '{$consultantNameKw}': " . implode(", ", $names) . ". Vui lòng chỉ định rõ ID nhân sự cần bù data."
                                ];
                            }
                            $consultant = $cRes['exact'];
                            $targetConsultantId = (int)$consultant['id'];

                            // 2. Resolve Round
                            $rRes = $resolveRound();
                            $targetRound = null;
                            if ($rRes && isset($rRes['exact'])) {
                                $targetRound = $rRes['exact'];
                            } elseif ($rRes && isset($rRes['multiple'])) {
                                $rNames = array_map(fn($m) => "[ID: {$m['id']}] {$m['round_name']}", $rRes['multiple']);
                                return [
                                    'success' => false,
                                    'error' => "Tìm thấy nhiều vòng phân bổ khớp với từ khóa: " . implode(", ", $rNames) . ". Vui lòng chỉ định rõ ID vòng cần bù."
                                ];
                            } else {
                                // Find rounds this consultant is currently in
                                $rcStmt = $db->prepare("
                                    SELECT dr.id, dr.round_name, dr.is_active
                                    FROM round_consultants rc
                                    JOIN distribution_rounds dr ON rc.round_id = dr.id
                                    WHERE rc.consultant_id = ? AND dr.tenant_id = ? AND dr.is_active = 1
                                    LIMIT 5
                                ");
                                $rcStmt->execute([$targetConsultantId, $tid]);
                                $assignedRounds = $rcStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                                if (count($assignedRounds) === 1) {
                                    $targetRound = $assignedRounds[0];
                                } elseif (count($assignedRounds) > 1) {
                                    $rNames = array_map(fn($m) => "[ID: {$m['id']}] {$m['round_name']}", $assignedRounds);
                                    return [
                                        'success' => false,
                                        'error' => "Chuyên viên {$consultant['full_name']} đang tham gia nhiều vòng xoay: " . implode(", ", $rNames) . ". Vui lòng nói rõ muốn bù data vào vòng nào."
                                    ];
                                } else {
                                    // Default to first active round in system
                                    $defStmt = $db->prepare("SELECT id, round_name, is_active FROM distribution_rounds WHERE tenant_id = ? AND is_active = 1 ORDER BY id ASC LIMIT 1");
                                    $defStmt->execute([$tid]);
                                    $targetRound = $defStmt->fetch(PDO::FETCH_ASSOC);
                                    if (!$targetRound) {
                                        return [
                                            'success' => false,
                                            'error' => "Hệ thống chưa có vòng phân bổ nào hoạt động để bù data."
                                        ];
                                    }
                                }
                            }

                            $targetRoundId = (int)$targetRound['id'];

                            // 3. Atomic Database Update
                            $db->beginTransaction();
                            try {
                                $chkStmt = $db->prepare("
                                    SELECT compensation_count FROM round_consultants 
                                    WHERE round_id = ? AND consultant_id = ? FOR UPDATE
                                ");
                                $chkStmt->execute([$targetRoundId, $targetConsultantId]);
                                $existing = $chkStmt->fetch(PDO::FETCH_ASSOC);

                                $prevCount = 0;
                                $newCount = $compCount;

                                if ($existing) {
                                    $prevCount = (int)$existing['compensation_count'];
                                    $newCount = $prevCount + $compCount;
                                    $upd = $db->prepare("UPDATE round_consultants SET compensation_count = compensation_count + ? WHERE round_id = ? AND consultant_id = ?");
                                    $upd->execute([$compCount, $targetRoundId, $targetConsultantId]);
                                } else {
                                    $ins = $db->prepare("INSERT INTO round_consultants (round_id, consultant_id, is_active, receive_ratio, compensation_count) VALUES (?, ?, 1, 1, ?)");
                                    $ins->execute([$targetRoundId, $targetConsultantId, $compCount]);
                                }

                                // Audit Log in distribution_logs
                                $auditMsg = "AI Agent bù {$compCount} data cho {$consultant['full_name']} tại Vòng {$targetRound['round_name']} (Lý do: {$reason}, Người thực hiện: {$userName})";
                                $logStmt = $db->prepare("INSERT INTO distribution_logs (lead_id, assigned_to, round_id, status, message, received_at) VALUES (NULL, ?, ?, 'compensation', ?, NOW())");
                                $logStmt->execute([$targetConsultantId, $targetRoundId, $auditMsg]);

                                $db->commit();

                                return [
                                    'success' => true,
                                    'action' => 'compensate_consultant',
                                    'consultant' => [
                                        'id' => $targetConsultantId,
                                        'name' => $consultant['full_name']
                                    ],
                                    'round' => [
                                        'id' => $targetRoundId,
                                        'name' => $targetRound['round_name']
                                    ],
                                    'added_count' => $compCount,
                                    'previous_compensation_count' => $prevCount,
                                    'current_compensation_count' => $newCount,
                                    'message' => "Đã ghi nhận bù thành công {$compCount} data cho chuyên viên {$consultant['full_name']} tại Vòng [{$targetRound['round_name']}]. Số lượt ưu tiên bù hiện tại: {$newCount}."
                                ];
                            } catch (\Throwable $e) {
                                if ($db->inTransaction()) $db->rollBack();
                                throw $e;
                            }
                        }

                        // ----------------------------------------------------
                        // ACTION 3: DISTRIBUTE LEAD ("Giao số 09... tên ... vào vòng")
                        // ----------------------------------------------------
                        case 'distribute_lead': {
                            if (!$canManageRounds) {
                                return [
                                    'success' => false,
                                    'error' => "Bạn không có thẩm quyền điều phối hoặc đưa khách hàng vào vòng phân bổ (Yêu cầu vai trò Quản lý hoặc Quản trị viên/Sale Admin)."
                                ];
                            }

                            if (strlen($leadPhone) < 8) {
                                return [
                                    'success' => false,
                                    'error' => "Số điện thoại khách hàng không hợp lệ ('{$leadPhone}'). Vui lòng cung cấp số điện thoại tối thiểu 8 chữ số."
                                ];
                            }

                            // 1. Resolve Target Round
                            $rRes = $resolveRound();
                            $targetRound = null;
                            if ($rRes && isset($rRes['exact'])) {
                                $targetRound = $rRes['exact'];
                            } else {
                                // Default to active round with lowest load
                                $defStmt = $db->prepare("
                                    SELECT dr.id, dr.round_name, dr.last_assigned_consultant_id,
                                           (SELECT COUNT(1) FROM distribution_logs dl WHERE dl.round_id = dr.id AND DATE(dl.received_at) = CURDATE()) as leads_today
                                    FROM distribution_rounds dr
                                    WHERE dr.tenant_id = ? AND dr.is_active = 1
                                    ORDER BY leads_today ASC, dr.id ASC LIMIT 1
                                ");
                                $defStmt->execute([$tid]);
                                $targetRound = $defStmt->fetch(PDO::FETCH_ASSOC);
                                if (!$targetRound) {
                                    return [
                                        'success' => false,
                                        'error' => "Không tìm thấy vòng phân bổ lead nào đang hoạt động trong hệ thống."
                                    ];
                                }
                            }

                            $targetRoundId = (int)$targetRound['id'];

                            // 2. Atomic Allocation Transaction
                            $db->beginTransaction();
                            try {
                                // Find or Create Contact in contacts table
                                $chkC = $db->prepare("SELECT id, full_name, phone, owner_id FROM contacts WHERE phone = ? AND tenant_id = ? LIMIT 1 FOR UPDATE");
                                $chkC->execute([$leadPhone, $tid]);
                                $existingContact = $chkC->fetch(PDO::FETCH_ASSOC);

                                $contactId = 0;
                                $isExisting = false;

                                if ($existingContact) {
                                    $contactId = (int)$existingContact['id'];
                                    $isExisting = true;
                                    $currentOwnerId = (int)($existingContact['owner_id'] ?? 0);
                                    if ($currentOwnerId > 0) {
                                        $ownerStmt = $db->prepare("SELECT full_name FROM users WHERE id = ?");
                                        $ownerStmt->execute([$currentOwnerId]);
                                        $ownerName = $ownerStmt->fetchColumn() ?: "ID #{$currentOwnerId}";
                                        $db->rollBack();
                                        return [
                                            'success' => false,
                                            'error' => "Khách hàng {$leadPhone} ({$existingContact['full_name']}) đã tồn tại trên hệ thống và đang thuộc quyền chăm sóc của chuyên viên [{$ownerName}]. Không thể tự ý chiếm đoạt hoặc phân bổ lại vào vòng xoay."
                                        ];
                                    }

                                    // Update notes or name if provided
                                    if (!empty($leadName) || !empty($leadNote)) {
                                        $updC = $db->prepare("UPDATE contacts SET full_name = COALESCE(NULLIF(?, ''), full_name), notes = CONCAT(IFNULL(notes, ''), '\n[AI Ghi chú]: ', ?) WHERE id = ?");
                                        $updC->execute([$leadName, $leadNote ?: 'Cập nhật từ AI chat', $contactId]);
                                    }
                                } else {
                                    $cName = !empty($leadName) ? $leadName : "Khách hàng {$leadPhone}";
                                    $insC = $db->prepare("
                                        INSERT INTO contacts (tenant_id, full_name, phone, email, notes, pipeline_status, created_by, created_at)
                                        VALUES (?, ?, ?, ?, ?, 'assigned', ?, NOW())
                                    ");
                                    $insC->execute([$tid, $cName, $leadPhone, $leadEmail, $leadNote ?: 'Tạo từ AI Chat', $uid]);
                                    $contactId = (int)$db->lastInsertId();
                                }

                                // 3. Select Winner Consultant in Round
                                // A. Priority 1: Consultant with compensation_count > 0
                                $compStmt = $db->prepare("
                                    SELECT rc.consultant_id, rc.compensation_count, u.full_name as consultant_name, u.phone as consultant_phone
                                    FROM round_consultants rc
                                    JOIN users u ON rc.consultant_id = u.id
                                    WHERE rc.round_id = ? AND rc.is_active = 1 AND rc.compensation_count > 0 AND u.is_active = 1
                                    ORDER BY rc.compensation_count DESC, rc.consultant_id ASC
                                    LIMIT 1
                                    FOR UPDATE
                                ");
                                $compStmt->execute([$targetRoundId]);
                                $compWinner = $compStmt->fetch(PDO::FETCH_ASSOC);

                                $winnerId = 0;
                                $winnerName = "";
                                $winnerPhone = "";
                                $distType = "rotation";

                                if ($compWinner) {
                                    $winnerId = (int)$compWinner['consultant_id'];
                                    $winnerName = $compWinner['consultant_name'];
                                    $winnerPhone = $compWinner['consultant_phone'];
                                    $distType = "compensation";

                                    // Decrement compensation count
                                    $decComp = $db->prepare("UPDATE round_consultants SET compensation_count = compensation_count - 1 WHERE round_id = ? AND consultant_id = ?");
                                    $decComp->execute([$targetRoundId, $winnerId]);
                                } else {
                                    // B. Priority 2: Next in Round-Robin rotation
                                    $rotStmt = $db->prepare("
                                        SELECT rc.consultant_id, u.full_name as consultant_name, u.phone as consultant_phone
                                        FROM round_consultants rc
                                        JOIN users u ON rc.consultant_id = u.id
                                        WHERE rc.round_id = ? AND rc.is_active = 1 AND u.is_active = 1
                                        ORDER BY rc.consultant_id ASC
                                    ");
                                    $rotStmt->execute([$targetRoundId]);
                                    $activeConsultants = $rotStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                                    if (empty($activeConsultants)) {
                                        $db->rollBack();
                                        return [
                                            'success' => false,
                                            'error' => "Vòng [{$targetRound['round_name']}] hiện tại không có chuyên viên nào đang trong ca trực nhận số. Vui lòng bật ca trực cho tư vấn viên trước."
                                        ];
                                    }

                                    // Pick next after last_assigned_consultant_id
                                    $lastId = (int)($targetRound['last_assigned_consultant_id'] ?? 0);
                                    $picked = null;

                                    foreach ($activeConsultants as $ac) {
                                        if ((int)$ac['consultant_id'] > $lastId) {
                                            $picked = $ac;
                                            break;
                                        }
                                    }
                                    if (!$picked) {
                                        $picked = $activeConsultants[0]; // Wrap around
                                    }

                                    $winnerId = (int)$picked['consultant_id'];
                                    $winnerName = $picked['consultant_name'];
                                    $winnerPhone = $picked['consultant_phone'];

                                    // Update last_assigned_consultant_id on round
                                    $updRound = $db->prepare("UPDATE distribution_rounds SET last_assigned_consultant_id = ? WHERE id = ?");
                                    $updRound->execute([$winnerId, $targetRoundId]);
                                }

                                // 4. Assign Owner to Contact
                                $updOwner = $db->prepare("UPDATE contacts SET owner_id = ?, pipeline_status = 'assigned' WHERE id = ?");
                                $updOwner->execute([$winnerId, $contactId]);

                                // 5. Insert Distribution Log
                                $logMsg = $distType === 'compensation'
                                    ? "AI Agent phân bổ khách hàng theo diện Ưu Tiên Bù Số cho {$winnerName}."
                                    : "AI Agent phân bổ khách hàng theo vòng xoay Round-Robin cho {$winnerName}.";
                                $insLog = $db->prepare("
                                    INSERT INTO distribution_logs (lead_id, assigned_to, round_id, status, message, received_at)
                                    VALUES (?, ?, ?, ?, ?, NOW())
                                ");
                                $insLog->execute([$contactId, $winnerId, $targetRoundId, $distType === 'compensation' ? 'compensation' : 'assigned', $logMsg]);

                                $db->commit();

                                return [
                                    'success' => true,
                                    'action' => 'distribute_lead',
                                    'contact' => [
                                        'id' => $contactId,
                                        'name' => !empty($leadName) ? $leadName : "Khách hàng {$leadPhone}",
                                        'phone' => $leadPhone,
                                        'is_new' => !$isExisting
                                    ],
                                    'round' => [
                                        'id' => $targetRoundId,
                                        'name' => $targetRound['round_name']
                                    ],
                                    'assigned_consultant' => [
                                        'id' => $winnerId,
                                        'name' => $winnerName,
                                        'phone' => $winnerPhone
                                    ],
                                    'distribution_type' => $distType,
                                    'distribution_message' => $logMsg,
                                    'verdict' => "Đã giao thành công khách hàng {$leadPhone} (" . (!empty($leadName) ? $leadName : 'Chưa có tên') . ") vào Vòng [{$targetRound['round_name']}]. Người nhận số: {$winnerName} (Diện: " . ($distType === 'compensation' ? 'Ưu tiên bù số' : 'Vòng xoay luân phiên') . ")."
                                ];
                            } catch (\Throwable $e) {
                                if ($db->inTransaction()) $db->rollBack();
                                throw $e;
                            }
                        }

                        // ----------------------------------------------------
                        // ACTION 4: TOGGLE CONSULTANT SHIFT ("Bật/tắt ca trực")
                        // ----------------------------------------------------
                        case 'toggle_consultant_shift': {
                            if (!$canManageRounds) {
                                return [
                                    'success' => false,
                                    'error' => "Bạn không có quyền điều chỉnh ca trực nhận số của chuyên viên (Yêu cầu vai trò Quản lý hoặc Quản trị viên/Sale Admin)."
                                ];
                            }

                            $cRes = $resolveConsultant();
                            if (!$cRes || !isset($cRes['exact'])) {
                                return [
                                    'success' => false,
                                    'error' => "Không tìm thấy chuyên viên tư vấn phù hợp để thay đổi ca trực."
                                ];
                            }
                            $consultant = $cRes['exact'];
                            $targetConsultantId = (int)$consultant['id'];

                            $rRes = $resolveRound();
                            if (!$rRes || !isset($rRes['exact'])) {
                                return [
                                    'success' => false,
                                    'error' => "Vui lòng chỉ định rõ vòng phân bổ cần điều chỉnh ca trực."
                                ];
                            }
                            $round = $rRes['exact'];
                            $targetRoundId = (int)$round['id'];

                            $newStatus = $shiftActive ? 1 : 0;
                            $updShift = $db->prepare("UPDATE round_consultants SET is_active = ? WHERE round_id = ? AND consultant_id = ?");
                            $updShift->execute([$newStatus, $targetRoundId, $targetConsultantId]);

                            return [
                                'success' => true,
                                'action' => 'toggle_consultant_shift',
                                'consultant' => ['id' => $targetConsultantId, 'name' => $consultant['full_name']],
                                'round' => ['id' => $targetRoundId, 'name' => $round['round_name']],
                                'shift_active' => (bool)$newStatus,
                                'message' => "Đã " . ($newStatus ? "BẬT" : "TẮT") . " trạng thái trực nhận số của chuyên viên {$consultant['full_name']} tại Vòng [{$round['round_name']}]."
                            ];
                        }

                        // ----------------------------------------------------
                        // ACTION 5: LIST ROUNDS
                        // ----------------------------------------------------
                        case 'list_rounds':
                        default: {
                            $stmt = $db->prepare("
                                SELECT dr.id, dr.round_name, dr.description, dr.is_active, dr.last_assigned_consultant_id,
                                       u.full_name as last_assigned_consultant_name,
                                       (SELECT COUNT(1) FROM round_consultants rc WHERE rc.round_id = dr.id AND rc.is_active = 1) as active_consultant_count,
                                       (SELECT COUNT(1) FROM distribution_logs dl WHERE dl.round_id = dr.id AND DATE(dl.received_at) = CURDATE()) as leads_today
                                FROM distribution_rounds dr
                                LEFT JOIN users u ON dr.last_assigned_consultant_id = u.id
                                WHERE dr.tenant_id = ?
                                ORDER BY dr.is_active DESC, dr.id ASC
                            ");
                            $stmt->execute([$tid]);
                            $rounds = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                            return [
                                'success' => true,
                                'total_rounds' => count($rounds),
                                'rounds' => $rounds,
                                'summary' => "Hiện có " . count($rounds) . " vòng phân bổ lead trong hệ thống."
                            ];
                        }
                    }
                }

                default:
                    return [
                        'success' => false,
                        'error' => "Tool {$toolName} không tồn tại hoặc chưa được hỗ trợ."
                    ];
            }
        } catch (\Throwable $e) {
            error_log("Execute Tool [{$toolName}] Error: " . $e->getMessage());
            return [
                'success' => false,
                'error' => "Lỗi thực thi công cụ: " . $e->getMessage()
            ];
        }
    }
}
