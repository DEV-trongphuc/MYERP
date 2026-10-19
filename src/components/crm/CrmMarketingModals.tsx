import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  X, Send, Mail, Sparkles, Eye, Edit3, Search, Tag, CheckCircle2,
  AlertCircle, Loader2, FolderOpen, Globe, User, Users, Plus,
  GitBranch, List, ExternalLink, ChevronDown, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api as domationApi } from '../marketing/services/storageAdapter';
import { SYSTEM_TEMPLATES } from '../marketing/services/systemTemplates';
import { Template } from '../marketing/types';
// @ts-ignore: `compileHTML` is a named export from `htmlCompiler`
import { compileHTML } from '../marketing/components/templates/EmailEditor/utils/htmlCompiler';
import { MYERP_MERGE_TAG_GROUPS } from '../marketing/constants/mergeTags';
import { interpolateMergeTags } from '../marketing/utils/formatters';
import erpApi from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import { pushOverlay } from '../../utils/overlayStack';
import { useSettings } from '../marketing/components/contexts/SettingsContext';

export interface CrmMarketingContact {
  id: number;
  full_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  program?: string;
  stage_name?: string;
  company?: string;
  job_title?: string;
  city?: string;
  district?: string;
  address?: string;
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
  admission_date?: string;
  lead_code?: string;
  student_code?: string;
  expected_revenue?: number | string;
  total_deposit?: number | string;
  [k: string]: any;
}

export interface CrmSendTemplateEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: CrmMarketingContact[];
  onSuccess?: () => void;
  zIndex?: number;
}

export interface CrmBulkMarketingModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactIds: number[];
  contacts?: CrmMarketingContact[];
  initialMode?: 'list' | 'flow';
  onSuccess?: () => void;
  zIndex?: number;
}

const getTemplateVisibility = (tpl: Template): 'personal' | 'shared' | 'system' => {
  if (tpl.id.startsWith('sys_')) return 'system';
  const rawVis = (tpl as any).visibility || (tpl.bodyStyle as any)?.visibility;
  return rawVis === 'personal' ? 'personal' : 'shared';
};

const isOwnTemplate = (tpl: Template, currentUserId?: number, currentUserEmail?: string): boolean => {
  if (tpl.id.startsWith('sys_')) return false;
  const createdBy = Number((tpl as any).created_by || (tpl.bodyStyle as any)?.creator?.id || (tpl as any).creator?.id || 0);
  if (currentUserId && currentUserId > 0 && createdBy > 0 && createdBy === Number(currentUserId)) {
    return true;
  }
  const creatorEmail = String((tpl as any).creator?.email || (tpl.bodyStyle as any)?.creator?.email || '').trim().toLowerCase();
  if (currentUserEmail && creatorEmail && creatorEmail === currentUserEmail.trim().toLowerCase()) {
    return true;
  }
  return false;
};

const compileTemplateHtml = (tpl: Template | null): string => {
  if (!tpl) return '';
  if (tpl.htmlContent) return tpl.htmlContent;
  if (tpl.blocks && tpl.blocks.length > 0 && typeof tpl.blocks[0] === 'object') {
    return compileHTML(tpl.blocks, tpl.bodyStyle, tpl.name);
  }
  return '';
};

