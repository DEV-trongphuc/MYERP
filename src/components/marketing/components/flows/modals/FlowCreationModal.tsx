
import React, { useState, useEffect } from 'react';
import { ArrowRight, Gift, Zap, Info, Cake, Tag, Users, RefreshCw, Send, PartyPopper, Ghost, Crown, UserPlus, Snowflake, Check, List, FileInput, Layers, ListPlus, ShoppingCart, Plug, FileSpreadsheet, BellRing, Calendar, MessageSquare, UserMinus, Ticket, Bot, ClipboardList, Clock } from 'lucide-react';
import Modal from '../../common/Modal';
import Button from '../../common/Button';
import Input from '../../common/Input';
import { AppIcon } from '../../../../common/AppIcons';

interface FlowCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (flowData: any) => void;
  initialTemplateId?: string;
  initialCampaignId?: string;
  initialFlowName?: string;
}

import { FLOW_TEMPLATE_CATEGORIES } from '../../../constants/flowConstants';

const FLOW_TEMPLATES = [
  {
    id: 'tpl_myerp_round_sla',
    name: 'Chia Lead Vòng chia ➔ Kiểm tra SLA 2h ➔ Điều phối lại Sale',
    desc: 'Khi Lead được Vòng chia phân bổ: Gửi Zalo ZNS chào mừng ➔ Chờ 2 giờ ➔ Kiểm tra Sale đã liên hệ chưa. Nếu chưa, tự động chuyển sang Sale khác trong ca trực.',
    category: 'myerp_sale',
    tags: ['myerp_sale', 'pipeline_sla'],
    badge: 'MYERP SLA',
    appIconKey: 'flow_custom_event',
    icon: RefreshCw,
    theme: 'slate',
    gradient: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
    steps: [
      {
        id: 't1',
        type: 'trigger',
        label: 'Khi Lead được Vòng chia phân bổ',
        iconName: 'zap',
        config: {
          type: 'erp_event',
          targetId: 'round_distributed',
          erpFilters: { distribution_status: 'success' }
        },
        nextStepId: 'a1'
      },
      {
        id: 'a1',
        type: 'zalo_zns',
        label: 'Zalo ZNS Chào mừng & Giới thiệu Sale',
        iconName: 'message-square',
        config: {
          template_id: 'welcome_consultant_zns',
          subject: 'Chào mừng anh/chị! Tư vấn viên phụ trách sẽ liên hệ hỗ trợ ngay.'
        },
        nextStepId: 'w1'
      },
      {
        id: 'w1',
        type: 'wait',
        label: 'Chờ 2 giờ (SLA)',
        iconName: 'clock',
        config: { duration: 2, unit: 'hours' },
        nextStepId: 'c1'
      },
      {
        id: 'c1',
        type: 'condition',
        label: 'Sale đã liên hệ khách hàng?',
        iconName: 'git-merge',
        config: {
          conditionCategory: 'myerp',
          conditionType: 'crm_sale_contacted',
          waitDuration: 0,
          waitUnit: 'hours'
        },
        yesStepId: 'u1',
        noStepId: 'crm1'
      },
      {
        id: 'u1',
        type: 'update_tag',
        label: 'Gắn tag: SALE_DA_LIEN_HE',
        iconName: 'tag',
        config: { action: 'add', tags: ['SALE_DA_LIEN_HE'] }
      },
      {
        id: 'crm1',
        type: 'crm_action',
        label: 'Điều phối lại sang Sale khác (SLA)',
        iconName: 'briefcase',
        config: {
          actionType: 'reassign_if_uncontacted',
          roundId: '',
          note: 'Quá 2h chưa liên hệ - Tự động điều phối sang Sale khác'
        },
        nextStepId: 'crm2'
      },
      {
        id: 'crm2',
        type: 'crm_action',
        label: 'Báo thông báo khẩn cho Sale mới',
        iconName: 'briefcase',
        config: {
          actionType: 'notify_owner',
          title: 'Lead ưu tiên điều phối lại',
          message: 'Lead chưa được liên hệ sau 2h đã chuyển sang bạn chăm sóc ngay'
        }
      }
    ]
  },
  {
    id: 'tpl_myerp_multibranch_sale',
    name: 'Phân nhánh Đa tầng theo Vòng chia / Độ nóng Lead (Multi-If)',
    desc: 'Khi Lead được giao cho Sale: Tự động rẽ 3 nhánh theo Nhiệt độ Lead (Hot ➔ Giao việc gọi ngay 15p; Warm ➔ Gửi Zalo ZNS học bổng; Cold ➔ Chuỗi Email nuôi dưỡng).',
    category: 'pipeline_sla',
    tags: ['myerp_sale', 'pipeline_sla'],
    badge: 'Multi-If CRM',
    appIconKey: 'flow_smart_segment',
    icon: Layers,
    theme: 'rose',
    gradient: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
    steps: [
      {
        id: 't1',
        type: 'trigger',
        label: 'Khi Lead được giao cho Sale',
        iconName: 'zap',
        config: {
          type: 'erp_event',
          targetId: 'lead_assigned',
          erpFilters: { assignment_type: 'all' }
        },
        nextStepId: 'adv1'
      },
      {
        id: 'adv1',
        type: 'advanced_condition',
        label: 'Rẽ nhánh theo Độ nóng Lead (Hot/Warm/Cold)',
        iconName: 'git-merge',
        branches: [
          {
            id: 'br_hot',
            name: 'Lead Nóng (Hot)',
            nextStepId: 'crm_hot',
            stepId: 'crm_hot',
            conditionGroup: {
              id: 'cg_hot',
              logic: 'AND',
              conditions: [
                { id: 'r_hot', field: 'crm_temperature', operator: 'equals', value: 'hot' }
              ]
            }
          },
          {
            id: 'br_warm',
            name: 'Lead Ấm (Warm)',
            nextStepId: 'zns_warm',
            stepId: 'zns_warm',
            conditionGroup: {
              id: 'cg_warm',
              logic: 'AND',
              conditions: [
                { id: 'r_warm', field: 'crm_temperature', operator: 'equals', value: 'warm' }
              ]
            }
          }
        ],
        defaultStepId: 'mail_cold',
        config: {
          branches: [
            {
              id: 'br_hot',
              name: 'Lead Nóng (Hot)',
              nextStepId: 'crm_hot',
              stepId: 'crm_hot',
              conditionGroup: {
                id: 'cg_hot',
                logic: 'AND',
                conditions: [
                  { id: 'r_hot', field: 'crm_temperature', operator: 'equals', value: 'hot' }
                ]
              }
            },
            {
              id: 'br_warm',
              name: 'Lead Ấm (Warm)',
              nextStepId: 'zns_warm',
              stepId: 'zns_warm',
              conditionGroup: {
                id: 'cg_warm',
                logic: 'AND',
                conditions: [
                  { id: 'r_warm', field: 'crm_temperature', operator: 'equals', value: 'warm' }
                ]
              }
            }
          ],
          defaultStepId: 'mail_cold'
        }
      },
      {
        id: 'crm_hot',
        type: 'crm_action',
        label: 'Giao việc: Gọi tư vấn ngay trong 15 phút',
        iconName: 'briefcase',
        config: {
          actionType: 'create_task',
          taskTitle: 'Gọi tư vấn ngay trong 15 phút (Lead HOT)',
          taskType: 'call',
          priority: 'high',
          dueDays: 0,
          taskDescription: 'Khách hàng đang rất quan tâm (Hot), ưu tiên gọi điện tư vấn ngay.'
        }
      },
      {
        id: 'zns_warm',
        type: 'zalo_zns',
        label: 'Gửi thông tin chương trình & học bổng',
        iconName: 'message-square',
        config: {
          template_id: 'program_scholarship_zns',
          subject: 'Thông tin lộ trình đào tạo & ưu đãi học bổng dành riêng cho bạn'
        }
      },
      {
        id: 'mail_cold',
        type: 'action',
        label: 'Gửi chuỗi Email nuôi dưỡng',
        iconName: 'mail',
        config: {
          subject: 'Cẩm nang định hướng lộ trình & kinh nghiệm thực tế dành cho bạn'
        }
      }
    ]
  },
  {
    id: 'tpl_myerp_held_lead',
    name: 'Cứu Lead treo ngoài ca trực (Held Queue Recovery)',
    desc: 'Khi Lead bị giữ trong hàng đợi (ngoài giờ / chưa có ca trực): Tự động gửi Zalo ZNS trấn an khách hàng ➔ Chờ 8 giờ tới đầu ca sáng ➔ Chia lại vào Vòng chia Round-Robin.',
    category: 'myerp_sale',
    tags: ['myerp_sale'],
    badge: 'Ca trực & Queue',
    appIconKey: 'flow_inactivity',
    icon: Clock,
    theme: 'amber',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    steps: [
      {
        id: 't1',
        type: 'trigger',
        label: 'Khi Lead vào Hàng đợi chờ ca trực',
        iconName: 'zap',
        config: {
          type: 'erp_event',
          targetId: 'lead_held_queue',
          erpFilters: { distribution_status: 'held' }
        },
        nextStepId: 'zns1'
      },
      {
        id: 'zns1',
        type: 'zalo_zns',
        label: 'Zalo ZNS hẹn liên hệ đầu ca sáng',
        iconName: 'message-square',
        config: {
          template_id: 'after_hours_hold_zns',
          subject: 'Cảm ơn anh/chị đã đăng ký, Tư vấn viên sẽ liên hệ ngay đầu ca sáng'
        },
        nextStepId: 'w1'
      },
      {
        id: 'w1',
        type: 'wait',
        label: 'Chờ 8 giờ (Tới ca trực sáng)',
        iconName: 'clock',
        config: { duration: 8, unit: 'hours' },
        nextStepId: 'crm1'
      },
      {
        id: 'crm1',
        type: 'crm_action',
        label: 'Chia Lead theo Vòng chia Ca trực',
        iconName: 'briefcase',
        config: {
          actionType: 'assign_round_robin',
          roundId: '',
          respectShifts: true,
          onlyIfUnassigned: true
        }
      }
    ]
  },
  {
    id: 'tpl_myerp_deposit_onboarding',
    name: 'Xác nhận Đặt cọc ➔ Chào mừng Học viên mới (MYERP)',
    desc: 'Tự động kích hoạt khi Kế toán duyệt phiếu đặt cọc: Gửi Zalo ZNS xác nhận biên lai ➔ Gửi Email hướng dẫn nhập học ➔ Cập nhật trạng thái CRM Active & Hot.',
    category: 'academic_finance',
    tags: ['academic_finance'],
    badge: 'Kế toán & Học vụ',
    appIconKey: 'flow_purchase',
    icon: Crown,
    theme: 'emerald',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    steps: [
      {
        id: 't1',
        type: 'trigger',
        label: 'Khi Đặt cọc thành công (Approved)',
        iconName: 'zap',
        config: {
          type: 'erp_event',
          targetId: 'deposit_paid',
          erpFilters: {}
        },
        nextStepId: 'zns1'
      },
      {
        id: 'zns1',
        type: 'zalo_zns',
        label: 'Xác nhận biên lai đặt cọc thành công',
        iconName: 'message-square',
        config: {
          template_id: 'deposit_confirmed_zns',
          subject: 'Xác nhận biên lai đặt cọc thành công tại hệ thống MYERP'
        },
        nextStepId: 'mail1'
      },
      {
        id: 'mail1',
        type: 'action',
        label: 'Email hướng dẫn thủ tục nhập học',
        iconName: 'mail',
        config: {
          subject: 'Chào mừng tân học viên - Hướng dẫn thủ tục nhập học & lộ trình đào tạo'
        },
        nextStepId: 'crm1'
      },
      {
        id: 'crm1',
        type: 'crm_action',
        label: 'Cập nhật Lead: Active & Hot',
        iconName: 'briefcase',
        config: {
          actionType: 'update_stage',
          leadStatus: 'active',
          temperature: 'hot'
        }
      }
    ]
  },
  {
    id: 'ai_chatbot_lead',
    name: 'Lead từ AI Chatbot',
    desc: 'Kích hoạt ngay khi Bot AI Chatbot hoặc Auto-fill Website capture thông tin Lead (Email/SDT).',
    category: 'omnichannel',
    tags: ['omnichannel', 'myerp_sale'],
    appIconKey: 'flow_ai_bot',
    icon: Bot,
    theme: 'rose', // Đỏ đô sáng
    gradient: 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi có Lead từ AI', iconName: 'zap', config: { type: 'ai_capture', targetId: '' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email Chào Mừng', iconName: 'mail', config: { subject: 'Tài liệu bạn yêu cầu từ hệ thống MYERP' } }
    ]
  },
  {
    id: 'welcome_segment',
    name: 'Phân khúc động (Smart)',
    desc: 'Tự động chạy khi Khách hàng thỏa mãn bộ lọc (VD: VIP, Mới mua hàng).',
    category: 'pipeline_sla',
    tags: ['pipeline_sla', 'omnichannel'],
    appIconKey: 'flow_smart_segment',
    icon: Layers,
    theme: 'orange',
    gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi vào Phân khúc', iconName: 'zap', config: { type: 'segment', targetSubtype: 'segment', targetId: '' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email Chăm sóc Phân khúc', iconName: 'mail', config: { subject: 'Chào mừng bạn đến với nhóm đặc quyền' } }
    ]
  },
  {
    id: 'welcome_list',
    name: 'Gia nhập Danh sách',
    desc: 'Kích hoạt khi Khách hàng được thêm vào một danh sách tĩnh (VD: Import, API).',
    category: 'omnichannel',
    tags: ['omnichannel'],
    appIconKey: 'flow_list',
    icon: ListPlus,
    theme: 'slate',
    gradient: 'linear-gradient(135deg, #334155 0%, #475569 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi vào Danh sách', iconName: 'zap', config: { type: 'segment', targetSubtype: 'list', targetId: '' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email Chào mừng', iconName: 'mail', config: { subject: 'Cảm ơn bạn đã tham gia cộng đồng' } }
    ]
  },
  {
    id: 'purchase_success',
    name: 'Cảm ơn Mua hàng',
    desc: 'Gửi thư cảm ơn xác nhận ngay khi Khách hàng phát sinh đơn hàng mới.',
    category: 'academic_finance',
    tags: ['academic_finance', 'omnichannel'],
    appIconKey: 'flow_purchase',
    icon: ShoppingCart,
    theme: 'rose',
    gradient: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi Mua hàng', iconName: 'zap', config: { type: 'purchase', targetId: '' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email Cảm ơn', iconName: 'mail', config: { subject: 'Xác nhận đơn hàng thành công' } }
    ]
  },
  {
    id: 'custom_event_flow',
    name: 'Sự kiện Tùy chỉnh',
    desc: 'Kích hoạt khi nhận được một API Event bất kỳ (VD: Click Banner, App Login).',
    category: 'omnichannel',
    tags: ['omnichannel'],
    appIconKey: 'flow_custom_event',
    icon: Zap,
    theme: 'slate',
    gradient: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi có Custom Event', iconName: 'zap', config: { type: 'custom_event', targetId: '' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email Phản hồi', iconName: 'mail', config: { subject: 'Chúng tôi đã nhận được tương tác của bạn' } }
    ]
  },
  {
    id: 'tag_added',
    name: 'Khi được gắn Tag',
    desc: 'Kích hoạt ngay khi hồ sơ Khách hàng được gắn một nhãn cụ thể.',
    category: 'pipeline_sla',
    tags: ['pipeline_sla', 'omnichannel'],
    appIconKey: 'flow_tag',
    icon: Tag,
    theme: 'emerald',
    gradient: 'linear-gradient(135deg, #10b981 0%, #0d9488 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi được gắn nhãn', iconName: 'zap', config: { type: 'tag', targetId: '' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email Phản hồi Tag', iconName: 'mail', config: { subject: 'Bạn vừa nhận được ưu đãi mới' } }
    ]
  },
  {
    id: 'welcome_form',
    name: 'Chào mừng gửi Form',
    desc: 'Tự động phản hồi Khách hàng ngay sau khi họ điền Form đăng ký.',
    category: 'omnichannel',
    tags: ['omnichannel', 'myerp_sale'],
    appIconKey: 'flow_form',
    icon: FileInput,
    theme: 'amber',
    gradient: 'linear-gradient(135deg, #BD1D2D 0%, #991522 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi khách gửi Form', iconName: 'zap', config: { type: 'form', targetId: '' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email Phản hồi Form', iconName: 'mail', config: { subject: 'Cảm ơn bạn đã quan tâm - Tài liệu của bạn đây' } }
    ]
  },
  {
    id: 'survey_response',
    name: 'Phản hồi Khảo sát',
    desc: 'Tự động gửi Email cảm ơn hoặc gắn Tag ngay khi khách hàng nộp phản hồi khảo sát.',
    category: 'academic_finance',
    tags: ['academic_finance', 'omnichannel'],
    appIconKey: 'flow_survey',
    icon: ClipboardList,
    theme: 'amber',
    gradient: 'linear-gradient(135deg, #fbbf24 0%, #BD1D2D 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi nộp Khảo sát', iconName: 'zap', config: { type: 'survey', targetId: '' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email Cảm ơn', iconName: 'mail', config: { subject: 'Cảm ơn ý kiến đóng góp của bạn' } }
    ]
  },
  {
    id: 'zalo_oa_welcome',
    name: 'Quan tâm Zalo OA',
    desc: 'Bắt đầu chăm sóc ngay khi khách hàng nhấn "Quan tâm" trang Zalo OA của bạn.',
    category: 'omnichannel',
    tags: ['omnichannel'],
    appIconKey: 'flow_zalo',
    icon: UserPlus,
    theme: 'cyan',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi Quan tâm Zalo', iconName: 'zap', config: { type: 'zalo_follow', targetId: '' }, nextStepId: 'a1' },
      { id: 'a1', type: 'zalo_zns', label: 'Tin nhắn Chào mừng Zalo', iconName: 'message-square', config: { subject: 'Chào mừng bạn đã quan tâm OA của chúng tôi' } }
    ]
  },
  {
    id: 'campaign_tracking',
    name: 'Chăm sóc sau Chiến dịch',
    desc: 'Kích hoạt ngay khi một email trong chiến dịch chính vừa được gửi đi.',
    category: 'omnichannel',
    tags: ['omnichannel'],
    appIconKey: 'flow_mail',
    icon: Send,
    theme: 'slate',
    gradient: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi gửi Campaign', iconName: 'zap', config: { type: 'campaign', targetId: '' }, nextStepId: 'w1' },
      { id: 'w1', type: 'wait', label: 'Chờ 2 ngày', iconName: 'clock', config: { duration: 2, unit: 'days' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email Follow-up', iconName: 'mail', config: { subject: 'Bạn có nhận được ưu đãi hôm trước không?' } }
    ]
  },
  {
    id: 'keyword_auto_reply',
    name: 'Phản hồi Từ khóa (Chat)',
    desc: 'Tự động gửi thông tin khi khách nhắn các từ khóa như "GIÁ", "TƯ VẤN" qua Meta/Zalo.',
    category: 'omnichannel',
    tags: ['omnichannel'],
    appIconKey: 'flow_zalo',
    icon: MessageSquare,
    theme: 'blue',
    gradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi có từ khóa: GIÁ, TƯ VẤN', iconName: 'zap', config: { type: 'inbound_message', targetId: 'TƯ VẤN' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Gửi Báo giá / Tài liệu', iconName: 'mail', config: { subject: 'Tài liệu bạn yêu cầu đã sẵn sàng' } }
    ]
  },
  {
    id: 'upsell_after_purchase',
    name: 'Gợi ý Bán chéo (Upsell)',
    desc: 'Gửi mã giảm giá cho sản phẩm liên quan sau khi khách hoàn thành đơn hàng 3 ngày.',
    category: 'academic_finance',
    tags: ['academic_finance', 'omnichannel'],
    appIconKey: 'flow_purchase',
    icon: Gift,
    theme: 'orange',
    gradient: 'linear-gradient(135deg, #f97316 0%, #BD1D2D 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi Mua hàng thành công', iconName: 'zap', config: { type: 'purchase', targetId: '' }, nextStepId: 'w1' },
      { id: 'w1', type: 'wait', label: 'Chờ 3 ngày', iconName: 'clock', config: { duration: 3, unit: 'days' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email Ưu đãi Bán thêm', iconName: 'mail', config: { subject: 'Dành riêng cho bạn: Ưu đãi 15% cho sản phẩm đi kèm' } }
    ]
  },
  {
    id: 'abandoned_cart',
    name: 'Nhắc nhở Giỏ hàng',
    desc: 'Tự động gửi tin nhắn nhắc nhở khi khách đã thêm hàng vào giỏ nhưng chưa thanh toán.',
    category: 'academic_finance',
    tags: ['academic_finance', 'omnichannel'],
    appIconKey: 'flow_purchase',
    icon: ShoppingCart,
    theme: 'rose',
    gradient: 'linear-gradient(135deg, #BD1D2D 0%, #991522 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi thêm vào giỏ hàng', iconName: 'zap', config: { type: 'custom_event', targetId: 'add_to_cart' }, nextStepId: 'w1' },
      { id: 'w1', type: 'wait', label: 'Chờ 2 giờ', iconName: 'clock', config: { duration: 2, unit: 'hours' }, nextStepId: 'c1' },
      { id: 'c1', type: 'condition', label: 'Đã mua hàng chưa?', iconName: 'filter', config: { conditionType: 'clicked', waitDuration: 2, waitUnit: 'hours' }, yesStepId: '', noStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email Nhắc giỏ hàng', iconName: 'mail', config: { subject: 'Bạn còn sản phẩm chưa hoàn tất trong giỏ hàng' } }
    ]
  },
  {
    id: 'winback',
    name: 'Khách hàng ngủ đông',
    desc: 'Kích hoạt khi Khách hàng KHÔNG có tương tác (Mở/Click) trong 30 ngày.',
    category: 'pipeline_sla',
    tags: ['pipeline_sla', 'omnichannel'],
    appIconKey: 'flow_inactivity',
    icon: Snowflake,
    theme: 'blue',
    gradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
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
      { id: 'a1', type: 'action', label: 'Email Lôi kéo', iconName: 'mail', config: { subject: 'Ưu đãi dành riêng cho bạn: Giảm ngay 20% khi quay lại' } }
    ]
  },
  {
    id: 'birthday',
    name: 'Chúc mừng Sinh nhật',
    desc: 'Tự động gửi quà tặng đúng ngày sinh nhật của Khách hàng.',
    category: 'omnichannel',
    tags: ['omnichannel'],
    appIconKey: 'flow_birthday',
    icon: Cake,
    theme: 'rose',
    gradient: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Đúng ngày sinh nhật', iconName: 'zap', config: { type: 'date', dateField: 'dateOfBirth' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email Tặng Quà', iconName: 'mail', config: { subject: 'Chúc mừng sinh nhật - Quà tặng dành cho bạn' } }
    ]
  },
  {
    id: 'joined_anniversary',
    name: 'Tri ân Ngày gia nhập',
    desc: 'Tự động gửi thư tri ân khách hàng vào ngày kỷ niệm 1 năm, 2 năm gia nhập.',
    category: 'omnichannel',
    tags: ['omnichannel'],
    appIconKey: 'flow_custom_event',
    icon: PartyPopper,
    theme: 'slate',
    gradient: 'linear-gradient(135deg, #334155 0%, #0f172a 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Kỷ niệm ngày gia nhập', iconName: 'zap', config: { type: 'date', dateField: 'joinedAt' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email Tri ân', iconName: 'mail', config: { subject: 'Cảm ơn bạn đã đồng hành cùng chúng tôi suốt 1 năm qua' } }
    ]
  },
  {
    id: 'unsubscribe_cleanup',
    name: 'Xử lý Hủy đăng ký',
    desc: 'Tự động gắn nhãn "Unsubscribed" hoặc dọn dẹp CRM khi khách nhấn link hủy đăng ký.',
    category: 'pipeline_sla',
    tags: ['pipeline_sla'],
    appIconKey: 'flow_tag',
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
    category: 'omnichannel',
    tags: ['omnichannel'],
    appIconKey: 'flow_list',
    icon: FileSpreadsheet,
    theme: 'emerald',
    gradient: 'linear-gradient(135deg, #10b981 0%, #16a34a 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi gia nhập List Sheets', iconName: 'zap', config: { type: 'segment', targetSubtype: 'list', targetId: '' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email Chào mừng', iconName: 'mail', config: { subject: 'Chào mừng bạn' } }
    ]
  },
  {
    id: 'appointment_reminder',
    name: 'Nhắc lịch hẹn',
    desc: 'Tự động nhắc nhở Khách hàng trước ngày hẹn/lịch đặt được lưu trong Custom Field.',
    category: 'pipeline_sla',
    tags: ['pipeline_sla', 'academic_finance'],
    appIconKey: 'flow_custom_event',
    icon: BellRing,
    theme: 'rose',
    gradient: 'linear-gradient(135deg, #BD1D2D 0%, #991522 100%)',
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
        config: { subject: 'Nhắc nhở: Lịch hẹn của bạn là ngày mai' }
      }
    ]
  },
  {
    id: 'voucher_claim',
    name: 'Chăm sóc lấy Voucher',
    desc: 'Tự động gửi email đính kèm mã khi khách hàng xí Voucher, hoặc upsell sau vài ngày.',
    category: 'omnichannel',
    tags: ['omnichannel'],
    appIconKey: 'flow_tag',
    icon: Ticket,
    theme: 'amber',
    gradient: 'linear-gradient(135deg, #BD1D2D 0%, #991522 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi nhận Voucher', iconName: 'zap', config: { type: 'voucher', targetId: '' }, nextStepId: 'a1' },
      { id: 'a1', type: 'action', label: 'Email tặng mã', iconName: 'mail', config: { subject: 'Mã giảm giá của bạn' }, nextStepId: 'w1' },
      { id: 'w1', type: 'wait', label: 'Chờ hết hạn', iconName: 'clock', config: { duration: 3, unit: 'days' }, nextStepId: 'c1' },
      { id: 'c1', type: 'condition', label: 'Đã mua chưa?', iconName: 'filter', config: { conditionType: 'clicked', waitDuration: 3, waitUnit: 'days' }, yesStepId: '', noStepId: 'a2' },
      { id: 'a2', type: 'action', label: 'Email Nhắc nhở', iconName: 'mail', config: { subject: 'Mã giảm giá của bạn sắp hết hạn' } }
    ]
  },
  {
    id: 'voucher_redeem_thanks',
    name: 'Cảm ơn & Tặng quà sau Mua',
    desc: 'Bắt sự kiện khách hàng Gạch mã Voucher tại Cửa hàng. Tự động gửi thư Cảm ơn và mã giảm giá cho Lần Kế tiếp.',
    category: 'omnichannel',
    tags: ['omnichannel'],
    appIconKey: 'flow_purchase',
    icon: PartyPopper,
    theme: 'emerald',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    steps: [
      { id: 't1', type: 'trigger', label: 'Khi khách Dùng mã', iconName: 'zap', config: { type: 'voucher_redeem', targetId: '' }, nextStepId: 'a1' },
      { id: 'a1', type: 'zalo_zns', label: 'Zalo ZNS Cảm ơn', iconName: 'message-square', config: { template_id: 'thanks_zns' }, nextStepId: 'w1' },
      { id: 'w1', type: 'wait', label: 'Chờ 2 ngày', iconName: 'clock', config: { duration: 2, unit: 'days' }, nextStepId: 'a2' },
      { id: 'a2', type: 'action', label: 'Gửi Email Mời Đánh giá', iconName: 'mail', config: { subject: 'Mời bạn đánh giá trải nghiệm mua sắm' } }
    ]
  }
];

