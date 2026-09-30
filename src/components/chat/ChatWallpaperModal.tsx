import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Check, Upload, Sparkles, RefreshCw, 
  Sliders, Palette, Trash2, Eye, ShieldCheck, 
  Smile, Send, Paperclip, CheckCheck, Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { WALLPAPER_PRESETS, resolveChatFileUrl, type WallpaperPreset } from '../../utils/chatWallpapers';
import type { ChatWallpaperConfig } from '../../types/chat';
import { compressImageFile } from '../../utils/imageCompressor';
import api from '../../api/axios';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentWallpaper?: ChatWallpaperConfig;
  onSaveWallpaper: (wallpaperConfig: ChatWallpaperConfig | null) => Promise<void>;
  conversationTitle?: string;
  avatarUrl?: string;
}

export const ChatWallpaperModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentWallpaper,
  onSaveWallpaper,
  conversationTitle = 'Cuộc trò chuyện',
  avatarUrl
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(currentWallpaper?.preset_id || 'default');
  const [customUrl, setCustomUrl] = useState<string>(currentWallpaper?.custom ? (currentWallpaper.url || '') : '');
  const [overlayOpacity, setOverlayOpacity] = useState<number>(
    typeof currentWallpaper?.overlay_opacity === 'number' ? currentWallpaper.overlay_opacity : 1
  );
  const [activeTab, setActiveTab] = useState<'all' | 'gradient' | 'pattern' | 'dark'>('all');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Responsive mobile detection
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (currentWallpaper?.custom && currentWallpaper.url) {
        setCustomUrl(currentWallpaper.url);
        setSelectedPresetId('');
      } else {
        setSelectedPresetId(currentWallpaper?.preset_id || 'default');
        setCustomUrl('');
      }
      setOverlayOpacity(
        typeof currentWallpaper?.overlay_opacity === 'number' ? currentWallpaper.overlay_opacity : 1
      );
    }
  }, [isOpen, currentWallpaper]);

  const resolvedCustomUrl = useMemo(() => resolveChatFileUrl(customUrl), [customUrl]);

  if (!isOpen) return null;

  const filteredPresets = activeTab === 'all' 
    ? WALLPAPER_PRESETS 
    : WALLPAPER_PRESETS.filter(p => p.category === activeTab);

  // Active preview configuration
  const activePreset = WALLPAPER_PRESETS.find(p => p.id === selectedPresetId);
  const isCustomActive = Boolean(customUrl && !selectedPresetId);
  const previewBackground = isCustomActive 
    ? `url("${resolvedCustomUrl}")` 
    : (activePreset ? activePreset.cssBackground : '#ffffff');

  const handleCustomUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn tệp tin hình ảnh (.png, .jpg, .webp, .jpeg)');
      return;
    }

    try {
      setIsUploading(true);
      const loadingToast = toast.loading('Đang nén và tải lên ảnh nền chất lượng cao...');

      // Compress WebP
      const compressed = await compressImageFile(file, { maxWidth: 1920, maxHeight: 1920, quality: 0.88 });
      const formData = new FormData();
      formData.append('file', compressed);

      const res = await api.post('/chat/upload', formData);
      const url = res.data?.data?.url || res.data?.url;

      if (!url) throw new Error('Không nhận được đường dẫn ảnh từ máy chủ');

      setCustomUrl(url);
      setSelectedPresetId('');
      setOverlayOpacity(1); // Default 100% overlay
      toast.dismiss(loadingToast);
      toast.success('Đã tải lên ảnh nền thành công!');
    } catch (err: any) {
      console.error('Lỗi tải ảnh nền:', err);
      toast.error(err.response?.data?.message || err.message || 'Không thể tải ảnh lên');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      if (isCustomActive && customUrl) {
        await onSaveWallpaper({
          custom: true,
          url: customUrl,
          overlay_opacity: overlayOpacity,
          name: 'Ảnh tùy chỉnh'
        });
      } else if (selectedPresetId && selectedPresetId !== 'default') {
        const p = WALLPAPER_PRESETS.find(x => x.id === selectedPresetId);
        await onSaveWallpaper({
          preset_id: selectedPresetId,
          name: p?.name,
          overlay_opacity: overlayOpacity,
          custom: false
        });
      } else {
        // Reset to default clean white
        await onSaveWallpaper(null);
      }
      toast.success('Đã lưu ảnh nền cho cuộc trò chuyện!');
      onClose();
    } catch (e: any) {
      console.error('Lỗi lưu hình nền:', e);
      toast.error('Không thể lưu hình nền, vui lòng thử lại');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefault = async () => {
    try {
      setIsSaving(true);
      await onSaveWallpaper(null);
      setSelectedPresetId('default');
      setCustomUrl('');
      setOverlayOpacity(1);
      toast.success('Đã khôi phục ảnh nền mặc định!');
      onClose();
    } catch (e) {
      toast.error('Lỗi khôi phục mặc định');
    } finally {
      setIsSaving(false);
    }
  };

  // Live Chat Preview Sub-component (Reusable for desktop right column & mobile top banner)
  const renderLiveChatPreview = (compact = false) => (
    <div style={{
      borderRadius: compact ? '14px' : '16px',
      border: '1px solid #cbd5e1',
      boxShadow: compact ? '0 4px 14px rgba(15, 23, 42, 0.08)' : '0 8px 24px rgba(15, 23, 42, 0.1)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      background: '#ffffff',
      position: 'relative',
      height: compact ? '150px' : '100%',
      minHeight: compact ? '150px' : '320px',
      flex: compact ? 'none' : 1
    }}>
      {/* Mockup Chat Header */}
      <div style={{
        padding: compact ? '6px 12px' : '10px 14px',
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div style={{
            width: compact ? 22 : 28,
            height: compact ? 22 : 28,
            borderRadius: '50%',
            background: '#ef4444',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: compact ? '0.62rem' : '0.72rem',
            fontWeight: 700,
            overflow: 'hidden',
            flexShrink: 0
          }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              conversationTitle.slice(0, 1).toUpperCase()
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: compact ? '0.74rem' : '0.78rem', fontWeight: 750, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {conversationTitle}
            </div>
            {!compact && (
              <div style={{ fontSize: '0.65rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981' }} />
                <span>Đang hoạt động</span>
              </div>
            )}
          </div>
        </div>
        <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#ef4444', background: '#fee2e2', padding: '2px 7px', borderRadius: '6px' }}>
          {activePreset?.name || (isCustomActive ? 'Ảnh tải lên' : 'Mặc định')}
        </span>
      </div>

      {/* Mockup Chat Content Body with Applied Wallpaper */}
      <div style={{
        flex: 1,
        position: 'relative',
        background: previewBackground,
        backgroundSize: previewBackground.includes('url(') && !previewBackground.includes('data:image/svg') ? 'cover' : 'auto',
        backgroundPosition: 'center',
        backgroundRepeat: previewBackground.includes('data:image/svg') ? 'repeat' : 'no-repeat',
        padding: compact ? '8px 12px' : '14px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        gap: compact ? '6px' : '10px',
        overflow: 'hidden',
        transition: 'background 0.25s ease'
      }}>
        {/* Contrast overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: '#ffffff',
          opacity: 1 - overlayOpacity,
          pointerEvents: 'none',
          transition: 'opacity 0.2s ease'
        }} />

        {/* Incoming Message Bubble */}
        <div style={{
          alignSelf: 'flex-start',
          maxWidth: compact ? '88%' : '82%',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          zIndex: 2
        }}>
          <div style={{
            padding: compact ? '5px 9px' : '8px 12px',
            borderRadius: '12px 12px 12px 3px',
            background: '#ffffff',
            color: '#0f172a',
            fontSize: compact ? '0.72rem' : '0.78rem',
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            lineHeight: 1.3
          }}>
            Ảnh nền trực quan, chữ siêu nét ✨
          </div>
        </div>

        {/* Outgoing Message Bubble */}
        <div style={{
          alignSelf: 'flex-end',
          maxWidth: compact ? '88%' : '82%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '2px',
          zIndex: 2
        }}>
          <div style={{
            padding: compact ? '5px 9px' : '8px 12px',
            borderRadius: '12px 12px 3px 12px',
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: '#ffffff',
            fontSize: compact ? '0.72rem' : '0.78rem',
            fontWeight: 600,
            boxShadow: '0 3px 10px rgba(220, 38, 38, 0.28)',
            lineHeight: 1.3
          }}>
            Đã đồng bộ realtime tức thì 👍
          </div>
        </div>
      </div>

      {/* Mockup Chat Input Bar (Desktop only) */}
      {!compact && (
        <div style={{
          padding: '8px 10px',
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          zIndex: 10
        }}>
          <Smile size={15} color="#94a3b8" />
          <Paperclip size={15} color="#94a3b8" />
          <div style={{
            flex: 1,
            padding: '5px 10px',
            background: '#f1f5f9',
            borderRadius: '8px',
            fontSize: '0.72rem',
            color: '#94a3b8'
          }}>
            Nhập tin nhắn...
          </div>
          <div style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: '#ef4444',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Send size={11} />
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: isMobile ? 0 : '16px'
      }}
      onClick={onClose}
    >
      <motion.div
        initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.94, y: 18 }}
        animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
        exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.94, y: 18 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: '100%',
          maxWidth: isMobile ? '100vw' : '1020px',
          height: isMobile ? '92dvh' : 'min(720px, 92vh)',
          maxHeight: isMobile ? '92dvh' : '92vh',
          background: '#ffffff',
          borderRadius: isMobile ? '20px 20px 0 0' : '22px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Swipe / Grabber Bar */}
        {isMobile && (
          <div style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: '#cbd5e1',
            margin: '8px auto 0',
            flexShrink: 0
          }} />
        )}

        {/* Modal Header */}
        <div style={{
          padding: isMobile ? '10px 16px' : '14px 20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ffffff',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
            <div style={{
              width: isMobile ? 32 : 36,
              height: isMobile ? 32 : 36,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.28)',
              flexShrink: 0
            }}>
              <Palette size={isMobile ? 16 : 18} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: isMobile ? '0.9rem' : '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Ảnh nền cuộc trò chuyện
              </h3>
              <p style={{ margin: 0, fontSize: isMobile ? '0.68rem' : '0.73rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Đổi hình nền cho <strong style={{ color: '#0f172a' }}>{conversationTitle}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b',
              transition: 'background 0.15s',
              flexShrink: 0
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        {isMobile ? (
          /* MOBILE SINGLE COLUMN LAYOUT WITH STICKY PREVIEW */
          <div className="custom-scrollbar" style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            minHeight: 0
          }}>
            {/* 1. Mobile Live Preview Card */}
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '6px'
              }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Eye size={12} color="#ef4444" />
                  <span>Xem trước thực tế</span>
                </span>
              </div>
              {renderLiveChatPreview(true)}
            </div>

            {/* 2. Custom Upload Card */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderRadius: '12px',
              background: isCustomActive ? '#eff6ff' : '#f8fafc',
              border: isCustomActive ? '1.5px solid #3b82f6' : '1.5px dashed #cbd5e1',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  background: isCustomActive ? '#dbeafe' : '#f1f5f9',
                  color: isCustomActive ? '#2563eb' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Upload size={15} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.76rem', fontWeight: 750, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {isCustomActive ? 'Đang dùng ảnh tùy chỉnh' : 'Tải ảnh riêng của bạn'}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                    Tự nén WebP tốc độ cao
                  </div>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleCustomUpload}
              />

              <button
                type="button"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: isCustomActive ? '1px solid #93c5fd' : '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: isCustomActive ? '#2563eb' : '#0f172a',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  flexShrink: 0
                }}
              >
                {isUploading ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={12} />}
                <span>{isUploading ? 'Đang tải...' : isCustomActive ? 'Đổi ảnh' : 'Chọn ảnh'}</span>
              </button>
            </div>

            {/* 3. Category Filter Chips (Horizontal Scroll) */}
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px'
              }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 750, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Sparkles size={13} color="#ef4444" />
                  <span>Kho hình nền ({filteredPresets.length})</span>
                </span>

                <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  {[
                    { id: 'all', label: 'Tất cả' },
                    { id: 'gradient', label: 'Gradient' },
                    { id: 'pattern', label: 'Họa tiết' },
                    { id: 'dark', label: 'Tối' }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveTab(cat.id as any)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.66rem',
                        fontWeight: activeTab === cat.id ? 700 : 500,
                        border: 'none',
                        background: activeTab === cat.id ? '#0f172a' : '#f1f5f9',
                        color: activeTab === cat.id ? '#ffffff' : '#64748b',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Presets Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px'
              }}>
                {filteredPresets.map((preset) => {
                  const isSelected = selectedPresetId === preset.id && !customUrl;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => {
                        setSelectedPresetId(preset.id);
                        setCustomUrl('');
                        setOverlayOpacity(preset.defaultOpacity);
                      }}
                      style={{
                        borderRadius: '10px',
                        boxSizing: 'border-box',
                        border: isSelected ? '2px solid #ef4444' : '1.5px solid #e2e8f0',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        boxShadow: isSelected ? '0 3px 10px rgba(239, 68, 68, 0.25)' : 'none'
                      }}
                    >
                      <div style={{
                        height: '46px',
                        background: preset.previewBackground,
                        backgroundSize: 'cover',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {isSelected && (
                          <div style={{
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: '#ef4444',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                          }}>
                            <Check size={11} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <div style={{
                        padding: '4px 4px',
                        background: '#ffffff',
                        fontSize: '0.65rem',
                        fontWeight: isSelected ? 800 : 600,
                        color: isSelected ? '#ef4444' : '#334155',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        textAlign: 'center'
                      }}>
                        {preset.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. Opacity Slider */}
            <div style={{
              padding: '10px 12px',
              borderRadius: '12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', fontWeight: 700, color: '#0f172a' }}>
                  <Sliders size={13} color="#64748b" />
                  <span>Độ tương phản bong bóng</span>
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ef4444' }}>
                  {Math.round(overlayOpacity * 100)}%
                </span>
              </div>

              <input
                type="range"
                min="0.5"
                max="1"
                step="0.02"
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                style={{
                  width: '100%',
                  accentColor: '#ef4444',
                  cursor: 'pointer'
                }}
              />
            </div>
          </div>
        ) : (
          /* DESKTOP 2-COLUMN LAYOUT */
          <div style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            minHeight: 0,
            overflow: 'hidden'
          }}>
            {/* LEFT COLUMN: Controls & Presets */}
            <div className="custom-scrollbar" style={{
              padding: '18px 20px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              borderRight: '1px solid #e2e8f0'
            }}>
              {/* 1. Custom Upload Card */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '14px',
                background: isCustomActive ? '#eff6ff' : '#f8fafc',
                border: isCustomActive ? '1.5px solid #3b82f6' : '1.5px dashed #cbd5e1',
                gap: '12px',
                transition: 'all 0.15s ease'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '10px',
                    background: isCustomActive ? '#dbeafe' : '#f1f5f9',
                    color: isCustomActive ? '#2563eb' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Upload size={17} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 750, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {isCustomActive ? 'Đang dùng ảnh tùy chỉnh' : 'Tải ảnh nền riêng của bạn'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      Hỗ trợ PNG, JPG, WebP. Nén tự động.
                    </div>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleCustomUpload}
                />

                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: '7px 13px',
                    borderRadius: '9px',
                    border: isCustomActive ? '1px solid #93c5fd' : '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: isCustomActive ? '#2563eb' : '#0f172a',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  {isUploading ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={13} />}
                  <span>{isUploading ? 'Đang tải...' : isCustomActive ? 'Đổi ảnh' : 'Chọn ảnh'}</span>
                </button>
              </div>

              {/* 2. Preset Selector */}
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px'
                }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 750, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Sparkles size={14} color="#ef4444" />
                    <span>Kho mẫu hình nền ({filteredPresets.length})</span>
                  </span>

                  {/* Category Filter Pills */}
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {[
                      { id: 'all', label: 'Tất cả' },
                      { id: 'gradient', label: 'Gradient' },
                      { id: 'pattern', label: 'Họa tiết' },
                      { id: 'dark', label: 'Tối' }
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveTab(cat.id as any)}
                        style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.68rem',
                          fontWeight: activeTab === cat.id ? 700 : 500,
                          border: 'none',
                          background: activeTab === cat.id ? '#0f172a' : '#f1f5f9',
                          color: activeTab === cat.id ? '#ffffff' : '#64748b',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Presets Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                  gap: '10px'
                }}>
                  {filteredPresets.map((preset) => {
                    const isSelected = selectedPresetId === preset.id && !customUrl;
                    return (
                      <div
                        key={preset.id}
                        onClick={() => {
                          setSelectedPresetId(preset.id);
                          setCustomUrl('');
                          setOverlayOpacity(preset.defaultOpacity);
                        }}
                        style={{
                          borderRadius: '11px',
                          boxSizing: 'border-box',
                          border: isSelected ? '2px solid #ef4444' : '2px solid #e2e8f0',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                          boxShadow: isSelected ? '0 4px 14px rgba(239, 68, 68, 0.25), 0 0 0 1px #ef4444' : '0 1px 2px rgba(0,0,0,0.03)'
                        }}
                      >
                        <div style={{
                          height: '52px',
                          background: preset.previewBackground,
                          backgroundSize: 'cover',
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {isSelected && (
                            <div style={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              background: '#ef4444',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                            }}>
                              <Check size={12} strokeWidth={3} />
                            </div>
                          )}
                        </div>
                        <div style={{
                          padding: '5px 6px',
                          background: '#ffffff',
                          fontSize: '0.7rem',
                          fontWeight: isSelected ? 800 : 600,
                          color: isSelected ? '#ef4444' : '#334155',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          textAlign: 'center'
                        }}>
                          {preset.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Readability & Opacity Slider */}
              <div style={{
                padding: '12px 14px',
                borderRadius: '13px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>
                    <Sliders size={14} color="#64748b" />
                    <span>Độ tương phản bong bóng tin nhắn</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ef4444' }}>
                    {Math.round(overlayOpacity * 100)}%
                  </span>
                </div>

                <input
                  type="range"
                  min="0.5"
                  max="1"
                  step="0.02"
                  value={overlayOpacity}
                  onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                  style={{
                    width: '100%',
                    accentColor: '#ef4444',
                    cursor: 'pointer'
                  }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.67rem', color: '#64748b' }}>
                  <ShieldCheck size={12} color="#10b981" />
                  <span>Tự động tối ưu chữ và bong bóng chat dễ đọc, êm mắt.</span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Realistic Live Chat Mockup Preview */}
            <div style={{
              background: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              padding: '16px',
              position: 'relative'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px'
              }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Eye size={13} color="#ef4444" />
                  <span>Xem trước thực tế (Live Preview)</span>
                </span>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#94a3b8' }}>
                  {activePreset?.name || (isCustomActive ? 'Ảnh tải lên' : 'Mặc định')}
                </span>
              </div>

              {renderLiveChatPreview(false)}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div style={{
          padding: isMobile ? '10px 14px max(14px, env(safe-area-inset-bottom, 14px))' : '12px 20px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f8fafc',
          flexShrink: 0,
          gap: '8px'
        }}>
          <button
            type="button"
            onClick={handleResetDefault}
            disabled={isSaving}
            style={{
              padding: isMobile ? '8px 10px' : '8px 14px',
              borderRadius: '9px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#64748b',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: isSaving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#dc2626';
              e.currentTarget.style.borderColor = '#fca5a5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#64748b';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
          >
            <Trash2 size={13} />
            <span>{isMobile ? 'Mặc định' : 'Khôi phục mặc định'}</span>
          </button>

          <div style={{ display: 'flex', gap: '8px', flex: isMobile ? 1 : 'none', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 12px',
                borderRadius: '9px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              Hủy
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              style={{
                padding: isMobile ? '8px 14px' : '8px 18px',
                borderRadius: '9px',
                border: 'none',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: '#ffffff',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.28)',
                opacity: isSaving ? 0.7 : 1,
                flex: isMobile ? 1 : 'none'
              }}
            >
              {isSaving ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />}
              <span>{isSaving ? 'Đang lưu...' : 'Áp dụng'}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};
