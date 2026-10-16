import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Smartphone, Monitor, SmartphoneNfc, Code, Check, Edit3, Copy, ArrowLeft, Send } from 'lucide-react';
import { Template } from '../../../types';
import QuickSendEmailModal from '../../templates/QuickSendEmailModal';
import { Avatar } from '../../../../ui/Avatar';
import { pushOverlay } from '../../../../../utils/overlayStack';
import { getMktPortalRoot } from '../../../utils/portalRoot';

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

  const onClose = React.useCallback(() => {
    setAnimateIn(false);
    setTimeout(_onClose, 500);
  }, [_onClose]);

  React.useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      const timer = setTimeout(() => setAnimateIn(true), 10);
      return () => clearTimeout(timer);
    } else {
      setAnimateIn(false);
      const timer = setTimeout(() => setIsVisible(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    return pushOverlay('email-preview-drawer', onClose, 2000);
  }, [isOpen, onClose]);

  if (!isVisible) return null;

  let contentToRender = htmlContent;
  if (!contentToRender && template) {
    contentToRender = template.htmlContent;
  }

  const showMock = !contentToRender;

  const drawerContent = (
    <div className="fixed inset-0 flex justify-end" style={{ zIndex: 2147483625 }}>
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-500 ${animateIn ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      
      {/* Floating Back Button on Backdrop */}
      <div 
        className={`hidden lg:flex absolute left-0 top-0 bottom-0 left-0 items-center justify-center z-40 transition-opacity duration-500 ${animateIn ? 'opacity-100' : 'opacity-0'}`}
        style={{ pointerEvents: 'none' }}
      >
        <button
          onClick={onClose}
          className="w-12 h-12 rounded-full bg-slate-900/60 hover:bg-slate-900/80 text-white flex items-center justify-center shadow-2xl border border-slate-700/50 backdrop-blur-md transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer"
          style={{ pointerEvents: 'auto' }}
          title="Quay lại"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
      </div>

      <div
        className={`relative w-full bg-[var(--color-bg)] shadow-2xl flex flex-col h-full border-l border-[var(--color-border)] transform transition-all duration-500 ease-in-out ${animateIn ? 'translate-x-0 opacity-100' : 'translate-x-[100px] opacity-0'}`}
        style={{ width: 'calc(100vw - var(--sidebar-width, 220px))', maxWidth: 'none' }}
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
              className="btn primary px-3.5 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl shadow-sm font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
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
                className="btn primary px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" /> {actionLabel}
              </button>
            )}

            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-all hover:rotate-90 cursor-pointer"><X className="w-5 h-5" /></button>
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

            <div className="flex-1 bg-white relative overflow-hidden">
              {showMock ? (
                <div className="absolute inset-0 p-8 text-center flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-[#fff4e0] rounded-2xl mx-auto flex items-center justify-center text-[#ca7900] mb-4">
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
