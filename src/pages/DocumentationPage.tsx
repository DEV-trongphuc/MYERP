import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Code,
  Search,
  ChevronRight,
  Layers,
  ShieldCheck,
  Users,
  DollarSign,
  CheckSquare,
  Clock,
  Building2,
  Calendar,
  Sparkles,
  ArrowUpRight,
  Home,
  Copy,
  Check,
  FileText,
  AlertTriangle,
  Zap,
  Globe,
  Lock,
  Cpu,
  RefreshCw,
  Terminal,
  ChevronDown,
  Link2,
  Target,
  FileSpreadsheet,
  Flame,
  Snowflake,
  Rocket,
  Package,
  Briefcase,
  GraduationCap,
  Rss,
  Share2,
  Shield,
  CreditCard,
  UserCheck,
  CheckCircle,
  Inbox,
  Mail,
  MessageSquare,
  Send,
  Bell,
  X
} from 'lucide-react';

interface DocItem {
  id: string;
  title: string;
  description: string;
  headings: { id: string; text: string }[];
  content: React.ReactNode;
}

interface DocSection {
  id: string;
  title: string;
  icon: any;
  items: DocItem[];
}

const PermCell: React.FC<{ r: string; w: string; d: string }> = ({ r, w, d }) => {
  if (r === 'none' && w === 'none' && d === 'none') {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '3px', color: '#9ca3af', fontSize: '0.74rem' }}>
        <X size={13} color="#9ca3af" /> <span>None</span>
      </div>
    );
  }
  if (r === 'all' && w === 'all' && d === 'all') {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '3px', color: '#059669', fontSize: '0.74rem', fontWeight: 700 }}>
        <Check size={13} color="#059669" strokeWidth={2.5} /> <span>All</span>
      </div>
    );
  }
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '1px', fontSize: '0.68rem', textAlign: 'left', lineHeight: 1.3 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: r === 'none' ? '#9ca3af' : '#059669' }}>
        {r === 'none' ? <X size={10} color="#9ca3af" /> : <Check size={10} color="#059669" strokeWidth={2.5} />}
        <span>R: <strong>{r}</strong></span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: w === 'none' ? '#9ca3af' : '#2563eb' }}>
        {w === 'none' ? <X size={10} color="#9ca3af" /> : <Check size={10} color="#2563eb" strokeWidth={2.5} />}
        <span>W: <strong>{w}</strong></span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: d === 'none' ? '#9ca3af' : '#dc2626' }}>
        {d === 'none' ? <X size={10} color="#9ca3af" /> : <Check size={10} color="#dc2626" strokeWidth={2.5} />}
        <span>D: <strong>{d}</strong></span>
      </span>
    </div>
  );
};

