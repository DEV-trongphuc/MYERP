import React, { useState, useRef, useEffect } from 'react';
import { X, Smile, Search, ChevronLeft, ChevronRight } from 'lucide-react';

export interface StickerPack {
  id: string;
  name: string;
  icon: string;
  count: number;
  ext: 'png' | 'gif' | 'jpg' | 'webp';
  isGif?: boolean;
  isBrand?: boolean;
  badge?: string;
}

export const STICKER_PACKS: StickerPack[] = [
  {
    id: 'ideas',
    name: 'IDEAS with love',
    icon: '/stickers/ideas/ideas_1.webp',
    count: 24,
    ext: 'webp',
    isBrand: true,
    badge: 'Thương hiệu'
  },
  {
    id: 'ghost',
    name: 'Ghost Cute',
    icon: '/stickers/ghost/ghost_1.gif',
    count: 14,
    ext: 'gif',
    isGif: true
  },
  {
    id: 'maruko',
    name: 'Maruko',
    icon: '/stickers/maruko/maruko_1.png',
    count: 20,
    ext: 'png'
  },
  {
    id: 'smalldog',
    name: 'Cún con',
    icon: '/stickers/smalldog/smalldog_1.gif',
    count: 16,
    ext: 'gif',
    isGif: true
  },
  {
    id: 'girl',
    name: 'Girl',
    icon: '/stickers/girl/girl_1.gif',
    count: 14,
    ext: 'gif',
    isGif: true
  },
  {
    id: 'seal',
    name: 'Hải cẩu',
    icon: '/stickers/seal/seal_1.gif',
    count: 8,
    ext: 'gif',
    isGif: true
  },
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
  corporateStickers?: any[];
  onSelectCorporateSticker?: (sticker: any) => void;
  anchorEl?: HTMLElement | null;
  mode?: 'modal' | 'popover';
  zIndex?: number;
  initialTab?: string;
}

