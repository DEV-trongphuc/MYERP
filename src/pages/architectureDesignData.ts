export interface ArchSectionBlock {
  id: string;
  heading: string;
  paragraphs?: string[];
  bullets?: Array<{ label?: string; text: string; code?: string }>;
  diagram?: 'c4' | 'approval-state' | 'lead-pipeline' | 'ai-sequence' | 'core-erd' | 'z-index';
  table?: {
    headers: string[];
    rows: string[][];
  };
  callout?: {
    tone: 'info' | 'warn' | 'success';
    title: string;
    body: string;
  };
  codeBlock?: {
    title: string;
    lang: string;
    code: string;
  };
}

export interface ArchChapter {
  id: string;
  code: string;
  group: string;
  title: string;
  shortTitle: string;
  summary: string;
  badges: Array<{ label: string; tone?: 'slate' | 'blue' | 'green' | 'amber' | 'red' }>;
  fileAnchors: string[];
  sections: ArchSectionBlock[];
}

export const archChapters: ArchChapter[] = [
  {
    id: 'c4-topology',
    code: 'ARCH 01',
    group: 'I. KIẾN TRÚC TỔNG THỂ',
    title: '1. Bức tranh Tổng thể & C4 Container Topology',
    shortTitle: 'C4 Container Topology',
    summary:
      'MYERP (Enterprise SaaS Operations Suite) vận hành theo kiến trúc Modular Monolith kết hợp Dual-Router Gateway, tối ưu cho môi trường LiteSpeed/Apache PHP 8.1+ và React 19 SPA/PWA đa tenant.',
    badges: [
      { label: 'Modular Monolith', tone: 'blue' },
      { label: 'React 19 + TS', tone: 'slate' },
      { label: 'PHP 8.1+ Dual-Router', tone: 'green' },
      { label: 'MySQL ~251 Tables', tone: 'amber' }
    ],
    fileAnchors: ['src/App.tsx', 'vite.config.ts', 'backend/api.php', 'backend/index.php', 'backend/cron_master.php'],
    sections: [
      {
        id: 'sec-c4-diagram',
        heading: '1.1. Sơ đồ Luồng Kết nối & Hạ tầng C4 (Container Topology)',
        paragraphs: [
          'Mọi yêu cầu từ Client SPA/PWA đều đi qua lớp biên .htaccess (ép PHP alt-php81, chống cache file cấu hình động và trả đúng 404 cho các JS chunk cũ). Luồng API tự động rẽ nhánh từ Gateway Bridge (api.php) sang Front-Controller OOP (index.php) hoặc động cơ Marketing Automation.'
        ],
        diagram: 'c4'
      },
      {
        id: 'sec-c4-containers',
        heading: '1.2. Bản đồ Các Thành phần Cốt lõi (Workspace Inventory)',
        table: {
          headers: ['Thành phần', 'Công nghệ / Quy mô', 'Vai trò Kiến trúc', 'File Neo Chính'],
          rows: [
            [
              'Frontend SPA / PWA (src/)',
              'React 19.2, TypeScript ~6.0, Vite 8.0, Tailwind 4.3 (81 pages, 550+ components)',
              'Giao diện quản trị hợp nhất: CRM, Học vụ, Tài chính, Đặt cọc, PO/SO/POS, HRM, WorkChat, Marketing Studio',
              'src/App.tsx, vite.config.ts'
            ],
            [
              'PWA & HTTP Edge (public/)',
              'Pass-Through Service Worker + LiteSpeed .htaccess',
              'Cài đặt PWA Desktop/Mobile không kẹt cache chunk cũ; Cache-Control: no-store cho version.json & index.html',
              'public/sw.js, public/.htaccess'
            ],
            [
              'Dual API Gateway (backend/)',
              'PHP 8.1+, PDO Prepared Statements + MySQLi',
              'Cổng /api/* đi qua api.php -> chuyển tiếp 57+ domain REST sang OOP index.php',
              'backend/api.php, backend/index.php'
            ],
            [
              'OOP Domain Controllers',
              '65+ files tại backend/controllers/ + 6 Chat Traits',
              'Xử lý nghiệp vụ CRM, Tài chính, Cọc, PO/SO, HRM, Học vụ, WorkChat SSE, AI Multi-Agent & Meta Ads',
              'backend/controllers/AgentToolRegistry.php'
            ],
            [
              'Marketing Engine',
              '288 files tại backend/automation/ (18 worker tiến trình)',
              'Thực thi Flow đa kênh (FlowExecutor), Email SES/SMTP, Zalo OA/ZNS, Survey, Voucher, Web Tracking',
              'backend/automation/FlowExecutor.php'
            ],
            [
              'Database & Migrations',
              'MySQL / MariaDB utf8mb4_unicode_ci (~251 bảng, 338 migrations)',
              'Cô lập theo tenant_id & workspace_id, chuẩn 100% Soft-Delete (deleted_at IS NULL), giao dịch ACID',
              'backend/run_migrations.php, database_schema.md'
            ],
            [
              'Background Scheduling',
              'backend/cron_master.php + 11 child cron/workers',
              'Orchestrator 1 phút/lần dùng flock(), Sync Google Sheets 2 chiều, Mailer, Reminder học vụ/công nợ',
              'backend/cron_master.php, backend/cron_sync.php'
            ],
            [
              'Automated QA Suite (tests/)',
              'Node.js & PHP Test Harness (143 ca 4 tầng)',
              'Kiểm định hồi quy tính năng, biên NULL/năm nhuận, tương tác chéo phân hệ và phòng thủ đa tenant',
              'tests/e2e/runner.js'
            ]
          ]
        }
      }
    ]
  },
  {
    id: 'frontend-arch',
    code: 'ARCH 02',
    group: 'II. KIẾN TRÚC FRONTEND',
    title: '2. Frontend SPA/PWA, Routing, State & Networking',
    shortTitle: 'Frontend React 19 & PWA',
    summary:
      'Tối ưu trải nghiệm 0ms instant open với Persistent AppTabs, tách 8 vendor chunk, Service Worker pass-through chống lỗi trắng trang khi deploy bản mới, Zustand persistence và chuẩn 6 tầng Z-Index Overlay.',
    badges: [
      { label: 'Persistent AppTabs', tone: 'blue' },
      { label: 'Pass-Through PWA', tone: 'green' },
      { label: 'Zustand Stores', tone: 'slate' },
      { label: '6-Tier Overlay', tone: 'amber' }
    ],
    fileAnchors: ['vite.config.ts', 'src/App.tsx', 'src/api/axios.ts', 'src/utils/overlayStack.ts', 'src/utils/safeArray.ts'],
    sections: [
      {
        id: 'sec-fe-build',
        heading: '2.1. Đóng gói Build, Version Stamping & Chống Kẹt Cache PWA',
        bullets: [
          {
            label: 'versionManifestPlugin()',
            text: 'Mỗi lần npm run build sinh timestamp buildVersion ghi đồng bộ vào public/version.json, backend/version.json và cập nhật SW_VERSION trong sw.js.',
            code: 'vite.config.ts'
          },
          {
            label: '8 Manual Vendor Chunks',
            text: 'Tách riêng vendor-react, vendor-charts, vendor-icons, vendor-xlsx, vendor-pptx, vendor-framer, vendor-dnd và vendor chung giúp giữ cache dài hạn khi cập nhật UI nghiệp vụ.',
            code: 'vite.config.ts'
          },
          {
            label: 'Pass-Through Service Worker',
            text: 'Handler fetch trong public/sw.js không chặn event.respondWith() để tránh kẹt bundle JS cũ; .htaccess ép no-store cho version.json/index.html và trả 404 thật nếu asset hash cũ biến mất.',
            code: 'public/sw.js'
          },
          {
            label: 'Phát hiện Bản mới Realtime',
            text: 'Axios đọc header X-App-Version từ mọi phản hồi backend và phát sự kiện app-backend-version kết hợp AutoUpdateChecker.tsx đối chiếu /version.json.',
            code: 'src/api/axios.ts'
          },
          {
            label: 'Safe Array Collection Guards',
            text: 'Bộ helper ensureArray() & extractArray() bọc trước toàn bộ API response unwrapping (res.data, res.data.items, { rows, list }) nhằm ngăn runtime TypeError khi dữ liệu rỗng hoặc lỗi.',
            code: 'src/utils/safeArray.ts'
          }
        ]
      },
      {
        id: 'sec-fe-routes',
        heading: '2.2. Vòng đời Định tuyến (App.tsx) & Keep-Alive Tab Persistence',
        paragraphs: [
          'Pre-React Splash Guard tại index.html kiểm tra token và đường dẫn công khai (/login, /docs, /api-docs, /architecture-design, /public-schedule...) để ẩn splash screen ngay từ DOM đầu tiên. Persistent AppTabs giữ trạng thái trang đã mở bằng contain: strict & contentVisibility: hidden thay vì unmount.'
        ],
        table: {
          headers: ['Nhóm Tuyến (Route)', 'Cơ chế Bảo vệ / Role Guard', 'Component Đích'],
          rows: [
            ['/login, /report-data, /demo, /download, /splash-preview', 'Public (ngoài ProtectedRoute)', 'Login, ReportData, DemoEntry, DownloadPage'],
            ['/public-schedule/*, /public-booking/1on1/*, /s/:slug, /claim/:id', 'Public Portal theo mã / slug', 'PublicSchedulePage, PublicBooking1on1Page, PublicSurveyPage, PublicVoucherClaimPage'],
            ['/docs, /documentation, /api-docs, /architecture-design', 'Public Developer & Product Portals', 'DocumentationPage, ApiV1DocumentationPage, ArchitectureDesignPage'],
            ['/ (Root Dashboard)', 'isAcademic -> Workspace; sale -> SalePortal; Khác -> Executive Dashboard', 'SalePortal / Dashboard'],
            ['/workspace, /account, /calendar, /personal-calendar', 'Authenticated (Accountant trên /calendar -> DataList)', 'SalePortal / DataList'],
            ['/contacts, /students, /data, /companies, /deals, /quotes, /activities, /gatekeeper, /tickets', 'ProtectedRoute + Row-level RBAC Scope phía Backend', 'ContactsPage, DataList, CompaniesPage, DealsPage, Gatekeeper, Tickets'],
            ['/rounds, /rules, /integrations, /settings, /accounts', 'Admin / Director / HR / Marketing hoặc dynamic module permissions', 'Rounds, RuleSettings, Integrations, Settings, Accounts'],
            ['/deposits, /cash-flow, /accounting-az, /financial-dashboard, /hrm, /my-payslips', 'deposits:read, finance:read, hrm:read hoặc Executive/Accountant/HR', 'DepositsPage, HrmAccountingAzWorkspace, FinancialDashboard, HRM, MyPayslips'],
            ['/marketing, /marketing/*, /capi (13 modules)', 'canAccessMarketingRoute(user, route) — chặn vai trò sale ở cả UI & API', 'src/pages/marketing/* & CapiPage (.mkt-scope)']
          ]
        }
      },
      {
        id: 'sec-fe-state-http',
        heading: '2.3. Tầng State (Zustand + Contexts) & Cơ chế HTTP Cache / Mutex',
        bullets: [
          {
            label: 'useAuthStore (minth-auth)',
            text: 'Chuẩn hóa role (sales -> sale, super_admin -> superadmin) và tính scope 4 nấc all | team | own | none qua getModulePermissionScope().',
            code: 'src/store/authStore.ts'
          },
          {
            label: 'useUIStore',
            text: 'Khử trùng lặp Toast trong 1200ms, điều phối ConfirmModal, QRCodeCallModal, POSModal và 5 Global Drawers.',
            code: 'src/store/uiStore.ts'
          },
          {
            label: 'useChatStore + IndexedDB',
            text: 'Lưu trạng thái WorkChat & AI Multi-Agent, gửi kèm ngữ cảnh trang mở qua getClientCurrentContext(), đồng bộ đa tab qua BroadcastChannel (chatBroadcast.ts).',
            code: 'src/store/chatStore.ts'
          },
          {
            label: 'Method Tunneling & LRU Cache',
            text: 'PUT/PATCH/DELETE ERP tự chuyển sang POST kèm _method=<METHOD> về api.php?action=...; 30 endpoint danh mục cache 60s (LRU 250) + gộp GET trùng in-flight và tự xóa cache khi có ghi DB.',
            code: 'src/api/axios.ts'
          },
          {
            label: 'Single-Flight 401 Refresh & Retry',
            text: 'Mutex refreshInFlightPromise bảo đảm nhiều request 401 cùng lúc chỉ gọi 1 lần auth/refresh; GET/HEAD lỗi 502–504 tự thử lại tối đa 2 lần (600ms, 1200ms).',
            code: 'src/api/axios.ts'
          }
        ]
      },
      {
        id: 'sec-fe-zindex',
        heading: '2.4. Chuẩn Hóa 6 Tầng Z-Index Overlay & Phím tắt LIFO',
        paragraphs: [
          'Mọi Drawer và Modal render qua createPortal(..., document.body) và đăng ký vào overlayStack.ts để phím ESC chỉ đóng đúng lớp trên cùng theo thứ tự LIFO, đồng thời ngăn bộ gõ tiếng Việt Telex/VNI (isComposing / keyCode 229) kích hoạt nhầm phím tắt.'
        ],
        diagram: 'z-index'
      }
    ]
  },
  {
    id: 'backend-arch',
    code: 'ARCH 03',
    group: 'III. KIẾN TRÚC BACKEND',
    title: '3. Backend Dual-Router Gateway, Auth & Controllers Matrix',
    shortTitle: 'Backend Dual-Router & RBAC',
    summary:
      'Cấu trúc Dual-Router cho phép tương thích ngược các endpoint cũ trên api.php đồng thời chuyển tiếp 57+ nhóm tài nguyên REST hiện đại vào OOP Front-Controller (index.php) với bảo mật Env-Only, JWT HS256 và Dynamic Multi-Tenant RBAC.',
    badges: [
      { label: 'Env-Only Config', tone: 'red' },
      { label: 'JWT HS256 + TOTP', tone: 'blue' },
      { label: 'Auto-Rollback PDO', tone: 'green' },
      { label: 'TenantConfigService', tone: 'slate' }
    ],
    fileAnchors: ['backend/api.php', 'backend/index.php', 'backend/config.php', 'backend/config/TenantConfigService.php'],
    sections: [
      {
        id: 'sec-be-lifecycle',
        heading: '3.1. Vòng đời Xử lý Request & Bảo vệ Giao dịch',
        bullets: [
          {
            label: 'Gateway Bridge',
            text: 'Tự sửa URL truyền nhầm nhiều dấu ?, bóc tiền tố /v1/ hoặc /api/, kiểm tra $baseAction thuộc danh sách 57+ domain REST để điều hướng vào index.php.',
            code: 'backend/api.php'
          },
          {
            label: 'SSE & Stream Protection',
            text: 'Chủ động tắt zlib.output_compression và buffer trên các route SSE (chat/stream, get_sse_updates) giúp sự kiện đẩy về trình duyệt ngay lập tức.',
            code: 'backend/index.php'
          },
          {
            label: 'Input Sanitization (getBody)',
            text: 'Đệ quy chuyển chuỗi rỗng / 0000-00-00 / 1970-01-01 ở trường ngày thành NULL và chuỗi rỗng ở trường tiền tệ (amount, price, base_salary...) thành 0.',
            code: 'backend/index.php'
          },
          {
            label: 'Auto-Rollback & ETag',
            text: 'Hàm respond() tự kiểm tra $db->inTransaction() để rollBack() ngay nếu HTTP code >= 400 (tránh treo InnoDB row lock); GET 200 sinh ETag MD5 hỗ trợ 304 Not Modified.',
            code: 'backend/index.php'
          }
        ]
      },
      {
        id: 'sec-be-auth',
        heading: '3.2. Xác thực JWT, Fail-Closed Config & TenantConfigService',
        bullets: [
          {
            label: 'Fail-Closed Environment Boot',
            text: 'DB_USER, DB_PASS, DB_NAME, JWT_SECRET đọc bắt buộc từ backend/.env hoặc môi trường; từ chối khởi động (RuntimeException / HTTP 500 JSON) nếu thiếu khóa.',
            code: 'backend/config.php'
          },
          {
            label: 'Active DB Check (60s File Cache)',
            text: 'requireAuth() kiểm tra chữ ký HMAC SHA-256 và đối chiếu trạng thái user (is_active = 1 AND deleted_at IS NULL) từ DB hoặc file cache TTL 60 giây.',
            code: 'backend/index.php'
          },
          {
            label: 'TenantConfigService (33 Modules)',
            text: 'Quản trị động 6 bảng cấu hình SaaS theo tenant_id: tenant_roles, tenant_approval_workflows, tenant_notification_rules, tenant_student_tabs, tenant_academic_programs, tenant_email_templates.',
            code: 'backend/config/TenantConfigService.php'
          }
        ]
      },
      {
        id: 'sec-be-matrix',
        heading: '3.3. Bảng Định tuyến Toàn bộ REST Controllers (backend/index.php)',
        table: {
          headers: ['Nhóm Nghiệp vụ', 'Route Prefix', 'Controller', 'Cơ chế An toàn Chính'],
          rows: [
            ['Xác thực & Người dùng', 'auth/*, users/*, presence/*, tenant-config/*', 'AuthController, UserController, PresenceController, TenantConfigController', 'Public chỉ cho login/refresh/forgot/verify-2fa; users CRUD khóa theo Admin/Director; 2FA TOTP'],
            ['CRM & Khách hàng', 'contacts/*, companies/*, deals/*, quotes/*, tags/*, custom-fields/*', 'ContactController, CompanyController, DealController, QuoteController, TagController', 'Row-level IDOR check theo owner_id / collaborator_ids; Soft-Delete bulk-delete; match sync Domation'],
            ['Chia số & Gatekeeper', 'lead-distribution/*, consultant-shifts/*, connectors/*', 'LeadDistributionController, ConsultantShiftController, ConnectorController', 'Kiểm quyền contacts:approve, SELECT ... FOR UPDATE khi phân bổ/bàn giao lead, ghi distribution_logs'],
            ['Học vụ (Academic)', 'academic/*, academic-affairs/*', 'AcademicAffairsController', 'Public 1-on-1 slot locking FOR UPDATE; bảng điểm, bảo lưu + StudentDocOcrService, thư mời giảng'],
            ['Tài chính & Đặt cọc', 'deposits/*, cooperation-slips/*, invoices/*, expenses/*, finance/*', 'DepositController, CooperationController, FinanceController', 'ACID Transaction + FOR UPDATE, Anti-Self-Approval theo cấp độ duyệt, đồng bộ công nợ thực thu/chi'],
            ['Đơn hàng, POS & Kho', 'sales-orders/*, purchase-orders/*, pos/*, inventory/*, products/*, suppliers/*', 'SalesOrderController, PurchaseOrderController, POSController, InventoryController', 'Trừ kho nguyên tử, phê duyệt PO/SO theo workflow, nhật ký kho inventory_logs'],
            ['HRM, Lương & Kế toán A-Z', 'hrm/*, attendance/*, check-ins/*, assets/*, teams/*, accounting-az/*', 'HRMController, CheckInController, AssetController, TeamController', 'Khóa kỳ lương, duyệt nghỉ/tạm ứng/bổ sung công hàng loạt, cấp phát tài sản, xuất XML HTKK'],
            ['Công việc, Dự án & Social', 'tasks/*, project-tasks/*, activities/*, projects/*, classes/*, posts/*', 'ProjectController, ActivityController, TaskGroupController, PostController', 'Kanban, Gantt, Pomodoro log, Whiteboard Snapshot lock FOR UPDATE, bảng tin nội bộ'],
            ['Tệp, Helpdesk & Thông báo', 'cloud-files/*, upload, download-file, tickets/*, notifications/*', 'CloudFileController, UploadController, TicketController, NotificationController', 'Chống Path Traversal, OCR hợp đồng/CCCD, Ticket SLA + IDOR check, thông báo tenant-scoped'],
            ['BI, Search, Export & Cron', 'dashboard/*, badges, reports/*, export, import/*, search/*, crons/*', 'DashboardController, ReportController, ExportController, ImportController, CronController', 'Giữ 4-Way Data Parity đồng nhất giữa UI, AI Tools, Marketing Segment và Export Excel/CSV'],
            ['WorkChat & AI Swarm', 'chat/*, ai/*, qwen-agent/*, customer-journey-summary', 'ChatController, AIController, QwenAgentController', 'SSE Streaming (chat/stream), Delta Sync, Gemini Tool Swarm và tuyến Qwen Groq Lab tách biệt'],
            ['Marketing, Ads & Domation', 'marketing/*, campaigns/*, capi/*, meta-ads/*, omnichannel/*, domation/*', 'CampaignController, MetaAdsController, CapiController, OmnichannelController', 'Meta Dual-Pixel CAPI, Attribution Full-Funnel, Zalo ZNS Broadcast & cầu nối automation/']
          ]
        }
      }
    ]
  },
  {
    id: 'state-machines',
    code: 'ARCH 04',
    group: 'IV. NGHIỆP VỤ & CONCURRENCY',
    title: '4. State Machines Cốt lõi & Bất biến Đồng thời',
    shortTitle: 'State Machines & Concurrency',
    summary:
      'Mọi thao tác biến đổi số dư, công nợ, đặt cọc, chia số Lead và cập nhật phân bổ tư vấn đều khóa dòng ở tầng InnoDB (FOR UPDATE), chống tự phê duyệt (Anti-Self-Approval) và duy trì nhất quán 4 bề mặt dữ liệu.',
    badges: [
      { label: 'SELECT ... FOR UPDATE', tone: 'red' },
      { label: 'Anti-Self-Approval', tone: 'amber' },
      { label: '4-Way Data Parity', tone: 'green' },
      { label: '14 Pipeline Stages', tone: 'blue' }
    ],
    fileAnchors: ['backend/controllers/DepositController.php', 'backend/controllers/FinanceController.php', 'backend/webhook_logic.php', 'backend/controllers/ExportController.php'],
    sections: [
      {
        id: 'sec-sm-finance',
        heading: '4.1. Máy Trạng thái Phê duyệt Tài chính & Đặt cọc Đa cấp',
        paragraphs: [
          'Cơ chế kiểm soát chống Race Condition và tự duyệt tại DepositController & FinanceController dựa trên khóa dòng SELECT ... FOR UPDATE (kèm nhánh tương thích SQLite cho môi trường kiểm thử tự động) và TenantConfigService::canUserApproveWorkflowLevel().'
        ],
        diagram: 'approval-state'
      },
      {
        id: 'sec-sm-leads',
        heading: '4.2. Đường ống Tiếp nhận, Gatekeeper & Chia số Lead 2 Chiều',
        paragraphs: [
          'Lead từ Google Sheets (cron_sync), Landing Page hoặc API đi qua chuỗi chuẩn hóa SĐT/Email -> kiểm tra chặn spam -> kiểm tra trùng CRM giữ Owner cũ -> định tuyến Round/Rule -> AI/Manual Screener -> khóa phân bổ ca trực -> ghi ACID & đồng bộ ngược Google Apps Script (two_way_sync.gs dùng LockService).'
        ],
        diagram: 'lead-pipeline'
      },
      {
        id: 'sec-sm-parity',
        heading: '4.3. Đồng bộ 4 Bề Mặt Dữ liệu (4-Way Data Parity) & 14 Bước Phễu',
        callout: {
          tone: 'info',
          title: 'Chuẩn Phễu Tuyển Sinh 14 Giai đoạn (Migration 237)',
          body: 'Toàn bộ contacts và deals dùng chung chuẩn 14 pipeline stages kết hợp trạng thái chăm sóc lead_status (active | nurture | lost) & lead_temperature. Bộ lọc đa cấp (program, project_id, stage_id, owner_id, from_date, to_date) phải trả kết quả đồng nhất tuyệt đối trên cả 4 kênh.'
        },
        table: {
          headers: ['Bề mặt Dữ liệu', 'Thành phần Thực thi', 'Nguyên tắc Đồng bộ'],
          rows: [
            ['1. Web App UI & Decks BI', 'ContactsPage, CustomerPersonaOverviewDeck, SalesLeadPerformanceDeck', 'Dùng chung bộ tham số query chuẩn và tính toán trực tiếp trên MySQL'],
            ['2. AI Multi-Agent Tools', 'AgentToolRegistry::query_crm_leads_multitier', 'Áp dụng chung logic RBAC scope + filter thời gian & giai đoạn'],
            ['3. Marketing Segments & Lists', 'backend/automation/segment_helper.php & lists.php', 'Truy vấn tập subscriber/contact khớp chuẩn xác tiêu chí CRM'],
            ['4. Export Excel / CSV', 'backend/controllers/ExportController.php', 'Dùng chung bộ lọc WHERE/RBAC để file tải xuống khớp 100% với số lượng xem trên màn hình']
          ]
        }
      }
    ]
  },
  {
    id: 'ai-workchat',
    code: 'ARCH 05',
    group: 'V. WORKCHAT & AI MULTI-AGENT',
    title: '5. WorkChat SSE Realtime & Hội đồng 11 AI Agents',
    shortTitle: 'WorkChat & SI IDEAS Swarm',
    summary:
      'ChatController tách 6 PHP Traits độc lập với kênh SSE tiết kiệm worker PHP-FPM (< 5ms index check), kết hợp bộ nhớ hội thoại 2 tầng <working_memory> và định tuyến công cụ theo phân hệ cho 11 AI Agents.',
    badges: [
      { label: '6 Chat Traits', tone: 'slate' },
      { label: 'Non-blocking SSE', tone: 'green' },
      { label: 'Gemini 3.5 Flash-Lite', tone: 'blue' },
      { label: '11 Scoped Agents', tone: 'red' }
    ],
    fileAnchors: ['backend/controllers/ChatController.php', 'backend/controllers/ChatStreamAndAiEntryTrait.php', 'backend/controllers/ChatGeminiEngineTrait.php', 'src/constants/aiAgents.ts'],
    sections: [
      {
        id: 'sec-ai-traits',
        heading: '5.1. Kiến trúc 6 Traits & Kênh SSE Non-blocking',
        bullets: [
          { label: 'ChatCoreTrait', text: 'CRUD tin nhắn, reaction, ghim, chuyển tiếp và kho lưu trữ tệp ChatMediaVault.' },
          { label: 'ChatManagementTrait', text: 'Khởi tạo hội thoại 1-1 / nhóm, quản trị thành viên và dọn lịch sử.' },
          {
            label: 'ChatStreamAndAiEntryTrait',
            text: 'Endpoint chat/stream thực thi truy vấn nhẹ SELECT MAX(id) FROM chat_messages (< 5ms); chỉ khi phát hiện ID mới mới JOIN 4 bảng và phát sự kiện SSE new_messages, kèm Redis Presence TTL 60s.'
          },
          { label: 'ChatAgentContextTrait', text: 'Nạp ngữ cảnh thực thể đang mở từ Frontend (pathname, active_entity, bộ lọc Contacts), tri thức RAG và quyền caller.' },
          { label: 'ChatGeminiEngineTrait', text: 'Thực thi Function Calling với động cơ mặc định gemini-3.5-flash-lite và domain-scoped tools.' },
          { label: 'ChatGroqAndMemoryTrait', text: 'Dự phòng Groq và nén/khôi phục bộ nhớ ngữ cảnh hội thoại <working_memory>.' }
        ]
      },
      {
        id: 'sec-ai-sequence',
        heading: '5.2. Luồng Thực thi Tool Loop & Action Proposal (Human-in-the-Loop)',
        paragraphs: [
          'AI không tự ý ghi đè dữ liệu nghiệp vụ quan trọng xuống database mà xuất ra thẻ đề xuất hành động (draft_action_proposal) kèm mã định danh để người dùng kiểm tra trực quan trước khi xác nhận.'
        ],
        diagram: 'ai-sequence'
      },
      {
        id: 'sec-ai-agents',
        heading: '5.3. Ma trận Phân quyền & Công cụ của 11 AI Agents (SI IDEAS)',
        table: {
          headers: ['Agent ID', 'Vai trò Chuyên trách', 'Công cụ Đặc trưng', 'Cơ chế Kiểm soát'],
          rows: [
            ['master', 'SI IDEAS (Điều phối & Tri thức)', 'query_cross_domain_executive_synthesis, search_ideas_knowledge, trace_approval_blocker', 'Ghi DB qua ActionProposalCard'],
            ['tasks', 'Agent Task (WBS & Deadline)', 'query_tasks_and_projects_multitier, smart_manage_tasks_and_subtasks', 'Giới hạn trong công việc được giao/giám sát'],
            ['finance', 'Agent Thu Chi (PO/SO/Cọc)', 'query_finance_multitier_analytics, query_deposits_and_revenue_multitier', 'Cảnh báo duyệt đa cấp khoản chi >= 5.000.000đ'],
            ['sales', 'Agent Sales (CRM 360°)', 'query_crm_leads_multitier, get_lead_digital_footprint_360, get_sales_leaderboard', 'Chặn IDOR, cô lập theo owner_id / collaborator_ids'],
            ['hrm', 'Agent Nhân Sự (Công & Lương)', 'query_hrm_workforce_and_payroll_multitier, manage_my_hr_profile_and_requests', 'Cô lập get_my_payslip theo chính chủ'],
            ['academic', 'Agent Đào Tạo', 'get_academic_students_filter, get_academic_schedule_and_intakes, get_program_details', 'Tuân thủ quy chế tín chỉ ECTS & học phí ban hành'],
            ['records_legal', 'Agent Hồ Sơ & Pháp Lý', 'check_student_admission_records, attach_files_to_contact, get_contact_360_profile', 'Đối soát đủ văn bằng/công chứng trước xét tuyển'],
            ['assets_inventory', 'Agent Tài Sản & Kho', 'query_inventory_and_assets_multitier, get_inventory_health_check', 'Điều chuyển tài sản qua phiếu đề xuất duyệt'],
            ['marketing_campaigns', 'Agent Marketing (Domation & Ads)', 'query_omnichannel_journey_and_automation_analytics, smart_manage_automation_flows_and_campaigns', 'Tuân thủ nguyên tắc Match-Only, ẩn Ad Spend với non-MKT'],
            ['executive_bi', 'Agent Trợ Lý Giám Đốc (BI/P&L)', 'Toàn bộ *_multitier tools, get_executive_morning_brief, get_executive_financial_pulse', 'Chỉ mở cho director, superadmin, accountant'],
            ['system_it', 'Agent Kỹ Thuật & SLA', 'query_tickets_and_sla_multitier, get_system_health_status, get_ticket_status_and_sla_breaches', 'Ẩn bí mật cấu hình/DB trong log & phản hồi']
          ]
        }
      }
    ]
  },
  {
    id: 'marketing-engine',
    code: 'ARCH 06',
    group: 'VI. MARKETING & TRACKING',
    title: '6. Động cơ Automation, Web Tracking & Meta CAPI',
    shortTitle: 'Marketing, Tracking & CAPI',
    summary:
      'Động cơ automation tách biệt tải nặng thành 18 worker độc lập dùng RAM buffering + cache pruning, tích hợp Web Tracking SDK, đồng bộ "3 KHÔNG" Match-Only với CRM và Meta CAPI Dual-Pixel có lọc Phone-Farm.',
    badges: [
      { label: 'FlowExecutor RAM Buffer', tone: 'blue' },
      { label: '18 Workers', tone: 'slate' },
      { label: 'Match-Only 3 KHÔNG', tone: 'green' },
      { label: 'Dual-Pixel CAPI', tone: 'red' }
    ],
    fileAnchors: ['backend/automation/FlowExecutor.php', 'backend/utils/DomationContactMatcher.php', 'backend/controllers/CapiController.php', 'backend/config/MetaPlaybookService.php'],
    sections: [
      {
        id: 'sec-mkt-flow',
        heading: '6.1. Kiến trúc FlowExecutor & 18 Tiến trình Worker Chuyên biệt',
        bullets: [
          {
            label: 'RAM Stats Buffering (bufferStatsUpdate / flushStatsBuffer)',
            text: 'Gom hàng trăm cập nhật bộ đếm (stat_total_sent, stats_opened, stats_clicked) trên RAM rồi ghi batch một lần xuống MySQL với whitelist bảng/cột tĩnh.',
            code: 'FlowExecutor.php'
          },
          {
            label: 'Bounded Static Caches (pruneCache)',
            text: 'Giới hạn $tagCache và $profileCache ở ngưỡng 200 phần tử để worker xử lý tập 10.000+ subscribers không bị tràn bộ nhớ PHP.',
            code: 'FlowExecutor.php'
          },
          {
            label: '18 Worker Phân tách Hàng đợi',
            text: 'Bao gồm worker_flow, worker_priority, worker_campaign, worker_enroll, worker_trigger, worker_queue, worker_segment_counts, worker_tracking_aggregator, worker_web_analytics, worker_web_geo, worker_zalo_token, worker_notify, worker_reminder, worker_guard, worker_integrations và worker_maintenance.'
          }
        ]
      },
      {
        id: 'sec-mkt-capi',
        heading: '6.2. Web Tracking SDK, Match-Only CRM Sync & Meta Conversions API',
        callout: {
          tone: 'success',
          title: 'Quy tắc Đồng bộ "3 KHÔNG" Match-Only (DomationContactMatcher)',
          body: 'Khớp dấu chân tương tác (Email, Survey, Voucher, Web, Zalo) vào hồ sơ contacts hiện hữu qua SĐT/Email đã chuẩn hóa: (1) KHÔNG tự ý tạo Lead rác mới, (2) KHÔNG ghi đè Owner phụ trách, (3) KHÔNG kích hoạt chia số vòng xoay lại.'
        },
        bullets: [
          {
            label: 'Web Tracking Continuous Calendar',
            text: 'tracker.js / tracking.js đẩy dữ liệu vào web_visitors, web_sessions, web_page_views, web_events -> tổng hợp vào web_daily_stats phục vụ biểu đồ Recharts liên tục không đứt ngày.'
          },
          {
            label: 'Meta CAPI Dual-Pixel & Phone-Farm Defense',
            text: 'Quản lý tách biệt CRM Pixel và Web Pixel (lọc ngưỡng tín hiệu theo 14 bước phễu); bảng capi_blocked_phones (Migration 334) chặn số spam/phone-farm và campaign_send_claims (Migration 336) khóa gửi trùng chiến dịch.',
            code: 'CapiController.php'
          }
        ]
      }
    ]
  },
  {
    id: 'data-erd',
    code: 'ARCH 07',
    group: 'VII. KIẾN TRÚC DỮ LIỆU',
    title: '7. Phân tầng Dữ liệu Đa Tenant (~251 Bảng) & ERD',
    shortTitle: 'Database & Multi-Tenant ERD',
    summary:
      'CSDL MySQL/MariaDB chuẩn hóa utf8mb4_unicode_ci kết hợp 112 bảng nền ERP, 20 bảng mở rộng SaaS & nghiệp vụ (Migrations 311–338) và 123 bảng Marketing Automation phân tách theo workspace_id.',
    badges: [
      { label: 'utf8mb4_unicode_ci', tone: 'slate' },
      { label: 'tenant_id + workspace_id', tone: 'blue' },
      { label: '100% Soft-Delete', tone: 'green' },
      { label: 'Schema v338', tone: 'amber' }
    ],
    fileAnchors: ['database_schema.md', 'database_schema.json', 'backend/run_migrations.php', 'backend/migrations/324_integrate_domation_schema_and_match_sync.php'],
    sections: [
      {
        id: 'sec-erd-layers',
        heading: '7.1. Phân tầng 3 Lớp Dữ liệu trên Cùng Cụm Database',
        table: {
          headers: ['Tầng Lược đồ', 'Quy mô Bảng', 'Khóa Cô lập & Chuẩn Bảng tiêu biểu'],
          rows: [
            [
              'Lớp Cốt lõi ERP',
              '112 bảng nền (51 bảng trọng tâm gắn tenant_id)',
              'tenants, users, teams, contacts, companies, deals, deposits, deposit_milestones, sales_orders, purchase_orders, invoices, expenses, hrm_leave_requests, monthly_payslips, check_ins, chat_conversations, chat_messages'
            ],
            [
              'Lớp Mở rộng SaaS & Nghiệp vụ (Migrations 311–338)',
              '6 bảng SaaS Config + 14 bảng Nghiệp vụ mới',
              'tenant_roles, tenant_approval_workflows, tenant_notification_rules, tenant_student_tabs, tenant_academic_programs, tenant_email_templates, task_whiteboards, student_subject_grades, student_postpone_records, capi_blocked_phones, campaign_send_claims'
            ],
            [
              'Lớp Marketing Automation (Migration 324)',
              '123 bảng (phân tách theo workspace_id)',
              'subscribers, lists, segments, flows, subscriber_flow_states, flow_enrollments, campaigns, surveys, survey_responses, voucher_campaigns, web_visitors, web_sessions, web_daily_stats, zalo_oa_configs, meta_customer_journey'
            ]
          ]
        }
      },
      {
        id: 'sec-erd-diagram',
        heading: '7.2. Sơ đồ Quan hệ Thực thể Trọng tâm (Core Multi-Tenant ERD)',
        diagram: 'core-erd'
      }
    ]
  },
  {
    id: 'handover-runbook',
    code: 'ARCH 08',
    group: 'VIII. VẬN HÀNH & BÀN GIAO',
    title: '8. Runbook Cài đặt, Deploy, Cron & Bảo mật Tiếp quản',
    shortTitle: 'Handover Operations Runbook',
    summary:
      'Quy trình thao tác chuẩn (SOP) dành cho đội kỹ thuật tiếp nhận: thiết lập .env, chạy Local Dev/Build/143 ca E2E, phân tách Staging/Production, Migration v338, Backup/Restore DB và Master Cronjob.',
    badges: [
      { label: 'SOP Dev & Build', tone: 'blue' },
      { label: 'Staging Isolation', tone: 'amber' },
      { label: 'Cron flock()', tone: 'green' },
      { label: 'Rotate Checklist', tone: 'red' }
    ],
    fileAnchors: ['README.md', '.env.example', 'backend/.env.example', 'deploy-myerp.ps1', 'deploy-staging.ps1', 'backend/cron_master.php'],
    sections: [
      {
        id: 'sec-ops-commands',
        heading: '8.1. Thiết lập Môi trường & Bộ Lệnh Phát triển Cục bộ',
        codeBlock: {
          title: 'Khởi tạo môi trường từ template & kiểm định Build / E2E',
          lang: 'bash',
          code: `# 1. Tạo tệp cấu hình từ template mẫu (điền DB_*, JWT_SECRET, DIAG_TOKEN, CRON_SECRET)
cp .env.example .env
cp backend/.env.example backend/.env

# 2. Cài dependencies Frontend & chạy Dev Server (tự proxy /backend -> VITE_API_URL)
npm install
npm run dev

# 3. Kiểm tra TypeScript + Build Production (xuất dist/ + cập nhật public/version.json)
npm run build

# 4. Chạy bộ kiểm thử hồi quy 143 ca E2E & kiểm tra cú pháp PHP
node tests/e2e/runner.js
php -l backend/index.php`
        }
      },
      {
        id: 'sec-ops-deploy',
        heading: '8.2. Phân tách Môi trường Triển khai (Staging vs Production)',
        table: {
          headers: ['Thuộc tính', 'Staging Environment', 'Production Environment'],
          rows: [
            ['Script Triển khai', 'deploy-staging.ps1 (-FrontendOnly / -BackendOnly / -SyncSchemaOnly)', 'deploy-myerp.ps1 (tự nhận diện git diff FE/BE, ép CheckTypes)'],
            ['Cơ sở Dữ liệu Đích', 'DB Staging riêng biệt (cô lập hoàn toàn khỏi Production)', 'DB Production chính thức'],
            ['Khóa An toàn Chống Nhầm', 'Chỉ tác động thư mục & DB Staging', 'Chặn cứng [STAGING LOCKED] nếu RemoteDir chứa từ khóa staging/stagging'],
            ['Bảo toàn Khi Giải nén', 'Giữ nguyên .env, .env.*, uploads/*, *.log, _locks', 'Giữ nguyên .env, .env.*, uploads/*, *.log, _locks'],
            ['Kiểm chứng Sau Deploy', 'So khớp version.json; /assets/nonexistent.js trả 404; soi 0 Fatal error_log', 'So khớp version.json; /assets/nonexistent.js trả 404; soi 0 Fatal error_log']
          ]
        }
      },
      {
        id: 'sec-ops-cron',
        heading: '8.3. Master Cron Orchestrator, Google Sheets 2-Way Sync & Backup DB',
        codeBlock: {
          title: 'Cấu hình Crontab duy nhất trên Server (1 phút/lần với flock)',
          lang: 'cron',
          code: `* * * * * /usr/local/bin/ea-php81 /path/to/myerp/backend/cron_master.php >> /path/to/cron_master.log 2>&1`
        },
        bullets: [
          {
            label: '11 Tiến trình Con từ cron_master.php',
            text: 'cron_sync.php (Sheets + tự nhả lock syncing quá 3 phút + chia lead), cron_recurring_tasks.php, cron_deposit_reminders.php, cron_academic_reminders.php, cron_mailer.php và 6 workers marketing (tracking_aggregator, flow, campaign, queue, trigger, enroll).'
          },
          {
            label: 'Google Apps Script (two_way_sync.gs)',
            text: 'Triển khai Web App trên Sheet tuyển sinh, sử dụng LockService.getScriptLock().waitLock(10000) để đồng bộ trạng thái/TVV phụ trách ngược về Sheet an toàn.'
          },
          {
            label: 'Database Migrations v338 & Backup',
            text: 'run_migrations.php xin khóa GET_LOCK("db_migration_lock", 30) và kiểm tra information_schema idempotent; sao lưu/khôi phục qua npm run backup:db & npm run restore:db đọc cấu hình từ backend/.env.'
          }
        ]
      },
      {
        id: 'sec-ops-security',
        heading: '8.4. Checklist Bảo mật Khi Tiếp nhận Hệ thống',
        table: {
          headers: ['Mức độ', 'Hạng mục', 'Hành động Khuyến nghị'],
          rows: [
            ['CRITICAL', 'Xoay vòng toàn bộ khóa & mật khẩu môi trường', 'Cấp mới DB_PASS, JWT_SECRET, DIAG_TOKEN, CRON_SECRET, SSH deploy key và kiểm tra API keys (Gemini, Zalo OA, Meta) trên cả Staging & Production.'],
            ['HIGH', 'Rút ngắn TTL JWT & Cơ chế thu hồi phiên', 'Xem xét điều chỉnh JWT_EXPIRE_ACCESS về 1–24h kết hợp kiểm tra revoke từ bảng refresh_tokens trong backend/config.php.'],
            ['MEDIUM', 'Khóa CRON_SECRET tường minh & thu gọn script test', 'Khai báo CRON_SECRET trong backend/.env rồi gỡ fallback tại backend/automation/*.php; loại bỏ các file backend/test_*.php khỏi gói upload Production.'],
            ['LOW', 'Làm mới Snapshot Schema Tài liệu', 'Chạy lại php backend/export_db_schema.php sau khi bàn giao để đồng bộ đầy đủ database_schema.json & .md theo DB thực tế.']
          ]
        }
      }
    ]
  }
];
