import React from 'react';
import toast from 'react-hot-toast';
import { MessageSquare, X, ArrowUpRight } from 'lucide-react';
import { playChatNotificationSound } from './chatSound';

export interface ChatToastPayload {
  messageId: number;
  conversationId: number;
  senderName: string;
  senderAvatar?: string;
  conversationTitle?: string;
  content: string;
  messageType?: string;
  onOpenConversation: (conversationId: number) => void;
}

// Track recently toasted message IDs to prevent duplicates
const toastedMessageIds = new Set<number>();

export const showChatNotificationToast = (payload: ChatToastPayload) => {
  if (toastedMessageIds.has(payload.messageId)) return;
  toastedMessageIds.add(payload.messageId);

  // Keep set size manageable
  if (toastedMessageIds.size > 200) {
    const arr = Array.from(toastedMessageIds);
    arr.slice(0, 100).forEach((id) => toastedMessageIds.delete(id));
  }

  // Play pleasant notification sound chime
  playChatNotificationSound();

  // Format content preview based on message type
  let previewText = payload.content;
  if (payload.messageType === 'image') {
    previewText = '📷 Đã gửi một hình ảnh';
  } else if (payload.messageType === 'file') {
    previewText = '📎 Đã gửi một tệp đính kèm';
  } else if (payload.messageType === 'sticker') {
    previewText = '✨ Đã gửi một nhãn dán';
  } else if (payload.messageType === 'erp_card') {
    previewText = '📊 Đã chia sẻ liên kết dữ liệu ERP';
  }

  toast.custom(
    (t) => (
      <div
        onClick={() => {
          toast.dismiss(t.id);
          payload.onOpenConversation(payload.conversationId);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: '#ffffff',
          border: '1px solid #fecaca',
          borderLeft: '4px solid #dc2626',
          borderRadius: '12px',
          padding: '12px 14px',
          boxShadow: '0 12px 28px -4px rgba(220, 38, 38, 0.18), 0 6px 14px -2px rgba(0, 0, 0, 0.08)',
          cursor: 'pointer',
          maxWidth: '380px',
          width: '100%',
          opacity: t.visible ? 1 : 0,
          transform: t.visible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(-8px)',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: 'auto',
          userSelect: 'none'
        }}
      >
        {/* Avatar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {payload.senderAvatar ? (
            <img
              src={payload.senderAvatar}
              alt={payload.senderName}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '1.5px solid #fee2e2'
              }}
            />
          ) : (
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {(payload.senderName || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          {/* Online green indicator badge */}
          <span
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: '#10b981',
              border: '2px solid #ffffff'
            }}
          />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '2px' }}>
            <span
              style={{
                fontWeight: 750,
                fontSize: '0.85rem',
                color: '#0f172a',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {payload.senderName}
            </span>
            {payload.conversationTitle && (
              <span
                style={{
                  fontSize: '0.68rem',
                  color: '#dc2626',
                  background: '#fef2f2',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontWeight: 650,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '120px'
                }}
              >
                {payload.conversationTitle}
              </span>
            )}
          </div>
          <p
            style={{
              margin: 0,
              fontSize: '0.78rem',
              color: '#475569',
              lineHeight: 1.35,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {previewText}
          </p>
        </div>

        {/* Action button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <button
            type="button"
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              borderRadius: '6px',
              padding: '4px 6px',
              fontSize: '0.72rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              cursor: 'pointer'
            }}
            title="Mở tin nhắn"
          >
            <ArrowUpRight size={13} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toast.dismiss(t.id);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px'
            }}
            title="Đóng"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    ),
    {
      duration: 5000,
      position: 'top-right'
    }
  );
};
