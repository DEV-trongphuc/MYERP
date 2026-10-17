import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Bot, Globe, FolderPlus, Plus, Building, Edit2, Trash2, ArrowLeft, BookOpen, ChevronDown, Sparkles, Zap, Users, Shield, Settings, Activity, MessageSquare, ExternalLink } from 'lucide-react';
import PageHero from '../../common/PageHero';

import Tabs from '../../common/Tabs';
import { useChatPage } from '../../../contexts/ChatPageContext';
import OrgUserManager from '../org/OrgUserManager';
import AdminLogsTab from './AdminLogsTab';
import FeedbackAdminPanel from './FeedbackAdminPanel';
import { AppIcon } from '../../../../common/AppIcons';

interface AITrainingGridProps {
    mainTab: 'website' | 'chat';
    setMainTab: (id: 'website' | 'chat') => void;
    categorySubTab?: 'chatbots' | 'users' | 'logs' | 'settings' | 'feedback';
    setCategorySubTab?: (tab: 'chatbots' | 'users' | 'logs' | 'settings' | 'feedback') => void;
    searchTerm: string;
    setSearchTerm: (s: string) => void;
    properties: any[];
    loading: boolean;
    setSelectedProperty: (id: string) => void;
    setViewMode: (mode: 'grid' | 'doc') => void;
    viewModeChat: 'categories' | 'chatbots';
    setViewModeChat: (mode: 'categories' | 'chatbots') => void;
    setSelectedCategoryId: (id: string | null) => void;
    categories: any[];
    chatbots: any[];
    setIsCreateCategoryModalOpen: (o: boolean) => void;
    setIsCreateBotModalOpen: (o: boolean) => void;
    selectedCategoryId: string | null;
    setActiveTab?: (tab: 'training' | 'settings' | 'embed' | 'instruction' | 'inbox' | 'logs') => void;
    setShareLinkToCopy: (url: string) => void;
    setIsShareLinkModalOpen: (o: boolean) => void;
    handleEditCategory: (c: any) => void;
    handleDeleteCategory: (id: string, name: string, e: any) => void;
    filteredChatbots: any[];
    handleEditBot: (b: any) => void;
    handleDeleteChatbot: (id: string, name: string) => void;
    setIsOptimizationModalOpen: (o: boolean) => void;
    setIsEmbeddingModalOpen: (o: boolean) => void;
    setIsTipsModalOpen: (o: boolean) => void;
    activePropertyId?: string | null;
    hideWebsiteTab?: boolean;
    brandColor?: string;
    onOpenOrgManager?: () => void;
    isDarkTheme?: boolean;
    singleGroupMode?: boolean;
    onClose?: () => void;
    selectedCategory?: any;
    /** Override orgUser from context — used by Autoflow shell to inject admin credentials */
    orgUserOverride?: any;
    onOpenAISpace?: (categoryId: string) => void;
    onOpenBotChat?: (botId: string, categoryId?: string) => void;
}

