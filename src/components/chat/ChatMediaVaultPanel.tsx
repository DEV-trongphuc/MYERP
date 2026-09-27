import React, { useState, useEffect } from 'react';
import { 
  X, Image as ImageIcon, FileText, Link2, Users, Download, 
  ExternalLink, ChevronDown, ChevronUp, ChevronLeft, Check,
  FileArchive, FileSpreadsheet, Film, Globe, Search, Trash2
} from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { Avatar } from '../ui/Avatar';
import { DeleteConversationModal } from './DeleteConversationModal';
import { getFileFormatConfig, formatFileSize } from '../../utils/chatFileUtils';

interface Props {
  onClose: () => void;
  onOpenAddMember: () => void;
  isMaximized?: boolean;
  onCloseChat?: () => void;
}

export const ChatMediaVaultPanel: React.FC<Props> = ({ onClose, onOpenAddMember, isMaximized, onCloseChat }) => {
  const { 
    activeConversation, 
    vaultItems, 
    fetchVault,
    loadingVault 
  } = useChatStore();

  const [expandedSections, setExpandedSections] = useState<{ media: boolean; file: boolean; link: boolean }>({
    media: true,
    file: true,
    link: true
  });
  const [drilldownCategory, setDrilldownCategory] = useState<'all' | 'image' | 'document' | 'link'>('all');
  const [drilldownSearch, setDrilldownSearch] = useState('');
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Initial fetch all items in vault when panel mounts or conversation changes
  useEffect(() => {
    if (activeConversation) {
      fetchVault(activeConversation.id, 'all');
    }
  }, [activeConversation?.id]);

  if (!activeConversation) return null;

  const isGroup = activeConversation.type === 'group';

  // Group vault items
  const mediaItems = vaultItems.filter((i) => i.category === 'image' || i.category === 'video');
  const fileItems = vaultItems.filter((i) => i.category === 'document');
  const linkItems = vaultItems.filter((i) => i.category === 'link');

  const toggleSection = (section: 'media' | 'file' | 'link') => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const isDirect = activeConversation.type === 'direct';
  const titleText = (isDirect && activeConversation.other_user?.full_name)
    ? activeConversation.other_user.full_name
    : (activeConversation.title || activeConversation.other_user?.full_name || 'Đồng nghiệp');
  const avatarUrl = (isDirect && activeConversation.other_user)
    ? activeConversation.other_user.avatar_url
    : (activeConversation.avatar_url || activeConversation.other_user?.avatar_url);
  const isInactive = isDirect && activeConversation.other_user?.is_active === false;
  const subtitleText = isGroup 
    ? `${activeConversation.participants?.length || activeConversation.participant_count || 0} thành viên`
    : isInactive
    ? 'Đã nghỉ việc / Inactive'
    : (activeConversation.other_user?.job_title || activeConversation.other_user?.role || 'Nhân sự');

  // DRILLDOWN VIEW (When user clicks "Xem tất cả")
  if (drilldownCategory !== 'all') {
    const categoryTitle = drilldownCategory === 'image' ? 'Media' : drilldownCategory === 'document' ? 'File tệp tin' : 'Liên kết Link';
    const items = (drilldownCategory === 'image' ? mediaItems : drilldownCategory === 'document' ? fileItems : linkItems)
      .filter((i) => !drilldownSearch || i.file_name?.toLowerCase().includes(drilldownSearch.toLowerCase()) || i.file_url?.toLowerCase().includes(drilldownSearch.toLowerCase()));

    return (
      <div style={{ width: '100%', height: '100%', background: '#ffffff', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e2e8f0' }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
          <button
            onClick={() => setDrilldownCategory('all')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: '#0f172a', fontWeight: 700, fontSize: '0.85rem', padding: 0 }}
          >
            <ChevronLeft size={18} />
            <span>{categoryTitle} ({items.length})</span>
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', borderRadius: '8px', padding: '6px 10px' }}>
            <Search size={14} color="#94a3b8" />
            <input
              type="text"
              placeholder={`Tìm trong ${categoryTitle.toLowerCase()}...`}
              value={drilldownSearch}
              onChange={(e) => setDrilldownSearch(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.8rem', width: '100%' }}
            />
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 10px', fontSize: '0.85rem' }}>
              Không tìm thấy mục nào
            </div>
          ) : drilldownCategory === 'image' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {items.map((it) => (
                <div
                  key={it.id}
                  onClick={() => setSelectedPreviewImage(it.file_url)}
                  style={{ width: '100%', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', background: '#f1f5f9', position: 'relative' }}
                >
                  <img src={it.file_url} alt={it.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {items.map((it) => {
                const fmt = getFileFormatConfig(it.file_name || it.file_url);
                return (
                  <div
                    key={it.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: '8px', background: fmt.bg || '#f1f5f9', color: fmt.text || '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 650, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {it.file_name || it.file_url}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        {it.file_size ? formatFileSize(it.file_size) : ''} • {new Date(it.created_at).toLocaleDateString('vi-VN')}
                      </div>
                    </div>
                    <a
                      href={it.file_url}
                      target="_blank"
                      download={it.file_name}
                      rel="noreferrer"
                      style={{ color: '#64748b', padding: '4px' }}
                    >
                      <Download size={15} />
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ALL-IN-ONE OVERVIEW LAYOUT (Matches reference image)
  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#ffffff',
      borderLeft: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#f8fafc'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              color: '#334155',
              padding: '4px 6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
            title="Quay lại khung chat"
          >
            <ChevronLeft size={18} />
          </button>
          <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
            Thông tin hội thoại
          </span>
        </div>
        <button
          onClick={isMaximized && onCloseChat ? onCloseChat : onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', borderRadius: '6px' }}
          title={isMaximized ? "Đóng chat" : "Đóng thông tin"}
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Profile Card */}
        <div style={{
          padding: '18px 16px 14px',
          textAlign: 'center',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <Avatar src={avatarUrl} name={titleText} size={64} />
          <h4 style={{ margin: '10px 0 2px', fontSize: '0.975rem', fontWeight: 800, color: '#0f172a' }}>
            {titleText}
          </h4>
          <span style={{
            fontSize: '0.75rem',
            color: isInactive ? '#dc2626' : '#64748b',
            fontWeight: isInactive ? 700 : 550,
            background: isInactive ? '#fef2f2' : 'transparent',
            padding: isInactive ? '2px 8px' : '0',
            borderRadius: isInactive ? '6px' : '0'
          }}>
            {subtitleText}
          </span>
        </div>

        {/* Mutual Groups / Participants Bar */}
        <div style={{ padding: '12px 14px 6px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            background: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={16} color="#475569" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>
                {isGroup ? `${activeConversation.participants?.length || 0} thành viên trong nhóm` : 'Nhóm chung & Nội bộ'}
              </span>
            </div>
            {isGroup && (
              <button
                type="button"
                onClick={onOpenAddMember}
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                + Thêm
              </button>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 1: ẢNH / VIDEO (4-column grid + "Xem tất cả")
           ══════════════════════════════════════════════════════════════════════ */}
        <div style={{ borderBottom: '1px solid #f1f5f9', padding: '12px 14px' }}>
          <div
            onClick={() => toggleSection('media')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '10px' }}
          >
            <div style={{ fontSize: '0.85rem', fontWeight: 750, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Media</span>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>({mediaItems.length})</span>
            </div>
            {expandedSections.media ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
          </div>

          {expandedSections.media && (
            <>
              {mediaItems.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', padding: '8px 0', textAlign: 'center' }}>
                  Chưa có hình ảnh nào được gửi
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px' }}>
                    {mediaItems.slice(0, 8).map((it) => (
                      <div
                        key={it.id}
                        onClick={() => setSelectedPreviewImage(it.file_url)}
                        style={{
                          aspectRatio: '1',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          background: '#f1f5f9',
                          cursor: 'pointer',
                          border: '1px solid #e2e8f0',
                          transition: 'transform 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.04)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <img src={it.file_url} alt={it.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setDrilldownCategory('image')}
                    style={{
                      width: '100%',
                      padding: '7px 0',
                      background: '#f1f5f9',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#334155',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
                  >
                    Xem tất cả ({mediaItems.length})
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 2: FILE (Document list with size, date + "Xem tất cả")
           ══════════════════════════════════════════════════════════════════════ */}
        <div style={{ borderBottom: '1px solid #f1f5f9', padding: '12px 14px' }}>
          <div
            onClick={() => toggleSection('file')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '10px' }}
          >
            <div style={{ fontSize: '0.85rem', fontWeight: 750, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>File</span>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>({fileItems.length})</span>
            </div>
            {expandedSections.file ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
          </div>

          {expandedSections.file && (
            <>
              {fileItems.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', padding: '8px 0', textAlign: 'center' }}>
                  Chưa có tệp tài liệu nào
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                    {fileItems.slice(0, 4).map((it) => {
                      const fmt = getFileFormatConfig(it.file_name);
                      return (
                        <div
                          key={it.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '6px 8px',
                            borderRadius: '8px',
                            background: '#f8fafc',
                            border: '1px solid #f1f5f9'
                          }}
                        >
                          <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: '8px',
                            background: fmt.bg || '#eff6ff',
                            color: fmt.text || '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <FileText size={16} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 650, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {it.file_name}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>{it.file_size ? formatFileSize(it.file_size) : '0 KB'}</span>
                              <span style={{ color: '#10b981', display: 'flex', alignItems: 'center' }}><Check size={11} /></span>
                              <span>•</span>
                              <span>{new Date(it.created_at).toLocaleDateString('vi-VN')}</span>
                            </div>
                          </div>
                          <a
                            href={it.file_url}
                            download={it.file_name}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: '#64748b', padding: '4px' }}
                            title="Tải xuống"
                          >
                            <Download size={14} />
                          </a>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setDrilldownCategory('document')}
                    style={{
                      width: '100%',
                      padding: '7px 0',
                      background: '#f1f5f9',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#334155',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
                  >
                    Xem tất cả ({fileItems.length})
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 3: LINK (Shared web links list)
           ══════════════════════════════════════════════════════════════════════ */}
        <div style={{ padding: '12px 14px' }}>
          <div
            onClick={() => toggleSection('link')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '10px' }}
          >
            <div style={{ fontSize: '0.85rem', fontWeight: 750, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Link</span>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>({linkItems.length})</span>
            </div>
            {expandedSections.link ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
          </div>

          {expandedSections.link && (
            <>
              {linkItems.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', padding: '8px 0', textAlign: 'center' }}>
                  Chưa có liên kết nào được chia sẻ
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {linkItems.slice(0, 4).map((it) => {
                    let hostname = 'liên kết';
                    try { hostname = new URL(it.file_url).hostname; } catch {}
                    return (
                      <a
                        key={it.id}
                        href={it.file_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '6px 8px',
                          borderRadius: '8px',
                          background: '#f8fafc',
                          border: '1px solid #f1f5f9',
                          textDecoration: 'none'
                        }}
                      >
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: '8px',
                          background: '#eff6ff',
                          color: '#2563eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Globe size={16} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 650, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {it.file_name || it.file_url}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#2563eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {hostname}
                          </div>
                        </div>
                        <span style={{ fontSize: '0.65rem', color: '#94a3b8', flexShrink: 0 }}>
                          {new Date(it.created_at).toLocaleDateString('vi-VN')}
                        </span>
                      </a>
                    );
                  })}
                  {linkItems.length > 4 && (
                    <button
                      type="button"
                      onClick={() => setDrilldownCategory('link')}
                      style={{
                        width: '100%',
                        padding: '7px 0',
                        background: '#f1f5f9',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#334155',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Xem tất cả ({linkItems.length})
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Danger zone: Delete conversation & clean physical files */}
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #fee2e2' }}>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid #fecaca',
                background: '#fef2f2',
                color: '#dc2626',
                fontSize: '0.8rem',
                fontWeight: 750,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#fee2e2';
                e.currentTarget.style.borderColor = '#fca5a5';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#fef2f2';
                e.currentTarget.style.borderColor = '#fecaca';
              }}
              title="Xóa vĩnh viễn tin nhắn và giải phóng toàn bộ file trên server"
            >
              <Trash2 size={15} color="#dc2626" />
              <span>Xóa cuộc trò chuyện này</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delete Conversation Confirmation Modal */}
      <DeleteConversationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onSuccess={() => {
          setShowDeleteModal(false);
          onClose();
        }}
      />

      {/* Lightbox for preview */}
      {selectedPreviewImage && (
        <div
          onClick={() => setSelectedPreviewImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            zIndex: 2147483647,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <img src={selectedPreviewImage} alt="Preview" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }} />
        </div>
      )}
    </div>
  );
};