export const DocumentationPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSectionId, setActiveSectionId] = useState('arch');
  const [activeItemId, setActiveItemId] = useState('arch-overview');
  const [expandedSectionIds, setExpandedSectionIds] = useState<string[]>(['arch']);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeHeadingId, setActiveHeadingId] = useState<string>('');
  const contentRef = useRef<HTMLDivElement>(null);

  const toggleSection = (sectionId: string) => {
    setExpandedSectionIds(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const sections: DocSection[] = useMemo(() => [
    // 1. KIẾN TRÚC & HẠ TẦNG
    {
      id: 'arch',
      title: '1. Kiến Trúc, Bảo Mật & Hạ Tầng Kỹ Thuật',
      icon: Layers,
      items: [
        {
          id: 'arch-overview',
          title: 'Kiến Trúc Tổng Thể, Tech Stack & Multi-Tenant',
          description: 'Mô hình thiết kế Single Page Application (SPA), Backend RESTful PHP 8.1 với 39 Controllers và Phân lập Đa Doanh nghiệp.',
          headings: [
            { id: 'tech-stack', text: 'Mô Hình Công Nghệ (Tech Stack)' },
            { id: 'multi-tenant', text: 'Cơ Chế Phân Lập Multi-Tenant' },
            { id: 'database-engine', text: 'Cơ Sở Dữ Liệu & Auto Migrations' }
          ],
          content: (
            <div className="doc-prose">
              <p>
                <strong>IDEAS MYERP</strong> là nền tảng quản trị tổng thể doanh nghiệp (Enterprise Resource Planning & CRM)
                được thiết kế chuyên biệt cho hệ sinh thái giáo dục, đào tạo đại học/sau đại học và dịch vụ tư vấn chuyên sâu.
                Hệ thống hội tụ khả năng tự động hóa bán hàng (Sales Automation), quản lý nhân sự - tiền lương đa tầng (HRM & Payroll),
                chấm công sinh trắc học thông minh, kiểm soát ngân sách chi tiêu và Trí tuệ Nhân tạo hỗ trợ thẩm định dữ liệu.
              </p>

              <h2 id="tech-stack">Mô Hình Công Nghệ (Tech Stack)</h2>
              <table className="doc-table">
                <thead>
                  <tr>
                    <th style={{ width: '180px' }}>Thành phần</th>
                    <th style={{ width: '260px' }}>Công nghệ sử dụng</th>
                    <th>Vai trò & Đặc tả kỹ thuật</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Frontend SPA</strong></td>
                    <td>React 19 + TypeScript, Vite 8, Framer Motion, Zustand</td>
                    <td>Ứng dụng đơn trang (SPA) phản hồi siêu tốc, chia tách Dynamic Chunks lazy-loaded, tối ưu tải trang dưới 500ms. Quản lý trạng thái linh hoạt qua Auth Store và UI Store.</td>
                  </tr>
                  <tr>
                    <td><strong>Backend Modular</strong></td>
                    <td>PHP 8.1 RESTful Architecture, PDO MySQL, ea-php81</td>
                    <td>39 Controllers chuyên biệt xử lý từng nghiệp vụ độc lập, Prepared Statements 100% chống SQL Injection, thời gian phản hồi API &lt; 50ms.</td>
                  </tr>
                  <tr>
                    <td><strong>Cơ sở Dữ liệu</strong></td>
                    <td>MySQL 8.0 / MariaDB 10.6+ InnoDB</td>
                    <td>Hơn 45 bảng quan hệ chuẩn hóa 3NF, liên kết khóa ngoại cascade chặt chẽ, tự động kiểm tra và nâng cấp phiên bản schema qua <code>run_migrations.php</code>.</td>
                  </tr>
                  <tr>
                    <td><strong>Thời Gian Thực</strong></td>
                    <td>Server-Sent Events (SSE) + Telegram Bot Webhooks</td>
                    <td>Kênh stream sự kiện persistent qua <code>get_sse_updates</code>, tự động đẩy badge count và thông báo đẩy tức thì mà không gây nghẽn mạng do polling.</td>
                  </tr>
                  <tr>
                    <td><strong>Trí Tuệ Nhân Tạo (AI)</strong></td>
                    <td>OpenAI GPT-4o / Google Gemini Engine</td>
                    <td>AI Pre-screener (Gatekeeper) chấm điểm tiềm năng lead 0-100, chống trùng dữ liệu và trợ lý RAG hỗ trợ chính sách nội bộ.</td>
                  </tr>
                </tbody>
              </table>

              <h2 id="multi-tenant">Cơ Chế Phân Lập Multi-Tenant</h2>
              <p>
                Toàn bộ các bảng nghiệp vụ cốt lõi (<code>contacts</code>, <code>deals</code>, <code>pipeline_stages</code>, <code>expenses</code>, <code>hrm_employees</code>)
                đều được gắn cờ định danh <code>tenant_id</code>. Tất cả các truy vấn tại Controller đều bắt buộc truyền điều kiện lọc theo đơn vị thành viên:
              </p>
              <div className="doc-code-box">
                <code>
                  SELECT * FROM contacts WHERE tenant_id = :tenant_id AND status = :status;
                </code>
              </div>
              <p>
                Nhờ đó, dữ liệu của từng đơn vị/học viện được bảo mật cách ly tuyệt đối, loại trừ 100% rủi ro rò rỉ dữ liệu chéo giữa các pháp nhân.
              </p>

              <h2 id="database-engine">Cơ Sở Dữ Liệu & Auto Migrations</h2>
              <p>
                Hệ thống áp dụng cơ chế di trú cơ sở dữ liệu phiên bản lũy tiến (Incremental Migrations). Khi hệ thống khởi động hoặc quản trị viên truy cập trang bảo trì,
                file <code>run_migrations.php</code> sẽ tự động quét danh mục <code>backend/migrations/</code>, đối chiếu với bảng nhật ký phiên bản và thực thi các script SQL
                còn thiếu một cách tuần tự, đảm bảo database luôn đồng nhất giữa môi trường phát triển và môi trường vận hành thực tế.
              </p>
            </div>
          )
        },
        {
          id: 'arch-concurrency',
          title: 'Khóa Tranh Chấp (Advisory Locking) & SSE Realtime',
          description: 'Giải pháp xử lý tranh chấp dữ liệu đồng thời và cơ chế đồng bộ sự kiện thời gian thực.',
          headings: [
            { id: 'advisory-lock', text: 'Cơ Chế Khóa Tranh Chấp (Advisory Locking)' },
            { id: 'realtime-sync', text: 'Đồng Bộ Real-Time SSE' }
          ],
          content: (
            <div className="doc-prose">
              <h2 id="advisory-lock">Cơ Chế Khóa Tranh Chấp (Advisory Locking)</h2>
              <p>
                Để giải quyết triệt để lỗi xung đột dữ liệu đồng thời (<em>Race Condition / Double Assignment</em>) khi nhiều tư vấn viên
                cùng lúc nhận lead hoặc nhiều cấp quản lý cùng bấm duyệt một đơn chi tiêu:
              </p>
              <div className="doc-code-box">
                <code>
                  -- Lấy khóa tranh chấp cấp độ ứng dụng trong MySQL<br />
                  SELECT GET_LOCK('lead_assign_' || :lead_id, 10);<br />
                  -- Thực hiện kiểm tra tính hợp lệ và phân bổ tư vấn viên<br />
                  UPDATE contacts SET assigned_user_id = :user_id WHERE id = :lead_id AND assigned_user_id IS NULL;<br />
                  -- Giải phóng khóa an toàn<br />
                  SELECT RELEASE_LOCK('lead_assign_' || :lead_id);
                </code>
              </div>
              <p>
                Chỉ có duy nhất một tiến trình được quyền can thiệp vào bản ghi tại một thời điểm, loại bỏ hoàn toàn tình trạng trùng lặp phân công.
              </p>

              <h2 id="realtime-sync">Đồng Bộ Real-Time SSE</h2>
              <p>
                Trình duyệt duy trì kết nối persistent với server qua endpoint <code>/backend/api.php?action=get_sse_updates&amp;token=...</code>:
              </p>
              <ul>
                <li><strong>Ping Heartbeat:</strong> Gửi sự kiện ping mỗi 15 giây để duy trì kết nối xuyên suốt qua firewall/proxy.</li>
                <li><strong>Notification Dispatch:</strong> Khi phát sinh Lead mới, Đơn duyệt mới hoặc Ticket lỗi được xử lý, server đẩy event trực tiếp tới client để cập nhật badge số đỏ và thanh thông báo tức thì.</li>
              </ul>
            </div>
          )
        },
        {
          id: 'arch-queues',
          title: 'Hàng Đợi Bất Đồng Bộ (Background Queue Workers) & Crons',
          description: 'Cơ chế xử lý tác vụ ngầm: Gửi email tự động, nhắc lịch học vụ và phân tích dữ liệu định kỳ.',
          headings: [
            { id: 'queue-engine', text: 'Hàng Đợi Tác Vụ Ngầm (Queue Engine)' },
            { id: 'cron-schedules', text: 'Lịch Trình Cron Jobs Định Kỳ' }
          ],
          content: (
            <div className="doc-prose">
              <h2 id="queue-engine">Hàng Đợi Tác Vụ Ngầm (Queue Engine)</h2>
              <p>
                Để giữ thời gian phản hồi API dưới 50ms, các tác vụ nặng như gửi email xác nhận, gửi tin nhắn Zalo ZNS hoặc đồng bộ Meta CAPI
                không được thực thi đồng bộ trong luồng request của người dùng, mà được đẩy vào bảng hàng đợi tác vụ <code>system_jobs</code> / <code>email_queue</code>.
              </p>
              <p>
                Tiến trình nền <code>cron_queue_worker.php</code> và <code>cron_mailer.php</code> chạy độc lập trên server với chu kỳ 1 phút/lần
                để bốc việc từ hàng đợi, thực hiện gửi với cơ chế thử lại (Retry Policy tối đa 3 lần) và ghi nhận nhật ký thất bại nếu có sự cố mạng.
              </p>

              <h2 id="cron-schedules">Lịch Trình Cron Jobs Định Kỳ</h2>
              <table className="doc-table">
                <thead>
                  <tr>
                    <th style={{ width: '220px' }}>File Cron Script</th>
                    <th style={{ width: '150px' }}>Tần suất chạy</th>
                    <th>Nhiệm vụ nghiệp vụ</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>cron_mailer.php</code></td>
                    <td>Mỗi 1 phút</td>
                    <td>Quét hàng đợi email chưa gửi, phân luồng gửi qua PHPMailer SMTP, tự động cập nhật trạng thái đã gửi.</td>
                  </tr>
                  <tr>
                    <td><code>cron_academic_reminders.php</code></td>
                    <td>07:00 &amp; 18:00 hàng ngày</td>
                    <td>Quét thời khóa biểu lớp học ngày hôm sau, gửi thông báo nhắc lịch học qua email và Telegram cho học viên và giảng viên.</td>
                  </tr>
                  <tr>
                    <td><code>cron_deposit_reminders.php</code></td>
                    <td>08:30 hàng ngày</td>
                    <td>Đối soát các khoản cọc giữ chỗ sắp đến hạn hoàn tất học phí, cảnh báo TVV phụ trách chủ động liên hệ.</td>
                  </tr>
                  <tr>
                    <td><code>cron_daily_report.php</code></td>
                    <td>22:00 hàng ngày</td>
                    <td>Tổng kết doanh số chốt đơn, số tiền cọc thực thu và số lượng lead mới phát sinh gửi trực tiếp về Group Telegram Ban Giám Đốc.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )
        },
        {
          id: 'arch-rbac-security',
          title: 'Kiến Trúc Phân Quyền Hạt Nhân (RBAC), Ma Trận Scopes & Bảo Mật Đa Tầng',
          description: 'Đặc tả 4 cấp độ dữ liệu (all, team, own, none), ma trận quyền permissions_json, phân lập Multi-tenant và kiến trúc an ninh phòng thủ đa lớp.',
          headings: [
            { id: 'rbac-scopes', text: '4 Cấp Độ Scope Dữ Liệu (Data Access Scopes)' },
            { id: 'role-definitions', text: 'Đặc Tả Chi Tiết 10 Vai Trò (Roles) Chuẩn Doanh Nghiệp' },
            { id: 'rbac-matrix-table', text: 'Bảng Ma Trận Phân Quyền Chi Tiết (10 Roles × 9 Phân Hệ)' },
            { id: 'rbac-matrix', text: 'Ma Trận Quyền Hạt Nhân (permissions_json) & Cấu Trúc Đội Nhóm' },
            { id: 'special-authorizations', text: 'Quyền Hạn Đặc Thù & Cơ Chế Phê Duyệt Nghiệp Vụ' },
            { id: 'security-layers', text: 'Kiến Trúc An Ninh Phòng Thủ Đa Lớp (Defense-in-Depth)' }
          ],
          content: (
            <div className="doc-prose">
              <h2 id="rbac-scopes">4 Cấp Độ Scope Dữ Liệu (Data Access Scopes)</h2>
              <p>
                Hệ thống <strong>IDEAS MYERP</strong> áp dụng mô hình phân quyền ma trận mở rộng kết hợp giữa
                <strong>RBAC (Role-Based Access Control)</strong> và <strong>ABAC (Attribute-Based Access Control)</strong>.
                Mọi truy vấn dữ liệu nhạy cảm (Contacts, Deals, Quotes, Doanh số, Học viên) được quy định chặt chẽ qua hàm
                kiểm tra phạm vi <code>getScope($auth, $module, $action)</code> với 4 cấp độ:
              </p>
              <table className="doc-table">
                <thead>
                  <tr>
                    <th style={{ width: '120px' }}>Scope</th>
                    <th style={{ width: '220px' }}>Đối tượng áp dụng</th>
                    <th>Quyền hạn &amp; Cơ chế lọc SQL tương ứng</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>all</code></td>
                    <td><code>superadmin</code>, <code>admin</code>, <code>director</code>, <code>assistant</code></td>
                    <td>
                      Toàn quyền truy cập và giám sát toàn bộ dữ liệu trong cùng một tổ chức (tenant).
                      Câu truy vấn chỉ giới hạn theo <code>WHERE tenant_id = :tenant_id</code>.
                    </td>
                  </tr>
                  <tr>
                    <td><code>team</code></td>
                    <td>Trưởng nhóm / Quản lý (<code>manager</code>), Phó nhóm (<code>co_leader_ids</code>)</td>
                    <td>
                      Được xem và quản lý dữ liệu của chính mình và toàn bộ thành viên cấp dưới trong nhóm.
                      Hệ thống tự động liên kết bảng <code>teams</code> và bảng <code>users</code> để mở rộng điều kiện lọc:
                      <code>WHERE tenant_id = :tenant_id AND (assigned_to = :my_id OR assigned_to IN (SELECT id FROM users WHERE team_id = :my_team_id))</code>.
                    </td>
                  </tr>
                  <tr>
                    <td><code>own</code></td>
                    <td>Tư vấn viên (<code>sale</code>, <code>sales</code>), Giảng viên (<code>teacher</code>), Nhân viên chuyên môn</td>
                    <td>
                      Chỉ được xem và xử lý hồ sơ/học viên/đơn hàng được phân bổ trực tiếp cho chính mình.
                      Điều kiện lọc bắt buộc: <code>WHERE tenant_id = :tenant_id AND assigned_to = :my_id</code>.
                    </td>
                  </tr>
                  <tr>
                    <td><code>none</code></td>
                    <td>Tài khoản bị giới hạn quyền theo hành động (VD: nhân viên sale cố xóa lead hoặc truy cập cài đặt hệ thống)</td>
                    <td>
                      Bị từ chối truy cập tuyệt đối (HTTP 403 Forbidden). Hệ thống tự động ghi nhật ký vi phạm bảo mật vào <code>admin_logs</code>.
                    </td>
                  </tr>
                </tbody>
              </table>

              <h2 id="role-definitions">Đặc Tả Chi Tiết 10 Vai Trò (Roles) Chuẩn Doanh Nghiệp</h2>
              <p>
                Hệ thống chuẩn hóa 10 nhóm vai trò (Roles) tương ứng với từng phòng ban và vị trí công tác thực tế trong doanh nghiệp:
              </p>

              <div style={{ overflowX: 'auto', margin: '16px 0', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <table className="doc-table" style={{ margin: 0, fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-secondary)' }}>
                      <th style={{ width: '130px' }}>Mã Role (Slug)</th>
                      <th style={{ width: '170px' }}>Chức danh vị trí</th>
                      <th style={{ width: '90px', textAlign: 'center' }}>Scope</th>
                      <th style={{ minWidth: '320px' }}>Đặc tả trách nhiệm &amp; Thẩm quyền nghiệp vụ</th>
                      <th style={{ minWidth: '220px' }}>Quy tắc bảo mật &amp; Giới hạn</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code style={{ color: '#ef4444', fontWeight: 700 }}>superadmin</code></td>
                      <td><strong>1. Super Admin</strong><br /><small style={{ color: 'var(--color-text-muted)' }}>Quản trị viên Tối cao</small></td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#059669' }}>all</td>
                      <td>Tài khoản root cấp hệ thống, sở hữu toàn quyền quản trị multi-tenant, khởi tạo và cấu hình cơ sở dữ liệu, quản lý API Gateway, JWT, Webhook, Cron Jobs, sao lưu phục hồi dữ liệu và kiểm tra Audit Logs.</td>
                      <td>Toàn quyền không giới hạn; quyền hard-delete dữ liệu khi bảo trì; bảo vệ chống xóa nhầm bằng khóa xác thực cấp cao.</td>
                    </tr>
                    <tr>
                      <td><code style={{ color: '#d97706', fontWeight: 700 }}>admin</code></td>
                      <td><strong>2. Admin</strong><br /><small style={{ color: 'var(--color-text-muted)' }}>Quản trị viên Vận hành</small></td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#059669' }}>all</td>
                      <td>Quản trị vận hành nội bộ một chi nhánh hoặc công ty: tạo mới và khóa tài khoản nhân sự, phân bổ đội nhóm, thiết lập ca làm việc, cấu hình thông báo (Mail SES, Telegram, Zalo), quy tắc tính công và bảng giá.</td>
                      <td>Toàn quyền Xem, Sửa, Xóa mềm (Soft Delete) và khôi phục từ thùng rác đối với mọi dữ liệu thuộc cùng <code>tenant_id</code>.</td>
                    </tr>
                    <tr>
                      <td><code style={{ color: '#7c3aed', fontWeight: 700 }}>director</code></td>
                      <td><strong>3. Director</strong><br /><small style={{ color: 'var(--color-text-muted)' }}>Ban Giám Đốc / Điều Hành</small></td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#059669' }}>all</td>
                      <td>Giám đốc điều hành, theo dõi toàn bộ dashboard KPI, dòng tiền thực thu/chi, tiến độ tuyển sinh, phê duyệt các khoản chi lớn (≥ 20 triệu), phê duyệt hợp đồng đối tác và chính sách hoa hồng.</td>
                      <td>Read/Write ở phân hệ kinh doanh và tài chính; Delete: <code>none</code> ở Khách hàng và Cài đặt để bảo vệ cơ sở dữ liệu cốt lõi; không can thiệp cài đặt kỹ thuật.</td>
                    </tr>
                    <tr>
                      <td><code style={{ color: '#2563eb', fontWeight: 700 }}>manager</code></td>
                      <td><strong>4. Manager</strong><br /><small style={{ color: 'var(--color-text-muted)' }}>Trưởng Nhóm / Quản Lý</small></td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#2563eb' }}>team</td>
                      <td>
                        Quản lý toàn bộ khách hàng, hợp đồng đặt cọc của thành viên trực thuộc nhóm mình (theo <code>team_id</code>). Duyệt cấp 1 đơn nghỉ phép, bổ sung công bù, tạm ứng và giải trình đi muộn.<br />
                        <strong>⚡ 2 Chế độ hoạt động đặc thù:</strong><br />
                        • <em>Trưởng nhóm kiêm Sale (combined):</em> Nhận chia data tự động, chạy đồng hồ SLA, phải chấm công hàng ngày.<br />
                        • <em>Trưởng nhóm thuần túy (pure):</em> Không nhận data cá nhân, miễn chấm công, chuyên tâm quản trị và duyệt đơn.
                      </td>
                      <td>Giới hạn nghiêm ngặt theo <code>team_id</code>; Delete: <code>none</code> ở phân hệ khách hàng; không có quyền truy cập vào sổ quỹ tiền mặt hay cấu hình hệ thống.</td>
                    </tr>
                    <tr>
                      <td><code style={{ color: '#059669', fontWeight: 700 }}>assistant</code></td>
                      <td><strong>5. Assistant</strong><br /><small style={{ color: 'var(--color-text-muted)' }}>Trợ Lý / Điều Phối Data</small></td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#059669' }}>all</td>
                      <td>Tiếp nhận data khách hàng mới từ Form/Ads/Fanpage, rà soát trùng lặp, điều phối chia data (Round-robin hoặc thủ công) cho đội ngũ Sales, hỗ trợ tạo báo giá chuẩn và kiểm tra phiếu hợp tác.</td>
                      <td>Read: <code>all</code>, Write: <code>all</code> trên Leads, Deals, Quotes, Projects, Companies. Delete: <code>none</code> tuyệt đối nhằm bảo vệ tài sản dữ liệu khách hàng.</td>
                    </tr>
                    <tr>
                      <td><code style={{ color: '#ea580c', fontWeight: 700 }}>sales</code> / <code>sale</code></td>
                      <td><strong>6. Sales</strong><br /><small style={{ color: 'var(--color-text-muted)' }}>Tư Vấn Viên Tuyển Sinh</small></td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#d97706' }}>own</td>
                      <td>Trực tiếp gọi điện tư vấn, cập nhật trạng thái chăm sóc trên phễu 14 bước tuyển sinh, tạo báo giá (Quotes), ghi nhận phiếu đặt cọc (Deals/Deposits). Ràng buộc bởi đồng hồ SLA gọi điện đầu tiên (30 phút).</td>
                      <td>Chỉ xem và xử lý khách hàng được phân bổ cho chính mình (<code>assigned_to = my_id</code>); Delete: <code>none</code>; tuyệt đối không thấy hồ sơ của TVV khác cùng nhóm.</td>
                    </tr>
                    <tr>
                      <td><code style={{ color: '#db2777', fontWeight: 700 }}>hr</code></td>
                      <td><strong>7. HR / Nhân Sự</strong><br /><small style={{ color: 'var(--color-text-muted)' }}>Quản Trị Nhân Lực &amp; Lương</small></td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#059669' }}>all (HRM)</td>
                      <td>Quản lý hồ sơ nhân sự, hợp đồng lao động, cấu hình BHXH/BHYT/BHTN, lịch xếp ca (Roster), theo dõi máy chấm công/Face AI/GPS. Duyệt cấp 2 đơn phép/công, tính lương, phát hành phiếu lương và khóa bảng lương.</td>
                      <td>Toàn quyền trên bảng <code>users</code>, <code>check_ins</code>, <code>leaves</code>, <code>shifts</code>, <code>monthly_payslips</code>. Không truy cập vào sổ quỹ tiền mặt hay hợp đồng bán hàng CRM.</td>
                    </tr>
                    <tr>
                      <td><code style={{ color: '#0284c7', fontWeight: 700 }}>accountant</code></td>
                      <td><strong>8. Accountant</strong><br /><small style={{ color: 'var(--color-text-muted)' }}>Kế Toán &amp; Tài Chính</small></td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#059669' }}>all (Finance)</td>
                      <td>Quản lý sổ quỹ tiền mặt và tài khoản ngân hàng, xác nhận thực thu phiếu cọc, kiểm tra chứng từ chi tiêu, đối soát công nợ, phát hành hóa đơn tài chính và tham gia duyệt chi phí cấp 2 trước khi thanh toán.</td>
                      <td>Toàn quyền phân hệ Tài chính (<code>expenses</code>, <code>incomes</code>, <code>deposits</code>, <code>quotes</code>, <code>invoices</code>). Xem tiến độ đơn bán hàng để xuất hóa đơn; không sửa đổi Lead của Sales.</td>
                    </tr>
                    <tr>
                      <td><code style={{ color: '#0d9488', fontWeight: 700 }}>teacher</code></td>
                      <td><strong>9. Teacher</strong><br /><small style={{ color: 'var(--color-text-muted)' }}>Giảng Viên &amp; Giáo Vụ</small></td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#d97706' }}>own / team</td>
                      <td>Xem thời khóa biểu giảng dạy, danh sách học viên trong các lớp học được phân công, thực hiện điểm danh từng buổi, nhập điểm thi/bài tập và ghi nhận tổng số giờ dạy thực tế để đối soát thù lao.</td>
                      <td>Chỉ truy cập dữ liệu lớp học và học viên được phân công giảng dạy. Tuyệt đối không xem thông tin chi phí, doanh thu, hợp đồng kinh doanh hay bảng lương người khác.</td>
                    </tr>
                    <tr>
                      <td><code style={{ color: '#9333ea', fontWeight: 700 }}>marketing</code></td>
                      <td><strong>10. Marketing</strong><br /><small style={{ color: 'var(--color-text-muted)' }}>Tiếp Thị &amp; Nguồn Lead</small></td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#059669' }}>all (Campaigns)</td>
                      <td>Quản lý kênh tiếp thị: tích hợp UTM Tracking, Landing Pages, Form Webhooks, Fanpage Lead Ads. Đo lường tỷ lệ chuyển đổi, chi phí trên từng liên hệ (CPL) và hiệu quả chiến dịch (ROI).</td>
                      <td>Read: <code>all</code> chiến dịch và nguồn; tự động che giấu số điện thoại khách hàng (chỉ hiển thị 4 số cuối) nhằm chống lộ dữ liệu; Write: <code>own</code> cấu hình chiến dịch.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h2 id="rbac-matrix-table">Bảng Ma Trận Phân Quyền Chi Tiết (10 Roles × 9 Phân Hệ)</h2>
              <p>
                Bảng đối chiếu tổng quan quyền hạn chuẩn mặc định của từng vai trò trên 9 phân hệ cốt lõi trong hệ thống IDEAS MYERP.
                Mỗi ô hiển thị trực quan trạng thái 3 hành động: <strong>R (Read - Xem)</strong>, <strong>W (Write - Thêm/Sửa)</strong>, <strong>D (Delete - Xóa)</strong> bằng icon Check xanh (<Check size={13} color="#059669" style={{ display: 'inline', verticalAlign: 'middle' }} />) và icon X (<X size={13} color="#9ca3af" style={{ display: 'inline', verticalAlign: 'middle' }} />) kèm phạm vi Scope tương ứng:
              </p>

              <div style={{ overflowX: 'auto', margin: '16px 0', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <table className="doc-table" style={{ margin: 0, fontSize: '0.74rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-secondary)' }}>
                      <th style={{ minWidth: '150px' }}>Phân Hệ (Module)</th>
                      <th style={{ minWidth: '85px', textAlign: 'center' }}>Super Admin</th>
                      <th style={{ minWidth: '85px', textAlign: 'center' }}>Admin</th>
                      <th style={{ minWidth: '85px', textAlign: 'center' }}>Director</th>
                      <th style={{ minWidth: '85px', textAlign: 'center' }}>Manager</th>
                      <th style={{ minWidth: '85px', textAlign: 'center' }}>Assistant</th>
                      <th style={{ minWidth: '85px', textAlign: 'center' }}>Sales</th>
                      <th style={{ minWidth: '85px', textAlign: 'center' }}>HR</th>
                      <th style={{ minWidth: '85px', textAlign: 'center' }}>Accountant</th>
                      <th style={{ minWidth: '85px', textAlign: 'center' }}>Teacher</th>
                      <th style={{ minWidth: '85px', textAlign: 'center' }}>Marketing</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>1. Khách Hàng (Leads/CRM)</strong></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="all" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="all" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="team" w="team" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="own" w="own" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="none" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="none" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="none" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="own" d="none" /></td>
                    </tr>
                    <tr>
                      <td><strong>2. Đặt Cọc &amp; Hợp Đồng (Deals)</strong></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="all" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="all" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="all" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="team" w="team" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="all" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="own" w="own" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="none" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="team" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="none" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="none" w="none" d="none" /></td>
                    </tr>
                    <tr>
                      <td><strong>3. Phiếu Hợp Tác (Cooperation)</strong></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="all" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="all" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="all" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="team" w="own" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="own" w="own" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="none" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="none" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="none" w="none" d="none" /></td>
                    </tr>
                    <tr>
                      <td><strong>4. Báo Giá &amp; Hóa Đơn (Quotes)</strong></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="all" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="all" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="all" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="team" w="team" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="own" w="own" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="none" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="none" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="none" w="none" d="none" /></td>
                    </tr>
                    <tr>
                      <td><strong>5. Đối Tác &amp; Đại Lý (Companies)</strong></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="all" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="all" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="team" w="team" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="none" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="team" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="none" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="none" w="none" d="none" /></td>
                    </tr>
                    <tr>
                      <td><strong>6. Dự Án &amp; Roster (Projects)</strong></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="all" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="all" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="team" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="none" w="none" d="none" /></td>
                    </tr>
                    <tr>
                      <td><strong>7. Nhân Sự &amp; Công Lương (HRM)</strong></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="all" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="all" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="team" w="team" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="none" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="own" w="own" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="all" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="own" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="own" w="own" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="own" w="own" d="none" /></td>
                    </tr>
                    <tr>
                      <td><strong>8. Đào Tạo &amp; Lớp Học (Academic)</strong></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="all" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="all" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="team" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="team" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="none" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="none" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="none" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="own" w="own" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="none" w="none" d="none" /></td>
                    </tr>
                    <tr>
                      <td><strong>9. Cấu Hình Hệ Thống (Settings)</strong></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="all" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="all" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="none" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="none" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="all" w="all" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="none" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="none" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="none" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="none" w="none" d="none" /></td>
                      <td style={{ textAlign: 'center' }}><PermCell r="none" w="none" d="none" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h2 id="rbac-matrix">Ma Trận Quyền Hạt Nhân (permissions_json) &amp; Cấu Trúc Đội Nhóm</h2>
              <p>
                Ngoài vai trò mặc định (Role), mỗi tài khoản người dùng trong bảng <code>users</code> đều có trường <code>permissions_json</code>
                lưu trữ quyền hạn theo cấu trúc ma trận JSON:
              </p>
              <div className="doc-code-box">
                <code>
                  &#123;<br />
                  &nbsp;&nbsp;"leads": &#123; "read": "team", "write": "team", "delete": "none" &#125;,<br />
                  &nbsp;&nbsp;"deals": &#123; "read": "all", "write": "own", "delete": "none" &#125;,<br />
                  &nbsp;&nbsp;"quotes": &#123; "read": "all", "write": "all", "delete": "none" &#125;,<br />
                  &nbsp;&nbsp;"academic": &#123; "read": "all", "write": "own", "delete": "none" &#125;,<br />
                  &nbsp;&nbsp;"finance": &#123; "read": "none", "write": "none", "delete": "none" &#125;<br />
                  &#125;
                </code>
              </div>
              <p>
                Cơ chế này cho phép Trưởng phòng hoặc Quản trị viên tùy biến cấp quyền hạt nhân cho từng cá nhân (ví dụ: một nhân viên sale xuất sắc được
                cấp thêm quyền xem dữ liệu của toàn team hoặc hỗ trợ duyệt đơn báo giá) mà không cần thay đổi Role gốc của tài khoản.
              </p>

              <h2 id="special-authorizations">Quyền Hạn Đặc Thù &amp; Cơ Chế Phê Duyệt Nghiệp Vụ</h2>
              <p>
                Bên cạnh ma trận CRUD, hệ thống tích hợp các luồng phê duyệt và kiểm soát bảo mật đa bước:
              </p>
              <ul>
                <li>
                  <strong>Luồng Phê Duyệt Đơn Nhân Sự 2 Cấp (Leaves &amp; Supplementary Attendance):</strong>
                  <br />
                  - <em>Cấp 1:</em> Trưởng nhóm (<code>manager</code>) hoặc Quản lý trực tiếp duyệt tính xác thực nghiệp vụ.
                  <br />
                  - <em>Cấp 2:</em> Phòng Nhân sự (<code>hr</code>) hoặc Ban Giám Đốc duyệt ghi nhận vào bảng công/bảng lương và trừ phép năm.
                </li>
                <li>
                  <strong>Cập Nhật Công / Bổ Sung Công (Missing Check-in):</strong>
                  <br />
                  Khi nhân viên quên chấm công cả sáng và chiều trong ngày làm việc quá khứ, giao diện lịch hiển thị huy hiệu <em>"Cập nhật công"</em>. Nhân viên bắt buộc nhập lý do giải trình chi tiết kèm giờ vào/ra thực tế để tạo bản ghi có trạng thái <code>pending_approval</code>, chờ Quản lý duyệt trước khi tính công.
                </li>
                <li>
                  <strong>Bảo Vệ Khách Hàng SLA &amp; Thu Hồi Tự Động (Lead Fair-Share):</strong>
                  <br />
                  Tư vấn viên nhận Lead có thời hạn 30 phút để thực hiện cuộc gọi đầu tiên (First Call). Nếu vi phạm SLA, hệ thống tự động thu hồi Lead và đẩy vào hàng đợi tái phân bổ cho tư vấn viên khác.
                </li>
                <li>
                  <strong>Chốt Bảng Lương &amp; Khóa Số Liệu:</strong>
                  <br />
                  Chỉ có tài khoản có quyền <code>hr</code> và <code>admin</code> mới được kích hoạt lệnh chốt kỳ công. Sau khi chốt, toàn bộ bản ghi chấm công của tháng đó sẽ chuyển sang trạng thái <em>Read-only</em>, chống mọi hành vi sửa đổi dữ liệu hồi tố.
                </li>
              </ul>

              <h2 id="security-layers">Kiến Trúc An Ninh Phòng Thủ Đa Lớp (Defense-in-Depth)</h2>
              <div className="doc-stages">
                <div className="doc-stage">
                  <strong>
                    <Shield size={15} color="#10b981" />
                    <span>100% Prepared Statements (Anti-SQLi)</span>
                  </strong>
                  <p>Tuyệt đối không sử dụng phép nối chuỗi trực tiếp trong truy vấn. 100% lệnh SQL chạy qua PDO Parameter Binding, vô hiệu hóa hoàn toàn nguy cơ SQL Injection.</p>
                </div>
                <div className="doc-stage">
                  <strong>
                    <Lock size={15} color="#3b82f6" />
                    <span>Rate Limiting &amp; Chống Brute-Force</span>
                  </strong>
                  <p>Áp dụng bộ đệm trượt giới hạn 5 lần thử mật khẩu sai / 5 phút trên một IP/Username. Vượt ngưỡng sẽ tự động kích hoạt mã Captcha bảo vệ hoặc tạm khóa đăng nhập 15 phút.</p>
                </div>
                <div className="doc-stage">
                  <strong>
                    <Cpu size={15} color="#8b5cf6" />
                    <span>Token Blacklisting &amp; Revocation</span>
                  </strong>
                  <p>Khi nhân viên đổi mật khẩu hoặc đăng xuất, Token ID (JTI) được đẩy ngay vào bảng Blacklist. Mọi request sử dụng token cũ sẽ lập tức bị chặn.</p>
                </div>
                <div className="doc-stage">
                  <strong>
                    <FileText size={15} color="#f59e0b" />
                    <span>Audit Trail Bất Biến (admin_logs)</span>
                  </strong>
                  <p>Mọi thao tác Thêm, Sửa, Xóa, Đổi quyền, Ghi nhận giờ giảng, Nhập điểm, Xuất Excel đều tự động ghi lại IP, User ID, Timestamp và Diff Before/After. Không một ai có thể xóa sửa log này từ UI.</p>
                </div>
              </div>
            </div>
          )
        },
        {
          id: 'arch-db-dictionary',
          title: 'Từ Điển Cơ Sở Dữ Liệu 91 Bảng Chuẩn Hóa (Core Database Schema)',
          description: 'Tra cứu toàn diện 91 bảng quan hệ InnoDB theo 9 cụm chức năng: Khóa ngoại, vai trò nghiệp vụ và cơ chế bảo toàn dữ liệu.',
          headings: [
            { id: 'db-clusters', text: 'Phân Nhóm 9 Cụm Nghiệp Vụ Cơ Sở Dữ Liệu' },
            { id: 'db-table-dictionary', text: 'Bảng Tra Cứu Chi Tiết 91 Bảng Dữ Liệu Thực Tế' },
            { id: 'db-integrity-rules', text: 'Quy Tắc Ràng Buộc Khóa Ngoại & Tự Động Hóa Migrations' }
          ],
          content: (
            <div className="doc-prose">
              <h2 id="db-clusters">Phân Nhóm 9 Cụm Nghiệp Vụ Cơ Sở Dữ Liệu</h2>
              <p>
                Cơ sở dữ liệu <strong>IDEAS MYERP</strong> được xây dựng trên nền tảng MySQL 8.0 / MariaDB 10.6+ InnoDB chuẩn hóa 3NF gồm <strong>91 bảng quan hệ</strong> phân chia theo 9 phân hệ chức năng:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', margin: '14px 0' }}>
                <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                  <strong style={{ color: 'var(--color-primary)' }}>1. Tổ chức &amp; Bảo mật (11 bảng)</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Quản lý đa doanh nghiệp, tài khoản, token xác thực, phân quyền và nhật ký kiểm toán.</p>
                </div>
                <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                  <strong style={{ color: 'var(--color-primary)' }}>2. CRM &amp; Khách Hàng (12 bảng)</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Nhân khẩu học (persons), liên hệ, lịch sử phễu 14 bước tuyển sinh, form thu thập.</p>
                </div>
                <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                  <strong style={{ color: 'var(--color-primary)' }}>3. Phân Phối Lead &amp; Fair-Share (8 bảng)</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Vòng xoay Round-Robin, trọng số, đền bù lượt thiếu (Starvation) và quy tắc định tuyến.</p>
                </div>
                <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                  <strong style={{ color: 'var(--color-primary)' }}>4. Bán Hàng &amp; Doanh Thu (9 bảng)</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Báo giá (Quotes), hóa đơn (Invoices), tiền cọc giữ chỗ (Deposits), phiếu hợp tác.</p>
                </div>
                <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                  <strong style={{ color: 'var(--color-primary)' }}>5. Chấm Công &amp; Tiền Lương (8 bảng)</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Check-in GPS/Selfie, ca trực đêm/lễ/cuối tuần, nghỉ phép và phiếu lương ký số.</p>
                </div>
                <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                  <strong style={{ color: 'var(--color-primary)' }}>6. Tài Chính &amp; Mua Sắm (5 bảng)</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Đề xuất thanh toán chi phí, tạm ứng, đơn mua sắm vật tư (PO) và nhà cung cấp.</p>
                </div>
                <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                  <strong style={{ color: 'var(--color-primary)' }}>7. Đào Tạo &amp; Học Vụ (5 bảng)</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Chương trình đào tạo, khóa tuyển sinh, biểu phí học phần và bảng xếp ca giảng viên.</p>
                </div>
                <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                  <strong style={{ color: 'var(--color-primary)' }}>8. Dự Án &amp; Công Việc (6 bảng)</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Dự án, quy trình mẫu (Workflows), checklist đầu việc và tài liệu kho đám mây.</p>
                </div>
                <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                  <strong style={{ color: 'var(--color-primary)' }}>9. Tự Động Hóa &amp; Tích Hợp (17 bảng)</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Hàng đợi mail/Zalo/Sync, kết nối Google Sheets, Meta CAPI, AI Vector RAG và Cấu hình.</p>
                </div>
              </div>

              <h2 id="db-table-dictionary">Bảng Tra Cứu Chi Tiết 91 Bảng Dữ Liệu Thực Tế</h2>
              <div style={{ overflowX: 'auto', margin: '14px 0', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <table className="doc-table" style={{ margin: 0, fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-secondary)' }}>
                      <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                      <th style={{ width: '180px' }}>Tên bảng (Table Name)</th>
                      <th style={{ width: '150px' }}>Phân nhóm nghiệp vụ</th>
                      <th>Mô tả chức năng &amp; Ràng buộc dữ liệu cốt lõi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td style={{ textAlign: 'center' }}>1</td><td><code>tenants</code></td><td>Tổ chức &amp; Bảo mật</td><td>Phân lập đa doanh nghiệp (Tenant ID, Domain, mã công ty, trạng thái kích hoạt).</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>2</td><td><code>users</code></td><td>Tổ chức &amp; Bảo mật</td><td>Hồ sơ tài khoản, chức vụ, mật khẩu mã hóa bcrypt, permissions_json, giờ làm riêng.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>3</td><td><code>teams</code></td><td>Tổ chức &amp; Bảo mật</td><td>Đội nhóm kinh doanh / nghiệp vụ, liên kết leader_id và co_leader_ids.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>4</td><td><code>accounts</code></td><td>Tổ chức &amp; Bảo mật</td><td>Danh mục tài khoản ngân hàng và sổ quỹ tiền mặt nội bộ của từng tenant.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>5</td><td><code>quyen_truy_cap</code></td><td>Tổ chức &amp; Bảo mật</td><td>Danh mục quyền hạn hạt nhân tĩnh của hệ thống.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>6</td><td><code>refresh_tokens</code></td><td>Tổ chức &amp; Bảo mật</td><td>Lưu trữ Refresh Token JWT xoay vòng, hỗ trợ xác thực bảo mật và thu hồi phiên đăng nhập.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>7</td><td><code>login_attempts</code></td><td>Tổ chức &amp; Bảo mật</td><td>Bộ đệm giới hạn đăng nhập chống Brute-Force (tự động khóa sau 5 lần thử sai).</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>8</td><td><code>admin_logs</code></td><td>Tổ chức &amp; Bảo mật</td><td>Nhật ký kiểm toán thao tác quản trị viên bất biến (IP, User, Action, Timestamp).</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>9</td><td><code>audit_logs</code></td><td>Tổ chức &amp; Bảo mật</td><td>Nhật ký ghi vết biến động dữ liệu chi tiết (Diff Before/After giá trị các trường).</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>10</td><td><code>capi_logs</code></td><td>Tổ chức &amp; Bảo mật</td><td>Nhật ký sự kiện chuyển đổi bắn về Meta Conversion API (CAPI).</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>11</td><td><code>schema_migrations</code></td><td>Tổ chức &amp; Bảo mật</td><td>Lịch sử các phiên bản migration cơ sở dữ liệu đã thực thi tự động.</td></tr>

                    <tr><td style={{ textAlign: 'center' }}>12</td><td><code>persons</code></td><td>CRM &amp; Khách Hàng</td><td>Thực thể nhân khẩu học chuẩn hóa duy nhất (Họ tên, CCCD/CMND, ngày sinh, giới tính).</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>13</td><td><code>contacts</code></td><td>CRM &amp; Khách Hàng</td><td>Hồ sơ liên hệ khách hàng gắn liền với từng tổ chức tenant (khóa ngoại person_id).</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>14</td><td><code>contact_phones</code></td><td>CRM &amp; Khách Hàng</td><td>Lưu trữ đa số điện thoại của một khách hàng, hỗ trợ thuật toán chống trùng đa kênh.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>15</td><td><code>contact_emails</code></td><td>CRM &amp; Khách Hàng</td><td>Danh sách email của khách hàng phục vụ gửi tài liệu và chăm sóc tự động.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>16</td><td><code>leads</code></td><td>CRM &amp; Khách Hàng</td><td>Phiên tuyển sinh/bán hàng của khách hàng theo từng nguồn tiếp thị và chiến dịch.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>17</td><td><code>pipeline_stages</code></td><td>CRM &amp; Khách Hàng</td><td>Cấu hình danh mục 14 bước chuyển đổi phễu tuyển sinh chuẩn.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>18</td><td><code>deal_stage_history</code></td><td>CRM &amp; Khách Hàng</td><td>Nhật ký lịch sử và thời gian khách hàng dừng tại từng bước phễu tuyển sinh.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>19</td><td><code>deals</code></td><td>CRM &amp; Khách Hàng</td><td>Hợp đồng bán hàng, cơ hội đặt cọc học bổng, giá trị dự kiến và tiến độ chốt đơn.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>20</td><td><code>lead_offers</code></td><td>CRM &amp; Khách Hàng</td><td>Các gói ưu đãi, voucher, chính sách học bổng áp dụng cho từng khách hàng.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>21</td><td><code>forms</code></td><td>CRM &amp; Khách Hàng</td><td>Cấu hình form thu thập lead nhúng trên website, landing page hoặc mạng xã hội.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>22</td><td><code>form_submissions</code></td><td>CRM &amp; Khách Hàng</td><td>Dữ liệu thô khách hàng điền form gửi về máy chủ trước khi qua AI Gatekeeper.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>23</td><td><code>blocked_leads</code></td><td>CRM &amp; Khách Hàng</td><td>Danh sách đen (Blacklist) chặn số điện thoại rác, spam và đối thủ quấy rối.</td></tr>

                    <tr><td style={{ textAlign: 'center' }}>24</td><td><code>duplicate_log</code></td><td>Phân Phối &amp; Fair-Share</td><td>Nhật ký ghi nhận các trường hợp khách hàng trùng lặp và cảnh báo xung đột dữ liệu.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>25</td><td><code>distribution_rounds</code></td><td>Phân Phối &amp; Fair-Share</td><td>Cấu hình các vòng xoay chia data (Round-Robin, chia theo phần trăm, ca trực).</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>26</td><td><code>round_consultants</code></td><td>Phân Phối &amp; Fair-Share</td><td>Danh sách tư vấn viên tham gia trong vòng và trọng số chia số (weight).</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>27</td><td><code>distribution_logs</code></td><td>Phân Phối &amp; Fair-Share</td><td>Nhật ký chi tiết từng lượt chia lead (phân bổ thành công, đền bù, nhắc nhở).</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>28</td><td><code>active_compensation_logs</code></td><td>Phân Phối &amp; Fair-Share</td><td>Lịch sử đền bù lượt thiếu (Starvation Prevention) cho TVV bị thu hồi do nghỉ phép.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>29</td><td><code>consultants</code></td><td>Phân Phối &amp; Fair-Share</td><td>Quản lý năng lực và trạng thái sẵn sàng tiếp nhận data của từng tư vấn viên.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>30</td><td><code>consultant_leaves</code></td><td>Phân Phối &amp; Fair-Share</td><td>Lịch xin tạm dừng nhận data của TVV (khi nghỉ phép hoặc đi công tác ngoài văn phòng).</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>31</td><td><code>routing_rules</code></td><td>Phân Phối &amp; Fair-Share</td><td>Quy tắc định tuyến tự động theo nguồn data, chiến dịch và loại chương trình đào tạo.</td></tr>

                    <tr><td style={{ textAlign: 'center' }}>32</td><td><code>quotes</code></td><td>Bán Hàng &amp; Doanh Thu</td><td>Báo giá chi tiết gửi khách hàng, quản lý tỷ lệ chiết khấu, voucher và thuế VAT.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>33</td><td><code>quote_items</code></td><td>Bán Hàng &amp; Doanh Thu</td><td>Chi tiết từng dòng khóa học / sản phẩm dịch vụ trong phiếu báo giá.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>34</td><td><code>invoices</code></td><td>Bán Hàng &amp; Doanh Thu</td><td>Hóa đơn điện tử chính thức phát hành cho học viên và khách hàng doanh nghiệp.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>35</td><td><code>invoice_items</code></td><td>Bán Hàng &amp; Doanh Thu</td><td>Chi tiết các khoản mục thanh toán trên hóa đơn tài chính.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>36</td><td><code>deposits</code></td><td>Bán Hàng &amp; Doanh Thu</td><td>Phiếu đặt cọc giữ chỗ, ảnh ủy nhiệm chi ngân hàng và xác nhận thực thu của kế toán.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>37</td><td><code>deposit_milestones</code></td><td>Bán Hàng &amp; Doanh Thu</td><td>Các đợt thanh toán trả góp học phí theo mốc thời gian thỏa thuận.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>38</td><td><code>cooperation_slips</code></td><td>Bán Hàng &amp; Doanh Thu</td><td>Phiếu hợp tác tuyển sinh chia sẻ hoa hồng với đại lý và trường liên kết.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>39</td><td><code>companies</code></td><td>Bán Hàng &amp; Doanh Thu</td><td>Hồ sơ doanh nghiệp đối tác, đại lý tuyển sinh và viện đào tạo liên kết.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>40</td><td><code>segments</code></td><td>Bán Hàng &amp; Doanh Thu</td><td>Phân khúc đối tượng khách hàng phục vụ chiến dịch truyền thông và tiếp thị lại.</td></tr>

                    <tr><td style={{ textAlign: 'center' }}>41</td><td><code>check_ins</code></td><td>Chấm Công &amp; Tiền Lương</td><td>Nhật ký chấm công (GPS, Wi-Fi BSSID, ảnh selfie, phút trễ, phút về sớm, công bù).</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>42</td><td><code>shifts</code></td><td>Chấm Công &amp; Tiền Lương</td><td>Danh mục ca làm việc (ca hành chính, ca tối, ca trực thứ Bảy, ca trực lớp học).</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>43</td><td><code>leaves</code></td><td>Chấm Công &amp; Tiền Lương</td><td>Đơn từ điện tử (nghỉ phép năm, nghỉ ốm, WFH, làm thêm giờ OT, đi muộn bù giờ).</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>44</td><td><code>monthly_payslips</code></td><td>Chấm Công &amp; Tiền Lương</td><td>Bảng lương tháng, chữ ký số điện tử Canvas (signature_url), ghi chú khiếu nại (note).</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>45</td><td><code>night_shift_registrations</code></td><td>Chấm Công &amp; Tiền Lương</td><td>Đăng ký và phê duyệt trực ca đêm của đội ngũ tư vấn tuyển sinh.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>46</td><td><code>holiday_shift_registrations</code></td><td>Chấm Công &amp; Tiền Lương</td><td>Đăng ký và phê duyệt trực các ngày nghỉ lễ quốc gia hưởng lương đặc thù.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>47</td><td><code>weekend_shift_registrations</code></td><td>Chấm Công &amp; Tiền Lương</td><td>Đăng ký và phê duyệt trực ca thứ Bảy, Chủ Nhật phục vụ tư vấn học viên.</td></tr>

                    <tr><td style={{ textAlign: 'center' }}>48</td><td><code>expenses</code></td><td>Tài Chính &amp; Mua Sắm</td><td>Đơn đề xuất thanh toán, tạm ứng chi tiêu nội bộ có phê duyệt đa cấp.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>49</td><td><code>expense_entities</code></td><td>Tài Chính &amp; Mua Sắm</td><td>Đối tượng thụ hưởng chi phí (nhân viên nhận tạm ứng, đối tác cung cấp dịch vụ).</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>50</td><td><code>purchase_orders</code></td><td>Tài Chính &amp; Mua Sắm</td><td>Đơn đặt hàng mua sắm vật tư, trang thiết bị văn phòng và công nghệ.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>51</td><td><code>purchase_order_items</code></td><td>Tài Chính &amp; Mua Sắm</td><td>Chi tiết số lượng, đơn giá từng khoản mục trong đơn mua sắm.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>52</td><td><code>suppliers</code></td><td>Tài Chính &amp; Mua Sắm</td><td>Hồ sơ nhà cung cấp dịch vụ, thông tin xuất hóa đơn và tài khoản ngân hàng.</td></tr>

                    <tr><td style={{ textAlign: 'center' }}>53</td><td><code>products</code></td><td>Đào Tạo &amp; Học Vụ</td><td>Danh mục chương trình đào tạo, khóa học, gói dịch vụ tư vấn du học / thạc sĩ.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>54</td><td><code>product_categories</code></td><td>Đào Tạo &amp; Học Vụ</td><td>Phân loại ngành học, hệ đào tạo (Cử nhân, Thạc sĩ, Tiến sĩ, Chứng chỉ quốc tế).</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>55</td><td><code>batches</code></td><td>Đào Tạo &amp; Học Vụ</td><td>Đợt tuyển sinh, khóa khai giảng lớp học và niên khóa đào tạo.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>56</td><td><code>project_roster</code></td><td>Đào Tạo &amp; Học Vụ</td><td>Bảng phân công giảng viên chính, trợ giảng và xếp phòng học cho từng buổi.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>57</td><td><code>inventory_logs</code></td><td>Đào Tạo &amp; Học Vụ</td><td>Nhật ký xuất nhập tồn tài liệu học tập, giáo trình và quà tặng tuyển sinh.</td></tr>

                    <tr><td style={{ textAlign: 'center' }}>58</td><td><code>projects</code></td><td>Dự Án &amp; Công Việc</td><td>Dự án đào tạo tổng thể, quản lý tiến độ, ngân sách và thành viên tham gia.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>59</td><td><code>workflows</code></td><td>Dự Án &amp; Công Việc</td><td>Quy trình nghiệp vụ mẫu áp dụng cho các bộ phận chuyên môn.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>60</td><td><code>workflow_task_templates</code></td><td>Dự Án &amp; Công Việc</td><td>Mẫu danh sách các đầu việc chuẩn cần thực thi khi kích hoạt quy trình mới.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>61</td><td><code>project_documents</code></td><td>Dự Án &amp; Công Việc</td><td>Kho lưu trữ tài liệu, đề cương, quyết định mở lớp liên kết với dự án.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>62</td><td><code>cloud_files</code></td><td>Dự Án &amp; Công Việc</td><td>Quản trị tệp tin tải lên máy chủ cục bộ hoặc dịch vụ lưu trữ đám mây.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>63</td><td><code>file_categories</code></td><td>Dự Án &amp; Công Việc</td><td>Phân cấp thư mục tài liệu lưu trữ khoa học theo phòng ban.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>64</td><td><code>files</code></td><td>Dự Án &amp; Công Việc</td><td>Siêu dữ liệu tệp tin đính kèm (dung lượng, đuôi mở rộng, MIME type).</td></tr>

                    <tr><td style={{ textAlign: 'center' }}>65</td><td><code>notifications</code></td><td>Tự Động Hóa &amp; Tích Hợp</td><td>Bảng thông báo trung tâm lưu trữ thông báo đẩy thời gian thực tới người dùng.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>66</td><td><code>sent_notifications</code></td><td>Tự Động Hóa &amp; Tích Hợp</td><td>Lịch sử các thông báo đã gửi qua Email SES, Zalo Bot và Telegram Webhook.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>67</td><td><code>user_notification_settings</code></td><td>Tự Động Hóa &amp; Tích Hợp</td><td>Cấu hình tùy chọn kênh nhận thông báo cá nhân của từng nhân viên.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>68</td><td><code>task_muted_notifications</code></td><td>Tự Động Hóa &amp; Tích Hợp</td><td>Danh sách các nhiệm vụ/dự án mà người dùng đã chọn tắt chuông thông báo.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>69</td><td><code>mail_queue</code></td><td>Tự Động Hóa &amp; Tích Hợp</td><td>Hàng đợi gửi email tự động bất đồng bộ qua Amazon SES SMTP.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>70</td><td><code>zalo_queue</code></td><td>Tự Động Hóa &amp; Tích Hợp</td><td>Hàng đợi tin nhắn gửi qua Zalo Official Account / Zalo Personal Bot.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>71</td><td><code>sync_queue</code></td><td>Tự Động Hóa &amp; Tích Hợp</td><td>Hàng đợi đồng bộ dữ liệu hai chiều với các trang Google Sheets liên kết.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>72</td><td><code>sheet_connections</code></td><td>Tự Động Hóa &amp; Tích Hợp</td><td>Cấu hình kết nối Google Service Account và Spreadsheet ID của phòng ban.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>73</td><td><code>sheet_sync_records</code></td><td>Tự Động Hóa &amp; Tích Hợp</td><td>Nhật ký đối soát từng dòng dữ liệu đồng bộ giữa hệ thống và Google Sheets.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>74</td><td><code>field_mappings</code></td><td>Tự Động Hóa &amp; Tích Hợp</td><td>Quy tắc ánh xạ tên cột Google Sheets tương ứng với các trường trong database.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>75</td><td><code>system_settings</code></td><td>Tự Động Hóa &amp; Tích Hợp</td><td>Bảng lưu trữ toàn bộ các tham số cấu hình vận hành cốt lõi của toàn hệ sinh thái.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>76</td><td><code>activities</code></td><td>Tự Động Hóa &amp; Tích Hợp</td><td>Dòng thời gian hoạt động chăm sóc khách hàng (cuộc gọi, họp mặt, ghi chú).</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>77</td><td><code>activity_comments</code></td><td>Tự Động Hóa &amp; Tích Hợp</td><td>Bình luận và chỉ đạo nghiệp vụ của Trưởng nhóm trong từng hoạt động chăm sóc.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>78</td><td><code>notes</code></td><td>Tự Động Hóa &amp; Tích Hợp</td><td>Ghi chú nội bộ trên hồ sơ khách hàng, đơn hàng và dự án.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>79</td><td><code>note_mentions</code></td><td>Tự Động Hóa &amp; Tích Hợp</td><td>Ghi nhận người dùng được nhắc tên (@mention) để kích hoạt thông báo tức thì.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>80</td><td><code>comments</code></td><td>Tự Động Hóa &amp; Tích Hợp</td><td>Hệ thống tương tác, bình luận trên Bảng tin nội bộ (Enterprise Feed).</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>81</td><td><code>communication_logs</code></td><td>Tự Động Hóa &amp; Tích Hợp</td><td>Nhật ký cuộc gọi thoại tổng đài Cloud Call Center (thời lượng, file ghi âm).</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>82</td><td><code>marketing_campaigns</code></td><td>Tự Động Hóa &amp; Tích Hợp</td><td>Quản lý chiến dịch quảng cáo, ngân sách giải ngân và bộ tham số UTM Tracking.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>83</td><td><code>data_reports</code></td><td>Tự Động Hóa &amp; Tích Hợp</td><td>Dữ liệu tổng hợp báo cáo định kỳ kết xuất tự động từ hệ thống.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>84</td><td><code>email_otps</code></td><td>Tự Động Hóa &amp; Tích Hợp</td><td>Mã xác thực một lần (OTP) gửi qua email phục vụ đổi mật khẩu bảo mật cao.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>85</td><td><code>entity_tags</code></td><td>Tự Động Hóa &amp; Tích Hợp</td><td>Bảng liên kết đa-đa giữa các thực thể hệ thống và nhãn gắn thẻ.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>86</td><td><code>tags</code></td><td>Tự Động Hóa &amp; Tích Hợp</td><td>Danh mục nhãn màu sắc phân loại hồ sơ khách hàng và công việc.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>87</td><td><code>ticket_comments</code></td><td>Tự Động Hóa &amp; Tích Hợp</td><td>Trao đổi và cập nhật tiến độ xử lý ticket phản ánh chất lượng Lead.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>88</td><td><code>ticket_notify_settings</code></td><td>Tự Động Hóa &amp; Tích Hợp</td><td>Cấu hình thông báo tự động cho từng loại khiếu nại / ticket nội bộ.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>89</td><td><code>tickets</code></td><td>Tự Động Hóa &amp; Tích Hợp</td><td>Phiếu yêu cầu đền bù lead rác, hỗ trợ kỹ thuật và kiểm tra tài chính.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>90</td><td><code>ai_training_docs</code></td><td>Tự Động Hóa &amp; Tích Hợp</td><td>Tài liệu tri thức nội bộ nạp vào vector database cho trợ lý AI RAG.</td></tr>
                    <tr><td style={{ textAlign: 'center' }}>91</td><td><code>ai_training_chunks</code></td><td>Tự Động Hóa &amp; Tích Hợp</td><td>Các phân đoạn văn bản vector hóa (embedding) phục vụ truy hồi chính sách tự động.</td></tr>
                  </tbody>
                </table>
              </div>

              <h2 id="db-integrity-rules">Quy Tắc Ràng Buộc Khóa Ngoại &amp; Tự Động Hóa Migrations</h2>
              <p>
                Để đảm bảo tính toàn vẹn dữ liệu ở cấp độ phần cứng cơ sở dữ liệu:
              </p>
              <ul>
                <li><strong>Toàn vẹn khóa ngoại (Foreign Key Constraints):</strong> Mọi bảng giao dịch đều liên kết chặt chẽ với bảng cha qua khóa ngoại. Khi một <code>tenant</code> hoặc <code>user</code> bị xóa, hệ thống áp dụng cơ chế <code>ON DELETE CASCADE</code> hoặc <code>ON DELETE SET NULL</code> đối với các bản ghi lịch sử, chống hoàn toàn hiện tượng bản ghi mồ côi (Orphan Records).</li>
                <li><strong>Tự động nâng cấp cấu trúc (Self-Healing Auto Migrations):</strong> Khi deploy phiên bản mới, tiến trình <code>run_migrations.php</code> tự động đối chiếu schema hiện tại với phiên bản mục tiêu trong bảng <code>schema_migrations</code>. Nếu phát hiện thiếu bảng hoặc thiếu cột mới, hệ thống tự động chạy các câu lệnh <code>ALTER TABLE</code> an toàn mà không làm gián đoạn hệ thống.</li>
              </ul>
            </div>
          )
        },
        {
          id: 'arch-system-settings',
          title: 'Ma Trận Tham Số Cấu Hình Nghiệp Vụ Toàn Cục (system_settings)',
          description: 'Đặc tả các tham số vận hành cốt lõi: Hạn mức kinh doanh, SLA tiếp nhận lead, bù lượt thiếu (Starvation) và cấu hình điều phối Fallback.',
          headings: [
            { id: 'settings-business-limits', text: 'Hạn Mức Kinh Doanh & SLA Tiếp Nhận Lead' },
            { id: 'settings-attendance-schedule', text: 'Lịch Trình Làm Việc, Trực Ca & Chấm Công' },
            { id: 'settings-starvation-fallback', text: 'Thuật Toán Bù Lượt Thiếu & Xử Lý Fallback' },
            { id: 'settings-integrations', text: 'Tham Số Tích Hợp Kênh Ngoài (Meta, Zalo, SES, Sheets)' }
          ],
          content: (
            <div className="doc-prose">
              <p>
                Bảng <code>system_settings</code> lưu trữ toàn bộ các tham số vận hành cốt lõi của doanh nghiệp dưới dạng khóa - giá trị (Key-Value), cho phép Ban Giám Đốc và Quản trị viên tùy chỉnh linh hoạt chính sách kinh doanh mà không cần sửa đổi mã nguồn:
              </p>

              <h2 id="settings-business-limits">Hạn Mức Kinh Doanh &amp; SLA Tiếp Nhận Lead</h2>
              <div style={{ overflowX: 'auto', margin: '14px 0', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <table className="doc-table" style={{ margin: 0, fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-secondary)' }}>
                      <th style={{ width: '220px' }}>Khóa cấu hình (Setting Key)</th>
                      <th style={{ width: '120px' }}>Giá trị chuẩn</th>
                      <th>Đặc tả nghiệp vụ &amp; Cơ chế kiểm soát tự động</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>lead_decay_days</code></td>
                      <td><code>7</code> (ngày)</td>
                      <td><strong>Số ngày tự động rớt nhiệt (Decay):</strong> Nếu một Lead đã phân bổ cho TVV nhưng không phát sinh bất kỳ cuộc gọi hay cập nhật trạng thái nào trong vòng 7 ngày, hệ thống tự động thu hồi Lead về kho dữ liệu chung (Databank) để tái phân bổ.</td>
                    </tr>
                    <tr>
                      <td><code>first_call_sla_minutes</code></td>
                      <td><code>30</code> (phút)</td>
                      <td><strong>Thời hạn cuộc gọi đầu tiên (First Call SLA):</strong> TVV sau khi nhận Lead mới trong giờ hành chính bắt buộc phải thực hiện cuộc gọi đầu tiên trong vòng 30 phút. Quá thời hạn này, hệ thống kích hoạt cảnh báo vi phạm SLA và có thể thu hồi Lead chia cho người khác.</td>
                    </tr>
                    <tr>
                      <td><code>backpressure_limit</code></td>
                      <td><code>5 - 10</code> (lead)</td>
                      <td><strong>Hạn mức chống ngậm data (Backpressure):</strong> Giới hạn số lượng Lead ở trạng thái <em>"Chưa Xử Lý"</em> tối đa mà một TVV được phép nắm giữ. Khi vượt ngưỡng, hệ thống tự động loại TVV khỏi vòng quay chia số cho đến khi TVV xử lý xong số lead cũ.</td>
                    </tr>
                    <tr>
                      <td><code>deposit_demote_status</code></td>
                      <td><code>chua_chot</code></td>
                      <td><strong>Quy tắc xử lý bỏ cọc:</strong> Khi một hồ sơ khách hàng đã đặt cọc nhưng sau đó hủy cọc hoặc đòi hoàn cọc, hệ thống tự động hạ cấp trạng thái phễu tuyển sinh về bước quy định và trừ doanh số dự kiến.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h2 id="settings-attendance-schedule">Lịch Trình Làm Việc, Trực Ca &amp; Chấm Công</h2>
              <div style={{ overflowX: 'auto', margin: '14px 0', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <table className="doc-table" style={{ margin: 0, fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-secondary)' }}>
                      <th style={{ width: '220px' }}>Khóa cấu hình (Setting Key)</th>
                      <th style={{ width: '120px' }}>Giá trị chuẩn</th>
                      <th>Đặc tả nghiệp vụ &amp; Cơ chế kiểm soát tự động</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>global_work_start_time</code><br /><code>global_work_end_time</code></td>
                      <td><code>08:00</code><br /><code>17:30</code></td>
                      <td>Khung giờ làm việc hành chính chuẩn toàn công ty. Áp dụng cho mọi nhân viên không cài đặt khung giờ đặc thù (<code>use_custom_work_hours = 0</code>).</td>
                    </tr>
                    <tr>
                      <td><code>global_work_schedule</code></td>
                      <td>JSON Schedule</td>
                      <td>Cấu hình giờ bắt đầu / kết thúc chi tiết từng ngày trong tuần từ Thứ Hai đến Thứ Bảy, bao gồm giờ nghỉ trưa (12:00 - 13:30) và cấu hình làm việc buổi sáng Thứ Bảy.</td>
                    </tr>
                    <tr>
                      <td><code>holiday_schedules</code></td>
                      <td>JSON Array</td>
                      <td>Danh mục các kỳ nghỉ lễ tết quốc gia (Tết Nguyên Đán, Giỗ Tổ, 30/4 - 1/5, Quốc Khánh). Hệ thống tự động miễn chấm công và mở đăng ký trực lễ hưởng thù lao đặc biệt.</td>
                    </tr>
                    <tr>
                      <td><code>require_checkout</code></td>
                      <td><code>1</code> (Bật)</td>
                      <td>Bắt buộc nhân viên phải bấm Check-out cuối ca trước khi tan làm. Nếu tắt, hệ thống chỉ yêu cầu check-in một lần đầu ngày.</td>
                    </tr>
                    <tr>
                      <td><code>office_latitude</code><br /><code>office_longitude</code><br /><code>office_allowed_radius</code></td>
                      <td>Tọa độ GPS<br />Bán kính: <code>100m</code></td>
                      <td>Tọa độ địa lý trụ sở văn phòng và bán kính GPS cho phép chấm công. Mọi tọa độ vượt quá bán kính 100m sẽ bị hệ thống từ chối xác thực check-in.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h2 id="settings-starvation-fallback">Thuật Toán Bù Lượt Thiếu &amp; Xử Lý Fallback</h2>
              <div style={{ overflowX: 'auto', margin: '14px 0', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <table className="doc-table" style={{ margin: 0, fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-secondary)' }}>
                      <th style={{ width: '220px' }}>Khóa cấu hình (Setting Key)</th>
                      <th style={{ width: '120px' }}>Giá trị chuẩn</th>
                      <th>Đặc tả nghiệp vụ &amp; Cơ chế kiểm soát tự động</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>starvation_prevention_enabled</code></td>
                      <td><code>1</code> (Bật)</td>
                      <td><strong>Kích hoạt Bù Lượt Thiếu (Starvation Prevention):</strong> Khi một TVV quay trở lại làm việc sau kỳ nghỉ phép hoặc công tác dài ngày, thuật toán tự động tính toán số lượt chia bị thiếu và ưu tiên cấp lượt nhận Data mới liên tục cho đến khi cân bằng với các đồng nghiệp khác.</td>
                    </tr>
                    <tr>
                      <td><code>late_checkin_compensation</code></td>
                      <td><code>1</code> (Bật)</td>
                      <td><strong>Đền bù khi giải trình trễ check-in:</strong> Nếu TVV bị hệ thống tạm ngưng chia Lead do chưa check-in đúng giờ nhưng sau đó đã gửi đơn giải trình và được Quản lý duyệt, hệ thống tự động cấp lượt bù tương ứng vào bảng <code>active_compensation_logs</code>.</td>
                    </tr>
                    <tr>
                      <td><code>fallback_round_id</code><br /><code>fallback_admin_id</code></td>
                      <td>ID Vòng / User ID</td>
                      <td><strong>Phân bổ dự phòng (Fallback):</strong> Khi một Lead đổ về nhưng không khớp bất kỳ điều kiện định tuyến nào (ví dụ: đăng ký khóa học đặc thù ngoài danh mục, hoặc toàn bộ TVV trong vòng đều đang quá tải Backpressure), Lead được tự động đẩy về Vòng dự phòng hoặc chỉ định Admin trực tiếp thụ lý.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h2 id="settings-integrations">Tham Số Tích Hợp Kênh Ngoài (Meta, Zalo, SES, Sheets)</h2>
              <p>
                Đảm bảo luồng dữ liệu thông suốt giữa ERP và các nền tảng công nghệ toàn cầu:
              </p>
              <ul>
                <li><strong>Meta Conversion API (<code>meta_pixel_id</code>, <code>meta_access_token</code>):</strong> Tự động đồng bộ ngược các sự kiện chốt đơn (Deal Won, Đặt cọc) về Facebook Ads Manager để thuật toán Meta tối ưu hóa đối tượng Lookalike chính xác.</li>
                <li><strong>Zalo Official Account (<code>zalo_oa_id</code>, <code>zalo_secret_key</code>):</strong> Kết nối trực tiếp qua Zalo OpenAPI để gửi tin nhắn ZNS xác nhận lịch tư vấn và thông báo nội bộ tới nhân viên.</li>
                <li><strong>Amazon SES SMTP (<code>email_smtp_host</code>, <code>email_smtp_user</code>):</strong> Cấu hình máy chủ thư điện tử bảo mật cao, đảm bảo tỷ lệ gửi phiếu lương và hợp đồng vào Inbox đạt trên 99.8%.</li>
                <li><strong>Google Sheets Service Account:</strong> Đồng bộ hai chiều thời gian thực giữa CRM và bảng tính Google Sheets của từng chi nhánh thông qua tiến trình ngầm <code>cron_sync.php</code>.</li>
              </ul>
            </div>
          )
        },
        {
          id: 'arch-controllers',
          title: 'Danh Mục 39 Backend Controllers & 11 Tiến Trình Ngầm (Crons)',
          description: 'Đặc tả toàn diện 39 Controllers PHP 8.1 trong backend/controllers/, phương thức xử lý, bảng dữ liệu liên kết và 11 tiến trình ngầm.',
          headings: [
            { id: 'backend-controllers-matrix', text: 'Bảng Đối Soát 39 Backend Controllers Thực Tế' },
            { id: 'backend-crons-matrix', text: 'Danh Mục 11 Tiến Trình Ngầm & Cron Jobs' }
          ],
          content: (
            <div className="doc-prose">
              <p>
                Toàn bộ nghiệp vụ của hệ thống IDEAS MYERP phía máy chủ được thực thi thông qua <strong>39 Controllers chuyên biệt</strong> đặt tại thư mục <code>backend/controllers/</code> kết hợp với <strong>11 tiến trình ngầm (Cron Jobs / Queue Workers)</strong>. 
                Dưới đây là bảng đối soát chi tiết 100% mã nguồn thực tế:
              </p>

              <h2 id="backend-controllers-matrix">Bảng Đối Soát 39 Backend Controllers Thực Tế</h2>
              <div className="table-responsive">
                <table className="doc-table">
                  <thead>
                    <tr>
                      <th style={{ width: '4%' }}>#</th>
                      <th style={{ width: '22%' }}>Tên Controller (File)</th>
                      <th style={{ width: '20%' }}>Bảng Quản Lý Chính</th>
                      <th style={{ width: '54%' }}>Chức Năng Nghiệp Vụ & Phương Thức Cốt Lõi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>1</td>
                      <td><code>ActivityController.php</code></td>
                      <td><code>activity_logs</code>, <code>leads</code></td>
                      <td>Ghi vết tương tác khách hàng, cuộc gọi tư vấn, nhật ký chăm sóc và đặt lịch nhắc hẹn chăm sóc tiếp theo.</td>
                    </tr>
                    <tr>
                      <td>2</td>
                      <td><code>AuthController.php</code></td>
                      <td><code>users</code>, <code>refresh_tokens</code>, <code>login_attempts</code></td>
                      <td>Xác thực JWT token, làm mới phiên (Refresh Token xoay vòng), đổi mật khẩu mã hóa bcrypt và phòng chống Brute-Force limit.</td>
                    </tr>
                    <tr>
                      <td>3</td>
                      <td><code>CampaignController.php</code></td>
                      <td><code>campaigns</code>, <code>leads</code></td>
                      <td>Quản lý chiến dịch tuyển sinh, theo dõi UTM source/medium/campaign, ngân sách tiếp thị và tỷ lệ hoàn vốn ROI.</td>
                    </tr>
                    <tr>
                      <td>4</td>
                      <td><code>CapiController.php</code></td>
                      <td><code>capi_logs</code>, <code>leads</code>, <code>deals</code></td>
                      <td>Đẩy sự kiện chuyển đổi thời gian thực lên Meta Conversions API (Lead, Purchase, CompleteRegistration) và TikTok Events.</td>
                    </tr>
                    <tr>
                      <td>5</td>
                      <td><code>CheckInController.php</code></td>
                      <td><code>check_ins</code>, <code>shifts</code></td>
                      <td>Xác thực chấm công 3 lớp (GPS Geofencing, Wi-Fi BSSID, Selfie Biometrics), tính phút đi trễ/về sớm và xử lý đơn bù công.</td>
                    </tr>
                    <tr>
                      <td>6</td>
                      <td><code>CloudFileController.php</code></td>
                      <td><code>cloud_files</code>, <code>file_categories</code></td>
                      <td>Quản lý kho lưu trữ tệp tin đám mây, gắn nhãn tài liệu, liên kết tệp vào dự án và hồ sơ khách hàng.</td>
                    </tr>
                    <tr>
                      <td>7</td>
                      <td><code>CompanyController.php</code></td>
                      <td><code>companies</code>, <code>cooperation_slips</code></td>
                      <td>Quản lý hồ sơ đối tác doanh nghiệp, trường đại học liên kết, đại lý tuyển sinh và hợp đồng ghi nhớ MOU.</td>
                    </tr>
                    <tr>
                      <td>8</td>
                      <td><code>ContactController.php</code></td>
                      <td><code>contacts</code>, <code>contact_phones</code>, <code>contact_emails</code>, <code>persons</code></td>
                      <td>Quản trị thực thể khách hàng trung tâm, tách đa số điện thoại/email, giải thuật chống trùng đa kênh và phân bổ lead.</td>
                    </tr>
                    <tr>
                      <td>9</td>
                      <td><code>CooperationController.php</code></td>
                      <td><code>cooperation_slips</code>, <code>companies</code></td>
                      <td>Quản lý phiếu hợp tác tuyển sinh, tỷ lệ chiết khấu, hoa hồng đại lý đối tác và theo dõi tiến độ chi trả.</td>
                    </tr>
                    <tr>
                      <td>10</td>
                      <td><code>CustomFieldController.php</code></td>
                      <td><code>custom_fields</code>, <code>custom_field_values</code></td>
                      <td>Định nghĩa và lưu trữ các trường dữ liệu tùy biến động cho từng module mà không cần thay đổi schema vật lý.</td>
                    </tr>
                    <tr>
                      <td>11</td>
                      <td><code>DashboardController.php</code></td>
                      <td>Tổng hợp đa bảng</td>
                      <td>Tổng hợp số liệu thống kê realtime: doanh thu, công nợ, số lượng lead theo phễu, KPI đội ngũ kinh doanh.</td>
                    </tr>
                    <tr>
                      <td>12</td>
                      <td><code>DealController.php</code></td>
                      <td><code>deals</code>, <code>deal_stage_history</code></td>
                      <td>Quản trị cơ hội bán hàng, phễu tuyển sinh 14 giai đoạn, giá trị hợp đồng và thời gian dừng (dwell time) tại từng bước.</td>
                    </tr>
                    <tr>
                      <td>13</td>
                      <td><code>DepositController.php</code></td>
                      <td><code>deposits</code>, <code>deposit_milestones</code></td>
                      <td>Quản trị tiền cọc giữ chỗ, phân kỳ các đợt đóng tiền cọc, xuất biên lai thu tiền, quy trình hoàn cọc và cấn trừ học phí.</td>
                    </tr>
                    <tr>
                      <td>14</td>
                      <td><code>ExportController.php</code></td>
                      <td>CRM, HRM, Kế toán</td>
                      <td>Xuất khẩu dữ liệu Excel chuẩn hóa tốc độ cao cho danh sách khách hàng, học viên, bảng chấm công và bảng lương tháng.</td>
                    </tr>
                    <tr>
                      <td>15</td>
                      <td><code>FileCategoryController.php</code></td>
                      <td><code>file_categories</code></td>
                      <td>Quản lý danh mục phân loại tài liệu, phân quyền truy cập theo cấp thư mục tệp tin.</td>
                    </tr>
                    <tr>
                      <td>16</td>
                      <td><code>FinanceController.php</code></td>
                      <td><code>expenses</code>, <code>accounts</code>, <code>expense_entities</code></td>
                      <td>Quản lý đơn đề nghị thanh toán, tạm ứng công tác, hoàn ứng chi tiêu, sổ quỹ ngân hàng và dòng tiền ra vào.</td>
                    </tr>
                    <tr>
                      <td>17</td>
                      <td><code>HRMController.php</code></td>
                      <td><code>users</code>, <code>shifts</code>, <code>leaves</code>, <code>monthly_payslips</code></td>
                      <td>Hồ sơ nhân sự, xếp ca làm việc, duyệt đơn xin nghỉ phép, bộ máy tính lương tự động, chữ ký số và giải quyết khiếu nại lương.</td>
                    </tr>
                    <tr>
                      <td>18</td>
                      <td><code>ImportController.php</code></td>
                      <td><code>contacts</code>, <code>leads</code>, <code>persons</code></td>
                      <td>Nhập dữ liệu khách hàng/học viên hàng loạt từ file Excel, tự động chuẩn hóa số điện thoại và chặn trùng lặp.</td>
                    </tr>
                    <tr>
                      <td>19</td>
                      <td><code>InventoryController.php</code></td>
                      <td><code>inventory</code>, <code>products</code></td>
                      <td>Quản trị kho giáo trình, tài liệu học tập, quà tặng tuyển sinh và theo dõi tài sản thiết bị văn phòng bàn giao cho nhân sự.</td>
                    </tr>
                    <tr>
                      <td>20</td>
                      <td><code>NoteController.php</code></td>
                      <td><code>notes</code></td>
                      <td>Quản lý ghi chú nội bộ bảo mật trên từng hồ sơ khách hàng, cơ hội bán hàng và công việc dự án.</td>
                    </tr>
                    <tr>
                      <td>21</td>
                      <td><code>NotificationController.php</code></td>
                      <td><code>notifications</code>, <code>sent_notifications</code></td>
                      <td>Hệ thống thông báo đẩy đa kênh: chuông thông báo In-app, Web Push qua SSE, gửi cảnh báo vi phạm SLA và nhắc nhở công.</td>
                    </tr>
                    <tr>
                      <td>22</td>
                      <td><code>POSController.php</code></td>
                      <td><code>pos_orders</code>, <code>pos_order_items</code></td>
                      <td>Điểm bán lẻ và thu phí trực tiếp tại quầy tuyển sinh, in hóa đơn nhanh và ghi nhận doanh thu tức thì vào sổ quỹ.</td>
                    </tr>
                    <tr>
                      <td>23</td>
                      <td><code>PostController.php</code></td>
                      <td><code>posts</code>, <code>comments</code>, <code>likes</code></td>
                      <td>Bảng tin truyền thông nội bộ doanh nghiệp (Enterprise Feed), đăng thông báo ban giám đốc, tương tác và gắn sao bài viết.</td>
                    </tr>
                    <tr>
                      <td>24</td>
                      <td><code>ProductController.php</code></td>
                      <td><code>products</code>, <code>product_categories</code></td>
                      <td>Danh mục chương trình đào tạo (Cử nhân, Thạc sĩ, Chứng chỉ), cơ cấu tín chỉ học phần và biểu phí tiêu chuẩn.</td>
                    </tr>
                    <tr>
                      <td>25</td>
                      <td><code>ProjectController.php</code></td>
                      <td><code>projects</code>, <code>project_roster</code>, <code>batches</code></td>
                      <td>Quản lý dự án tổng thể, lớp học đào tạo, bảng công việc Kanban, phân công giảng viên và phòng học.</td>
                    </tr>
                    <tr>
                      <td>26</td>
                      <td><code>PurchaseOrderController.php</code></td>
                      <td><code>purchase_orders</code>, <code>purchase_order_items</code></td>
                      <td>Đơn mua sắm vật tư, trang thiết bị (PO), quy trình trình ký phê duyệt 3 cấp và nhập kho hàng hóa.</td>
                    </tr>
                    <tr>
                      <td>27</td>
                      <td><code>QuoteController.php</code></td>
                      <td><code>quotes</code>, <code>quote_items</code></td>
                      <td>Bộ máy tạo báo giá tuyển sinh/dịch vụ, áp dụng chính sách học bổng, chiết khấu, thuế VAT và tự động kết xuất PDF chuẩn.</td>
                    </tr>
                    <tr>
                      <td>28</td>
                      <td><code>ReportController.php</code></td>
                      <td>Tổng hợp đa bảng</td>
                      <td>Xuất các báo cáo chuyên sâu: báo cáo tỷ lệ chuyển đổi sales, phân tích kênh quảng cáo, báo cáo chi phí và công nợ tồn đọng.</td>
                    </tr>
                    <tr>
                      <td>29</td>
                      <td><code>SalesOrderController.php</code></td>
                      <td><code>sales_orders</code>, <code>invoices</code>, <code>invoice_items</code></td>
                      <td>Quản lý đơn đặt hàng bán (SO), kích hoạt hợp đồng học viên và phát hành hóa đơn tài chính.</td>
                    </tr>
                    <tr>
                      <td>30</td>
                      <td><code>SearchController.php</code></td>
                      <td>Toàn bộ hệ thống</td>
                      <td>Tìm kiếm toàn cục siêu tốc trên thanh công cụ: tìm khách hàng, số điện thoại, mã đơn, tên nhân viên và hồ sơ dự án.</td>
                    </tr>
                    <tr>
                      <td>31</td>
                      <td><code>SupplierController.php</code></td>
                      <td><code>suppliers</code></td>
                      <td>Hồ sơ nhà cung cấp dịch vụ, văn phòng phẩm, địa điểm thuê ngoài và lịch sử thanh toán công nợ.</td>
                    </tr>
                    <tr>
                      <td>32</td>
                      <td><code>TagController.php</code></td>
                      <td><code>tags</code>, <code>taggables</code></td>
                      <td>Hệ thống gắn nhãn phân loại đa thực thể (Lead Tags, Deal Tags, Task Tags) hỗ trợ lọc dữ liệu thông minh.</td>
                    </tr>
                    <tr>
                      <td>33</td>
                      <td><code>TeamController.php</code></td>
                      <td><code>teams</code>, <code>users</code></td>
                      <td>Quản trị sơ đồ tổ chức, phòng ban, phân cấp Trưởng nhóm (Leader) và Đồng trưởng nhóm (Co-leaders).</td>
                    </tr>
                    <tr>
                      <td>34</td>
                      <td><code>TicketController.php</code></td>
                      <td><code>tickets</code></td>
                      <td>Trung tâm tiếp nhận yêu cầu hỗ trợ, chia ticket theo phòng ban chuyên trách, giám sát hạn cam kết SLA xử lý.</td>
                    </tr>
                    <tr>
                      <td>35</td>
                      <td><code>UploadController.php</code></td>
                      <td><code>uploads</code></td>
                      <td>Tiếp nhận tệp đính kèm, ảnh selfie chấm công, chứng từ thanh toán, kiểm tra định dạng an toàn MIME type và lưu trữ.</td>
                    </tr>
                    <tr>
                      <td>36</td>
                      <td><code>UserController.php</code></td>
                      <td><code>users</code>, <code>quyen_truy_cap</code></td>
                      <td>Quản lý tài khoản cán bộ nhân viên, phân quyền RBAC chi tiết, thiết lập khung giờ làm việc cá nhân hóa.</td>
                    </tr>
                    <tr>
                      <td>37</td>
                      <td><code>WorkflowTaskTemplateController.php</code></td>
                      <td><code>workflows</code>, <code>workflow_task_templates</code></td>
                      <td>Quản lý quy trình chuẩn (SOP) và bộ checklist công việc mẫu tự động sinh ra khi tạo mới khóa học hoặc dự án.</td>
                    </tr>
                    <tr>
                      <td>38</td>
                      <td><code>ai_chat_handler.php</code></td>
                      <td>Vector RAG, LLM API</td>
                      <td>Tiếp nhận câu hỏi từ nhân viên/tư vấn viên, truy vấn cơ sở tri thức đào tạo nội bộ và trả lời tự động.</td>
                    </tr>
                    <tr>
                      <td>39</td>
                      <td><code>ai_training_handler.php</code></td>
                      <td>Vector Embeddings</td>
                      <td>Nạp tài liệu quy chế, biểu phí, chính sách tuyển sinh vào cơ sở dữ liệu Vector để phục vụ cho trợ lý ảo AI.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h2 id="backend-crons-matrix">Danh Mục 11 Tiến Trình Ngầm & Cron Jobs</h2>
              <div className="table-responsive">
                <table className="doc-table">
                  <thead>
                    <tr>
                      <th style={{ width: '4%' }}>#</th>
                      <th style={{ width: '24%' }}>Tệp Script Cron</th>
                      <th style={{ width: '18%' }}>Tần Suất / Thời Điểm Chạy</th>
                      <th style={{ width: '54%' }}>Nhiệm Vụ Thực Thi Phía Máy Chủ</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>1</td>
                      <td><code>cron_master.php</code></td>
                      <td>Mỗi 1 phút (<code>* * * * *</code>)</td>
                      <td>Nhạc trưởng điều phối: Kiểm tra các tiến trình con còn sống, kích hoạt các cron con theo đúng lịch trình đã định cấu hình.</td>
                    </tr>
                    <tr>
                      <td>2</td>
                      <td><code>cron_academic_reminders.php</code></td>
                      <td>Mỗi 15 phút</td>
                      <td>Quét thời khóa biểu: Gửi thông báo nhắc lịch học cho học viên và lịch dạy cho giảng viên trước 24 giờ và 2 giờ qua App, Email và Zalo.</td>
                    </tr>
                    <tr>
                      <td>3</td>
                      <td><code>cron_deposit_reminders.php</code></td>
                      <td>Mỗi 60 phút</td>
                      <td>Quét bảng <code>deposits</code> và <code>deposit_milestones</code>: Nhắc nhở chuyên viên tuyển sinh và khách hàng về đợt nộp cọc hoặc thanh toán đợt kế tiếp sắp đến hạn.</td>
                    </tr>
                    <tr>
                      <td>4</td>
                      <td><code>cron_recurring_tasks.php</code></td>
                      <td>00:05 mỗi ngày</td>
                      <td>Tự động nhân bản các công việc định kỳ (Daily / Weekly / Monthly tasks) từ các mẫu quy trình công việc chuẩn.</td>
                    </tr>
                    <tr>
                      <td>5</td>
                      <td><code>cron_queue_worker.php</code></td>
                      <td>Chạy liên tục (Daemon)</td>
                      <td>Quét và xử lý hàng đợi tác vụ bất đồng bộ: Xử lý ghi nhận log, cập nhật lượt đền bù Fair-Share, xử lý sự kiện bắn Webhook.</td>
                    </tr>
                    <tr>
                      <td>6</td>
                      <td><code>cron_mailer.php</code></td>
                      <td>Mỗi 1 phút</td>
                      <td>Quét hàng đợi <code>mail_queue</code>: Gửi email hàng loạt thông qua Amazon SES API, kiểm soát rate limit để đảm bảo tỷ lệ vào Inbox cao nhất.</td>
                    </tr>
                    <tr>
                      <td>7</td>
                      <td><code>cron_ai_worker.php</code></td>
                      <td>Mỗi 2 phút</td>
                      <td>Tiến trình thẩm định dữ liệu ngầm: Quét các Lead mới đăng ký để gửi lên LLM chấm điểm tiềm năng (0-100), phân loại Hot/Warm/Cold và tóm tắt nhu cầu.</td>
                    </tr>
                    <tr>
                      <td>8</td>
                      <td><code>cron_sync.php</code></td>
                      <td>Mỗi 5 phút</td>
                      <td>Đồng bộ hai chiều thời gian thực với Google Sheets CRM của từng trung tâm/chi nhánh, đảm bảo dữ liệu luôn nhất quán.</td>
                    </tr>
                    <tr>
                      <td>9</td>
                      <td><code>cron_daily_report.php</code></td>
                      <td>22:00 hàng ngày</td>
                      <td>Tổng hợp số liệu doanh thu, số cọc phát sinh, số lead mới nhận, tỷ lệ xử lý SLA trong ngày và gửi báo cáo tóm tắt qua Telegram / Email quản lý.</td>
                    </tr>
                    <tr>
                      <td>10</td>
                      <td><code>cron_weekly_report.php</code></td>
                      <td>08:00 sáng Thứ Hai</td>
                      <td>Tổng hợp hiệu suất kinh doanh, xếp hạng chuyên viên tuyển sinh xuất sắc trong tuần và gửi báo cáo lên Ban Giám đốc.</td>
                    </tr>
                    <tr>
                      <td>11</td>
                      <td><code>cron_monthly_report.php</code></td>
                      <td>01:00 ngày 1 hàng tháng</td>
                      <td>Tổng kết tài chính tháng, đối soát doanh số chốt deal, tiền cọc thực thu và đối soát bảng chấm công phục vụ chốt kỳ lương.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
        }
      ]
    },

    // 2. AI GATEKEEPER & SCORING
    {
      id: 'gatekeeper',
      title: '2. AI Gatekeeper, Pre-Screening & Chấm Điểm Dữ Liệu',
      icon: Sparkles,
      items: [
        {
          id: 'gate-scoring',
          title: 'AI Pre-Screening, Chấm Điểm Tiềm Năng 0-100 & Phân Loại Nhiệt Độ',
          description: 'Bộ máy thẩm định ngữ cảnh bằng LLM, chấm điểm tiềm năng lead và phân loại nhiệt độ tiếp cận.',
          headings: [
            { id: 'scoring-criteria', text: 'Tiêu Chí Chấm Điểm Ngữ Cảnh' },
            { id: 'temperature-cards', text: 'Phân Loại Nhiệt Độ Khách Hàng (Hot / Warm / Cold)' }
          ],
          content: (
            <div className="doc-prose">
              <p>
                Khi nhận được thông tin đăng ký của khách hàng từ Landing Page, Facebook Form hoặc Webhook đối tác,
                <strong>AI Gatekeeper</strong> tiến hành phân tích ngữ cảnh tự động bằng mô hình ngôn ngữ lớn để lượng hóa tiềm năng chốt đơn:
              </p>

              <h2 id="scoring-criteria">Tiêu Chí Chấm Điểm Ngữ Cảnh</h2>
              <table className="doc-table">
                <thead>
                  <tr>
                    <th style={{ width: '220px' }}>Nhóm tiêu chí</th>
                    <th style={{ width: '130px' }}>Trọng số điểm</th>
                    <th>Quy chuẩn đánh giá của AI</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Nhu cầu &amp; Ngân sách</strong></td>
                    <td>+40 điểm</td>
                    <td>Khách hàng nêu rõ mục tiêu học tập (thăng chức, du học, bằng cấp quốc tế) và ngân sách dự kiến sẵn sàng chi trả.</td>
                  </tr>
                  <tr>
                    <td><strong>Thời điểm ra quyết định</strong></td>
                    <td>+25 điểm</td>
                    <td>Dự kiến nhập học ngay trong kỳ tuyển sinh gần nhất (trong vòng 1 - 2 tháng tới).</td>
                  </tr>
                  <tr>
                    <td><strong>Độ hoàn thiện thông tin</strong></td>
                    <td>+20 điểm</td>
                    <td>Cung cấp đầy đủ Số điện thoại chính chủ, Email cơ quan, Tên công ty đang công tác và Chức danh quản lý.</td>
                  </tr>
                  <tr>
                    <td><strong>Độ khớp chương trình</strong></td>
                    <td>+15 điểm</td>
                    <td>Hồ sơ học vấn (bằng cử nhân, kinh nghiệm làm việc) thỏa mãn trực tiếp điều kiện đầu vào của chương trình đăng ký.</td>
                  </tr>
                </tbody>
              </table>

              <h2 id="temperature-cards">Phân Loại Nhiệt Độ Khách Hàng (Hot / Warm / Cold)</h2>
              <div className="doc-stages">
                <div className="doc-stage">
                  <strong>
                    <Flame size={15} color="#ef4444" />
                    <span>HOT (≥ 80 điểm)</span>
                  </strong>
                  <p>Khách hàng có nhu cầu cấp bách, động lực mạnh mẽ và ngân sách sẵn sàng. Quy định cam kết SLA yêu cầu tư vấn viên gọi điện tiếp cận trong vòng <strong>5 phút</strong>.</p>
                </div>
                <div className="doc-stage">
                  <strong>
                    <Zap size={15} color="#f59e0b" />
                    <span>WARM (50 - 79 điểm)</span>
                  </strong>
                  <p>Khách hàng đang tìm hiểu nghiêm túc nhưng cần tư vấn chuyên sâu về lộ trình và chính sách học phí. Thời hạn liên hệ quy chuẩn trong vòng <strong>30 phút</strong>.</p>
                </div>
                <div className="doc-stage">
                  <strong>
                    <Snowflake size={15} color="#0ea5e9" />
                    <span>COLD (&lt; 50 điểm)</span>
                  </strong>
                  <p>Khách hàng để lại thông tin sơ sài hoặc đang tham khảo dài hạn. Hệ thống đưa vào phễu nuôi dưỡng tự động qua Email Marketing và Zalo ZNS.</p>
                </div>
              </div>
            </div>
          )
        },
        {
          id: 'gate-contract-ocr',
          title: '[R&D Đang Phát Triển] Tải Hợp Đồng Tự Động Sinh Sales Order & Lịch Thanh Toán',
          description: 'Tính năng AI OCR thông minh trích xuất dữ liệu từ văn bản hợp đồng đào tạo scan để tạo Đơn bán hàng tự động.',
          headings: [
            { id: 'contract-pipeline', text: 'Luồng Xử Lý Trích Xuất Hợp Đồng' },
            { id: 'data-mapping', text: 'Ánh Xạ Dữ Liệu Lên Đơn Bán Hàng (SO)' }
          ],
          content: (
            <div className="doc-prose">
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '14px 18px', borderRadius: '8px', marginBottom: '22px' }}>
                <strong style={{ color: '#15803d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Rocket size={15} />
                  <span>Tính Năng Trọng Điểm Đang Triển Khai (R&D Active Feature)</span>
                </strong>
                <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#166534' }}>
                  Giúp bộ phận Tuyển sinh và Kế toán rút ngắn 90% thời gian nhập liệu hợp đồng giấy thủ công, loại trừ hoàn toàn sai sót đối soát số tiền và kỳ hạn đóng tiền.
                </p>
              </div>

              <h2 id="contract-pipeline">Luồng Xử Lý Trích Xuất Hợp Đồng</h2>
              <div className="doc-flow">
                <div className="doc-flow-step">1. Tư vấn viên tải lên file hợp đồng (PDF / Ảnh chụp / Scan)</div>
                <div className="doc-flow-arrow">→</div>
                <div className="doc-flow-step">2. OCR Engine đọc ký tự quang học &amp; Phân tích cấu trúc bảng</div>
                <div className="doc-flow-arrow">→</div>
                <div className="doc-flow-step">3. LLM trích xuất Pháp nhân, Học phí, Mã khóa học &amp; Đợt đóng</div>
                <div className="doc-flow-arrow">→</div>
                <div className="doc-flow-step">4. Hệ thống tự sinh Đơn Bán Hàng (SO) &amp; Lịch thu công nợ</div>
              </div>

              <h2 id="data-mapping">Ánh Xạ Dữ Liệu Lên Đơn Bán Hàng (SO)</h2>
              <table className="doc-table">
                <thead>
                  <tr>
                    <th style={{ width: '220px' }}>Trường dữ liệu trên Hợp đồng</th>
                    <th style={{ width: '240px' }}>Trường đích trên Hệ thống MYERP</th>
                    <th>Quy tắc nghiệp vụ kiểm tra chéo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Họ tên, SĐT, Số CCCD học viên</td>
                    <td><code>contacts.name</code>, <code>contacts.phone</code></td>
                    <td>Tự động tìm kiếm Lead hiện hữu trên CRM; nếu đã tồn tại thì liên kết hồ sơ, nếu chưa thì tạo Contact mới.</td>
                  </tr>
                  <tr>
                    <td>Tên chương trình đào tạo</td>
                    <td><code>sales_orders.product_id</code></td>
                    <td>So khớp với danh mục khóa học trong bảng <code>products</code> để lấy mã học phần và giá niêm yết chuẩn.</td>
                  </tr>
                  <tr>
                    <td>Tổng giá trị hợp đồng &amp; Chiết khấu</td>
                    <td><code>sales_orders.final_amount</code>, <code>discount</code></td>
                    <td>Kiểm tra chéo với mức học bổng hoặc chính sách chiết khấu được cấp trong Báo giá (Quotes) đã duyệt.</td>
                  </tr>
                  <tr>
                    <td>Các đợt thanh toán (Milestones)</td>
                    <td><code>order_payment_schedules</code></td>
                    <td>Tự động tách thành các kỳ hạn thu nợ (Đợt 1 - Cọc/Nhập học, Đợt 2, Đợt 3...) với ngày đáo hạn chính xác.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )
        },
        {
          id: 'gate-dedup-blacklist',
          title: 'Chống Trùng Đa Kênh & Bộ Lọc Blacklist Viễn Thông',
          description: 'Cơ chế lọc rác tự động, chuẩn hóa định dạng số điện thoại viễn thông và chặn spam đối thủ.',
          headings: [
            { id: 'dedup-mechanism', text: 'Thuật Toán Chống Trùng Đa Kênh' },
            { id: 'blacklist-engine', text: 'Bộ Lọc Chặn Rác & Blacklist (blocked_leads)' }
          ],
          content: (
            <div className="doc-prose">
              <h2 id="dedup-mechanism">Thuật Toán Chống Trùng Đa Kênh</h2>
              <p>
                Để bảo vệ quyền lợi chăm sóc khách hàng và tránh lãng phí chi phí marketing, khi một lead đổ vào hệ thống:
              </p>
              <ul>
                <li><strong>Chuẩn hóa số điện thoại:</strong> Tự động loại bỏ khoảng trắng, dấu chấm, dấu gạch ngang và quy đổi các đầu số quốc tế <code>+84</code> hoặc <code>84</code> về định dạng chuẩn 10 chữ số bắt đầu bằng <code>0</code>.</li>
                <li><strong>Cửa sổ bảo vệ thời gian:</strong> Nếu số điện thoại này đã được chia cho một TVV trong vòng <strong>90 ngày gần nhất</strong>, lead mới sẽ tự động được gộp vào hồ sơ cũ, tăng chỉ số tương tác (Interactions count) và bắn thông báo tới TVV đang phụ trách thay vì chia ra ngoài cho người khác.</li>
              </ul>

              <h2 id="blacklist-engine">Bộ Lọc Chặn Rác &amp; Blacklist (blocked_leads)</h2>
              <p>
                Bảng <code>blocked_leads</code> lưu trữ danh sách đen gồm số điện thoại spam, đối thủ khảo sát giá hoặc số máy quấy rối:
              </p>
              <ul>
                <li>Lead trùng với Blacklist sẽ tự động bị gắn trạng thái <code>blocked</code> hoặc <code>spam</code>.</li>
                <li>Hệ thống <strong>hoàn toàn không đưa vào luồng chia lead</strong>, bảo vệ thời gian và tinh thần làm việc của nhân sự kinh doanh.</li>
              </ul>
            </div>
          )
        }
      ]
    },

    // 3. PHỄU TUYỂN SINH 14 STAGES CHUẨN
    {
      id: 'pipeline',
      title: '3. Phễu Tuyển Sinh & Bán Hàng (14 Pipeline Stages Chuẩn)',
      icon: DollarSign,
      items: [
        {
          id: 'pipe-stages',
          title: 'Đặc Tả 14 Giai Đoạn Tuyển Sinh Chuẩn từ Database (IDEAS Admissions Pipeline)',
          description: 'Quy chuẩn hành vi tư vấn viên, mục tiêu nghiệp vụ và tiêu chuẩn chuyển đổi qua 14 giai đoạn phễu đồng bộ từ Database.',
          headings: [
            { id: 'fourteen-stages', text: 'Đặc Tả 14 Giai Đoạn Tuyển Sinh Chuẩn' },
            { id: 'crm-state-machine', text: 'Cơ Chế Trạng Thái & Quản Trị Phễu CRM' },
            { id: 'customer-360', text: 'Hồ Sơ Khách Hàng Toàn Diện (Customer Profile 360)' }
          ],
          content: (
            <div className="doc-prose">
              <h2 id="fourteen-stages">Đặc Tả 14 Giai Đoạn Tuyển Sinh Chuẩn (IDEAS Admissions Pipeline)</h2>
              <p>
                Toàn bộ dữ liệu phễu bán hàng được quản lý tập trung tại bảng <code>pipeline_stages</code> với <strong>14 giai đoạn tuyển sinh chuyên nghiệp</strong>.
                Mỗi mốc đánh dấu bước tiến rõ ràng trong hành trình quyết định của học viên, đi kèm checklist hành động bắt buộc và tiêu chuẩn đầu ra (Exit Criteria):
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table className="doc-table">
                  <thead>
                    <tr>
                      <th style={{ width: '45px' }}>#</th>
                      <th style={{ width: '210px' }}>Giai Đoạn &amp; Slug</th>
                      <th style={{ width: '230px' }}>Định Nghĩa / Milestone</th>
                      <th style={{ width: '180px' }}>Mục Tiêu Giai Đoạn</th>
                      <th style={{ width: '260px' }}>Checklist Hành Động TVV (Sales Actions)</th>
                      <th style={{ width: '220px' }}>Tiêu Chuẩn Đầu Ra (Exit Criteria)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>01</code></td>
                      <td>
                        <strong style={{ color: '#3b82f6' }}>01 – New Lead</strong><br />
                        <code>new_lead</code>
                      </td>
                      <td>Lead vừa được ghi nhận trên CRM; chưa có hoạt động tư vấn thực tế.</td>
                      <td>Thiết lập liên hệ đầu tiên.</td>
                      <td>Kiểm tra Lead trùng; nguồn Lead; chương trình quan tâm; phân công TVV; liên hệ lần đầu.</td>
                      <td>Đã thực hiện ít nhất 01 hoạt động liên hệ hợp lệ → <em>Contact Attempted</em>.</td>
                    </tr>
                    <tr>
                      <td><code>02</code></td>
                      <td>
                        <strong style={{ color: '#64748b' }}>02 – Contact Attempted</strong><br />
                        <code>contact_attempted</code>
                      </td>
                      <td>TVV đã gọi/gửi Zalo/email nhưng chưa có trao đổi hai chiều.</td>
                      <td>Thiết lập được tương tác hai chiều.</td>
                      <td>Follow-up theo cadence; đa kênh (Call, SMS, Zalo); ghi nhận đầy đủ lịch sử tương tác.</td>
                      <td>Khách phản hồi hoặc có cuộc trao đổi trực tiếp → <em>Connected</em>.</td>
                    </tr>
                    <tr>
                      <td><code>03</code></td>
                      <td>
                        <strong style={{ color: '#06b6d4' }}>03 – Connected</strong><br />
                        <code>connected</code>
                      </td>
                      <td>Đã có trao đổi hai chiều nhưng chưa đủ dữ liệu để xác định mức độ phù hợp.</td>
                      <td>Qualification sơ bộ.</td>
                      <td>Thu thập chương trình quan tâm, học vấn, kinh nghiệm, chức vụ/lĩnh vực, mục tiêu và thời điểm dự kiến nhập học.</td>
                      <td>Khách đáp ứng điều kiện sơ bộ của ít nhất 01 chương trình → <em>Needed</em>.</td>
                    </tr>
                    <tr>
                      <td><code>04</code></td>
                      <td>
                        <strong style={{ color: '#7c3aed' }}>04 – Needed</strong><br />
                        <code>needed</code>
                      </td>
                      <td>Khách được xác định có khả năng phù hợp với chương trình IDEAS đang tuyển sinh.</td>
                      <td>Xác nhận mức độ phù hợp và mở Discovery.</td>
                      <td>Đánh giá Academic Fit, Professional Fit, Program Fit, Timeline, Motivation và Financial indication.</td>
                      <td>Đủ dữ liệu nền tảng và khách đồng ý trao đổi sâu hơn → <em>Discovery Completed</em>.</td>
                    </tr>
                    <tr>
                      <td><code>05</code></td>
                      <td>
                        <strong style={{ color: '#0d9488' }}>05 – Discovery Completed</strong><br />
                        <code>discovery_completed</code>
                      </td>
                      <td>TVV đã hiểu mục tiêu, pain point, động lực, rào cản và tiêu chí ra quyết định của khách.</td>
                      <td>Hiểu nhu cầu thật để đưa ra khuyến nghị chính xác.</td>
                      <td>Làm rõ Goal – Pain – Motivation – Constraint – Decision Criteria – Decision Timeline.</td>
                      <td>Đủ cơ sở đưa ra khuyến nghị chương trình cụ thể → <em>Program Matched</em>.</td>
                    </tr>
                    <tr>
                      <td><code>06</code></td>
                      <td>
                        <strong style={{ color: '#0284c7' }}>06 – Program Matched</strong><br />
                        <code>program_matched</code>
                      </td>
                      <td>Đã xác định chương trình/phương án học phù hợp nhất với hồ sơ và mục tiêu khách.</td>
                      <td>Chuyển từ giới thiệu nhiều lựa chọn sang tư vấn giải pháp phù hợp.</td>
                      <td>Trình bày lý do khuyến nghị; dùng Program One-page, Brochure, Curriculum, Learning Journey, Comparison nếu cần.</td>
                      <td>Khách xác nhận chương trình phù hợp và đồng ý xem đề xuất chi tiết → <em>Proposal Sent</em>.</td>
                    </tr>
                    <tr>
                      <td><code>07</code></td>
                      <td>
                        <strong style={{ color: '#d97706' }}>07 – Proposal Sent</strong><br />
                        <code>proposal_sent</code>
                      </td>
                      <td>Khách đã nhận đề xuất tuyển sinh chính thức, gồm chương trình, học phí, chính sách, intake và next step.</td>
                      <td>Đưa khách sang trạng thái cân nhắc đăng ký thực tế.</td>
                      <td>Gửi proposal cá nhân hóa; giải thích giá trị; học phí; scholarship; payment plan; deadline; CTA.</td>
                      <td>Khách bắt đầu đánh giá, đặt câu hỏi chuyên sâu, so sánh hoặc cân nhắc điều kiện → <em>Evaluation / Objection</em>.</td>
                    </tr>
                    <tr>
                      <td><code>08</code></td>
                      <td>
                        <strong style={{ color: '#ea580c' }}>08 – Evaluation / Objection</strong><br />
                        <code>evaluation_objection</code>
                      </td>
                      <td>Khách đang đánh giá nghiêm túc và có các băn khoăn về giá, recognition, thời gian, chất lượng, hình thức học…</td>
                      <td>Xử lý đúng rào cản và giảm rủi ro cảm nhận.</td>
                      <td>Xác định đúng objection; chỉ gửi proof/tài liệu phù hợp; follow-up theo vấn đề cụ thể.</td>
                      <td>Khách thể hiện ý định nộp hồ sơ hoặc bắt đầu cung cấp hồ sơ → <em>Application Started</em>.</td>
                    </tr>
                    <tr>
                      <td><code>09</code></td>
                      <td>
                        <strong style={{ color: '#e11d48' }}>09 – Application Started</strong><br />
                        <code>application_started</code>
                      </td>
                      <td>Khách bắt đầu gửi CV, bằng, bảng điểm, passport hoặc điền form.</td>
                      <td>Giảm friction để hoàn thiện hồ sơ nhanh.</td>
                      <td>Gửi Application Checklist; hướng dẫn hồ sơ; deadline; nhắc tài liệu còn thiếu; hỗ trợ form.</td>
                      <td>Đủ bộ hồ sơ để chuyển xét tuyển → <em>Application Completed</em>.</td>
                    </tr>
                    <tr>
                      <td><code>10</code></td>
                      <td>
                        <strong style={{ color: '#4338ca' }}>10 – Application Completed</strong><br />
                        <code>application_completed</code>
                      </td>
                      <td>Hồ sơ đã đầy đủ và được chuyển sang quy trình xét tuyển.</td>
                      <td>Theo dõi xét tuyển và duy trì commitment.</td>
                      <td>Kiểm tra; submit admission; chuẩn bị interview nếu có; cập nhật tiến độ cho khách.</td>
                      <td>Trường/đơn vị có thẩm quyền xác nhận đủ điều kiện → <em>Admission Approved</em>.</td>
                    </tr>
                    <tr>
                      <td><code>11</code></td>
                      <td>
                        <strong style={{ color: '#65a30d' }}>11 – Admission Approved</strong><br />
                        <code>admission_approved</code>
                      </td>
                      <td>Khách đã được xác nhận đủ điều kiện nhập học/nhận Acceptance hoặc Conditional Acceptance.</td>
                      <td>Chuyển tâm lý từ “đang đăng ký” sang “đã được nhận”.</td>
                      <td>Gửi/giải thích kết quả admission; điều kiện còn lại; deadline; next step.</td>
                      <td>Khách xác nhận chấp nhận offer/scholarship/điều kiện nhập học → <em>Offer / Scholarship Accepted</em>.</td>
                    </tr>
                    <tr>
                      <td><code>12</code></td>
                      <td>
                        <strong style={{ color: '#16a34a' }}>12 – Offer / Scholarship Accepted</strong><br />
                        <code>offer_accepted</code>
                      </td>
                      <td>Khách đã xác nhận đồng ý chương trình, học phí, scholarship, intake và các điều kiện liên quan.</td>
                      <td>Tạo commitment rõ ràng trước bước tài chính.</td>
                      <td>Xác nhận bằng email/Zalo/form/hợp đồng; chốt payment plan; cung cấp hướng dẫn thanh toán.</td>
                      <td>Khách thực hiện giao dịch tài chính theo chính sách → <em>Deposit / Tuition Payment</em>.</td>
                    </tr>
                    <tr>
                      <td><code>13</code></td>
                      <td>
                        <strong style={{ color: '#059669' }}>13 – Deposit / Tuition Payment</strong><br />
                        <code>deposit_tuition_payment</code>
                      </td>
                      <td>Khách đã phát sinh Application Fee/Deposit/Registration Fee/Tuition theo quy định.</td>
                      <td>Hoàn tất nghĩa vụ tài chính để kích hoạt nhập học.</td>
                      <td>Theo dõi khoản thu; xác nhận chứng từ; nhắc phần còn lại; phối hợp Kế toán/Admissions.</td>
                      <td>Hoàn tất hồ sơ + nghĩa vụ tài chính + điều kiện kích hoạt intake → <em>Enrolled</em>.</td>
                    </tr>
                    <tr>
                      <td><code>14</code></td>
                      <td>
                        <strong style={{ color: '#db2777' }}>14 – Enrolled (Won)</strong><br />
                        <code>enrolled</code>
                      </td>
                      <td>Khách chính thức trở thành học viên và được xác nhận trong intake.</td>
                      <td>Handover sạch từ Sales sang Student Experience/Academic.</td>
                      <td>Bàn giao chương trình, intake, payment plan, scholarship, cam kết đặc biệt, quyền lợi, lưu ý học vụ và người phụ trách tiếp theo.</td>
                      <td>Kết thúc Pipeline tuyển sinh; chuyển sang Student Journey / Onboarding.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h2 id="crm-state-machine">Cơ Chế Trạng Thái &amp; Quản Trị Phễu CRM</h2>
              <p>
                Ngoài Stage hiện tại, hệ thống theo dõi ma trận quản trị đa chiều trên bảng <code>contacts</code> và <code>deals</code>:
              </p>
              <ul>
                <li><strong>Lead Status:</strong> <code>active</code> (Đang tư vấn tích cực), <code>nurture</code> (Tạm ngưng / Nuôi dưỡng dài hạn), <code>lost</code> (Mất deal / Không chốt được).</li>
                <li><strong>Lead Temperature:</strong> <code>hot</code> (Ưu tiên chốt gấp), <code>warm</code> (Ấm / Đang theo lộ trình), <code>low_intent</code> (Ý định thấp), <code>nurture</code> (Chăm sóc định kỳ).</li>
                <li><strong>Follow-up Cam Kết:</strong> Mỗi khách hàng bắt buộc phải có <code>next_action</code> (Hành động kế tiếp) và <code>next_followup_date</code> (Thời điểm liên hệ lại).</li>
                <li><strong>Dự Báo Doanh Thu (Revenue Forecast):</strong> Gắn liền với <code>expected_decision_date</code> (Ngày dự kiến quyết định) và <code>expected_intake</code> (Kỳ nhập học mục tiêu).</li>
                <li><strong>Báo Cáo Lý Do Rơi Rụng (Lost Reasons):</strong> Khi chuyển trạng thái <code>lost</code>, hệ thống bắt buộc lưu <code>lost_reason</code> và tự động ghi nhận <code>lost_stage_id</code> để thống kê tỷ lệ rơi rụng ở từng nấc thang tuyển sinh.</li>
              </ul>

              <h2 id="customer-360">Hồ Sơ Khách Hàng Toàn Diện (Customer Profile 360)</h2>
              <p>
                Drawer hồ sơ khách hàng (<code>CustomerProfileDrawer.tsx</code>) cung cấp góc nhìn 360 độ:
              </p>
              <ul>
                <li><strong>Thông tin định danh:</strong> Họ tên, SĐT, Email, Tỉnh thành, Nguồn chiến dịch, Điểm AI Gatekeeper.</li>
                <li><strong>Dòng thời gian tương tác (Timeline):</strong> Toàn bộ lịch sử cuộc gọi, tin nhắn, ghi chú, lịch hẹn tư vấn.</li>
                <li><strong>Lịch sử giao dịch:</strong> Danh sách Báo giá (Quotes), Đơn bán hàng (SO), Biên lai cọc (Deposits) và công nợ hiện tại.</li>
              </ul>
            </div>
          )
        }
      ]
    },

    // 4. PHÂN BỔ LEAD & ĐỀN BÙ FAIR-SHARE
    {
      id: 'crm-distribution',
      title: '4. Thuật Toán Phân Bổ Lead & Đền Bù Công Bằng (Fair-Share)',
      icon: RefreshCw,
      items: [
        {
          id: 'dist-round-robin',
          title: 'Thuật Toán Chia Round-Robin, Trọng Số Năng Lực & Phân Ca Trực',
          description: 'Quy tắc lọc danh sách tư vấn viên khả dụng, chia quay vòng theo trọng số và phân ca.',
          headings: [
            { id: 'round-robin-engine', text: 'Thuật Toán Round-Robin & Trọng Số Năng Lực' },
            { id: 'fair-share-audit', text: 'Quy Trình Đền Bù Lead Rác (Fair Share Audit)' },
            { id: 'sla-lead-recovery', text: 'Quy Tắc Thu Hồi & Tái Phân Bổ (Recovery)' }
          ],
          content: (
            <div className="doc-prose">
              <h2 id="round-robin-engine">Thuật Toán Round-Robin &amp; Trọng Số Năng Lực</h2>
              <p>
                Quy trình chia lead vận hành theo thuật toán quay vòng công bằng (Round-Robin) có áp dụng trọng số năng lực:
              </p>
              <ul>
                <li><strong>Lọc danh sách khả dụng (Active Pool):</strong> Chỉ tư vấn viên thỏa mãn cả 3 điều kiện: (1) Tài khoản đang kích hoạt, (2) Đang trong ca trực hợp lệ theo chấm công hoặc bảng xếp ca, (3) Chưa chạm ngưỡng giới hạn lead tối đa trong ngày (Cap Limit).</li>
                <li><strong>Trọng số phân bổ (Weight):</strong> TVV kỳ cựu hoặc đạt thành tích xuất sắc có thể được cấu hình trọng số <code>1.5x</code> hoặc <code>2.0x</code>, nghĩa là cứ mỗi vòng quay họ nhận được 2 lead thay vì 1 lead.</li>
              </ul>

              <h2 id="fair-share-audit">Quy Trình Đền Bù Lead Rác (Fair Share Audit)</h2>
              <p>
                Để đảm bảo công bằng khi nhân viên nhận phải lead rác (số thuê bao không liên lạc được, số ảo, nhầm máy):
              </p>
              <div className="doc-flow">
                <div className="doc-flow-step">1. TVV mở Ticket báo lỗi lead (bảng <code>data_reports</code>)</div>
                <div className="doc-flow-arrow">→</div>
                <div className="doc-flow-step">2. Quản lý đối soát nhật ký tương tác &amp; CRM Activities</div>
                <div className="doc-flow-arrow">→</div>
                <div className="doc-flow-step">3. Quản lý phê duyệt (Approved / Compensated)</div>
                <div className="doc-flow-arrow">→</div>
                <div className="doc-flow-step">4. Hệ thống tự động cộng 1 Credit bù data</div>
                <div className="doc-flow-arrow">→</div>
                <div className="doc-flow-step">5. Tự động ưu tiên cấp lead mới ở vòng chia Fair-Share kế tiếp</div>
              </div>

              <h2 id="sla-lead-recovery">Quy Tắc Thu Hồi &amp; Tái Phân Bổ (Recovery)</h2>
              <ul>
                <li><strong>Thu hồi theo SLA ngắn (SLA Timeout):</strong> Nếu tư vấn viên không thực hiện cuộc gọi hoặc cập nhật tương tác đầu tiên trong vòng <strong>30 phút</strong>, hệ thống tự động thu hồi lead và đẩy sang tư vấn viên tiếp theo.</li>
                <li><strong>Tái phân phối dài hạn (Re-assignment 3 - 6 tháng):</strong> Các khách hàng đã liên hệ nhưng không chốt đơn sau 90 ngày (Dead Deals) sẽ tự động được thu hồi về kho dữ liệu chung (Databank) để tái phân bổ cho nhân sự mới khai thác lại.</li>
              </ul>
            </div>
          )
        },
        {
          id: 'dist-ref-data',
          title: 'Chính Sách REF Data, Nguồn Giới Thiệu & Bảo Vệ Lead Tự Khai Thác',
          description: 'Quy chuẩn nguồn dữ liệu giới thiệu (REF), danh mục đối tác tier="referrer", cơ chế miễn trừ Round-Robin và bảo hộ 180 ngày.',
          headings: [
            { id: 'ref-sources-partners', text: 'Phân Loại Nguồn REF & Đối Tác Giới Thiệu (tier="referrer")' },
            { id: 'ref-protection-rights', text: 'Cơ Chế Bảo Vệ Quyền Sở Hữu Lead Tự Khai Thác' },
            { id: 'ref-180-days-lock', text: 'Quy Tắc Bảo Hộ 180 Ngày & Deduplication So Khớp SĐT/Email' },
            { id: 'advisory-locks-idempotency', text: 'Khóa Tranh Chấp Advisory Lock & Header X-Idempotency-Key' }
          ],
          content: (
            <div className="doc-prose">
              <h2 id="ref-sources-partners">Phân Loại Nguồn REF &amp; Đối Tác Giới Thiệu (tier="referrer")</h2>
              <p>
                Chương trình phát triển mạng lưới giới thiệu (Referral Program) là một trong những trụ cột tuyển sinh quan trọng nhất.
                Dữ liệu khách hàng có nguồn gốc giới thiệu được định danh qua điều kiện <code>source IN ('gioi_thieu', 'ref', 'referral', 'ca_nhan')</code>.
                Đồng thời, đối tác giới thiệu được quản lý trong bảng <code>companies</code> với phân hạng chuyên biệt <code>tier = 'referrer'</code>:
              </p>
              <table className="doc-table">
                <thead>
                  <tr>
                    <th style={{ width: '180px' }}>Nhóm đối tác REF</th>
                    <th style={{ width: '220px' }}>Đối tượng đại diện</th>
                    <th>Chính sách ghi nhận &amp; Hoa hồng thưởng</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Cựu Học Viên (Alumni)</strong></td>
                    <td>Học viên các khóa MBA/Thạc sĩ/Cử nhân đã tốt nghiệp</td>
                    <td>Nhận voucher giảm trừ học phí cho khóa học tiếp theo hoặc hoa hồng tiền mặt 3% - 5% giá trị hợp đồng khi giới thiệu bạn bè/đồng nghiệp nhập học thành công.</td>
                  </tr>
                  <tr>
                    <td><strong>Giảng Viên (Faculty REF)</strong></td>
                    <td>Giảng viên cơ hữu, Giảng viên thỉnh giảng quốc tế</td>
                    <td>Ghi nhận thù lao phát triển học thuật khi giới thiệu học viên đủ điều kiện nghiên cứu hoặc tham gia chương trình học bổng chuyên sâu.</td>
                  </tr>
                  <tr>
                    <td><strong>Doanh Nghiệp (B2B Partner)</strong></td>
                    <td>Tập đoàn, Hiệp hội doanh nghiệp, Đối tác đào tạo in-house</td>
                    <td>Ký kết hợp đồng hợp tác đào tạo doanh nghiệp, chiết khấu theo số lượng nhân sự đăng ký (Group Discount) từ 10% - 25%.</td>
                  </tr>
                  <tr>
                    <td><strong>Cộng Tác Viên (Affiliate / KOL)</strong></td>
                    <td>Chuyên gia tư vấn giáo dục độc lập, cựu lãnh đạo ban ngành</td>
                    <td>Gắn mã định danh REF riêng biệt, theo dõi tiến độ chuyển đổi theo thời gian thực qua Cổng đối tác (Referrer Portal).</td>
                  </tr>
                </tbody>
              </table>

              <h2 id="ref-protection-rights">Cơ Chế Bảo Vệ Quyền Sở Hữu Lead Tự Khai Thác</h2>
              <p>
                Để khuyến khích tư vấn viên chủ động tìm kiếm và mở rộng nguồn khách hàng cá nhân ngoài kho dữ liệu chung do Marketing cấp:
              </p>
              <ul>
                <li><strong>Miễn trừ hạn ngạch Round-Robin:</strong> Khi TVV nhập Lead có nguồn là <code>ca_nhan</code> hoặc <code>gioi_thieu</code>, Lead này <em>không bị tính trừ</em> vào số lượng Lead tối đa trong ngày (Cap Limit) của nhân sự đó.</li>
                <li><strong>Khóa quyền sở hữu độc quyền (Ownership Lock):</strong> Lead tự khai thác được gán cố định cho chính nhân sự tạo ra nó, tuyệt đối không bị thuật toán Round-Robin điều phối sang người khác.</li>
                <li><strong>Miễn trừ thu hồi SLA ngắn:</strong> Quy tắc tự động thu hồi sau 30 phút không liên hệ không áp dụng đối với Lead tự khai thác, giúp tư vấn viên có đủ thời gian xây dựng mối quan hệ tự nhiên với đối tác.</li>
              </ul>

              <h2 id="ref-180-days-lock">Quy Tắc Bảo Hộ 180 Ngày &amp; Deduplication So Khớp SĐT/Email</h2>
              <p>
                Để giải quyết triệt để tình trạng tranh chấp khách hàng giữa các tư vấn viên khi khách hàng đăng ký lại qua form tuyển sinh mới:
              </p>
              <div className="doc-flow">
                <div className="doc-flow-step">1. Chuẩn hóa SĐT (+84/0x) &amp; Email lowercase</div>
                <div className="doc-flow-arrow">→</div>
                <div className="doc-flow-step">2. Quét kiểm tra lịch sử trong cơ sở dữ liệu</div>
                <div className="doc-flow-arrow">→</div>
                <div className="doc-flow-step">3. Nếu &lt; 180 ngày &amp; Đang có TVV phụ trách: Khóa bảo hộ, gửi Noti về cho TVV cũ</div>
                <div className="doc-flow-arrow">→</div>
                <div className="doc-flow-step">4. Nếu &gt; 180 ngày hoặc Trạng thái Lost: Cho phép tái phân bổ Round-Robin</div>
              </div>
              <p>
                Quy tắc bảo hộ 180 ngày (6 tháng) đảm bảo công sức nuôi dưỡng khách hàng của tư vấn viên được tôn trọng tuyệt đối. Nếu khách hàng quay lại trong vòng 6 tháng,
                hệ thống tự động kích hoạt thông báo Zalo/Telegram nhắc nhở tư vấn viên đang phụ trách tiếp tục chăm sóc, không chia cho người mới.
              </p>

              <h2 id="advisory-locks-idempotency">Khóa Tranh Chấp Advisory Lock &amp; Header X-Idempotency-Key</h2>
              <p>
                Khi có hàng trăm lượt đăng ký nộp form cùng một thời điểm từ chiến dịch quảng cáo hoặc sự kiện Webinar:
              </p>
              <ul>
                <li><strong>MySQL Advisory Lock:</strong> Tiến trình phân bổ sử dụng khóa <code>GET_LOCK('lead_distribution_tenant_' . $tenantId, 5)</code> để đảm bảo chỉ có 1 tiến trình xử lý chia số tại một thời điểm, ngăn chặn hoàn toàn việc 2 nhân viên cùng nhận 1 lead.</li>
                <li><strong>Header X-Idempotency-Key:</strong> Các yêu cầu nhạy cảm như ghi nhận cọc, thanh toán hóa đơn hay tạo Lead từ Webhook đều hỗ trợ truyền mã UUID định danh <code>X-Idempotency-Key</code>. Nếu server phát hiện cùng một mã trong vòng 5 phút, hệ thống sẽ trả về kết quả đã ghi nhận trước đó thay vì thực thi hai lần.</li>
              </ul>
            </div>
          )
        }
      ]
    },

    // 5. BÁO GIÁ, ĐƠN HÀNG & TIỀN CỌC
    {
      id: 'quotes-deposits',
      title: '5. Báo Giá (Quotes), Đơn Bán Hàng (SO) & Tiền Cọc (Deposits)',
      icon: FileText,
      items: [
        {
          id: 'quotes-management',
          title: 'Bộ Máy Tạo Báo Giá (Quotes Engine) & Xuất File PDF',
          description: 'Cấu trúc tạo báo giá tuyển sinh đa khóa học, áp dụng chiết khấu đa tầng, tính thuế VAT và xuất PDF chuẩn.',
          headings: [
            { id: 'quotes-features', text: 'Tính Năng Bộ Máy Báo Giá' },
            { id: 'sales-order-conversion', text: 'Chuyển Đổi Sang Đơn Bán Hàng (Sales Orders)' }
          ],
          content: (
            <div className="doc-prose">
              <h2 id="quotes-features">Tính Năng Bộ Máy Báo Giá</h2>
              <p>
                Phân hệ Báo giá (<code>QuotesPage.tsx</code>) hỗ trợ tính toán phức hợp:
              </p>
              <ul>
                <li>Thêm nhiều khóa học / sản phẩm dịch vụ trong cùng 1 báo giá.</li>
                <li>Áp dụng chiết khấu linh hoạt: Chiết khấu theo phần trăm (%), chiết khấu tiền mặt cố định, hoặc mã voucher giảm giá.</li>
                <li>Tính thuế Giá trị gia tăng (VAT 8% hoặc 10%) tự động.</li>
                <li>Xuất file PDF báo giá chuyên nghiệp có đầy đủ logo, thông tin pháp nhân công ty, tài khoản ngân hàng và điều khoản thanh toán.</li>
              </ul>

              <h2 id="sales-order-conversion">Chuyển Đổi Sang Đơn Bán Hàng (Sales Orders)</h2>
              <p>
                Khi khách hàng đồng ý ký hợp đồng hoặc xác nhận nhập học:
              </p>
              <ul>
                <li>Một nút bấm chuyển đổi Báo giá thành <strong>Đơn Bán Hàng (Sales Order)</strong> chính thức.</li>
                <li>Khóa đơn giá, tự động chia các đợt thanh toán (Installments) và chuyển dữ liệu sang phân hệ Thu chi - Kế toán.</li>
              </ul>
            </div>
          )
        },
        {
          id: 'deposits-workflow',
          title: 'Quản Trị Tiền Cọc (Deposits), Biên Lai & Cấn Trừ Công Nợ',
          description: 'Quy trình thu cọc giữ chỗ, xuất biên nhận điện tử và tự động cấn trừ nghĩa vụ tài chính.',
          headings: [
            { id: 'deposit-receipts', text: 'Lập Biên Lai Thu Cọc Giữ Chỗ' },
            { id: 'deposit-offset', text: 'Cấn Trừ Công Nợ & Phê Duyệt Hoàn Cọc' }
          ],
          content: (
            <div className="doc-prose">
              <h2 id="deposit-receipts">Lập Biên Lai Thu Cọc Giữ Chỗ</h2>
              <p>
                Khi khách hàng chuyển khoản đặt cọc giữ học bổng hoặc chỗ học trong kỳ tuyển sinh:
              </p>
              <ul>
                <li>TVV lập phiếu thu cọc trên <code>DepositsPage.tsx</code> đính kèm ảnh ủy nhiệm chi ngân hàng.</li>
                <li>Kế toán đối soát sao kê tài khoản ngân hàng và bấm <strong>Xác nhận thực thu</strong>.</li>
                <li>Hệ thống gửi Email xác nhận thu tiền kèm biên lai thu tiền điện tử có mã tra cứu bảo mật.</li>
              </ul>

              <h2 id="deposit-offset">Cấn Trừ Công Nợ &amp; Phê Duyệt Hoàn Cọc</h2>
              <p>
                Khi phát sinh Đơn bán hàng chính thức:
              </p>
              <ul>
                <li>Khoản cọc được tự động cấn trừ trực tiếp vào Đợt thanh toán số 01 của Sales Order.</li>
                <li>Trường hợp khách hàng không đủ điều kiện nhập học và có nhu cầu xin hoàn cọc: Yêu cầu hoàn cọc phải đi qua quy trình phê duyệt đa cấp (Trưởng phòng Tuyển sinh $\rightarrow$ Kế toán trưởng $\rightarrow$ Giám đốc duyệt chi).</li>
              </ul>
            </div>
          )
        }
      ]
    },

    // 6. CHẤM CÔNG THÔNG MINH
    {
      id: 'attendance',
      title: '6. Chấm Công Thông Minh Đa Lớp (Smart Attendance)',
      icon: Clock,
      items: [
        {
          id: 'att-biometrics',
          title: 'Xác Thực Đa Lớp: GPS Geofencing, Wi-Fi BSSID & Selfie Biometrics',
          description: 'Giải pháp chấm công bảo mật cao, chống gian lận vị trí, xác thực khuôn mặt và tính toán đi muộn về sớm tự động.',
          headings: [
            { id: 'geofence-wifi', text: 'Xác Thực Tọa Độ GPS & BSSID Mạng Wi-Fi' },
            { id: 'selfie-verification', text: 'Chụp Ảnh Selfie & Nhận Diện Khuôn Mặt' },
            { id: 'late-early-rules', text: 'Thuật Toán Tính Đi Trễ, Về Sớm & Cập Nhật Công' },
            { id: 'penalty-rules', text: 'Khung Giờ Chuẩn & Chế Tài Khấu Trừ Công' }
          ],
          content: (
            <div className="doc-prose">
              <h2 id="geofence-wifi">Xác Thực Tọa Độ GPS &amp; BSSID Mạng Wi-Fi</h2>
              <p>
                Để chống việc chấm công hộ hoặc sử dụng phần mềm giả lập GPS (Fake GPS):
              </p>
              <ul>
                <li><strong>GPS Geofencing:</strong> Thiết bị nhân viên phải nằm trong bán kính cho phép (mặc định 100m) quanh tọa độ văn phòng công ty bằng công thức Haversine đối chiếu vĩ độ / kinh độ.</li>
                <li><strong>Khóa Wi-Fi BSSID / MAC Address:</strong> Hệ thống đối chiếu địa chỉ MAC phần cứng của Router Wi-Fi văn phòng mà thiết bị đang kết nối. Ngay cả khi fake GPS, nếu không bắt đúng sóng Wi-Fi cơ quan thì chấm công sẽ bị từ chối.</li>
              </ul>

              <h2 id="selfie-verification">Chụp Ảnh Selfie &amp; Nhận Diện Khuôn Mặt</h2>
              <p>
                Khi bấm Check-in / Check-out, ứng dụng kích hoạt camera trước yêu cầu chụp ảnh selfie thực thời:
              </p>
              <ul>
                <li>Ngăn chặn 100% tình trạng nhân viên gửi điện thoại nhờ đồng nghiệp chấm công hộ.</li>
                <li>Ảnh chụp chấm công được lưu trữ an toàn trên máy chủ (`selfie_url` / `checkout_selfie_url`) và hiển thị trực tiếp trên bảng công để Trưởng phòng và Nhân sự hậu kiểm bất kỳ lúc nào.</li>
              </ul>

              <h2 id="late-early-rules">Thuật Toán Tính Đi Trễ, Về Sớm &amp; Cập Nhật Công</h2>
              <p>
                Cơ chế tính toán phút đi trễ (<code>late_minutes</code>) và phút về sớm (<code>early_minutes</code>) được thực thi tự động trong <code>CheckInController.php</code>:
              </p>
              <div className="doc-code-box">
                <code>
                  // 1. Thuật toán tính phút đi trễ đầu ca:<br />
                  $lateMinutes = (int)ceil((strtotime($currentHM) - strtotime($workStartHM)) / 60);<br />
                  // Nếu check-in sau giờ nghỉ trưa: so khớp với giờ bắt đầu ca chiều ($afternoonStartHM)<br />
                  <br />
                  // 2. Thuật toán tính phút về sớm cuối ca:<br />
                  $earlyMinutes = (int)ceil((strtotime($workEndHM) - strtotime($currentOutHM)) / 60);
                </code>
              </div>
              <p>
                <strong>Quy trình "Cập nhật công" (Missing Check-in / Bổ sung công bù):</strong>
              </p>
              <ul>
                <li>Khi nhân viên quên chấm công trong ngày làm việc quá khứ, giao diện lịch hiển thị huy hiệu <em>"Cập nhật công"</em>.</li>
                <li>Nhân viên bắt buộc nhập lý do giải trình chi tiết kèm giờ vào / giờ ra thực tế đề xuất.</li>
                <li>Hệ thống tạo bản ghi có trạng thái <code>pending_approval</code> và gửi thông báo tới Quản lý trực tiếp (Manager) duyệt Cấp 1 trước khi tính công.</li>
                <li><strong>Trường hợp đặc biệt:</strong> Nếu Trưởng phòng / Quản lý / Leader tự tạo đơn bổ sung công cho chính mình, hệ thống tự động duyệt (<code>approved</code>) và gán <code>late_minutes = 0</code> nhằm tránh tình trạng nghẽn đơn tự phê duyệt.</li>
              </ul>

              <h2 id="penalty-rules">Khung Giờ Chuẩn &amp; Chế Tài Khấu Trừ Công</h2>
              <div style={{ overflowX: 'auto', margin: '14px 0', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <table className="doc-table" style={{ margin: 0, fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-secondary)' }}>
                      <th>Khung giờ làm việc</th>
                      <th>Số phút đi muộn / về sớm</th>
                      <th>Mức chế tài xử lý</th>
                      <th>Quy tắc công lương tương ứng</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Ca sáng:</strong> 08:00 - 12:00<br /><strong>Ca chiều:</strong> 13:30 - 17:30</td>
                      <td>1 - 15 phút</td>
                      <td>Nhắc nhở / Cảnh cáo hệ thống</td>
                      <td>Ghi nhận số phút trễ vào bảng công; bảo lưu nguyên vẹn 1.0 ngày công chuẩn.</td>
                    </tr>
                    <tr>
                      <td>Theo lịch làm việc chi nhánh</td>
                      <td>16 - 60 phút</td>
                      <td>Khấu trừ 0.25 ngày công</td>
                      <td>Tính 0.75 ngày công thực tế; trừ tiền phạt trễ trong bảng lương tháng.</td>
                    </tr>
                    <tr>
                      <td>Theo lịch làm việc chi nhánh</td>
                      <td>Trên 60 phút</td>
                      <td>Tính nửa ngày công (0.5 công)</td>
                      <td>Yêu cầu nộp đơn xin đi muộn bù giờ hoặc chuyển sang nghỉ nửa ngày phép năm.</td>
                    </tr>
                    <tr>
                      <td>Toàn bộ các ca</td>
                      <td>Quên check-in / check-out</td>
                      <td>Ghi nhận vắng mặt tạm thời</td>
                      <td>Khóa tính công ngày đó cho đến khi đơn "Cập nhật công" được Quản lý phê duyệt.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
        },
        {
          id: 'att-reminders',
          title: 'Hệ Thống Tự Động Nhắc Nhở Công & Tiến Trình Tự Động Hóa (Crons)',
          description: 'Cơ chế kích hoạt thông báo tự động trước ca, sau ca, phát hiện quên check-in/out, nhắc duyệt đơn và điều phối tác vụ qua Master Cron.',
          headings: [
            { id: 'attendance-reminders', text: 'Nhắc Chấm Công Vào Ca & Quên Check-in' },
            { id: 'checkout-reminders', text: 'Nhắc Chấm Công Ra Ca & Quên Check-out' },
            { id: 'approval-reminders', text: 'Tự Động Nhắc Quản Lý Duyệt Đơn Tồn Đọng' },
            { id: 'cron-ecosystem', text: 'Hệ Thống Tự Động Nhắc Nhở Khác (Cọc, Học Vụ, Báo Cáo Định Kỳ)' }
          ],
          content: (
            <div className="doc-prose">
              <h2 id="attendance-reminders">Nhắc Chấm Công Vào Ca &amp; Quên Check-in</h2>
              <p>
                Nhằm triệt tiêu tình trạng nhân viên có mặt tại cơ quan nhưng quên check-in dẫn đến mất quyền lợi công lương:
              </p>
              <ul>
                <li><strong>Nhắc vào ca (<code>ATTENDANCE_REMINDER</code>):</strong> Kích hoạt tự động trước giờ bắt đầu ca làm việc 15 phút (ví dụ: 07:45 sáng hoặc 13:15 chiều). Thông báo đẩy tức thì qua In-App Banner, Web Notification và tin nhắn Zalo Bot tới từng nhân viên có lịch làm việc trong ngày.</li>
                <li><strong>Cảnh báo quên check-in (<code>CHECKIN_MISSING_REMINDER</code>):</strong> Sau giờ vào ca 15 phút (ví dụ: 08:15 sáng), hệ thống quét toàn bộ danh sách nhân sự trực ca. Những nhân sự chưa có bản ghi check-in hợp lệ sẽ nhận cảnh báo khẩn cấp nhắc nhở thực hiện chấm công ngay lập tức để giảm thiểu số phút đi muộn.</li>
                <li><strong>Ghi nhận đi trễ (<code>CHECKIN_LATE</code>):</strong> Khi nhân sự check-in sau khung giờ quy định, hệ thống tự động bắn thông báo xác nhận số phút trễ và hướng dẫn làm giải trình nếu có lý do chính đáng.</li>
              </ul>

              <h2 id="checkout-reminders">Nhắc Chấm Công Ra Ca &amp; Quên Check-out</h2>
              <p>
                Đảm bảo ghi nhận đầy đủ thời gian cống hiến thực tế và hỗ trợ tính toán làm thêm giờ (OT):
              </p>
              <ul>
                <li><strong>Nhắc ra ca (<code>CHECKOUT_REMINDER</code>):</strong> Đúng thời điểm kết thúc ca làm việc (ví dụ: 17:30), hệ thống gửi thông báo nhắc nhở nhân viên thực hiện chụp ảnh selfie check-out trước khi rời cơ quan.</li>
                <li><strong>Cảnh báo quên check-out (<code>CHECKOUT_MISSING_REMINDER</code>):</strong> Sau giờ tan ca từ 30 đến 60 phút, nếu nhân sự đã có bản ghi check-in sáng nhưng chưa có bản ghi check-out chiều, hệ thống gửi thông báo nhắc nhở khẩn cấp để nhân sự kịp thời ghi nhận trước khi phiên làm việc trong ngày bị khóa.</li>
              </ul>

              <h2 id="approval-reminders">Tự Động Nhắc Quản Lý Duyệt Đơn Tồn Đọng</h2>
              <p>
                Để chống nghẽn quy trình nội bộ và đảm bảo SLA phê duyệt đơn từ:
              </p>
              <ul>
                <li><strong>Nhắc duyệt định kỳ (<code>APPROVAL_REMINDER</code>):</strong> Tiến trình ngầm định kỳ quét toàn bộ các đơn xin nghỉ phép (Leaves), đơn tạm ứng lương (Advances), đơn cập nhật công bù (Supplementary Check-in), đề xuất chi phí và ticket bồi hoàn Lead đang ở trạng thái <code>pending</code> hoặc <code>pending_approval</code>.</li>
                <li>Nếu đơn tồn đọng quá 4 giờ làm việc chưa được xử lý, hệ thống tự động gửi thông báo nhắc nhở tới Trưởng nhóm (Manager Cấp 1).</li>
                <li>Nếu tồn đọng quá 24 giờ, hệ thống tự động leo thang (Escalate) thông báo tới Trưởng phòng Nhân sự và Ban Giám đốc.</li>
              </ul>

              <h2 id="cron-ecosystem">Hệ Thống Tự Động Nhắc Nhở Khác (Cọc, Học Vụ, Báo Cáo Định Kỳ)</h2>
              <p>
                Toàn bộ các tác vụ tự động hóa được điều phối bởi tiến trình <strong>Master Cron Orchestrator</strong> (<code>backend/cron_master.php</code>) chạy mỗi 1 phút trên máy chủ với cơ chế khóa tệp chống xung đột tài nguyên:
              </p>

              <div style={{ overflowX: 'auto', margin: '14px 0', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <table className="doc-table" style={{ margin: 0, fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-secondary)' }}>
                      <th>Hạng mục tự động hóa</th>
                      <th>Tiến trình thực thi</th>
                      <th>Chu kỳ kích hoạt</th>
                      <th>Mô tả chi tiết tác vụ &amp; Đối tượng thụ hưởng</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Nhắc nộp tiền cọc &amp; công nợ</strong></td>
                      <td><code>cron_deposit_reminders.php</code></td>
                      <td>Hàng ngày (08:00 sáng)</td>
                      <td>Tự động quét các hợp đồng đặt cọc giữ chỗ và đợt thanh toán học phí sắp đến hạn (trước 3 ngày, trước 1 ngày). Gửi thông báo nhắc nhở tới Tư vấn viên phụ trách và Kế toán thu tiền.</td>
                    </tr>
                    <tr>
                      <td><strong>Nhắc lịch đào tạo &amp; học vụ</strong></td>
                      <td><code>cron_academic_reminders.php</code></td>
                      <td>Trước buổi học 30 phút</td>
                      <td>Nhắc Giảng viên điểm danh buổi học, kiểm tra sĩ số lớp, gửi thông báo lịch thi và lịch bảo vệ luận văn/đồ án tốt nghiệp cho học viên.</td>
                    </tr>
                    <tr>
                      <td><strong>Nhắc nhiệm vụ lặp lại</strong></td>
                      <td><code>cron_recurring_tasks.php</code></td>
                      <td>00:05 mỗi ngày</td>
                      <td>Tự động sinh các đầu việc định kỳ (Daily/Weekly checklist) từ quy trình mẫu, phân công nhân sự và gửi thông báo nhắc hạn hoàn thành (Deadline).</td>
                    </tr>
                    <tr>
                      <td><strong>Báo cáo tự động định kỳ</strong></td>
                      <td><code>cron_daily_report.php</code><br /><code>cron_weekly_report.php</code><br /><code>cron_monthly_report.php</code></td>
                      <td>Cuối ngày (22:00)<br />Chủ Nhật (20:00)<br />Ngày 01 đầu tháng</td>
                      <td>Tổng hợp số liệu doanh thu, chi phí, tỷ lệ chuyển đổi Lead, tỷ lệ chuyên cần và số phút đi muộn về sớm gửi trực tiếp vào Telegram/Zalo Ban Giám Đốc.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
        }
      ]
    },

    // 7. NHÂN SỰ & TÍNH LƯƠNG TỰ ĐỘNG
    {
      id: 'hrm-payroll',
      title: '7. Quản Trị Nhân Sự, Bảng Xếp Ca & Lương Tự Động (HRM & Payroll)',
      icon: Users,
      items: [
        {
          id: 'hrm-shifts-leaves',
          title: 'Hồ Sơ Nhân Sự, Bảng Xếp Ca (Shifts) & Đơn Từ Điện Tử',
          description: 'Quản lý hợp đồng lao động, ca làm việc linh hoạt và phê duyệt đơn nghỉ phép / WFH / OT trực tuyến.',
          headings: [
            { id: 'employee-records', text: 'Quản Lý Hồ Sơ & Hợp Đồng Nhân Sự' },
            { id: 'shift-scheduler', text: 'Bảng Xếp Ca (Shift Scheduler)' },
            { id: 'leave-workflow', text: 'Hệ Thống Đơn Từ Điện Tử (Nghỉ Phép / OT / WFH)' }
          ],
          content: (
            <div className="doc-prose">
              <h2 id="employee-records">Quản Lý Hồ Sơ &amp; Hợp Đồng Nhân Sự</h2>
              <p>
                Phân hệ HRM lưu trữ thông tin nhân sự toàn diện: Mã nhân viên, Chức vụ, Phòng ban, Cấp bậc, Ngày bắt đầu làm việc, Loại hợp đồng lao động, Số người phụ thuộc giảm trừ gia cảnh và Thông tin tài khoản nhận lương.
              </p>

              <h2 id="shift-scheduler">Bảng Xếp Ca (Shift Scheduler)</h2>
              <p>
                Hỗ trợ xếp ca linh hoạt cho các phòng ban đặc thù:
              </p>
              <ul>
                <li>Ca hành chính (08:00 - 17:30).</li>
                <li>Ca trực tư vấn tối và cuối tuần (xoay ca cho đội ngũ Tuyển sinh).</li>
                <li>Ca trực hỗ trợ lớp học và trợ giảng học vụ.</li>
              </ul>

              <h2 id="leave-workflow">Hệ Thống Đơn Từ Điện Tử (Nghỉ Phép / OT / WFH)</h2>
              <p>
                Nhân viên gửi đơn trực tuyến trên hệ thống:
              </p>
              <ul>
                <li>Tự động kiểm tra số ngày phép năm còn lại (Annual Leave Balance).</li>
                <li>Chuyển thông báo duyệt tới Quản lý trực tiếp. Khi đơn được duyệt, hệ thống tự động gạch công hợp lệ trên bảng chấm công mà không cần HR nhập tay.</li>
              </ul>
            </div>
          )
        },
        {
          id: 'hrm-payroll-engine',
          title: 'Bộ Máy Tính Lương Tự Động, Ký Số Phiếu Lương & Khiếu Nại Lương',
          description: 'Công thức tính toán lương thời gian, hoa hồng doanh số, bảo hiểm bắt buộc, chữ ký điện tử số và quy trình giải quyết khiếu nại phiếu lương.',
          headings: [
            { id: 'payroll-formula', text: 'Công Thức Tính Lương Toàn Diện' },
            { id: 'payroll-lifecycle', text: 'Vòng Đời 4 Trạng Thái Của Phiếu Lương' },
            { id: 'payslip-digital-signing', text: 'Ký Nhận Phiếu Lương Số (Digital Signature Canvas)' },
            { id: 'payslip-dispute-resolution', text: 'Trao Đổi Khiếu Nại & Điều Chỉnh Phiếu Lương' }
          ],
          content: (
            <div className="doc-prose">
              <h2 id="payroll-formula">Công Thức Tính Lương Toàn Diện</h2>
              <div className="doc-code-box">
                <code>
                  Lương Thực Lĩnh = (Lương Cơ Bản / Ngày Công Chuẩn) * Ngày Công Thực Tế<br />
                  &nbsp;&nbsp;+ Phụ Cấp (Ăn trưa + Xăng xe + Trách nhiệm + Thâm niên)<br />
                  &nbsp;&nbsp;+ Hoa Hồng Doanh Số Tuyển Sinh (KPI Commission từ Đơn Hàng Thành Công)<br />
                  &nbsp;&nbsp;+ Thù Lao Giảng Dạy &amp; Phụ Cấp Giờ Dạy (Dành cho Giảng viên)<br />
                  &nbsp;&nbsp;- Trích Đóng Bảo Hiểm Bắt Buộc: BHXH (8%) + BHYT (1.5%) + BHTN (1%) = 10.5%<br />
                  &nbsp;&nbsp;- Thuế Thu Nhập Cá Nhân (TNCN lũy tiến từng phần theo luật định)<br />
                  &nbsp;&nbsp;- Khấu Trừ Phạt Đi Muộn / Về Sớm Trong Tháng (lateness_penalty)<br />
                  &nbsp;&nbsp;- Khấu Trừ Tạm Ứng Đã Giải Ngân (advance_deduction)
                </code>
              </div>

              <h2 id="payroll-lifecycle">Vòng Đời 4 Trạng Thái Của Phiếu Lương</h2>
              <p>
                Mọi phiếu lương trong bảng <code>monthly_payslips</code> đều trải qua quy trình kiểm soát chặt chẽ với 4 trạng thái nối tiếp:
              </p>
              <div style={{ overflowX: 'auto', margin: '14px 0', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <table className="doc-table" style={{ margin: 0, fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-secondary)' }}>
                      <th>Trạng thái (Status)</th>
                      <th>Ý nghĩa nghiệp vụ</th>
                      <th>Người thực hiện &amp; Thao tác</th>
                      <th>Bảo mật &amp; Quyền truy cập</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code style={{ color: '#9ca3af', fontWeight: 700 }}>draft</code></td>
                      <td>Bản nháp nội bộ</td>
                      <td>Phòng Nhân sự &amp; Kế toán tính toán từ dữ liệu chấm công và hoa hồng CRM.</td>
                      <td>Chỉ HR và Kế toán nhìn thấy; nhân viên chưa thể xem phiếu lương này.</td>
                    </tr>
                    <tr>
                      <td><code style={{ color: '#3b82f6', fontWeight: 700 }}>sent</code></td>
                      <td>Đã phát hành tới nhân viên</td>
                      <td>HR bấm <strong>Gửi phiếu lương</strong> (<code>sendPayslips</code>) cho từng cá nhân hoặc toàn công ty.</td>
                      <td>Gửi thông báo <code>HRM_PAYSLIP_PUBLISHED</code>, mở quyền cho nhân viên vào xem tại <code>/my-payslips</code>.</td>
                    </tr>
                    <tr>
                      <td><code style={{ color: '#10b981', fontWeight: 700 }}>confirmed</code></td>
                      <td>Đã ký nhận xác nhận</td>
                      <td>Nhân viên kiểm tra số liệu chính xác và thực hiện ký số điện tử trên Canvas.</td>
                      <td>Lưu trữ URL chữ ký số (<code>signature_url</code>) và thời điểm ký (<code>confirmed_at = NOW()</code>). Chống chối bỏ.</td>
                    </tr>
                    <tr>
                      <td><code style={{ color: '#ef4444', fontWeight: 700 }}>disputed</code></td>
                      <td>Có khiếu nại / yêu cầu điều chỉnh</td>
                      <td>Nhân viên phát hiện sai lệch số liệu và bấm nút <em>"Khiếu nại / Phản hồi"</em> kèm ghi chú giải trình.</td>
                      <td>Bắn thông báo khẩn <code>HRM_PAYSLIP_DISPUTED</code> tới HR &amp; Kế toán để rà soát, chỉnh sửa và phát hành lại.</td>
                    </tr>
                    <tr>
                      <td><code style={{ color: '#7c3aed', fontWeight: 700 }}>locked</code></td>
                      <td>Đã khóa kỳ lương vĩnh viễn</td>
                      <td>Ban Giám đốc &amp; Kế toán trưởng kích hoạt lệnh <code>lockPayroll</code> sau khi tất cả khiếu nại đã được giải quyết.</td>
                      <td>Toàn bộ bảng công và phiếu lương chuyển sang chế độ chỉ đọc (Read-only); tuyệt đối chống sửa đổi hồi tố.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h2 id="payslip-digital-signing">Ký Nhận Phiếu Lương Số (Digital Signature Canvas)</h2>
              <p>
                Để hiện đại hóa quy trình ký nhận lương không cần giấy tờ mà vẫn đảm bảo tính pháp lý nội bộ:
              </p>
              <ul>
                <li>Tại trang <code>/my-payslips</code>, sau khi đối soát đầy đủ các mục thu nhập và khấu trừ, nhân viên bấm <strong>Ký xác nhận phiếu lương</strong>.</li>
                <li>Ứng dụng mở khung vẽ chữ ký cảm ứng chuẩn HTML5 Canvas hỗ trợ cả chuột trên máy tính lẫn thao tác vuốt chạm tay trên màn hình điện thoại.</li>
                <li>Khi bấm <em>"Xác nhận &amp; Ký số"</em>: Hệ thống mã hóa ảnh chữ ký, lưu đường dẫn vào trường <code>signature_url</code>, ghi nhận thời điểm chính xác đến từng giây vào <code>confirmed_at = NOW()</code> và chuyển trạng thái phiếu lương thành <code>confirmed</code>.</li>
                <li>Hệ thống tự động kích hoạt thông báo <code>HRM_PAYSLIP_CONFIRMED</code> gửi về hòm thư bộ phận Nhân sự và Kế toán để lưu hồ sơ đối soát chi trả.</li>
              </ul>

              <h2 id="payslip-dispute-resolution">Trao Đổi Khiếu Nại &amp; Điều Chỉnh Phiếu Lương</h2>
              <p>
                Quy trình xử lý thấu đáo mọi vướng mắc công lương giữa người lao động và doanh nghiệp:
              </p>
              <ul>
                <li><strong>Gửi khiếu nại trực tuyến:</strong> Nếu nhân viên phát hiện sai sót (ví dụ: ngày làm việc thực tế bị tính thiếu do quên bổ sung công, thiếu hoa hồng từ đơn hàng SO-012 đã thanh toán, tính nhầm mức giảm trừ gia cảnh), nhân viên bấm <strong>"Khiếu nại / Phản hồi"</strong> ngay trên phiếu lương.</li>
                <li><strong>Ghi nhận nguyên nhân:</strong> Nhân viên nhập chi tiết lý do và đính kèm bằng chứng giải trình trong modal đối thoại. Hệ thống gọi API <code>confirmPayslip</code> với tham số <code>action: 'dispute'</code>, cập nhật trạng thái phiếu lương sang <code>disputed</code> và lưu nội dung vào trường <code>note</code>.</li>
                <li><strong>Cảnh báo khẩn cấp tới HR:</strong> Sự kiện <code>HRM_PAYSLIP_DISPUTED</code> được phát đi, thông báo ngay lập tức cho Chuyên viên Nhân sự và Kế toán trưởng kèm theo họ tên nhân viên và nội dung khiếu nại.</li>
                <li><strong>Đối soát &amp; Tái phát hành:</strong> Phòng Nhân sự và Kế toán kiểm tra lại nhật ký chấm công (<code>check_ins</code>) và đơn hàng CRM. Sau khi điều chỉnh số liệu đúng, HR bấm nút phát hành lại (chuyển trạng thái về <code>sent</code>) để nhân viên xem lại và thực hiện ký số xác nhận.</li>
              </ul>
            </div>
          )
        }
      ]
    },

    // 8. PHÊ DUYỆT ĐA CẤP
    {
      id: 'approvals',
      title: '8. Phê Duyệt Đa Cấp & Luồng Ký Duyệt Số (Approvals)',
      icon: ShieldCheck,
      items: [
        {
          id: 'appr-matrix',
          title: 'Ma Trận Phê Duyệt Theo Chức Vụ & Audit Trail Bất Biến',
          description: 'Quy trình kiểm soát đa tầng đối với chi tiêu, đề xuất mua sắm, bồi hoàn data và đơn từ.',
          headings: [
            { id: 'approval-hierarchy', text: 'Ma Trận Phê Duyệt Động' },
            { id: 'immutable-audit', text: 'Nhật Ký Phê Duyệt Bất Biến (Immutable Audit Trail)' }
          ],
          content: (
            <div className="doc-prose">
              <h2 id="approval-hierarchy">Ma Trận Phê Duyệt Động</h2>
              <p>
                Phân hệ Duyệt (<code>Approvals.tsx</code>) tự động điều hướng đơn từ theo cấp bậc thẩm quyền:
              </p>
              <table className="doc-table">
                <thead>
                  <tr>
                    <th style={{ width: '220px' }}>Loại Đơn / Đề Xuất</th>
                    <th style={{ width: '260px' }}>Cấp Phê Duyệt Thứ 1</th>
                    <th>Cấp Phê Duyệt Thứ 2 (Cuối)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Đơn Nghỉ Phép / OT / WFH</strong></td>
                    <td>Trưởng Nhóm / Quản Lý Trực Tiếp</td>
                    <td>Trưởng Phòng Nhân Sự (HR Manager)</td>
                  </tr>
                  <tr>
                    <td><strong>Đơn Đề Nghị Chi Tiền (&lt; 20 triệu)</strong></td>
                    <td>Trưởng Bộ Phận</td>
                    <td>Kế Toán Trưởng</td>
                  </tr>
                  <tr>
                    <td><strong>Đơn Mua Sắm / Chi Lớn (≥ 20 triệu)</strong></td>
                    <td>Kế Toán Trưởng</td>
                    <td>Ban Giám Đốc (Director)</td>
                  </tr>
                  <tr>
                    <td><strong>Ticket Đền Bù Lead Rác</strong></td>
                    <td>Trưởng Phòng Kinh Doanh</td>
                    <td>Hệ thống tự động cộng credit bù</td>
                  </tr>
                </tbody>
              </table>

              <h2 id="immutable-audit">Nhật Ký Phê Duyệt Bất Biến (Immutable Audit Trail)</h2>
              <p>
                Mọi hành động Bấm Duyệt, Từ Chối hoặc Yêu Cầu Bổ Sung Hồ Sơ đều được ghi nhận vào bảng <code>approval_logs</code>: Lưu trữ chính xác User ID, Thời điểm chính xác đến từng giây, Địa chỉ IP và Ghi chú giải trình lý do từ chối. Không một ai (kể cả quản trị viên hệ thống) có quyền sửa đổi hay xóa nhật ký này.
              </p>
            </div>
          )
        }
      ]
    },

    // 9. CHI PHÍ & NHÀ CUNG CẤP
    {
      id: 'expenses-suppliers',
      title: '9. Chi Phí, Mua Sắm & Quản Lý Nhà Cung Cấp (Suppliers)',
      icon: CreditCard,
      items: [
        {
          id: 'exp-management',
          title: 'Đơn Đề Nghị Thanh Toán, Tạm Ứng & Hồ Sơ Nhà Cung Cấp',
          description: 'Quản lý tạm ứng, thanh toán chi phí hoạt động, quản lý nhà cung cấp và đối soát công nợ phải trả.',
          headings: [
            { id: 'expense-advances', text: 'Quy Trình Tạm Ứng & Hoàn Ứng Chi Phí' },
            { id: 'supplier-portfolio', text: 'Quản Lý Hồ Sơ Nhà Cung Cấp (Suppliers)' }
          ],
          content: (
            <div className="doc-prose">
              <h2 id="expense-advances">Quy Trình Tạm Ứng &amp; Hoàn Ứng Chi Phí</h2>
              <p>
                Nhân viên tổ chức sự kiện hoặc đi công tác:
              </p>
              <ul>
                <li>Lập đơn <strong>Tạm ứng kinh phí</strong> trình Giám đốc duyệt và Kế toán chi tiền.</li>
                <li>Sau khi hoàn tất công việc, tạo hồ sơ <strong>Hoàn ứng</strong>: Tải lên hình ảnh hóa đơn VAT, chứng từ hợp lệ để cấn trừ tạm ứng. Phần dư hoàn lại quỹ công ty, phần thiếu kế toán thanh toán bổ sung.</li>
              </ul>

              <h2 id="supplier-portfolio">Quản Lý Hồ Sơ Nhà Cung Cấp (Suppliers)</h2>
              <p>
                Phân hệ Đối tác (<code>SuppliersPage.tsx</code>) lưu trữ thông tin:
              </p>
              <ul>
                <li>Tên doanh nghiệp, Mã số thuế, Địa chỉ, Người liên hệ đại diện.</li>
                <li>Thông tin tài khoản ngân hàng thụ hưởng phục vụ lệnh chuyển tiền tự động.</li>
                <li>Lịch sử các Đơn đặt hàng mua (Purchase Orders) và tiến độ thanh toán công nợ.</li>
              </ul>
            </div>
          )
        }
      ]
    },

    // 10. KHO KHÓA HỌC & HỌC PHÍ
    {
      id: 'products-tuition',
      title: '10. Kho Khóa Học, Gói Dịch Vụ & Học Phí (Products & Inventory)',
      icon: Package,
      items: [
        {
          id: 'prod-catalog-fees',
          title: 'Danh Mục Chương Trình Đào Tạo, Biểu Phí & Quản Lý Học Liệu',
          description: 'Cấu hình học phí theo tín chỉ/học phần, chính sách học bổng và quản lý tồn kho giáo trình quà tặng.',
          headings: [
            { id: 'course-catalog', text: 'Danh Mục Chương Trình Đào Tạo' },
            { id: 'tuition-scholarship', text: 'Chính Sách Biểu Phí & Học Bổng' },
            { id: 'inventory-materials', text: 'Quản Lý Tồn Kho Giáo Trình &amp; Học Liệu' }
          ],
          content: (
            <div className="doc-prose">
              <h2 id="course-catalog">Danh Mục Chương Trình Đào Tạo</h2>
              <p>
                Hệ thống chuẩn hóa các ngành đào tạo: Cử nhân quốc tế (BBA), Thạc sĩ điều hành cao cấp (EMBA/MBA), Các chứng chỉ quản trị chuyên sâu và Khóa đào tạo doanh nghiệp (B2B In-house Training).
              </p>

              <h2 id="tuition-scholarship">Chính Sách Biểu Phí &amp; Học Bổng</h2>
              <p>
                Cấu hình học phí linh hoạt:
              </p>
              <ul>
                <li>Biểu phí tiêu chuẩn trọn khóa hoặc đóng theo từng kỳ học (Semester/Term).</li>
                <li>Ma trận học bổng khuyến học (Scholarship 10%, 20%, 50% hoặc Học bổng Hiệu trưởng) được cài đặt điều kiện tự động áp dụng khi tạo Báo giá.</li>
              </ul>

              <h2 id="inventory-materials">Quản Lý Tồn Kho Giáo Trình &amp; Học Liệu</h2>
              <p>
                Theo dõi số lượng tồn kho của giáo trình học tập, tài liệu đào tạo, balo, đồng phục và quà tặng tuyển sinh tại từng kho cơ sở; tự động cảnh báo khi tồn kho chạm ngưỡng tối thiểu.
              </p>
            </div>
          )
        }
      ]
    },

    // 11. DỰ ÁN & WORKSPACE TASKS
    {
      id: 'projects-tasks',
      title: '11. Quản Lý Dự Án & Không Gian Làm Việc (Projects & Tasks)',
      icon: Briefcase,
      items: [
        {
          id: 'proj-kanban-workflow',
          title: 'Mô Hình Kanban Board, Phân Công Nhiệm Vụ & Tiến Độ Dự Án',
          description: 'Quản lý các chiến dịch tuyển sinh, sự kiện khai giảng và công việc phòng ban theo phương pháp Agile.',
          headings: [
            { id: 'kanban-board', text: 'Bảng Điều Khiển Kanban & Gantt Timeline' },
            { id: 'task-details', text: 'Chi Tiết Nhiệm Vụ, Checklist &amp; File Đính Kèm' }
          ],
          content: (
            <div className="doc-prose">
              <h2 id="kanban-board">Bảng Điều Khiển Kanban &amp; Gantt Timeline</h2>
              <p>
                Phân hệ Dự án (<code>ProjectsPage.tsx</code>) cung cấp giao diện trực quan:
              </p>
              <ul>
                <li>Kéo thả thẻ nhiệm vụ qua các cột trạng thái: <em>Cần Làm (To Do)</em>, <em>Đang Thực Hiện (In Progress)</em>, <em>Chờ Phê Duyệt (Review)</em>, <em>Hoàn Thành (Done)</em>.</li>
                <li>Biểu đồ Gantt theo dõi tiến độ tổng thể của các chiến dịch tuyển sinh trọng điểm.</li>
              </ul>

              <h2 id="task-details">Chi Tiết Nhiệm Vụ, Checklist &amp; File Đính Kèm</h2>
              <p>
                Drawer nhiệm vụ (<code>WorkspaceTaskDrawer.tsx</code>):
              </p>
              <ul>
                <li>Giao việc cho người phụ trách chính (Assignee) và các thành viên phối hợp (Co-assignees).</li>
                <li>Thiết lập ngày bắt đầu, hạn chót (Deadline) và độ ưu tiên (Urgent, High, Medium, Low).</li>
                <li>Danh mục checklist đầu việc con cần hoàn thành và không gian trao đổi bình luận real-time.</li>
              </ul>
            </div>
          )
        }
      ]
    },

    // 12. THỜI KHÓA BIỂU & TRA CỨU PUBLIC
    {
      id: 'academic-schedule',
      title: '12. Thời Khóa Biểu & Tra Cứu Công Khai (Academic Portals)',
      icon: GraduationCap,
      items: [
        {
          id: 'acad-portals',
          title: 'Lịch Đào Tạo Tổng Thể & 3 Cổng Tra Cứu Public Tokenized',
          description: 'Điều phối phòng học, giảng viên và cung cấp đường dẫn tra cứu công khai an toàn không cần đăng nhập.',
          headings: [
            { id: 'master-schedule', text: 'Điều Phối Thời Khóa Biểu & Phòng Học' },
            { id: 'public-links', text: '3 Cổng Tra Cứu Bảo Mật Không Cần Đăng Nhập' }
          ],
          content: (
            <div className="doc-prose">
              <h2 id="master-schedule">Điều Phối Thời Khóa Biểu &amp; Phòng Học</h2>
              <p>
                Phân hệ Lịch đào tạo (<code>InternalSchedulePage.tsx</code>):
              </p>
              <ul>
                <li>Sắp xếp lịch học theo từng môn, khóa học, phòng học và giảng viên phụ trách.</li>
                <li>Hệ thống tự động phát hiện xung đột lịch (giảng viên bị trùng giờ dạy hoặc phòng học đã có lớp khác sử dụng).</li>
              </ul>

              <h2 id="public-links">3 Cổng Tra Cứu Bảo Mật Không Cần Đăng Nhập</h2>
              <p>
                Học viên và Giảng viên có thể tra cứu lịch mọi lúc mọi nơi qua các URL mã hóa an toàn:
              </p>
              <table className="doc-table">
                <thead>
                  <tr>
                    <th style={{ width: '280px' }}>Đường dẫn Public URL</th>
                    <th style={{ width: '200px' }}>Đối tượng sử dụng</th>
                    <th>Nội dung hiển thị</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>/public-schedule/:customerId</code></td>
                    <td>Học viên cá nhân</td>
                    <td>Xem toàn bộ lịch học, phòng học, giảng viên và tài liệu môn học của riêng học viên đó.</td>
                  </tr>
                  <tr>
                    <td><code>/public-schedule/course/:campaignId</code></td>
                    <td>Cả lớp học / Khóa học</td>
                    <td>Thời khóa biểu toàn khóa của một lớp học, danh sách môn học và lộ trình học tập.</td>
                  </tr>
                  <tr>
                    <td><code>/public-schedule/lecturer/:lecturerId</code></td>
                    <td>Giảng viên</td>
                    <td>Lịch giảng dạy chi tiết của giảng viên, danh sách lớp phụ trách và phòng học tương ứng.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )
        },
        {
          id: 'acad-teaching-grades',
          title: 'Quản Trị Giờ Giảng Dạy, Thù Lao Giảng Viên, Bảng Điểm Tín Chỉ & Luận Văn Thạc Sĩ',
          description: 'Quy chuẩn tính giờ giảng, đơn giá thù lao, quy trình duyệt 4 bước, đồng bộ bảng điểm tín chỉ và quản lý mốc luận văn thạc sĩ.',
          headings: [
            { id: 'teaching-hours-rates', text: 'Quản Lý Giờ Giảng Dạy & Tính Thù Lao Giảng Viên' },
            { id: 'grades-sync-system', text: 'Đồng Bộ Bảng Điểm Tín Chỉ (grades_json) & Điểm Danh' },
            { id: 'thesis-milestones', text: 'Quản Lý Tiến Độ Luận Văn Thạc Sĩ (thesis_milestones_json)' },
            { id: 'academic-sla-audits', text: 'Cơ Chế Giám Sát Giờ Giảng & Kiểm Định Chất Lượng' }
          ],
          content: (
            <div className="doc-prose">
              <h2 id="teaching-hours-rates">Quản Lý Giờ Giảng Dạy &amp; Tính Thù Lao Giảng Viên</h2>
              <p>
                Hệ thống hỗ trợ quản lý chi tiết toàn bộ hoạt động giảng dạy của đội ngũ giảng viên cơ hữu và giảng viên thỉnh giảng quốc tế:
              </p>
              <table className="doc-table">
                <thead>
                  <tr>
                    <th style={{ width: '180px' }}>Loại hình giảng dạy</th>
                    <th style={{ width: '150px' }}>Hệ số giờ dạy</th>
                    <th>Quy chuẩn nghiệm thu &amp; Tính thù lao</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Giảng Viên Cơ Hữu (Internal)</strong></td>
                    <td>1.0x (Giờ chuẩn)</td>
                    <td>Số giờ giảng được đối soát với định mức nghĩa vụ giảng dạy theo hợp đồng lao động năm. Giờ vượt định mức được tính thù lao dạy thêm giờ (Overtime).</td>
                  </tr>
                  <tr>
                    <td><strong>Giảng Viên Thỉnh Giảng (Visiting)</strong></td>
                    <td>1.2x - 1.5x (Theo học hàm)</td>
                    <td>Thù lao tính trực tiếp theo số giờ giảng thực tế $\times$ đơn giá giờ theo học hàm (Giáo sư, Phó Giáo sư, Tiến sĩ, Thạc sĩ).</td>
                  </tr>
                  <tr>
                    <td><strong>Lớp Trực Tuyến (Online Zoom)</strong></td>
                    <td>1.0x</td>
                    <td>Tự động tích hợp link Zoom phòng học, ghi nhận thời gian host buổi học và danh sách điểm danh tham dự của học viên.</td>
                  </tr>
                  <tr>
                    <td><strong>Hướng Dẫn Luận Văn (Thesis)</strong></td>
                    <td>Theo mốc đề tài</td>
                    <td>Thù lao thanh toán theo 3 đợt: (1) Duyệt đề cương chi tiết (30%), (2) Phản biện độc lập (30%), (3) Học viên bảo vệ thành công trước Hội đồng (40%).</td>
                  </tr>
                </tbody>
              </table>

              <h2 id="grades-sync-system">Đồng Bộ Bảng Điểm Tín Chỉ (grades_json) &amp; Điểm Danh</h2>
              <p>
                Dữ liệu học tập của học viên được số hóa toàn diện trong trường <code>grades_json</code> của hồ sơ học vụ:
              </p>
              <ul>
                <li><strong>Cơ cấu điểm học phần:</strong> Điểm chuyên cần (10% - 20%), Điểm bài tập nhóm/thuyết trình giữa kỳ (30% - 40%), Điểm thi kết thúc học phần hoặc bài luận cuối kỳ (50% - 60%).</li>
                <li><strong>Quy đổi thang điểm:</strong> Tự động quy đổi linh hoạt giữa thang điểm 10, thang điểm 4 (GPA) và thang điểm chữ (A, B, C, D, F) theo tiêu chuẩn đào tạo quốc tế.</li>
                <li><strong>Khóa sổ bảng điểm:</strong> Sau khi Giảng viên hoàn tất nhập điểm và Trưởng khoa duyệt, bảng điểm sẽ được đóng dấu khóa sổ (Grade Freeze). Mọi sửa đổi sau đó đều yêu cầu biên bản giải trình và sự chấp thuận của Ban Giám Hiệu.</li>
              </ul>

              <h2 id="thesis-milestones">Quản Lý Tiến Độ Luận Văn Thạc Sĩ (thesis_milestones_json)</h2>
              <p>
                Đối với các chương trình đào tạo Sau đại học (Thạc sĩ, Tiến sĩ), hệ thống cung cấp phân hệ giám sát tiến độ nghiên cứu khoa học:
              </p>
              <div className="doc-flow">
                <div className="doc-flow-step">1. Đăng ký tên đề tài &amp; Gán Giảng viên hướng dẫn (Supervisor)</div>
                <div className="doc-flow-arrow">→</div>
                <div className="doc-flow-step">2. Nộp và Bảo vệ đề cương nghiên cứu (Research Proposal)</div>
                <div className="doc-flow-arrow">→</div>
                <div className="doc-flow-step">3. Kiểm tra tính nguyên bản &amp; Chống đạo văn (Turnitin &lt; 20%)</div>
                <div className="doc-flow-arrow">→</div>
                <div className="doc-flow-step">4. Đánh giá phản biện độc lập (Blind Reviewer)</div>
                <div className="doc-flow-arrow">→</div>
                <div className="doc-flow-step">5. Bảo vệ trước Hội đồng chấm Luận văn chính thức</div>
              </div>

              <h2 id="academic-sla-audits">Cơ Chế Giám Sát Giờ Giảng &amp; Kiểm Định Chất Lượng</h2>
              <p>
                Quy trình nghiệm thu giờ giảng 4 bước nghiêm ngặt:
                <strong>Giảng viên điểm danh</strong> $\rightarrow$
                <strong>Trợ giảng xác nhận sĩ số &amp; biên bản buổi học</strong> $\rightarrow$
                <strong>Phòng Học vụ thẩm định giờ dạy thực tế</strong> $\rightarrow$
                <strong>Phòng Tài chính - Kế toán lập bảng chi trả thù lao</strong>.
                Mọi bước đều có lưu vết người duyệt và chữ ký số.
              </p>
            </div>
          )
        }
      ]
    },

    // 13. TRUYỀN THÔNG NỘI BỘ & AUDIT TRAIL
    {
      id: 'enterprise-feed-audit',
      title: '13. Truyền Thông Nội Bộ & Nhật Ký Kiểm Toán (Feed & Audit)',
      icon: Rss,
      items: [
        {
          id: 'feed-audit-overview',
          title: 'Bảng Tin Nội Bộ (Enterprise Feed) & Nhật Ký Kiểm Toán Toàn Diện (audit_logs)',
          description: 'Không gian truyền thông văn hóa doanh nghiệp và hệ thống truy vết 100% hoạt động hệ thống.',
          headings: [
            { id: 'enterprise-feed', text: 'Bảng Tin Nội Bộ Doanh Nghiệp (/feed)' },
            { id: 'audit-trail-logs', text: 'Nhật Ký Kiểm Toán Toàn Diện (audit_logs)' }
          ],
          content: (
            <div className="doc-prose">
              <h2 id="enterprise-feed">Bảng Tin Nội Bộ Doanh Nghiệp (/feed)</h2>
              <p>
                Kênh kết nối nhân viên toàn công ty:
              </p>
              <ul>
                <li>Đăng tải thông báo quan trọng của Ban Giám Đốc, quyết định bổ nhiệm, khen thưởng.</li>
                <li>Vinh danh thành tích (Kudos) của các tư vấn viên xuất sắc và đội nhóm đạt chỉ tiêu kinh doanh.</li>
                <li>Nhân viên tương tác, thả tim và bình luận nâng cao tinh thần đoàn kết nội bộ.</li>
              </ul>

              <h2 id="audit-trail-logs">Nhật Ký Kiểm Toán Toàn Diện (audit_logs)</h2>
              <p>
                Đảm bảo an toàn bảo mật và phục vụ kiểm toán độc lập:
              </p>
              <ul>
                <li>Mọi thao tác Tạo mới, Chỉnh sửa, Xóa, Xuất dữ liệu (Export Excel/CSV) đều tự động được ghi lại trong bảng <code>audit_logs</code>.</li>
                <li>Lưu lại dữ liệu cũ trước khi sửa (Old Data) và dữ liệu mới (New Data) dưới dạng JSON, giúp phát hiện và khôi phục nhanh chóng nếu có nhầm lẫn.</li>
              </ul>
            </div>
          )
        }
      ]
    },

    // 14. TÍCH HỢP ĐA KÊNH & TỰ ĐỘNG HÓA
    {
      id: 'integrations-automation',
      title: '14. Tích Hợp Đa Kênh, Webhooks & Tự Động Hóa (Automation)',
      icon: Share2,
      items: [
        {
          id: 'integrations-amazon-ses',
          title: 'Amazon SES Mail Engine, Template Thương Hiệu & Hàng Đợi Ngầm',
          description: 'Hạ tầng gửi email bất đồng bộ qua mail_queue, Amazon SES SMTP Port 587 TLS, Rate Limiting 100ms, Security Shield CC và chuẩn hóa thương hiệu IDEAS.',
          headings: [
            { id: 'ses-queue-architecture', text: '1. Kiến Trúc Hàng Đợi Bất Đồng Bộ (mail_queue & Worker)' },
            { id: 'ses-smtp-config', text: '2. Cấu Hình Amazon SES SMTP & Anti-Throttle 100ms' },
            { id: 'ses-brand-templates', text: '3. Chuẩn Hóa Template Email Thương Hiệu IDEAS & Phân Lập Đối Tượng' },
            { id: 'ses-security-shield', text: '4. Lá Chắn Bảo Mật (Security Shield) & Quản Trị Hàng Đợi' }
          ],
          content: (
            <div className="doc-prose">
              <p>
                Hệ thống gửi Email của <strong>IDEAS MYERP</strong> được xây dựng theo mô hình kiến trúc hàng đợi bất đồng bộ
                (Asynchronous Message Queue) kết hợp trực tiếp với dịch vụ thư điện tử doanh nghiệp <strong>Amazon Simple Email Service (Amazon SES)</strong>
                qua giao thức SMTP bảo mật STARTTLS. Kiến trúc này triệt tiêu hoàn toàn độ trễ I/O mạng, giải phóng tiến trình web server ngay lập tức
                và đảm bảo 100% email giao dịch, biên lai thu tiền, thông báo lịch học và cảnh báo quản trị được chuyển giao tin cậy.
              </p>

              <h2 id="ses-queue-architecture">1. Kiến Trúc Hàng Đợi Bất Đồng Bộ (mail_queue &amp; Worker)</h2>
              <p>
                Mọi tác vụ gửi mail trong toàn bộ 39 Controllers và dịch vụ <code>NotificationService.php</code> đều không gọi SMTP trực tiếp
                ở luồng chính (trừ kiểm tra kết nối đơn lẻ). Thay vào đó, payload được ghi nhận vào bảng cơ sở dữ liệu <code>mail_queue</code>:
              </p>
              <table className="doc-table">
                <thead>
                  <tr>
                    <th style={{ width: '160px' }}>Trường dữ liệu</th>
                    <th style={{ width: '140px' }}>Kiểu &amp; Ràng buộc</th>
                    <th>Ý nghĩa &amp; Vai trò vận hành</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>id</code></td>
                    <td>BIGINT AUTO_INCREMENT</td>
                    <td>Định danh duy nhất của tác vụ gửi thư trong hàng đợi.</td>
                  </tr>
                  <tr>
                    <td><code>to_email</code></td>
                    <td>VARCHAR(255) INDEX</td>
                    <td>Địa chỉ email người nhận chính (khách hàng, học viên hoặc nhân sự nội bộ).</td>
                  </tr>
                  <tr>
                    <td><code>cc_email</code></td>
                    <td>TEXT NULLABLE</td>
                    <td>Danh sách email đồng kính gửi (CC), được kiểm duyệt nghiêm ngặt qua Security Shield.</td>
                  </tr>
                  <tr>
                    <td><code>subject</code></td>
                    <td>VARCHAR(500)</td>
                    <td>Tiêu đề thư, tự động nối dấu mộc thời gian <code>[H:i d/m/Y]</code> để chống gộp luồng hội thoại trên Gmail/Outlook.</td>
                  </tr>
                  <tr>
                    <td><code>body_html</code></td>
                    <td>LONGTEXT</td>
                    <td>Toàn bộ nội dung thư HTML đã được đóng khung hoàn chỉnh theo Design System thương hiệu IDEAS.</td>
                  </tr>
                  <tr>
                    <td><code>status</code></td>
                    <td>ENUM('pending', 'processing', 'sent', 'failed')</td>
                    <td>Trạng thái xử lý: <code>pending</code> (chờ gửi) $\rightarrow$ <code>processing</code> (đang gửi) $\rightarrow$ <code>sent</code> (thành công) hoặc <code>failed</code>.</td>
                  </tr>
                  <tr>
                    <td><code>attempts</code></td>
                    <td>INT DEFAULT 0</td>
                    <td>Số lần thử gửi. Nếu gặp sự cố mạng hoặc SES từ chối, worker tự động thử lại tối đa 3 lần trước khi đánh dấu lỗi vĩnh viễn.</td>
                  </tr>
                  <tr>
                    <td><code>lead_id</code></td>
                    <td>INT NULLABLE</td>
                    <td>Khóa ngoại liên kết tới Lead/Khách hàng, đồng bộ trạng thái <code>email_notify_status</code> và ghi vết tương tác.</td>
                  </tr>
                  <tr>
                    <td><code>sent_at</code> / <code>last_error</code></td>
                    <td>DATETIME / TEXT</td>
                    <td>Thời điểm gửi thành công thực tế hoặc chi tiết nhật ký lỗi từ Amazon SES SMTP để phục vụ giám sát.</td>
                  </tr>
                </tbody>
              </table>

              <h2 id="ses-smtp-config">2. Cấu Hình Amazon SES SMTP &amp; Anti-Throttle 100ms</h2>
              <p>
                Tiến trình công nhân <code>backend/cron_mailer.php</code> (hàm <code>runMailerCron</code>) thực thi liên tục để rút các email chờ gửi:
              </p>
              <ul>
                <li><strong>Khóa hàng đợi không nghẽn (Non-blocking Queue Lock):</strong> Sử dụng câu truy vấn chuyên sâu:
                  <pre><code>SELECT id, to_email, cc_email, subject, body_html, attempts, lead_id
                    FROM mail_queue
                    WHERE status = 'pending' OR (status = 'failed' AND attempts &lt; 3)
                    ORDER BY id ASC LIMIT 50 FOR UPDATE SKIP LOCKED;</code></pre>
                  Cơ chế <code>FOR UPDATE SKIP LOCKED</code> cho phép nhiều worker tiến trình chạy song song mà không bao giờ bị nghẽn khóa (Deadlock) hay gửi trùng email.
                </li>
                <li><strong>Khởi tạo kết nối SMTP Keep-Alive:</strong> Đối tượng <code>PHPMailer</code> được khởi tạo duy nhất một lần ở đầu vòng lặp và bật <code>$mail-&gt;SMTPKeepAlive = true</code>. Kết nối TCP/TLS tới cổng 587 của Amazon SES được giữ sống qua nhiều lượt gửi, giảm 85% chi phí bắt tay SSL (TLS Handshake overhead).</li>
                <li><strong>Bộ đệm điều tiết tốc độ (Anti-Throttle Pacing):</strong> Sau mỗi email được gửi, worker thực thi lệnh tạm nghỉ <code>usleep(100000);</code> (100 mili-giây). Độ trễ này đảm bảo hệ thống không bao giờ vượt ngưỡng băng thông cấp phép (Max Send Rate) của Amazon SES, bảo vệ uy tín IP và domain của Viện Đào tạo.</li>
                <li><strong>Cơ chế tự giải cứu tiến trình kẹt (Stuck Job Auto-Recovery):</strong> Nếu một worker bị đứt kết nối đột ngột giữa chừng, câu lệnh:
                  <pre><code>UPDATE mail_queue SET status = 'pending'
                    WHERE status = 'processing'
                    AND (updated_at IS NULL OR updated_at &lt;= DATE_SUB(NOW(), INTERVAL 10 MINUTE));</code></pre>
                  sẽ tự động khôi phục các email bị treo quá 10 phút trở lại hàng đợi để lượt chạy tiếp theo xử lý ngay.
                </li>
              </ul>

              <h2 id="ses-brand-templates">3. Chuẩn Hóa Template Email Thương Hiệu IDEAS &amp; Phân Lập Đối Tượng</h2>
              <p>
                Mọi email phát ra từ hệ thống đều được chuẩn hóa qua hàm lõi <code>_getBaseHtml()</code> và <code>sendEmailNotification()</code>
                trong <code>backend/mailer.php</code>, đảm bảo tính thẩm mỹ, hiển thị chuẩn mực trên mọi ứng dụng di động và phân lập nghiêm ngặt:
              </p>
              <div className="doc-callout doc-callout-info">
                <h4>Phân Tách Rõ Ràng Giữa Email Nội Bộ Và Email Khách Hàng / Học Viên</h4>
                <ul>
                  <li>
                    <strong>Email Gửi Khách Hàng / Học Viên:</strong>
                    <ul>
                      <li>Tiêu đề tiền tố chuẩn hóa: <code>[IDEAS] + [Tiêu đề thư] + [H:i d/m/Y]</code> (loại bỏ tuyệt đối các tiền tố nội bộ như <em>[IDEAS ERP]</em>).</li>
                      <li>Khung nội dung: Khung viền đỏ thương hiệu <code>#BD1D2D</code> với font chữ Inter hiện đại, nền xám thanh lịch <code>#f8fafc</code>.</li>
                      <li><strong>Bỏ nút "Đăng Nhập Hệ Thống":</strong> Thay thế bằng dòng lưu ý pháp lý tự động: <em>"Đây là tin tự động theo lịch thanh toán trên hợp đồng, vui lòng bỏ qua nếu bạn đã thanh toán."</em> để bảo mật đường dẫn nội bộ.</li>
                    </ul>
                  </li>
                  <li>
                    <strong>Email Gửi Nội Bộ Nhân Sự:</strong>
                    <ul>
                      <li>Tiêu đề tiền tố chuẩn hóa: <code>[IDEAS ERP] + [Nội dung cảnh báo] + [H:i d/m/Y]</code>.</li>
                      <li>Khung nội dung: Kèm nút bấm kêu gọi hành động (Call To Action) đỏ nổi bật <strong>"ĐĂNG NHẬP HỆ THỐNG"</strong> trỏ trực tiếp về địa chỉ ERP <code>https://myerp.ideas.edu.vn</code> để xử lý công việc ngay.</li>
                    </ul>
                  </li>
                </ul>
              </div>

              <h2 id="ses-security-shield">4. Lá Chắn Bảo Mật (Security Shield) &amp; Quản Trị Hàng Đợi</h2>
              <p>
                Nhằm ngăn chặn triệt để rủi ro lộ dữ liệu khách hàng hoặc gửi nhầm danh sách CC, mailer tích hợp bộ lọc bảo mật tự động:
              </p>
              <ul>
                <li><strong>Security Shield Lọc Sạch CC:</strong> Khi chuẩn bị danh sách gửi, hệ thống tự động tải bản đồ email người dùng nội bộ (<code>internalEmailsMap</code>). Mọi địa chỉ CC không thuộc đuôi <code>@ideas.edu.vn</code> hoặc không tồn tại trong bảng <code>users</code> sẽ bị bóc tách và loại bỏ ngay lập tức, kèm dòng cảnh báo an ninh ghi vào log: <code>[SECURITY SHIELD] Removed customer email from CC</code>.</li>
                <li><strong>Chống Gửi Trùng Lặp (5-Minute Deduplication Shield):</strong> Khi phát sinh thông báo gắn với <code>lead_id</code>, hệ thống kiểm tra nếu cùng một người nhận đã nhận email cho lead này trong vòng 5 phút trước, yêu cầu mới sẽ được coi là hợp lệ mà không nhân bản thêm bản ghi vào hàng đợi.</li>
                <li><strong>Tự Động Dọn Dẹp Dữ Liệu Cũ (Auto-Prune 30 Days):</strong> Bảng <code>mail_queue</code> tự động dọn dẹp các email có trạng thái <code>sent</code> hoặc <code>failed</code> cũ hơn 30 ngày, giữ cho dung lượng cơ sở dữ liệu luôn gọn nhẹ và truy vấn tốc độ cao.</li>
              </ul>
            </div>
          )
        },
        {
          id: 'integrations-zalo-bot',
          title: 'Hệ Thống Zalo Bot, Zalo Queue & Tích Hợp ZNS / OA',
          description: 'Tự động hóa thông báo qua Zalo Bot API, hàng đợi zalo_queue, phân luồng đích danh TVV và nhóm quản trị.',
          headings: [
            { id: 'zalo-queue-engine', text: '1. Cơ Chế Xử Lý Hàng Đợi Zalo Queue & Worker Ngầm' },
            { id: 'zalo-routing-logic', text: '2. Thuật Toán Phân Luồng Thông Báo: Cá Nhân vs Nhóm Quản Trị' },
            { id: 'zalo-activity-sync', text: '3. Tự Động Đồng Bộ Nhật Ký Hoạt Động (Contact Activities)' }
          ],
          content: (
            <div className="doc-prose">
              <p>
                Kênh thông báo Zalo đóng vai trò huyết mạch trong việc kết nối tức thời giữa hệ thống ERP với đội ngũ Tư vấn tuyển sinh
                và Ban Quản trị. Thông qua <code>backend/zalo_bot.php</code> và hàng đợi <code>zalo_queue</code>, hệ thống hỗ trợ cả phương thức
                gửi tin hàng loạt không nghẽn tiến trình và gửi tin đồng bộ tức thì cho các sự kiện khẩn cấp.
              </p>

              <h2 id="zalo-queue-engine">1. Cơ Chế Xử Lý Hàng Đợi Zalo Queue &amp; Worker Ngầm</h2>
              <p>
                Tương tự mailer, các thông báo Zalo được quản lý qua bảng <code>zalo_queue</code> với cấu trúc:
              </p>
              <ul>
                <li><code>bot_token</code>: Token xác thực Zalo Bot API của doanh nghiệp.</li>
                <li><code>chat_id</code>: Mã phòng chat Zalo cá nhân của nhân sự hoặc ID nhóm chat quản trị.</li>
                <li><code>body_text</code>: Nội dung văn bản thông báo đã được định dạng chuẩn hóa.</li>
                <li><code>status</code>: Trạng thái tin nhắn (<code>pending</code>, <code>processing</code>, <code>sent</code>, <code>failed</code>).</li>
                <li><code>attempts</code>: Đếm số lần gửi (thử lại tối đa 3 lần).</li>
              </ul>
              <p>
                Hàm <code>runZaloMailerCron($conn)</code> trong <code>backend/cron_mailer.php</code> tự động rút từng lô 50 tin nhắn Zalo
                bằng kỹ thuật <code>FOR UPDATE SKIP LOCKED</code>, giải cứu các tin bị kẹt quá 10 phút, giãn cách 100ms giữa các tin
                và tự động dọn dẹp các bản ghi hoàn tất sau 30 ngày.
              </p>

              <h2 id="zalo-routing-logic">2. Thuật Toán Phân Luồng Thông Báo: Cá Nhân vs Nhóm Quản Trị</h2>
              <p>
                Hệ thống <code>NotificationService.php</code> áp dụng thuật toán phân luồng Zalo thông minh để tránh gây loãng thông tin:
              </p>
              <table className="doc-table">
                <thead>
                  <tr>
                    <th style={{ width: '180px' }}>Đối tượng nhận</th>
                    <th style={{ width: '220px' }}>Loại sự kiện kích hoạt</th>
                    <th>Quy tắc định tuyến &amp; Bảo vệ</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Zalo Chat ID Cá Nhân (Sale)</strong></td>
                    <td>
                      <code>LEAD_ASSIGNMENT</code><br />
                      <code>LEAD_NEW</code> / <code>NEW_LEAD</code><br />
                      <code>LEAD_REASSIGN</code><br />
                      <code>LEAD_HANDOVER_NEW_SALE</code><br />
                      <code>SO_CREATED_FOR_SALE</code>
                    </td>
                    <td>
                      Chỉ gửi đích danh tới Zalo của Tư vấn viên được giao khách hàng hoặc phát sinh đơn hàng.
                      Nếu tư vấn viên tắt nhận kênh Zalo trong bảng <code>user_notification_settings</code> (Ma trận thông báo cá nhân), hệ thống sẽ tự động bỏ qua.
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Group Zalo Quản Trị (Admin Group)</strong></td>
                    <td>
                      <code>TICKET_LEAD</code> / <code>TICKET_NEW</code><br />
                      <code>LEAD_RECALL</code><br />
                      <code>DAILY_REPORT_SUMMARY</code><br />
                      Sự kiện Lead toàn hệ thống
                    </td>
                    <td>
                      Chỉ bắn vào Group Admin Zalo các sự kiện mang tính chất phân bổ dữ liệu toàn công ty,
                      cảnh báo khiếu nại chất lượng số (Ticket lỗi data) và Báo cáo tổng kết ngày lúc 22:00.
                      Tuyệt đối không bắn các thông báo nội bộ cá nhân (chấm công, nghỉ phép) vào nhóm Zalo chung.
                    </td>
                  </tr>
                </tbody>
              </table>

              <h2 id="zalo-activity-sync">3. Tự Động Đồng Bộ Nhật Ký Hoạt Động (Contact Activities)</h2>
              <p>
                Khi một tin nhắn Zalo được gửi đi gắn liền với một khách hàng (<code>lead_id &gt; 0</code>), hệ thống tự động:
              </p>
              <ul>
                <li>Cập nhật trạng thái <code>zalo_notify_status = 'sent'</code> và mốc thời gian <code>zalo_notify_sent_at = NOW()</code> trên bản ghi Lead.</li>
                <li>Ghi một dòng nhật ký chi tiết vào bảng <code>contact_activities</code> với loại <code>type = 'zalo'</code>, nội dung tóm tắt và trạng thái kết nối, giúp nhà quản lý xem lại toàn bộ lịch sử tương tác đa kênh tại Hồ Sơ Khách Hàng 360.</li>
                <li>Ghi lại vết nhật ký chi tiết tại tệp <code>zalo_send_log.txt</code> để đối soát kỹ thuật với Zalo Open Platform API.</li>
              </ul>
            </div>
          )
        },
        {
          id: 'integrations-telegram-bot',
          title: 'Telegram Bot Dispatcher & Phân Luồng Thông Báo Tức Thời',
          description: 'Hạ tầng phát tín hiệu tức thời qua 3 kênh Telegram chuyên biệt, non-blocking execution qua register_shutdown_function.',
          headings: [
            { id: 'tg-channels', text: '1. 3 Kênh Phân Luồng Chuyên Biệt: Sales, Approvals, Reports' },
            { id: 'tg-formatting-actions', text: '2. Định Dạng Tin Nhắn Cao Cấp & Nút Bấm Tương Tác 1-Chạm' },
            { id: 'tg-performance', text: '3. Tối Ưu Hiệu Năng: Non-Blocking Shutdown Handler (< 50ms)' }
          ],
          content: (
            <div className="doc-prose">
              <p>
                Hệ sinh thái Telegram Bot trong <strong>IDEAS MYERP</strong> được vận hành thông qua thư viện kết nối
                <code>backend/telegram_bot.php</code>. Đây là kênh phản ứng nhanh dành cho đội ngũ quản trị cấp cao và lực lượng bán hàng,
                đảm bảo thời gian phản hồi trước các cơ hội kinh doanh mới luôn đạt chuẩn SLA dưới 5 phút.
              </p>

              <h2 id="tg-channels">1. 3 Kênh Phân Luồng Chuyên Biệt: Sales, Approvals, Reports</h2>
              <p>
                Hệ thống tách biệt hoàn toàn 3 nhóm Telegram chuyên trách để đảm bảo thông tin đúng người, đúng việc:
              </p>
              <div className="doc-callout doc-callout-warning">
                <h4>Phân Luồng Nhóm Telegram Theo Vai Trò Doanh Nghiệp</h4>
                <ol>
                  <li>
                    <strong>Kênh Bán Hàng (Sales Channel):</strong>
                    <br />Bắn thông báo tức thì khi có Lead mới đăng ký hoặc được AI duyệt vào luồng. Tin nhắn hiển thị đầy đủ: Họ tên khách hàng, Số điện thoại (định dạng bấm gọi 1-chạm), Chương trình quan tâm, Nguồn chiến dịch và Điểm số chất lượng AI.
                  </li>
                  <li>
                    <strong>Kênh Phê Duyệt &amp; Điều Hành (Approvals Channel):</strong>
                    <br />Gửi cảnh báo tới các cấp quản lý và Ban Giám Đốc khi phát sinh yêu cầu phê duyệt mới: Đơn xin nghỉ phép, Đề nghị duyệt chấm công đi muộn/về sớm, Phiếu yêu cầu chi tiền mặt, Đề xuất tạm ứng lương và Đơn đặt hàng mua ngoài (PO).
                  </li>
                  <li>
                    <strong>Kênh Báo Cáo Định Kỳ Ban Giám Đốc (Daily Reports Channel):</strong>
                    <br />Bắn bản tin tóm lược kinh doanh, doanh thu thực thu, biến động tỷ lệ chuyển đổi và trạng thái nhân sự lúc 22:00 hàng ngày.
                  </li>
                </ol>
              </div>

              <h2 id="tg-formatting-actions">2. Định Dạng Tin Nhắn Cao Cấp &amp; Nút Bấm Tương Tác 1-Chạm</h2>
              <p>
                Tin nhắn gửi qua Telegram được tối ưu hóa hiển thị với cú pháp HTML cao cấp:
              </p>
              <ul>
                <li><strong>Định dạng trực quan:</strong> Sử dụng các thẻ in đậm <code>&lt;b&gt;</code>, khối mã nguồn <code>&lt;code&gt;</code> cho mã đơn/mã lead, ký hiệu trạng thái màu (🟢 Đã duyệt, 🔴 Từ chối, 🟡 Chờ xử lý).</li>
                <li><strong>Action Links &amp; Inline Buttons:</strong> Tích hợp đường dẫn một chạm giúp người nhận nhấn vào là mở thẳng hồ sơ trên trình duyệt điện thoại hoặc ứng dụng CRM di động mà không cần đăng nhập tìm kiếm thủ công.</li>
                <li><strong>Hàng Đợi Dự Phòng (telegram_queue):</strong> Ngoài gửi cURL tức thì, các tin nhắn định kỳ được xếp vào bảng <code>telegram_queue</code> và được worker <code>runTelegramMailerCron</code> quét gửi với độ trễ 100ms, tự động dọn dẹp sau 30 ngày.</li>
              </ul>

              <h2 id="tg-performance">3. Tối Ưu Hiệu Năng: Non-Blocking Shutdown Handler (&lt; 50ms)</h2>
              <p>
                Một trong những ưu điểm kỹ thuật vượt trội của <code>NotificationService.php</code> là cơ chế <strong>Non-blocking Dispatch</strong>:
              </p>
              <ul>
                <li>Khi người dùng thực hiện một thao tác trên giao diện (ví dụ: tạo đơn bán hàng hoặc nộp đơn nghỉ phép), máy chủ ghi nhận dữ liệu vào Database trước.</li>
                <li>Sau đó, hệ thống gọi hàm <code>fastcgi_finish_request()</code> và đóng luồng HTTP để trả về kết quả <code>200 OK</code> cho trình duyệt của người dùng trong chưa đầy <strong>50ms</strong>.</li>
                <li>Toàn bộ tác vụ gửi tin mạng ra ngoài tới Zalo API, Telegram API và đưa email vào Queue được thực hiện ngầm bên trong <code>register_shutdown_function()</code>. Người dùng hoàn toàn không phải chờ đợi mạng ngoại vi phản hồi.</li>
              </ul>
            </div>
          )
        },
        {
          id: 'integrations-daily-reports',
          title: 'Báo Cáo Tự Động Định Kỳ (Daily 22:00) & Hệ Thống Nhắc Lịch',
          description: 'Tự động kết xuất báo cáo ngày, tuần, tháng với Cửa sổ thời gian trượt (Sliding Window), phát sóng Tri-channel và nhắc lịch học vụ, cọc học phí.',
          headings: [
            { id: 'daily-report-engine', text: '1. Cơ Chế Báo Cáo Tổng Kết Ngày (Daily Report 22:00)' },
            { id: 'sliding-time-window', text: '2. Thuật Toán Cửa Sổ Thời Gian Trượt (Sliding Time Window)' },
            { id: 'scheduled-reminders', text: '3. Hệ Thống Nhắc Lịch Tự Động: Đặt Cọc & Học Vụ Thạc Sĩ' },
            { id: 'cron-master-orchestrator', text: '4. Bộ Điều Phối Tổng Thể Master Orchestrator (cron_master.php)' }
          ],
          content: (
            <div className="doc-prose">
              <p>
                Khả năng tự động hóa báo cáo và nhắc nhở đúng giờ là xương sống trong công tác điều hành của Viện Đào tạo.
                Hệ sinh thái cron jobs của <strong>IDEAS MYERP</strong> bao gồm báo cáo tổng kết ngày, báo cáo tuần, báo cáo tháng
                và các tiến trình nhắc nhở tài chính, học vụ độc lập.
              </p>

              <h2 id="daily-report-engine">1. Cơ Chế Báo Cáo Tổng Kết Ngày (Daily Report 22:00)</h2>
              <p>
                Tệp tiến trình <code>backend/cron_daily_report.php</code> được kích hoạt tự động vào <strong>22:00 hàng ngày</strong>
                (hoặc theo cấu hình <code>zalo_daily_report_time</code> trong hệ thống). Báo cáo tổng kết toàn bộ bức tranh vận hành ngày:
              </p>
              <table className="doc-table">
                <thead>
                  <tr>
                    <th style={{ width: '200px' }}>Nhóm chỉ số</th>
                    <th style={{ width: '260px' }}>Bảng dữ liệu trích xuất</th>
                    <th>Nội dung tổng hợp chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Tổng Quan Chia Số (Data Stats)</strong></td>
                    <td><code>distribution_logs</code> JOIN <code>consultants</code></td>
                    <td>
                      Tổng số data phát sinh trong kỳ; Phân loại chi tiết theo từng Tư vấn viên:
                      Số lượng <em>chia vòng (round-robin)</em>, số lượng <em>bù vé lỗi (compensation)</em>,
                      và số lượng <em>nhắc lại khách hàng cũ (reminder)</em>. Sắp xếp thứ tự giảm dần theo tổng lượng nhận.
                    </td>
                  </tr>
                  <tr>
                    <td><strong>AI Pre-Screener Stats</strong></td>
                    <td><code>leads</code> (status = 'pending_approval', 'rejected', 'blacklisted')</td>
                    <td>
                      Số lượng data bị AI chấm dưới chuẩn hoặc tạm giữ chờ duyệt;
                      Tổng số lượng data đang tồn đọng trên toàn hệ thống cần Giám đốc Tuyển sinh rà soát.
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Báo Cáo Lỗi Dữ Liệu (Tickets)</strong></td>
                    <td><code>data_reports</code></td>
                    <td>
                      Tổng số khiếu nại data rác/sai số do TVV mở; Số lượng đã được Quản lý duyệt hoàn bù,
                      số lượng bị từ chối và số lượng ticket đang chờ giải quyết.
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Chặn Spam (Blacklist Defense)</strong></td>
                    <td><code>admin_logs</code> (action = 'BLOCK_LEAD_BLACKLIST')</td>
                    <td>
                      Tổng số lượng số điện thoại rác/phá hoại bị hệ thống tường lửa tự động nhận diện và chặn đứng trong ngày.
                    </td>
                  </tr>
                </tbody>
              </table>

              <h2 id="sliding-time-window">2. Thuật Toán Cửa Sổ Thời Gian Trượt (Sliding Time Window)</h2>
              <p>
                Để triệt tiêu lỗi mất mát số liệu do giờ chạy cron bị lệch vài phút, <code>cron_daily_report.php</code>
                sử dụng thuật toán <strong>Cửa sổ Thời Gian Trượt (Sliding Time Window)</strong>:
              </p>
              <ul>
                <li>Mỗi lần chạy thành công, hệ thống ghi nhận mốc thời gian kết thúc vào biến cấu hình <code>last_daily_report_timestamp</code>.</li>
                <li>Lần chạy kế tiếp sẽ quét dữ liệu chính xác từ <code>$startTimestamp = last_daily_report_timestamp</code> đến <code>$endTimestamp = NOW()</code>.</li>
                <li>Phương pháp này đảm bảo 100% số liệu được tổng kết liền mạch, không có bất kỳ khoảng trống (gap) nào bị bỏ sót và không trùng lặp số liệu giữa các ngày.</li>
                <li><strong>Phát sóng đa kênh (Tri-channel Broadcast):</strong> Sau khi tổng hợp, báo cáo được gửi đồng thời qua 3 kênh độc lập:
                  <ol>
                    <li>Bắn tin nhắn Markdown định dạng đẹp vào <strong>Group Zalo Admin</strong>.</li>
                    <li>Bắn tin nhắn HTML định dạng khối mã vào <strong>Group Telegram Lãnh Đạo</strong>.</li>
                    <li>Gửi <strong>Email Digest HTML</strong> tổng hợp kèm bảng biểu chi tiết tới hòm thư riêng của tất cả Quản trị viên và Ban Giám Đốc.</li>
                  </ol>
                </li>
              </ul>

              <h2 id="scheduled-reminders">3. Hệ Thống Nhắc Lịch Tự Động: Đặt Cọc &amp; Học Vụ Thạc Sĩ</h2>
              <p>
                Bên cạnh báo cáo tổng kết ngày, hệ thống vận hành 2 cỗ máy nhắc nhở định kỳ chuyên sâu:
              </p>
              <ul>
                <li>
                  <strong>Tự Động Nhắc Thanh Toán Cọc Học Phí (<code>cron_deposit_reminders.php</code>):</strong>
                  <br />Quét các mốc thanh toán trong bảng <code>deposit_milestones</code> liên kết với hợp đồng <code>deposits</code>.
                  Kiểm tra điều kiện: <code>auto_remind = 1</code>, mốc tiền chưa đóng (<code>pending</code>), cách ngày đến hạn theo cấu hình <code>remind_days_before</code> (ví dụ: 3 ngày trước hạn), và đạt khung giờ gửi <code>remind_at_hour</code> (ví dụ: 08:30 sáng).
                  Tự động gửi email chuyên biệt cho học viên kèm số tiền, mốc hạn và thông tin số tài khoản ngân hàng của Viện.
                </li>
                <li>
                  <strong>Tự Động Nhắc Tiến Độ Đào Tạo &amp; Luận Văn Thạc Sĩ (<code>cron_academic_reminders.php</code>):</strong>
                  <br />Quét cấu hình <code>reminders_json</code> trong các chương trình đào tạo đang hoạt động:
                  <ul>
                    <li>Nhắc mốc luận văn thạc sĩ: Hạn nộp đề cương, hạn duyệt đề cương của GVHD, hạn nộp luận văn phản biện và lịch bảo vệ chính thức.</li>
                    <li>Nhắc lịch học: Tự động gửi email nhắc học viên và giảng viên trước 24 giờ và trước 2 giờ diễn ra buổi học trực tuyến/trực tiếp, kèm đường link phòng học Zoom/Teams.</li>
                    <li>Nhắc hạn nộp chuyên đề/tiểu luận môn học trước 3 ngày.</li>
                  </ul>
                </li>
              </ul>

              <h2 id="cron-master-orchestrator">4. Bộ Điều Phối Tổng Thể Master Orchestrator (cron_master.php)</h2>
              <p>
                Để đơn giản hóa việc triển khai trên cPanel hoặc máy chủ Linux/Windows, toàn bộ hệ sinh thái cron được điều phối
                qua duy nhất <strong>một dòng lệnh Crontab định kỳ mỗi 1 phút</strong>:
              </p>
              <pre><code>* * * * * php /home/user/public_html/backend/cron_master.php &gt; /dev/null 2&gt;&amp;1</code></pre>
              <p>
                Tiến trình <code>cron_master.php</code> đóng vai trò nhạc trưởng (Master Orchestrator):
              </p>
              <ul>
                <li>Tự động nhận diện phiên bản PHP CLI tối ưu trên máy chủ (ưu tiên PHP 8.1 / 8.2 như <code>/usr/local/bin/ea-php81</code>).</li>
                <li>Kiểm tra khóa an toàn <code>cron_master_*.lock</code> để chống chạy song song trùng lặp.</li>
                <li>Kích hoạt song song ngầm các tiến trình con độc lập:
                  <code>cron_sync.php</code> (đồng bộ sheets, chia số, kiểm tra báo cáo ngày/tuần/tháng),
                  <code>cron_recurring_tasks.php</code> (sinh công việc định kỳ),
                  <code>cron_deposit_reminders.php</code> (nhắc tiền cọc),
                  <code>cron_academic_reminders.php</code> (nhắc lịch học vụ),
                  và <code>cron_mailer.php</code> (xử lý hàng đợi email và Zalo).
                </li>
              </ul>
            </div>
          )
        },
        {
          id: 'integrations-full',
          title: 'Meta Conversions API (CAPI), TikTok Events & Webhooks Đa Nền Tảng',
          description: 'Hạ tầng kết nối quảng cáo đa nền tảng, bắn ngược tín hiệu chuyển đổi và tự động hóa thông báo.',
          headings: [
            { id: 'ad-conversions', text: '1. Tối Ưu Quảng Cáo Meta CAPI & TikTok Events API' },
            { id: 'webhook-integrations', text: '2. Webhooks Tiếp Nhận Dữ Liệu Đa Nguồn' }
          ],
          content: (
            <div className="doc-prose">
              <h2 id="ad-conversions">1. Tối Ưu Quảng Cáo Meta CAPI &amp; TikTok Events API</h2>
              <p>
                Hệ thống tích hợp sâu với Conversions API của Meta và TikTok:
              </p>
              <ul>
                <li>Khi Lead phát sinh: Gửi tín hiệu <code>Lead</code> về trình quản lý quảng cáo kèm mã băm SHA256 email/phone.</li>
                <li>Khi Lead chuyển sang Stage Won (Đã đóng tiền cọc/học phí): Tự động bắn tín hiệu <code>Purchase</code> kèm doanh thu thực tế về Pixel, giúp thuật toán AI của Facebook/TikTok tối ưu tệp đối tượng tương tự (Lookalike Audience) có khả năng thanh toán cao nhất.</li>
              </ul>

              <h2 id="webhook-integrations">2. Webhooks Tiếp Nhận Dữ Liệu Đa Nguồn</h2>
              <p>
                Hệ thống cung cấp các endpoint webhook bảo mật tiếp nhận dữ liệu tự động từ các nguồn:
              </p>
              <ul>
                <li><strong>Landing Page &amp; Web Forms:</strong> Tiếp nhận dữ liệu đăng ký tuyển sinh tức thời với khóa bảo mật Bearer Token hoặc HMAC Secret.</li>
                <li><strong>Google Sheets Two-way Sync:</strong> Đồng bộ 2 chiều qua <code>cron_sync.php</code> và AppScript Webhooks.</li>
                <li><strong>Zalo Webhook &amp; Telegram Webhook:</strong> Tiếp nhận tương tác phản hồi từ người dùng (như lệnh báo cáo <code>/report</code> hoặc <code>/tools</code>).</li>
              </ul>
            </div>
          )
        }
      ]
    }
  ], []);

  // Filter sections based on search
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const query = searchQuery.toLowerCase();
    return sections.map(section => ({
      ...section,
      items: section.items.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        section.title.toLowerCase().includes(query)
      )
    })).filter(section => section.items.length > 0);
  }, [sections, searchQuery]);

  const currentSection = sections.find(s => s.id === activeSectionId) || sections[0];
  const currentItem = currentSection.items.find(i => i.id === activeItemId) || currentSection.items[0];

  const scrollToHeading = (id: string) => {
    setActiveHeadingId(id);
    const element = document.getElementById(id);
    if (element && contentRef.current) {
      const elTop = element.getBoundingClientRect().top;
      const containerTop = contentRef.current.getBoundingClientRect().top;
      contentRef.current.scrollTo({
        top: contentRef.current.scrollTop + (elTop - containerTop) - 20,
        behavior: 'smooth'
      });
    }
  };

  const handleSelectItem = (sectionId: string, itemId: string) => {
    setActiveSectionId(sectionId);
    setActiveItemId(itemId);
    setActiveHeadingId('');
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="doc-full-wrapper">
      {/* Top Header */}
      <header className="doc-full-header">
        <div className="doc-header-left">
          <div className="doc-brand" onClick={() => navigate('/')}>
            <span className="doc-brand-title">IDEAS MYERP</span>
            <span className="doc-brand-badge">ENTERPRISE DOCS</span>
          </div>
          <span className="doc-header-sep">/</span>
          <span className="doc-header-subtitle">Tài Liệu Toàn Diện 14 Phân Hệ Hệ Thống</span>
        </div>

        <div className="doc-header-search-bar">
          <Search size={15} className="doc-search-icon" />
          <input
            type="text"
            placeholder="Tìm kiếm nhanh phân hệ, tính năng, quy trình (Ctrl + K)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="doc-search-input"
          />
          {searchQuery && (
            <button className="doc-search-clear" onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>

        <div className="doc-header-right">
          <button
            onClick={() => navigate('/api-docs')}
            className="doc-nav-btn doc-nav-btn-secondary"
            title="Xem Tài Liệu API & SDK Reference"
          >
            <Code size={15} />
            <span>API Docs & SDKs</span>
          </button>
          <button
            onClick={() => navigate('/')}
            className="doc-nav-btn doc-nav-btn-primary"
            title="Trở về Trang Chủ MYERP"
          >
            <Home size={15} />
            <span>Vào Hệ Thống</span>
          </button>
        </div>
      </header>

      {/* Main Full-Width Layout (3 Columns) */}
      <div className="doc-full-container">
        {/* Column 1: Left Navigation Sidebar */}
        <aside className="doc-col-sidebar">
          <div className="doc-col-sidebar-inner">
            <div className="doc-menu-caption">DANH MỤC PHÂN HỆ ({sections.length})</div>

            {filteredSections.map(section => {
              const SectionIcon = section.icon;
              const isSectionActive = section.id === activeSectionId;
              const isExpanded = expandedSectionIds.includes(section.id);

              return (
                <div key={section.id} className="doc-nav-section">
                  <div
                    className={`doc-nav-section-title ${isSectionActive ? 'active' : ''}`}
                    onClick={() => {
                      setActiveSectionId(section.id);
                      toggleSection(section.id);
                      if (!isExpanded && section.items.length > 0) {
                        handleSelectItem(section.id, section.items[0].id);
                      }
                    }}
                  >
                    <div className="doc-nav-section-title-left">
                      <SectionIcon size={16} className="doc-nav-section-icon" />
                      <span>{section.title}</span>
                    </div>
                    <ChevronDown
                      size={14}
                      className={`doc-chevron-icon ${isExpanded ? 'open' : ''}`}
                    />
                  </div>

                  <div className={`doc-nav-subitems-wrapper ${isExpanded ? 'open' : ''}`}>
                    <div className="doc-nav-subitems-inner">
                      <div className="doc-nav-subitems">
                        {section.items.map(item => {
                          const isItemActive = item.id === activeItemId;
                          return (
                            <div
                              key={item.id}
                              className={`doc-nav-subitem ${isItemActive ? 'active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectItem(section.id, item.id);
                              }}
                            >
                              <span className="doc-subitem-bullet">•</span>
                              <span className="doc-subitem-text">{item.title}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Column 2: Center Content Area (Expands to Fill Full Width & Scrolls Independently) */}
        <main className="doc-col-content" ref={contentRef}>
          <div className="doc-content-article">
            {/* Breadcrumb */}
            <div className="doc-nav-breadcrumb">
              <span>Tài liệu</span>
              <ChevronRight size={13} />
              <span>{currentSection.title}</span>
              <ChevronRight size={13} />
              <span className="active-leaf">{currentItem?.title}</span>
            </div>

            {/* Title Banner */}
            <div className="doc-article-header">
              <h1 className="doc-article-title">{currentItem?.title}</h1>
              <p className="doc-article-lead">{currentItem?.description}</p>
            </div>

            {/* Dynamic Content */}
            <div className="doc-article-body">
              {currentItem?.content}
            </div>

            {/* Footer Navigation */}
            <div className="doc-article-footer">
              <div className="doc-footer-info">
                <span>Chương: </span>
                <strong>{currentSection.title}</strong>
              </div>
              <div className="doc-footer-action">
                <button
                  onClick={() => navigate('/api-docs')}
                  className="doc-nav-btn doc-nav-btn-secondary"
                >
                  <span>Xem tài liệu API tương ứng</span>
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Column 3: Right On-This-Page Table of Contents */}
        <aside className="doc-col-toc">
          <div className="doc-col-toc-inner">
            <div className="doc-toc-header">MỤC LỤC TRANG NÀY</div>
            {currentItem?.headings && currentItem.headings.length > 0 ? (
              <div className="doc-toc-links">
                {currentItem.headings.map(h => (
                  <div
                    key={h.id}
                    className={`doc-toc-link ${activeHeadingId === h.id ? 'active' : ''}`}
                    onClick={() => scrollToHeading(h.id)}
                  >
                    <span>{h.text}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="doc-toc-empty">Không có tiểu mục</div>
            )}

            <div className="doc-toc-quick-box">
              <div className="doc-quick-title">Cần Hỗ Trợ Kỹ Thuật?</div>
              <p className="doc-quick-desc">Tra cứu nhanh toàn bộ tham số REST API và bộ code mẫu tại API Docs.</p>
              <button
                onClick={() => navigate('/api-docs')}
                className="doc-quick-btn"
              >
                Mở API Docs
              </button>
            </div>

            {/* Exclusive Intellectual Property & Development Notice */}
            <div className="doc-toc-copyright-box">
              <div className="doc-copyright-badge">
                <Shield size={12} color="#dc2626" />
                <span>BẢN QUYỀN ĐỘC QUYỀN</span>
              </div>
              <div className="doc-copyright-title">TurnioDEV Fullstack Developer</div>
              <div className="doc-copyright-subtitle">CEO / Founder DOM MARKETING</div>
              <p className="doc-copyright-statement">
                Hệ thống xây dựng và phát triển độc quyền. Nghiêm cấm tuyệt đối mọi hành vi sao chép, trích xuất cấu trúc, phân phối lại hoặc đảo ngược mã nguồn (Reverse Engineering) dưới mọi hình thức khi chưa có sự chấp thuận bằng văn bản chính thức từ tác giả. Mọi hành vi xâm phạm sẽ bị truy cứu trách nhiệm pháp lý theo Luật Sở hữu trí tuệ.
              </p>
              <div className="doc-copyright-links">
                <a href="https://domation.net/" target="_blank" rel="noopener noreferrer" className="doc-copyright-link" title="Website DOM MARKETING">
                  <Globe size={12} /> <span>domation.net</span>
                </a>
                <a href="https://www.tiktok.com/@turnio.dev" target="_blank" rel="noopener noreferrer" className="doc-copyright-link" title="TikTok TurnioDEV">
                  <Zap size={12} /> <span>@turnio.dev</span>
                </a>
                <a href="https://fb.com/turni0" target="_blank" rel="noopener noreferrer" className="doc-copyright-link" title="Facebook TurnioDEV">
                  <Share2 size={12} /> <span>fb.com/turni0</span>
                </a>
                <a href="https://www.linkedin.com/in/turnio-dev/" target="_blank" rel="noopener noreferrer" className="doc-copyright-link" title="LinkedIn TurnioDEV">
                  <Briefcase size={12} /> <span>in/turnio-dev</span>
                </a>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Embedded 100% Full-Width Clean Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,300;0,400;0,500;0,700;0,900;1,400;1,500;1,700&display=swap');

        html:has(.doc-full-wrapper),
        body:has(.doc-full-wrapper),
        #root:has(.doc-full-wrapper) {
          height: 100% !important;
          overflow: hidden !important;
        }

        .doc-full-wrapper {
          width: 100%;
          height: 100vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          background-color: #f8fafc;
          color: #0f172a;
          font-family: 'Roboto', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
          font-size: 14px;
          line-height: 1.65;
          margin: 0;
          padding: 0;
        }

        .doc-full-header {
          flex-shrink: 0;
          height: 60px;
          width: 100%;
          background-color: #ffffff;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          box-sizing: border-box;
          z-index: 50;
        }

        .doc-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .doc-brand {
          display: flex;
          align-items: baseline;
          gap: 6px;
          cursor: pointer;
        }

        .doc-brand-title {
          font-weight: 800;
          font-size: 16px;
          letter-spacing: -0.5px;
          color: #0f172a;
        }

        .doc-brand-badge {
          font-size: 10px;
          font-weight: 800;
          color: #64748b;
          letter-spacing: 0.5px;
          background: #f1f5f9;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .doc-header-sep {
          color: #cbd5e1;
        }

        .doc-header-subtitle {
          font-size: 12.5px;
          font-weight: 500;
          color: #475569;
        }

        .doc-header-search-bar {
          position: relative;
          width: 420px;
        }

        .doc-search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .doc-search-input {
          width: 100%;
          height: 36px;
          padding: 0 32px 0 34px;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
          background: #f1f5f9;
          font-size: 13px;
          font-family: inherit;
          color: #0f172a;
          outline: none;
          box-sizing: border-box;
          transition: all 0.15s ease;
        }

        .doc-search-input:focus {
          background: #ffffff;
          border-color: #0284c7;
          box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.15);
        }

        .doc-search-clear {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          font-size: 11px;
        }

        .doc-header-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .doc-nav-btn {
          height: 36px;
          padding: 0 14px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s ease;
        }

        .doc-nav-btn-secondary {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #334155;
        }

        .doc-nav-btn-secondary:hover {
          background: #f8fafc;
          border-color: #94a3b8;
        }

        .doc-nav-btn-primary {
          background: #0f172a;
          border: 1px solid #0f172a;
          color: #ffffff;
        }

        .doc-nav-btn-primary:hover {
          background: #1e293b;
        }

        /* 3-Column Full-Width Container */
        .doc-full-container {
          display: flex;
          width: 100%;
          flex: 1;
          height: calc(100vh - 60px);
          overflow: hidden;
          box-sizing: border-box;
        }

        /* Column 1: Left Navigation */
        .doc-col-sidebar {
          width: 290px;
          flex-shrink: 0;
          border-right: 1px solid #e2e8f0;
          background: #ffffff;
          height: 100%;
          overflow-y: auto;
        }

        .doc-col-sidebar-inner {
          padding: 20px 14px 40px 18px;
        }

        .doc-menu-caption {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.5px;
          color: #94a3b8;
          margin-bottom: 12px;
          padding-left: 6px;
        }

        .doc-nav-section {
          margin-bottom: 6px;
        }

        .doc-nav-section-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          user-select: none;
        }

        .doc-nav-section-title:hover {
          background-color: #f1f5f9;
          color: #0f172a;
        }

        .doc-nav-section-title.active {
          background-color: #f0f9ff;
          color: #0284c7;
          font-weight: 700;
        }

        .doc-nav-section-title-left {
          display: flex;
          align-items: center;
          gap: 9px;
          flex: 1;
          min-width: 0;
        }

        .doc-chevron-icon {
          flex-shrink: 0;
          color: #94a3b8;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), color 0.2s;
        }

        .doc-chevron-icon.open {
          transform: rotate(180deg);
          color: #0284c7;
        }

        .doc-nav-section-icon {
          color: #64748b;
          flex-shrink: 0;
        }

        /* Smooth Accordion Expansion */
        .doc-nav-subitems-wrapper {
          display: grid;
          grid-template-rows: 0fr;
          opacity: 0;
          transition: grid-template-rows 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
        }

        .doc-nav-subitems-wrapper.open {
          grid-template-rows: 1fr;
          opacity: 1;
          transition: grid-template-rows 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
        }

        .doc-nav-subitems-inner {
          overflow: hidden;
        }

        .doc-nav-subitems {
          margin-left: 12px;
          padding-left: 8px;
          padding-top: 4px;
          padding-bottom: 6px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .doc-nav-subitem {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 5px;
          font-size: 12.5px;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s;
        }

        .doc-nav-subitem:hover {
          color: #0284c7;
          background-color: #f8fafc;
        }

        .doc-nav-subitem.active {
          color: #0284c7;
          font-weight: 600;
          background-color: #f0f9ff;
        }

        .doc-subitem-bullet {
          font-size: 10px;
        }

        /* Column 2: Center Content Area (Expands Fluidly & Scrolls Independently) */
        .doc-col-content {
          flex: 1;
          min-width: 0;
          height: 100%;
          overflow-y: auto;
          background: #ffffff;
          padding: 32px 48px 80px 48px;
          scroll-behavior: smooth;
        }

        .doc-content-article {
          width: 100%;
        }

        .doc-nav-breadcrumb {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #64748b;
          margin-bottom: 20px;
        }

        .doc-nav-breadcrumb .active-leaf {
          color: #0f172a;
          font-weight: 600;
        }

        .doc-article-header {
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 20px;
          margin-bottom: 28px;
        }

        .doc-article-title {
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.5px;
          color: #0f172a;
          margin: 0 0 8px 0;
        }

        .doc-article-lead {
          font-size: 15px;
          color: #475569;
          margin: 0;
        }

        .doc-prose h2 {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
          margin: 32px 0 14px 0;
          letter-spacing: -0.3px;
          padding-top: 10px;
          border-top: 1px dashed #e2e8f0;
        }

        .doc-prose h3 {
          font-size: 16px;
          font-weight: 700;
          color: #1e293b;
          margin: 22px 0 10px 0;
        }

        .doc-prose p {
          margin: 0 0 16px 0;
          color: #334155;
          font-size: 14.5px;
          line-height: 1.7;
        }

        .doc-prose ul, .doc-prose ol {
          margin: 0 0 20px 0;
          padding-left: 24px;
          color: #334155;
          line-height: 1.7;
        }

        .doc-prose li {
          margin-bottom: 8px;
        }

        /* Full content tables with no ellipsis clipping */
        .doc-table {
          width: 100%;
          border-collapse: collapse;
          margin: 18px 0 26px 0;
          font-size: 13px;
          table-layout: auto;
        }

        .doc-table th, .doc-table td {
          border: 1px solid #e2e8f0;
          padding: 11px 15px;
          text-align: left;
          white-space: normal !important;
          text-overflow: clip !important;
          overflow: visible !important;
          max-width: none !important;
          word-break: break-word !important;
          line-height: 1.65;
        }

        .doc-table th {
          background-color: #f8fafc;
          font-weight: 700;
          color: #1e293b;
        }

        .doc-table code {
          background: #f1f5f9;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
          color: #0f172a;
          font-size: 12px;
        }

        .doc-grid-3 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
          margin: 18px 0 24px 0;
        }

        .doc-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px 18px;
        }

        .doc-card h4 {
          margin: 0 0 8px 0;
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
        }

        .doc-card p {
          margin: 0;
          font-size: 13px;
          color: #475569;
          line-height: 1.5;
        }

        .doc-flow {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 14px 18px;
          margin: 18px 0 24px 0;
        }

        .doc-flow-step {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12.5px;
          font-weight: 600;
          color: #1e293b;
        }

        .doc-flow-arrow {
          color: #94a3b8;
          font-weight: 700;
        }

        .doc-stages {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 14px;
          margin: 16px 0 24px 0;
        }

        /* Minimalist & clean cards without cheesy AI colored top border */
        .doc-stage {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          padding: 16px 18px;
          border-radius: 8px;
          transition: all 0.2s ease;
        }

        .doc-stage:hover {
          border-color: #cbd5e1;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }

        .doc-stage strong {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13.5px;
          margin-bottom: 6px;
          color: #0f172a;
        }

        .doc-stage p {
          margin: 0;
          font-size: 12.5px;
          color: #64748b;
          line-height: 1.55;
        }

        /* Gỡ bỏ hoàn toàn viền top màu cũ */
        .doc-stage.hot, .doc-stage.warm, .doc-stage.cold {
          border-left: none !important;
          border-top: 1px solid #e2e8f0 !important;
        }

        .doc-code-box {
          background: #0f172a;
          color: #f8fafc;
          padding: 14px 18px;
          border-radius: 6px;
          font-family: monospace;
          font-size: 13px;
          margin: 14px 0 20px 0;
          overflow-x: auto;
          line-height: 1.6;
        }

        .doc-article-footer {
          margin-top: 48px;
          padding-top: 24px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .doc-footer-info {
          font-size: 13px;
          color: #64748b;
        }

        /* Column 3: Right TOC Sidebar */
        .doc-col-toc {
          width: 250px;
          flex-shrink: 0;
          border-left: 1px solid #e2e8f0;
          background: #f8fafc;
          height: 100%;
          overflow-y: auto;
        }

        .doc-col-toc-inner {
          padding: 24px 16px;
        }

        .doc-toc-header {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.5px;
          color: #94a3b8;
          margin-bottom: 12px;
        }

        .doc-toc-links {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .doc-toc-link {
          font-size: 12.5px;
          color: #64748b;
          cursor: pointer;
          padding: 6px 10px;
          border-radius: 4px;
          transition: all 0.15s;
          line-height: 1.4;
          border-left: none !important;
        }

        .doc-toc-link:hover {
          color: #0284c7;
          background: #f1f5f9;
        }

        .doc-toc-link.active {
          color: #0284c7;
          font-weight: 600;
          background: #f0f9ff;
          border-left: none !important;
          padding-left: 10px;
        }

        .doc-toc-empty {
          font-size: 12px;
          color: #94a3b8;
          font-style: italic;
        }

        .doc-toc-quick-box {
          margin-top: 36px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 14px;
        }

        .doc-quick-title {
          font-size: 12.5px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 6px;
        }

        .doc-quick-desc {
          font-size: 11.5px;
          color: #64748b;
          line-height: 1.5;
          margin: 0 0 10px 0;
        }

        .doc-quick-btn {
          width: 100%;
          background: #0f172a;
          color: #ffffff;
          border: none;
          padding: 6px 0;
          border-radius: 4px;
          font-size: 11.5px;
          font-weight: 600;
          cursor: pointer;
        }

        .doc-quick-btn:hover {
          background: #1e293b;
        }

        .doc-toc-copyright-box {
          margin-top: 14px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-left: 3px solid #dc2626;
          border-radius: 6px;
          padding: 12px;
        }

        .doc-copyright-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          font-weight: 800;
          color: #dc2626;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }

        .doc-copyright-title {
          font-size: 12px;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.3;
        }

        .doc-copyright-subtitle {
          font-size: 11px;
          font-weight: 600;
          color: #475569;
          margin-bottom: 8px;
        }

        .doc-copyright-statement {
          font-size: 10.8px;
          color: #64748b;
          line-height: 1.55;
          margin: 0 0 10px 0;
          text-align: justify;
        }

        .doc-copyright-links {
          display: flex;
          flex-direction: column;
          gap: 5px;
          border-top: 1px dashed #e2e8f0;
          padding-top: 8px;
        }

        .doc-copyright-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: #0284c7;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.15s;
        }

        .doc-copyright-link:hover {
          color: #0369a1;
          text-decoration: underline;
        }

        @media (max-width: 1200px) {
          .doc-col-toc {
            display: none;
          }
        }

        @media (max-width: 900px) {
          .doc-col-sidebar {
            display: none;
          }
          .doc-header-search-bar {
            display: none;
          }
          .doc-col-content {
            padding: 24px 20px;
          }
        }
      `}</style>
    </div>
  );
};

export default DocumentationPage;
