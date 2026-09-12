import React, { useState, useRef, useEffect } from 'react';
import { X, Smile, Search } from 'lucide-react';

export interface StickerPack {
  id: string;
  name: string;
  icon: string;
  count: number;
  ext: 'png' | 'gif';
  isGif?: boolean;
}

export const STICKER_PACKS: StickerPack[] = [
  {
    id: 'meep',
    name: 'Meep',
    icon: '/stickers/meep/meep_3.png',
    count: 16,
    ext: 'png'
  },
  {
    id: 'foxlove',
    name: 'Fox Love',
    icon: '/stickers/foxlove/foxlove_1.png',
    count: 16,
    ext: 'png'
  },
  {
    id: 'buffalo',
    name: 'Buffalo',
    icon: '/stickers/buffalo/buffalo_1.gif',
    count: 11,
    ext: 'gif',
    isGif: true
  },
  {
    id: 'minion',
    name: 'Minions',
    icon: '/stickers/minion/minion_1.png',
    count: 20,
    ext: 'png'
  }
];

export const POPULAR_EMOJIS = [
  // Cảm xúc & Mặt cười
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇',
  '🥰', '😍', '🤩', '😘', '😋', '😜', '🤪', '🤑', '🤗', '🤔', '🤐', '🤨',
  '😐', '😏', '😒', '🙄', '😬', '😔', '😴', '😷', '🥵', '🥶', '🤯', '🥳',
  '😎', '🤓', '🧐', '😭', '😱', '🥺', '😡', '🤬', '😈', '👻', '💀', '👽',
  // Trái tim & Cảm xúc
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '❣️', '💕', '💞',
  '💓', '💗', '💖', '💘', '💝', '💟', '💋', '💯', '✨', '🔥', '⭐', '🌟',
  // Cử chỉ & Bàn tay
  '👍', '👎', '👏', '🙌', '👐', '🤝', '👊', '✊', '🤛', '🤜', '🤞', '✌️',
  '🤟', '🤘', '👌', '👈', '👉', '👆', '👇', '✋', '👋', '🤙', '💪', '🙏',
  // Chúc mừng & Công việc
  '🎉', '🎊', '🏆', '🥇', '🥈', '🥉', '👑', '💎', '💡', '🎯', '🚀', '🎁',
  '🎈', '🍻', '☕', '💰', '💵', '📊', '📈', '📅', '⏰', '💼', '📌', '🔔'
];

interface StickerPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSticker: (url: string, packId: string) => void;
  onSelectEmoji?: (emoji: string) => void;
  anchorEl?: HTMLElement | null;
  mode?: 'modal' | 'popover';
}

export const StickerPickerModal: React.FC<StickerPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectSticker,
  onSelectEmoji,
  anchorEl,
  mode = 'popover'
}) => {
  const [activeTab, setActiveTab] = useState<string>('meep');
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Position calculation for popover mode
  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'popover' && anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      const pickerWidth = 340;
      const pickerHeight = 380;
      
      let top = rect.top - pickerHeight - 8;
      // If not enough space above, display below
      if (top < 10) {
        top = rect.bottom + 8;
      }
      
      let left = rect.left - 100;
      if (left + pickerWidth > window.innerWidth - 16) {
        left = window.innerWidth - pickerWidth - 16;
      }
      if (left < 16) {
        left = 16;
      }

      setPopoverPos({ top, left });
    }
  }, [isOpen, anchorEl, mode]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current && 
        !containerRef.current.contains(e.target as Node) &&
        (!anchorEl || !anchorEl.contains(e.target as Node))
      ) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, anchorEl]);

  if (!isOpen) return null;

  const currentPack = STICKER_PACKS.find(p => p.id === activeTab);

  return (
    <div 
      style={
        mode === 'popover' && popoverPos
          ? {
              position: 'fixed',
              top: `${popoverPos.top}px`,
              left: `${popoverPos.left}px`,
              zIndex: 99999
            }
          : {
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99999,
              backdropFilter: 'blur(3px)'
            }
      }
    >
      <div
        ref={containerRef}
        style={{
          width: '350px',
          height: '390px',
          background: 'var(--color-surface, #ffffff)',
          color: 'var(--color-text, #1e293b)',
          borderRadius: '16px',
          boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.35), 0 0 0 1px var(--color-border, rgba(255, 255, 255, 0.1))',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'scaleUpFade 0.18s ease-out'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid var(--color-border-light, #e2e8f0)',
          background: 'var(--color-bg, #f8fafc)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.1rem' }}>✨</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
              {activeTab === 'emoji' ? 'Biểu cảm & Emoji' : `Nhãn dán: ${currentPack?.name || 'Sticker'}`}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-muted, #64748b)',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Stickers / Emojis Grid Area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          background: 'var(--color-surface, #ffffff)'
        }}>
          {activeTab === 'emoji' ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '6px',
              textAlign: 'center'
            }}>
              {POPULAR_EMOJIS.map((em, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (onSelectEmoji) onSelectEmoji(em);
                    onClose();
                  }}
                  style={{
                    fontSize: '1.4rem',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 0',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    userSelect: 'none'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'scale(1.25)';
                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {em}
                </button>
              ))}
            </div>
          ) : currentPack ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '10px',
              alignItems: 'center'
            }}>
              {Array.from({ length: currentPack.count }).map((_, i) => {
                const num = i + 1;
                const stickerUrl = `/stickers/${currentPack.id}/${currentPack.id}_${num}.${currentPack.ext}`;
                return (
                  <div
                    key={num}
                    onClick={() => {
                      onSelectSticker(stickerUrl, currentPack.id);
                      onClose();
                    }}
                    style={{
                      aspectRatio: '1',
                      borderRadius: '12px',
                      padding: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      background: 'rgba(0, 0, 0, 0.02)'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'scale(1.18)';
                      e.currentTarget.style.boxShadow = '0 6px 14px rgba(0,0,0,0.12)';
                      e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.02)';
                    }}
                  >
                    <img
                      src={stickerUrl}
                      alt={`${currentPack.name} ${num}`}
                      loading="lazy"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        pointerEvents: 'none',
                        userSelect: 'none'
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Bottom Pack Tabs Navigation */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 10px',
          borderTop: '1px solid var(--color-border-light, #e2e8f0)',
          background: 'var(--color-bg, #f8fafc)',
          overflowX: 'auto'
        }}>
          {/* Emoji Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('emoji')}
            style={{
              padding: '5px 8px',
              borderRadius: '8px',
              border: activeTab === 'emoji' ? '1px solid var(--color-primary, #3b82f6)' : '1px solid transparent',
              background: activeTab === 'emoji' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
              cursor: 'pointer',
              fontSize: '1.15rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s'
            }}
            title="Biểu cảm Emoji"
          >
            😀
          </button>

          <div style={{ width: '1px', height: '18px', background: 'var(--color-border-light, #e2e8f0)', margin: '0 2px' }} />

          {/* Sticker Pack Tabs */}
          {STICKER_PACKS.map(pack => (
            <button
              key={pack.id}
              type="button"
              onClick={() => setActiveTab(pack.id)}
              style={{
                width: '34px',
                height: '34px',
                padding: '3px',
                borderRadius: '8px',
                border: activeTab === pack.id ? '2px solid var(--color-primary, #3b82f6)' : '1px solid transparent',
                background: activeTab === pack.id ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
                flexShrink: 0
              }}
              title={pack.name}
            >
              <img
                src={pack.icon}
                alt={pack.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain'
                }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
