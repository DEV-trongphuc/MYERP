import * as React from 'react';
import { useState } from 'react';
import {
  ChevronLeft, Undo2, Redo2, Layout, Code, Monitor, Smartphone, Eye, Save,
  Loader2, Send, FolderOpen, ShieldCheck, Pencil, Users, Lock, Globe, ChevronDown
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
  canUndo, canRedo, onUndo, onRedo, onSave, onCancel, onPreview, onSendTest, onOpenTestModal,
  onValidate, validationIssueCount, showValidation, isDirty = false,
  visibility = 'shared', setVisibility, accessConfig, setAccessConfig, canSetShared = true
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [showTestInput, setShowTestInput] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);

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
          {/* Name row with save-state dot + pencil hint */}
          <div className="group/name relative flex items-center gap-1.5">
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
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-sm font-semibold text-slate-800 outline-none focus:outline-none bg-transparent hover:bg-slate-50 focus:bg-slate-100 px-2.5 rounded-[12px] transition-all border border-transparent hover:border-slate-200 focus:border-[var(--color-primary)] truncate max-w-[150px] sm:max-w-[220px] flex items-center"
            />
            <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover/name:opacity-100 transition-opacity duration-200 pointer-events-none shrink-0" />
          </div>
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

        {/* Sleek Access / Sharing Trigger Button */}
        {(setVisibility || setAccessConfig) && (
          <div className="hidden lg:flex items-center">
            <button
              type="button"
              onMouseEnter={() => preloadAccessDirectory()}
              onClick={() => setIsAccessModalOpen(true)}
              title="Phân quyền & Chia sẻ mẫu thiết kế"
              className={`h-9 px-3 rounded-[12px] border text-xs font-semibold inline-flex items-center gap-1.5 transition-all shadow-2xs outline-none focus:outline-none cursor-pointer ${
                currentMode === 'personal'
                  ? 'bg-amber-50/70 border-amber-200 text-amber-800 hover:bg-amber-100/70'
                  : currentMode === 'custom'
                    ? 'bg-rose-50/70 border-rose-200 text-[#BD1D2D] hover:bg-rose-100/70'
                    : 'bg-emerald-50/70 border-emerald-200 text-emerald-800 hover:bg-emerald-100/70'
              }`}
            >
              {currentMode === 'personal' ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Riêng tư</span>
                </>
              ) : currentMode === 'custom' ? (
                <>
                  <Users className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0" />
                  <span>Giới hạn ({totalSelectedTargets})</span>
                </>
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Công khai</span>
                </>
              )}
              <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
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

      {/* RIGHT: Validate + Test + Preview + Save */}
      <div className="flex items-center gap-2.5">
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
    </div>
  );
};

export default EmailTopBar;
