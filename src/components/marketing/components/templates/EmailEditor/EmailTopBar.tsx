import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft, Undo2, Redo2, Layout, Code, Monitor, Smartphone, Eye, Save,
  Loader2, Send, FolderOpen, ShieldCheck, Pencil, Users, Lock, Globe, Sparkles, X, Check, FileText
} from 'lucide-react';
import Button from '../../common/Button';
import Select from '../../common/Select';
import { TemplateGroup } from '../../../types';
import TemplateAccessModal, {
  type TemplateAccessConfig,
  type TemplateVisibilityMode,
  countAccessTargets,
  preloadAccessDirectory
} from '../TemplateAccessModal';

interface EmailTopBarProps {
  name: string;
  setName: (name: string) => void;
  groupId: string;
  setGroupId: (id: string) => void;
  groups: TemplateGroup[];
  editorMode: 'visual' | 'code';
  setEditorMode: (mode: 'visual' | 'code') => void;
  viewMode: 'desktop' | 'mobile';
  setViewMode: (mode: 'desktop' | 'mobile') => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onCancel: () => void;
  onPreview: () => void;
  onSendTest: (email: string) => Promise<void>;
  onOpenTestModal?: () => void;
  onOpenAIModal?: () => void;
  onValidate: () => void;
  validationIssueCount?: number;
  showValidation?: boolean;
  /** True when there are unsaved changes (historyIndex !== savedHistoryIndex) */
  isDirty?: boolean;
  visibility?: TemplateVisibilityMode;
  setVisibility?: (v: TemplateVisibilityMode) => void;
  accessConfig?: TemplateAccessConfig;
  setAccessConfig?: (cfg: TemplateAccessConfig) => void;
  canSetShared?: boolean;
}

