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
                                'scope' => [
                                    'type' => 'STRING',
                                    'enum' => ['mine', 'team', 'company'],
                                    'description' => 'Phạm vi tra cứu công việc: mine (việc của tôi), team (việc của toàn nhóm do tôi làm Trưởng phòng/Quản lý), company (việc toàn viện dành cho Admin/Giám đốc). Mặc định: mine'
                                ],
                                'assignee_name' => [
                                    'type' => 'STRING',
                                    'description' => 'Lọc công việc theo tên nhân viên phụ trách'
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
                        'description' => 'Tra cứu và lọc học viên, khách hàng tiềm năng, đối tác trong hệ thống CRM theo tổ hợp bộ lọc đa chiều (từ khóa họ tên/SĐT/Email, giới tính, giai đoạn pipeline, chuyên viên phụ trách, số ngày chưa tương tác/bỏ quên > 90 ngày, nguồn, ngày tạo). Tự động cung cấp link mở hồ sơ và đường link xuất file Excel/CSV chuẩn xác.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'query' => [
                                    'type' => 'STRING',
                                    'description' => 'Từ khóa tìm kiếm: Số điện thoại, email, họ tên hoặc mã ID khách hàng (tùy chọn)'
                                ],
                                'gender' => [
                                    'type' => 'STRING',
                                    'enum' => ['all', 'male', 'female'],
                                    'description' => 'Lọc theo giới tính (male: nam, female: nữ, all: tất cả)'
                                ],
                                'stage_id' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Mã giai đoạn pipeline (1: New Lead, 2: Connected, 3: Qualified, 4: Needed...)'
                                ],
                                'stage_name' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên hoặc slug giai đoạn (ví dụ: "new_lead", "needed", "connected")'
                                ],
                                'owner_name' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên chuyên viên phụ trách (ví dụ: "Linh Đan", "Bùi Tuấn Anh")'
                                ],
                                'owner_id' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Mã ID chuyên viên tư vấn phụ trách'
                                ],
                                'stale_days' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Lọc các lead bỏ quên / không có tương tác trên N ngày (ví dụ: 90 ngày)'
                                ],
                                'source' => [
                                    'type' => 'STRING',
                                    'description' => 'Nguồn khách hàng (Facebook Ads, Website, Hotline, Zalo, Giới thiệu...)'
                                ],
                                'created_from' => [
                                    'type' => 'STRING',
                                    'description' => 'Ngày tạo từ (YYYY-MM-DD)'
                                ],
                                'created_to' => [
                                    'type' => 'STRING',
                                    'description' => 'Ngày tạo đến (YYYY-MM-DD)'
                                ],
                                'limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng khách hàng xem trước (mặc định 5, tối đa 20)'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'filter_expenses_advanced',
                        'description' => 'Tra cứu và lọc đề xuất thanh toán, chi phí (PO), tạm ứng toàn viện theo trạng thái duyệt (chờ duyệt L1/L2, đã duyệt, đã chi/chưa chi), phòng ban, hạn mức số tiền min-max, và hạn thanh toán.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'status' => [
                                    'type' => 'STRING',
                                    'enum' => ['all', 'pending', 'pending_l1', 'pending_l2', 'approved', 'rejected', 'paid', 'unpaid'],
                                    'description' => 'Trạng thái đề xuất: pending (chờ duyệt), approved (đã duyệt), paid (đã chi), unpaid (đã duyệt chưa chi), all (tất cả)'
                                ],
                                'department' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên phòng ban hoặc danh mục chi phí (ví dụ: Marketing, Văn phòng, Đào tạo)'
                                ],
                                'min_amount' => [
                                    'type' => 'NUMBER',
                                    'description' => 'Số tiền tối thiểu (VNĐ)'
                                ],
                                'max_amount' => [
                                    'type' => 'NUMBER',
                                    'description' => 'Số tiền tối đa (VNĐ)'
                                ],
                                'deadline_status' => [
                                    'type' => 'STRING',
                                    'enum' => ['all', 'overdue', 'today', 'this_week'],
                                    'description' => 'Hạn thanh toán: overdue (quá hạn), today (hôm nay), this_week (tuần này)'
                                ],
                                'created_by_name' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên người tạo đề xuất'
                                ],
                                'limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng bản ghi (mặc định 5, tối đa 20)'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'get_sales_leaderboard',
                        'description' => 'Bảng vàng xếp hạng doanh số, tiền cọc và số hợp đồng của các chuyên viên tư vấn / Sales theo ngày, tuần, tháng, quý, năm.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'period' => [
                                    'type' => 'STRING',
                                    'enum' => ['today', 'yesterday', 'this_week', 'this_month', 'last_month', 'this_quarter', 'this_year'],
                                    'description' => 'Khoảng thời gian thống kê (mặc định this_month)'
                                ],
                                'top_limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng chuyên viên hiển thị trong Top (mặc định 5, tối đa 10)'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'get_staff_directory_advanced',
                        'description' => 'Tra cứu danh bạ nhân sự toàn viện với bộ lọc chuyên sâu: sinh nhật trong tháng, loại hợp đồng (thử việc, chính thức, part-time), phòng ban, hoặc từ khóa tìm kiếm.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'birthday_month' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Tháng sinh nhật cần tra cứu (1-12)'
                                ],
                                'contract_type' => [
                                    'type' => 'STRING',
                                    'enum' => ['all', 'probation', 'official', 'part_time', 'intern', 'resigned'],
                                    'description' => 'Loại hợp đồng: probation (thử việc), official (chính thức), part_time, resigned (đã nghỉ)'
                                ],
                                'department' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên phòng ban hoặc chức danh'
                                ],
                                'keyword' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên, email hoặc số điện thoại nhân sự'
                                ],
                                'limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng nhân sự hiển thị (mặc định 10, tối đa 30)'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'get_academic_students_filter',
                        'description' => 'Tra cứu và lọc hồ sơ học viên các chương trình đào tạo (EMBA, MBA, MSc AI, DBA), kiểm tra tình trạng thiếu hồ sơ nhập học, bản dịch công chứng, hợp đồng đào tạo.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'program_code' => [
                                    'type' => 'STRING',
                                    'description' => 'Mã hoặc tên chương trình đào tạo (ví dụ: EMBA, MBA, MSc AI, DBA)'
                                ],
                                'study_status' => [
                                    'type' => 'STRING',
                                    'enum' => ['all', 'studying', 'completed', 'reserved', 'suspended', 'graduated', 'deferred', 'dropped'],
                                    'description' => 'Tình trạng học tập'
                                ],
                                'missing_doc' => [
                                    'type' => 'STRING',
                                    'enum' => ['all', 'id_card', 'degree', 'translation', 'contract'],
                                    'description' => 'Lọc theo tình trạng hồ sơ còn thiếu: id_card (thiếu CCCD), degree (thiếu bằng ĐH), translation (thiếu dịch thuật công chứng), contract (chưa ký hợp đồng)'
                                ],
                                'limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng học viên hiển thị (mặc định 5, tối đa 20)'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'get_inventory_health_check',
                        'description' => 'Kiểm tra sức khỏe kho vật tư, ấn phẩm tuyển sinh, quà tặng (balo, áo, bút ký, tài liệu) và tài sản công ty; phát hiện các món tồn kho dưới định mức an toàn hoặc hết hàng.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'alert_only' => [
                                    'type' => 'BOOLEAN',
                                    'description' => 'Chỉ lấy các mặt hàng cảnh báo hết hoặc sắp hết (tồn kho <= 10 hoặc hết hàng)'
                                ],
                                'category' => [
                                    'type' => 'STRING',
                                    'description' => 'Danh mục vật phẩm (quà tặng, ấn phẩm, đồng phục, tài sản)'
                                ],
                                'keyword' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên hoặc SKU vật phẩm'
                                ],
                                'limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng kết quả (mặc định 10, tối đa 25)'
                                ]
                            ]
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
                        'name' => 'query_company_attendance_and_work_hours',
                        'description' => 'Tra cứu toàn diện dữ liệu chấm công, đi trễ, về sớm, tăng ca (OT), nghỉ phép, làm việc từ xa (WFH), và bảng công chi tiết theo ngày/tháng/khoảng thời gian của toàn công ty, theo team, hoặc của nhân sự cụ thể. Hỗ trợ trích xuất Top đi trễ nhiều nhất, Top tăng ca, và cung cấp link tải/export file bảng công Excel. Phân quyền: Ban Giám đốc/HR xem toàn công ty; Manager xem team; Cá nhân xem chính mình.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'scope' => [
                                    'type' => 'STRING',
                                    'enum' => ['top_late', 'top_overtime', 'employee_detail', 'month_summary', 'date_detail', 'today_status', 'export_link'],
                                    'description' => 'Phạm vi tra cứu: top_late (Top nhân viên đi trễ nhiều nhất), top_overtime (Top tăng ca OT), employee_detail (Chi tiết bảng công của 1 nhân sự cụ thể), month_summary (Tổng hợp công tháng), date_detail (Chi tiết quẹt thẻ ngày cụ thể), today_status (Tình hình đi làm/WFH/vắng mặt hôm nay), export_link (Lấy link tải file bảng công).'
                                ],
                                'user_query' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên hoặc mã ID của nhân sự cụ thể (ví dụ: "Huỳnh Trọng Phúc", "Phúc", 100067)'
                                ],
                                'month' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Tháng cần tra cứu (1-12, mặc định tháng hiện tại)'
                                ],
                                'year' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Năm cần tra cứu (mặc định năm hiện tại)'
                                ],
                                'specific_date' => [
                                    'type' => 'STRING',
                                    'description' => 'Ngày cụ thể (định dạng YYYY-MM-DD, hoặc "today", "yesterday", "hôm nay", "hôm qua")'
                                ],
                                'from_date' => [
                                    'type' => 'STRING',
                                    'description' => 'Ngày bắt đầu khoảng thời gian (YYYY-MM-DD)'
                                ],
                                'to_date' => [
                                    'type' => 'STRING',
                                    'description' => 'Ngày kết thúc khoảng thời gian (YYYY-MM-DD)'
                                ],
                                'department' => [
                                    'type' => 'STRING',
                                    'description' => 'Lọc theo phòng ban hoặc team nếu có'
                                ],
                                'limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng kết quả cần lấy (mặc định 10, tối đa 50)'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'export_crm_leads_advanced',
                        'description' => 'Xuất file / tải danh sách Lead, khách hàng tiềm năng CRM theo tổ hợp bộ lọc đa tầng: Giai đoạn Pipeline (ví dụ: "1-4", "1,2,3,4,13", "pipeline 1 đến 4 hoặc 13"), Giới tính (Nam / Nữ / Tất cả), Khoảng thời gian (từ ngày... đến ngày...), Chương trình học quan tâm. Tự động đếm số lượng thực tế trong CSDL, trích xuất 3-5 khách hàng mẫu xem trước và tạo link tải file CSV/Excel UTF-8 BOM chuẩn cho người dùng.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'stages' => [
                                    'type' => 'STRING',
                                    'description' => 'Các giai đoạn pipeline cần xuất (ví dụ: "1-4,13", "1,2,3,4,13", "new_lead,connected", hoặc "all").'
                                ],
                                'gender' => [
                                    'type' => 'STRING',
                                    'enum' => ['male', 'female', 'all', 'nam', 'nu'],
                                    'description' => 'Giới tính khách hàng cần lọc: "male" hoặc "nam" (Nam), "female" hoặc "nu" (Nữ), "all" (Tất cả).'
                                ],
                                'from_date' => [
                                    'type' => 'STRING',
                                    'description' => 'Ngày bắt đầu lọc (định dạng YYYY-MM-DD)'
                                ],
                                'to_date' => [
                                    'type' => 'STRING',
                                    'description' => 'Ngày kết thúc lọc (định dạng YYYY-MM-DD)'
                                ],
                                'program' => [
                                    'type' => 'STRING',
                                    'description' => 'Lọc theo chương trình quan tâm (ví dụ: MBA, EMBA, DBA, BBA, MSCAI)'
                                ],
                                'search' => [
                                    'type' => 'STRING',
                                    'description' => 'Từ khóa tìm kiếm theo tên hoặc SĐT'
                                ],
                                'limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng lead cần lấy/xuất (ví dụ: 100, 50, 200). Mặc định để trống để xuất toàn bộ theo bộ lọc.'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'analyze_leads_demographics_and_job_titles',
                        'description' => 'Phân tích chuyên sâu cơ cấu chức vụ, nhóm ngành nghề kinh doanh, cấp bậc quản lý (C-Level/Lãnh đạo, Quản lý cấp trung, Chuyên viên), và tỷ lệ hoàn thiện dữ liệu chức vụ/công ty của tập khách hàng/lead CRM (hoặc 100/500 lead gần nhất). Tự động phân nhóm và cung cấp biểu đồ trực quan cho Marketing và Ban Giám đốc.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng lead gần nhất cần phân tích (ví dụ: 100, 500, 1000). Mặc định để trống để phân tích toàn bộ dataset theo bộ lọc.'
                                ],
                                'program' => [
                                    'type' => 'STRING',
                                    'description' => 'Lọc theo chương trình đào tạo nếu có (ví dụ: MBA, EMBA, DBA, BBA, MSCAI)'
                                ],
                                'stages' => [
                                    'type' => 'STRING',
                                    'description' => 'Lọc theo các giai đoạn pipeline (ví dụ: "1-4", "1,2,3,4,13", "all")'
                                ],
                                'has_job_title_only' => [
                                    'type' => 'BOOLEAN',
                                    'description' => 'Chỉ phân tích các lead đã cập nhật chức vụ (mặc định false: phân tích toàn bộ và báo cáo tỷ lệ)'
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
                        'description' => 'Tra cứu phiếu lương cá nhân hoặc tra cứu tiền lương nhân viên/toàn viện theo phân quyền RBAC nghiêm ngặt: Giám đốc/Admin/HR được quyền tra cứu mọi nhân viên hoặc tổng quan quỹ lương toàn viện; Quản lý/Trưởng phòng được tra cứu nhân viên thuộc team mình; Nhân viên chỉ được tra cứu chính mình.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'employee_query' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên hoặc mã nhân viên cần tra cứu phiếu lương (dành cho Giám đốc, HR, hoặc Trưởng phòng tra cứu nhân sự thuộc quyền). Để trống nếu người dùng tự tra cứu phiếu lương của chính mình, hoặc nhập "all" / "toan cong ty" nếu Giám đốc/HR muốn xem tổng quỹ lương.'
                                ],
                                'month' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Tháng cần tra cứu (1-12, mặc định tháng hiện tại hoặc gần nhất có bảng lương)'
                                ],
                                'year' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Năm cần tra cứu (mặc định năm hiện tại)'
                                ],
                                'summary_all' => [
                                    'type' => 'BOOLEAN',
                                    'description' => 'Đặt true nếu Giám đốc/HR muốn xem báo cáo tổng hợp quỹ lương toàn công ty'
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
                        'description' => 'Chỉ đường, cung cấp link điều hướng trực tiếp và mở tab/modal hồ sơ của bất kỳ đối tượng nào trong MYERP (Học viên/Khách hàng cụ thể, Phiếu chi PO, Đơn cọc SO, Phiếu duyệt Quy trình, Task công việc, hoặc các phân hệ chính). Hỗ trợ tra cứu theo tên hoặc mã ID để mở đúng tab hồ sơ cá nhân.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'destination' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên tính năng hoặc đối tượng cần mở tab (ví dụ: học viên, khách hàng, ngô quang hưng, phiếu chi, đơn cọc, chấm công, bàn làm việc)'
                                ],
                                'search_query' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên người, mã ID hoặc từ khóa hồ sơ cụ thể cần mở tab (ví dụ: Ngô Quang Hưng, PO-2024, #1024960)'
                                ],
                                'target_id' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Mã ID cụ thể của hồ sơ cần mở (nếu biết)'
                                ],
                                'entity_type' => [
                                    'type' => 'STRING',
                                    'enum' => ['contact', 'po', 'so', 'workflow', 'task', 'general'],
                                    'description' => 'Loại thực thể cần mở: contact (học viên/khách), po (phiếu chi), so (đơn cọc), workflow (quy trình), task (công việc)'
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
                        'description' => 'Tra cứu lịch sử 360 độ toàn diện của khách hàng/học viên khi người dùng hỏi sâu hoặc hỏi tới: Khách vào CRM từ lúc nào (ngày tạo, nguồn marketing, chiến dịch), ai chăm sóc/tư vấn (chuyên viên phụ trách, người cộng tác, chi nhánh), lịch sử ghi chú tương tác tư vấn (mặc định lấy 3 cái gần nhất, hỗ trợ lấy 5, 10 hoặc lấy hết/tất cả qua tham số notes_limit), danh mục hồ sơ giấy tờ trong cloud_files (hồ sơ có gì), và thẩm định điều kiện nhập học (chuẩn hết chưa, thiếu giấy tờ gì), kèm tình trạng tài chính đặt cọc/học phí.',
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
                                ],
                                'notes_limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng tương tác/ghi chú tư vấn cần lấy (mặc định 3 cái gần nhất. Nếu người dùng yêu cầu lấy 5, lấy 10 hoặc lấy hết/tất cả thì truyền số lượng tương ứng từ 3 đến 50).'
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
                                'include_revenue' => [
                                    'type' => 'BOOLEAN',
                                    'description' => 'Bao gồm tổng doanh số tiền cọc/học phí đã duyệt thu từ kế toán của tư vấn viên'
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
                    ],
                    [
                        'name' => 'query_crm_leads_multitier',
                        'description' => 'SIÊU CÔNG CỤ TRUY VẤN & PHÂN TÍCH CRM ĐA TẦNG, ĐA CẤP (MULTI-TIER CRM QUERY & FACET ENGINE): Lọc và bóc tách phễu dữ liệu học viên/lead theo tổ hợp nhiều điều kiện lồng nhau: nhiều chương trình (MBA, EMBA, DBA, MSCAI, BBA), nhiều giai đoạn pipeline (ví dụ: "1-4,13", "1,2,3,4", "new_lead,consulted,deposit"), nhiều nguồn tiếp cận (Facebook, Hotline, Referral, Workshop), nhiều chi nhánh/thành phố (Hà Nội, TP.HCM, Đà Nẵng), chuyên viên tư vấn, tình trạng đóng cọc / hợp đồng SO (có cọc / chưa cọc, mức tiền cọc tối thiểu/tối đa), số ngày bỏ quên chưa tương tác (stale_days), và khoảng thời gian. Tự động tính toán tổng số bản ghi thực tế, ma trận phân nhóm đa chiều (Group-by Program, Stage, Source, Owner), tỷ lệ chuyển đổi %, trích xuất xem trước các học viên tiêu biểu kèm link mở hồ sơ, sinh biểu đồ trực quan Recharts và tạo link tải file Excel/CSV UTF-8 BOM.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'programs' => [
                                    'type' => 'STRING',
                                    'description' => 'Danh sách một hoặc nhiều chương trình đào tạo cần lọc (cách nhau bởi dấu phẩy, ví dụ: "MBA, EMBA" hoặc "DBA, MSCAI, BBA"). Để trống nếu lấy tất cả.'
                                ],
                                'stages' => [
                                    'type' => 'STRING',
                                    'description' => 'Danh sách các giai đoạn pipeline (ví dụ: "1-4", "1,2,3,4,13", "new_lead,connected,consulted", hoặc "deposit"). Để trống nếu lấy tất cả.'
                                ],
                                'sources' => [
                                    'type' => 'STRING',
                                    'description' => 'Danh sách nguồn khách hàng (ví dụ: "Facebook, Hotline, Referral" hoặc "Website, Workshop").'
                                ],
                                'branches_or_cities' => [
                                    'type' => 'STRING',
                                    'description' => 'Địa bàn / chi nhánh (ví dụ: "Hà Nội, TP.HCM", "HCM", "Đà Nẵng").'
                                ],
                                'gender' => [
                                    'type' => 'STRING',
                                    'enum' => ['all', 'male', 'female'],
                                    'description' => 'Lọc theo giới tính: male (nam), female (nữ), all (tất cả).'
                                ],
                                'owners' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên hoặc ID chuyên viên tư vấn phụ trách (cách nhau bởi dấu phẩy, ví dụ: "Linh Đan, Bùi Tuấn Anh" hoặc "Phúc").'
                                ],
                                'financial_filter' => [
                                    'type' => 'STRING',
                                    'enum' => ['all', 'has_deposit', 'no_deposit', 'has_so', 'high_value_deposit'],
                                    'description' => 'Bộ lọc tài chính: all (tất cả), has_deposit (đã có đặt cọc), no_deposit (chưa có đặt cọc), has_so (đã ký đơn bán hàng SO), high_value_deposit (tiền cọc >= 10.000.000 VNĐ).'
                                ],
                                'min_deposit_amount' => [
                                    'type' => 'NUMBER',
                                    'description' => 'Số tiền cọc tối thiểu (VNĐ) nếu muốn lọc chính xác theo mức tiền.'
                                ],
                                'stale_days' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Lọc học viên/lead bỏ quên không có tương tác trên N ngày (ví dụ: 30, 60, 90).'
                                ],
                                'interaction_status' => [
                                    'type' => 'STRING',
                                    'enum' => ['all', 'has_activity', 'no_activity', 'has_call_recently'],
                                    'description' => 'Trạng thái chăm sóc: has_activity (đã có lịch sử gọi/ghi chú), no_activity (chưa từng tương tác), has_call_recently (có cuộc gọi trong 30 ngày qua).'
                                ],
                                'date_field' => [
                                    'type' => 'STRING',
                                    'enum' => ['created_at', 'last_contact', 'deposit_date'],
                                    'description' => 'Trường thời gian áp dụng cho from_date / to_date (mặc định created_at).'
                                ],
                                'from_date' => [
                                    'type' => 'STRING',
                                    'description' => 'Từ ngày (định dạng YYYY-MM-DD).'
                                ],
                                'to_date' => [
                                    'type' => 'STRING',
                                    'description' => 'Đến ngày (định dạng YYYY-MM-DD).'
                                ],
                                'search_query' => [
                                    'type' => 'STRING',
                                    'description' => 'Từ khóa tìm kiếm theo tên, số điện thoại hoặc email.'
                                ],
                                'group_by' => [
                                    'type' => 'STRING',
                                    'enum' => ['program_stage', 'source_stage', 'owner_stage', 'branch_program', 'month_source', 'none'],
                                    'description' => 'Chiều bóc tách ma trận: program_stage (Chương trình × Giai đoạn), source_stage (Nguồn × Giai đoạn/Cọc), owner_stage (Chuyên viên × Doanh số cọc), branch_program (Chi nhánh × Chương trình), month_source (Tháng × Nguồn lead).'
                                ],
                                'limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng bản ghi xem trước (mặc định 5, tối đa 20).'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'query_finance_multitier_analytics',
                        'description' => 'SIÊU CÔNG CỤ PHÂN TÍCH TÀI CHÍNH, CHI PHÍ & NGÂN SÁCH ĐA TẦNG (MULTI-TIER FINANCIAL & EXPENSE ANALYTICS): Phân tích, tổng hợp và bóc tách các đề xuất chi phí (PO), tạm ứng, dòng tiền toàn viện hoặc theo phòng ban (Marketing, Tuyển sinh, Học vụ, Vận hành), hạng mục chi tiêu, và trạng thái phê duyệt (chờ duyệt L1/L2, đã duyệt, đã chi, đã hoàn ứng). Tự động tính tổng ngân sách, chi tiêu thực tế, phát hiện các khoản chi vượt hạn mức hoặc sắp đến hạn thanh toán, trích xuất ma trận phòng ban × hạng mục, kèm biểu đồ trực quan Recharts.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'departments' => [
                                    'type' => 'STRING',
                                    'description' => 'Danh sách phòng ban cần phân tích (cách nhau bởi dấu phẩy, ví dụ: "Marketing, Đào tạo, Tuyển sinh, Văn phòng"). Để trống nếu lấy toàn viện.'
                                ],
                                'categories' => [
                                    'type' => 'STRING',
                                    'description' => 'Danh sách hạng mục chi phí (ví dụ: "Quảng cáo, Sự kiện, Thuê văn phòng, Thiết bị, Tiếp khách").'
                                ],
                                'statuses' => [
                                    'type' => 'STRING',
                                    'description' => 'Trạng thái duyệt: "pending, approved, paid, rejected" hoặc "pending_l1, pending_l2". Mặc định lấy tất cả.'
                                ],
                                'period' => [
                                    'type' => 'STRING',
                                    'enum' => ['this_month', 'last_month', 'this_quarter', 'last_quarter', 'this_year', 'custom'],
                                    'description' => 'Kỳ phân tích (mặc định this_month).'
                                ],
                                'from_date' => [
                                    'type' => 'STRING',
                                    'description' => 'Từ ngày (định dạng YYYY-MM-DD khi chọn period=custom).'
                                ],
                                'to_date' => [
                                    'type' => 'STRING',
                                    'description' => 'Đến ngày (định dạng YYYY-MM-DD khi chọn period=custom).'
                                ],
                                'min_amount' => [
                                    'type' => 'NUMBER',
                                    'description' => 'Số tiền tối thiểu (VNĐ).'
                                ],
                                'max_amount' => [
                                    'type' => 'NUMBER',
                                    'description' => 'Số tiền tối đa (VNĐ).'
                                ],
                                'overdue_only' => [
                                    'type' => 'BOOLEAN',
                                    'description' => 'Chỉ lọc các khoản chi/tạm ứng đã quá hạn thanh toán.'
                                ],
                                'group_by' => [
                                    'type' => 'STRING',
                                    'enum' => ['department_category', 'department_status', 'month_department', 'category'],
                                    'description' => 'Chiều bóc tách phân tích: department_category (Phòng ban × Hạng mục), department_status (Phòng ban × Trạng thái duyệt), month_department (Tháng × Phòng ban).'
                                ],
                                'limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng khoản chi tiêu biểu xem trước (mặc định 5, tối đa 20).'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'query_deposits_and_revenue_multitier',
                        'description' => 'SIÊU CÔNG CỤ PHÂN TÍCH ĐA TẦNG DOANH THU, PHIẾU THU CỌC (SO) & CÔNG NỢ HỌC VIÊN: Lọc chéo và gom nhóm đa chiều theo chương trình/dự án (EMBA, MBA, DBA...), trạng thái phiếu thu (approved, pending, cancelled), chuyên viên tư vấn/người tạo, tình trạng công nợ đợt đóng tiền (deposit_milestones: overdue, due_soon, unpaid, fully_paid), khoảng tiền, khoảng ngày và tự động sinh biểu đồ kèm link tải file Excel/CSV.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'programs' => [
                                    'type' => 'STRING',
                                    'description' => 'Lọc theo chương trình học hoặc dự án (cách nhau dấu phẩy, VD: "EMBA,DBA,MBA").'
                                ],
                                'statuses' => [
                                    'type' => 'STRING',
                                    'description' => 'Trạng thái phiếu cọc/SO (VD: "approved", "pending", "cancelled" hoặc "approved,pending").'
                                ],
                                'owners' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên hoặc ID chuyên viên tư vấn / người lập phiếu (cách nhau dấu phẩy).'
                                ],
                                'milestone_status' => [
                                    'type' => 'STRING',
                                    'enum' => ['all', 'overdue', 'due_soon', 'unpaid', 'fully_paid'],
                                    'description' => 'Lọc theo tiến độ thanh toán các đợt cọc (deposit_milestones): overdue (Quá hạn đóng học phí), due_soon (Sắp đến hạn trong 7 ngày), unpaid (Còn đợt chưa hoàn tất), fully_paid (Đã đóng đủ các đợt).'
                                ],
                                'min_amount' => [
                                    'type' => 'NUMBER',
                                    'description' => 'Mức tiền cọc/học phí tối thiểu (VNĐ).'
                                ],
                                'max_amount' => [
                                    'type' => 'NUMBER',
                                    'description' => 'Mức tiền cọc/học phí tối đa (VNĐ).'
                                ],
                                'period' => [
                                    'type' => 'STRING',
                                    'enum' => ['all', 'today', 'this_week', 'this_month', 'last_month', 'this_quarter', 'last_quarter', 'this_year'],
                                    'description' => 'Kỳ thời gian nhanh (mặc định: all).'
                                ],
                                'from_date' => [
                                    'type' => 'STRING',
                                    'description' => 'Từ ngày (YYYY-MM-DD).'
                                ],
                                'to_date' => [
                                    'type' => 'STRING',
                                    'description' => 'Đến ngày (YYYY-MM-DD).'
                                ],
                                'search_query' => [
                                    'type' => 'STRING',
                                    'description' => 'Từ khóa tìm theo tên học viên, SĐT, mã phiếu unit_code, ghi chú.'
                                ],
                                'limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng bản ghi xem trước (mặc định 10, tối đa 25).'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'query_tasks_and_projects_multitier',
                        'description' => 'SIÊU CÔNG CỤ PHÂN TÍCH ĐA TẦNG CÔNG VIỆC, NHIỆM VỤ & TIẾN ĐỘ DỰ ÁN/PHÒNG BAN: Lọc chéo và thống kê công việc theo trạng thái (pending, in_progress, completed, overdue, waiting_approval), mức độ ưu tiên (urgent, high, medium, low), nhân sự thực hiện, người giao, phòng ban/nhóm việc (task_groups), khoảng deadline và tự động sinh biểu đồ kèm link tải file Excel/CSV.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'statuses' => [
                                    'type' => 'STRING',
                                    'description' => 'Lọc trạng thái công việc (cách nhau dấu phẩy: pending, in_progress, completed, cancelled, overdue, today, waiting_approval).'
                                ],
                                'priorities' => [
                                    'type' => 'STRING',
                                    'description' => 'Lọc mức độ ưu tiên (cách nhau dấu phẩy: urgent, high, medium, low).'
                                ],
                                'assignees' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên hoặc ID người được giao việc (cách nhau dấu phẩy).'
                                ],
                                'creators' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên hoặc ID người giao việc.'
                                ],
                                'departments' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên phòng ban, bộ phận hoặc nhóm công việc (task_group).'
                                ],
                                'overdue_only' => [
                                    'type' => 'BOOLEAN',
                                    'description' => 'Chỉ lọc các công việc đã quá hạn hoàn thành (true/false).'
                                ],
                                'from_date' => [
                                    'type' => 'STRING',
                                    'description' => 'Hạn chót hoặc ngày tạo từ ngày (YYYY-MM-DD).'
                                ],
                                'to_date' => [
                                    'type' => 'STRING',
                                    'description' => 'Hạn chót hoặc ngày tạo đến ngày (YYYY-MM-DD).'
                                ],
                                'search_query' => [
                                    'type' => 'STRING',
                                    'description' => 'Từ khóa tìm theo tiêu đề công việc, nội dung hoặc nhãn tags.'
                                ],
                                'limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng công việc xem trước (mặc định 10, tối đa 25).'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'query_deals_and_b2b_multitier',
                        'description' => 'SIÊU CÔNG CỤ PHÂN TÍCH ĐA TẦNG CƠ HỘI KINH DOANH & B2B DEALS: Lọc chéo và thống kê các cơ hội (deals) và doanh nghiệp (companies) theo giai đoạn Pipeline (stages), trạng thái (open, won, lost), mức độ ưu tiên, nhân sự phụ trách (owners), khoảng giá trị hợp đồng (min_value, max_value), ngày dự kiến chốt và tự động sinh biểu đồ kèm link tải file Excel/CSV.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'stages' => [
                                    'type' => 'STRING',
                                    'description' => 'Lọc theo tên hoặc ID giai đoạn Pipeline của Deal (cách nhau dấu phẩy).'
                                ],
                                'statuses' => [
                                    'type' => 'STRING',
                                    'description' => 'Trạng thái Deal (open, won, lost, hoặc all).'
                                ],
                                'priorities' => [
                                    'type' => 'STRING',
                                    'description' => 'Mức độ ưu tiên (high, medium, low).'
                                ],
                                'owners' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên hoặc ID Sale phụ trách Deal.'
                                ],
                                'min_value' => [
                                    'type' => 'NUMBER',
                                    'description' => 'Giá trị hợp đồng tối thiểu (VNĐ).'
                                ],
                                'max_value' => [
                                    'type' => 'NUMBER',
                                    'description' => 'Giá trị hợp đồng tối đa (VNĐ).'
                                ],
                                'period' => [
                                    'type' => 'STRING',
                                    'enum' => ['all', 'today', 'this_week', 'this_month', 'last_month', 'this_quarter', 'this_year'],
                                    'description' => 'Kỳ thời gian nhanh (mặc định: all).'
                                ],
                                'from_date' => [
                                    'type' => 'STRING',
                                    'description' => 'Từ ngày (YYYY-MM-DD).'
                                ],
                                'to_date' => [
                                    'type' => 'STRING',
                                    'description' => 'Đến ngày (YYYY-MM-DD).'
                                ],
                                'search_query' => [
                                    'type' => 'STRING',
                                    'description' => 'Từ khóa tìm theo tên Deal, tên công ty B2B hoặc tên khách hàng.'
                                ],
                                'limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng bản ghi xem trước (mặc định 10, tối đa 25).'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'query_tickets_and_sla_multitier',
                        'description' => 'SIÊU CÔNG CỤ PHÂN TÍCH ĐA TẦNG TICKET HỖ TRỢ, HỌC VỤ & SLA: Lọc chéo và thống kê các yêu cầu hỗ trợ / sự vụ (tickets) theo trạng thái (open, in_progress, resolved, closed, overdue_sla), mức độ ưu tiên (urgent, high, medium, low), danh mục (categories), người xử lý (assignees), người tạo (creators) và tự động sinh biểu đồ kèm link tải file Excel/CSV.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'statuses' => [
                                    'type' => 'STRING',
                                    'description' => 'Trạng thái Ticket (open, in_progress, resolved, closed, overdue_sla).'
                                ],
                                'priorities' => [
                                    'type' => 'STRING',
                                    'description' => 'Mức độ ưu tiên (urgent, high, medium, low).'
                                ],
                                'categories' => [
                                    'type' => 'STRING',
                                    'description' => 'Danh mục Ticket (Học vụ, Tài chính, Kỹ thuật, Khiếu nại...).'
                                ],
                                'assignees' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên hoặc ID nhân sự xử lý Ticket.'
                                ],
                                'creators' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên hoặc ID người tạo Ticket.'
                                ],
                                'period' => [
                                    'type' => 'STRING',
                                    'enum' => ['all', 'today', 'this_week', 'this_month', 'last_month', 'this_quarter', 'this_year'],
                                    'description' => 'Kỳ thời gian nhanh (mặc định: all).'
                                ],
                                'from_date' => [
                                    'type' => 'STRING',
                                    'description' => 'Từ ngày (YYYY-MM-DD).'
                                ],
                                'to_date' => [
                                    'type' => 'STRING',
                                    'description' => 'Đến ngày (YYYY-MM-DD).'
                                ],
                                'search_query' => [
                                    'type' => 'STRING',
                                    'description' => 'Từ khóa tìm theo tiêu đề Ticket, mô tả hoặc tên khách hàng.'
                                ],
                                'limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng bản ghi xem trước (mặc định 10, tối đa 25).'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'query_hrm_workforce_and_payroll_multitier',
                        'description' => 'SIÊU CÔNG CỤ PHÂN TÍCH ĐA TẦNG NHÂN SỰ (HRM), PHÉP NĂM, BẢO HIỂM & BẢNG LƯƠNG: Lọc chéo và thống kê đội ngũ nhân sự theo phòng ban (departments), vai trò/chức danh (roles), trạng thái làm việc (active, inactive), trạng thái đóng BHXH (has_insurance), kỳ lương (month_year), quỹ phép năm và tự động sinh biểu đồ kèm link tải file Excel/CSV.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'departments' => [
                                    'type' => 'STRING',
                                    'description' => 'Phòng ban hoặc đội nhóm (cách nhau dấu phẩy).'
                                ],
                                'roles' => [
                                    'type' => 'STRING',
                                    'description' => 'Vai trò hoặc chức danh (sale, manager, accountant, academic, hr...).'
                                ],
                                'status' => [
                                    'type' => 'STRING',
                                    'description' => 'Trạng thái làm việc (active, inactive, all).'
                                ],
                                'has_insurance' => [
                                    'type' => 'STRING',
                                    'enum' => ['all', 'yes', 'no'],
                                    'description' => 'Lọc theo trạng thái đóng BHXH (yes, no, all).'
                                ],
                                'month_year' => [
                                    'type' => 'STRING',
                                    'description' => 'Kỳ bảng lương định dạng YYYY-MM (mặc định tháng hiện tại).'
                                ],
                                'search_query' => [
                                    'type' => 'STRING',
                                    'description' => 'Từ khóa tìm theo họ tên, email, SĐT hoặc chức danh nhân sự.'
                                ],
                                'limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng nhân sự xem trước (mặc định 10, tối đa 25).'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'query_inventory_and_assets_multitier',
                        'description' => 'SIÊU CÔNG CỤ PHÂN TÍCH ĐA TẦNG KHO VẬT TƯ, SẢN PHẨM, LÔ HÀNG & TÀI SẢN CẤP PHÁT: Lọc chéo và thống kê sản phẩm/kho (products, batches) và tài sản nhân sự (hrm_assets) theo danh mục (categories), tình trạng tồn kho (in_stock, low_stock, out_of_stock, expiring_soon), từ khóa tìm kiếm và tự động sinh biểu đồ kèm link tải file Excel/CSV.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'data_type' => [
                                    'type' => 'STRING',
                                    'enum' => ['all', 'inventory', 'products', 'assets'],
                                    'description' => 'Loại dữ liệu cần phân tích: inventory/products (vật tư, ấn phẩm, khóa học & lô hàng), assets (tài sản cấp phát cho nhân sự), hoặc all.'
                                ],
                                'categories' => [
                                    'type' => 'STRING',
                                    'description' => 'Danh mục sản phẩm/vật tư (cách nhau dấu phẩy).'
                                ],
                                'stock_status' => [
                                    'type' => 'STRING',
                                    'enum' => ['all', 'in_stock', 'low_stock', 'out_of_stock', 'expiring_soon'],
                                    'description' => 'Tình trạng tồn kho (in_stock, low_stock, out_of_stock, expiring_soon).'
                                ],
                                'search_query' => [
                                    'type' => 'STRING',
                                    'description' => 'Từ khóa tìm theo tên sản phẩm, mã SKU, mã lô hoặc tên tài sản.'
                                ],
                                'limit' => [
                                    'type' => 'INTEGER',
                                    'description' => 'Số lượng bản ghi xem trước (mặc định 10, tối đa 25).'
                                ]
                            ]
                        ]
                    ],
                    [
                        'name' => 'query_cross_domain_executive_synthesis',
                        'description' => 'SIÊU CÔNG CỤ TỔNG HỢP ĐIỀU HÀNH ĐA PHÂN HỆ (CROSS-DOMAIN EXECUTIVE SYNTHESIS - CEO / DIRECTOR / BI): Phân tích liên thông 4 trụ cột trong 1 lần gọi: (1) Phễu Tuyển sinh & CRM Leads (Tổng lead, Lead mới, Đang chăm sóc, Nhập học, phân rã theo nguồn & chương trình), (2) Đặt cọc & Doanh thu (Approved vs Pending Deposits, Open/Won Deals B2B), (3) Chi phí Marketing & Vận hành (Tính CPL thực tế = Chi phí MKT / Tổng Lead và ROAS = Doanh thu Cọc / Chi phí MKT), (4) Tốc độ Đội ngũ Sales & Sẵn sàng Nhân sự HRM (Top tư vấn viên chuyển đổi, mật độ tương tác activities/notes, quân số đi làm/đi trễ/nghỉ phép). Tự động sinh biểu đồ tổng hợp và gợi ý hành động điều hành.',
                        'parameters' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'period' => [
                                    'type' => 'STRING',
                                    'enum' => ['today', 'this_week', 'this_month', 'last_month', 'this_quarter', 'this_year', 'custom'],
                                    'description' => 'Kỳ báo cáo tổng hợp (mặc định: this_month).'
                                ],
                                'from_date' => [
                                    'type' => 'STRING',
                                    'description' => 'Ngày bắt đầu YYYY-MM-DD (nếu chọn custom hoặc chỉ định khoảng ngày cụ thể).'
                                ],
                                'to_date' => [
                                    'type' => 'STRING',
                                    'description' => 'Ngày kết thúc YYYY-MM-DD (nếu chọn custom hoặc chỉ định khoảng ngày cụ thể).'
                                ],
                                'program' => [
                                    'type' => 'STRING',
                                    'description' => 'Lọc theo chương trình đào tạo (EMBA, MBA, DBA, BBA, MSc AI... cách nhau dấu phẩy).'
                                ],
                                'source' => [
                                    'type' => 'STRING',
                                    'description' => 'Lọc theo nguồn Lead / kênh Marketing (Facebook, Google, Zalo, TikTok, Referral...).'
                                ],
                                'team_id' => [
                                    'type' => 'INTEGER',
                                    'description' => 'ID đội nhóm kinh doanh / phòng ban cần phân tích.'
                                ],
                                'owner_name' => [
                                    'type' => 'STRING',
                                    'description' => 'Tên chuyên viên tư vấn (Sale) cụ thể nếu muốn bóc tách hiệu suất cá nhân.'
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
                'manage_lead_round_distribution',
                'query_crm_leads_multitier',
                'query_finance_multitier_analytics',
                'query_deposits_and_revenue_multitier',
                'query_tasks_and_projects_multitier',
                'query_deals_and_b2b_multitier',
                'query_tickets_and_sla_multitier',
                'query_hrm_workforce_and_payroll_multitier',
                'query_inventory_and_assets_multitier',
                'query_cross_domain_executive_synthesis'
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
     * Format contact disambiguation payload with Smart Cards, CLARIFY_OPTIONS and NEXT_BEST_ACTIONS
     */
    private static function formatContactDisambiguationPayload(array $rows, string $query, string $actionContext): array {
        $candidates = [];
        $clarifyOptions = [];
        $nextBestActions = [];
        foreach ($rows as $r) {
            $cid = (int)$r['id'];
            $name = $r['full_name'] ?: ($r['name'] ?? 'Khách hàng');
            $code = !empty($r['student_code']) ? $r['student_code'] : ('#' . $cid);
            $phone = !empty($r['phone']) ? $r['phone'] : 'Chưa có SĐT';
            $prog = !empty($r['program']) ? $r['program'] : 'Chưa rõ CT';
            $stage = !empty($r['stage_name']) ? $r['stage_name'] : (!empty($r['pipeline_status']) ? $r['pipeline_status'] : 'Mới');
            $owner = !empty($r['owner_name']) ? $r['owner_name'] : 'Chưa gán';

            $candidates[] = [
                'id' => $cid,
                'student_code' => $code,
                'full_name' => $name,
                'name' => $name,
                'phone' => $phone,
                'program' => $prog,
                'stage' => $stage,
                'owner_name' => $owner,
                'smart_card' => self::buildEntitySmartCard('contact', [
                    'id' => $cid,
                    'name' => "{$name} ({$code})",
                    'subtitle' => "{$prog} • SĐT: {$phone}",
                    'status' => $stage,
                    'meta' => "Sale: {$owner}",
                    'link' => "/contacts?id={$cid}"
                ])
            ];
            $clarifyOptions[] = [
                'label' => "{$name} ({$code} - {$phone})",
                'prompt' => "Thực hiện {$actionContext} cho khách hàng {$name} (ID: {$cid}, Mã: {$code})"
            ];
            $nextBestActions[] = [
                'label' => "Chọn {$name} (#{$cid})",
                'prompt' => "Thực hiện {$actionContext} cho khách hàng {$name} (contact_id: {$cid})"
            ];
        }

        $clarifyJson = json_encode($clarifyOptions, JSON_UNESCAPED_UNICODE);
        $nbaJson = json_encode(array_slice($nextBestActions, 0, 4), JSON_UNESCAPED_UNICODE);

        return [
            'success' => false,
            'status' => 'requires_disambiguation',
            'requires_disambiguation' => true,
            'ambiguous_query' => $query,
            'candidate_count' => count($candidates),
            'candidates' => $candidates,
            'message' => "Tìm thấy " . count($candidates) . " hồ sơ khách hàng/học viên khớp với '{$query}'. Vui lòng chọn chính xác hồ sơ cần {$actionContext}.",
            'ai_rendering_directive' => "PHÁT HIỆN NHIỀU HỒ SƠ TRÙNG KHỚP VỚI '{$query}': Tuyệt đối KHÔNG tự ý đoán hoặc chọn đại 1 người. Hãy liệt kê danh sách ứng viên bên dưới (kèm thẻ Smart Card) để người dùng chọn chính xác hồ sơ cần {$actionContext}, và BẮT BUỘC giữ nguyên khối <<<CLARIFY_OPTIONS: {$clarifyJson}>>> cùng <<<NEXT_BEST_ACTIONS: {$nbaJson}>>> ở cuối câu trả lời.",
            'clarify_options_block' => "<<<CLARIFY_OPTIONS: {$clarifyJson}>>>",
            'next_best_actions_block' => "<<<NEXT_BEST_ACTIONS: {$nbaJson}>>>"
        ];
    }

    private static array $leadScopeCache = [];

    /**
     * Centralized CRM Lead Read Scope Evaluator (100% Parity with ContactController::getScope($auth, 'leads', 'read'))
     * Ensures Marketing (by role, team_id=3, team_name/job_title/department), Sale Admin, Academic, Assistant, Viewer,
     * Global Admin/Director, and users with permissions_json['leads']['read'] === 'all' can view all leads across all sales reps.
     */
    public static function evaluateLeadReadScope(PDO $db, array $auth): array {
        $uid = (int)($auth['user_id'] ?? $auth['id'] ?? 0);
        if ($uid > 0 && isset(self::$leadScopeCache[$uid])) {
            return self::$leadScopeCache[$uid];
        }

        $role = strtolower(trim((string)($auth['role'] ?? 'user')));
        $teamId = isset($auth['team_id']) ? (int)$auth['team_id'] : null;
        $teamName = $auth['team_name'] ?? null;
        $jobTitle = $auth['job_title'] ?? null;
        $department = $auth['department'] ?? null;
        $permsRaw = $auth['permissions_json'] ?? ($auth['permissions'] ?? null);

        if ($uid > 0 && ($teamId === null || $teamName === null || $jobTitle === null || $department === null || $permsRaw === null)) {
            try {
                $stmtU = $db->prepare("
                    SELECT u.role, u.team_id, t.name as team_name, u.job_title, u.department, u.permissions_json
                    FROM users u
                    LEFT JOIN teams t ON u.team_id = t.id
                    WHERE u.id = ?
                    LIMIT 1
                ");
                $stmtU->execute([$uid]);
                $uRow = $stmtU->fetch(PDO::FETCH_ASSOC);
                if ($uRow) {
                    if ($role === '' || $role === 'user' || $role === 'nhân sự') {
                        $role = strtolower(trim((string)($uRow['role'] ?? $role)));
                    }
                    $teamId = (int)($uRow['team_id'] ?? 0);
                    $teamName = (string)($uRow['team_name'] ?? '');
                    $jobTitle = (string)($uRow['job_title'] ?? '');
                    $department = (string)($uRow['department'] ?? '');
                    $permsRaw = $uRow['permissions_json'] ?? null;
                }
            } catch (\Throwable $e) {}
        }

        $perms = is_string($permsRaw) ? (json_decode($permsRaw, true) ?: []) : (is_array($permsRaw) ? $permsRaw : []);
        $leadsReadPerm = strtolower(trim((string)($perms['leads']['read'] ?? '')));

        $combMkt = mb_strtolower(($teamName ?? '') . ' ' . ($jobTitle ?? '') . ' ' . ($department ?? ''));
        $isMarketing = in_array($role, ['marketing', 'mkt'], true)
            || ((int)$teamId === 3)
            || (mb_strpos($combMkt, 'marketing') !== false)
            || (mb_strpos($combMkt, 'mkt') !== false);

        $combAcad = mb_strtolower(($department ?? '') . ' ' . ($jobTitle ?? ''));
        $isAcademic = in_array($role, ['academic', 'hoc_vu', 'hoc_thuat', 'tro_giang', 'teacher', 'giang_vien', 'academic_officer'], true)
            || (mb_strpos($combAcad, 'học vụ') !== false)
            || (mb_strpos($combAcad, 'học thuật') !== false)
            || (mb_strpos($combAcad, 'academic') !== false)
            || (mb_strpos($combAcad, 'giảng viên') !== false)
            || (mb_strpos($combAcad, 'trợ giảng') !== false);

        $isGlobalAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'general_director', 'sale_director', 'executive', 'ceo'], true);
        $isSaleAdmin = in_array($role, ['sale_admin', 'saleadmin', 'lead_admin', 'lead_manager'], true);
        $isAssistant = in_array($role, ['assistant', 'tro_ly'], true);
        $isViewer = ($role === 'viewer');
        $isManager = in_array($role, ['manager', 'truong_phong', 'leader', 'team_lead'], true);

        $canViewAllLeads = $isGlobalAdmin
            || $isSaleAdmin
            || $isMarketing
            || $isAcademic
            || $isAssistant
            || $isViewer
            || ($leadsReadPerm === 'all');

        $canViewTeamLeads = !$canViewAllLeads && ($isManager || $leadsReadPerm === 'team');

        $result = [
            'role' => $role,
            'scope' => $canViewAllLeads ? 'all' : ($canViewTeamLeads ? 'team' : 'own'),
            'can_view_all_leads' => $canViewAllLeads,
            'can_view_team_leads' => $canViewTeamLeads,
            'is_global_admin' => $isGlobalAdmin,
            'is_sale_admin' => $isSaleAdmin,
            'is_marketing' => $isMarketing,
            'is_academic' => $isAcademic,
            'is_assistant' => $isAssistant,
            'is_manager' => $isManager,
            'team_id' => (int)$teamId,
            'team_name' => (string)$teamName,
            'department' => (string)$department,
            'job_title' => (string)$jobTitle
        ];

        if ($uid > 0) {
            self::$leadScopeCache[$uid] = $result;
        }
        return $result;
    }

    /**
     * Strip Vietnamese accents/diacritics for accent-insensitive search & scoring
     */
    public static function removeVietnameseAccents(string $str): string {
        $str = preg_replace('/[àáạảãâầấậẩẫăằắặẳẵ]/u', 'a', $str);
        $str = preg_replace('/[ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴ]/u', 'A', $str);
        $str = preg_replace('/[èéẹẻẽêềếệểễ]/u', 'e', $str);
        $str = preg_replace('/[ÈÉẸẺẼÊỀẾỆỂỄ]/u', 'E', $str);
        $str = preg_replace('/[ìíịỉĩ]/u', 'i', $str);
        $str = preg_replace('/[ÌÍỊỈĨ]/u', 'I', $str);
        $str = preg_replace('/[òóọỏõôồốộổỗơờớợởỡ]/u', 'o', $str);
        $str = preg_replace('/[ÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠ]/u', 'O', $str);
        $str = preg_replace('/[ùúụủũưừứựửữ]/u', 'u', $str);
        $str = preg_replace('/[ÙÚỤỦŨƯỪỨỰỬỮ]/u', 'U', $str);
        $str = preg_replace('/[ỳýỵỷỹ]/u', 'y', $str);
        $str = preg_replace('/[ỲÝỴỶỸ]/u', 'Y', $str);
        $str = preg_replace('/[đ]/u', 'd', $str);
        $str = preg_replace('/[Đ]/u', 'D', $str);
        // Also strip combining diacritical marks if NFC/NFD decomposed
        $str = preg_replace('/[\x{0300}-\x{036f}]/u', '', $str);
        return $str;
    }

    /**
     * Build SQL WHERE clause for Vietnamese accent-insensitive & multi-token fuzzy name retrieval
     */
    public static function buildVietnameseFuzzyNameWhere(string $column, string $rawQuery, array &$params): string {
        $tokens = preg_split('/\s+/u', trim($rawQuery), -1, PREG_SPLIT_NO_EMPTY);
        if (empty($tokens)) {
            $params[] = '%' . trim($rawQuery) . '%';
            return "{$column} LIKE ?";
        }
        $tokenPattern = '%' . implode('%', $tokens) . '%';
        $unaccentedPattern = '%' . implode('%', array_map([self::class, 'removeVietnameseAccents'], $tokens)) . '%';
        $params[] = $tokenPattern;
        $params[] = $unaccentedPattern;
        return "(CONVERT({$column} USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE ? OR CONVERT({$column} USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE ?)";
    }

    /**
     * Score fuzzy name match (0-100) to prioritize exact accented/unaccented matches over partial token matches
     */
    public static function scoreFuzzyNameMatch(string $candidateName, string $rawQuery): int {
        $candClean = mb_strtolower(trim(preg_replace('/\s+/u', ' ', $candidateName)));
        $queryClean = mb_strtolower(trim(preg_replace('/\s+/u', ' ', $rawQuery)));
        if ($candClean === '' || $queryClean === '') {
            return 0;
        }
        if ($candClean === $queryClean) {
            return 100;
        }
        $candUnaccented = mb_strtolower(self::removeVietnameseAccents($candClean));
        $queryUnaccented = mb_strtolower(self::removeVietnameseAccents($queryClean));
        if ($candUnaccented === $queryUnaccented) {
            return 95;
        }
        $qTokens = preg_split('/\s+/u', $queryUnaccented, -1, PREG_SPLIT_NO_EMPTY);
        $cTokens = preg_split('/\s+/u', $candUnaccented, -1, PREG_SPLIT_NO_EMPTY);
        if (!empty($qTokens) && !empty($cTokens)) {
            // Check ordered whole-word token match (e.g. "nguyen hung" in "nguyen quang hung")
            $cIdx = 0;
            $matchedCount = 0;
            foreach ($qTokens as $qt) {
                while ($cIdx < count($cTokens)) {
                    if ($cTokens[$cIdx] === $qt) {
                        $matchedCount++;
                        $cIdx++;
                        break;
                    }
                    $cIdx++;
                }
            }
            if ($matchedCount === count($qTokens)) {
                $firstLastBonus = ($qTokens[0] === $cTokens[0] && end($qTokens) === end($cTokens)) ? 5 : 0;
                return 80 + $firstLastBonus;
            }
        }
        if (mb_strpos($candUnaccented, $queryUnaccented) !== false) {
            return 60;
        }
        return 40;
    }

    /**
     * Static helper for Contact RBAC isolation (respects can_view_all_leads and can_view_team_leads)
     */
    public static function getContactRbacClause(string $alias, array $leadRbac, int $uid, bool $allowExtraAll = false): array {
        if (!empty($leadRbac['can_view_all_leads']) || $allowExtraAll) {
            return [0 => '1=1', 1 => [], 'clause' => '1=1', 'params' => []];
        }
        $prefix = $alias ? "{$alias}." : "";
        if (!empty($leadRbac['can_view_team_leads'])) {
            $teamId = (int)($leadRbac['team_id'] ?? 0);
            $clause = "({$prefix}owner_id = ? OR FIND_IN_SET(?, IFNULL({$prefix}collaborator_ids, '')) OR {$prefix}owner_id IN (
                SELECT id FROM users WHERE team_id IN (
                    SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))
                ) OR (? > 0 AND team_id = ?)
            ) OR {$prefix}id IN (
                SELECT contact_id FROM cooperation_slips 
                WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE '{}' END), JSON_QUOTE(CAST(? AS CHAR)))
            ))";
            $params = [$uid, (string)$uid, $uid, $teamId, $teamId, (string)$uid];
            return [
                0 => $clause,
                1 => $params,
                'clause' => $clause,
                'params' => $params
            ];
        }
        $clause = "({$prefix}owner_id = ? OR FIND_IN_SET(?, IFNULL({$prefix}collaborator_ids, '')) OR {$prefix}id IN (
            SELECT contact_id FROM cooperation_slips 
            WHERE JSON_CONTAINS(JSON_KEYS(CASE WHEN (shares_json IS NOT NULL AND JSON_VALID(shares_json)) THEN shares_json ELSE '{}' END), JSON_QUOTE(CAST(? AS CHAR)))
        ))";
        $params = [$uid, (string)$uid, (string)$uid];
        return [
            0 => $clause,
            1 => $params,
            'clause' => $clause,
            'params' => $params
        ];
    }

    /**
     * Resolve a contact with Smart Disambiguation ("Biết tự hỏi khi gặp nhiều lựa chọn") and Zero-Trust RBAC
     */
    private static function resolveContactWithDisambiguation(
        PDO $db,
        int $tid,
        array $auth,
        string $query,
        int $exactContactId = 0,
        string $actionContext = 'thao tác',
        bool $allowAccountantAcademic = false
    ): array {
        $uid = (int)($auth['user_id'] ?? 0);
        $leadRbac = self::evaluateLeadReadScope($db, $auth);
        $role = $leadRbac['role'];
        $isAccountant = in_array($role, ['accountant', 'ke_toan'], true);
        $isAcademic = $leadRbac['is_academic'];
        $allowExtraAll = $allowAccountantAcademic && ($isAccountant || $isAcademic);

        $rbacInfo = self::getContactRbacClause('c', $leadRbac, $uid, $allowExtraAll);
        $rbacClause = $rbacInfo['clause'];
        $rbacParams = $rbacInfo['params'];

        $selectSql = "SELECT c.*,
                             c.full_name as name,
                             ps.name as stage_name,
                             ps.name as current_stage_name,
                             ps.order_index as current_stage_order,
                             u.full_name as owner_name,
                             u.email as owner_email,
                             COALESCE(t.branch, 'Hội sở chính') as branch_name
                      FROM contacts c
                      LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
                      LEFT JOIN users u ON c.owner_id = u.id
                      LEFT JOIN teams t ON u.team_id = t.id";

        $query = trim($query);

        // 1. Exact ID lookup if contact_id > 0 or query is a pure positive integer ID (not a phone number starting with 0)
        $targetId = $exactContactId > 0 ? $exactContactId : (preg_match('/^[1-9]\d{0,7}$/', $query) ? (int)$query : 0);
        if ($targetId > 0) {
            $stmt = $db->prepare("{$selectSql} WHERE c.id = ? AND c.tenant_id = ? AND c.deleted_at IS NULL AND {$rbacClause} LIMIT 1");
            $stmt->execute(array_merge([$targetId, $tid], $rbacParams));
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                return ['status' => 'resolved', 'contact' => $row];
            }
            if ($exactContactId > 0 && $query === '') {
                return [
                    'status' => 'not_found',
                    'error_payload' => [
                        'success' => false,
                        'error' => "Không tìm thấy hồ sơ khách hàng/học viên ID #{$exactContactId} hoặc bạn không có quyền truy cập."
                    ]
                ];
            }
        }

        if ($query === '') {
            return [
                'status' => 'not_found',
                'error_payload' => [
                    'success' => false,
                    'error' => "Vui lòng cung cấp tên, số điện thoại, mã học viên hoặc ID khách hàng cần {$actionContext}."
                ]
            ];
        }

        // 2. Search by tokenized/accent-insensitive full_name, student_code, phone, email (LIMIT 6 to detect ambiguity)
        $cleanPhone = preg_replace('/[^0-9]/', '', $query);
        $sParams = [$tid];
        $fuzzyNameClause = self::buildVietnameseFuzzyNameWhere('c.full_name', $query, $sParams);
        $sWhere = [$fuzzyNameClause, "c.email LIKE ?", "c.student_code LIKE ?"];
        $sParams[] = '%' . $query . '%';
        $sParams[] = '%' . $query . '%';
        if (!empty($cleanPhone) && strlen($cleanPhone) >= 6) {
            $sWhere[] = "c.phone LIKE ?";
            $sParams[] = '%' . $cleanPhone . '%';
        } else {
            $sWhere[] = "c.phone LIKE ?";
            $sParams[] = '%' . $query . '%';
        }

        $sql = "{$selectSql}
                WHERE c.tenant_id = ?
                  AND c.deleted_at IS NULL
                  AND (" . implode(' OR ', $sWhere) . ")
                  AND {$rbacClause}
                ORDER BY
                  CASE
                    WHEN LOWER(IFNULL(c.student_code, '')) = LOWER(?) THEN 0
                    WHEN IFNULL(c.phone, '') = ? THEN 1
                    WHEN LOWER(c.full_name) = LOWER(?) THEN 2
                    ELSE 3
                  END ASC,
                  c.id DESC
                LIMIT 6";
        $execParams = array_merge($sParams, $rbacParams, [$query, $query, $query]);
        $stmt = $db->prepare($sql);
        $stmt->execute($execParams);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        if (count($rows) === 0) {
            return [
                'status' => 'not_found',
                'error_payload' => [
                    'success' => false,
                    'error' => "Không tìm thấy hồ sơ khách hàng/học viên nào khớp với '{$query}' trong phạm vi quyền hạn của bạn."
                ]
            ];
        }

        if (count($rows) === 1) {
            return ['status' => 'resolved', 'contact' => $rows[0]];
        }

        // If user entered an exact unique student_code that matches exactly 1 record, resolve it
        $exactCodeMatches = array_values(array_filter($rows, fn($r) => !empty($r['student_code']) && mb_strtolower(trim($r['student_code'])) === mb_strtolower($query)));
        if (count($exactCodeMatches) === 1) {
            return ['status' => 'resolved', 'contact' => $exactCodeMatches[0]];
        }

        // Score candidates with scoreFuzzyNameMatch; if 1 candidate has an exact full-name match (accented or unaccented), select it
        foreach ($rows as &$rItem) {
            $rItem['_fuzzy_score'] = self::scoreFuzzyNameMatch((string)($rItem['full_name'] ?? ''), $query);
        }
        unset($rItem);
        usort($rows, fn($a, $b) => ($b['_fuzzy_score'] <=> $a['_fuzzy_score']) ?: ((int)$b['id'] <=> (int)$a['id']));

        $exactFullMatches = array_values(array_filter($rows, fn($r) => ($r['_fuzzy_score'] ?? 0) >= 95));
        if (count($exactFullMatches) === 1) {
            return ['status' => 'resolved', 'contact' => $exactFullMatches[0]];
        }

        return [
            'status' => 'ambiguous',
            'candidates' => $rows,
            'disambiguation_payload' => self::formatContactDisambiguationPayload($rows, $query, $actionContext)
        ];
    }

    /**
     * Centralized Safe Executor with Strict Zero-Trust RBAC Guards
     */
    public static function executeTool(PDO $db, string $toolName, array $args, array $auth): array {
        $uid = (int)($auth['user_id'] ?? 0);
        $tid = (int)($auth['tenant_id'] ?? 1);
        $leadRbac = self::evaluateLeadReadScope($db, $auth);
        $role = $leadRbac['role'];
        $userName = $auth['full_name'] ?? ($auth['name'] ?? 'Bạn');

        $isGlobalAdmin = $leadRbac['is_global_admin'];
        $isManager = $leadRbac['is_manager'];
        $isMarketing = $leadRbac['is_marketing'];
        $isSaleAdmin = $leadRbac['is_sale_admin'];
        $canViewAllLeads = $leadRbac['can_view_all_leads'];
        $canViewTeamLeads = $leadRbac['can_view_team_leads'];
        $isAccountant = in_array($role, ['accountant', 'ke_toan'], true);
        $isHR = in_array($role, ['hr', 'nhan_su'], true);
        $isAcademic = $leadRbac['is_academic'];
        $isSale = in_array($role, ['sales', 'sale', 'kinh_doanh', 'sale_admin', 'saleadmin', 'consultant', 'tu_van'], true);
        $canAccessAllContacts = $canViewAllLeads;

        // Zero-Trust Contact RBAC Condition: if not authorized for all/team contacts, strictly isolate to owner, collaborator, or cooperation slip
        $getContactRbacClause = function(string $alias = 'c') use ($leadRbac, $uid) {
            return self::getContactRbacClause($alias, $leadRbac, $uid, false);
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
                    $scope = trim((string)($args['scope'] ?? 'mine'));
                    $assigneeQuery = trim((string)($args['assignee_name'] ?? ''));

                    // RBAC Scope Evaluation
                    $params = [$tid];
                    if (($scope === 'company' || $scope === 'all') && $isGlobalAdmin) {
                        $where = "a.tenant_id = ? AND a.deleted_at IS NULL AND a.type IN ('task', 'meeting')";
                    } elseif (($scope === 'team' || $isManager) && ($isManager || $isGlobalAdmin)) {
                        // Manager or Global Admin viewing Team tasks
                        $where = "a.tenant_id = ? AND a.deleted_at IS NULL AND a.type IN ('task', 'meeting') AND (
                            a.user_id = ? OR a.created_by = ? OR a.approver_id = ? OR FIND_IN_SET(?, IFNULL(a.participant_ids, '')) > 0
                            OR a.user_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ? OR FIND_IN_SET(?, COALESCE(co_leader_ids, ''))))
                            OR a.created_by IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ? OR FIND_IN_SET(?, COALESCE(co_leader_ids, ''))))
                        )";
                        $params[] = $uid;
                        $params[] = $uid;
                        $params[] = $uid;
                        $params[] = (string)$uid;
                        $params[] = $uid;
                        $params[] = (string)$uid;
                        $params[] = $uid;
                        $params[] = (string)$uid;
                    } else {
                        // Personal tasks
                        $where = "a.tenant_id = ? AND a.deleted_at IS NULL AND a.type IN ('task', 'meeting') AND (a.user_id = ? OR a.created_by = ? OR a.approver_id = ? OR FIND_IN_SET(?, IFNULL(a.participant_ids, '')) > 0)";
                        $params[] = $uid;
                        $params[] = $uid;
                        $params[] = $uid;
                        $params[] = (string)$uid;
                    }

                    // Always isolate personal tasks from other users
                    $where .= " AND (NOT (IFNULL(a.tags, '') LIKE '%personal_task%' OR IFNULL(a.tags, '') LIKE '%ca_nhan%') OR a.user_id = ? OR a.created_by = ?)";
                    $params[] = $uid;
                    $params[] = $uid;

                    if (!empty($assigneeQuery)) {
                        $where .= " AND (a.user_id IN (SELECT id FROM users WHERE full_name LIKE ?))";
                        $params[] = '%' . $assigneeQuery . '%';
                    }

                    // 1. Calculate Aggregated Statistics (Defense against 100+ tasks)
                    $statSql = "SELECT 
                                    COUNT(1) as total_undone,
                                    SUM(CASE WHEN a.due_date IS NOT NULL AND a.due_date < NOW() THEN 1 ELSE 0 END) as overdue_count,
                                    SUM(CASE WHEN a.priority IN ('urgent', 'high') THEN 1 ELSE 0 END) as urgent_count,
                                    SUM(CASE WHEN a.due_date IS NOT NULL AND a.due_date >= CURDATE() AND a.due_date < DATE_ADD(CURDATE(), INTERVAL 1 DAY) THEN 1 ELSE 0 END) as today_count
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
                            $sliceWhere .= " AND a.due_date IS NOT NULL AND a.due_date < DATE_ADD(CURDATE(), INTERVAL 1 DAY)";
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
                        $isOverdue = (!empty($t['due_date']) && strtotime($t['due_date']) < time() && !in_array($statusRaw, ['done', 'completed'], true) && (int)($t['progress'] ?? 0) < 100) ? ' ([ĐÃ QUÁ HẠN])' : '';

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

                        $tId = (int)$t['id'];
                        $directUrl = "https://myerp.ideas.edu.vn/workspace?task_id={$tId}";
                        $escSub = addslashes($t['subject']);
                        $smartTag = "<<<ERP_CARD:{\"entity_type\":\"task\",\"entity_id\":{$tId},\"title\":\"{$escSub}\",\"status\":\"{$statusRaw}\",\"direct_url\":\"{$directUrl}\",\"action_label\":\"Mở công việc\"}>>>";

                        $formattedTasks[] = [
                            'id' => $tId,
                            'subject' => $t['subject'],
                            'description' => !empty($parsed['description']) ? mb_substr($parsed['description'], 0, 500) : '',
                            'status' => $statusText,
                            'priority' => $prioText,
                            'progress' => (int)($t['progress'] ?? 0) . '%',
                            'direct_url' => $directUrl,
                            'open_tab_markdown' => "[Bấm để mở việc #{$tId}]({$directUrl})",
                            'smart_tag' => $smartTag,
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
                        SELECT COUNT(1) FROM hrm_leave_requests l
                        JOIN users u ON l.user_id = u.id
                        WHERE u.tenant_id = ? AND l.status = 'pending'
                          AND (l.user_id = ? OR l.approver_id = ? OR l.approver_id_2 = ? " . ($isGlobalAdmin ? "OR (l.approver_id IS NULL OR l.approver_id = 0)" : "") . ")
                    ");
                    $stmtLv->execute([$tid, $uid, $uid, $uid]);
                    $leaveCount = (int)$stmtLv->fetchColumn();

                    // B. Count advances
                    $stmtAdv = $db->prepare("
                        SELECT COUNT(1) FROM hrm_salary_advances sa
                        JOIN users u ON sa.user_id = u.id
                        WHERE u.tenant_id = ? AND sa.status = 'pending'
                          AND (sa.user_id = ? OR sa.approver_id = ? OR sa.approver_id_2 = ? " . ($isGlobalAdmin ? "OR (sa.approver_id IS NULL OR sa.approver_id = 0)" : "") . ")
                    ");
                    $stmtAdv->execute([$tid, $uid, $uid, $uid]);
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
                        SELECT COUNT(1) FROM check_ins ci
                        JOIN users u ON ci.user_id = u.id
                        WHERE u.tenant_id = ? AND ci.status = 'pending_approval' " . ($isGlobalAdmin ? "" : " AND ci.user_id = ?") . "
                    ");
                    $stmtCi->execute($isGlobalAdmin ? [$tid] : [$tid, $uid]);
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
                            WHERE u.tenant_id = ? AND l.status = 'pending'
                              AND (l.user_id = ? OR l.approver_id = ? OR l.approver_id_2 = ? " . ($isGlobalAdmin ? "OR (l.approver_id IS NULL OR l.approver_id = 0)" : "") . ")
                            ORDER BY l.id DESC
                            LIMIT " . (int)$rem . "
                        ");
                        $stmtLList->execute([$tid, $uid, $uid, $uid]);
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
                            WHERE a.tenant_id = ? AND a.deleted_at IS NULL
                              AND (NOT (IFNULL(a.tags, '') LIKE '%personal_task%' OR IFNULL(a.tags, '') LIKE '%ca_nhan%') OR a.user_id = ? OR a.created_by = ?)";
                    $params = [$tid, $uid, $uid];

                    if (!$isGlobalAdmin && !$isManager) {
                        $sql .= " AND (a.user_id = ? OR a.created_by = ? OR a.approver_id = ? OR FIND_IN_SET(?, IFNULL(a.participant_ids, '')) > 0)";
                        $params[] = $uid;
                        $params[] = $uid;
                        $params[] = $uid;
                        $params[] = (string)$uid;
                    }

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
                    $isOverdue = (!empty($task['due_date']) && strtotime($task['due_date']) < time() && !in_array($statusRaw, ['done', 'completed'], true) && (int)($task['progress'] ?? 0) < 100) ? ' ([ĐÃ QUÁ HẠN])' : '';
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
                // 4. SEARCH CONTACTS (CRM DEFENSE & MULTI-FACETED FILTER)
                // ==========================================
                case 'search_contacts': {
                    $q = trim($args['query'] ?? '');
                    $gender = strtolower(trim($args['gender'] ?? 'all'));
                    $stageId = !empty($args['stage_id']) ? (int)$args['stage_id'] : 0;
                    $stageName = trim($args['stage_name'] ?? '');
                    $ownerName = trim($args['owner_name'] ?? '');
                    $ownerId = !empty($args['owner_id']) ? (int)$args['owner_id'] : 0;
                    $staleDays = !empty($args['stale_days']) ? (int)$args['stale_days'] : 0;
                    $source = trim($args['source'] ?? '');
                    $createdFrom = trim($args['created_from'] ?? '');
                    $createdTo = trim($args['created_to'] ?? '');
                    $limit = max(1, min(20, (int)($args['limit'] ?? 5)));

                    $hasSpecificFilter = ($gender !== 'all') || ($stageId > 0) || !empty($stageName) || !empty($ownerName) || ($ownerId > 0) || ($staleDays > 0) || !empty($source) || !empty($createdFrom) || !empty($createdTo);

                    if (empty($q) && !$hasSpecificFilter) {
                        return ['success' => false, 'message' => 'Vui lòng cung cấp từ khóa tìm kiếm hoặc chọn ít nhất một bộ lọc (chuyên viên, số ngày bỏ quên, giai đoạn, v.v.).'];
                    }
                    if (!empty($q) && mb_strlen($q) < 2 && !$hasSpecificFilter) {
                        return ['success' => false, 'message' => 'Từ khóa tìm kiếm quá ngắn (tối thiểu 2 ký tự).'];
                    }

                    $where = ["c.tenant_id = ?", "c.deleted_at IS NULL"];
                    $params = [$tid];

                    // Resolve owner by name if owner_id not given
                    if ($ownerId <= 0 && !empty($ownerName)) {
                        $uParams = [$tid];
                        $uFuzzyWhere = self::buildVietnameseFuzzyNameWhere('full_name', $ownerName, $uParams);
                        $uStmt = $db->prepare("SELECT id, full_name FROM users WHERE tenant_id = ? AND {$uFuzzyWhere} LIMIT 5");
                        $uStmt->execute($uParams);
                        $foundUsers = $uStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                        if (!empty($foundUsers)) {
                            usort($foundUsers, fn($a, $b) => self::scoreFuzzyNameMatch((string)$b['full_name'], $ownerName) <=> self::scoreFuzzyNameMatch((string)$a['full_name'], $ownerName));
                            $ownerId = (int)$foundUsers[0]['id'];
                        }
                    }

                    if ($ownerId > 0) {
                        $where[] = "c.owner_id = ?";
                        $params[] = $ownerId;
                    } elseif (!empty($ownerName)) {
                        $where[] = self::buildVietnameseFuzzyNameWhere('u.full_name', $ownerName, $params);
                    }

                    if (!empty($q)) {
                        if (is_numeric($q)) {
                            $where[] = "(c.id = ? OR c.phone LIKE ?)";
                            $params[] = (int)$q;
                            $params[] = '%' . $q . '%';
                        } else {
                            $fuzzyQClause = self::buildVietnameseFuzzyNameWhere('c.full_name', $q, $params);
                            $where[] = "({$fuzzyQClause} OR c.phone LIKE ? OR c.email LIKE ?)";
                            $like = '%' . $q . '%';
                            $params[] = $like;
                            $params[] = $like;
                        }
                    }

                    if ($gender === 'male' || $gender === 'nam') {
                        $where[] = "c.gender IN ('male', 'nam', '1')";
                    } elseif ($gender === 'female' || $gender === 'nu' || $gender === 'nữ') {
                        $where[] = "c.gender IN ('female', 'nu', '0')";
                    }

                    if ($stageId > 0) {
                        $where[] = "c.stage_id = ?";
                        $params[] = $stageId;
                    } elseif (!empty($stageName)) {
                        $where[] = "(ps.name LIKE ? OR c.status LIKE ?)";
                        $params[] = '%' . $stageName . '%';
                        $params[] = '%' . $stageName . '%';
                    }

                    if ($staleDays > 0) {
                        $where[] = "(
                            (c.last_contact IS NOT NULL AND c.last_contact < DATE_SUB(NOW(), INTERVAL ? DAY))
                            OR (c.last_contact IS NULL AND c.created_at < DATE_SUB(NOW(), INTERVAL ? DAY))
                        )";
                        $params[] = $staleDays;
                        $params[] = $staleDays;
                    }

                    if (!empty($source)) {
                        $where[] = "c.source LIKE ?";
                        $params[] = '%' . $source . '%';
                    }

                    if (!empty($createdFrom)) {
                        $where[] = "c.created_at >= ?";
                        $params[] = $createdFrom . ' 00:00:00';
                    }
                    if (!empty($createdTo)) {
                        $where[] = "c.created_at <= ?";
                        $params[] = $createdTo . ' 23:59:59';
                    }

                    // Zero-Trust Sales & Staff Isolation: Non-admins only see own/collaborated contacts
                    if (!$canAccessAllContacts) {
                        $rbac = $getContactRbacClause('c');
                        $where[] = $rbac['clause'];
                        $params = array_merge($params, $rbac['params']);
                    }

                    $whereSql = implode(" AND ", $where);

                    // 1. Total matching count (Accurate MySQL calculation)
                    $countSql = "SELECT COUNT(1) FROM contacts c
                                 LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
                                 LEFT JOIN users u ON c.owner_id = u.id
                                 WHERE {$whereSql}";
                    $countStmt = $db->prepare($countSql);
                    $countStmt->execute($params);
                    $totalMatching = (int)$countStmt->fetchColumn();

                    if ($totalMatching === 0) {
                        return [
                            'success' => true,
                            'total_matching' => 0,
                            'count' => 0,
                            'message' => 'Không tìm thấy học viên/khách hàng phù hợp trong phạm vi quyền hạn của bạn.'
                        ];
                    }

                    // 2. Fetch preview contacts
                    $sql = "SELECT c.id, c.full_name, c.phone, c.email, c.status, c.stage_id, c.last_contact, ps.name as stage_name, ps.order_index as stage_order, u.full_name as owner_name,
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
                            WHERE {$whereSql}
                            ORDER BY c.id DESC LIMIT " . (int)$limit;
                    $stmt = $db->prepare($sql);
                    $stmt->execute($params);
                    $contacts = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    // 3. Build export URL (100% Filter Parity with ExportController)
                    $exportParams = ['type' => 'contact'];
                    if (!empty($q)) $exportParams['search'] = $q;
                    if ($ownerId > 0) {
                        $exportParams['owner_id'] = $ownerId;
                    } elseif (!empty($ownerName)) {
                        $exportParams['owners'] = $ownerName;
                    }
                    if ($stageId > 0) {
                        $exportParams['stage_id'] = $stageId;
                    } elseif (!empty($stageName)) {
                        $exportParams['stages'] = $stageName;
                    }
                    if (!empty($gender) && $gender !== 'all') $exportParams['gender'] = $gender;
                    if (!empty($source)) $exportParams['source'] = $source;
                    if ($staleDays > 0) $exportParams['stale_days'] = $staleDays;
                    if (!empty($createdFrom)) $exportParams['from'] = $createdFrom;
                    if (!empty($createdTo)) $exportParams['to'] = $createdTo;
                    $exportUrl = '/export?' . http_build_query($exportParams);

                    return [
                        'success' => true,
                        'total_matching' => $totalMatching,
                        'count' => count($contacts),
                        'export_url' => $exportUrl,
                        'export_markdown' => "[Tải danh sách Excel/CSV ({$totalMatching} học viên/lead)]({$exportUrl})",
                        'contacts' => array_map(function($c) {
                            $stageOrder = !empty($c['stage_order']) ? (int)$c['stage_order'] : 1;
                            $isReadyForSo = ($stageOrder >= 13);
                            $stageName = $c['stage_name'] ?: ($c['status'] ?: 'Mới');
                            $cId = (int)$c['id'];
                            $directUrl = "https://myerp.ideas.edu.vn/contacts?id={$cId}";
                            $escName = addslashes($c['full_name']);
                            $cPhone = $c['phone'] ?: '';
                            $smartTag = "<<<ERP_CARD:{\"entity_type\":\"contact\",\"entity_id\":{$cId},\"title\":\"{$escName}\",\"subtitle\":\"{$cPhone} • {$stageName}\",\"status\":\"in_progress\",\"direct_url\":\"{$directUrl}\",\"action_label\":\"Mở hồ sơ\"}>>>";
                            return [
                                'id' => $cId,
                                'name' => $c['full_name'],
                                'phone' => $c['phone'],
                                'email' => $c['email'],
                                'stage' => $stageName,
                                'stage_id' => !empty($c['stage_id']) ? (int)$c['stage_id'] : null,
                                'stage_order' => $stageOrder,
                                'last_contact' => $c['last_contact'] ? date('d/m/Y H:i', strtotime($c['last_contact'])) : 'Chưa có tương tác',
                                'direct_url' => $directUrl,
                                'open_tab_markdown' => "[Mở hồ sơ {$c['full_name']}]({$directUrl})",
                                'smart_tag' => $smartTag,
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

                    $cRes = self::resolveContactWithDisambiguation($db, $tid, $auth, $cQuery, $contactId, 'tra cứu công nợ và lịch sử tài chính', true);
                    if ($cRes['status'] === 'ambiguous') {
                        return $cRes['disambiguation_payload'];
                    }
                    if ($cRes['status'] !== 'resolved') {
                        return $cRes['error_payload'];
                    }
                    $resolvedContact = $cRes['contact'];
                    $contactId = (int)$resolvedContact['id'];

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
                // 7.1. QUERY COMPANY ATTENDANCE & WORK HOURS (TOP LATE, OVERTIME, WFH & EMPLOYEE LEDGER)
                // ==========================================
                case 'query_company_attendance_and_work_hours': {
                    $scope = trim($args['scope'] ?? 'month_summary');
                    $userQuery = trim($args['user_query'] ?? '');
                    $month = min(12, max(1, (int)($args['month'] ?? date('n'))));
                    $year = (int)($args['year'] ?? date('Y'));
                    $specificDate = trim($args['specific_date'] ?? '');
                    $fromDate = trim($args['from_date'] ?? '');
                    $toDate = trim($args['to_date'] ?? '');
                    $deptFilter = trim($args['department'] ?? '');
                    $limit = min(50, max(1, (int)($args['limit'] ?? 10)));

                    // Normalize date shortcuts
                    $todayDate = date('Y-m-d');
                    $yesterdayDate = date('Y-m-d', strtotime('-1 day'));
                    if (in_array(mb_strtolower($specificDate), ['today', 'hom nay', 'hôm nay'], true)) {
                        $specificDate = $todayDate;
                    } elseif (in_array(mb_strtolower($specificDate), ['yesterday', 'hom qua', 'hôm qua'], true)) {
                        $specificDate = $yesterdayDate;
                    }

                    // Auto-adjust scope if specific_date is provided
                    if (!empty($specificDate) && in_array($scope, ['month_summary', 'date_detail', 'today_status'], true)) {
                        $scope = 'date_detail';
                    } elseif (!empty($userQuery) && $scope === 'month_summary') {
                        $scope = 'employee_detail';
                    }

                    $canViewAll = ($isGlobalAdmin || $isHR);

                    // Period calculation
                    if (!empty($fromDate) && !empty($toDate)) {
                        $rangeStart = $fromDate;
                        $rangeEnd = $toDate;
                        $periodLabel = "Từ ngày {$fromDate} đến {$toDate}";
                    } else {
                        $rangeStart = sprintf('%04d-%02d-01', $year, $month);
                        $rangeEnd = date('Y-m-t', strtotime($rangeStart));
                        $periodLabel = "Tháng {$month}/{$year}";
                    }

                    // Standard Work Policy
                    $workPolicy = [
                        'morning' => '08:00 - 12:00 (4.0 giờ = 0.5 công)',
                        'lunch_break' => '12:00 - 13:00',
                        'afternoon' => '13:00 - 17:00 (4.0 giờ = 0.5 công)',
                        'standard_day' => '8.0 giờ = 1.0 công chuẩn',
                        'late_rule' => 'Check-in sau 08:00 (sáng) hoặc sau 13:00 (chiều)',
                        'early_rule' => 'Check-out trước 12:00 (sáng) hoặc trước 17:00 (chiều)',
                        'ot_rule' => 'Làm việc ngoài khung giờ hành chính (sau 17:00) hoặc đăng ký tăng ca được duyệt'
                    ];

                    // ----------------------------------------------------
                    // SUB-CASE 1: TOP LATE COMERS (AI ĐI TRỄ NHIỀU NHẤT)
                    // ----------------------------------------------------
                    if ($scope === 'top_late') {
                        // Regular staff can only see their own lateness
                        if (!$canViewAll && !$isManager) {
                            $stmtMyLate = $db->prepare("SELECT 
                                COUNT(CASE WHEN c.late_minutes > 0 OR c.status = 'late' OR (TIME(c.check_in_time) > '08:00:00' AND TIME(c.check_in_time) < '12:00:00') THEN 1 END) as late_count,
                                SUM(
                                    CASE 
                                        WHEN c.late_minutes > 0 THEN c.late_minutes 
                                        WHEN TIME(c.check_in_time) > '08:00:00' AND TIME(c.check_in_time) < '12:00:00' 
                                             THEN TIMESTAMPDIFF(MINUTE, '08:00:00', TIME(c.check_in_time))
                                        ELSE 0 
                                    END
                                ) as total_late_minutes
                            FROM check_ins c
                            WHERE c.user_id = ? AND c.check_in_date BETWEEN ? AND ?");
                            $stmtMyLate->execute([$uid, $rangeStart, $rangeEnd]);
                            $myLate = $stmtMyLate->fetch(PDO::FETCH_ASSOC);

                            return [
                                'success' => true,
                                'scope' => 'top_late_personal',
                                'period' => $periodLabel,
                                'company_work_hours' => $workPolicy,
                                'role_notice' => 'Bạn đang tra cứu với quyền Nhân viên cá nhân. Hệ thống hiển thị chi tiết vi phạm đi trễ của chính bạn.',
                                'my_lateness' => [
                                    'name' => $userName,
                                    'late_count' => (int)($myLate['late_count'] ?? 0),
                                    'total_late_minutes' => (int)($myLate['total_late_minutes'] ?? 0),
                                    'summary' => "Trong {$periodLabel}, bạn đi trễ " . (int)($myLate['late_count'] ?? 0) . " lần với tổng cộng " . (int)($myLate['total_late_minutes'] ?? 0) . " phút."
                                ],
                                'instruction' => 'Trình bày số liệu đi trễ cá nhân cho người dùng một cách thân thiện, nhã nhặn. TUYỆT ĐỐI KHÔNG dùng từ "(Zero-Trust)". TUYỆT ĐỐI KHÔNG sinh thẻ Lead.'
                            ];
                        }

                        // Admin / HR / Manager query
                        $whereClauses = ["u.tenant_id = ?", "c.check_in_date BETWEEN ? AND ?"];
                        $params = [$tid, $rangeStart, $rangeEnd];

                        if (!$canViewAll && $isManager) {
                            $whereClauses[] = "(u.id = ? OR u.team_id IN (SELECT id FROM teams WHERE leader_id = ? OR FIND_IN_SET(?, COALESCE(co_leader_ids, ''))) OR (u.team_id IS NOT NULL AND u.team_id = (SELECT team_id FROM users WHERE id = ?)))";
                            $params[] = $uid;
                            $params[] = $uid;
                            $params[] = $uid;
                            $params[] = $uid;
                        }

                        if (!empty($deptFilter)) {
                            $whereClauses[] = "(t.name LIKE ? OR u.job_title LIKE ?)";
                            $params[] = "%$deptFilter%";
                            $params[] = "%$deptFilter%";
                        }

                        $whereSql = implode(' AND ', $whereClauses);

                        $sqlTop = "SELECT 
                                        u.id as user_id, 
                                        u.full_name, 
                                        COALESCE(u.job_title, u.role) as job_title,
                                        COALESCE(t.name, 'Chung') as team_name,
                                        COUNT(CASE WHEN c.late_minutes > 0 OR c.status = 'late' OR (TIME(c.check_in_time) > '08:00:00' AND TIME(c.check_in_time) < '12:00:00') THEN 1 END) as late_count,
                                        SUM(
                                            CASE 
                                                WHEN c.late_minutes > 0 THEN c.late_minutes 
                                                WHEN TIME(c.check_in_time) > '08:00:00' AND TIME(c.check_in_time) < '12:00:00' 
                                                     THEN TIMESTAMPDIFF(MINUTE, '08:00:00', TIME(c.check_in_time))
                                                ELSE 0 
                                            END
                                        ) as total_late_minutes
                                    FROM check_ins c
                                    JOIN users u ON c.user_id = u.id
                                    LEFT JOIN teams t ON u.team_id = t.id
                                    WHERE $whereSql
                                    GROUP BY u.id, u.full_name, u.job_title, t.name
                                    HAVING total_late_minutes > 0
                                    ORDER BY total_late_minutes DESC, late_count DESC
                                    LIMIT {$limit}";

                        $stmtTop = $db->prepare($sqlTop);
                        $stmtTop->execute($params);
                        $topList = $stmtTop->fetchAll(PDO::FETCH_ASSOC) ?: [];

                        $formattedList = [];
                        $rank = 1;
                        foreach ($topList as $item) {
                            $formattedList[] = [
                                'rank' => $rank++,
                                'user_id' => (int)$item['user_id'],
                                'name' => $item['full_name'],
                                'team' => $item['team_name'],
                                'job_title' => $item['job_title'],
                                'total_late_minutes' => (int)$item['total_late_minutes'],
                                'late_count' => (int)$item['late_count'],
                                'direct_profile_url' => "https://myerp.ideas.edu.vn/hrm?user_id=" . $item['user_id']
                            ];
                        }

                        return [
                            'success' => true,
                            'scope' => 'top_late',
                            'period' => $periodLabel,
                            'department' => $deptFilter ?: 'Toàn bộ công ty',
                            'total_infractions_found' => count($formattedList),
                            'company_work_hours' => $workPolicy,
                            'top_late_staff' => $formattedList,
                            'export_download_url' => "/api/export?type=attendance&month={$month}&year={$year}",
                            'instruction' => 'BẮT BUỘC trình bày danh sách TOP NHÂN VIÊN ĐI TRỄ dưới dạng BẢNG MARKDOWN chuẩn (| Hạng | Họ và tên | Phòng ban / Chức vụ | Tổng phút trễ | Số lần trễ |). Liệt kê trung thực đúng số liệu MySQL ở trên. TUYỆT ĐỐI KHÔNG sinh thẻ ERP_CARD Contact/Lead. TUYỆT ĐỐI KHÔNG dùng từ "(Zero-Trust)". Cuối câu kèm gợi ý xem chi tiết hoặc tải bảng công.'
                        ];
                    }

                    // ----------------------------------------------------
                    // SUB-CASE 2: TOP OVERTIME (AI TĂNG CA NHIỀU NHẤT)
                    // ----------------------------------------------------
                    if ($scope === 'top_overtime') {
                        $whereClauses = ["u.tenant_id = ?", "c.check_in_date BETWEEN ? AND ?", "c.check_out_time > '17:00:00'"];
                        $params = [$tid, $rangeStart, $rangeEnd];

                        if (!$canViewAll && $isManager) {
                            $whereClauses[] = "(u.id = ? OR u.team_id IN (SELECT id FROM teams WHERE leader_id = ? OR FIND_IN_SET(?, COALESCE(co_leader_ids, ''))))";
                            $params[] = $uid;
                            $params[] = $uid;
                            $params[] = $uid;
                        } elseif (!$canViewAll) {
                            $whereClauses[] = "u.id = ?";
                            $params[] = $uid;
                        }

                        $whereSql = implode(' AND ', $whereClauses);
                        $sqlOt = "SELECT 
                                    u.id as user_id, 
                                    u.full_name, 
                                    COALESCE(u.job_title, u.role) as job_title,
                                    COALESCE(t.name, 'Chung') as team_name,
                                    COUNT(1) as ot_shifts_count,
                                    ROUND(SUM(TIMESTAMPDIFF(MINUTE, '17:00:00', TIME(c.check_out_time))) / 60.0, 1) as total_ot_hours
                                  FROM check_ins c
                                  JOIN users u ON c.user_id = u.id
                                  LEFT JOIN teams t ON u.team_id = t.id
                                  WHERE $whereSql
                                  GROUP BY u.id, u.full_name, u.job_title, t.name
                                  HAVING total_ot_hours > 0
                                  ORDER BY total_ot_hours DESC
                                  LIMIT {$limit}";

                        $stmtOt = $db->prepare($sqlOt);
                        $stmtOt->execute($params);
                        $otList = $stmtOt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                        return [
                            'success' => true,
                            'scope' => 'top_overtime',
                            'period' => $periodLabel,
                            'company_work_hours' => $workPolicy,
                            'top_overtime_staff' => $otList,
                            'instruction' => 'BẮT BUỘC định dạng BẢNG MARKDOWN danh sách tăng ca OT (Hạng | Nhân sự | Phòng ban | Số ca OT | Tổng giờ OT). TUYỆT ĐỐI KHÔNG sinh thẻ Lead. TUYỆT ĐỐI KHÔNG dùng từ "(Zero-Trust)".'
                        ];
                    }

                    // ----------------------------------------------------
                    // SUB-CASE 3: DATE DETAIL / TODAY STATUS (NGÀY CỤ THỂ, HÔM QUA, HÔM NAY)
                    // ----------------------------------------------------
                    if ($scope === 'date_detail' || $scope === 'today_status') {
                        $targetDate = !empty($specificDate) ? $specificDate : $todayDate;

                        // Check-ins for target date
                        $whereClauses = ["u.tenant_id = ?", "c.check_in_date = ?"];
                        $params = [$tid, $targetDate];

                        if (!$canViewAll && $isManager) {
                            $whereClauses[] = "(u.id = ? OR u.team_id IN (SELECT id FROM teams WHERE leader_id = ? OR FIND_IN_SET(?, COALESCE(co_leader_ids, ''))))";
                            $params[] = $uid;
                            $params[] = $uid;
                            $params[] = $uid;
                        } elseif (!$canViewAll) {
                            $whereClauses[] = "u.id = ?";
                            $params[] = $uid;
                        }

                        $whereSql = implode(' AND ', $whereClauses);
                        $sqlDate = "SELECT 
                                        c.id as check_in_id,
                                        c.user_id,
                                        u.full_name,
                                        COALESCE(u.job_title, u.role) as job_title,
                                        COALESCE(t.name, 'Chung') as team_name,
                                        TIME_FORMAT(c.check_in_time, '%H:%i') as check_in_time,
                                        TIME_FORMAT(c.check_out_time, '%H:%i') as check_out_time,
                                        c.late_minutes,
                                        c.early_minutes,
                                        c.status,
                                        c.reason,
                                        c.admin_note
                                    FROM check_ins c
                                    JOIN users u ON c.user_id = u.id
                                    LEFT JOIN teams t ON u.team_id = t.id
                                    WHERE $whereSql
                                    ORDER BY c.check_in_time ASC";

                        $stmtDate = $db->prepare($sqlDate);
                        $stmtDate->execute($params);
                        $dateRows = $stmtDate->fetchAll(PDO::FETCH_ASSOC) ?: [];

                        // Leaves / WFH on target date (Fixed: table hrm_leave_requests & datetime comparison)
                        $whereLeaves = [
                            "u.tenant_id = ?",
                            "l.status = 'approved'",
                            "DATE(l.start_date) <= ?",
                            "DATE(l.end_date) >= ?"
                        ];
                        $leaveParams = [$tid, $targetDate, $targetDate];

                        if (!$canViewAll && $isManager) {
                            $whereLeaves[] = "(u.id = ? OR u.team_id IN (SELECT id FROM teams WHERE leader_id = ? OR FIND_IN_SET(?, COALESCE(co_leader_ids, ''))))";
                            $leaveParams[] = $uid;
                            $leaveParams[] = $uid;
                            $leaveParams[] = $uid;
                        } elseif (!$canViewAll) {
                            $whereLeaves[] = "u.id = ?";
                            $leaveParams[] = $uid;
                        }

                        $sqlLeaves = "SELECT 
                                        l.id as leave_id,
                                        l.user_id,
                                        u.full_name,
                                        COALESCE(u.job_title, u.role) as job_title,
                                        COALESCE(t.name, 'Chung') as team_name,
                                        l.leave_type,
                                        l.reason
                                      FROM hrm_leave_requests l
                                      JOIN users u ON l.user_id = u.id
                                      LEFT JOIN teams t ON u.team_id = t.id
                                      WHERE " . implode(' AND ', $whereLeaves);

                        $stmtL = $db->prepare($sqlLeaves);
                        $stmtL->execute($leaveParams);
                        $leaveRows = $stmtL->fetchAll(PDO::FETCH_ASSOC) ?: [];

                        $wfhStaff = [];
                        $leaveStaff = [];
                        foreach ($leaveRows as $lr) {
                            if ($lr['leave_type'] === 'remote_work') {
                                $wfhStaff[] = $lr;
                            } else {
                                $leaveStaff[] = $lr;
                            }
                        }

                        // Query all active personnel in company (excluding bots and inactive/dormant)
                        $whereActiveStaff = [
                            "u.tenant_id = ?",
                            "(u.is_active = 1 OR u.is_active IS NULL)",
                            "(u.status = 'active' OR u.status IS NULL)",
                            "u.role NOT IN ('bot', 'system')"
                        ];
                        $activeStaffParams = [$tid];
                        if (!$canViewAll && $isManager) {
                            $whereActiveStaff[] = "(u.id = ? OR u.team_id IN (SELECT id FROM teams WHERE leader_id = ? OR FIND_IN_SET(?, COALESCE(co_leader_ids, ''))))";
                            $activeStaffParams[] = $uid;
                            $activeStaffParams[] = $uid;
                            $activeStaffParams[] = $uid;
                        } elseif (!$canViewAll) {
                            $whereActiveStaff[] = "u.id = ?";
                            $activeStaffParams[] = $uid;
                        }
                        $sqlActiveStaff = "SELECT u.id, u.full_name, COALESCE(u.job_title, u.role) as job_title, COALESCE(t.name, 'Chung') as team_name, u.role,
                                                  (SELECT MAX(check_in_date) FROM check_ins WHERE user_id = u.id) as last_checkin,
                                                  (SELECT COUNT(1) FROM check_ins WHERE user_id = u.id) as total_checkins
                                           FROM users u
                                           LEFT JOIN teams t ON u.team_id = t.id
                                           WHERE " . implode(' AND ', $whereActiveStaff) . "
                                           ORDER BY t.name ASC, u.full_name ASC";
                        $stmtActive = $db->prepare($sqlActiveStaff);
                        $stmtActive->execute($activeStaffParams);
                        $activeStaffList = $stmtActive->fetchAll(PDO::FETCH_ASSOC) ?: [];

                        $checkedInUserIds = array_map(fn($r) => (int)$r['user_id'], $dateRows);
                        $wfhUserIds = array_map(fn($r) => (int)$r['user_id'], $wfhStaff);
                        $leaveUserIds = array_map(fn($r) => (int)$r['user_id'], $leaveStaff);

                        $notCheckedInStaff = [];
                        $dormantStaff = [];

                        foreach ($activeStaffList as $staff) {
                            $sId = (int)$staff['id'];
                            if (in_array($sId, $checkedInUserIds, true) || in_array($sId, $wfhUserIds, true) || in_array($sId, $leaveUserIds, true)) {
                                continue;
                            }
                            $isLeadership = in_array(strtolower($staff['role'] ?? ''), ['admin', 'superadmin', 'director'], true);
                            $lastCi = $staff['last_checkin'];
                            $totalCi = (int)$staff['total_checkins'];

                            if (!$isLeadership && ($totalCi === 0 || empty($lastCi) || strtotime($lastCi) < strtotime('-30 days'))) {
                                $dormantStaff[] = [
                                    'user_id' => $sId,
                                    'full_name' => $staff['full_name'],
                                    'job_title' => $staff['job_title'],
                                    'team_name' => $staff['team_name'],
                                    'last_checkin' => $lastCi ? date('d/m/Y', strtotime($lastCi)) : 'Chưa từng quẹt thẻ',
                                    'status_note' => 'Không hoạt động (>30 ngày không chấm công)'
                                ];
                            } else {
                                $notCheckedInStaff[] = [
                                    'user_id' => $sId,
                                    'full_name' => $staff['full_name'],
                                    'job_title' => $staff['job_title'],
                                    'team_name' => $staff['team_name'],
                                    'status_note' => 'Chưa quẹt thẻ hôm nay'
                                ];
                            }
                        }

                        return [
                            'success' => true,
                            'scope' => 'date_detail',
                            'date' => $targetDate,
                            'total_checked_in_office' => count($dateRows),
                            'total_wfh' => count($wfhStaff),
                            'total_on_leave' => count($leaveStaff),
                            'total_not_checked_in' => count($notCheckedInStaff),
                            'total_inactive_or_dormant' => count($dormantStaff),
                            'company_work_hours' => $workPolicy,
                            'present_office_records' => $dateRows,
                            'wfh_records' => $wfhStaff,
                            'leave_records' => $leaveStaff,
                            'not_checked_in_records' => $notCheckedInStaff,
                            'inactive_dormant_staff' => $dormantStaff,
                            'instruction' => 'BẮT BUỘC phân định rạch ròi 3 nhóm: (1) CÓ MẶT TẠI VĂN PHÒNG ĐÃ QUẸT THẺ (kèm giờ check-in), (2) ĐANG LÀM VIỆC TỪ XA WFH ĐÃ ĐƯỢC DUYỆT (ghi rõ tên và lý do), (3) CHƯA QUẸT THẺ / VẮNG MẶT. Đối với nhân sự không hoạt động/inactive đã tách riêng để nhận biết. TUYỆT ĐỐI KHÔNG gộp chung toàn bộ nhân viên công ty thành "đang đi làm". Định dạng bảng Markdown rõ ràng từng nhóm.'
                        ];
                    }

                    // ----------------------------------------------------
                    // SUB-CASE 4: EMPLOYEE DETAIL / MONTH SUMMARY (BẢNG CÔNG CỤ THỂ 1 NHÂN SỰ)
                    // ----------------------------------------------------
                    // Resolve target user
                    $targetUser = null;
                    if (!empty($userQuery)) {
                        if (is_numeric($userQuery)) {
                            $stmtU = $db->prepare("SELECT u.id, u.full_name, u.email, u.phone, u.job_title, u.role, u.team_id, t.name as team_name FROM users u LEFT JOIN teams t ON u.team_id = t.id WHERE u.tenant_id = ? AND u.id = ? LIMIT 1");
                            $stmtU->execute([$tid, (int)$userQuery]);
                            $targetUser = $stmtU->fetch(PDO::FETCH_ASSOC);
                        }
                        if (!$targetUser) {
                            $uParams = [$tid];
                            $uFuzzy = self::buildVietnameseFuzzyNameWhere('u.full_name', $userQuery, $uParams);
                            $pSearch = "%$userQuery%";
                            $uParams[] = $pSearch;
                            $uParams[] = $pSearch;
                            $uParams[] = $userQuery;
                            $stmtU = $db->prepare("SELECT u.id, u.full_name, u.email, u.phone, u.job_title, u.role, u.team_id, t.name as team_name FROM users u LEFT JOIN teams t ON u.team_id = t.id WHERE u.tenant_id = ? AND ({$uFuzzy} OR u.username LIKE ? OR u.email LIKE ?) ORDER BY (u.full_name = ?) DESC, u.id ASC LIMIT 5");
                            $stmtU->execute($uParams);
                            $candUsers = $stmtU->fetchAll(PDO::FETCH_ASSOC) ?: [];
                            if (!empty($candUsers)) {
                                usort($candUsers, fn($a, $b) => self::scoreFuzzyNameMatch((string)$b['full_name'], $userQuery) <=> self::scoreFuzzyNameMatch((string)$a['full_name'], $userQuery));
                                $targetUser = $candUsers[0];
                            }
                        }
                    }

                    if (!$targetUser) {
                        // Default to requesting user
                        $stmtU = $db->prepare("SELECT u.id, u.full_name, u.email, u.phone, u.job_title, u.role, u.team_id, t.name as team_name FROM users u LEFT JOIN teams t ON u.team_id = t.id WHERE u.id = ? LIMIT 1");
                        $stmtU->execute([$uid]);
                        $targetUser = $stmtU->fetch(PDO::FETCH_ASSOC);
                    }

                    if (!$targetUser) {
                        return [
                            'success' => false,
                            'message' => 'Không tìm thấy thông tin nhân sự trong hệ thống để tra cứu bảng công.'
                        ];
                    }

                    $targetUid = (int)$targetUser['id'];

                    // RBAC Evaluation (Director/Admin/HR: all; Manager: own team; Staff: self only)
                    if ($targetUid !== $uid && !$canViewAll) {
                        if ($isManager) {
                            $stmtMgr = $db->prepare("SELECT 1 FROM users target_u JOIN teams t ON target_u.team_id = t.id WHERE target_u.id = ? AND (t.leader_id = ? OR target_u.team_id = (SELECT team_id FROM users WHERE id = ?)) LIMIT 1");
                            $stmtMgr->execute([$targetUid, $uid, $uid]);
                            if (!$stmtMgr->fetchColumn()) {
                                return [
                                    'success' => false,
                                    'restricted' => true,
                                    'message' => "Theo phân cấp quản trị nội bộ, bạn có quyền quản lý thành viên thuộc team do bạn phụ trách. Bạn không có quyền truy cập dữ liệu bảng công của nhân sự {$targetUser['full_name']}. Vui lòng liên hệ Ban Giám đốc hoặc Phòng Nhân sự để được hỗ trợ."
                                ];
                            }
                        } else {
                            return [
                                'success' => false,
                                'restricted' => true,
                                'message' => "Bạn chỉ có thể tra cứu thông tin bảng công của chính mình. Dữ liệu bảng công của nhân sự {$targetUser['full_name']} được bảo mật theo quy định nội bộ."
                            ];
                        }
                    }

                    // Query check-ins of target employee
                    $stmtEmpCi = $db->prepare("SELECT 
                                                    c.id as check_in_id,
                                                    c.check_in_date,
                                                    DATE_FORMAT(c.check_in_date, '%d/%m/%Y') as formatted_date,
                                                    DAYNAME(c.check_in_date) as day_name,
                                                    TIME_FORMAT(c.check_in_time, '%H:%i') as check_in_time,
                                                    TIME_FORMAT(c.check_out_time, '%H:%i') as check_out_time,
                                                    c.late_minutes,
                                                    c.early_minutes,
                                                    c.status,
                                                    c.reason,
                                                    c.admin_note
                                                FROM check_ins c
                                                WHERE c.user_id = ? AND c.check_in_date BETWEEN ? AND ?
                                                ORDER BY c.check_in_date ASC");
                    $stmtEmpCi->execute([$targetUid, $rangeStart, $rangeEnd]);
                    $empCiRows = $stmtEmpCi->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    // Query leaves / WFH of target employee (Fixed: table hrm_leave_requests & total_days)
                    $stmtEmpL = $db->prepare("SELECT id, leave_type, start_date, end_date, COALESCE(total_days, 1.0) as days_count, status, reason FROM hrm_leave_requests WHERE user_id = ? AND status = 'approved' AND DATE(start_date) <= ? AND DATE(end_date) >= ?");
                    $stmtEmpL->execute([$targetUid, $rangeEnd, $rangeStart]);
                    $empLRows = $stmtEmpL->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    // Query leave balances from hrm_profiles
                    $stmtP = $db->prepare("SELECT annual_leave_total, annual_leave_used, compensatory_leave_total, compensatory_leave_used FROM hrm_profiles WHERE user_id = ? LIMIT 1");
                    $stmtP->execute([$targetUid]);
                    $prof = $stmtP->fetch(PDO::FETCH_ASSOC);

                    $annualTotal = (float)($prof['annual_leave_total'] ?? 12.0);
                    $annualUsed = (float)($prof['annual_leave_used'] ?? 0.0);
                    $annualRemain = max(0.0, $annualTotal - $annualUsed);

                    // Compute aggregates
                    $totalWorkDays = 0;
                    $totalLateCount = 0;
                    $totalLateMinutes = 0;
                    $totalEarlyMinutes = 0;
                    $totalOtHours = 0.0;

                    foreach ($empCiRows as $r) {
                        if ($r['status'] !== 'rejected') {
                            $totalWorkDays += 1;
                        }
                        $lateM = (int)($r['late_minutes'] ?? 0);
                        if ($lateM <= 0 && $r['check_in_time'] && $r['check_in_time'] > '08:00') {
                            $inM = (int)substr($r['check_in_time'], 0, 2) * 60 + (int)substr($r['check_in_time'], 3, 2);
                            $diff = $inM - (8 * 60);
                            if ($diff > 0) $lateM = $diff;
                        }
                        if ($lateM > 0 || $r['status'] === 'late') {
                            $totalLateCount += 1;
                            $totalLateMinutes += ($lateM > 0 ? $lateM : 15);
                        }
                        $earlyM = (int)($r['early_minutes'] ?? 0);
                        if ($earlyM > 0) {
                            $totalEarlyMinutes += $earlyM;
                        }
                        if ($r['check_out_time'] && $r['check_out_time'] > '17:00') {
                            $outM = (int)substr($r['check_out_time'], 0, 2) * 60 + (int)substr($r['check_out_time'], 3, 2);
                            $otM = $outM - (17 * 60);
                            if ($otM > 0) $totalOtHours += round($otM / 60.0, 1);
                        }
                    }

                    $wfhCount = 0;
                    $leaveDaysCount = 0;
                    foreach ($empLRows as $l) {
                        if ($l['leave_type'] === 'remote_work') {
                            $wfhCount += (float)($l['days_count'] ?? 1.0);
                        } else {
                            $leaveDaysCount += (float)($l['days_count'] ?? 1.0);
                        }
                    }

                    return [
                        'success' => true,
                        'scope' => 'employee_detail',
                        'period' => $periodLabel,
                        'employee' => [
                            'id' => $targetUid,
                            'name' => $targetUser['full_name'],
                            'job_title' => $targetUser['job_title'] ?: $targetUser['role'],
                            'team' => $targetUser['team_name'] ?: 'Chung',
                            'email' => $targetUser['email']
                        ],
                        'company_work_hours' => $workPolicy,
                        'statistics' => [
                            'actual_worked_days' => $totalWorkDays,
                            'late_count' => $totalLateCount,
                            'total_late_minutes' => $totalLateMinutes,
                            'early_leave_minutes' => $totalEarlyMinutes,
                            'total_ot_hours' => $totalOtHours,
                            'wfh_days' => $wfhCount,
                            'leave_days_taken' => $leaveDaysCount,
                            'annual_leave_remaining' => $annualRemain
                        ],
                        'daily_logs' => array_slice($empCiRows, 0, 31),
                        'leave_requests' => $empLRows,
                        'export_download_url' => "/api/export?type=attendance&user_id={$targetUid}&month={$month}&year={$year}",
                        'instruction' => 'BẮT BUỘC: 1. Nêu tóm tắt bảng công nhân sự ' . $targetUser['full_name'] . ' (Số công thực tế, số lần trễ, tổng phút trễ, tăng ca OT, WFH, phép còn lại). 2. Trình bày chi tiết từng ngày dưới dạng BẢNG MARKDOWN chuẩn (| Ngày | Giờ vào | Giờ ra | Trễ/Sớm | Trạng thái |). 3. Đính kèm link tải file: `[Bấm vào đây để tải Bảng công file Excel/CSV](/api/export?type=attendance&user_id=' . $targetUid . '&month=' . $month . '&year=' . $year . ')`. TUYỆT ĐỐI KHÔNG sinh thẻ Lead/Học viên CRM. TUYỆT ĐỐI KHÔNG dùng từ "(Zero-Trust)".'
                    ];
                }

                // ==========================================
                // 7b. ADVANCED CRM LEADS EXPORT & MULTI-FILTER
                // ==========================================
                case 'export_leads':
                case 'export_leads_dataset':
                case 'export_crm_leads_advanced': {
                    $tid = (int)($auth['tenant_id'] ?? 1);
                    $uid = (int)($auth['user_id'] ?? 0);

                    $rawStages = trim((string)($args['stages'] ?? ''));
                    $gender = strtolower(trim((string)($args['gender'] ?? 'all')));
                    $fromDate = trim((string)($args['from_date'] ?? ''));
                    $toDate = trim((string)($args['to_date'] ?? ''));
                    $program = trim((string)($args['program'] ?? ''));
                    $ownersParam = trim((string)($args['owners'] ?? ($args['assigned_to'] ?? ($args['owner_name'] ?? ''))));
                    $search = trim((string)($args['search'] ?? ''));
                    $limit = isset($args['limit']) && is_numeric($args['limit']) ? max(1, (int)$args['limit']) : 0;

                    // Build query
                    $where = ["t.tenant_id = ?", "t.deleted_at IS NULL"];
                    $params = [$tid];

                    // Filter by Lead Status (active vs lost vs nurture). Default for sales pipeline: active leads only (hide lost & nurture, hide customer)
                    $leadStatusParam = strtolower(trim((string)($args['lead_status'] ?? '')));
                    if ($leadStatusParam === 'lost') {
                        $where[] = "t.lead_status = 'lost'";
                    } elseif ($leadStatusParam === 'nurture') {
                        $where[] = "t.lead_status = 'nurture'";
                    } elseif ($leadStatusParam === 'all') {
                        // Include all
                    } else {
                        // Default active pipeline: hide both lost and nurture (same as CRM Tiềm năng list)
                        $where[] = "(t.lead_status NOT IN ('lost', 'nurture') OR t.lead_status IS NULL)";
                        $where[] = "(t.status != 'customer' OR t.status IS NULL)";
                    }

                    // RBAC Data Isolation (100% Parity with ContactController::getScope)
                    if (!$canViewAllLeads) {
                        if ($canViewTeamLeads) {
                            $where[] = "(t.owner_id = ? OR FIND_IN_SET(?, COALESCE(t.collaborator_ids, '')) OR t.owner_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id))))))";
                            $params[] = $uid;
                            $params[] = (string)$uid;
                            $params[] = $uid;
                        } else {
                            $where[] = "(t.owner_id = ? OR FIND_IN_SET(?, COALESCE(t.collaborator_ids, '')))";
                            $params[] = $uid;
                            $params[] = (string)$uid;
                        }
                    }

                    if (!empty($ownersParam) && $ownersParam !== 'all') {
                        $ownList = array_filter(array_map('trim', explode(',', $ownersParam)));
                        $ownOrs = [];
                        foreach ($ownList as $own) {
                            if (is_numeric($own)) {
                                $ownOrs[] = "(t.owner_id = ? OR FIND_IN_SET(?, COALESCE(t.collaborator_ids, '')))";
                                $params[] = (int)$own;
                                $params[] = (string)(int)$own;
                            } else {
                                $ownOrs[] = "EXISTS (SELECT 1 FROM users u_own WHERE u_own.id = t.owner_id AND u_own.full_name LIKE ?)";
                                $params[] = '%' . $own . '%';
                            }
                        }
                        if (!empty($ownOrs)) {
                            $where[] = "(" . implode(' OR ', $ownOrs) . ")";
                        }
                    }

                    // Multi-stage filtering
                    $exportStagesParam = '';
                    $matchingStageNames = [];
                    if (!empty($rawStages) && $rawStages !== 'all') {
                        $rawParts = explode(',', $rawStages);
                        $stageIds = [];
                        $orderIndexes = [];
                        $stageSlugs = [];

                        foreach ($rawParts as $part) {
                            $part = trim($part);
                            if (empty($part)) continue;
                            if (strpos($part, '-') !== false) {
                                $rangeParts = explode('-', $part, 2);
                                $min = (int)trim($rangeParts[0]);
                                $max = (int)trim($rangeParts[1]);
                                if ($min > 0 && $max >= $min) {
                                    for ($r = $min; $r <= $max; $r++) {
                                        if ($r <= 14) $orderIndexes[] = $r - 1;
                                    }
                                }
                            } elseif (is_numeric($part)) {
                                $n = (int)$part;
                                if ($n >= 1 && $n <= 14) {
                                    $orderIndexes[] = $n - 1;
                                }
                                $stageIds[] = $n;
                            } else {
                                $stageSlugs[] = $part;
                            }
                        }

                        $stageOrClauses = [];
                        if (!empty($stageIds)) {
                            $inIds = implode(',', array_unique(array_map('intval', $stageIds)));
                            $stageOrClauses[] = "t.stage_id IN ($inIds)";
                        }
                        if (!empty($orderIndexes)) {
                            $inOrders = implode(',', array_unique(array_map('intval', $orderIndexes)));
                            $stageOrClauses[] = "t.stage_id IN (SELECT id FROM pipeline_stages WHERE order_index IN ($inOrders))";
                            // Query exact stage names from database
                            $stmtStageNames = $db->query("SELECT name FROM pipeline_stages WHERE order_index IN ($inOrders) ORDER BY order_index ASC");
                            $matchingStageNames = $stmtStageNames ? ($stmtStageNames->fetchAll(PDO::FETCH_COLUMN) ?: []) : [];
                        }
                        if (!empty($stageSlugs)) {
                            $placeholders = implode(',', array_fill(0, count($stageSlugs), '?'));
                            $stageOrClauses[] = "t.pipeline_status IN ($placeholders)";
                            foreach ($stageSlugs as $slug) { $params[] = $slug; }
                        }

                        if (!empty($stageOrClauses)) {
                            $where[] = "(" . implode(' OR ', $stageOrClauses) . ")";
                        } else {
                            // Specified stages produced no valid matching pipeline stages
                            $where[] = "1=0";
                        }
                        $exportStagesParam = $rawStages;
                    }

                    $stageNamesStr = !empty($matchingStageNames) ? implode(', ', $matchingStageNames) : ($rawStages ?: 'Tất cả giai đoạn');
                    if (count($matchingStageNames) > 1) {
                        $firstStg = reset($matchingStageNames);
                        $lastStg = end($matchingStageNames);
                        $stageFullDesc = "các giai đoạn từ {$firstStg} đến {$lastStg} ({$stageNamesStr})";
                    } elseif (count($matchingStageNames) === 1) {
                        $stageFullDesc = "giai đoạn " . reset($matchingStageNames);
                    } else {
                        $stageFullDesc = $rawStages ? "giai đoạn {$rawStages}" : "tất cả các giai đoạn";
                    }

                    // Gender filtering
                    $genderLabel = 'Tất cả giới tính';
                    if (!empty($gender) && $gender !== 'all') {
                        if (in_array($gender, ['male', 'nam', 'trai', 'boy'], true)) {
                            $where[] = "LOWER(TRIM(COALESCE(t.gender, ''))) IN ('male', 'nam')";
                            $genderLabel = 'Nam (Male)';
                            $gender = 'male';
                        } elseif (in_array($gender, ['female', 'nu', 'nữ', 'gai', 'girl'], true)) {
                            $where[] = "(LOWER(TRIM(COALESCE(t.gender, ''))) IN ('female', 'nu') OR t.gender = 'Nữ')";
                            $genderLabel = 'Nữ (Female)';
                            $gender = 'female';
                        }
                    }

                    // Date range
                    $dateLabel = 'Toàn bộ thời gian';
                    if (!empty($fromDate) && !empty($toDate)) {
                        $where[] = "t.created_at BETWEEN ? AND ?";
                        $params[] = $fromDate . ' 00:00:00';
                        $params[] = $toDate . ' 23:59:59';
                        $dateLabel = "Từ {$fromDate} đến {$toDate}";
                    } elseif (!empty($fromDate)) {
                        $where[] = "t.created_at >= ?";
                        $params[] = $fromDate . ' 00:00:00';
                        $dateLabel = "Từ ngày {$fromDate} đến nay";
                    } elseif (!empty($toDate)) {
                        $where[] = "t.created_at <= ?";
                        $params[] = $toDate . ' 23:59:59';
                        $dateLabel = "Đến ngày {$toDate}";
                    }

                    // Program filter
                    if (!empty($program)) {
                        $where[] = "t.program LIKE ?";
                        $params[] = "%$program%";
                    }

                    // Search filter
                    if (!empty($search)) {
                        $where[] = "(t.full_name LIKE ? OR t.phone LIKE ? OR t.email LIKE ?)";
                        $params[] = "%$search%";
                        $params[] = "%$search%";
                        $params[] = "%$search%";
                    }

                    $whereSql = implode(' AND ', $where);

                    // Count total leads
                    $sqlCount = "SELECT COUNT(*) FROM contacts t WHERE $whereSql";
                    $stmtCount = $db->prepare($sqlCount);
                    $stmtCount->execute($params);
                    $totalCount = (int)$stmtCount->fetchColumn();

                    // Fetch 5 sample leads for preview (with job_title and company included)
                    $sqlSample = "SELECT 
                                    t.id, 
                                    t.full_name, 
                                    t.phone, 
                                    COALESCE(NULLIF(TRIM(t.job_title), ''), 'Chưa cập nhật') as job_title,
                                    COALESCE(NULLIF(TRIM(t.company), ''), COALESCE(co.name, '—')) as company_name,
                                    COALESCE(t.gender, 'Chưa rõ') as gender,
                                    COALESCE(t.program, 'Chưa rõ') as program,
                                    COALESCE(ps.name, t.pipeline_status, 'Chưa xác định') as stage_name,
                                    COALESCE(u.full_name, 'Chưa gán') as owner_name,
                                    DATE_FORMAT(t.created_at, '%d/%m/%Y') as formatted_date
                                  FROM contacts t
                                  LEFT JOIN companies co ON t.company_id = co.id
                                  LEFT JOIN pipeline_stages ps ON t.stage_id = ps.id
                                  LEFT JOIN users u ON t.owner_id = u.id
                                  WHERE $whereSql
                                  ORDER BY t.id DESC
                                  LIMIT " . ($limit > 0 ? min(5, $limit) : 5);
                    $stmtSample = $db->prepare($sqlSample);
                    $stmtSample->execute($params);
                    $samples = $stmtSample->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    $maskedSamples = [];
                    foreach ($samples as $s) {
                        $rawPhone = trim($s['phone'] ?? '');
                        $maskedPhone = (strlen($rawPhone) >= 7) ? substr($rawPhone, 0, 3) . '****' . substr($rawPhone, -3) : ($rawPhone !== '' ? $rawPhone : '—');
                        $maskedSamples[] = [
                            'id' => (int)$s['id'],
                            'name' => $s['full_name'],
                            'job_title' => $s['job_title'],
                            'company' => $s['company_name'],
                            'contact_link' => "/contact/{$s['id']}",
                            'phone' => $maskedPhone,
                            'gender' => $s['gender'],
                            'program' => $s['program'],
                            'stage' => $s['stage_name'],
                            'owner' => $s['owner_name'],
                            'created_at' => $s['formatted_date']
                        ];
                    }

                    // Build export URL
                    $queryParams = ['type' => 'contact', 'export_mode' => 'full'];
                    if ($limit > 0) $queryParams['limit'] = $limit;
                    if (!empty($exportStagesParam)) $queryParams['stages'] = $exportStagesParam;
                    if (!empty($gender) && $gender !== 'all') $queryParams['gender'] = $gender;
                    if (!empty($fromDate)) $queryParams['from'] = $fromDate;
                    if (!empty($toDate)) $queryParams['to'] = $toDate;
                    if (!empty($program)) $queryParams['program'] = $program;
                    if (!empty($ownersParam) && $ownersParam !== 'all') $queryParams['owners'] = $ownersParam;
                    if (!empty($search)) $queryParams['search'] = $search;

                    $exportUrl = "/api/export?" . http_build_query($queryParams);

                    $totalReported = ($limit > 0) ? min($limit, $totalCount) : $totalCount;
                    $scopeDesc = ($limit > 0) ? "{$totalReported} lead gần đây nhất (trên tổng số " . number_format($totalCount, 0, ',', '.') . " lead)" : number_format($totalCount, 0, ',', '.') . " lead";

                    return [
                        'success' => true,
                        'total_matching_leads' => $totalReported,
                        'total_database_leads' => $totalCount,
                        'limit_applied' => $limit > 0 ? $limit : null,
                        'criteria' => [
                            'stages' => $stageFullDesc,
                            'gender' => $genderLabel,
                            'period' => $dateLabel,
                            'program' => $program ?: 'Tất cả chương trình'
                        ],
                        'preview_samples' => $maskedSamples,
                        'download_url' => $exportUrl,
                        'direct_download_link' => "https://myerp.ideas.edu.vn{$exportUrl}",
                        'export_link_markdown' => "[Bấm vào đây để tải " . ($limit > 0 ? "danh sách {$limit} Lead gần đây" : "danh sách Lead") . " kèm chức vụ (File Excel/CSV)]({$exportUrl})",
                        'instruction' => 'BẮT BUỘC: 1. Thông báo rõ ràng: Hệ thống đã lọc và ghi nhận **' . $scopeDesc . '** trong ' . $stageFullDesc . '. 2. BẢNG XEM TRƯỚC (Preview) BẮT BUỘC ĐẦY ĐỦ CÁC CỘT: (| ID | HỌ VÀ TÊN | CHỨC VỤ | CÔNG TY | SĐT | GIAI ĐOẠN | SALE PHỤ TRÁCH | NGÀY TẠO |). Cột HỌ VÀ TÊN BẮT BUỘC dùng link `[Tên](/contact/ID)`. BẮT BUỘC hiển thị rõ cột CHỨC VỤ của từng lead. 3. Đính kèm nút hoặc link tải file: `[Bấm vào đây để tải ' . ($limit > 0 ? "danh sách {$limit} Lead gần đây" : "danh sách Lead") . ' kèm chức vụ (File Excel/CSV)](' . $exportUrl . ')`. TUYỆT ĐỐI KHÔNG dùng từ "(Zero-Trust)".'
                    ];
                }

                // ==========================================
                // 7c. ANALYZE LEADS DEMOGRAPHICS, JOB TITLES & INDUSTRIES
                // ==========================================
                case 'analyze_leads_demographics_and_job_titles': {
                    $tid = (int)($auth['tenant_id'] ?? 1);
                    $uid = (int)($auth['user_id'] ?? 0);

                    $limit = isset($args['limit']) && is_numeric($args['limit']) ? max(1, min(5000, (int)$args['limit'])) : 0;
                    $program = trim((string)($args['program'] ?? ''));
                    $rawStages = trim((string)($args['stages'] ?? ''));
                    $ownersParam = trim((string)($args['owners'] ?? ($args['assigned_to'] ?? '')));
                    $hasJobTitleOnly = (bool)($args['has_job_title_only'] ?? false);

                    $where = ["t.tenant_id = ?", "t.deleted_at IS NULL"];
                    $params = [$tid];

                    // Active sales pipeline filter
                    $where[] = "(t.lead_status NOT IN ('lost', 'nurture') OR t.lead_status IS NULL)";
                    $where[] = "(t.status != 'customer' OR t.status IS NULL)";

                    // RBAC Data Isolation (100% Parity with ContactController::getScope)
                    if (!$canViewAllLeads) {
                        if ($canViewTeamLeads) {
                            $where[] = "(t.owner_id = ? OR FIND_IN_SET(?, COALESCE(t.collaborator_ids, '')) OR t.owner_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id))))))";
                            $params[] = $uid;
                            $params[] = (string)$uid;
                            $params[] = $uid;
                        } else {
                            $where[] = "(t.owner_id = ? OR FIND_IN_SET(?, COALESCE(t.collaborator_ids, '')))";
                            $params[] = $uid;
                            $params[] = (string)$uid;
                        }
                    }

                    if (!empty($ownersParam) && $ownersParam !== 'all') {
                        $ownList = array_filter(array_map('trim', explode(',', $ownersParam)));
                        $ownOrs = [];
                        foreach ($ownList as $own) {
                            if (is_numeric($own)) {
                                $ownOrs[] = "(t.owner_id = ? OR FIND_IN_SET(?, COALESCE(t.collaborator_ids, '')))";
                                $params[] = (int)$own;
                                $params[] = (string)(int)$own;
                            } else {
                                $ownOrs[] = "EXISTS (SELECT 1 FROM users u_own WHERE u_own.id = t.owner_id AND u_own.full_name LIKE ?)";
                                $params[] = '%' . $own . '%';
                            }
                        }
                        if (!empty($ownOrs)) {
                            $where[] = "(" . implode(' OR ', $ownOrs) . ")";
                        }
                    }

                    if (!empty($program)) {
                        $where[] = "t.program LIKE ?";
                        $params[] = "%$program%";
                    }

                    if (!empty($rawStages) && $rawStages !== 'all') {
                        $stageParts = array_filter(array_map('trim', explode(',', $rawStages)));
                        $stageIds = [];
                        $orderIndexes = [];
                        $stageNames = [];
                        foreach ($stageParts as $sp) {
                            if (strpos($sp, '-') !== false) {
                                $range = explode('-', $sp, 2);
                                $minR = (int)trim($range[0]);
                                $maxR = (int)trim($range[1]);
                                if ($minR > 0 && $maxR >= $minR) {
                                    for ($r = $minR; $r <= $maxR; $r++) {
                                        $orderIndexes[] = $r - 1;
                                    }
                                }
                            } elseif (is_numeric($sp)) {
                                $n = (int)$sp;
                                if ($n >= 1 && $n <= 14) {
                                    $orderIndexes[] = $n - 1;
                                }
                                $stageIds[] = $n;
                            } else {
                                $stageNames[] = $sp;
                            }
                        }
                        $stageOrs = [];
                        if (!empty($stageIds)) {
                            $inIds = implode(',', array_unique($stageIds));
                            $stageOrs[] = "t.stage_id IN ($inIds)";
                        }
                        if (!empty($orderIndexes)) {
                            $inOrders = implode(',', array_unique($orderIndexes));
                            $stageOrs[] = "t.stage_id IN (SELECT id FROM pipeline_stages WHERE order_index IN ($inOrders))";
                        }
                        if (!empty($stageNames)) {
                            foreach ($stageNames as $sn) {
                                $stageOrs[] = "(t.status LIKE ? OR t.pipeline_status LIKE ? OR EXISTS (SELECT 1 FROM pipeline_stages ps_f WHERE ps_f.id = t.stage_id AND ps_f.name LIKE ?))";
                                $params[] = '%' . $sn . '%';
                                $params[] = '%' . $sn . '%';
                                $params[] = '%' . $sn . '%';
                            }
                        }
                        if (!empty($stageOrs)) {
                            $where[] = "(" . implode(' OR ', $stageOrs) . ")";
                        }
                    }

                    if ($hasJobTitleOnly) {
                        $where[] = "t.job_title IS NOT NULL AND TRIM(t.job_title) != ''";
                    }

                    $whereSql = implode(' AND ', $where);

                    // If limit specified, fetch the exact $limit most recent leads
                    if ($limit > 0) {
                        $sqlFetch = "SELECT t.id, t.full_name, t.phone, t.job_title, t.company, t.industry, t.program, ps.name as stage_name, u.full_name as owner_name, DATE_FORMAT(t.created_at, '%d/%m/%Y') as created_date
                                     FROM contacts t
                                     LEFT JOIN pipeline_stages ps ON t.stage_id = ps.id
                                     LEFT JOIN users u ON t.owner_id = u.id
                                     WHERE $whereSql
                                     ORDER BY t.id DESC
                                     LIMIT $limit";
                        $stmtFetch = $db->prepare($sqlFetch);
                        $stmtFetch->execute($params);
                        $leadRows = $stmtFetch->fetchAll(PDO::FETCH_ASSOC) ?: [];
                        $totalAnalyzed = count($leadRows);
                    } else {
                        // Entire filtered dataset
                        $stmtCount = $db->prepare("SELECT COUNT(*) FROM contacts t WHERE $whereSql");
                        $stmtCount->execute($params);
                        $totalAnalyzed = (int)$stmtCount->fetchColumn();

                        // Fetch leads with job titles for deep classification
                        $sqlWithJob = "SELECT t.id, t.full_name, t.job_title, t.company, t.industry, t.program 
                                       FROM contacts t 
                                       WHERE $whereSql AND t.job_title IS NOT NULL AND TRIM(t.job_title) != ''";
                        $stmtWj = $db->prepare($sqlWithJob);
                        $stmtWj->execute($params);
                        $leadRows = $stmtWj->fetchAll(PDO::FETCH_ASSOC) ?: [];
                    }

                    // Demographic & Seniority Counters
                    $hasJobCount = 0;
                    $hasCompanyCount = 0;
                    $jobFrequency = [];
                    $industryFrequency = [];
                    $levelCounts = [
                        'c_level' => ['label' => '👑 C-Level & Ban Lãnh Đạo (CEO, Giám đốc, Chủ tịch, Founder)', 'count' => 0, 'examples' => []],
                        'manager' => ['label' => '💼 Quản Lý Cấp Trung (Trưởng phòng, Trưởng bộ phận, Manager, Lead)', 'count' => 0, 'examples' => []],
                        'specialist' => ['label' => '🔬 Chuyên Gia & Chuyên Viên (Kỹ sư, Bác sĩ, Dược sĩ, Kế toán, Analyst)', 'count' => 0, 'examples' => []],
                        'owner' => ['label' => '🏢 Khởi Nghiệp & Chủ Doanh Nghiệp (Chủ DN, Kinh doanh tự do)', 'count' => 0, 'examples' => []],
                        'other' => ['label' => '👥 Chức Danh Khác / Nhân sự', 'count' => 0, 'examples' => []],
                        'unspecified' => ['label' => '❓ Chưa Cập Nhật Chức Vụ (Cần khai thác trong tư vấn)', 'count' => 0, 'examples' => []]
                    ];

                    // Process records
                    foreach ($leadRows as $r) {
                        $jt = trim($r['job_title'] ?? '');
                        $co = trim($r['company'] ?? '');
                        $ind = trim($r['industry'] ?? '');

                        if ($co !== '') $hasCompanyCount++;
                        if ($ind !== '') {
                            $industryFrequency[$ind] = ($industryFrequency[$ind] ?? 0) + 1;
                        }

                        if ($jt === '') {
                            $levelCounts['unspecified']['count']++;
                            continue;
                        }

                        $hasJobCount++;
                        $jobFrequency[$jt] = ($jobFrequency[$jt] ?? 0) + 1;
                        $lower = mb_strtolower($jt);

                        if (preg_match('/(ceo|founder|co-founder|director|giám đốc|giam doc|chủ tịch|chu tich|tổng giám đốc|tong giam doc|managing director|cfo|cmo|cto|coo|president|general manager|viện trưởng|hội đồng)/i', $lower)) {
                            $levelCounts['c_level']['count']++;
                            if (count($levelCounts['c_level']['examples']) < 4 && !in_array($jt, $levelCounts['c_level']['examples'], true)) {
                                $levelCounts['c_level']['examples'][] = $jt;
                            }
                        } elseif (preg_match('/(trưởng phòng|phó phòng|truong phong|pho phong|trưởng bộ phận|truong bo phan|manager|lead|leader|trưởng ban|truong ban|head of|quản lý|quan ly|supervisor)/i', $lower)) {
                            $levelCounts['manager']['count']++;
                            if (count($levelCounts['manager']['examples']) < 4 && !in_array($jt, $levelCounts['manager']['examples'], true)) {
                                $levelCounts['manager']['examples'][] = $jt;
                            }
                        } elseif (preg_match('/(chuyên viên|chuyen vien|kỹ sư|ky su|bác sĩ|bac si|dược sĩ|duoc si|kế toán|ke toan|chuyên gia|chuyen gia|analyst|engineer|doctor|pharmacist|accountant|giảng viên|giang vien|lecturer|consultant)/i', $lower)) {
                            $levelCounts['specialist']['count']++;
                            if (count($levelCounts['specialist']['examples']) < 4 && !in_array($jt, $levelCounts['specialist']['examples'], true)) {
                                $levelCounts['specialist']['examples'][] = $jt;
                            }
                        } elseif (preg_match('/(chủ dn|chủ doanh nghiệp|chu doanh nghiep|kinh doanh tự do|kinh doanh tu do|owner|entrepreneur|hộ kinh doanh)/i', $lower)) {
                            $levelCounts['owner']['count']++;
                            if (count($levelCounts['owner']['examples']) < 4 && !in_array($jt, $levelCounts['owner']['examples'], true)) {
                                $levelCounts['owner']['examples'][] = $jt;
                            }
                        } else {
                            $levelCounts['other']['count']++;
                            if (count($levelCounts['other']['examples']) < 4 && !in_array($jt, $levelCounts['other']['examples'], true)) {
                                $levelCounts['other']['examples'][] = $jt;
                            }
                        }
                    }

                    // If totalAnalyzed was from count (limit=0), calculate unspecified
                    if ($limit === 0) {
                        $levelCounts['unspecified']['count'] = max(0, $totalAnalyzed - $hasJobCount);
                        // Also fetch industry counts across dataset
                        $stInd = $db->prepare("SELECT TRIM(industry) as ind, COUNT(1) as cnt FROM contacts t WHERE $whereSql AND industry IS NOT NULL AND TRIM(industry) != '' GROUP BY TRIM(industry) ORDER BY cnt DESC LIMIT 10");
                        $stInd->execute($params);
                        $indRows = $stInd->fetchAll(PDO::FETCH_ASSOC) ?: [];
                        $industryFrequency = [];
                        foreach ($indRows as $ir) {
                            $industryFrequency[$ir['ind']] = (int)$ir['cnt'];
                        }
                    }

                    arsort($jobFrequency);
                    arsort($industryFrequency);

                    $topJobs = [];
                    foreach (array_slice($jobFrequency, 0, 10, true) as $title => $cnt) {
                        $topJobs[] = ['job_title' => $title, 'count' => $cnt];
                    }

                    $topIndustries = [];
                    foreach (array_slice($industryFrequency, 0, 10, true) as $indName => $cnt) {
                        $topIndustries[] = ['industry' => $indName, 'count' => $cnt];
                    }

                    $fillRateJobPercent = ($totalAnalyzed > 0) ? round(($hasJobCount / $totalAnalyzed) * 100, 1) : 0;
                    $fillRateCoPercent = ($totalAnalyzed > 0) ? round(($hasCompanyCount / $totalAnalyzed) * 100, 1) : 0;
                    $leadershipFitCount = $levelCounts['c_level']['count'] + $levelCounts['manager']['count'];
                    $leadershipFitPercent = ($hasJobCount > 0) ? round(($leadershipFitCount / $hasJobCount) * 100, 1) : 0;

                    $exportUrl = "/api/export?type=contact&export_mode=full" . ($limit > 0 ? "&limit={$limit}" : "") . (!empty($program) ? "&program=" . urlencode($program) : "") . (!empty($rawStages) && $rawStages !== 'all' ? "&stages=" . urlencode($rawStages) : "");

                    return [
                        'success' => true,
                        'scope_description' => $limit > 0 ? "Phân tích {$limit} lead gần đây nhất" : "Phân tích toàn bộ tập lead CRM trong hệ thống",
                        'total_leads_analyzed' => $totalAnalyzed,
                        'data_hygiene' => [
                            'has_job_title_count' => $hasJobCount,
                            'missing_job_title_count' => $totalAnalyzed - $hasJobCount,
                            'job_title_fill_rate' => "{$fillRateJobPercent}%",
                            'has_company_count' => $hasCompanyCount,
                            'company_fill_rate' => "{$fillRateCoPercent}%"
                        ],
                        'seniority_pyramid' => [
                            'c_level' => [
                                'label' => 'C-Level & Ban Lãnh Đạo (CEO, Giám đốc, Founder)',
                                'count' => $levelCounts['c_level']['count'],
                                'percent_of_known' => $hasJobCount > 0 ? round($levelCounts['c_level']['count'] / $hasJobCount * 100, 1) . '%' : '0%',
                                'examples' => implode(', ', $levelCounts['c_level']['examples']) ?: 'CEO, Director, Founder'
                            ],
                            'middle_management' => [
                                'label' => 'Quản Lý Cấp Trung (Trưởng phòng, Manager, Lead)',
                                'count' => $levelCounts['manager']['count'],
                                'percent_of_known' => $hasJobCount > 0 ? round($levelCounts['manager']['count'] / $hasJobCount * 100, 1) . '%' : '0%',
                                'examples' => implode(', ', $levelCounts['manager']['examples']) ?: 'Manager, Trưởng phòng, Lead'
                            ],
                            'specialists' => [
                                'label' => 'Chuyên Gia / Kỹ Sư / Bác Sĩ / Kế Toán',
                                'count' => $levelCounts['specialist']['count'],
                                'percent_of_known' => $hasJobCount > 0 ? round($levelCounts['specialist']['count'] / $hasJobCount * 100, 1) . '%' : '0%',
                                'examples' => implode(', ', $levelCounts['specialist']['examples']) ?: 'Engineer, Bác sĩ, Chuyên viên'
                            ],
                            'business_owners' => [
                                'label' => 'Chủ Doanh Nghiệp / Khởi Nghiệp',
                                'count' => $levelCounts['owner']['count'],
                                'percent_of_known' => $hasJobCount > 0 ? round($levelCounts['owner']['count'] / $hasJobCount * 100, 1) . '%' : '0%',
                                'examples' => implode(', ', $levelCounts['owner']['examples']) ?: 'Chủ DN'
                            ],
                            'unspecified' => [
                                'label' => 'Chưa Cập Nhật Chức Vụ',
                                'count' => $levelCounts['unspecified']['count'],
                                'percent_of_total' => $totalAnalyzed > 0 ? round($levelCounts['unspecified']['count'] / $totalAnalyzed * 100, 1) . '%' : '0%'
                            ]
                        ],
                        'top_job_titles' => $topJobs,
                        'top_industries' => $topIndustries,
                        'executive_takeaways' => [
                            'leadership_fit' => "Trong số các lead đã có thông tin chức vụ, có {$leadershipFitPercent}% thuộc nhóm C-Level và Quản lý cấp trung (rất phù hợp tuyển sinh EMBA và DBA).",
                            'actionable_advice' => $fillRateJobPercent < 20 ? "Tỷ lệ điền chức vụ còn thấp ({$fillRateJobPercent}%). Kiến nghị Marketing bổ sung trường 'Chức vụ' và 'Công ty' trên Landing Page/Facebook Ads, và Sale cần ưu tiên cập nhật chức danh trong cuộc gọi đầu tiên (TTL1)." : "Dữ liệu chức vụ ổn định, khuyến nghị phân bổ lead C-Level ưu tiên cho tư vấn chương trình Tiến sĩ DBA / EMBA."
                        ],
                        'download_export_url' => $exportUrl,
                        'export_link_markdown' => "[Bấm vào đây để tải tệp dữ liệu chi tiết kèm chức vụ]({$exportUrl})",
                        'instruction' => 'BẮT BUỘC TRÌNH BÀY ĐẦY ĐỦ 4 PHẦN CHUYÊN NGHIỆP:\n1. BẢNG TỔNG QUAN ĐỘ ĐẦY ĐỦ DỮ LIỆU (Tổng lead phân tích | Có chức vụ | Chưa có chức vụ | Tỷ lệ %).\n2. BẢNG PHÂN BỔ THÁP CẤP BẬC QUẢN LÝ (C-Level, Quản lý cấp trung, Chuyên gia, Khác kèm số lượng, % và ví dụ chức danh).\n3. BẢNG TOP NGÀNH NGHỀ PHỔ BIẾN.\n4. ĐÍNH KÈM THẺ BIỂU ĐỒ TRỰC QUAN: `<<<DYNAMIC_CHART: {"type": "bar", "title": "Cơ Cấu Cấp Bậc Quản Lý Lead CRM", "xAxisKey": "name", "data": [{"name": "C-Level/Lãnh đạo", "value": ' . $levelCounts['c_level']['count'] . '}, {"name": "Quản lý cấp trung", "value": ' . $levelCounts['manager']['count'] . '}, {"name": "Chuyên gia/Kỹ sư", "value": ' . $levelCounts['specialist']['count'] . '}, {"name": "Chưa cập nhật", "value": ' . $levelCounts['unspecified']['count'] . '}], "series": [{"dataKey": "value", "label": "Số lượng", "color": "#3b82f6"}]}>>>`.\n5. Đính kèm link tải file: `[Bấm vào đây để tải tệp dữ liệu chi tiết kèm chức vụ](' . $exportUrl . ')`.'
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
                    $employeeQuery = trim((string)($args['employee_query'] ?? ''));
                    $summaryAll = !empty($args['summary_all']) || in_array(mb_strtolower($employeeQuery), ['all', 'toan cong ty', 'toàn công ty', 'toan vien', 'toàn viện', 'tat ca', 'tất cả'], true);

                    $targetUid = $uid;
                    $targetUserName = $userName;

                    // 1. Company-wide Payroll Overview (Director / Admin / HR only)
                    if ($summaryAll) {
                        if (!$isGlobalAdmin && !$isHR) {
                            return [
                                'success' => false,
                                'restricted' => true,
                                'message' => 'Bạn không có quyền truy cập dữ liệu bảng lương toàn công ty. Dữ liệu này chỉ dành riêng cho Ban Giám đốc và Phòng Nhân sự.'
                            ];
                        }

                        $period = ($month !== null && $month >= 1 && $month <= 12) ? sprintf('%04d-%02d', $year, $month) : date('Y-m');
                        $stmtSum = $db->prepare("SELECT 
                            COUNT(1) as total_slips,
                            COUNT(DISTINCT monthly_payslips.user_id) as total_employees,
                            COALESCE(SUM(monthly_payslips.net_salary), 0) as total_net,
                            COALESCE(SUM(monthly_payslips.salary_basic_calculated), 0) as total_basic,
                            COALESCE(SUM(monthly_payslips.kpi_bonus), 0) as total_kpi_bonus,
                            COALESCE(SUM(monthly_payslips.allowance_total), 0) as total_allowance,
                            COALESCE(SUM(monthly_payslips.insurance_bhxh), 0) as total_bhxh,
                            SUM(CASE WHEN monthly_payslips.status = 'paid' THEN 1 ELSE 0 END) as paid_count,
                            SUM(CASE WHEN monthly_payslips.status = 'approved' THEN 1 ELSE 0 END) as approved_count,
                            SUM(CASE WHEN monthly_payslips.status IN ('draft', 'pending_approval') THEN 1 ELSE 0 END) as pending_count
                        FROM monthly_payslips
                        JOIN users u ON u.id = monthly_payslips.user_id
                        WHERE u.tenant_id = ? AND monthly_payslips.month_year = ?");
                        $stmtSum->execute([$tid, $period]);
                        $sumData = $stmtSum->fetch(PDO::FETCH_ASSOC) ?: [];

                        return [
                            'success' => true,
                            'is_company_summary' => true,
                            'month_year' => $period,
                            'total_employees' => (int)($sumData['total_employees'] ?? 0),
                            'total_net_payroll' => number_format((float)($sumData['total_net'] ?? 0), 0, ',', '.') . ' VND',
                            'total_basic_payroll' => number_format((float)($sumData['total_basic'] ?? 0), 0, ',', '.') . ' VND',
                            'total_kpi_bonus' => number_format((float)($sumData['total_kpi_bonus'] ?? 0), 0, ',', '.') . ' VND',
                            'total_allowance' => number_format((float)($sumData['total_allowance'] ?? 0), 0, ',', '.') . ' VND',
                            'status_counts' => [
                                'paid' => (int)($sumData['paid_count'] ?? 0),
                                'approved' => (int)($sumData['approved_count'] ?? 0),
                                'pending' => (int)($sumData['pending_count'] ?? 0),
                            ],
                            'route_url' => '/hrm?tab=payroll',
                            'summary' => "Tổng quỹ lương kỳ {$period}: " . number_format((float)($sumData['total_net'] ?? 0), 0, ',', '.') . " VND cho {$sumData['total_employees']} nhân sự ({$sumData['paid_count']} đã thanh toán, {$sumData['approved_count']} đã duyệt, {$sumData['pending_count']} chờ duyệt)."
                        ];
                    }

                    // 2. Specific Employee Query (RBAC Isolation)
                    if (!empty($employeeQuery)) {
                        // Find target employee
                        $stmtFind = $db->prepare("SELECT id, full_name, role, team_id FROM users WHERE tenant_id = ? AND (full_name LIKE ? OR id = ? OR email LIKE ?) AND status = 'active' ORDER BY (full_name = ?) DESC LIMIT 1");
                        $stmtFind->execute([$tid, "%$employeeQuery%", (int)$employeeQuery, "%$employeeQuery%", $employeeQuery]);
                        $foundUser = $stmtFind->fetch(PDO::FETCH_ASSOC);

                        if (!$foundUser) {
                            return [
                                'success' => false,
                                'message' => "Không tìm thấy thông tin nhân sự '{$employeeQuery}' trong hệ thống để tra cứu phiếu lương."
                            ];
                        }

                        $queriedUid = (int)$foundUser['id'];
                        if ($queriedUid !== $uid) {
                            // Check permission
                            if ($isGlobalAdmin || $isHR) {
                                $targetUid = $queriedUid;
                                $targetUserName = $foundUser['full_name'];
                            } elseif ($isManager) {
                                $stmtMgr = $db->prepare("SELECT 1 FROM users u JOIN teams t ON u.team_id = t.id WHERE u.id = ? AND (t.leader_id = ? OR u.team_id = (SELECT team_id FROM users WHERE id = ?)) LIMIT 1");
                                $stmtMgr->execute([$queriedUid, $uid, $uid]);
                                if ($stmtMgr->fetchColumn()) {
                                    $targetUid = $queriedUid;
                                    $targetUserName = $foundUser['full_name'];
                                } else {
                                    return [
                                        'success' => false,
                                        'restricted' => true,
                                        'message' => "Theo quy định bảo mật tiền lương, bạn chỉ có quyền xem phiếu lương của nhân sự thuộc nhóm bạn quản lý. Bạn không có quyền truy cập phiếu lương của {$foundUser['full_name']}."
                                    ];
                                }
                            } else {
                                return [
                                    'success' => false,
                                    'restricted' => true,
                                    'message' => "Theo quy định bảo mật tiền lương của Viện, bạn chỉ có quyền tra cứu phiếu lương của chính mình. Dữ liệu tiền lương của nhân sự khác được bảo mật tuyệt đối."
                                ];
                            }
                        }
                    }

                    // Query payslip for $targetUid
                    if ($month !== null && $month >= 1 && $month <= 12) {
                        $period = sprintf('%04d-%02d', $year, $month);
                        $stmt = $db->prepare("SELECT * FROM monthly_payslips WHERE user_id = ? AND month_year = ? LIMIT 1");
                        $stmt->execute([$targetUid, $period]);
                    } else {
                        $stmt = $db->prepare("SELECT * FROM monthly_payslips WHERE user_id = ? ORDER BY month_year DESC LIMIT 1");
                        $stmt->execute([$targetUid]);
                    }

                    $ps = $stmt->fetch(PDO::FETCH_ASSOC);
                    if (!$ps) {
                        $whoText = ($targetUid === $uid) ? "cho bạn" : "cho nhân sự {$targetUserName}";
                        return [
                            'success' => true,
                            'has_record' => false,
                            'message' => "Hiện tại hệ thống chưa có dữ liệu bảng lương {$whoText}" . ($month ? " trong tháng {$month}/{$year}." : ".") . " Bạn có thể kiểm tra lại tại mục Phiếu lương (/my-payslips) hoặc liên hệ phòng Nhân sự.",
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
                    $subjectPrefix = ($targetUid === $uid) ? "của bạn" : "của nhân sự {$targetUserName}";

                    return [
                        'success' => true,
                        'has_record' => true,
                        'employee_name' => $targetUserName,
                        'is_self' => ($targetUid === $uid),
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
                        'summary' => "Phiếu lương kỳ {$ps['month_year']} {$subjectPrefix}: Thực nhận " . number_format((float)$ps['net_salary'], 0, ',', '.') . " VND. Số ngày công thực tế: {$ps['work_days_actual']}/{$ps['work_days_required']} ngày. Trạng thái: {$stText}."
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

                        $stmtLv = $db->prepare("SELECT COUNT(*) FROM hrm_leave_requests l JOIN users u ON l.user_id = u.id WHERE u.tenant_id = ? AND l.status = 'pending' AND (l.user_id = ? OR l.approver_id = ? OR l.approver_id_2 = ? " . ($isGlobalAdmin ? "OR l.approver_id IS NULL OR l.approver_id = 0" : "") . ")");
                        $stmtLv->execute([$tid, $uid, $uid, $uid]);
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
                    $greetingName = $auth['full_name'] ?? ($auth['clean_name'] ?? ($auth['name'] ?? 'Sếp'));
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
                    $searchQuery = trim($args['search_query'] ?? '');
                    $targetId = (int)($args['target_id'] ?? 0);
                    $entityType = strtolower(trim($args['entity_type'] ?? ''));
                    $baseUrl = 'https://myerp.ideas.edu.vn';

                    // Auto-detect specific entity intent and ID from destination
                    $isExplicitPo = ($entityType === 'po') || preg_match('/(?:^|\b|\s)(?:po|phiếu chi|chi phí|đề nghị thanh toán)(?:\b|\s|[0-9]|$)/iu', $dest);
                    $isExplicitSo = ($entityType === 'so') || preg_match('/(?:^|\b|\s)(?:so|đặt cọc|đơn cọc|phiếu thu)(?:\b|\s|[0-9]|$)/iu', $dest);
                    $isExplicitTask = ($entityType === 'task') || preg_match('/(?:^|\b|\s)(?:task|nhiệm vụ|công việc)(?:\b|\s|[0-9]|$)/iu', $dest);
                    $isExplicitContact = ($entityType === 'contact') || preg_match('/(?:^|\b|\s)(?:học viên|khách hàng|khách|lead|sinh viên|hồ sơ|contact|student)(?:\b|\s|[0-9]|$)/iu', $dest);

                    // Extract numeric ID if present
                    if ($targetId <= 0) {
                        if (preg_match('/(?:#|id\s*[:=]?\s*|(?:po|so|task|việc|đơn|cọc|học viên|khách|lead)\s*)([0-9]{1,10})/iu', $dest, $idMatch)) {
                            $targetId = (int)$idMatch[1];
                        } elseif (preg_match('/\b([0-9]{3,10})\b/', $dest, $idMatch)) {
                            $targetId = (int)$idMatch[1];
                        }
                    }

                    // Auto-extract query if targetId is zero and searchQuery is empty but dest contains specific name/code
                    if ($targetId <= 0 && empty($searchQuery)) {
                        $cleanedDest = trim(preg_replace('/^(?:mở\s*tab|tab|xem\s*tab|mở|xem|tìm|hồ\s*sơ|học\s*viên|khách\s*hàng|khách|lead|đơn|phiếu|task|công\s*việc)\s+/iu', '', $dest));
                        $cleanedDest = trim(preg_replace('/(?:\s*(?:đi|nhé|nè|giùm|hộ|cho\s*mình))\s*$/iu', '', $cleanedDest));
                        $systemModules = ['workspace', 'bàn làm việc', 'cong viec', 'công việc', 'quy trình', 'phê duyệt', 'approvals', 'phiếu chi', 'chi phí', 'po', 'phiếu thu', 'đặt cọc', 'so', 'tiềm năng', 'lead', 'crm', 'pipeline', 'phễu', 'học viên', 'chấm công', 'phiếu lương', 'bảng lương', 'dòng tiền', 'nhân sự', 'dự án', 'cài đặt'];
                        if (mb_strlen($cleanedDest) >= 2 && !in_array($cleanedDest, $systemModules, true)) {
                            $searchQuery = $cleanedDest;
                        }
                    }

                    // 1. SPECIFIC PURCHASE ORDER (PO) / EXPENSE LOOKUP (If explicit PO intent)
                    if ($isExplicitPo && ($targetId > 0 || !empty($searchQuery))) {
                        $expWhere = ["e.tenant_id = ?", "e.deleted_at IS NULL"];
                        $expParams = [$tid];
                        if (!$isGlobalAdmin && !$isAccountant && !$isManager) {
                            $expWhere[] = "(e.created_by = ? OR e.approver_id = ? OR e.approver_id_2 = ? OR e.approver_id_3 = ? OR FIND_IN_SET(?, IFNULL(e.related_user_ids, '')))";
                            $expParams = array_merge($expParams, [$uid, $uid, $uid, $uid, (string)$uid]);
                        }
                        if ($targetId > 0) {
                            $expWhere[] = "e.id = ?";
                            $expParams[] = $targetId;
                        } else {
                            $cleanTitle = trim(preg_replace('/^(?:po|phiếu chi|chi phí)\s*/iu', '', $searchQuery));
                            $expWhere[] = "(e.title LIKE ? OR CAST(e.id AS CHAR) = ?)";
                            $expParams[] = '%' . $cleanTitle . '%';
                            $expParams[] = $cleanTitle;
                        }
                        $stmtExp = $db->prepare("SELECT e.id, e.title, e.amount, e.status, e.created_by FROM expenses e WHERE " . implode(" AND ", $expWhere) . " ORDER BY e.id DESC LIMIT 1");
                        $stmtExp->execute($expParams);
                        $foundExp = $stmtExp->fetch(PDO::FETCH_ASSOC);
                        if ($foundExp) {
                            $poId = (int)$foundExp['id'];
                            $poTitle = $foundExp['title'];
                            $directUrl = "{$baseUrl}/expenses?id={$poId}";
                            $escTitle = addslashes($poTitle);
                            $smartTag = "<<<ERP_CARD:{\"entity_type\":\"po\",\"entity_id\":{$poId},\"title\":\"{$escTitle}\",\"amount\":{$foundExp['amount']},\"status\":\"{$foundExp['status']}\",\"direct_url\":\"{$directUrl}\",\"action_label\":\"Mở phiếu chi PO\"}>>>";
                            return [
                                'success' => true,
                                'found_entity' => true,
                                'entity_type' => 'po',
                                'entity_id' => $poId,
                                'title' => "Phiếu chi PO: {$poTitle}",
                                'direct_url' => $directUrl,
                                'relative_url' => "/expenses?id={$poId}",
                                'open_tab_markdown' => "[Bấm để mở phiếu chi #{$poId}]({$directUrl})",
                                'smart_tag' => $smartTag,
                                'description' => "Đã mở sẵn phiếu chi PO #{$poId} ({$poTitle}). Bấm đường dẫn trực tiếp hoặc thẻ ERP để mở modal chi tiết."
                            ];
                        }
                    }

                    // 2. SPECIFIC TASK LOOKUP (If explicit Task intent)
                    if ($isExplicitTask && ($targetId > 0 || !empty($searchQuery))) {
                        $tWhere = ["a.tenant_id = ?", "a.deleted_at IS NULL", "a.type = 'task'"];
                        $tParams = [$tid];
                        if (!$isGlobalAdmin) {
                            if ($isManager) {
                                $tWhere[] = "(a.user_id = ? OR a.created_by = ? OR a.approver_id = ? OR FIND_IN_SET(?, IFNULL(a.participant_ids, '')) OR a.user_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ? OR FIND_IN_SET(?, COALESCE(co_leader_ids, '')))) OR a.created_by IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ? OR FIND_IN_SET(?, COALESCE(co_leader_ids, '')))))";
                                $tParams = array_merge($tParams, [$uid, $uid, $uid, (string)$uid, $uid, (string)$uid, $uid, (string)$uid]);
                            } else {
                                $tWhere[] = "(a.user_id = ? OR a.created_by = ? OR a.approver_id = ? OR FIND_IN_SET(?, IFNULL(a.participant_ids, '')))";
                                $tParams = array_merge($tParams, [$uid, $uid, $uid, (string)$uid]);
                            }
                        }
                        if ($targetId > 0) {
                            $tWhere[] = "a.id = ?";
                            $tParams[] = $targetId;
                        } else {
                            $cleanSub = trim(preg_replace('/^(?:task|công việc|nhiệm vụ)\s*/iu', '', $searchQuery));
                            $tWhere[] = "(a.subject LIKE ? OR CAST(a.id AS CHAR) = ?)";
                            $tParams[] = '%' . $cleanSub . '%';
                            $tParams[] = $cleanSub;
                        }
                        $stmtT = $db->prepare("SELECT a.id, a.subject, a.status, a.priority, a.due_date FROM activities a WHERE " . implode(" AND ", $tWhere) . " ORDER BY a.id DESC LIMIT 1");
                        $stmtT->execute($tParams);
                        $foundT = $stmtT->fetch(PDO::FETCH_ASSOC);
                        if ($foundT) {
                            $tId = (int)$foundT['id'];
                            $tSub = $foundT['subject'];
                            $directUrl = "{$baseUrl}/workspace?task_id={$tId}";
                            $escSub = addslashes($tSub);
                            $smartTag = "<<<ERP_CARD:{\"entity_type\":\"task\",\"entity_id\":{$tId},\"title\":\"{$escSub}\",\"status\":\"{$foundT['status']}\",\"direct_url\":\"{$directUrl}\",\"action_label\":\"Mở công việc\"}>>>";
                            return [
                                'success' => true,
                                'found_entity' => true,
                                'entity_type' => 'task',
                                'entity_id' => $tId,
                                'title' => "Công việc: {$tSub}",
                                'direct_url' => $directUrl,
                                'relative_url' => "/workspace?task_id={$tId}",
                                'open_tab_markdown' => "[Bấm để mở công việc #{$tId}]({$directUrl})",
                                'smart_tag' => $smartTag,
                                'description' => "Đã mở sẵn công việc #{$tId} ({$tSub}). Bấm đường dẫn trực tiếp hoặc thẻ ERP để mở drawer."
                            ];
                        }
                    }

                    // 3. SPECIFIC CONTACT / STUDENT / LEAD LOOKUP
                    if (!$isExplicitPo && !$isExplicitTask && !$isExplicitSo && ($targetId > 0 || !empty($searchQuery) || $entityType === 'contact')) {
                        $isPersonIntent = ($entityType === 'contact') || !empty($searchQuery) || (preg_match('/(học viên|khách|lead|sinh viên|hồ sơ|contact|student)/iu', $dest) && !empty($searchQuery));
                        
                        if ($isPersonIntent || !empty($searchQuery)) {
                            $cWhere = ["c.tenant_id = ?", "c.deleted_at IS NULL"];
                            $cParams = [$tid];

                            if ($targetId > 0) {
                                $cWhere[] = "c.id = ?";
                                $cParams[] = $targetId;
                            } elseif (!empty($searchQuery)) {
                                if (preg_match('/^[0-9]{8,12}$/', $searchQuery)) {
                                    $cWhere[] = "c.phone LIKE ?";
                                    $cParams[] = '%' . $searchQuery . '%';
                                } else {
                                    $cWhere[] = "(c.full_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR CAST(c.id AS CHAR) = ?)";
                                    $cLike = '%' . $searchQuery . '%';
                                    $cParams[] = $cLike;
                                    $cParams[] = $cLike;
                                    $cParams[] = $cLike;
                                    $cParams[] = $searchQuery;
                                }
                            }

                            // Enforce RBAC
                            if (!$canAccessAllContacts) {
                                $rbac = $getContactRbacClause('c');
                                $cWhere[] = $rbac['clause'];
                                $cParams = array_merge($cParams, $rbac['params']);
                            }

                            $sqlSearchContact = "SELECT c.id, c.full_name, c.phone, c.email, c.status, ps.name as stage_name, u.full_name as owner_name
                                                FROM contacts c
                                                LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
                                                LEFT JOIN users u ON c.owner_id = u.id
                                                WHERE " . implode(" AND ", $cWhere) . "
                                                ORDER BY c.id DESC LIMIT 1";
                            $stmtContact = $db->prepare($sqlSearchContact);
                            $stmtContact->execute($cParams);
                            $foundContact = $stmtContact->fetch(PDO::FETCH_ASSOC);

                            if ($foundContact) {
                                $cId = (int)$foundContact['id'];
                                $cName = $foundContact['full_name'];
                                $cPhone = $foundContact['phone'] ?: '';
                                $cStage = $foundContact['stage_name'] ?: ($foundContact['status'] ?: 'Đang tư vấn');
                                $directUrl = "{$baseUrl}/contacts?id={$cId}";
                                $relativeUrl = "/contacts?id={$cId}";
                                $escName = addslashes($cName);
                                $smartTag = "<<<ERP_CARD:{\"entity_type\":\"contact\",\"entity_id\":{$cId},\"title\":\"{$escName}\",\"subtitle\":\"{$cPhone} • {$cStage}\",\"status\":\"in_progress\",\"direct_url\":\"{$directUrl}\",\"action_label\":\"Mở hồ sơ học viên\"}>>>";

                                return [
                                    'success' => true,
                                    'found_entity' => true,
                                    'entity_type' => 'contact',
                                    'entity_id' => $cId,
                                    'title' => "Hồ sơ học viên/khách hàng: {$cName}",
                                    'direct_url' => $directUrl,
                                    'relative_url' => $relativeUrl,
                                    'open_tab_markdown' => "[Bấm để mở hồ sơ {$cName}]({$directUrl})",
                                    'smart_tag' => $smartTag,
                                    'description' => "Đã mở sẵn hồ sơ của học viên {$cName} (SĐT: {$cPhone}, Trạng thái: {$cStage}). Bấm đường dẫn trực tiếp hoặc thẻ ERP bên dưới để xem chi tiết."
                                ];
                            }
                        }
                    }

                    // 4. SPECIFIC SALES ORDER (SO) / DEPOSIT LOOKUP
                    if ($targetId > 0 || !empty($searchQuery) || $entityType === 'so' || preg_match('/(so|đặt cọc|phiếu thu|học phí)/iu', $dest)) {
                        if ($targetId > 0 || !empty($searchQuery)) {
                            $depWhere = ["(c.tenant_id = ? OR p.tenant_id = ? OR u.tenant_id = ?)", "(c.id IS NULL OR c.deleted_at IS NULL)"];
                            $depParams = [$tid, $tid, $tid];
                            if (!$isGlobalAdmin && !$isAccountant) {
                                if ($isManager) {
                                    $depWhere[] = "(d.created_by = ? OR c.owner_id = ? OR FIND_IN_SET(?, IFNULL(c.collaborator_ids, '')) OR d.created_by IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ? OR FIND_IN_SET(?, COALESCE(co_leader_ids, '')))) OR c.owner_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ? OR FIND_IN_SET(?, COALESCE(co_leader_ids, '')))))";
                                    $depParams = array_merge($depParams, [$uid, $uid, (string)$uid, $uid, (string)$uid, $uid, (string)$uid]);
                                } else {
                                    $depWhere[] = "(d.created_by = ? OR c.owner_id = ? OR FIND_IN_SET(?, IFNULL(c.collaborator_ids, '')))";
                                    $depParams = array_merge($depParams, [$uid, $uid, (string)$uid]);
                                }
                            }
                            if ($targetId > 0) {
                                $depWhere[] = "d.id = ?";
                                $depParams[] = $targetId;
                            } else {
                                $depWhere[] = "(d.unit_code LIKE ? OR CAST(d.id AS CHAR) = ?)";
                                $depParams[] = '%' . $searchQuery . '%';
                                $depParams[] = $searchQuery;
                            }
                            $stmtDep = $db->prepare("SELECT d.id, d.unit_code, d.price, d.status, c.full_name as contact_name FROM deposits d LEFT JOIN contacts c ON d.contact_id = c.id LEFT JOIN projects p ON d.project_id = p.id LEFT JOIN users u ON d.created_by = u.id WHERE " . implode(" AND ", $depWhere) . " ORDER BY d.id DESC LIMIT 1");
                            $stmtDep->execute($depParams);
                            $foundDep = $stmtDep->fetch(PDO::FETCH_ASSOC);
                            if ($foundDep) {
                                $soId = (int)$foundDep['id'];
                                $soTitle = $foundDep['unit_code'] ?: "Đơn cọc #{$soId} ({$foundDep['contact_name']})";
                                $directUrl = "{$baseUrl}/deposits?id={$soId}";
                                $escTitle = addslashes($soTitle);
                                $smartTag = "<<<ERP_CARD:{\"entity_type\":\"so\",\"entity_id\":{$soId},\"title\":\"{$escTitle}\",\"amount\":{$foundDep['price']},\"status\":\"{$foundDep['status']}\",\"direct_url\":\"{$directUrl}\",\"action_label\":\"Mở đơn cọc SO\"}>>>";
                                return [
                                    'success' => true,
                                    'found_entity' => true,
                                    'entity_type' => 'so',
                                    'entity_id' => $soId,
                                    'title' => "Đơn cọc SO: {$soTitle}",
                                    'direct_url' => $directUrl,
                                    'relative_url' => "/deposits?id={$soId}",
                                    'open_tab_markdown' => "[Bấm để mở đơn cọc SO #{$soId}]({$directUrl})",
                                    'smart_tag' => $smartTag,
                                    'description' => "Đã mở sẵn đơn đặt cọc SO #{$soId}. Bấm đường dẫn trực tiếp hoặc thẻ ERP để mở chi tiết."
                                ];
                            }
                        }
                    }

                    // 5. STANDARD SYSTEM MODULE FALLBACK
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

                    $directUrl = "{$baseUrl}{$matched['url']}";
                    return [
                        'success' => true,
                        'found_entity' => false,
                        'title' => $matched['title'],
                        'url' => $matched['url'],
                        'direct_url' => $directUrl,
                        'open_tab_markdown' => "[Bấm để mở {$matched['title']}]({$directUrl})",
                        'description' => $matched['desc'],
                        'guide' => "Bạn có thể truy cập trực tiếp tại: [{$matched['title']}]({$directUrl}) hoặc nhấp vào thanh Menu điều hướng bên trái."
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

                    // Sum Approved Deposits (Sales Orders / Cash In) - deposits table has no tenant_id column, isolate via contacts/projects/users
                    $stmtIn = $db->prepare("
                        SELECT COUNT(DISTINCT d.id) as total_slips, IFNULL(SUM(d.price), 0) as total_in
                        FROM deposits d
                        LEFT JOIN contacts c ON d.contact_id = c.id
                        LEFT JOIN projects p ON d.project_id = p.id
                        LEFT JOIN users u ON d.created_by = u.id
                        WHERE (c.tenant_id = ? OR p.tenant_id = ? OR u.tenant_id = ?)
                          AND (c.id IS NULL OR c.deleted_at IS NULL)
                          AND d.status = 'approved'
                          AND d.created_at LIKE ?
                    ");
                    $stmtIn->execute([$tid, $tid, $tid, $period . '-%']);
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
                    $stmtPendingSO = $db->prepare("
                        SELECT COUNT(DISTINCT d.id), IFNULL(SUM(d.price), 0)
                        FROM deposits d
                        LEFT JOIN contacts c ON d.contact_id = c.id
                        LEFT JOIN projects p ON d.project_id = p.id
                        LEFT JOIN users u ON d.created_by = u.id
                        WHERE (c.tenant_id = ? OR p.tenant_id = ? OR u.tenant_id = ?)
                          AND (c.id IS NULL OR c.deleted_at IS NULL)
                          AND d.status = 'pending'
                    ");
                    $stmtPendingSO->execute([$tid, $tid, $tid]);
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
                        $rawExportType = strtolower(trim((string)($params['export_type'] ?? ($params['type'] ?? 'contact'))));
                        if (in_array($rawExportType, ['contact', 'contacts', 'lead', 'leads', 'crm', 'crm_leads', 'student', 'students', 'hoc_vien', 'khach_hang', 'export_data', 'export'], true)) {
                            $exportType = 'contact';
                        } elseif (in_array($rawExportType, ['company', 'companies', 'doanh_nghiep'], true)) {
                            $exportType = 'company';
                        } elseif (in_array($rawExportType, ['deal', 'deals', 'co_hoi', 'b2b'], true)) {
                            $exportType = 'deal';
                        } elseif (in_array($rawExportType, ['product', 'products', 'san_pham'], true)) {
                            $exportType = 'product';
                        } elseif (in_array($rawExportType, ['inventory', 'inventories', 'kho', 'vat_tu'], true)) {
                            $exportType = 'inventory';
                        } elseif (in_array($rawExportType, ['asset', 'assets', 'tai_san'], true)) {
                            $exportType = 'asset';
                        } elseif (in_array($rawExportType, ['attendance', 'attendances', 'bang_cong', 'cham_cong'], true)) {
                            $exportType = 'attendance';
                        } elseif (in_array($rawExportType, ['expense', 'expenses', 'chi_phi', 'phieu_chi', 'po'], true)) {
                            $exportType = 'expense';
                        } elseif (in_array($rawExportType, ['deposit', 'deposits', 'dat_coc', 'phieu_thu', 'so', 'sales_order', 'doanh_thu'], true)) {
                            $exportType = 'deposit';
                        } elseif (in_array($rawExportType, ['task', 'tasks', 'cong_viec', 'nhiem_vu', 'activity', 'activities'], true)) {
                            $exportType = 'task';
                        } elseif (in_array($rawExportType, ['ticket', 'tickets', 'sla', 'yeu_cau', 'ho_tro'], true)) {
                            $exportType = 'ticket';
                        } elseif (in_array($rawExportType, ['staff', 'employee', 'employees', 'hrm', 'nhan_su', 'payroll', 'bang_luong'], true)) {
                            $exportType = 'staff';
                        } else {
                            $exportType = 'contact';
                        }
                        $params['export_type'] = $exportType;
                        $params['type'] = $exportType;

                        if (empty($params['download_url'])) {
                            $queryParams = http_build_query(array_filter([
                                'type' => $exportType,
                                'search' => $params['search'] ?? ($params['search_query'] ?? ''),
                                'lead_status' => $params['lead_status'] ?? '',
                                'status' => $params['status'] ?? ($params['statuses'] ?? ''),
                                'segment' => $params['segment'] ?? '',
                                'stale_days' => $params['stale_days'] ?? '',
                                'from' => $params['from'] ?? ($params['from_date'] ?? ''),
                                'to' => $params['to'] ?? ($params['to_date'] ?? ''),
                                'date_field' => $params['date_field'] ?? '',
                                'team_id' => $params['team_id'] ?? '',
                                'owner_id' => $params['owner_id'] ?? '',
                                'owners' => $params['owners'] ?? '',
                                'program' => $params['program'] ?? ($params['programs'] ?? ''),
                                'stages' => $params['stages'] ?? ($params['stage_ids'] ?? ''),
                                'source' => $params['source'] ?? ($params['sources'] ?? ''),
                                'city' => $params['city'] ?? ($params['branches_or_cities'] ?? ''),
                                'gender' => $params['gender'] ?? '',
                                'financial_filter' => $params['financial_filter'] ?? ($params['deposit_status'] ?? ''),
                                'min_deposit' => $params['min_deposit'] ?? ($params['min_deposit_amount'] ?? ''),
                                'interaction_status' => $params['interaction_status'] ?? ($params['activity_status'] ?? ''),
                                'departments' => $params['departments'] ?? ($params['department'] ?? ''),
                                'category' => $params['category'] ?? ($params['categories'] ?? ''),
                                'period' => $params['period'] ?? '',
                                'min_amount' => $params['min_amount'] ?? ($params['min_value'] ?? ''),
                                'max_amount' => $params['max_amount'] ?? ($params['max_value'] ?? ''),
                                'overdue_only' => $params['overdue_only'] ?? '',
                                'milestone_status' => $params['milestone_status'] ?? '',
                                'priorities' => $params['priorities'] ?? ($params['priority'] ?? ''),
                                'assignees' => $params['assignees'] ?? '',
                                'creators' => $params['creators'] ?? ($params['created_by_name'] ?? ''),
                                'role' => $params['role'] ?? ($params['roles'] ?? ''),
                                'has_insurance' => $params['has_insurance'] ?? '',
                                'month_year' => $params['month_year'] ?? '',
                                'stock_status' => $params['stock_status'] ?? '',
                                'user_name' => $params['user_name'] ?? ($params['staff_name'] ?? ''),
                                'tag' => $params['tag'] ?? ($params['tags'] ?? ''),
                                'data_type' => $params['data_type'] ?? '',
                                'student_sub_tab' => $params['student_sub_tab'] ?? '',
                                'multi_program' => $params['multi_program'] ?? '',
                                'export_mode' => $params['export_mode'] ?? 'filtered'
                            ], fn($v) => $v !== '' && $v !== null));
                            $params['download_url'] = '/export?' . $queryParams;
                        }
                        if (empty($params['filename'])) {
                            $params['filename'] = 'export_' . $exportType . '_' . date('Ymd_His') . '.csv';
                        }
                    }

                    // Smart Contact Disambiguation if proposal references a contact by name/query without exact contact_id
                    $contactLookup = trim((string)($params['contact_query'] ?? ($params['contact_name'] ?? ($params['customer_name'] ?? ''))));
                    if (empty($params['contact_id']) && $contactLookup !== '' && in_array($actionType, ['task', 'deposit', 'crm_Stage', 'crm_stage', 'note', 'schedule'], true)) {
                        $cRes = self::resolveContactWithDisambiguation($db, $tid, $auth, $contactLookup, 0, "lập thẻ đề xuất ({$title})", true);
                        if ($cRes['status'] === 'ambiguous') {
                            return $cRes['disambiguation_payload'];
                        } elseif ($cRes['status'] === 'resolved') {
                            $params['contact_id'] = (int)$cRes['contact']['id'];
                            $params['contact_name'] = $cRes['contact']['full_name'];
                        }
                    }

                    if ($actionType === 'task') {
                        // Creator is ALWAYS the current chatting user
                        $params['created_by'] = $uid;
                        $params['created_by_id'] = $uid;
                        $params['created_by_name'] = $auth['full_name'] ?? ($auth['user_full_name'] ?? '');

                        // Smart assignee lookup with Disambiguation
                        $targetAssignee = trim($params['assignee_name'] ?? ($params['assignee'] ?? ($params['user_name'] ?? '')));
                        if (empty($params['user_id']) && !empty($targetAssignee)) {
                            $uParams = [$tid];
                            $uFuzzy = self::buildVietnameseFuzzyNameWhere('full_name', $targetAssignee, $uParams);
                            $uParams[] = '%' . $targetAssignee . '%';
                            $stmtU = $db->prepare("
                                SELECT id, full_name, email, role, job_title, department 
                                FROM users 
                                WHERE tenant_id = ? 
                                  AND ({$uFuzzy} OR username LIKE ?) 
                                  AND status != 'inactive' 
                                  AND deleted_at IS NULL
                                LIMIT 6
                            ");
                            $stmtU->execute($uParams);
                            $matchedStaff = $stmtU->fetchAll(PDO::FETCH_ASSOC) ?: [];
                            if (count($matchedStaff) > 1) {
                                foreach ($matchedStaff as &$msItem) {
                                    $msItem['_fuzzy_score'] = self::scoreFuzzyNameMatch((string)($msItem['full_name'] ?? ''), $targetAssignee);
                                }
                                unset($msItem);
                                usort($matchedStaff, fn($a, $b) => ($b['_fuzzy_score'] <=> $a['_fuzzy_score']) ?: ((int)$a['id'] <=> (int)$b['id']));
                                $exactStaffMatches = array_values(array_filter($matchedStaff, fn($ms) => ($ms['_fuzzy_score'] ?? 0) >= 95));
                                if (count($exactStaffMatches) === 1) {
                                    $matchedStaff = [$exactStaffMatches[0]];
                                }
                            }
                            if (count($matchedStaff) === 1) {
                                $params['user_id'] = (int)$matchedStaff[0]['id'];
                                $params['assignee_name'] = $matchedStaff[0]['full_name'];
                            } elseif (count($matchedStaff) > 1) {
                                $clarifyOpts = [];
                                $nbaOpts = [];
                                $candidates = [];
                                foreach ($matchedStaff as $s) {
                                    $sid = (int)$s['id'];
                                    $sName = $s['full_name'];
                                    $sTitle = !empty($s['job_title']) ? $s['job_title'] : ($s['role'] ?? 'Nhân sự');
                                    $sDept = !empty($s['department']) ? $s['department'] : 'Phòng ban';
                                    $candidates[] = [
                                        'id' => $sid,
                                        'name' => $sName,
                                        'role' => $s['role'] ?? '',
                                        'title' => $sTitle,
                                        'department' => $sDept,
                                        'smart_card' => self::buildEntitySmartCard('staff', [
                                            'id' => $sid,
                                            'name' => $sName,
                                            'subtitle' => "{$sTitle} • {$sDept}",
                                            'status' => 'Đang làm việc',
                                            'meta' => $s['email'] ?? '',
                                            'link' => "/hrm?user_id={$sid}"
                                        ])
                                    ];
                                    $clarifyOpts[] = [
                                        'label' => "{$sName} ({$sTitle} - {$sDept})",
                                        'prompt' => "Giao công việc '{$title}' cho {$sName} (user_id: {$sid})"
                                    ];
                                    $nbaOpts[] = [
                                        'label' => "Giao cho {$sName} (#{$sid})",
                                        'prompt' => "Tạo công việc '{$title}' giao cho {$sName} (user_id: {$sid})"
                                    ];
                                }
                                $clarifyJson = json_encode($clarifyOpts, JSON_UNESCAPED_UNICODE);
                                $nbaJson = json_encode(array_slice($nbaOpts, 0, 4), JSON_UNESCAPED_UNICODE);
                                return [
                                    'success' => false,
                                    'status' => 'requires_disambiguation',
                                    'requires_disambiguation' => true,
                                    'ambiguous_query' => $targetAssignee,
                                    'candidate_count' => count($candidates),
                                    'candidates' => $candidates,
                                    'message' => "Có " . count($candidates) . " nhân sự trùng tên '{$targetAssignee}'. Vui lòng chọn chính xác người nhận việc trước khi khởi tạo phiếu.",
                                    'ai_rendering_directive' => "PHÁT HIỆN NHIỀU NHÂN SỰ TRÙNG TÊN '{$targetAssignee}': Tuyệt đối KHÔNG xuất thẻ <<<ACTION_PROPOSAL>>> lúc này. Hãy hiển thị danh sách nhân sự bên dưới (kèm Smart Card) để người dùng chọn chính xác người nhận việc, và BẮT BUỘC giữ nguyên khối <<<CLARIFY_OPTIONS: {$clarifyJson}>>> cùng <<<NEXT_BEST_ACTIONS: {$nbaJson}>>> ở cuối câu trả lời.",
                                    'clarify_options_block' => "<<<CLARIFY_OPTIONS: {$clarifyJson}>>>",
                                    'next_best_actions_block' => "<<<NEXT_BEST_ACTIONS: {$nbaJson}>>>"
                                ];
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
                            'done', 100, 'contact', ?, ?,
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
                            'done', 100, 'contact', ?, ?,
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

                    // 2. Fetch Staff Roster (Excluding bot accounts and filtering inactive)
                    $whereClauses = ["u.tenant_id = ?", "u.role NOT IN ('bot', 'system')"];
                    $params = [$tid];

                    // Status filter
                    if ($requestedStatus === 'active') {
                        $whereClauses[] = "(u.is_active = 1 OR u.is_active IS NULL) AND (u.status = 'active' OR u.status IS NULL)";
                    } elseif ($requestedStatus === 'inactive_resigned') {
                        $whereClauses[] = "(u.is_active = 0 OR u.status IN ('inactive', 'leave', 'resigned'))";
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
                                    leader.full_name as leader_name,
                                    (SELECT MAX(check_in_date) FROM check_ins WHERE user_id = u.id) as last_checkin,
                                    (SELECT COUNT(1) FROM check_ins WHERE user_id = u.id) as total_checkins,
                                    (SELECT COUNT(1) FROM activities a WHERE a.user_id = u.id AND a.deleted_at IS NULL) as total_activities
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

                    // Group by department & evaluate real active vs dormant/inactive
                    $groupedByDept = [];
                    $totalTrulyActive = 0;
                    $totalDormantInactive = 0;

                    foreach ($allUsers as $u) {
                        $dName = $u['department'];
                        if (!isset($groupedByDept[$dName])) {
                            $groupedByDept[$dName] = [
                                'department' => $dName,
                                'leader' => $u['leader_name'] ?: ($deptLeaders[$dName]['leader_name'] ?? 'Chưa chỉ định'),
                                'member_count' => 0,
                                'active_working_count' => 0,
                                'dormant_inactive_count' => 0,
                                'members' => []
                            ];
                        }

                        $isLeadership = in_array(strtolower($u['role'] ?? ''), ['admin', 'superadmin', 'director'], true);
                        $isResigned = ((int)$u['is_active'] === 0 || in_array($u['status'], ['inactive', 'leave', 'resigned'], true));
                        $isDormant = (!$isLeadership && !$isResigned && ((int)$u['total_checkins'] === 0 && (int)$u['total_activities'] === 0));
                        $isNoRecentCheckin = (!$isLeadership && !$isResigned && !$isDormant && (!empty($u['last_checkin']) && strtotime($u['last_checkin']) < strtotime('-30 days')));

                        if ($isResigned) {
                            $memberStatus = 'Đã thôi việc / Inactive';
                            $totalDormantInactive++;
                            $groupedByDept[$dName]['dormant_inactive_count']++;
                        } elseif ($isDormant) {
                            $memberStatus = 'Tài khoản không hoạt động (0 chấm công)';
                            $totalDormantInactive++;
                            $groupedByDept[$dName]['dormant_inactive_count']++;
                        } elseif ($isNoRecentCheckin) {
                            $memberStatus = 'Vắng mặt dài hạn (>30 ngày không quẹt thẻ)';
                            $totalDormantInactive++;
                            $groupedByDept[$dName]['dormant_inactive_count']++;
                        } else {
                            $memberStatus = 'Đang làm việc';
                            $totalTrulyActive++;
                            $groupedByDept[$dName]['active_working_count']++;
                        }

                        $groupedByDept[$dName]['member_count']++;
                        $groupedByDept[$dName]['members'][] = [
                            'id' => (int)$u['id'],
                            'name' => $u['full_name'],
                            'job_title' => $u['job_title'] ?: $u['role'],
                            'role' => $u['role'],
                            'status' => $memberStatus,
                            'is_dormant_or_inactive' => ($memberStatus !== 'Đang làm việc'),
                            'last_checkin' => $u['last_checkin'] ? date('d/m/Y', strtotime($u['last_checkin'])) : 'Chưa từng quẹt thẻ',
                            'email' => $u['email'],
                            'phone' => $u['phone']
                        ];
                    }

                    return [
                        'success' => true,
                        'total_company_active_staff' => $totalTrulyActive,
                        'total_dormant_or_inactive_staff' => $totalDormantInactive,
                        'department_count' => count($groupedByDept),
                        'filter_applied' => [
                            'department' => $deptFilter ?: 'Tất cả phòng ban',
                            'status' => $requestedStatus,
                            'search' => $searchName ?: null
                        ],
                        'departments' => array_values($groupedByDept),
                        'instruction' => 'BẮT BUỘC nhận biết và chỉ ra rõ các nhân sự không hoạt động / chưa từng quẹt thẻ / nghi ngờ đã nghỉ việc. TUYỆT ĐỐI KHÔNG liệt kê tài khoản Bot SI IDEAS vào danh sách nhân sự. Không gộp nhân sự inactive vào tổng số nhân sự đang làm việc thực tế.'
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

                    $cRes = self::resolveContactWithDisambiguation($db, $tid, $auth, $cQuery, $contactId, "chuyển giai đoạn Pipeline sang '{$targetStageInput}'", false);
                    if ($cRes['status'] === 'ambiguous') {
                        return $cRes['disambiguation_payload'];
                    }
                    if ($cRes['status'] !== 'resolved') {
                        return $cRes['error_payload'];
                    }
                    $currContact = $cRes['contact'];
                    $contactId = (int)$currContact['id'];

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

                    $cRes = self::resolveContactWithDisambiguation($db, $tid, $auth, $cQuery, $contactId, 'lưu ghi chú tư vấn', false);
                    if ($cRes['status'] === 'ambiguous') {
                        return $cRes['disambiguation_payload'];
                    }
                    if ($cRes['status'] !== 'resolved') {
                        return $cRes['error_payload'];
                    }
                    $contact = $cRes['contact'];
                    $contactId = (int)$contact['id'];

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

                    $cRes = self::resolveContactWithDisambiguation($db, $tid, $auth, $cQuery, $contactId, 'đính kèm tài liệu hồ sơ', true);
                    if ($cRes['status'] === 'ambiguous') {
                        return $cRes['disambiguation_payload'];
                    }
                    if ($cRes['status'] !== 'resolved') {
                        return $cRes['error_payload'];
                    }
                    $contact = $cRes['contact'];
                    $contactId = (int)$contact['id'];

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

                        // If still empty, check $auth['metadata'] or $auth['attached_file']
                        if (empty($filesToAttach) && !empty($auth['metadata'])) {
                            if (!empty($auth['metadata']['attachments']) && is_array($auth['metadata']['attachments'])) {
                                foreach ($auth['metadata']['attachments'] as $att) {
                                    $u = $att['url'] ?? ($att['file_url'] ?? '');
                                    if ($u) {
                                        $filesToAttach[] = [
                                            'url' => $u,
                                            'name' => $att['name'] ?? ($att['file_name'] ?? basename($u)),
                                            'size' => (int)($att['size'] ?? ($att['file_size'] ?? 0)),
                                            'mime' => $att['mime_type'] ?? ($att['type'] ?? '')
                                        ];
                                    }
                                }
                            } elseif (!empty($auth['metadata']['url'])) {
                                $filesToAttach[] = [
                                    'url' => $auth['metadata']['url'],
                                    'name' => $auth['metadata']['file_name'] ?? basename($auth['metadata']['url']),
                                    'size' => (int)($auth['metadata']['file_size'] ?? 0),
                                    'mime' => $auth['metadata']['mime_type'] ?? ''
                                ];
                            }
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

                    $cRes = self::resolveContactWithDisambiguation($db, $tid, $auth, $cQuery, $contactId, 'cập nhật thông tin hồ sơ', false);
                    if ($cRes['status'] === 'ambiguous') {
                        return $cRes['disambiguation_payload'];
                    }
                    if ($cRes['status'] !== 'resolved') {
                        return $cRes['error_payload'];
                    }
                    $curr = $cRes['contact'];
                    $contactId = (int)$curr['id'];

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

                    $cRes = self::resolveContactWithDisambiguation($db, $tid, $auth, $cQuery, $contactId, "thẩm định hồ sơ pháp lý ({$programCode})", true);
                    if ($cRes['status'] === 'ambiguous') {
                        return $cRes['disambiguation_payload'];
                    }
                    if ($cRes['status'] !== 'resolved') {
                        return $cRes['error_payload'];
                    }
                    $contact = $cRes['contact'];
                    $contactId = (int)$contact['id'];

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
                        ? "[ĐỦ ĐIỀU KIỆN NHẬP HỌC] (Đã nộp đầy đủ {$completedCount}/{$totalRequired} hồ sơ)"
                        : "[CHƯA ĐỦ ĐIỀU KIỆN] (Đã nộp {$completedCount}/{$totalRequired} - Còn thiếu: " . implode(', ', $missingItems) . ")";

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

                    // Zero-Trust RBAC: Accessible to Admin, Director, Manager, Sales, Marketing, Sale Admin, Academic
                    $canViewMarketing = ($canViewAllLeads || $canViewTeamLeads || $isSale || $isMarketing);
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
                    $startDate = sprintf('%04d-%02d-01', $year, $month);
                    $endDate = date('Y-m-t', strtotime($startDate));

                    // 1. Total revenue collected from Sales Orders in month (sales_orders has total, paid_amount, order_date, created_at, tenant_id)
                    $soStmt = $db->prepare("
                        SELECT 
                            COALESCE(SUM(total), 0) as total_revenue,
                            COALESCE(SUM(paid_amount), 0) as total_collected,
                            COALESCE(SUM(GREATEST(0, total - COALESCE(paid_amount, 0))), 0) as total_receivable,
                            COUNT(id) as total_so_count
                        FROM sales_orders 
                        WHERE tenant_id = ? AND status != 'cancelled'
                          AND COALESCE(order_date, DATE(created_at)) BETWEEN ? AND ?
                    ");
                    $soStmt->execute([$tid, $startDate, $endDate]);
                    $soData = $soStmt->fetch(PDO::FETCH_ASSOC) ?: [];
                    $revenuePaid = (float)($soData['total_collected'] ?? 0);
                    $revenueContracted = (float)($soData['total_revenue'] ?? 0);
                    $soCount = (int)($soData['total_so_count'] ?? 0);

                    // 2. Total expenses approved / paid in month (expenses has date, created_at, amount)
                    $expStmt = $db->prepare("
                        SELECT 
                            COALESCE(SUM(amount), 0) as total_expense_disbursed,
                            COUNT(id) as total_expense_count
                        FROM expenses 
                        WHERE tenant_id = ? AND deleted_at IS NULL 
                          AND status IN ('approved', 'paid')
                          AND COALESCE(date, DATE(created_at)) BETWEEN ? AND ?
                    ");
                    $expStmt->execute([$tid, $startDate, $endDate]);
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
                        'health_assessment' => $netCashflow >= 0 ? '[TÍCH CỰC] Dòng tiền ròng dương - Sức khỏe tài chính tốt' : '[CẦN LƯU Ý] Dòng tiền ròng âm trong kỳ - Cần thúc đẩy thu hồi công nợ các đợt cọc'
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
                        'system_status' => 'Hoạt động bình thường (All Systems Operational)',
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

                    // 1. Resolve Contact with Smart Disambiguation & RBAC
                    $cRes = self::resolveContactWithDisambiguation($db, $tid, $auth, $cQuery, $contactId, 'tra cứu hồ sơ 360 độ', true);
                    if ($cRes['status'] === 'ambiguous') {
                        return $cRes['disambiguation_payload'];
                    }
                    if ($cRes['status'] !== 'resolved') {
                        return $cRes['error_payload'];
                    }
                    $contact = $cRes['contact'];
                    $contact['company_name'] = $contact['company'] ?? ($contact['company_name'] ?? '');
                    $contactId = (int)$contact['id'];

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

                    // Parse dynamic notes_limit (default 3, min 1, max 50)
                    $notesLimit = isset($args['notes_limit']) ? (int)$args['notes_limit'] : 3;
                    if ($notesLimit <= 0) $notesLimit = 3;
                    if ($notesLimit > 50) $notesLimit = 50;

                    // Sort chronologically descending
                    usort($timelineItems, fn($a, $b) => $b['timestamp'] <=> $a['timestamp']);
                    $totalAvailableNotes = count($timelineItems);
                    $notesTimeline = array_map(fn($item) => $item['text'], array_slice($timelineItems, 0, $notesLimit));

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
                        ? "[ĐẠT CHUẨN] Đã nộp đủ {$completedCount}/{$totalRequired} giấy tờ bắt buộc theo chuẩn tuyển sinh quốc tế ({$programCode}). Sẵn sàng cấp Letter of Acceptance."
                        : "[CHƯA ĐỦ HỒ SƠ] (Thiếu " . count($missingItems) . " giấy tờ): Đã nộp {$completedCount}/{$totalRequired}. Còn thiếu bắt buộc: " . implode(', ', $missingItems) . ".";

                    // 6. Financial Deposits (Cọc & Học phí)
                    $dStmt = $db->prepare("
                        SELECT id, unit_code, price as amount, status, created_at
                        FROM deposits
                        WHERE contact_id = ? AND status != 'cancelled'
                        ORDER BY id DESC LIMIT 5
                    ");
                    $dStmt->execute([$contactId]);
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
                            'campaign' => (!empty($contact['utm_campaign']) ? $contact['utm_campaign'] : (!empty($contact['utm_source']) ? $contact['utm_source'] : 'Không có')),
                            'last_contact' => $lastContactFormatted
                        ],
                        'care_team' => [
                            'owner_name' => $contact['owner_name'] ?: 'Chưa phân bổ',
                            'branch' => $contact['branch_name'] ?: 'Hội sở chính',
                            'collaborators' => !empty($collaboratorNames) ? implode(', ', $collaboratorNames) : 'Không có'
                        ],
                        'notes_history' => [
                            'total_notes_in_system' => $totalAvailableNotes,
                            'displayed_count' => count($notesTimeline),
                            'notes_limit_applied' => $notesLimit,
                            'latest_notes' => $notesTimeline,
                            'guidance_for_ai' => 'BẮT BUỘC liệt kê đầy đủ tất cả ' . count($notesTimeline) . ' tương tác gần nhất trên (dưới dạng Bảng Markdown hoặc danh sách có ngày giờ chi tiết). Nếu người dùng muốn xem thêm (5, 10 hoặc tất cả), gọi lại tool với notes_limit tương ứng.'
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

                    // 2b. Query Approved Revenue & Deposits for this consultant
                    $revTargetUid = ($filterAssigned > 0) ? $filterAssigned : $uid;
                    $revSql = "SELECT 
                                    COUNT(d.id) as approved_deposits_count,
                                    COALESCE(SUM(d.price), 0) as approved_revenue
                               FROM deposits d
                               LEFT JOIN contacts c ON d.contact_id = c.id
                               WHERE d.status = 'approved' AND (c.owner_id = ? OR d.created_by = ?)";
                    $revStmt = $db->prepare($revSql);
                    $revStmt->execute([$revTargetUid, $revTargetUid]);
                    $revData = $revStmt->fetch(PDO::FETCH_ASSOC) ?: ['approved_deposits_count' => 0, 'approved_revenue' => 0];
                    $approvedRevenue = (float)($revData['approved_revenue'] ?? 0);
                    $approvedDepositsCount = (int)($revData['approved_deposits_count'] ?? 0);

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
                            'approved_deposits_count' => $approvedDepositsCount,
                            'approved_revenue_total' => number_format($approvedRevenue, 0, ',', '.') . ' VND',
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
                        $lWhere = "u_c.tenant_id = ? AND l.status = 'pending'";
                        $lParams = [$tid];

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
                            JOIN users u_c ON l.user_id = u_c.id
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
                                (SELECT COUNT(1) FROM contacts c WHERE c.owner_id = u.id AND c.tenant_id = ? AND c.deleted_at IS NULL AND c.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as leads_month,
                                (SELECT COUNT(1) FROM contacts c WHERE c.owner_id = u.id AND c.tenant_id = ? AND c.deleted_at IS NULL AND DATE(c.created_at) = CURDATE()) as leads_today
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

                    $where = "(c.tenant_id = ? OR p.tenant_id = ? OR u.tenant_id = ?) AND (c.id IS NULL OR c.deleted_at IS NULL)";
                    $params = [$tid, $tid, $tid];

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
                        $where .= " AND (c.full_name LIKE ? OR c.phone LIKE ? OR d.unit_code LIKE ? OR p.name LIKE ? OR CAST(d.id AS CHAR) LIKE ? OR IFNULL(d.notes, '') LIKE ?)";
                        $kw = '%' . $keyword . '%';
                        $params = array_merge($params, [$kw, $kw, $kw, $kw, $kw, $kw]);
                    }

                    // Zero-Trust RBAC: GlobalAdmin/Accountant see all in tenant; Manager sees own + team; others see own/collaborated
                    if (!$isGlobalAdmin && !$isAccountant) {
                        if ($isManager) {
                            $where .= " AND (d.created_by = ? OR c.owner_id = ? OR FIND_IN_SET(?, IFNULL(c.collaborator_ids, '')) OR d.created_by IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ? OR FIND_IN_SET(?, COALESCE(co_leader_ids, '')))) OR c.owner_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ? OR FIND_IN_SET(?, COALESCE(co_leader_ids, '')))))";
                            $params = array_merge($params, [$uid, $uid, (string)$uid, $uid, (string)$uid, $uid, (string)$uid]);
                        } else {
                            $where .= " AND (d.created_by = ? OR c.owner_id = ? OR FIND_IN_SET(?, IFNULL(c.collaborator_ids, '')))";
                            $params = array_merge($params, [$uid, $uid, (string)$uid]);
                        }
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
                                $clarifyOpts = [];
                                $nbaOpts = [];
                                foreach ($cRes['multiple'] as $m) {
                                    $mid = (int)$m['id'];
                                    $mName = $m['full_name'];
                                    $mPhone = $m['phone'] ?: 'Chưa có SĐT';
                                    $clarifyOpts[] = [
                                        'label' => "{$mName} (#{$mid} - {$mPhone})",
                                        'prompt' => "Bù {$compCount} data cho chuyên viên {$mName} (consultant_id: {$mid})"
                                    ];
                                    $nbaOpts[] = [
                                        'label' => "Bù cho {$mName} (#{$mid})",
                                        'prompt' => "Bù {$compCount} data cho chuyên viên {$mName} (consultant_id: {$mid})"
                                    ];
                                }
                                $clarifyJson = json_encode($clarifyOpts, JSON_UNESCAPED_UNICODE);
                                $nbaJson = json_encode(array_slice($nbaOpts, 0, 4), JSON_UNESCAPED_UNICODE);
                                return [
                                    'success' => false,
                                    'status' => 'requires_disambiguation',
                                    'requires_disambiguation' => true,
                                    'ambiguous_query' => $consultantNameKw,
                                    'candidates' => $cRes['multiple'],
                                    'message' => "Tìm thấy " . count($cRes['multiple']) . " chuyên viên khớp với tên '{$consultantNameKw}'. Vui lòng chọn chính xác nhân sự cần bù data.",
                                    'ai_rendering_directive' => "PHÁT HIỆN NHIỀU NHÂN SỰ TRÙNG TÊN '{$consultantNameKw}': Hãy hỏi lại người dùng muốn bù data cho ai và BẮT BUỘC giữ nguyên khối <<<CLARIFY_OPTIONS: {$clarifyJson}>>> cùng <<<NEXT_BEST_ACTIONS: {$nbaJson}>>> ở cuối câu trả lời.",
                                    'clarify_options_block' => "<<<CLARIFY_OPTIONS: {$clarifyJson}>>>",
                                    'next_best_actions_block' => "<<<NEXT_BEST_ACTIONS: {$nbaJson}>>>"
                                ];
                            }
                            $consultant = $cRes['exact'];
                            $targetConsultantId = (int)$consultant['id'];

                            // 2. Resolve Round
                            $rRes = $resolveRound();
                            $targetRound = null;
                            $buildRoundDisambiguation = function(array $roundList, string $actionText, string $promptPrefix) {
                                $clarifyOpts = [];
                                $nbaOpts = [];
                                foreach ($roundList as $rItem) {
                                    $rid = (int)$rItem['id'];
                                    $rName = $rItem['round_name'];
                                    $clarifyOpts[] = [
                                        'label' => "Vòng #{$rid}: {$rName}",
                                        'prompt' => "{$promptPrefix} tại vòng {$rName} (round_id: {$rid})"
                                    ];
                                    $nbaOpts[] = [
                                        'label' => "Chọn {$rName} (#{$rid})",
                                        'prompt' => "{$promptPrefix} tại vòng {$rName} (round_id: {$rid})"
                                    ];
                                }
                                $clarifyJson = json_encode($clarifyOpts, JSON_UNESCAPED_UNICODE);
                                $nbaJson = json_encode(array_slice($nbaOpts, 0, 4), JSON_UNESCAPED_UNICODE);
                                return [
                                    'success' => false,
                                    'status' => 'requires_disambiguation',
                                    'requires_disambiguation' => true,
                                    'candidates' => $roundList,
                                    'message' => "Có " . count($roundList) . " vòng phân bổ phù hợp để {$actionText}. Vui lòng chọn chính xác vòng phân bổ.",
                                    'ai_rendering_directive' => "PHÁT HIỆN NHIỀU VÒNG PHÂN BỔ LEAD: Tuyệt đối KHÔNG tự ý chọn đại vòng. Hãy liệt kê các vòng bên dưới để người dùng chọn và BẮT BUỘC giữ nguyên khối <<<CLARIFY_OPTIONS: {$clarifyJson}>>> cùng <<<NEXT_BEST_ACTIONS: {$nbaJson}>>> ở cuối câu trả lời.",
                                    'clarify_options_block' => "<<<CLARIFY_OPTIONS: {$clarifyJson}>>>",
                                    'next_best_actions_block' => "<<<NEXT_BEST_ACTIONS: {$nbaJson}>>>"
                                ];
                            };

                            if ($rRes && isset($rRes['exact'])) {
                                $targetRound = $rRes['exact'];
                            } elseif ($rRes && isset($rRes['multiple'])) {
                                return $buildRoundDisambiguation($rRes['multiple'], "bù {$compCount} data cho {$consultant['full_name']}", "Bù {$compCount} data cho {$consultant['full_name']} (consultant_id: {$targetConsultantId})");
                            } else {
                                // Find rounds this consultant is currently in
                                $rcStmt = $db->prepare("
                                    SELECT dr.id, dr.round_name, dr.is_active
                                    FROM round_consultants rc
                                    JOIN distribution_rounds dr ON rc.round_id = dr.id
                                    WHERE rc.consultant_id = ? AND dr.tenant_id = ? AND dr.is_active = 1
                                    LIMIT 6
                                ");
                                $rcStmt->execute([$targetConsultantId, $tid]);
                                $assignedRounds = $rcStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                                if (count($assignedRounds) === 1) {
                                    $targetRound = $assignedRounds[0];
                                } elseif (count($assignedRounds) > 1) {
                                    return $buildRoundDisambiguation($assignedRounds, "bù {$compCount} data cho {$consultant['full_name']}", "Bù {$compCount} data cho {$consultant['full_name']} (consultant_id: {$targetConsultantId})");
                                } else {
                                    // Check active rounds in system
                                    $defStmt = $db->prepare("SELECT id, round_name, is_active FROM distribution_rounds WHERE tenant_id = ? AND is_active = 1 ORDER BY id ASC LIMIT 6");
                                    $defStmt->execute([$tid]);
                                    $activeRounds = $defStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                                    if (count($activeRounds) === 1) {
                                        $targetRound = $activeRounds[0];
                                    } elseif (count($activeRounds) > 1) {
                                        return $buildRoundDisambiguation($activeRounds, "bù {$compCount} data cho {$consultant['full_name']}", "Bù {$compCount} data cho {$consultant['full_name']} (consultant_id: {$targetConsultantId})");
                                    } else {
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

                            // 1. Resolve Target Round with Smart Disambiguation
                            $rRes = $resolveRound();
                            $targetRound = null;
                            $distCandidateRounds = [];
                            if ($rRes && isset($rRes['exact'])) {
                                $targetRound = $rRes['exact'];
                            } elseif ($rRes && isset($rRes['multiple'])) {
                                $distCandidateRounds = $rRes['multiple'];
                            } else {
                                $defStmt = $db->prepare("
                                    SELECT dr.id, dr.round_name, dr.is_active, dr.last_assigned_consultant_id,
                                           (SELECT COUNT(1) FROM distribution_logs dl WHERE dl.round_id = dr.id AND DATE(dl.received_at) = CURDATE()) as leads_today
                                    FROM distribution_rounds dr
                                    WHERE dr.tenant_id = ? AND dr.is_active = 1
                                    ORDER BY leads_today ASC, dr.id ASC LIMIT 6
                                ");
                                $defStmt->execute([$tid]);
                                $activeRounds = $defStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                                if (count($activeRounds) === 1) {
                                    $targetRound = $activeRounds[0];
                                } elseif (count($activeRounds) > 1) {
                                    $distCandidateRounds = $activeRounds;
                                } else {
                                    return [
                                        'success' => false,
                                        'error' => "Không tìm thấy vòng phân bổ lead nào đang hoạt động trong hệ thống."
                                    ];
                                }
                            }

                            if (!$targetRound && !empty($distCandidateRounds)) {
                                $clarifyOpts = [];
                                $nbaOpts = [];
                                $leadLabel = !empty($leadName) ? "{$leadName} ({$leadPhone})" : $leadPhone;
                                foreach ($distCandidateRounds as $rItem) {
                                    $rid = (int)$rItem['id'];
                                    $rName = $rItem['round_name'];
                                    $clarifyOpts[] = [
                                        'label' => "Vòng #{$rid}: {$rName}",
                                        'prompt' => "Phân bổ khách hàng {$leadLabel} vào vòng {$rName} (round_id: {$rid})"
                                    ];
                                    $nbaOpts[] = [
                                        'label' => "Giao vào {$rName} (#{$rid})",
                                        'prompt' => "Phân bổ khách hàng {$leadLabel} vào vòng {$rName} (round_id: {$rid})"
                                    ];
                                }
                                $clarifyJson = json_encode($clarifyOpts, JSON_UNESCAPED_UNICODE);
                                $nbaJson = json_encode(array_slice($nbaOpts, 0, 4), JSON_UNESCAPED_UNICODE);
                                return [
                                    'success' => false,
                                    'status' => 'requires_disambiguation',
                                    'requires_disambiguation' => true,
                                    'candidates' => $distCandidateRounds,
                                    'message' => "Hệ thống có " . count($distCandidateRounds) . " vòng phân bổ đang hoạt động. Vui lòng chọn chính xác vòng muốn giao khách hàng {$leadLabel}.",
                                    'ai_rendering_directive' => "PHÁT HIỆN NHIỀU VÒNG PHÂN BỔ ĐANG HOẠT ĐỘNG: Tuyệt đối KHÔNG tự ý phân bổ đại vào 1 vòng. Hãy hỏi lại người dùng muốn giao khách hàng {$leadLabel} vào vòng nào và BẮT BUỘC giữ nguyên khối <<<CLARIFY_OPTIONS: {$clarifyJson}>>> cùng <<<NEXT_BEST_ACTIONS: {$nbaJson}>>> ở cuối câu trả lời.",
                                    'clarify_options_block' => "<<<CLARIFY_OPTIONS: {$clarifyJson}>>>",
                                    'next_best_actions_block' => "<<<NEXT_BEST_ACTIONS: {$nbaJson}>>>"
                                ];
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

                            $shiftVerb = $shiftActive ? 'BẬT' : 'TẮT';
                            $cRes = $resolveConsultant();
                            if (!$cRes) {
                                return [
                                    'success' => false,
                                    'error' => "Không tìm thấy chuyên viên tư vấn phù hợp để thay đổi ca trực."
                                ];
                            }
                            if (isset($cRes['multiple'])) {
                                $clarifyOpts = [];
                                $nbaOpts = [];
                                foreach ($cRes['multiple'] as $m) {
                                    $mid = (int)$m['id'];
                                    $mName = $m['full_name'];
                                    $clarifyOpts[] = [
                                        'label' => "{$mName} (#{$mid})",
                                        'prompt' => "{$shiftVerb} ca trực cho chuyên viên {$mName} (consultant_id: {$mid})"
                                    ];
                                    $nbaOpts[] = [
                                        'label' => "{$shiftVerb} ca {$mName} (#{$mid})",
                                        'prompt' => "{$shiftVerb} ca trực cho chuyên viên {$mName} (consultant_id: {$mid})"
                                    ];
                                }
                                $clarifyJson = json_encode($clarifyOpts, JSON_UNESCAPED_UNICODE);
                                $nbaJson = json_encode(array_slice($nbaOpts, 0, 4), JSON_UNESCAPED_UNICODE);
                                return [
                                    'success' => false,
                                    'status' => 'requires_disambiguation',
                                    'requires_disambiguation' => true,
                                    'candidates' => $cRes['multiple'],
                                    'message' => "Tìm thấy nhiều chuyên viên trùng tên '{$consultantNameKw}'. Vui lòng chọn chính xác nhân sự cần {$shiftVerb} ca trực.",
                                    'ai_rendering_directive' => "PHÁT HIỆN NHIỀU NHÂN SỰ TRÙNG TÊN: Hãy hỏi lại người dùng muốn {$shiftVerb} ca trực cho ai và BẮT BUỘC giữ nguyên khối <<<CLARIFY_OPTIONS: {$clarifyJson}>>> cùng <<<NEXT_BEST_ACTIONS: {$nbaJson}>>> ở cuối câu trả lời.",
                                    'clarify_options_block' => "<<<CLARIFY_OPTIONS: {$clarifyJson}>>>",
                                    'next_best_actions_block' => "<<<NEXT_BEST_ACTIONS: {$nbaJson}>>>"
                                ];
                            }
                            $consultant = $cRes['exact'];
                            $targetConsultantId = (int)$consultant['id'];

                            $rRes = $resolveRound();
                            $round = null;
                            $shiftCandidateRounds = [];
                            if ($rRes && isset($rRes['exact'])) {
                                $round = $rRes['exact'];
                            } elseif ($rRes && isset($rRes['multiple'])) {
                                $shiftCandidateRounds = $rRes['multiple'];
                            } else {
                                $rcStmt = $db->prepare("
                                    SELECT dr.id, dr.round_name, dr.is_active
                                    FROM round_consultants rc
                                    JOIN distribution_rounds dr ON rc.round_id = dr.id
                                    WHERE rc.consultant_id = ? AND dr.tenant_id = ?
                                    LIMIT 6
                                ");
                                $rcStmt->execute([$targetConsultantId, $tid]);
                                $assignedRounds = $rcStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                                if (count($assignedRounds) === 1) {
                                    $round = $assignedRounds[0];
                                } elseif (count($assignedRounds) > 1) {
                                    $shiftCandidateRounds = $assignedRounds;
                                } else {
                                    return [
                                        'success' => false,
                                        'error' => "Chuyên viên {$consultant['full_name']} hiện chưa được gán vào vòng phân bổ nào."
                                    ];
                                }
                            }

                            if (!$round && !empty($shiftCandidateRounds)) {
                                $clarifyOpts = [];
                                $nbaOpts = [];
                                foreach ($shiftCandidateRounds as $rItem) {
                                    $rid = (int)$rItem['id'];
                                    $rName = $rItem['round_name'];
                                    $clarifyOpts[] = [
                                        'label' => "Vòng #{$rid}: {$rName}",
                                        'prompt' => "{$shiftVerb} ca trực cho {$consultant['full_name']} (consultant_id: {$targetConsultantId}) tại vòng {$rName} (round_id: {$rid})"
                                    ];
                                    $nbaOpts[] = [
                                        'label' => "{$shiftVerb} tại {$rName} (#{$rid})",
                                        'prompt' => "{$shiftVerb} ca trực cho {$consultant['full_name']} (consultant_id: {$targetConsultantId}) tại vòng {$rName} (round_id: {$rid})"
                                    ];
                                }
                                $clarifyJson = json_encode($clarifyOpts, JSON_UNESCAPED_UNICODE);
                                $nbaJson = json_encode(array_slice($nbaOpts, 0, 4), JSON_UNESCAPED_UNICODE);
                                return [
                                    'success' => false,
                                    'status' => 'requires_disambiguation',
                                    'requires_disambiguation' => true,
                                    'candidates' => $shiftCandidateRounds,
                                    'message' => "Chuyên viên {$consultant['full_name']} đang thuộc nhiều vòng phân bổ. Vui lòng chọn vòng cần {$shiftVerb} ca trực.",
                                    'ai_rendering_directive' => "PHÁT HIỆN NHIỀU VÒNG PHÂN BỔ: Hãy hỏi người dùng muốn {$shiftVerb} ca trực cho {$consultant['full_name']} ở vòng nào và BẮT BUỘC giữ nguyên khối <<<CLARIFY_OPTIONS: {$clarifyJson}>>> cùng <<<NEXT_BEST_ACTIONS: {$nbaJson}>>> ở cuối câu trả lời.",
                                    'clarify_options_block' => "<<<CLARIFY_OPTIONS: {$clarifyJson}>>>",
                                    'next_best_actions_block' => "<<<NEXT_BEST_ACTIONS: {$nbaJson}>>>"
                                ];
                            }
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

                // ==========================================
                // 39. FILTER EXPENSES ADVANCED (ENTERPRISE FINANCE)
                // ==========================================
                case 'filter_expenses_advanced': {
                    $status = strtolower(trim((string)($args['status'] ?? 'all')));
                    $department = trim((string)($args['department'] ?? ''));
                    $createdByName = trim((string)($args['created_by_name'] ?? ($args['creator'] ?? '')));
                    $minAmount = isset($args['min_amount']) ? (float)$args['min_amount'] : null;
                    $maxAmount = isset($args['max_amount']) ? (float)$args['max_amount'] : null;
                    $deadlineStatus = strtolower(trim((string)($args['deadline_status'] ?? 'all')));
                    $limit = max(1, min(15, (int)($args['limit'] ?? 5)));

                    $where = ["e.tenant_id = ?", "e.deleted_at IS NULL"];
                    $params = [$tid];

                    // Zero-Trust RBAC: Non-admin/accountant only see expenses created by or assigned to them
                    if (!$isGlobalAdmin && !$isAccountant && !$isManager) {
                        $where[] = "(e.created_by = ? OR e.approver_id = ? OR e.approver_id_2 = ? OR e.approver_id_3 = ? OR FIND_IN_SET(?, IFNULL(e.related_user_ids, '')))";
                        $params[] = $uid;
                        $params[] = $uid;
                        $params[] = $uid;
                        $params[] = $uid;
                        $params[] = (string)$uid;
                    }

                    if ($status === 'pending') {
                        $where[] = "e.status = 'pending'";
                    } elseif ($status === 'pending_l1') {
                        $where[] = "e.status = 'pending' AND (e.status_level_1 = 'pending' OR e.status_level_1 IS NULL)";
                    } elseif ($status === 'pending_l2') {
                        $where[] = "e.status = 'pending' AND e.status_level_1 = 'approved' AND (e.status_level_2 = 'pending' OR e.status_level_2 IS NULL)";
                    } elseif ($status === 'approved') {
                        $where[] = "e.status = 'approved'";
                    } elseif ($status === 'rejected') {
                        $where[] = "e.status = 'rejected'";
                    } elseif ($status === 'paid') {
                        $where[] = "(e.status = 'paid' OR (e.status = 'approved' AND e.is_refunded = 1))";
                    } elseif ($status === 'unpaid') {
                        $where[] = "e.status = 'approved' AND (e.is_refunded = 0 OR e.is_refunded IS NULL)";
                    }

                    if (!empty($department)) {
                        $where[] = "(e.category LIKE ? OR e.title LIKE ?)";
                        $params[] = '%' . $department . '%';
                        $params[] = '%' . $department . '%';
                    }

                    if (!empty($createdByName)) {
                        $where[] = "u.full_name LIKE ?";
                        $params[] = '%' . $createdByName . '%';
                    }

                    if ($minAmount !== null && $minAmount > 0) {
                        $where[] = "e.amount >= ?";
                        $params[] = $minAmount;
                    }
                    if ($maxAmount !== null && $maxAmount > 0) {
                        $where[] = "e.amount <= ?";
                        $params[] = $maxAmount;
                    }

                    if ($deadlineStatus === 'overdue') {
                        $where[] = "e.due_date IS NOT NULL AND e.due_date < CURDATE()";
                    } elseif ($deadlineStatus === 'today') {
                        $where[] = "e.due_date IS NOT NULL AND DATE(e.due_date) = CURDATE()";
                    } elseif ($deadlineStatus === 'this_week') {
                        $where[] = "e.due_date IS NOT NULL AND YEARWEEK(e.due_date, 1) = YEARWEEK(CURDATE(), 1)";
                    }

                    $whereSql = implode(" AND ", $where);

                    // Aggregate total count and sum
                    $aggSql = "SELECT COUNT(1) as total_count, COALESCE(SUM(e.amount), 0) as total_amount FROM expenses e LEFT JOIN users u ON e.created_by = u.id WHERE {$whereSql}";
                    $aggStmt = $db->prepare($aggSql);
                    $aggStmt->execute($params);
                    $agg = $aggStmt->fetch(PDO::FETCH_ASSOC);
                    $totalCount = (int)($agg['total_count'] ?? 0);
                    $totalAmount = (float)($agg['total_amount'] ?? 0);

                    if ($totalCount === 0) {
                        return [
                            'success' => true,
                            'total_matching' => 0,
                            'total_amount' => 0,
                            'message' => 'Không tìm thấy phiếu chi/đề xuất thanh toán phù hợp với bộ lọc trong phạm vi quyền hạn.'
                        ];
                    }

                    $sql = "SELECT e.id, e.title, e.amount, e.currency, e.category, e.vendor_name, e.status, e.approval_status, e.date, e.due_date, e.created_at,
                                   u.full_name as creator_name,
                                   u2.full_name as approver_name
                            FROM expenses e
                            LEFT JOIN users u ON e.created_by = u.id
                            LEFT JOIN users u2 ON e.approver_id = u2.id
                            WHERE {$whereSql}
                            ORDER BY e.id DESC
                            LIMIT " . (int)$limit;
                    $stmt = $db->prepare($sql);
                    $stmt->execute($params);
                    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    $items = array_map(function($r) {
                        $eId = (int)$r['id'];
                        $directUrl = "https://myerp.ideas.edu.vn/finance?tab=expenses&id={$eId}";
                        $amtFormatted = number_format((float)$r['amount'], 0, ',', '.') . ' ' . ($r['currency'] ?: 'VND');
                        $smartTag = "<<<ERP_CARD:{\"entity_type\":\"po\",\"entity_id\":{$eId},\"title\":\"[PO-{$eId}] " . addslashes($r['title']) . "\",\"subtitle\":\"{$amtFormatted} • " . ($r['vendor_name'] ?: 'Nội bộ') . "\",\"status\":\"" . ($r['status'] === 'approved' ? 'completed' : 'in_progress') . "\",\"direct_url\":\"{$directUrl}\",\"action_label\":\"Mở phiếu chi\"}>>>";
                        return [
                            'id' => $eId,
                            'title' => $r['title'],
                            'amount' => (float)$r['amount'],
                            'amount_formatted' => $amtFormatted,
                            'category' => $r['category'] ?: 'Chưa phân loại',
                            'vendor' => $r['vendor_name'] ?: 'Nội bộ',
                            'creator' => $r['creator_name'] ?: 'Nhân sự',
                            'approver' => $r['approver_name'] ?: 'Chưa chỉ định',
                            'status' => $r['status'],
                            'date' => $r['date'] ? date('d/m/Y', strtotime($r['date'])) : null,
                            'due_date' => $r['due_date'] ? date('d/m/Y', strtotime($r['due_date'])) : 'Không đặt hạn chót',
                            'is_overdue' => (!empty($r['due_date']) && strtotime($r['due_date']) < strtotime('today')),
                            'direct_url' => $directUrl,
                            'open_link_markdown' => "[Bấm xem Phiếu chi #{$eId}]({$directUrl})",
                            'smart_tag' => $smartTag
                        ];
                    }, $rows);

                    $expExportParams = ['type' => 'expense'];
                    if (!empty($status) && $status !== 'all') $expExportParams['status'] = $status;
                    if (!empty($department)) $expExportParams['departments'] = $department;
                    if (!empty($createdByName)) $expExportParams['created_by_name'] = $createdByName;
                    if ($minAmount !== null && $minAmount > 0) $expExportParams['min_amount'] = $minAmount;
                    if ($maxAmount !== null && $maxAmount > 0) $expExportParams['max_amount'] = $maxAmount;
                    if ($deadlineStatus === 'overdue') $expExportParams['overdue_only'] = '1';
                    $expExportUrl = '/export?' . http_build_query($expExportParams);

                    return [
                        'success' => true,
                        'total_matching' => $totalCount,
                        'total_amount' => $totalAmount,
                        'total_amount_formatted' => number_format($totalAmount, 0, ',', '.') . ' VND',
                        'count' => count($items),
                        'expenses' => $items,
                        'export_url' => $expExportUrl,
                        'export_link_markdown' => "[Bấm vào đây để tải danh sách {$totalCount} phiếu chi (File Excel/CSV)]({$expExportUrl})",
                        'export_markdown' => "[Bấm vào đây để tải danh sách {$totalCount} phiếu chi (File Excel/CSV)]({$expExportUrl})"
                    ];
                }

                // ==========================================
                // 40. GET SALES LEADERBOARD (CRM LEADERBOARD)
                // ==========================================
                case 'get_sales_leaderboard': {
                    $period = strtolower(trim((string)($args['period'] ?? 'this_month')));
                    $fromDate = trim((string)($args['from_date'] ?? ''));
                    $toDate = trim((string)($args['to_date'] ?? ''));
                    $limit = max(1, min(20, (int)($args['top_limit'] ?? $args['limit'] ?? 10)));

                    if (!empty($fromDate) && !empty($toDate)) {
                        $from = $fromDate . ' 00:00:00';
                        $to = $toDate . ' 23:59:59';
                    } elseif ($period === 'today') {
                        $from = date('Y-m-d 00:00:00');
                        $to = date('Y-m-d 23:59:59');
                    } elseif ($period === 'yesterday') {
                        $from = date('Y-m-d 00:00:00', strtotime('-1 day'));
                        $to = date('Y-m-d 23:59:59', strtotime('-1 day'));
                    } elseif ($period === 'this_week') {
                        $from = date('Y-m-d 00:00:00', strtotime('monday this week'));
                        $to = date('Y-m-d 23:59:59', strtotime('sunday this week'));
                    } elseif ($period === 'last_month') {
                        $from = date('Y-m-01 00:00:00', strtotime('first day of last month'));
                        $to = date('Y-m-t 23:59:59', strtotime('last day of last month'));
                    } elseif ($period === 'this_quarter') {
                        $curMonth = (int)date('n');
                        $quarterStartMonth = floor(($curMonth - 1) / 3) * 3 + 1;
                        $from = date(sprintf('Y-%02d-01 00:00:00', $quarterStartMonth));
                        $to = date('Y-m-d 23:59:59');
                    } elseif ($period === 'this_year') {
                        $from = date('Y-01-01 00:00:00');
                        $to = date('Y-12-31 23:59:59');
                    } else { // this_month default
                        $from = date('Y-m-01 00:00:00');
                        $to = date('Y-m-t 23:59:59');
                    }

                    // Zero-Trust Sales RBAC: Sales rep can view the leaderboard ranking, but cannot see private data
                    $where = "u.tenant_id = ? AND u.is_active = 1 AND u.role IN ('admin','manager','sales','sale','director','superadmin','super_admin')";

                    $sql = "
                        SELECT u.id, u.full_name, u.role,
                               COUNT(DISTINCT d.id) as deal_count,
                               COALESCE(SUM(CASE WHEN ps.is_won = 1 THEN d.value ELSE 0 END), 0) as won_value,
                               COUNT(DISTINCT CASE WHEN ps.is_won = 1 THEN d.id ELSE NULL END) as won_count,
                               COALESCE((
                                   SELECT SUM(dep.price) FROM deposits dep 
                                   WHERE (dep.created_by = u.id OR EXISTS (SELECT 1 FROM contacts c_dep WHERE c_dep.id = dep.contact_id AND c_dep.owner_id = u.id))
                                     AND dep.status = 'approved' AND dep.created_at BETWEEN ? AND ?
                               ), 0) as total_deposit_collected
                        FROM users u
                        LEFT JOIN deals d ON d.owner_id = u.id AND d.deleted_at IS NULL AND d.tenant_id = ? AND d.created_at BETWEEN ? AND ?
                        LEFT JOIN pipeline_stages ps ON d.stage_id = ps.id
                        WHERE {$where}
                        GROUP BY u.id, u.full_name, u.role
                        ORDER BY won_value DESC, total_deposit_collected DESC, won_count DESC
                        LIMIT " . (int)$limit;

                    $stmt = $db->prepare($sql);
                    $stmt->execute([$from, $to, $tid, $from, $to, $tid]);
                    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    $ranked = [];
                    $rank = 1;
                    foreach ($rows as $r) {
                        $wonVal = (float)$r['won_value'];
                        $depVal = (float)$r['total_deposit_collected'];
                        $ranked[] = [
                            'rank' => $rank++,
                            'user_id' => (int)$r['id'],
                            'name' => $r['full_name'],
                            'role' => $r['role'],
                            'won_deals_count' => (int)$r['won_count'],
                            'total_deals' => (int)$r['deal_count'],
                            'won_revenue' => $wonVal,
                            'won_revenue_formatted' => number_format($wonVal, 0, ',', '.') . ' VND',
                            'deposit_collected' => $depVal,
                            'deposit_collected_formatted' => number_format($depVal, 0, ',', '.') . ' VND'
                        ];
                    }

                    return [
                        'success' => true,
                        'period' => $period,
                        'from' => substr($from, 0, 10),
                        'to' => substr($to, 0, 10),
                        'total_consultants' => count($ranked),
                        'leaderboard' => $ranked,
                        'summary' => count($ranked) > 0 ? "Top 1 hiện tại là {$ranked[0]['name']} với doanh số " . $ranked[0]['won_revenue_formatted'] . "." : "Chưa có dữ liệu doanh số trong kỳ."
                    ];
                }

                // ==========================================
                // 41. GET STAFF DIRECTORY ADVANCED (HRM ROSTER)
                // ==========================================
                case 'get_staff_directory_advanced': {
                    $bMonth = !empty($args['birthday_month']) ? (int)$args['birthday_month'] : 0;
                    $contractType = strtolower(trim((string)($args['contract_type'] ?? 'all')));
                    $department = trim((string)($args['department'] ?? ''));
                    $keyword = trim((string)($args['keyword'] ?? ''));
                    $limit = max(1, min(30, (int)($args['limit'] ?? 10)));

                    $where = ["u.tenant_id = ?", "u.role NOT IN ('bot', 'system')"];
                    $params = [$tid];

                    // Zero-Trust RBAC: Only Admin, Director, HR, or Manager can query inactive/resigned personnel
                    $canViewInactive = ($isGlobalAdmin || in_array($role, ['hr', 'director', 'manager', 'truong_phong'], true));

                    if ($contractType === 'resigned') {
                        if ($canViewInactive) {
                            $where[] = "(u.is_active = 0 OR u.status IN ('inactive', 'leave', 'resigned'))";
                        } else {
                            $where[] = "1=0"; // Restricted
                        }
                    } elseif ($contractType === 'probation') {
                        $where[] = "(u.is_active = 1 OR u.is_active IS NULL) AND (u.status = 'active' OR u.status IS NULL)";
                        $where[] = "(u.role = 'probation' OR u.job_title LIKE '%thử việc%' OR p.joined_date >= DATE_SUB(NOW(), INTERVAL 2 MONTH))";
                    } elseif ($contractType === 'official') {
                        $where[] = "(u.is_active = 1 OR u.is_active IS NULL) AND (u.status = 'active' OR u.status IS NULL)";
                        $where[] = "(u.role != 'probation' AND (u.job_title NOT LIKE '%thử việc%' OR u.job_title IS NULL))";
                    } elseif (!$canViewInactive) {
                        $where[] = "(u.is_active = 1 OR u.is_active IS NULL) AND (u.status = 'active' OR u.status IS NULL)";
                    }

                    if ($bMonth >= 1 && $bMonth <= 12) {
                        $where[] = "u.dob IS NOT NULL AND MONTH(u.dob) = ?";
                        $params[] = $bMonth;
                    }

                    if (!empty($keyword)) {
                        $where[] = "(u.full_name LIKE ? OR u.phone LIKE ? OR u.email LIKE ? OR u.username LIKE ?)";
                        $kw = '%' . $keyword . '%';
                        $params = array_merge($params, [$kw, $kw, $kw, $kw]);
                    }

                    if (!empty($department)) {
                        $where[] = "(t.name LIKE ? OR u.job_title LIKE ? OR u.department LIKE ?)";
                        $dKw = '%' . $department . '%';
                        $params = array_merge($params, [$dKw, $dKw, $dKw]);
                    }

                    $whereSql = implode(" AND ", $where);

                    $sql = "SELECT u.id, u.full_name, u.email, u.phone, u.role, u.job_title, u.dob, u.gender, u.status, u.is_active,
                                   t.name as team_name,
                                   p.joined_date,
                                   (SELECT MAX(check_in_date) FROM check_ins WHERE user_id = u.id) as last_checkin,
                                   (SELECT COUNT(1) FROM check_ins WHERE user_id = u.id) as total_checkins,
                                   (SELECT COUNT(1) FROM activities a WHERE a.user_id = u.id AND a.deleted_at IS NULL) as total_activities,
                                   COALESCE(NULLIF(TRIM(u.department), ''), NULLIF(TRIM(t.name), ''), 
                                       CASE 
                                           WHEN u.role IN ('admin', 'superadmin', 'super_admin', 'director') THEN 'Ban Giám đốc'
                                           WHEN u.role = 'hr' THEN 'Phòng Nhân sự'
                                           WHEN u.role = 'accountant' THEN 'Phòng Kế toán'
                                           WHEN u.role = 'marketing' THEN 'Phòng Marketing'
                                           WHEN u.role IN ('sales', 'sale', 'sale_admin', 'saleadmin') THEN 'Phòng Kinh doanh'
                                           ELSE 'Khác'
                                       END
                                   ) as department
                            FROM users u
                            LEFT JOIN teams t ON u.team_id = t.id
                            LEFT JOIN hrm_profiles p ON u.id = p.user_id
                            WHERE {$whereSql}
                            ORDER BY u.full_name ASC
                            LIMIT " . (int)$limit;

                    $stmt = $db->prepare($sql);
                    $stmt->execute($params);
                    $staff = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    $formatted = array_map(function($s) {
                        $isLeadership = in_array(strtolower($s['role'] ?? ''), ['admin', 'superadmin', 'director'], true);
                        $isResigned = ((int)$s['is_active'] === 0 || in_array($s['status'], ['inactive', 'leave', 'resigned'], true));
                        $isDormant = (!$isLeadership && !$isResigned && ((int)$s['total_checkins'] === 0 && (int)$s['total_activities'] === 0));
                        $isNoRecent = (!$isLeadership && !$isResigned && !$isDormant && (!empty($s['last_checkin']) && strtotime($s['last_checkin']) < strtotime('-30 days')));

                        if ($isResigned) {
                            $statusLabel = 'Đã nghỉ việc / Inactive';
                        } elseif ($isDormant) {
                            $statusLabel = 'Chưa kích hoạt / Không hoạt động';
                        } elseif ($isNoRecent) {
                            $statusLabel = 'Vắng mặt dài hạn (>30 ngày không quẹt thẻ)';
                        } else {
                            $statusLabel = 'Đang làm việc';
                        }

                        return [
                            'id' => (int)$s['id'],
                            'name' => $s['full_name'],
                            'email' => $s['email'],
                            'phone' => $s['phone'] ?: 'Chưa cập nhật',
                            'job_title' => $s['job_title'] ?: 'Nhân viên',
                            'department' => $s['department'],
                            'birthday' => $s['dob'] ? date('d/m/Y', strtotime($s['dob'])) : 'Chưa cập nhật',
                            'gender' => $s['gender'] ?: 'Chưa cập nhật',
                            'joined_date' => $s['joined_date'] ? date('d/m/Y', strtotime($s['joined_date'])) : 'Chưa cập nhật',
                            'status' => $statusLabel,
                            'is_dormant_or_inactive' => ($statusLabel !== 'Đang làm việc'),
                            'last_checkin' => $s['last_checkin'] ? date('d/m/Y', strtotime($s['last_checkin'])) : 'Chưa từng quẹt thẻ'
                        ];
                    }, $staff);

                    return [
                        'success' => true,
                        'count' => count($formatted),
                        'staff' => $formatted,
                        'summary' => count($formatted) > 0 ? "Tìm thấy " . count($formatted) . " nhân sự phù hợp (đã phân loại trạng thái hoạt động thực tế)." : "Không có nhân sự nào phù hợp với điều kiện tra cứu."
                    ];
                }

                // ==========================================
                // 42. GET ACADEMIC STUDENTS FILTER (ADMISSIONS CHECK)
                // ==========================================
                case 'get_academic_students_filter': {
                    $programCode = strtoupper(trim((string)($args['program_code'] ?? '')));
                    $studyStatus = strtolower(trim((string)($args['study_status'] ?? 'all')));
                    $missingDoc = strtolower(trim((string)($args['missing_doc'] ?? 'all')));
                    $limit = max(1, min(20, (int)($args['limit'] ?? 5)));

                    $where = ["c.tenant_id = ?", "c.deleted_at IS NULL"];
                    $params = [$tid];

                    // Zero-Trust Contact RBAC: If not admin/manager/academic, restrict to assigned contacts
                    if (!$canAccessAllContacts && !$isAcademic) {
                        $rbac = $getContactRbacClause('c');
                        $where[] = $rbac['clause'];
                        $params = array_merge($params, $rbac['params']);
                    }

                    // Enrolled or advanced stage contacts (students) - schema-verified: contacts uses status='customer', not is_customer
                    $where[] = "(c.status = 'customer' OR c.stage_id >= 10 OR c.pipeline_status IN ('enrolled', 'student', 'hoc_vien') OR c.status IN ('enrolled', 'student', 'hoc_vien') OR c.program LIKE '%EMBA%' OR c.program LIKE '%MBA%' OR c.program LIKE '%DBA%' OR c.notes LIKE '%EMBA%' OR c.notes LIKE '%MBA%' OR c.notes LIKE '%DBA%')";

                    if (!empty($programCode)) {
                        $where[] = "(c.program LIKE ? OR c.notes LIKE ? OR p.name LIKE ? OR d.title LIKE ?)";
                        $pKw = '%' . $programCode . '%';
                        $params = array_merge($params, [$pKw, $pKw, $pKw, $pKw]);
                    }

                    $whereSql = implode(" AND ", $where);

                    $sql = "SELECT c.id, c.full_name, c.phone, c.email, c.status, c.stage_id, c.notes, c.program,
                                   ps.name as stage_name,
                                   u.full_name as consultant_name
                            FROM contacts c
                            LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
                            LEFT JOIN users u ON c.owner_id = u.id
                            LEFT JOIN projects p ON c.project_id = p.id
                            LEFT JOIN deals d ON d.contact_id = c.id AND d.deleted_at IS NULL
                            WHERE {$whereSql}
                            GROUP BY c.id
                            ORDER BY c.id DESC
                            LIMIT " . (int)($limit * 3); // Overfetch slightly to evaluate document checklist

                    $stmt = $db->prepare($sql);
                    $stmt->execute($params);
                    $candidates = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    // Batch fetch cloud_files to eliminate N+1 query
                    $filesByContact = [];
                    if (!empty($candidates)) {
                        $candIds = array_values(array_unique(array_map(fn($row) => (int)$row['id'], $candidates)));
                        $inPh = implode(',', array_fill(0, count($candIds), '?'));
                        $cfStmt = $db->prepare("SELECT contact_id, name, category FROM cloud_files WHERE tenant_id = ? AND contact_id IN ($inPh)");
                        $cfStmt->execute(array_merge([$tid], $candIds));
                        foreach ($cfStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $fRow) {
                            $filesByContact[(int)$fRow['contact_id']][] = $fRow;
                        }
                    }

                    $results = [];
                    foreach ($candidates as $c) {
                        $cId = (int)$c['id'];
                        $files = $filesByContact[$cId] ?? [];

                        $hasId = false;
                        $hasDegree = false;
                        $hasTranslation = false;
                        $hasContract = false;

                        foreach ($files as $f) {
                            $nm = mb_strtolower($f['name'] ?? '');
                            $cat = mb_strtolower($f['category'] ?? '');
                            if (str_contains($nm, 'cccd') || str_contains($nm, 'passport') || str_contains($cat, 'cccd') || str_contains($cat, 'hộ chiếu')) $hasId = true;
                            if (str_contains($nm, 'bang') || str_contains($nm, 'diploma') || str_contains($nm, 'degree') || str_contains($cat, 'bằng')) $hasDegree = true;
                            if (str_contains($nm, 'dich') || str_contains($nm, 'translation') || str_contains($cat, 'dịch')) $hasTranslation = true;
                            if (str_contains($nm, 'hop_dong') || str_contains($nm, 'contract') || str_contains($cat, 'hợp đồng')) $hasContract = true;
                        }

                        // Filter by missingDoc if specified
                        if ($missingDoc === 'id_card' && $hasId) continue;
                        if ($missingDoc === 'degree' && $hasDegree) continue;
                        if ($missingDoc === 'translation' && $hasTranslation) continue;
                        if ($missingDoc === 'contract' && $hasContract) continue;

                        $missingList = [];
                        if (!$hasId) $missingList[] = 'CCCD / Hộ chiếu';
                        if (!$hasDegree) $missingList[] = 'Bằng ĐH';
                        if (!$hasTranslation) $missingList[] = 'Bản dịch công chứng';
                        if (!$hasContract) $missingList[] = 'Hợp đồng đào tạo';

                        $directUrl = "https://myerp.ideas.edu.vn/contacts?id={$cId}";
                        $smartTag = "<<<ERP_CARD:{\"entity_type\":\"contact\",\"entity_id\":{$cId},\"title\":\"" . addslashes($c['full_name']) . "\",\"subtitle\":\"" . ($c['phone'] ?: '') . " • " . (empty($missingList) ? 'Đủ hồ sơ' : 'Thiếu ' . count($missingList) . ' mục') . "\",\"status\":\"" . (empty($missingList) ? 'completed' : 'in_progress') . "\",\"direct_url\":\"{$directUrl}\",\"action_label\":\"Mở hồ sơ học viên\"}>>>";

                        $results[] = [
                            'id' => $cId,
                            'name' => $c['full_name'],
                            'phone' => $c['phone'],
                            'email' => $c['email'],
                            'stage' => $c['stage_name'] ?: ($c['status'] ?: 'Đang học'),
                            'consultant' => $c['consultant_name'] ?: 'Chưa phân công',
                            'admission_ready' => empty($missingList),
                            'missing_documents' => $missingList,
                            'direct_url' => $directUrl,
                            'smart_tag' => $smartTag
                        ];

                        if (count($results) >= $limit) break;
                    }

                    $studentExportParams = ['type' => 'contact', 'segment' => 'customer'];
                    if (!empty($programCode)) $studentExportParams['program'] = $programCode;
                    $studentExportUrl = '/export?' . http_build_query($studentExportParams);

                    return [
                        'success' => true,
                        'count' => count($results),
                        'students' => $results,
                        'export_url' => $studentExportUrl,
                        'export_markdown' => "[Tải danh sách học viên (File Excel/CSV)]({$studentExportUrl})",
                        'summary' => count($results) > 0 ? "Tìm thấy " . count($results) . " học viên phù hợp." : "Không có học viên nào phù hợp với điều kiện hồ sơ tra cứu."
                    ];
                }

                // ==========================================
                // 43. GET INVENTORY HEALTH CHECK (STOCK DEFENSE)
                // ==========================================
                case 'get_inventory_health_check': {
                    $alertOnly = !empty($args['alert_only']);
                    $category = trim((string)($args['category'] ?? ''));
                    $keyword = trim((string)($args['keyword'] ?? ''));
                    $limit = max(1, min(25, (int)($args['limit'] ?? 10)));

                    $where = ["p.tenant_id = ?"];
                    $params = [$tid];

                    if (!empty($category)) {
                        $where[] = "p.category LIKE ?";
                        $params[] = '%' . $category . '%';
                    }

                    if (!empty($keyword)) {
                        $where[] = "(p.name LIKE ? OR p.sku LIKE ?)";
                        $params[] = '%' . $keyword . '%';
                        $params[] = '%' . $keyword . '%';
                    }

                    $whereSql = implode(" AND ", $where);

                    $sql = "
                        SELECT p.id, p.name, p.sku, p.category, p.unit, p.price,
                               COALESCE(SUM(CASE WHEN b.status = 'active' THEN b.current_qty ELSE 0 END), 0) as total_qty
                        FROM products p
                        LEFT JOIN batches b ON p.id = b.product_id AND b.tenant_id = ?
                        WHERE {$whereSql}
                        GROUP BY p.id, p.name, p.sku, p.category, p.unit, p.price
                    ";

                    if ($alertOnly) {
                        $sql .= " HAVING total_qty <= 10";
                    }

                    $sql .= " ORDER BY total_qty ASC, p.name ASC LIMIT " . (int)$limit;

                    $stmt = $db->prepare($sql);
                    $stmt->execute(array_merge([$tid], $params));
                    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    $items = array_map(function($r) {
                        $qty = (int)$r['total_qty'];
                        if ($qty <= 0) {
                            $health = '[HẾT HÀNG]';
                        } elseif ($qty <= 10) {
                            $health = '[CẢNH BÁO: SẮP HẾT (<= 10)]';
                        } else {
                            $health = '[AN TOÀN]';
                        }

                        return [
                            'product_id' => (int)$r['id'],
                            'name' => $r['name'],
                            'sku' => $r['sku'] ?: 'N/A',
                            'category' => $r['category'] ?: 'Vật phẩm / Quà tặng',
                            'unit' => $r['unit'] ?: 'cái',
                            'current_stock' => $qty,
                            'health_status' => $health
                        ];
                    }, $rows);

                    return [
                        'success' => true,
                        'count' => count($items),
                        'inventory' => $items,
                        'summary' => count($items) > 0 ? "Tìm thấy " . count($items) . " vật phẩm trong kho." : "Không có cảnh báo tồn kho bất thường."
                    ];
                }

                // ==========================================
                // 44. QUERY CRM LEADS MULTITIER (MULTI-FACETED CRM QUERY & BI AGGREGATION ENGINE)
                // ==========================================
                case 'query_crm_leads_multitier': {
                    $programsParam = trim((string)($args['programs'] ?? ($args['program'] ?? '')));
                    $stagesParam = trim((string)($args['stages'] ?? ''));
                    $sourcesParam = trim((string)($args['sources'] ?? ($args['source'] ?? '')));
                    $branchesParam = trim((string)($args['branches_or_cities'] ?? ($args['city'] ?? '')));
                    $gender = strtolower(trim((string)($args['gender'] ?? 'all')));
                    $ownersParam = trim((string)($args['owners'] ?? ($args['assigned_to'] ?? '')));
                    $financialFilter = strtolower(trim((string)($args['financial_filter'] ?? ($args['deposit_status'] ?? 'all'))));
                    $minDeposit = isset($args['min_deposit_amount']) ? (float)$args['min_deposit_amount'] : (isset($args['min_deposit']) ? (float)$args['min_deposit'] : 0);
                    $staleDays = !empty($args['stale_days']) ? (int)$args['stale_days'] : 0;
                    $interactionStatus = strtolower(trim((string)($args['interaction_status'] ?? ($args['activity_status'] ?? 'all'))));
                    $recordType = strtolower(trim((string)($args['record_type'] ?? 'all')));
                    $leadStatus = strtolower(trim((string)($args['lead_status'] ?? 'all')));
                    $rawTags = trim((string)($args['tags'] ?? ($args['tag'] ?? '')));
                    $dateField = strtolower(trim((string)($args['date_field'] ?? 'created_at')));
                    if (!in_array($dateField, ['created_at', 'last_contact', 'deposit_date', 'updated_at', 'admission_date'], true)) {
                        $dateField = 'created_at';
                    }
                    $fromDate = trim((string)($args['from_date'] ?? ($args['from'] ?? '')));
                    $toDate = trim((string)($args['to_date'] ?? ($args['to'] ?? '')));
                    $searchQuery = trim((string)($args['search_query'] ?? ($args['search'] ?? '')));
                    $groupBy = strtolower(trim((string)($args['group_by'] ?? 'program_stage')));
                    $limit = max(1, min(20, (int)($args['limit'] ?? 5)));

                    $where = ["c.tenant_id = ?", "c.deleted_at IS NULL"];
                    $params = [$tid];

                    // Zero-Trust CRM RBAC Isolation (100% synced with ContactController::getScope)
                    if (!$canViewAllLeads) {
                        if ($canViewTeamLeads) {
                            $where[] = "(c.owner_id = ? OR FIND_IN_SET(?, COALESCE(c.collaborator_ids, '')) OR c.owner_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))) OR (? > 0 AND team_id = ?)))";
                            $params[] = $uid;
                            $params[] = (string)$uid;
                            $params[] = $uid;
                            $params[] = $teamId;
                            $params[] = $teamId;
                        } else {
                            $where[] = "(c.owner_id = ? OR FIND_IN_SET(?, COALESCE(c.collaborator_ids, '')))";
                            $params[] = $uid;
                            $params[] = (string)$uid;
                        }
                    }

                    // 0a. Record Type Filter (lead vs customer vs all)
                    if ($recordType === 'lead') {
                        $where[] = "(c.status != 'customer' OR c.status IS NULL)";
                    } elseif ($recordType === 'customer' || $recordType === 'student') {
                        $where[] = "(c.status = 'customer' OR c.pipeline_status IN ('enrolled', 'hoc_vien') OR c.stage_id IN (SELECT id FROM pipeline_stages WHERE system_slug IN ('enrolled', 'hoc_vien') OR is_won = 1))";
                    }

                    // 0b. Lead Status Filter
                    if ($leadStatus === 'active_only') {
                        $where[] = "(c.lead_status NOT IN ('lost', 'nurture') OR c.lead_status IS NULL)";
                    } elseif (!empty($leadStatus) && $leadStatus !== 'all') {
                        $lsList = array_filter(array_map('trim', explode(',', $leadStatus)));
                        if (!empty($lsList)) {
                            $lsPh = implode(',', array_fill(0, count($lsList), '?'));
                            $where[] = "c.lead_status IN ($lsPh)";
                            foreach ($lsList as $lsItem) {
                                $params[] = $lsItem;
                            }
                        }
                    }

                    // 1. Programs Multi-Filter
                    if (!empty($programsParam) && $programsParam !== 'all') {
                        $progList = array_filter(array_map('trim', explode(',', $programsParam)));
                        if (!empty($progList)) {
                            $progOrs = [];
                            foreach ($progList as $p) {
                                $progOrs[] = "c.program LIKE ?";
                                $params[] = '%' . $p . '%';
                            }
                            $where[] = "(" . implode(' OR ', $progOrs) . ")";
                        }
                    }

                    // 2. Stages Multi-Filter
                    if (!empty($stagesParam) && $stagesParam !== 'all') {
                        $stageParts = array_filter(array_map('trim', explode(',', $stagesParam)));
                        $stageIds = [];
                        $orderIndexes = [];
                        $stageNames = [];

                        foreach ($stageParts as $sp) {
                            if (strpos($sp, '-') !== false) {
                                $range = explode('-', $sp, 2);
                                $minR = (int)trim($range[0]);
                                $maxR = (int)trim($range[1]);
                                if ($minR > 0 && $maxR >= $minR) {
                                    for ($r = $minR; $r <= $maxR; $r++) {
                                        if ($r <= 14) $orderIndexes[] = $r - 1;
                                        $stageIds[] = $r;
                                    }
                                }
                            } elseif (is_numeric($sp)) {
                                $n = (int)$sp;
                                if ($n >= 1 && $n <= 14) {
                                    $orderIndexes[] = $n - 1;
                                }
                                $stageIds[] = $n;
                            } else {
                                $stageNames[] = $sp;
                            }
                        }

                        $stageOrs = [];
                        if (!empty($stageIds)) {
                            $inIds = implode(',', array_unique(array_map('intval', $stageIds)));
                            $stageOrs[] = "c.stage_id IN ($inIds)";
                        }
                        if (!empty($orderIndexes)) {
                            $inOrders = implode(',', array_unique(array_map('intval', $orderIndexes)));
                            $stageOrs[] = "c.stage_id IN (SELECT id FROM pipeline_stages WHERE order_index IN ($inOrders))";
                        }
                        if (!empty($stageNames)) {
                            foreach ($stageNames as $sn) {
                                $stageOrs[] = "(c.pipeline_status LIKE ? OR c.status LIKE ? OR EXISTS (SELECT 1 FROM pipeline_stages ps_s WHERE ps_s.id = c.stage_id AND (ps_s.system_slug = ? OR ps_s.name LIKE ?)))";
                                $params[] = '%' . $sn . '%';
                                $params[] = '%' . $sn . '%';
                                $params[] = $sn;
                                $params[] = '%' . $sn . '%';
                            }
                        }
                        if (!empty($stageOrs)) {
                            $where[] = "(" . implode(' OR ', $stageOrs) . ")";
                        }
                    }

                    // 3. Sources Multi-Filter (matches both source and utm_source)
                    if (!empty($sourcesParam) && $sourcesParam !== 'all') {
                        $srcList = array_filter(array_map('trim', explode(',', $sourcesParam)));
                        if (!empty($srcList)) {
                            $srcOrs = [];
                            foreach ($srcList as $s) {
                                $srcOrs[] = "(c.source LIKE ? OR c.utm_source LIKE ?)";
                                $params[] = '%' . $s . '%';
                                $params[] = '%' . $s . '%';
                            }
                            $where[] = "(" . implode(' OR ', $srcOrs) . ")";
                        }
                    }

                    // 4. Branches / Cities / Districts Multi-Filter (Schema-safe: contacts has city, district, address)
                    if (!empty($branchesParam) && $branchesParam !== 'all') {
                        $cityList = array_filter(array_map('trim', explode(',', $branchesParam)));
                        if (!empty($cityList)) {
                            $cityOrs = [];
                            foreach ($cityList as $city) {
                                $cityOrs[] = "(c.city LIKE ? OR c.district LIKE ? OR c.address LIKE ?)";
                                $params[] = '%' . $city . '%';
                                $params[] = '%' . $city . '%';
                                $params[] = '%' . $city . '%';
                            }
                            $where[] = "(" . implode(' OR ', $cityOrs) . ")";
                        }
                    }

                    // 5. Gender Filter
                    if (in_array($gender, ['male', 'nam', 'trai', 'boy'], true)) {
                        $where[] = "LOWER(TRIM(COALESCE(c.gender, ''))) IN ('male', 'nam', '1')";
                    } elseif (in_array($gender, ['female', 'nu', 'nữ', 'gai', 'girl'], true)) {
                        $where[] = "(LOWER(TRIM(COALESCE(c.gender, ''))) IN ('female', 'nu', '0') OR c.gender = 'Nữ')";
                    }

                    // 6. Owners Multi-Filter (matches owner_id or collaborator_ids by name/ID with Vietnamese accent-insensitive matching)
                    if (!empty($ownersParam) && $ownersParam !== 'all') {
                        $ownerList = array_filter(array_map('trim', explode(',', $ownersParam)));
                        $ownerOrs = [];
                        foreach ($ownerList as $own) {
                            if (is_numeric($own)) {
                                $ownerOrs[] = "(c.owner_id = ? OR FIND_IN_SET(?, COALESCE(c.collaborator_ids, '')))";
                                $params[] = (int)$own;
                                $params[] = (string)(int)$own;
                            } else {
                                $ownFuzzyWhere = self::buildVietnameseFuzzyNameWhere('u_own.full_name', $own, $params);
                                $ownerOrs[] = "EXISTS (SELECT 1 FROM users u_own WHERE (u_own.id = c.owner_id OR FIND_IN_SET(u_own.id, COALESCE(c.collaborator_ids, ''))) AND ({$ownFuzzyWhere} OR u_own.email LIKE ?))";
                                $params[] = '%' . $own . '%';
                            }
                        }
                        if (!empty($ownerOrs)) {
                            $where[] = "(" . implode(' OR ', $ownerOrs) . ")";
                        }
                    }

                    // 6b. Tags Multi-Filter
                    if (!empty($rawTags) && $rawTags !== 'all') {
                        $tagList = array_filter(array_map('trim', explode(',', $rawTags)));
                        if (!empty($tagList)) {
                            $tagOrs = [];
                            foreach ($tagList as $tg) {
                                $tagOrs[] = "c.tags LIKE ?";
                                $params[] = '%' . $tg . '%';
                            }
                            $where[] = "(" . implode(' OR ', $tagOrs) . ")";
                        }
                    }

                    // 7. Financial Status & Deposit Filters (NULL-safe EXISTS / NOT EXISTS & Schema-verified deposits)
                    if ($financialFilter === 'has_deposit') {
                        $where[] = "EXISTS (SELECT 1 FROM deposits dep_f WHERE dep_f.contact_id = c.id AND dep_f.status NOT IN ('cancelled', 'rejected'))";
                    } elseif ($financialFilter === 'approved_deposit' || $financialFilter === 'has_approved_deposit') {
                        $where[] = "EXISTS (SELECT 1 FROM deposits dep_f WHERE dep_f.contact_id = c.id AND dep_f.status = 'approved')";
                    } elseif ($financialFilter === 'pending_deposit') {
                        $where[] = "EXISTS (SELECT 1 FROM deposits dep_f WHERE dep_f.contact_id = c.id AND dep_f.status = 'pending')";
                    } elseif ($financialFilter === 'no_deposit') {
                        $where[] = "NOT EXISTS (SELECT 1 FROM deposits dep_f WHERE dep_f.contact_id = c.id AND dep_f.status NOT IN ('cancelled', 'rejected'))";
                    } elseif ($financialFilter === 'has_so') {
                        $where[] = "(c.stage_id IN (SELECT id FROM pipeline_stages WHERE order_index >= 12) OR c.status = 'customer')";
                    } elseif ($financialFilter === 'high_value_deposit') {
                        $where[] = "EXISTS (SELECT 1 FROM deposits dep_f WHERE dep_f.contact_id = c.id AND dep_f.price >= 10000000 AND dep_f.status NOT IN ('cancelled', 'rejected'))";
                    }

                    if ($minDeposit > 0) {
                        $where[] = "EXISTS (SELECT 1 FROM deposits dep_m WHERE dep_m.contact_id = c.id AND dep_m.price >= ? AND dep_m.status NOT IN ('cancelled', 'rejected'))";
                        $params[] = $minDeposit;
                    }

                    // 8. Stale Days Filter
                    if ($staleDays > 0) {
                        $where[] = "((c.last_contact IS NOT NULL AND c.last_contact < DATE_SUB(NOW(), INTERVAL ? DAY)) OR (c.last_contact IS NULL AND c.created_at < DATE_SUB(NOW(), INTERVAL ? DAY)))";
                        $params[] = $staleDays;
                        $params[] = $staleDays;
                    }

                    // 9. Interaction Status Filter (3-source NULL-safe EXISTS / NOT EXISTS: activities, notes, and last_contact)
                    if ($interactionStatus === 'has_activity' || $interactionStatus === 'contacted') {
                        $where[] = "(
                            (c.last_contact IS NOT NULL AND c.last_contact != '')
                            OR EXISTS (SELECT 1 FROM activities act_f WHERE (act_f.contact_id = c.id OR (act_f.related_id = c.id AND act_f.related_type IN ('contact', 'lead'))) AND act_f.deleted_at IS NULL)
                            OR EXISTS (SELECT 1 FROM notes n_f WHERE n_f.entity_type = 'contact' AND n_f.entity_id = c.id AND n_f.body NOT LIKE '[Tự động]%' AND n_f.body NOT LIKE '[Phân bổ]%' AND n_f.body NOT LIKE '[Giao data]%' AND n_f.body NOT LIKE '[Auto]%' AND n_f.body NOT LIKE '[Import]%' AND n_f.body NOT LIKE '[Tái phân bổ]%')
                        )";
                    } elseif ($interactionStatus === 'no_activity' || $interactionStatus === 'uncontacted') {
                        $where[] = "(
                            (c.last_contact IS NULL OR c.last_contact = '')
                            AND NOT EXISTS (SELECT 1 FROM activities act_f WHERE (act_f.contact_id = c.id OR (act_f.related_id = c.id AND act_f.related_type IN ('contact', 'lead'))) AND act_f.deleted_at IS NULL)
                            AND NOT EXISTS (SELECT 1 FROM notes n_f WHERE n_f.entity_type = 'contact' AND n_f.entity_id = c.id AND n_f.body NOT LIKE '[Tự động]%' AND n_f.body NOT LIKE '[Phân bổ]%' AND n_f.body NOT LIKE '[Giao data]%' AND n_f.body NOT LIKE '[Auto]%' AND n_f.body NOT LIKE '[Import]%' AND n_f.body NOT LIKE '[Tái phân bổ]%')
                        )";
                    } elseif ($interactionStatus === 'has_call_recently') {
                        $where[] = "EXISTS (SELECT 1 FROM activities act_f WHERE (act_f.contact_id = c.id OR (act_f.related_id = c.id AND act_f.related_type IN ('contact', 'lead'))) AND act_f.type = 'call' AND act_f.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND act_f.deleted_at IS NULL)";
                    }

                    // Snapshot filters before Date Range Filter for diagnostic fallback when created_at returns 0 rows
                    $whereWithoutDate = $where;
                    $paramsWithoutDate = $params;

                    // 10. Date Range Filter (supports created_at, last_contact, updated_at, admission_date, and deposit_date)
                    if ($dateField === 'deposit_date') {
                        if (!empty($fromDate) && !empty($toDate)) {
                            $where[] = "EXISTS (SELECT 1 FROM deposits dep_d WHERE dep_d.contact_id = c.id AND dep_d.status NOT IN ('cancelled', 'rejected') AND dep_d.created_at BETWEEN ? AND ?)";
                            $params[] = $fromDate . ' 00:00:00';
                            $params[] = $toDate . ' 23:59:59';
                        } elseif (!empty($fromDate)) {
                            $where[] = "EXISTS (SELECT 1 FROM deposits dep_d WHERE dep_d.contact_id = c.id AND dep_d.status NOT IN ('cancelled', 'rejected') AND dep_d.created_at >= ?)";
                            $params[] = $fromDate . ' 00:00:00';
                        } elseif (!empty($toDate)) {
                            $where[] = "EXISTS (SELECT 1 FROM deposits dep_d WHERE dep_d.contact_id = c.id AND dep_d.status NOT IN ('cancelled', 'rejected') AND dep_d.created_at <= ?)";
                            $params[] = $toDate . ' 23:59:59';
                        }
                    } elseif ($dateField === 'admission_date') {
                        if (!empty($fromDate)) {
                            $where[] = "c.admission_date >= ?";
                            $params[] = $fromDate;
                        }
                        if (!empty($toDate)) {
                            $where[] = "c.admission_date <= ?";
                            $params[] = $toDate;
                        }
                    } else {
                        $targetDateField = ($dateField === 'last_contact') ? 'c.last_contact' : (($dateField === 'updated_at') ? 'c.updated_at' : 'c.created_at');
                        if (!empty($fromDate) && !empty($toDate)) {
                            $where[] = "{$targetDateField} BETWEEN ? AND ?";
                            $params[] = $fromDate . ' 00:00:00';
                            $params[] = $toDate . ' 23:59:59';
                        } elseif (!empty($fromDate)) {
                            $where[] = "{$targetDateField} >= ?";
                            $params[] = $fromDate . ' 00:00:00';
                        } elseif (!empty($toDate)) {
                            $where[] = "{$targetDateField} <= ?";
                            $params[] = $toDate . ' 23:59:59';
                        }
                    }

                    // 11. Search Query Keyword (Accent-Insensitive & Tokenized Fuzzy Name Matching)
                    if (!empty($searchQuery)) {
                        $fuzzySearchName = self::buildVietnameseFuzzyNameWhere('c.full_name', $searchQuery, $params);
                        $likeQ = '%' . $searchQuery . '%';
                        $where[] = "({$fuzzySearchName} OR c.phone LIKE ? OR c.email LIKE ? OR c.company LIKE ? OR c.job_title LIKE ? OR c.notes LIKE ?)";
                        array_push($params, $likeQ, $likeQ, $likeQ, $likeQ, $likeQ);

                        $fuzzySearchNameNoDate = self::buildVietnameseFuzzyNameWhere('c.full_name', $searchQuery, $paramsWithoutDate);
                        $whereWithoutDate[] = "({$fuzzySearchNameNoDate} OR c.phone LIKE ? OR c.email LIKE ? OR c.company LIKE ? OR c.job_title LIKE ? OR c.notes LIKE ?)";
                        array_push($paramsWithoutDate, $likeQ, $likeQ, $likeQ, $likeQ, $likeQ);
                    }

                    $whereSql = implode(" AND ", $where);

                    // ==========================================
                    // 1. TOTAL MATCHING COUNT & OVERALL ROLLUP (Single-Pass Consolidated SQL)
                    // ==========================================
                    $countRollupSql = "SELECT 
                                         COUNT(DISTINCT c.id) as total_matching,
                                         COUNT(DISTINCT dep.id) as deposit_count,
                                         COUNT(DISTINCT dep.contact_id) as deposited_lead_count,
                                         COALESCE(SUM(dep.price), 0) as total_deposit_amount
                                       FROM contacts c
                                       LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
                                       LEFT JOIN users u ON c.owner_id = u.id
                                       LEFT JOIN deposits dep ON dep.contact_id = c.id AND dep.status NOT IN ('cancelled', 'rejected')
                                       WHERE {$whereSql}";
                    $countRollupStmt = $db->prepare($countRollupSql);
                    $countRollupStmt->execute($params);
                    $rollupData = $countRollupStmt->fetch(PDO::FETCH_ASSOC) ?: [];
                    $totalMatching = (int)($rollupData['total_matching'] ?? 0);

                    if ($totalMatching === 0) {
                        $zeroResultPayload = [
                            'success' => true,
                            'total_matching' => 0,
                            'applied_date_filter' => [
                                'date_field' => $dateField,
                                'from_date' => $fromDate,
                                'to_date' => $toDate
                            ],
                            'message' => 'Không tìm thấy học viên/khách hàng nào có ngày tạo (created_at) đúng trong khoảng thời gian yêu cầu.'
                        ];

                        // Diagnostic Fallback: When a date filter returned 0 rows, check total all-time leads and recently updated/assigned leads for those same non-date filters
                        if (!empty($fromDate) || !empty($toDate)) {
                            try {
                                $noDateSql = implode(" AND ", $whereWithoutDate);
                                $stmtAllTime = $db->prepare("SELECT COUNT(DISTINCT c.id) FROM contacts c LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id LEFT JOIN users u ON c.owner_id = u.id WHERE {$noDateSql}");
                                $stmtAllTime->execute($paramsWithoutDate);
                                $totalAllTime = (int)$stmtAllTime->fetchColumn();

                                $updatedInRangeCount = 0;
                                if ($totalAllTime > 0 && $dateField === 'created_at') {
                                    $updWhere = $whereWithoutDate;
                                    $updParams = $paramsWithoutDate;
                                    if (!empty($fromDate) && !empty($toDate)) {
                                        $updWhere[] = "(c.updated_at BETWEEN ? AND ? OR c.last_contact BETWEEN ? AND ?)";
                                        array_push($updParams, $fromDate . ' 00:00:00', $toDate . ' 23:59:59', $fromDate . ' 00:00:00', $toDate . ' 23:59:59');
                                    } elseif (!empty($fromDate)) {
                                        $updWhere[] = "(c.updated_at >= ? OR c.last_contact >= ?)";
                                        array_push($updParams, $fromDate . ' 00:00:00', $fromDate . ' 00:00:00');
                                    }
                                    $stmtUpd = $db->prepare("SELECT COUNT(DISTINCT c.id) FROM contacts c WHERE " . implode(" AND ", $updWhere));
                                    $stmtUpd->execute($updParams);
                                    $updatedInRangeCount = (int)$stmtUpd->fetchColumn();

                                    $stmtRecent = $db->prepare("
                                        SELECT c.id, c.full_name, c.phone, c.program, c.source,
                                               COALESCE(ps.name, c.pipeline_status, c.status, 'Mới') as stage_name,
                                               COALESCE(u.full_name, 'Chưa phân bổ') as owner_name,
                                               c.created_at, c.updated_at, c.last_contact
                                        FROM contacts c
                                        LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
                                        LEFT JOIN users u ON c.owner_id = u.id
                                        WHERE {$noDateSql}
                                        ORDER BY COALESCE(c.updated_at, c.created_at) DESC
                                        LIMIT 5
                                    ");
                                    $stmtRecent->execute($paramsWithoutDate);
                                    $recentFallbackLeads = $stmtRecent->fetchAll(PDO::FETCH_ASSOC);

                                    $zeroResultPayload['all_time_matching_without_date_filter'] = $totalAllTime;
                                    $zeroResultPayload['updated_or_interacted_in_date_range_count'] = $updatedInRangeCount;
                                    $zeroResultPayload['most_recent_leads_of_filter'] = $recentFallbackLeads;
                                    $zeroResultPayload['message'] = "Trong khoảng thời gian ({$fromDate} -> {$toDate}) không có lead mới nào được tạo (created_at), NHƯNG có tổng cộng {$totalAllTime} lead thỏa điều kiện lọc trên toàn hệ thống (trong đó có {$updatedInRangeCount} lead được cập nhật/chăm sóc trong khoảng thời gian này). Đã đính kèm 5 lead gần nhất trong `most_recent_leads_of_filter` để bạn thông tin đầy đủ cho người dùng.";
                                }
                            } catch (\Throwable $eDiag) {
                                // Safe ignore diagnostic error
                            }
                        }

                        return $zeroResultPayload;
                    }

                    $depositCount = (int)($rollupData['deposit_count'] ?? 0);
                    $depositedLeadCount = (int)($rollupData['deposited_lead_count'] ?? 0);
                    $totalDepositAmount = (float)($rollupData['total_deposit_amount'] ?? 0);
                    $conversionPct = $totalMatching > 0 ? round(($depositedLeadCount / $totalMatching) * 100, 1) : 0;
                    $avgDeposit = $depositCount > 0 ? round($totalDepositAmount / $depositCount, 0) : 0;

                    // ==========================================
                    // 2. MULTI-TIER FACETED AGGREGATIONS (GROUP BY)
                    // ==========================================

                    // Facet A: By Program (100% Parity: dep.status NOT IN ('cancelled', 'rejected'))
                    $progSql = "SELECT 
                                  COALESCE(NULLIF(TRIM(c.program), ''), 'Chưa phân loại') as program_name,
                                  COUNT(DISTINCT c.id) as lead_count,
                                  COUNT(DISTINCT dep.id) as deposit_count,
                                  COALESCE(SUM(dep.price), 0) as deposit_amount
                                FROM contacts c
                                LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
                                LEFT JOIN users u ON c.owner_id = u.id
                                LEFT JOIN deposits dep ON dep.contact_id = c.id AND dep.status NOT IN ('cancelled', 'rejected')
                                WHERE {$whereSql}
                                GROUP BY program_name
                                ORDER BY lead_count DESC
                                LIMIT 6";
                    $progStmt = $db->prepare($progSql);
                    $progStmt->execute($params);
                    $progFacets = $progStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    // Facet B: By Stage
                    $stageSql = "SELECT 
                                   COALESCE(ps.name, c.status, 'Mới') as stage_name,
                                   COALESCE(ps.order_index, 0) as stage_order,
                                   COUNT(DISTINCT c.id) as lead_count
                                 FROM contacts c
                                 LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
                                 LEFT JOIN users u ON c.owner_id = u.id
                                 WHERE {$whereSql}
                                 GROUP BY stage_name, stage_order
                                 ORDER BY stage_order ASC, lead_count DESC
                                 LIMIT 8";
                    $stageStmt = $db->prepare($stageSql);
                    $stageStmt->execute($params);
                    $stageFacets = $stageStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    // Facet C: By Source (100% Parity: dep.status NOT IN ('cancelled', 'rejected'))
                    $srcSql = "SELECT 
                                 COALESCE(NULLIF(TRIM(c.source), ''), 'Chưa rõ nguồn') as source_name,
                                 COUNT(DISTINCT c.id) as lead_count,
                                 COUNT(DISTINCT dep.id) as deposit_count
                               FROM contacts c
                               LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
                               LEFT JOIN users u ON c.owner_id = u.id
                               LEFT JOIN deposits dep ON dep.contact_id = c.id AND dep.status NOT IN ('cancelled', 'rejected')
                               WHERE {$whereSql}
                               GROUP BY source_name
                               ORDER BY lead_count DESC
                               LIMIT 6";
                    $srcStmt = $db->prepare($srcSql);
                    $srcStmt->execute($params);
                    $srcFacets = $srcStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    // Facet D: By Owner / Consultant (100% Parity: dep.status NOT IN ('cancelled', 'rejected'))
                    $ownerSql = "SELECT 
                                   COALESCE(u.full_name, 'Chưa phân công') as owner_name,
                                   COUNT(DISTINCT c.id) as lead_count,
                                   COUNT(DISTINCT dep.id) as deposit_count,
                                   COALESCE(SUM(dep.price), 0) as deposit_amount
                                 FROM contacts c
                                 LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
                                 LEFT JOIN users u ON c.owner_id = u.id
                                 LEFT JOIN deposits dep ON dep.contact_id = c.id AND dep.status NOT IN ('cancelled', 'rejected')
                                 WHERE {$whereSql}
                                 GROUP BY owner_name
                                 ORDER BY lead_count DESC
                                 LIMIT 6";
                    $ownerStmt = $db->prepare($ownerSql);
                    $ownerStmt->execute($params);
                    $ownerFacets = $ownerStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    // ==========================================
                    // 3. SYNTHESIZE DYNAMIC CHART DATA
                    // ==========================================
                    $chartData = [];
                    $chartSeries = [];
                    $chartTitle = "Phân tích Phễu & Cơ cấu Lead CRM";

                    if (!empty($progFacets) && count($progFacets) > 1) {
                        foreach ($progFacets as $pf) {
                            $chartData[] = [
                                'name' => $pf['program_name'],
                                'leads' => (int)$pf['lead_count'],
                                'deposits' => (int)$pf['deposit_count']
                            ];
                        }
                        $chartSeries = [
                            ['dataKey' => 'leads', 'name' => 'Tổng số Lead', 'color' => '#3b82f6'],
                            ['dataKey' => 'deposits', 'name' => 'Đã đóng cọc', 'color' => '#10b981']
                        ];
                        $chartTitle = "Cơ cấu Lead & Số lượng Đóng cọc theo Chương trình";
                    } elseif (!empty($stageFacets)) {
                        foreach ($stageFacets as $sf) {
                            $chartData[] = [
                                'name' => $sf['stage_name'],
                                'leads' => (int)$sf['lead_count']
                            ];
                        }
                        $chartSeries = [
                            ['dataKey' => 'leads', 'name' => 'Số lượng Lead', 'color' => '#6366f1']
                        ];
                        $chartTitle = "Phân bổ Lead theo Giai đoạn Pipeline";
                    }

                    // ==========================================
                    // 4. FETCH TOP PREVIEW RECORDS
                    // ==========================================
                    $previewSql = "SELECT c.id, c.full_name, c.phone, c.email, c.job_title, c.company, c.program, c.city, c.source, c.created_at, c.last_contact,
                                          COALESCE(ps.name, c.status, 'Mới') as stage_name,
                                          COALESCE(ps.order_index, 0) as stage_order,
                                          COALESCE(u.full_name, 'Chưa phân công') as owner_name,
                                          (SELECT SUM(price) FROM deposits WHERE contact_id = c.id AND status NOT IN ('cancelled', 'rejected')) as total_deposit,
                                          (
                                            SELECT CONCAT('[', DATE_FORMAT(act.created_at, '%d/%m/%Y'), '] ', act.type, ': ', COALESCE(NULLIF(TRIM(act.body), ''), act.subject, ''))
                                            FROM activities act
                                            WHERE ((act.related_id = c.id AND act.related_type IN ('contact', 'lead')) OR act.contact_id = c.id) AND act.deleted_at IS NULL
                                            ORDER BY act.created_at DESC LIMIT 1
                                          ) as latest_note
                                   FROM contacts c
                                   LEFT JOIN pipeline_stages ps ON c.stage_id = ps.id
                                   LEFT JOIN users u ON c.owner_id = u.id
                                   WHERE {$whereSql}
                                   ORDER BY c.id DESC
                                   LIMIT " . (int)$limit;
                    $previewStmt = $db->prepare($previewSql);
                    $previewStmt->execute($params);
                    $previewRows = $previewStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    $formattedPreviews = array_map(function($r) {
                        $cId = (int)$r['id'];
                        $cName = $r['full_name'];
                        $directUrl = "https://myerp.ideas.edu.vn/contacts?id={$cId}";
                        $depAmt = (float)($r['total_deposit'] ?? 0);
                        $depStr = $depAmt > 0 ? number_format($depAmt, 0, ',', '.') . ' VNĐ' : 'Chưa cọc';
                        $card = "<<<ERP_CARD:{\"entity_type\":\"contact\",\"entity_id\":{$cId},\"title\":\"" . addslashes($cName) . "\",\"subtitle\":\"" . ($r['phone'] ?: '') . " • " . ($r['program'] ?: 'CRM') . "\",\"status\":\"in_progress\",\"direct_url\":\"{$directUrl}\",\"action_label\":\"Mở hồ sơ\"}>>>";

                        return [
                            'id' => $cId,
                            'name' => $cName,
                            'phone' => $r['phone'] ?: 'Chưa có',
                            'job_title' => $r['job_title'] ?: 'Chưa cập nhật',
                            'company' => $r['company'] ?: 'Chưa cập nhật',
                            'program' => $r['program'] ?: 'Chưa phân loại',
                            'stage' => $r['stage_name'],
                            'owner' => $r['owner_name'],
                            'total_deposit' => $depStr,
                            'created_at' => date('d/m/Y', strtotime($r['created_at'])),
                            'latest_note' => $r['latest_note'] ?: 'Chưa có ghi chú',
                            'url' => $directUrl,
                            'smart_card' => $card
                        ];
                    }, $previewRows);

                    // ==========================================
                    // 5. EXPORT URL GENERATION (100% Filter Parity)
                    // ==========================================
                    $exportParams = ['type' => 'contact', 'export_mode' => 'full'];
                    if (!empty($recordType) && $recordType !== 'all') $exportParams['record_type'] = $recordType;
                    if (!empty($leadStatus) && $leadStatus !== 'all') $exportParams['lead_status'] = $leadStatus;
                    if (!empty($programsParam) && $programsParam !== 'all') $exportParams['program'] = $programsParam;
                    if (!empty($stagesParam) && $stagesParam !== 'all') $exportParams['stages'] = $stagesParam;
                    if (!empty($sourcesParam) && $sourcesParam !== 'all') $exportParams['source'] = $sourcesParam;
                    if (!empty($branchesParam) && $branchesParam !== 'all') $exportParams['city'] = $branchesParam;
                    if (!empty($gender) && $gender !== 'all') $exportParams['gender'] = $gender;
                    if (!empty($ownersParam) && $ownersParam !== 'all') $exportParams['owners'] = $ownersParam;
                    if (!empty($rawTags) && $rawTags !== 'all') $exportParams['tags'] = $rawTags;
                    if (!empty($financialFilter) && $financialFilter !== 'all') $exportParams['financial_filter'] = $financialFilter;
                    if ($minDeposit > 0) $exportParams['min_deposit'] = $minDeposit;
                    if ($staleDays > 0) $exportParams['stale_days'] = $staleDays;
                    if (!empty($interactionStatus) && $interactionStatus !== 'all') $exportParams['interaction_status'] = $interactionStatus;
                    if (!empty($dateField) && $dateField !== 'created_at') $exportParams['date_field'] = $dateField;
                    if (!empty($fromDate)) $exportParams['from'] = $fromDate;
                    if (!empty($toDate)) $exportParams['to'] = $toDate;
                    if (!empty($searchQuery)) $exportParams['search'] = $searchQuery;
                    $exportUrl = '/export?' . http_build_query($exportParams);

                    return [
                        'success' => true,
                        'total_matching' => $totalMatching,
                        'preview_count' => count($formattedPreviews),
                        'financial_summary' => [
                            'total_leads' => $totalMatching,
                            'deposit_count' => $depositCount,
                            'deposited_lead_count' => $depositedLeadCount,
                            'total_deposit_amount' => number_format($totalDepositAmount, 0, ',', '.') . ' VNĐ',
                            'avg_deposit_amount' => number_format($avgDeposit, 0, ',', '.') . ' VNĐ',
                            'conversion_rate_pct' => $conversionPct . '%'
                        ],
                        'facets' => [
                            'by_program' => $progFacets,
                            'by_stage' => $stageFacets,
                            'by_source' => $srcFacets,
                            'by_owner' => $ownerFacets
                        ],
                        'dynamic_chart' => !empty($chartData) ? [
                            'type' => 'bar',
                            'title' => $chartTitle,
                            'xAxisKey' => 'name',
                            'data' => $chartData,
                            'series' => $chartSeries
                        ] : null,
                        'preview_leads' => $formattedPreviews,
                        'export_url' => $exportUrl,
                        'export_markdown' => "[Bấm vào đây để tải toàn bộ {$totalMatching} học viên/lead (File Excel/CSV)]({$exportUrl})"
                    ];
                }

                // ==========================================
                // 45. QUERY FINANCE MULTITIER ANALYTICS (MULTI-TIER EXPENSE & BUDGET BI ENGINE)
                // ==========================================
                case 'query_finance_multitier_analytics': {
                    $departmentsParam = trim((string)($args['departments'] ?? ''));
                    $categoriesParam = trim((string)($args['categories'] ?? ''));
                    $statusesParam = trim((string)($args['statuses'] ?? ''));
                    $period = strtolower(trim((string)($args['period'] ?? 'this_month')));
                    $fromDate = trim((string)($args['from_date'] ?? ''));
                    $toDate = trim((string)($args['to_date'] ?? ''));
                    $minAmount = isset($args['min_amount']) ? (float)$args['min_amount'] : 0;
                    $maxAmount = isset($args['max_amount']) ? (float)$args['max_amount'] : 0;
                    $overdueOnly = !empty($args['overdue_only']);
                    $limit = max(1, min(20, (int)($args['limit'] ?? 5)));

                    $where = ["e.tenant_id = ?", "e.deleted_at IS NULL"];
                    $params = [$tid];

                    // Zero-Trust Finance RBAC
                    if (!$isGlobalAdmin && !$isAccountant && !$isManager) {
                        $where[] = "(e.created_by = ? OR e.approver_id = ? OR e.approver_id_2 = ? OR e.approver_id_3 = ? OR FIND_IN_SET(?, IFNULL(e.related_user_ids, '')))";
                        $params[] = $uid;
                        $params[] = $uid;
                        $params[] = $uid;
                        $params[] = $uid;
                        $params[] = (string)$uid;
                    }

                    // 1. Departments Filter
                    if (!empty($departmentsParam) && $departmentsParam !== 'all') {
                        $deptList = array_filter(array_map('trim', explode(',', $departmentsParam)));
                        if (!empty($deptList)) {
                            $deptOrs = [];
                            foreach ($deptList as $d) {
                                $deptOrs[] = "(e.category LIKE ? OR e.title LIKE ?)";
                                $params[] = '%' . $d . '%';
                                $params[] = '%' . $d . '%';
                            }
                            $where[] = "(" . implode(' OR ', $deptOrs) . ")";
                        }
                    }

                    // 2. Categories Filter
                    if (!empty($categoriesParam) && $categoriesParam !== 'all') {
                        $catList = array_filter(array_map('trim', explode(',', $categoriesParam)));
                        if (!empty($catList)) {
                            $catOrs = [];
                            foreach ($catList as $c) {
                                $catOrs[] = "e.category LIKE ?";
                                $params[] = '%' . $c . '%';
                            }
                            $where[] = "(" . implode(' OR ', $catOrs) . ")";
                        }
                    }

                    // 3. Statuses Filter
                    if (!empty($statusesParam) && $statusesParam !== 'all') {
                        $stList = array_filter(array_map('trim', explode(',', $statusesParam)));
                        if (!empty($stList)) {
                            $stOrs = [];
                            foreach ($stList as $st) {
                                if ($st === 'pending') {
                                    $stOrs[] = "e.status = 'pending'";
                                } elseif ($st === 'approved') {
                                    $stOrs[] = "e.status = 'approved'";
                                } elseif ($st === 'paid') {
                                    $stOrs[] = "(e.status = 'paid' OR (e.status = 'approved' AND e.is_refunded = 1))";
                                } elseif ($st === 'rejected') {
                                    $stOrs[] = "e.status = 'rejected'";
                                } elseif ($st === 'pending_l1') {
                                    $stOrs[] = "e.status = 'pending' AND (e.status_level_1 = 'pending' OR e.status_level_1 IS NULL)";
                                } elseif ($st === 'pending_l2') {
                                    $stOrs[] = "e.status = 'pending' AND e.status_level_1 = 'approved' AND (e.status_level_2 = 'pending' OR e.status_level_2 IS NULL)";
                                }
                            }
                            if (!empty($stOrs)) {
                                $where[] = "(" . implode(' OR ', $stOrs) . ")";
                            }
                        }
                    }

                    // 4. Period & Date Filter
                    if ($period === 'this_month') {
                        $where[] = "e.date >= DATE_FORMAT(NOW(), '%Y-%m-01') AND e.date <= LAST_DAY(NOW())";
                    } elseif ($period === 'last_month') {
                        $where[] = "e.date >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m-01') AND e.date <= LAST_DAY(DATE_SUB(NOW(), INTERVAL 1 MONTH))";
                    } elseif ($period === 'this_quarter') {
                        $where[] = "QUARTER(e.date) = QUARTER(NOW()) AND YEAR(e.date) = YEAR(NOW())";
                    } elseif ($period === 'last_quarter') {
                        $where[] = "QUARTER(e.date) = QUARTER(DATE_SUB(NOW(), INTERVAL 3 MONTH)) AND YEAR(e.date) = YEAR(DATE_SUB(NOW(), INTERVAL 3 MONTH))";
                    } elseif ($period === 'this_year') {
                        $where[] = "YEAR(e.date) = YEAR(NOW())";
                    } elseif (!empty($fromDate) && !empty($toDate)) {
                        $where[] = "e.date BETWEEN ? AND ?";
                        $params[] = $fromDate;
                        $params[] = $toDate;
                    } elseif (!empty($fromDate)) {
                        $where[] = "e.date >= ?";
                        $params[] = $fromDate;
                    } elseif (!empty($toDate)) {
                        $where[] = "e.date <= ?";
                        $params[] = $toDate;
                    }

                    // 5. Amount Brackets
                    if ($minAmount > 0) {
                        $where[] = "e.amount >= ?";
                        $params[] = $minAmount;
                    }
                    if ($maxAmount > 0) {
                        $where[] = "e.amount <= ?";
                        $params[] = $maxAmount;
                    }

                    // 6. Overdue Only
                    if ($overdueOnly) {
                        $where[] = "e.due_date IS NOT NULL AND e.due_date < CURDATE() AND (e.status != 'paid' AND (e.is_refunded = 0 OR e.is_refunded IS NULL))";
                    }

                    $whereSql = implode(" AND ", $where);

                    // ==========================================
                    // 1. TOTAL EXPENSE & STATUS ROLLUP
                    // ==========================================
                    $aggSql = "SELECT 
                                 COUNT(1) as total_count,
                                 COALESCE(SUM(e.amount), 0) as total_amount,
                                 COALESCE(SUM(CASE WHEN e.status = 'approved' THEN e.amount ELSE 0 END), 0) as approved_amount,
                                 COALESCE(SUM(CASE WHEN e.status = 'paid' OR (e.status = 'approved' AND e.is_refunded = 1) THEN e.amount ELSE 0 END), 0) as paid_amount,
                                 COALESCE(SUM(CASE WHEN e.status = 'pending' THEN e.amount ELSE 0 END), 0) as pending_amount,
                                 COALESCE(SUM(CASE WHEN e.due_date IS NOT NULL AND e.due_date < CURDATE() AND e.status != 'paid' THEN 1 ELSE 0 END), 0) as overdue_count
                               FROM expenses e
                               WHERE {$whereSql}";
                    $aggStmt = $db->prepare($aggSql);
                    $aggStmt->execute($params);
                    $agg = $aggStmt->fetch(PDO::FETCH_ASSOC);

                    $totalCount = (int)($agg['total_count'] ?? 0);
                    $totalAmount = (float)($agg['total_amount'] ?? 0);
                    $paidAmount = (float)($agg['paid_amount'] ?? 0);
                    $pendingAmount = (float)($agg['pending_amount'] ?? 0);
                    $overdueCount = (int)($agg['overdue_count'] ?? 0);

                    if ($totalCount === 0) {
                        return [
                            'success' => true,
                            'total_matching' => 0,
                            'total_amount' => 0,
                            'message' => 'Không tìm thấy khoản chi/đề xuất thanh toán nào thỏa mãn bộ lọc trong phạm vi quyền hạn.'
                        ];
                    }

                    // ==========================================
                    // 2. GROUP BY CATEGORY / DEPARTMENT FACETS
                    // ==========================================
                    $catSql = "SELECT 
                                 COALESCE(NULLIF(TRIM(e.category), ''), 'Chưa phân loại') as category_name,
                                 COUNT(1) as item_count,
                                 COALESCE(SUM(e.amount), 0) as category_amount
                               FROM expenses e
                               WHERE {$whereSql}
                               GROUP BY category_name
                               ORDER BY category_amount DESC
                               LIMIT 8";
                    $catStmt = $db->prepare($catSql);
                    $catStmt->execute($params);
                    $catFacets = $catStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    $chartData = [];
                    foreach ($catFacets as $cf) {
                        $chartData[] = [
                            'name' => $cf['category_name'],
                            'amount' => round((float)$cf['category_amount'] / 1000000, 1),
                            'count' => (int)$cf['item_count']
                        ];
                    }

                    // ==========================================
                    // 3. TOP EXPENSE RECORDS PREVIEW
                    // ==========================================
                    $topSql = "SELECT e.id, e.title, e.amount, e.category, e.status, e.date, e.due_date, e.created_at,
                                      u.full_name as creator_name
                               FROM expenses e
                               LEFT JOIN users u ON e.created_by = u.id
                               WHERE {$whereSql}
                               ORDER BY e.amount DESC, e.id DESC
                               LIMIT " . (int)$limit;
                    $topStmt = $db->prepare($topSql);
                    $topStmt->execute($params);
                    $topExpenses = $topStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                    $formattedTop = array_map(function($e) {
                        $eId = (int)$e['id'];
                        $directUrl = "https://myerp.ideas.edu.vn/expenses?id={$eId}";
                        $amtStr = number_format((float)$e['amount'], 0, ',', '.') . ' VNĐ';
                        $card = "<<<ERP_CARD:{\"entity_type\":\"expense\",\"entity_id\":{$eId},\"title\":\"" . addslashes($e['title']) . "\",\"subtitle\":\"{$amtStr} • " . ($e['category'] ?: 'Chi phí') . "\",\"status\":\"in_progress\",\"direct_url\":\"{$directUrl}\",\"action_label\":\"Xem phiếu chi\"}>>>";

                        return [
                            'id' => $eId,
                            'title' => $e['title'],
                            'amount' => $amtStr,
                            'category' => $e['category'] ?: 'Khác',
                            'creator' => $e['creator_name'] ?: 'N/A',
                            'date' => date('d/m/Y', strtotime($e['date'] ?: $e['created_at'])),
                            'due_date' => $e['due_date'] ? date('d/m/Y', strtotime($e['due_date'])) : 'Không đặt',
                            'status' => $e['status'] === 'approved' ? 'Đã duyệt' : ($e['status'] === 'paid' ? 'Đã chi' : ($e['status'] === 'pending' ? 'Chờ duyệt' : $e['status'])),
                            'smart_card' => $card
                        ];
                    }, $topExpenses);

                    // 4. Build Expense Export URL (100% Filter Parity)
                    $expExportParams = ['type' => 'expense'];
                    if (!empty($departmentsParam) && $departmentsParam !== 'all') $expExportParams['departments'] = $departmentsParam;
                    if (!empty($categoriesParam) && $categoriesParam !== 'all') $expExportParams['category'] = $categoriesParam;
                    if (!empty($statusesParam) && $statusesParam !== 'all') $expExportParams['status'] = $statusesParam;
                    if (!empty($period)) $expExportParams['period'] = $period;
                    if (!empty($fromDate)) $expExportParams['from'] = $fromDate;
                    if (!empty($toDate)) $expExportParams['to'] = $toDate;
                    if ($minAmount > 0) $expExportParams['min_amount'] = $minAmount;
                    if ($maxAmount > 0) $expExportParams['max_amount'] = $maxAmount;
                    if ($overdueOnly) $expExportParams['overdue_only'] = '1';
                    $expExportUrl = '/export?' . http_build_query($expExportParams);

                    return [
                        'success' => true,
                        'total_matching' => $totalCount,
                        'financial_summary' => [
                            'total_count' => $totalCount,
                            'total_amount' => number_format($totalAmount, 0, ',', '.') . ' VNĐ',
                            'paid_amount' => number_format($paidAmount, 0, ',', '.') . ' VNĐ',
                            'pending_amount' => number_format($pendingAmount, 0, ',', '.') . ' VNĐ',
                            'overdue_count' => $overdueCount
                        ],
                        'facets_by_category' => $catFacets,
                        'dynamic_chart' => !empty($chartData) ? [
                            'type' => 'bar',
                            'title' => 'Cơ cấu Chi phí theo Hạng mục (Đơn vị: Triệu VNĐ)',
                            'xAxisKey' => 'name',
                            'data' => $chartData,
                            'series' => [
                                ['dataKey' => 'amount', 'name' => 'Chi phí (Tr. VNĐ)', 'color' => '#ef4444']
                            ]
                        ] : null,
                        'top_expenses' => $formattedTop,
                        'export_url' => $expExportUrl,
                        'export_markdown' => "[Bấm vào đây để tải báo cáo chi phí ({$totalCount} phiếu chi)]({$expExportUrl})"
                    ];
                }

                // =========================================================================
                // TOOL: query_deposits_and_revenue_multitier (MULTI-TIER DEPOSIT & SO ENGINE)
                // =========================================================================
                case 'query_deposits_and_revenue_multitier': {
                    $programsParam   = trim((string)($args['programs'] ?? $args['program'] ?? ''));
                    $statusesParam   = trim((string)($args['statuses'] ?? $args['status'] ?? ''));
                    $milestoneStatus = strtolower(trim((string)($args['milestone_status'] ?? '')));
                    $ownersParam     = trim((string)($args['owners'] ?? $args['sale_id'] ?? $args['owner_id'] ?? ''));
                    $citiesParam     = trim((string)($args['branches_or_cities'] ?? $args['city'] ?? ''));
                    $sourcesParam    = trim((string)($args['sources'] ?? $args['source'] ?? ''));
                    $minAmount       = isset($args['min_amount']) && is_numeric($args['min_amount']) ? (float)$args['min_amount'] : 0;
                    $maxAmount       = isset($args['max_amount']) && is_numeric($args['max_amount']) ? (float)$args['max_amount'] : 0;
                    $period          = strtolower(trim((string)($args['period'] ?? '')));
                    $fromDate        = trim((string)($args['from_date'] ?? $args['from'] ?? ''));
                    $toDate          = trim((string)($args['to_date'] ?? $args['to'] ?? ''));
                    $search          = trim((string)($args['search'] ?? $args['search_query'] ?? ''));
                    $limit           = max(1, min(100, (int)($args['limit'] ?? 20)));

                    $where = [
                        '(c.tenant_id = ? OR p.tenant_id = ? OR u.tenant_id = ?)',
                        '(c.id IS NULL OR c.deleted_at IS NULL)'
                    ];
                    $params = [$tid, $tid, $tid];

                    // Zero-Trust RBAC
                    $isFinAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'ceo', 'accountant', 'ke_toan', 'sale_admin', 'saleadmin'], true);
                    $isManager  = in_array($role, ['manager', 'truong_phong', 'leader', 'team_lead'], true);
                    if (!$isFinAdmin) {
                        if ($isManager) {
                            $where[] = "(d.created_by = ? OR c.owner_id = ? OR d.created_by IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id))))) OR c.owner_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id))))))";
                            array_push($params, $uid, $uid, $uid, $uid);
                        } else {
                            $where[] = "(d.created_by = ? OR c.owner_id = ? OR FIND_IN_SET(?, IFNULL(c.collaborator_ids, '')))";
                            array_push($params, $uid, $uid, (string)$uid);
                        }
                    }

                    // 1. Program / Project Filter
                    if ($programsParam !== '' && $programsParam !== 'all') {
                        $progList = array_filter(array_map('trim', explode(',', $programsParam)));
                        if (!empty($progList)) {
                            $progOrs = [];
                            foreach ($progList as $pItem) {
                                $progOrs[] = "(c.program LIKE ? OR p.name LIKE ?)";
                                $params[] = '%' . $pItem . '%';
                                $params[] = '%' . $pItem . '%';
                            }
                            $where[] = "(" . implode(' OR ', $progOrs) . ")";
                        }
                    }

                    // 2. Status Filter
                    if ($statusesParam !== '' && $statusesParam !== 'all') {
                        $stList = array_filter(array_map('trim', explode(',', strtolower($statusesParam))));
                        if (!empty($stList)) {
                            $stOrs = [];
                            foreach ($stList as $st) {
                                if ($st === 'active_only') {
                                    $stOrs[] = "d.status NOT IN ('cancelled', 'rejected')";
                                } elseif ($st === 'approved' || $st === 'completed') {
                                    $stOrs[] = "d.status IN ('approved', 'completed')";
                                } else {
                                    $stOrs[] = "d.status = ?";
                                    $params[] = $st;
                                }
                            }
                            if (!empty($stOrs)) {
                                $where[] = "(" . implode(' OR ', $stOrs) . ")";
                            }
                        }
                    }

                    // 2B. Milestone Status Filter (deposit_milestones)
                    if ($milestoneStatus !== '' && $milestoneStatus !== 'all') {
                        if ($milestoneStatus === 'overdue') {
                            $where[] = "EXISTS (SELECT 1 FROM deposit_milestones dm WHERE dm.deposit_id = d.id AND dm.status NOT IN ('paid', 'approved', 'completed', 'cancelled', 'rejected') AND dm.expected_pay_date IS NOT NULL AND dm.expected_pay_date < CURDATE())";
                        } elseif ($milestoneStatus === 'due_soon') {
                            $where[] = "EXISTS (SELECT 1 FROM deposit_milestones dm WHERE dm.deposit_id = d.id AND dm.status NOT IN ('paid', 'approved', 'completed', 'cancelled', 'rejected') AND dm.expected_pay_date IS NOT NULL AND dm.expected_pay_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY))";
                        } elseif (in_array($milestoneStatus, ['unpaid', 'pending_approval', 'pending'], true)) {
                            $where[] = "EXISTS (SELECT 1 FROM deposit_milestones dm WHERE dm.deposit_id = d.id AND dm.status IN ('pending', 'pending_approval', 'unpaid'))";
                        } elseif (in_array($milestoneStatus, ['fully_paid', 'paid'], true)) {
                            $where[] = "(d.status IN ('approved', 'completed') OR (EXISTS (SELECT 1 FROM deposit_milestones dm WHERE dm.deposit_id = d.id) AND NOT EXISTS (SELECT 1 FROM deposit_milestones dm WHERE dm.deposit_id = d.id AND dm.status NOT IN ('paid', 'approved', 'completed'))))";
                        }
                    }

                    // 3. Owners / Sales Filter
                    if ($ownersParam !== '' && $ownersParam !== 'all') {
                        $ownList = array_filter(array_map('trim', explode(',', $ownersParam)));
                        if (!empty($ownList)) {
                            $ownOrs = [];
                            foreach ($ownList as $own) {
                                if (is_numeric($own)) {
                                    $ownOrs[] = "(d.created_by = ? OR c.owner_id = ?)";
                                    $params[] = (int)$own;
                                    $params[] = (int)$own;
                                } else {
                                    $fzU = self::buildVietnameseFuzzyNameWhere('u.full_name', $own, $params);
                                    $fzUc = self::buildVietnameseFuzzyNameWhere('u_c.full_name', $own, $params);
                                    $ownOrs[] = "({$fzU} OR {$fzUc})";
                                }
                            }
                            $where[] = "(" . implode(' OR ', $ownOrs) . ")";
                        }
                    }

                    // 4. Branch / City Filter
                    if ($citiesParam !== '' && $citiesParam !== 'all') {
                        $cityList = array_filter(array_map('trim', explode(',', $citiesParam)));
                        if (!empty($cityList)) {
                            $cityOrs = [];
                            foreach ($cityList as $cItem) {
                                $cityOrs[] = "(c.city LIKE ? OR c.district LIKE ? OR c.address LIKE ?)";
                                $params[] = '%' . $cItem . '%';
                                $params[] = '%' . $cItem . '%';
                                $params[] = '%' . $cItem . '%';
                            }
                            $where[] = "(" . implode(' OR ', $cityOrs) . ")";
                        }
                    }

                    // 5. Lead Source / UTM Source Filter
                    if ($sourcesParam !== '' && $sourcesParam !== 'all') {
                        $srcList = array_filter(array_map('trim', explode(',', $sourcesParam)));
                        if (!empty($srcList)) {
                            $srcOrs = [];
                            foreach ($srcList as $sItem) {
                                $srcOrs[] = "(c.source LIKE ? OR c.utm_source LIKE ?)";
                                $params[] = '%' . $sItem . '%';
                                $params[] = '%' . $sItem . '%';
                            }
                            $where[] = "(" . implode(' OR ', $srcOrs) . ")";
                        }
                    }

                    // 6. Amount Range
                    if ($minAmount > 0) {
                        $where[] = "d.price >= ?";
                        $params[] = $minAmount;
                    }
                    if ($maxAmount > 0) {
                        $where[] = "d.price <= ?";
                        $params[] = $maxAmount;
                    }

                    // 7. Time Period / Date Range
                    if ($fromDate !== '' && $toDate !== '') {
                        $where[] = "d.created_at BETWEEN ? AND ?";
                        $params[] = $fromDate . ' 00:00:00';
                        $params[] = $toDate . ' 23:59:59';
                    } elseif ($fromDate !== '') {
                        $where[] = "d.created_at >= ?";
                        $params[] = $fromDate . ' 00:00:00';
                    } elseif ($toDate !== '') {
                        $where[] = "d.created_at <= ?";
                        $params[] = $toDate . ' 23:59:59';
                    } elseif ($period === 'today') {
                        $where[] = "d.created_at >= CURDATE() AND d.created_at <= CONCAT(CURDATE(), ' 23:59:59')";
                    } elseif ($period === 'yesterday') {
                        $where[] = "d.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND d.created_at < CURDATE()";
                    } elseif ($period === 'this_week') {
                        $where[] = "d.created_at BETWEEN ? AND ?";
                        $params[] = date('Y-m-d 00:00:00', strtotime('monday this week'));
                        $params[] = date('Y-m-d 23:59:59', strtotime('sunday this week'));
                    } elseif ($period === 'this_month') {
                        $where[] = "d.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00') AND d.created_at <= CONCAT(LAST_DAY(NOW()), ' 23:59:59')";
                    } elseif ($period === 'last_month') {
                        $where[] = "d.created_at >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m-01 00:00:00') AND d.created_at <= CONCAT(LAST_DAY(DATE_SUB(NOW(), INTERVAL 1 MONTH)), ' 23:59:59')";
                    } elseif ($period === 'this_quarter') {
                        $curMonth = (int)date('n');
                        $qStartMonth = (floor(($curMonth - 1) / 3) * 3) + 1;
                        $qEndMonth   = $qStartMonth + 2;
                        $qStart      = date('Y-' . str_pad((string)$qStartMonth, 2, '0', STR_PAD_LEFT) . '-01 00:00:00');
                        $qEnd        = date('Y-m-t 23:59:59', strtotime(date('Y-' . str_pad((string)$qEndMonth, 2, '0', STR_PAD_LEFT) . '-01')));
                        $where[]     = "d.created_at BETWEEN ? AND ?";
                        $params[]    = $qStart;
                        $params[]    = $qEnd;
                    } elseif ($period === 'this_year') {
                        $where[] = "d.created_at BETWEEN ? AND ?";
                        $params[] = date('Y-01-01 00:00:00');
                        $params[] = date('Y-12-31 23:59:59');
                    }

                    // 8. Search Keyword
                    if ($search !== '') {
                        $fzCust = self::buildVietnameseFuzzyNameWhere('c.full_name', $search, $params);
                        $like = "%{$search}%";
                        $where[] = "({$fzCust} OR c.phone LIKE ? OR p.name LIKE ? OR d.unit_code LIKE ? OR CAST(d.id AS CHAR) LIKE ?)";
                        array_push($params, $like, $like, $like, $like);
                    }

                    $whereSql = implode(' AND ', $where);
                    $baseJoins = "FROM deposits d
                                  LEFT JOIN contacts c ON d.contact_id = c.id
                                  LEFT JOIN projects p ON d.project_id = p.id
                                  LEFT JOIN users u ON d.created_by = u.id
                                  LEFT JOIN users u_c ON c.owner_id = u_c.id";

                    // Aggregate Summary
                    $stmtAgg = $db->prepare("
                        SELECT COUNT(DISTINCT d.id) as total_count,
                               COALESCE(SUM(CASE WHEN d.status NOT IN ('cancelled', 'rejected') THEN d.price ELSE 0 END), 0) as total_active_amount,
                               COALESCE(SUM(CASE WHEN d.status IN ('approved', 'completed') THEN d.price ELSE 0 END), 0) as approved_amount,
                               COALESCE(SUM(CASE WHEN d.status = 'pending' THEN d.price ELSE 0 END), 0) as pending_amount
                        {$baseJoins}
                        WHERE {$whereSql}
                    ");
                    $stmtAgg->execute($params);
                    $agg = $stmtAgg->fetch(PDO::FETCH_ASSOC);
                    $totalCount = (int)($agg['total_count'] ?? 0);

                    // Facets by Program
                    $stmtProg = $db->prepare("
                        SELECT COALESCE(NULLIF(TRIM(c.program), ''), NULLIF(TRIM(p.name), ''), 'Chưa phân loại') as program_name,
                               COUNT(DISTINCT d.id) as count,
                               COALESCE(SUM(d.price), 0) as total_amount
                        {$baseJoins}
                        WHERE {$whereSql}
                        GROUP BY program_name
                        ORDER BY total_amount DESC
                        LIMIT 10
                    ");
                    $stmtProg->execute($params);
                    $progFacets = $stmtProg->fetchAll(PDO::FETCH_ASSOC);

                    // Facets by Status
                    $stmtSt = $db->prepare("
                        SELECT COALESCE(d.status, 'pending') as status,
                               COUNT(DISTINCT d.id) as count,
                               COALESCE(SUM(d.price), 0) as total_amount
                        {$baseJoins}
                        WHERE {$whereSql}
                        GROUP BY d.status
                        ORDER BY count DESC
                    ");
                    $stmtSt->execute($params);
                    $statusFacets = $stmtSt->fetchAll(PDO::FETCH_ASSOC);

                    // Sample rows
                    $stmtRows = $db->prepare("
                        SELECT d.id, d.price, d.status, d.unit_code, d.created_at,
                               c.id as contact_id, c.full_name as customer_name, c.phone as customer_phone, c.program as contact_program, c.city,
                               p.name as project_name,
                               COALESCE(u.full_name, u_c.full_name, 'Chưa gán') as sale_name
                        {$baseJoins}
                        WHERE {$whereSql}
                        ORDER BY d.created_at DESC, d.id DESC
                        LIMIT {$limit}
                    ");
                    $stmtRows->execute($params);
                    $rows = $stmtRows->fetchAll(PDO::FETCH_ASSOC);

                    $formattedDeposits = array_map(function($r) {
                        $statusMap = [
                            'approved' => 'Đã duyệt / Đã thu',
                            'completed' => 'Hoàn tất',
                            'pending' => 'Chờ kế toán duyệt',
                            'rejected' => 'Từ chối',
                            'cancelled' => 'Đã hủy'
                        ];
                        $stLabel = $statusMap[$r['status'] ?? 'pending'] ?? ($r['status'] ?? 'Chờ duyệt');
                        $prog = $r['contact_program'] ?: ($r['project_name'] ?: 'N/A');
                        $card = self::buildEntitySmartCard('deposit', [
                            'id' => $r['id'],
                            'title' => 'Phiếu thu / Đặt cọc #' . $r['id'] . ' - ' . ($r['customer_name'] ?: 'Khách hàng'),
                            'subtitle' => number_format((float)$r['price'], 0, ',', '.') . ' VNĐ • ' . $prog,
                            'status' => $stLabel,
                            'status_color' => in_array($r['status'], ['approved', 'completed'], true) ? 'emerald' : ($r['status'] === 'pending' ? 'amber' : 'red'),
                            'metrics' => [
                                ['label' => 'Khách hàng', 'value' => ($r['customer_name'] ?: 'N/A') . ($r['customer_phone'] ? ' (' . $r['customer_phone'] . ')' : '')],
                                ['label' => 'Số tiền', 'value' => number_format((float)$r['price'], 0, ',', '.') . ' VNĐ'],
                                ['label' => 'Chương trình', 'value' => $prog],
                                ['label' => 'Sale phụ trách', 'value' => $r['sale_name']]
                            ],
                            'url' => '/sales-orders?id=' . $r['id']
                        ]);
                        return [
                            'id' => (int)$r['id'],
                            'customer_name' => $r['customer_name'] ?: 'N/A',
                            'customer_phone' => $r['customer_phone'] ?: '',
                            'program' => $prog,
                            'amount_formatted' => number_format((float)$r['price'], 0, ',', '.') . ' VNĐ',
                            'status' => $stLabel,
                            'sale_name' => $r['sale_name'],
                            'created_at' => $r['created_at'],
                            'smart_card' => $card
                        ];
                    }, $rows);

                    $chartData = [];
                    foreach ($progFacets as $pf) {
                        $chartData[] = [
                            'name' => mb_substr((string)$pf['program_name'], 0, 22),
                            'amount' => round(((float)$pf['total_amount']) / 1000000, 2),
                            'count' => (int)$pf['count']
                        ];
                    }

                    // Build 100% Parity Export URL
                    $depExportParams = ['type' => 'deposit'];
                    if ($programsParam !== '' && $programsParam !== 'all') $depExportParams['programs'] = $programsParam;
                    if ($statusesParam !== '' && $statusesParam !== 'all') $depExportParams['status'] = $statusesParam;
                    if ($milestoneStatus !== '' && $milestoneStatus !== 'all') $depExportParams['milestone_status'] = $milestoneStatus;
                    if ($ownersParam !== '' && $ownersParam !== 'all') $depExportParams['owners'] = $ownersParam;
                    if ($citiesParam !== '' && $citiesParam !== 'all') $depExportParams['city'] = $citiesParam;
                    if ($sourcesParam !== '' && $sourcesParam !== 'all') $depExportParams['source'] = $sourcesParam;
                    if ($minAmount > 0) $depExportParams['min_amount'] = $minAmount;
                    if ($maxAmount > 0) $depExportParams['max_amount'] = $maxAmount;
                    if ($period !== '') $depExportParams['period'] = $period;
                    if ($fromDate !== '') $depExportParams['from'] = $fromDate;
                    if ($toDate !== '') $depExportParams['to'] = $toDate;
                    if ($search !== '') $depExportParams['search'] = $search;
                    $depExportUrl = '/export?' . http_build_query($depExportParams);

                    return [
                        'success' => true,
                        'total_matching' => $totalCount,
                        'financial_summary' => [
                            'total_count' => $totalCount,
                            'total_active_amount' => number_format((float)($agg['total_active_amount'] ?? 0), 0, ',', '.') . ' VNĐ',
                            'approved_amount' => number_format((float)($agg['approved_amount'] ?? 0), 0, ',', '.') . ' VNĐ',
                            'pending_amount' => number_format((float)($agg['pending_amount'] ?? 0), 0, ',', '.') . ' VNĐ'
                        ],
                        'facets_by_program' => $progFacets,
                        'facets_by_status' => $statusFacets,
                        'dynamic_chart' => !empty($chartData) ? [
                            'type' => 'bar',
                            'title' => 'Doanh thu Đặt cọc theo Chương trình (Triệu VNĐ)',
                            'xAxisKey' => 'name',
                            'data' => $chartData,
                            'series' => [
                                ['dataKey' => 'amount', 'name' => 'Doanh thu (Tr. VNĐ)', 'color' => '#10b981']
                            ]
                        ] : null,
                        'sample_deposits' => $formattedDeposits,
                        'export_url' => $depExportUrl,
                        'export_markdown' => "[Bấm vào đây để tải danh sách Phiếu thu / Đặt cọc ({$totalCount} bản ghi)]({$depExportUrl})"
                    ];
                }

                // =========================================================================
                // TOOL: query_tasks_and_projects_multitier (MULTI-TIER TASK & WORKFLOW ENGINE)
                // =========================================================================
                case 'query_tasks_and_projects_multitier': {
                    $statusesParam    = trim((string)($args['statuses'] ?? $args['status'] ?? ''));
                    $prioritiesParam  = trim((string)($args['priorities'] ?? $args['priority'] ?? ''));
                    $assigneesParam   = trim((string)($args['assignees'] ?? $args['assigned_to'] ?? $args['user_id'] ?? ''));
                    $creatorsParam    = trim((string)($args['creators'] ?? $args['created_by'] ?? ''));
                    $departmentsParam = trim((string)($args['departments'] ?? $args['department'] ?? ''));
                    $relatedType      = strtolower(trim((string)($args['related_type'] ?? '')));
                    $relatedId        = isset($args['related_id']) && $args['related_id'] !== '' ? (int)$args['related_id'] : (isset($args['contact_id']) && $args['contact_id'] !== '' ? (int)$args['contact_id'] : 0);
                    $taskGroupId      = isset($args['task_group_id']) && $args['task_group_id'] !== '' && $args['task_group_id'] !== 'all' ? (int)$args['task_group_id'] : 0;
                    $teamId           = isset($args['team_id']) && $args['team_id'] !== '' && $args['team_id'] !== 'all' && $args['team_id'] !== 'all_teams_bypass' ? (int)$args['team_id'] : 0;
                    $overdueOnly      = !empty($args['overdue_only']) && in_array(strtolower((string)$args['overdue_only']), ['1', 'true', 'yes'], true);
                    $dateField        = strtolower(trim((string)($args['date_field'] ?? 'due_date')));
                    $period           = strtolower(trim((string)($args['period'] ?? '')));
                    $fromDate         = trim((string)($args['from_date'] ?? $args['from'] ?? $args['start_date'] ?? ''));
                    $toDate           = trim((string)($args['to_date'] ?? $args['to'] ?? $args['end_date'] ?? ''));
                    $search           = trim((string)($args['search'] ?? $args['search_query'] ?? ''));
                    $limit            = max(1, min(100, (int)($args['limit'] ?? 20)));

                    $where = ['t.tenant_id = ?', 't.deleted_at IS NULL', "t.type = 'task'"];
                    $params = [$tid];

                    // Always isolate personal tasks from other users
                    $where[] = "(NOT (IFNULL(t.tags, '') LIKE '%personal_task%' OR IFNULL(t.tags, '') LIKE '%ca_nhan%') OR t.user_id = ? OR t.created_by = ?)";
                    array_push($params, $uid, $uid);

                    // Zero-Trust RBAC
                    $isTaskAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'ceo', 'hr', 'sale_admin', 'saleadmin'], true);
                    $isManager   = in_array($role, ['manager', 'truong_phong', 'leader', 'team_lead'], true);
                    if (!$isTaskAdmin) {
                        if ($isManager) {
                            $where[] = "(t.user_id = ? OR t.created_by = ? OR t.approver_id = ? OR FIND_IN_SET(?, IFNULL(t.participant_ids, '')) > 0 OR t.user_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id))))) OR t.created_by IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id))))))";
                            array_push($params, $uid, $uid, $uid, (string)$uid, $uid, $uid);
                        } else {
                            $where[] = "(t.user_id = ? OR t.created_by = ? OR t.approver_id = ? OR FIND_IN_SET(?, IFNULL(t.participant_ids, '')) > 0)";
                            array_push($params, $uid, $uid, $uid, (string)$uid);
                        }
                    }

                    // 1. Status Filter
                    if ($statusesParam !== '' && $statusesParam !== 'all') {
                        $stList = array_filter(array_map('trim', explode(',', strtolower($statusesParam))));
                        if (!empty($stList)) {
                            $stOrs = [];
                            foreach ($stList as $st) {
                                if ($st === 'in_progress') {
                                    $stOrs[] = "(t.status = 'in_progress' OR (t.status = 'planned' AND t.progress > 0 AND t.progress < 100))";
                                } elseif (in_array($st, ['planned', 'open', 'open_only', 'not_done', 'active', 'todo'], true)) {
                                    $stOrs[] = "(t.status NOT IN ('done', 'completed', 'cancelled') AND (t.progress < 100 OR t.progress IS NULL))";
                                } elseif ($st === 'done' || $st === 'completed') {
                                    $stOrs[] = "(t.status IN ('done', 'completed') OR t.progress >= 100)";
                                } elseif ($st === 'overdue') {
                                    $stOrs[] = "(t.due_date IS NOT NULL AND t.due_date < NOW() AND t.status NOT IN ('done', 'completed', 'cancelled') AND (t.progress < 100 OR t.progress IS NULL))";
                                } else {
                                    $stOrs[] = "t.status = ?";
                                    $params[] = $st;
                                }
                            }
                            if (!empty($stOrs)) {
                                $where[] = "(" . implode(' OR ', $stOrs) . ")";
                            }
                        }
                    }

                    // 2. Priority Filter
                    if ($prioritiesParam !== '' && $prioritiesParam !== 'all') {
                        $prList = array_filter(array_map('trim', explode(',', strtolower($prioritiesParam))));
                        if (!empty($prList)) {
                            $placeholders = implode(',', array_fill(0, count($prList), '?'));
                            $where[] = "t.priority IN ({$placeholders})";
                            foreach ($prList as $pr) {
                                $params[] = $pr;
                            }
                        }
                    }

                    // 3. Assignees Filter
                    if ($assigneesParam !== '' && $assigneesParam !== 'all') {
                        $assList = array_filter(array_map('trim', explode(',', $assigneesParam)));
                        if (!empty($assList)) {
                            $assOrs = [];
                            foreach ($assList as $a) {
                                if (is_numeric($a)) {
                                    $assOrs[] = "t.user_id = ?";
                                    $params[] = (int)$a;
                                } else {
                                    $assOrs[] = self::buildVietnameseFuzzyNameWhere('u_ass.full_name', $a, $params);
                                }
                            }
                            $where[] = "(" . implode(' OR ', $assOrs) . ")";
                        }
                    }

                    // 4. Creators Filter
                    if ($creatorsParam !== '' && $creatorsParam !== 'all') {
                        $crList = array_filter(array_map('trim', explode(',', $creatorsParam)));
                        if (!empty($crList)) {
                            $crOrs = [];
                            foreach ($crList as $cr) {
                                if (is_numeric($cr)) {
                                    $crOrs[] = "t.created_by = ?";
                                    $params[] = (int)$cr;
                                } else {
                                    $crOrs[] = self::buildVietnameseFuzzyNameWhere('u_cr.full_name', $cr, $params);
                                }
                            }
                            $where[] = "(" . implode(' OR ', $crOrs) . ")";
                        }
                    }

                    // 4B. Departments / Team / Project Filter
                    if ($departmentsParam !== '' && $departmentsParam !== 'all') {
                        $deptList = array_filter(array_map('trim', explode(',', $departmentsParam)));
                        if (!empty($deptList)) {
                            $deptOrs = [];
                            foreach ($deptList as $dItem) {
                                $likeD = '%' . $dItem . '%';
                                $deptOrs[] = "(u_ass.department LIKE ? OR u_cr.department LIKE ? OR tm_ass.name LIKE ? OR p.name LIKE ?)";
                                array_push($params, $likeD, $likeD, $likeD, $likeD);
                            }
                            $where[] = "(" . implode(' OR ', $deptOrs) . ")";
                        }
                    }

                    if ($taskGroupId > 0) {
                        $where[] = "t.task_group_id = ?";
                        $params[] = $taskGroupId;
                    }

                    if ($teamId > 0) {
                        $where[] = "(t.user_id IN (SELECT id FROM users WHERE team_id = ? AND tenant_id = ?))";
                        $params[] = $teamId;
                        $params[] = $tid;
                    }

                    // 5. Related Type & Related ID Filter
                    if ($relatedType !== '' && $relatedType !== 'all') {
                        $where[] = "t.related_type = ?";
                        $params[] = $relatedType;
                    }

                    if ($relatedId > 0) {
                        $where[] = "(t.related_id = ? OR t.contact_id = ?)";
                        $params[] = $relatedId;
                        $params[] = $relatedId;
                    }

                    // 6. Overdue Only Filter
                    if ($overdueOnly) {
                        $where[] = "t.due_date IS NOT NULL AND t.due_date < NOW() AND t.status NOT IN ('done', 'completed', 'cancelled') AND (t.progress < 100 OR t.progress IS NULL)";
                    }

                    // 7. Date Range / Period Filter
                    $colDateMap = [
                        'due_date'     => 't.due_date',
                        'created_at'   => 't.created_at',
                        'completed_at' => 't.done_at',
                        'done_at'      => 't.done_at',
                    ];
                    $colDate = $colDateMap[$dateField] ?? 't.due_date';
                    if ($fromDate !== '' && $toDate !== '') {
                        $where[] = "{$colDate} BETWEEN ? AND ?";
                        $params[] = $fromDate . ' 00:00:00';
                        $params[] = $toDate . ' 23:59:59';
                    } elseif ($fromDate !== '') {
                        $where[] = "{$colDate} >= ?";
                        $params[] = $fromDate . ' 00:00:00';
                    } elseif ($toDate !== '') {
                        $where[] = "{$colDate} <= ?";
                        $params[] = $toDate . ' 23:59:59';
                    } elseif ($period === 'today') {
                        $where[] = "{$colDate} >= CURDATE() AND {$colDate} <= CONCAT(CURDATE(), ' 23:59:59')";
                    } elseif ($period === 'this_week') {
                        $where[] = "{$colDate} BETWEEN ? AND ?";
                        $params[] = date('Y-m-d 00:00:00', strtotime('monday this week'));
                        $params[] = date('Y-m-d 23:59:59', strtotime('sunday this week'));
                    } elseif ($period === 'this_month') {
                        $where[] = "{$colDate} >= DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00') AND {$colDate} <= CONCAT(LAST_DAY(NOW()), ' 23:59:59')";
                    } elseif ($period === 'last_month') {
                        $where[] = "{$colDate} >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m-01 00:00:00') AND {$colDate} <= CONCAT(LAST_DAY(DATE_SUB(NOW(), INTERVAL 1 MONTH)), ' 23:59:59')";
                    }

                    // 8. Search Keyword
                    if ($search !== '') {
                        $like = "%{$search}%";
                        $where[] = "(t.subject LIKE ? OR t.body LIKE ? OR u_ass.full_name LIKE ? OR p.name LIKE ? OR c.full_name LIKE ?)";
                        array_push($params, $like, $like, $like, $like, $like);
                    }

                    $whereSql = implode(' AND ', $where);
                    $baseJoins = "FROM activities t
                                  LEFT JOIN users u_ass ON t.user_id = u_ass.id
                                  LEFT JOIN teams tm_ass ON u_ass.team_id = tm_ass.id
                                  LEFT JOIN users u_cr ON t.created_by = u_cr.id
                                  LEFT JOIN projects p ON (t.related_type = 'project' AND t.related_id = p.id)
                                  LEFT JOIN contacts c ON ((t.related_type IN ('contact', 'lead') AND t.related_id = c.id) OR t.contact_id = c.id) AND c.deleted_at IS NULL";

                    // Aggregate Summary
                    $stmtAgg = $db->prepare("
                        SELECT COUNT(DISTINCT t.id) as total_count,
                               SUM(CASE WHEN (t.status IN ('done', 'completed') OR t.progress >= 100) THEN 1 ELSE 0 END) as completed_count,
                               SUM(CASE WHEN (t.status = 'in_progress' OR (t.status = 'planned' AND t.progress > 0 AND t.progress < 100)) THEN 1 ELSE 0 END) as in_progress_count,
                               SUM(CASE WHEN (t.status IN ('todo', 'planned') AND (t.progress IS NULL OR t.progress = 0)) THEN 1 ELSE 0 END) as todo_count,
                               SUM(CASE WHEN t.due_date IS NOT NULL AND t.due_date < NOW() AND t.status NOT IN ('done', 'completed', 'cancelled') AND (t.progress < 100 OR t.progress IS NULL) THEN 1 ELSE 0 END) as overdue_count
                        {$baseJoins}
                        WHERE {$whereSql}
                    ");
                    $stmtAgg->execute($params);
                    $agg = $stmtAgg->fetch(PDO::FETCH_ASSOC);
                    $totalCount = (int)($agg['total_count'] ?? 0);

                    // Facets by Status
                    $stmtSt = $db->prepare("
                        SELECT COALESCE(t.status, 'todo') as status,
                               COUNT(DISTINCT t.id) as count
                        {$baseJoins}
                        WHERE {$whereSql}
                        GROUP BY t.status
                        ORDER BY count DESC
                    ");
                    $stmtSt->execute($params);
                    $statusFacets = $stmtSt->fetchAll(PDO::FETCH_ASSOC);

                    // Facets by Assignee
                    $stmtAss = $db->prepare("
                        SELECT COALESCE(u_ass.full_name, 'Chưa phân công') as assignee_name,
                               COUNT(DISTINCT t.id) as total_tasks,
                               SUM(CASE WHEN t.due_date IS NOT NULL AND t.due_date < NOW() AND t.status NOT IN ('done', 'completed', 'cancelled') AND (t.progress < 100 OR t.progress IS NULL) THEN 1 ELSE 0 END) as overdue_tasks
                        {$baseJoins}
                        WHERE {$whereSql}
                        GROUP BY u_ass.id, u_ass.full_name
                        ORDER BY total_tasks DESC
                        LIMIT 10
                    ");
                    $stmtAss->execute($params);
                    $assigneeFacets = $stmtAss->fetchAll(PDO::FETCH_ASSOC);

                    // Sample rows
                    $stmtRows = $db->prepare("
                        SELECT t.id, t.subject as title, t.body as description, t.status, t.priority, t.progress, t.due_date, t.done_at as completed_at, t.created_at,
                               t.related_type, t.related_id,
                               COALESCE(u_ass.full_name, 'Chưa phân công') as assignee_name,
                               COALESCE(u_cr.full_name, 'Hệ thống') as creator_name,
                               COALESCE(p.name, c.full_name, '') as related_name
                        {$baseJoins}
                        WHERE {$whereSql}
                        ORDER BY CASE WHEN t.due_date IS NOT NULL AND t.due_date < NOW() AND t.status NOT IN ('done', 'completed', 'cancelled') AND (t.progress < 100 OR t.progress IS NULL) THEN 0 ELSE 1 END ASC,
                                 t.due_date ASC, t.id DESC
                        LIMIT {$limit}
                    ");
                    $stmtRows->execute($params);
                    $rows = $stmtRows->fetchAll(PDO::FETCH_ASSOC);

                    $formattedTasks = array_map(function($r) {
                        $isOverdue = !empty($r['due_date']) && strtotime($r['due_date']) < time() && !in_array($r['status'], ['done', 'completed', 'cancelled'], true) && (int)($r['progress'] ?? 0) < 100;
                        return [
                            'id' => (int)$r['id'],
                            'title' => $r['title'],
                            'status' => $r['status'],
                            'priority' => $r['priority'],
                            'assignee_name' => $r['assignee_name'],
                            'creator_name' => $r['creator_name'],
                            'due_date' => $r['due_date'],
                            'is_overdue' => $isOverdue,
                            'related_name' => $r['related_name'],
                            'url' => '/workspace?task_id=' . $r['id']
                        ];
                    }, $rows);

                    $chartData = [];
                    foreach ($assigneeFacets as $af) {
                        $chartData[] = [
                            'name' => mb_substr((string)$af['assignee_name'], 0, 18),
                            'total' => (int)$af['total_tasks'],
                            'overdue' => (int)$af['overdue_tasks']
                        ];
                    }

                    // Build 100% Parity Export URL
                    $taskExportParams = ['type' => 'task'];
                    if ($statusesParam !== '' && $statusesParam !== 'all') $taskExportParams['status'] = $statusesParam;
                    if ($prioritiesParam !== '' && $prioritiesParam !== 'all') $taskExportParams['priority'] = $prioritiesParam;
                    if ($assigneesParam !== '' && $assigneesParam !== 'all') $taskExportParams['assignees'] = $assigneesParam;
                    if ($creatorsParam !== '' && $creatorsParam !== 'all') $taskExportParams['creators'] = $creatorsParam;
                    if ($departmentsParam !== '' && $departmentsParam !== 'all') $taskExportParams['departments'] = $departmentsParam;
                    if ($taskGroupId > 0) $taskExportParams['task_group_id'] = $taskGroupId;
                    if ($teamId > 0) $taskExportParams['team_id'] = $teamId;
                    if ($relatedType !== '' && $relatedType !== 'all') $taskExportParams['related_type'] = $relatedType;
                    if ($relatedId > 0) $taskExportParams['related_id'] = $relatedId;
                    if ($overdueOnly) $taskExportParams['overdue_only'] = '1';
                    if ($dateField !== 'due_date') $taskExportParams['date_field'] = $dateField;
                    if ($period !== '') $taskExportParams['period'] = $period;
                    if ($fromDate !== '') $taskExportParams['from'] = $fromDate;
                    if ($toDate !== '') $taskExportParams['to'] = $toDate;
                    if ($search !== '') $taskExportParams['search'] = $search;
                    $taskExportUrl = '/export?' . http_build_query($taskExportParams);

                    return [
                        'success' => true,
                        'total_matching' => $totalCount,
                        'task_summary' => [
                            'total_count' => $totalCount,
                            'completed_count' => (int)($agg['completed_count'] ?? 0),
                            'in_progress_count' => (int)($agg['in_progress_count'] ?? 0),
                            'todo_count' => (int)($agg['todo_count'] ?? 0),
                            'overdue_count' => (int)($agg['overdue_count'] ?? 0)
                        ],
                        'facets_by_status' => $statusFacets,
                        'facets_by_assignee' => $assigneeFacets,
                        'dynamic_chart' => !empty($chartData) ? [
                            'type' => 'bar',
                            'title' => 'Phân bổ Công việc & Quá hạn theo Nhân sự',
                            'xAxisKey' => 'name',
                            'data' => $chartData,
                            'series' => [
                                ['dataKey' => 'total', 'name' => 'Tổng việc', 'color' => '#3b82f6'],
                                ['dataKey' => 'overdue', 'name' => 'Quá hạn', 'color' => '#ef4444']
                            ]
                        ] : null,
                        'sample_tasks' => $formattedTasks,
                        'export_url' => $taskExportUrl,
                        'export_markdown' => "[Bấm vào đây để tải danh sách Công việc ({$totalCount} bản ghi)]({$taskExportUrl})"
                    ];
                }

                // =========================================================================
                // TOOL: query_deals_and_b2b_multitier (MULTI-TIER DEALS & B2B PIPELINE ENGINE)
                // =========================================================================
                case 'query_deals_and_b2b_multitier': {
                    $stagesParam     = trim((string)($args['stages'] ?? $args['stage_ids'] ?? ''));
                    $statusesParam   = strtolower(trim((string)($args['statuses'] ?? $args['status'] ?? '')));
                    $prioritiesParam = strtolower(trim((string)($args['priorities'] ?? $args['priority'] ?? '')));
                    $ownersParam     = trim((string)($args['owners'] ?? $args['owner_id'] ?? ''));
                    $minValue        = isset($args['min_value']) && is_numeric($args['min_value']) ? (float)$args['min_value'] : (isset($args['min_amount']) && is_numeric($args['min_amount']) ? (float)$args['min_amount'] : 0);
                    $maxValue        = isset($args['max_value']) && is_numeric($args['max_value']) ? (float)$args['max_value'] : (isset($args['max_amount']) && is_numeric($args['max_amount']) ? (float)$args['max_amount'] : 0);
                    $period          = strtolower(trim((string)($args['period'] ?? '')));
                    $fromDate        = trim((string)($args['from_date'] ?? $args['from'] ?? ''));
                    $toDate          = trim((string)($args['to_date'] ?? $args['to'] ?? ''));
                    $search          = trim((string)($args['search'] ?? $args['search_query'] ?? ''));
                    $limit           = max(1, min(100, (int)($args['limit'] ?? 20)));

                    $where = ['d.tenant_id = ?', 'd.deleted_at IS NULL'];
                    $params = [$tid];

                    // Zero-Trust RBAC
                    $isDealAdmin = $canViewAllLeads || in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'ceo', 'sale_admin', 'saleadmin', 'accountant', 'ke_toan'], true);
                    if (!$isDealAdmin) {
                        if ($canViewTeamLeads) {
                            $where[] = "(d.owner_id = ? OR c.owner_id = ? OR d.owner_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))) OR (? > 0 AND team_id = ?)))";
                            array_push($params, $uid, $uid, $uid, $teamId, $teamId);
                        } else {
                            $where[] = "(d.owner_id = ? OR c.owner_id = ?)";
                            array_push($params, $uid, $uid);
                        }
                    }

                    if ($stagesParam !== '' && $stagesParam !== 'all') {
                        $stList = array_filter(array_map('trim', explode(',', $stagesParam)));
                        if (!empty($stList)) {
                            $stOrs = [];
                            foreach ($stList as $sItem) {
                                if (is_numeric($sItem)) {
                                    $stOrs[] = "d.stage_id = ?";
                                    $params[] = (int)$sItem;
                                } else {
                                    $stOrs[] = "ps.name LIKE ?";
                                    $params[] = '%' . $sItem . '%';
                                }
                            }
                            $where[] = "(" . implode(' OR ', $stOrs) . ")";
                        }
                    }

                    if ($statusesParam !== '' && $statusesParam !== 'all') {
                        $statusList = array_filter(array_map('trim', explode(',', $statusesParam)));
                        if (!empty($statusList)) {
                            $sOrs = [];
                            foreach ($statusList as $st) {
                                if ($st === 'won') {
                                    $sOrs[] = "(d.status = 'won' OR ps.is_won = 1)";
                                } elseif ($st === 'lost') {
                                    $sOrs[] = "(d.status = 'lost' OR ps.is_lost = 1)";
                                } elseif ($st === 'open') {
                                    $sOrs[] = "(COALESCE(d.status, 'open') = 'open' AND COALESCE(ps.is_won, 0) = 0 AND COALESCE(ps.is_lost, 0) = 0)";
                                } else {
                                    $sOrs[] = "d.status = ?";
                                    $params[] = $st;
                                }
                            }
                            $where[] = "(" . implode(' OR ', $sOrs) . ")";
                        }
                    }

                    if ($prioritiesParam !== '' && $prioritiesParam !== 'all') {
                        $prList = array_filter(array_map('trim', explode(',', $prioritiesParam)));
                        if (!empty($prList)) {
                            $ph = implode(',', array_fill(0, count($prList), '?'));
                            $where[] = "d.priority IN ({$ph})";
                            foreach ($prList as $pr) $params[] = $pr;
                        }
                    }

                    if ($ownersParam !== '' && $ownersParam !== 'all') {
                        $ownList = array_filter(array_map('trim', explode(',', $ownersParam)));
                        if (!empty($ownList)) {
                            $ownOrs = [];
                            foreach ($ownList as $own) {
                                if (is_numeric($own)) {
                                    $ownOrs[] = "d.owner_id = ?";
                                    $params[] = (int)$own;
                                } else {
                                    $ownOrs[] = "u.full_name LIKE ?";
                                    $params[] = '%' . $own . '%';
                                }
                            }
                            $where[] = "(" . implode(' OR ', $ownOrs) . ")";
                        }
                    }

                    if ($minValue > 0) {
                        $where[] = "d.value >= ?";
                        $params[] = $minValue;
                    }
                    if ($maxValue > 0) {
                        $where[] = "d.value <= ?";
                        $params[] = $maxValue;
                    }

                    if ($fromDate !== '' && $toDate !== '') {
                        $where[] = "d.created_at BETWEEN ? AND ?";
                        $params[] = $fromDate . ' 00:00:00';
                        $params[] = $toDate . ' 23:59:59';
                    } elseif ($fromDate !== '') {
                        $where[] = "d.created_at >= ?";
                        $params[] = $fromDate . ' 00:00:00';
                    } elseif ($toDate !== '') {
                        $where[] = "d.created_at <= ?";
                        $params[] = $toDate . ' 23:59:59';
                    } elseif ($period === 'today') {
                        $where[] = "d.created_at >= CURDATE() AND d.created_at <= CONCAT(CURDATE(), ' 23:59:59')";
                    } elseif ($period === 'this_week') {
                        $where[] = "YEARWEEK(d.created_at, 1) = YEARWEEK(CURDATE(), 1)";
                    } elseif ($period === 'this_month') {
                        $where[] = "d.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00') AND d.created_at <= CONCAT(LAST_DAY(NOW()), ' 23:59:59')";
                    } elseif ($period === 'last_month') {
                        $where[] = "d.created_at >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m-01 00:00:00') AND d.created_at <= CONCAT(LAST_DAY(DATE_SUB(NOW(), INTERVAL 1 MONTH)), ' 23:59:59')";
                    } elseif ($period === 'this_quarter') {
                        $where[] = "QUARTER(d.created_at) = QUARTER(NOW()) AND YEAR(d.created_at) = YEAR(NOW())";
                    } elseif ($period === 'this_year') {
                        $where[] = "YEAR(d.created_at) = YEAR(NOW())";
                    }

                    if ($search !== '') {
                        $like = "%{$search}%";
                        $where[] = "(d.title LIKE ? OR co.name LIKE ? OR c.full_name LIKE ? OR u.full_name LIKE ?)";
                        array_push($params, $like, $like, $like, $like);
                    }

                    $whereSql = implode(' AND ', $where);
                    $baseJoins = "FROM deals d
                                  LEFT JOIN pipeline_stages ps ON d.stage_id = ps.id
                                  LEFT JOIN companies co ON (d.company_id = co.id AND co.deleted_at IS NULL)
                                  LEFT JOIN contacts c ON (d.contact_id = c.id AND c.deleted_at IS NULL)
                                  LEFT JOIN users u ON d.owner_id = u.id";

                    $stmtAgg = $db->prepare("
                        SELECT COUNT(DISTINCT d.id) as total_count,
                               COALESCE(SUM(d.value), 0) as total_value,
                               COALESCE(SUM(d.value * COALESCE(d.probability, 50) / 100), 0) as weighted_value,
                               COALESCE(SUM(CASE WHEN d.status = 'won' OR ps.is_won = 1 THEN d.value ELSE 0 END), 0) as won_value,
                               COALESCE(SUM(CASE WHEN COALESCE(d.status, 'open') = 'open' AND COALESCE(ps.is_won, 0) = 0 AND COALESCE(ps.is_lost, 0) = 0 THEN d.value ELSE 0 END), 0) as open_value
                        {$baseJoins}
                        WHERE {$whereSql}
                    ");
                    $stmtAgg->execute($params);
                    $agg = $stmtAgg->fetch(PDO::FETCH_ASSOC);
                    $totalCount = (int)($agg['total_count'] ?? 0);

                    $stmtStage = $db->prepare("
                        SELECT COALESCE(ps.name, 'Chưa phân giai đoạn') as stage_name,
                               COUNT(DISTINCT d.id) as count,
                               COALESCE(SUM(d.value), 0) as total_value
                        {$baseJoins}
                        WHERE {$whereSql}
                        GROUP BY ps.id, ps.name
                        ORDER BY total_value DESC
                    ");
                    $stmtStage->execute($params);
                    $stageFacets = $stmtStage->fetchAll(PDO::FETCH_ASSOC);

                    $stmtRows = $db->prepare("
                        SELECT d.id, d.title, d.value, d.currency, d.probability, d.expected_close_date, d.priority, d.status, d.created_at,
                               COALESCE(ps.name, 'Chưa phân giai đoạn') as stage_name,
                               COALESCE(co.name, '') as company_name,
                               COALESCE(c.full_name, '') as contact_name,
                               COALESCE(u.full_name, 'Chưa gán') as owner_name
                        {$baseJoins}
                        WHERE {$whereSql}
                        ORDER BY d.value DESC, d.id DESC
                        LIMIT {$limit}
                    ");
                    $stmtRows->execute($params);
                    $rows = $stmtRows->fetchAll(PDO::FETCH_ASSOC);

                    $formattedDeals = array_map(function($r) {
                        $valStr = number_format((float)$r['value'], 0, ',', '.') . ' ' . ($r['currency'] ?: 'VND');
                        $clientLabel = $r['company_name'] ?: ($r['contact_name'] ?: 'Khách hàng B2B');
                        $card = self::buildEntitySmartCard('deal', [
                            'id' => $r['id'],
                            'title' => $r['title'],
                            'subtitle' => "{$valStr} • {$clientLabel}",
                            'status' => $r['stage_name'],
                            'meta' => 'Sale: ' . $r['owner_name'] . ' (' . (int)($r['probability'] ?? 0) . '%)',
                            'url' => '/deals?id=' . $r['id']
                        ]);
                        return [
                            'id' => (int)$r['id'],
                            'title' => $r['title'],
                            'value_formatted' => $valStr,
                            'probability' => (int)($r['probability'] ?? 0) . '%',
                            'stage_name' => $r['stage_name'],
                            'company_name' => $r['company_name'],
                            'contact_name' => $r['contact_name'],
                            'owner_name' => $r['owner_name'],
                            'expected_close_date' => $r['expected_close_date'],
                            'smart_card' => $card
                        ];
                    }, $rows);

                    $chartData = [];
                    foreach ($stageFacets as $sf) {
                        $chartData[] = [
                            'name' => mb_substr((string)$sf['stage_name'], 0, 20),
                            'amount' => round(((float)$sf['total_value']) / 1000000, 2),
                            'count' => (int)$sf['count']
                        ];
                    }

                    $dealExportParams = ['type' => 'deal'];
                    if ($stagesParam !== '' && $stagesParam !== 'all') $dealExportParams['stages'] = $stagesParam;
                    if ($statusesParam !== '' && $statusesParam !== 'all') $dealExportParams['status'] = $statusesParam;
                    if ($prioritiesParam !== '' && $prioritiesParam !== 'all') $dealExportParams['priority'] = $prioritiesParam;
                    if ($ownersParam !== '' && $ownersParam !== 'all') $dealExportParams['owners'] = $ownersParam;
                    if ($minValue > 0) $dealExportParams['min_amount'] = $minValue;
                    if ($maxValue > 0) $dealExportParams['max_amount'] = $maxValue;
                    if ($period !== '') $dealExportParams['period'] = $period;
                    if ($fromDate !== '') $dealExportParams['from'] = $fromDate;
                    if ($toDate !== '') $dealExportParams['to'] = $toDate;
                    if ($search !== '') $dealExportParams['search'] = $search;
                    $dealExportUrl = '/export?' . http_build_query($dealExportParams);

                    return [
                        'success' => true,
                        'total_matching' => $totalCount,
                        'deal_summary' => [
                            'total_count' => $totalCount,
                            'total_pipeline_value' => number_format((float)($agg['total_value'] ?? 0), 0, ',', '.') . ' VNĐ',
                            'weighted_forecast_value' => number_format((float)($agg['weighted_value'] ?? 0), 0, ',', '.') . ' VNĐ',
                            'won_value' => number_format((float)($agg['won_value'] ?? 0), 0, ',', '.') . ' VNĐ',
                            'open_value' => number_format((float)($agg['open_value'] ?? 0), 0, ',', '.') . ' VNĐ'
                        ],
                        'facets_by_stage' => $stageFacets,
                        'dynamic_chart' => !empty($chartData) ? [
                            'type' => 'bar',
                            'title' => 'Giá trị Cơ hội Kinh doanh (Deals) theo Giai đoạn (Triệu VNĐ)',
                            'xAxisKey' => 'name',
                            'data' => $chartData,
                            'series' => [
                                ['dataKey' => 'amount', 'name' => 'Giá trị (Tr. VNĐ)', 'color' => '#6366f1']
                            ]
                        ] : null,
                        'sample_deals' => $formattedDeals,
                        'export_url' => $dealExportUrl,
                        'export_markdown' => "[Bấm vào đây để tải danh sách Cơ hội kinh doanh / Deals ({$totalCount} bản ghi)]({$dealExportUrl})"
                    ];
                }

                // =========================================================================
                // TOOL: query_tickets_and_sla_multitier (MULTI-TIER TICKETS & SLA ENGINE)
                // =========================================================================
                case 'query_tickets_and_sla_multitier': {
                    $statusesParam   = strtolower(trim((string)($args['statuses'] ?? $args['status'] ?? '')));
                    $prioritiesParam = strtolower(trim((string)($args['priorities'] ?? $args['priority'] ?? '')));
                    $categoriesParam = trim((string)($args['categories'] ?? $args['category'] ?? ''));
                    $assigneesParam  = trim((string)($args['assignees'] ?? $args['assignee_id'] ?? ''));
                    $creatorsParam   = trim((string)($args['creators'] ?? $args['created_by'] ?? ''));
                    $period          = strtolower(trim((string)($args['period'] ?? '')));
                    $fromDate        = trim((string)($args['from_date'] ?? $args['from'] ?? ''));
                    $toDate          = trim((string)($args['to_date'] ?? $args['to'] ?? ''));
                    $search          = trim((string)($args['search'] ?? $args['search_query'] ?? ''));
                    $limit           = max(1, min(100, (int)($args['limit'] ?? 20)));

                    $where = ['t.tenant_id = ?'];
                    $params = [$tid];

                    // Zero-Trust RBAC
                    $isTicketAdmin = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'ceo', 'academic', 'hoc_vu', 'hoc_thuat', 'sale_admin', 'saleadmin', 'hr'], true);
                    $isManager     = in_array($role, ['manager', 'truong_phong', 'leader', 'team_lead'], true);
                    if (!$isTicketAdmin) {
                        if ($isManager) {
                            $where[] = "(t.assignee_id = ? OR t.created_by = ? OR t.assignee_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id))))))";
                            array_push($params, $uid, $uid, $uid);
                        } else {
                            $where[] = "(t.assignee_id = ? OR t.created_by = ?)";
                            array_push($params, $uid, $uid);
                        }
                    }

                    if ($statusesParam !== '' && $statusesParam !== 'all') {
                        $stList = array_filter(array_map('trim', explode(',', $statusesParam)));
                        if (!empty($stList)) {
                            $stOrs = [];
                            foreach ($stList as $st) {
                                if ($st === 'overdue_sla') {
                                    $stOrs[] = "(t.status NOT IN ('resolved', 'closed') AND t.created_at < DATE_SUB(NOW(), INTERVAL 48 HOUR))";
                                } else {
                                    $stOrs[] = "t.status = ?";
                                    $params[] = $st;
                                }
                            }
                            $where[] = "(" . implode(' OR ', $stOrs) . ")";
                        }
                    }

                    if ($prioritiesParam !== '' && $prioritiesParam !== 'all') {
                        $prList = array_filter(array_map('trim', explode(',', $prioritiesParam)));
                        if (!empty($prList)) {
                            $ph = implode(',', array_fill(0, count($prList), '?'));
                            $where[] = "t.priority IN ({$ph})";
                            foreach ($prList as $pr) $params[] = $pr;
                        }
                    }

                    if ($categoriesParam !== '' && $categoriesParam !== 'all') {
                        $catList = array_filter(array_map('trim', explode(',', $categoriesParam)));
                        if (!empty($catList)) {
                            $catOrs = [];
                            foreach ($catList as $cItem) {
                                $catOrs[] = "t.category LIKE ?";
                                $params[] = '%' . $cItem . '%';
                            }
                            $where[] = "(" . implode(' OR ', $catOrs) . ")";
                        }
                    }

                    if ($assigneesParam !== '' && $assigneesParam !== 'all') {
                        $assList = array_filter(array_map('trim', explode(',', $assigneesParam)));
                        if (!empty($assList)) {
                            $assOrs = [];
                            foreach ($assList as $a) {
                                if (is_numeric($a)) {
                                    $assOrs[] = "t.assignee_id = ?";
                                    $params[] = (int)$a;
                                } else {
                                    $assOrs[] = self::buildVietnameseFuzzyNameWhere('u_ass.full_name', $a, $params);
                                }
                            }
                            $where[] = "(" . implode(' OR ', $assOrs) . ")";
                        }
                    }

                    if ($creatorsParam !== '' && $creatorsParam !== 'all') {
                        $crList = array_filter(array_map('trim', explode(',', $creatorsParam)));
                        if (!empty($crList)) {
                            $crOrs = [];
                            foreach ($crList as $cr) {
                                if (is_numeric($cr)) {
                                    $crOrs[] = "t.created_by = ?";
                                    $params[] = (int)$cr;
                                } else {
                                    $crOrs[] = self::buildVietnameseFuzzyNameWhere('u_cr.full_name', $cr, $params);
                                }
                            }
                            $where[] = "(" . implode(' OR ', $crOrs) . ")";
                        }
                    }

                    if ($fromDate !== '' && $toDate !== '') {
                        $where[] = "t.created_at BETWEEN ? AND ?";
                        $params[] = $fromDate . ' 00:00:00';
                        $params[] = $toDate . ' 23:59:59';
                    } elseif ($fromDate !== '') {
                        $where[] = "t.created_at >= ?";
                        $params[] = $fromDate . ' 00:00:00';
                    } elseif ($toDate !== '') {
                        $where[] = "t.created_at <= ?";
                        $params[] = $toDate . ' 23:59:59';
                    } elseif ($period === 'today') {
                        $where[] = "t.created_at >= CURDATE() AND t.created_at <= CONCAT(CURDATE(), ' 23:59:59')";
                    } elseif ($period === 'this_week') {
                        $where[] = "YEARWEEK(t.created_at, 1) = YEARWEEK(CURDATE(), 1)";
                    } elseif ($period === 'this_month') {
                        $where[] = "t.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00') AND t.created_at <= CONCAT(LAST_DAY(NOW()), ' 23:59:59')";
                    } elseif ($period === 'last_month') {
                        $where[] = "t.created_at >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m-01 00:00:00') AND t.created_at <= CONCAT(LAST_DAY(DATE_SUB(NOW(), INTERVAL 1 MONTH)), ' 23:59:59')";
                    }

                    if ($search !== '') {
                        $like = "%{$search}%";
                        $where[] = "(t.subject LIKE ? OR t.description LIKE ? OR t.customer_name LIKE ? OR u_ass.full_name LIKE ?)";
                        array_push($params, $like, $like, $like, $like);
                    }

                    $whereSql = implode(' AND ', $where);
                    $baseJoins = "FROM tickets t
                                  LEFT JOIN users u_ass ON t.assignee_id = u_ass.id
                                  LEFT JOIN users u_cr ON t.created_by = u_cr.id";

                    $stmtAgg = $db->prepare("
                        SELECT COUNT(DISTINCT t.id) as total_count,
                               SUM(CASE WHEN t.status = 'open' THEN 1 ELSE 0 END) as open_count,
                               SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
                               SUM(CASE WHEN t.status IN ('resolved', 'closed') THEN 1 ELSE 0 END) as resolved_count,
                               SUM(CASE WHEN t.status NOT IN ('resolved', 'closed') AND t.created_at < DATE_SUB(NOW(), INTERVAL 48 HOUR) THEN 1 ELSE 0 END) as sla_breach_count
                        {$baseJoins}
                        WHERE {$whereSql}
                    ");
                    $stmtAgg->execute($params);
                    $agg = $stmtAgg->fetch(PDO::FETCH_ASSOC);
                    $totalCount = (int)($agg['total_count'] ?? 0);

                    $stmtCat = $db->prepare("
                        SELECT COALESCE(NULLIF(TRIM(t.category), ''), 'Hỗ trợ chung') as category_name,
                               COUNT(DISTINCT t.id) as count
                        {$baseJoins}
                        WHERE {$whereSql}
                        GROUP BY category_name
                        ORDER BY count DESC
                    ");
                    $stmtCat->execute($params);
                    $catFacets = $stmtCat->fetchAll(PDO::FETCH_ASSOC);

                    $stmtRows = $db->prepare("
                        SELECT t.id, t.subject, t.description, t.status, t.priority, t.category, t.customer_name, t.created_at, t.updated_at,
                               COALESCE(u_ass.full_name, 'Chưa phân công') as assignee_name,
                               COALESCE(u_cr.full_name, 'Hệ thống') as creator_name
                        {$baseJoins}
                        WHERE {$whereSql}
                        ORDER BY t.created_at DESC, t.id DESC
                        LIMIT {$limit}
                    ");
                    $stmtRows->execute($params);
                    $rows = $stmtRows->fetchAll(PDO::FETCH_ASSOC);

                    $formattedTickets = array_map(function($r) {
                        $ageHours = round((time() - strtotime($r['created_at'])) / 3600, 1);
                        $slaBreach = !in_array($r['status'], ['resolved', 'closed'], true) && $ageHours > 48;
                        return [
                            'id' => (int)$r['id'],
                            'subject' => $r['subject'],
                            'category' => $r['category'] ?: 'Chung',
                            'status' => $r['status'],
                            'priority' => $r['priority'],
                            'customer_name' => $r['customer_name'] ?: 'Nội bộ',
                            'assignee_name' => $r['assignee_name'],
                            'creator_name' => $r['creator_name'],
                            'sla_breach' => $slaBreach,
                            'created_at' => $r['created_at'],
                            'url' => '/tickets?id=' . $r['id']
                        ];
                    }, $rows);

                    $chartData = [];
                    foreach ($catFacets as $cf) {
                        $chartData[] = [
                            'name' => mb_substr((string)$cf['category_name'], 0, 20),
                            'count' => (int)$cf['count']
                        ];
                    }

                    $ticketExportParams = ['type' => 'ticket'];
                    if ($statusesParam !== '' && $statusesParam !== 'all') $ticketExportParams['status'] = $statusesParam;
                    if ($prioritiesParam !== '' && $prioritiesParam !== 'all') $ticketExportParams['priority'] = $prioritiesParam;
                    if ($categoriesParam !== '' && $categoriesParam !== 'all') $ticketExportParams['category'] = $categoriesParam;
                    if ($assigneesParam !== '' && $assigneesParam !== 'all') $ticketExportParams['assignees'] = $assigneesParam;
                    if ($creatorsParam !== '' && $creatorsParam !== 'all') $ticketExportParams['creators'] = $creatorsParam;
                    if ($period !== '') $ticketExportParams['period'] = $period;
                    if ($fromDate !== '') $ticketExportParams['from'] = $fromDate;
                    if ($toDate !== '') $ticketExportParams['to'] = $toDate;
                    if ($search !== '') $ticketExportParams['search'] = $search;
                    $ticketExportUrl = '/export?' . http_build_query($ticketExportParams);

                    return [
                        'success' => true,
                        'total_matching' => $totalCount,
                        'ticket_sla_summary' => [
                            'total_count' => $totalCount,
                            'open_count' => (int)($agg['open_count'] ?? 0),
                            'in_progress_count' => (int)($agg['in_progress_count'] ?? 0),
                            'resolved_count' => (int)($agg['resolved_count'] ?? 0),
                            'sla_breach_count' => (int)($agg['sla_breach_count'] ?? 0)
                        ],
                        'facets_by_category' => $catFacets,
                        'dynamic_chart' => !empty($chartData) ? [
                            'type' => 'bar',
                            'title' => 'Phân bổ Ticket Hỗ trợ theo Danh mục',
                            'xAxisKey' => 'name',
                            'data' => $chartData,
                            'series' => [
                                ['dataKey' => 'count', 'name' => 'Số lượng Ticket', 'color' => '#f59e0b']
                            ]
                        ] : null,
                        'sample_tickets' => $formattedTickets,
                        'export_url' => $ticketExportUrl,
                        'export_markdown' => "[Bấm vào đây để tải danh sách Ticket & SLA ({$totalCount} bản ghi)]({$ticketExportUrl})"
                    ];
                }

                // =========================================================================
                // TOOL: query_hrm_workforce_and_payroll_multitier (MULTI-TIER HRM & PAYROLL ENGINE)
                // =========================================================================
                case 'query_hrm_workforce_and_payroll_multitier': {
                    $departmentsParam = trim((string)($args['departments'] ?? $args['department'] ?? ''));
                    $rolesParam       = trim((string)($args['roles'] ?? $args['role'] ?? ''));
                    $statusParam      = strtolower(trim((string)($args['status'] ?? 'active')));
                    $hasInsurance     = strtolower(trim((string)($args['has_insurance'] ?? 'all')));
                    $monthYear        = trim((string)($args['month_year'] ?? date('Y-m')));
                    $search           = trim((string)($args['search'] ?? $args['search_query'] ?? ''));
                    $limit            = max(1, min(100, (int)($args['limit'] ?? 20)));

                    $where = ['u.tenant_id = ?', "u.role NOT IN ('superadmin', 'super_admin')"];
                    $params = [$monthYear, $tid];

                    // Zero-Trust RBAC for HRM & Payroll
                    $canViewFullHrm = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'ceo', 'hr', 'nhan_su', 'accountant', 'ke_toan'], true);
                    $isManager      = in_array($role, ['manager', 'truong_phong', 'leader', 'team_lead'], true);
                    if (!$canViewFullHrm) {
                        if ($isManager) {
                            $where[] = "(u.id = ? OR u.team_id IN (SELECT id FROM teams WHERE FIND_IN_SET(?, CONCAT(leader_id, CHAR(44), COALESCE(co_leader_ids, leader_id)))))";
                            array_push($params, $uid, $uid);
                        } else {
                            $where[] = "u.id = ?";
                            $params[] = $uid;
                        }
                    }

                    if ($statusParam === 'active') {
                        $where[] = "COALESCE(u.is_active, 1) = 1";
                    } elseif ($statusParam === 'inactive') {
                        $where[] = "COALESCE(u.is_active, 1) = 0";
                    }

                    if ($departmentsParam !== '' && $departmentsParam !== 'all') {
                        $dList = array_filter(array_map('trim', explode(',', $departmentsParam)));
                        if (!empty($dList)) {
                            $dOrs = [];
                            foreach ($dList as $dItem) {
                                $likeD = '%' . $dItem . '%';
                                $dOrs[] = "(u.department LIKE ? OR tm.name LIKE ? OR tm.branch LIKE ?)";
                                array_push($params, $likeD, $likeD, $likeD);
                            }
                            $where[] = "(" . implode(' OR ', $dOrs) . ")";
                        }
                    }

                    if ($rolesParam !== '' && $rolesParam !== 'all') {
                        $rList = array_filter(array_map('trim', explode(',', $rolesParam)));
                        if (!empty($rList)) {
                            $rOrs = [];
                            foreach ($rList as $rItem) {
                                $likeR = '%' . $rItem . '%';
                                $rOrs[] = "(u.role LIKE ? OR u.job_title LIKE ?)";
                                array_push($params, $likeR, $likeR);
                            }
                            $where[] = "(" . implode(' OR ', $rOrs) . ")";
                        }
                    }

                    if ($hasInsurance === 'yes' || $hasInsurance === '1' || $hasInsurance === 'true') {
                        $where[] = "hp.has_insurance = 1";
                    } elseif ($hasInsurance === 'no' || $hasInsurance === '0' || $hasInsurance === 'false') {
                        $where[] = "COALESCE(hp.has_insurance, 0) = 0";
                    }

                    if ($search !== '') {
                        $fzStaff = self::buildVietnameseFuzzyNameWhere('u.full_name', $search, $params);
                        $like = "%{$search}%";
                        $where[] = "({$fzStaff} OR u.email LIKE ? OR u.phone LIKE ? OR u.job_title LIKE ?)";
                        array_push($params, $like, $like, $like);
                    }

                    $whereSql = implode(' AND ', $where);
                    $baseJoins = "FROM users u
                                  LEFT JOIN hrm_profiles hp ON hp.user_id = u.id
                                  LEFT JOIN teams tm ON u.team_id = tm.id
                                  LEFT JOIN monthly_payslips mp ON (mp.user_id = u.id AND mp.tenant_id = u.tenant_id AND mp.month_year = ?)";

                    $stmtAgg = $db->prepare("
                        SELECT COUNT(DISTINCT u.id) as total_staff,
                               SUM(CASE WHEN COALESCE(u.is_active, 1) = 1 THEN 1 ELSE 0 END) as active_staff,
                               SUM(CASE WHEN hp.has_insurance = 1 THEN 1 ELSE 0 END) as insured_staff,
                               COALESCE(SUM(hp.base_salary), 0) as total_base_salary,
                               COALESCE(SUM(mp.net_salary), 0) as total_net_payslip
                        {$baseJoins}
                        WHERE {$whereSql}
                    ");
                    $stmtAgg->execute($params);
                    $agg = $stmtAgg->fetch(PDO::FETCH_ASSOC);
                    $totalCount = (int)($agg['total_staff'] ?? 0);

                    $stmtDept = $db->prepare("
                        SELECT COALESCE(NULLIF(TRIM(u.department), ''), NULLIF(TRIM(tm.name), ''), 'Chưa phân phòng ban') as dept_name,
                               COUNT(DISTINCT u.id) as count
                        {$baseJoins}
                        WHERE {$whereSql}
                        GROUP BY dept_name
                        ORDER BY count DESC
                    ");
                    $stmtDept->execute($params);
                    $deptFacets = $stmtDept->fetchAll(PDO::FETCH_ASSOC);

                    $stmtRows = $db->prepare("
                        SELECT u.id, u.full_name, u.email, u.phone, u.role, u.job_title, u.department, COALESCE(u.is_active, 1) as is_active,
                               COALESCE(tm.name, '') as team_name,
                               hp.joined_date, hp.base_salary, hp.has_insurance,
                               hp.annual_leave_total, hp.annual_leave_used,
                               mp.net_salary, mp.status as payslip_status
                        {$baseJoins}
                        WHERE {$whereSql}
                        ORDER BY u.id ASC
                        LIMIT {$limit}
                    ");
                    $stmtRows->execute($params);
                    $rows = $stmtRows->fetchAll(PDO::FETCH_ASSOC);

                    $formattedStaff = array_map(function($r) use ($canViewFullHrm, $uid) {
                        $sid = (int)$r['id'];
                        $canSeeSalary = $canViewFullHrm || $sid === $uid;
                        $dept = $r['department'] ?: ($r['team_name'] ?: 'Chưa phân phòng');
                        $leaveRem = max(0, (float)($r['annual_leave_total'] ?? 12) - (float)($r['annual_leave_used'] ?? 0));
                        $isActive = (int)($r['is_active'] ?? 1) === 1;
                        return [
                            'id' => $sid,
                            'full_name' => $r['full_name'],
                            'job_title' => $r['job_title'] ?: $r['role'],
                            'department' => $dept,
                            'phone' => $r['phone'] ?: '',
                            'email' => $r['email'] ?: '',
                            'joined_date' => $r['joined_date'] ?: 'Chưa cập nhật',
                            'has_insurance' => !empty($r['has_insurance']) ? 'Có BHXH' : 'Chưa đóng',
                            'remaining_annual_leave' => $leaveRem,
                            'base_salary' => $canSeeSalary ? number_format((float)($r['base_salary'] ?? 0), 0, ',', '.') . ' VNĐ' : 'Bảo mật',
                            'net_salary_month' => $canSeeSalary && $r['net_salary'] !== null ? number_format((float)$r['net_salary'], 0, ',', '.') . ' VNĐ' : ($canSeeSalary ? 'Chưa chốt bảng lương' : 'Bảo mật'),
                            'smart_card' => self::buildEntitySmartCard('staff', [
                                'id' => $sid,
                                'name' => $r['full_name'],
                                'subtitle' => ($r['job_title'] ?: $r['role']) . ' • ' . $dept,
                                'status' => $isActive ? 'Đang làm việc' : 'Ngừng hoạt động',
                                'meta' => "Phép còn: {$leaveRem} ngày",
                                'link' => "/hrm?user_id={$sid}"
                            ])
                        ];
                    }, $rows);

                    $chartData = [];
                    foreach ($deptFacets as $df) {
                        $chartData[] = [
                            'name' => mb_substr((string)$df['dept_name'], 0, 20),
                            'count' => (int)$df['count']
                        ];
                    }

                    $staffExportParams = ['type' => 'staff'];
                    if ($departmentsParam !== '' && $departmentsParam !== 'all') $staffExportParams['departments'] = $departmentsParam;
                    if ($rolesParam !== '' && $rolesParam !== 'all') $staffExportParams['role'] = $rolesParam;
                    if ($statusParam !== '' && $statusParam !== 'all') $staffExportParams['status'] = $statusParam;
                    if ($hasInsurance !== '' && $hasInsurance !== 'all') $staffExportParams['has_insurance'] = $hasInsurance;
                    if ($monthYear !== '') $staffExportParams['month_year'] = $monthYear;
                    if ($search !== '') $staffExportParams['search'] = $search;
                    $staffExportUrl = '/export?' . http_build_query($staffExportParams);

                    return [
                        'success' => true,
                        'total_matching' => $totalCount,
                        'hrm_summary' => [
                            'total_staff' => $totalCount,
                            'active_staff' => (int)($agg['active_staff'] ?? 0),
                            'insured_staff' => (int)($agg['insured_staff'] ?? 0),
                            'total_base_salary' => $canViewFullHrm ? number_format((float)($agg['total_base_salary'] ?? 0), 0, ',', '.') . ' VNĐ' : 'Bảo mật theo phân quyền',
                            'total_net_payslip' => $canViewFullHrm ? number_format((float)($agg['total_net_payslip'] ?? 0), 0, ',', '.') . ' VNĐ' : 'Bảo mật theo phân quyền',
                            'month_year' => $monthYear
                        ],
                        'facets_by_department' => $deptFacets,
                        'dynamic_chart' => !empty($chartData) ? [
                            'type' => 'bar',
                            'title' => 'Cơ cấu Nhân sự theo Phòng ban / Đội nhóm',
                            'xAxisKey' => 'name',
                            'data' => $chartData,
                            'series' => [
                                ['dataKey' => 'count', 'name' => 'Nhân sự', 'color' => '#8b5cf6']
                            ]
                        ] : null,
                        'sample_staff' => $formattedStaff,
                        'export_url' => $staffExportUrl,
                        'export_markdown' => "[Bấm vào đây để tải danh sách Nhân sự & Bảng lương ({$totalCount} nhân sự)]({$staffExportUrl})"
                    ];
                }

                // =========================================================================
                // TOOL: query_inventory_and_assets_multitier (MULTI-TIER INVENTORY & ASSETS ENGINE)
                // =========================================================================
                case 'query_inventory_and_assets_multitier': {
                    $dataType      = strtolower(trim((string)($args['data_type'] ?? 'all')));
                    $categoriesPar = trim((string)($args['categories'] ?? $args['category'] ?? ''));
                    $stockStatus   = strtolower(trim((string)($args['stock_status'] ?? 'all')));
                    $search        = trim((string)($args['search'] ?? $args['search_query'] ?? ''));
                    $limit         = max(1, min(100, (int)($args['limit'] ?? 20)));

                    $whereP = ['p.tenant_id = ?', 'p.deleted_at IS NULL'];
                    $paramsP = [$tid];

                    if ($categoriesPar !== '' && $categoriesPar !== 'all') {
                        $cList = array_filter(array_map('trim', explode(',', $categoriesPar)));
                        if (!empty($cList)) {
                            $cOrs = [];
                            foreach ($cList as $cItem) {
                                $cOrs[] = "p.category LIKE ?";
                                $paramsP[] = '%' . $cItem . '%';
                            }
                            $whereP[] = "(" . implode(' OR ', $cOrs) . ")";
                        }
                    }

                    if ($stockStatus === 'in_stock') {
                        $whereP[] = "COALESCE(b_agg.total_qty, 0) > 0";
                    } elseif ($stockStatus === 'low_stock') {
                        $whereP[] = "COALESCE(b_agg.total_qty, 0) BETWEEN 1 AND 10";
                    } elseif ($stockStatus === 'out_of_stock') {
                        $whereP[] = "COALESCE(b_agg.total_qty, 0) <= 0";
                    } elseif ($stockStatus === 'expiring_soon') {
                        $whereP[] = "b_agg.nearest_expiry IS NOT NULL AND b_agg.nearest_expiry <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)";
                    }

                    if ($search !== '') {
                        $like = "%{$search}%";
                        $whereP[] = "(p.name LIKE ? OR p.sku LIKE ? OR p.category LIKE ?)";
                        array_push($paramsP, $like, $like, $like);
                    }

                    $wherePSql = implode(' AND ', $whereP);
                    $prodJoins = "FROM products p
                                  LEFT JOIN (
                                      SELECT product_id,
                                             SUM(current_qty) as total_qty,
                                             SUM(current_qty * import_price) as stock_val,
                                             MIN(CASE WHEN current_qty > 0 AND expiry_date IS NOT NULL THEN expiry_date ELSE NULL END) as nearest_expiry
                                      FROM batches
                                      WHERE status = 'active'
                                      GROUP BY product_id
                                  ) b_agg ON b_agg.product_id = p.id";

                    $stmtPAgg = $db->prepare("
                        SELECT COUNT(DISTINCT p.id) as total_products,
                               COALESCE(SUM(b_agg.total_qty), 0) as total_stock_qty,
                               COALESCE(SUM(b_agg.stock_val), 0) as total_stock_value,
                               SUM(CASE WHEN COALESCE(b_agg.total_qty, 0) <= 0 THEN 1 ELSE 0 END) as out_of_stock_count
                        {$prodJoins}
                        WHERE {$wherePSql}
                    ");
                    $stmtPAgg->execute($paramsP);
                    $pAgg = $stmtPAgg->fetch(PDO::FETCH_ASSOC);

                    $stmtPRows = $db->prepare("
                        SELECT p.id, p.name, p.sku, p.category, p.unit, p.price, p.cost,
                               COALESCE(b_agg.total_qty, 0) as stock_qty,
                               COALESCE(b_agg.stock_val, 0) as stock_val,
                               b_agg.nearest_expiry
                        {$prodJoins}
                        WHERE {$wherePSql}
                        ORDER BY stock_qty DESC, p.id DESC
                        LIMIT {$limit}
                    ");
                    $stmtPRows->execute($paramsP);
                    $prodRows = $stmtPRows->fetchAll(PDO::FETCH_ASSOC);

                    // Assets query (hrm_assets)
                    $whereA = ['a.tenant_id = ?'];
                    $paramsA = [$tid];
                    if ($search !== '') {
                        $likeA = "%{$search}%";
                        $whereA[] = "(a.asset_name LIKE ? OR a.asset_code LIKE ? OR u.full_name LIKE ?)";
                        array_push($paramsA, $likeA, $likeA, $likeA);
                    }
                    $whereASql = implode(' AND ', $whereA);
                    $stmtARows = $db->prepare("
                        SELECT a.id, a.asset_name, a.asset_code, a.given_date,
                               COALESCE(u.full_name, 'Chưa bàn giao') as holder_name
                        FROM hrm_assets a
                        LEFT JOIN users u ON a.user_id = u.id
                        WHERE {$whereASql}
                        ORDER BY a.id DESC
                        LIMIT {$limit}
                    ");
                    $stmtARows->execute($paramsA);
                    $assetRows = $stmtARows->fetchAll(PDO::FETCH_ASSOC);

                    $exportType = $dataType === 'assets' ? 'asset' : ($dataType === 'products' ? 'product' : 'inventory');
                    $invExportParams = ['type' => $exportType];
                    if ($categoriesPar !== '' && $categoriesPar !== 'all') $invExportParams['category'] = $categoriesPar;
                    if ($stockStatus !== '' && $stockStatus !== 'all') $invExportParams['stock_status'] = $stockStatus;
                    if ($search !== '') $invExportParams['search'] = $search;
                    $invExportUrl = '/export?' . http_build_query($invExportParams);

                    return [
                        'success' => true,
                        'inventory_summary' => [
                            'total_products' => (int)($pAgg['total_products'] ?? 0),
                            'total_stock_qty' => (int)($pAgg['total_stock_qty'] ?? 0),
                            'total_stock_value' => number_format((float)($pAgg['total_stock_value'] ?? 0), 0, ',', '.') . ' VNĐ',
                            'out_of_stock_count' => (int)($pAgg['out_of_stock_count'] ?? 0),
                            'allocated_assets_count' => count($assetRows)
                        ],
                        'sample_products' => $prodRows,
                        'sample_assets' => $assetRows,
                        'export_url' => $invExportUrl,
                        'export_markdown' => "[Bấm vào đây để tải báo cáo Kho vật tư & Tài sản]({$invExportUrl})"
                    ];
                }

                // =========================================================================
                // TOOL: query_cross_domain_executive_synthesis (CROSS-DOMAIN 360° EXECUTIVE ENGINE)
                // =========================================================================
                case 'query_cross_domain_executive_synthesis': {
                    $period      = strtolower(trim((string)($args['period'] ?? 'this_month')));
                    $fromDate    = trim((string)($args['from_date'] ?? $args['from'] ?? ''));
                    $toDate      = trim((string)($args['to_date'] ?? $args['to'] ?? ''));
                    $citiesParam = trim((string)($args['branches_or_cities'] ?? $args['city'] ?? ''));
                    $progsParam  = trim((string)($args['programs'] ?? $args['program'] ?? ''));

                    if ($fromDate === '' && $toDate === '') {
                        if ($period === 'today') {
                            $fromDate = date('Y-m-d');
                            $toDate   = date('Y-m-d');
                        } elseif ($period === 'this_week') {
                            $fromDate = date('Y-m-d', strtotime('monday this week'));
                            $toDate   = date('Y-m-d');
                        } elseif ($period === 'last_month') {
                            $fromDate = date('Y-m-01', strtotime('first day of last month'));
                            $toDate   = date('Y-m-t', strtotime('last day of last month'));
                        } elseif ($period === 'this_quarter') {
                            $curMonth = (int)date('n');
                            $qStartMonth = (floor(($curMonth - 1) / 3) * 3) + 1;
                            $fromDate = date('Y-' . str_pad((string)$qStartMonth, 2, '0', STR_PAD_LEFT) . '-01');
                            $toDate   = date('Y-m-d');
                        } elseif ($period === 'this_year') {
                            $fromDate = date('Y-01-01');
                            $toDate   = date('Y-m-d');
                        } elseif ($period !== 'all_time') {
                            $fromDate = date('Y-m-01');
                            $toDate   = date('Y-m-t');
                        }
                    }

                    // 1. CRM & Lead Funnel Synthesis (RBAC-aware)
                    $crmWhere = ['c.tenant_id = ?', 'c.deleted_at IS NULL'];
                    $crmParams = [$tid];
                    [$rbacSqlCrm, $rbacParamsCrm] = self::getContactRbacClause('c', $leadRbac, $uid);
                    if ($rbacSqlCrm !== '') {
                        $crmWhere[] = $rbacSqlCrm;
                        $crmParams = array_merge($crmParams, $rbacParamsCrm);
                    }
                    if ($fromDate !== '' && $toDate !== '') {
                        $crmWhere[] = "c.created_at BETWEEN ? AND ?";
                        $crmParams[] = $fromDate . ' 00:00:00';
                        $crmParams[] = $toDate . ' 23:59:59';
                    }
                    if ($citiesParam !== '' && $citiesParam !== 'all') {
                        $cList = array_filter(array_map('trim', explode(',', $citiesParam)));
                        if (!empty($cList)) {
                            $cOrs = [];
                            foreach ($cList as $ci) {
                                $cOrs[] = "(c.city LIKE ? OR c.district LIKE ? OR c.address LIKE ?)";
                                array_push($crmParams, "%{$ci}%", "%{$ci}%", "%{$ci}%");
                            }
                            $crmWhere[] = "(" . implode(' OR ', $cOrs) . ")";
                        }
                    }
                    if ($progsParam !== '' && $progsParam !== 'all') {
                        $pList = array_filter(array_map('trim', explode(',', $progsParam)));
                        if (!empty($pList)) {
                            $pOrs = [];
                            foreach ($pList as $pi) {
                                $pOrs[] = "c.program LIKE ?";
                                $crmParams[] = "%{$pi}%";
                            }
                            $crmWhere[] = "(" . implode(' OR ', $pOrs) . ")";
                        }
                    }
                    $crmWhereSql = implode(' AND ', $crmWhere);
                    $stmtCrm = $db->prepare("
                        SELECT COUNT(DISTINCT c.id) as total_leads,
                               COUNT(DISTINCT dep.contact_id) as deposited_leads,
                               COUNT(DISTINCT dep.id) as deposit_count,
                               COALESCE(SUM(dep.price), 0) as crm_deposit_amount,
                               SUM(CASE WHEN (c.last_contact IS NULL OR c.last_contact = '') AND NOT EXISTS (SELECT 1 FROM activities act_x WHERE (act_x.contact_id = c.id OR (act_x.related_id = c.id AND act_x.related_type IN ('contact', 'lead'))) AND act_x.deleted_at IS NULL) THEN 1 ELSE 0 END) as uncontacted_leads
                        FROM contacts c
                        LEFT JOIN deposits dep ON dep.contact_id = c.id AND dep.status NOT IN ('cancelled', 'rejected')
                        WHERE {$crmWhereSql}
                    ");
                    $stmtCrm->execute($crmParams);
                    $crmAgg = $stmtCrm->fetch(PDO::FETCH_ASSOC) ?: [];
                    $totalLeads = (int)($crmAgg['total_leads'] ?? 0);
                    $depositedLeads = (int)($crmAgg['deposited_leads'] ?? 0);
                    $convRate = $totalLeads > 0 ? round(($depositedLeads / $totalLeads) * 100, 1) : 0.0;

                    // 2. Revenue & Deposits Synthesis (by deposit date)
                    $depWhere = ['(c.tenant_id = ? OR p.tenant_id = ? OR u.tenant_id = ?)', '(c.id IS NULL OR c.deleted_at IS NULL)'];
                    $depParams = [$tid, $tid, $tid];
                    $isFinExec = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'ceo', 'accountant', 'ke_toan', 'sale_admin', 'saleadmin'], true);
                    if (!$isFinExec) {
                        [$rbacSqlDep, $rbacParamsDep] = self::getContactRbacClause('c', $leadRbac, $uid);
                        if ($rbacSqlDep !== '') {
                            $depWhere[] = "(d.created_by = ? OR {$rbacSqlDep})";
                            $depParams[] = $uid;
                            $depParams = array_merge($depParams, $rbacParamsDep);
                        }
                    }
                    if ($fromDate !== '' && $toDate !== '') {
                        $depWhere[] = "d.created_at BETWEEN ? AND ?";
                        $depParams[] = $fromDate . ' 00:00:00';
                        $depParams[] = $toDate . ' 23:59:59';
                    }
                    $depWhereSql = implode(' AND ', $depWhere);
                    $stmtDep = $db->prepare("
                        SELECT COUNT(DISTINCT d.id) as total_deposits,
                               COALESCE(SUM(CASE WHEN d.status IN ('approved', 'completed') THEN d.price ELSE 0 END), 0) as approved_revenue,
                               COALESCE(SUM(CASE WHEN d.status = 'pending' THEN d.price ELSE 0 END), 0) as pending_revenue,
                               COALESCE(SUM(CASE WHEN d.status NOT IN ('cancelled', 'rejected') THEN d.price ELSE 0 END), 0) as active_revenue
                        FROM deposits d
                        LEFT JOIN contacts c ON d.contact_id = c.id
                        LEFT JOIN projects p ON d.project_id = p.id
                        LEFT JOIN users u ON d.created_by = u.id
                        WHERE {$depWhereSql}
                    ");
                    $stmtDep->execute($depParams);
                    $depAgg = $stmtDep->fetch(PDO::FETCH_ASSOC) ?: [];
                    $approvedRev = (float)($depAgg['approved_revenue'] ?? 0);
                    $pendingRev  = (float)($depAgg['pending_revenue'] ?? 0);
                    $activeRev   = (float)($depAgg['active_revenue'] ?? 0);

                    // 3. Expenses & Operating Cashflow Synthesis
                    $expWhere = ['e.tenant_id = ?', 'e.deleted_at IS NULL'];
                    $expParams = [$tid];
                    if (!$isFinExec) {
                        $expWhere[] = "e.created_by = ?";
                        $expParams[] = $uid;
                    }
                    if ($fromDate !== '' && $toDate !== '') {
                        $expWhere[] = "e.created_at BETWEEN ? AND ?";
                        $expParams[] = $fromDate . ' 00:00:00';
                        $expParams[] = $toDate . ' 23:59:59';
                    }
                    $expWhereSql = implode(' AND ', $expWhere);
                    $stmtExp = $db->prepare("
                        SELECT COUNT(DISTINCT e.id) as expense_count,
                               COALESCE(SUM(CASE WHEN e.status IN ('approved', 'paid', 'completed') THEN e.amount ELSE 0 END), 0) as approved_expense,
                               COALESCE(SUM(CASE WHEN e.status = 'pending' THEN e.amount ELSE 0 END), 0) as pending_expense
                        FROM expenses e
                        WHERE {$expWhereSql}
                    ");
                    $stmtExp->execute($expParams);
                    $expAgg = $stmtExp->fetch(PDO::FETCH_ASSOC) ?: [];
                    $approvedExp = (float)($expAgg['approved_expense'] ?? 0);
                    $pendingExp  = (float)($expAgg['pending_expense'] ?? 0);
                    $netCashflow = $approvedRev - $approvedExp;

                    // 4. Consolidated HRM, Tasks & Tickets Pulse (Single Multi-Subquery SELECT)
                    $canViewFullHrm = in_array($role, ['admin', 'superadmin', 'super_admin', 'director', 'ceo', 'hr', 'nhan_su', 'accountant', 'ke_toan'], true);
                    $stmtOps = $db->prepare("
                        SELECT
                            (SELECT COUNT(*) FROM users u WHERE u.tenant_id = ? AND COALESCE(u.is_active, 1) = 1 AND u.role NOT IN ('superadmin', 'super_admin')) as active_staff,
                            (SELECT COUNT(DISTINCT ci.user_id) FROM check_ins ci JOIN users u_ci ON ci.user_id = u_ci.id WHERE u_ci.tenant_id = ? AND ci.check_in_date = CURDATE() AND ci.check_in_time IS NOT NULL) as present_today,
                            (SELECT COALESCE(SUM(hp.base_salary), 0) FROM users u2 JOIN hrm_profiles hp ON hp.user_id = u2.id WHERE u2.tenant_id = ? AND COALESCE(u2.is_active, 1) = 1 AND u2.role NOT IN ('superadmin', 'super_admin')) as base_salary_fund,
                            (SELECT COUNT(*) FROM activities t WHERE t.tenant_id = ? AND t.deleted_at IS NULL AND t.type = 'task' AND t.status NOT IN ('done', 'completed', 'cancelled')) as open_tasks,
                            (SELECT COUNT(*) FROM activities t2 WHERE t2.tenant_id = ? AND t2.deleted_at IS NULL AND t2.type = 'task' AND t2.due_date IS NOT NULL AND t2.due_date < NOW() AND t2.status NOT IN ('done', 'completed', 'cancelled')) as overdue_tasks,
                            (SELECT COUNT(*) FROM tickets tk WHERE tk.tenant_id = ? AND tk.status NOT IN ('resolved', 'closed')) as open_tickets,
                            (SELECT COUNT(*) FROM tickets tk2 WHERE tk2.tenant_id = ? AND tk2.status NOT IN ('resolved', 'closed') AND tk2.created_at < DATE_SUB(NOW(), INTERVAL 48 HOUR)) as sla_breach_tickets
                    ");
                    $stmtOps->execute([$tid, $tid, $tid, $tid, $tid, $tid, $tid]);
                    $opsAgg = $stmtOps->fetch(PDO::FETCH_ASSOC) ?: [];

                    $chartData = [
                        [
                            'name' => 'Doanh thu Đã duyệt',
                            'amount' => round($approvedRev / 1000000, 2)
                        ],
                        [
                            'name' => 'Doanh thu Chờ duyệt',
                            'amount' => round($pendingRev / 1000000, 2)
                        ],
                        [
                            'name' => 'Chi phí Đã duyệt',
                            'amount' => round($approvedExp / 1000000, 2)
                        ],
                        [
                            'name' => 'Dòng tiền Ròng (Net)',
                            'amount' => round($netCashflow / 1000000, 2)
                        ]
                    ];

                    $crmExportUrl = '/export?' . http_build_query(array_filter([
                        'type' => 'contact',
                        'export_mode' => 'full',
                        'from' => $fromDate,
                        'to' => $toDate,
                        'city' => $citiesParam ?: null,
                        'program' => $progsParam ?: null
                    ]));
                    $depExportUrl = '/export?' . http_build_query(array_filter([
                        'type' => 'deposit',
                        'from' => $fromDate,
                        'to' => $toDate
                    ]));
                    $expExportUrl = '/export?' . http_build_query(array_filter([
                        'type' => 'expense',
                        'from' => $fromDate,
                        'to' => $toDate
                    ]));

                    return [
                        'success' => true,
                        'period_applied' => [
                            'period' => $period,
                            'from_date' => $fromDate,
                            'to_date' => $toDate
                        ],
                        'crm_and_funnel' => [
                            'total_leads' => $totalLeads,
                            'deposited_leads' => $depositedLeads,
                            'conversion_rate_pct' => $convRate . '%',
                            'uncontacted_leads' => (int)($crmAgg['uncontacted_leads'] ?? 0)
                        ],
                        'revenue_and_deposits' => [
                            'deposit_count' => (int)($depAgg['total_deposits'] ?? 0),
                            'active_revenue' => number_format($activeRev, 0, ',', '.') . ' VNĐ',
                            'approved_revenue' => number_format($approvedRev, 0, ',', '.') . ' VNĐ',
                            'pending_revenue' => number_format($pendingRev, 0, ',', '.') . ' VNĐ'
                        ],
                        'expenses_and_cashflow' => [
                            'expense_count' => (int)($expAgg['expense_count'] ?? 0),
                            'approved_expense' => number_format($approvedExp, 0, ',', '.') . ' VNĐ',
                            'pending_expense' => number_format($pendingExp, 0, ',', '.') . ' VNĐ',
                            'net_operating_cashflow' => number_format($netCashflow, 0, ',', '.') . ' VNĐ'
                        ],
                        'hrm_and_workforce' => [
                            'active_staff' => (int)($opsAgg['active_staff'] ?? 0),
                            'present_today' => (int)($opsAgg['present_today'] ?? 0),
                            'base_salary_fund' => $canViewFullHrm ? number_format((float)($opsAgg['base_salary_fund'] ?? 0), 0, ',', '.') . ' VNĐ' : 'Bảo mật theo phân quyền'
                        ],
                        'operations_and_sla' => [
                            'open_tasks' => (int)($opsAgg['open_tasks'] ?? 0),
                            'overdue_tasks' => (int)($opsAgg['overdue_tasks'] ?? 0),
                            'open_tickets' => (int)($opsAgg['open_tickets'] ?? 0),
                            'sla_breach_tickets' => (int)($opsAgg['sla_breach_tickets'] ?? 0)
                        ],
                        'dynamic_chart' => [
                            'type' => 'bar',
                            'title' => 'Tổng hợp Doanh thu - Chi phí - Dòng tiền ròng (Triệu VNĐ)',
                            'xAxisKey' => 'name',
                            'data' => $chartData,
                            'series' => [
                                ['dataKey' => 'amount', 'name' => 'Giá trị (Tr. VNĐ)', 'color' => '#10b981']
                            ]
                        ],
                        'export_url' => $crmExportUrl,
                        'export_markdown' => "[Bấm vào đây để tải dữ liệu CRM ({$totalLeads} hồ sơ)]({$crmExportUrl}) | [Tải danh sách Đặt cọc]({$depExportUrl}) | [Tải danh sách Chi phí]({$expExportUrl})"
                    ];
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
