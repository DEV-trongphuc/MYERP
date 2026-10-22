import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  Activity,
  Globe,
  Mail,
  GitBranch,
  ClipboardCheck,
  Ticket,
  MessageSquare,
  Plus,
  Play,
  Pause,
  LogOut,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Flame,
  Eye,
  MousePointerClick,
  QrCode,
  Search,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  Loader2,
  Send,
  Layers,
  X
} from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import { canViewOmnichannelJourney } from '../../utils/roleUtils';

interface CustomerOmnichannelJourneyTabProps {
  contact: any;
  onRefreshContact?: () => void;
}

const CANONICAL_CHART_PALETTE = [
  '#C6333D',
  '#334155',
  '#E11D48',
  '#64748B',
  '#991B1B',
  '#475569',
  '#FB7185',
  '#94A3B8',
  '#1E293B',
  '#CBD5E1'
];

const getCompletenessTone = (pct: number) => {
  if (pct >= 80) {
    return { bar: '#10b981', dot: '#10b981', text: '#059669', bg: '#ecfdf5' };
  }
  if (pct >= 50) {
    return { bar: '#f59e0b', dot: '#f59e0b', text: '#d97706', bg: '#fffbeb' };
  }
  return { bar: '#ef4444', dot: '#ef4444', text: '#dc2626', bg: '#fef2f2' };
};

