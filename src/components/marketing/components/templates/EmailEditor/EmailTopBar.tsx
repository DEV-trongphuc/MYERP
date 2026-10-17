import * as React from 'react';
import { useState } from 'react';
import { ChevronLeft, Undo2, Redo2, Layout, Code, Monitor, Smartphone, Eye, Save, Loader2, Send, FolderOpen, ShieldCheck, Pencil, Users, Lock } from 'lucide-react';
import Button from '../../common/Button';
import Select from '../../common/Select';
import { TemplateGroup } from '../../../types';

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
  visibility?: 'shared' | 'personal';
  setVisibility?: (v: 'shared' | 'personal') => void;
  canSetShared?: boolean;
}

const EmailTopBar: React.FC<EmailTopBarProps> = ({
  name, setName, groupId, setGroupId, groups, editorMode, setEditorMode, viewMode, setViewMode,
  canUndo, canRedo, onUndo, onRedo, onSave, onCancel, onPreview, onSendTest, onOpenTestModal,
  onValidate, validationIssueCount, showValidation, isDirty = false,
  visibility = 'shared', setVisibility, canSetShared = true
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [showTestInput, setShowTestInput] = useState(false);
  const [testEmail, setTestEmail] = useState('');

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

  return (
    <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] z-50 relative">
      {/* LEFT: Back + Name + Group + Visibility */}
      <div className="flex items-center gap-3.5">
        <button onClick={onCancel} className="h-9 w-9 rounded-[12px] flex items-center justify-center hover:bg-slate-100 text-slate-500 transition-colors">
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
              className="h-9 text-sm font-semibold text-slate-800 outline-none bg-transparent hover:bg-slate-50 focus:bg-slate-100 px-2.5 rounded-[12px] transition-all border border-transparent hover:border-slate-200 focus:border-[var(--color-primary)] truncate max-w-[150px] sm:max-w-[220px] flex items-center"
            />
            <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover/name:opacity-100 transition-opacity duration-200 pointer-events-none shrink-0" />
          </div>
          <p className="text-[10px] text-slate-400 font-black px-2 uppercase tracking-wider leading-none mt-0.5">
            {editorMode === 'code' ? 'HTML Editor' : 'Drag & Drop Builder'}
          </p>
        </div>

        <div className="h-8 w-px bg-slate-200/60 mx-0.5 hidden sm:block" />

        <div className="w-48 hidden sm:flex items-center">
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

        {/* Visibility Selector (Shared vs Personal) */}
        {setVisibility && (
          <div className="hidden lg:flex items-center">
            {canSetShared ? (
              <div className="flex items-center h-9 p-0.5 rounded-[12px] bg-slate-100 border border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setVisibility('shared')}
                  title="Dùng chung cho toàn công ty & đội ngũ Sale"
                  className={`h-8 px-2.5 rounded-[10px] text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                    visibility === 'shared'
                      ? 'bg-white shadow-xs text-[var(--color-primary)]'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Dùng chung</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility('personal')}
                  title="Mẫu cá nhân (Chỉ mình tôi chỉnh sửa)"
                  className={`h-8 px-2.5 rounded-[10px] text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                    visibility === 'personal'
                      ? 'bg-white shadow-xs text-[var(--color-primary)]'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Chỉ mình tôi</span>
                </button>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-rose-50 text-[var(--color-primary)] border border-rose-200/60 text-[11px] font-bold">
                <Lock className="w-3.5 h-3.5" />
                Mẫu cá nhân
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {editorMode === 'visual' && (
          <div className="flex items-center h-9 p-0.5 rounded-[12px] bg-slate-100 border border-slate-200/60 shadow-xs">
            <button onClick={onUndo} disabled={!canUndo} className="h-8 w-8 rounded-[10px] hover:bg-white text-slate-500 hover:text-[var(--color-primary)] hover:shadow-xs disabled:opacity-30 disabled:hover:bg-transparent transition-all flex items-center justify-center" title="Undo (Ctrl+Z)"><Undo2 className="w-4 h-4" /></button>
            <div className="w-px h-4 bg-slate-200 mx-0.5"></div>
            <button onClick={onRedo} disabled={!canRedo} className="h-8 w-8 rounded-[10px] hover:bg-white text-slate-500 hover:text-[var(--color-primary)] hover:shadow-xs disabled:opacity-30 disabled:hover:bg-transparent transition-all flex items-center justify-center" title="Redo (Ctrl+Y)"><Redo2 className="w-4 h-4" /></button>
          </div>
        )}

        <div className="hidden md:flex h-9 p-0.5 rounded-[12px] bg-slate-100 border border-slate-200/60 items-center">
          <button 
            onClick={() => setEditorMode('visual')} 
            className={`h-8 px-3 rounded-[10px] text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${editorMode === 'visual' ? 'bg-white shadow-xs text-[var(--color-primary)] font-bold' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Layout className="w-3.5 h-3.5" />
            <span className="leading-none">Visual</span>
          </button>
          <button 
            onClick={() => setEditorMode('code')} 
            className={`h-8 px-3 rounded-[10px] text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${editorMode === 'code' ? 'bg-white shadow-xs text-[var(--color-primary)] font-bold' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Code className="w-3.5 h-3.5" />
            <span className="leading-none">Code</span>
          </button>
        </div>

        <div className="hidden md:flex h-9 p-0.5 rounded-[12px] bg-slate-100 border border-slate-200/60 items-center gap-0.5">
          <button onClick={() => setViewMode('desktop')} className={`h-8 w-8 rounded-[10px] transition-all flex items-center justify-center ${viewMode === 'desktop' ? 'bg-white shadow-xs text-[var(--color-primary)]' : 'text-slate-500 hover:text-slate-700'}`} title="Desktop View"><Monitor className="w-4 h-4" /></button>
          <button onClick={() => setViewMode('mobile')} className={`h-8 w-8 rounded-[10px] transition-all flex items-center justify-center ${viewMode === 'mobile' ? 'bg-white shadow-xs text-[var(--color-primary)]' : 'text-slate-500 hover:text-slate-700'}`} title="Mobile View"><Smartphone className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Validate button */}
        {editorMode === 'visual' && (
          <div className="relative">
            <button
              onClick={onValidate}
              title="Kiểm duyệt email"
              className={`relative flex items-center gap-2 h-9 px-3.5 rounded-[12px] border text-xs font-semibold transition-all ${showValidation
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
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
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
            className="hidden sm:flex h-9 px-3.5 !rounded-[12px] text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-xs"
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
                  onClick={handleSendTest}
                  disabled={isSendingTest || !testEmail}
                  className="bg-[var(--color-primary)] text-white rounded-lg p-2 hover:brightness-95 transition-colors disabled:opacity-50"
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
          className="hidden sm:flex h-9 px-3.5 !rounded-[12px] text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs items-center justify-center gap-1.5" 
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
          className="h-9 px-3.5 !rounded-[12px] text-xs font-semibold transition-all duration-300 shadow-xs !border-transparent bg-[var(--color-primary)] text-white hover:brightness-95 flex items-center gap-1.5"
        >
          Lưu mẫu
        </Button>
      </div>
    </div>
  );
};

export default EmailTopBar;
