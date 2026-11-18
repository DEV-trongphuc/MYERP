import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Pause, Play, Lock, Save, RefreshCw, Eye, EyeOff, Layout, BarChart3, Settings as SettingsIcon, Clock, TrendingUp, Sparkles, Loader2, Search, CheckCircle2, GitMerge, Mail, MessageSquare, Timer, MoreVertical } from 'lucide-react';
import Badge from '../../common/Badge';
import Button from '../../common/Button';
import Modal from '../../common/Modal';
import ReactMarkdown from '../../../shims/reactMarkdown';
import { Flow } from '../../../types';
import { api } from '../../../services/storageAdapter';

interface FlowHeaderProps {
  flow: Flow;
  isSaving: boolean;
  hasCriticalErrors: boolean;
  isViewMode: boolean;
  activeTab: 'builder' | 'analytics' | 'settings';
  durationInfo?: { min: string, max: string } | null;
  onBack?: () => void;
  onTabChange?: (tab: 'builder' | 'analytics' | 'settings') => void;
  onToggleStatus?: () => void;
  onToggleViewMode?: () => void;
  onSave: () => void;
  onRestore: () => void;
  onSimulate: () => void;
  onHistory?: () => void;
  onActivate?: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onToggleReportMode?: () => void;
  isReportMode?: boolean;
  onSync?: () => void;
  isSyncing?: boolean;
  onRename?: (name: string) => void;
  canSave?: boolean;
}