const formatDateTimeVN = (val?: string | null): string => {
  if (!val) return 'Chưa ghi nhận';
  const clean = String(val).replace(' ', 'T');
  const d = new Date(clean);
  if (isNaN(d.getTime())) return String(val);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const CustomerOmnichannelJourneyTab: React.FC<CustomerOmnichannelJourneyTabProps> = ({
  contact,
  onRefreshContact
}) => {
  const { user } = useAuth();
  const hasAccess = canViewOmnichannelJourney(user);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [journeyData, setJourneyData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sub-tabs in unified workspace
  const [activeSubTab, setActiveSubTab] = useState<'timeline' | 'conversations' | 'flows' | 'surveys' | 'web'>('timeline');
  const [timelineChannelFilter, setTimelineChannelFilter] = useState<
    'all' | 'web' | 'email' | 'flow' | 'survey' | 'voucher'
  >('all');

  // Linked Conversations filter & active thread
  const [convChannel, setConvChannel] = useState<'all' | 'web_ai' | 'meta' | 'zalo'>('all');
  const [selectedConv, setSelectedConv] = useState<any>(null);

  // Modals for interactive actions
  const [showEnrollModal, setShowEnrollModal] = useState<boolean>(false);
  const [availableFlows, setAvailableFlows] = useState<any[]>([]);
  const [enrollFlowId, setEnrollFlowId] = useState<string>('');
  const [enrollFlowName, setEnrollFlowName] = useState<string>('');
  const [enrollNote, setEnrollNote] = useState<string>('');

  const [showIssueVoucherModal, setShowIssueVoucherModal] = useState<boolean>(false);
  const [availableVouchers, setAvailableVouchers] = useState<any[]>([]);
  const [voucherCodeInput, setVoucherCodeInput] = useState<string>('');
  const [voucherCampaignId, setVoucherCampaignId] = useState<string>('');
  const [voucherDiscountValue, setVoucherDiscountValue] = useState<string>('');
  const [voucherNote, setVoucherNote] = useState<string>('');

  const [expandedSurveyId, setExpandedSurveyId] = useState<string | number | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | number | null>(null);

  // Synchronous Ref Guard against rapid spam clicks
  const inFlightRef = useRef<boolean>(false);
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);

  const fetchJourney = useCallback(
    async (signal?: AbortSignal, isSilent = false) => {
      if (!contact?.id) return;
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setErrorMsg(null);

      try {
        const res = await api.get(`/contacts/${contact.id}/omnichannel-journey`, { signal });
        const payload = res.data?.data ?? res.data ?? {};
        setJourneyData(payload);
      } catch (err: any) {
        if (
          err?.name === 'AbortError' ||
          err?.name === 'CanceledError' ||
          err?.code === 'ERR_CANCELED'
        ) {
          return;
        }
        setErrorMsg(err?.response?.data?.message || 'Không thể tải dữ liệu Hành trình Đa kênh 360°');
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [contact?.id]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchJourney(controller.signal, false);
    return () => {
      controller.abort();
    };
  }, [fetchJourney]);

  // Load flows / vouchers options when modal opens
  const openEnrollFlowModal = async () => {
    setShowEnrollModal(true);
    if (Array.isArray(journeyData?.available_flows) && journeyData.available_flows.length > 0) {
      setAvailableFlows(journeyData.available_flows);
      return;
    }
    try {
      const res = await api.get('/domation/flows');
      const list = res.data?.data?.items || res.data?.data || res.data || [];
      if (Array.isArray(list)) setAvailableFlows(list);
    } catch {
      // Fallback if endpoint returns empty
    }
  };

  const openIssueVoucherModal = async () => {
    setShowIssueVoucherModal(true);
    if (Array.isArray(journeyData?.available_campaigns) && journeyData.available_campaigns.length > 0) {
      setAvailableVouchers(journeyData.available_campaigns);
      return;
    }
    try {
      const res = await api.get('/domation/voucher_campaigns');
      const list = res.data?.data?.items || res.data?.data || res.data || [];
      if (Array.isArray(list)) setAvailableVouchers(list);
    } catch {
      // Fallback if endpoint returns empty
    }
  };

  // Action 1: Enroll contact into Automation Flow
  const handleEnrollFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact?.id) return;
    if (!enrollFlowId && !enrollFlowName.trim()) {
      toast.error('Vui lòng chọn hoặc nhập tên Kịch bản Automation');
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setSubmittingAction('enroll-flow');

    try {
      await api.post(`/contacts/${contact.id}/enroll-flow`, {
        flow_id: enrollFlowId ? String(enrollFlowId) : undefined,
        flow_name: enrollFlowName.trim() || undefined,
        note: enrollNote.trim() || undefined
      });
      toast.success('Đã đưa khách hàng vào kịch bản Automation!');
      setShowEnrollModal(false);
      setEnrollFlowId('');
      setEnrollFlowName('');
      setEnrollNote('');
      await fetchJourney(undefined, true);
      onRefreshContact?.();
      window.dispatchEvent(new CustomEvent('contact-updated', { detail: { contactId: contact.id } }));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lỗi khi đưa khách hàng vào kịch bản');
    } finally {
      inFlightRef.current = false;
      setSubmittingAction(null);
    }
  };

  // Action 2: Pause / Resume / Exit Automation Flow
  const handleFlowStateChange = async (
    flowItem: any,
    action: 'pause' | 'resume' | 'exit'
  ) => {
    if (!contact?.id) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const actionKey = `flow-state-${flowItem?.id || flowItem?.flow_id || 'default'}-${action}`;
    setSubmittingAction(actionKey);

    try {
      await api.post(`/contacts/${contact.id}/flow-state`, {
        state_id: flowItem?.state_id || flowItem?.enrollment_id || flowItem?.id,
        enrollment_id: flowItem?.enrollment_id || flowItem?.id,
        flow_id: flowItem?.flow_id || flowItem?.id,
        flow_name: flowItem?.flow_name || flowItem?.name,
        action,
        status: action === 'pause' ? 'paused' : action === 'resume' ? 'active' : 'exited'
      });
      const labelMap = {
        pause: 'Đã tạm dừng kịch bản Automation',
        resume: 'Đã tiếp tục chạy kịch bản Automation',
        exit: 'Đã cho khách hàng rời kịch bản Automation'
      };
      toast.success(labelMap[action]);
      await fetchJourney(undefined, true);
      onRefreshContact?.();
      window.dispatchEvent(new CustomEvent('contact-updated', { detail: { contactId: contact.id } }));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể cập nhật trạng thái kịch bản');
    } finally {
      inFlightRef.current = false;
      setSubmittingAction(null);
    }
  };

  // Action 3: Issue Voucher
  const handleIssueVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact?.id) return;
    if (!voucherCodeInput.trim() && !voucherCampaignId) {
      toast.error('Vui lòng chọn chiến dịch Voucher hoặc nhập mã ưu đãi');
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setSubmittingAction('issue-voucher');

    try {
      await api.post(`/contacts/${contact.id}/issue-voucher`, {
        voucher_code: voucherCodeInput.trim() || undefined,
        campaign_id: voucherCampaignId ? Number(voucherCampaignId) || voucherCampaignId : undefined,
        voucher_id: voucherCampaignId ? Number(voucherCampaignId) || voucherCampaignId : undefined,
        discount_value: voucherDiscountValue ? Number(voucherDiscountValue) : undefined,
        note: voucherNote.trim() || undefined
      });
      toast.success('Đã cấp mã ưu đãi (Voucher) cho khách hàng!');
      setShowIssueVoucherModal(false);
      setVoucherCodeInput('');
      setVoucherCampaignId('');
      setVoucherDiscountValue('');
      setVoucherNote('');
      await fetchJourney(undefined, true);
      onRefreshContact?.();
      window.dispatchEvent(new CustomEvent('contact-updated', { detail: { contactId: contact.id } }));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lỗi khi cấp mã ưu đãi');
    } finally {
      inFlightRef.current = false;
      setSubmittingAction(null);
    }
  };

  // Action 4: Redeem Voucher
  const handleRedeemVoucher = async (codeToRedeem?: string) => {
    if (!contact?.id) return;
    const targetCode =
      codeToRedeem ||
      summary.active_voucher_code ||
      contact?.active_voucher_code ||
      '';
    if (!targetCode) {
      toast.error('Khách hàng chưa có mã ưu đãi khả dụng để gạch mã');
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setSubmittingAction(`redeem-${targetCode}`);

    try {
      await api.post(`/contacts/${contact.id}/redeem-voucher`, {
        voucher_code: targetCode,
        code: targetCode
      });
      toast.success(`Đã gạch mã ưu đãi ${targetCode} thành công!`);
      await fetchJourney(undefined, true);
      onRefreshContact?.();
      window.dispatchEvent(new CustomEvent('contact-updated', { detail: { contactId: contact.id } }));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lỗi khi gạch mã ưu đãi');
    } finally {
      inFlightRef.current = false;
      setSubmittingAction(null);
    }
  };

  // Merge contact fields + API response summary
  const summary = useMemo(() => {
    const s = journeyData?.summary || journeyData?.metrics || journeyData || {};
    const rawWebSessions = Array.isArray(journeyData?.web_sessions)
      ? journeyData.web_sessions
      : Array.isArray(journeyData?.web_sessions?.sessions)
      ? journeyData.web_sessions.sessions
      : Array.isArray(journeyData?.sessions)
      ? journeyData.sessions
      : [];

    const webPageviewsCount = Number(
      s.web_pageviews_count ?? contact?.web_pageviews_count ?? 0
    );
    const maxScrollDepth = Number(
      s.max_scroll_depth ?? contact?.max_scroll_depth ?? 0
    );
    const lastWebVisitAt =
      s.last_web_visit_at ?? contact?.last_web_visit_at ?? null;

    const webSessionsCount = Math.max(
      Number(s.web_sessions_count ?? contact?.web_sessions_count ?? 0),
      rawWebSessions.length,
      webPageviewsCount > 0 || Boolean(lastWebVisitAt) ? 1 : 0
    );

    const statsEmailSent = Number(
      s.stats_email_sent ?? contact?.stats_email_sent ?? 0
    );
    const statsEmailOpened = Number(
      s.stats_email_opened ?? contact?.stats_email_opened ?? 0
    );
    const statsEmailClicked = Number(
      s.stats_email_clicked ?? contact?.stats_email_clicked ?? 0
    );
    const lastEmailOpenAt =
      s.last_email_open_at ?? contact?.last_email_open_at ?? null;
    const lastEmailClickAt =
      s.last_email_click_at ?? contact?.last_email_click_at ?? null;

    const activeFlowCount = Number(
      s.active_flow_count ??
        (Array.isArray(journeyData?.active_flows) ? journeyData.active_flows.length : undefined) ??
        contact?.active_flow_count ??
        0
    );
    const completedFlowCount = Number(
      s.completed_flow_count ??
        (Array.isArray(journeyData?.completed_flows) ? journeyData.completed_flows.length : undefined) ??
        (Array.isArray(journeyData?.flow_history) ? journeyData.flow_history.length : undefined) ??
        contact?.completed_flow_count ??
        0
    );
    const activeFlowNames =
      s.active_flow_names ??
      contact?.active_flow_names ??
      (Array.isArray(journeyData?.active_flows)
        ? journeyData.active_flows.map((f: any) => f.flow_name || f.name).filter(Boolean).join(', ')
        : '');

    const surveyCompletedCount = Number(
      s.survey_completed_count ??
        (Array.isArray(journeyData?.survey_responses) ? journeyData.survey_responses.length : undefined) ??
        (Array.isArray(journeyData?.surveys) ? journeyData.surveys.length : undefined) ??
        contact?.survey_completed_count ??
        0
    );
    const activeVoucherCode =
      s.active_voucher_code ?? contact?.active_voucher_code ?? '';
    const marketingStatus =
      s.marketing_status ?? contact?.marketing_status ?? 'subscribed';

    return {
      web_sessions_count: webSessionsCount,
      web_pageviews_count: webPageviewsCount,
      max_scroll_depth: maxScrollDepth,
      last_web_visit_at: lastWebVisitAt,
      stats_email_sent: statsEmailSent,
      stats_email_opened: statsEmailOpened,
      stats_email_clicked: statsEmailClicked,
      last_email_open_at: lastEmailOpenAt,
      last_email_click_at: lastEmailClickAt,
      active_flow_count: activeFlowCount,
      completed_flow_count: completedFlowCount,
      active_flow_names: activeFlowNames,
      survey_completed_count: surveyCompletedCount,
      active_voucher_code: activeVoucherCode,
      marketing_status: marketingStatus
    };
  }, [journeyData, contact]);

  const activeFlows: any[] = useMemo(() => {
    if (Array.isArray(journeyData?.active_flows)) return journeyData.active_flows;
    if (Array.isArray(journeyData?.flows)) {
      return journeyData.flows.filter((f: any) =>
        ['active', 'waiting', 'processing', 'paused'].includes(String(f.status || ''))
      );
    }
    if (summary.active_flow_names) {
      return String(summary.active_flow_names)
        .split(',')
        .map((n: string, idx: number) => ({
          id: `flow-${idx}`,
          flow_name: n.trim(),
          status: 'active'
        }))
        .filter((f: any) => f.flow_name);
    }
    return [];
  }, [journeyData, summary.active_flow_names]);

  const completedFlows: any[] = useMemo(() => {
    if (Array.isArray(journeyData?.completed_flows)) return journeyData.completed_flows;
    if (Array.isArray(journeyData?.flow_history)) return journeyData.flow_history;
    if (Array.isArray(journeyData?.flows)) {
      return journeyData.flows.filter((f: any) => f.status === 'completed' || f.status === 'exited');
    }
    return [];
  }, [journeyData]);

  const surveyResponses: any[] = useMemo(() => {
    return Array.isArray(journeyData?.survey_responses)
      ? journeyData.survey_responses
      : Array.isArray(journeyData?.surveys)
      ? journeyData.surveys
      : [];
  }, [journeyData]);

  const webSessions: any[] = useMemo(() => {
    const raw = Array.isArray(journeyData?.web_sessions)
      ? journeyData.web_sessions
      : Array.isArray(journeyData?.web_sessions?.sessions)
      ? journeyData.web_sessions.sessions
      : Array.isArray(journeyData?.sessions)
      ? journeyData.sessions
      : [];
    if (raw.length > 0) return raw;
    if (summary.web_pageviews_count > 0 || summary.last_web_visit_at) {
      const pvs = Array.isArray(journeyData?.web_page_views) && journeyData.web_page_views.length > 0
        ? journeyData.web_page_views
        : [
            {
              id: 'pv-summary',
              page_title: `Truy cập & xem nội dung Website (${summary.web_pageviews_count || 1} trang)`,
              url: 'Website',
              scroll_depth: summary.max_scroll_depth || 0,
              time_on_page: 0,
              loaded_at: summary.last_web_visit_at
            }
          ];
      return [
        {
          id: 'ws-summary',
          landing_page: `Truy cập Website (${summary.web_pageviews_count || 1} lượt xem)`,
          started_at: summary.last_web_visit_at,
          device_type: 'Website',
          max_scroll_depth: summary.max_scroll_depth || 0,
          pageviews_count: summary.web_pageviews_count || 1,
          page_views: pvs
        }
      ];
    }
    return [];
  }, [journeyData, summary.web_pageviews_count, summary.last_web_visit_at, summary.max_scroll_depth]);

  const vouchersList: any[] = useMemo(() => {
    return Array.isArray(journeyData?.vouchers)
      ? journeyData.vouchers
      : Array.isArray(journeyData?.voucher_history)
      ? journeyData.voucher_history
      : [];
  }, [journeyData]);

  // Linked Omnichannel Conversations (Web AI Chat, Meta Fanpage, Zalo OA)
  const linkedConversations = useMemo(() => {
    const rawChatMsgs: any[] = Array.isArray(journeyData?.chat_messages) ? journeyData.chat_messages : [];
    const domationAi = Array.isArray(journeyData?.domation_ai_conversations)
      ? journeyData.domation_ai_conversations.map((c: any) => ({ ...c, _channel: 'web_ai', _channelLabel: 'Web AI Chat' }))
      : Array.isArray(journeyData?.linked_conversations?.domation_ai_conversations)
      ? journeyData.linked_conversations.domation_ai_conversations.map((c: any) => ({ ...c, _channel: 'web_ai', _channelLabel: 'Web AI Chat' }))
      : [];

    const metaConvs = Array.isArray(journeyData?.meta_conversations)
      ? journeyData.meta_conversations.map((c: any) => ({ ...c, _channel: 'meta', _channelLabel: 'Meta Fanpage' }))
      : Array.isArray(journeyData?.linked_conversations?.meta_conversations)
      ? journeyData.linked_conversations.meta_conversations.map((c: any) => ({ ...c, _channel: 'meta', _channelLabel: 'Meta Fanpage' }))
      : [];

    const zaloMsgs = Array.isArray(journeyData?.zalo_user_messages)
      ? journeyData.zalo_user_messages.map((c: any) => ({ ...c, _channel: 'zalo', _channelLabel: 'Zalo OA' }))
      : Array.isArray(journeyData?.linked_conversations?.zalo_user_messages)
      ? journeyData.linked_conversations.zalo_user_messages.map((c: any) => ({ ...c, _channel: 'zalo', _channelLabel: 'Zalo OA' }))
      : [];

    const chatFallback =
      domationAi.length === 0 && metaConvs.length === 0 && zaloMsgs.length === 0
        ? rawChatMsgs.map((m: any, idx: number) => ({
            id: m.raw?.id || `chat-${idx}`,
            _channel: m.channel === 'zalo' ? 'zalo' : m.channel === 'meta' ? 'meta' : 'web_ai',
            _channelLabel: m.channel === 'zalo' ? 'Zalo OA' : m.channel === 'meta' ? 'Meta Fanpage' : 'Web AI Chat',
            visitor_name: m.sender_name,
            last_message: m.content,
            created_at: m.occurred_at
          }))
        : [];

    const combined = [...domationAi, ...metaConvs, ...zaloMsgs, ...chatFallback];
    if (convChannel === 'all') return combined;
    return combined.filter((item) => item._channel === convChannel);
  }, [journeyData, convChannel]);

  // All Timeline Events (before channel filter)
  const allTimelineEvents = useMemo(() => {
    const rawTimeline: any[] = Array.isArray(journeyData?.unified_timeline)
      ? journeyData.unified_timeline
      : Array.isArray(journeyData?.timeline)
      ? journeyData.timeline
      : [];

    const synthesized: any[] = rawTimeline.map((item: any) => ({
      ...item,
      description: item.description || item.subtitle || '',
      created_at: item.created_at || item.occurred_at || item.timestamp
    }));

    const hasEmailEvent = synthesized.some((ev) => {
      const ch = String(ev.channel || ev.event_type || '').toLowerCase();
      return ch.includes('email') || ch.includes('mail') || ch.includes('zns');
    });
    const hasWebEvent = synthesized.some((ev) => {
      const ch = String(ev.channel || ev.event_type || '').toLowerCase();
      return ch.includes('web') || ch.includes('page') || ch.includes('visit');
    });

    if (!hasEmailEvent && (summary.stats_email_sent > 0 || summary.stats_email_opened > 0 || summary.stats_email_clicked > 0)) {
      if (summary.stats_email_clicked > 0) {
        synthesized.push({
          id: 'synth-email-click',
          channel: 'email',
          title: `Click liên kết trong Email (${summary.stats_email_clicked} lượt click)`,
          description: 'Khách hàng đã bấm vào đường dẫn trong Email chăm sóc',
          created_at: summary.last_email_click_at || summary.last_email_open_at
        });
      }
      if (summary.stats_email_opened > 0) {
        synthesized.push({
          id: 'synth-email-open',
          channel: 'email',
          title: `Mở đọc Email (${summary.stats_email_opened} lượt mở)`,
          description: `Đã gửi ${summary.stats_email_sent} email • Mở đọc ${summary.stats_email_opened} lần${summary.stats_email_clicked > 0 ? ` • Click ${summary.stats_email_clicked} lần` : ''}`,
          created_at: summary.last_email_open_at
        });
      }
      if (summary.stats_email_sent > 0) {
        synthesized.push({
          id: 'synth-email-sent',
          channel: 'email',
          title: `Đã gửi Email Marketing (${summary.stats_email_sent} email)`,
          description: 'Lịch sử gửi Email & ZNS tự động cho khách hàng',
          created_at: summary.last_email_open_at
        });
      }
    }

    if (!hasWebEvent && webSessions.length > 0) {
      webSessions.forEach((ws: any, idx: number) => {
        synthesized.push({
          id: `ws-${ws.id || idx}`,
          channel: 'web',
          title: `Truy cập Website (${ws.pageviews_count || summary.web_pageviews_count || 1} lượt xem trang)`,
          description: ws.landing_page || ws.url || `Cuộn trang tối đa ${ws.max_scroll_depth ?? summary.max_scroll_depth ?? 0}%`,
          created_at: ws.started_at || ws.created_at || ws.last_active_at || summary.last_web_visit_at
        });
      });
    }

    if (synthesized.length === 0) {
      activeFlows.forEach((fl: any, idx: number) => {
        synthesized.push({
          id: `fl-a-${fl.id || idx}`,
          channel: 'flow',
          title: `Đang chạy kịch bản: ${fl.flow_name || fl.name}`,
          description: `Bước hiện tại: ${fl.step_label || fl.current_step_name || fl.current_node || 'Đang xử lý'}`,
          created_at: fl.enrolled_at || fl.updated_at || fl.created_at
        });
      });
      completedFlows.forEach((fl: any, idx: number) => {
        synthesized.push({
          id: `fl-c-${fl.id || idx}`,
          channel: 'flow',
          title: `Hoàn tất kịch bản: ${fl.flow_name || fl.name}`,
          description: `Trạng thái: Đã hoàn tất`,
          created_at: fl.completed_at || fl.updated_at || fl.created_at
        });
      });
      surveyResponses.forEach((sr: any, idx: number) => {
        synthesized.push({
          id: `sr-${sr.id || idx}`,
          channel: 'survey',
          title: `Hoàn thành Khảo sát: ${sr.survey_title || sr.title || `#${sr.id || idx + 1}`}`,
          description: 'Đã gửi câu trả lời khảo sát',
          created_at: sr.submitted_at || sr.created_at
        });
      });
      vouchersList.forEach((vc: any, idx: number) => {
        synthesized.push({
          id: `vc-${vc.id || idx}`,
          channel: 'voucher',
          title: `Mã ưu đãi ${vc.code || vc.voucher_code}`,
          description: vc.status === 'used' || vc.status === 'redeemed' ? 'Đã sử dụng' : 'Đang có hiệu lực',
          created_at: vc.used_at || vc.redeemed_at || vc.issued_at || vc.created_at
        });
      });
    }

    return synthesized;
  }, [journeyData, summary, webSessions, activeFlows, completedFlows, surveyResponses, vouchersList]);

  // Filtered Omnichannel Timeline
  const unifiedTimeline = useMemo(() => {
    return allTimelineEvents.filter((item) => {
      if (timelineChannelFilter === 'all') return true;
      const ch = String(item.channel || item.event_type || item.type || '').toLowerCase();
      if (timelineChannelFilter === 'web') return ch.includes('web') || ch.includes('page') || ch.includes('visit');
      if (timelineChannelFilter === 'email') return ch.includes('email') || ch.includes('zns') || ch.includes('mail') || ch.includes('zalo');
      if (timelineChannelFilter === 'flow') return ch.includes('flow') || ch.includes('automation');
      if (timelineChannelFilter === 'survey') return ch.includes('survey') || ch.includes('quiz') || ch.includes('form');
      if (timelineChannelFilter === 'voucher') return ch.includes('voucher') || ch.includes('qr') || ch.includes('coupon');
      return true;
    });
  }, [allTimelineEvents, timelineChannelFilter]);

  if (!hasAccess) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        Bạn không có quyền truy cập dữ liệu Hành trình tương tác.
      </div>
    );
  }

  const openRate =
    summary.stats_email_sent > 0
      ? Math.min(100, Math.round((summary.stats_email_opened / summary.stats_email_sent) * 100))
      : summary.stats_email_opened > 0
      ? 100
      : 0;
  const clickRate =
    summary.stats_email_opened > 0
      ? Math.min(100, Math.round((summary.stats_email_clicked / summary.stats_email_opened) * 100))
      : 0;

  const channelStats = useMemo(() => {
    const emailCount = Number(summary.stats_email_sent || 0);
    const webCount = Number((summary.web_sessions_count || 0) + (summary.web_pageviews_count || 0));
    const flowCount = Number((summary.active_flow_count || 0) + (summary.completed_flow_count || 0));
    const surveyCount = Number(summary.survey_completed_count || 0);
    const chatCount = Number(linkedConversations.length + (summary.active_voucher_code ? 1 : 0));
    const subTotal = emailCount + webCount + flowCount + surveyCount + chatCount;
    const crmCount = Math.max(0, allTimelineEvents.length - subTotal);
    const total = Math.max(subTotal + crmCount, allTimelineEvents.length, 1);

    const rawItems = [
      { id: 'email', name: 'Email & ZNS', count: emailCount, color: CANONICAL_CHART_PALETTE[0] },
      { id: 'web', name: 'Website & UTM', count: webCount, color: CANONICAL_CHART_PALETTE[1] },
      { id: 'flow', name: 'Automation Flow', count: flowCount, color: CANONICAL_CHART_PALETTE[2] },
      { id: 'survey', name: 'Khảo sát / Lead Form', count: surveyCount, color: CANONICAL_CHART_PALETTE[3] },
      { id: 'chat', name: 'Hội thoại & Voucher', count: chatCount, color: CANONICAL_CHART_PALETTE[4] },
      { id: 'crm', name: 'Tương tác CRM', count: crmCount, color: CANONICAL_CHART_PALETTE[5] }
    ];

    const items = rawItems
      .map((item) => ({
        ...item,
        pct: total > 0 ? Math.round((item.count / total) * 1000) / 10 : 0
      }))
      .sort((a, b) => b.count - a.count);

    return { items, total };
  }, [summary, linkedConversations.length, allTimelineEvents.length]);

  const profileCompleteness = useMemo(() => {
    const fields = [
      contact?.full_name,
      contact?.phone,
      contact?.email,
      contact?.utm_campaign || contact?.source || contact?.campaign_name,
      contact?.program || contact?.school,
      contact?.job_title,
      contact?.company,
      contact?.address || contact?.city
    ];
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  }, [contact]);

  const engagementHealthPct = useMemo(() => {
    const totalScore = (allTimelineEvents.length * 12) + (summary.stats_email_opened * 18) + (summary.web_pageviews_count * 6);
    return Math.min(100, Math.max(15, Math.round(totalScore / 1.4) || (allTimelineEvents.length > 0 ? 60 : 20)));
  }, [allTimelineEvents.length, summary.stats_email_opened, summary.web_pageviews_count]);

  const mktStatusBadge = (() => {
    const st = String(summary.marketing_status || 'subscribed').toLowerCase();
    if (st === 'unsubscribed' || st === 'opt_out') {
      return { label: 'Đã hủy đăng ký', color: '#d97706', bg: 'rgba(245, 158, 11, 0.1)' };
    }
    if (st === 'bounced' || st === 'complained' || st === 'invalid') {
      return { label: 'Email lỗi', color: '#dc2626', bg: 'rgba(239, 68, 68, 0.1)' };
    }
    return { label: 'Đang nhận Email', color: '#059669', bg: 'rgba(16, 185, 129, 0.1)' };
  })();

  const getChannelBadgeMeta = (rawCh: string) => {
    const ch = String(rawCh || '').toLowerCase();
    if (ch.includes('web') || ch.includes('page')) {
      return { label: 'Website', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.1)' };
    }
    if (ch.includes('email') || ch.includes('mail') || ch.includes('zns')) {
      return { label: 'Email / ZNS', color: '#db2777', bg: 'rgba(219, 39, 119, 0.1)' };
    }
    if (ch.includes('flow') || ch.includes('automation')) {
      return { label: 'Automation', color: '#4f46e5', bg: 'rgba(79, 70, 229, 0.1)' };
    }
    if (ch.includes('survey') || ch.includes('quiz')) {
      return { label: 'Khảo sát', color: '#d97706', bg: 'rgba(217, 119, 6, 0.1)' };
    }
    if (ch.includes('voucher')) {
      return { label: 'Voucher', color: '#059669', bg: 'rgba(5, 150, 105, 0.1)' };
    }
    return { label: rawCh || 'Tương tác', color: '#475569', bg: 'rgba(100, 116, 139, 0.12)' };
  };

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '1.5rem' }}>
      {/* 1. TOP HEADER BAR — Clean White Executive Card */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          padding: '0.85rem 1.15rem',
          borderRadius: 14,
          border: '1px solid #e2e8f0',
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'rgba(189, 29, 45, 0.08)',
              color: '#BD1D2D',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Activity size={15} />
          </div>
          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
            Hành trình tương tác đa kênh 360°
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 8px',
              borderRadius: 6,
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#334155',
              background: '#f1f5f9',
              border: 'none'
            }}
          >
            {mktStatusBadge.label}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={openEnrollFlowModal}
            style={{
              height: 32,
              padding: '0 12px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              color: '#0f172a',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          >
            <Plus size={13} style={{ color: '#BD1D2D' }} />
            <span>+ Gán Kịch bản</span>
          </button>
          <button
            type="button"
            onClick={openIssueVoucherModal}
            style={{
              height: 32,
              padding: '0 12px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              color: '#0f172a',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          >
            <Ticket size={13} style={{ color: '#334155' }} />
            <span>Cấp Voucher</span>
          </button>
          {summary.active_voucher_code && (
            <button
              type="button"
              onClick={() => handleRedeemVoucher(summary.active_voucher_code)}
              disabled={Boolean(submittingAction)}
              style={{
                height: 32,
                padding: '0 12px',
                borderRadius: 8,
                border: '1px solid #10b981',
                background: '#ecfdf5',
                color: '#059669',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <CheckCircle2 size={13} />
              <span>Redeem ({summary.active_voucher_code})</span>
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.08)',
            color: '#dc2626',
            fontSize: '0.78rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <AlertCircle size={14} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 2. 4 CANONICAL TOP KPI CARDS (Matching CustomerPersonaOverviewDeck.tsx 100%) */}
      <div className="dashboard-kpi-grid" style={{ marginBottom: 0 }}>
        {/* KPI 1: DẤU CHÂN SỐ ĐA KÊNH */}
        <div
          className="stat-card"
          onClick={() => {
            setActiveSubTab('timeline');
            setTimelineChannelFilter('all');
          }}
          style={{
            minHeight: '132px',
            display: 'flex',
            flexDirection: 'column',
            cursor: 'pointer',
            border: activeSubTab === 'timeline' && timelineChannelFilter === 'all'
              ? '1.5px solid #0f172a'
              : '1px solid #e2e8f0',
            background: activeSubTab === 'timeline' && timelineChannelFilter === 'all'
              ? '#f8fafc'
              : '#ffffff',
            borderRadius: 16,
            padding: '1.15rem 1.25rem',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span
              className="stat-label"
              style={{
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontWeight: 700,
                fontSize: '0.73rem',
                color: '#64748b'
              }}
            >
              DẤU CHÂN SỐ ĐA KÊNH
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(189, 29, 45, 0.08)',
                color: '#BD1D2D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Activity size={16} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
            {allTimelineEvents.length.toLocaleString('vi-VN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px', fontWeight: 500, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span>• Website: <strong style={{ color: '#0f172a' }}>{summary.web_sessions_count} phiên</strong></span>
            <span>• Chat: <strong style={{ color: '#0f172a' }}>{linkedConversations.length} hội thoại</strong></span>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '8px', fontSize: '0.73rem', color: '#64748b', fontWeight: 500 }}>
            Tổng hợp toàn bộ điểm chạm đa kênh
          </div>
        </div>

        {/* KPI 2: CHIẾN DỊCH EMAIL & ZNS */}
        <div
          className="stat-card"
          onClick={() => {
            setActiveSubTab('timeline');
            setTimelineChannelFilter('email');
          }}
          style={{
            minHeight: '132px',
            display: 'flex',
            flexDirection: 'column',
            cursor: 'pointer',
            border: activeSubTab === 'timeline' && timelineChannelFilter === 'email'
              ? '1.5px solid #0f172a'
              : '1px solid #e2e8f0',
            background: activeSubTab === 'timeline' && timelineChannelFilter === 'email'
              ? '#f8fafc'
              : '#ffffff',
            borderRadius: 16,
            padding: '1.15rem 1.25rem',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span
              className="stat-label"
              style={{
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontWeight: 700,
                fontSize: '0.73rem',
                color: '#64748b'
              }}
            >
              CHIẾN DỊCH EMAIL &amp; ZNS
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(189, 29, 45, 0.08)',
                color: '#BD1D2D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Mail size={16} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: '1.85rem', fontWeight: 800, color: '#BD1D2D', fontVariantNumeric: 'tabular-nums' }}>
            {summary.stats_email_sent.toLocaleString('vi-VN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px', fontWeight: 500, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span>• Đã mở: <strong style={{ color: '#0f172a' }}>{summary.stats_email_opened} ({openRate}%)</strong></span>
            <span>• Click: <strong style={{ color: '#0f172a' }}>{clickRate}%</strong></span>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '8px', fontSize: '0.73rem', color: '#64748b', fontWeight: 500 }}>
            Chiến dịch gửi đi &amp; tỷ lệ tương tác email
          </div>
        </div>

        {/* KPI 3: KỊCH BẢN AUTOMATION */}
        <div
          className="stat-card"
          onClick={() => setActiveSubTab('flows')}
          style={{
            minHeight: '132px',
            display: 'flex',
            flexDirection: 'column',
            cursor: 'pointer',
            border: activeSubTab === 'flows'
              ? '1.5px solid #0f172a'
              : '1px solid #e2e8f0',
            background: activeSubTab === 'flows'
              ? '#f8fafc'
              : '#ffffff',
            borderRadius: 16,
            padding: '1.15rem 1.25rem',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span
              className="stat-label"
              style={{
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontWeight: 700,
                fontSize: '0.73rem',
                color: '#64748b'
              }}
            >
              KỊCH BẢN AUTOMATION
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(15, 23, 42, 0.06)',
                color: '#334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <GitBranch size={16} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
            {summary.active_flow_count.toLocaleString('vi-VN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px', fontWeight: 500, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span>• Hoàn tất: <strong style={{ color: '#0f172a' }}>{summary.completed_flow_count} luồng</strong></span>
            <span>• Đang chạy: <strong style={{ color: '#0f172a' }}>{summary.active_flow_count}</strong></span>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '8px', fontSize: '0.73rem', color: '#64748b', fontWeight: 500 }}>
            Tự động hóa luồng nuôi dưỡng &amp; chăm sóc
          </div>
        </div>

        {/* KPI 4: KHẢO SÁT, FORM ADS & VOUCHER */}
        <div
          className="stat-card"
          onClick={() => setActiveSubTab('surveys')}
          style={{
            minHeight: '132px',
            display: 'flex',
            flexDirection: 'column',
            cursor: 'pointer',
            border: activeSubTab === 'surveys'
              ? '1.5px solid #0f172a'
              : '1px solid #e2e8f0',
            background: activeSubTab === 'surveys'
              ? '#f8fafc'
              : '#ffffff',
            borderRadius: 16,
            padding: '1.15rem 1.25rem',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span
              className="stat-label"
              style={{
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontWeight: 700,
                fontSize: '0.73rem',
                color: '#64748b'
              }}
            >
              KHẢO SÁT, FORM ADS &amp; VOUCHER
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(15, 23, 42, 0.06)',
                color: '#334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <ClipboardCheck size={16} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
            {summary.survey_completed_count.toLocaleString('vi-VN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px', fontWeight: 500, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span>• Đã nộp: <strong style={{ color: '#0f172a' }}>{summary.survey_completed_count} form</strong></span>
            <span>• Voucher: <strong style={{ color: '#0f172a' }}>{summary.active_voucher_code || 'Chưa cấp'}</strong></span>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '8px', fontSize: '0.73rem', color: '#64748b', fontWeight: 500 }}>
            Phản hồi khảo sát &amp; ưu đãi kích hoạt
          </div>
        </div>
      </div>

      {/* 3. CANONICAL DASHBOARD ANALYTICS ROW (Archetype 1 Ranked List + SVG Donut & Meta Ads Attribution / Health) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem' }}>
        {/* Left Card: Archetype 1 Ranked List + 148x148 SVG Donut */}
        <div
          className="card"
          style={{
            padding: '1.35rem',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            background: '#ffffff',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                Thống Kê Điểm Chạm Theo Kênh Tương Tác
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                Tỷ trọng phân bổ các điểm chạm đa kênh của khách hàng
              </p>
            </div>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                color: '#0f172a',
                fontSize: '0.74rem',
                fontWeight: 700
              }}
            >
              {allTimelineEvents.length} điểm chạm
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.15fr 0.85fr',
              gap: '1rem',
              alignItems: 'center'
            }}
          >
            {/* Ranked List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {channelStats.items.slice(0, 5).map((ch, idx) => (
                <div key={ch.id} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <span
                        style={{
                          width: '18px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: idx === 0 ? '#BD1D2D' : '#64748b'
                        }}
                      >
                        #{idx + 1}
                      </span>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          background: ch.color,
                          flexShrink: 0
                        }}
                      />
                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: idx === 0 ? 700 : 600,
                          color: '#0f172a',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {ch.name}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>
                        {ch.count}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        ({ch.pct}%)
                      </span>
                    </div>
                  </div>
                  <div style={{ marginLeft: 24, height: 6, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, Math.max(ch.pct, ch.count > 0 ? 5 : 0))}%`,
                        background: idx === 0 ? '#C6333D' : ch.color,
                        borderRadius: 4,
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* SVG Donut Chart */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderLeft: '1px solid #f1f5f9',
                paddingLeft: '0.5rem'
              }}
            >
              <div style={{ position: 'relative', width: 148, height: 148 }}>
                <svg width="148" height="148" viewBox="0 0 148 148" style={{ transform: 'rotate(-90deg)' }}>
                  <circle
                    cx="74"
                    cy="74"
                    r="54"
                    fill="transparent"
                    stroke="#f1f5f9"
                    strokeWidth="16"
                  />
                  {(() => {
                    const circ = 2 * Math.PI * 54;
                    let acc = 0;
                    return channelStats.items
                      .filter((it) => it.pct > 0)
                      .map((it, i) => {
                        const dash = (it.pct / 100) * circ;
                        const offset = acc;
                        acc += dash;
                        return (
                          <circle
                            key={it.id || i}
                            cx="74"
                            cy="74"
                            r="54"
                            fill="transparent"
                            stroke={it.color}
                            strokeWidth="16"
                            strokeDasharray={`${dash} ${circ}`}
                            strokeDashoffset={-offset}
                            strokeLinecap="round"
                          />
                        );
                      });
                  })()}
                </svg>
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none'
                  }}
                >
                  <span style={{ fontSize: '1.22rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
                    {channelStats.items[0]?.pct ? `${Math.round(channelStats.items[0].pct)}%` : '0%'}
                  </span>
                  <span style={{ fontSize: '0.69rem', color: '#64748b', marginTop: '3px' }}>
                    {channelStats.items[0]?.name?.split(' ')[0] || 'Đa kênh'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: '8px' }}>
                {channelStats.items.slice(0, 3).map((it) => (
                  <span key={it.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', color: '#64748b' }}>
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: it.color }} />
                    <span>{it.name.split('/')[0]}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: Archetype 5 / Meta Ads Attribution & Engagement Health */}
        <div
          className="card"
          style={{
            padding: '1.35rem',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            background: '#ffffff',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                Chất Lượng Tương Tác &amp; Nguồn Chuyển Đổi (Attribution)
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                Nhận diện chiến dịch Meta Ads / UTM &amp; Chỉ số sức khỏe số
              </p>
            </div>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                color: '#BD1D2D',
                fontSize: '0.74rem',
                fontWeight: 700
              }}
            >
              UTM / Meta Tracked
            </span>
          </div>

          {/* Meta Ads & Attribution Details Box + Live Ad Preview Iframe */}
          {(() => {
            const metaAttr = journeyData?.meta_attribution || journeyData?.summary?.meta_attribution || null;
            const rawAdId = String(metaAttr?.ad_id || contact?.ad_id || '').trim();
            const cleanAdId = rawAdId.replace(/[^0-9]/g, '');
            const adPreview = metaAttr?.ad_preview || null;
            const campaignName = metaAttr?.campaign_name || contact?.utm_campaign || contact?.campaign_name || 'Chưa ghi nhận';
            const adsetName = metaAttr?.adset_name || contact?.utm_medium || contact?.adset_name || 'Chưa ghi nhận';
            const adOrFormName = metaAttr?.ad_name || metaAttr?.form_name || contact?.utm_content || contact?.form_name || 'Chưa ghi nhận';
            const sourceName = metaAttr?.platform
              ? `${String(metaAttr.platform).toUpperCase()} (${metaAttr.form_name || metaAttr.sheet_source || 'Meta Lead'})`
              : (contact?.source || contact?.source_detail || 'Chưa ghi nhận');

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '8px',
                    fontSize: '0.76rem'
                  }}
                >
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.71rem', display: 'block' }}>Chiến dịch (Campaign):</span>
                    <strong style={{ color: '#0f172a', fontWeight: 700, wordBreak: 'break-word' }}>
                      {campaignName}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.71rem', display: 'block' }}>Nhóm QC (AdSet / Medium):</span>
                    <strong style={{ color: '#0f172a', fontWeight: 700, wordBreak: 'break-word' }}>
                      {adsetName}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.71rem', display: 'block' }}>Bài QC / Mẫu Form (Ad):</span>
                    <strong style={{ color: '#0f172a', fontWeight: 700, wordBreak: 'break-word' }}>
                      {adOrFormName}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.71rem', display: 'block' }}>Nguồn gốc &amp; Ad ID:</span>
                    <strong style={{ color: '#0f172a', fontWeight: 700 }}>
                      {sourceName}{cleanAdId ? ` • ID: ${cleanAdId}` : ''}
                    </strong>
                  </div>
                </div>

                {/* Live Meta Ad Preview Iframe when Customer has synced Ad ID */}
                {cleanAdId !== '' && (
                  <div
                    style={{
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    <div
                      style={{
                        padding: '8px 12px',
                        background: '#f8fafc',
                        borderBottom: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        fontSize: '0.74rem'
                      }}
                    >
                      <span style={{ fontWeight: 800, color: '#0f172a', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Eye size={13} style={{ color: '#BD1D2D' }} />
                        <span>Iframe Bài Quảng Cáo Meta (Ad ID: {cleanAdId})</span>
                      </span>
                      <a
                        href={adPreview?.ad_library_url || `https://www.facebook.com/ads/library/?id=${encodeURIComponent(cleanAdId)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: '#BD1D2D',
                          fontWeight: 700,
                          textDecoration: 'none',
                          fontSize: '0.72rem'
                        }}
                      >
                        <span>Mở Ad Library</span>
                        <ExternalLink size={11.5} />
                      </a>
                    </div>
                    {adPreview?.iframe_src ? (
                      <iframe
                        title={`Meta Ad Preview ${cleanAdId}`}
                        src={adPreview.iframe_src}
                        style={{ width: '100%', height: '320px', border: 'none', background: '#f8fafc' }}
                        sandbox="allow-scripts allow-same-origin allow-popups"
                      />
                    ) : adPreview?.srcdoc_html ? (
                      <iframe
                        title={`Meta Ad Attribution Preview ${cleanAdId}`}
                        srcDoc={adPreview.srcdoc_html}
                        style={{ width: '100%', height: '275px', border: 'none', background: '#f8fafc' }}
                        sandbox="allow-popups allow-top-navigation-by-user-activation"
                      />
                    ) : null}
                  </div>
                )}
              </div>
            );
          })()}

          {/* 3 Health / Completeness Bars with getCompletenessTone */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              {
                label: 'Mức độ tương tác đa kênh',
                pct: engagementHealthPct,
                desc: `${allTimelineEvents.length} sự kiện tương tác ghi nhận`
              },
              {
                label: 'Tỷ lệ mở Email / ZNS',
                pct: openRate,
                desc: `${summary.stats_email_opened}/${summary.stats_email_sent} email đã mở`
              },
              {
                label: 'Độ hoàn thiện hồ sơ số',
                pct: profileCompleteness,
                desc: 'Thông tin nhân khẩu học & điểm chạm số'
              }
            ].map((metric, mIdx) => {
              const tone = getCompletenessTone(metric.pct);
              return (
                <div
                  key={mIdx}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: '#f8fafc',
                    border: '1px solid #f1f5f9',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: tone.dot }} />
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>
                        {metric.label}
                      </span>
                    </div>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '999px',
                        background: tone.bg,
                        color: tone.text,
                        fontSize: '0.72rem',
                        fontWeight: 800
                      }}
                    >
                      {metric.pct}%
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 4, background: '#e2e8f0', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${metric.pct}%`,
                        background: tone.bar,
                        borderRadius: 4,
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '0.69rem', color: '#64748b' }}>
                    {metric.desc}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. UNIFIED OMNICHANNEL WORKSPACE CARD */}
      <div
        className="card"
        style={{
          padding: '1.25rem',
          borderRadius: 16,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
        }}
      >
        {/* Top Navigation Row: Canonical Segmented Switcher */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            paddingBottom: '10px',
            marginBottom: '12px',
            borderBottom: '1px solid #f1f5f9'
          }}
        >
          {/* Main Subtabs Segmented Switcher */}
          <div
            style={{
              display: 'inline-flex',
              padding: '3px',
              borderRadius: '10px',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              gap: '2px',
              flexWrap: 'wrap'
            }}
          >
            {[
              { id: 'timeline', label: 'Dòng thời gian', count: allTimelineEvents.length, icon: Activity },
              { id: 'conversations', label: 'Hội thoại Chat', count: linkedConversations.length, icon: MessageSquare },
              { id: 'flows', label: 'Automation', count: activeFlows.length + completedFlows.length, icon: GitBranch },
              { id: 'surveys', label: 'Khảo sát / Quiz', count: surveyResponses.length, icon: ClipboardCheck },
              { id: 'web', label: 'Website & UTM', count: webSessions.length, icon: Globe }
            ].map((st) => {
              const isAct = activeSubTab === st.id;
              const IconComp = st.icon;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setActiveSubTab(st.id as any)}
                  style={{
                    height: '30px',
                    padding: '0 12px',
                    borderRadius: '7px',
                    border: 'none',
                    background: isAct ? '#ffffff' : 'transparent',
                    color: isAct ? '#BD1D2D' : '#64748b',
                    fontSize: '0.76rem',
                    fontWeight: isAct ? 700 : 600,
                    cursor: 'pointer',
                    boxShadow: isAct ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <IconComp size={13} style={{ color: isAct ? '#BD1D2D' : '#64748b' }} />
                  <span>{st.label}</span>
                  <span
                    style={{
                      background: isAct ? 'rgba(189, 29, 45, 0.1)' : '#e2e8f0',
                      color: isAct ? '#BD1D2D' : '#475569',
                      borderRadius: '999px',
                      padding: '1px 6px',
                      fontSize: '0.68rem',
                      fontWeight: 700
                    }}
                  >
                    {st.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right-side Contextual Filter Pills (Canonical Segmented Switcher) */}
          {activeSubTab === 'timeline' && (
            <div
              style={{
                display: 'inline-flex',
                padding: '3px',
                borderRadius: '10px',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                gap: '2px',
                flexWrap: 'wrap'
              }}
            >
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'web', label: 'Web' },
                { id: 'email', label: 'Email/ZNS' },
                { id: 'flow', label: 'Flow' },
                { id: 'survey', label: 'Khảo sát' },
                { id: 'voucher', label: 'Voucher' }
              ].map((flt) => {
                const isFltActive = timelineChannelFilter === flt.id;
                return (
                  <button
                    key={flt.id}
                    type="button"
                    onClick={() => setTimelineChannelFilter(flt.id as any)}
                    style={{
                      height: '26px',
                      padding: '0 10px',
                      borderRadius: '6px',
                      border: 'none',
                      background: isFltActive ? '#ffffff' : 'transparent',
                      color: isFltActive ? '#BD1D2D' : '#64748b',
                      fontSize: '0.72rem',
                      fontWeight: isFltActive ? 700 : 600,
                      cursor: 'pointer',
                      boxShadow: isFltActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {flt.label}
                  </button>
                );
              })}
            </div>
          )}

          {activeSubTab === 'conversations' && (
            <div
              style={{
                display: 'inline-flex',
                padding: '3px',
                borderRadius: '10px',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                gap: '2px',
                flexWrap: 'wrap'
              }}
            >
              {[
                { id: 'all', label: 'Tất cả kênh' },
                { id: 'web_ai', label: 'Web AI' },
                { id: 'meta', label: 'Meta' },
                { id: 'zalo', label: 'Zalo OA' }
              ].map((ch) => {
                const isChActive = convChannel === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setConvChannel(ch.id as any)}
                    style={{
                      height: '26px',
                      padding: '0 10px',
                      borderRadius: '6px',
                      border: 'none',
                      background: isChActive ? '#ffffff' : 'transparent',
                      color: isChActive ? '#BD1D2D' : '#64748b',
                      fontSize: '0.72rem',
                      fontWeight: isChActive ? 700 : 600,
                      cursor: 'pointer',
                      boxShadow: isChActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {ch.label}
                  </button>
                );
              })}
            </div>
          )}

          {activeSubTab === 'flows' && (
            <button
              type="button"
              onClick={openEnrollFlowModal}
              style={{
                height: 30,
                padding: '0 12px',
                borderRadius: 8,
                background: '#BD1D2D',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <Plus size={13} />
              <span>Đưa vào Kịch bản</span>
            </button>
          )}
        </div>

        {/* SUB-TAB 1: Unified Timeline */}
        {activeSubTab === 'timeline' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {loading && allTimelineEvents.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[1, 2, 3, 4].map((idx) => (
                  <div
                    key={idx}
                    className="animate-pulse"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border-light)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                      <div className="h-4 w-14 rounded bg-slate-200/80 dark:bg-white/[0.08]" />
                      <div className="h-4 w-48 rounded bg-slate-200/80 dark:bg-white/[0.08]" />
                    </div>
                    <div className="h-3.5 w-20 rounded bg-slate-200/60 dark:bg-white/[0.05]" />
                  </div>
                ))}
              </div>
            ) : unifiedTimeline.length === 0 ? (
              <div
                style={{
                  padding: '18px 14px',
                  textAlign: 'center',
                  borderRadius: '6px',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text-muted)',
                  fontSize: '0.78rem'
                }}
              >
                Chưa có sự kiện tương tác số nào trong bộ lọc kênh này.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '420px', overflowY: 'auto' }}>
                {unifiedTimeline.map((ev: any, idx: number) => {
                  const badge = getChannelBadgeMeta(ev.channel || ev.event_type || '');
                  return (
                    <div
                      key={ev.id || idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: 'var(--color-bg)',
                        border: '1px solid var(--color-border-light)'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '0.64rem',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: badge.bg,
                              color: badge.color,
                              flexShrink: 0
                            }}
                          >
                            {badge.label}
                          </span>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)' }}>
                            {ev.title || ev.event_name || ev.subject || 'Hoạt động tương tác'}
                          </span>
                        </div>
                        {ev.description && (
                          <div
                            style={{
                              fontSize: '0.72rem',
                              color: 'var(--color-text-muted)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {ev.description}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {formatDateTimeVN(ev.created_at || ev.occurred_at || ev.timestamp)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SUB-TAB 2: Hội thoại Đa kênh (Web AI Chat, Meta Fanpage, Zalo OA) */}
        {activeSubTab === 'conversations' && (
          <div>
            {linkedConversations.length === 0 ? (
              <div
                style={{
                  padding: '18px 14px',
                  textAlign: 'center',
                  borderRadius: '8px',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text-muted)',
                  fontSize: '0.78rem'
                }}
              >
                Chưa có lịch sử hội thoại Web AI Chat, Meta Fanpage hoặc Zalo OA nào khớp với SĐT / Email của khách hàng này.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: selectedConv ? 'minmax(220px, 1fr) 2fr' : '1fr',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '340px', overflowY: 'auto' }}>
                  {linkedConversations.map((conv: any, idx: number) => {
                    const isSelected = selectedConv && (selectedConv.id || selectedConv.session_id) === (conv.id || conv.session_id);
                    return (
                      <div
                        key={conv.id || conv.session_id || idx}
                        onClick={() => setSelectedConv(conv)}
                        style={{
                          padding: '8px 11px',
                          borderRadius: '8px',
                          background: isSelected ? 'rgba(189, 29, 45, 0.08)' : 'var(--color-bg)',
                          borderLeft: isSelected ? '3px solid var(--color-primary)' : '3px solid transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '0.66rem',
                              fontWeight: 800,
                              color: 'var(--color-primary)',
                              background: 'rgba(189, 29, 45, 0.1)',
                              padding: '1px 6px',
                              borderRadius: '999px'
                            }}
                          >
                            {conv._channelLabel}
                          </span>
                          <span style={{ fontSize: '0.67rem', color: 'var(--color-text-muted)' }}>
                            {formatDateTimeVN(conv.updated_at || conv.created_at || conv.last_message_at)}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text)' }}>
                          {conv.visitor_name || conv.customer_name || conv.sender_name || contact?.full_name || 'Khách hàng'}
                        </div>
                        <div
                          style={{
                            fontSize: '0.73rem',
                            color: 'var(--color-text-muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {conv.last_message || conv.message || conv.summary || 'Bấm để xem chi tiết hội thoại'}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedConv && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'var(--color-bg)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      maxHeight: '340px',
                      overflowY: 'auto'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '5px', borderBottom: '1px solid var(--color-border-light)' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--color-text)' }}>
                        Nội dung hội thoại ({selectedConv._channelLabel})
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedConv(null)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    {Array.isArray(selectedConv.messages) && selectedConv.messages.length > 0 ? (
                      selectedConv.messages.map((m: any, mIdx: number) => {
                        const isAgent = m.role === 'assistant' || m.sender === 'agent' || m.direction === 'outbound';
                        return (
                          <div
                            key={m.id || mIdx}
                            style={{
                              alignSelf: isAgent ? 'flex-end' : 'flex-start',
                              maxWidth: '82%',
                              padding: '7px 11px',
                              borderRadius: '10px',
                              background: isAgent ? 'var(--color-primary)' : 'var(--color-surface)',
                              color: isAgent ? '#ffffff' : 'var(--color-text)',
                              fontSize: '0.76rem',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                            }}
                          >
                            <div>{m.content || m.text || m.message}</div>
                            <div style={{ fontSize: '0.64rem', opacity: 0.75, marginTop: '2px', textAlign: 'right' }}>
                              {formatDateTimeVN(m.created_at || m.timestamp)}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: 'var(--color-surface)',
                          fontSize: '0.76rem',
                          color: 'var(--color-text)'
                        }}
                      >
                        {selectedConv.message || selectedConv.last_message || selectedConv.content || 'Không có tin nhắn chi tiết'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SUB-TAB 3: Lịch sử Kịch bản Automation */}
        {activeSubTab === 'flows' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {activeFlows.length === 0 && completedFlows.length === 0 ? (
              <div
                style={{
                  padding: '18px 14px',
                  textAlign: 'center',
                  borderRadius: '8px',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text-muted)',
                  fontSize: '0.78rem'
                }}
              >
                Khách hàng chưa được đưa vào kịch bản Automation nào.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[...activeFlows, ...completedFlows].map((fl: any, idx: number) => {
                  const isActive = fl.status === 'active' || fl.status === 'paused';
                  const isPaused = fl.status === 'paused';
                  return (
                    <div
                      key={fl.id || idx}
                      style={{
                        padding: '9px 12px',
                        borderRadius: '8px',
                        background: 'var(--color-bg)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text)' }}>
                            {fl.flow_name || fl.name || `Kịch bản #${fl.flow_id || idx + 1}`}
                          </span>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              padding: '1px 7px',
                              borderRadius: '999px',
                              background: isPaused
                                ? 'rgba(245, 158, 11, 0.14)'
                                : isActive
                                ? 'rgba(189, 29, 45, 0.12)'
                                : 'rgba(16, 185, 129, 0.12)',
                              color: isPaused ? '#d97706' : isActive ? 'var(--color-primary)' : '#059669'
                            }}
                          >
                            {isPaused ? 'Tạm dừng' : isActive ? 'Đang chạy' : 'Đã hoàn tất'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          Bước: {fl.current_step_name || fl.current_node || 'Hoàn thành'} • Tham gia:{' '}
                          {formatDateTimeVN(fl.enrolled_at || fl.created_at)}
                        </div>
                      </div>

                      {isActive && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <button
                            type="button"
                            onClick={() => handleFlowStateChange(fl, isPaused ? 'resume' : 'pause')}
                            disabled={Boolean(submittingAction)}
                            style={{
                              padding: '4px 9px',
                              borderRadius: '6px',
                              border: 'none',
                              background: isPaused ? '#059669' : '#f59e0b',
                              color: '#ffffff',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            {isPaused ? 'Tiếp tục' : 'Tạm dừng'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFlowStateChange(fl, 'exit')}
                            disabled={Boolean(submittingAction)}
                            style={{
                              padding: '4px 9px',
                              borderRadius: '6px',
                              border: 'none',
                              background: 'rgba(239, 68, 68, 0.14)',
                              color: '#dc2626',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Rời luồng
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SUB-TAB 4: Chi tiết Câu trả lời Khảo sát / Quiz */}
        {activeSubTab === 'surveys' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {surveyResponses.length === 0 ? (
              <div
                style={{
                  padding: '18px 14px',
                  textAlign: 'center',
                  borderRadius: '8px',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text-muted)',
                  fontSize: '0.78rem'
                }}
              >
                Chưa có dữ liệu câu trả lời Khảo sát / Bài test nào của khách hàng này.
              </div>
            ) : (
              surveyResponses.map((sr: any, idx: number) => {
                const srKey = sr.id || idx;
                const isExpanded = expandedSurveyId === srKey || idx === 0;
                const answers = Array.isArray(sr.answer_details) && sr.answer_details.length > 0
                  ? sr.answer_details
                  : Array.isArray(sr.answers)
                  ? sr.answers
                  : sr.parsed_answers && typeof sr.parsed_answers === 'object'
                  ? Object.entries(sr.parsed_answers).map(([q, a]) => ({ question: q, answer: String(a) }))
                  : sr.response_data && typeof sr.response_data === 'object'
                  ? Object.entries(sr.response_data).map(([q, a]) => ({ question: q, answer: String(a) }))
                  : [];

                return (
                  <div
                    key={srKey}
                    style={{
                      borderRadius: '8px',
                      background: 'var(--color-bg)',
                      overflow: 'hidden'
                    }}
                  >
                    <div
                      onClick={() => setExpandedSurveyId(isExpanded ? null : srKey)}
                      style={{
                        padding: '9px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)' }}>
                          {sr.survey_title || sr.title || `Khảo sát #${sr.survey_id || idx + 1}`}
                        </div>
                        <div style={{ fontSize: '0.71rem', color: 'var(--color-text-muted)' }}>
                          Nộp lúc: {formatDateTimeVN(sr.submitted_at || sr.created_at)}
                        </div>
                      </div>
                      {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </div>

                    {isExpanded && (
                      <div
                        style={{
                          padding: '8px 12px 10px',
                          borderTop: '1px solid var(--color-border-light)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        {answers.length === 0 ? (
                          <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                            {sr.summary || 'Đã ghi nhận hoàn thành khảo sát.'}
                          </div>
                        ) : (
                          answers.map((ans: any, aIdx: number) => (
                            <div
                              key={aIdx}
                              style={{
                                padding: '6px 9px',
                                borderRadius: '6px',
                                background: 'var(--color-surface)'
                              }}
                            >
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                                Câu {aIdx + 1}: {ans.question || ans.label || ans.field}
                              </div>
                              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: '1px' }}>
                                {String(ans.answer ?? ans.value ?? '—')}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* SUB-TAB 5: Chi tiết Phiên truy cập Website & UTM */}
        {activeSubTab === 'web' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {webSessions.length === 0 ? (
              <div
                style={{
                  padding: '18px 14px',
                  textAlign: 'center',
                  borderRadius: '8px',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text-muted)',
                  fontSize: '0.78rem'
                }}
              >
                Chưa ghi nhận phiên truy cập Website (Web Sessions & Pageviews) cho khách hàng này.
              </div>
            ) : (
              webSessions.map((ws: any, idx: number) => {
                const wsKey = ws.id || ws.session_id || idx;
                const isExpanded = expandedSessionId === wsKey || idx === 0;
                const pageViews: any[] = Array.isArray(ws.page_views)
                  ? ws.page_views
                  : Array.isArray(ws.pageviews)
                  ? ws.pageviews
                  : [];

                return (
                  <div
                    key={wsKey}
                    style={{
                      borderRadius: '8px',
                      background: 'var(--color-bg)',
                      overflow: 'hidden'
                    }}
                  >
                    <div
                      onClick={() => setExpandedSessionId(isExpanded ? null : wsKey)}
                      style={{
                        padding: '9px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        gap: '8px'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.79rem', fontWeight: 800, color: 'var(--color-text)' }}>
                            Phiên #{idx + 1} • {ws.landing_page || ws.domain || 'Website'}
                          </span>
                          {ws.utm_source && (
                            <span
                              style={{
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '999px',
                                background: 'rgba(189, 29, 45, 0.1)',
                                color: 'var(--color-primary)'
                              }}
                            >
                              UTM: {ws.utm_source} / {ws.utm_medium || '—'} / {ws.utm_campaign || '—'}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.71rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          {formatDateTimeVN(ws.started_at || ws.created_at)} • {ws.device_type || ws.browser || 'Desktop/Mobile'} • Cuộn: {ws.max_scroll_depth ?? summary.max_scroll_depth}%
                        </div>
                      </div>
                      {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </div>

                    {isExpanded && pageViews.length > 0 && (
                      <div
                        style={{
                          padding: '8px 12px 10px',
                          borderTop: '1px solid var(--color-border-light)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '5px'
                        }}
                      >
                        {pageViews.map((pv: any, pIdx: number) => (
                          <div
                            key={pv.id || pIdx}
                            style={{
                              padding: '6px 9px',
                              borderRadius: '6px',
                              background: 'var(--color-surface)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                              fontSize: '0.73rem'
                            }}
                          >
                            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                              {pv.page_title || pv.url || pv.path}
                            </span>
                            <span style={{ color: 'var(--color-text-muted)' }}>
                              Cuộn {pv.scroll_depth || 0}% • {pv.time_on_page || 0}s
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: + Đưa vào Kịch bản Automation (POST /contacts/:id/enroll-flow) */}
      {showEnrollModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setShowEnrollModal(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleEnrollFlow}
            style={{
              width: '100%',
              maxWidth: '460px',
              background: 'var(--color-surface)',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)' }}>
                Đưa khách hàng vào Kịch bản Automation
              </h4>
              <button
                type="button"
                onClick={() => setShowEnrollModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {availableFlows.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '6px' }}>
                  Chọn kịch bản có sẵn
                </label>
                <select
                  className="form-input"
                  value={enrollFlowId}
                  onChange={(e) => {
                    setEnrollFlowId(e.target.value);
                    const found = availableFlows.find((f) => String(f.id) === e.target.value);
                    if (found) setEnrollFlowName(found.name || found.title || '');
                  }}
                  style={{ width: '100%' }}
                >
                  <option value="">-- Chọn kịch bản Automation --</option>
                  {availableFlows.map((fl: any) => (
                    <option key={fl.id} value={fl.id}>
                      {fl.name || fl.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '6px' }}>
                Hoặc nhập tên Kịch bản Automation *
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="VD: Nuôi dưỡng Lead MBA 7 ngày..."
                value={enrollFlowName}
                onChange={(e) => setEnrollFlowName(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '6px' }}>
                Ghi chú kích hoạt
              </label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="Ghi chú lý do đưa khách vào luồng..."
                value={enrollNote}
                onChange={(e) => setEnrollNote(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                className="btn outline sm"
                onClick={() => setShowEnrollModal(false)}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submittingAction === 'enroll-flow'}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--color-primary)',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {submittingAction === 'enroll-flow' ? 'Đang xử lý...' : 'Xác nhận đưa vào Kịch bản'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: + Cấp Mã Ưu Đãi Voucher (POST /contacts/:id/issue-voucher) */}
      {showIssueVoucherModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setShowIssueVoucherModal(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleIssueVoucher}
            style={{
              width: '100%',
              maxWidth: '460px',
              background: 'var(--color-surface)',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)' }}>
                Cấp Mã Ưu Đãi (Voucher / QR) Cho Khách Hàng
              </h4>
              <button
                type="button"
                onClick={() => setShowIssueVoucherModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {availableVouchers.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '6px' }}>
                  Chọn chiến dịch Voucher có sẵn
                </label>
                <select
                  className="form-input"
                  value={voucherCampaignId}
                  onChange={(e) => {
                    setVoucherCampaignId(e.target.value);
                    const found = availableVouchers.find((v) => String(v.id) === e.target.value);
                    if (found?.code) setVoucherCodeInput(found.code);
                  }}
                  style={{ width: '100%' }}
                >
                  <option value="">-- Chọn chiến dịch Voucher --</option>
                  {availableVouchers.map((vc: any) => (
                    <option key={vc.id} value={vc.id}>
                      {vc.name || vc.title || vc.code}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '6px' }}>
                Mã Ưu Đãi (Voucher Code) *
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="VD: IDEAS-VIP5M, SCHOLAR-2026..."
                value={voucherCodeInput}
                onChange={(e) => setVoucherCodeInput(e.target.value.toUpperCase())}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '6px' }}>
                Giá trị ưu đãi (VNĐ hoặc %)
              </label>
              <input
                type="number"
                min={0}
                className="form-input"
                placeholder="VD: 5000000"
                value={voucherDiscountValue}
                onChange={(e) => setVoucherDiscountValue(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '6px' }}>
                Ghi chú cấp mã
              </label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="Lý do cấp mã ưu đãi..."
                value={voucherNote}
                onChange={(e) => setVoucherNote(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                className="btn outline sm"
                onClick={() => setShowIssueVoucherModal(false)}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submittingAction === 'issue-voucher'}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--color-primary)',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {submittingAction === 'issue-voucher' ? 'Đang cấp mã...' : 'Cấp Mã Ưu Đãi'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default CustomerOmnichannelJourneyTab;