const AITrainingGrid: React.FC<AITrainingGridProps> = (props) => {
    const {
        mainTab, setMainTab, searchTerm, properties, loading,
        setSelectedProperty, setViewMode, viewModeChat, setViewModeChat,
        setSelectedCategoryId, categories, setIsCreateCategoryModalOpen,
        setIsCreateBotModalOpen,
        selectedCategoryId,
        handleEditCategory, handleDeleteCategory, filteredChatbots,
        handleEditBot, handleDeleteChatbot, setIsOptimizationModalOpen,
        setIsEmbeddingModalOpen,
        setIsTipsModalOpen,
        activePropertyId,
        hideWebsiteTab,
        brandColor = '#2563eb',
        onOpenOrgManager,
        isDarkTheme,
        categorySubTab,
        setCategorySubTab,
        selectedCategory: selectedCategoryProp
    } = props;

    const singleGroupMode = props.singleGroupMode;
    const onClose = props.onClose;

    // Fallback local state if not provided by parent (e.g. when used in AI Space)
    const [internalSubTab, setInternalSubTab] = useState<'chatbots' | 'users' | 'logs' | 'settings' | 'feedback'>('chatbots');
    const activeSubTab = categorySubTab || internalSubTab;
    const handleSetSubTab = (tab: any) => {
        if (setCategorySubTab) {
            setCategorySubTab(tab);
        } else {
            setInternalSubTab(tab);
        }
    };

    const { orgUser: orgUserFromContext } = useChatPage();
    // Use override (from Autoflow shell) if context orgUser is not available
    const orgUser = props.orgUserOverride ?? orgUserFromContext;
    const isAdminUser = ['admin', 'assistant', 'super_admin', 'manager'].includes(String(orgUser?.role || '').toLowerCase());

    // Hex to HSL helper
    const hexToHSL = (hex: string) => {
        let r = 0, g = 0, b = 0;
        const hx = hex.startsWith('#') ? hex : '#' + hex;
        if (hx.length === 4) {
            r = parseInt("0x" + hx[1] + hx[1]) / 255;
            g = parseInt("0x" + hx[2] + hx[2]) / 255;
            b = parseInt("0x" + hx[3] + hx[3]) / 255;
        } else if (hx.length === 7) {
            r = parseInt("0x" + hx[1] + hx[2]) / 255;
            g = parseInt("0x" + hx[3] + hx[4]) / 255;
            b = parseInt("0x" + hx[5] + hx[6]) / 255;
        }
        let cmin = Math.min(r, g, b), cmax = Math.max(r, g, b), delta = cmax - cmin, h = 0, s = 0, l = 0;
        if (delta === 0) h = 0;
        else if (cmax === r) h = ((g - b) / delta) % 6;
        else if (cmax === g) h = (b - r) / delta + 2;
        else h = (r - g) / delta + 4;
        h = Math.round(h * 60);
        if (h < 0) h += 360;
        l = (cmax + cmin) / 2;
        s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
        s = +(s * 100).toFixed(1);
        l = +(l * 100).toFixed(1);
        return { h, s, l };
    };

    const activeCategory = categories.find(c => String(c.id) === String(selectedCategoryId));
    const activeBrandColor = brandColor || activeCategory?.brand_color || '#2563eb';
    const hsl = hexToHSL(activeBrandColor);

    const filteredProperties = properties.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.domain.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const renderCardSkeleton = (key: number) => (
        <div key={key} className={`p-6 rounded-[18px] border flex flex-col justify-between gap-5 shadow-none ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex justify-between items-start gap-3">
                <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-[12px] animate-pulse bg-slate-200/70 dark:bg-white/[0.06] shrink-0" />
                    <div className="space-y-2">
                        <div className="w-36 h-4 rounded-[8px] animate-pulse bg-slate-200/70 dark:bg-white/[0.06]" />
                        <div className="w-24 h-3 rounded-[6px] animate-pulse bg-slate-200/70 dark:bg-white/[0.06]" />
                    </div>
                </div>
                <div className="w-14 h-5 rounded-md animate-pulse bg-slate-200/70 dark:bg-white/[0.06]" />
            </div>
            <div className="space-y-4">
                <div className="h-14 w-full rounded-[14px] animate-pulse bg-slate-200/70 dark:bg-white/[0.06]" />
                <div className="h-10 w-full rounded-xl animate-pulse bg-slate-200/70 dark:bg-white/[0.06]" />
            </div>
        </div>
    );

    return (
        <div className="relative">
            <style dangerouslySetInnerHTML={{
                __html: `
                :root {
                    --brand-h: ${hsl.h};
                    --brand-s: ${hsl.s}%;
                    --brand-l: ${hsl.l}%;
                    --brand-primary: hsl(var(--brand-h), var(--brand-s), var(--brand-l));
                    --brand-primary-light: hsl(var(--brand-h), var(--brand-s), calc(var(--brand-l) + 15%));
                    --brand-primary-dark: hsl(var(--brand-h), var(--brand-s), calc(var(--brand-l) - 10%));
                    --brand-surface: hsl(var(--brand-h), var(--brand-s), 98%);
                    --brand-border: hsl(var(--brand-h), var(--brand-s), 92%);
                    --brand-shadow: hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.15);
                }
                .bg-[var(--color-primary)] { background-color: var(--brand-primary) !important; }
                .text-[var(--color-primary)] { color: var(--brand-primary) !important; }
                .from-[var(--color-primary)] { --tw-gradient-from: var(--brand-primary) !important; --tw-gradient-to: var(--brand-primary-dark) !important; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important; }
            `}} />
            <div className="space-y-6">
                <PageHero
                    title={<>AI <span className={hideWebsiteTab ? "text-white/70" : "text-slate-500 dark:text-slate-400"}>Training Center</span></>}
                    subtitle="Nạp kiến thức và huấn luyện bộ não AI cho từng website hoặc các kênh chatbot tập trung của bạn."
                    customGradient={hideWebsiteTab ? "from-[var(--color-primary)] to-[#9A1523]" : undefined}
                    actions={[
                        ...(onOpenOrgManager && isAdminUser ? [{
                            label: 'Quản lý Nhân sự',
                            icon: Users,
                            onClick: () => onOpenOrgManager(),
                        }] : []),
                        {
                            label: 'Hướng dẫn AI',
                            icon: BookOpen,
                            onClick: () => setIsTipsModalOpen(true),
                        }
                    ]}
                />

                <div className={`w-full rounded-[18px] border shadow-none p-4 md:p-6 min-h-[600px] transition-colors ${isDarkTheme ? 'bg-[rgba(13,17,23,0.6)] backdrop-blur-md border-slate-800' : 'bg-white border-slate-200'}`}>
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-6 mb-6 lg:mb-8">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6 flex-1">
                            {!hideWebsiteTab && (
                                <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 lg:mx-0 lg:px-0 w-fit">
                                    <Tabs
                                        activeId={mainTab}
                                        onChange={(id) => {
                                            setMainTab(id as any);
                                            if (id === 'chat') {
                                                setViewModeChat('categories');
                                                setSelectedCategoryId(null);
                                            }
                                        }}
                                        variant="pill"
                                        className="flex-nowrap"
                                        items={[
                                            { id: 'website', label: `AI Chatbot (${properties.length})`, icon: Globe },
                                            { id: 'chat', label: `Huấn luyện nhóm (${categories.length})`, icon: Bot },
                                        ]}
                                        isDarkTheme={isDarkTheme}
                                    />
                                </div>
                            )}

                            {viewModeChat === 'chatbots' && (
                                <div className="flex items-center gap-2">
                                    <Tabs
                                        activeId={activeSubTab}
                                        onChange={(id) => handleSetSubTab(id as any)}
                                        variant="pill"
                                        items={[
                                            ...(!hideWebsiteTab ? [] : [{ id: 'chatbots', label: 'AI Agents', icon: Bot }]),
                                            { id: 'users', label: 'Quản trị User', icon: Users },
                                            { id: 'feedback', label: 'Phản hồi', icon: MessageSquare },
                                        ]}
                                        isDarkTheme={isDarkTheme}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 shrink-0">
                            <div className="relative group/tips shrink-0">
                                <button
                                    type="button"
                                    className={`w-full lg:w-auto h-9 px-4 border rounded-[var(--radius-md)] text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-none ${isDarkTheme ? 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                                >
                                    <BookOpen className="w-4 h-4" style={{ color: activeBrandColor }} />
                                    <span className="hidden sm:inline">Hướng dẫn AI</span>
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover/tips:rotate-180 transition-transform duration-300" />
                                </button>

                                <div className={`absolute right-0 top-full mt-2 w-64 rounded-[14px] border p-2 space-y-1 invisible opacity-0 group-hover/tips:visible group-hover/tips:opacity-100 transition-all duration-200 transform origin-top-right z-50 ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                                    <button
                                        type="button"
                                        onClick={() => setIsOptimizationModalOpen(true)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left group ${isDarkTheme ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}
                                    >
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-all" style={{ backgroundColor: `${activeBrandColor}15`, color: activeBrandColor, borderColor: `${activeBrandColor}30` }}>
                                            <Sparkles className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className={`text-[11px] font-bold ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>Tối ưu Training</div>
                                            <div className="text-[9px] text-slate-400 font-medium">Cách soạn dữ liệu chuẩn</div>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            props.setIsEmbeddingModalOpen(true);
                                            toast.success('Đang mở Cơ chế AI & Score...');
                                        }}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left group ${isDarkTheme ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}
                                    >
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-all" style={{ backgroundColor: `${activeBrandColor}15`, color: activeBrandColor, borderColor: `${activeBrandColor}30` }}>
                                            <Bot className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className={`text-[11px] font-bold ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>Cơ chế AI & Score</div>
                                            <div className="text-[9px] text-slate-400 font-medium">Hiểu về Embedding</div>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setIsTipsModalOpen(true)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left group ${isDarkTheme ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}
                                    >
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-all" style={{ backgroundColor: `${activeBrandColor}15`, color: activeBrandColor, borderColor: `${activeBrandColor}30` }}>
                                            <Zap className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className={`text-[11px] font-bold ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>Smart Link (Nâng cao)</div>
                                            <div className="text-[9px] text-slate-400 font-medium">Tự tạo nút & ảnh</div>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Admin Logs Button - Only in AI Space */}
                            {props.setActiveTab && hideWebsiteTab && (
                                <button
                                    type="button"
                                    onClick={() => props.setActiveTab && props.setActiveTab('logs')}
                                    className="h-10 md:h-11 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap text-white bg-gradient-to-r from-[var(--color-primary)] to-[#9A1523]"
                                >
                                    <Activity size={16} className="text-white animate-pulse" />
                                    Logs & Stats
                                </button>
                            )}
                        </div>
                    </div>

                    {mainTab === 'website' ? (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className={`text-base md:text-lg font-bold ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>Danh sách Website</h3>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Tổng cộng: {filteredProperties.length.toLocaleString()}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {loading ? (
                                    [1, 2, 3].map(i => renderCardSkeleton(i))
                                ) : filteredProperties.map(p => (
                                    <div key={p.id} className={`group p-6 rounded-[18px] border transition-colors flex flex-col justify-between gap-5 relative overflow-hidden shadow-none ${isDarkTheme ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                        <div className="flex justify-between items-start gap-3 relative z-10">
                                            <div className="flex items-center gap-3.5 min-w-0">
                                                <AppIcon name="ai_training" size={40} className="rounded-[12px] shrink-0" />
                                                <div className="min-w-0">
                                                    <h4 className={`text-base font-bold leading-tight truncate pr-2 ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`} title={p.name}>{p.name}</h4>
                                                    <p className="text-[11px] text-slate-400 font-mono mt-1 pr-2 truncate">{p.domain}</p>
                                                </div>
                                            </div>
                                            <div className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tight shrink-0 ${p.ai_enabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : (isDarkTheme ? 'bg-slate-800 text-slate-500 border border-slate-700' : 'bg-slate-50 text-slate-400 border border-slate-200')}`}>
                                                {p.ai_enabled ? 'Active' : 'OFF'}
                                            </div>
                                        </div>

                                        <div className="space-y-4 relative z-10">
                                            <div className={`flex items-center justify-between p-3 rounded-[14px] border transition-colors ${isDarkTheme ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50/70 border-slate-200'}`}>
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Tài liệu</span>
                                                    <span className={`text-sm font-black ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>{(p.stats?.docs_count || 0).toLocaleString()} <span className="text-[10px] font-medium text-slate-500">docs</span></span>
                                                </div>
                                                <div className={`h-8 w-px ${isDarkTheme ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Cuộc trò chuyện</span>
                                                    <span className={`text-sm font-black ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>{(p.stats?.queries_count || 0).toLocaleString()} <span className="text-[10px] font-medium text-slate-500">convos</span></span>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedProperty(p.id);
                                                    setViewMode('doc');
                                                }}
                                                className={`w-full h-10 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${isDarkTheme ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}`}
                                            >
                                                <Bot className={`w-4 h-4 ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`} />
                                                QUẢN LÝ
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 lg:p-6 rounded-[18px] border mb-6 gap-6 ${isDarkTheme ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50/50 border-slate-200'}`}>
                                <div className="flex items-center gap-3">
                                    {viewModeChat === 'chatbots' && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (activeSubTab !== 'chatbots') {
                                                    handleSetSubTab('chatbots');
                                                } else if (singleGroupMode && onClose) {
                                                    onClose();
                                                } else {
                                                    setViewModeChat('categories');
                                                    setSelectedCategoryId(null);
                                                }
                                            }}
                                            className={`p-2.5 rounded-xl transition-colors mr-1 border shadow-none ${isDarkTheme ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-100'}`}
                                        >
                                            <ArrowLeft className="w-5 h-5" />
                                        </button>
                                    )}
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className={`text-base lg:text-lg font-bold ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>
                                                {viewModeChat === 'categories' ? 'Danh sách Nhóm' : `Quản lý: ${categories.find(c => String(c.id) === String(selectedCategoryId))?.name || 'Nhóm'}`}
                                            </h3>
                                            <div className={`hidden sm:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border ${isDarkTheme ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-white text-slate-500 border-slate-200'}`}>
                                                {viewModeChat === 'categories'
                                                    ? `Tổng cộng: ${categories.length.toLocaleString()}`
                                                    : activeSubTab === 'chatbots'
                                                        ? `Chatbots: ${filteredChatbots.length.toLocaleString()}`
                                                        : (activeSubTab || 'chatbots').toUpperCase()}
                                            </div>
                                        </div>
                                        <p className={`text-[10px] lg:text-xs font-medium tracking-tight ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                                            {viewModeChat === 'categories'
                                                ? 'Quản lý các nhóm AI và không gian làm việc AI Space.'
                                                : (activeSubTab === 'chatbots' ? 'Danh sách các chatbot AI thuộc nhóm này.' : activeSubTab === 'users' ? 'Quản lý toàn bộ thành viên trong tổ chức này.' : `Quản lý ${activeSubTab === 'logs' ? 'nhật ký' : 'cài đặt'} của nhóm.`)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 sm:gap-3 ml-auto">
                                    {viewModeChat === 'categories' && !singleGroupMode ? (
                                        <button
                                            type="button"
                                            onClick={() => setIsCreateCategoryModalOpen(true)}
                                            className={`h-10 px-5 rounded-xl text-[10px] lg:text-xs font-bold transition-all flex items-center gap-2 shadow-none w-full sm:w-auto justify-center border ${isDarkTheme ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:border-slate-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                                        >
                                            <FolderPlus className="w-4 h-4 text-slate-400" />
                                            Tạo Group
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-2 lg:gap-3">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const cat = activeCategory
                                                        || selectedCategoryProp
                                                        || { id: selectedCategoryId || '', name: '', description: '', slug: '' };
                                                    handleEditCategory(cat);
                                                }}
                                                className={`h-10 px-4 rounded-xl text-[10px] lg:text-xs font-bold transition-all flex items-center justify-center gap-2 border shadow-none ${isDarkTheme ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                            >
                                                <Settings className="w-4 h-4 text-slate-400" />
                                                <span>Quản trị Group</span>
                                            </button>

                                            {/* View AI Space button */}
                                            {selectedCategoryId && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (props.onOpenAISpace) {
                                                            props.onOpenAISpace(selectedCategoryId);
                                                        } else {
                                                            window.open(`/#/ai-space/${selectedCategoryId}`, '_blank');
                                                        }
                                                    }}
                                                    className={`h-10 px-4 rounded-xl text-[10px] lg:text-xs font-bold transition-all flex items-center justify-center gap-2 border shadow-none ${isDarkTheme ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-600/30' : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'}`}
                                                    title={`Mở AI Space: ${categories.find(c => String(c.id) === String(selectedCategoryId))?.name || ''}`}
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                    <span>Xem AI Space</span>
                                                </button>
                                            )}

                                            {/* Primary Tabs Action */}
                                            {activeSubTab === 'chatbots' && (
                                                <button
                                                    type="button"
                                                    onClick={() => setIsCreateBotModalOpen(true)}
                                                    className={`h-10 px-5 rounded-xl text-[10px] lg:text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-none border ${isDarkTheme ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]/20 hover:bg-[#9A1523]' : 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]/10 hover:brightness-95'}`}
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    Tạo AI Agent
                                                </button>
                                            )}

                                            {activeSubTab === 'users' && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const btn = document.getElementById('org-user-add-btn');
                                                        if (btn) btn.click();
                                                    }}
                                                    className={`h-10 px-5 rounded-xl text-[10px] lg:text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-none border ${isDarkTheme ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]/20 hover:bg-[#9A1523]' : 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]/10 hover:brightness-95'}`}
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    Thêm User Tổ chức
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {viewModeChat === 'categories' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {loading ? (
                                        [1, 2, 3].map(i => renderCardSkeleton(i))
                                    ) : categories.length === 0 ? (
                                        <div className={`col-span-full py-20 text-center border-2 border-dashed rounded-[18px] ${isDarkTheme ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200 bg-slate-50/50'}`}>
                                            <Building className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                            <h3 className={`font-bold text-lg ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>Chưa có nhóm nào</h3>
                                            <p className="text-slate-500 mt-2 text-sm">Vui lòng tạo nhóm để quản lý các chatbot.</p>
                                        </div>
                                    ) : categories.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()))).map(c => (
                                        <div
                                            key={c.id}
                                            onClick={() => {
                                                setSelectedCategoryId(c.id);
                                                setViewModeChat('chatbots');
                                            }}
                                            className={`group p-6 rounded-[18px] border transition-colors cursor-pointer flex flex-col justify-between gap-5 relative overflow-hidden shadow-none ${isDarkTheme ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                                        >
                                            <div className="flex justify-between items-start gap-3 relative z-10">
                                                <div className="flex items-center gap-3.5 min-w-0">
                                                    <AppIcon name="ai_training" size={40} className="rounded-[12px] shrink-0" />
                                                    <div className="min-w-0">
                                                        <h4 className={`text-base font-bold leading-tight truncate pr-2 ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`} title={c.name}>{c.name}</h4>
                                                        <p className={`text-[11px] mt-1 pr-2 truncate ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`} title={c.description || 'Chưa có mô tả cho nhóm này.'}>
                                                            {c.description || 'Chưa có mô tả cho nhóm này.'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {isAdminUser && (
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); handleEditCategory(c); }}
                                                                className={`p-1.5 rounded-lg border transition-colors ${isDarkTheme ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-700'}`}
                                                                title="Chỉnh sửa nhóm"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteCategory(c.id, c.name, e); }}
                                                                className={`p-1.5 rounded-lg border transition-colors ${isDarkTheme ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-rose-400' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-rose-50 hover:text-rose-600'}`}
                                                                title="Xóa nhóm"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                    <div className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tight bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                        Active
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-4 relative z-10">
                                                <div className={`flex items-center justify-between p-3 rounded-[14px] border transition-colors ${isDarkTheme ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50/70 border-slate-200'}`}>
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">AI Agents</span>
                                                        <span className={`text-sm font-black ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>{(c.chatbot_count || 0).toLocaleString()} <span className="text-[10px] font-medium text-slate-500">bots</span></span>
                                                    </div>
                                                    <div className={`h-8 w-px ${isDarkTheme ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Tài liệu</span>
                                                        <span className={`text-sm font-black ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>{(c.docs_count || 0).toLocaleString()} <span className="text-[10px] font-medium text-slate-500">docs</span></span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedCategoryId(c.id);
                                                            setViewModeChat('chatbots');
                                                        }}
                                                        className={`flex-1 h-10 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 ${isDarkTheme ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}`}
                                                    >
                                                        <Shield className={`w-3.5 h-3.5 ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`} />
                                                        QUẢN LÝ NHÓM
                                                    </button>
                                                    {props.onOpenAISpace && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                props.onOpenAISpace?.(c.id);
                                                            }}
                                                            className={`h-10 px-3.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 shrink-0 ${isDarkTheme ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/25' : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'}`}
                                                            title={`Mở AI Space: ${c.name}`}
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                            AI SPACE
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {activeSubTab === 'chatbots' ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {filteredChatbots.length === 0 ? (
                                                <div className={`col-span-full py-20 text-center border-2 border-dashed rounded-[18px] ${isDarkTheme ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200 bg-slate-50/50'}`}>
                                                    <Bot className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                                    <h3 className={`font-bold text-lg ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>Chưa có AI Chatbot nào</h3>
                                                    <p className="text-slate-500 mt-2 text-sm">Nhấn "Tạo AI Agent" để bắt đầu.</p>
                                                </div>
                                            ) : filteredChatbots.map(c => (
                                                <div key={c.id} className={`group p-6 rounded-[18px] border transition-colors flex flex-col justify-between gap-5 relative overflow-hidden shadow-none ${isDarkTheme ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                                    <div className="flex justify-between items-start gap-3 relative z-10">
                                                        <div className="flex items-center gap-3.5 min-w-0">
                                                            <AppIcon name="ai_training" size={40} className="rounded-[12px] shrink-0" />
                                                            <div className="min-w-0">
                                                                <h4 className={`text-base font-bold leading-tight truncate pr-2 ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`} title={c.name}>{c.name}</h4>
                                                                <p className={`text-[11px] mt-1 pr-2 truncate ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`} title={c.description || 'Chưa có mô tả'}>
                                                                    {c.description || 'Chưa có mô tả'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); handleEditBot(c); }}
                                                                    className={`p-1.5 rounded-lg border transition-colors ${isDarkTheme ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-700'}`}
                                                                    title="Chỉnh sửa Chatbot"
                                                                >
                                                                    <Edit2 className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); handleDeleteChatbot(c.id, c.name); }}
                                                                    className={`p-1.5 rounded-lg border transition-colors ${isDarkTheme ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-rose-400' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-rose-50 hover:text-rose-600'}`}
                                                                    title="Xóa Chatbot"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                            <div className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tight ${activePropertyId === c.id || c.ai_enabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : (isDarkTheme ? 'bg-slate-800 text-slate-500 border border-slate-700' : 'bg-slate-50 text-slate-400 border border-slate-200')}`}>
                                                                {activePropertyId === c.id || c.ai_enabled ? 'Active' : 'OFF'}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4 relative z-10">
                                                        <div className={`flex items-center justify-between p-3 rounded-[14px] border transition-colors ${isDarkTheme ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50/70 border-slate-200'}`}>
                                                            <div className="flex flex-col">
                                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Tài liệu</span>
                                                                <span className={`text-sm font-black ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>{(c.stats?.docs_count || 0).toLocaleString()} <span className="text-[10px] font-medium text-slate-500">docs</span></span>
                                                            </div>
                                                            <div className={`h-8 w-px ${isDarkTheme ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Cuộc trò chuyện</span>
                                                                <span className={`text-sm font-black ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>{(c.stats?.queries_count || 0).toLocaleString()} <span className="text-[10px] font-medium text-slate-500">convos</span></span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => { setSelectedProperty(c.id); setViewMode('doc'); }}
                                                                className={`flex-1 h-10 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 ${isDarkTheme ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}`}
                                                            >
                                                                <Bot className={`w-3.5 h-3.5 ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`} />
                                                                TRAINING AI
                                                            </button>
                                                            {props.onOpenBotChat && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => props.onOpenBotChat?.(c.id, c.category_id || selectedCategoryId || undefined)}
                                                                    className={`h-10 px-3.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 shrink-0 ${isDarkTheme ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/25' : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'}`}
                                                                    title={`Mở Chat: ${c.name}`}
                                                                >
                                                                    <MessageSquare className="w-3.5 h-3.5" />
                                                                    MỞ CHAT
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : activeSubTab === 'users' ? (
                                        <div className={`p-4 rounded-[18px] border ${isDarkTheme ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
                                            <OrgUserManager
                                                isDarkTheme={isDarkTheme}
                                                hideHeader={true}
                                                categoryId={selectedCategoryId}
                                            />
                                        </div>
                                    ) : activeSubTab === 'logs' ? (
                                        <div className={`p-4 rounded-[18px] border ${isDarkTheme ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
                                            <AdminLogsTab categoryId={selectedCategoryId} />
                                        </div>
                                    ) : activeSubTab === 'feedback' ? (
                                        <div className={`p-4 rounded-[18px] border ${isDarkTheme ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
                                            <FeedbackAdminPanel />
                                        </div>
                                    ) : (
                                        <div className={`p-12 text-center border-2 border-dashed rounded-[18px] ${isDarkTheme ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200 bg-slate-50/50'}`}>
                                            <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                            <h3 className={`font-bold text-lg ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>Cài đặt Nhóm</h3>
                                            <p className="text-slate-500 mt-2 mb-6 text-sm">Quản lý thông tin cơ bản và cấu hình của nhóm AI này.</p>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const cat = categories.find(c => String(c.id) === String(selectedCategoryId));
                                                    if (cat) handleEditCategory(cat);
                                                }}
                                                className="px-6 py-3 bg-[var(--color-primary)] text-white rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all"
                                            >
                                                Mở Cấu hình Nhóm
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default React.memo(AITrainingGrid);

