
import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, Gift, Zap, Info, Cake, Tag, Users, RefreshCw, Send, PartyPopper, Ghost, Crown, UserPlus, Snowflake, Check, List, FileInput, Layers, ListPlus, ShoppingCart, Plug, FileSpreadsheet, BellRing, Calendar, MessageSquare, UserMinus, Ticket, Bot, ClipboardList } from 'lucide-react';
import Modal from '../../common/Modal';
import Button from '../../common/Button';
import Input from '../../common/Input';

interface FlowCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (flowData: any) => void;
  initialTemplateId?: string;
  initialCampaignId?: string;
  initialFlowName?: string;
}

const FLOW_TEMPLATES = [
  {
    id: 'ai_chatbot_lead',
    name: 'Lead từ AI Chatbot',
    desc: 'Kích hoạt ngay khi Bot AI Chatbot hoặc Auto-fill Website capture thông tin Lead (Email/SDT).',
    icon: Bot,
    theme: 'rose', // Đỏ đô sáng
    gradient: 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi có Lead từ AI', iconName: 'zap', config: { type: 'ai_capture', targetId: '' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email Chào Mừng', iconName: 'mail', config: { subject: 'Tài liệu bạn yêu cầu từ AI của chúng tôi! 🚀' } }
    ]
  },
  {
    id: 'welcome_segment',
    name: 'Phân khúc động (Smart)',
    desc: 'Tự động chạy khi Khách hàng thỏa mãn bộ lọc (VD: VIP, Mới mua hàng).',
    icon: Layers,
    theme: 'orange',
    gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi vào Phân khúc', iconName: 'zap', config: { type: 'segment', targetSubtype: 'segment', targetId: '' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email Chăm sóc Phân khúc', iconName: 'mail', config: { subject: 'Chào mừng bạn đến với nhóm đặc quyền! ✨' } }
    ]
  },
  {
    id: 'welcome_list',
    name: 'Gia nhập Danh sách',
    desc: 'Kích hoạt khi Khách hàng được thêm vào một danh sách tĩnh (VD: Import, API).',
    icon: ListPlus,
    theme: 'indigo',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi vào Danh sách', iconName: 'zap', config: { type: 'segment', targetSubtype: 'list', targetId: '' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email Chào mừng', iconName: 'mail', config: { subject: 'Cảm ơn bạn đã tham gia cộng đồng! 👋' } }
    ]
  },
  {
    id: 'purchase_success',
    name: 'Cảm ơn Mua hàng',
    desc: 'Gửi thư cảm ơn xác nhận ngay khi Khách hàng phát sinh đơn hàng mới.',
    icon: ShoppingCart,
    theme: 'pink',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi Mua hàng', iconName: 'zap', config: { type: 'purchase', targetId: '' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email Cảm ơn', iconName: 'mail', config: { subject: 'Xác nhận đơn hàng thành công! 🛍️' } }
    ]
  },
  {
    id: 'custom_event_flow',
    name: 'Sự kiện Tùy chỉnh',
    desc: 'Kích hoạt khi nhận được một API Event bất kỳ (VD: Click Banner, App Login).',
    icon: Zap,
    theme: 'violet',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi có Custom Event', iconName: 'zap', config: { type: 'custom_event', targetId: '' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email Phản hồi', iconName: 'mail', config: { subject: 'Chúng tôi nhận được tương tác của bạn! 🚀' } }
    ]
  },
  {
    id: 'tag_added',
    name: 'Khi được gắn Tag',
    desc: 'Kích hoạt ngay khi hồ sơ Khách hàng được gắn một nhãn cụ thể.',
    icon: Tag,
    theme: 'emerald',
    gradient: 'linear-gradient(135deg, #10b981 0%, #0d9488 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi được gắn nhãn', iconName: 'zap', config: { type: 'tag', targetId: '' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email Phản hồi Tag', iconName: 'mail', config: { subject: 'Bạn vừa nhận được nhãn mới! Xem ngay ưu đãi' } }
    ]
  },
  {
    id: 'welcome_form',
    name: 'Chào mừng gửi Form',
    desc: 'Tự động phản hồi Khách hàng ngay sau khi họ điền Form đăng ký.',
    icon: FileInput,
    theme: 'amber',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi khách gửi Form', iconName: 'zap', config: { type: 'form', targetId: '' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email Phản hồi Form', iconName: 'mail', config: { subject: 'Cảm ơn bạn đã quan tâm! Tài liệu của bạn đây' } }
    ]
  },
  {
    id: 'survey_response',
    name: 'Phản hồi Khảo sát',
    desc: 'Tự động gửi Email cảm ơn hoặc gắn Tag ngay khi khách hàng nộp phản hồi khảo sát.',
    icon: ClipboardList,
    theme: 'amber',
    gradient: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi nộp Khảo sát', iconName: 'zap', config: { type: 'survey', targetId: '' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email Cảm ơn', iconName: 'mail', config: { subject: 'Cảm ơn ý kiến đóng góp của bạn! 🙏' } }
    ]
  },
  {
    id: 'zalo_oa_welcome',
    name: 'Quan tâm Zalo OA',
    desc: 'Bắt đầu chăm sóc ngay khi khách hàng nhấn "Quan tâm" trang Zalo OA của bạn.',
    icon: UserPlus,
    theme: 'cyan',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi Quan tâm Zalo', iconName: 'zap', config: { type: 'zalo_follow' }, nextStepId: 'a1' },
      { id: 'a1', type: 'zalo_zns', label: 'Tin nhắn Chào mừng Zalo', iconName: 'message-square', config: { subject: 'Chào mừng bạn đã quan tâm OA của chúng tôi! 💐' } }
    ]
  },
  {
    id: 'campaign_tracking',
    name: 'Chăm sóc sau Chiến dịch',
    desc: 'Kích hoạt ngay khi một email trong chiến dịch chính vừa được gửi đi.',
    icon: Send,
    theme: 'violet',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi gửi Campaign', iconName: 'zap', config: { type: 'campaign', targetId: '' }, nextStepId: 'w1' },
      { id: 'w1', type: 'wait', label: 'Chờ 2 ngày', iconName: 'clock', config: { duration: 2, unit: 'days' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email Follow-up', iconName: 'mail', config: { subject: 'Bạn có nhận được ưu đãi hôm trước không? 😉' } }
    ]
  },
  {
    id: 'keyword_auto_reply',
    name: 'Phản hồi Từ khóa (Chat)',
    desc: 'Tự động gửi thông tin khi khách nhắn các từ khóa như "GIÁ", "TƯ VẤN" qua Meta/Zalo.',
    icon: MessageSquare,
    theme: 'blue',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #4f46e5 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi có từ khóa: GIÁ, TƯ VẤN', iconName: 'zap', config: { type: 'inbound_message', targetId: 'TƯ VẤN' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Gửi Báo giá / Tài liệu', iconName: 'mail', config: { subject: 'Tài liệu bạn yêu cầu đã sẵn sàng! 📄' } }
    ]
  },
  {
    id: 'upsell_after_purchase',
    name: 'Gợi ý Bán chéo (Upsell)',
    desc: 'Gửi mã giảm giá cho sản phẩm liên quan sau khi khách hoàn thành đơn hàng 3 ngày.',
    icon: Gift,
    theme: 'orange',
    gradient: 'linear-gradient(135deg, #f97316 0%, #d97706 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi Mua hàng thành công', iconName: 'zap', config: { type: 'purchase', targetId: '' }, nextStepId: 'w1' },
      { id: 'w1', type: 'wait', label: 'Chờ 3 ngày', iconName: 'clock', config: { duration: 3, unit: 'days' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email Ưu đãi Bán thêm', iconName: 'mail', config: { subject: 'Dành riêng cho bạn: Ưu đãi 15% cho sản phẩm đi kèm! 🎁' } }
    ]
  },
  {
    id: 'abandoned_cart',
    name: 'Nhắc nhở Giỏ hàng',
    desc: 'Tự động gửi tin nhắn nhắc nhở khi khách đã thêm hàng vào giỏ nhưng chưa thanh toán.',
    icon: ShoppingCart,
    theme: 'rose',
    gradient: 'linear-gradient(135deg, #f43f5e 0%, #db2777 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi thêm vào giỏ hàng', iconName: 'zap', config: { type: 'custom_event', targetId: 'add_to_cart' }, nextStepId: 'w1' },
      { id: 'w1', type: 'wait', label: 'Chờ 2 giờ', iconName: 'clock', config: { duration: 2, unit: 'hours' }, nextStepId: 'c1' },
      { id: 'c1', type: 'condition', label: 'Đã mua hàng chưa?', iconName: 'filter', config: { field: 'lastPurchase', operator: 'within_last', value: '2', unit: 'hours' }, yesStepId: '', noStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email Nhắc giỏ hàng', iconName: 'mail', config: { subject: 'Bạn để quên món đồ yêu thích trong giỏ hàng! 🛒' } }
    ]
  },
  {
    id: 'winback',
    name: 'Khách hàng ngủ đông',
    desc: 'Kích hoạt khi Khách hàng KHÔNG có tương tác (Mở/Click) trong 30 ngày.',
    icon: Snowflake,
    theme: 'blue',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #4f46e5 100%)',
    steps: [
      {
        id: 't1',
        type: 'trigger',
        label: 'Không hoạt động > 30 ngày',
        iconName: 'zap',
        config: {
          type: 'date',
          dateField: 'lastActivity',
          inactiveAmount: 30,
        },
        nextStepId: 'a1'
      },
      { id: 'a1', type: 'action', label: 'Email Lôi kéo', iconName: 'mail', config: { subject: 'Chúng tôi nhớ bạn! Giảm ngay 20% khi quay lại' } }
    ]
  },
  {
    id: 'birthday',
    name: 'Chúc mừng Sinh nhật',
    desc: 'Tự động gửi quà tặng đúng ngày sinh nhật của Khách hàng.',
    icon: Cake,
    theme: 'pink',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Đúng ngày sinh nhật', iconName: 'zap', config: { type: 'date', dateField: 'dateOfBirth' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email Tặng Quà', iconName: 'mail', config: { subject: 'Chúc mừng sinh nhật! Nhận quà ngay 🎂' } }
    ]
  },
  {
    id: 'joined_anniversary',
    name: 'Tri ân Ngày gia nhập',
    desc: 'Tự động gửi thư tri ân khách hàng vào ngày kỷ niệm 1 năm, 2 năm gia nhập.',
    icon: PartyPopper,
    theme: 'violet',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Kỷ niệm ngày gia nhập', iconName: 'zap', config: { type: 'date', dateField: 'joinedAt' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email Tri ân', iconName: 'mail', config: { subject: 'Cảm ơn bạn đã đồng hành cùng chúng tôi suốt 1 năm qua! ❤️' } }
    ]
  },
  {
    id: 'unsubscribe_cleanup',
    name: 'Xử lý Hủy đăng ký',
    desc: 'Tự động gắn nhãn "Unsubscribed" hoặc dọn dẹp CRM khi khách nhấn link hủy đăng ký.',
    icon: UserMinus,
    theme: 'red',
    gradient: 'linear-gradient(135deg, #ef4444 0%, #be123c 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi Hủy đăng ký', iconName: 'zap', config: { type: 'unsubscribe' }, nextStepId: 'a1' },
      { id: 'a1', type: 'update_tag', label: 'Gắn nhãn: STOP', iconName: 'tag', config: { action: 'add', tags: ['UNSUBSCRIBED', 'STOP_MARKETING'] } }
    ]
  },
  {
    id: 'google_sheets_sync',
    name: 'Đồng bộ Google Sheets',
    desc: 'Tự động gửi email khi có Khách hàng mới từ Google Sheets.',
    icon: FileSpreadsheet,
    theme: 'emerald',
    gradient: 'linear-gradient(135deg, #10b981 0%, #16a34a 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi gia nhập List Sheets', iconName: 'zap', config: { type: 'segment', targetSubtype: 'list', targetId: '' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email Chào mừng', iconName: 'mail', config: { subject: 'Chào mừng bạn!' } }
    ]
  },
  {
    id: 'appointment_reminder',
    name: 'Nhắc lịch hẹn',
    desc: 'Tự động nhắc nhở Khách hàng trước ngày hẹn/lịch đặt được lưu trong Custom Field.',
    icon: BellRing,
    theme: 'violet',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
    steps: [
      {
        id: 't1',
        type: 'trigger',
        label: '1 ngày trước [ngay_dat_lich]',
        iconName: 'zap',
        config: {
          type: 'date',
          dateField: 'custom_field_date',
          customFieldKey: 'ngay_dat_lich',
          offsetType: 'before',
          offsetValue: 1,
          triggerHour: 8,
          targetLists: 'all',
          targetListIds: []
        },
        nextStepId: 'a1'
      },
      {
        id: 'a1',
        type: 'action',
        label: 'Email Nhắc lịch',
        iconName: 'mail',
        config: { subject: '⏰ Nhắc nhở: Lịch hẹn của bạn là ngày mai!' }
      }
    ]
  },
  {
    id: 'voucher_claim',
    name: 'Chăm sóc lấy Voucher',
    desc: 'Tự động gửi email đính kèm mã khi khách hàng xí Voucher, hoặc upsell sau vài ngày.',
    icon: Ticket,
    theme: 'amber',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi nhận Voucher', iconName: 'zap', config: { type: 'voucher', targetId: '' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email tặng mã', iconName: 'mail', config: { subject: 'Mã giảm giá của bạn đây! 🎟️' }, nextStepId: 'w1' },
      { id: 'w1', type: 'wait', label: 'Chờ hêt hạn', iconName: 'clock', config: { duration: 3, unit: 'days' }, nextStepId: 'c1' },
      { id: 'c1', type: 'condition', label: 'Đã mua chưa?', iconName: 'filter', config: { field: 'lastPurchase', operator: 'within_last', value: '3', unit: 'days' }, yesStepId: '', noStepId: 'a2' },
      { id: 'a2', type: 'action', label: 'Email Nhắc nhở', iconName: 'mail', config: { subject: 'Mã sắp hết hạn, dùng ngay kẻo lỡ! ⏰' } }
    ]
  },
  {
    id: 'voucher_redeem_thanks',
    name: 'Cảm ơn & Tặng quà sau Mua',
    desc: 'Bắt sự kiện khách hàng Gạch mã Voucher tại Cửa hàng. Tự động gửi thư Cảm ơn và mã giảm giá cho Lần Kế tiếp.',
    icon: PartyPopper,
    theme: 'emerald',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi khách Dùng mã', iconName: 'zap', config: { type: 'voucher_redeem', targetId: '' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Zalo ZNS Cảm ơn', iconName: 'message-square', config: { templateId: 'thanks_zns' }, nextStepId: 'w1' },
      { id: 'w1', type: 'wait', label: 'Chờ 2 ngày', iconName: 'clock', config: { duration: 2, unit: 'days' }, nextStepId: 'a2' },
      { id: 'a2', type: 'action', label: 'Gửi Email Mời Đánh giá', iconName: 'mail', config: { subject: 'Bạn đánh giá trải nghiệm mua sắm hôm trước thế nào? ⭐' } }
    ]
  }
];

