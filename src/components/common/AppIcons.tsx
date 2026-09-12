import React from 'react';

interface AppIconProps {
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const AppIcon: React.FC<AppIconProps> = ({ name, size = 56, className = '', style = {} }) => {
  const normName = (name || '').toLowerCase().trim();

  // Common shadow filter inside each SVG
  const filterDef = (id: string) => (
    <filter id={id} x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodOpacity="0.25" />
    </filter>
  );

  // 1. QUY TRÌNH & PHÊ DUYỆT (Style 1B - Đỏ Ruby - Bảng kẹp hồ sơ & bút ký mạ vàng)
  if (normName.includes('quy trình') || normName.includes('phê duyệt')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_wf_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#991b1b" />
          </linearGradient>
          {filterDef('ai_wf_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_wf_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <rect x="15" y="14" width="26" height="30" rx="4" fill="#7f1d1d" />
        <rect x="17" y="16" width="22" height="26" rx="2.5" fill="#ffffff" filter="url(#ai_wf_sh)" />
        <rect x="23" y="12" width="10" height="5" rx="1.5" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="0.8" />
        <circle cx="28" cy="14.5" r="1.2" fill="#64748b" />
        <rect x="21" y="22" width="13" height="2" rx="1" fill="#cbd5e1" />
        <rect x="21" y="27" width="14" height="2" rx="1" fill="#cbd5e1" />
        <rect x="21" y="32" width="9" height="2" rx="1" fill="#cbd5e1" />
        <g transform="rotate(45 37 34)">
          <rect x="35" y="24" width="4" height="14" rx="1" fill="#fbbf24" stroke="#ffffff" strokeWidth="0.8" />
          <path d="M35 38L37 41L39 38H35Z" fill="#1e293b" />
        </g>
      </svg>
    );
  }

  // 2. BÀN LÀM VIỆC (Xanh Emerald - Khay nhiệm vụ card)
  if (normName.includes('bàn làm việc') || normName.includes('workspace')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_ws_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          {filterDef('ai_ws_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_ws_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <rect x="14" y="14" width="28" height="28" rx="5" fill="#ffffff" filter="url(#ai_ws_sh)" />
        <rect x="18" y="18" width="20" height="6" rx="2" fill="#ecfdf5" />
        <rect x="18" y="18" width="4" height="6" rx="2" fill="#10b981" />
        <rect x="24" y="20.5" width="11" height="1.8" rx="0.9" fill="#047857" />
        <rect x="18" y="26" width="20" height="6" rx="2" fill="#f0fdf4" />
        <rect x="18" y="26" width="4" height="6" rx="2" fill="#34d399" />
        <rect x="24" y="28.5" width="8" height="1.8" rx="0.9" fill="#059669" />
        <rect x="18" y="34" width="20" height="5" rx="2" fill="#f0fdf4" />
        <rect x="18" y="34" width="4" height="5" rx="2" fill="#6ee7b7" />
      </svg>
    );
  }

  // 3. QUẢN LÝ CÔNG / CHẤM CÔNG (Style 2B - Cam Hoàng Hôn - Lịch ngày công & ca làm việc)
  if (normName.includes('chấm công') || normName.includes('quản lý công') || normName.includes('duyệt công') || normName.includes('attendance')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_att_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff7a00" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
          {filterDef('ai_att_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_att_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <rect x="14" y="16" width="28" height="26" rx="5" fill="#ffffff" filter="url(#ai_att_sh)" />
        <path d="M14 21C14 18.2386 16.2386 16 19 16H37C39.7614 16 42 18.2386 42 21V23H14V21Z" fill="#ea580c" />
        <rect x="20" y="13.5" width="2.8" height="5" rx="1.4" fill="#ffffff" />
        <rect x="33.2" y="13.5" width="2.8" height="5" rx="1.4" fill="#ffffff" />
        <circle cx="20" cy="28" r="1.8" fill="#ea580c" />
        <circle cx="25.3" cy="28" r="1.8" fill="#ea580c" />
        <circle cx="30.6" cy="28" r="1.8" fill="#ea580c" />
        <circle cx="36" cy="28" r="1.8" fill="#ea580c" />
        <circle cx="20" cy="34" r="1.8" fill="#ea580c" />
        <circle cx="25.3" cy="34" r="1.8" fill="#ea580c" />
        <circle cx="30.6" cy="34" r="1.8" fill="#cbd5e1" />
        <circle cx="36" cy="34" r="1.8" fill="#cbd5e1" />
      </svg>
    );
  }

  // 4. BẢNG TIN NỘI BỘ (Tờ báo feed tin tức đa tầng)
  if (normName.includes('bảng tin') || normName.includes('feed')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_feed_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d946ef" />
            <stop offset="100%" stopColor="#a21caf" />
          </linearGradient>
          {filterDef('ai_feed_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_feed_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <rect x="19" y="13" width="23" height="26" rx="3.5" fill="#fdf4ff" opacity="0.6" />
        <rect x="14" y="16" width="25" height="27" rx="3.5" fill="#ffffff" filter="url(#ai_feed_sh)" />
        <rect x="17" y="19" width="19" height="3" rx="1" fill="#a21caf" />
        <rect x="17" y="24" width="8" height="8" rx="1.5" fill="#fae8ff" stroke="#e879f9" strokeWidth="0.6" />
        <rect x="27" y="24.5" width="9" height="1.8" rx="0.9" fill="#64748b" />
        <rect x="27" y="27.5" width="9" height="1.8" rx="0.9" fill="#cbd5e1" />
        <rect x="27" y="30.5" width="6" height="1.8" rx="0.9" fill="#cbd5e1" />
        <rect x="17" y="35" width="9" height="1.6" rx="0.8" fill="#94a3b8" />
        <rect x="17" y="38" width="7" height="1.6" rx="0.8" fill="#cbd5e1" />
        <rect x="28" y="35" width="8" height="1.6" rx="0.8" fill="#94a3b8" />
        <rect x="28" y="38" width="5" height="1.6" rx="0.8" fill="#cbd5e1" />
      </svg>
    );
  }

  // 5. DASHBOARD (Xanh Royal Blue - Chỉ số & KPI)
  if (normName.includes('dashboard') || normName === 'tổng quan') {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_dash_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1e40af" />
          </linearGradient>
          {filterDef('ai_dash_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_dash_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <rect x="13" y="14" width="30" height="28" rx="5" fill="#ffffff" filter="url(#ai_dash_sh)" />
        <rect x="16" y="17" width="11" height="9" rx="2" fill="#dbeafe" />
        <rect x="18" y="19" width="7" height="2" rx="1" fill="#1d4ed8" />
        <rect x="18" y="23" width="4" height="1.5" rx="0.75" fill="#93c5fd" />
        <rect x="29" y="17" width="11" height="9" rx="2" fill="#eff6ff" />
        <rect x="31" y="19" width="7" height="2" rx="1" fill="#2563eb" />
        <rect x="31" y="23" width="5" height="1.5" rx="0.75" fill="#bfdbfe" />
        <rect x="17" y="32" width="3" height="7" rx="1" fill="#93c5fd" />
        <rect x="22" y="29" width="3" height="10" rx="1" fill="#3b82f6" />
        <rect x="27" y="34" width="3" height="5" rx="1" fill="#bfdbfe" />
        <rect x="32" y="28" width="3" height="11" rx="1" fill="#1d4ed8" />
        <rect x="37" y="30" width="3" height="9" rx="1" fill="#2563eb" />
      </svg>
    );
  }

  // 6. LỊCH TRÌNH (Tím Indigo)
  if (normName === 'lịch trình' || normName === 'lịch biểu' || normName === 'calendar') {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_cal_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#4338ca" />
          </linearGradient>
          {filterDef('ai_cal_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_cal_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <rect x="14" y="16" width="28" height="26" rx="5" fill="#ffffff" filter="url(#ai_cal_sh)" />
        <path d="M14 21C14 18.2386 16.2386 16 19 16H37C39.7614 16 42 18.2386 42 21V23H14V21Z" fill="#4338ca" />
        <rect x="20" y="13.5" width="2.8" height="5" rx="1.4" fill="#ffffff" />
        <rect x="33.2" y="13.5" width="2.8" height="5" rx="1.4" fill="#ffffff" />
        <rect x="18" y="26" width="4" height="4" rx="1" fill="#e0e7ff" />
        <rect x="24" y="26" width="4" height="4" rx="1" fill="#e0e7ff" />
        <rect x="30" y="26" width="4" height="4" rx="1" fill="#e0e7ff" />
        <rect x="18" y="32" width="4" height="4" rx="1" fill="#e0e7ff" />
        <rect x="24" y="32" width="4" height="4" rx="1" fill="#4f46e5" />
        <rect x="30" y="32" width="4" height="4" rx="1" fill="#e0e7ff" />
      </svg>
    );
  }

  // 7. TIỀM NĂNG / KHÁCH HÀNG (Hồng San Hô - Coral Rose)
  if (normName.includes('tiềm năng') || normName.includes('khách hàng') || normName.includes('contacts')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_cont_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#be123c" />
          </linearGradient>
          {filterDef('ai_cont_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_cont_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <rect x="14" y="16" width="28" height="24" rx="4.5" fill="#ffffff" filter="url(#ai_cont_sh)" />
        <circle cx="21.5" cy="24" r="3.5" fill="#f43f5e" />
        <path d="M17 32C17 29.5 19 28.5 21.5 28.5C24 28.5 26 29.5 26 32" stroke="#f43f5e" strokeWidth="1.6" strokeLinecap="round" />
        <rect x="28" y="22" width="10" height="2" rx="1" fill="#94a3b8" />
        <rect x="28" y="26" width="8" height="1.8" rx="0.9" fill="#cbd5e1" />
        <rect x="28" y="30" width="11" height="1.8" rx="0.9" fill="#cbd5e1" />
      </svg>
    );
  }

  // 8. PIPELINE (Teal Cyan - Phễu chuyển đổi bán hàng)
  if (normName.includes('pipeline') || normName.includes('deals')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_pipe_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#0f766e" />
          </linearGradient>
          {filterDef('ai_pipe_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_pipe_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <path d="M15 17H41L36 24H20L15 17Z" fill="#ffffff" filter="url(#ai_pipe_sh)" />
        <path d="M21 26H35L32 32H24L21 26Z" fill="#a5f3fc" />
        <path d="M25 34H31L29 40H27L25 34Z" fill="#38bdf8" />
      </svg>
    );
  }

  // 9. HỌC VIÊN (Tím Violet - Mũ cử nhân tốt nghiệp)
  if (normName.includes('học viên') || normName.includes('sinh viên') || normName.includes('students') || normName.includes('nộp hồ sơ') || normName.includes('lệ phí')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_stu_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#6d28d9" />
          </linearGradient>
          {filterDef('ai_stu_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_stu_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <path d="M28 16L14 23L28 30L42 23L28 16Z" fill="#ffffff" filter="url(#ai_stu_sh)" />
        <path d="M20 26.5V33.5C20 36 24 38 28 38C32 38 36 36 36 33.5V26.5" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M38 25V33" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="38" cy="34" r="1.5" fill="#fbbf24" />
      </svg>
    );
  }

  // 10. NHẬT KÝ DATA (Xanh Sky - Database 3 tầng)
  if (normName.includes('nhật ký data') || normName === 'data' || normName.includes('kho data')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_data_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#075985" />
          </linearGradient>
          {filterDef('ai_data_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_data_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <ellipse cx="28" cy="19" rx="14" ry="4" fill="#ffffff" filter="url(#ai_data_sh)" />
        <path d="M14 19V26C14 28.2 20.3 30 28 30C35.7 30 42 28.2 42 26V19" fill="#e0f2fe" />
        <ellipse cx="28" cy="26" rx="14" ry="4" fill="#ffffff" />
        <circle cx="37" cy="23" r="1" fill="#0284c7" />
        <path d="M14 26V34C14 36.2 20.3 38 28 38C35.7 38 42 36.2 42 34V26" fill="#bae6fd" />
        <ellipse cx="28" cy="34" rx="14" ry="4" fill="#ffffff" />
        <circle cx="37" cy="31" r="1" fill="#0284c7" />
      </svg>
    );
  }

  // 11. ĐỐI SOÁT CÔNG BẰNG (Vàng Hổ Phách - Cân vàng công lý)
  if (normName.includes('đối soát') || normName.includes('fair-share')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_fair_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          {filterDef('ai_fair_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_fair_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <rect x="26.5" y="16" width="3" height="22" rx="1.5" fill="#ffffff" filter="url(#ai_fair_sh)" />
        <rect x="22" y="37" width="12" height="3" rx="1.5" fill="#ffffff" />
        <rect x="15" y="19" width="26" height="2.5" rx="1.2" fill="#ffffff" />
        <path d="M17 21L14 28H22L19 21" stroke="#fef3c7" strokeWidth="1.2" />
        <path d="M13 28C13 30.5 16 31.5 18 31.5C20 31.5 23 30.5 23 28H13Z" fill="#ffffff" />
        <path d="M37 21L34 28H42L39 21" stroke="#fef3c7" strokeWidth="1.2" />
        <path d="M33 28C33 30.5 36 31.5 38 31.5C40 31.5 43 30.5 43 28H33Z" fill="#ffffff" />
      </svg>
    );
  }

  // 12. AI PRE-SCREENER / GATEKEEPER (Matrix Teal - Khiên bảo vệ công nghệ AI)
  if (normName.includes('gatekeeper') || normName.includes('pre-screener') || (normName.includes('ai') && !normName.includes('huấn luyện'))) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_gate_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0d9488" />
            <stop offset="100%" stopColor="#134e4a" />
          </linearGradient>
          {filterDef('ai_gate_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_gate_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <path d="M28 14L39 18V26C39 33 34 38 28 41C22 38 17 33 17 26V18L28 14Z" fill="#ffffff" filter="url(#ai_gate_sh)" />
        <circle cx="28" cy="26" r="3.5" fill="#0f766e" />
        <path d="M28 20V22.5" stroke="#0f766e" strokeWidth="2" strokeLinecap="round" />
        <path d="M28 29.5V32" stroke="#0f766e" strokeWidth="2" strokeLinecap="round" />
        <path d="M22 26H24.5" stroke="#0f766e" strokeWidth="2" strokeLinecap="round" />
        <path d="M31.5 26H34" stroke="#0f766e" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  // 13. TICKET DATA LỖI (Đỏ Cam Cảnh Báo)
  if (normName.includes('ticket data lỗi') || normName.includes('ticket lỗi') || (normName.includes('ticket') && !normName.includes('hỗ trợ') && !normName.includes('helpdesk'))) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_ticket_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#9a3412" />
          </linearGradient>
          {filterDef('ai_ticket_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_ticket_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <path d="M15 19C15 17.8954 15.8954 17 17 17H39C40.1046 17 41 17.8954 41 19V25C39 25 37.5 26.5 37.5 28C37.5 29.5 39 31 41 31V37C41 38.1046 40.1046 39 39 39H17C15.8954 39 15 38.1046 15 37V31C17 31 18.5 29.5 18.5 28C18.5 26.5 17 25 15 25V19Z" fill="#ffffff" filter="url(#ai_ticket_sh)" />
        <rect x="27" y="21" width="2.5" height="7" rx="1.2" fill="#ea580c" />
        <circle cx="28.2" cy="32" r="1.4" fill="#ea580c" />
      </svg>
    );
  }

  // 14. HELPDESK / TICKET HỖ TRỢ (Xanh Hải Quân Marine Navy - Phao Cứu Hộ)
  if (normName.includes('helpdesk') || normName.includes('hỗ trợ')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_help_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </linearGradient>
          {filterDef('ai_help_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_help_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <circle cx="28" cy="28" r="14" fill="#ffffff" filter="url(#ai_help_sh)" />
        <circle cx="28" cy="28" r="6" fill="#1e3a8a" />
        <path d="M28 14V22" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
        <path d="M28 34V42" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
        <path d="M14 28H22" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
        <path d="M34 28H42" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  // 15. PURCHASE ORDER / CHI PHÍ (Bank Jade - Thẻ tín dụng & chi tiêu PO)
  if (normName.includes('purchase order') || normName.includes('chi phí') || normName.includes('expenses')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_po_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="100%" stopColor="#064e3b" />
          </linearGradient>
          {filterDef('ai_po_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_po_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <rect x="13" y="17" width="30" height="22" rx="4.5" fill="#ffffff" filter="url(#ai_po_sh)" />
        <rect x="13" y="22" width="30" height="4" fill="#064e3b" />
        <rect x="17" y="28" width="5.5" height="4.5" rx="1" fill="#fbbf24" stroke="#d97706" strokeWidth="0.5" />
        <rect x="25" y="30" width="13" height="2" rx="1" fill="#cbd5e1" />
      </svg>
    );
  }

  // 16. SALES ORDER / ĐẶT CỌC (Vàng Kim Hoàng Gia - Biên nhận tiền ₫)
  if (normName.includes('sales order') || normName.includes('đặt cọc') || normName.includes('deposits')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_so_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#ca8a04" />
          </linearGradient>
          {filterDef('ai_so_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_so_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <path d="M16 15H40V39L36 37L32 39L28 37L24 39L20 37L16 39V15Z" fill="#ffffff" filter="url(#ai_so_sh)" />
        <circle cx="28" cy="22" r="3.5" fill="#fef9c3" />
        <text x="28" y="24.5" fontSize="7" fontWeight="900" fill="#ca8a04" textAnchor="middle">₫</text>
        <rect x="20" y="28" width="16" height="2" rx="1" fill="#cbd5e1" />
        <rect x="20" y="32" width="11" height="2" rx="1" fill="#cbd5e1" />
      </svg>
    );
  }

  // 17. DỰ BÁO DÒNG TIỀN (Ocean Teal - Vòng chu chuyển tiền tệ)
  if (normName.includes('dòng tiền') || normName.includes('cash-flow')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_cash_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#0f766e" />
          </linearGradient>
          {filterDef('ai_cash_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_cash_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <circle cx="28" cy="28" r="13" stroke="#ccfbf1" strokeWidth="3" strokeDasharray="24 16" filter="url(#ai_cash_sh)" />
        <path d="M37 17L42 20L38 24" fill="#ffffff" />
        <path d="M19 39L14 36L18 32" fill="#ffffff" />
        <circle cx="28" cy="28" r="6" fill="#ffffff" />
        <text x="28" y="30.5" fontSize="7.5" fontWeight="900" fill="#0f766e" textAnchor="middle">$</text>
      </svg>
    );
  }

  // 18. CHƯƠNG TRÌNH / DỰ ÁN (Cobalt Azure - Tòa cao ốc dự án)
  if (normName === 'chương trình' || normName.includes('projects') || normName.includes('dự án')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_prog_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          {filterDef('ai_prog_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_prog_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <path d="M17 39V19C17 17.8954 17.8954 17 19 17H31C32.1046 17 33 17.8954 33 19V39H17Z" fill="#ffffff" filter="url(#ai_prog_sh)" />
        <path d="M33 25H38C39.1046 25 40 25.8954 40 27V39H33V25Z" fill="#bae6fd" />
        <rect x="21" y="21" width="3" height="3" rx="0.5" fill="#1d4ed8" />
        <rect x="26" y="21" width="3" height="3" rx="0.5" fill="#1d4ed8" />
        <rect x="21" y="27" width="3" height="3" rx="0.5" fill="#1d4ed8" />
        <rect x="26" y="27" width="3" height="3" rx="0.5" fill="#1d4ed8" />
        <rect x="23.5" y="34" width="4" height="5" rx="0.5" fill="#1d4ed8" />
      </svg>
    );
  }

  // 19. KHÓA HỌC / CHIẾN DỊCH (Hồng Sen - Các lớp học phần)
  if (normName.includes('khóa học') || normName.includes('chiến dịch') || normName.includes('campaigns')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_course_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#be185d" />
          </linearGradient>
          {filterDef('ai_course_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_course_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <path d="M28 17L14 23L28 29L42 23L28 17Z" fill="#ffffff" filter="url(#ai_course_sh)" />
        <path d="M14 28L28 34L42 28" stroke="#fbcfe8" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M14 33L28 39L42 33" stroke="#f472b6" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }

  // 20. LỊCH HỌC (Lavender Deep - Lịch thời khóa biểu)
  if (normName.includes('lịch học') || normName.includes('schedules')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_sch_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#3730a3" />
          </linearGradient>
          {filterDef('ai_sch_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_sch_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <rect x="14" y="16" width="28" height="26" rx="5" fill="#ffffff" filter="url(#ai_sch_sh)" />
        <path d="M14 21C14 18.2386 16.2386 16 19 16H37C39.7614 16 42 18.2386 42 21V23H14V21Z" fill="#3730a3" />
        <circle cx="28" cy="31" r="6" fill="#e0e7ff" />
        <path d="M28 31L28 28" stroke="#3730a3" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M28 31L31 31" stroke="#3730a3" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  // 21. ĐỐI TÁC (Corporate Navy - Bắt tay liên kết B2B)
  if (normName.includes('đối tác') || normName.includes('companies')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_comp_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </linearGradient>
          {filterDef('ai_comp_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_comp_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <path d="M14 26L22 18L28 24L24 28L14 26Z" fill="#dbeafe" />
        <path d="M42 26L34 18L28 24L32 28L42 26Z" fill="#dbeafe" />
        <rect x="23" y="24" width="10" height="10" rx="3" fill="#ffffff" filter="url(#ai_comp_sh)" />
        <path d="M25 27H31" stroke="#1e3a8a" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M25 31H29" stroke="#1e3a8a" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  // 22. TÀI LIỆU (Nâu Da Bò - Cặp hồ sơ lưu trữ)
  if (normName.includes('tài liệu') || normName.includes('files')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_files_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#92400e" />
          </linearGradient>
          {filterDef('ai_files_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_files_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <path d="M15 20C15 18.8954 15.8954 18 17 18H23L26 21H39C40.1046 21 41 21.8954 41 23V37C41 38.1046 40.1046 39 39 39H17C15.8954 39 15 38.1046 15 37V20Z" fill="#fde68a" />
        <rect x="18" y="15" width="20" height="16" rx="2" fill="#ffffff" filter="url(#ai_files_sh)" />
        <rect x="22" y="19" width="12" height="1.8" rx="0.9" fill="#92400e" />
        <rect x="22" y="23" width="8" height="1.8" rx="0.9" fill="#cbd5e1" />
        <path d="M14 26H42V37C42 38.1046 41.1046 39 40 39H16C14.8954 39 14 38.1046 14 37V26Z" fill="#fbbf24" />
      </svg>
    );
  }

  // 23. NHÀ CUNG CẤP (Xám Titan - Xe tải logistics)
  if (normName.includes('nhà cung cấp') || normName.includes('suppliers')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_sup_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          {filterDef('ai_sup_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_sup_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <rect x="14" y="20" width="18" height="15" rx="2" fill="#ffffff" filter="url(#ai_sup_sh)" />
        <path d="M32 24H37L41 29V35H32V24Z" fill="#ffffff" />
        <path d="M33 26H36L39 30H33V26Z" fill="#475569" />
        <circle cx="20" cy="36" r="3.5" fill="#0f172a" />
        <circle cx="20" cy="36" r="1.5" fill="#ffffff" />
        <circle cx="36" cy="36" r="3.5" fill="#0f172a" />
        <circle cx="36" cy="36" r="1.5" fill="#ffffff" />
      </svg>
    );
  }

  // 24. PHIẾU LƯƠNG (Berry Rose - Bảng lương cá nhân ₫)
  if (normName.includes('phiếu lương') || normName.includes('payslip')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_pay_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#db2777" />
            <stop offset="100%" stopColor="#9d174d" />
          </linearGradient>
          {filterDef('ai_pay_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_pay_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <rect x="16" y="14" width="24" height="29" rx="3.5" fill="#ffffff" filter="url(#ai_pay_sh)" />
        <circle cx="28" cy="22" r="4.5" fill="#fdf2f8" stroke="#db2777" strokeWidth="1.2" />
        <text x="28" y="25" fontSize="7" fontWeight="900" fill="#9d174d" textAnchor="middle">₫</text>
        <rect x="20" y="29" width="16" height="2" rx="1" fill="#cbd5e1" />
        <rect x="20" y="33" width="12" height="2" rx="1" fill="#cbd5e1" />
        <rect x="20" y="37" width="14" height="2" rx="1" fill="#db2777" />
      </svg>
    );
  }

  // 25. PHÒNG BAN (Caribbean Aqua - Sơ đồ cây phân nhánh)
  if (normName.includes('phòng ban') || normName.includes('teams')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_dept_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#0e7490" />
          </linearGradient>
          {filterDef('ai_dept_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_dept_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <rect x="22" y="15" width="12" height="8" rx="2" fill="#ffffff" filter="url(#ai_dept_sh)" />
        <circle cx="28" cy="19" r="2" fill="#0e7490" />
        <path d="M28 23V27H18V31" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M28 27H38V31" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="13" y="31" width="10" height="8" rx="2" fill="#ffffff" />
        <circle cx="18" cy="35" r="1.8" fill="#0e7490" />
        <rect x="33" y="31" width="10" height="8" rx="2" fill="#ffffff" />
        <circle cx="38" cy="35" r="1.8" fill="#0e7490" />
      </svg>
    );
  }

  // 26. NHÂN SỰ CÔNG TY (Tím Amethyst - Nhóm 3 người)
  if (normName === 'nhân sự công ty' || normName === 'nhân viên' || (normName.includes('nhân sự') && !normName.includes('lương'))) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_hrm_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#5b21b6" />
          </linearGradient>
          {filterDef('ai_hrm_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_hrm_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <circle cx="28" cy="21" r="4.5" fill="#ffffff" filter="url(#ai_hrm_sh)" />
        <path d="M20 37C20 32.5 23.5 30 28 30C32.5 30 36 32.5 36 37" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="18" cy="24" r="3.2" fill="#ddd6fe" />
        <path d="M12 36C12 33 14.5 31.5 17.5 31.5" stroke="#ddd6fe" strokeWidth="2" strokeLinecap="round" />
        <circle cx="38" cy="24" r="3.2" fill="#ddd6fe" />
        <path d="M38.5 31.5C41.5 31.5 44 33 44 36" stroke="#ddd6fe" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  // 27. TÀI KHOẢN CÁ NHÂN (Xám Bạc Kim Loại - Avatar cá nhân)
  if (normName.includes('tài khoản cá nhân') || normName === 'tài khoản' || normName.includes('account')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_acc_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          {filterDef('ai_acc_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_acc_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <circle cx="28" cy="28" r="14" stroke="#ffffff" strokeWidth="1.8" />
        <circle cx="28" cy="23" r="5" fill="#ffffff" filter="url(#ai_acc_sh)" />
        <path d="M18.5 36C19.5 31.5 23.5 29.5 28 29.5C32.5 29.5 36.5 31.5 37.5 36" fill="#ffffff" />
      </svg>
    );
  }

  // 28. NHÂN SỰ & LƯƠNG (Royal Plum - Quản trị HRM tổng thể)
  if (normName.includes('nhân sự & lương') || normName.includes('hrm')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_hrmfull_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6d28d9" />
            <stop offset="100%" stopColor="#4c1d95" />
          </linearGradient>
          {filterDef('ai_hrmfull_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_hrmfull_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <path d="M28 14L39 18V26C39 33 34 38 28 41C22 38 17 33 17 26V18L28 14Z" fill="#ffffff" filter="url(#ai_hrmfull_sh)" />
        <circle cx="28" cy="23" r="3.2" fill="#4c1d95" />
        <path d="M22 32C22 28.5 25 27 28 27C31 27 34 28.5 34 32" stroke="#4c1d95" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  // 29. CÀI ĐẶT HỆ THỐNG (Xám Cơ Khí - Cặp bánh răng kỹ thuật)
  if (normName.includes('cài đặt') || normName.includes('settings')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_set_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          {filterDef('ai_set_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_set_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <g filter="url(#ai_set_sh)">
          <circle cx="24" cy="24" r="7" stroke="#ffffff" strokeWidth="3" />
          <path d="M24 14V17M24 31V34M14 24H17M31 24H34M17 17L19 19M29 29L31 31M17 31L19 29M29 19L31 17" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
        </g>
        <circle cx="36" cy="35" r="4.5" stroke="#94a3b8" strokeWidth="2.2" />
        <path d="M36 28V30M36 40V42M29 35H31M41 35H43" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  // 30. HUẤN LUYỆN AI (Cyber Crimson - Chip bán dẫn não bộ AI)
  if (normName.includes('huấn luyện ai') || normName.includes('ai-training')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_ai_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#be123c" />
            <stop offset="100%" stopColor="#881337" />
          </linearGradient>
          {filterDef('ai_ai_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_ai_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <rect x="18" y="18" width="20" height="20" rx="4" fill="#ffffff" filter="url(#ai_ai_sh)" />
        <rect x="22" y="22" width="12" height="12" rx="2" fill="#881337" />
        <circle cx="28" cy="28" r="2.5" fill="#facc15" />
        <path d="M23 14V18M28 14V18M33 14V18" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M23 38V42M28 38V42M33 38V42" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M14 23H18M14 28H18M14 33H18" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M38 23H42M38 28H42M38 33H42" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  // 31. QUẢN LÝ TÀI KHOẢN (Shield Navy - Khiên an ninh & ổ khóa vàng)
  if (normName.includes('quản lý tài khoản') || normName.includes('accounts')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_admin_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4338ca" />
            <stop offset="100%" stopColor="#312e81" />
          </linearGradient>
          {filterDef('ai_admin_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_admin_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <path d="M28 14L39 18V26C39 33 34 38 28 41C22 38 17 33 17 26V18L28 14Z" fill="#ffffff" filter="url(#ai_admin_sh)" />
        <rect x="24" y="27" width="8" height="6" rx="1.5" fill="#f59e0b" />
        <path d="M25.5 27V24C25.5 22.6 26.6 21.5 28 21.5C29.4 21.5 30.5 22.6 30.5 24V27" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <circle cx="28" cy="30" r="1" fill="#78350f" />
      </svg>
    );
  }

  // 32. VÒNG PHÂN BỔ (Electric Lime - Vòng phân nhánh luân chuyển)
  if (normName.includes('vòng phân bổ') || normName.includes('rounds')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_rounds_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#65a30d" />
            <stop offset="100%" stopColor="#3f6212" />
          </linearGradient>
          {filterDef('ai_rounds_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_rounds_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <circle cx="28" cy="18" r="4.5" fill="#ffffff" filter="url(#ai_rounds_sh)" />
        <circle cx="18" cy="34" r="4.5" fill="#ffffff" filter="url(#ai_rounds_sh)" />
        <circle cx="38" cy="34" r="4.5" fill="#ffffff" filter="url(#ai_rounds_sh)" />
        <path d="M28 22V26L18 30V34" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M28 26L38 30V34" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }

  // 33. QUY TẮC ĐỊNH TUYẾN (Electric Violet - Mạch điều phối tín hiệu)
  if (normName.includes('quy tắc') || normName.includes('định tuyến') || normName.includes('rules')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_rules_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#9333ea" />
            <stop offset="100%" stopColor="#6b21a8" />
          </linearGradient>
          {filterDef('ai_rules_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_rules_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <rect x="15" y="24" width="8" height="8" rx="2" fill="#ffffff" filter="url(#ai_rules_sh)" />
        <circle cx="39" cy="19" r="4" fill="#ffffff" />
        <circle cx="39" cy="37" r="4" fill="#ffffff" />
        <path d="M23 28H29C32 28 32 19 35 19H39" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M29 28C32 28 32 37 35 37H39" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
    );
  }

  // 34. TÍCH HỢP DATA (Connection Cyan - Mắt xích liên kết API)
  if (normName.includes('tích hợp') || normName.includes('integrations') || normName.includes('capi')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_integ_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0891b2" />
            <stop offset="100%" stopColor="#155e75" />
          </linearGradient>
          {filterDef('ai_integ_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_integ_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <g transform="rotate(-45 28 28)" filter="url(#ai_integ_sh)">
          <rect x="16" y="24" width="14" height="8" rx="4" stroke="#ffffff" strokeWidth="2.5" fill="none" />
          <rect x="26" y="24" width="14" height="8" rx="4" stroke="#ffffff" strokeWidth="2.5" fill="none" />
        </g>
      </svg>
    );
  }

  // DEFAULT FALLBACK (Xanh Dương - Square Widget)
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
      <defs>
        <linearGradient id="ai_def_bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        {filterDef('ai_def_sh')}
      </defs>
      <rect width="56" height="56" rx="16" fill="url(#ai_def_bg)" />
      <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      <rect x="16" y="16" width="24" height="24" rx="5" fill="#ffffff" filter="url(#ai_def_sh)" />
    </svg>
  );
};
