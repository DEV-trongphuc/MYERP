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
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { Avatar } from '../ui/Avatar';

export interface ActionProposal {
  action_type: 'leave' | 'expense' | 'task' | 'lead' | 'sales_order' | 'deposit' | 'supplementary' | 'advance_payment' | 'inventory_receipt' | 'shift_swap' | 'admission_document_request' | 'legal_contract' | 'asset_handover' | 'marketing_campaign' | 'export_data' | 'export' | (string & {});
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

  const handleOpenAndPrefill = async () => {
    if (inFlightRef.current || status !== 'idle') return;
    inFlightRef.current = true;
    setErrorMsg('');

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
            collaborator_ids: Array.isArray(p.collaborator_ids) ? p.collaborator_ids : (p.collaborator_ids ? String(p.collaborator_ids).split(',') : []),
            team_id: p.team_id ? Number(p.team_id) : undefined
          });
          toast.success('Đã mở Công việc (Task) và điền sẵn thông tin!');
          break;
        }

        case 'lead': {
          window.dispatchEvent(new CustomEvent('open-quick-add-lead', {
            detail: {
              full_name: p.name || p.full_name || '',
              phone: p.phone || '',
              email: p.email || '',
              source: p.source || 'AI IDEAS Super Intelligent',
              notes: p.notes || ''
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
            reason: p.reason || 'Đăng ký qua trợ lý AI IDEAS'
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
            reason: p.reason || p.notes || 'Quên chấm công (Đề xuất qua AI IDEAS)'
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
            items: p.items || []
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
            shift_type: p.shift_type || 'weekend'
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
            navigate(`/contacts?id=${cid}&tab=documents`);
          } else {
            navigate('/contacts');
          }
          toast.success('Đã chuyển đến Hồ sơ học viên để kiểm tra và tải tài liệu thẩm định!');
          break;
        }

        case 'legal_contract': {
          const cid = p.contact_id || p.id;
          if (cid) {
            navigate(`/contacts?id=${cid}&tab=contracts`);
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

        case 'export_data':
        case 'export': {
          setStatus('submitting');
          const expType = p.export_type || p.type || 'contact';
          let downloadUrl = p.download_url || p.url || '';
          if (!downloadUrl) {
            const paramsObj: Record<string, string> = { type: expType };
            if (p.search) paramsObj.search = p.search;
            if (p.segment) paramsObj.segment = p.segment;
            if (p.lead_status) paramsObj.lead_status = p.lead_status;
            if (p.status) paramsObj.status = p.status;
            if (p.from) paramsObj.from = p.from;
            if (p.to) paramsObj.to = p.to;
            if (p.owner_id) paramsObj.owner_id = p.owner_id;
            if (p.team_id) paramsObj.team_id = p.team_id;
            if (p.tag) paramsObj.tag = p.tag;
            const qs = new URLSearchParams(paramsObj).toString();
            downloadUrl = `/export?${qs}`;
          }

          toast.loading('Đang trích xuất và tải tệp Excel...', { id: 'export-action-toast' });
          const fileName = p.filename || p.file_name || `export_${expType}_${new Date().toISOString().slice(0, 10)}.csv`;

          const res = await api.get(downloadUrl, { responseType: 'blob' });
          const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.setAttribute('download', fileName);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(blobUrl);

          toast.success('Đã tải tệp Excel thành công!', { id: 'export-action-toast' });
          break;
        }

        default:
          throw new Error('Loại hành động không được hỗ trợ: ' + proposal.action_type);
      }

      setStatus('success');
      if (onExecuted) {
        onExecuted(proposal.action_type, proposal.params);
      }
    } catch (err: any) {
      console.error('Open & Prefill Error:', err);
      const msg = err.message || 'Lỗi khi mở phiếu đề xuất';
      setErrorMsg(msg);
      setStatus('error');
      toast.error(msg);
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

  const approverOrAssigneeName = p.approver_name || p.assignee_name || p.user_name || (p.approver_id ? `Người duyệt #${p.approver_id}` : null);
  const approverAvatar = p.approver_avatar || p.assignee_avatar || '';
  const approverLabel = p.approver_name ? 'Người duyệt' : (p.assignee_name || p.user_name ? 'Người thực hiện' : 'Người duyệt');

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
        border: `1px solid ${theme.border}`,
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
            border: `1px solid ${theme.border}`,
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
          disabled={status === 'submitting'}
          onClick={(e) => {
            e.stopPropagation();
            handleOpenAndPrefill();
          }}
          style={{
            flex: 1,
            padding: '6px 10px',
            borderRadius: '7px',
            border: 'none',
            background: theme.accent,
            color: '#ffffff',
            fontSize: '0.74rem',
            fontWeight: 700,
            cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            boxShadow: `0 1.5px 5px ${theme.border}`,
            transition: 'opacity 0.15s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          {getButtonContent()}
        </button>
      </div>
    </div>
  );
};