const FlowCreationModal: React.FC<FlowCreationModalProps> = ({
  isOpen, onClose, onCreate, initialTemplateId, initialCampaignId, initialFlowName
}) => {
  const [step, setStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
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
        const newStep = { ...s, id: idMap[s.id], config: s.config ? { ...s.config } : {} };

        // Apply initialCampaignId to trigger if it's a campaign trigger
        if (newStep.type === 'trigger' && newStep.config?.type === 'campaign' && initialCampaignId) {
          newStep.config.targetId = initialCampaignId;
        }

        if (s.nextStepId && idMap[s.nextStepId]) newStep.nextStepId = idMap[s.nextStepId];
        if (s.yesStepId && idMap[s.yesStepId]) newStep.yesStepId = idMap[s.yesStepId];
        if (s.noStepId && idMap[s.noStepId]) newStep.noStepId = idMap[s.noStepId];
        if (s.pathAStepId && idMap[s.pathAStepId]) newStep.pathAStepId = idMap[s.pathAStepId];
        if (s.pathBStepId && idMap[s.pathBStepId]) newStep.pathBStepId = idMap[s.pathBStepId];
        if (s.defaultStepId && idMap[s.defaultStepId]) newStep.defaultStepId = idMap[s.defaultStepId];
        if (newStep.config?.defaultStepId && idMap[newStep.config.defaultStepId]) {
          newStep.config.defaultStepId = idMap[newStep.config.defaultStepId];
        }
        if (Array.isArray(s.branches)) {
          newStep.branches = s.branches.map((br: any) => ({
            ...br,
            nextStepId: br.nextStepId && idMap[br.nextStepId] ? idMap[br.nextStepId] : br.nextStepId,
            stepId: br.stepId && idMap[br.stepId] ? idMap[br.stepId] : br.stepId,
          }));
        }
        if (Array.isArray(newStep.config?.branches)) {
          newStep.config.branches = newStep.config.branches.map((br: any) => ({
            ...br,
            nextStepId: br.nextStepId && idMap[br.nextStepId] ? idMap[br.nextStepId] : br.nextStepId,
            stepId: br.stepId && idMap[br.stepId] ? idMap[br.stepId] : br.stepId,
          }));
        }
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

  const reset = () => { setStep(1); setSelectedCategory('all'); setSelectedTemplate(null); setFlowName(''); };

  const filteredTemplates = FLOW_TEMPLATES.filter((tpl: any) => {
    if (selectedCategory === 'all') return true;
    if (tpl.category === selectedCategory) return true;
    if (Array.isArray(tpl.tags) && tpl.tags.includes(selectedCategory)) return true;
    return false;
  });

  const getBorderClass = (theme: string, isSelected: boolean) => {
    if (!isSelected) return 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50';

    switch (theme) {
      case 'cyan': return 'border-cyan-500 ring-2 ring-cyan-500/15 shadow-sm bg-cyan-50/30';
      case 'slate': return 'border-slate-800 ring-2 ring-slate-900/10 shadow-sm bg-slate-50/70';
      case 'blue': return 'border-blue-500 ring-2 ring-blue-500/15 shadow-sm bg-blue-50/30';
      case 'rose':
      case 'red':
      case 'amber':
      case 'orange': return 'border-[#BD1D2D] ring-2 ring-[#BD1D2D]/15 shadow-sm bg-red-50/20';
      case 'emerald': return 'border-emerald-500 ring-2 ring-emerald-500/15 shadow-sm bg-emerald-50/30';
      default: return 'border-slate-800 ring-2 ring-slate-900/10 shadow-sm bg-slate-50/70';
    }
  };

  const getCheckColor = (theme: string) => {
    switch (theme) {
      case 'cyan': return 'text-cyan-600';
      case 'slate': return 'text-slate-900';
      case 'blue': return 'text-blue-600';
      case 'rose':
      case 'red':
      case 'amber':
      case 'orange': return 'text-[#BD1D2D]';
      case 'emerald': return 'text-emerald-600';
      default: return 'text-slate-700';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { onClose(); reset(); }}
      title={step === 1 ? "Chọn mẫu kịch bản tự động hóa" : "Đặt tên kịch bản"}
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
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 px-1 pb-2 border-b border-slate-100">
            {FLOW_TEMPLATE_CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-2 rounded-xl text-[11px] font-bold transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[var(--color-primary)] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-1">
            {filteredTemplates.map((tpl: any) => {
              const isSelected = selectedTemplate?.id === tpl.id;
              return (
                <div
                  key={tpl.id}
                  onClick={() => setSelectedTemplate(tpl)}
                  className={`p-6 rounded-2xl border cursor-pointer transition-[border-color,background-color,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] flex flex-col gap-4 relative overflow-hidden group ${getBorderClass(tpl.theme, isSelected)}`}
                >
                  <div className={`absolute top-4 right-4 bg-white rounded-full p-1.5 shadow-sm border border-slate-200 transition-[transform,opacity] duration-200 ${isSelected ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>
                    <Check className={`w-3.5 h-3.5 ${getCheckColor(tpl.theme)} stroke-[3]`} />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-200"
                    >
                      <AppIcon name={tpl.appIconKey} size={52} className="rounded-xl shadow-sm" />
                    </div>
                    {tpl.badge && (
                      <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold uppercase tracking-wider">
                        {tpl.badge}
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-[15px] mb-1.5 group-hover:text-[var(--color-primary)] transition-colors">{tpl.name}</h4>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{tpl.desc}</p>
                    <div className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 tabular-nums">
                      <Zap className="w-3 h-3 text-amber-500" />
                      <span>{tpl.steps?.length || 0} bước tự động</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 animate-in slide-in-from-right-8 duration-200 p-1">
          <Input label="Tên kịch bản nội bộ" placeholder="VD: Chào mừng Khách hàng từ Form Landing Page" value={flowName} onChange={(e) => setFlowName(e.target.value)} autoFocus />
          <div className="p-5 bg-blue-50 border border-blue-200/80 rounded-xl flex gap-3">
            <Info className="w-4 h-4 text-blue-600 mt-1" />
            <p className="text-[11px] text-blue-700 font-semibold leading-relaxed">Hệ thống sẽ tự động cấu hình các bước cơ bản theo logic của kịch bản "{selectedTemplate?.name}". Bạn có thể chỉnh sửa chi tiết sau khi tạo.</p>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default FlowCreationModal;