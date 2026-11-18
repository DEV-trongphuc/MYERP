import React from 'react';

const boxBase: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  padding: '10px 12px',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
};

const tagStyle = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-block',
  fontSize: '10px',
  fontWeight: 800,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  padding: '2px 6px',
  borderRadius: '4px',
  background: bg,
  color,
  marginBottom: '4px',
});

const arrowDown = (label?: string) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '6px 0' }}>
    <div style={{ width: '2px', height: '12px', background: '#94a3b8' }} />
    {label && (
      <span
        style={{
          fontSize: '10.5px',
          fontWeight: 600,
          color: '#475569',
          background: '#f1f5f9',
          padding: '1px 8px',
          borderRadius: '999px',
          border: '1px solid #e2e8f0',
          margin: '2px 0',
        }}
      >
        {label}
      </span>
    )}
    <div
      style={{
        width: 0,
        height: 0,
        borderLeft: '5px solid transparent',
        borderRight: '5px solid transparent',
        borderTop: '7px solid #64748b',
      }}
    />
  </div>
);

export const ArchitectureDiagramRenderer: React.FC<{
  type: 'c4' | 'approval-state' | 'lead-pipeline' | 'ai-sequence' | 'core-erd' | 'z-index';
}> = ({ type }) => {
  if (type === 'c4') {
    return (
      <div className="arch-diagram-card">
        <div className="arch-diagram-header">
          <span>C4 CONTAINER ARCHITECTURE TOPOLOGY</span>
          <span className="arch-diagram-chip">Live Production Path</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <div style={{ ...boxBase, width: '100%', maxWidth: '540px', borderColor: '#0284c7', background: '#f0f9ff', textAlign: 'center' }}>
            <span style={tagStyle('#0284c7', '#ffffff')}>Client Tier</span>
            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>React 19.2 SPA & Pass-Through PWA (Vite 8 + Zustand)</div>
            <div style={{ fontSize: '11.5px', color: '#475569' }}>81 Pages • Persistent AppTabs • HTTPS REST + SSE EventStream</div>
          </div>

          {arrowDown('HTTPS / REST / SSE')}

          <div style={{ ...boxBase, width: '100%', maxWidth: '540px', textAlign: 'center' }}>
            <span style={tagStyle('#334155', '#ffffff')}>HTTP Edge & Cache Rules</span>
            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>LiteSpeed / Apache Edge (.htaccess + sw.js)</div>
            <div style={{ fontSize: '11.5px', color: '#475569' }}>alt-php81 • no-store index.html & version.json • strict 404 missing chunks</div>
          </div>

          {arrowDown('Rewrites & Route Dispatch')}

          <div className="arch-grid-3">
            <div style={{ ...boxBase, borderTop: '3px solid #BD1D2D' }}>
              <span style={tagStyle('#fef2f2', '#BD1D2D')}>Gateway Bridge</span>
              <div style={{ fontWeight: 700, fontSize: '12.5px', color: '#0f172a' }}>backend/api.php</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                Legacy actions &amp; chuẩn hóa tiền tố /v1/, /api/ &rarr; chuyển 57+ REST domains
              </div>
            </div>
            <div style={{ ...boxBase, borderTop: '3px solid #0284c7' }}>
              <span style={tagStyle('#f0f9ff', '#0284c7')}>OOP Front-Controller</span>
              <div style={{ fontWeight: 700, fontSize: '12.5px', color: '#0f172a' }}>backend/index.php</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                65+ Domain Controllers • JWT HS256 • 6 Chat Traits • TenantConfigService
              </div>
            </div>
            <div style={{ ...boxBase, borderTop: '3px solid #059669' }}>
              <span style={tagStyle('#ecfdf5', '#059669')}>Automation Engine</span>
              <div style={{ fontWeight: 700, fontSize: '12.5px', color: '#0f172a' }}>backend/automation/</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                FlowExecutor + 18 Workers • RAM Stats Buffering • Web Tracking & Campaigns
              </div>
            </div>
          </div>

          {arrowDown('PDO Prepared + Row Locks (FOR UPDATE) + Non-Blocking Cron')}

          <div className="arch-grid-3">
            <div style={{ ...boxBase, background: '#f8fafc' }}>
              <span style={tagStyle('#e2e8f0', '#334155')}>Primary Store</span>
              <div style={{ fontWeight: 700, fontSize: '12.5px', color: '#0f172a' }}>MySQL / MariaDB InnoDB</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                ~251 bảng • utf8mb4 • Soft-Delete & ACID Transactions
              </div>
            </div>
            <div style={{ ...boxBase, background: '#f8fafc' }}>
              <span style={tagStyle('#e2e8f0', '#334155')}>AI & Ephemeral Cache</span>
              <div style={{ fontWeight: 700, fontSize: '12.5px', color: '#0f172a' }}>Gemini 3.5 Flash-Lite + Redis</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                WorkChat AI Swarm, Groq Qwen Lab, Presence Cache TTL 60s
              </div>
            </div>
            <div style={{ ...boxBase, background: '#f8fafc' }}>
              <span style={tagStyle('#e2e8f0', '#334155')}>Cron & Integrations</span>
              <div style={{ fontWeight: 700, fontSize: '12.5px', color: '#0f172a' }}>cron_master.php + APIs</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                Google Sheets 2-Way, Meta CAPI, Zalo OA/ZNS, AWS SES/SMTP
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'approval-state') {
    return (
      <div className="arch-diagram-card">
        <div className="arch-diagram-header">
          <span>3-LEVEL FINANCIAL APPROVAL & ANTI-SELF-APPROVAL STATE MACHINE</span>
          <span className="arch-diagram-chip">SELECT ... FOR UPDATE</span>
        </div>
        <div className="arch-flow-wrap">
          <div className="arch-state-node">
            <span style={tagStyle('#f1f5f9', '#475569')}>Draft / Init</span>
            <div className="arch-node-title">Pending Level 1</div>
            <div className="arch-node-sub">Phiếu chi / Đề xuất / Cọc (created_by)</div>
          </div>
          <span className="arch-flow-arrow">-&gt;</span>
          <div className="arch-state-node" style={{ borderColor: '#0284c7', background: '#f0f9ff' }}>
            <span style={tagStyle('#0284c7', '#ffffff')}>TX + Lock</span>
            <div className="arch-node-title">Pending Level 2</div>
            <div className="arch-node-sub">Kiểm Anti-Self-Approval & quy trình cấp 1</div>
          </div>
          <span className="arch-flow-arrow">-&gt;</span>
          <div className="arch-state-node" style={{ borderColor: '#d97706', background: '#fffbeb' }}>
            <span style={tagStyle('#d97706', '#ffffff')}>Final Gate</span>
            <div className="arch-node-title">Pending Level 3</div>
            <div className="arch-node-sub">Director / Admin / Kế toán trưởng</div>
          </div>
          <span className="arch-flow-arrow">-&gt;</span>
          <div className="arch-state-node" style={{ borderColor: '#059669', background: '#ecfdf5' }}>
            <span style={tagStyle('#059669', '#ffffff')}>Approved</span>
            <div className="arch-node-title">Approved / Paid</div>
            <div className="arch-node-sub">Giải ngân & đồng bộ sổ cái thực thu/chi</div>
          </div>
        </div>
        <div style={{ marginTop: '12px', padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '12px', color: '#991b1b', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <span><strong>Nhánh Từ chối / Lỗi:</strong> Từ chối ở bất kỳ cấp nào -&gt; trạng thái <code>rejected</code> (ghi log lý do) hoặc tự <code>rollBack()</code> nếu HTTP &gt;= 400.</span>
          <span><strong>HTTP 403:</strong> Chặn ngay lập tức nếu người tạo tự duyệt ở cấp không cho phép self-approve.</span>
        </div>
      </div>
    );
  }

  if (type === 'lead-pipeline') {
    const steps = [
      { n: '01', title: 'Ingest', sub: 'Google Sheets (cron_sync), Webhook, Form API' },
      { n: '02', title: 'Normalize', sub: 'Chuẩn hóa SĐT / Email & sanitize payload' },
      { n: '03', title: 'Block Check', sub: 'Kiểm tra danh sách chặn / global exclusion' },
      { n: '04', title: 'CRM Dup Check', sub: 'Trùng khách hàng đang có Owner -> giữ Owner & cập nhật lịch sử' },
      { n: '05', title: 'Routing Rules', sub: 'evaluateRules() định tuyến đúng Target Round' },
      { n: '06', title: 'AI Screener', sub: 'Nghi spam / không đạt chuẩn -> giữ tại Gatekeeper (held)' },
      { n: '07', title: 'Round-Robin + Shift', sub: 'Chọn TVV khả dụng theo ca trực, nghỉ phép & hạn mức' },
      { n: '08', title: 'ACID + 2-Way Sync', sub: 'Transaction contacts + distribution_logs -> đẩy ngược Sheet' },
    ];
    return (
      <div className="arch-diagram-card">
        <div className="arch-diagram-header">
          <span>LEAD INGESTION, GATEKEEPER & FAIR-SHARE PIPELINE</span>
          <span className="arch-diagram-chip">2-Way Sync Safe</span>
        </div>
        <div className="arch-grid-4">
          {steps.map(st => (
            <div key={st.n} style={boxBase}>
              <span style={tagStyle('#0f172a', '#ffffff')}>Bước {st.n}</span>
              <div style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a', marginTop: '2px' }}>{st.title}</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', lineHeight: 1.4 }}>{st.sub}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'ai-sequence') {
    const seq = [
      { who: 'WorkChat UI + useChatStore', msg: 'Gửi câu hỏi + pathname + active_entity + __MYERP_CONTACTS_ACTIVE_FILTERS__' },
      { who: 'ChatGeminiEngineTrait', msg: 'Lọc lịch sử nặng, đọc <working_memory> 2 tầng & inject 5–9 scoped tools theo Agent ID' },
      { who: 'Gemini 3.5 Flash-Lite + AgentTools', msg: 'Thực thi Function Calling (có hỗ trợ chạy song song nhiều tool)' },
      { who: 'MySQL (Tenant & RBAC Scoped)', msg: 'Truy vấn số liệu thực tế; kiểm tra owner_id / collaborator_ids / quyền từng phân hệ' },
      { who: 'Chat Output & Working Memory', msg: 'Lưu active_filters/entity_refs mới -> trả Markdown, Chart hoặc ActionProposalCard xác nhận' },
    ];
    return (
      <div className="arch-diagram-card">
        <div className="arch-diagram-header">
          <span>SI IDEAS AI SWARM EXECUTION SEQUENCE</span>
          <span className="arch-diagram-chip">Human-in-the-Loop</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {seq.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 12px' }}>
              <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#0f172a', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, flexShrink: 0 }}>
                {idx + 1}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0284c7' }}>{item.who}</div>
                <div style={{ fontSize: '12px', color: '#334155' }}>{item.msg}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'z-index') {
    const tiers = [
      { z: '10005 – 11000', tier: 'Tier 1 – 2 (Base Floating)', desc: 'ChatFloatingLauncher (10005), WorkChatModal (10010), MobileSidebarDrawer (11000)' },
      { z: '2147483620 – 25', tier: 'Tier 3 (Primary Drawers)', desc: 'Global Drawer Backdrop (2147483620) & CustomerProfileDrawer / CampaignDrawer (2147483625)' },
      { z: '2147483635', tier: 'Tier 4 (Nested Drawers)', desc: 'WorkspaceTaskDrawer, TicketDrawer, DepositDetailDrawer, ExpenseQuickViewDrawer, ApprovalDetailDrawer' },
      { z: '2147483641 – 44', tier: 'Tier 5A (Modals trên Drawer)', desc: 'Submodals trong Hồ sơ (2147483641), Standard CustomModals (2147483644)' },
      { z: '2147483646 – 47', tier: 'Tier 5B (Topmost System)', desc: 'ConfirmModal / Lightbox / Ký xác nhận (2147483646) & Toast Notification Portal (2147483647)' },
    ];
    return (
      <div className="arch-diagram-card">
        <div className="arch-diagram-header">
          <span>6-TIER OVERLAY Z-INDEX & LIFO ESCAPE STACK</span>
          <span className="arch-diagram-chip">src/utils/overlayStack.ts</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {tiers.map(t => (
            <div key={t.tier} style={{ display: 'grid', gridTemplateColumns: '140px 180px 1fr', gap: '10px', alignItems: 'center', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 12px', fontSize: '12px' }}>
              <code style={{ fontWeight: 700, color: '#0284c7', background: '#f0f9ff', padding: '2px 6px', borderRadius: '4px', textAlign: 'center' }}>{t.z}</code>
              <strong style={{ color: '#0f172a' }}>{t.tier}</strong>
              <span style={{ color: '#475569' }}>{t.desc}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // core-erd
  const clusters = [
    {
      title: '1. Multi-Tenant & RBAC',
      color: '#0f172a',
      tables: ['tenants (1) -> users, teams, pipeline_stages', 'tenant_roles, tenant_approval_workflows', 'tenant_notification_rules, system_settings'],
    },
    {
      title: '2. CRM & Tuyển sinh 14 Bước',
      color: '#0284c7',
      tables: ['contacts (owner_id, tenant_id, deleted_at)', 'distribution_rounds -> distribution_logs', 'deals, quotes, activities, tickets'],
    },
    {
      title: '3. Tài chính, Cọc & PO/SO',
      color: '#BD1D2D',
      tables: ['deposits -> deposit_milestones', 'sales_orders, purchase_orders, invoices', 'expenses (3-level approval), cooperation_slips'],
    },
    {
      title: '4. Học vụ & Nhân sự HRM',
      color: '#059669',
      tables: ['student_subject_grades, student_postpone_records', 'mentoring_1on1_configs -> mentoring_1on1_bookings', 'hrm_leave_requests, check_ins, monthly_payslips, hrm_assets'],
    },
    {
      title: '5. WorkChat & AI Swarm',
      color: '#7c3aed',
      tables: ['chat_conversations -> chat_messages, chat_participants', 'ai_query_audit_logs, ai_user_memories', 'ai_knowledge_base (RAG tenant scoped)'],
    },
    {
      title: '6. Marketing Automation (workspace_id)',
      color: '#d97706',
      tables: ['subscribers, lists, segments, campaigns', 'flows -> subscriber_flow_states, flow_enrollments', 'web_visitors, web_sessions, web_daily_stats, zalo/meta'],
    },
  ];
  return (
    <div className="arch-diagram-card">
      <div className="arch-diagram-header">
        <span>CORE MULTI-TENANT ENTITY CLUSTERS (~251 TABLES)</span>
        <span className="arch-diagram-chip">tenant_id + workspace_id</span>
      </div>
      <div className="arch-grid-3">
        {clusters.map(c => (
          <div key={c.title} style={{ ...boxBase, borderTop: `3px solid ${c.color}` }}>
            <div style={{ fontWeight: 800, fontSize: '12px', color: '#0f172a', marginBottom: '6px' }}>{c.title}</div>
            <ul style={{ margin: 0, paddingLeft: '14px', fontSize: '11px', color: '#475569', lineHeight: 1.55 }}>
              {c.tables.map((t, i) => (
                <li key={i}><code>{t}</code></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};