const FlowHeader: React.FC<FlowHeaderProps> = ({
  flow,
  isSaving,
  hasCriticalErrors,
  isViewMode,
  activeTab,
  durationInfo,
  onBack,
  onTabChange,
  onToggleStatus,
  onToggleViewMode,
  onSave,
  onRestore,
  onSimulate,
  isSidebarOpen,
  onToggleSidebar,
  onToggleReportMode,
  isReportMode,
  onSync,
  isSyncing,
  onRename,
  canSave = true
}) => {
  const isArchived = flow.status === 'archived';

  // More menu for mobile (collapses secondary icon buttons)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close more menu on outside click
  useEffect(() => {
    if (!moreMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [moreMenuOpen]);

  // AI Review State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [isConfirmingAi, setIsConfirmingAi] = useState(false);
  const [isAiReviewing, setIsAiReviewing] = useState(false);
  const [aiReviewResult, setAiReviewResult] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);

  useEffect(() => {
      if (isAiReviewing) {
          setLoadingStep(0);
          const interval = setInterval(() => {
              setLoadingStep(prev => (prev < 3 ? prev + 1 : prev));
          }, 1500);
          return () => clearInterval(interval);
      }
  }, [isAiReviewing]);

  const handleAiReviewClick = () => {
      setAiModalOpen(true);
      setIsConfirmingAi(true);
      setIsAiReviewing(false);
      setAiReviewResult(null);
  };

  const handleConfirmAiReview = async () => {
      setIsConfirmingAi(false);
      setIsAiReviewing(true);
      setAiReviewResult(null);

      try {
            const data: any = await api.post('flow_ai_review.php', { flow });
            
            // Force React to render SOMETHING by stringifying if review is missing
            let extractedReview = '';
            
            if (data?.data?.review) {
                extractedReview = data.data.review;
            } else if (data?.review) {
                extractedReview = data.review;
            } else {
                extractedReview = "Dữ liệu trả về không đúng định dạng:\n```json\n" + JSON.stringify(data, null, 2) + "\n```";
            }
            
            // UI Auto-Detection: Replace UUIDs with Node Labels
            const uuidRegex = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;
            extractedReview = extractedReview.replace(uuidRegex, (match) => {
                const step = flow.steps?.find(s => s.id === match);
                if (step) {
                    return `**[${step.label || step.type}]**`;
                }
                return match;
            });
            
            // Ensure proper markdown block separation for headings just in case AI returns tight strings
            extractedReview = extractedReview.replace(/### /g, '\n\n### ');

            if (data?.success) {
                setAiReviewResult(extractedReview);
            } else {
                setAiReviewResult(`Lỗi: ${data?.error || data?.message || 'Không thể lấy nhận xét từ AI.'}`);
            }
      } catch (error) {
          setAiReviewResult('Đã xảy ra lỗi khi kết nối tới AI.');
      } finally {
          setIsAiReviewing(false);
      }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-30 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.03)] transition-colors duration-200 flex flex-col">
      {/* Top Row: Title & Actions */}
      <div className="h-[72px] lg:h-20 px-4 lg:px-8 flex items-center justify-between relative">
        <div className="flex items-center gap-3 lg:gap-5 z-10 min-w-0 lg:w-1/4">
          <button onClick={onBack} className="p-2 hover:bg-slate-50 dark:bg-slate-950 rounded-xl text-slate-400 hover:text-slate-800 dark:text-slate-200 transition-colors shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-2 lg:gap-3 overflow-hidden">
              <input
                className="text-sm lg:text-base font-bold text-slate-800 dark:text-slate-200 bg-transparent border-none outline-none focus:ring-2 focus:ring-[#2563eb]/20 rounded-lg px-2 -ml-2 w-full transition-colors hover:bg-slate-50 dark:bg-slate-950 focus:bg-white dark:bg-slate-900 truncate"
                value={flow.name}
                onChange={(e) => onRename?.(e.target.value)}
                placeholder="Tên kịch bản..."
                title="Sửa tên kịch bản nhanh"
                disabled={isViewMode}
              />
              {isViewMode && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[8px] lg:text-[9px] font-bold uppercase tracking-widest border border-blue-100 flex-shrink-0">Preview</span>}
            </div>
            <div className="flex items-center gap-2 mt-1 lg:mt-1.5">
            <Badge variant={flow.status === 'active' ? 'success' : (isArchived ? 'danger' : 'neutral')} className="text-[9px] px-2.5 py-1 uppercase font-bold tracking-[0.12em] rounded-lg shadow-sm border-none bg-opacity-90 backdrop-blur-sm">
                {flow.status === 'active' ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>ĐANG CHẠY</span>
                  </div>
                ) : (isArchived ? 'ĐÃ XOÁ' : 'TẠM DỪNG')}
              </Badge>

              {/* DURATION DISPLAY - Hidden on mobile, shown on SM+ */}
              {durationInfo && !isArchived && (
                <div className="hidden sm:flex items-center gap-2 ml-3 pl-3 border-l border-slate-200 dark:border-slate-800">
                  <Timer className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest tabular-nums">
                    {durationInfo.min === durationInfo.max ? durationInfo.max : `${durationInfo.min} - ${durationInfo.max}`}
                  </span>
                </div>
              )}

              {isSaving && !isArchived && (
                <span className="text-[10px] font-bold text-emerald-600 animate-pulse ml-3 flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-lg">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                  SAVING...
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Absolute Tabs Container */}
        <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          <div className="h-9 rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 flex items-center gap-1 border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
            {[
              { id: 'builder', label: 'Thiết kế', icon: Layout },
              { id: 'analytics', label: 'Báo cáo', icon: BarChart3 },
              { id: 'settings', label: 'Cài đặt', icon: SettingsIcon },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => onTabChange?.(tab.id as any)}
                className={`h-8 flex items-center gap-2 px-4 rounded-lg text-xs font-semibold transition-colors duration-200 ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-slate-900 text-[var(--color-text)] shadow-xs'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 lg:gap-3 z-10 shrink-0">
          {!isArchived && activeTab === 'builder' && (
            <div className="flex items-center gap-1.5 lg:gap-2">
              <button
                onClick={handleAiReviewClick}
                disabled={isAiReviewing || isConfirmingAi}
                className="h-9 px-3.5 rounded-xl bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700 hover:bg-slate-200/70 dark:hover:bg-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                title="AI phân tích và đánh giá luồng"
              >
                {isAiReviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-[#BD1D2D]" strokeWidth={1.75} />} 
                <span className="hidden sm:inline">AI REVIEW</span>
              </button>
              <button
                onClick={onToggleStatus}
                className={`h-9 px-3.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors border shadow-xs ${flow.status === 'active'
                  ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50'
                  : (hasCriticalErrors
                    ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed opacity-50'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50')
                }`}
              >
                {flow.status === 'active' ? (
                  <><Pause className="w-3.5 h-3.5 fill-current" /> <span className="hidden sm:inline">DỪNG</span></>
                ) : (
                  hasCriticalErrors ? <><Lock className="w-3.5 h-3.5" /> <span className="hidden sm:inline">LOCKED</span></> : <><Play className="w-3.5 h-3.5 fill-current" /> <span className="hidden sm:inline">KÍCH HOẠT</span></>
                )}
              </button>
            </div>
          )}

          <div className="h-6 lg:h-8 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 lg:mx-1 hidden md:block"></div>

          {activeTab === 'builder' && (
            <div className="flex items-center gap-1.5">
              {/* Desktop: clean segmented group */}
              <div className="hidden sm:flex items-center h-9 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 gap-0.5">
                <button
                  onClick={onToggleReportMode}
                  className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                    isReportMode
                      ? 'bg-white dark:bg-slate-900 text-[#BD1D2D] shadow-xs'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  }`}
                  title={isReportMode ? "Tắt Báo cáo nhanh" : "Xem Báo cáo nhanh"}
                >
                  <BarChart3 className="w-4 h-4" />
                </button>

                <button
                  onClick={onToggleViewMode}
                  className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                    isViewMode
                      ? 'bg-white dark:bg-slate-900 text-amber-600 shadow-xs'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  }`}
                  title={isViewMode ? "Thoát chế độ xem" : "Xem trước"}
                >
                  {isViewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>

                <button
                  onClick={onToggleSidebar}
                  className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                    isSidebarOpen
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  }`}
                  title={isSidebarOpen ? "Ẩn thanh bên" : "Hiện thanh bên"}
                >
                  <Layout className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile: collapse all 3 into a single ⋯ More dropdown */}
              <div className="relative sm:hidden" ref={moreMenuRef}>
                <button
                  onClick={() => setMoreMenuOpen(prev => !prev)}
                  className={`flex p-2 rounded-xl transition-colors border ${moreMenuOpen ? 'bg-slate-100 text-slate-700 border-slate-200' : 'border-transparent text-slate-400 hover:bg-slate-50 hover:text-slate-700'}`}
                  title="Thêm tùy chọn"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {moreMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden">
                    <button
                      onClick={() => { onToggleReportMode?.(); setMoreMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-left transition-colors ${
                        isReportMode ? 'text-[#BD1D2D] bg-rose-50 dark:bg-rose-950/30' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <BarChart3 className="w-4 h-4" />
                      {isReportMode ? 'Tắt Báo cáo nhanh' : 'Báo cáo nhanh'}
                    </button>
                    <button
                      onClick={() => { onToggleViewMode?.(); setMoreMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-left transition-colors border-t border-slate-50 dark:border-slate-800 ${
                        isViewMode ? 'text-amber-600 bg-orange-50' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {isViewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {isViewMode ? 'Thoát xem trước' : 'Xem trước'}
                    </button>
                    <button
                      onClick={() => { onToggleSidebar?.(); setMoreMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-left transition-colors border-t border-slate-50 dark:border-slate-800 ${
                        isSidebarOpen ? 'text-emerald-600 bg-emerald-50' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Layout className="w-4 h-4" />
                      {isSidebarOpen ? 'Ẩn thanh bên' : 'Hiện thanh bên'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <button
              onClick={onSync}
              disabled={isSyncing}
              className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-bg)] text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Đang làm mới...' : 'Làm mới'}
            </button>
          )}

          {isArchived ? (
            <button
              onClick={onRestore}
              className="bg-emerald-600 text-white hover:bg-emerald-700 h-9 px-4 rounded-xl font-semibold text-xs shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Khôi phục</span>
            </button>
          ) : (
            <button
              onClick={onSave}
              disabled={isViewMode || isSaving}
              className={`h-9 px-4 rounded-xl font-semibold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-colors ${
                isViewMode || isSaving
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-[var(--color-primary)] text-white hover:brightness-95'
              }`}
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Lưu</span>
            </button>
          )}
        </div>
      </div >

      {/* Mobile Row: Navigation Tabs */}
      <div className="flex lg:hidden w-full overflow-x-auto border-t border-slate-200 dark:border-slate-800 py-2 px-2 justify-center bg-white dark:bg-slate-900">
        <div className="h-9 rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 flex gap-1 border border-slate-200/80 dark:border-slate-700/60">
          {[
            { id: 'builder', label: 'Thiết kế', icon: Layout },
            { id: 'analytics', label: 'Báo cáo', icon: BarChart3 },
            { id: 'settings', label: 'Cài đặt', icon: SettingsIcon },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange?.(tab.id as any)}
              className={`h-8 flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-900 text-[var(--color-text)] shadow-xs'
                  : 'text-[var(--color-text-muted)]'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* AI Review Modal */}
      <Modal
          isOpen={aiModalOpen}
          onClose={() => setAiModalOpen(false)}
          title={
            <div className="flex items-center gap-2">
                <div className="p-1.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/70 dark:border-rose-800/40 rounded-lg">
                    <Sparkles className="w-4 h-4 text-[#BD1D2D]" strokeWidth={1.75} />
                </div>
                <span>AI Phân Tích & Đánh Giá</span>
            </div>
          }
          size="lg"
      >
          <div className="space-y-4">
              {isConfirmingAi ? (
                  <div className="flex flex-col space-y-4">
                      <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Tóm tắt Kịch bản sẽ gửi cho AI:</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">Hệ thống sẽ tổng hợp các thông số dưới đây và gửi cho AI để tìm ra các lỗ hổng về logic rẽ nhánh, vòng lặp vô tận, hoặc trải nghiệm người dùng kém.</p>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
                              <div className="bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col gap-2 shadow-sm">
                                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                      <div className="p-1.5 bg-[#0F172A] text-white rounded-lg shrink-0 shadow-sm"><Mail className="w-3.5 h-3.5" /></div>
                                      <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Email</span>
                                  </div>
                                  <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                                      {flow.steps?.filter(s => s.type === 'action' || s.label?.toLowerCase().includes('email')).length || 0}
                                  </div>
                              </div>
                              <div className="bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col gap-2 shadow-sm">
                                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                      <div className="p-1.5 bg-blue-600 text-white rounded-lg shrink-0 shadow-sm"><MessageSquare className="w-3.5 h-3.5" /></div>
                                      <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Zalo ZNS</span>
                                  </div>
                                  <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                                      {flow.steps?.filter(s => s.type === 'zalo_zns' || s.type === 'zalo_cs' || s.label?.toLowerCase().includes('zalo')).length || 0}
                                  </div>
                              </div>
                              <div className="bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col gap-2 shadow-sm">
                                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                      <div className="p-1.5 bg-amber-500 text-white rounded-lg shrink-0 shadow-sm"><Timer className="w-3.5 h-3.5" /></div>
                                      <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Bước Chờ</span>
                                  </div>
                                  <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                                      {flow.steps?.filter(s => s.type === 'wait').length || 0}
                                  </div>
                              </div>
                              <div className="bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col gap-2 shadow-sm">
                                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                      <div className="p-1.5 bg-[#BD1D2D] text-white rounded-lg shrink-0 shadow-sm"><GitMerge className="w-3.5 h-3.5" /></div>
                                      <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Rẽ Nhánh</span>
                                  </div>
                                  <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                                      {flow.steps?.reduce((acc, s) => {
                                          if (s.type === 'condition') return acc + 2;
                                          if (s.type === 'advanced_condition') return acc + (s.config?.branches?.length || 0) + 1;
                                          return acc;
                                      }, 0) || 0}
                                  </div>
                              </div>
                          </div>
                      </div>
                      <div className="flex justify-end gap-3 pt-2">
                          <Button variant="secondary" onClick={() => setAiModalOpen(false)}>Hủy bỏ</Button>
                          <Button variant="primary" onClick={handleConfirmAiReview} className="bg-[#BD1D2D] hover:bg-[#9A1523] text-white border-0 shadow-sm transition-colors duration-200">
                              <Sparkles className="w-4 h-4 mr-2" strokeWidth={1.75} /> Bắt đầu Phân tích
                          </Button>
                      </div>
                  </div>
              ) : isAiReviewing ? (
                  <div className="flex flex-col py-8 px-4 space-y-6">
                      <div className="flex justify-center mb-2">
                          <div className="w-16 h-16 bg-[#0F172A] border border-slate-700 rounded-2xl shadow-md flex items-center justify-center">
                              <Loader2 className="w-8 h-8 text-white animate-spin" />
                          </div>
                      </div>
                      
                      <div className="space-y-3 max-w-sm mx-auto w-full">
                          <div className={`flex items-center gap-3 p-3 rounded-xl transition-[opacity,transform] duration-300 ${loadingStep >= 0 ? 'bg-slate-50 dark:bg-slate-800/50 opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}>
                              {loadingStep > 0 ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Search className="w-5 h-5 text-[#BD1D2D] animate-pulse" />}
                              <span className={`text-sm font-medium ${loadingStep > 0 ? 'text-slate-600 dark:text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>Đang quét toàn bộ cấu trúc kịch bản...</span>
                          </div>
                          
                          <div className={`flex items-center gap-3 p-3 rounded-xl transition-[opacity,transform] duration-300 delay-150 ${loadingStep >= 1 ? 'bg-slate-50 dark:bg-slate-800/50 opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}>
                              {loadingStep > 1 ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : (loadingStep === 1 ? <SettingsIcon className="w-5 h-5 text-slate-700 dark:text-slate-300 animate-spin" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-200 dark:border-slate-700"></div>)}
                              <span className={`text-sm font-medium ${loadingStep > 1 ? 'text-slate-600 dark:text-slate-400' : (loadingStep === 1 ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600')}`}>Đang phân tích logic các node hành động...</span>
                          </div>

                          <div className={`flex items-center gap-3 p-3 rounded-xl transition-[opacity,transform] duration-300 delay-300 ${loadingStep >= 2 ? 'bg-slate-50 dark:bg-slate-800/50 opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}>
                              {loadingStep > 2 ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : (loadingStep === 2 ? <GitMerge className="w-5 h-5 text-blue-500 animate-pulse" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-200 dark:border-slate-700"></div>)}
                              <span className={`text-sm font-medium ${loadingStep > 2 ? 'text-slate-600 dark:text-slate-400' : (loadingStep === 2 ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600')}`}>Đang kiểm tra rủi ro & điều kiện rẽ nhánh...</span>
                          </div>

                          <div className={`flex items-center gap-3 p-3 rounded-xl transition-[opacity,transform] duration-300 delay-500 ${loadingStep >= 3 ? 'bg-slate-50 dark:bg-slate-800/50 opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}>
                              {loadingStep === 3 ? <Sparkles className="w-5 h-5 text-[#BD1D2D] animate-pulse" strokeWidth={1.75} /> : <div className="w-5 h-5 rounded-full border-2 border-slate-200 dark:border-slate-700"></div>}
                              <span className={`text-sm font-medium ${loadingStep === 3 ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600'}`}>Đang tổng hợp báo cáo tối ưu...</span>
                          </div>
                      </div>
                  </div>
              ) : aiReviewResult ? (
                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
                      <div className="max-w-none">
                          {/* Fallback to raw text if ReactMarkdown fails to render */}
                          <div className="whitespace-pre-wrap font-sans text-sm text-slate-700 dark:text-slate-300 mb-4 block md:hidden">
                              (Raw Output)<br/>{aiReviewResult}
                          </div>
                          <div className="hidden md:block text-sm">
                              <ReactMarkdown
                                components={{
                                  h3: ({node, ...props}) => <h3 className="text-[13px] font-bold uppercase tracking-widest text-[#BD1D2D] dark:text-rose-400 mt-8 mb-3 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2" {...props} />,
                                  p: ({node, ...props}) => <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4" {...props} />,
                                  ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-5 space-y-2 marker:text-[#BD1D2D]" {...props} />,
                                  li: ({node, ...props}) => <li className="text-slate-600 dark:text-slate-300 leading-relaxed" {...props} />,
                                  strong: ({node, ...props}) => <strong className="text-slate-900 dark:text-slate-100 font-semibold bg-slate-200/60 dark:bg-slate-800 px-1 rounded" {...props} />
                                }}
                              >
                                {aiReviewResult.replace(/### /g, '\n\n### ')}
                              </ReactMarkdown>
                          </div>
                      </div>
                  </div>
              ) : null}
          </div>
      </Modal>

    </div>
  );
};

export default FlowHeader;
