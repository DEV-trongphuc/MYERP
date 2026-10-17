import React from 'react';

interface AppIconProps {
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const NAV_ICON_MAP: Record<string, string> = {
  marketing_dashboard: '/marketing',
  automation_flows: '/marketing/flows',
  email_campaigns: '/marketing/campaigns',
  email_templates: '/marketing/templates',
  audience_segments: '/marketing/audience',
  surveys_quiz: '/marketing/surveys',
  vouchers_qr: '/marketing/vouchers',
  social_bot: '/marketing/social-bot',
  ai_training: '/marketing/ai-training',
  web_tracking: '/marketing/web-tracking',
  api_triggers: '/marketing/api-triggers'
};

export const AppIcon: React.FC<AppIconProps> = ({ name, size = 56, className = '', style = {} }) => {
  const normName = (name || '').toLowerCase().trim();

  // Common shadow filter inside each SVG
  const filterDef = (id: string) => (
    <filter id={id} x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodOpacity="0.25" />
    </filter>
  );

  // MKT 1. MARKETING DASHBOARD ('marketing_dashboard' / '/marketing')
  if (normName === 'marketing_dashboard' || normName === '/marketing' || normName === 'marketing' || normName.includes('tổng quan marketing') || normName.includes('marketing dashboard')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_mkt_dash_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </linearGradient>
          {filterDef('ai_mkt_dash_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_mkt_dash_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <rect x="13" y="14" width="30" height="28" rx="5.5" fill="#ffffff" filter="url(#ai_mkt_dash_sh)" />
        <path d="M17 34L23 27L28 30L36 20" stroke="#2563eb" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="36" cy="20" r="2.8" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.2" />
        <rect x="17" y="18" width="9" height="4" rx="1.5" fill="#dbeafe" />
        <rect x="17" y="37" width="22" height="2" rx="1" fill="#cbd5e1" />
      </svg>
    );
  }

  // MKT 2. AUTOMATION FLOWS ('automation_flows' / '/marketing/flows')
  if (normName === 'automation_flows' || normName === '/marketing/flows' || normName === 'automation' || normName.includes('kịch bản automation') || normName.includes('automation flow')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_mkt_flow_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#4c1d95" />
          </linearGradient>
          {filterDef('ai_mkt_flow_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_mkt_flow_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <g filter="url(#ai_mkt_flow_sh)">
          <rect x="14" y="14" width="12" height="9" rx="3" fill="#ffffff" />
          <rect x="30" y="23.5" width="12" height="9" rx="3" fill="#ffffff" />
          <rect x="14" y="33" width="12" height="9" rx="3" fill="#ffffff" />
        </g>
        <circle cx="20" cy="18.5" r="2" fill="#7c3aed" />
        <circle cx="36" cy="28" r="2" fill="#f59e0b" />
        <circle cx="20" cy="37.5" r="2" fill="#10b981" />
        <path d="M26 18.5H32C34.2 18.5 36 20.3 36 22.5V23.5" stroke="#ddd6fe" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M36 32.5V33.5C36 35.7 34.2 37.5 32 37.5H26" stroke="#ddd6fe" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }

  // MKT 3. EMAIL CAMPAIGNS ('email_campaigns' / '/marketing/campaigns')
  if (normName === 'email_campaigns' || normName === '/marketing/campaigns' || normName.includes('chiến dịch email')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_mkt_camp_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#9d174d" />
          </linearGradient>
          {filterDef('ai_mkt_camp_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_mkt_camp_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <rect x="13" y="17" width="30" height="22" rx="4.5" fill="#ffffff" filter="url(#ai_mkt_camp_sh)" />
        <path d="M14.5 19L28 28.5L41.5 19" stroke="#db2777" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="39" cy="17" r="4.5" fill="#fbbf24" stroke="#ffffff" strokeWidth="1.5" />
      </svg>
    );
  }

  // MKT 4. EMAIL TEMPLATES ('email_templates' / '/marketing/templates')
  if (normName === 'email_templates' || normName === '/marketing/templates' || normName.includes('mẫu email') || normName.includes('mẫu thiết kế')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_mkt_tpl_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
          {filterDef('ai_mkt_tpl_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_mkt_tpl_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <rect x="15" y="13" width="26" height="30" rx="4.5" fill="#ffffff" filter="url(#ai_mkt_tpl_sh)" />
        <rect x="19" y="17" width="18" height="6" rx="2" fill="#0284c7" />
        <rect x="19" y="26" width="11" height="8" rx="1.5" fill="#bae6fd" />
        <rect x="32" y="26" width="5" height="8" rx="1.5" fill="#e0f2fe" />
        <rect x="19" y="37" width="18" height="2.2" rx="1.1" fill="#94a3b8" />
      </svg>
    );
  }

  // MKT 5. AUDIENCE SEGMENTS ('audience_segments' / '/marketing/audience')
  if (normName === 'audience_segments' || normName === '/marketing/audience' || normName.includes('tệp khách hàng') || normName.includes('tệp liên hệ') || normName.includes('phân khúc')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_mkt_aud_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          {filterDef('ai_mkt_aud_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_mkt_aud_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <circle cx="28" cy="28" r="14" fill="#ffffff" filter="url(#ai_mkt_aud_sh)" />
        <path d="M28 14A14 14 0 0 1 42 28H28V14Z" fill="#059669" />
        <circle cx="24" cy="25" r="3" fill="#047857" />
        <path d="M19 34C19 31.2 21.2 29.5 24 29.5C26.8 29.5 29 31.2 29 34" stroke="#047857" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  // MKT 6. SURVEYS & QUIZ ('surveys_quiz' / '/marketing/surveys')
  if (normName === 'surveys_quiz' || normName === '/marketing/surveys' || normName.includes('khảo sát') || normName.includes('bài test') || normName.includes('survey')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_mkt_srv_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          {filterDef('ai_mkt_srv_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_mkt_srv_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <rect x="15" y="13" width="26" height="30" rx="4.5" fill="#ffffff" filter="url(#ai_mkt_srv_sh)" />
        <circle cx="21" cy="21" r="2.5" fill="#10b981" />
        <rect x="26" y="19.8" width="11" height="2.4" rx="1.2" fill="#475569" />
        <circle cx="21" cy="28.5" r="2.5" fill="#f59e0b" />
        <rect x="26" y="27.3" width="9" height="2.4" rx="1.2" fill="#94a3b8" />
        <circle cx="21" cy="36" r="2.5" fill="#cbd5e1" />
        <rect x="26" y="34.8" width="11" height="2.4" rx="1.2" fill="#cbd5e1" />
      </svg>
    );
  }

  // MKT 7. VOUCHERS & QR ('vouchers_qr' / '/marketing/vouchers')
  if (normName === 'vouchers_qr' || normName === '/marketing/vouchers' || normName.includes('voucher') || normName.includes('mã ưu đãi')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_mkt_vch_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e11d48" />
            <stop offset="100%" stopColor="#9f1239" />
          </linearGradient>
          {filterDef('ai_mkt_vch_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_mkt_vch_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <path d="M13 19C13 17.3431 14.3431 16 16 16H40C41.6569 16 43 17.3431 43 19V24.5C40.8 24.5 39 26.1 39 28C39 29.9 40.8 31.5 43 31.5V37C43 38.6569 41.6569 40 40 40H16C14.3431 40 13 38.6569 13 37V31.5C15.2 31.5 17 29.9 17 28C17 26.1 15.2 24.5 13 24.5V19Z" fill="#ffffff" filter="url(#ai_mkt_vch_sh)" />
        <line x1="25" y1="18" x2="25" y2="38" stroke="#fda4af" strokeWidth="1.6" strokeDasharray="3 3" />
        <rect x="29" y="22" width="4" height="4" rx="0.8" fill="#e11d48" />
        <rect x="35" y="22" width="4" height="4" rx="0.8" fill="#e11d48" />
        <rect x="29" y="28" width="4" height="4" rx="0.8" fill="#e11d48" />
        <rect x="35" y="28" width="4" height="4" rx="0.8" fill="#fbbf24" />
      </svg>
    );
  }

  // MKT 8. WEB TRACKING & PIXEL ('web_tracking' / '/marketing/web-tracking' / 'journey360' / 'hành trình')
  if (normName === 'web_tracking' || normName === '/marketing/web-tracking' || normName.includes('web tracking') || normName.includes('journey360') || normName.includes('đa kênh 360') || normName === 'hành trình' || normName.includes('hành trình')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_mkt_web_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#0891b2" />
          </linearGradient>
          {filterDef('ai_mkt_web_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_mkt_web_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <circle cx="28" cy="28" r="14" fill="#ffffff" filter="url(#ai_mkt_web_sh)" />
        <ellipse cx="28" cy="28" rx="6.5" ry="13.5" stroke="#2563eb" strokeWidth="1.6" />
        <line x1="14.5" y1="28" x2="41.5" y2="28" stroke="#2563eb" strokeWidth="1.6" />
        <circle cx="35" cy="21" r="3.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.2" />
      </svg>
    );
  }

  // MKT 9. SOCIAL BOT ('social_bot' / '/marketing/social-bot')
  if (normName === 'social_bot' || normName === '/marketing/social-bot' || normName.includes('social bot')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_mkt_soc_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0068FF" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          {filterDef('ai_mkt_soc_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_mkt_soc_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <circle cx="28" cy="28" r="14" fill="#ffffff" filter="url(#ai_mkt_soc_sh)" />
        <rect x="21" y="21" width="14" height="11" rx="3" stroke="#2563eb" strokeWidth="1.8" />
        <circle cx="25" cy="26" r="1.5" fill="#0068FF" />
        <circle cx="31" cy="26" r="1.5" fill="#0068FF" />
        <path d="M26 36L28 32H24L26 36Z" fill="#2563eb" />
      </svg>
    );
  }

  // MKT 10. API & WEBHOOK ('api_triggers' / '/marketing/api-triggers')
  if (normName === 'api_triggers' || normName === '/marketing/api-triggers' || normName.includes('api & webhook') || normName.includes('api_triggers')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_mkt_api_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          {filterDef('ai_mkt_api_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_mkt_api_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <circle cx="28" cy="28" r="14" fill="#ffffff" filter="url(#ai_mkt_api_sh)" />
        <circle cx="23" cy="28" r="3" stroke="#6366f1" strokeWidth="1.8" />
        <circle cx="33" cy="22" r="3" stroke="#6366f1" strokeWidth="1.8" />
        <circle cx="33" cy="34" r="3" stroke="#6366f1" strokeWidth="1.8" />
        <path d="M26 28H28C29.5 28 30.5 24 30.5 23" stroke="#6366f1" strokeWidth="1.5" />
        <path d="M26 28H28C29.5 28 30.5 32 30.5 33" stroke="#6366f1" strokeWidth="1.5" />
      </svg>
    );
  }

  // MKT 11. AI TRAINING ('ai_training' / '/marketing/ai-training' / 'đào tạo ai')
  if (normName === 'ai_training' || normName === '/marketing/ai-training' || normName.includes('đào tạo ai') || normName.includes('ai training')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_mkt_aitrain_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#BD1D2D" />
            <stop offset="55%" stopColor="#9f1239" />
            <stop offset="100%" stopColor="#4c1d95" />
          </linearGradient>
          {filterDef('ai_mkt_aitrain_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_mkt_aitrain_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.24)" strokeWidth="1" />
        <rect x="13" y="13" width="30" height="30" rx="8" fill="#ffffff" filter="url(#ai_mkt_aitrain_sh)" />
        <path d="M28 18C23.5 18 20 21.2 20 25.2C20 27.6 21.2 29.7 23 31V34.5C23 35.6 23.9 36.5 25 36.5H31C32.1 36.5 33 35.6 33 34.5V31C34.8 29.7 36 27.6 36 25.2C36 21.2 32.5 18 28 18Z" fill="#ffe4e6" stroke="#BD1D2D" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M25 25.5L27.5 23L30.5 26L33 23.5" stroke="#BD1D2D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="25" cy="25.5" r="1.4" fill="#BD1D2D" />
        <circle cx="28" cy="29" r="1.4" fill="#7c3aed" />
        <circle cx="31" cy="25.5" r="1.4" fill="#BD1D2D" />
        <path d="M37.5 16.5L38.4 18.6L40.5 19.5L38.4 20.4L37.5 22.5L36.6 20.4L34.5 19.5L36.6 18.6L37.5 16.5Z" fill="#f59e0b" />
      </svg>
    );
  }

  // MKT 12. API TRIGGER SUB-ICONS ('trigger_form', 'trigger_purchase', 'trigger_custom', 'trigger_otp')
  if (normName === 'trigger_form' || normName === 'biểu mẫu thu thập') {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_trg_form_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#BD1D2D" />
            <stop offset="100%" stopColor="#881337" />
          </linearGradient>
          {filterDef('ai_trg_form_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_trg_form_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <rect x="15" y="13" width="26" height="30" rx="5" fill="#ffffff" filter="url(#ai_trg_form_sh)" />
        <rect x="19" y="18" width="18" height="3.5" rx="1.5" fill="#ffe4e6" stroke="#BD1D2D" strokeWidth="1" />
        <rect x="19" y="24.5" width="18" height="3.5" rx="1.5" fill="#f1f5f9" />
        <rect x="19" y="31" width="11" height="3.5" rx="1.5" fill="#f1f5f9" />
        <rect x="32" y="31" width="5" height="3.5" rx="1.5" fill="#BD1D2D" />
      </svg>
    );
  }

  if (normName === 'trigger_purchase' || normName === 'đơn hàng webhook') {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_trg_pur_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          {filterDef('ai_trg_pur_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_trg_pur_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <rect x="14" y="15" width="28" height="26" rx="5.5" fill="#ffffff" filter="url(#ai_trg_pur_sh)" />
        <path d="M20 22H22.5L24.5 31H34L36 24H23.5" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="25.5" cy="34.5" r="1.8" fill="#10b981" />
        <circle cx="33" cy="34.5" r="1.8" fill="#10b981" />
      </svg>
    );
  }

  if (normName === 'trigger_custom' || normName === 'sự kiện custom') {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_trg_cus_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          {filterDef('ai_trg_cus_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_trg_cus_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <circle cx="28" cy="28" r="14" fill="#ffffff" filter="url(#ai_trg_cus_sh)" />
        <path d="M29.5 18L21.5 29H27.5L26.5 38L34.5 27H28.5L29.5 18Z" fill="#2563eb" stroke="#2563eb" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    );
  }

  if (normName === 'trigger_otp' || normName === 'luồng & otp active') {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_trg_otp_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#4c1d95" />
          </linearGradient>
          {filterDef('ai_trg_otp_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_trg_otp_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <path d="M28 14L39 18.5V26.5C39 33.5 34.2 38.8 28 41.5C21.8 38.8 17 33.5 17 26.5V18.5L28 14Z" fill="#ffffff" filter="url(#ai_trg_otp_sh)" />
        <rect x="23" y="25" width="10" height="8" rx="2" fill="#7c3aed" />
        <path d="M25.5 25V23C25.5 21.6 26.6 20.5 28 20.5C29.4 20.5 30.5 21.6 30.5 23V25" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" />
        <circle cx="28" cy="29" r="1.2" fill="#ffffff" />
      </svg>
    );
  }

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
  if (normName.includes('bàn làm việc') || normName.includes('workspace') || normName.includes('công việc') || normName === 'tasks') {
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
  if (normName.includes('bảng tin') || normName.includes('feed') || normName.includes('mạng xã hội')) {
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
  if (normName.includes('tiềm năng') || normName.includes('khách hàng') || normName.includes('contacts') || normName.includes('thông tin') || normName === 'info') {
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
  if (normName.includes('học viên') || normName.includes('sinh viên') || normName.includes('students') || normName.includes('nộp hồ sơ') || normName.includes('lệ phí') || normName.includes('học tập') || normName === 'learning') {
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
  if (normName.includes('sales order') || normName.includes('đặt cọc') || normName.includes('deposits') || normName.includes('thanh toán') || normName === 'deals') {
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
  if (normName.includes('đối tác') || normName.includes('companies') || normName.includes('hợp tác') || normName === 'cooperation') {
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
  if (normName.includes('tài liệu') || normName.includes('files') || normName.includes('hồ sơ') || normName === 'docs') {
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

  // 35. TƯƠNG TÁC / TIMELINE (Xanh Lam Royal - Lịch sử & Hoạt động trao đổi)
  if (normName.includes('tương tác') || normName.includes('timeline') || normName.includes('nhật ký') || normName === 'activity') {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_tl_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          {filterDef('ai_tl_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_tl_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <rect x="14" y="15" width="28" height="26" rx="5" fill="#ffffff" filter="url(#ai_tl_sh)" />
        <circle cx="28" cy="25" r="6.5" stroke="#3b82f6" strokeWidth="1.8" fill="#eff6ff" />
        <path d="M28 21.5V25L30.5 27.5" stroke="#1d4ed8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="20" y="34.5" width="16" height="2" rx="1" fill="#94a3b8" />
      </svg>
    );
  }

  // 36. PHÂN LOẠI / TAGS (Hồng Sen - Nhãn mác & Tag phân loại)
  if (normName.includes('phân loại') || normName.includes('tag') || normName === 'tags') {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_tag_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#be185d" />
          </linearGradient>
          {filterDef('ai_tag_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_tag_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <path d="M17 18C17 16.3431 18.3431 15 20 15H28.5858C29.3815 15 30.1446 15.3161 30.7071 15.8787L40.1213 25.2929C41.2929 26.4645 41.2929 28.3635 40.1213 29.5351L31.5351 38.1213C30.3635 39.2929 28.4645 39.2929 27.2929 38.1213L17.8787 28.7071C17.3161 28.1446 17 27.3815 17 26.5858V18Z" fill="#ffffff" filter="url(#ai_tag_sh)" />
        <circle cx="23" cy="21" r="2.5" fill="#ec4899" />
        <rect x="23" y="27" width="8" height="2" rx="1" transform="rotate(45 23 27)" fill="#cbd5e1" />
      </svg>
    );
  }

  // 37. SCORING / CHẤM ĐIỂM (Cyan - Tâm điểm Radar & Lead Score)
  if (normName.includes('scoring') || normName.includes('chấm điểm') || normName.includes('lead score')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_sc_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#0e7490" />
          </linearGradient>
          {filterDef('ai_sc_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_sc_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <circle cx="28" cy="28" r="14" fill="#ffffff" filter="url(#ai_sc_sh)" />
        <circle cx="28" cy="28" r="10" stroke="#06b6d4" strokeWidth="1.8" fill="#ecfeff" />
        <circle cx="28" cy="28" r="5.5" stroke="#0891b2" strokeWidth="1.6" fill="#cffafe" />
        <circle cx="28" cy="28" r="2.5" fill="#0e7490" />
        <path d="M28 12V16M28 40V44M12 28H16M40 28H44" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  // 38. WORKCHAT / TIN NHẮN (Đỏ Ruby - Thẻ Hội Thoại 2 Chiều Đồng Bộ Chuẩn)
  if (normName.includes('workchat') || normName.includes('chat') || normName.includes('tin nhắn') || normName.includes('tin nhan') || normName.includes('trò chuyện') || normName.includes('tro chuyen') || normName === 'message' || normName === 'messages') {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_wc_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#991b1b" />
          </linearGradient>
          {filterDef('ai_wc_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_wc_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        {/* White Card base */}
        <rect x="13" y="14" width="30" height="28" rx="5.5" fill="#ffffff" filter="url(#ai_wc_sh)" />
        {/* Outgoing Red Bubble */}
        <path d="M21 18H35C36.6569 18 38 19.3431 38 21V25C38 26.6569 36.6569 28 35 28H25L21 31.5V28C19.8954 28 19 27.1046 19 26V20C19 18.8954 19.8954 18 21 18Z" fill="#dc2626" />
        <circle cx="25" cy="23" r="1.3" fill="#ffffff" />
        <circle cx="28.5" cy="23" r="1.3" fill="#ffffff" />
        <circle cx="32" cy="23" r="1.3" fill="#ffffff" />
        {/* Incoming Grey Bubble */}
        <path d="M17 33C17 31.8954 17.8954 31 19 31H31C32.1046 31 33 31.8954 33 33V35.5C33 36.6046 32.1046 37.5 31 37.5H29L26 39.5V37.5H19C17.8954 37.5 17 36.6046 17 35.5V33Z" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="0.8" />
        <rect x="20" y="33.8" width="8" height="1.4" rx="0.7" fill="#94a3b8" />
      </svg>
    );
  }

  // MKT STEP: WAIT / CLOCK
  if (normName === 'wait' || normName === 'clock' || normName.includes('chờ') || normName.includes('wait')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_wait_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
          {filterDef('ai_wait_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_wait_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <circle cx="28" cy="28" r="14" fill="#ffffff" filter="url(#ai_wait_sh)" />
        <circle cx="28" cy="28" r="11" stroke="#fef3c7" strokeWidth="2" fill="#fffbeb" />
        <path d="M28 21V28L33 31" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="28" cy="28" r="2" fill="#d97706" />
      </svg>
    );
  }

  // MKT STEP: CONDITION / GIT-MERGE / BRANCH
  if (normName === 'condition' || normName === 'git-merge' || normName === 'advanced_condition' || normName.includes('rẽ nhánh') || normName.includes('logic')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_cond_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#4338ca" />
          </linearGradient>
          {filterDef('ai_cond_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_cond_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <rect x="14" y="14" width="28" height="28" rx="8" fill="#ffffff" filter="url(#ai_cond_sh)" />
        <path d="M22 19V37" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M22 28C28 28 34 26 34 21" stroke="#818cf8" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="22" cy="19" r="3.2" fill="#4338ca" stroke="#ffffff" strokeWidth="1.5" />
        <circle cx="22" cy="37" r="3.2" fill="#4338ca" stroke="#ffffff" strokeWidth="1.5" />
        <circle cx="34" cy="21" r="3.2" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
      </svg>
    );
  }

  // MKT STEP: SPLIT TEST / A-B TEST / BEAKER
  if (normName === 'split_test' || normName === 'beaker' || normName.includes('split') || normName.includes('a/b')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_ab_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#0e7490" />
          </linearGradient>
          {filterDef('ai_ab_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_ab_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <rect x="14" y="14" width="28" height="28" rx="8" fill="#ffffff" filter="url(#ai_ab_sh)" />
        <path d="M25 20H31M26 20V26L20 36H36L30 26V20" stroke="#0891b2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M22 33H34" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" />
        <circle cx="26" cy="30" r="1.2" fill="#0891b2" />
        <circle cx="30" cy="31" r="1" fill="#0891b2" />
      </svg>
    );
  }

  // MKT STEP: REMOVE ACTION / USER MINUS / CLEANUP
  if (normName === 'remove_action' || normName === 'user-minus' || normName.includes('dọn dẹp') || normName.includes('hủy đăng ký')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_rm_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#be123c" />
          </linearGradient>
          {filterDef('ai_rm_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_rm_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <circle cx="28" cy="28" r="14" fill="#ffffff" filter="url(#ai_rm_sh)" />
        <circle cx="25" cy="24" r="5" stroke="#f43f5e" strokeWidth="2" fill="#ffe4e6" />
        <path d="M17 36C17 32 20.5 30 25 30C26.5 30 27.8 30.3 29 30.8" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" />
        <path d="M33 33H39" stroke="#be123c" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }

  // MKT STEP: LINK FLOW / CONNECT
  if (normName === 'link_flow' || normName === 'link' || normName.includes('chuyển kịch bản')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_lf_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          {filterDef('ai_lf_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_lf_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <rect x="14" y="14" width="28" height="28" rx="8" fill="#ffffff" filter="url(#ai_lf_sh)" />
        <path d="M26 23H24C21.7909 23 20 24.7909 20 27C20 29.2091 21.7909 31 24 31H26" stroke="#475569" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M30 23H32C34.2091 23 36 24.7909 36 27C36 29.2091 34.2091 31 32 31H30" stroke="#475569" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M24 27H32" stroke="#3b82f6" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }

  // MKT STEP: ZALO ZNS
  if (normName === 'zalo_zns' || normName === 'zalo' || normName.includes('zns')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_zalo_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0068ff" />
            <stop offset="100%" stopColor="#0043a8" />
          </linearGradient>
          {filterDef('ai_zalo_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_zalo_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <circle cx="28" cy="28" r="14" fill="#ffffff" filter="url(#ai_zalo_sh)" />
        <path d="M21 24H35C35.5 24 36 24.5 36 25V31C36 31.5 35.5 32 35 32H27L23 35V32H21C20.5 32 20 31.5 20 31V25C20 24.5 20.5 24 21 24Z" fill="#0068ff" />
        <text x="24" y="30" fill="#ffffff" fontSize="7" fontWeight="bold" fontFamily="sans-serif">Z</text>
      </svg>
    );
  }

  // MKT STEP: LIST ACTION
  if (normName === 'list_action' || normName === 'list' || normName.includes('danh sách')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_la_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          {filterDef('ai_la_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_la_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <rect x="14" y="14" width="28" height="28" rx="7" fill="#ffffff" filter="url(#ai_la_sh)" />
        <rect x="19" y="21" width="4" height="4" rx="1" fill="#10b981" />
        <rect x="26" y="22" width="11" height="2" rx="1" fill="#64748b" />
        <rect x="19" y="27" width="4" height="4" rx="1" fill="#10b981" />
        <rect x="26" y="28" width="9" height="2" rx="1" fill="#64748b" />
        <rect x="19" y="33" width="4" height="4" rx="1" fill="#10b981" />
        <rect x="26" y="34" width="11" height="2" rx="1" fill="#64748b" />
      </svg>
    );
  }

  // FLOW 1. AI BOT TRIGGER ('flow_ai_bot' / 'flow_ai' / 'flow_bot' / 'ai_capture' / 'ai_chatbot_lead')
  if (normName === 'flow_ai_bot' || normName === 'flow_ai' || normName === 'flow_bot' || normName === 'ai_capture' || normName === 'ai_chatbot_lead' || normName.includes('ai chatbot') || normName.includes('lead ai') || normName.includes('ai_bot')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_fl_bot_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#be123c" />
          </linearGradient>
          {filterDef('ai_fl_bot_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_fl_bot_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <g filter="url(#ai_fl_bot_sh)">
          {/* Antenna */}
          <line x1="28" y1="12" x2="28" y2="16.5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
          <circle cx="28" cy="10.5" r="2.5" fill="#fde047" stroke="#ffffff" strokeWidth="1" />
          {/* Ear sensors */}
          <rect x="11.5" y="23" width="3" height="8" rx="1.5" fill="#ffffff" />
          <rect x="41.5" y="23" width="3" height="8" rx="1.5" fill="#ffffff" />
          {/* Bot Head */}
          <rect x="14" y="16.5" width="28" height="21" rx="6.5" fill="#ffffff" />
          {/* Visor Screen */}
          <rect x="17.5" y="20" width="21" height="14" rx="4" fill="#0f172a" />
          {/* Glowing Eyes */}
          <circle cx="23" cy="27" r="2.5" fill="#38bdf8" />
          <circle cx="23.8" cy="26.2" r="0.8" fill="#ffffff" />
          <circle cx="33" cy="27" r="2.5" fill="#38bdf8" />
          <circle cx="33.8" cy="26.2" r="0.8" fill="#ffffff" />
          {/* Golden AI Sparkle Badge */}
          <circle cx="39" cy="38.5" r="5" fill="#fbbf24" stroke="#ffffff" strokeWidth="1.2" />
          <path d="M39 35.8L39.8 37.6L41.6 38.5L39.8 39.4L39 41.2L38.2 39.4L36.4 38.5L38.2 37.6L39 35.8Z" fill="#ffffff" />
        </g>
      </svg>
    );
  }

  // FLOW 2. SMART SEGMENT TRIGGER ('flow_smart_segment' / 'flow_segment' / 'smart_segment' / 'welcome_segment')
  if (normName === 'flow_smart_segment' || normName === 'flow_segment' || normName === 'smart_segment' || normName === 'welcome_segment' || (normName.includes('flow') && normName.includes('segment')) || normName.includes('phân khúc')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_fl_seg_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#c2410c" />
          </linearGradient>
          {filterDef('ai_fl_seg_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_fl_seg_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <g filter="url(#ai_fl_seg_sh)">
          {/* Bottom Floating Layer */}
          <path d="M14 34L28 41L42 34" stroke="#ffedd5" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.8" />
          {/* Middle Floating Layer */}
          <path d="M14 27.5L28 34.5L42 27.5" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {/* Top Surface Isometric Plate */}
          <path d="M28 14.5L42.5 21.5L28 28.5L13.5 21.5L28 14.5Z" fill="#ffffff" />
          {/* Center Glowing Core */}
          <circle cx="28" cy="21.5" r="3" fill="#ea580c" />
          <circle cx="28" cy="21.5" r="1.2" fill="#ffffff" />
          <circle cx="36" cy="18" r="1.5" fill="#fde047" />
          <circle cx="20" cy="18" r="1.5" fill="#fde047" />
        </g>
      </svg>
    );
  }

  // FLOW 3. LIST TRIGGER ('flow_list' / 'flow_list_plus' / 'welcome_list' / 'added_to_list')
  if (normName === 'flow_list' || normName === 'flow_list_plus' || normName === 'welcome_list' || normName === 'added_to_list' || (normName.includes('flow') && normName.includes('list')) || normName.includes('danh sách')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_fl_lst_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#4338ca" />
          </linearGradient>
          {filterDef('ai_fl_lst_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_fl_lst_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <g filter="url(#ai_fl_lst_sh)">
          {/* White Document Card */}
          <rect x="14" y="13" width="28" height="30" rx="6.5" fill="#ffffff" />
          {/* Row 1 with Check Badge */}
          <rect x="18" y="18.5" width="4.5" height="4.5" rx="1.5" fill="#6366f1" />
          <path d="M19.3 20.8L20.2 21.7L21.7 19.8" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="25" y="20" width="12" height="2" rx="1" fill="#64748b" />
          {/* Row 2 with Check Badge */}
          <rect x="18" y="25" width="4.5" height="4.5" rx="1.5" fill="#6366f1" />
          <path d="M19.3 27.3L20.2 28.2L21.7 26.3" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="25" y="26.5" width="10" height="2" rx="1" fill="#64748b" />
          {/* Row 3 */}
          <rect x="18" y="31.5" width="4.5" height="4.5" rx="1.5" fill="#cbd5e1" />
          <rect x="25" y="33" width="7" height="2" rx="1" fill="#94a3b8" />
          {/* Emerald Plus Badge */}
          <circle cx="38" cy="38" r="6" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
          <path d="M38 34.5V41.5M34.5 38H41.5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  // FLOW 4. PURCHASE TRIGGER ('flow_purchase' / 'purchase_success' / 'flow_cart' / 'flow_order' / 'flow_upsell')
  if (normName === 'flow_purchase' || normName === 'purchase_success' || normName === 'flow_cart' || normName === 'flow_order' || normName.includes('mua hàng') || normName.includes('đơn hàng') || normName.includes('purchase') || normName.includes('upsell') || normName.includes('giỏ hàng')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_fl_pur_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#be185d" />
          </linearGradient>
          {filterDef('ai_fl_pur_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_fl_pur_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <g filter="url(#ai_fl_pur_sh)">
          {/* White rounded card */}
          <rect x="13.5" y="13.5" width="29" height="29" rx="7.5" fill="#ffffff" />
          {/* Shopping cart basket */}
          <path d="M18 18.5H21.5L24 30.5H33.5L36.5 22H23" stroke="#ec4899" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          {/* Wheels */}
          <circle cx="25.5" cy="34.5" r="2" fill="#be185d" />
          <circle cx="32" cy="34.5" r="2" fill="#be185d" />
          {/* Golden Star / Badge */}
          <circle cx="37.5" cy="18" r="5.2" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.4" />
          <path d="M37.5 14.8L38.4 16.8L40.5 17.1L38.9 18.5L39.4 20.6L37.5 19.5L35.6 20.6L36.1 18.5L34.5 17.1L36.6 16.8L37.5 14.8Z" fill="#ffffff" />
        </g>
      </svg>
    );
  }

  // FLOW 5. CUSTOM EVENT TRIGGER ('flow_custom_event' / 'custom_event_flow' / 'flow_event' / 'flow_zap')
  if (normName === 'flow_custom_event' || normName === 'custom_event_flow' || normName === 'flow_event' || normName === 'flow_zap' || normName.includes('custom_event') || normName.includes('sự kiện') || normName.includes('event')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_fl_evt_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#6d28d9" />
          </linearGradient>
          {filterDef('ai_fl_evt_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_fl_evt_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <g filter="url(#ai_fl_evt_sh)">
          {/* Crisp White Circle */}
          <circle cx="28" cy="28" r="14.5" fill="#ffffff" />
          {/* Lightning Bolt */}
          <path d="M29.5 16L20 28.5H27L25 40L36 26.5H29L30.5 16Z" fill="#8b5cf6" stroke="#7c3aed" strokeWidth="0.8" strokeLinejoin="round" />
          {/* Glowing Energy Sparks */}
          <circle cx="17.5" cy="19.5" r="1.8" fill="#fbbf24" />
          <circle cx="38.5" cy="35" r="2" fill="#fbbf24" />
          <circle cx="37.5" cy="18.5" r="1.3" fill="#e9d5ff" />
        </g>
      </svg>
    );
  }

  // FLOW 6. TAG TRIGGER ('flow_tag' / 'tag_added' / 'flow_label')
  if (normName === 'flow_tag' || normName === 'tag_added' || normName === 'flow_label' || normName.includes('gắn tag') || normName.includes('nhãn') || normName.includes('tag')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_fl_tag_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          {filterDef('ai_fl_tag_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_fl_tag_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <g filter="url(#ai_fl_tag_sh)">
          {/* Angled Modern Price Tag */}
          <path d="M17 18C17 16.8954 17.8954 16 19 16H28C28.5304 16 29.0391 16.2107 29.4142 16.5858L41 28.1716C41.781 28.9526 41.781 30.219 41 31L32 40C31.219 40.781 29.9526 40.781 29.1716 40L17.5858 28.4142C17.2107 28.0391 17 27.5304 17 27V18Z" fill="#ffffff" />
          {/* Tag Ribbon Hole */}
          <circle cx="23" cy="22" r="2.8" fill="#10b981" />
          {/* Ribbon String */}
          <path d="M23 19.2C23 16 21 14 19 13.5" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" fill="none" />
          {/* Stripe Accent */}
          <path d="M28 29L33.5 34.5" stroke="#a7f3d0" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="37.5" cy="18.5" r="1.5" fill="#fde047" />
        </g>
      </svg>
    );
  }

  // FLOW 7. FORM TRIGGER ('flow_form' / 'welcome_form' / 'form_submission')
  if (normName === 'flow_form' || normName === 'welcome_form' || normName === 'form_submission' || normName.includes('form') || normName.includes('biểu mẫu')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_fl_frm_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0d9488" />
            <stop offset="100%" stopColor="#0f766e" />
          </linearGradient>
          {filterDef('ai_fl_frm_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_fl_frm_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <g filter="url(#ai_fl_frm_sh)">
          {/* Form Card */}
          <rect x="14" y="13" width="28" height="30" rx="6" fill="#ffffff" />
          {/* Form Title Line */}
          <rect x="18" y="17" width="12" height="3" rx="1.5" fill="#0d9488" />
          {/* Input Field 1 */}
          <rect x="18" y="22.5" width="20" height="5" rx="2" fill="#f0fdfa" stroke="#5eead4" strokeWidth="0.8" />
          <rect x="20.5" y="24.5" width="8" height="1.5" rx="0.75" fill="#0d9488" />
          {/* Input Field 2 */}
          <rect x="18" y="29.5" width="20" height="5" rx="2" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="0.8" />
          <rect x="20.5" y="31.5" width="11" height="1.5" rx="0.75" fill="#94a3b8" />
          {/* Golden Submit Button Badge */}
          <circle cx="38" cy="38" r="6" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
          <path d="M36 38H40M38.5 36L40.5 38L38.5 40" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    );
  }

  // FLOW 8. SURVEY TRIGGER ('flow_survey' / 'survey_response' / 'flow_feedback' / 'flow_quiz')
  if (normName === 'flow_survey' || normName === 'survey_response' || normName === 'flow_feedback' || normName === 'flow_quiz' || normName.includes('khảo sát') || normName.includes('survey') || normName.includes('feedback')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_fl_srv_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          {filterDef('ai_fl_srv_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_fl_srv_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <g filter="url(#ai_fl_srv_sh)">
          {/* Survey Clipboard */}
          <rect x="15" y="14" width="26" height="29" rx="5" fill="#ffffff" />
          {/* Top Clip */}
          <rect x="22" y="11.5" width="12" height="4.5" rx="2" fill="#78350f" />
          <circle cx="28" cy="13.5" r="1.2" fill="#ffffff" />
          {/* Row 1 checked */}
          <circle cx="20" cy="20.5" r="2.2" fill="#10b981" />
          <path d="M19.1 20.5L19.9 21.3L21.2 19.8" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="24.5" y="19.5" width="12" height="2" rx="1" fill="#475569" />
          {/* Row 2 checked */}
          <circle cx="20" cy="26" r="2.2" fill="#10b981" />
          <path d="M19.1 26L19.9 26.8L21.2 25.3" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="24.5" y="25" width="9" height="2" rx="1" fill="#475569" />
          {/* 3 Rating Stars */}
          <path d="M20 31.5L20.6 32.8L22 33L21 34L21.2 35.5L20 34.8L18.8 35.5L19 34L18 33L19.4 32.8L20 31.5Z" fill="#f59e0b" />
          <path d="M25 31.5L25.6 32.8L27 33L26 34L26.2 35.5L25 34.8L23.8 35.5L24 34L23 33L24.4 32.8L25 31.5Z" fill="#f59e0b" />
          <path d="M30 31.5L30.6 32.8L32 33L31 34L31.2 35.5L30 34.8L28.8 35.5L29 34L28 33L29.4 32.8L30 31.5Z" fill="#f59e0b" />
          {/* Edit Pen Badge */}
          <circle cx="38" cy="38" r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.2" />
          <path d="M36 40L39.5 36.5L40 37L36.5 40.5L35.5 40.5L36 40Z" fill="#ffffff" />
        </g>
      </svg>
    );
  }

  // FLOW 9. ZALO TRIGGER ('flow_zalo' / 'flow_zalo_follow' / 'zalo_oa_welcome' / 'zalo_follow')
  if (normName === 'flow_zalo' || normName === 'flow_zalo_follow' || normName === 'zalo_oa_welcome' || normName === 'zalo_follow' || normName.includes('zalo')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_fl_zalo_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#0891b2" />
          </linearGradient>
          {filterDef('ai_fl_zalo_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_fl_zalo_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <g filter="url(#ai_fl_zalo_sh)">
          {/* Rounded Chat Bubble */}
          <path d="M14 26C14 18.5 20.2 14 28 14C35.8 14 42 18.5 42 26C42 33.5 35.8 38 28 38C25.5 38 23.2 37.3 21.2 36.2L15 38L16.8 32.7C15 30.7 14 28.5 14 26Z" fill="#ffffff" />
          {/* Inner Silhouette */}
          <circle cx="26" cy="24" r="4" fill="#0284c7" />
          <path d="M19 33C19 29.5 22.2 28 26 28C29.8 28 33 29.5 33 33" fill="#0284c7" />
          {/* Friend Plus Badge */}
          <circle cx="36" cy="21" r="5" fill="#0068ff" stroke="#ffffff" strokeWidth="1.2" />
          <path d="M36 18.5V23.5M33.5 21H38.5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  // FLOW 10. MAIL / TRIAL / CAMPAIGN TRIGGER ('flow_mail' / 'flow_trial' / 'flow_campaign' / 'campaign_tracking')
  if (normName === 'flow_mail' || normName === 'flow_trial' || normName === 'flow_campaign' || normName === 'campaign_tracking' || normName === 'flow_broadcast' || normName.includes('mail') || normName.includes('trial') || normName.includes('email') || normName.includes('chiến dịch')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_fl_mail_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          {filterDef('ai_fl_mail_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_fl_mail_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <g filter="url(#ai_fl_mail_sh)">
          {/* White Envelope Card */}
          <rect x="13" y="16" width="30" height="23" rx="5" fill="#ffffff" />
          <path d="M14.5 18L28 28L41.5 18" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          {/* Flying Paper Plane / Send Badge */}
          <circle cx="38" cy="38" r="6" fill="#fbbf24" stroke="#ffffff" strokeWidth="1.5" />
          <path d="M41 35L35 37.5L37.5 39L41 35Z" fill="#ffffff" />
          <path d="M37.5 39V41.5L39 40" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      </svg>
    );
  }

  // FLOW 11. INACTIVITY TRIGGER ('flow_inactivity' / 'inactivity' / 'winback' / 'ngủ đông')
  if (normName === 'flow_inactivity' || normName === 'inactivity' || normName === 'winback' || normName === 'ngủ đông' || normName === 'flow_winback' || normName.includes('ngủ đông') || normName.includes('inactivity') || normName.includes('winback')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_fl_inac_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
          {filterDef('ai_fl_inac_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_fl_inac_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <g filter="url(#ai_fl_inac_sh)">
          {/* Frosted Clock Dial */}
          <circle cx="28" cy="28" r="14.5" fill="#ffffff" />
          <circle cx="28" cy="28" r="11" fill="#f0f9ff" stroke="#bae6fd" strokeWidth="1" />
          {/* Clock Hands */}
          <circle cx="28" cy="28" r="1.8" fill="#0284c7" />
          <line x1="28" y1="28" x2="28" y2="21" stroke="#0284c7" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="28" y1="28" x2="33" y2="28" stroke="#0284c7" strokeWidth="2.2" strokeLinecap="round" />
          {/* Snowflake Crystal Badge */}
          <circle cx="38" cy="38" r="6" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />
          <path d="M38 34.5V41.5M34.5 38H41.5M35.5 35.5L40.5 40.5M35.5 40.5L40.5 35.5" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
          {/* Ice Frost Sparkle */}
          <circle cx="17.5" cy="18.5" r="1.5" fill="#e0f2fe" />
        </g>
      </svg>
    );
  }

  // FLOW 12. BIRTHDAY TRIGGER ('flow_birthday' / 'birthday')
  if (normName === 'flow_birthday' || normName.includes('sinh nhật') || normName.includes('birthday')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_fl_bday_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#f43f5e" />
          </linearGradient>
          {filterDef('ai_fl_bday_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_fl_bday_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <g filter="url(#ai_fl_bday_sh)">
          {/* Candle & Flame */}
          <rect x="26.5" y="15" width="3" height="7" rx="1" fill="#ffffff" />
          <path d="M28 11C28 11 26 13 26 14C26 15.1 26.9 16 28 16C29.1 16 30 15.1 30 14C30 13 28 11 28 11Z" fill="#fbbf24" />
          {/* Cake Top Layer */}
          <rect x="19" y="22" width="18" height="7" rx="2" fill="#ffffff" />
          {/* Cake Bottom Layer */}
          <rect x="15" y="29" width="26" height="10" rx="3" fill="#ffffff" />
          {/* Strawberry / Frosting dots */}
          <circle cx="20" cy="33" r="1.5" fill="#f43f5e" />
          <circle cx="28" cy="33" r="1.5" fill="#f43f5e" />
          <circle cx="36" cy="33" r="1.5" fill="#f43f5e" />
          {/* Sparkles */}
          <circle cx="16" cy="18" r="1.5" fill="#fde047" />
          <circle cx="40" cy="20" r="1.5" fill="#fde047" />
        </g>
      </svg>
    );
  }

  // FLOW 13. ARCHIVED FLOW ('flow_archive' / 'archived_flow')
  if (normName === 'flow_archive' || normName === 'archived_flow' || normName.includes('lưu trữ') || normName.includes('đã xóa')) {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none" className={className} style={style}>
        <defs>
          <linearGradient id="ai_fl_arc_bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          {filterDef('ai_fl_arc_sh')}
        </defs>
        <rect width="56" height="56" rx="16" fill="url(#ai_fl_arc_bg)" />
        <rect width="56" height="56" rx="16" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        <g filter="url(#ai_fl_arc_sh)">
          {/* Archive Document Box */}
          <rect x="14" y="16" width="28" height="24" rx="5" fill="#ffffff" />
          <rect x="18" y="21" width="20" height="3" rx="1.5" fill="#94a3b8" />
          <rect x="22" y="27" width="12" height="2" rx="1" fill="#cbd5e1" />
          {/* Clock / Archive Badge */}
          <circle cx="38" cy="38" r="5.5" fill="#94a3b8" stroke="#ffffff" strokeWidth="1.2" />
          <path d="M38 35.5V38.5H40" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
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