export const StickerPickerModal: React.FC<StickerPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectSticker,
  onSelectEmoji,
  corporateStickers,
  onSelectCorporateSticker,
  anchorEl,
  mode = 'popover',
  zIndex = 2147483647,
  initialTab = 'ideas'
}) => {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [ideasGender, setIdeasGender] = useState<'male' | 'female'>('male');
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  // Position calculation for popover mode
  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'popover' && anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      const pickerWidth = 350;
      const pickerHeight = 390;
      
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
              zIndex: zIndex
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
              zIndex: zIndex,
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
              {activeTab === 'emoji' ? 'Biểu cảm & Emoji' : activeTab === 'corporate' ? 'Nhãn dán: Doanh nghiệp' : `Nhãn dán: ${currentPack?.name || 'Sticker'}`}
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
          ) : activeTab === 'corporate' && Array.isArray(corporateStickers) && corporateStickers.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px'
            }}>
              {corporateStickers.map((stk) => (
                <div
                  key={stk.id}
                  onClick={() => {
                    if (onSelectCorporateSticker) {
                      onSelectCorporateSticker(stk);
                    }
                    onClose();
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '10px',
                    background: stk.bgGradient,
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                    transition: 'transform 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.03)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <span style={{ fontSize: '1.25rem' }}>{stk.icon}</span>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {stk.name}
                  </span>
                </div>
              ))}
            </div>
          ) : currentPack ? (
            <div>
              {/* Gender selector tab for IDEAS with love */}
              {currentPack.id === 'ideas' && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '10px',
                  padding: '3px',
                  background: '#f1f5f9',
                  borderRadius: '10px'
                }}>
                  <button
                    type="button"
                    onClick={() => setIdeasGender('male')}
                    title="Bộ Nam (12 nhãn dán)"
                    style={{
                      flex: 1,
                      padding: '7px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: ideasGender === 'male' ? '#ffffff' : 'transparent',
                      color: ideasGender === 'male' ? '#2563eb' : '#94a3b8',
                      cursor: 'pointer',
                      boxShadow: ideasGender === 'male' ? '0 2px 6px rgba(37, 99, 235, 0.15)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: ideasGender === 'male' ? '#2563eb' : '#94a3b8' }}>
                      <circle cx="10" cy="14" r="5" />
                      <line x1="19" y1="5" x2="13.6" y2="10.4" />
                      <polyline points="19 11 19 5 13 5" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIdeasGender('female')}
                    title="Bộ Nữ (12 nhãn dán)"
                    style={{
                      flex: 1,
                      padding: '7px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: ideasGender === 'female' ? '#ffffff' : 'transparent',
                      color: ideasGender === 'female' ? '#ec4899' : '#94a3b8',
                      cursor: 'pointer',
                      boxShadow: ideasGender === 'female' ? '0 2px 6px rgba(236, 72, 153, 0.15)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: ideasGender === 'female' ? '#ec4899' : '#94a3b8' }}>
                      <circle cx="12" cy="9" r="5" />
                      <line x1="12" y1="14" x2="12" y2="21" />
                      <line x1="9" y1="18" x2="15" y2="18" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Grid of stickers */}
              {(() => {
                let itemNumbers: number[] = [];
                if (currentPack.id === 'ideas') {
                  itemNumbers = ideasGender === 'male'
                    ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
                    : [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
                } else {
                  itemNumbers = Array.from({ length: currentPack.count }).map((_, i) => i + 1);
                }

                return (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '10px',
                    alignItems: 'center'
                  }}>
                    {itemNumbers.map((num) => {
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
                            background: 'transparent'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.transform = 'scale(1.18)';
                            e.currentTarget.style.boxShadow = '0 6px 14px rgba(0,0,0,0.12)';
                            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = 'none';
                            e.currentTarget.style.background = 'transparent';
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
                );
              })()}
            </div>
          ) : null}
        </div>

        {/* Bottom Pack Tabs Navigation with Prev/Next Buttons */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 8px',
          borderTop: '1px solid var(--color-border-light, #e2e8f0)',
          background: 'var(--color-bg, #f8fafc)',
          gap: '4px'
        }}>
          {/* Scroll Prev Button */}
          <button
            type="button"
            onClick={() => {
              tabsScrollRef.current?.scrollBy({ left: -90, behavior: 'smooth' });
            }}
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              border: 'none',
              background: '#ffffff',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              flexShrink: 0
            }}
            title="Cuộn sang trái"
          >
            <ChevronLeft size={14} />
          </button>

          {/* Scrollable Tabs Track */}
          <div
            ref={tabsScrollRef}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              padding: '2px 4px'
            }}
          >
            {/* Emoji Tab */}
            <button
              type="button"
              onClick={(e) => {
                setActiveTab('emoji');
                e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
              }}
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
                transition: 'all 0.15s',
                flexShrink: 0
              }}
              title="Biểu cảm Emoji"
            >
              😀
            </button>

            <div style={{ width: '1px', height: '18px', background: 'var(--color-border-light, #e2e8f0)', margin: '0 2px', flexShrink: 0 }} />

            {/* Sticker Pack Tabs */}
            {(STICKER_PACKS || []).map(pack => {
              const isSelected = activeTab === pack.id;
              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={(e) => {
                    setActiveTab(pack.id);
                    e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                  }}
                  style={{
                    position: 'relative',
                    width: '36px',
                    height: '36px',
                    padding: '2px',
                    borderRadius: '9px',
                    border: isSelected 
                      ? (pack.isBrand ? '2.5px solid #dc2626' : '2px solid var(--color-primary, #3b82f6)') 
                      : (pack.isBrand ? '2px solid #ef4444' : '1px solid transparent'),
                    background: isSelected 
                      ? (pack.isBrand ? '#fee2e2' : 'rgba(59, 130, 246, 0.12)') 
                      : (pack.isBrand ? '#fff1f2' : 'transparent'),
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
                      objectFit: 'contain',
                      borderRadius: '6px'
                    }}
                  />
                  {pack.isBrand && (
                    <span style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      background: '#dc2626',
                      color: '#ffffff',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      border: '1px solid #ffffff'
                    }}>
                      ★
                    </span>
                  )}
                </button>
              );
            })}

            {/* Corporate Stickers Tab */}
            {corporateStickers && corporateStickers.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  setActiveTab('corporate');
                  e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                }}
                style={{
                  height: '34px',
                  padding: '3px 8px',
                  borderRadius: '8px',
                  border: activeTab === 'corporate' ? '2px solid var(--color-primary, #3b82f6)' : '1px solid transparent',
                  background: activeTab === 'corporate' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                  transition: 'all 0.15s',
                  flexShrink: 0
                }}
                title="Biểu ngữ Doanh nghiệp"
              >
                💼
              </button>
            )}
          </div>

          {/* Scroll Next Button */}
          <button
            type="button"
            onClick={() => {
              tabsScrollRef.current?.scrollBy({ left: 90, behavior: 'smooth' });
            }}
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              border: 'none',
              background: '#ffffff',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              flexShrink: 0
            }}
            title="Cuộn sang phải"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
