import React, { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  Send,
  Sparkles,
  Cpu,
  Zap,
  ShieldCheck,
  Trash2,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Clock,
  Terminal,
  Database,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Layers,
  Sliders,
  Brain,
  Play,
  RefreshCw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { parseAllChatTags } from '../components/chat/chatTagParsers';
import { ChatDynamicChart } from '../components/chat/ChatDynamicChart';
import { ChatSmartErpCard } from '../components/chat/ChatSmartErpCard';
import { ActionProposalCard } from '../components/chat/ActionProposalCard';
import { NextBestActionChips } from '../components/chat/NextBestActionChips';
import { ProactiveInsightCard } from '../components/chat/ProactiveInsightCard';
import { SPECIALIZED_AGENTS } from '../constants/aiAgents';
import { downloadExportFile } from '../utils/exportHelper';
import { useUIStore } from '../store/uiStore';

interface ExecutedStep {
  tool: string;
  args: Record<string, any>;
  latency_ms: number;
  summary: string;
  has_error?: boolean;
}

interface TelemetryData {
  model: string;
  provider?: string;
  turns_used: number;
  tools_loaded_count?: number;
  tools_called_count?: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens?: number;
  groq_time_ms?: number;
  total_wall_ms?: number;
  tokens_per_second?: number;
  rag_matched_count?: number;
}

interface CollaboratingAgent {
  id: string;
  badge: string;
  focus: string;
}

interface LabMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
  reasoning_trace?: string;
  collaborating_agents?: CollaboratingAgent[];
  executed_steps?: ExecutedStep[];
  telemetry?: TelemetryData;
}

interface StatusInfo {
  has_key: boolean;
  masked_key: string;
  active_model: string;
  engine: string;
  available_models: {
    id: string;
    name: string;
    context_window: number;
    badge: string;
  }[];
  total_tools: number;
  tool_names: string[];
}

const TEST_PROMPTS = [
  {
    category: 'Điều hành & Ban Giám đốc',
    title: 'Bức tranh toàn cảnh 360° toàn viện',
    prompt: 'Tổng hợp bức tranh điều hành toàn viện tháng này: số lượng Lead mới, doanh thu đặt cọc thực thu, chi phí PO và tỷ lệ chuyển đổi.',
    agentId: 'executive_bi',
  },
  {
    category: 'CRM & Tuyển sinh',
    title: 'Phân tích Lead MBA/DBA & Xuất Excel',
    prompt: 'Thống kê khách hàng tiềm năng quan tâm chương trình MBA và DBA trong tháng này theo nguồn và giai đoạn, kèm biểu đồ và link xuất Excel.',
    agentId: 'sales',
  },
  {
    category: 'Tài chính & Kế toán',
    title: 'Đối soát Thu Chi PO / SO & Đặt cọc',
    prompt: 'Phân tích tổng quan thu chi tài chính tháng này, liệt kê các khoản đặt cọc (SO) gần đây và các đề xuất chi (PO) đang chờ duyệt.',
    agentId: 'finance',
  },
  {
    category: 'Nhân sự & Chấm công',
    title: 'Kiểm tra Chấm công & Lịch nghỉ phép',
    prompt: 'Tra cứu tình hình nhân sự, tổng hợp chấm công tháng này và danh sách nhân viên nghỉ phép hôm nay.',
    agentId: 'hrm',
  },
  {
    category: 'Công việc & Bàn làm việc',
    title: 'Rà soát Task quá hạn & Việc hôm nay',
    prompt: 'Kiểm tra danh sách công việc trên bàn làm việc của tôi đang đến hạn hôm nay hoặc đang quá hạn cần xử lý ngay.',
    agentId: 'tasks',
  },
  {
    category: 'Marketing & Đa kênh',
    title: 'Hiệu quả Chiến dịch Email & Automation Flow',
    prompt: 'Phân tích hiệu quả các chiến dịch Email Marketing, kịch bản Automation Flow và danh sách Lead nóng tương tác cao.',
    agentId: 'marketing_campaigns',
  },
];

const STORAGE_KEY = 'myerp_qwen_agent_lab_messages_v1';