const EmailTopBar: React.FC<EmailTopBarProps> = ({
  name, setName, groupId, setGroupId, groups, editorMode, setEditorMode, viewMode, setViewMode,
  canUndo, canRedo, onUndo, onRedo, onSave, onCancel, onPreview, onSendTest, onOpenTestModal, onOpenAIModal,
  onValidate, validationIssueCount, showValidation, isDirty = false,
  visibility = 'shared', setVisibility, accessConfig, setAccessConfig, canSetShared = true
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [showTestInput, setShowTestInput] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isNameModalOpen) {
      setDraftName(name);
      setTimeout(() => {
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
      }, 40);
    }
  }, [isNameModalOpen, name]);

  const handleConfirmNameModal = () => {
    const trimmed = draftName.trim();
    if (trimmed) {
      setName(trimmed);
    }
    setIsNameModalOpen(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave();
    } catch (err) {
      console.error('[EmailTopBar] Save failed:', err);
    } finally {
      setTimeout(() => setIsSaving(false), 600);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail || !testEmail.includes('@')) return;
    setIsSendingTest(true);
    await onSendTest(testEmail);
    setIsSendingTest(false);
    setShowTestInput(false);
  };

  const effectiveAccessConfig: TemplateAccessConfig = accessConfig || {
    visibility: visibility === 'system' ? 'shared' : visibility,
    allowed_user_ids: [],
    allowed_team_ids: [],
    allowed_departments: [],
    permission: 'use',
  };

  const currentMode: TemplateVisibilityMode = effectiveAccessConfig.visibility || visibility || 'shared';
  const totalSelectedTargets = countAccessTargets(effectiveAccessConfig);

  return (
    <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] z-50 relative">
      {/* LEFT: Back + Name + Group + Access Trigger */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="h-9 w-9 rounded-[12px] flex items-center justify-center hover:bg-slate-100 text-slate-500 transition-colors outline-none focus:outline-none cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex flex-col">
          {/* Name row with save-state dot + click to open spacious Rename Modal */}
          <button
            type="button"
            onClick={() => setIsNameModalOpen(true)}
            title={`Nhấn để đổi tên mẫu: ${name || 'Chưa đặt tên'}`}
            className="group/name relative flex items-center gap-2 h-8 px-2.5 -ml-1 rounded-[10px] hover:bg-slate-100/90 border border-transparent hover:border-slate-200 transition-all outline-none focus:outline-none cursor-pointer text-left"
          >
            {/* Save-state indicator dot */}
            <span
              title={isDirty ? 'Có thay đổi chưa lưu' : 'Đã lưu'}
              className="w-2.5 h-2.5 rounded-full shrink-0 transition-all duration-500"
              style={{
                backgroundColor: isDirty ? '#BD1D2D' : '#10b981',
                boxShadow: isDirty
                  ? '0 0 8px 2px rgba(189, 29, 45, 0.35)'
                  : '0 0 6px 1px rgba(16, 185, 129, 0.3)'
              }}
            />
            <span className="text-sm font-bold text-slate-800 group-hover/name:text-[var(--color-primary)] truncate max-w-[160px] sm:max-w-[230px] transition-colors">
              {name || 'Mẫu thiết kế chưa đặt tên'}
            </span>
            <span className="w-5 h-5 rounded-md bg-slate-100 group-hover/name:bg-[var(--color-primary)]/10 text-slate-400 group-hover/name:text-[var(--color-primary)] flex items-center justify-center transition-colors shrink-0">
              <Pencil className="w-3 h-3" />
            </span>
          </button>
          <p className="text-[10px] text-slate-400 font-black px-2 uppercase tracking-wider leading-none mt-0.5">
            {editorMode === 'code' ? 'HTML Editor' : 'Drag & Drop Builder'}
          </p>
        </div>

        <div className="h-8 w-px bg-slate-200/60 mx-0.5 hidden sm:block" />

        <div className="w-44 hidden sm:flex items-center">
          <Select
            options={[
              { value: '', label: 'Chưa phân loại' },
              ...groups.map(g => ({ value: g.id, label: g.name }))
            ]}
            value={groupId}
            onChange={setGroupId}
            variant="filled"
            size="sm"
            searchable
            icon={FolderOpen}
            placeholder="Chọn nhóm..."
          />
        </div>

        {/* Sleek Icon-Only Access / Sharing Trigger Button */}
        {(setVisibility || setAccessConfig) && (
          <div className="hidden sm:flex items-center">
            <button
              type="button"
              onMouseEnter={() => preloadAccessDirectory()}
              onClick={() => setIsAccessModalOpen(true)}
              title={
                currentMode === 'personal'
                  ? 'Phân quyền: Riêng tư (Chỉ mình tôi)'
                  : currentMode === 'custom'
                    ? `Phân quyền: Giới hạn (${totalSelectedTargets} đối tượng)`
                    : 'Phân quyền: Công khai (Toàn công ty)'
              }
              className={`relative h-9 w-9 rounded-[12px] border flex items-center justify-center transition-all shadow-2xs outline-none focus:outline-none cursor-pointer ${
                currentMode === 'personal'
                  ? 'bg-amber-50/80 border-amber-200 text-amber-700 hover:bg-amber-100/80'
                  : currentMode === 'custom'
                    ? 'bg-rose-50/80 border-rose-200 text-[#BD1D2D] hover:bg-rose-100/80'
                    : 'bg-emerald-50/80 border-emerald-200 text-emerald-700 hover:bg-emerald-100/80'
              }`}
            >
              {currentMode === 'personal' ? (
                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              ) : currentMode === 'custom' ? (
                <Users className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
              ) : (
                <Globe className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              {currentMode === 'custom' && totalSelectedTargets > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#BD1D2D] text-white text-[9px] font-black flex items-center justify-center shadow-2xs">
                  {totalSelectedTargets}
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* CENTER: Undo/Redo + Visual/Code + Desktop/Mobile */}
      <div className="flex items-center gap-3">
        {editorMode === 'visual' && (
          <div className="flex items-center h-9 p-0.5 rounded-[12px] bg-slate-100 border border-slate-200/60 shadow-xs">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className="h-8 w-8 rounded-[10px] hover:bg-white text-slate-500 hover:text-[var(--color-primary)] hover:shadow-xs disabled:opacity-30 disabled:hover:bg-transparent transition-all flex items-center justify-center outline-none focus:outline-none cursor-pointer"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-slate-200 mx-0.5"></div>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              className="h-8 w-8 rounded-[10px] hover:bg-white text-slate-500 hover:text-[var(--color-primary)] hover:shadow-xs disabled:opacity-30 disabled:hover:bg-transparent transition-all flex items-center justify-center outline-none focus:outline-none cursor-pointer"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="hidden md:flex h-9 p-0.5 rounded-[12px] bg-slate-100 border border-slate-200/60 items-center">
          <button
            type="button"
            onClick={() => setEditorMode('visual')}
            className={`h-8 px-3 rounded-[10px] text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all outline-none focus:outline-none cursor-pointer ${
              editorMode === 'visual' ? 'bg-white shadow-xs text-[var(--color-primary)] font-bold' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Layout className="w-3.5 h-3.5" />
            <span className="leading-none">Visual</span>
          </button>
          <button
            type="button"
            onClick={() => setEditorMode('code')}
            className={`h-8 px-3 rounded-[10px] text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all outline-none focus:outline-none cursor-pointer ${
              editorMode === 'code' ? 'bg-white shadow-xs text-[var(--color-primary)] font-bold' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span className="leading-none">Code</span>
          </button>
        </div>

        <div className="hidden md:flex h-9 p-0.5 rounded-[12px] bg-slate-100 border border-slate-200/60 items-center gap-0.5">
          <button
            type="button"
            onClick={() => setViewMode('desktop')}
            className={`h-8 w-8 rounded-[10px] transition-all flex items-center justify-center outline-none focus:outline-none cursor-pointer ${
              viewMode === 'desktop' ? 'bg-white shadow-xs text-[var(--color-primary)]' : 'text-slate-500 hover:text-slate-700'
            }`}
            title="Desktop View"
          >
            <Monitor className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('mobile')}
            className={`h-8 w-8 rounded-[10px] transition-all flex items-center justify-center outline-none focus:outline-none cursor-pointer ${
              viewMode === 'mobile' ? 'bg-white shadow-xs text-[var(--color-primary)]' : 'text-slate-500 hover:text-slate-700'
            }`}
            title="Mobile View"
          >
            <Smartphone className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* RIGHT: AI + Validate + Test + Preview + Save */}
      <div className="flex items-center gap-2.5">
        {editorMode === 'visual' && onOpenAIModal && (
          <button
            type="button"
            onClick={onOpenAIModal}
            title="Thiết kế & Tinh chỉnh Email bằng AI"
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-[12px] border border-rose-200/90 bg-rose-50/80 text-[#BD1D2D] hover:bg-[#BD1D2D] hover:text-white hover:border-[#BD1D2D] text-xs font-bold transition-all shadow-2xs outline-none focus:outline-none cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Tạo bằng AI</span>
          </button>
        )}

        {editorMode === 'visual' && (
          <div className="relative">
            <button
              type="button"
              onClick={onValidate}
              title="Kiểm duyệt email"
              className={`relative flex items-center gap-2 h-9 px-3.5 rounded-[12px] border text-xs font-semibold transition-all outline-none focus:outline-none cursor-pointer ${
                showValidation
                  ? 'bg-slate-100 border-slate-300 text-slate-800 shadow-inner'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 shadow-xs'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Kiểm duyệt</span>
              {validationIssueCount !== undefined && validationIssueCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-sm shadow-rose-300 animate-in zoom-in duration-200">
                  {validationIssueCount}
                </span>
              )}
              {validationIssueCount === 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-sm">
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              )}
            </button>
          </div>
        )}

        <div className="relative">
          <Button
            variant="secondary"
            onClick={() => {
              if (onOpenTestModal) {
                onOpenTestModal();
              } else {
                setShowTestInput(!showTestInput);
              }
            }}
            icon={Send}
            className="hidden sm:flex h-9 px-3.5 !rounded-[12px] text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-xs outline-none focus:outline-none"
          >
            Test
          </Button>
          {showTestInput && (
            <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-[14px] shadow-xl border border-slate-200 p-3 z-50 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-200">
              <p className="text-xs font-semibold text-slate-700">Gửi email test</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="nhập email..."
                  className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[var(--color-primary)] transition-all"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendTest()}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSendTest}
                  disabled={isSendingTest || !testEmail}
                  className="bg-[var(--color-primary)] text-white rounded-lg p-2 hover:brightness-95 transition-colors disabled:opacity-50 outline-none focus:outline-none"
                >
                  {isSendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
          {showTestInput && <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowTestInput(false)} />}
        </div>

        <Button
          variant="secondary"
          onClick={onPreview}
          className="hidden sm:flex h-9 px-3.5 !rounded-[12px] text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs items-center justify-center gap-1.5 outline-none focus:outline-none"
          title="Xem trước"
        >
          <Eye className="w-4 h-4 text-[var(--color-primary)]" strokeWidth={2.2} />
          <span className="hidden lg:inline">Xem trước</span>
        </Button>
        <Button
          icon={isSaving ? Loader2 : Save}
          onClick={handleSave}
          isLoading={isSaving}
          disabled={isSaving}
          title="Lưu mẫu (Ctrl+S)"
          className="h-9 px-3.5 !rounded-[12px] text-xs font-semibold transition-all duration-300 shadow-xs !border-transparent bg-[var(--color-primary)] text-white hover:brightness-95 flex items-center gap-1.5 outline-none focus:outline-none"
        >
          Lưu mẫu
        </Button>
      </div>

      {/* Granular Access / Sharing Modal */}
      <TemplateAccessModal
        isOpen={isAccessModalOpen}
        onClose={() => setIsAccessModalOpen(false)}
        templateName={name}
        value={effectiveAccessConfig}
        canSetShared={canSetShared}
        onSave={(nextCfg) => {
          if (setVisibility) setVisibility(nextCfg.visibility);
          if (setAccessConfig) setAccessConfig(nextCfg);
        }}
      />

      {/* Spacious Template Name & Category Modal */}
      {isNameModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsNameModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-[20px] border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#BD1D2D]/10 text-[#BD1D2D] flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 leading-tight">
                    Đặt tên Mẫu Thiết Kế Email
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Đặt tên rõ ràng để dễ dàng tìm kiếm và chọn khi tạo chiến dịch
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNameModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors outline-none focus:outline-none cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                  Tên mẫu thiết kế <span className="text-[#BD1D2D]">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleConfirmNameModal();
                    } else if (e.key === 'Escape') {
                      setIsNameModalOpen(false);
                    }
                  }}
                  placeholder="Nhập tên mẫu thiết kế email..."
                  spellCheck={false}
                  className="w-full px-4 py-3.5 text-base font-bold text-slate-900 bg-slate-50/70 focus:bg-white border-2 border-slate-200 focus:border-[#BD1D2D] rounded-[14px] outline-none focus:ring-4 focus:ring-[#BD1D2D]/10 transition-all"
                />
                <div className="flex items-center justify-between mt-1.5 px-1">
                  <span className="text-[11px] text-slate-400 font-medium">
                    Nhấn <strong className="text-slate-600">Enter</strong> để xác nhận nhanh
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">
                    {draftName.trim().length} ký tự
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                  Nhóm / Danh mục lưu trữ
                </label>
                <Select
                  options={[
                    { value: '', label: 'Chưa phân loại' },
                    ...groups.map(g => ({ value: g.id, label: g.name }))
                  ]}
                  value={groupId}
                  onChange={setGroupId}
                  variant="outline"
                  size="md"
                  searchable
                  icon={FolderOpen}
                  placeholder="Chọn nhóm..."
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsNameModalOpen(false)}
                className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors outline-none focus:outline-none cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmNameModal}
                disabled={!draftName.trim()}
                className="h-10 px-5 rounded-xl bg-[#BD1D2D] hover:brightness-95 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs outline-none focus:outline-none cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Lưu tên mẫu</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default EmailTopBar;

