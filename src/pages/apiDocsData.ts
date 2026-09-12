// src/pages/apiDocsData.ts
// Toàn bộ 24 Chuyên mục API đặc tả chi tiết cho hệ thống IDEAS MYERP

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  title: string;
  description: string;
  authRequired: boolean;
  headers?: Record<string, string>;
  queryParams?: Array<{ name: string; type: string; required: boolean; desc: string }>;
  bodyParams?: Array<{ name: string; type: string; required: boolean; desc: string }>;
  sampleBody?: any;
  sampleResponse: any;
}

export interface ApiCategory {
  id: string;
  title: string;
  endpoints: ApiEndpoint[];
}

export const apiCategories: ApiCategory[] = [
  // 1. XÁC THỰC & PHÂN QUYỀN
  {
    id: 'auth',
    title: '1. Xác Thực, Phân Quyền & Tài Khoản (Auth & RBAC)',
    endpoints: [
      {
        method: 'POST',
        path: '/backend/api.php?action=login',
        title: 'Đăng Nhập Người Dùng (User Login)',
        description: 'Xác thực tài khoản qua username/email và mật khẩu. Trả về JWT Access Token (hạn 2 giờ) và Refresh Token (hạn 7 ngày) kèm thông tin phân quyền RBAC.',
        authRequired: false,
        headers: { "Content-Type": "application/json" },
        bodyParams: [
          { name: 'username', type: 'string', required: true, desc: 'Tên đăng nhập hoặc địa chỉ email nội bộ' },
          { name: 'password', type: 'string', required: true, desc: 'Mật khẩu bảo mật' },
          { name: 'remember_me', type: 'boolean', required: false, desc: 'Duy trì phiên đăng nhập 30 ngày' }
        ],
        sampleBody: {
          username: "tuvanvien.lan",
          password: "MySecurePassword2026!",
          remember_me: true
        },
        sampleResponse: {
          success: true,
          message: "Đăng nhập thành công",
          access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          refresh_token: "d9a1f28b4c5e...",
          expires_in: 7200,
          user: {
            id: 1042,
            username: "tuvanvien.lan",
            name: "Nguyễn Thị Lan",
            email: "lan.nt@ideas.edu.vn",
            role: "sale",
            tenant_id: 1,
            department: "Phòng Tuyển Sinh",
            permissions: ["leads.view", "leads.edit", "deals.create", "quotes.create"]
          }
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=refresh_token',
        title: 'Làm Mới Token (Refresh Access Token)',
        description: 'Sử dụng Refresh Token còn hiệu lực để cấp phát Access Token mới mà không làm gián đoạn trải nghiệm của người dùng trên giao diện SPA.',
        authRequired: false,
        headers: { "Content-Type": "application/json" },
        bodyParams: [
          { name: 'refresh_token', type: 'string', required: true, desc: 'Mã Refresh Token được cấp lúc đăng nhập' }
        ],
        sampleBody: {
          refresh_token: "d9a1f28b4c5e..."
        },
        sampleResponse: {
          success: true,
          access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new...",
          expires_in: 7200
        }
      },
      {
        method: 'GET',
        path: '/backend/api.php?action=me',
        title: 'Lấy Thông Tin Cá Nhân & Quyền Hạn (Get Current User Profile)',
        description: 'Truy vấn chi tiết hồ sơ tài khoản hiện tại, cấu hình nhận thông báo, ca trực hôm nay và số liệu KPI đang phụ trách.',
        authRequired: true,
        sampleResponse: {
          success: true,
          user: {
            id: 1042,
            name: "Nguyễn Thị Lan",
            email: "lan.nt@ideas.edu.vn",
            phone: "0901.234.567",
            role: "sale",
            zalo_chat_id: "zalo_uid_8819",
            telegram_chat_id: "12849102",
            assigned_leads_count: 28,
            current_intake_target: 120000000,
            current_intake_achieved: 85000000
          }
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=change_password',
        title: 'Đổi Mật Khẩu (Change Password)',
        description: 'Đổi mật khẩu người dùng, yêu cầu mật khẩu hiện tại và tự động vô hiệu hóa toàn bộ Refresh Token trên các thiết bị khác.',
        authRequired: true,
        bodyParams: [
          { name: 'old_password', type: 'string', required: true, desc: 'Mật khẩu hiện tại' },
          { name: 'new_password', type: 'string', required: true, desc: 'Mật khẩu mới (tối thiểu 8 ký tự, có chữ hoa, số)' }
        ],
        sampleBody: {
          old_password: "MySecurePassword2026!",
          new_password: "NewUltraSecurePass2026@"
        },
        sampleResponse: {
          success: true,
          message: "Đổi mật khẩu thành công. Vui lòng đăng nhập lại."
        }
      },
      {
        method: 'GET',
        path: '/backend/api.php?action=users_list',
        title: 'Danh Sách Nhân Sự & Tài Khoản (List System Users)',
        description: 'Truy vấn danh sách nhân viên trong đơn vị theo quyền quản trị, hỗ trợ lọc theo phòng ban, vai trò và trạng thái hoạt động.',
        authRequired: true,
        queryParams: [
          { name: 'role', type: 'string', required: false, desc: 'Lọc theo vai trò (admin, sale, accountant, academic)' },
          { name: 'department_id', type: 'integer', required: false, desc: 'Lọc theo ID phòng ban' },
          { name: 'status', type: 'string', required: false, desc: 'Trạng thái: active hoặc inactive' }
        ],
        sampleResponse: {
          success: true,
          total: 45,
          users: [
            {
              id: 1042,
              name: "Nguyễn Thị Lan",
              email: "lan.nt@ideas.edu.vn",
              role: "sale",
              department: "Tuyển Sinh",
              status: "active",
              created_at: "2025-10-15"
            }
          ]
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=update_user_role',
        title: 'Phân Quyền Vai Trò Nhân Sự (Update User Role & Matrix)',
        description: 'Chỉ định vai trò hệ thống và ma trận quyền hạn tùy biến (Custom Permissions) cho một nhân sự.',
        authRequired: true,
        bodyParams: [
          { name: 'user_id', type: 'integer', required: true, desc: 'ID nhân viên cần phân quyền' },
          { name: 'role', type: 'string', required: true, desc: 'Vai trò: admin, manager, sale, academic, finance' },
          { name: 'custom_permissions', type: 'array', required: false, desc: 'Mảng các quyền hạn bổ sung' }
        ],
        sampleBody: {
          user_id: 1042,
          role: "manager",
          custom_permissions: ["approvals.leave", "approvals.expense", "reports.export"]
        },
        sampleResponse: {
          success: true,
          message: "Cập nhật quyền hạn nhân sự thành công"
        }
      },
      {
        method: 'GET',
        path: '/backend/api.php?action=rbac_user_permissions',
        title: 'Tra Cứu Ma Trận Quyền Hạt Nhân & Scope Dữ Liệu (Get RBAC Permissions)',
        description: 'Truy vấn ma trận quyền chi tiết của người dùng từ permissions_json và tính toán phạm vi dữ liệu Scope (all, team, own, none) cho từng module.',
        authRequired: true,
        queryParams: [
          { name: 'user_id', type: 'integer', required: false, desc: 'ID người dùng cần tra cứu (mặc định lấy user hiện tại)' }
        ],
        sampleResponse: {
          success: true,
          user_id: 1042,
          role: "sale",
          tenant_id: 1,
          team_id: 4,
          is_team_leader: false,
          scopes: {
            contacts: { view: "own", create: true, edit: "own", delete: "none", export: false },
            deals: { view: "own", create: true, edit: "own", delete: "none" },
            quotes: { view: "own", create: true, edit: "own", delete: "none" },
            academic: { view: "all", edit_grades: false, approve_hours: false },
            finance: { view: "none", approve_expense: false }
          },
          permissions_json: {
            contacts: { view: "own", create: true, edit: "own", delete: "none" },
            deals: { view: "own", create: true, edit: "own" }
          }
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=update_user_permissions',
        title: 'Cập Nhật Ma Trận Quyền Hạt Nhân (Update User Permissions Matrix)',
        description: 'Quản trị viên cấu hình ma trận quyền tùy biến cấp độ hành động và gán phạm vi Scope dữ liệu cho một tài khoản.',
        authRequired: true,
        bodyParams: [
          { name: 'user_id', type: 'integer', required: true, desc: 'ID người dùng cần cập nhật' },
          { name: 'permissions_json', type: 'object', required: true, desc: 'Đối tượng JSON chứa ma trận module và action' }
        ],
        sampleBody: {
          user_id: 1042,
          permissions_json: {
            contacts: { view: "team", create: true, edit: "own", delete: "none", export: false },
            deals: { view: "team", create: true, edit: "team" }
          }
        },
        sampleResponse: {
          success: true,
          message: "Cập nhật ma trận phân quyền người dùng thành công"
        }
      },
      {
        method: 'GET',
        path: '/backend/api.php?action=teams_hierarchy',
        title: 'Cây Tổ Đội & Phân Cấp Quản Lý (Teams Hierarchy & Leaders)',
        description: 'Truy vấn danh sách các tổ đội, Trưởng nhóm (leader_id), Phó nhóm (co_leader_ids) và danh sách thành viên trực thuộc phục vụ phân quyền scope team.',
        authRequired: true,
        sampleResponse: {
          success: true,
          teams: [
            {
              id: 4,
              name: "Team Tuyển Sinh Miền Nam 01",
              leader_id: 1008,
              leader_name: "Trần Văn Hùng",
              co_leader_ids: [1015],
              members_count: 8,
              member_ids: [1008, 1015, 1042, 1043, 1044, 1045, 1046, 1047]
            }
          ]
        }
      }
    ]
  },

  // 2. KHÁCH HÀNG & HỌC VIÊN
  {
    id: 'contacts',
    title: '2. Khách Hàng, Học Viên & Hồ Sơ 360 (Contacts & 360 Profile)',
    endpoints: [
      {
        method: 'GET',
        path: '/backend/api.php?action=contacts',
        title: 'Danh Sách Học Viên & Khách Hàng (Query Contacts)',
        description: 'Truy vấn danh sách học viên/khách hàng tiềm năng kèm phân trang, tìm kiếm họ tên, số điện thoại, nhãn màu và trạng thái tuyển sinh.',
        authRequired: true,
        queryParams: [
          { name: 'page', type: 'integer', required: false, desc: 'Trang cần xem (mặc định 1)' },
          { name: 'limit', type: 'integer', required: false, desc: 'Số bản ghi mỗi trang (mặc định 20)' },
          { name: 'search', type: 'string', required: false, desc: 'Từ khóa tìm kiếm (họ tên, sđt, email)' },
          { name: 'temperature', type: 'string', required: false, desc: 'Phân loại nhiệt độ: Hot, Warm, Cold' },
          { name: 'owner_id', type: 'integer', required: false, desc: 'Lọc theo nhân viên tư vấn phụ trách' }
        ],
        sampleResponse: {
          success: true,
          total: 1250,
          page: 1,
          limit: 20,
          contacts: [
            {
              id: 5401,
              name: "Hoàng Minh Tuấn",
              phone: "0912.888.999",
              email: "tuan.hm@gmail.com",
              program: "Thạc Sĩ Quản Trị Kinh Doanh (MBA)",
              lead_temperature: "Hot",
              ai_score: 88,
              owner_name: "Nguyễn Thị Lan",
              pipeline_stage: "Báo giá / Học bổng",
              created_at: "2026-09-10 14:30:00"
            }
          ]
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=create_contact',
        title: 'Thêm Mới Khách Hàng / Học Viên (Create Contact)',
        description: 'Tạo mới bản ghi khách hàng, tự động chuẩn hóa định dạng số điện thoại E.164, kích hoạt thuật toán chống trùng và chấm điểm AI Gatekeeper.',
        authRequired: true,
        bodyParams: [
          { name: 'name', type: 'string', required: true, desc: 'Họ và tên đầy đủ' },
          { name: 'phone', type: 'string', required: true, desc: 'Số điện thoại liên hệ' },
          { name: 'email', type: 'string', required: false, desc: 'Địa chỉ email' },
          { name: 'program_interest', type: 'string', required: true, desc: 'Khóa học hoặc chương trình quan tâm' },
          { name: 'campaign_id', type: 'integer', required: false, desc: 'ID chiến dịch quảng cáo mang lead về' },
          { name: 'notes', type: 'string', required: false, desc: 'Ghi chú ban đầu từ học viên' }
        ],
        sampleBody: {
          name: "Phạm Hồng Ánh",
          phone: "0987.654.321",
          email: "anh.ph@techcorp.vn",
          program_interest: "Executive Mini-MBA 2026",
          campaign_id: 12,
          notes: "Quan tâm lịch học thứ Bảy & Chủ Nhật"
        },
        sampleResponse: {
          success: true,
          message: "Tạo khách hàng mới thành công",
          contact_id: 5402,
          assigned_to: 1042,
          ai_score: 92,
          lead_temperature: "Hot"
        }
      },
      {
        method: 'GET',
        path: '/backend/api.php?action=contact_detail',
        title: 'Hồ Sơ Khách Hàng 360 Độ (Customer 360 View)',
        description: 'Trả về toàn cảnh thông tin khách hàng: Báo giá (Quotes), Đơn bán hàng (SO), Các mốc tiền cọc (Deposits), Lịch sử cuộc gọi, Email và ghi chú nội bộ.',
        authRequired: true,
        queryParams: [
          { name: 'id', type: 'integer', required: true, desc: 'ID khách hàng cần xem chi tiết' }
        ],
        sampleResponse: {
          success: true,
          contact: {
            id: 5401,
            name: "Hoàng Minh Tuấn",
            phone: "0912.888.999",
            email: "tuan.hm@gmail.com",
            workplace: "Giám đốc Vận hành - SunTech JSC",
            academic_status: "Đã trúng tuyển, chờ nhập học",
            total_paid: 30000000,
            remaining_balance: 75000000,
            quotes_count: 2,
            orders_count: 1,
            deposits_count: 1
          }
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=assign_contact',
        title: 'Bàn Giao & Điều Chuyển Lead (Reassign Consultant)',
        description: 'Chuyển giao quyền chăm sóc khách hàng cho Tư vấn viên khác, ghi nhận vào distribution_logs và tự động bắn tin Zalo thông báo cho Sale mới.',
        authRequired: true,
        bodyParams: [
          { name: 'contact_id', type: 'integer', required: true, desc: 'ID khách hàng cần chuyển' },
          { name: 'new_owner_id', type: 'integer', required: true, desc: 'ID tư vấn viên tiếp nhận' },
          { name: 'transfer_reason', type: 'string', required: true, desc: 'Lý do bàn giao (chuyển ca, đổi vùng miền, TVV nghỉ phép)' }
        ],
        sampleBody: {
          contact_id: 5401,
          new_owner_id: 1055,
          transfer_reason: "Chuyển giao cho TVV phụ trách địa bàn Hà Nội"
        },
        sampleResponse: {
          success: true,
          message: "Đã bàn giao khách hàng thành công và gửi thông báo Zalo cho TVV tiếp nhận."
        }
      },
      {
        method: 'GET',
        path: '/backend/api.php?action=referrer_lookup',
        title: 'Tra Cứu Đối Tác Giới Thiệu (Referrer Partner Lookup)',
        description: 'Tìm kiếm đối tác giới thiệu (Cựu học viên, Giảng viên, Doanh nghiệp B2B, Affiliate) trong bảng companies với bộ lọc tier = "referrer".',
        authRequired: true,
        queryParams: [
          { name: 'search', type: 'string', required: false, desc: 'Từ khóa tên đối tác, SĐT, mã số thuế hoặc người đại diện' },
          { name: 'referrer_type', type: 'string', required: false, desc: 'Phân loại: alumni, lecturer, b2b_partner, affiliate' }
        ],
        sampleResponse: {
          success: true,
          referrers: [
            {
              id: 88,
              name: "Hội Cựu Học Viên MBA Khóa 2022",
              code: "REF-ALUMNI-22",
              tier: "referrer",
              phone: "0903.111.222",
              email: "alumni.mba22@ideas.edu.vn",
              commission_rate: 5.0,
              total_referred_leads: 34,
              successful_enrollments: 12
            },
            {
              id: 92,
              name: "TS. Nguyễn Hoàng Nam (Khoa Quản Trị)",
              code: "REF-FACULTY-05",
              tier: "referrer",
              phone: "0918.333.444",
              email: "nam.nh@ideas.edu.vn",
              commission_rate: 7.0,
              total_referred_leads: 18,
              successful_enrollments: 8
            }
          ]
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=link_referrer',
        title: 'Gắn Đối Tác Giới Thiệu & Hoa Hồng (Link Referrer to Contact/Deal)',
        description: 'Gắn đối tác giới thiệu REF vào hồ sơ học viên, cập nhật nguồn source = "gioi_thieu", lưu vết mã REF và thiết lập tỷ lệ hoa hồng chi trả.',
        authRequired: true,
        bodyParams: [
          { name: 'contact_id', type: 'integer', required: true, desc: 'ID học viên hoặc khách hàng' },
          { name: 'deal_id', type: 'integer', required: false, desc: 'ID cơ hội bán hàng / tuyển sinh' },
          { name: 'referrer_id', type: 'integer', required: true, desc: 'ID đối tác giới thiệu (companies.id)' },
          { name: 'commission_type', type: 'string', required: true, desc: 'Hình thức hoa hồng: percent (%) hoặc fixed_amount (VND)' },
          { name: 'commission_value', type: 'number', required: true, desc: 'Giá trị hoa hồng (ví dụ: 5% hoặc 5000000)' },
          { name: 'notes', type: 'string', required: false, desc: 'Ghi chú thỏa thuận giới thiệu' }
        ],
        sampleBody: {
          contact_id: 5402,
          deal_id: 2190,
          referrer_id: 88,
          commission_type: "percent",
          commission_value: 5.0,
          notes: "Cựu học viên giới thiệu đồng nghiệp công ty TechCorp"
        },
        sampleResponse: {
          success: true,
          message: "Gắn đối tác giới thiệu thành công. Đã khóa quyền sở hữu lead và miễn trừ chia số Round-Robin."
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=check_lead_protection',
        title: 'Kiểm Tra Bảo Hộ 180 Ngày & Trùng Lặp (Check Lead Protection & Deduplication)',
        description: 'Kiểm tra xem số điện thoại hoặc email đã từng tồn tại trong hệ thống chưa, xác định thời hạn bảo hộ 180 ngày và danh tính tư vấn viên đang sở hữu.',
        authRequired: true,
        bodyParams: [
          { name: 'phone', type: 'string', required: true, desc: 'Số điện thoại cần kiểm tra' },
          { name: 'email', type: 'string', required: false, desc: 'Địa chỉ email' }
        ],
        sampleBody: {
          phone: "0912.888.999",
          email: "tuan.hm@gmail.com"
        },
        sampleResponse: {
          success: true,
          is_duplicate: true,
          is_protected: true,
          days_since_last_touch: 42,
          protected_until: "2026-11-08",
          current_owner: {
            user_id: 1042,
            name: "Nguyễn Thị Lan",
            department: "Tuyển Sinh"
          },
          can_assign_round_robin: false,
          recommendation: "Lead vẫn trong thời hạn bảo hộ 180 ngày. Tiếp tục chuyển cho tư vấn viên Lan chăm sóc."
        }
      }
    ]
  },

  // 3. PHỄU BÁN HÀNG 14 STAGES
  {
    id: 'pipeline',
    title: '3. Phễu Bán Hàng 14 Stages & Cơ Hội (Deals & Pipeline)',
    endpoints: [
      {
        method: 'GET',
        path: '/backend/api.php?action=deals',
        title: 'Truy Vấn Danh Sách Deal Phễu (Query Pipeline Deals)',
        description: 'Lấy dữ liệu phễu bán hàng theo dạng bảng hoặc thẻ Kanban phân bổ qua 14 Stages, tổng giá trị tiềm năng và tỷ lệ chuyển đổi.',
        authRequired: true,
        queryParams: [
          { name: 'stage_id', type: 'integer', required: false, desc: 'Lọc theo ID giai đoạn phễu' },
          { name: 'intake', type: 'string', required: false, desc: 'Kỳ tuyển sinh (ví dụ: K28-2026)' },
          { name: 'consultant_id', type: 'integer', required: false, desc: 'Lọc theo nhân viên phụ trách' }
        ],
        sampleResponse: {
          success: true,
          total_pipeline_value: 3500000000,
          deals_by_stage: {
            "Gặp Trực Tiếp / Online (Stage 6)": [
              {
                id: 1204,
                title: "Deal MBA - Hoàng Minh Tuấn",
                contact_name: "Hoàng Minh Tuấn",
                expected_revenue: 105000000,
                probability: 70,
                next_action: "Gửi kế hoạch học tập qua Zalo",
                next_followup_date: "2026-09-14"
              }
            ]
          }
        }
      },
      {
        method: 'PUT',
        path: '/backend/api.php?action=update_deal_stage',
        title: 'Chuyển Đổi Giai Đoạn Phễu (Transition Deal Stage)',
        description: 'Chuyển một Deal từ Stage này sang Stage khác. Hệ thống kiểm tra điều kiện tiêu chuẩn đầu ra (Exit Criteria) và kích hoạt automation workflows.',
        authRequired: true,
        bodyParams: [
          { name: 'deal_id', type: 'integer', required: true, desc: 'ID deal cần chuyển' },
          { name: 'new_stage_id', type: 'integer', required: true, desc: 'ID giai đoạn mới (từ 1 đến 14)' },
          { name: 'stage_notes', type: 'string', required: false, desc: 'Ghi chú kết quả sau giai đoạn vừa hoàn tất' }
        ],
        sampleBody: {
          deal_id: 1204,
          new_stage_id: 8,
          stage_notes: "Khách hàng đã tham gia hội thảo viện và đồng ý nộp hồ sơ xét tuyển."
        },
        sampleResponse: {
          success: true,
          message: "Chuyển giai đoạn phễu thành công sang Stage 8 (Nộp Hồ Sơ Xét Tuyển)",
          previous_stage: 6,
          current_stage: 8,
          updated_at: "2026-09-12 16:25:00"
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=mark_deal_lost',
        title: 'Đánh Dấu Cơ Hội Thất Bại (Mark Deal as Lost)',
        description: 'Đánh dấu Deal không thành công. Bắt buộc ghi nhận lý do thất bại (lost_reason) để phân tích tỷ lệ rơi rụng ở từng mắt xích.',
        authRequired: true,
        bodyParams: [
          { name: 'deal_id', type: 'integer', required: true, desc: 'ID deal cần đóng' },
          { name: 'lost_reason', type: 'string', required: true, desc: 'Lý do mất deal (Học phí cao, Trùng lịch công tác, Chọn trường khác, Không liên lạc được)' },
          { name: 'competitor_name', type: 'string', required: false, desc: 'Tên đối thủ cạnh tranh nếu có' },
          { name: 'notes', type: 'string', required: false, desc: 'Chi tiết phân tích thất bại' }
        ],
        sampleBody: {
          deal_id: 1204,
          lost_reason: "Trùng lịch công tác nước ngoài dài hạn",
          notes: "Khách hàng hẹn sẽ học vào đợt khai giảng tháng 03/2027."
        },
        sampleResponse: {
          success: true,
          message: "Đã cập nhật trạng thái Lost Deal thành công"
        }
      }
    ]
  },

  // 4. BÁO GIÁ & ĐƠN BÁN HÀNG
  {
    id: 'quotes_so',
    title: '4. Báo Giá Học Phí & Đơn Bán Hàng (Quotes & Sales Orders)',
    endpoints: [
      {
        method: 'POST',
        path: '/backend/api.php?action=create_quote',
        title: 'Lập Báo Giá Học Phí Mới (Create Tuition Quote)',
        description: 'Tạo bảng báo giá học phí gồm học phí gốc, các học phần bắt buộc/tự chọn, chiết khấu sớm (Early Bird) và học bổng khuyến học.',
        authRequired: true,
        bodyParams: [
          { name: 'contact_id', type: 'integer', required: true, desc: 'ID học viên nhận báo giá' },
          { name: 'program_id', type: 'integer', required: true, desc: 'ID chương trình đào tạo' },
          { name: 'base_tuition', type: 'number', required: true, desc: 'Học phí niêm yết' },
          { name: 'discount_amount', type: 'number', required: false, desc: 'Số tiền chiết khấu ưu đãi' },
          { name: 'valid_until', type: 'string', required: true, desc: 'Thời hạn hiệu lực của báo giá (YYYY-MM-DD)' }
        ],
        sampleBody: {
          contact_id: 5401,
          program_id: 108,
          base_tuition: 120000000,
          discount_amount: 15000000,
          valid_until: "2026-09-30"
        },
        sampleResponse: {
          success: true,
          quote_id: 309,
          quote_code: "BG-2026-09-0309",
          final_tuition: 105000000,
          pdf_url: "/uploads/quotes/BG-2026-09-0309.pdf"
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=convert_quote_to_so',
        title: 'Chuyển Báo Giá Thành Đơn Bán Hàng (Convert Quote to SO)',
        description: 'Khi học viên đồng ý nhập học, chuyển đổi bảng báo giá thành Đơn bán hàng chính thức (Sales Order), ghi nhận doanh số và tạo hợp đồng.',
        authRequired: true,
        bodyParams: [
          { name: 'quote_id', type: 'integer', required: true, desc: 'ID báo giá cần chuyển đổi' },
          { name: 'intake_code', type: 'string', required: true, desc: 'Mã lớp/kỳ khai giảng' },
          { name: 'payment_plan', type: 'string', required: true, desc: 'Hình thức thanh toán: 1_lan, 2_ky, 3_ky, tra_gop' }
        ],
        sampleBody: {
          quote_id: 309,
          intake_code: "MBA-K28",
          payment_plan: "2_ky"
        },
        sampleResponse: {
          success: true,
          message: "Chuyển đổi Đơn bán hàng thành công",
          sales_order_id: 882,
          order_code: "SO-2026-0882",
          total_amount: 105000000
        }
      },
      {
        method: 'GET',
        path: '/backend/api.php?action=sales_orders',
        title: 'Danh Sách Đơn Bán Hàng (Query Sales Orders)',
        description: 'Truy vấn danh sách đơn hàng SO, trạng thái thanh toán, tiến độ hoàn tất hồ sơ và người phụ trách.',
        authRequired: true,
        queryParams: [
          { name: 'status', type: 'string', required: false, desc: 'Trạng thái: draft, approved, completed, cancelled' },
          { name: 'from_date', type: 'string', required: false, desc: 'Từ ngày (YYYY-MM-DD)' },
          { name: 'to_date', type: 'string', required: false, desc: 'Đến ngày (YYYY-MM-DD)' }
        ],
        sampleResponse: {
          success: true,
          orders: [
            {
              id: 882,
              order_code: "SO-2026-0882",
              customer_name: "Hoàng Minh Tuấn",
              program: "Thạc Sĩ QTKD",
              total_amount: 105000000,
              paid_amount: 30000000,
              status: "approved",
              created_at: "2026-09-12"
            }
          ]
        }
      }
    ]
  },

  // 5. TIỀN CỌC & MỐC THANH TOÁN
  {
    id: 'deposits',
    title: '5. Quản Trị Tiền Cọc, Trả Góp & Chia Đợt (Deposits & Payment Milestones)',
    endpoints: [
      {
        method: 'GET',
        path: '/backend/api.php?action=deposits',
        title: 'Danh Sách Hợp Đồng Cọc (Query Deposits)',
        description: 'Lấy danh sách các khoản tiền cọc giữ chỗ, phân bổ đợt thanh toán và tỷ lệ hoa hồng của TVV.',
        authRequired: true,
        queryParams: [
          { name: 'status', type: 'string', required: false, desc: 'pending, confirmed, refunded, completed' },
          { name: 'contact_id', type: 'integer', required: false, desc: 'Lọc theo ID học viên' }
        ],
        sampleResponse: {
          success: true,
          deposits: [
            {
              id: 412,
              deposit_code: "DC-2026-0412",
              contact_name: "Hoàng Minh Tuấn",
              total_price: 105000000,
              deposit_amount: 10000000,
              status: "confirmed",
              expected_commission: 3150000,
              milestones_count: 3
            }
          ]
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=create_deposit',
        title: 'Tạo Hợp Đồng Cọc & Sinh Đợt Đóng Học Phí (Create Deposit & Milestones)',
        description: 'Tạo hợp đồng đặt cọc mới và tự động sinh các mốc thanh toán trong bảng deposit_milestones kèm ngày đến hạn.',
        authRequired: true,
        bodyParams: [
          { name: 'contact_id', type: 'integer', required: true, desc: 'ID học viên' },
          { name: 'project_id', type: 'integer', required: true, desc: 'ID dự án/ngành học' },
          { name: 'price', type: 'number', required: true, desc: 'Tổng học phí hợp đồng' },
          { name: 'deposit_amount', type: 'number', required: true, desc: 'Số tiền đặt cọc giữ chỗ' },
          { name: 'milestones', type: 'array', required: true, desc: 'Danh sách các đợt đóng tiếp theo' }
        ],
        sampleBody: {
          contact_id: 5401,
          project_id: 4,
          price: 105000000,
          deposit_amount: 10000000,
          milestones: [
            { milestone_name: "Đợt 1: Học phí Kỳ I", expected_amount: 45000000, expected_pay_date: "2026-10-15" },
            { milestone_name: "Đợt 2: Học phí Kỳ II", expected_amount: 50000000, expected_pay_date: "2027-02-15" }
          ]
        },
        sampleResponse: {
          success: true,
          message: "Tạo hợp đồng cọc và lịch thanh toán thành công",
          deposit_id: 412,
          milestones_created: 2
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=confirm_deposit_payment',
        title: 'Xác Nhận Thu Tiền Cọc (Confirm Deposit Payment)',
        description: 'Kế toán xác nhận tiền đã vào tài khoản ngân hàng của Viện, cập nhật trạng thái đã thu và kích hoạt quyền học vụ.',
        authRequired: true,
        bodyParams: [
          { name: 'deposit_id', type: 'integer', required: true, desc: 'ID hợp đồng cọc' },
          { name: 'bank_reference', type: 'string', required: true, desc: 'Mã tham chiếu giao dịch ngân hàng / sao kê' },
          { name: 'actual_amount', type: 'number', required: true, desc: 'Số tiền thực nhận' }
        ],
        sampleBody: {
          deposit_id: 412,
          bank_reference: "MBB-FT262559012389",
          actual_amount: 10000000
        },
        sampleResponse: {
          success: true,
          message: "Xác nhận tiền cọc thành công",
          receipt_number: "PT-2026-09-0891"
        }
      }
    ]
  },

  // 6. SẢN PHẨM & BIỂU PHÍ
  {
    id: 'products',
    title: '6. Sản Phẩm, Khóa Học, Biểu Phí & Học Bổng (Product Catalog & Tuition)',
    endpoints: [
      {
        method: 'GET',
        path: '/backend/api.php?action=products',
        title: 'Danh Mục Khóa Học & Ngành Đào Tạo (Get Product Catalog)',
        description: 'Truy vấn toàn bộ chương trình đào tạo đại học, thạc sĩ, chứng chỉ nghề, thời lượng đào tạo và chỉ tiêu tuyển sinh.',
        authRequired: true,
        sampleResponse: {
          success: true,
          products: [
            {
              id: 108,
              code: "MBA-EXEC",
              name: "Thạc Sĩ Quản Trị Kinh Doanh Điều Hành (Executive MBA)",
              duration_months: 18,
              credits: 60,
              base_tuition: 120000000,
              status: "active"
            }
          ]
        }
      },
      {
        method: 'GET',
        path: '/backend/api.php?action=tuition_fee_structure',
        title: 'Cấu Trúc Biểu Phí & Học Phần (Tuition Fee Breakdown)',
        description: 'Xem chi tiết đơn giá từng tín chỉ, phí xét tuyển đầu vào, lệ phí bảo vệ luận văn thạc sĩ và các kỳ hạn đóng.',
        authRequired: true,
        queryParams: [
          { name: 'product_id', type: 'integer', required: true, desc: 'ID chương trình đào tạo' }
        ],
        sampleResponse: {
          success: true,
          product_id: 108,
          curriculum_modules: [
            { module_name: "Quản Trị Chiến Lược Nâng Cao", credits: 3, fee: 6000000 },
            { module_name: "Tài Chính Doanh Nghiệp Toàn Cầu", credits: 3, fee: 6000000 },
            { module_name: "Luận Văn Tốt Nghiệp Thạc Sĩ", credits: 9, fee: 18000000 }
          ]
        }
      }
    ]
  },

  // 7. CHẤM CÔNG SINH TRẮC HỌC
  {
    id: 'attendance',
    title: '7. Chấm Công Đa Phương Thức & Điểm Danh (Attendance & Biometrics)',
    endpoints: [
      {
        method: 'POST',
        path: '/backend/api.php?action=checkin',
        title: 'Chấm Công Vào Ca (Check-In Attendance)',
        description: 'Ghi nhận chấm công vào ca làm việc bằng tọa độ GPS trong bán kính cho phép, đối soát BSSID Wifi văn phòng hoặc quét QR động.',
        authRequired: true,
        bodyParams: [
          { name: 'method', type: 'string', required: true, desc: 'gps, wifi, qr_dynamic, face_ai' },
          { name: 'lat', type: 'number', required: false, desc: 'Vĩ độ GPS thiết bị' },
          { name: 'lng', type: 'number', required: false, desc: 'Kinh độ GPS thiết bị' },
          { name: 'bssid', type: 'string', required: false, desc: 'Địa chỉ MAC trạm phát Wifi văn phòng' },
          { name: 'qr_token', type: 'string', required: false, desc: 'Mã QR Token xoay vòng mỗi 15 giây' }
        ],
        sampleBody: {
          method: "gps",
          lat: 10.7769,
          lng: 106.7009,
          bssid: "74:ac:b9:28:11:0e"
        },
        sampleResponse: {
          success: true,
          message: "Chấm công vào ca thành công",
          checkin_time: "08:28:15",
          status: "on_time",
          distance_meters: 14.5
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=checkout',
        title: 'Chấm Công Ra Ca (Check-Out Attendance)',
        description: 'Ghi nhận chấm công kết thúc ca làm việc, tính toán tổng số giờ làm thực tế và cảnh báo nếu về sớm trước giờ quy định.',
        authRequired: true,
        bodyParams: [
          { name: 'method', type: 'string', required: true, desc: 'Phương thức check-out' }
        ],
        sampleResponse: {
          success: true,
          checkout_time: "17:32:10",
          work_hours: 8.0,
          overtime_hours: 0.5
        }
      },
      {
        method: 'GET',
        path: '/backend/api.php?action=attendance_today',
        title: 'Tình Hình Điểm Danh Hôm Nay (Today Attendance Dashboard)',
        description: 'Quản lý xem nhanh danh sách nhân sự đã có mặt, đi muộn, vắng mặt hoặc đang nghỉ phép có hưởng lương.',
        authRequired: true,
        sampleResponse: {
          success: true,
          total_active_staff: 45,
          present_count: 41,
          late_count: 2,
          leave_count: 2
        }
      }
    ]
  },

  // 8. QUẢN TRỊ NHÂN LỰC & BẢNG LƯƠNG
  {
    id: 'hrm',
    title: '8. Quản Trị Nhân Lực, Nghỉ Phép & Bảng Lương (HRM & Payroll)',
    endpoints: [
      {
        method: 'POST',
        path: '/backend/api.php?action=submit_leave_request',
        title: 'Nộp Đơn Nghỉ Phép (Submit Leave Request)',
        description: 'Tạo đơn xin nghỉ phép (phép năm, ốm đau, việc riêng, thai sản), tự động tính số ngày phép còn lại và gửi thông báo Telegram cho Quản lý.',
        authRequired: true,
        bodyParams: [
          { name: 'leave_type', type: 'string', required: true, desc: 'annual, sick, personal, maternity' },
          { name: 'start_date', type: 'string', required: true, desc: 'Ngày bắt đầu (YYYY-MM-DD)' },
          { name: 'end_date', type: 'string', required: true, desc: 'Ngày kết thúc (YYYY-MM-DD)' },
          { name: 'reason', type: 'string', required: true, desc: 'Lý do nghỉ phép' },
          { name: 'handover_to', type: 'integer', required: false, desc: 'ID đồng nghiệp bàn giao công việc' }
        ],
        sampleBody: {
          leave_type: "annual",
          start_date: "2026-09-20",
          end_date: "2026-09-21",
          reason: "Giải quyết việc gia đình",
          handover_to: 1045
        },
        sampleResponse: {
          success: true,
          message: "Đã nộp đơn nghỉ phép thành công. Đang chờ Quản lý duyệt.",
          leave_request_id: 189
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=approve_leave',
        title: 'Phê Duyệt Đơn Nghỉ Phép (Approve Leave Request)',
        description: 'Trưởng bộ phận hoặc Ban Giám Đốc phê duyệt hoặc từ chối đơn nghỉ phép, cập nhật công phép vào bảng chấm công tháng.',
        authRequired: true,
        bodyParams: [
          { name: 'request_id', type: 'integer', required: true, desc: 'ID đơn xin nghỉ' },
          { name: 'decision', type: 'string', required: true, desc: 'approved hoặc rejected' },
          { name: 'comment', type: 'string', required: false, desc: 'Ý kiến phê duyệt' }
        ],
        sampleBody: {
          request_id: 189,
          decision: "approved",
          comment: "Đã duyệt. Chúc bạn giải quyết việc thuận lợi."
        },
        sampleResponse: {
          success: true,
          message: "Đã phê duyệt đơn nghỉ phép thành công"
        }
      },
      {
        method: 'GET',
        path: '/backend/api.php?action=payroll_calculation',
        title: 'Tính Toán Bảng Lương Đa Tầng (Calculate Monthly Payroll)',
        description: 'Tính lương tháng tự động theo công thức đa tầng: Lương cứng theo ngày công thực tế + Thưởng KPI đạt chỉ tiêu + Hoa hồng hợp đồng cọc - Các khoản giảm trừ bảo hiểm.',
        authRequired: true,
        queryParams: [
          { name: 'month', type: 'integer', required: true, desc: 'Tháng (1-12)' },
          { name: 'year', type: 'integer', required: true, desc: 'Năm (ví dụ 2026)' }
        ],
        sampleResponse: {
          success: true,
          payroll_summary: {
            period: "09/2026",
            total_gross: 650000000,
            total_net: 585000000,
            staff_count: 45
          }
        }
      }
    ]
  },

  // 9. TÀI CHÍNH, THU CHI & NGÂN SÁCH
  {
    id: 'finance',
    title: '9. Tài Chính, Thu Chi & Ngân Sách (Finance & Cashflow)',
    endpoints: [
      {
        method: 'GET',
        path: '/backend/api.php?action=cashflow_summary',
        title: 'Báo Cáo Dòng Tiền & Quỹ Thực Tế (Cashflow Summary)',
        description: 'Xem số dư thực thời gian thực tại quỹ tiền mặt, các tài khoản ngân hàng thương mại và biểu đồ thu chi trong tháng.',
        authRequired: true,
        sampleResponse: {
          success: true,
          cash_on_hand: 85200000,
          bank_accounts: [
            { bank_name: "Vietcombank", account_no: "1028394851", balance: 1420500000 },
            { bank_name: "MBBank", account_no: "8829103948", balance: 890000000 }
          ],
          total_revenue_month: 2310500000,
          total_expense_month: 980200000
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=create_expense_request',
        title: 'Lập Đề Xuất Chi Phí (Create Expense Request)',
        description: 'Tạo phiếu đề nghị chi tiền cho các hoạt động: Quảng cáo, thuê địa điểm, in ấn giáo trình, công tác phí.',
        authRequired: true,
        bodyParams: [
          { name: 'title', type: 'string', required: true, desc: 'Nội dung chi' },
          { name: 'amount', type: 'number', required: true, desc: 'Số tiền đề xuất' },
          { name: 'category', type: 'string', required: true, desc: 'marketing, office, salary, teaching, logistics' },
          { name: 'invoice_attachment', type: 'string', required: false, desc: 'Link file ảnh/PDF hóa đơn đính kèm' }
        ],
        sampleBody: {
          title: "Chi phí chạy chiến dịch quảng cáo Meta Ads tuần 2 tháng 9",
          amount: 45000000,
          category: "marketing",
          invoice_attachment: "/uploads/expenses/inv_meta_sept2.pdf"
        },
        sampleResponse: {
          success: true,
          expense_id: 302,
          status: "pending_manager_approval"
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=approve_expense',
        title: 'Phê Duyệt Phiếu Chi (Approve Expense)',
        description: 'Cấp quản lý hoặc Kế toán trưởng phê duyệt phiếu chi và tự động sinh phiếu xuất quỹ tiền mặt hoặc ủy nhiệm chi ngân hàng.',
        authRequired: true,
        bodyParams: [
          { name: 'expense_id', type: 'integer', required: true, desc: 'ID phiếu chi' },
          { name: 'payment_source', type: 'string', required: true, desc: 'Nguồn tiền chi: cash hoặc bank_account_id' }
        ],
        sampleResponse: {
          success: true,
          message: "Đã phê duyệt và hoàn tất xuất quỹ chi tiền"
        }
      }
    ]
  },

  // 10. NHÀ CUNG CẤP & ĐƠN ĐẶT HÀNG PO
  {
    id: 'suppliers_po',
    title: '10. Nhà Cung Cấp & Đơn Đặt Mua Hàng (Suppliers & Purchase Orders)',
    endpoints: [
      {
        method: 'GET',
        path: '/backend/api.php?action=suppliers',
        title: 'Danh Sách Nhà Cung Cấp (Get Suppliers)',
        description: 'Quản lý danh bạ đối tác cung cấp dịch vụ in ấn, văn phòng phẩm, trang thiết bị phòng học và đơn vị tổ chức sự kiện.',
        authRequired: true,
        sampleResponse: {
          success: true,
          suppliers: [
            {
              id: 28,
              name: "Công ty In Ấn & Quảng Cáo Thăng Long",
              tax_code: "0108920192",
              contact_person: "Trần Đức Nam",
              phone: "0934.111.222",
              category: "In ấn giáo trình & tài liệu"
            }
          ]
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=create_po',
        title: 'Lập Đơn Đặt Mua Hàng (Create Purchase Order)',
        description: 'Tạo đơn đặt mua hàng PO gửi nhà cung cấp, kiểm soát số lượng, đơn giá và quy trình phê duyệt ngân sách.',
        authRequired: true,
        bodyParams: [
          { name: 'supplier_id', type: 'integer', required: true, desc: 'ID nhà cung cấp' },
          { name: 'items', type: 'array', required: true, desc: 'Danh sách mặt hàng cần mua' },
          { name: 'expected_delivery', type: 'string', required: true, desc: 'Hạn giao hàng (YYYY-MM-DD)' }
        ],
        sampleBody: {
          supplier_id: 28,
          expected_delivery: "2026-09-25",
          items: [
            { item_name: "Giáo trình Quản trị Chiến Lược", quantity: 200, unit_price: 150000 },
            { item_name: "Cặp da & Sổ tay chào tân học viên", quantity: 200, unit_price: 250000 }
          ]
        },
        sampleResponse: {
          success: true,
          po_id: 91,
          po_code: "PO-2026-0091",
          total_amount: 80000000,
          status: "pending_approval"
        }
      }
    ]
  },

  // 11. QUẢN LÝ KHO HỌC LIỆU
  {
    id: 'inventory',
    title: '11. Quản Lý Kho Học Liệu & Giáo Trình (Inventory & Warehousing)',
    endpoints: [
      {
        method: 'GET',
        path: '/backend/api.php?action=inventory_items',
        title: 'Danh Mục Tồn Kho (Get Inventory Items)',
        description: 'Xem số lượng tồn kho thực tế của sách giáo trình, đồng phục, cặp da, kỷ niệm chương và quà tặng tuyển sinh.',
        authRequired: true,
        sampleResponse: {
          success: true,
          items: [
            {
              id: 54,
              sku: "BK-MBA-STRAT",
              name: "Giáo Trình Quản Trị Chiến Lược MBA",
              quantity_on_hand: 142,
              safety_stock: 30,
              unit: "Cuốn"
            }
          ]
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=stock_out',
        title: 'Xuất Kho Phát Học Liệu (Stock Out for Students)',
        description: 'Xuất kho sách vở, đồng phục bàn giao cho tân học viên khi hoàn tất thủ tục nhập học chính thức.',
        authRequired: true,
        bodyParams: [
          { name: 'item_id', type: 'integer', required: true, desc: 'ID vật tư' },
          { name: 'quantity', type: 'integer', required: true, desc: 'Số lượng xuất' },
          { name: 'contact_id', type: 'integer', required: true, desc: 'ID học viên nhận' },
          { name: 'reason', type: 'string', required: true, desc: 'Lý do xuất kho' }
        ],
        sampleBody: {
          item_id: 54,
          quantity: 1,
          contact_id: 5401,
          reason: "Phát bộ tài liệu khai giảng lớp MBA-K28"
        },
        sampleResponse: {
          success: true,
          message: "Xuất kho thành công. Tồn kho mới: 141 cuốn."
        }
      }
    ]
  },

  // 12. DỰ ÁN & CÔNG VIỆC KANBAN
  {
    id: 'projects_tasks',
    title: '12. Dự Án & Quản Lý Công Việc Kanban (Projects & Tasks Workflow)',
    endpoints: [
      {
        method: 'GET',
        path: '/backend/api.php?action=project_tasks',
        title: 'Danh Sách Công Việc Dự Án (Get Project Tasks)',
        description: 'Truy vấn các công việc theo dự án tuyển sinh hoặc sự kiện khai giảng, phân loại theo trạng thái Todo, Doing, Review, Done.',
        authRequired: true,
        queryParams: [
          { name: 'project_id', type: 'integer', required: true, desc: 'ID dự án' }
        ],
        sampleResponse: {
          success: true,
          tasks: [
            {
              id: 981,
              title: "Hoàn thiện danh sách phòng thi đầu vào MBA",
              assignee: "Nguyễn Thị Lan",
              priority: "high",
              status: "doing",
              due_date: "2026-09-18"
            }
          ]
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=create_task',
        title: 'Giao Việc Mới (Create Task)',
        description: 'Tạo nhiệm vụ mới cho cá nhân hoặc nhóm, đính kèm checklist và thông báo tới người được giao việc.',
        authRequired: true,
        bodyParams: [
          { name: 'project_id', type: 'integer', required: true, desc: 'ID dự án' },
          { name: 'title', type: 'string', required: true, desc: 'Tên nhiệm vụ' },
          { name: 'assignee_id', type: 'integer', required: true, desc: 'ID nhân sự phụ trách' },
          { name: 'priority', type: 'string', required: true, desc: 'low, medium, high, urgent' },
          { name: 'due_date', type: 'string', required: true, desc: 'Hạn hoàn thành (YYYY-MM-DD)' }
        ],
        sampleResponse: {
          success: true,
          task_id: 982,
          message: "Giao việc thành công"
        }
      }
    ]
  },

  // 13. THU NGÂN TẠI QUẦY & POS
  {
    id: 'pos',
    title: '13. Thu Ngân Tại Quầy & Thanh Toán POS (POS & Counter Billing)',
    endpoints: [
      {
        method: 'POST',
        path: '/backend/api.php?action=generate_vietqr',
        title: 'Sinh Mã VietQR Động Theo Đơn (Generate Dynamic VietQR)',
        description: 'Sinh mã QR thanh toán chuyển khoản liên ngân hàng NAPAS VietQR tự động điền sẵn số tiền và nội dung chuyển khoản mã đơn.',
        authRequired: true,
        bodyParams: [
          { name: 'amount', type: 'number', required: true, desc: 'Số tiền thanh toán (VNĐ)' },
          { name: 'order_code', type: 'string', required: true, desc: 'Mã đơn hàng / hợp đồng cọc' },
          { name: 'customer_name', type: 'string', required: true, desc: 'Họ tên học viên' }
        ],
        sampleBody: {
          amount: 10000000,
          order_code: "DC-0412",
          customer_name: "Hoang Minh Tuan"
        },
        sampleResponse: {
          success: true,
          qr_code_url: "https://img.vietqr.io/image/VCB-1028394851-compact2.png?amount=10000000&addInfo=DC0412%20HoangMinhTuan",
          bank_name: "Vietcombank",
          account_number: "1028394851",
          account_holder: "VIEN DAO TAO IDEAS"
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=pos_checkout',
        title: 'Thanh Toán Tại Quầy & In Biên Lai (POS Counter Checkout)',
        description: 'Thu tiền mặt hoặc quẹt thẻ POS tại bàn tuyển sinh, in biên lai thu tiền tức thì và đồng bộ doanh số ngày.',
        authRequired: true,
        bodyParams: [
          { name: 'contact_id', type: 'integer', required: true, desc: 'ID học viên' },
          { name: 'amount', type: 'number', required: true, desc: 'Số tiền nộp' },
          { name: 'payment_type', type: 'string', required: true, desc: 'cash, pos_card, vietqr' }
        ],
        sampleResponse: {
          success: true,
          receipt_id: "BL-2026-8912",
          printed: true
        }
      }
    ]
  },

  // 14. CHIẾN DỊCH TUYỂN SINH & MARKETING
  {
    id: 'campaigns',
    title: '14. Chiến Dịch Tuyển Sinh & Ngân Sách Marketing (Campaigns & Marketing)',
    endpoints: [
      {
        method: 'GET',
        path: '/backend/api.php?action=campaigns',
        title: 'Danh Sách Chiến Dịch (Get Campaigns)',
        description: 'Truy vấn các chiến dịch tuyển sinh đang hoạt động, ngân sách đã chi, số lượng lead mang về và doanh số thực thu.',
        authRequired: true,
        sampleResponse: {
          success: true,
          campaigns: [
            {
              id: 12,
              name: "Chiến dịch Tuyển sinh MBA Đợt 2 / 2026",
              channel: "Meta Ads & TikTok",
              allocated_budget: 150000000,
              spent_budget: 82000000,
              leads_count: 480,
              cpl: 170833,
              enrolled_count: 32,
              revenue: 3360000000,
              roi_percent: 4097
            }
          ]
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=create_campaign',
        title: 'Tạo Chiến Dịch Tuyển Sinh Mới (Create Campaign)',
        description: 'Khởi tạo chiến dịch marketing mới, cấu hình ngân sách dự toán, gắn mã UTM Source và phân bổ cho đội nhóm tư vấn.',
        authRequired: true,
        bodyParams: [
          { name: 'name', type: 'string', required: true, desc: 'Tên chiến dịch' },
          { name: 'channel', type: 'string', required: true, desc: 'Kênh truyền thông' },
          { name: 'budget', type: 'number', required: true, desc: 'Ngân sách phê duyệt' },
          { name: 'start_date', type: 'string', required: true, desc: 'Ngày bắt đầu' },
          { name: 'end_date', type: 'string', required: true, desc: 'Ngày kết thúc' }
        ],
        sampleResponse: {
          success: true,
          campaign_id: 13,
          message: "Tạo chiến dịch mới thành công"
        }
      }
    ]
  },

  // 15. QUẢNG CÁO CAPI & WEBHOOKS
  {
    id: 'capi_webhooks',
    title: '15. Quảng Cáo Meta CAPI, TikTok Events & Webhooks (Conversions API)',
    endpoints: [
      {
        method: 'POST',
        path: '/backend/api.php?action=send_capi_event',
        title: 'Bắn Sự Kiện Chuyển Đổi Về Pixel (Send Conversions Event)',
        description: 'Truyền tín hiệu chuyển đổi Lead hoặc Purchase (kèm giá trị giao dịch thực tế) về Meta Conversions API và TikTok Events API để tối ưu tệp Lookalike.',
        authRequired: true,
        bodyParams: [
          { name: 'event_name', type: 'string', required: true, desc: 'Lead hoặc Purchase' },
          { name: 'email', type: 'string', required: true, desc: 'Email học viên (hệ thống tự băm SHA256)' },
          { name: 'phone', type: 'string', required: true, desc: 'SĐT học viên (hệ thống tự băm SHA256)' },
          { name: 'value', type: 'number', required: false, desc: 'Giá trị tiền thực thu (dành cho Purchase)' },
          { name: 'currency', type: 'string', required: false, desc: 'VND' }
        ],
        sampleBody: {
          event_name: "Purchase",
          email: "tuan.hm@gmail.com",
          phone: "0912888999",
          value: 10000000,
          currency: "VND"
        },
        sampleResponse: {
          success: true,
          meta_response: { events_received: 1, fbtrace_id: "F2oK92pLm01" },
          tiktok_response: { code: 0, message: "OK" }
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=receive_webhook_lead',
        title: 'Webhook Tiếp Nhận Lead Từ Landing Page (Inbound Lead Webhook)',
        description: 'Cổng tiếp nhận dữ liệu đăng ký tự động từ các trang Landing Page, Google Forms hoặc đối tác tuyển sinh, bảo mật bằng X-Webhook-Secret.',
        authRequired: false,
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Secret": "IDEAS_SECRET_KEY_2026_XYZ"
        },
        bodyParams: [
          { name: 'fullname', type: 'string', required: true, desc: 'Họ và tên' },
          { name: 'phone', type: 'string', required: true, desc: 'Số điện thoại' },
          { name: 'program', type: 'string', required: true, desc: 'Khóa học đăng ký' },
          { name: 'utm_source', type: 'string', required: false, desc: 'Nguồn quảng cáo' }
        ],
        sampleBody: {
          fullname: "Trần Mai Phương",
          phone: "0938.999.111",
          program: "MBA",
          utm_source: "facebook_reels"
        },
        sampleResponse: {
          success: true,
          lead_id: 5403,
          assigned_consultant: "Nguyễn Thị Lan",
          distribution_mode: "round_robin"
        }
      }
    ]
  },

  // 16. BÁO CÁO LỖI DỮ LIỆU & KHIẾU NẠI TICKETS
  {
    id: 'tickets',
    title: '16. Báo Cáo Lỗi Dữ Liệu & Khiếu Nại (Tickets & Data Disputes)',
    endpoints: [
      {
        method: 'GET',
        path: '/backend/api.php?action=tickets',
        title: 'Danh Sách Khiếu Nại Dữ Liệu (Query Quality Tickets)',
        description: 'Xem các ticket báo cáo số điện thoại rác, sai số, không nghe máy do Tư vấn viên nộp.',
        authRequired: true,
        sampleResponse: {
          success: true,
          tickets: [
            {
              id: 78,
              lead_id: 5390,
              consultant_name: "Nguyễn Thị Lan",
              reason: "Số thuê bao không có thực / nhầm máy",
              status: "pending",
              created_at: "2026-09-12 10:15:00"
            }
          ]
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=approve_ticket',
        title: 'Phê Duyệt Ticket & Bù Điểm Chia Số (Approve Quality Ticket)',
        description: 'Quản lý duyệt ticket khiếu nại data rác. Hệ thống tự động cộng credit đền bù vào vòng phân bổ tiếp theo cho Tư vấn viên.',
        authRequired: true,
        bodyParams: [
          { name: 'ticket_id', type: 'integer', required: true, desc: 'ID ticket khiếu nại' },
          { name: 'compensation', type: 'boolean', required: true, desc: 'true nếu duyệt đền bù data' }
        ],
        sampleResponse: {
          success: true,
          message: "Đã duyệt ticket thành công và cộng điểm bù 1 data cho TVV"
        }
      }
    ]
  },

  // 17. BẢN TIN DOANH NGHIỆP & TƯƠNG TÁC NỘI BỘ
  {
    id: 'feed',
    title: '17. Bản Tin Doanh Nghiệp & Tương Tác Nội Bộ (Enterprise Feed & Activities)',
    endpoints: [
      {
        method: 'GET',
        path: '/backend/api.php?action=feed_posts',
        title: 'Lấy Bản Tin Nội Bộ (Get Enterprise Feed)',
        description: 'Truy vấn bài đăng thông báo, vinh danh cá nhân xuất sắc, nội quy viện và các bài thảo luận nội bộ.',
        authRequired: true,
        sampleResponse: {
          success: true,
          posts: [
            {
              id: 67,
              author_name: "Ban Giám Đốc",
              title: "Vinh danh Top Gun Tuyển Sinh Xuất Sắc Tuần 1 Tháng 9",
              content: "Chúc mừng đồng chí Nguyễn Thị Lan đã đạt 145% chỉ tiêu cọc...",
              pinned: true,
              likes_count: 38,
              comments_count: 12
            }
          ]
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=create_feed_post',
        title: 'Đăng Thông Báo Mới (Create Feed Post)',
        description: 'Ban điều hành hoặc quản lý đăng bài thông báo mới lên Enterprise Feed.',
        authRequired: true,
        bodyParams: [
          { name: 'title', type: 'string', required: true, desc: 'Tiêu đề bài viết' },
          { name: 'content', type: 'string', required: true, desc: 'Nội dung chi tiết' },
          { name: 'pinned', type: 'boolean', required: false, desc: 'Ghim lên đầu bảng tin' }
        ],
        sampleResponse: {
          success: true,
          post_id: 68
        }
      }
    ]
  },

  // 18. KHO TỆP ĐÁM MÂY
  {
    id: 'cloud_files',
    title: '18. Kho Tệp Đám Mây & Thư Viện Học Liệu Số (Cloud Files & Digital Assets)',
    endpoints: [
      {
        method: 'GET',
        path: '/backend/api.php?action=cloud_files',
        title: 'Thư Viện Tệp Tin Đám Mây (Get Cloud Files)',
        description: 'Truy vấn tài liệu học tập, hợp đồng đào tạo scan, biểu mẫu biểu phí và giáo trình điện tử.',
        authRequired: true,
        queryParams: [
          { name: 'category_id', type: 'integer', required: false, desc: 'Lọc theo thư mục phân loại' }
        ],
        sampleResponse: {
          success: true,
          files: [
            {
              id: 421,
              file_name: "Hop_Dong_Dao_Tao_MBA_2026.pdf",
              file_size_mb: 2.4,
              category: "Biểu mẫu pháp lý",
              download_url: "/uploads/docs/Hop_Dong_Dao_Tao_MBA_2026.pdf"
            }
          ]
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=upload_file',
        title: 'Tải Lên Tệp Tin An Toàn (Secure File Upload)',
        description: 'Upload file đính kèm với mã hóa tên file an toàn, quét mã độc và nén ảnh tự động.',
        authRequired: true,
        headers: { "Content-Type": "multipart/form-data" },
        bodyParams: [
          { name: 'file', type: 'binary', required: true, desc: 'File cần upload (PDF, PNG, JPG, DOCX)' },
          { name: 'category_id', type: 'integer', required: true, desc: 'Thư mục đích' }
        ],
        sampleResponse: {
          success: true,
          file_id: 422,
          file_url: "/uploads/docs/9a8b7c_doc.pdf"
        }
      }
    ]
  },

  // 19. BÁO CÁO THỐNG KÊ & BI DASHBOARD
  {
    id: 'reports_bi',
    title: '19. Báo Cáo Thống Kê & BI Dashboard (Reports & Business Intelligence)',
    endpoints: [
      {
        method: 'GET',
        path: '/backend/api.php?action=dashboard_metrics',
        title: 'Chỉ Số Điều Hành Real-Time (Executive Dashboard KPI)',
        description: 'Xem toàn cảnh doanh số ngày, tháng, tỷ lệ chuyển đổi Lead-to-Won, số lượng cọc mới và tỷ lệ nhân sự có mặt.',
        authRequired: true,
        sampleResponse: {
          success: true,
          daily_revenue: 125000000,
          monthly_revenue: 2850000000,
          active_leads_count: 854,
          conversion_rate_percent: 18.5,
          top_consultants: [
            { name: "Nguyễn Thị Lan", revenue: 420000000 },
            { name: "Trần Văn Nam", revenue: 380000000 }
          ]
        }
      },
      {
        method: 'GET',
        path: '/backend/api.php?action=fair_share_distribution_report',
        title: 'Báo Cáo Kiểm Toán Chia Số Công Bằng (Fair-Share Distribution Audit)',
        description: 'Báo cáo chi tiết số data được phân bổ cho từng tư vấn viên trong ngày/tuần để giám sát tính công bằng của thuật toán Round-Robin.',
        authRequired: true,
        sampleResponse: {
          success: true,
          consultant_stats: [
            { name: "Nguyễn Thị Lan", assigned: 14, compensation: 2, reminder: 3, total: 19 },
            { name: "Trần Văn Nam", assigned: 14, compensation: 1, reminder: 4, total: 19 }
          ]
        }
      }
    ]
  },

  // 20. TRỢ LÝ TRÍ TUỆ NHÂN TẠO AI
  {
    id: 'ai_engine',
    title: '20. Trợ Lý Trí Tuệ Nhân Tạo AI (AI Copilot & Knowledge Training)',
    endpoints: [
      {
        method: 'POST',
        path: '/backend/api.php?action=ai_chat',
        title: 'Trợ Lý AI Tư Vấn Bán Hàng (AI Sales Copilot Chat)',
        description: 'Gửi câu hỏi của học viên tới mô hình AI đã được huấn luyện bằng tri thức của Viện, nhận gợi ý kịch bản xử lý từ chối và thông tin khóa học chuẩn xác.',
        authRequired: true,
        bodyParams: [
          { name: 'message', type: 'string', required: true, desc: 'Câu hỏi hoặc băn khoăn của khách hàng' },
          { name: 'contact_id', type: 'integer', required: false, desc: 'ID học viên để AI nạp ngữ cảnh hồ sơ' }
        ],
        sampleBody: {
          message: "Học viên hỏi: Tôi đã tốt nghiệp đại học ngành kỹ thuật thì có đủ điều kiện học Thạc sĩ Quản trị Kinh doanh không?",
          contact_id: 5401
        },
        sampleResponse: {
          success: true,
          ai_reply: "Dạ được anh nhé! Theo quy chế tuyển sinh của Viện IDEAS, học viên tốt nghiệp khối ngành Kỹ thuật hoàn toàn đủ điều kiện học Thạc sĩ QTKD sau khi hoàn thành 3 môn học phần bổ sung kiến thức cơ sở...",
          confidence_score: 0.96
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=ai_evaluate_lead',
        title: 'AI Chấm Điểm Tiềm Năng Lead (AI Lead Scoring)',
        description: 'Phân tích thông tin đăng ký của khách hàng để chấm điểm từ 0 - 100 và phân loại nhiệt độ (Hot/Warm/Cold).',
        authRequired: true,
        bodyParams: [
          { name: 'lead_id', type: 'integer', required: true, desc: 'ID lead cần thẩm định' }
        ],
        sampleResponse: {
          success: true,
          ai_score: 88,
          temperature: "Hot",
          rationale: "Khách hàng có ngân sách tự chi trả, vị trí quản lý và dự định học ngay trong tháng 10."
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=ai_train_document',
        title: 'Nạp Tài Liệu Huấn Luyện AI (Ingest Knowledge Document)',
        description: 'Upload tài liệu quy chế đào tạo, cẩm nang tư vấn tuyển sinh để trích xuất văn bản và nạp vào Vector Database cho AI.',
        authRequired: true,
        bodyParams: [
          { name: 'document_title', type: 'string', required: true, desc: 'Tên tài liệu' },
          { name: 'document_text', type: 'string', required: true, desc: 'Nội dung tri thức' }
        ],
        sampleResponse: {
          success: true,
          message: "Đã trích xuất và huấn luyện 14 đoạn tri thức mới cho AI thành công"
        }
      }
    ]
  },

  // 21. HÀNG ĐỢI NGẦM, AMAZON SES, ZALO BOT & TELEGRAM
  {
    id: 'queue_messaging',
    title: '21. Hàng Đợi Ngầm, Amazon SES Mail, Zalo Bot & Telegram Bot (Queue & Messaging Workers)',
    endpoints: [
      {
        method: 'GET',
        path: '/backend/api.php?action=get_queue_stats',
        title: 'Thống Kê Hàng Đợi (Queue Statistics)',
        description: 'Xem trạng thái hoạt động của các hàng đợi ngầm (mail_queue, zalo_queue, telegram_queue), số lượng tác vụ pending, processing, sent và failed.',
        authRequired: true,
        sampleResponse: {
          success: true,
          mail_queue: { pending: 12, processing: 2, sent_today: 1840, failed: 3 },
          zalo_queue: { pending: 5, processing: 1, sent_today: 420, failed: 0 },
          telegram_queue: { pending: 2, processing: 0, sent_today: 310, failed: 0 },
          worker_status: "running",
          engine: "MySQL 8.0 SKIP LOCKED + Amazon SES SMTP"
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=queue_email',
        title: 'Đưa Email Vào Hàng Đợi Ngầm (Queue Email)',
        description: 'Đẩy email vào bảng mail_queue để worker cron_mailer.php quét gửi qua Amazon SES Port 587 STARTTLS với cơ chế Rate Limit 100ms.',
        authRequired: true,
        bodyParams: [
          { name: 'to_email', type: 'string', required: true, desc: 'Email người nhận' },
          { name: 'subject', type: 'string', required: true, desc: 'Tiêu đề email' },
          { name: 'body_html', type: 'string', required: true, desc: 'Nội dung HTML chuẩn template thương hiệu' },
          { name: 'lead_id', type: 'integer', required: false, desc: 'ID khách hàng liên kết' }
        ],
        sampleBody: {
          to_email: "tuan.hm@gmail.com",
          subject: "Thông báo lịch khai giảng lớp MBA-K28",
          body_html: "<h2>Chào anh Tuấn,</h2><p>Lễ khai giảng của anh sẽ diễn ra vào...</p>",
          lead_id: 5401
        },
        sampleResponse: {
          success: true,
          queue_id: 5120,
          status: "pending"
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=send_test_email',
        title: 'Kiểm Tra Kết Nối Amazon SES SMTP (Test Email SES)',
        description: 'Gửi thử nghiệm email đồng bộ trực tiếp qua Amazon SES SMTP Port 587 STARTTLS để kiểm tra thông số máy chủ, tính hợp lệ của tài khoản và tốc độ bắt tay TLS.',
        authRequired: true,
        bodyParams: [
          { name: 'to_email', type: 'string', required: true, desc: 'Email nhận kiểm tra' },
          { name: 'subject', type: 'string', required: false, desc: 'Tiêu đề thử nghiệm' },
          { name: 'content', type: 'string', required: false, desc: 'Nội dung kiểm tra kết nối' }
        ],
        sampleResponse: {
          success: true,
          message: "Gửi email kiểm tra qua Amazon SES thành công",
          provider: "ses",
          smtp_host: "email-smtp.ap-southeast-1.amazonaws.com",
          latency_ms: 185
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=queue_zalo_message',
        title: 'Đưa Tin Nhắn Vào Hàng Đợi Zalo (Queue Zalo Message)',
        description: 'Đẩy tin nhắn văn bản vào bảng zalo_queue để worker xử lý ngầm, hỗ trợ định tuyến tới Zalo cá nhân của Tư vấn viên hoặc Group Admin.',
        authRequired: true,
        bodyParams: [
          { name: 'chat_id', type: 'string', required: true, desc: 'Zalo Chat ID của TVV hoặc Group ID' },
          { name: 'body_text', type: 'string', required: true, desc: 'Nội dung thông báo' },
          { name: 'lead_id', type: 'integer', required: false, desc: 'ID khách hàng liên kết' }
        ],
        sampleResponse: {
          success: true,
          zalo_queue_id: 3810,
          status: "pending"
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=send_telegram_alert',
        title: 'Bắn Cảnh Báo Telegram Theo Kênh (Send Telegram Alert)',
        description: 'Gửi tin nhắn tức thời tới một trong 3 nhóm Telegram chuyên biệt: Sales Channel, Approvals Channel hoặc Daily Reports Channel.',
        authRequired: true,
        bodyParams: [
          { name: 'channel_type', type: 'string', required: true, desc: 'sales, approvals, reports' },
          { name: 'message', type: 'string', required: true, desc: 'Nội dung định dạng HTML hoặc Markdown' }
        ],
        sampleBody: {
          channel_type: "sales",
          message: "🔥 <b>[LEAD MỚI]</b> Hoàng Minh Tuấn - 0912.888.999 - Khóa MBA (Điểm AI: 88). Bấm vào đây để gọi ngay!"
        },
        sampleResponse: {
          success: true,
          dispatched_channel: "sales_group"
        }
      },
      {
        method: 'GET',
        path: '/backend/api.php?action=notifications_bell',
        title: 'Lấy Thông Báo Chuông In-App (Get In-App Notifications)',
        description: 'Truy vấn danh sách thông báo chuông của người dùng hiện tại, số lượng tin chưa đọc và liên kết chuyển hướng nhanh.',
        authRequired: true,
        sampleResponse: {
          success: true,
          unread_count: 3,
          notifications: [
            {
              id: 902,
              title: "Bạn vừa được giao khách hàng mới",
              body: "Khách hàng Hoàng Minh Tuấn quan tâm khóa học MBA.",
              link: "/contacts?id=5401",
              is_read: 0,
              created_at: "2026-09-12 14:30:00"
            }
          ]
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=update_notification_matrix',
        title: 'Cấu Hình Ma Trận Thông Báo Cá Nhân (Update Notification Matrix)',
        description: 'Người dùng tùy chỉnh nhận hay không nhận thông báo qua 4 kênh độc lập (Chuông, Zalo, Telegram, Email) cho từng loại sự kiện.',
        authRequired: true,
        bodyParams: [
          { name: 'matrix_config', type: 'object', required: true, desc: 'Cấu hình bật/tắt theo từng sự kiện và kênh' }
        ],
        sampleResponse: {
          success: true,
          message: "Lưu cấu hình ma trận thông báo thành công"
        }
      }
    ]
  },

  // 22. BÁO CÁO TỰ ĐỘNG ĐỊNH KỲ & NHẮC LỊCH
  {
    id: 'cron_automation',
    title: '22. Báo Cáo Tự Động Định Kỳ & Tự Động Nhắc Lịch (Daily/Weekly/Monthly Reports & Reminders)',
    endpoints: [
      {
        method: 'POST',
        path: '/backend/api.php?action=trigger_daily_report',
        title: 'Kích Hoạt Tổng Kết Báo Cáo Ngày (Trigger Daily Report)',
        description: 'Chạy tức thời thuật toán Cửa sổ thời gian trượt (Sliding Time Window) trong cron_daily_report.php, tổng hợp số liệu chia số, AI Pre-Screener, Tickets lỗi và bắn đồng thời tới Zalo Group, Telegram Group và Email Ban Giám Đốc.',
        authRequired: true,
        headers: { "Authorization": "Bearer YOUR_SUPER_ADMIN_TOKEN" },
        sampleResponse: {
          success: true,
          message: "Đã tổng kết và gửi báo cáo ngày thành công",
          window_start: "2026-09-11 22:00:00",
          window_end: "2026-09-12 16:20:00",
          metrics: {
            total_leads: 85,
            round_robin: 62,
            compensation: 15,
            reminders: 8,
            held_by_ai: 3,
            below_standard: 7,
            tickets_opened: 4,
            blocked_blacklist: 12
          },
          dispatched_channels: {
            zalo_group: true,
            telegram_group: true,
            email_admins_count: 5
          }
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=trigger_deposit_reminders',
        title: 'Kích Hoạt Nhắc Tiền Cọc Đến Hạn (Trigger Deposit Reminders)',
        description: 'Quét các mốc deposit_milestones sắp đến hạn theo remind_days_before và tự động gửi email thông báo học phí kèm số tài khoản cho học viên.',
        authRequired: true,
        sampleResponse: {
          success: true,
          reminders_sent: 14,
          message: "Đã gửi 14 email nhắc đóng tiền cọc đợt tiếp theo"
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=trigger_academic_reminders',
        title: 'Kích Hoạt Nhắc Lịch Học Vụ & Luận Văn (Trigger Academic Reminders)',
        description: 'Quét hạn nộp đề cương, luận văn thạc sĩ và lịch các buổi học sắp diễn ra để gửi email nhắc học viên và giảng viên.',
        authRequired: true,
        sampleResponse: {
          success: true,
          reminders_sent: 28,
          message: "Đã gửi thông báo lịch học và mốc luận văn thạc sĩ thành công"
        }
      }
    ]
  },

  // 23. TÌM KIẾM TOÀN CỤC & KHỬ TRÙNG
  {
    id: 'search_dedup',
    title: '23. Tìm Kiếm Toàn Cục & Khử Trùng (Omni-Search & Deduplication)',
    endpoints: [
      {
        method: 'GET',
        path: '/backend/api.php?action=omni_search',
        title: 'Tìm Kiếm Toàn Cục (Omni-Search Across ERP)',
        description: 'Tìm kiếm siêu tốc mọi đối tượng trong hệ thống: Họ tên học viên, số điện thoại, địa chỉ email, mã đơn hàng SO, mã hợp đồng cọc và hóa đơn chi phí.',
        authRequired: true,
        queryParams: [
          { name: 'q', type: 'string', required: true, desc: 'Từ khóa tìm kiếm (tối thiểu 2 ký tự)' }
        ],
        sampleResponse: {
          success: true,
          query: "0912888999",
          results: {
            contacts: [{ id: 5401, name: "Hoàng Minh Tuấn", phone: "0912.888.999" }],
            deals: [{ id: 1204, title: "Deal MBA - Hoàng Minh Tuấn" }],
            sales_orders: [{ id: 882, order_code: "SO-2026-0882" }]
          }
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=check_duplicate_lead',
        title: 'Kiểm Tra Trùng Lặp Khách Hàng (Check Lead Duplication)',
        description: 'So khớp số điện thoại và email với cơ sở dữ liệu để phòng ngừa tạo trùng khách hàng và kiểm tra quy tắc 6 tháng tái phân bổ.',
        authRequired: true,
        bodyParams: [
          { name: 'phone', type: 'string', required: true, desc: 'Số điện thoại cần kiểm tra' },
          { name: 'email', type: 'string', required: false, desc: 'Email cần kiểm tra' }
        ],
        sampleResponse: {
          success: true,
          is_duplicate: true,
          existing_lead_id: 5401,
          assigned_to: "Nguyễn Thị Lan",
          created_at: "2026-09-10",
          rule_applied: "Lead đang được chăm sóc trong vòng 180 ngày"
        }
      }
    ]
  },

  // 24. BẢO MẬT & NHẬT KÝ KIỂM TOÁN
  {
    id: 'security_audit',
    title: '24. Bảo Mật, Nhật Ký Kiểm Toán & Khóa Tranh Chấp (Security, Audit & Advisory Locks)',
    endpoints: [
      {
        method: 'GET',
        path: '/backend/api.php?action=audit_logs',
        title: 'Truy Vấn Nhật Ký Kiểm Toán Bất Biến (Audit Trail)',
        description: 'Lấy lịch sử mọi hành động nhạy cảm trong hệ thống (phân quyền, xóa dữ liệu, duyệt tiền, đổi sale). Dữ liệu chỉ đọc và không thể can thiệp.',
        authRequired: true,
        queryParams: [
          { name: 'user_id', type: 'integer', required: false, desc: 'Lọc theo ID người thao tác' },
          { name: 'action', type: 'string', required: false, desc: 'Lọc theo hành động (UPDATE_LEAD, APPROVE_EXPENSE,...)' },
          { name: 'from_date', type: 'string', required: false, desc: 'Từ ngày (YYYY-MM-DD)' },
          { name: 'to_date', type: 'string', required: false, desc: 'Đến ngày (YYYY-MM-DD)' }
        ],
        sampleResponse: {
          success: true,
          total: 8420,
          logs: [
            {
              id: 18902,
              user_id: 100001,
              username: "director",
              action: "APPROVE_EXPENSE",
              target_table: "expenses",
              record_id: 302,
              ip_address: "14.232.180.45",
              details: "Phê duyệt phiếu chi mua trang thiết bị Lab số tiền 320,000,000 đ",
              created_at: "2026-09-12 11:20:15"
            }
          ]
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=verify_idempotency',
        title: 'Kiểm Tra & Khóa Khóa Trùng Lặp (Idempotency Check)',
        description: 'Kiểm tra xem một mã giao dịch X-Idempotency-Key đã được thực thi hay chưa nhằm phòng ngừa Double-Submit khi thanh toán hoặc tạo đơn hàng.',
        authRequired: true,
        bodyParams: [
          { name: 'idempotency_key', type: 'string', required: true, desc: 'UUID v4 sinh từ Client' },
          { name: 'action_scope', type: 'string', required: true, desc: 'Phạm vi giao dịch (CREATE_SO, APPROVE_PO, CONFIRM_DEPOSIT)' }
        ],
        sampleResponse: {
          success: true,
          is_processed: false,
          message: "Khóa hợp lệ và chưa từng được thực thi. Cho phép tiếp tục giao dịch."
        }
      },
      {
        method: 'GET',
        path: '/backend/api.php?action=active_advisory_locks',
        title: 'Giám Sát Khóa Tranh Chấp Đồng Thời (Active MySQL Advisory Locks)',
        description: 'Xem các khóa phân bổ chia số GET_LOCK và khóa hàng đợi đang được giữ nhằm phòng ngừa Race Condition giữa các tiến trình.',
        authRequired: true,
        sampleResponse: {
          success: true,
          active_locks: [
            { lock_name: "lead_distribution_tenant_1", acquired_at: "2026-09-12 16:20:00", timeout_sec: 5 }
          ]
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=revoke_token',
        title: 'Vô Hiệu Hóa Token (Token Revocation & Blacklisting)',
        description: 'Đưa Access Token hoặc Refresh Token vào danh sách đen (Blacklist) khi người dùng đổi mật khẩu, đăng xuất hoặc khi phát hiện đăng nhập bất thường.',
        authRequired: true,
        bodyParams: [
          { name: 'token', type: 'string', required: true, desc: 'Chuỗi JWT Access Token hoặc Refresh Token cần thu hồi' },
          { name: 'reason', type: 'string', required: false, desc: 'Lý do thu hồi (user_logout, password_change, security_alert)' }
        ],
        sampleResponse: {
          success: true,
          message: "Token đã được đưa vào Blacklist và vô hiệu hóa ngay lập tức trên toàn hệ thống."
        }
      }
    ]
  },

  // 25. HỌC VỤ, GIẢNG VIÊN, LỊCH HỌC & ĐỒNG BỘ BẢNG ĐIỂM
  {
    id: 'academic_schedule',
    title: '25. Học Vụ, Giảng Viên, Lịch Học & Đồng Bộ Bảng Điểm (Academic, Lecturer Hours & Grades)',
    endpoints: [
      {
        method: 'GET',
        path: '/backend/api.php?action=public_student_schedule',
        title: 'Tra Cứu Lịch Học, Lịch Giảng Dạy & Thời Khóa Biểu (Academic Master Schedule)',
        description: 'Cổng tra cứu thời khóa biểu và lịch giảng tích hợp Zoom, phòng học, giáo trình môn học. Hỗ trợ 3 chế độ: theo học viên (customer_id), theo khóa học (campaign_id) hoặc theo giảng viên (lecturer_id).',
        authRequired: false,
        queryParams: [
          { name: 'customer_id', type: 'integer', required: false, desc: 'ID học viên (xem lịch học cá nhân)' },
          { name: 'campaign_id', type: 'integer', required: false, desc: 'ID lớp / khóa học (xem thời khóa biểu lớp)' },
          { name: 'lecturer_id', type: 'string', required: false, desc: 'ID giảng viên hoặc "all" (xem lịch giảng dạy)' }
        ],
        sampleResponse: {
          success: true,
          mode: "customer",
          student_info: {
            id: 5401,
            name: "Hoàng Minh Tuấn",
            student_code: "MBA2026-089",
            class_name: "MBA Khóa 24 - Đợt 1"
          },
          subjects: [
            {
              subject_id: 101,
              subject_code: "MBA-701",
              subject_name: "Quản Trị Chiến Lược Nâng Cao",
              credits: 3,
              lecturer_id: 88,
              lecturer_name: "GS.TS. Vũ Đình Thành",
              sessions: [
                {
                  session_number: 1,
                  date: "2026-09-18",
                  time: "18:30 - 21:30",
                  room: "Hội Trường B - Cơ Sở 1",
                  format: "offline",
                  zoom_link: null,
                  materials_url: "https://drive.ideas.edu.vn/materials/mba701-buoi1.pdf"
                },
                {
                  session_number: 2,
                  date: "2026-09-20",
                  time: "08:30 - 11:30",
                  room: "Phòng Trực Tuyến 01",
                  format: "online",
                  zoom_link: "https://zoom.us/j/88921981290",
                  zoom_passcode: "IDEAS2026",
                  materials_url: "https://drive.ideas.edu.vn/materials/mba701-buoi2.pdf"
                }
              ]
            }
          ]
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=record_teaching_hours',
        title: 'Ghi Nhận Giờ Giảng Dạy & Tính Thù Lao Giảng Viên (Record Teaching Hours)',
        description: 'Ghi nhận số giờ giảng dạy thực tế của giảng viên cơ hữu hoặc thỉnh giảng, đối soát hệ số học hàm, đính kèm biên bản buổi học và tạo phiếu duyệt thù lao chuyển Kế toán.',
        authRequired: true,
        bodyParams: [
          { name: 'lecturer_id', type: 'integer', required: true, desc: 'ID giảng viên' },
          { name: 'subject_id', type: 'integer', required: true, desc: 'ID môn học' },
          { name: 'class_id', type: 'integer', required: true, desc: 'ID lớp học / khóa học' },
          { name: 'teaching_date', type: 'string', required: true, desc: 'Ngày giảng dạy (YYYY-MM-DD)' },
          { name: 'hours_taught', type: 'number', required: true, desc: 'Số giờ giảng dạy thực tế (ví dụ: 3.5)' },
          { name: 'lecturer_type', type: 'string', required: true, desc: 'internal (cơ hữu) hoặc visiting (thỉnh giảng)' },
          { name: 'hourly_rate', type: 'number', required: true, desc: 'Đơn giá giờ giảng (VND)' },
          { name: 'multiplier', type: 'number', required: false, desc: 'Hệ số ngoài giờ / cuối tuần (mặc định 1.0)' },
          { name: 'attendance_sheet_url', type: 'string', required: false, desc: 'Link biên bản buổi học / phiếu điểm danh' },
          { name: 'notes', type: 'string', required: false, desc: 'Ghi chú nội dung bài giảng' }
        ],
        sampleBody: {
          lecturer_id: 88,
          subject_id: 101,
          class_id: 42,
          teaching_date: "2026-09-18",
          hours_taught: 3.5,
          lecturer_type: "visiting",
          hourly_rate: 800000,
          multiplier: 1.2,
          attendance_sheet_url: "https://drive.ideas.edu.vn/attendance/2026-09-18-mba24.pdf",
          notes: "Giảng Chuyên đề 1: Phân tích ma trận cạnh tranh Porter"
        },
        sampleResponse: {
          success: true,
          message: "Ghi nhận giờ giảng dạy thành công",
          record_id: 1205,
          total_remuneration: 3360000,
          approval_status: "pending_academic_review"
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=sync_subject_grades',
        title: 'Đồng Bộ Bảng Điểm Tín Chỉ Môn Học (Sync Subject Grades & GPA)',
        description: 'Cập nhật điểm thành phần (chuyên cần, giữa kỳ, thi cuối kỳ) vào trường grades_json của học viên, tự động tính điểm tổng kết thang 10, thang 4 và xếp loại tín chỉ.',
        authRequired: true,
        bodyParams: [
          { name: 'customer_id', type: 'integer', required: true, desc: 'ID học viên' },
          { name: 'subject_id', type: 'integer', required: true, desc: 'ID môn học' },
          { name: 'subject_code', type: 'string', required: true, desc: 'Mã môn học (ví dụ: MBA-701)' },
          { name: 'attendance_score', type: 'number', required: true, desc: 'Điểm chuyên cần (10% - thang 10)' },
          { name: 'midterm_score', type: 'number', required: true, desc: 'Điểm giữa kỳ (30% - thang 10)' },
          { name: 'final_score', type: 'number', required: true, desc: 'Điểm thi cuối kỳ (60% - thang 10)' },
          { name: 'credits', type: 'integer', required: true, desc: 'Số tín chỉ của môn' }
        ],
        sampleBody: {
          customer_id: 5401,
          subject_id: 101,
          subject_code: "MBA-701",
          attendance_score: 9.5,
          midterm_score: 8.5,
          final_score: 8.0,
          credits: 3
        },
        sampleResponse: {
          success: true,
          message: "Đồng bộ điểm môn học thành công",
          grade_summary: {
            raw_score: 8.3,
            gpa_4: 3.5,
            letter_grade: "B+",
            is_passed: true,
            accumulated_credits: 24
          }
        }
      },
      {
        method: 'GET',
        path: '/backend/api.php?action=thesis_progress',
        title: 'Theo Dõi Tiến Độ Luận Văn Thạc Sĩ (Thesis Milestones & Supervision)',
        description: 'Truy vấn tiến độ thực hiện luận văn tốt nghiệp, thông tin giảng viên hướng dẫn (Supervisor), mốc nộp đề cương, kết quả kiểm tra trùng lặp Turnitin và hội đồng bảo vệ.',
        authRequired: true,
        queryParams: [
          { name: 'customer_id', type: 'integer', required: true, desc: 'ID học viên cao học' }
        ],
        sampleResponse: {
          success: true,
          thesis_info: {
            topic_title: "Ứng Dụng Chuyển Đổi Số Trong Quản Trị Chuỗi Cung Ứng Ngành Bán Lẻ",
            supervisor: {
              id: 92,
              name: "TS. Nguyễn Hoàng Nam",
              email: "nam.nh@ideas.edu.vn"
            },
            current_stage: "independent_review",
            turnitin_similarity: "12.4%",
            milestones: [
              { stage: "proposal_approval", name: "Duyệt Đề Cương", status: "passed", date: "2026-03-15", grade: 8.8 },
              { stage: "progress_report_1", name: "Báo Cáo Tiến Độ 1", status: "passed", date: "2026-05-20" },
              { stage: "plagiarism_check", name: "Kiểm Tra Trùng Lặp Turnitin", status: "passed", date: "2026-08-10" },
              { stage: "independent_review", name: "Phản Biện Độc Lập", status: "in_progress", deadline: "2026-09-30" },
              { stage: "final_defense", name: "Bảo Vệ Hội Đồng", status: "pending", scheduled_date: "2026-10-25" }
            ]
          }
        }
      },
      {
        method: 'POST',
        path: '/backend/api.php?action=submit_session_attendance',
        title: 'Điểm Danh Buổi Học & Ghi Nhận Hiện Diện (Session Attendance Check-in)',
        description: 'Điểm danh từng học viên theo buổi học, phân loại có mặt / vắng có phép / vắng không phép và tự động phát cảnh báo cấm thi nếu vượt quá 20% số buổi vắng.',
        authRequired: true,
        bodyParams: [
          { name: 'class_id', type: 'integer', required: true, desc: 'ID lớp học' },
          { name: 'session_id', type: 'integer', required: true, desc: 'ID buổi học' },
          { name: 'attendance_list', type: 'array', required: true, desc: 'Mảng danh sách học viên và trạng thái' }
        ],
        sampleBody: {
          class_id: 42,
          session_id: 301,
          attendance_list: [
            { customer_id: 5401, status: "present", note: "" },
            { customer_id: 5402, status: "absent_excused", note: "Có đơn xin phép công tác" },
            { customer_id: 5403, status: "present", note: "" }
          ]
        },
        sampleResponse: {
          success: true,
          message: "Điểm danh buổi học thành công. Đã cập nhật tỷ lệ chuyên cần.",
          total_present: 32,
          total_absent: 2
        }
      }
    ]
  }
];
