# Sổ tay Vận hành, Triển khai & Tiếp quản Hệ thống (Handover Operations Runbook) — MYERP

Tài liệu này đi kèm [ARCHITECTURE_DESIGN.md](ARCHITECTURE_DESIGN.md), cung cấp toàn bộ quy trình thao tác chuẩn (SOP) để đội ngũ kỹ thuật tiếp quản có thể chạy môi trường phát triển, kiểm thử, vận hành Cron/Backup, triển khai Staging & Production an toàn, và hoàn tất xoay vòng khóa bảo mật khi nhận bàn giao.

---

## 1. Môi trường Phát triển Cục bộ (Local Development SOP)

| Thành phần | Lệnh thực thi (`package.json`) | Cơ chế & Ghi chú Vận hành |
| :--- | :--- | :--- |
| **Chạy Dev Server** | `npm run dev` | Chạy Vite ở cổng `5173` (hoặc cổng kế tiếp khả dụng). Proxy mọi `/backend/*` sang `VITE_API_URL` hoặc mặc định `https://myerp.ideas.edu.vn/backend`, tự giả lập `User-Agent` Chrome Desktop để vượt tường lửa upstream ([vite.config.ts](../vite.config.ts#L96-L120)). |
| **Build & Check Types** | `npm run build` | Thực thi `tsc -b && vite build`, xuất bundle vào `dist/`, tự động cập nhật `public/version.json`, `backend/version.json` và `SW_VERSION` trong [sw.js](../public/sw.js). |
| **ESLint** | `npm run lint` | Rà soát chuẩn TypeScript & React Hooks ([eslint.config.js](../eslint.config.js)). |
| **E2E Regression Suite** | `node tests/e2e/runner.js` | Chạy toàn bộ **`143`** test case qua `4` tầng (`~15–45ms`). |
| **Marketing E2E Suite** | `npm run test:marketing-e2e` | Chạy `node tests/e2e/marketing_e2e_runner.cjs` kiểm định chuyên biệt cụm Marketing Automation. |
| **Kiểm tra Cú pháp PHP** | `php -l <file.php>` | Bắt buộc đạt `No syntax errors detected` trước khi đóng gói upload Backend. |

---

## 2. Quản lý Cấu hình & Biến Môi trường (Environment Configuration)

> **Lưu ý bảo mật**: Các tệp `.env`, `.env.production` và `backend/.env` đã được gỡ khỏi Git tracking và liệt kê trong [.gitignore](../.gitignore). Khi thiết lập môi trường mới, hãy sao chép từ các file mẫu **[.env.example](../.env.example)** và **[backend/.env.example](../backend/.env.example)** — tuyệt đối không commit giá trị thật lên kho Git.

| Tệp / Khu vực | Nhóm Khóa Cấu hình (Keys) | Ghi chú |
| :--- | :--- | :--- |
| **Frontend Vite** (`.env`, `.env.production`, mẫu `.env.example`) | `VITE_API_URL`, `VITE_APP_TITLE` | Ở runtime trình duyệt, [env.ts](../src/config/env.ts#L1-L11) ưu tiên dùng `/backend` nếu hostname là `localhost`/`127.0.0.1` và `${window.location.origin}/backend` ở Production/Staging. |
| **Backend Core** (`backend/.env`, mẫu `backend/.env.example`, [config.php](../backend/config.php), [Config.php](../backend/config/Config.php)) | `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`, `JWT_SECRET`, `DIAG_TOKEN`, `MYERP_DIAG_TOKEN`, `CRON_SECRET`, `ALLOWED_ORIGINS`, `APP_ENV` | Fail-closed nếu thiếu `DB_USER`/`DB_PASS`/`DB_NAME`/`JWT_SECRET`. [Database.php](../backend/config/Database.php#L9-L19) bật `ATTR_ERRMODE => ERRMODE_EXCEPTION`, `ATTR_EMULATE_PREPARES => false`, `utf8mb4_unicode_ci`, `time_zone = '+07:00'`, timeout `300s`. |
| **Backup & Deploy Scripts** (biến môi trường shell / `backend/.env`) | `SSH_KEY`, `SSH_USER`, `SSH_PORT`, `PROD_SSH_HOST`, `STAGING_SSH_HOST`, `BACKUP_SSH_*` | Mặc định dùng `$HOME/.ssh/id_ed25519` nếu không truyền biến `SSH_KEY`. |
| **AI & Tích hợp Đa kênh** (`system_settings` theo `tenant_id` / `.env`) | `GEMINI_API_KEY`, `GEMINI_MODEL` (mặc định `gemini-3.5-flash-lite`), Groq API Key (`QwenAgentController`), Zalo OA Secret/Token, Meta Ad Account/Pixel/CAPI Token, AWS SES / SMTP | Cho phép cấu hình riêng biệt từng `tenant_id` qua màn hình Quản trị hệ thống và lưu cache thông qua `TenantConfigService`. |

---

## 3. Phân tách Môi trường Triển khai (Staging vs Production Topology)

Hệ thống tách biệt vật lý hoàn toàn giữa **Production** và **Staging** thông qua hai script PowerShell riêng:

| Thông số | Môi trường Staging ([deploy-staging.ps1](../deploy-staging.ps1)) | Môi trường Production ([deploy-myerp.ps1](../deploy-myerp.ps1)) |
| :--- | :--- | :--- |
| **URL Trực tiếp** | `https://myerp-stagging.ideas.edu.vn` | `https://myerp.ideas.edu.vn/` |
| **Target Directory & Host** | `myerp-stagging.ideas.edu.vn` (`103.110.87.26:2210`) | `myerp.ideas.edu.vn` (`chiefaiofficer.vn:2210`) |
| **Target Database** | `vhvxoigh_erpstagging` (cô lập hoàn toàn) | `vhvxoigh_myerp` |
| **Khóa an toàn chống nhầm** | Có chế độ `-SyncSchemaOnly` chạy `audit_and_sync_schema.php` | Chặn cứng bằng `[STAGING LOCKED]` nếu truyền `$RemoteDir` chứa `stagging`/`staging` ([deploy-myerp.ps1](../deploy-myerp.ps1#L20-L23)) |
| **Auto-Detect Build Flags** | `-FrontendOnly` (`-fe`), `-BackendOnly` (`-be`), `-SkipBuild`, `-CloneDatabase` | Tự động quét `git diff` để chọn FE-Only hoặc BE-Only; hỗ trợ `-CheckTypes` (`tsc -b`), `-SyncMedia` (bao gồm `stickers/` & video nặng) |
| **Tệp Bảo toàn Tuyệt đối khi Extract** | `uploads/*`, `.env`, `.env.*`, `*.log`, `scratch*`, `automation/_locks` | Tương tự — không ghi đè `.env` server và giữ nguyên toàn bộ thư mục upload học viên |

### Quy trình Kiểm chứng Sau Deploy (Bắt buộc)
Ngay sau khi chạy `npm run deploy` (hoặc `npm run deploy:frontend` / `npm run deploy:backend`):
1. Đối chiếu phiên bản giữa `public/version.json` local và `https://myerp.ideas.edu.vn/version.json`.
2. Kiểm tra quy tắc `.htaccess` bằng một URL asset giả (ví dụ `/assets/nonexistent_test.js`): phải nhận về **`HTTP 404`**, tuyệt đối không phải `HTTP 200` `text/html`.
3. Xác nhận `backend/.env` và `backend/uploads` vẫn tồn tại trên server; soi cuối file `backend/error_log` & `error_log` đảm bảo `0` lỗi PHP `Fatal` / `Parse error` mới phát sinh.
   - *Ghi chú vận hành server*: Trên hosting CloudLinux Alt-PHP 8.1 (`chiefaiofficer.vn`), khi khởi chạy PHP CLI định kỳ (cron mỗi phút) có thể ghi log cảnh báo hệ thống `PHP Startup: Unable to load dynamic library 'memcached.so' (undefined symbol: igbinary_serialize)` — đây là cấu hình module của OS cấp server, không làm gián đoạn PDO/HTTP ứng dụng.

---

## 4. Vận hành Cơ sở Dữ liệu, Migration & Sao lưu (Database SOP)

### 4.1. Tiến hóa Schema (`backend/run_migrations.php`)
- Hệ thống hiện đạt **`targetVersion = 338`** ([run_migrations.php](../backend/run_migrations.php#L21)).
- Cơ chế bảo vệ khi nâng cấp:
  1. Chỉ cho phép chạy từ CLI (`--apply`) hoặc qua HTTP kèm `DIAG_TOKEN`/`MYERP_DIAG_TOKEN` đọc từ `backend/.env` (kiểm tra bằng `hash_equals`).
  2. Xin khóa phân tán `SELECT GET_LOCK('db_migration_lock', 30)` tránh 2 quá trình migrate chạy đè nhau.
  3. Mọi migration dùng cấu trúc **Idempotent** (kiểm tra `information_schema` trước khi thêm cột/index) và tự tái tạo 2 SQL Views tương thích ngược (`accounts`, `consultants`) ở mỗi lần triển khai ([run_migrations.php](../backend/run_migrations.php)).

### 4.2. Sao lưu & Phục hồi (`scripts/backup-database.js` & `scripts/restore-database.js`)
- **Backup (`npm run backup:db`)** ([backup-database.js](../scripts/backup-database.js)): Nạp thông số từ `backend/.env` / biến môi trường, SSH thực thi `mysqldump --single-transaction --quick --max_allowed_packet=512M --routines --triggers --default-character-set=utf8mb4` xuất thành `/home/vhvxoigh/myerp_backup_latest.sql.gz` và tải về thư mục local `backups/`.
- **Restore (`npm run restore:db`)** ([restore-database.js](../scripts/restore-database.js)): Có prompt xác nhận an toàn (`yes`) trước khi tải bản `.sql.gz` lên và ghi đè lại `vhvxoigh_myerp` (hỗ trợ cờ `--force` cho tự động hóa).

---

## 5. Vận hành Cronjob & Đồng bộ Google Sheets 2 Chiều

### 5.1. Master Orchestrator (`backend/cron_master.php`)
Trên cPanel / crontab server chỉ cấu hình **1 cron duy nhất chạy mỗi phút**:
```cron
* * * * * /usr/local/bin/ea-php81 /home/vhvxoigh/myerp.ideas.edu.vn/backend/cron_master.php >> /home/vhvxoigh/cron_master.log 2>&1
```
- **Khóa chống chồng tiến trình**: Dùng `flock($lockFp, LOCK_EX | LOCK_NB)` tại `sys_get_temp_dir()/cron_master_<md5>.lock` ([cron_master.php](../backend/cron_master.php#L10-L21)).
- **11 Tiến trình con được spawn bất đồng bộ** ([cron_master.php](../backend/cron_master.php#L90-L102)):
  1. `cron_sync.php` (đồng bộ Sheet Lead + Inventory + tự nhả trạng thái `syncing` treo quá `3` phút + chia số + báo cáo Ngày/Tuần/Tháng)
  2. `cron_recurring_tasks.php`
  3. `cron_deposit_reminders.php`
  4. `cron_academic_reminders.php`
  5. `cron_mailer.php`
  6. `automation/worker_tracking_aggregator.php`
  7. `automation/worker_flow.php`
  8. `automation/worker_campaign.php`
  9. `automation/worker_queue.php`
  10. `automation/worker_trigger.php`
  11. `automation/worker_enroll.php`

### 5.2. Tích hợp Đồng bộ 2 Chiều Google Sheets (`backend/two_way_sync.gs`)
- Dán mã trong [two_way_sync.gs](../backend/two_way_sync.gs) vào Google Apps Script gắn trên Google Sheet tuyển sinh và triển khai dạng Web App (`Execute as: Me`, `Who has access: Anyone`).
- Script Apps Script sử dụng `LockService.getScriptLock()` (`waitLock(10000)`) để chống ghi đè khi CRM bắn cập nhật trạng thái/TVV phụ trách (`executeTwoWaySyncActual`) đồng thời từ nhiều Lead.

---

## 6. Kiểm thử Chất lượng 4 Tầng (`tests/e2e/runner.js`)

Khi bàn giao hoặc sửa đổi code lõi, chạy `node tests/e2e/runner.js` để xác nhận đủ **`143`** kịch bản:
- **Tier 1 (`feat01`–`feat13`)**: Domain Data Error vs Tickets, Soft-Delete Mandate, SQL `IN (...)` Reindexing (`array_values`) & Anti-N+1, Anti-Self-Approval Deposit Milestones, Strict RBAC (`api.php`), IDOR Prevention (`ContactController`/`TicketController`), Marketing Route Guards (`11+` routes), Flow Survey Unicode & Soft-Delete, Email Preview Spinner & `Array.isArray` Guards, Web Tracking Dual-Series Recharts Calendar Gap-Filling, Academic 3-Step Modal, UI/UX Brand DNA.
- **Tier 2 (`feat01_boundary`–`feat13_boundary`)**: Kiểm tra biên dữ liệu rỗng/corrupt/ngày nhuận/năm 365 ngày/`tabular-nums`/tương phản WCAG AA.
- **Tier 3 (`xf01`–`xf08`)**: Kiểm thử tương tác cặp phân hệ.
- **Tier 4 (`rw01`–`rw05`)**: 5 kịch bản E2E thực tế & phòng thủ tấn công hỗn hợp đa tenant.

---

## 7. Trạng thái Bảo mật Đã Làm Sạch & Checklist Hậu Bàn Giao

Trong đợt chuẩn hóa mã nguồn trước bàn giao, đội phát triển đã hoàn tất:
- Gỡ `.env`, `.env.production`, `backend/.env` khỏi Git index và bổ sung bộ mẫu [`.env.example`](../.env.example) + [`backend/.env.example`](../backend/.env.example).
- Gỡ bỏ thông tin mật khẩu DB / `JWT_SECRET` / `DIAG_TOKEN` tĩnh ra khỏi `backend/config.php`, `backend/config/Config.php`, `backend/db_connect.php`, `backend/api.php`, `backend/index.php`, `backend/run_migrations.php`, `backend/api_diagnostic*.php`, `backend/clone_db_to_myerp.php`, `backend/export_students_full.php`, `backend/test_*.php`, `scripts/backup-database.js`, `scripts/restore-database.js`, `scripts/*.py` và `tests/`.

Dưới đây là **4 việc đội ngũ tiếp quản cần thực hiện ngay khi nhận hệ thống**:

| Mức độ | Hạng mục | Vị trí tham chiếu | Khuyến nghị Hành động cho Team Tiếp nhận |
| :--- | :--- | :--- | :--- |
| **CRITICAL** | Xoay vòng (Rotate) toàn bộ thông tin bí mật từng có trong lịch sử Git trước ngày bàn giao | `backend/.env` trên Production & Staging, Git history | Đổi mới mật khẩu MySQL `DB_PASS`, tạo mới `JWT_SECRET`, `DIAG_TOKEN` / `MYERP_DIAG_TOKEN`, `CRON_SECRET`, SSH key deploy và kiểm tra API key Gemini/Zalo/Meta. |
| **HIGH** | Thời hạn `JWT_EXPIRE_ACCESS` và `JWT_EXPIRE_REFRESH` đang để dài (`10` năm) cho PWA mobile | [config.php](../backend/config.php) | Giảm TTL Access Token về `1–24` giờ kèm cơ chế thu hồi phiên từ bảng `refresh_tokens` khi nhân sự nghỉ việc. |
| **MEDIUM** | Chuẩn hóa `CRON_SECRET` bắt buộc & thu gọn script phụ trợ trên Production | [backend/automation/](../backend/automation/), [backend/test_bootstrap.php](../backend/test_bootstrap.php) | Khai báo `CRON_SECRET` trong `backend/.env` trên server rồi gỡ giá trị fallback trong `backend/automation/*.php`; loại bỏ `backend/test_*.php` và `scripts/*.py` khỏi gói upload Production để thu hẹp bề mặt HTTP. |
| **LOW** | Đồng bộ snapshot tài liệu schema `database_schema.json` | [database_schema.md](../database_schema.md), [export_db_schema.php](../backend/export_db_schema.php) | Chạy lại `php backend/export_db_schema.php` trên Production DB để cập nhật bộ schema JSON/Markdown phản ánh trọn vẹn `~251` bảng hiện hành (`Migrations` v338). |
