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
    <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 z-30 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.03)] transition-all duration-300 flex flex-col">
      {/* Top Row: Title & Actions */}
      <div className="h-[72px] lg:h-20 px-4 lg:px-8 flex items-center justify-between relative">
        <div className="flex items-center gap-3 lg:gap-5 z-10 min-w-0 lg:w-1/4">
          <button onClick={onBack} className="p-2 hover:bg-slate-50 dark:bg-slate-950 rounded-xl text-slate-400 hover:text-slate-800 dark:text-slate-200 transition-colors shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-2 lg:gap-3 overflow-hidden">
              <input
                className="text-sm lg:text-base font-bold text-slate-800 dark:text-slate-200 bg-transparent border-none outline-none focus:ring-2 focus:ring-[#2563eb]/20 rounded-lg px-2 -ml-2 w-full transition-all hover:bg-slate-50 dark:bg-slate-950 focus:bg-white dark:bg-slate-900 truncate"
                value={flow.name}
                onChange={(e) => onRename?.(e.target.value)}
                placeholder="Tên kịch bản..."
                title="Sửa tên kịch bản nhanh"
                disabled={isViewMode}
              />
              {isViewMode && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[8px] lg:text-[9px] font-bold uppercase tracking-widest border border-blue-100 flex-shrink-0">Preview</span>}
            </div>
            <div className="flex items-center gap-2 mt-1 lg:mt-1.5">
            <Badge variant={flow.status === 'active' ? 'success' : (isArchived ? 'danger' : 'neutral')} className="text-[9px] px-2.5 py-1 uppercase font-black tracking-[0.15em] rounded-lg shadow-sm border-none bg-opacity-90 backdrop-blur-sm">
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
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    {durationInfo.min === durationInfo.max ? durationInfo.max : `${durationInfo.min} - ${durationInfo.max}`}
                  </span>
                </div>
              )}

              {isSaving && !isArchived && (
                <span className="text-[10px] font-black text-emerald-500 animate-pulse ml-3 flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-lg">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                  SAVING...
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Absolute Tabs Container - Increased z-index */}
        <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          <div className="bg-slate-50 dark:bg-slate-950 p-1.5 rounded-2xl flex gap-1.5 border border-slate-200 dark:border-slate-800 shadow-inner ring-4 ring-black/[0.02]">
            {[
              { id: 'builder', label: 'Thiết kế', icon: Layout },
              { id: 'analytics', label: 'Báo cáo', icon: BarChart3 },
              { id: 'settings', label: 'Cài đặt', icon: SettingsIcon },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id as any)}
                className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all duration-500 relative group ${activeTab === tab.id ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-md ring-1 ring-slate-200/50 dark:ring-white/10' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 hover:bg-white/50 dark:hover:bg-slate-900/50'}`}
              >
                <tab.icon className={`w-4 h-4 transition-transform duration-500 ${activeTab === tab.id ? 'scale-110' : 'group-hover:scale-110'}`} />
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
                className="w-10 sm:w-auto h-10 px-0 sm:px-4 lg:px-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] flex justify-center items-center gap-2 transition-all border border-purple-500/30 bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-[0_8px_20px_-6px_rgba(124,58,237,0.5)] hover:shadow-[0_12px_25px_-4px_rgba(124,58,237,0.6)] hover:-translate-y-0.5 active:scale-95 shrink-0 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                {isAiReviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-purple-200 group-hover:rotate-12 transition-transform" />} 
                <span className="hidden sm:inline relative z-10">AI REVIEW</span>
              </button>
              <button
                onClick={onToggleStatus}
                className={`w-10 sm:w-auto h-10 px-0 sm:px-4 lg:px-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] flex justify-center items-center gap-2 transition-all border shadow-sm hover:-translate-y-0.5 active:scale-95 shrink-0 ${flow.status === 'active'
                  ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 shadow-rose-200/30'
                  : (hasCriticalErrors ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-300 cursor-not-allowed opacity-50' : 'bg-white dark:bg-slate-950 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-500 shadow-emerald-500/10')
                  }`}
              >
                {flow.status === 'active' ? (
                  <><Pause className="w-4 h-4 fill-current" /> <span className="hidden sm:inline">DỪNG</span></>
                ) : (
                  hasCriticalErrors ? <><Lock className="w-4 h-4" /> <span className="hidden sm:inline">LOCKED</span></> : <><Play className="w-4 h-4 fill-current" /> <span className="hidden sm:inline">KÍCH HOẠT</span></>
                )}
              </button>
            </div>
          )}

          <div className="h-6 lg:h-8 w-px bg-slate-200 mx-0.5 lg:mx-1 hidden md:block"></div>

          {activeTab === 'builder' && (
            <div className="flex items-center gap-1.5">
              {/* Desktop: show 3 icon buttons individually */}
              <button
                onClick={onToggleReportMode}
                className={`hidden sm:flex p-2 lg:p-2.5 rounded-xl transition-all items-center gap-2 border active:scale-95 ${isReportMode ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'border-transparent text-slate-400 hover:text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:bg-slate-950'}`}
                title={isReportMode ? "Tắt Báo cáo nhanh" : "Xem Báo cáo nhanh"}
              >
                <BarChart3 className="w-4 h-4 lg:w-5 h-5" />
              </button>

              <button
                onClick={onToggleViewMode}
                className={`hidden sm:flex p-2 lg:p-2.5 rounded-xl transition-all items-center gap-2 border active:scale-95 ${isViewMode ? 'bg-orange-50 text-[#ca7900] border-orange-200' : 'border-transparent text-slate-400 hover:text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:bg-slate-950'}`}
                title={isViewMode ? "Thoát chế độ xem" : "Xem trước"}
              >
                {isViewMode ? <EyeOff className="w-4 h-4 lg:w-5 h-5" /> : <Eye className="w-4 h-4 lg:w-5 h-5" />}
              </button>

              <button
                onClick={onToggleSidebar}
                className={`hidden sm:flex p-2 lg:p-2.5 rounded-xl transition-all items-center gap-2 border active:scale-95 ${isSidebarOpen ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'border-transparent text-slate-400 hover:text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:bg-slate-950'}`}
                title={isSidebarOpen ? "Ẩn thanh bên" : "Hiện thanh bên"}
              >
                <Layout className="w-4 h-4 lg:w-5 h-5" />
              </button>

              {/* Mobile: collapse all 3 into a single ⋯ More dropdown */}
              <div className="relative sm:hidden" ref={moreMenuRef}>
                <button
                  onClick={() => setMoreMenuOpen(prev => !prev)}
                  className={`flex p-2 rounded-xl transition-all border active:scale-95 ${moreMenuOpen ? 'bg-slate-100 text-slate-700 border-slate-200' : 'border-transparent text-slate-400 hover:bg-slate-50 hover:text-slate-700'}`}
                  title="Thêm tùy chọn"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {moreMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    <button
                      onClick={() => { onToggleReportMode?.(); setMoreMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-left transition-colors ${
                        isReportMode ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600 hover:bg-slate-50'
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
            <Button
              size="sm"
              icon={RefreshCw}
              onClick={onSync}
              disabled={isSyncing}
              variant="secondary"
              className={`border-slate-200 dark:border-slate-700/60 !rounded-xl transition-all ${isSyncing ? 'animate-pulse' : ''}`}
            >
              {isSyncing ? 'Đang làm mới...' : 'Làm mới'}
            </Button>
          )}

          {isArchived ? (
            <Button icon={RefreshCw} onClick={onRestore} variant="primary" className="h-9 lg:h-10 rounded-full px-2 sm:px-4 lg:px-6 text-[9px] lg:text-[10px] uppercase font-black tracking-widest min-w-0"><span className="hidden sm:inline">Khôi phục</span></Button>
          ) : (
            <Button
              variant="custom"
              icon={Save}
              onClick={onSave}
              disabled={isViewMode}
              isLoading={isSaving}
              className={`h-9 lg:h-10 rounded-full px-2 sm:px-4 lg:px-6 text-[9px] lg:text-[10px] uppercase font-black tracking-widest transition-all min-w-0 flex items-center justify-center gap-2 ${isViewMode || isSaving
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none border-none'
                : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white shadow-md active:scale-95 border-none'
                }`}
            >
              <span className="hidden sm:inline">Lưu</span>
            </Button>
          )}
        </div>
      </div >

      {/* Mobile Row: Navigation Tabs */}
      <div className="flex lg:hidden w-full overflow-x-auto border-t border-slate-50 py-2 px-2 gap-2 justify-center bg-white dark:bg-slate-900">
        <div className="flex gap-1 p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
          {[
            { id: 'builder', label: 'Thiết kế', icon: Layout },
            { id: 'analytics', label: 'Báo cáo', icon: BarChart3 },
            { id: 'settings', label: 'Cài đặt', icon: SettingsIcon },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
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
                <div className="p-1.5 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 rounded-lg">
                    <Sparkles className="w-5 h-5 text-purple-600" />
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
                          
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div className="bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col gap-2 shadow-sm">
                                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                      <div className="p-1.5 bg-indigo-500 text-white rounded-lg shrink-0 shadow-sm"><Mail className="w-3.5 h-3.5" /></div>
                                      <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Email</span>
                                  </div>
                                  <div className="text-lg font-black text-slate-800 dark:text-slate-200">
                                      {flow.steps?.filter(s => s.type === 'action' || s.label?.toLowerCase().includes('email')).length || 0}
                                  </div>
                              </div>
                              <div className="bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col gap-2 shadow-sm">
                                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                      <div className="p-1.5 bg-blue-500 text-white rounded-lg shrink-0 shadow-sm"><MessageSquare className="w-3.5 h-3.5" /></div>
                                      <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Zalo ZNS</span>
                                  </div>
                                  <div className="text-lg font-black text-slate-800 dark:text-slate-200">
                                      {flow.steps?.filter(s => s.type === 'zalo_zns' || s.type === 'zalo_cs' || s.label?.toLowerCase().includes('zalo')).length || 0}
                                  </div>
                              </div>
                              <div className="bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col gap-2 shadow-sm">
                                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                      <div className="p-1.5 bg-amber-500 text-white rounded-lg shrink-0 shadow-sm"><Timer className="w-3.5 h-3.5" /></div>
                                      <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Bước Chờ</span>
                                  </div>
                                  <div className="text-lg font-black text-slate-800 dark:text-slate-200">
                                      {flow.steps?.filter(s => s.type === 'wait').length || 0}
                                  </div>
                              </div>
                              <div className="bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col gap-2 shadow-sm">
                                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                      <div className="p-1.5 bg-purple-500 text-white rounded-lg shrink-0 shadow-sm"><GitMerge className="w-3.5 h-3.5" /></div>
                                      <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">Rẽ Nhánh</span>
                                  </div>
                                  <div className="text-lg font-black text-slate-800 dark:text-slate-200">
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
                          <Button variant="primary" onClick={handleConfirmAiReview} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white border-0 shadow-md active:scale-95 transition-all duration-200">
                              <Sparkles className="w-4 h-4 mr-2" /> Bắt đầu Phân tích
                          </Button>
                      </div>
                  </div>
              ) : isAiReviewing ? (
                  <div className="flex flex-col py-8 px-4 space-y-6">
                      <div className="flex justify-center mb-2">
                          <div className="relative">
                              <div className="absolute inset-0 bg-purple-400 blur-xl opacity-20 rounded-full animate-pulse"></div>
                              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-xl flex items-center justify-center relative overflow-hidden">
                                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay"></div>
                                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                              </div>
                          </div>
                      </div>
                      
                      <div className="space-y-3 max-w-sm mx-auto w-full">
                          <div className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-500 ${loadingStep >= 0 ? 'bg-slate-50 dark:bg-slate-800/50 opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}>
                              {loadingStep > 0 ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Search className="w-5 h-5 text-purple-500 animate-pulse" />}
                              <span className={`text-sm font-medium ${loadingStep > 0 ? 'text-slate-600 dark:text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>Đang quét toàn bộ cấu trúc kịch bản...</span>
                          </div>
                          
                          <div className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-500 delay-150 ${loadingStep >= 1 ? 'bg-slate-50 dark:bg-slate-800/50 opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}>
                              {loadingStep > 1 ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : (loadingStep === 1 ? <SettingsIcon className="w-5 h-5 text-indigo-500 animate-spin" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-200 dark:border-slate-700"></div>)}
                              <span className={`text-sm font-medium ${loadingStep > 1 ? 'text-slate-600 dark:text-slate-400' : (loadingStep === 1 ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600')}`}>Đang phân tích logic các node hành động...</span>
                          </div>

                          <div className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-500 delay-300 ${loadingStep >= 2 ? 'bg-slate-50 dark:bg-slate-800/50 opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}>
                              {loadingStep > 2 ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : (loadingStep === 2 ? <GitMerge className="w-5 h-5 text-blue-500 animate-pulse" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-200 dark:border-slate-700"></div>)}
                              <span className={`text-sm font-medium ${loadingStep > 2 ? 'text-slate-600 dark:text-slate-400' : (loadingStep === 2 ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600')}`}>Đang kiểm tra rủi ro & điều kiện rẽ nhánh...</span>
                          </div>

                          <div className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-500 delay-500 ${loadingStep >= 3 ? 'bg-slate-50 dark:bg-slate-800/50 opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}>
                              {loadingStep === 3 ? <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-200 dark:border-slate-700"></div>}
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
                                  h3: ({node, ...props}) => <h3 className="text-[13px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 mt-8 mb-3 flex items-center gap-2 border-b border-purple-100 dark:border-purple-900/30 pb-2" {...props} />,
                                  p: ({node, ...props}) => <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4" {...props} />,
                                  ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-5 space-y-2 marker:text-purple-400" {...props} />,
                                  li: ({node, ...props}) => <li className="text-slate-600 dark:text-slate-300 leading-relaxed" {...props} />,
                                  strong: ({node, ...props}) => <strong className="text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-500/10 px-1 rounded" {...props} />
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
