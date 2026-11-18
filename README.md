# MYERP — Enterprise SaaS Operations Suite

Nền tảng quản trị doanh nghiệp đa phân hệ (Multi-Tenant Enterprise SaaS) hợp nhất **CRM & Tuyển sinh 14 bước, Marketing Automation & Omnichannel (Domation), Meta CAPI & Tracking, Học vụ (Academic), Tài chính – Đặt cọc – PO/SO/POS, Kế toán A–Z & HRM/Bảng lương, Quản lý Công việc & Dự án, WorkChat Realtime & Hội đồng 11 AI Multi-Agent (`SI IDEAS`)**.

---

## 1. Kiến trúc & Công nghệ Cốt lõi

- **Frontend (`src/`)**: React `19.2`, TypeScript `~6.0`, Vite `8.0`, Tailwind CSS `4.3`, Zustand (`authStore`, `uiStore`, `chatStore`), Lucide Icons, Recharts, Pass-Through PWA Service Worker ([`public/sw.js`](public/sw.js)).
- **Backend (`backend/`)**: PHP `8.1+` Dual-Router Gateway ([`api.php`](backend/api.php) + OOP Front-Controller [`index.php`](backend/index.php)), `65` domain controllers, `6` WorkChat Traits, HS256 JWT + 2FA TOTP, `TenantConfigService` (Dynamic RBAC & Workflows).
- **Marketing Automation Engine (`backend/automation/`)**: `FlowExecutor` + `18` worker độc lập xử lý Email/Zalo/ZNS/Web Tracking/Survey/Voucher & Match-Only CRM sync (`"3 KHÔNG"`).
- **Database**: MySQL / MariaDB (`utf8mb4_unicode_ci`), cô lập `tenant_id` & `workspace_id`, Soft-Delete (`deleted_at IS NULL`), `338` phiên bản migration idempotent ([`backend/run_migrations.php`](backend/run_migrations.php)).

---

## 2. Tài liệu Kỹ thuật & Vận hành Bàn giao

| Tài liệu | Nội dung chính |
| :--- | :--- |
| **[`docs/ARCHITECTURE_DESIGN.md`](docs/ARCHITECTURE_DESIGN.md)** | Kiến trúc C4 tổng thể, vòng đời SPA/PWA, Dual-Router Backend, State Machines (`FOR UPDATE` + Anti-Self-Approval), `SI IDEAS` AI Swarm, Marketing Engine & ERD `~251` bảng. |
| **[`docs/HANDOVER_RUNBOOK.md`](docs/HANDOVER_RUNBOOK.md)** | Hướng dẫn thiết lập `.env`, quy trình Dev/Build/Lint, Deploy Staging & Production, Migration/Backup/Restore DB, Cron Orchestrator, kiểm thử E2E và checklist bảo mật sau bàn giao. |

---

## 3. Thiết lập Môi trường Phát triển (Quick Start)

### Yêu cầu
- **Node.js** `>= 20.x` & `npm`
- **PHP** `>= 8.1` (`pdo_mysql`, `mysqli`, `mbstring`, `openssl`, `curl`)
- **MySQL / MariaDB** `>= 8.0` / `10.5+`

### Bước 1: Tạo file cấu hình từ template
```bash
cp .env.example .env
cp backend/.env.example backend/.env
```
Điền đầy đủ thông số kết nối database (`DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`), `JWT_SECRET`, `DIAG_TOKEN`, `CRON_SECRET` vào `backend/.env` và `VITE_API_URL` vào `.env`.

### Bước 2: Cài đặt & Chạy
```bash
# Cài dependencies Frontend
npm install

# Chạy Vite Dev Server (tự proxy /backend -> VITE_API_URL)
npm run dev

# Kiểm tra TypeScript + Build Production (xuất dist/ + cập nhật version.json)
npm run build

# Chạy bộ kiểm thử hồi quy 143 ca E2E
node tests/e2e/runner.js

# Kiểm tra cú pháp PHP trên file backend trước khi deploy
php -l backend/index.php
```

---

## 4. Triển khai & Sao lưu

- **Staging (`vhvxoigh_erpstagging`)**: `./deploy-staging.ps1` (hỗ trợ `-FrontendOnly`, `-BackendOnly`, `-SyncSchemaOnly`).
- **Production (`vhvxoigh_myerp`)**: `./deploy-myerp.ps1` (tự nhận diện thay đổi FE/BE, ép `CheckTypes`, giữ nguyên `.env` & `uploads/` trên server, có khóa `[STAGING LOCKED]`).
- **Backup / Restore DB**: `npm run backup:db` / `npm run restore:db` (đọc thông số từ `backend/.env` hoặc biến môi trường).
