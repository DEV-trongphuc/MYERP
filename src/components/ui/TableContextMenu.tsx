import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Phone, Copy, QrCode, MessageCircle, 
  ExternalLink, ChevronRight, Check, Tag, 
  Trash2, UserCheck, ShieldAlert 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { playPopSound, playDingSound } from '../../utils/confettiHelper';
import { useUIStore } from '../../store/uiStore';

export interface TableContextMenuProps {
  x: number;
  y: number;
  isOpen: boolean;
  onClose: () => void;
  item: {
    id: string | number;
    name?: string;
    full_name?: string;
    phone?: string;
    email?: string;
    status?: string;
    lead_status?: string;
    pipeline_stage_id?: string | number;
    [key: string]: any;
  } | null;
  onOpenProfile?: (item: any) => void;
  onChangeStatus?: (item: any, newStatus: string) => void;
  onAssign?: (item: any) => void;
  onDelete?: (item: any) => void;
  availableStatuses?: Array<{ id: string; label: string; color?: string }>;
}

export const TableContextMenu: React.FC<TableContextMenuProps> = ({
  x,
  y,
  isOpen,
  onClose,
  item,
  onOpenProfile,
  onChangeStatus,
  onAssign,
  onDelete,
  availableStatuses
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showStatusSubmenu, setShowStatusSubmenu] = useState(false);
  const [coords, setCoords] = useState({ top: y, left: x });

  // Calculate position with viewport boundary clamping
  useEffect(() => {
    if (!isOpen) {
      setShowStatusSubmenu(false);
      return;
    }

    const menuWidth = 240;
    const menuHeight = 320;
    const padding = 12;

    let posX = x;
    let posY = y;

    if (posX + menuWidth > window.innerWidth - padding) {
      posX = Math.max(padding, window.innerWidth - menuWidth - padding);
    }
    if (posY + menuHeight > window.innerHeight - padding) {
      posY = Math.max(padding, window.innerHeight - menuHeight - padding);
    }

    setCoords({ top: posY, left: posX });
  }, [x, y, isOpen]);

  // Click outside and ESC key listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleContextMenuOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('contextmenu', handleContextMenuOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('contextmenu', handleContextMenuOutside);
    };
  }, [isOpen, onClose]);

  if (typeof document === 'undefined' || !isOpen || !item) return null;

  const displayName = item.name || item.full_name || 'Khách hàng #' + item.id;
  const rawPhone = item.phone || '';
  const cleanPhone = rawPhone.replace(/[^\d+]/g, '');

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text);
      playPopSound();
      toast.success(`Đã sao chép ${label}!`, { id: 'ctx-copy' });
    } catch {
      toast.error('Không thể sao chép');
    }
    onClose();
  };

  const handleOpenQRCall = () => {
    if (!cleanPhone) {
      toast.error('Khách hàng chưa có số điện thoại');
      return;
    }
    playPopSound();
    useUIStore.getState().showCall(cleanPhone);
    onClose();
  };

  const handleOpenZalo = () => {
    if (!cleanPhone) {
      toast.error('Khách hàng chưa có số điện thoại');
      return;
    }
    playPopSound();
    const zaloNumber = cleanPhone.startsWith('0') ? cleanPhone : '0' + cleanPhone.replace(/^\+?84/, '');
    window.open(`https://zalo.me/${zaloNumber}`, '_blank');
    onClose();
  };

  const handleSelectStatus = (statusId: string) => {
    playDingSound();
    if (onChangeStatus) {
      onChangeStatus(item, statusId);
    }
    onClose();
  };

  const defaultStatuses = availableStatuses || [
    { id: 'new', label: 'Chưa chăm sóc', color: '#64748b' },
    { id: 'in_progress', label: 'Đang tư vấn', color: '#3b82f6' },
    { id: 'potential', label: 'Tiềm năng cao', color: '#10b981' },
    { id: 'won', label: 'Đã chốt (Won)', color: '#059669' },
    { id: 'lost', label: 'Không mua / Hủy', color: '#ef4444' },
  ];

  return createPortal(
    <AnimatePresence>
      <div 
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2147483646,
          pointerEvents: 'none'
        }}
      >
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.94, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94 }}
          transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] as any }}
          style={{
            position: 'absolute',
            top: coords.top,
            left: coords.left,
            width: 240,
            background: '#18181b', // Solid Dark Surface (Không dùng kính mờ)
            border: '1px solid #27272a',
            borderRadius: '10px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.6)',
            padding: '6px',
            color: '#f4f4f5',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '13px',
            pointerEvents: 'auto',
            userSelect: 'none',
            zIndex: 2147483647
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Info */}
          <div style={{
            padding: '8px 10px 10px 10px',
            borderBottom: '1px solid #27272a',
            marginBottom: '4px'
          }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {displayName}
            </div>
            {cleanPhone && (
              <div style={{ fontSize: '11px', color: '#a1a1aa', marginTop: '2px', fontFamily: 'monospace' }}>
                {rawPhone}
              </div>
            )}
          </div>

          {/* Action List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {/* View Profile */}
            {onOpenProfile && (
              <button
                type="button"
                className="ctx-item"
                onClick={() => {
                  playPopSound();
                  onOpenProfile(item);
                  onClose();
                }}
              >
                <User size={15} style={{ color: '#38bdf8' }} />
                <span>Xem hồ sơ chi tiết</span>
              </button>
            )}

            {/* Copy Phone */}
            {cleanPhone && (
              <button
                type="button"
                className="ctx-item"
                onClick={() => handleCopy(cleanPhone, 'Số điện thoại')}
              >
                <Copy size={15} style={{ color: '#a1a1aa' }} />
                <span>Sao chép SĐT</span>
              </button>
            )}

            {/* Call via QR */}
            {cleanPhone && (
              <button
                type="button"
                className="ctx-item"
                onClick={handleOpenQRCall}
              >
                <QrCode size={15} style={{ color: '#34d399' }} />
                <span>Gọi điện qua QR</span>
              </button>
            )}

            {/* Zalo */}
            {cleanPhone && (
              <button
                type="button"
                className="ctx-item"
                onClick={handleOpenZalo}
              >
                <MessageCircle size={15} style={{ color: '#60a5fa' }} />
                <span>Nhắn tin Zalo</span>
              </button>
            )}

            {/* Change Status (Submenu trigger) */}
            {onChangeStatus && (
              <div 
                style={{ position: 'relative' }}
                onMouseEnter={() => setShowStatusSubmenu(true)}
                onMouseLeave={() => setShowStatusSubmenu(false)}
              >
                <button
                  type="button"
                  className="ctx-item"
                  style={{ justifyContent: 'space-between' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Tag size={15} style={{ color: '#f59e0b' }} />
                    <span>Đổi trạng thái</span>
                  </div>
                  <ChevronRight size={14} style={{ color: '#71717a' }} />
                </button>

                {/* Submenu */}
                {showStatusSubmenu && (
                  <motion.div
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    style={{
                      position: 'absolute',
                      top: -6,
                      left: '100%',
                      marginLeft: '6px',
                      width: 170,
                      background: '#18181b', // Solid Dark
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                      boxShadow: '0 15px 25px -5px rgba(0, 0, 0, 0.7)',
                      padding: '4px',
                      zIndex: 2147483647
                    }}
                  >
                    {defaultStatuses.map((st) => {
                      const isCurrent = String(item.status || item.lead_status) === String(st.id);
                      return (
                        <button
                          key={st.id}
                          type="button"
                          className="ctx-item"
                          onClick={() => handleSelectStatus(st.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '12px',
                            fontWeight: isCurrent ? 700 : 500
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: st.color || '#94a3b8'
                            }} />
                            <span>{st.label}</span>
                          </div>
                          {isCurrent && <Check size={13} style={{ color: '#10b981' }} />}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </div>
            )}

            {/* Assign */}
            {onAssign && (
              <button
                type="button"
                className="ctx-item"
                onClick={() => {
                  playPopSound();
                  onAssign(item);
                  onClose();
                }}
              >
                <UserCheck size={15} style={{ color: '#c084fc' }} />
                <span>Gán tư vấn viên</span>
              </button>
            )}

            {/* Delete */}
            {onDelete && (
              <>
                <div style={{ height: '1px', background: '#27272a', margin: '4px 0' }} />
                <button
                  type="button"
                  className="ctx-item danger"
                  onClick={() => {
                    playPopSound();
                    onDelete(item);
                    onClose();
                  }}
                >
                  <Trash2 size={15} style={{ color: '#f87171' }} />
                  <span>Xóa / Lưu trữ</span>
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>

      <style>{`
        .ctx-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 7px 10px;
          border: none;
          background: transparent;
          color: #e4e4e7;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          text-align: left;
          transition: background 0.12s ease, color 0.12s ease;
          user-select: none;
        }
        .ctx-item:hover {
          background: #27272a !important;
          color: #ffffff !important;
        }
        .ctx-item.danger:hover {
          background: rgba(239, 68, 68, 0.15) !important;
          color: #fca5a5 !important;
        }
      `}</style>
    </AnimatePresence>,
    document.body
  );
};
