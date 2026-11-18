import React from 'react';
import { 
  User, CheckSquare, Receipt, CreditCard, GitBranch, 
  FileText, ArrowRight, Copy, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { ErpCardTagData } from './chatTagParsers';
import { copyTextSafely } from '../../utils/clipboard';
import { getTenantFrontendUrl } from '../../contexts/TenantConfigContext';

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
          bg: '#F8FAFC',
          hoverBg: '#F1F5F9',
          border: '#CBD5E1',
          accent: '#334155',
          btnBg: '#0F172A',
          btnText: '#ffffff',
          badgeBg: '#F1F5F9',
          badgeText: '#334155',
          label: 'Hồ sơ Nhân sự',
          icon: User,
        };
      case 'contact':
      case 'customer':
      case 'student':
      case 'lead':
        return {
          bg: '#F8FAFC',
          hoverBg: '#F1F5F9',
          border: '#BAE6FD',
          accent: '#0284C7',
          btnBg: '#0284C7',
          btnText: '#ffffff',
          badgeBg: '#E0F2FE',
          badgeText: '#0369A1',
          label: 'Hồ sơ Học viên / Lead',
          icon: User,
        };
      case 'expense':
      case 'po':
      case 'payment_order':
        return {
          bg: '#F0FDF4',
          hoverBg: '#DCFCE7',
          border: '#BBF7D0',
          accent: '#16A34A',
          btnBg: '#16A34A',
          btnText: '#ffffff',
          badgeBg: '#DCFCE7',
          badgeText: '#15803D',
          label: 'Phiếu chi / PO',
          icon: CreditCard,
        };
      case 'deposit':
      case 'so':
      case 'sale_order':
        return {
          bg: '#F0FDFA',
          hoverBg: '#CCFBF1',
          border: '#99F6E4',
          accent: '#0D9488',
          btnBg: '#0D9488',
          btnText: '#ffffff',
          badgeBg: '#CCFBF1',
          badgeText: '#0F766E',
          label: 'Phiếu đặt cọc (SO)',
          icon: Receipt,
        };
      case 'task':
      case 'activity':
        return {
          bg: '#FFFBEB',
          hoverBg: '#FEF3C7',
          border: '#FDE68A',
          accent: '#D97706',
          btnBg: '#B45309',
          btnText: '#ffffff',
          badgeBg: '#FEF3C7',
          badgeText: '#B45309',
          label: 'Công việc Workspace',
          icon: CheckSquare,
        };
      case 'approval':
      case 'workflow':
      case 'leave':
        return {
          bg: '#FEF2F2',
          hoverBg: '#FEE2E2',
          border: '#FECACA',
          accent: '#BD1D2D',
          btnBg: '#BD1D2D',
          btnText: '#ffffff',
          badgeBg: 'rgba(189, 29, 45, 0.08)',
          badgeText: '#BD1D2D',
          label: 'Quy trình & Phê duyệt',
          icon: GitBranch,
        };
      default:
        return {
          bg: '#F8FAFC',
          hoverBg: '#F1F5F9',
          border: '#CBD5E1',
          accent: '#334155',
          btnBg: '#334155',
          btnText: '#ffffff',
          badgeBg: '#E2E8F0',
          badgeText: '#334155',
          label: 'Đối tượng ERP',
          icon: FileText,
        };
    }
  })();

  const IconComp = themeConfig.icon;

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const baseUrl = getTenantFrontendUrl() || window.location.origin;
    const url = card.direct_url || (card.relative_url ? `${baseUrl}${card.relative_url}` : window.location.href);
    const ok = await copyTextSafely(url);
    if (ok) {
      setCopied(true);
      toast.success('Đã sao chép liên kết trực tiếp');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Không thể sao chép liên kết');
    }
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
        marginBottom: '4px',
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
        padding: '12px',
        cursor: 'pointer',
        transition: 'border-color 0.18s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth: '340px',
        position: 'relative',
        overflow: 'hidden'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#CBD5E1';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#E2E8F0';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.04)';
      }}
    >
      {/* Top Header Badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '4px',
          background: themeConfig.badgeBg,
          color: themeConfig.badgeText,
          border: 'none',
          fontSize: '0.68rem',
          fontWeight: 700,
          letterSpacing: '0.03em',
          textTransform: 'uppercase'
        }}>
          <IconComp size={12} strokeWidth={2} />
          <span>{themeConfig.label}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {card.entity_id && (
            <span style={{
              fontSize: '0.7rem',
              color: '#64748B',
              fontWeight: 600,
              fontFamily: 'monospace',
              fontVariantNumeric: 'tabular-nums'
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
              padding: '4px',
              borderRadius: '4px',
              color: copied ? '#16A34A' : '#94A3B8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {copied ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} strokeWidth={1.75} />}
          </button>
        </div>
      </div>

      {/* Main Entity Title */}
      <div>
        <div style={{
          fontWeight: 600,
          fontSize: '0.88rem',
          color: '#0F172A',
          lineHeight: 1.35,
          marginBottom: card.subtitle ? '4px' : '0'
        }}>
          {card.title}
        </div>
        {card.subtitle && (
          <div style={{
            fontSize: '0.75rem',
            color: '#64748B',
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
          gap: '8px',
          width: '100%',
          padding: '8px 12px',
          borderRadius: '8px',
          background: themeConfig.btnBg,
          color: themeConfig.btnText,
          border: 'none',
          fontSize: '0.76rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'opacity 0.15s cubic-bezier(0.22, 1, 0.36, 1)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.9';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
      >
        <span>{card.action_label || 'Mở hồ sơ'}</span>
        <ArrowRight size={12} strokeWidth={2} />
      </button>
    </div>
  );
};
