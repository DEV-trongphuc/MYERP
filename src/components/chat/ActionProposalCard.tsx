import React, { useState, useRef } from 'react';
import { 
  Sparkles, Check, X, Loader2, Calendar, DollarSign, 
  CheckSquare, User, ArrowRight, ExternalLink, AlertCircle, Clock,
  Package, RefreshCw, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useUIStore } from '../../store/uiStore';

export interface ActionProposal {
  action_type: 'leave' | 'expense' | 'task' | 'lead' | 'sales_order' | 'supplementary' | 'advance_payment' | 'inventory_receipt' | 'shift_swap' | 'admission_document_request' | 'legal_contract' | 'asset_handover' | 'marketing_campaign';
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

        case 'task': {
          useUIStore.getState().openTaskDrawer({
            id: 0,
            subject: p.subject || p.title || 'Công việc mới từ AI IDEAS',
            due_date: p.due_date || p.deadline || new Date().toISOString().split('T')[0],
            priority: p.priority || 'medium',
            body: p.body || p.description || '',
            user_id: p.user_id ? Number(p.user_id) : undefined
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

  // Icon mapping
  const getActionIcon = () => {
    switch (proposal.action_type) {
      case 'leave':
        return <Calendar className="w-5 h-5 text-[#BD1D2D]" />;
      case 'supplementary':
        return <Clock className="w-5 h-5 text-amber-600" />;
      case 'expense':
        return <DollarSign className="w-5 h-5 text-emerald-600" />;
      case 'advance_payment':
        return <DollarSign className="w-5 h-5 text-indigo-600" />;
      case 'inventory_receipt':
        return <Package className="w-5 h-5 text-amber-600" />;
      case 'shift_swap':
        return <RefreshCw className="w-5 h-5 text-blue-600" />;
      case 'task':
        return <CheckSquare className="w-5 h-5 text-indigo-600" />;
      case 'lead':
        return <User className="w-5 h-5 text-amber-600" />;
      case 'sales_order':
        return <DollarSign className="w-5 h-5 text-[#BD1D2D]" />;
      case 'admission_document_request':
        return <FileText className="w-5 h-5 text-amber-700" />;
      case 'legal_contract':
        return <FileText className="w-5 h-5 text-indigo-700" />;
      case 'asset_handover':
        return <Package className="w-5 h-5 text-orange-600" />;
      case 'marketing_campaign':
        return <Sparkles className="w-5 h-5 text-pink-600" />;
      default:
        return <Sparkles className="w-5 h-5 text-[#BD1D2D]" />;
    }
  };

  // Format parameter labels
  const formatParamKey = (k: string) => {
    const map: Record<string, string> = {
      leave_type: 'Loại nghỉ',
      start_date: 'Từ ngày',
      end_date: 'Đến ngày',
      total_days: 'Số ngày',
      reason: 'Lý do',
      title: 'Tiêu đề',
      amount: 'Số tiền',
      total: 'Tổng giá trị',
      total_amount: 'Tổng số tiền',
      total_amount_VND: 'Tổng số tiền (VND)',
      total_amount_vnd: 'Tổng số tiền (VND)',
      currency: 'Loại tiền tệ',
      price: 'Số tiền',
      category: 'Hạng mục chi',
      vendor_name: 'Đơn vị thụ hưởng',
      supplier_name: 'Nhà cung cấp',
      notes: 'Ghi chú',
      date: 'Ngày',
      in_time: 'Giờ vào',
      out_time: 'Giờ ra',
      order_date: 'Ngày tạo đơn',
      terms: 'Lịch thanh toán',
      installments: 'Lịch trình thanh toán',
      milestones: 'Lịch trình thanh toán',
      items: 'Danh sách đợt/mục',
      subject: 'Tên việc',
      due_date: 'Hạn chót',
      priority: 'Ưu tiên',
      body: 'Nội dung',
      name: 'Họ tên',
      full_name: 'Họ tên',
      customer_name: 'Học viên / Khách hàng',
      contact_name: 'Học viên / Khách hàng',
      contact_phone: 'SĐT khách hàng',
      contact_email: 'Email khách hàng',
      phone: 'SĐT',
      email: 'Email',
      source: 'Nguồn',
      approver_id: 'Người duyệt',
      approver_id_2: 'Duyệt cấp 2'
    };
    return map[k] || k;
  };

  const formatParamValue = (k: string, v: any): React.ReactNode => {
    if (v === null || v === undefined || v === '') return '—';

    // 1. Array of installments/items/milestones
    if (Array.isArray(v)) {
      if (v.length === 0) return 'Chưa thiết lập';
      if (typeof v[0] === 'object' && v[0] !== null) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '3px' }}>
            <span style={{ fontWeight: 700, color: '#BD1D2D' }}>
              {v.length} đợt thanh toán:
            </span>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
              maxHeight: '140px',
              overflowY: 'auto',
              background: '#f8fafc',
              padding: '6px 8px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              fontSize: '0.72rem'
            }}>
              {v.map((item: any, idx: number) => {
                const name = item.name || item.title || item.label || `Đợt ${idx + 1}`;
                const amt = item.amount || item.unit_price || item.price || 0;
                const amtStr = Number(amt) > 0 ? Number(amt).toLocaleString('vi-VN') + ' đ' : (amt ? String(amt) : '0 đ');
                const date = item.date || item.expected_pay_date || item.pay_date || '';
                return (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#334155' }}>• {name} {date ? `(${date})` : ''}</span>
                    <span style={{ fontWeight: 650, color: '#0f172a', whiteSpace: 'nowrap' }}>{amtStr}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }
      return v.join(', ');
    }

    // 2. Object handling
    if (typeof v === 'object') {
      try {
        return JSON.stringify(v);
      } catch {
        return '—';
      }
    }

    // 3. Amount / Currency formatting
    const kLower = k.toLowerCase();
    if (kLower.includes('amount') || kLower.includes('price') || kLower.includes('total')) {
      const num = Number(v);
      if (!isNaN(num) && num > 0) {
        return num.toLocaleString('vi-VN') + ' đ';
      }
    }

    if (k === 'total_days') {
      return `${v} ngày`;
    }
    if (k === 'leave_type') {
      const typeMap: Record<string, string> = {
        annual: 'Phép năm',
        remote_work: 'Làm từ xa (WFH)',
        overtime: 'Làm thêm giờ (OT)',
        unpaid: 'Nghỉ không lương',
        sick: 'Nghỉ ốm',
        late_early: 'Đi muộn / về sớm',
        special_paid: 'Việc riêng có lương'
      };
      return typeMap[v] || v;
    }
    if (k === 'priority') {
      const pMap: Record<string, string> = {
        urgent: 'Khẩn cấp 🔴',
        high: 'Cao 🟠',
        medium: 'Bình thường 🔵',
        low: 'Thấp ⚪'
      };
      return pMap[v] || v;
    }
    return String(v);
  };

  return (
    <div style={{
      marginTop: '10px',
      marginBottom: '6px',
      background: '#ffffff',
      border: '1.5px solid #fecaca',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 4px 14px rgba(189, 29, 45, 0.08)',
      maxWidth: '480px',
      fontFamily: 'inherit'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        background: '#fff5f5',
        borderBottom: '1px solid #fee2e2'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            background: '#ffffff',
            padding: '5px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {getActionIcon()}
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#991b1b' }}>
              {proposal.title || 'Đề xuất Khởi tạo Quy trình'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
              Hệ thống ERP • AI IDEAS Super Intelligent
            </div>
          </div>
        </div>

        {/* Status Badge */}
        {status === 'idle' && (
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 650,
            background: '#fef3c7',
            color: '#b45309',
            padding: '2px 8px',
            borderRadius: '10px',
            border: '1px solid #fde68a'
          }}>
            Chờ xác nhận
          </span>
        )}
        {status === 'submitting' && (
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 650,
            background: '#eff6ff',
            color: '#1d4ed8',
            padding: '2px 8px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <Loader2 className="w-3 h-3 animate-spin" /> Đang tạo...
          </span>
        )}
        {status === 'success' && (
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            background: '#dcfce7',
            color: '#15803d',
            padding: '2px 8px',
            borderRadius: '10px',
            border: '1px solid #bbf7d0',
            display: 'flex',
            alignItems: 'center',
            gap: '3px'
          }}>
            <Check className="w-3 h-3" /> Đã tạo #{resultId}
          </span>
        )}
        {status === 'cancelled' && (
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            background: '#f1f5f9',
            color: '#64748b',
            padding: '2px 8px',
            borderRadius: '10px'
          }}>
            Đã hủy
          </span>
        )}
        {status === 'error' && (
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            background: '#fee2e2',
            color: '#b91c1c',
            padding: '2px 8px',
            borderRadius: '10px'
          }}>
            Lỗi
          </span>
        )}
      </div>

      {/* Summary Banner */}
      {proposal.summary && (
        <div style={{
          padding: '8px 14px',
          background: '#fafafa',
          borderBottom: '1px dashed #e2e8f0',
          fontSize: '0.78rem',
          color: '#334155',
          lineHeight: '1.4'
        }}>
          <strong>Tóm tắt:</strong> {proposal.summary}
        </div>
      )}

      {/* Structured Parameters Grid */}
      <div style={{ padding: '10px 14px', fontSize: '0.75rem' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '6px 12px'
        }}>
          {Object.entries(proposal.params || {}).map(([key, val]) => {
            const isFullWidth = key === 'installments' || key === 'milestones' || key === 'items' || key === 'notes' || key === 'body' || key === 'reason';
            return (
              <div 
                key={key} 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  gridColumn: isFullWidth ? 'span 2' : 'auto'
                }}
              >
                <span style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 500 }}>
                  {formatParamKey(key)}
                </span>
                <span style={{ color: '#0f172a', fontWeight: 600, wordBreak: 'break-word' }}>
                  {formatParamValue(key, val)}
                </span>
              </div>
            );
          })}
        </div>

        {errorMsg && (
          <div style={{
            marginTop: '8px',
            padding: '6px 10px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#991b1b',
            fontSize: '0.72rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div style={{
        padding: '10px 14px',
        background: '#f8fafc',
        borderTop: '1px solid #f1f5f9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '8px'
      }}>
        {status === 'idle' && (
          <>
            <button
              onClick={handleCancel}
              style={{
                padding: '6px 12px',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#64748b',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '7px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
            >
              <X className="w-3.5 h-3.5" /> Hủy
            </button>

            <button
              onClick={handleOpenAndPrefill}
              style={{
                padding: '6px 14px',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#ffffff',
                background: 'linear-gradient(135deg, #BD1D2D 0%, #991b1b 100%)',
                border: 'none',
                borderRadius: '7px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 2px 6px rgba(189, 29, 45, 0.3)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>Mở phiếu & Điền sẵn thông tin</span>
            </button>
          </>
        )}

        {status === 'submitting' && (
          <div style={{
            fontSize: '0.75rem',
            color: '#1d4ed8',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Loader2 className="w-4 h-4 animate-spin text-[#BD1D2D]" />
            <span>Đang mở phiếu và nạp dữ liệu...</span>
          </div>
        )}

        {status === 'success' && (
          <div style={{
            fontSize: '0.75rem',
            color: '#15803d',
            fontWeight: 650,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Check className="w-4 h-4 text-emerald-600" />
            <span>Đã chuyển dữ liệu vào phiếu để bạn kiểm tra & lưu</span>
          </div>
        )}

        {status === 'cancelled' && (
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
            Đề xuất đã bị hủy
          </div>
        )}

        {status === 'error' && (
          <button
            onClick={handleOpenAndPrefill}
            style={{
              padding: '5px 12px',
              fontSize: '0.72rem',
              fontWeight: 650,
              color: '#b91c1c',
              background: '#ffffff',
              border: '1px solid #f87171',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Thử lại
          </button>
        )}
      </div>
    </div>
  );
};