const FlowCreationModal: React.FC<FlowCreationModalProps> = ({
  isOpen, onClose, onCreate, initialTemplateId, initialCampaignId, initialFlowName
}) => {
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [flowName, setFlowName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Handle pre-fill
  useEffect(() => {
    if (isOpen && initialTemplateId) {
      const tpl = FLOW_TEMPLATES.find(t => t.id === initialTemplateId);
      if (tpl) {
        setSelectedTemplate(tpl);
        setFlowName(initialFlowName || tpl.name);
        setStep(2);
      }
    }
  }, [isOpen, initialTemplateId, initialFlowName]);

  const handleNext = () => {
    if (step === 1) {
      if (selectedTemplate) {
        // Only set default name if not already pre-filled
        if (!flowName) {
          setFlowName(selectedTemplate.name);
        }
        setStep(2);
      }
    } else if (step === 2) {
      if (flowName.trim()) {
        createFlow();
      }
    }
  };

  const createFlow = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const idMap: Record<string, string> = {};
      selectedTemplate.steps.forEach((s: any) => { idMap[s.id] = crypto.randomUUID(); });

      const finalSteps = selectedTemplate.steps.map((s: any) => {
        const newStep = { ...s, id: idMap[s.id] };

        // Apply initialCampaignId to trigger if it's a campaign trigger
        if (newStep.type === 'trigger' && newStep.config?.type === 'campaign' && initialCampaignId) {
          newStep.config.targetId = initialCampaignId;
        }

        if (s.nextStepId && idMap[s.nextStepId]) newStep.nextStepId = idMap[s.nextStepId];
        if (s.yesStepId && idMap[s.yesStepId]) newStep.yesStepId = idMap[s.yesStepId];
        if (s.noStepId && idMap[s.noStepId]) newStep.noStepId = idMap[s.noStepId];
        if (s.pathAStepId && idMap[s.pathAStepId]) newStep.pathAStepId = idMap[s.pathAStepId];
        if (s.pathBStepId && idMap[s.pathBStepId]) newStep.pathBStepId = idMap[s.pathBStepId];
        return newStep;
      });

      await onCreate({
        name: flowName.trim(),
        steps: finalSteps,
        description: selectedTemplate?.desc || 'Kịch bản tự động hóa.'
      });
      onClose();
      reset();
    } catch (error) {
      console.error("Error creating flow:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const reset = () => { setStep(1); setSelectedTemplate(null); setFlowName(''); };

  const getBorderClass = (theme: string, isSelected: boolean) => {
    if (!isSelected) return 'border-slate-100 bg-white hover:border-slate-300 hover:shadow-lg hover:-translate-y-1';

    switch (theme) {
      case 'cyan': return 'border-cyan-400 ring-4 ring-cyan-50 shadow-xl shadow-cyan-100 bg-cyan-50/30';
      case 'violet': return 'border-blue-400 ring-4 ring-blue-50 shadow-xl shadow-blue-100 bg-blue-50/30';
      case 'indigo': return 'border-indigo-400 ring-4 ring-indigo-50 shadow-xl shadow-indigo-100 bg-indigo-50/30';
      case 'blue': return 'border-blue-400 ring-4 ring-blue-50 shadow-xl shadow-blue-100 bg-blue-50/30';
      case 'rose': return 'border-rose-400 ring-4 ring-rose-50 shadow-xl shadow-rose-100 bg-rose-50/30';
      case 'pink': return 'border-pink-400 ring-4 ring-pink-50 shadow-xl shadow-pink-100 bg-pink-50/30';
      case 'amber': case 'orange': return 'border-amber-400 ring-4 ring-amber-50 shadow-xl shadow-amber-100 bg-amber-50/30';
      case 'emerald': return 'border-emerald-400 ring-4 ring-emerald-50 shadow-xl shadow-emerald-100 bg-emerald-50/30';
      case 'red': return 'border-rose-400 ring-4 ring-rose-50 shadow-xl shadow-rose-100 bg-rose-50/30';
      default: return 'border-slate-400 ring-4 ring-slate-100';
    }
  };

  const getCheckColor = (theme: string) => {
    switch (theme) {
      case 'cyan': return 'text-cyan-500';
      case 'violet': return 'text-blue-500';
      case 'indigo': return 'text-indigo-500';
      case 'blue': return 'text-blue-500';
      case 'rose': return 'text-rose-500';
      case 'pink': return 'text-pink-500';
      case 'amber': case 'orange': return 'text-amber-600';
      case 'emerald': return 'text-emerald-500';
      case 'red': return 'text-rose-500';
      default: return 'text-slate-500';
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { onClose(); reset(); }}
      title={step === 1 ? "Chọn mẫu kịch bản" : "Đặt tên kịch bản"}
      size="lg"
      footer={
        <div className="flex justify-between w-full">
          {step > 1 ? <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={isCreating}>Quay lại</Button> : <div />}
          <Button
            disabled={(step === 1 && !selectedTemplate) || (step === 2 && !flowName.trim()) || isCreating}
            isLoading={isCreating}
            onClick={handleNext}
            icon={step === 2 ? Zap : ArrowRight}
          >
            {step === 2 ? "Tạo kịch bản" : "Tiếp tục"}
          </Button>
        </div>
      }
    >
      {step === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-1">
          {FLOW_TEMPLATES.map((tpl) => {
            const isSelected = selectedTemplate?.id === tpl.id;
            return (
              <div
                key={tpl.id}
                onClick={() => setSelectedTemplate(tpl)}
                className={`p-6 rounded-[32px] border-2 cursor-pointer transition-all duration-500 flex flex-col gap-5 relative overflow-hidden group ${getBorderClass(tpl.theme, isSelected)}`}
              >
                <div className={`absolute top-4 right-4 bg-white rounded-full p-1.5 shadow-md border border-slate-50 transition-all duration-300 ${isSelected ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>
                  <Check className={`w-3.5 h-3.5 ${getCheckColor(tpl.theme)} stroke-[4px]`} />
                </div>

                <div 
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg transition-all duration-500 ${isSelected ? 'scale-110 rotate-3 shadow-xl' : 'group-hover:scale-110 group-hover:rotate-3'}`}
                  style={{ background: tpl.gradient }}
                >
                  <tpl.icon className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-black text-slate-800 text-[15px] mb-1.5 tracking-tight group-hover:text-[#ca7900] transition-colors">{tpl.name}</h4>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{tpl.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 animate-in slide-in-from-right-8 duration-500 p-1">
          <Input label="Tên kịch bản nội bộ" placeholder="VD: Chào mừng Khách hàng từ Form Landing Page" value={flowName} onChange={(e) => setFlowName(e.target.value)} autoFocus />
          <div className="p-5 bg-blue-50 border border-blue-100 rounded-2xl flex gap-3 shadow-inner">
            <Info className="w-4 h-4 text-blue-600 mt-1" />
            <p className="text-[11px] text-blue-700 font-semibold leading-relaxed">Hệ thống sẽ tự động cấu hình các bước cơ bản theo logic của kịch bản "{selectedTemplate?.name}". Bạn có thể chỉnh sửa chi tiết sau khi tạo.</p>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default FlowCreationModal;