export const CrmSendTemplateEmailModal: React.FC<CrmSendTemplateEmailModalProps> = ({
  isOpen,
  onClose,
  contacts,
  onSuccess,
  zIndex = 2147483645,
}) => {
  const effectiveZIndex = Math.min(Math.max(zIndex || 2147483645, 2147483640), 2147483646);
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const currentUserId = Number(currentUser?.id || 0);
  const currentUserEmail = String(currentUser?.email || '');

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateTab, setTemplateTab] = useState<'all' | 'shared' | 'personal' | 'system'>('all');
  const [templateSearch, setTemplateSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  const { senderEmails: verifiedSenders, senderName: defaultAppSenderName, refreshSettings } = useSettings();
  const [subject, setSubject] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [customEmailInput, setCustomEmailInput] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [activeEditorTab, setActiveEditorTab] = useState<'compose' | 'preview'>('compose');
  const [previewContactIdx, setPreviewContactIdx] = useState(0);

  const [showSubjectTagMenu, setShowSubjectTagMenu] = useState(false);
  const [showBodyTagMenu, setShowBodyTagMenu] = useState(false);
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const subjectMenuRef = useRef<HTMLDivElement>(null);
  const bodyMenuRef = useRef<HTMLDivElement>(null);

  const [isSending, setIsSending] = useState(false);
  const sendingGuardRef = useRef(false);

  // ESC overlay support
  useEffect(() => {
    if (!isOpen) return;
    return pushOverlay('crm-send-template-email-modal', onClose, effectiveZIndex);
  }, [isOpen, onClose, effectiveZIndex]);

  // Close tag dropdowns on click outside
  useEffect(() => {
    if (!showSubjectTagMenu && !showBodyTagMenu) return;
    const handleOutside = (e: MouseEvent) => {
      if (subjectMenuRef.current && !subjectMenuRef.current.contains(e.target as Node)) {
        setShowSubjectTagMenu(false);
      }
      if (bodyMenuRef.current && !bodyMenuRef.current.contains(e.target as Node)) {
        setShowBodyTagMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showSubjectTagMenu, showBodyTagMenu]);

  // Initialize default sender & subject when modal opens
  useEffect(() => {
    if (!isOpen) return;
    refreshSettings?.();
    const normalizedAppSender = defaultAppSenderName === 'Viện Quốc Tế IDEAS' ? 'IDEAS' : defaultAppSenderName;
    const defaultSender = normalizedAppSender || currentUser?.full_name || currentUser?.name || 'IDEAS';
    setSenderName(defaultSender);
    setSenderEmail((prev) => prev || verifiedSenders[0] || 'tuyensinh@ideas.edu.vn');
    setPreviewContactIdx(0);
    setActiveEditorTab('compose');
    if (contacts.length === 1 && !contacts[0].email) {
      setCustomEmailInput('');
    } else {
      setCustomEmailInput('');
    }
    if (!subject && !htmlBody) {
      const firstContact = contacts[0];
      const prog = firstContact?.program ? ` - Chương trình ${firstContact.program}` : '';
      setSubject(`Thông tin tư vấn học tập từ Viện Quốc Tế IDEAS${prog}`);
      setHtmlBody(
        `<div style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #1e293b; max-width: 640px; margin: 0 auto;">\n` +
        `  <p>Xin chào <strong>{{full_name}}</strong>,</p>\n` +
        `  <p>Cảm ơn anh/chị đã quan tâm đến chương trình <strong>{{program}}</strong> tại <strong>Viện Quốc Tế IDEAS</strong>.</p>\n` +
        `  <p>Em là <strong>{{consultant_name}}</strong> ({{consultant_role}}) — phụ trách hỗ trợ hồ sơ trực tiếp cho anh/chị.</p>\n` +
        `  <p>Nếu cần trao đổi thêm thông tin lộ trình học tập hoặc ưu đãi học phí, anh/chị có thể phản hồi trực tiếp email này hoặc liên hệ số điện thoại <strong>{{consultant_phone}}</strong>.</p>\n` +
        `  <p style="margin-top: 24px;">Trân trọng,<br/><strong>{{consultant_name}}</strong><br/>Viện Quốc Tế IDEAS</p>\n` +
        `</div>`
      );
    }
  }, [isOpen, contacts, currentUser]);

  // Fetch templates
  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    setLoadingTemplates(true);
    domationApi
      .get<Template[]>('templates', {}, { signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        const dbList = res.success && Array.isArray(res.data) ? res.data : [];
        setTemplates([...dbList, ...SYSTEM_TEMPLATES]);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setTemplates([...SYSTEM_TEMPLATES]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingTemplates(false);
      });
    return () => controller.abort();
  }, [isOpen]);

  const filteredTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    return templates.filter((t) => {
      const isSys = t.id.startsWith('sys_');
      const vis = getTemplateVisibility(t);
      const matchesTab =
        templateTab === 'all' ? true :
        templateTab === 'personal' ? (!isSys && (isOwnTemplate(t, currentUserId, currentUserEmail) || vis === 'personal')) :
        templateTab === 'shared' ? (!isSys && vis !== 'personal') :
        isSys;
      const matchesSearch = !q || (t.name || '').toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
  }, [templates, templateTab, templateSearch, currentUserId, currentUserEmail]);

  const handleSelectTemplate = (tpl: Template | null) => {
    setSelectedTemplate(tpl);
    if (!tpl) {
      return;
    }
    const compiled = compileTemplateHtml(tpl);
    if (compiled) {
      setHtmlBody(compiled);
    }
    if ((tpl as any).subject) {
      setSubject((tpl as any).subject);
    } else if (tpl.name) {
      setSubject(tpl.name);
    }
    setActiveEditorTab('preview');
  };

  const insertSubjectTag = (tag: string) => {
    const token = tag.startsWith('{{') ? tag : `{{${tag}}}`;
    const el = subjectInputRef.current;
    if (el) {
      const start = el.selectionStart ?? subject.length;
      const end = el.selectionEnd ?? subject.length;
      const next = subject.slice(0, start) + token + subject.slice(end);
      setSubject(next);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      }, 0);
    } else {
      setSubject((prev) => prev + ' ' + token);
    }
    setShowSubjectTagMenu(false);
  };

  const insertBodyTag = (tag: string) => {
    const token = tag.startsWith('{{') ? tag : `{{${tag}}}`;
    const el = bodyTextareaRef.current;
    if (el && activeEditorTab === 'compose') {
      const start = el.selectionStart ?? htmlBody.length;
      const end = el.selectionEnd ?? htmlBody.length;
      const next = htmlBody.slice(0, start) + token + htmlBody.slice(end);
      setHtmlBody(next);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      }, 0);
    } else {
      setHtmlBody((prev) => prev + token);
      setActiveEditorTab('compose');
    }
    setShowBodyTagMenu(false);
  };

  const buildMergeContextForContact = (c?: CrmMarketingContact) => {
    const fullName = (c?.full_name || c?.name || 'Quý khách hàng').trim();
    const parts = fullName.split(/\s+/);
    const firstName = parts.length > 0 ? parts[parts.length - 1] : fullName;
    const lastName = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
    const consultantName = c?.owner_name || currentUser?.full_name || currentUser?.name || 'Chuyên viên Tư vấn';
    const consultantEmail = c?.owner_email || currentUser?.email || 'support@ideas.edu.vn';
    const consultantPhone = c?.owner_phone || (currentUser as any)?.phone || '028 2244 6688';
    const consultantRole = currentUser?.job_title || 'Chuyên viên Tư vấn Đào tạo';

    return {
      fullName,
      full_name: fullName,
      firstName,
      first_name: firstName,
      lastName,
      last_name: lastName,
      email: c?.email || customEmailInput.trim() || '',
      phoneNumber: c?.phone || c?.mobile || '',
      phone_number: c?.phone || c?.mobile || '',
      phone: c?.phone || c?.mobile || '',
      companyName: c?.company || '',
      company_name: c?.company || '',
      jobTitle: c?.job_title || '',
      job_title: c?.job_title || '',
      city: c?.city || '',
      district: c?.district || '',
      address: c?.address || '',
      program: c?.program || 'MBA / DBA Quốc tế',
      stage_name: c?.stage_name || '',
      admission_date: c?.admission_date || '',
      lead_code: c?.student_code || c?.lead_code || (c?.id ? `KH-${c.id}` : ''),
      consultant_name: consultantName,
      consultant_phone: consultantPhone,
      consultant_email: consultantEmail,
      consultant_role: consultantRole,
      deal_title: c?.deal_title || (c?.program ? `${fullName} - ${c.program}` : fullName),
      deal_value: c?.expected_revenue || c?.value || '',
      deposit_amount: c?.total_deposit || c?.deposit_amount || '',
      deposit_status: c?.deposit_status || (Number(c?.total_deposit || 0) > 0 ? 'Đã đặt cọc' : 'Chưa đặt cọc'),
      payment_due_date: c?.payment_due_date || '',
      campaign_name: selectedTemplate?.name || 'CRM Direct Email',
    };
  };

  const activePreviewContact = contacts[previewContactIdx] || contacts[0];
  const previewMergeData = useMemo(
    () => buildMergeContextForContact(activePreviewContact),
    [activePreviewContact, currentUser, customEmailInput, selectedTemplate]
  );

  const interpolatedSubject = useMemo(
    () => interpolateMergeTags(subject, previewMergeData),
    [subject, previewMergeData]
  );

  const interpolatedHtml = useMemo(
    () => interpolateMergeTags(htmlBody, previewMergeData),
    [htmlBody, previewMergeData]
  );

  const validEmailContacts = useMemo(
    () => contacts.filter((c) => c.email && String(c.email).includes('@')),
    [contacts]
  );

  const customEmailsList = useMemo(() => {
    if (!customEmailInput.trim()) return [];
    return customEmailInput
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.includes('@'));
  }, [customEmailInput]);

  const totalValidRecipients = validEmailContacts.length + customEmailsList.length;

  const handleSendEmail = async () => {
    if (sendingGuardRef.current || isSending) return;
    if (!subject.trim()) {
      toast.error('Vui lòng nhập tiêu đề Email');
      return;
    }
    if (!htmlBody.trim()) {
      toast.error('Vui lòng nhập hoặc chọn nội dung Email');
      return;
    }
    if (totalValidRecipients === 0 && contacts.length === 0) {
      toast.error('Không có người nhận hợp lệ có địa chỉ Email');
      return;
    }

    sendingGuardRef.current = true;
    setIsSending(true);
    try {
      const contactIds = contacts.map((c) => Number(c.id)).filter((id) => id > 0);
      const recipientsPayload = validEmailContacts.map((c) => {
        const ctx = buildMergeContextForContact(c);
        return {
          id: String(c.id),
          contact_id: Number(c.id),
          email: String(c.email).trim(),
          first_name: ctx.first_name,
          last_name: ctx.last_name,
          full_name: ctx.full_name,
          phone_number: ctx.phone_number,
          company_name: ctx.company_name,
          job_title: ctx.job_title,
          city: ctx.city,
          custom_attributes: ctx,
        };
      });

      customEmailsList.forEach((em) => {
        if (!recipientsPayload.some((r) => r.email.toLowerCase() === em.toLowerCase())) {
          const ctx = buildMergeContextForContact(contacts[0]);
          recipientsPayload.push({
            id: `custom_${em}`,
            contact_id: contacts.length === 1 ? Number(contacts[0].id) : 0,
            email: em,
            first_name: ctx.first_name,
            last_name: ctx.last_name,
            full_name: ctx.full_name,
            phone_number: ctx.phone_number,
            company_name: ctx.company_name,
            job_title: ctx.job_title,
            city: ctx.city,
            custom_attributes: ctx,
          });
        }
      });

      const payload = {
        contact_ids: contactIds,
        custom_emails: customEmailsList,
        subject: subject.trim(),
        html_content: htmlBody,
        sender_email: senderEmail.trim() || verifiedSenders[0] || 'tuyensinh@ideas.edu.vn',
        from_email: senderEmail.trim() || verifiedSenders[0] || 'tuyensinh@ideas.edu.vn',
        sender_name: senderName.trim() || undefined,
        from_name: senderName.trim() || undefined,
        template_id: selectedTemplate?.id || undefined,
        template_name: selectedTemplate?.name || 'CRM Direct Email',
        recipients: recipientsPayload,
      };

      const res = await domationApi.post<any>('quick_send_email', payload);
      if (res && res.success) {
        const sentCount = res.data?.sent ?? Math.max(1, totalValidRecipients);
        toast.success(res.message || `Đã gửi thành công ${sentCount} email và lưu nhật ký tương tác CRM!`);
        onSuccess?.();
        onClose();
      } else {
        toast.error(res?.error || res?.message || 'Có lỗi xảy ra khi gửi email');
      }
    } catch (err: any) {
      console.error('CRM Send Email error:', err);
      toast.error(err?.message || 'Lỗi kết nối khi gửi email');
    } finally {
      sendingGuardRef.current = false;
      setIsSending(false);
    }
  };

  const handleOpenAdvancedCampaign = () => {
    const ids = contacts.map((c) => c.id).filter(Boolean).join(',');
    onClose();
    navigate(`/marketing/campaigns${ids ? `?crm_contacts=${ids}` : ''}`, {
      state: { openWizard: true, preselectedCrmContacts: contacts }
    });
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="mkt-scope">
    <div
      className="modal-backdrop modal-above-drawer fixed inset-0 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-[6px]"
      style={{ zIndex: effectiveZIndex, background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[18px] shadow-2xl w-full max-w-[1140px] max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between gap-4 bg-[var(--color-surface)] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-[14px] bg-[var(--color-primary)] text-white flex items-center justify-center shrink-0 shadow-sm">
              <Mail className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[var(--color-text)] truncate">
                {contacts.length === 1
                  ? `Gửi Email Mẫu — ${contacts[0].full_name || contacts[0].name || 'Khách hàng'}`
                  : `Gửi Email Hàng Loạt (${contacts.length} khách hàng đã chọn)`}
              </h2>
              <p className="text-xs text-[var(--color-text-muted)] truncate">
                Chọn mẫu thiết kế chuẩn hoặc tự soạn nội dung cá nhân hóa với biến trường dữ liệu CRM & tự động ghi nhận vào Timeline
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleOpenAdvancedCampaign}
              className="h-9 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-primary)] text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Mở trình tạo Chiến dịch Email Marketing nâng cao"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mở Chiến dịch Email nâng cao</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body: 2-Column Split Layout */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[var(--color-border)] overflow-hidden">
          {/* Left Column: Template Selector (4 cols) */}
          <div className="lg:col-span-4 flex flex-col min-h-0 bg-[var(--color-bg)]/50">
            <div className="p-3.5 border-b border-[var(--color-border)] space-y-2.5 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  1. Chọn mẫu Email
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTemplate(null);
                    setActiveEditorTab('compose');
                  }}
                  className={`text-xs font-semibold px-2 py-1 rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
                    !selectedTemplate
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10'
                  }`}
                >
                  + Tự soạn mới
                </button>
              </div>

              {/* Filter Tabs */}
              <div className="grid grid-cols-4 gap-1 p-1 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
                {[
                  { id: 'all', label: 'Tất cả' },
                  { id: 'shared', label: 'Chung' },
                  { id: 'personal', label: 'Của tôi' },
                  { id: 'system', label: 'Hệ thống' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplateTab(t.id as any)}
                    className={`py-1.5 text-[11px] font-semibold rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
                      templateTab === t.id
                        ? 'bg-[var(--color-primary)] text-white shadow-2xs'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="Tìm kiếm mẫu email..."
                  className="w-full h-9 pl-8.5 pr-3 text-xs rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>
            </div>

            {/* Template List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {loadingTemplates ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-[var(--color-text-muted)]">
                  <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
                  <span>Đang tải thư viện mẫu...</span>
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="py-10 text-center text-xs text-[var(--color-text-muted)]">
                  Không tìm thấy mẫu phù hợp.
                </div>
              ) : (
                filteredTemplates.map((tpl) => {
                  const isSelected = selectedTemplate?.id === tpl.id;
                  const vis = getTemplateVisibility(tpl);
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleSelectTemplate(tpl)}
                      className={`w-full text-left p-3 rounded-[14px] border transition-all flex items-start gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--color-surface)] border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/15 shadow-xs'
                          : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--color-bg)] border border-[var(--color-border-light)] flex items-center justify-center shrink-0 mt-0.5">
                        {tpl.id.startsWith('sys_') ? (
                          <Sparkles className="w-4 h-4 text-[var(--color-primary)]" />
                        ) : vis === 'personal' ? (
                          <User className="w-4 h-4 text-amber-600" />
                        ) : (
                          <Users className="w-4 h-4 text-emerald-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-xs font-semibold text-[var(--color-text)] truncate">
                            {tpl.name}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0" />}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-bg)] text-[var(--color-text-muted)] border border-[var(--color-border-light)]">
                            {vis === 'system' ? 'Mẫu chuẩn' : vis === 'personal' ? 'Của tôi' : 'Dùng chung'}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Subject, Merge Tags & Live Preview (8 cols) */}
          <div className="lg:col-span-8 flex flex-col min-h-0 bg-[var(--color-surface)]">
            {/* Recipient & Subject Form */}
            <div className="p-4 border-b border-[var(--color-border)] space-y-3 shrink-0">
              {/* Recipients summary, Verified Sender Email & Sender Name */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">
                    Người nhận ({totalValidRecipients} email / {contacts.length} hồ sơ)
                  </label>
                  <input
                    type="text"
                    value={customEmailInput}
                    onChange={(e) => setCustomEmailInput(e.target.value)}
                    placeholder={
                      validEmailContacts.length > 0
                        ? `Mặc định: ${validEmailContacts.map((c) => c.email).slice(0, 2).join(', ')}${validEmailContacts.length > 2 ? '...' : ''}`
                        : 'Nhập địa chỉ email nhận tại đây...'
                    }
                    className="w-full h-9 px-3 text-xs rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">
                    Email gửi đi (Đã xác minh)
                  </label>
                  <select
                    value={senderEmail || verifiedSenders[0] || 'tuyensinh@ideas.edu.vn'}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs font-medium rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                  >
                    {(verifiedSenders.length > 0 ? verifiedSenders : ['tuyensinh@ideas.edu.vn', 'cskh@ideas.edu.vn', 'marketing@ideas.edu.vn']).map((em, idx) => (
                      <option key={em} value={em}>
                        {em}{idx === 0 ? ' (Mặc định)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">
                    Tên người gửi hiển thị
                  </label>
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="VD: Nguyễn Văn A - Viện Quốc Tế IDEAS"
                    className="w-full h-9 px-3 text-xs rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
              </div>

              {/* Subject with Merge Tag Picker */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    Tiêu đề Email <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative" ref={subjectMenuRef}>
                    <button
                      type="button"
                      onClick={() => setShowSubjectTagMenu((p) => !p)}
                      className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Tag className="w-3 h-3" /> + Chèn biến cá nhân hóa
                    </button>
                    {showSubjectTagMenu && (
                      <div className="absolute right-0 top-full mt-1 w-72 max-h-72 overflow-y-auto bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[14px] shadow-xl z-50 p-2 custom-scrollbar">
                        {MYERP_MERGE_TAG_GROUPS.map((grp) => (
                          <div key={grp.id} className="mb-2 last:mb-0">
                            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                              {grp.label}
                            </div>
                            {grp.tags.map((item) => (
                              <button
                                key={item.key}
                                type="button"
                                onClick={() => insertSubjectTag(item.tag)}
                                className="w-full text-left px-2.5 py-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--color-bg)] flex items-center justify-between text-xs cursor-pointer"
                              >
                                <span className="font-medium text-[var(--color-text)]">{item.label}</span>
                                <code className="text-[10px] text-[var(--color-primary)] font-mono">{item.tag}</code>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <input
                  ref={subjectInputRef}
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Nhập tiêu đề email (hỗ trợ biến {{full_name}}, {{program}}...)"
                  className="w-full h-9.5 px-3 text-xs font-medium rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>
            </div>

            {/* Editor / Preview Toolbar */}
            <div className="px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-bg)]/60 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveEditorTab('compose')}
                  className={`h-8 px-3 rounded-[var(--radius-md)] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeEditorTab === 'compose'
                      ? 'bg-[var(--color-primary)] text-white shadow-2xs'
                      : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text)]'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" /> Soạn thảo nội dung (HTML)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveEditorTab('preview')}
                  className={`h-8 px-3 rounded-[var(--radius-md)] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeEditorTab === 'preview'
                      ? 'bg-[var(--color-primary)] text-white shadow-2xs'
                      : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text)]'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" /> Xem trước (Live Preview)
                </button>
              </div>

              <div className="flex items-center gap-2">
                {activeEditorTab === 'preview' && contacts.length > 1 && (
                  <select
                    value={previewContactIdx}
                    onChange={(e) => setPreviewContactIdx(Number(e.target.value))}
                    className="h-8 px-2.5 text-xs rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]"
                  >
                    {contacts.map((c, idx) => (
                      <option key={c.id || idx} value={idx}>
                        Xem trước: {c.full_name || c.name || `KH #${c.id}`}
                      </option>
                    ))}
                  </select>
                )}

                <div className="relative" ref={bodyMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowBodyTagMenu((p) => !p)}
                    className="h-8 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)] text-xs font-semibold text-[var(--color-text)] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Tag className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                    <span>Chèn biến MYERP</span>
                    <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                  </button>
                  {showBodyTagMenu && (
                    <div className="absolute right-0 top-full mt-1 w-80 max-h-80 overflow-y-auto bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[14px] shadow-2xl z-50 p-2 custom-scrollbar">
                      {MYERP_MERGE_TAG_GROUPS.map((grp) => (
                        <div key={grp.id} className="mb-2.5 last:mb-0">
                          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                            {grp.label}
                          </div>
                          {grp.tags.map((item) => (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => insertBodyTag(item.tag)}
                              className="w-full text-left px-2.5 py-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--color-bg)] flex items-center justify-between text-xs cursor-pointer"
                            >
                              <span className="font-medium text-[var(--color-text)]">{item.label}</span>
                              <code className="text-[10px] text-[var(--color-primary)] font-mono">{item.tag}</code>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Editor or Live Preview Canvas */}
            <div className="flex-1 min-h-[280px] overflow-y-auto p-4 bg-[var(--color-bg)]/30">
              {activeEditorTab === 'compose' ? (
                <textarea
                  ref={bodyTextareaRef}
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  placeholder="Nhập mã HTML hoặc nội dung email tại đây..."
                  className="w-full h-full min-h-[260px] p-3.5 text-xs font-mono leading-relaxed rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] resize-none"
                />
              ) : (
                <div className="rounded-[14px] border border-[var(--color-border)] bg-white overflow-hidden shadow-xs">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs text-slate-700 space-y-1">
                    <div>
                      <span className="font-semibold text-slate-500">Tiêu đề sau khi trộn biến: </span>
                      <span className="font-bold text-slate-900">{interpolatedSubject}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-500">Người nhận mẫu: </span>
                      <span>
                        {previewMergeData.full_name} ({previewMergeData.email || 'Chưa có email'})
                      </span>
                    </div>
                  </div>
                  <iframe
                    title="CRM Email Live Preview"
                    srcDoc={`<html><head><meta charset="utf-8"/><style>body{margin:0;padding:16px;font-family:Arial,sans-serif;background:#ffffff;color:#0f172a;}</style></head><body>${interpolatedHtml}</body></html>`}
                    className="w-full h-[320px] border-none bg-white"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-2">
            {totalValidRecipients > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-600 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Sẵn sàng gửi tới {totalValidRecipients} địa chỉ email
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-amber-600 font-medium">
                <AlertCircle className="w-4 h-4" />
                Hồ sơ chưa có email — Vui lòng nhập địa chỉ email ở ô Người nhận phía trên
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="h-9.5 px-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSendEmail}
              disabled={isSending || (totalValidRecipients === 0 && contacts.length === 0)}
              className="h-9.5 px-5 rounded-[var(--radius-md)] bg-[var(--color-primary)] hover:opacity-95 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm cursor-pointer"
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{isSending ? 'Đang gửi...' : `Gửi Email ngay (${Math.max(1, totalValidRecipients)})`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    </div>,
    document.body
  );
};

export const CrmBulkMarketingModal: React.FC<CrmBulkMarketingModalProps> = ({
  isOpen,
  onClose,
  contactIds,
  contacts = [],
  initialMode = 'list',
  onSuccess,
  zIndex = 2147483645,
}) => {
  const effectiveZIndex = Math.min(Math.max(zIndex || 2147483645, 2147483640), 2147483646);
  const [mode, setMode] = useState<'list' | 'flow'>(initialMode);
  const [lists, setLists] = useState<any[]>([]);
  const [flows, setFlows] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [selectedListId, setSelectedListId] = useState('');
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newListName, setNewListName] = useState('');

  const [selectedFlowId, setSelectedFlowId] = useState('');
  const [flowNote, setFlowNote] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitGuardRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
    }
  }, [isOpen, initialMode]);

  // ESC overlay support
  useEffect(() => {
    if (!isOpen) return;
    return pushOverlay('crm-bulk-marketing-modal', onClose, effectiveZIndex);
  }, [isOpen, onClose, effectiveZIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    setLoadingData(true);

    Promise.all([
      domationApi.get<any[]>('lists', {}, { signal: controller.signal }).catch(() => ({ success: false, data: [] })),
      domationApi.get<any[]>('flows', {}, { signal: controller.signal }).catch(() => ({ success: false, data: [] })),
    ])
      .then(([listsRes, flowsRes]) => {
        if (controller.signal.aborted) return;
        const loadedLists = listsRes.success && Array.isArray(listsRes.data) ? listsRes.data : [];
        const loadedFlows = flowsRes.success && Array.isArray(flowsRes.data) ? flowsRes.data : [];
        setLists(loadedLists);
        setFlows(loadedFlows);
        if (loadedLists.length > 0 && !selectedListId) {
          setSelectedListId(String(loadedLists[0].id));
        }
        const activeFlows = loadedFlows.filter((f: any) => f.status === 'active');
        if (activeFlows.length > 0 && !selectedFlowId) {
          setSelectedFlowId(String(activeFlows[0].id));
        } else if (loadedFlows.length > 0 && !selectedFlowId) {
          setSelectedFlowId(String(loadedFlows[0].id));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingData(false);
      });

    return () => controller.abort();
  }, [isOpen]);

  const handleSubmit = async () => {
    if (submitGuardRef.current || isSubmitting) return;
    const uniqueIds = Array.from(new Set(contactIds.map((id) => Number(id)).filter((id) => id > 0)));
    if (uniqueIds.length === 0) {
      toast.error('Chưa có hồ sơ khách hàng nào được chọn');
      return;
    }

    submitGuardRef.current = true;
    setIsSubmitting(true);

    try {
      if (mode === 'list') {
        if (isCreatingList && !newListName.trim()) {
          toast.error('Vui lòng nhập tên Danh sách Marketing mới');
          submitGuardRef.current = false;
          setIsSubmitting(false);
          return;
        }
        if (!isCreatingList && !selectedListId) {
          toast.error('Vui lòng chọn một Danh sách Marketing');
          submitGuardRef.current = false;
          setIsSubmitting(false);
          return;
        }

        const res = await erpApi.post('/contacts/static-list', {
          contact_ids: uniqueIds,
          list_mode: isCreatingList ? 'new' : 'existing',
          list_id: isCreatingList ? undefined : selectedListId,
          list_name: isCreatingList ? newListName.trim() : undefined,
          only_with_email: false,
        });
        const data = res.data?.data || res.data || {};
        const addedCount = Number(data.added_count ?? uniqueIds.length);
        const targetListName = data.list_name || (isCreatingList ? newListName.trim() : lists.find((l) => String(l.id) === String(selectedListId))?.name || 'Danh sách Marketing');
        toast.success(`Đã đồng bộ ${addedCount} khách hàng vào danh sách "${targetListName}"!`);
        onSuccess?.();
        onClose();
      } else {
        // Mode: 'flow'
        const targetFlow = flows.find((f) => String(f.id) === String(selectedFlowId));
        if (!targetFlow) {
          toast.error('Vui lòng chọn Kịch bản Automation');
          submitGuardRef.current = false;
          setIsSubmitting(false);
          return;
        }

        let enrolledCount = 0;
        let lastError = '';
        for (const cid of uniqueIds) {
          try {
            await erpApi.post(`/contacts/${cid}/enroll-flow`, {
              flow_id: targetFlow.id,
              flow_name: targetFlow.name,
              note: flowNote.trim() || `Kích hoạt từ CRM (${uniqueIds.length} hồ sơ)`,
            });
            enrolledCount++;
          } catch (err: any) {
            lastError = err?.response?.data?.error || err?.response?.data?.message || err?.message || '';
          }
        }

        if (enrolledCount > 0) {
          toast.success(`Đã kích hoạt kịch bản "${targetFlow.name}" cho ${enrolledCount}/${uniqueIds.length} khách hàng!`);
          onSuccess?.();
          onClose();
        } else {
          toast.error(lastError || 'Không thể kích hoạt Kịch bản Automation cho hồ sơ đã chọn');
        }
      }
    } catch (err: any) {
      console.error('CRM Bulk Marketing error:', err);
      toast.error(err?.message || 'Lỗi hệ thống khi thực hiện thao tác Marketing');
    } finally {
      submitGuardRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="mkt-scope">
    <div
      className="modal-backdrop modal-above-drawer fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[6px]"
      style={{ zIndex: effectiveZIndex, background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[18px] shadow-2xl w-full max-w-[540px] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[14px] bg-[var(--color-primary)] text-white flex items-center justify-center shrink-0">
              {mode === 'list' ? <List className="w-5 h-5" /> : <GitBranch className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--color-text)]">
                Marketing & Automation ({contactIds.length} khách hàng)
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                Đồng bộ hồ sơ CRM sang Danh sách Email hoặc kích hoạt luồng chăm sóc tự động
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-[var(--radius-md)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="px-5 pt-4">
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-[var(--color-bg)] rounded-[14px] border border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => setMode('list')}
              className={`h-9 rounded-[var(--radius-md)] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mode === 'list'
                  ? 'bg-[var(--color-primary)] text-white shadow-xs'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
              }`}
            >
              <List className="w-3.5 h-3.5" /> Thêm vào Danh sách Marketing
            </button>
            <button
              type="button"
              onClick={() => setMode('flow')}
              className={`h-9 rounded-[var(--radius-md)] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mode === 'flow'
                  ? 'bg-[var(--color-primary)] text-white shadow-xs'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" /> Kích hoạt Kịch bản Automation
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {loadingData ? (
            <div className="py-10 flex flex-col items-center justify-center gap-2 text-xs text-[var(--color-text-muted)]">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
              <span>Đang tải dữ liệu Marketing...</span>
            </div>
          ) : mode === 'list' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  {isCreatingList ? 'Tạo Danh sách Marketing mới' : 'Chọn Danh sách Marketing'}
                </label>
                <button
                  type="button"
                  onClick={() => setIsCreatingList((p) => !p)}
                  className="text-xs font-semibold text-[var(--color-primary)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isCreatingList ? 'Chọn danh sách có sẵn' : 'Tạo danh sách mới'}
                </button>
              </div>

              {isCreatingList ? (
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="Nhập tên danh sách mới (VD: Lead MBA Tháng 10)..."
                  className="w-full h-10 px-3.5 text-xs rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                  autoFocus
                />
              ) : (
                <select
                  value={selectedListId}
                  onChange={(e) => setSelectedListId(e.target.value)}
                  className="w-full h-10 px-3 text-xs rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                >
                  <option value="">-- Chọn danh sách nhận email --</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.count ?? 0} liên hệ)
                    </option>
                  ))}
                </select>
              )}

              <div className="p-3 rounded-[14px] bg-[var(--color-bg)] border border-[var(--color-border-light)] text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Hệ thống sẽ tự động đồng bộ Họ tên, Email, SĐT, Chương trình quan tâm và Giai đoạn Pipeline của <strong>{contactIds.length} hồ sơ</strong> sang phân hệ Email Marketing để phục vụ gửi chiến dịch.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
                  Chọn Kịch bản Automation (Flow)
                </label>
                <select
                  value={selectedFlowId}
                  onChange={(e) => setSelectedFlowId(e.target.value)}
                  className="w-full h-10 px-3 text-xs rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                >
                  <option value="">-- Chọn kịch bản chăm sóc tự động --</option>
                  {flows.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} {f.status === 'active' ? '(Đang chạy)' : `(${f.status})`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
                  Ghi chú kích hoạt (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={flowNote}
                  onChange={(e) => setFlowNote(e.target.value)}
                  placeholder="VD: Chăm sóc tự động sau tư vấn lần 1..."
                  className="w-full h-10 px-3.5 text-xs rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-9.5 px-4 rounded-[var(--radius-md)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || loadingData}
            className="h-9.5 px-5 rounded-[var(--radius-md)] bg-[var(--color-primary)] hover:opacity-95 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm cursor-pointer"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>
              {isSubmitting
                ? 'Đang xử lý...'
                : mode === 'list'
                ? 'Thêm vào Danh sách'
                : 'Kích hoạt Kịch bản'}
            </span>
          </button>
        </div>
      </div>
    </div>
    </div>,
    document.body
  );
};

export interface CrmFilterToStaticListModalProps {
  isOpen: boolean;
  onClose: () => void;
  filterParams: Record<string, any>;
  selectedContactIds?: number[];
  totalMatchingCount: number;
  activeFilterSummary?: string[];
  onSuccess?: (res: any) => void;
  zIndex?: number;
}

export const CrmFilterToStaticListModal: React.FC<CrmFilterToStaticListModalProps> = ({
  isOpen,
  onClose,
  filterParams,
  selectedContactIds = [],
  totalMatchingCount,
  activeFilterSummary = [],
  onSuccess,
  zIndex = 2147483645
}) => {
  const effectiveZIndex = Math.min(Math.max(zIndex || 2147483645, 2147483640), 2147483646);
  const navigate = useNavigate();
  const [scope, setScope] = useState<'all_filtered' | 'selected'>('all_filtered');
  const [destinationMode, setDestinationMode] = useState<'new' | 'existing'>('new');
  const [listName, setListName] = useState('');
  const [listDescription, setListDescription] = useState('');
  const [targetListId, setTargetListId] = useState('');
  const [onlyWithEmail, setOnlyWithEmail] = useState(false);

  const [existingLists, setExistingLists] = useState<Array<{ id: string; name: string; count?: number }>>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedResult, setSavedResult] = useState<{
    list_id?: string | number;
    list_name?: string;
    added_count: number;
    total_matched: number;
  } | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    return pushOverlay('crm-filter-to-static-list-modal', onClose, effectiveZIndex);
  }, [isOpen, onClose, effectiveZIndex]);

  useEffect(() => {
    if (!isOpen) return;
    setSavedResult(null);
    setScope(selectedContactIds.length > 0 ? 'selected' : 'all_filtered');
    setDestinationMode('new');
    const todayStr = new Date().toLocaleDateString('vi-VN');
    setListName(`Tệp Khách hàng CRM (${todayStr})`);
    setListDescription(
      activeFilterSummary.length > 0
        ? `Lọc từ CRM: ${activeFilterSummary.join(' • ')}`
        : 'Đồng bộ từ bộ lọc Quản lý Liên hệ & Lead MYERP'
    );
    setOnlyWithEmail(false);

    setLoadingLists(true);
    domationApi
      .get<any[]>('lists')
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          const mapped = res.data.map((l: any) => ({
            id: String(l.id),
            name: l.name || `Danh sách #${l.id}`,
            count: Number(l.count || 0)
          }));
          setExistingLists(mapped);
          if (mapped.length > 0) {
            setTargetListId(mapped[0].id);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingLists(false));
  }, [isOpen, selectedContactIds.length]);

  if (!isOpen) return null;

  const handleSaveStaticList = async () => {
    if (inFlightRef.current || isSubmitting) return;
    if (destinationMode === 'new' && !listName.trim()) {
      toast.error('Vui lòng nhập tên Danh sách tĩnh mới');
      return;
    }
    if (destinationMode === 'existing' && !targetListId) {
      toast.error('Vui lòng chọn Danh sách tĩnh đích');
      return;
    }

    inFlightRef.current = true;
    setIsSubmitting(true);
    try {
      const payload: Record<string, any> = {
        ...filterParams,
        contact_ids: scope === 'selected' ? selectedContactIds : undefined,
        list_name: destinationMode === 'new' ? listName.trim() : undefined,
        list_description: destinationMode === 'new' ? listDescription.trim() : undefined,
        target_list_id: destinationMode === 'existing' ? targetListId : undefined,
        only_with_email: onlyWithEmail
      };

      const res = await erpApi.post('/contacts/static-list', payload);
      const data = res.data?.data ?? res.data;
      if (res.data?.success !== false && data) {
        const addedCount = Number(data.added_count ?? data.populated_count ?? data.count ?? 0);
        const totalMatched = Number(
          data.total_matched ?? (scope === 'selected' ? selectedContactIds.length : totalMatchingCount)
        );
        const resolvedName =
          data.list_name ||
          (destinationMode === 'new'
            ? listName.trim()
            : existingLists.find((l) => l.id === targetListId)?.name || 'Danh sách tĩnh');

        setSavedResult({
          list_id: data.list_id ?? data.id ?? targetListId,
          list_name: resolvedName,
          added_count: addedCount,
          total_matched: totalMatched
        });
        toast.success(`Đã lưu ${addedCount.toLocaleString('vi-VN')} khách hàng vào Danh sách tĩnh!`);
        onSuccess?.(data);
      } else {
        toast.error(res.data?.message || 'Không thể lưu Danh sách tĩnh');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lỗi kết nối khi tạo Danh sách tĩnh từ bộ lọc CRM');
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="mkt-scope">
    <div
      className="modal-backdrop modal-above-drawer fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[6px] p-4"
      style={{ zIndex: effectiveZIndex, background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={() => !isSubmitting && onClose()}
    >
      <div
        className="w-full max-w-xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between bg-emerald-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <List className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[var(--color-text)]">
                Lưu Danh sách Tĩnh (Email / Marketing)
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                Đóng băng tệp khách hàng từ bộ lọc CRM sang phân hệ Marketing mà không bị giới hạn phân trang
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {savedResult ? (
          <div className="p-6 space-y-5">
            <div className="p-5 rounded-[20px] bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-extrabold text-[var(--color-text)]">
                Đã đồng bộ sang Danh sách Tĩnh thành công!
              </h4>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Danh sách: <strong className="text-emerald-600">{savedResult.list_name}</strong>
              </p>
              <div className="inline-flex items-center gap-4 px-4 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] mt-2">
                <div className="text-left">
                  <div className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
                    Tổng khớp bộ lọc
                  </div>
                  <div className="text-sm font-black text-[var(--color-text)]">
                    {savedResult.total_matched.toLocaleString('vi-VN')} hồ sơ
                  </div>
                </div>
                <div className="h-6 w-px bg-[var(--color-border)]" />
                <div className="text-left">
                  <div className="text-[10px] font-bold uppercase text-emerald-600">
                    Đã nạp vào List
                  </div>
                  <div className="text-sm font-black text-emerald-600">
                    {savedResult.added_count.toLocaleString('vi-VN')} liên hệ
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate(`/marketing/audience?tab=lists${savedResult.list_id ? `&list_id=${savedResult.list_id}` : ''}`);
                }}
                className="h-10 px-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                Mở Danh sách trong Email Marketing
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate(`/marketing/campaigns${savedResult.list_id ? `?list_id=${savedResult.list_id}` : ''}`, {
                    state: { openWizard: true, listId: savedResult.list_id }
                  });
                }}
                className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all"
              >
                <Send className="w-4 h-4" />
                Tạo Chiến dịch Email ngay
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            {/* Active Filter Badges */}
            {activeFilterSummary.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)] space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  Điều kiện lọc đang áp dụng trên trang Liên hệ
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeFilterSummary.map((badge, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[11px] font-bold"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 1. Scope Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-[var(--color-text-secondary)]">
                1. Phạm vi Khách hàng cần nạp
              </label>
              <div className="grid grid-cols-1 gap-2.5">
                <label
                  onClick={() => setScope('all_filtered')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                    scope === 'all_filtered'
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        scope === 'all_filtered' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-400'
                      }`}
                    >
                      {scope === 'all_filtered' && <Check className="w-2.5 h-2.5" />}
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-[var(--color-text)]">
                        Toàn bộ khách hàng khớp bộ lọc hiện tại (Tất cả các trang)
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        Quét trực tiếp từ Database MYERP, không giới hạn 10 dòng/trang
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-600 text-white text-xs font-black shrink-0">
                    {totalMatchingCount.toLocaleString('vi-VN')} hồ sơ
                  </span>
                </label>

                {selectedContactIds.length > 0 && (
                  <label
                    onClick={() => setScope('selected')}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                      scope === 'selected'
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          scope === 'selected' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-400'
                        }`}
                      >
                        {scope === 'selected' && <Check className="w-2.5 h-2.5" />}
                      </div>
                      <div>
                        <p className="text-xs font-extrabold text-[var(--color-text)]">
                          Chỉ những khách hàng đang tích chọn trên bảng
                        </p>
                        <p className="text-[11px] text-[var(--color-text-muted)]">
                          Lưu nhanh các liên hệ bạn vừa đánh dấu checkbox
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-xl bg-indigo-600 text-white text-xs font-black shrink-0">
                      {selectedContactIds.length.toLocaleString('vi-VN')} đã chọn
                    </span>
                  </label>
                )}
              </div>
            </div>

            {/* 2. Destination Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  2. Danh sách Tĩnh đích
                </label>
                <div className="flex bg-[var(--color-bg)] p-0.5 rounded-xl border border-[var(--color-border)]">
                  <button
                    type="button"
                    onClick={() => setDestinationMode('new')}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      destinationMode === 'new'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    + Tạo Danh sách mới
                  </button>
                  <button
                    type="button"
                    onClick={() => setDestinationMode('existing')}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      destinationMode === 'existing'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    Chọn Danh sách có sẵn
                  </button>
                </div>
              </div>

              {destinationMode === 'new' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--color-text-secondary)] mb-1">
                      Tên Danh sách tĩnh mới *
                    </label>
                    <input
                      type="text"
                      value={listName}
                      onChange={(e) => setListName(e.target.value)}
                      placeholder="VD: Danh sách Lead Nóng nhận Học bổng Tháng 10..."
                      className="w-full h-10 px-3.5 text-xs font-semibold rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:border-emerald-500"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--color-text-secondary)] mb-1">
                      Mô tả / Ghi chú nguồn lọc
                    </label>
                    <input
                      type="text"
                      value={listDescription}
                      onChange={(e) => setListDescription(e.target.value)}
                      placeholder="Ghi chú mục đích sử dụng danh sách..."
                      className="w-full h-10 px-3.5 text-xs rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-[var(--color-text-secondary)] mb-1">
                    Chọn Danh sách tĩnh hiện có
                  </label>
                  <select
                    value={targetListId}
                    onChange={(e) => setTargetListId(e.target.value)}
                    disabled={loadingLists}
                    className="w-full h-10 px-3 text-xs font-semibold rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Chọn danh sách tĩnh --</option>
                    {existingLists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.count ?? 0} thành viên)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 3. Email Filter Checkbox */}
            <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] cursor-pointer hover:border-emerald-500/40 transition-all">
              <input
                type="checkbox"
                checked={onlyWithEmail}
                onChange={(e) => setOnlyWithEmail(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-extrabold text-[var(--color-text)] block">
                  Chỉ thêm khách hàng có địa chỉ Email hợp lệ
                </span>
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  Bỏ tích nếu bạn muốn lưu cả những Lead chỉ có Số điện thoại để phục vụ gửi Zalo ZNS / SMS hoặc Telesale.
                </span>
              </div>
            </label>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-end gap-2.5">
          {savedResult ? (
            <button
              type="button"
              onClick={onClose}
              className="h-9.5 px-5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text)] hover:opacity-90 cursor-pointer"
            >
              Đóng cửa sổ
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="h-9.5 px-4 rounded-xl border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveStaticList}
                disabled={isSubmitting}
                className="h-9.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-2 shadow-sm cursor-pointer transition-all"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <List className="w-4 h-4" />}
                <span>
                  {isSubmitting
                    ? 'Đang đồng bộ danh sách...'
                    : scope === 'selected'
                    ? `Lưu ${selectedContactIds.length.toLocaleString('vi-VN')} khách hàng vào List`
                    : `Lưu ${totalMatchingCount.toLocaleString('vi-VN')} khách hàng vào List`}
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
    </div>,
    document.body
  );
};

