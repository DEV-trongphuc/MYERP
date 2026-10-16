import React, { useState, useRef } from 'react';
import { 
  Sparkles, Check, X, Loader2, Calendar, DollarSign, 
  CheckSquare, User, ArrowRight, ExternalLink, AlertCircle, Clock,
  Package, RefreshCw, FileText, FileSpreadsheet, Download, ClipboardList,
  Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { downloadExportFile } from '../../utils/exportHelper';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { Avatar } from '../ui/Avatar';

export interface ActionProposal {
  action_type: 'leave' | 'expense' | 'task' | 'lead' | 'sales_order' | 'deposit' | 'supplementary' | 'advance_payment' | 'inventory_receipt' | 'shift_swap' | 'admission_document_request' | 'legal_contract' | 'asset_handover' | 'marketing_campaign' | 'ticket' | 'quote' | 'deal' | 'export_data' | 'export' | (string & {});
  title: string;
  params: Record<string, any>;
  summary: string;
}

function safeParseJson<T = any>(str: string): T | null {
  if (!str || typeof str !== 'string') return null;
  try {
    return JSON.parse(str);
  } catch {
    try {
      const sanitized = str
        .replace(/\\u1ecp/gi, 'ỉ')
        .replace(/\\u(?![0-9a-fA-F]{4})/g, '\\\\u')
        .replace(/[\x00-\x1F\x7F-\x9F]/g, (c) => (c === '\n' || c === '\r' || c === '\t' ? c : ''));
      return JSON.parse(sanitized);
    } catch {
      try {
        const relaxed = str
          .replace(/\\u1ecp/gi, 'ỉ')
          .replace(/\\u(?![0-9a-fA-F]{4})/g, '');
        return JSON.parse(relaxed);
      } catch {
        return null;
      }
    }
  }
}

export const parseActionProposal = (content: string): { cleanContent: string; proposal: ActionProposal | null } => {
  if (!content) return { cleanContent: '', proposal: null };
  const match = content.match(/<<<ACTION_PROPOSAL:\s*({[\s\S]*?})\s*>>>/);
  if (!match) return { cleanContent: content, proposal: null };

  // Always strip raw <<<ACTION_PROPOSAL:...>>> tag from the message bubble view
  const cleanContent = content.replace(match[0], '').trim();

  const raw = safeParseJson<any>(match[1]);

  if (!raw) {
    // Robust fallback: regex extraction if JSON was heavily malformed
    const typeMatch = match[1].match(/"action_type"\s*:\s*"([^"]+)"/);
    if (typeMatch) {
      const actionType = typeMatch[1] as ActionProposal['action_type'];
      const summaryMatch = match[1].match(/"summary"\s*:\s*"([^"]+)"/);
      const reasonMatch = match[1].match(/"reason"\s*:\s*"([^"]+)"/);
      const startDateMatch = match[1].match(/"start_date"\s*:\s*"([^"]+)"/);
      const endDateMatch = match[1].match(/"end_date"\s*:\s*"([^"]+)"/);
      return {
        cleanContent,
        proposal: {
          action_type: actionType,
          title: actionType === 'leave' ? 'Đề xuất nghỉ phép' : 'Đề xuất hành động ERP',
          summary: summaryMatch ? summaryMatch[1] : 'Đề xuất từ AI IDEAS',
          params: {
            leave_type: 'unpaid',
            start_date: startDateMatch ? startDateMatch[1] : new Date().toISOString().split('T')[0],
            end_date: endDateMatch ? endDateMatch[1] : new Date().toISOString().split('T')[0],
            total_days: 1,
            reason: reasonMatch ? reasonMatch[1] : 'Việc cá nhân'
          }
        }
      };
    }
    return { cleanContent, proposal: null };
  }

  let params: Record<string, any> = raw.params || {};
  if (raw.params_json) {
    if (typeof raw.params_json === 'string') {
      const parsedParams = safeParseJson<Record<string, any>>(raw.params_json);
      if (parsedParams && typeof parsedParams === 'object') {
        params = { ...params, ...parsedParams };
      }
    } else if (typeof raw.params_json === 'object') {
      params = { ...params, ...raw.params_json };
    }
  }

  const proposal: ActionProposal = {
    action_type: (raw.action_type || params.action_type || 'leave') as ActionProposal['action_type'],
    title: raw.title || params.title || (raw.action_type === 'leave' ? 'Đề xuất nghỉ phép' : 'Đề xuất hành động ERP'),
    summary: raw.summary || params.summary || 'Đề xuất từ AI IDEAS',
    params
  };

  return { cleanContent, proposal };
};

interface ActionProposalCardProps {
  proposal: ActionProposal;
  messageId: number | string;
  onExecuted?: (actionType: string, resultData: any) => void;
}