export const QwenAgentLabPage: React.FC = () => {
  const navigate = useNavigate();
  const [statusInfo, setStatusInfo] = useState<StatusInfo | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);
  const [selectedModel, setSelectedModel] = useState<string>('qwen/qwen3.8-27b');
  const [temperature, setTemperature] = useState<number>(0.15);
  const [pinnedAgentId, setPinnedAgentId] = useState<string>('auto');

  const [messages, setMessages] = useState<LabMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignore storage error
    }
    return [
      {
        id: 'welcome_qwen',
        role: 'assistant',
        content:
          'Xin chào! Tôi là **SI IDEAS × Qwen 3.8 27B** hoạt động **100% độc lập trên Groq Cloud LPU (Đã loại bỏ hoàn toàn Gemini API)**.\n\n' +
          'Tôi được kết nối trực tiếp với toàn bộ **70 Công cụ Nghiệp vụ (`AgentToolRegistry`)** và **Database MySQL thực tế** của MYERP (CRM Lead, Học viên, Thu chi PO/SO, Nhân sự, Chấm công, Công việc, Marketing Automation). Bạn có thể chọn một kịch bản kiểm thử bên trái hoặc nhập câu hỏi bất kỳ để kiểm chứng tốc độ và độ chính xác!',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        model: 'qwen/qwen3.8-27b',
        collaborating_agents: [
          {
            id: 'master',
            badge: 'SI IDEAS (Qwen 3.8 27B • Zero Gemini)',
            focus: 'Điều phối viên trung tâm kết nối 70 công cụ ERP trên Groq Cloud LPU.',
          },
        ],
      },
    ];
  });

  const [inputText, setInputText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [expandedReasoningIds, setExpandedReasoningIds] = useState<Record<string, boolean>>({});
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [newApiKeyInput, setNewApiKeyInput] = useState<string>('');
  const [savingKey, setSavingKey] = useState<boolean>(false);

  const inFlightRef = useRef<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {
      // Ignore quota error
    }
  }, [messages]);

  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await api.get('/qwen-agent/status');
      const data = res.data?.data;
      if (data) {
        setStatusInfo(data);
        if (data.active_model) {
          setSelectedModel(data.active_model);
        }
      }
    } catch (err: any) {
      // Silent fallback if status check fails
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const latestTelemetryMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && (messages[i].telemetry || messages[i].executed_steps)) {
        return messages[i];
      }
    }
    return null;
  }, [messages]);

  const handleSendMessage = async (overridePrompt?: string, overrideAgentId?: string) => {
    const textToSend = (overridePrompt !== undefined ? overridePrompt : inputText).trim();
    if (!textToSend || inFlightRef.current) return;

    inFlightRef.current = true;
    setIsSending(true);
    if (overridePrompt === undefined) {
      setInputText('');
    }
    const activeAgentToUse = overrideAgentId !== undefined ? overrideAgentId : pinnedAgentId;
    if (overrideAgentId !== undefined) {
      setPinnedAgentId(overrideAgentId);
    }

    const userMsg: LabMessage = {
      id: 'u_' + Date.now(),
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    const historyForApi = messages
      .filter((m) => m.id !== 'welcome_qwen')
      .slice(-10)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await api.post('/qwen-agent/chat', {
        message: textToSend,
        model: selectedModel,
        temperature,
        pinned_agent_id: activeAgentToUse,
        history: historyForApi,
      });

      const payload = res.data?.data;
      const assistantMsg: LabMessage = {
        id: 'a_' + Date.now(),
        role: 'assistant',
        content: payload?.reply || 'Không nhận được nội dung phản hồi.',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        model: payload?.model || selectedModel,
        reasoning_trace: payload?.reasoning_trace || '',
        collaborating_agents: payload?.collaborating_agents || [],
        executed_steps: payload?.executed_steps || [],
        telemetry: payload?.telemetry || undefined,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.data?.error_detail ||
        err?.message ||
        'Lỗi kết nối tới Groq Cloud API';
      toast.error(errMsg);
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          role: 'assistant',
          content: `⚠️ **Không thể hoàn tất truy vấn trên Groq Cloud**: ${errMsg}`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          model: selectedModel,
        },
      ]);
    } finally {
      inFlightRef.current = false;
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  };

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApiKeyInput.trim() && !selectedModel) return;
    setSavingKey(true);
    try {
      const res = await api.post('/qwen-agent/settings', {
        groq_api_key: newApiKeyInput.trim() || undefined,
        groq_model: selectedModel,
      });
      const data = res.data?.data;
      if (data) {
        setStatusInfo((prev) =>
          prev
            ? {
                ...prev,
                has_key: data.has_key,
                masked_key: data.masked_key,
                active_model: data.active_model,
              }
            : prev
        );
      }
      setNewApiKeyInput('');
      setShowKeyModal(false);
      toast.success('Đã cập nhật cấu hình Groq Cloud bảo mật!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể lưu cấu hình Groq API');
    } finally {
      setSavingKey(false);
    }
  };

  const handleClearSession = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setMessages([
      {
        id: 'welcome_qwen_' + Date.now(),
        role: 'assistant',
        content:
          'Đã làm mới phiên làm việc! Toàn bộ ngữ cảnh đã được dọn sạch. Hãy chọn kịch bản hoặc nhập câu hỏi mới để test **Qwen 3.8 27B (Groq Cloud)**.',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        model: selectedModel,
      },
    ]);
    toast.success('Đã làm mới phiên test Qwen 3.8 27B');
  };

  const triggerExportUrl = (rawHref: string) => {
    try {
      const url = new URL(rawHref, window.location.origin);
      const params: Record<string, any> = {};
      url.searchParams.forEach((v, k) => {
        params[k] = v;
      });
      downloadExportFile({
        endpoint: '/export',
        params,
        defaultFilename: `export_${params.type || 'data'}.csv`,
      });
    } catch {
      window.open(rawHref, '_blank');
    }
  };

  const handleOpenErpCard = (card: any) => {
    const eType = String(card.entity_type || '').toLowerCase();
    const eId = Number(card.entity_id || 0);
    if (eType === 'contact' && eId > 0) {
      useUIStore.getState().openCustomerDrawer(eId);
      return;
    }
    if (card.relative_url) {
      navigate(card.relative_url);
      return;
    }
    if (card.direct_url) {
      try {
        const u = new URL(card.direct_url);
        navigate(u.pathname + u.search);
      } catch {
        navigate(card.direct_url);
      }
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 64px)',
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        overflow: 'hidden',
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #BD1D2D 0%, #7f1d1d 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            <Brain size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)' }}>
                SI IDEAS × Qwen 3.8 27B Lab
              </h1>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#059669',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                }}
              >
                100% NO GEMINI • GROQ LPU
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'rgba(189, 29, 45, 0.1)',
                  color: 'var(--color-primary)',
                }}
              >
                {statusInfo?.total_tools || 70} ERP Tools Kết Nối Thật
              </span>
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
              Màn hình kiểm thử độc lập nhân bản toàn bộ kiến trúc Multi-Agent & SQL Tool Registry sang Qwen 3.8 27B
            </div>
          </div>
        </div>

        {/* Right Controls: Model Switcher, Temperature, Masked Key Badge, Reset */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Model Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={15} style={{ color: 'var(--color-primary)' }} />
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              style={{
                height: 34,
                padding: '0 10px',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <option value="qwen/qwen3.8-27b">Qwen 3.8 27B (qwen/qwen3.8-27b)</option>
              <option value="openai/gpt-oss-120b">GPT-OSS 120B (openai/gpt-oss-120b)</option>
              <option value="openai/gpt-oss-20b">GPT-OSS 20B (openai/gpt-oss-20b)</option>
            </select>
          </div>

          {/* Temperature Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sliders size={14} style={{ color: 'var(--color-text-muted)' }} />
            <select
              value={String(temperature)}
              onChange={(e) => setTemperature( parseFloat(e.target.value) )}
              style={{
                height: 34,
                padding: '0 8px',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <option value="0.1">Temp 0.1 (Chuẩn SQL)</option>
              <option value="0.15">Temp 0.15 (Mặc định)</option>
              <option value="0.3">Temp 0.3 (Linh hoạt)</option>
              <option value="0.6">Temp 0.6 (Sáng tạo)</option>
            </select>
          </div>

          {/* Masked API Key Security Badge */}
          <button
            type="button"
            onClick={() => setShowKeyModal(true)}
            title="Key được bảo mật tuyệt đối ở tầng Backend (.env.local / system_settings)"
            style={{
              height: 34,
              padding: '0 10px',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              fontSize: '0.76rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <ShieldCheck size={14} style={{ color: statusInfo?.has_key !== false ? '#059669' : '#f59e0b' }} />
            <span>Groq Key: {loadingStatus ? '••••' : statusInfo?.masked_key || 'Đã bảo mật'}</span>
          </button>

          {/* Clear Chat Button */}
          <button
            type="button"
            onClick={handleClearSession}
            style={{
              height: 34,
              padding: '0 12px',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-muted)',
              fontSize: '0.78rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <Trash2 size={14} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Main 3-Column Body */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '290px minmax(0, 1fr) 320px',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* LEFT COLUMN: Specialized Agent Selector & 1-Click Test Scenarios */}
        <div
          style={{
            borderRight: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            padding: '14px',
            gap: '16px',
          }}
        >
          {/* Agent Selector */}
          <div>
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--color-text-muted)',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>Chế độ Multi-Agent Swarm</span>
              <Layers size={13} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <button
                type="button"
                onClick={() => setPinnedAgentId('auto')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  borderRadius: 10,
                  border:
                    pinnedAgentId === 'auto'
                      ? '1.5px solid var(--color-primary)'
                      : '1px solid var(--color-border)',
                  background:
                    pinnedAgentId === 'auto' ? 'rgba(189, 29, 45, 0.08)' : 'var(--color-bg)',
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: 'var(--color-primary)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Sparkles size={15} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>Auto Swarm (Tự động)</div>
                  <div
                    style={{
                      fontSize: '0.7rem',
                      color: 'var(--color-text-muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    Tự động gọi 1-3 Agent theo câu hỏi
                  </div>
                </div>
              </button>

              {SPECIALIZED_AGENTS.filter((a) => a.id !== 'master').map((ag) => {
                const isSelected = pinnedAgentId === ag.id;
                return (
                  <button
                    key={ag.id}
                    type="button"
                    onClick={() => setPinnedAgentId(ag.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '9px',
                      padding: '7px 10px',
                      borderRadius: 10,
                      border: isSelected
                        ? `1.5px solid ${ag.badgeColor}`
                        : '1px solid transparent',
                      background: isSelected ? ag.badgeBg : 'transparent',
                      color: 'var(--color-text)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <img
                      src={ag.avatar}
                      alt={ag.name}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flexShrink: 0,
                        border: `1px solid ${ag.badgeColor}`,
                      }}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: isSelected ? '#0f172a' : 'var(--color-text)' }}>
                        {ag.name}
                      </div>
                      <div
                        style={{
                          fontSize: '0.68rem',
                          color: isSelected ? '#334155' : 'var(--color-text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {ag.roleTitle}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 1-Click ERP Test Scenarios */}
          <div>
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--color-text-muted)',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>Kịch bản Test 1-Click</span>
              <Play size={12} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {TEST_PROMPTS.map((tp, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isSending}
                  onClick={() => handleSendMessage(tp.prompt, 'auto')}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    cursor: isSending ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.66rem',
                      fontWeight: 800,
                      color: 'var(--color-primary)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {tp.category}
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{tp.title}</span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--color-text-muted)',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {tp.prompt}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: Chat Stream & Input */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            background: 'var(--color-bg)',
          }}
        >
          {/* Messages List */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              const parsed = !isUser ? parseAllChatTags(msg.content) : null;
              const displayContent = parsed ? parsed.cleanContent : msg.content;
              const isReasoningOpen = !!expandedReasoningIds[msg.id];

              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isUser ? 'flex-end' : 'flex-start',
                    gap: '6px',
                  }}
                >
                  {/* Sender Header + Agent Badges */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap',
                      fontSize: '0.73rem',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    <span style={{ fontWeight: 800, color: isUser ? 'var(--color-primary)' : 'var(--color-text)' }}>
                      {isUser ? 'Bạn' : 'SI IDEAS × Qwen 3.8 27B'}
                    </span>
                    <span>• {msg.timestamp}</span>
                    {!isUser && msg.model && (
                      <span
                        style={{
                          padding: '1px 7px',
                          borderRadius: 999,
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                        }}
                      >
                        {msg.model}
                      </span>
                    )}
                    {!isUser &&
                      msg.collaborating_agents &&
                      msg.collaborating_agents.map((ag) => (
                        <span
                          key={ag.id}
                          style={{
                            padding: '1px 8px',
                            borderRadius: 999,
                            background: 'rgba(189, 29, 45, 0.1)',
                            color: 'var(--color-primary)',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                          }}
                        >
                          {ag.badge}
                        </span>
                      ))}
                    {!isUser && msg.telemetry?.tokens_per_second ? (
                      <span
                        style={{
                          padding: '1px 7px',
                          borderRadius: 999,
                          background: 'rgba(16, 185, 129, 0.12)',
                          color: '#059669',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                        }}
                      >
                        ⚡ {msg.telemetry.tokens_per_second} tok/s ({msg.telemetry.total_wall_ms}ms)
                      </span>
                    ) : null}
                  </div>

                  {/* Executed Tools Pills (if any) */}
                  {!isUser && msg.executed_steps && msg.executed_steps.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxWidth: '92%' }}>
                      {msg.executed_steps.map((st, sIdx) => (
                        <div
                          key={sIdx}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: 8,
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            fontSize: '0.72rem',
                          }}
                        >
                          <Database size={12} style={{ color: st.has_error ? '#ef4444' : '#059669' }} />
                          <code style={{ fontWeight: 700, color: 'var(--color-text)' }}>{st.tool}</code>
                          <span style={{ color: 'var(--color-text-muted)' }}>({st.latency_ms}ms)</span>
                          <span style={{ color: '#059669', fontWeight: 600 }}>• {st.summary}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Collapsible Reasoning Trace (<think>) */}
                  {!isUser && msg.reasoning_trace && (
                    <div style={{ maxWidth: '92%', width: '100%' }}>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedReasoningIds((prev) => ({
                            ...prev,
                            [msg.id]: !prev[msg.id],
                          }))
                        }
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: 8,
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-surface)',
                          color: 'var(--color-text-muted)',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {isReasoningOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        <span>Chuỗi suy luận nội tại Qwen 3.8 (&lt;think&gt;)</span>
                      </button>
                      {isReasoningOpen && (
                        <pre
                          style={{
                            marginTop: 6,
                            padding: '10px 12px',
                            borderRadius: 10,
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            fontSize: '0.74rem',
                            color: 'var(--color-text-muted)',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            maxHeight: 240,
                            overflowY: 'auto',
                          }}
                        >
                          {msg.reasoning_trace}
                        </pre>
                      )}
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    style={{
                      maxWidth: isUser ? '78%' : '94%',
                      padding: isUser ? '11px 16px' : '16px 20px',
                      borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: isUser ? 'var(--color-primary)' : 'var(--color-surface)',
                      color: isUser ? '#ffffff' : 'var(--color-text)',
                      border: isUser ? 'none' : '1px solid var(--color-border)',
                      fontSize: '0.875rem',
                      lineHeight: 1.6,
                      overflowX: 'auto',
                    }}
                  >
                    {isUser ? (
                      <div style={{ whiteSpace: 'pre-wrap' }}>{displayContent}</div>
                    ) : (
                      <div className="qwen-markdown-body">
                        <QwenMarkdownRenderer content={displayContent} onExport={triggerExportUrl} />

                        {/* Rich ERP Widgets Parsed from Tags */}
                        {parsed?.proactiveInsight && (
                          <div style={{ marginTop: 12 }}>
                            <ProactiveInsightCard
                              insight={parsed.proactiveInsight}
                              onAction={(p) => handleSendMessage(p)}
                            />
                          </div>
                        )}

                        {parsed?.chart && (
                          <div style={{ marginTop: 14 }}>
                            <ChatDynamicChart chart={parsed.chart} />
                          </div>
                        )}

                        {parsed?.erpCard && (
                          <div style={{ marginTop: 12 }}>
                            <ChatSmartErpCard card={parsed.erpCard} onOpen={handleOpenErpCard} />
                          </div>
                        )}

                        {parsed?.proposals &&
                          parsed.proposals.map((prop, pIdx) => (
                            <div key={pIdx} style={{ marginTop: 12 }}>
                              <ActionProposalCard proposal={prop} messageId={`${msg.id}_${pIdx}`} />
                            </div>
                          ))}

                        {(parsed?.nextBestActions || parsed?.clarifyOptions) && (
                          <div style={{ marginTop: 12 }}>
                            <NextBestActionChips
                              actions={parsed.nextBestActions}
                              clarifyOptions={parsed.clarifyOptions}
                              onSelectAction={(prompt) => handleSendMessage(prompt)}
                              disabled={isSending}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Skeleton Loading State (Zero Spinners Policy) */}
            {isSending && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  maxWidth: '75%',
                  padding: '16px 20px',
                  borderRadius: '16px 16px 16px 4px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    className="animate-pulse"
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: 'var(--color-primary)',
                    }}
                  />
                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                    Qwen 3.8 27B (Groq LPU) đang điều phối Agent & truy vấn MySQL...
                  </span>
                </div>
                <div
                  className="animate-pulse"
                  style={{
                    height: 12,
                    width: '88%',
                    borderRadius: 6,
                    background: 'var(--color-border)',
                  }}
                />
                <div
                  className="animate-pulse"
                  style={{
                    height: 12,
                    width: '64%',
                    borderRadius: 6,
                    background: 'var(--color-border)',
                  }}
                />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Composer Bar */}
          <div
            style={{
              padding: '12px 20px',
              background: 'var(--color-surface)',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '10px',
                background: 'var(--color-bg)',
                border: '1.5px solid var(--color-border)',
                borderRadius: 14,
                padding: '8px 12px',
              }}
            >
              <textarea
                ref={inputRef}
                rows={2}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Nhập câu hỏi kiểm thử cho Qwen 3.8 27B (VD: Thống kê Lead mới tháng này, Báo cáo thu chi PO/SO, Công việc của tôi...)"
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: 'var(--color-text)',
                  fontSize: '0.875rem',
                  resize: 'none',
                  lineHeight: 1.5,
                }}
              />
              <button
                type="button"
                disabled={isSending || !inputText.trim()}
                onClick={() => handleSendMessage()}
                style={{
                  height: 38,
                  padding: '0 16px',
                  borderRadius: 10,
                  border: 'none',
                  background:
                    isSending || !inputText.trim()
                      ? 'var(--color-border)'
                      : 'var(--color-primary)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: isSending || !inputText.trim() ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                }}
              >
                <Send size={15} />
                <span>Gửi Qwen 3.8</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Groq LPU Telemetry & Tool Execution Inspector */}
        <div
          style={{
            borderLeft: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            padding: '14px',
            gap: '16px',
          }}
        >
          {/* Groq LPU Speedometer Card */}
          <div
            style={{
              padding: '14px',
              borderRadius: 14,
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: 'var(--color-text-muted)',
                }}
              >
                Groq LPU Telemetry
              </span>
              <Zap size={14} style={{ color: '#059669' }} />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
              }}
            >
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>Tốc độ Sinh Token</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#059669' }}>
                  {latestTelemetryMessage?.telemetry?.tokens_per_second
                    ? `${latestTelemetryMessage.telemetry.tokens_per_second} tok/s`
                    : '—'}
                </div>
              </div>

              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>Thời gian Groq LPU</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)' }}>
                  {latestTelemetryMessage?.telemetry?.groq_time_ms !== undefined
                    ? `${latestTelemetryMessage.telemetry.groq_time_ms} ms`
                    : '—'}
                </div>
              </div>

              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>Tổng Tokens (In/Out)</div>
                <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--color-text)' }}>
                  {latestTelemetryMessage?.telemetry
                    ? `${latestTelemetryMessage.telemetry.prompt_tokens} / ${latestTelemetryMessage.telemetry.completion_tokens}`
                    : '—'}
                </div>
              </div>

              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>Số vòng Tool Loop</div>
                <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                  {latestTelemetryMessage?.telemetry?.turns_used
                    ? `${latestTelemetryMessage.telemetry.turns_used} vòng`
                    : '1 vòng'}
                </div>
              </div>
            </div>
          </div>

          {/* Active Collaborating Agents */}
          <div>
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                color: 'var(--color-text-muted)',
                marginBottom: 8,
              }}
            >
              Swarm Đang Phối Hợp
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(latestTelemetryMessage?.collaborating_agents || [
                {
                  id: 'master',
                  badge: 'SI IDEAS (Qwen 3.8 27B)',
                  focus: 'Sẵn sàng phân tích yêu cầu và gọi công cụ MySQL.',
                },
              ]).map((ag) => (
                <div
                  key={ag.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                    {ag.badge}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 3 }}>
                    {ag.focus}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tool Execution Trace */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                color: 'var(--color-text-muted)',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>Nhật ký Gọi Tool (MySQL)</span>
              <Terminal size={13} />
            </div>

            {!latestTelemetryMessage?.executed_steps ||
            latestTelemetryMessage.executed_steps.length === 0 ? (
              <div
                style={{
                  padding: '16px 12px',
                  borderRadius: 12,
                  background: 'var(--color-bg)',
                  border: '1px dashed var(--color-border)',
                  fontSize: '0.75rem',
                  color: 'var(--color-text-muted)',
                  textAlign: 'center',
                }}
              >
                Chưa có lệnh gọi công cụ nào trong lượt gần nhất. Hãy bấm vào một kịch bản test bên trái!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {latestTelemetryMessage.executed_steps.map((step, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      fontSize: '0.74rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 6,
                      }}
                    >
                      <code style={{ fontWeight: 800, color: 'var(--color-text)' }}>{step.tool}</code>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: '#059669',
                        }}
                      >
                        {step.latency_ms}ms
                      </span>
                    </div>
                    <div style={{ marginTop: 4, color: 'var(--color-primary)', fontWeight: 700 }}>
                      {step.summary}
                    </div>
                    <pre
                      style={{
                        marginTop: 6,
                        marginBottom: 0,
                        padding: '6px 8px',
                        borderRadius: 8,
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        fontSize: '0.68rem',
                        color: 'var(--color-text-muted)',
                        overflowX: 'auto',
                      }}
                    >
                      {JSON.stringify(step.args, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Security / API Key Configuration Modal */}
      {showKeyModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2147483646,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setShowKeyModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 460,
              borderRadius: 18,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              padding: 22,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <KeyRound size={20} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>
                Bảo mật Groq Cloud API Key
              </h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.5, marginTop: 0 }}>
              API Key của bạn đang được lưu trữ bảo mật ở tầng Backend (<code>backend/.env.local</code> — nằm trong{' '}
              <code>.gitignore</code> và <code>system_settings</code>), tuyệt đối không lộ trên trình duyệt hay Git.
            </p>
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                fontSize: '0.8rem',
                marginBottom: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ color: 'var(--color-text-muted)' }}>Key đang kích hoạt:</span>
              <code style={{ fontWeight: 800, color: '#059669' }}>
                {statusInfo?.masked_key || 'Đã cấu hình'}
              </code>
            </div>

            <form onSubmit={handleSaveApiKey}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                Đổi Groq API Key mới (Tùy chọn - Để trống nếu giữ nguyên):
              </label>
              <input
                type="password"
                value={newApiKeyInput}
                onChange={(e) => setNewApiKeyInput(e.target.value)}
                placeholder="gsk_..."
                style={{
                  width: '100%',
                  height: 38,
                  padding: '0 12px',
                  borderRadius: 10,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  fontSize: '0.84rem',
                  marginBottom: 16,
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  style={{
                    height: 36,
                    padding: '0 14px',
                    borderRadius: 10,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={savingKey}
                  style={{
                    height: 36,
                    padding: '0 16px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'var(--color-primary)',
                    color: '#fff',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {savingKey ? 'Đang lưu...' : 'Lưu cấu hình'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const renderInlineMarkdown = (text: string, onExport: (href: string) => void): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  const tokenRegex = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[2] !== undefined && match[3] !== undefined) {
      const label = match[2];
      const rawHref = match[3].trim();
      if (rawHref.includes('/export?')) {
        nodes.push(
          <button
            key={`exp-${keyIdx++}`}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onExport(rawHref);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              margin: '4px 4px 4px 0',
              padding: '6px 13px',
              borderRadius: 9,
              background: 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Download size={13} />
            <span>{label}</span>
          </button>
        );
      } else {
        nodes.push(
          <a
            key={`lnk-${keyIdx++}`}
            href={rawHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'var(--color-primary)',
              fontWeight: 700,
              textDecoration: 'underline',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>{label}</span>
            <ExternalLink size={12} />
          </a>
        );
      }
    } else if (match[4] !== undefined) {
      nodes.push(<strong key={`b-${keyIdx++}`}>{match[4]}</strong>);
    } else if (match[5] !== undefined) {
      nodes.push(
        <code
          key={`c-${keyIdx++}`}
          style={{
            padding: '1px 6px',
            borderRadius: 5,
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            fontSize: '0.79rem',
            fontFamily: 'monospace',
          }}
        >
          {match[5]}
        </code>
      );
    }
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
};

const QwenMarkdownRenderer: React.FC<{ content: string; onExport: (href: string) => void }> = ({
  content,
  onExport,
}) => {
  const lines = String(content || '').split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // GFM Table detection
    if (trimmed.startsWith('|') && i + 1 < lines.length && /^\s*\|?[\s:-]+\|/.test(lines[i + 1])) {
      const parseRow = (rowStr: string) =>
        rowStr
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());

      const headers = parseRow(lines[i]);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(parseRow(lines[i]));
        i++;
      }

      elements.push(
        <div
          key={`tbl-${i}`}
          style={{
            overflowX: 'auto',
            margin: '12px 0',
            borderRadius: 10,
            border: '1px solid var(--color-border)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr>
                {headers.map((h, hIdx) => (
                  <th
                    key={hIdx}
                    style={{
                      padding: '8px 12px',
                      background: 'var(--color-bg)',
                      borderBottom: '1px solid var(--color-border)',
                      textAlign: 'left',
                      fontWeight: 800,
                      fontSize: '0.74rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    {renderInlineMarkdown(h, onExport)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, rIdx) => (
                <tr key={rIdx}>
                  {r.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      {renderInlineMarkdown(cell, onExport)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={`h3-${i}`} style={{ margin: '12px 0 6px', fontSize: '0.94rem', fontWeight: 800 }}>
          {renderInlineMarkdown(trimmed.slice(4), onExport)}
        </h4>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 key={`h2-${i}`} style={{ margin: '14px 0 6px', fontSize: '1.02rem', fontWeight: 800 }}>
          {renderInlineMarkdown(trimmed.slice(3), onExport)}
        </h3>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h2 key={`h1-${i}`} style={{ margin: '14px 0 8px', fontSize: '1.1rem', fontWeight: 800 }}>
          {renderInlineMarkdown(trimmed.slice(2), onExport)}
        </h2>
      );
      i++;
      continue;
    }

    // Bullet list
    if (/^[-*•]\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} style={{ margin: '6px 0 10px 18px', padding: 0 }}>
          {listItems.map((item, idx) => (
            <li key={idx} style={{ marginBottom: 4 }}>
              {renderInlineMarkdown(item, onExport)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Paragraph
    elements.push(
      <p key={`p-${i}`} style={{ margin: '6px 0' }}>
        {renderInlineMarkdown(line, onExport)}
      </p>
    );
    i++;
  }

  return <>{elements}</>;
};

export default QwenAgentLabPage;
