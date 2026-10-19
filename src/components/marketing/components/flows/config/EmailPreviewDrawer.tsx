import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Smartphone, Monitor, SmartphoneNfc, Code, Check, Edit3, Copy, Send } from 'lucide-react';
import { Template } from '../../../types';
import QuickSendEmailModal from '../../templates/QuickSendEmailModal';
import { Avatar } from '../../../../ui/Avatar';
import { pushOverlay } from '../../../../../utils/overlayStack';
import { getMktPortalRoot } from '../../../utils/portalRoot';
import { api } from '../../../services/storageAdapter';
// @ts-ignore: `compileHTML` is a named export from `htmlCompiler`
import { compileHTML } from '../../templates/EmailEditor/utils/htmlCompiler';

interface EmailPreviewDrawerProps {
  template: Template | null;
  htmlContent?: string;
  isOpen: boolean;
  onClose: () => void;
  // Optional action buttons for "Templates" page usage
  onAction?: () => void;
  actionLabel?: string;
  onEdit?: () => void;
  onDuplicate?: () => void;
}

const EmailPreviewDrawer: React.FC<EmailPreviewDrawerProps> = ({ template, htmlContent, isOpen, onClose: _onClose, onAction, actionLabel, onEdit, onDuplicate }) => {
  const [viewMode, setViewMode] = React.useState<'desktop' | 'mobile'>('desktop');
  const [isVisible, setIsVisible] = React.useState(false);
  const [animateIn, setAnimateIn] = React.useState(false);
  const [showQuickSend, setShowQuickSend] = useState(false);
  const [fetchedHtml, setFetchedHtml] = useState<string>('');
  const [isFetchingFull, setIsFetchingFull] = useState<boolean>(false);

  const onClose = React.useCallback(() => {
    setAnimateIn(false);
    setTimeout(() => {
      setIsVisible(false);
      _onClose();
    }, 220);
  }, [_onClose]);

  React.useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setAnimateIn(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    } else {
      setAnimateIn(false);
      const timer = setTimeout(() => setIsVisible(false), 220);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    return pushOverlay('email-preview-drawer', onClose, 2000);
  }, [isOpen, onClose]);

  useEffect(() => {
    setFetchedHtml('');
    if (!isOpen || !template) {
      setIsFetchingFull(false);
      return;
    }
    const existingHtml = htmlContent || template.htmlContent || (
      template.blocks && template.blocks.length > 0 && typeof template.blocks[0] === 'object'
        ? compileHTML(template.blocks, template.bodyStyle, template.name)
        : ''
    );
    if (existingHtml || template.id.startsWith('sys_')) {
      setIsFetchingFull(false);
      return;
    }
    let cancelled = false;
    setIsFetchingFull(true);
    api.get<Template>(`templates/${template.id}`)
      .then(res => {
        if (cancelled) return;
        if (res.success && res.data) {
          const full = res.data;
          const compiled = full.htmlContent || (
            full.blocks && full.blocks.length > 0 && typeof full.blocks[0] === 'object'
              ? compileHTML(full.blocks, full.bodyStyle, full.name)
              : ''
          );
          if (compiled) setFetchedHtml(compiled);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsFetchingFull(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, template?.id, htmlContent, template?.htmlContent]);

  if (!isVisible) return null;

  let contentToRender = htmlContent || template?.htmlContent || fetchedHtml;
  if (!contentToRender && template?.blocks && template.blocks.length > 0 && typeof template.blocks[0] === 'object') {
    contentToRender = compileHTML(template.blocks, template.bodyStyle, template.name);
  }

  const showMock = !contentToRender && !isFetchingFull;

  const drawerContent = (
    <div className="fixed inset-0 z-[2147483625] flex justify-end" style={{ zIndex: 2147483625, pointerEvents: animateIn ? 'auto' : 'none' }}>
      <div
        className="drawer-backdrop"
        onClick={onClose}
        style={{
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          opacity: animateIn ? 1 : 0,
          transition: 'opacity 0.22s cubic-bezier(0.25, 0.1, 0.25, 1)',
          pointerEvents: animateIn ? 'auto' : 'none',
          zIndex: 2147483620,
          '--drawer-backdrop-z': 2147483620
        } as React.CSSProperties}
      />

      <div
        className="drawer-panel fixed top-0 right-0 bottom-0 z-[2147483625] w-full bg-[var(--color-bg)] shadow-2xl flex flex-col h-full border-l border-[var(--color-border)]"
        style={{
          width: 'calc(100vw - var(--sidebar-width, 220px))',
          maxWidth: 'none',
          zIndex: 2147483625,
          opacity: animateIn ? 1 : 0,
          transform: animateIn ? 'translate3d(0, 0, 0)' : 'translate3d(48px, 0, 0)',
          transition: 'transform 0.22s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.20s cubic-bezier(0.25, 0.1, 0.25, 1)',
          pointerEvents: animateIn ? 'auto' : 'none'
        }}
      >
        <div className="px-6 py-4 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {template && (
              <Avatar
                name={(template.bodyStyle as any)?.creator?.name || 'Hệ thống'}
                src={(template.bodyStyle as any)?.creator?.picture}
                size={34}
              />
            )}
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-slate-800 truncate">{template?.name || 'HTML Preview'}</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                {htmlContent ? <><Code className="w-3 h-3" /> Visual Preview</> : 'Template Preview'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('desktop')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'desktop' ? 'bg-white shadow text-[var(--color-primary)]' : 'text-slate-400'}`}
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('mobile')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'mobile' ? 'bg-white shadow text-[var(--color-primary)]' : 'text-slate-400'}`}
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Send Button */}
            <button
              onClick={() => setShowQuickSend(true)}
              className="px-3.5 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-[var(--radius-md)] shadow-sm font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
              title="Gửi email này nhanh cho danh sách khách hàng"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Gửi thư</span>
            </button>

            {onDuplicate && (
              <button
                onClick={onDuplicate}
                className="p-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-700 rounded-xl shadow-sm transition-all flex items-center justify-center cursor-pointer"
                title="Nhân bản"
              >
                <Copy className="w-5 h-5" />
              </button>
            )}

            {onEdit && (
              <button
                onClick={onEdit}
                className="p-2.5 bg-gradient-to-br from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-xl shadow-md transition-all flex items-center justify-center cursor-pointer"
                title="Chỉnh sửa"
              >
                <Edit3 className="w-5 h-5" />
              </button>
            )}

            {onAction && actionLabel && !onEdit && !onDuplicate && (
              <button
                onClick={onAction}
                className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-[var(--radius-md)] text-xs font-bold uppercase tracking-wider shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" /> {actionLabel}
              </button>
            )}

            <button onClick={onClose} className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer" title="Đóng"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-[var(--color-bg)]">
          <div className={`bg-white shadow-2xl transition-all duration-500 rounded-lg overflow-hidden border border-slate-200 flex flex-col ${viewMode === 'mobile' ? 'w-[375px]' : 'w-full h-full'}`}>
            <div className="bg-slate-100 px-4 py-2 flex items-center gap-2 border-b border-slate-200 shrink-0">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
              </div>
              <div className="bg-white px-3 py-1 rounded text-[10px] text-slate-400 flex-1 text-center font-mono truncate">
                about:blank
              </div>
            </div>

            <div className="email-canvas-scope flex-1 bg-white relative overflow-hidden">
              {isFetchingFull && !contentToRender ? (
                <div className="p-8 max-w-[600px] mx-auto space-y-5 animate-pulse">
                  <div className="w-full h-56 bg-slate-200/80 rounded-xl" />
                  <div className="h-6 bg-slate-200/80 rounded-md w-3/4" />
                  <div className="space-y-2.5">
                    <div className="h-4 bg-slate-200/70 rounded w-full" />
                    <div className="h-4 bg-slate-200/70 rounded w-11/12" />
                    <div className="h-4 bg-slate-200/70 rounded w-4/5" />
                  </div>
                  <div className="h-10 bg-slate-200/80 rounded-lg w-44 mx-auto mt-6" />
                </div>
              ) : showMock ? (
                <div className="absolute inset-0 p-8 text-center flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-[#fff4e0] rounded-2xl mx-auto flex items-center justify-center text-[var(--color-primary)] mb-4">
                    <SmartphoneNfc className="w-8 h-8" />
                  </div>
                  <h1 className="text-2xl font-black text-slate-800 mb-2">Chưa có nội dung</h1>
                  <p className="text-slate-500 text-sm max-w-md">Template này chưa được biên dịch HTML hoặc chưa có nội dung. Vui lòng kiểm tra lại trình editor.</p>
                </div>
              ) : (
                <iframe
                  title="email-preview"
                  srcDoc={contentToRender || ''}
                  className="w-full h-full border-none"
                  sandbox="allow-same-origin"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Send Modal */}
      {showQuickSend && (
        <QuickSendEmailModal
          isOpen={showQuickSend}
          onClose={() => setShowQuickSend(false)}
          template={template}
          htmlContent={contentToRender}
        />
      )}
    </div>
  );

  return createPortal(drawerContent, getMktPortalRoot());
};

export default EmailPreviewDrawer;