export const ActionProposalCard: React.FC<ActionProposalCardProps> = ({
  proposal,
  messageId,
  onExecuted
}) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'cancelled' | 'error'>('idle');
  const [resultId, setResultId] = useState<number | string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const inFlightRef = useRef(false);
  const proposalInstanceId = `${messageId}_${proposal.action_type}`;

  // Bi-directional event bus: listen for form completions from background Drawers/Modals
  React.useEffect(() => {
    const handleActionCompleted = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail;
      if (!detail) return;

      const activeProposalId = detail.proposalId || (window as any).__activeErpProposalId;
      if (!activeProposalId || activeProposalId !== proposalInstanceId) {
        return;
      }

      if (
        detail.actionType === proposal.action_type ||
        (proposal.action_type === 'advance_payment' && detail.actionType === 'expense') ||
        (proposal.action_type === 'supplementary' && detail.actionType === 'attendance') ||
        (proposal.action_type === 'deposit' && detail.actionType === 'deposit')
      ) {
        setStatus('success');
        if (detail.id) setResultId(detail.id);
        if ((window as any).__activeErpProposalId === proposalInstanceId) {
          (window as any).__activeErpProposalId = null;
        }
      }
    };
    window.addEventListener('erp-action-completed', handleActionCompleted);
    return () => window.removeEventListener('erp-action-completed', handleActionCompleted);
  }, [proposal.action_type, proposalInstanceId]);

  const handleOpenAndPrefill = async () => {
    if (inFlightRef.current || status === 'submitting' || status === 'success' || status === 'cancelled') return;
    inFlightRef.current = true;
    setErrorMsg('');
    (window as any).__activeErpProposalId = proposalInstanceId;

    try {
      const p = proposal.params || {};

      switch (proposal.action_type) {
        case 'expense': {
          window.dispatchEvent(new CustomEvent('open-expense-create-drawer', {
            detail: {
              title: p.title || 'Đề xuất thanh toán',
              amount: Number(p.amount) || 0,
              category: p.category || 'general',
              notes: p.notes || p.reason || '',
              approver_id: p.approver_id,
              approver_id_2: p.approver_id_2,
              approver_id_3: p.approver_id_3,
              due_date: p.due_date || '',
              vat_amount: p.vat_amount !== undefined ? Number(p.vat_amount) : undefined,
              has_vat_invoice: p.has_vat_invoice !== undefined ? Boolean(p.has_vat_invoice) : undefined,
              is_vat_inclusive: p.is_vat_inclusive !== undefined ? Boolean(p.is_vat_inclusive) : undefined,
              items: Array.isArray(p.items) ? p.items : undefined,
              entities: Array.isArray(p.entities) ? p.entities : undefined,
              bank_name: p.bank_name || '',
              bank_account: p.bank_account || '',
              bank_holder: p.bank_holder || '',
              vendor_name: p.vendor_name || ''
            }
          }));
          toast.success('Đã mở Đề xuất chi và điền sẵn thông tin! Bạn hãy kiểm tra lại và bấm Lưu nhé.');
          break;
        }

        case 'sales_order': {
          let contactId = p.contact_id || p.customer_id || p.id || null;
          const phone = p.contact_phone || p.phone || p['SĐT'] || p['sdt'] || p['so_dien_thoai'] || '';
          const email = p.contact_email || p.email || p['Email'] || '';
          const fullName = p.contact_name || p.customer_name || p.name || p.full_name || p['Họ và tên'] || '';

          // If contact_id is missing, attempt to lookup contact by phone/email/name from CRM
          if (!contactId && (phone || email || fullName)) {
            try {
              const searchQ = phone || email || fullName;
              const res = await api.get('/contacts', { params: { search: searchQ } });
              const list = Array.isArray(res.data) ? res.data : (res.data?.data?.items || res.data?.data || res.data?.items || []);
              if (list.length > 0) {
                const cleanPhone = String(phone).replace(/\D/g, '');
                const matched = list.find((c: any) => {
                  const cPhone = String(c.phone || '').replace(/\D/g, '');
                  if (cleanPhone && cPhone && (cPhone.includes(cleanPhone) || cleanPhone.includes(cPhone))) return true;
                  if (email && c.email && String(c.email).toLowerCase() === String(email).toLowerCase()) return true;
                  return false;
                }) || list[0];
                if (matched && matched.id) {
                  contactId = matched.id;
                }
              }
            } catch (err) {
              console.warn('Auto contact lookup error:', err);
            }
          }

          // Format milestones / installments cleanly
          const rawList = p.installments || p.milestones || p.items || p.schedule || [];
          let mappedMilestones: any[] | undefined = undefined;

          if (Array.isArray(rawList) && rawList.length > 0) {
            mappedMilestones = rawList.map((it: any, idx: number) => {
              const name = it.name || it.title || it.label || `Đợt ${idx + 1}`;
              const amount = String(it.amount || it.price || it.unit_price || '');

              let payDate = it.date || it.expected_pay_date || it.pay_date || '';
              if (payDate && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(payDate)) {
                const parts = payDate.split('/');
                payDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              }
              if (!payDate || isNaN(new Date(payDate).getTime())) {
                payDate = new Date().toLocaleDateString('sv-SE');
              }

              return {
                name,
                amount,
                expected_pay_date: payDate
              };
            });
          }

          const totalAmount = p.total || p.amount || p.total_amount_VND || p.total_amount || p['Tổng tiền'] || '';

          useUIStore.getState().setShowPOS({
            id: contactId ? Number(contactId) : null,
            full_name: fullName || 'Khách hàng',
            phone: phone || '',
            email: email || '',
            price: totalAmount ? String(totalAmount) : '',
            notes: p.notes || p.description || 'Khởi tạo từ AI IDEAS Agent',
            milestones: mappedMilestones,
            projectId: p.project_id || p.course_id || p.program_id || '',
            unit_code: p.unit_code || '',
            expected_commission: p.expected_commission !== undefined ? String(p.expected_commission) : undefined,
            accountant_id: p.accountant_id ? Number(p.accountant_id) : undefined,
            participant_ids: p.participant_ids || '',
            exchange_rate: p.exchange_rate !== undefined ? Number(p.exchange_rate) : undefined,
            currency: p.currency || 'VND'
          });
          toast.success('Đã mở Phiếu thu/Đơn hàng (SO) và điền sẵn thông tin! Bạn hãy kiểm tra và lưu nhé.');
          break;
        }

        case 'deposit': {
          let contactId = p.contact_id || p.customer_id || p.id || null;
          const phone = p.contact_phone || p.phone || p['SĐT'] || p['sdt'] || '';
          const email = p.contact_email || p.email || '';
          const fullName = p.contact_name || p.customer_name || p.name || p.full_name || '';

          if (!contactId && (phone || email || fullName)) {
            try {
              const searchQ = phone || email || fullName;
              const res = await api.get('/contacts', { params: { search: searchQ } });
              const list = Array.isArray(res.data) ? res.data : (res.data?.data?.items || res.data?.data || res.data?.items || []);
              if (list.length > 0) {
                const cleanPhone = String(phone).replace(/\D/g, '');
                const matched = list.find((c: any) => {
                  const cPhone = String(c.phone || '').replace(/\D/g, '');
                  if (cleanPhone && cPhone && (cPhone.includes(cleanPhone) || cleanPhone.includes(cPhone))) return true;
                  if (email && c.email && String(c.email).toLowerCase() === String(email).toLowerCase()) return true;
                  return false;
                }) || list[0];
                if (matched && matched.id) {
                  contactId = matched.id;
                }
              }
            } catch (err) {
              console.warn('Auto contact lookup error:', err);
            }
          }

          const depositAmount = p.amount || p.deposit_amount || p.price || p.total || p.total_amount || '';

          useUIStore.getState().setShowPOS({
            id: contactId ? Number(contactId) : null,
            full_name: fullName || 'Học viên',
            phone: phone || '',
            email: email || '',
            price: depositAmount ? String(depositAmount) : '',
            notes: p.notes || p.description || 'Phiếu đặt cọc/giữ chỗ từ AI IDEAS Agent',
            projectId: p.project_id || p.course_id || p.program_id || '',
            unit_code: p.unit_code || '',
            expected_commission: p.expected_commission !== undefined ? String(p.expected_commission) : undefined,
            accountant_id: p.accountant_id ? Number(p.accountant_id) : undefined,
            participant_ids: p.participant_ids || '',
            exchange_rate: p.exchange_rate !== undefined ? Number(p.exchange_rate) : undefined,
            currency: p.currency || 'VND'
          });
          toast.success('Đã mở Phiếu Đặt Cọc / Giữ Chỗ và điền sẵn thông tin! Bạn hãy kiểm tra và bấm Lưu nhé.');
          break;
        }

        case 'task': {
          const currentUser = useAuthStore.getState().user;
          let targetUserId = p.user_id ? Number(p.user_id) : undefined;
          let targetUserName = p.assignee_name || p.user_name || undefined;

          // Smart assignee resolution if user_id is missing but a name is mentioned
          if (!targetUserId) {
            const staffList = useChatStore.getState().staffDirectory || [];
            const searchTarget = (p.assignee_name || p.assignee || p.user || '').toLowerCase().trim();
            if (searchTarget) {
              const matched = staffList.filter(s => s.full_name?.toLowerCase().includes(searchTarget));
              if (matched.length === 1) {
                targetUserId = matched[0].id;
                targetUserName = matched[0].full_name;
              }
            } else {
              // Check if subject, body or summary mentions "giao cho [Tên]"
              const fullText = `${p.subject || ''} ${p.body || ''} ${proposal.summary || ''} ${proposal.title || ''}`;
              const m = fullText.match(/giao cho\s+([a-zA-Z0-9_\u00C0-\u1EF9\s]+?)(?:\s+mai|\s+làm|\s+cập nhật|\s+hạn|\.|\,|$)/i);
              if (m && m[1]) {
                const cName = m[1].trim().toLowerCase();
                const matched = staffList.filter(s => s.full_name?.toLowerCase().includes(cName));
                if (matched.length === 1) {
                  targetUserId = matched[0].id;
                  targetUserName = matched[0].full_name;
                }
              }
            }
          }

          const targetContactId = p.contact_id || p.customer_id || p.student_id || p.lead_id || (p.related_type === 'contact' ? p.related_id : undefined);
          const targetContactName = p.contact_name || p.customer_name || p.student_name || p.lead_name || '';

          useUIStore.getState().openTaskDrawer({
            id: 'new',
            subject: p.subject || p.title || 'Công việc mới từ AI IDEAS',
            due_date: p.due_date || p.deadline || new Date().toISOString().split('T')[0],
            priority: p.priority || 'medium',
            body: p.body || p.description || '',
            user_id: targetUserId,
            user_name: targetUserName,
            assignee_name: targetUserName,
            created_by: currentUser?.id,
            created_by_id: currentUser?.id,
            created_by_name: currentUser?.full_name || 'Tôi',
            created_by_avatar: currentUser?.avatar_url,
            participant_ids: p.participant_ids || (p.collaborator_ids ? (Array.isArray(p.collaborator_ids) ? p.collaborator_ids.join(',') : String(p.collaborator_ids)) : ''),
            collaborator_ids: Array.isArray(p.collaborator_ids) ? p.collaborator_ids : (p.collaborator_ids ? String(p.collaborator_ids).split(',') : []),
            team_id: p.team_id ? Number(p.team_id) : undefined,
            contact_id: targetContactId ? Number(targetContactId) : undefined,
            contact_name: targetContactName || undefined,
            related_type: targetContactId ? 'contact' : (p.related_type || undefined),
            related_id: targetContactId ? Number(targetContactId) : (p.related_id ? Number(p.related_id) : undefined),
            from_customer_drawer: Boolean(targetContactId)
          });
          toast.success('Đã mở Công việc (Task) và điền sẵn thông tin!');
          break;
        }

        case 'lead': {
          const leadName = p.name || p.full_name || p.contact_name || '';
          window.dispatchEvent(new CustomEvent('open-quick-add-lead', {
            detail: {
              name: leadName,
              full_name: leadName,
              phone: p.phone || '',
              email: p.email || '',
              company: p.company || '',
              source: p.source || (p.is_personal ? 'ca_nhan' : ''),
              program: p.program || p.type || '',
              type: p.program || p.type || '',
              notes: p.notes || p.description || '',
              owner_id: p.owner_id || p.assigned_to || p.target_owner_id || '',
              assignee_name: p.assignee_name || p.owner_name || p.target_owner_name || '',
              distribution_mode: p.distribution_mode || (p.is_personal ? 'self_assign' : (p.owner_id || p.assigned_to || p.target_owner_id ? 'direct_assign' : '')),
              is_personal: Boolean(p.is_personal),
              bulk_leads: Array.isArray(p.bulk_leads) ? p.bulk_leads : undefined,
            }
          }));
          toast.success('Đã mở Form thêm học viên và điền sẵn thông tin!');
          break;
        }

        case 'leave': {
          const leaveDetail = {
            createLeaveType: 'leave',
            leave_type: p.leave_type || 'annual',
            start_date: p.start_date || p.from_date || new Date().toISOString().split('T')[0],
            end_date: p.end_date || p.to_date || new Date().toISOString().split('T')[0],
            total_days: Number(p.total_days) || 1,
            reason: p.reason || 'Đăng ký qua trợ lý AI IDEAS',
            _draft_created_at: Date.now()
          };
          sessionStorage.setItem('pending_leave_draft', JSON.stringify(leaveDetail));
          window.dispatchEvent(new CustomEvent('open-create-leave-modal', { detail: leaveDetail }));
          if (!window.location.pathname.startsWith('/attendance')) {
            navigate('/attendance?action=create-leave');
          }
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('open-create-leave-modal', { detail: leaveDetail }));
          }, 120);
          toast.success('Đã mở Đơn xin nghỉ phép và điền sẵn thông tin!');
          break;
        }

        case 'supplementary': {
          const suppDetail = {
            createLeaveType: 'supplementary',
            date: p.date || new Date().toISOString().split('T')[0],
            in_time: p.in_time || '08:00',
            out_time: p.out_time || '17:00',
            reason: p.reason || p.notes || 'Quên chấm công (Đề xuất qua AI IDEAS)',
            _draft_created_at: Date.now()
          };
          sessionStorage.setItem('pending_leave_draft', JSON.stringify(suppDetail));
          window.dispatchEvent(new CustomEvent('open-create-leave-modal', { detail: suppDetail }));
          if (!window.location.pathname.startsWith('/attendance')) {
            navigate('/attendance?action=create-leave');
          }
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('open-create-leave-modal', { detail: suppDetail }));
          }, 120);
          toast.success('Đã mở Đơn giải trình bổ sung công và điền sẵn thông tin!');
          break;
        }

        case 'advance_payment': {
          window.dispatchEvent(new CustomEvent('open-expense-create-drawer', {
            detail: {
              title: p.title || 'Đề nghị tạm ứng công tác',
              amount: Number(p.amount) || 0,
              category: 'advance_payment',
              notes: p.notes || p.reason || 'Tạm ứng chi phí công tác',
              approver_id: p.approver_id,
              approver_id_2: p.approver_id_2
            }
          }));
          toast.success('Đã mở Đề xuất tạm ứng và điền sẵn thông tin!');
          break;
        }

        case 'inventory_receipt': {
          const poDraft = {
            notes: p.notes || p.reason || 'Phiếu nhập kho vật tư từ AI IDEAS',
            supplier_name: p.supplier_name || 'Nhà cung cấp',
            items: p.items || [],
            _draft_created_at: Date.now()
          };
          sessionStorage.setItem('pending_po_draft', JSON.stringify(poDraft));
          if (!window.location.pathname.startsWith('/inventory')) {
            navigate('/inventory?tab=purchase_orders&create_po=1');
          } else {
            navigate('/inventory?tab=purchase_orders&create_po=1');
          }
          toast.success('Đã mở Phiếu nhập kho (PO) và điền sẵn thông tin!');
          break;
        }

        case 'shift_swap': {
          const swapDetail = {
            createLeaveType: 'overtime',
            start_date: p.date || p.start_date || new Date().toISOString().split('T')[0],
            end_date: p.date || p.end_date || new Date().toISOString().split('T')[0],
            reason: p.reason || p.notes || 'Đề xuất đổi ca trực/lịch làm việc (AI IDEAS)',
            shift_type: p.shift_type || 'weekend',
            _draft_created_at: Date.now()
          };
          sessionStorage.setItem('pending_leave_draft', JSON.stringify(swapDetail));
          window.dispatchEvent(new CustomEvent('open-create-leave-modal', { detail: swapDetail }));
          if (!window.location.pathname.startsWith('/attendance')) {
            navigate('/attendance?action=create-leave');
          }
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('open-create-leave-modal', { detail: swapDetail }));
          }, 120);
          toast.success('Đã mở Đề xuất đổi ca trực và điền sẵn thông tin!');
          break;
        }

        case 'admission_document_request': {
          const cid = p.contact_id || p.id;
          if (cid) {
            useUIStore.getState().openCustomerDrawer(Number(cid), 'docs');
            if (useChatStore.getState().isMaximized) {
              useChatStore.getState().toggleMaximize();
            }
          } else {
            navigate('/contacts');
          }
          toast.success('Đã mở Hồ sơ học viên để kiểm tra và tải tài liệu thẩm định!');
          break;
        }

        case 'legal_contract': {
          const cid = p.contact_id || p.id;
          if (cid) {
            useUIStore.getState().openCustomerDrawer(Number(cid), 'docs');
            if (useChatStore.getState().isMaximized) {
              useChatStore.getState().toggleMaximize();
            }
          } else {
            navigate('/deposits');
          }
          toast.success('Đã mở mục Quản lý Hợp đồng & Cam kết đào tạo!');
          break;
        }

        case 'asset_handover': {
          navigate('/hrm?tab=assets');
          toast.success('Đã mở phân hệ Tài sản (HRM Assets) để lập biên bản bàn giao!');
          break;
        }

        case 'marketing_campaign': {
          navigate('/marketing');
          toast.success('Đã mở phân hệ Chiến dịch & Nguồn Lead Marketing!');
          break;
        }

        case 'ticket': {
          const ticketDraft = {
            subject: p.subject || p.title || 'Hỗ trợ học viên từ AI IDEAS',
            priority: p.priority || 'medium',
            customer_name: p.customer_name || p.student_name || '',
            contact_id: p.contact_id || null,
            description: p.description || p.notes || p.body || '',
            _draft_created_at: Date.now()
          };
          sessionStorage.setItem('pending_ticket_draft', JSON.stringify(ticketDraft));
          navigate('/support-tickets?create=1');
          toast.success('Đã mở Phiếu hỗ trợ / Khiếu nại (Ticket) và điền sẵn thông tin!');
          break;
        }

        case 'quote': {
          const quoteDraft = {
            title: p.title || 'Báo giá chương trình đào tạo',
            customer_name: p.customer_name || p.contact_name || '',
            contact_id: p.contact_id || null,
            total: p.total || p.amount || 0,
            notes: p.notes || '',
            _draft_created_at: Date.now()
          };
          sessionStorage.setItem('pending_quote_draft', JSON.stringify(quoteDraft));
          navigate('/quotes?create=1');
          toast.success('Đã mở Báo giá (Quote) và điền sẵn thông tin!');
          break;
        }

        case 'deal': {
          sessionStorage.setItem('ai_draft_deal', JSON.stringify(p));
          window.dispatchEvent(new CustomEvent('open-create-deal-modal', { detail: p }));
          if (!window.location.pathname.startsWith('/deals')) {
            navigate('/deals?create=1');
          }
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('open-create-deal-modal', { detail: p }));
          }, 120);
          toast.success('Đã mở Cơ hội tuyển sinh / Deal và điền sẵn thông tin!');
          break;
        }

        case 'export_data':
        case 'export': {
          setStatus('submitting');
          const rawType = String(p.export_type || p.type || 'contact').toLowerCase();
          let expType = 'contact';
          if (['company', 'companies', 'doanh_nghiep'].includes(rawType)) {
            expType = 'company';
          } else if (['deal', 'deals', 'co_hoi', 'b2b'].includes(rawType)) {
            expType = 'deal';
          } else if (['product', 'products', 'san_pham'].includes(rawType)) {
            expType = 'product';
          } else if (['inventory', 'inventories', 'kho', 'vat_tu'].includes(rawType)) {
            expType = 'inventory';
          } else if (['asset', 'assets', 'tai_san'].includes(rawType)) {
            expType = 'asset';
          } else if (['attendance', 'attendances', 'bang_cong', 'cham_cong'].includes(rawType)) {
            expType = 'attendance';
          } else if (['expense', 'expenses', 'chi_phi', 'phieu_chi'].includes(rawType)) {
            expType = 'expense';
          } else if (['purchase_order', 'purchase_orders', 'po', 'don_mua_hang'].includes(rawType)) {
            expType = 'purchase_order';
          } else if (['deposit', 'deposits', 'phieu_thu', 'dat_coc', 'doanh_thu'].includes(rawType)) {
            expType = 'deposit';
          } else if (['sales_order', 'sales_orders', 'so', 'don_dat_hang', 'don_hang_ban'].includes(rawType)) {
            expType = 'sales_order';
          } else if (['invoice', 'invoices', 'hoa_don'].includes(rawType)) {
            expType = 'invoice';
          } else if (['quote', 'quotes', 'bao_gia'].includes(rawType)) {
            expType = 'quote';
          } else if (['supplier', 'suppliers', 'nha_cung_cap', 'vendor', 'vendors'].includes(rawType)) {
            expType = 'supplier';
          } else if (['salary_advance', 'salary_advances', 'advance', 'tam_ung', 'tam_ung_luong'].includes(rawType)) {
            expType = 'salary_advance';
          } else if (['task', 'tasks', 'cong_viec', 'nhiem_vu'].includes(rawType)) {
            expType = 'task';
          } else if (['ticket', 'tickets', 'sla', 'yeu_cau', 'ho_tro'].includes(rawType)) {
            expType = 'ticket';
          } else if (['staff', 'employee', 'employees', 'hrm', 'nhan_su', 'payroll', 'bang_luong'].includes(rawType)) {
            expType = 'staff';
          }

          toast.loading('Đang trích xuất và tải tệp Excel...', { id: 'export-action-toast' });
          const fileName = p.filename || p.file_name || `export_${expType}_${new Date().toISOString().slice(0, 10)}.csv`;

          let endpoint = '/export';
          const paramsObj: Record<string, any> = { type: expType };
          const downloadUrl = p.download_url || p.url || '';
          if (downloadUrl) {
            try {
              const urlObj = new URL(downloadUrl, window.location.origin);
              endpoint = urlObj.pathname.replace(/^\/api/, '');
              urlObj.searchParams.forEach((val, key) => {
                paramsObj[key] = val;
              });
            } catch {
              const qParts = downloadUrl.split('?');
              endpoint = qParts[0].replace(/^\/api/, '');
              if (qParts[1]) {
                const sp = new URLSearchParams(qParts[1]);
                sp.forEach((val, key) => {
                  paramsObj[key] = val;
                });
              }
            }
          } else {
            const forwardKeys = [
              'search', 'segment', 'lead_status', 'status', 'statuses', 'from', 'to',
              'owner_id', 'owners', 'team_id', 'tag', 'data_type', 'student_sub_tab',
              'multi_program', 'export_mode', 'limit', 'stages', 'gender', 'program',
              'programs', 'source', 'sources', 'city', 'branches_or_cities',
              'financial_filter', 'min_deposit', 'stale_days',
              'interaction_status', 'date_field', 'departments', 'department_or_team', 'category',
              'period', 'min_amount', 'max_amount', 'overdue_only',
              'milestone_status', 'priorities', 'close_date_status', 'min_value', 'max_value',
              'unit_code', 'vendor_name', 'approval_filter', 'subtask_filter', 'custom_rules'
            ];
            forwardKeys.forEach((k) => {
              if (p[k] !== undefined && p[k] !== null && p[k] !== '') {
                paramsObj[k] = typeof p[k] === 'object' ? JSON.stringify(p[k]) : String(p[k]);
              }
            });
          }

          // Ensure normalized type
          paramsObj.type = expType;

          await downloadExportFile({
            endpoint,
            params: paramsObj,
            defaultFilename: fileName,
            onSuccess: () => {
              toast.success('Đã tải tệp Excel thành công!', { id: 'export-action-toast' });
            },
            onError: (err: any) => {
              const errTxt = err?.message || 'Không thể tải file xuất dữ liệu';
              toast.error(errTxt, { id: 'export-action-toast' });
            }
          });
          break;
        }

        default:
          throw new Error('Loại hành động không được hỗ trợ: ' + proposal.action_type);
      }

      if (proposal.action_type === 'export_data' || proposal.action_type === 'export') {
        setStatus('success');
      } else if (
        proposal.action_type === 'expense' ||
        proposal.action_type === 'task' ||
        ((proposal.action_type === 'admission_document_request' || proposal.action_type === 'legal_contract') && (p.contact_id || p.id))
      ) {
        // Global Drawer — dock Chat instead of minimizing completely
        const chatState = useChatStore.getState();
        if (chatState.isMaximized) {
          chatState.toggleMaximize();
        }
        if (proposal.action_type === 'expense') {
          toast('Đã mở phiếu chi bên cạnh cửa sổ Chat để bạn đối chiếu và lưu.', { icon: 'ℹ️' });
        }
      } else {
        // Page-level modals (Leave, Task, Contact, Deposit on page): minimize Chat Modal so the opened Modal in ERP is immediately visible
        useChatStore.getState().minimizeChat();
        toast('Đã mở form và thu nhỏ cửa sổ Chat để bạn dễ thao tác.', { icon: 'ℹ️' });
      }

      if (onExecuted) {
        onExecuted(proposal.action_type, proposal.params);
      }
    } catch (err: any) {
      console.error('Open & Prefill Error:', err);
      const msg = err.response?.data?.message || err.message || 'Lỗi khi mở phiếu đề xuất';
      setErrorMsg(msg);
      setStatus('error');
      toast.error(msg, { id: 'export-action-toast' });
    } finally {
      inFlightRef.current = false;
    }
  };

  const handleCancel = () => {
    setStatus('cancelled');
    toast('Đã hủy đề xuất khởi tạo.', { icon: 'ℹ️' });
  };

  const currentUser = useAuthStore((s) => s.user);

  const getCardTheme = () => {
    switch (proposal.action_type) {
      case 'export_data':
      case 'export':
        return {
          bg: '#f5f3ff',
          text: '#6d28d9',
          border: '#ddd6fe',
          accent: '#7c3aed',
          label: 'XUẤT DỮ LIỆU',
          icon: <FileSpreadsheet size={13} color="#7c3aed" />
        };
      case 'task':
        return {
          bg: '#eff6ff',
          text: '#1d4ed8',
          border: '#bfdbfe',
          accent: '#2563eb',
          label: 'CÔNG VIỆC',
          icon: <CheckSquare size={13} color="#2563eb" />
        };
      case 'sales_order':
        return {
          bg: '#ecfdf5',
          text: '#047857',
          border: '#a7f3d0',
          accent: '#059669',
          label: 'ĐƠN HÀNG (SO)',
          icon: <FileText size={13} color="#059669" />
        };
      case 'deposit':
        return {
          bg: '#ecfdf5',
          text: '#047857',
          border: '#a7f3d0',
          accent: '#059669',
          label: 'ĐẶT CỌC',
          icon: <DollarSign size={13} color="#059669" />
        };
      case 'lead':
        return {
          bg: '#f0f9ff',
          text: '#0369a1',
          border: '#bae6fd',
          accent: '#0284c7',
          label: 'KHÁCH HÀNG CRM',
          icon: <User size={13} color="#0284c7" />
        };
      case 'inventory_receipt':
        return {
          bg: '#fffbeb',
          text: '#b45309',
          border: '#fde68a',
          accent: '#d97706',
          label: 'KHO VẬT TƯ',
          icon: <Package size={13} color="#d97706" />
        };
      case 'asset_handover':
        return {
          bg: '#fffbeb',
          text: '#b45309',
          border: '#fde68a',
          accent: '#d97706',
          label: 'TÀI SẢN',
          icon: <Package size={13} color="#d97706" />
        };
      case 'marketing_campaign':
        return {
          bg: '#fdf2f8',
          text: '#be185d',
          border: '#fbcfe8',
          accent: '#db2777',
          label: 'MARKETING',
          icon: <Sparkles size={13} color="#db2777" />
        };
      case 'ticket':
        return {
          bg: '#fef2f2',
          text: '#dc2626',
          border: '#fecaca',
          accent: '#ef4444',
          label: 'TICKET CSKH',
          icon: <AlertCircle size={13} color="#ef4444" />
        };
      case 'quote':
        return {
          bg: '#f0f9ff',
          text: '#0369a1',
          border: '#bae6fd',
          accent: '#0284c7',
          label: 'BÁO GIÁ',
          icon: <FileText size={13} color="#0284c7" />
        };
      case 'deal':
        return {
          bg: '#fdf4ff',
          text: '#a21caf',
          border: '#f5d0fe',
          accent: '#c026d3',
          label: 'DEAL CRM',
          icon: <Sparkles size={13} color="#c026d3" />
        };
      case 'leave':
      case 'expense':
      case 'advance_payment':
      case 'supplementary':
      case 'shift_swap':
      case 'admission_document_request':
      case 'legal_contract':
      default:
        return {
          bg: '#f5f3ff',
          text: '#6d28d9',
          border: '#ddd6fe',
          accent: '#7c3aed',
          label: 'QUY TRÌNH',
          icon: <ClipboardList size={13} color="#7c3aed" />
        };
    }
  };

  const getStatusBadge = () => {
    if (status === 'submitting') {
      return { label: 'Đang xử lý...', bg: '#eff6ff', text: '#1d4ed8' };
    }
    if (status === 'success') {
      if (proposal.action_type === 'export_data' || proposal.action_type === 'export') {
        return { label: 'Đã tải xong', bg: '#ecfdf5', text: '#047857' };
      }
      return { label: resultId ? `Đã tạo #${resultId}` : 'Đã mở phiếu', bg: '#ecfdf5', text: '#047857' };
    }
    if (status === 'cancelled') {
      return { label: 'Đã hủy', bg: '#f1f5f9', text: '#64748b' };
    }
    if (status === 'error') {
      return { label: 'Lỗi', bg: '#fef2f2', text: '#dc2626' };
    }
    // Idle
    if (proposal.action_type === 'export_data' || proposal.action_type === 'export') {
      return { label: 'Sẵn sàng tải', bg: '#ecfdf5', text: '#047857' };
    }
    return { label: 'Chờ duyệt', bg: '#fffbeb', text: '#b45309' };
  };

  const theme = getCardTheme();
  const statBadge = getStatusBadge();
  const p = proposal.params || {};

  const senderName = p.created_by_name || p.creator_name || currentUser?.full_name || 'Người dùng';
  const senderAvatar = p.created_by_avatar || p.creator_avatar || currentUser?.avatar_url || '';
  const createdAtStr = p.created_at || (proposal as any).created_at || '';

  const leadAssigneeName = p.assignee_name || p.owner_name || p.target_owner_name || null;
  const approverOrAssigneeName = p.approver_name || leadAssigneeName || p.user_name || (p.approver_id ? `Người duyệt #${p.approver_id}` : null);
  const approverAvatar = p.approver_avatar || p.assignee_avatar || '';
  const approverLabel = proposal.action_type === 'lead'
    ? 'Giao cho Sale'
    : p.approver_name
      ? 'Người duyệt'
      : (p.assignee_name || p.user_name ? 'Người thực hiện' : 'Người duyệt');

  let summaryRowText = '';
  if (proposal.action_type === 'expense' || proposal.action_type === 'advance_payment') {
    summaryRowText = `[Hồ sơ chi phí]: Danh mục: ${p.category || 'Khác'}${p.amount ? ` • ${Number(p.amount).toLocaleString('vi-VN')} đ` : ''}`;
  } else if (proposal.action_type === 'export_data' || proposal.action_type === 'export') {
    summaryRowText = `[Bộ lọc dữ liệu]: ${p.filters_summary || proposal.summary || 'Toàn bộ dữ liệu phù hợp'}`;
  } else if (proposal.action_type === 'task') {
    summaryRowText = `[Công việc]: ${p.priority ? `Ưu tiên: ${p.priority}` : ''}${p.due_date ? ` • Hạn: ${new Date(p.due_date).toLocaleDateString('vi-VN')}` : ''}`;
  } else if (proposal.action_type === 'leave') {
    summaryRowText = `[Nghỉ phép]: ${p.leave_type || 'Phép'}${p.total_days ? ` • ${p.total_days} ngày` : ''}${p.reason ? ` • Lý do: ${p.reason}` : ''}`;
  } else if (proposal.action_type === 'sales_order' || proposal.action_type === 'deposit') {
    summaryRowText = `[Đơn hàng]: ${p.customer_name ? `KH: ${p.customer_name}` : ''}${p.total_amount ? ` • ${Number(p.total_amount).toLocaleString('vi-VN')} đ` : ''}`;
  } else if (proposal.action_type === 'ticket') {
    summaryRowText = `[Ticket CSKH]: ${p.customer_name ? `Học viên: ${p.customer_name} • ` : ''}Ưu tiên: ${p.priority || 'Trung bình'}`;
  } else if (proposal.action_type === 'quote') {
    summaryRowText = `[Báo giá]: ${p.customer_name ? `KH: ${p.customer_name} • ` : ''}${p.total ? `${Number(p.total).toLocaleString('vi-VN')} đ` : ''}`;
  } else if (proposal.action_type === 'deal') {
    summaryRowText = `[Deal]: ${p.title || 'Cơ hội chốt tuyển sinh'}${p.value ? ` • ${Number(p.value).toLocaleString('vi-VN')} đ` : ''}`;
  } else if (proposal.action_type === 'lead') {
    const leadParts: string[] = [];
    const leadFullName = p.name || p.full_name || p.contact_name;
    if (leadFullName) leadParts.push(`KH: ${leadFullName}`);
    if (p.phone) leadParts.push(`SĐT: ${p.phone}`);
    if (p.program || p.type) leadParts.push(`Chương trình: ${p.program || p.type}`);
    if (p.is_personal || p.source === 'ca_nhan') leadParts.push('Phân loại: Data cá nhân');
    else if (p.source) leadParts.push(`Nguồn: ${p.source}`);
    summaryRowText = leadParts.length > 0 ? leadParts.join(' • ') : (proposal.summary ? `[Chi tiết]: ${proposal.summary}` : '');
  } else if (proposal.summary) {
    summaryRowText = `[Chi tiết]: ${proposal.summary}`;
  }

  const idTag = p.id || p.code || p.entity_id || (String(messageId).replace(/\D/g, '').slice(-4) || '1685');

  const getButtonContent = () => {
    if (status === 'submitting') {
      return (
        <>
          <Loader2 size={13} className="animate-spin" />
          <span>Đang xử lý...</span>
        </>
      );
    }
    if (status === 'success') {
      return (
        <>
          <Check size={13} />
          <span>Đã hoàn thành {resultId ? `#${resultId}` : ''}</span>
        </>
      );
    }
    if (status === 'cancelled') {
      return (
        <>
          <X size={13} />
          <span>Đã hủy đề xuất</span>
        </>
      );
    }
    if (proposal.action_type === 'export_data' || proposal.action_type === 'export') {
      return (
        <>
          <Download size={13} />
          <span>Tải tệp Excel ngay {p.estimated_count ? `(${p.estimated_count} dòng)` : ''}</span>
        </>
      );
    }
    if (proposal.action_type === 'task') {
      return (
        <>
          <CheckSquare size={13} />
          <span>Mở Task & Điền sẵn thông tin</span>
        </>
      );
    }
    if (proposal.action_type === 'lead') {
      return (
        <>
          <User size={13} />
          <span>Mở Form Thêm Lead & Điền sẵn</span>
        </>
      );
    }
    return (
      <>
        <ExternalLink size={13} />
        <span>Xem chi tiết quy trình</span>
      </>
    );
  };

  return (
    <div
      onClick={handleOpenAndPrefill}
      style={{
        marginTop: '8px',
        marginBottom: '6px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '10px 12px',
        boxShadow: '0 3px 10px rgba(0, 0, 0, 0.06)',
        minWidth: '240px',
        maxWidth: '300px',
        color: '#0f172a',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.15s ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 5px 14px rgba(0, 0, 0, 0.09)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 3px 10px rgba(0, 0, 0, 0.06)';
        e.currentTarget.style.transform = 'none';
      }}
    >
      {/* Top Header Tags */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.62rem',
            fontWeight: 700,
            padding: '1.5px 6px',
            borderRadius: '4px',
            background: theme.bg,
            color: theme.text,
            border: 'none',
            whiteSpace: 'nowrap'
          }}>
            {theme.icon}
            <span>{theme.label}</span>
          </div>
          {statBadge && (
            <span style={{
              fontSize: '0.62rem',
              fontWeight: 700,
              padding: '1.5px 5px',
              borderRadius: '4px',
              background: statBadge.bg,
              color: statBadge.text,
              whiteSpace: 'nowrap'
            }}>
              {statBadge.label}
            </span>
          )}
        </div>
        <span style={{ fontSize: '0.64rem', color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>
          #{idTag}
        </span>
      </div>

      {/* Card Title */}
      <div style={{
        fontWeight: 700,
        fontSize: '0.80rem',
        color: '#0f172a',
        lineHeight: 1.3,
        marginBottom: '6px'
      }}>
        {proposal.title || 'Đề xuất Khởi tạo Quy trình'}
      </div>

      {/* Metadata rows */}
      <div style={{ fontSize: '0.74rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '8px' }}>
        {/* Row 1: Sender */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Avatar src={senderAvatar} name={senderName} size={18} />
          <span>
            Người gửi: <strong style={{ color: '#334155' }}>{senderName}</strong> {createdAtStr ? <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>({createdAtStr})</span> : ''}
          </span>
        </div>

        {/* Row 2: Approver / Assignee */}
        {approverOrAssigneeName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Avatar src={approverAvatar} name={approverOrAssigneeName} size={18} />
            <span>
              {approverLabel}: <strong style={{ color: '#334155' }}>{approverOrAssigneeName}</strong>
            </span>
          </div>
        )}

        {/* Lead-specific Program / Personal badges */}
        {proposal.action_type === 'lead' && (p.program || p.type) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#64748b' }}>Chương trình: <strong style={{ color: '#334155' }}>{p.program || p.type}</strong></span>
          </div>
        )}
        {proposal.action_type === 'lead' && (p.is_personal || p.source === 'ca_nhan') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#64748b' }}>Phân loại: <strong style={{ color: '#0284c7' }}>Data cá nhân</strong></span>
          </div>
        )}

        {/* Row 3: Summary / Filter details */}
        {summaryRowText && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={13} color="#64748b" style={{ flexShrink: 0 }} />
            <span style={{ wordBreak: 'break-word', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {summaryRowText}
            </span>
          </div>
        )}
      </div>

      {/* Error message if any */}
      {errorMsg && (
        <div style={{
          marginBottom: '6px',
          padding: '4px 8px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '5px',
          color: '#991b1b',
          fontSize: '0.70rem',
          display: 'flex',
          alignItems: 'center',
          gap: '5px'
        }}>
          <AlertCircle size={12} className="flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Action Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {status === 'idle' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleCancel();
            }}
            title="Hủy bỏ"
            style={{
              padding: '6px 8px',
              borderRadius: '7px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = '#f8fafc'; }}
          >
            <X size={12} />
          </button>
        )}
        <button
          type="button"
          disabled={status === 'submitting' || status === 'success' || status === 'cancelled'}
          onClick={(e) => {
            e.stopPropagation();
            handleOpenAndPrefill();
          }}
          style={{
            flex: 1,
            padding: '6px 10px',
            borderRadius: '7px',
            border: 'none',
            background: status === 'success' ? '#10b981' : (status === 'cancelled' ? '#94a3b8' : theme.accent),
            color: '#ffffff',
            fontSize: '0.74rem',
            fontWeight: 700,
            cursor: (status === 'submitting' || status === 'success' || status === 'cancelled') ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            boxShadow: status === 'success' ? '0 1.5px 5px rgba(16, 185, 129, 0.3)' : `0 1.5px 5px ${theme.border}`,
            transition: 'opacity 0.15s ease'
          }}
          onMouseEnter={(e) => { if (status === 'idle') e.currentTarget.style.opacity = '0.9'; }}
          onMouseLeave={(e) => { if (status === 'idle') e.currentTarget.style.opacity = '1'; }}
        >
          {getButtonContent()}
        </button>
      </div>
    </div>
  );
};
