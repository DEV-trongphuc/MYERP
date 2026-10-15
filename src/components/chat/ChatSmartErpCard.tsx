import React from 'react';
import { 
  User, CheckSquare, Receipt, CreditCard, GitBranch, 
  FileText, ArrowRight, ExternalLink, Sparkles, Copy, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { ErpCardTagData } from './chatTagParsers';

interface Props {
  card: ErpCardTagData;
  onOpen?: (card: ErpCardTagData) => void;
}

export const ChatSmartErpCard: React.FC<Props> = ({ card, onOpen }) => {
  const [copied, setCopied] = React.useState(false);

  const eType = card.entity_type?.toLowerCase() || 'contact';
  
  const themeConfig = (() => {
    switch (eType) {
      case 'employee':
      case 'staff':
      case 'user':
      case 'hrm':
        return {
          bg: '#f5f3ff',
          hoverBg: '#ede9fe',
          border: '#ddd6fe',
          accent: '#7c3aed',
          btnBg: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
          btnText: '#ffffff',
          badgeBg: '#ede9fe',
          badgeText: '#7c3aed',
          label: 'Hồ sơ Nhân sự',
          icon: User,
        };
      case 'contact':
      case 'customer':
      case 'student':
      case 'lead':
        return {
          bg: '#f0f7ff',
          hoverBg: '#e0effe',
          border: '#bae6fd',
          accent: '#0284c7',
          btnBg: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
          btnText: '#ffffff',
          badgeBg: '#e0f2fe',
          badgeText: '#0369a1',
          label: 'Hồ sơ Học viên / Lead',
          icon: User,
        };
      case 'expense':
      case 'po':
      case 'payment_order':
        return {
          bg: '#f0fdf4',
          hoverBg: '#dcfce7',
          border: '#bbf7d0',
          accent: '#16a34a',
          btnBg: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
          btnText: '#ffffff',
          badgeBg: '#dcfce7',
          badgeText: '#15803d',
          label: 'Phiếu chi / PO',
          icon: CreditCard,
        };
      case 'deposit':
      case 'so':
      case 'sale_order':
        return {
          bg: '#f0fdfa',
          hoverBg: '#ccfbf1',
          border: '#99f6e4',
          accent: '#0d9488',
          btnBg: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
          btnText: '#ffffff',
          badgeBg: '#ccfbf1',
          badgeText: '#0f766e',
          label: 'Phiếu đặt cọc (SO)',
          icon: Receipt,
        };
      case 'task':
      case 'activity':
        return {
          bg: '#fffbeb',
          hoverBg: '#fef3c7',
          border: '#fde68a',
          accent: '#d97706',
          btnBg: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
          btnText: '#ffffff',
          badgeBg: '#fef3c7',
          badgeText: '#b45309',
          label: 'Công việc Workspace',
          icon: CheckSquare,
        };
      case 'approval':
      case 'workflow':
      case 'leave':
        return {
          bg: '#faf5ff',
          hoverBg: '#f3e8ff',
          border: '#e9d5ff',
          accent: '#9333ea',
          btnBg: 'linear-gradient(135deg, #9333ea 0%, #7e22ce 100%)',
          btnText: '#ffffff',
          badgeBg: '#f3e8ff',
          badgeText: '#7e22ce',
          label: 'Quy trình & Phê duyệt',
          icon: GitBranch,
        };
      default:
        return {
          bg: '#f8fafc',
          hoverBg: '#f1f5f9',
          border: '#cbd5e1',
          accent: '#475569',
          btnBg: 'linear-gradient(135deg, #475569 0%, #334155 100%)',
          btnText: '#ffffff',
          badgeBg: '#e2e8f0',
          badgeText: '#334155',
          label: 'Đối tượng ERP',
          icon: Sparkles,
        };
    }
  })();

  const IconComp = themeConfig.icon;

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = card.direct_url || (card.relative_url ? `https://myerp.ideas.edu.vn${card.relative_url}` : window.location.href);
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success('Đã sao chép liên kết trực tiếp!');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCardClick = () => {
    if (onOpen) {
      onOpen(card);
    } else {
      const url = card.direct_url || card.relative_url;
      if (url) window.open(url, '_blank');
    }
  };

  return (
    <div
      onClick={handleCardClick}
      style={{
        marginTop: '8px',
        marginBottom: '6px',
        background: '#ffffff',
        borderRadius: '12px',
        border: `1.5px solid ${themeConfig.border}`,
        boxShadow: '0 3px 12px rgba(0, 0, 0, 0.05)',
        padding: '11px 13px',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth: '340px',
        position: 'relative',
        overflow: 'hidden'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = themeConfig.accent;
        e.currentTarget.style.boxShadow = '0 6px 18px rgba(0, 0, 0, 0.09)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = themeConfig.border;
        e.currentTarget.style.boxShadow = '0 3px 12px rgba(0, 0, 0, 0.05)';
        e.currentTarget.style.transform = 'none';
      }}
    >
      {/* Top Header Badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '2px 7px',
          borderRadius: '5px',
          background: themeConfig.badgeBg,
          color: themeConfig.badgeText,
          fontSize: '0.68rem',
          fontWeight: 800,
          letterSpacing: '0.3px',
          textTransform: 'uppercase'
        }}>
          <IconComp size={12} strokeWidth={2.4} />
          <span>{themeConfig.label}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {card.entity_id && (
            <span style={{
              fontSize: '0.68rem',
              color: '#94a3b8',
              fontWeight: 700,
              fontFamily: 'monospace'
            }}>
              #{card.entity_id}
            </span>
          )}
          <button
            type="button"
            title="Sao chép đường dẫn"
            onClick={handleCopyLink}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '2px 4px',
              borderRadius: '4px',
              color: copied ? '#16a34a' : '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {copied ? <Check size={12} strokeWidth={3} /> : <Copy size={12} />}
          </button>
        </div>
      </div>

      {/* Main Entity Title */}
      <div>
        <div style={{
          fontWeight: 750,
          fontSize: '0.88rem',
          color: '#0f172a',
          lineHeight: 1.35,
          marginBottom: card.subtitle ? '3px' : '0'
        }}>
          {card.title}
        </div>
        {card.subtitle && (
          <div style={{
            fontSize: '0.74rem',
            color: '#64748b',
            lineHeight: 1.4,
            fontWeight: 500
          }}>
            {card.subtitle}
          </div>
        )}
      </div>

      {/* Action Button: 1-Touch Drawer Slider */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleCardClick();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          width: '100%',
          padding: '6px 12px',
          borderRadius: '7px',
          background: themeConfig.btnBg,
          color: themeConfig.btnText,
          border: 'none',
          fontSize: '0.76rem',
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
          transition: 'all 0.15s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.filter = 'brightness(1.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.filter = 'none';
        }}
      >
        <span>👉 {card.action_label || 'Bấm để mở hồ sơ'}</span>
        <ArrowRight size={13} strokeWidth={2.4} />
      </button>
    </div>
  );
};
