import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getMktPortalRoot } from '../../../utils/portalRoot';
import { AISettings } from '../../../views/AITraining';
import { toast } from 'react-hot-toast';
import { Save, Bot, Sparkles, Database, FolderPlus, BrainCircuit, FlaskConical, Search, AlertTriangle, HelpCircle, RefreshCw, X, Copy, Move, Trash2, Check, BookOpen, Mail, Palette, Building, Image as ImageIcon, Users, FileInput, ShieldCheck, Zap, Settings, ChevronDown, BarChart2, ArrowLeft, Pencil, Activity, ListCheck, Globe, Edit2, Eye, FileText, Layers, Clock, FileUp, BellRing, Edit3 } from 'lucide-react';
import Button from '../../common/Button';
import Input from '../../common/Input';
import AITrainingTable from '../../AITrainingTable';
import AdminLogsTab from './AdminLogsTab';
import VisibilitySettings from '../VisibilitySettings';
import FastRepliesSettings from '../FastRepliesSettings';
import ScenarioManager from '../ScenarioManager';
import UnifiedChat from '../UnifiedChat';
import AIStatsModal from './AIStatsModal';
import PageHero from '../../common/PageHero';
import { MessageSquare } from 'lucide-react';
import InputModal from '../../common/InputModal';
import { api } from '../../../services/storageAdapter';
import { API_BASE_URL, EXTERNAL_API_BASE } from '../../../utils/config';

interface AITrainingDetailProps {
    selectedProperty: string;
    chatbots: any[];
    properties: any[];
    settings: AISettings;
    setIsOptimizationModalOpen: (o: boolean) => void;
    setIsEmbeddingModalOpen: (o: boolean) => void;
    setIsTipsModalOpen: (o: boolean) => void;
    activeTab: 'training' | 'settings' | 'embed' | 'instruction' | 'inbox' | 'logs' | 'scenarios';
    setActiveTab: (t: 'training' | 'settings' | 'embed' | 'instruction' | 'inbox' | 'logs' | 'scenarios') => void;
    setSelectedBotLogsId: (id: string | null) => void;
    setIsFolderModalOpen: (o: boolean) => void;
    setIsSynonymsModalOpen: (o: boolean) => void;
    loading: boolean;
    handleTestAI: () => void;
    toggleChatbotStatus: (s: number) => void;
    docs: any[];
    handleTrainDocs: () => void;
    docSearchTerm: string;
    setDocSearchTerm: (s: string) => void;
    selectedIds: string[];
    fetchChatbots: (catId?: string) => void;
    setBulkActionType: (t: 'copy' | 'move' | null) => void;
    setIsBulkMoveModalOpen: (o: boolean) => void;
    handleBulkDelete: () => void;
    setSelectedIds: (ids: string[]) => void;
    groupedDocs: any[];
    expandedGroups: string[];
    setExpandedGroups: (ids: string[]) => void;
    onReorder: (fromIndex: number, toIndex: number, list: any[]) => void;
    toggleDoc: (id: string, s: number) => void;
    handleViewDoc: (doc: any) => void;
    deleteDoc: (id: string, batchId?: string) => void;
    setInfoDoc: (doc: any) => void;
    newDoc: any;
    handleEditFolder: (f: any) => void;
    setIsAddModalOpen: (o: boolean) => void;
    setNewDoc: (d: any) => void;
    selectedIdsSet: Set<string>;
    totalSelectableCount: number;
    onToggleSelect: (id: string) => void;
    onToggleSelectAll: () => void;
    setSettings: (s: any) => void;
    showAdvanced: boolean;
    setShowAdvanced: (b: boolean) => void;
    handleSaveSettings: () => void;
    newQuickAction: string;
    setNewQuickAction: (s: string) => void;
    addQuickAction: () => void;
    removeQuickAction: (i: number) => void;
    initialConversationId?: string | null;
    initialVisitorId?: string | null;
    mainTab: 'website' | 'chat' | 'users' | 'groups' | 'logs';
    onBack?: () => void;
    isDarkTheme?: boolean;
    hideLogsTab?: boolean;
    fileInputRef: React.RefObject<HTMLInputElement>;
    handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    uploadLimit?: string;
    fetchDocs?: () => void;
    orgUser?: any;
    categoryId?: string;
}



const AITrainingDetail: React.FC<AITrainingDetailProps> = (props) => {
    const {
        selectedProperty, chatbots, properties, settings, setIsOptimizationModalOpen,
        setIsEmbeddingModalOpen, setIsTipsModalOpen, activeTab, setActiveTab, setSelectedBotLogsId,
        setIsFolderModalOpen, setIsSynonymsModalOpen, loading, handleTestAI,
        toggleChatbotStatus, docs, handleTrainDocs, docSearchTerm, setDocSearchTerm,
        selectedIds, fetchChatbots, setBulkActionType, setIsBulkMoveModalOpen,
        handleBulkDelete, setSelectedIds, groupedDocs, expandedGroups, setExpandedGroups,
        onReorder, toggleDoc, handleViewDoc, deleteDoc, setInfoDoc, newDoc,
        handleEditFolder, setIsAddModalOpen, setNewDoc, selectedIdsSet,
        totalSelectableCount, onToggleSelect, onToggleSelectAll, setSettings,
        showAdvanced, setShowAdvanced, handleSaveSettings,
        newQuickAction, setNewQuickAction, addQuickAction, removeQuickAction,
        mainTab, isDarkTheme, uploadLimit, categoryId
    } = props;


    // Local state for expensive typing inputs to prevent re-rendering the entire AITraining component on every keystroke
    const [localInstruction, setLocalInstruction] = useState(settings.system_instruction || '');
    const [localBotName, setLocalBotName] = useState(settings.bot_name || '');
    const [localCompanyName, setLocalCompanyName] = useState(settings.company_name || '');
    const [localTeaser, setLocalTeaser] = useState(settings.teaser_msg || '');
    const [triggerAnalysisModal, setTriggerAnalysisModal] = useState<number | boolean>(false);
    const [showAIStats, setShowAIStats] = useState(false);
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);

    const [activeFeatureTab, setActiveFeatureTab] = useState<'scenarios' | 'knowledge'>('knowledge');

    // [NEW] Page-count modal state for chunked PDF upload
    const [pendingPdfFile, setPendingPdfFile] = useState<File | null>(null);
    const [isPdfPageModal, setIsPdfPageModal] = useState(false);
    const [pdfPageInput, setPdfPageInput] = useState('');
    const [pdfUploading, setPdfUploading] = useState(false);
    const [pdfConfirmStep, setPdfConfirmStep] = useState(false); // true = show confirm screen
    const [pdfDetecting, setPdfDetecting] = useState(false); // true = reading page count via PDF.js

    // [NEW] PDF chunk progress tracking: { [docId]: { done, total, percent, status, title } }
    const [pdfProgressMap, setPdfProgressMap] = useState<Record<string, any>>({});
    const [isGlobalWorkspace, setIsGlobalWorkspace] = useState(false);
    const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Detect processing PDF docs (with chunked_extraction flag in metadata)
    const processingPdfDocs = (props.docs || []).filter((d: any) => {
        if (d.status !== 'processing') return false;
        try { const m = JSON.parse(d.metadata || '{}'); return !!m.chunked_extraction; } catch { return false; }
    });

    // Poll progress every 15s while there are processing docs
    // (Extraction batches are spaced 60s apart due to rate limiting)
    const fetchPdfProgress = useCallback(async () => {
        const apiBase = api.baseUrl;
        const updates: Record<string, any> = {};
        for (const doc of processingPdfDocs) {
            try {
                const r = await fetch(`${apiBase}/ai_training.php?action=get_pdf_progress&property_id=${props.selectedProperty}&doc_id=${doc.id}`);
                if (!r.ok) throw new Error("Fetch progress failed");
                const data = await r.json();
                if (data.success) updates[doc.id] = {
                    ...data,
                    fetched_at: Date.now(),
                };
            } catch { }
        }
        if (Object.keys(updates).length > 0) {
            setPdfProgressMap(prev => ({ ...prev, ...updates }));
            const anyDone = Object.values(updates).some((u: any) => u.doc_status === 'trained');
            if (anyDone) {
                props.fetchDocs?.();
                setTimeout(() => props.fetchChatbots(props.selectedProperty), 1000);
            }
        }
    }, [processingPdfDocs.map((d: any) => d.id).join(','), props.selectedProperty]);

    useEffect(() => {
        if (processingPdfDocs.length === 0) {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            return;
        }
        fetchPdfProgress();
        pollTimerRef.current = setInterval(fetchPdfProgress, 5000); // poll every 5s for responsive UI
        return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
    }, [processingPdfDocs.length, props.selectedProperty]);

    // Intercept file input: fast binary regex detect → show confirm modal → upload
    const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (props.fileInputRef?.current) props.fileInputRef.current.value = '';

        if (ext !== 'pdf') {
            props.handleFileUpload(e);
            return;
        }

        // Fast binary regex — không load pdfjs để tránh block browser
        setPdfDetecting(true);
        let totalPages = 0;
        try {
            const buf = await file.slice(0, Math.min(file.size, 512 * 1024)).arrayBuffer(); // chỉ đọc 512KB đầu
            const text = new TextDecoder('latin1').decode(buf);
            const m1 = text.match(/\/Count\s+(\d+)/);
            if (m1) {
                totalPages = parseInt(m1[1], 10);
            } else {
                const m2 = text.match(/\/Type\s*\/Page[^s]/g);
                totalPages = m2 ? m2.length : 0;
            }
            // Nếu /Count không có trong 512KB đầu, đọc 512KB cuối
            if (!totalPages) {
                const tail = await file.slice(Math.max(0, file.size - 512 * 1024)).arrayBuffer();
                const tailText = new TextDecoder('latin1').decode(tail);
                const mt = tailText.match(/\/Count\s+(\d+)/);
                if (mt) totalPages = parseInt(mt[1], 10);
            }
        } catch { }
        if (!totalPages || totalPages < 1) totalPages = 1;
        setPdfDetecting(false);

        // Hiện modal xác nhận (đã có số trang)
        setPendingPdfFile(file);
        setPdfPageInput(String(totalPages));
        setIsPdfPageModal(true);
    };

    const handlePdfPageModalConfirm = async () => {
        if (!pendingPdfFile) return;
        const totalPages = parseInt(pdfPageInput, 10) || 1;
        setPdfUploading(true);
        try {
            const apiBase = api.baseUrl;
            const fd = new FormData();
            fd.append('action', 'upload_training_file');
            fd.append('property_id', props.selectedProperty);
            fd.append('total_pages', String(totalPages));
            fd.append('is_global_workspace', isGlobalWorkspace ? '1' : '0');
            fd.append('uploaded_by', props.orgUser?.email || props.orgUser?.full_name || 'admin');
            fd.append('file', pendingPdfFile);
            const res = await fetch(`${apiBase}/ai_training.php`, { method: 'POST', body: fd });
            if (!res.ok) throw new Error("Upload failed with status: " + res.status);
            const data = await res.json();
            const { toast } = await import('react-hot-toast');
            if (data.success) {
                toast.success(`📄 Đưa vào hàng đợi: ${data.total_chunks} đợt (${totalPages} trang). AI học ngầm!`, { duration: 6000 });
                setIsPdfPageModal(false);
                setPendingPdfFile(null);
                setIsGlobalWorkspace(false);
                props.fetchDocs?.();
                setTimeout(() => props.fetchChatbots(props.selectedProperty), 800);
            } else {
                toast.error('Lỗi upload: ' + (data.message || 'Không xác định'));
            }
        } catch (err: any) {
            const { toast } = await import('react-hot-toast');
            toast.error('Lỗi kết nối: ' + err.message);
        } finally {
            setPdfUploading(false);
        }
    };

    const toggleWorkspace = async (id: string, current: number) => {
        const newStatus = current ? 0 : 1;
        try {
            const apiBase = api.baseUrl;
            const res = await fetch(`${apiBase}/ai_training.php?action=toggle_workspace`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'toggle_workspace',
                    property_id: props.selectedProperty,
                    doc_id: id,
                    is_global_workspace: newStatus
                })
            });
            if (!res.ok) throw new Error("Toggle workspace failed");
            const data = await res.json();
            if (data.success) {
                toast.success(newStatus ? 'Đã bật Global Workspace cho tài liệu này' : 'Đã tắt Global Workspace');
                props.fetchDocs?.();
            } else {
                toast.error(data.message || 'Lỗi khi cập nhật Workspace');
            }
        } catch (err) {
            toast.error('Lỗi kết nối');
        }
    };


    // Sync local state when settings prop changes (e.g. initial load or property switch)
    useEffect(() => {
        setLocalInstruction(settings.system_instruction || '');
    }, [settings.system_instruction, selectedProperty]);

    useEffect(() => {
        setLocalBotName(settings.bot_name || '');
    }, [settings.bot_name, selectedProperty]);

    useEffect(() => {
        setLocalCompanyName(settings.company_name || '');
    }, [settings.company_name, selectedProperty]);

    useEffect(() => {
        setLocalTeaser(settings.teaser_msg || '');
    }, [settings.teaser_msg, selectedProperty]);

    // Reset activeTab when selectedProperty changes
    // For chat mode, default to 'training' tab, otherwise 'inbox'
    useEffect(() => {
        setActiveTab(mainTab === 'chat' ? 'training' : 'inbox');
        setTrainingSubTab('manual');
    }, [selectedProperty]);

    const [trainingSubTab, setTrainingSubTab] = useState<'manual' | 'files'>('manual');

    // Auto-switch to non-empty tab when docs change
    const manualCount = (docs || []).filter((d: any) => d.source_type !== 'upload').length;
    const filesCount = (docs || []).filter((d: any) => d.source_type === 'upload').length;
    useEffect(() => {
        if (trainingSubTab === 'manual' && manualCount === 0 && filesCount > 0) {
            setTrainingSubTab('files');
        } else if (trainingSubTab === 'files' && filesCount === 0 && manualCount > 0) {
            setTrainingSubTab('manual');
        }
    }, [manualCount, filesCount]);

    const filteredGroupedDocs = React.useMemo(() => {
        let baseList = groupedDocs;

        // 1. FILTER BY SUBTAB
        baseList = baseList.map(item => {
            if (item.isGroup) {
                const filteredMembers = (item.members || []).filter((m: any) => {
                    if (trainingSubTab === 'files') return m.source_type === 'upload';
                    if (trainingSubTab === 'manual') return m.source_type !== 'upload';
                    return false;
                });
                return { ...item, members: filteredMembers };
            } else {
                const matches = (() => {
                    if (trainingSubTab === 'files') return item.source_type === 'upload';
                    if (trainingSubTab === 'manual') return item.source_type !== 'upload' && item.source_type !== 'folder';
                    return false;
                })();
                return matches ? item : null;
            }
        }).filter(item => {
            if (!item) return false;
            if (item.isGroup && item.members.length === 0) return false;
            return true;
        }) as any[];

        // 2. SEARCH FILTER: API đã tìm kiếm phía server khi có docSearchTerm.
        // Không filter lại ở frontend để tránh mất kết quả do cấu trúc group/folder
        // Chỉ filter client-side khi KHÔNG có search (để lọc instant theo subtab)
        if (docSearchTerm) {
            // API returned pre-filtered flat docs → just show all of them as-is
            // nhưng vẫn expandAll groups để kết quả hiển thị đầy đủ
            return baseList;
        }

        return baseList;
    }, [groupedDocs, trainingSubTab, docSearchTerm]);

    // Debounced sync to parent settings to reduce re-renders of the entire page while typing
    useEffect(() => {
        const timer = setTimeout(() => {
            if (
                localInstruction !== settings.system_instruction ||
                localBotName !== settings.bot_name ||
                localCompanyName !== settings.company_name ||
                localTeaser !== settings.teaser_msg
            ) {
                setSettings((prev: any) => ({
                    ...prev,
                    system_instruction: localInstruction,
                    bot_name: localBotName,
                    company_name: localCompanyName,
                    teaser_msg: localTeaser
                }));
            }
        }, 1000); // 1 second debounce
        return () => clearTimeout(timer);
    }, [localInstruction, localBotName, localCompanyName, localTeaser, settings.system_instruction, settings.bot_name, settings.company_name, settings.teaser_msg, setSettings]);

    const handleLocalSaveSettings = async () => {
        // Force immediate sync of local states to parent settings before saving
        setSettings((prev: any) => ({
            ...prev,
            system_instruction: localInstruction,
            bot_name: localBotName,
            company_name: localCompanyName,
            teaser_msg: localTeaser
        }));

        // Use a small timeout to allow setSettings to propagate to the parent's state
        // and be reflected in the 'settings' prop before handleSaveSettings uses it.
        setTimeout(() => {
            handleSaveSettings();
        }, 100);
    };

    const currentProperty = (chatbots || []).find(p => p.id === selectedProperty) || (properties || []).find(p => p.id === selectedProperty);

    // Color Theme Injection
    const brandColor = settings.cat_brand_color || settings.brand_color || '#2563eb';

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

    const hsl = hexToHSL(brandColor);

    return (
        <div className="relative">
            <style dangerouslySetInnerHTML={{
                __html: `
                :root {
                    --brand-h: ${hsl.h};
                    --brand-s: ${hsl.s}%;
                    --brand-l: ${hsl.l}%;
                    --brand-primary: hsl(var(--brand-h), var(--brand-s), var(--brand-l));
                    --brand-primary-light: hsl(var(--brand-h), var(--brand-s), calc(var(--brand-l) + 10%));
                    --brand-primary-dark: hsl(var(--brand-h), var(--brand-s), calc(var(--brand-l) - 10%));
                     --brand-surface: ${isDarkTheme ? 'hsl(var(--brand-h), var(--brand-s), 10%)' : 'hsl(var(--brand-h), var(--brand-s), 98.5%)'};
                    --brand-surface-accent: ${isDarkTheme ? 'hsl(var(--brand-h), var(--brand-s), 15%)' : 'hsl(var(--brand-h), var(--brand-s), 96%)'};
                    --brand-border: ${isDarkTheme ? 'hsl(var(--brand-h), var(--brand-s), 20%)' : 'hsl(var(--brand-h), var(--brand-s), 94%)'};
                    --brand-border-accent: ${isDarkTheme ? 'hsl(var(--brand-h), var(--brand-s), 25%)' : 'hsl(var(--brand-h), var(--brand-s), 88%)'};
                    --brand-text-accent: ${isDarkTheme ? 'hsl(var(--brand-h), var(--brand-s), 70%)' : 'hsl(var(--brand-h), var(--brand-s), 35%)'};
                    --brand-shadow: hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.12);
                }
                .bg-[var(--color-primary)] { background-color: var(--brand-primary) !important; }
                .text-[var(--color-primary)] { color: var(--brand-primary) !important; }
                .border-[var(--color-primary)] { border-color: var(--brand-primary) !important; }
                .shadow-[var(--color-primary)] { shadow-color: var(--brand-shadow) !important; }
                .from-[var(--color-primary)] { --tw-gradient-from: var(--brand-primary) !important; --tw-gradient-to: var(--brand-primary-dark) !important; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important; }
            `}} />

            <div className="space-y-6 md:space-y-8">
                <PageHero
                title={
                    <div className="flex items-center gap-3">
                        {props.onBack && (
                            <button
                                onClick={props.onBack}
                                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:bg-white/10 text-white/50 hover:text-white"
                                title="Quay lại"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        )}
                        <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-[1.25rem] bg-white flex items-center justify-center shadow-md overflow-hidden relative shrink-0">
                            {settings.bot_avatar ? (
                                <img
                                    src={settings.bot_avatar}
                                    className={`w-full h-full object-cover ${categoryId ? 'grayscale hover:grayscale-0 transition-all duration-300' : ''}`}
                                    alt=""
                                />
                            ) : (
                                <div className={`w-full h-full flex items-center justify-center transition-all duration-500 ${categoryId ? 'bg-[var(--color-primary)]' : 'bg-gradient-to-br from-[#BD1D2D] to-[#9A1523]'}`}>
                                    <Bot className="w-6 h-6 text-white" />
                                </div>
                            )}
                        </div>
                        <span className="flex items-center gap-2 truncate">
                            {currentProperty?.name || 'Cấu hình AI'}
                            <button
                                onClick={() => setIsRenameModalOpen(true)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/20 text-white/70 hover:text-white shrink-0"
                                title="Sửa tên AI"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                        </span>
                    </div>
                }
                subtitle={currentProperty?.description || 'Quản lý kiến thức và cấu hình nâng cao cho AI của bạn.'}
                customGradient={categoryId ? "from-[var(--color-primary)] to-[#9A1523]" : undefined}
                shadowColor={categoryId ? "shadow-[var(--color-primary)]/30" : undefined}
                actions={[
                    ...(!props.hideLogsTab ? [{
                        label: 'Nhật ký',
                        icon: Activity,
                        onClick: () => {
                            setSelectedBotLogsId(selectedProperty);
                            setActiveTab('logs');
                        }
                    }] : []),
                    ...(!(chatbots || []).some(c => c.id === selectedProperty) && (properties || []).some(p => p.id === selectedProperty) ? [
                        {
                            label: 'Web Tracking',
                            icon: Globe,
                            onClick: () => {
                                window.location.hash = `#/web-tracking?propertyId=${selectedProperty}&view=report`;
                            }
                        },
                        {
                            label: 'Thống kê AI',
                            icon: BarChart2,
                            onClick: () => setShowAIStats(true)
                        }
                    ] : []),
                    {
                        label: 'Phân tích AI',
                        title: 'Phân tích & Tối ưu luồng chat',
                        icon: Zap,
                        primary: true,
                        onClick: () => {
                            setActiveTab('inbox');
                            setTriggerAnalysisModal(Date.now());
                        }
                    }
                ]}
            />

            <div className={`rounded-[14px] border shadow-sm p-4 lg:p-6 min-h-[600px] transition-colors duration-500 animate-in fade-in slide-in-from-bottom-5 delay-200 ${isDarkTheme ? 'bg-[rgba(13,17,23,0.6)] backdrop-blur-md border-slate-800 shadow-none' : 'bg-white border-slate-200 shadow-sm'}`}>


            {/* Tabs */}
            <div className={`flex items-center gap-2 lg:gap-3 mb-6 lg:mb-8 border-b pb-5 overflow-x-auto scrollbar-hide ${isDarkTheme ? 'border-slate-800' : 'border-slate-100'}`}>
                {mainTab === 'chat' ? (
                    <>
                        <button
                            onClick={() => setActiveTab('training')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-xs font-semibold transition-all duration-200 whitespace-nowrap ${activeTab === 'training'
                                ? (isDarkTheme ? 'bg-slate-800 text-slate-200 border border-slate-700 shadow-sm' : 'bg-slate-100 text-slate-800 shadow-sm border border-slate-200')
                                : (isDarkTheme ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-800')}`}
                        >
                            <BookOpen className="w-4 h-4" /> Dữ liệu đào tạo
                        </button>
                        <button
                            onClick={() => setActiveTab('instruction')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-xs font-semibold transition-all duration-200 whitespace-nowrap ${activeTab === 'instruction'
                                ? (isDarkTheme ? 'bg-slate-800 text-slate-200 border border-slate-700 shadow-sm' : 'bg-slate-100 text-slate-800 shadow-sm border border-slate-200')
                                : (isDarkTheme ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-800')}`}
                        >
                            <Bot className="w-4 h-4" /> Cấu hình AI
                        </button>
                        <button
                            onClick={() => setActiveTab('inbox')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-xs font-semibold transition-all duration-200 whitespace-nowrap ${activeTab === 'inbox'
                                ? (isDarkTheme ? 'bg-slate-800 text-slate-200 border border-slate-700 shadow-sm' : 'bg-slate-100 text-slate-800 shadow-sm border border-slate-200')
                                : (isDarkTheme ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-800')}`}
                        >
                            <MessageSquare className="w-4 h-4" />
                            Hộp thư
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={() => setActiveTab('inbox')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-xs font-semibold transition-all duration-200 whitespace-nowrap ${activeTab === 'inbox'
                                ? (isDarkTheme ? 'bg-slate-800 text-slate-200 border border-slate-700 shadow-sm' : 'bg-slate-100 text-slate-800 shadow-sm border border-slate-200')
                                : (isDarkTheme ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-800')}`}
                        >
                            <MessageSquare className="w-4 h-4" />
                            {currentProperty ? 'Hộp thư' : 'Hội thoại'}
                        </button>
                        <button
                            onClick={() => setActiveTab('training')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-xs font-semibold transition-all duration-200 whitespace-nowrap ${activeTab === 'training'
                                ? (isDarkTheme ? 'bg-slate-800 text-slate-200 border border-slate-700 shadow-sm' : 'bg-slate-100 text-slate-800 shadow-sm border border-slate-200')
                                : (isDarkTheme ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-800')}`}
                        >
                            <BookOpen className="w-4 h-4" /> Dữ liệu đào tạo
                        </button>
                        <button
                            onClick={() => setActiveTab('instruction')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-xs font-semibold transition-all duration-200 whitespace-nowrap ${activeTab === 'instruction'
                                ? (isDarkTheme ? 'bg-slate-800 text-slate-200 border border-slate-700 shadow-sm' : 'bg-slate-100 text-slate-800 shadow-sm border border-slate-200')
                                : (isDarkTheme ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-800')}`}
                        >
                            <Bot className="w-4 h-4" /> Cấu hình AI
                        </button>
                    </>
                )}

                {!(chatbots || []).some(c => c.id === selectedProperty) && (
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-xs font-semibold transition-all duration-200 whitespace-nowrap ${activeTab === 'settings'
                            ? (isDarkTheme ? 'bg-slate-800 text-slate-200 border border-slate-700 shadow-sm' : 'bg-slate-100 text-slate-800 shadow-sm border border-slate-200')
                            : (isDarkTheme ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-800')}`}
                    >
                        <Palette className="w-4 h-4" /> Cài đặt Widget
                    </button>
                )}
            </div>

            {/* Tab Content */}
            <div className="tab-content-container">
                <div className={activeTab === 'training' ? "block animate-in fade-in duration-300" : "hidden"}>
                    {/* FEATURE SELECTOR TABS */}
                    <div className={`flex items-center gap-8 border-b mb-8 px-2 ${isDarkTheme ? 'border-slate-800' : 'border-slate-200/80'}`}>
                        <button 
                            onClick={() => setActiveFeatureTab('knowledge')}
                            className={`relative pb-4 flex items-center gap-2 text-xs font-semibold transition-all ${activeFeatureTab === 'knowledge' ? (isDarkTheme ? 'text-white' : 'text-[var(--color-primary)]') : (isDarkTheme ? 'text-slate-500 hover:text-slate-300' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]')}`}
                        >
                            <Database className={`w-4 h-4 ${activeFeatureTab === 'knowledge' ? 'text-[var(--color-primary)]' : 'opacity-70'}`} />
                            Kho kiến thức AI
                            {activeFeatureTab === 'knowledge' && (
                                <span className="absolute bottom-[-1px] left-0 w-full h-[2.5px] bg-[var(--color-primary)] rounded-t-full"></span>
                            )}
                        </button>

                        <button 
                            onClick={() => setActiveFeatureTab('scenarios')}
                            className={`relative pb-4 flex items-center gap-2 text-xs font-semibold transition-all ${activeFeatureTab === 'scenarios' ? (isDarkTheme ? 'text-white' : 'text-[var(--color-primary)]') : (isDarkTheme ? 'text-slate-500 hover:text-slate-300' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]')}`}
                        >
                            <Zap className={`w-4 h-4 ${activeFeatureTab === 'scenarios' ? 'text-[var(--color-primary)]' : 'opacity-70'}`} />
                            Kịch bản hội thoại
                            {activeFeatureTab === 'scenarios' && (
                                <span className="absolute bottom-[-1px] left-0 w-full h-[2.5px] bg-[var(--color-primary)] rounded-t-full"></span>
                            )}
                        </button>
                    </div>

                    {/* CONTENT: SCENARIOS */}
                    <div className={`transition-all duration-500 py-4 ${activeFeatureTab === 'scenarios' ? 'block animate-in fade-in slide-in-from-top-4' : 'hidden'}`}>
                        <ScenarioManager
                            propertyId={selectedProperty}
                            isDarkTheme={isDarkTheme}
                            brandColor={brandColor}
                        />
                    </div>

                    {/* CONTENT: KNOWLEDGE BASE */}
                    <div className={`transition-all duration-500 py-4 space-y-6 ${activeFeatureTab === 'knowledge' ? 'block animate-in fade-in slide-in-from-top-4' : 'hidden'}`}>
                        <div className={`flex flex-col lg:flex-row justify-between lg:items-center p-5 lg:p-6 rounded-[14px] border gap-5 shadow-sm ${isDarkTheme ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-sm border hidden md:flex ${isDarkTheme ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'}`}>
                                    <Database className={`w-5 h-5 ${isDarkTheme ? 'text-orange-400' : 'text-[var(--color-primary)]'}`} />
                                </div>
                                <div className="hidden md:block">
                                    <h3 className={`text-lg font-black tracking-tight ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Kho Kiến Thức AI</h3>
                                    <div className={`text-[12px] font-medium mt-0.5 ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                                        Công cụ quản lý dữ liệu
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide shrink-0">
                                <button onClick={() => setIsFolderModalOpen(true)} className={`h-9 lg:h-11 px-3 lg:px-5 rounded-lg lg:rounded-xl text-[10px] lg:text-[11px] font-bold border transition-all flex items-center gap-2 shadow-sm whitespace-nowrap ${isDarkTheme ? 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}>
                                    <FolderPlus className={`w-3.5 h-3.5 lg:w-4 h-4 ${isDarkTheme ? 'fill-[#ffc800] text-[#ffc800]' : 'fill-[#fbbf24] text-[#fbbf24]'}`} /> Tạo Thư Mục
                                </button>
                                <button
                                    onClick={() => props.fileInputRef?.current?.click()}
                                    className={`h-9 lg:h-11 px-3 lg:px-5 rounded-lg lg:rounded-xl text-[10px] lg:text-[11px] font-bold border transition-all flex items-center gap-2 shadow-sm whitespace-nowrap ${isDarkTheme ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}
                                >
                                    <FileUp className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-emerald-500 shrink-0" />
                                    <span>PDF Training{uploadLimit ? ` [max ${uploadLimit}]` : ''}</span>
                                </button>

                                <input
                                    type="file"
                                    ref={props.fileInputRef}
                                    onChange={handleFileInputChange}
                                    className="hidden"
                                    accept=".pdf"
                                />
                                <div className="flex items-center gap-2 lg:gap-3 shrink-0">
                                    <button
                                        onClick={() => setIsSynonymsModalOpen(true)}
                                        disabled={loading}
                                        className={`h-9 lg:h-11 px-3 lg:px-5 rounded-lg lg:rounded-xl text-[10px] lg:text-[11px] font-bold border transition-all duration-500 flex items-center gap-2 shadow-sm whitespace-nowrap ${isDarkTheme ? 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        <BrainCircuit className="w-3.5 h-3.5 lg:w-4 h-4 text-slate-400" />
                                        Học Đồng Nghĩa
                                    </button>
                                    <div className={`hidden lg:block h-8 w-px mx-1 ${isDarkTheme ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                                    {mainTab !== 'chat' && (
                                        <button
                                            onClick={handleTestAI}
                                            className={`h-9 lg:h-11 px-3 lg:px-5 rounded-lg lg:rounded-xl border font-bold text-[10px] lg:text-[11px] transition-all flex items-center gap-2 group active:scale-95 shadow-sm whitespace-nowrap ${isDarkTheme ? 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600 hover:text-slate-100' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900'}`}
                                        >
                                            <FlaskConical className={`w-3.5 h-3.5 lg:w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors ${isDarkTheme ? 'group-hover:text-slate-200' : ''}`} />
                                            <span>Test AI</span>
                                        </button>
                                    )}
                                    <div
                                        onClick={() => toggleChatbotStatus(settings.is_enabled ? 0 : 1)}
                                        className={`flex items-center gap-3 px-3 lg:px-5 py-2 rounded-lg lg:rounded-xl border cursor-pointer transition-all select-none shadow-sm h-9 lg:h-11 whitespace-nowrap ${isDarkTheme ? 'bg-slate-700 border-slate-600 hover:border-slate-500' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                                    >
                                        <span className={`text-[9px] lg:text-[10px] font-black uppercase tracking-tight ${settings.is_enabled ? (isDarkTheme ? 'text-slate-200' : 'text-slate-700') : 'text-slate-400'}`}>{settings.is_enabled ? 'Đang chờ' : 'Tạm dừng'}</span>
                                        <div className={`w-8 h-4 lg:w-9 lg:h-5 rounded-full p-0.5 transition-all duration-300 flex items-center ${settings.is_enabled ? 'bg-emerald-500 justify-end' : (isDarkTheme ? 'bg-slate-800 justify-start' : 'bg-slate-200 justify-start')}`}>
                                            <div className="w-3 h-3 lg:w-4 lg:h-4 bg-white rounded-full shadow-sm"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Training Alert */}
                        {docs.some((d: any) => d.status === 'pending' && d.source_type !== 'folder') && (
                            <div className={`border rounded-[14px] p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 shadow-sm ${isDarkTheme ? 'bg-slate-800/50 border-slate-700' : 'bg-[var(--color-primary)]-surface border-slate-100'}`} style={{ backgroundColor: isDarkTheme ? undefined : 'var(--brand-surface)', borderColor: isDarkTheme ? undefined : 'var(--brand-border)' }}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full border flex items-center justify-center shadow-sm shrink-0 ${isDarkTheme ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`} style={{ color: 'var(--brand-primary)' }}><AlertTriangle className="w-6 h-6" /></div>
                                    <div className="flex-1">
                                        <h4 className={`text-sm font-bold flex items-center gap-2 uppercase tracking-tight ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>
                                            Còn Huấn Luyện Dữ Liệu Mới
                                            <span style={{ backgroundColor: 'var(--brand-surface-accent)', color: 'var(--brand-text-accent)' }} className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-black ${isDarkTheme ? 'bg-slate-700 text-slate-300' : ''}`}>
                                                {docs.filter((d: any) => d.status === 'pending' && d.source_type !== 'folder').length.toLocaleString()} MỤC
                                            </span>
                                            <button onClick={() => setIsEmbeddingModalOpen(true)} className={`ml-1 transition-colors p-1 rounded-full ${isDarkTheme ? 'text-slate-500 hover:text-slate-300 bg-slate-800/50' : 'text-slate-400 hover:text-slate-600 bg-white/50'}`} title="Tại sao cần huấn luyện lại?">
                                                <HelpCircle className="w-3 h-3" />
                                            </button>
                                        </h4>
                                        <p className={`text-xs mt-1 leading-relaxed font-medium ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                                            Hệ thống phát hiện có dữ liệu mới hoặc đã chỉnh sửa chưa được học.
                                            <br />Vui lòng bấm nút huấn luyện để AI cập nhật kiến thức mới nhất.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleTrainDocs}
                                    disabled={loading || docs.some(d => d.status === 'processing')}
                                    className={`
                                        h-9 px-4 rounded-[var(--radius-md)] bg-[var(--color-primary)] hover:brightness-95 text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-2 shrink-0 border-none
                                        ${(loading || docs.some(d => d.status === 'processing')) ? 'opacity-70 cursor-wait' : 'active:scale-95'}
                                    `}
                                >
                                    {(loading || docs.some(d => d.status === 'processing')) ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                                    {docs.some(d => d.status === 'processing' && d.status_message)
                                        ? (docs.find(d => d.status === 'processing' && d.status_message)?.status_message)
                                        : (loading || docs.some(d => d.status === 'processing') ? 'Đang học...' : 'Huấn luyện ngay')}
                                </button>
                            </div>
                        )}

                        {/* Subtabs - simple gray */}
                        <div className="px-3 lg:px-6 mt-5 mb-1">
                            <div className={`inline-flex items-center gap-1 p-1 rounded-xl ${isDarkTheme ? 'bg-slate-800/60' : 'bg-slate-100'}`}>

                                <button
                                    onClick={() => setTrainingSubTab('manual')}
                                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-150
                                        ${trainingSubTab === 'manual'
                                            ? (isDarkTheme ? 'bg-slate-700 text-slate-100 shadow-sm' : 'bg-white text-slate-800 shadow-sm')
                                            : (isDarkTheme ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')}`}
                                >
                                    <span>Thủ công</span>
                                    <span className={`text-[10px] font-black tabular-nums px-1 rounded ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>{manualCount}</span>
                                </button>

                                <button
                                    onClick={() => setTrainingSubTab('files')}
                                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-150
                                        ${trainingSubTab === 'files'
                                            ? (isDarkTheme ? 'bg-slate-700 text-slate-100 shadow-sm' : 'bg-white text-slate-800 shadow-sm')
                                            : (isDarkTheme ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')}`}
                                >
                                    <span>File PDF</span>
                                    <span className={`text-[10px] font-black tabular-nums px-1 rounded ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>{filesCount}</span>
                                </button>

                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-6 mb-4 mt-8 px-3 lg:px-6">
                            <div className="flex items-center gap-3">
                                <h4 className={`text-sm font-bold ${isDarkTheme ? 'text-slate-300' : 'text-slate-800'}`}>Danh mục tài liệu</h4>
                                <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${isDarkTheme ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
                                    {filteredGroupedDocs.length} mục hiển thị
                                </span>
                            </div>
                            <div className="relative group max-w-sm flex-1">
                                <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isDarkTheme ? 'text-slate-600 group-focus-within:text-[var(--color-primary)]' : 'text-slate-400 group-focus-within:text-emerald-500'}`} />
                                <input
                                    type="text"
                                    placeholder="Lọc tài liệu theo tên, tags..."
                                    value={docSearchTerm}
                                    onChange={(e) => setDocSearchTerm(e.target.value)}
                                    className={`h-11 border rounded-xl pl-10 pr-4 py-2 text-xs font-bold outline-none transition-all shadow-sm w-full ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-200 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)]' : 'bg-white border-slate-200 text-slate-700 focus:ring-emerald-500/5 focus:border-emerald-500'}`}
                                />
                                {docSearchTerm && (
                                    <button
                                        onClick={() => setDocSearchTerm('')}
                                        className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors ${isDarkTheme ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
                                    >
                                        <X className="w-3.5 h-3.5 text-slate-400" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Bulk Actions (omitted from target content) */}

                        {/* Bulk Actions */}
                        {selectedIds.length > 0 && (
                            <div className="sticky top-14 lg:top-16 z-30 flex items-center justify-between bg-amber-50/90 backdrop-blur-md px-6 py-3 rounded-[14px] shadow-sm border border-amber-100 animate-in slide-in-from-top-4 duration-300 mb-6 font-medium">
                                <div className="flex items-center gap-4">
                                    <div className="w-7 h-7 bg-[var(--color-primary)] rounded-lg flex items-center justify-center text-white shadow-sm">
                                        <Check className="w-4 h-4 stroke-[4]" />
                                    </div>
                                    <div className="text-sm font-bold text-slate-700">
                                        Đã chọn <span className="text-[var(--color-primary)] font-black">{selectedIds.length.toLocaleString()}</span> mục
                                    </div>
                                </div>

                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => { fetchChatbots(); props.setBulkActionType('copy'); props.setIsBulkMoveModalOpen(true); }}
                                        className="h-10 px-4 flex items-center gap-2 text-slate-500 hover:text-[#9A1523] hover:bg-white rounded-xl transition-all text-xs font-bold"
                                    >
                                        <Copy className="w-4 h-4" />
                                        <span>Sao chép đến</span>
                                    </button>
                                    <button
                                        onClick={() => { fetchChatbots(); props.setBulkActionType('move'); props.setIsBulkMoveModalOpen(true); }}
                                        className="h-10 px-4 flex items-center gap-2 text-slate-500 hover:text-[#9A1523] hover:bg-white rounded-xl transition-all text-xs font-bold"
                                    >
                                        <Move className="w-4 h-4" />
                                        <span>Di chuyển</span>
                                    </button>

                                    <div className="w-px h-6 bg-amber-200/50 mx-3"></div>

                                    <button
                                        onClick={handleBulkDelete}
                                        className="w-10 h-10 bg-white border border-rose-100 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all flex items-center justify-center shadow-sm"
                                        title="Xóa nhanh"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setSelectedIds([])}
                                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors ml-2"
                                        title="Hủy chọn"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* PDF Chunked Extraction Progress Banner */}
                        {processingPdfDocs.length > 0 && (
                            <div className="space-y-3 mb-4">
                                {processingPdfDocs.map((doc: any) => {
                                    const prog = pdfProgressMap[doc.id];
                                    const done = prog?.done ?? 0;
                                    const processing = prog?.processing ?? 0;
                                    const total = prog?.total ?? ((() => { try { return JSON.parse(doc.metadata || '{}').total_chunks || 0; } catch { return 0; } })());
                                    const pct = total > 0 ? Math.round(done / total * 100) : 0;
                                    // Visual: never go backwards — take max of real pct vs in-progress estimate
                                    const processingPct = processing > 0 && total > 0 ? Math.round(processing / total * 45) : 0;
                                    const visualPct = Math.max(pct, processingPct);
                                    const statusMsg: string = prog?.status_message || doc.error_message || '';
                                    const isCooldown: boolean = prog?.is_cooldown ?? (statusMsg.includes('ngh') || statusMsg.includes('rate limit'));
                                    const isEmbedding: boolean = prog?.is_embedding ?? (statusMsg.toLowerCase().includes('embedding') || statusMsg.toLowerCase().includes('merge'));

                                    // Inline color palettes (no Tailwind dynamic classes)
                                    const colors = isEmbedding
                                        ? {
                                            text: isDarkTheme ? '#818cf8' : '#4f46e5',
                                            bg: isDarkTheme ? 'rgba(99,102,241,0.1)' : '#eef2ff',
                                            border: isDarkTheme ? '#4338ca' : '#c7d2fe',
                                            barFrom: '#818cf8', barTo: '#6366f1',
                                            labelBg: isDarkTheme ? 'rgba(99,102,241,0.15)' : '#e0e7ff',
                                        }
                                        : isCooldown
                                            ? {
                                                text: isDarkTheme ? '#fbbf24' : '#BD1D2D',
                                                bg: isDarkTheme ? 'rgba(251,191,36,0.08)' : '#fffbeb',
                                                border: isDarkTheme ? '#92400e' : '#fde68a',
                                                barFrom: '#fcd34d', barTo: '#BD1D2D',
                                                labelBg: isDarkTheme ? 'rgba(251,191,36,0.12)' : '#fef3c7',
                                            }
                                            : {
                                                text: isDarkTheme ? '#34d399' : '#059669',
                                                bg: isDarkTheme ? 'rgba(52,211,153,0.08)' : '#ecfdf5',
                                                border: isDarkTheme ? '#065f46' : '#a7f3d0',
                                                barFrom: '#34d399', barTo: '#14b8a6',
                                                labelBg: isDarkTheme ? 'rgba(52,211,153,0.1)' : '#d1fae5',
                                            };

                                    return (
                                        <div key={doc.id} style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 16 }}>
                                            {/* Header row */}
                                            <div className="flex items-center gap-3 mb-3">
                                                <div style={{ width: 36, height: 36, borderRadius: 12, background: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    {isCooldown ? (
                                                        <svg style={{ width: 16, height: 16, color: colors.text }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                    ) : (
                                                        <svg style={{ width: 16, height: 16, color: colors.text }} className="animate-spin" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span style={{ color: isDarkTheme ? '#e2e8f0' : '#1e293b', fontSize: 12, fontWeight: 900 }} className="truncate max-w-[220px]">
                                                            {doc.name || doc.title || 'Tài liệu PDF'}
                                                        </span>
                                                        <span className={isCooldown ? '' : 'animate-pulse'} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', padding: '2px 8px', borderRadius: 999, color: colors.text, background: colors.labelBg, textTransform: 'uppercase', flexShrink: 0 }}>
                                                            {isEmbedding ? '🧠 Tạo Embedding' : isCooldown ? '⏳ Chờ rate limit' : processing > 0 ? '⚡ Đang trích xuất' : '📄 Trích xuất'}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: 10, marginTop: 2, color: isDarkTheme ? '#94a3b8' : '#64748b' }}>
                                                        {total > 0 ? `${done}/${total} đợt Hoàn thành` : 'Khởi động...'}
                                                        {processing > 0 && <span style={{ marginLeft: 4, color: colors.text }}> · {processing} đang xử lý</span>}
                                                        {total > 0 && <span style={{ margin: '0 4px' }}>·</span>}
                                                        {total > 0 && <span style={{ fontWeight: 700 }}>{pct}%</span>}
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: 24, fontWeight: 900, color: colors.text, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                                                    {pct}%
                                                </div>
                                            </div>

                                            {/* Progress bar — inline style, always visible */}
                                            <div style={{ height: 10, borderRadius: 999, overflow: 'hidden', background: isDarkTheme ? 'rgba(100,116,139,0.25)' : 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
                                                <div
                                                    style={{
                                                        height: '100%',
                                                        borderRadius: 999,
                                                        background: `linear-gradient(to right, ${colors.barFrom}, ${colors.barTo})`,
                                                        width: `${Math.max(4, visualPct)}%`,
                                                        transition: 'width 1s ease-out',
                                                        opacity: processing > 0 && pct === 0 ? 0.75 : 1,
                                                    }}
                                                />
                                            </div>

                                            {/* Status message */}
                                            {statusMsg ? (
                                                <div style={{ fontSize: 10, fontWeight: 600, padding: '6px 8px', borderRadius: 8, background: isDarkTheme ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)', color: isDarkTheme ? '#94a3b8' : '#64748b', lineHeight: 1.5 }}>
                                                    {isCooldown && <span style={{ marginRight: 4 }}>💤</span>}
                                                    {statusMsg}
                                                </div>
                                            ) : (
                                                <div style={{ fontSize: 9, fontWeight: 500, textAlign: 'right', color: isDarkTheme ? '#475569' : '#cbd5e1' }}>
                                                    Cập nhật mỗi 5 giây · Chạy ngầm
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <AITrainingTable
                            groupedDocs={filteredGroupedDocs}
                            expandedGroups={docSearchTerm
                                ? filteredGroupedDocs.filter((g: any) => g.isGroup).map((g: any) => g.id)
                                : expandedGroups}
                            setExpandedGroups={setExpandedGroups}
                            showGlobal={trainingSubTab === 'files'}
                            onReorder={onReorder}
                            toggleDoc={toggleDoc}
                            handleViewDoc={handleViewDoc}
                            deleteDoc={deleteDoc}
                            setInfoDoc={setInfoDoc}
                            newDoc={newDoc}
                            handleEditFolder={handleEditFolder}
                            setIsAddModalOpen={setIsAddModalOpen}
                            setNewDoc={setNewDoc}
                            selectedIds={selectedIdsSet}
                            totalCount={totalSelectableCount}
                            onToggleSelect={onToggleSelect}
                            onToggleSelectAll={onToggleSelectAll}
                            toggleWorkspace={toggleWorkspace}
                            isDarkTheme={isDarkTheme}
                        />
                    </div>
                </div>

                {/* ── PDF Confirm Modal ── */}
                {isPdfPageModal && pendingPdfFile && (() => {
                    const pages = parseInt(pdfPageInput) || 1;
                    const batches = Math.ceil(pages / 5);
                    const mins = Math.max(1, Math.ceil(batches / 5) * 2);
                    const fileMB = (pendingPdfFile.size / 1024 / 1024).toFixed(2);
                    return createPortal(
                        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]">
                            <div className={`relative w-full max-w-[380px] rounded-[14px] shadow-2xl overflow-hidden border ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>

                                {/* Header */}
                                <div className="px-8 pt-8 pb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${isDarkTheme ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                                            Tài liệu sẵn sàng
                                        </span>
                                    </div>
                                    <h3 className={`text-2xl font-black ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
                                        Xác nhận huấn luyện
                                    </h3>
                                    <p className={`text-xs mt-1 font-medium ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>
                                        Kiểm tra thông số trước khi bắt đầu
                                    </p>
                                </div>

                                <div className="px-8 pb-8 space-y-6">
                                    {/* Main File Box */}
                                    <div className={`p-4 rounded-[14px] border ${isDarkTheme ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50/50 border-slate-100'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/20 shrink-0">
                                                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className={`text-sm font-bold truncate ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>{pendingPdfFile.name}</p>
                                                <p className="text-[10px] mt-0.5 font-bold uppercase tracking-wider text-slate-400">{fileMB} MB</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stats List */}
                                    <div className={`divide-y ${isDarkTheme ? 'divide-slate-800' : 'divide-slate-100'}`}>
                                        {[
                                            { label: 'Số lượng trang', value: `${pages} trang`, icon: <FileText className="w-4 h-4" /> },
                                            { label: 'Phân đoạn xử lý', value: `${batches} đợt`, icon: <Layers className="w-4 h-4" /> },
                                            { label: 'Thời gian dự kiến', value: `~${mins} phút`, icon: <Clock className="w-4 h-4" /> },
                                        ].map((s, i) => (
                                            <div key={i} className="py-3 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={isDarkTheme ? 'text-slate-600' : 'text-slate-300'}>{s.icon}</div>
                                                    <span className={`text-[11px] font-bold uppercase tracking-tight ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>{s.label}</span>
                                                </div>
                                                <span className={`text-xs font-black ${isDarkTheme ? 'text-emerald-400' : 'text-emerald-600'}`}>{s.value}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={() => { setIsPdfPageModal(false); setPendingPdfFile(null); }}
                                            disabled={pdfUploading}
                                            className={`h-12 px-6 rounded-[14px] text-xs font-bold transition-all border ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                            Hủy bỏ
                                        </button>
                                        <button
                                            onClick={handlePdfPageModalConfirm}
                                            disabled={pdfUploading}
                                            className={`flex-1 h-12 rounded-[14px] text-xs font-black text-white flex items-center justify-center gap-2 transition-all shadow-xl shadow-emerald-500/20
                                                ${pdfUploading ? 'bg-slate-400' : 'bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98]'}`}>
                                            {pdfUploading ? (
                                                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Đang tải...</>
                                            ) : (
                                                <>Bắt đầu huấn luyện →</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>,
                        getMktPortalRoot()
                    );
                })()}



                {
                    !(chatbots || []).some(c => c.id === selectedProperty) && (
                        <div className={activeTab === 'settings' ? "block animate-in fade-in duration-300" : "hidden"}>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 space-y-8">
                                    {/* Configuration Form */}
                                    <div className={`p-8 rounded-[14px] border space-y-8 transition-all duration-500 ${isDarkTheme ? 'bg-slate-800/20 border-slate-700' : 'bg-slate-50/50 border-slate-200'}`}>
                                        <div className={`flex items-center justify-between border-b pb-5 ${isDarkTheme ? 'border-slate-800' : 'border-slate-200'}`}>
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center shadow-sm border ${isDarkTheme ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-100 text-slate-800'}`}>
                                                    <Bot className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className={`text-lg font-bold ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>Thông tin nhận diện</h3>
                                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Xác lập danh tính nhân sự AI</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Assuming useState and useEffect are declared at the component's top level */}
                                        {/* Example:
                                    const [localBotName, setLocalBotName] = useState(settings.bot_name || '');
                                    const [localCompanyName, setLocalCompanyName] = useState(settings.company_name || '');
                                    // Add other local states as needed, e.g., for instruction
                                    // const [localInstruction, setLocalInstruction] = useState(settings.instruction || '');

                                    useEffect(() => {
                                        setLocalBotName(settings.bot_name || '');
                                    }, [settings.bot_name]);

                                    useEffect(() => {
                                        setLocalCompanyName(settings.company_name || '');
                                    }, [settings.company_name]);

                                    // useEffect(() => {
                                    //     setLocalInstruction(settings.instruction || '');
                                    // }, [settings.instruction]);
                                */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <Input label="Tên tư vấn viên (Bot Name)" placeholder="VD: Lan Hương" value={localBotName} onChange={e => { setLocalBotName(e.target.value); }} icon={Bot} isDarkTheme={isDarkTheme} />
                                            <Input label="Tên doanh nghiệp công tác" placeholder="VD: MailFlow Pro" value={localCompanyName} onChange={e => { setLocalCompanyName(e.target.value); }} icon={Building} isDarkTheme={isDarkTheme} />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="w-full">
                                                <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5 ml-1 text-slate-400">
                                                    Màu thương hiệu (UI)
                                                </label>
                                                <div className="relative group">
                                                    <div className={`flex items-center gap-3 border rounded-xl h-[42px] px-3 transition-all duration-200 shadow-sm ${isDarkTheme ? 'bg-slate-800 border-slate-700 hover:border-slate-600 focus-within:border-[var(--color-primary)] focus-within:ring-[var(--color-primary)]/5' : 'bg-white border-slate-200 hover:border-slate-300 focus-within:border-[var(--color-primary)] focus-within:ring-4 focus-within:ring-[var(--color-primary)]/10'}`}>
                                                        <div className={`relative w-6 h-6 rounded-full overflow-hidden border shrink-0 shadow-sm ${isDarkTheme ? 'border-slate-700' : 'border-slate-200'}`}>
                                                            <input
                                                                type="color"
                                                                value={settings.brand_color || settings.cat_brand_color || '#000000'}
                                                                onChange={(e: any) => setSettings({ ...settings, brand_color: e.target.value })}
                                                                className="absolute -top-2 -left-2 w-[150%] h-[150%] cursor-pointer border-none p-0 bg-transparent"
                                                            />
                                                        </div>
                                                        <input
                                                            type="text"
                                                            value={settings.brand_color}
                                                            onChange={(e: any) => setSettings({ ...settings, brand_color: e.target.value })}
                                                            className={`flex-1 bg-transparent border-none text-sm font-bold font-mono outline-none uppercase text-slate-700 placeholder:text-slate-300 ${isDarkTheme ? 'text-slate-200 placeholder:text-slate-600' : 'text-slate-700 placeholder:text-slate-300'}`}
                                                            placeholder={settings.cat_brand_color ? `${settings.cat_brand_color} (Nhóm)` : "#000000"}
                                                        />
                                                        {!settings.brand_color && settings.cat_brand_color && (
                                                            <Users className="w-4 h-4 text-[var(--color-primary)]" />
                                                        )}
                                                        <Palette className="w-4 h-4 text-slate-400" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="relative">
                                                <Input
                                                    label="Avatar URL (32x32)"
                                                    placeholder={settings.cat_bot_avatar ? "(Kế thừa từ nhóm)" : "https://..."}
                                                    value={settings.bot_avatar}
                                                    onChange={(e: any) => setSettings({ ...settings, bot_avatar: e.target.value })}
                                                    icon={ImageIcon}
                                                    isDarkTheme={isDarkTheme}
                                                />
                                                {!settings.bot_avatar && settings.cat_bot_avatar && (
                                                    <Users className="absolute right-3 top-[34px] w-4 h-4 text-emerald-500" />
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-6">
                                            <div className="relative group">
                                                <div className="relative">
                                                    <Input
                                                        label="Gemini API Key"
                                                        type="password"
                                                        placeholder={settings.cat_gemini_api_key ? "•••••••••••••••• (Kế thừa từ nhóm)" : "Nhập API Key của bạn tại đây..."}
                                                        value={settings.gemini_api_key}
                                                        onChange={(e: any) => setSettings({ ...settings, gemini_api_key: e.target.value })}
                                                        icon={Bot}
                                                        isDarkTheme={isDarkTheme}
                                                    />
                                                    {!settings.gemini_api_key && settings.cat_gemini_api_key && (
                                                        <Users className="absolute right-3 top-[34px] w-4 h-4 text-emerald-500" />
                                                    )}
                                                </div>
                                                <p className="text-[9px] text-slate-400 font-medium px-2 mt-1">
                                                    {(!settings.gemini_api_key && settings.cat_gemini_api_key)
                                                        ? "Đang dùng API Key chung của Nhóm. Nhập vào đây nếu muốn dùng Key riêng cho bot này."
                                                        : "Key này sẽ được dùng để xử lý dữ liệu và trả lời chatbot cho riêng website này."
                                                    }
                                                </p>
                                            </div>
                                        </div>


                                        <div className="space-y-3">
                                            <label className="text-xs font-semibold text-[var(--color-text)]">Câu hỏi nhanh (Quick Actions)</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={newQuickAction}
                                                    onChange={(e: any) => setNewQuickAction(e.target.value)}
                                                    placeholder="Nhập câu hỏi gợi ý..."
                                                    className={`flex-1 h-9 px-3.5 border rounded-[var(--radius-md)] text-xs font-medium outline-none transition-all ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-200 focus:border-[var(--color-primary)]' : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10'}`}
                                                />
                                                <button className="h-9 px-4 bg-[var(--color-primary)] hover:brightness-95 text-white font-semibold rounded-[var(--radius-md)] text-xs shadow-xs transition-all shrink-0" onClick={addQuickAction}>Thêm</button>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {settings.quick_actions.map((qa: string, idx: number) => (
                                                    <div key={idx} className={`px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium border flex items-center gap-1.5 shadow-xs ${isDarkTheme ? 'bg-slate-800/50 border-slate-700 text-slate-300' : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)]'}`}>
                                                        <span>{qa}</span>
                                                        <button onClick={() => removeQuickAction(idx)} className="text-slate-400 hover:text-rose-500 transition-colors ml-1"><X className="w-3 h-3" /></button>
                                                    </div>
                                                ))}
                                                {settings.quick_actions.length === 0 && <p className="text-xs text-[var(--color-text-muted)] italic">Chưa có nút hỏi nhanh.</p>}
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-[var(--color-text)]">Lời chào mừng khách (Khi mở chat)</label>
                                            <textarea
                                                value={settings.welcome_msg}
                                                onChange={(e: any) => setSettings({ ...settings, welcome_msg: e.target.value })}
                                                className={`w-full p-3 border rounded-[var(--radius-md)] text-xs font-medium outline-none transition-all resize-none h-24 ${isDarkTheme ? 'bg-slate-800/50 border-slate-700 text-slate-200 focus:border-[var(--color-primary)]' : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10'}`}
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-[var(--color-text)]">Câu chào gợi ý (Khi chat đang đóng)</label>
                                            <input
                                                type="text"
                                                value={localTeaser}
                                                onChange={(e: any) => setLocalTeaser(e.target.value)}
                                                placeholder="VD: Chat với AI ngay!"
                                                className={`w-full h-9 px-3.5 border rounded-[var(--radius-md)] text-xs font-medium outline-none transition-all ${isDarkTheme ? 'bg-slate-800/50 border-slate-700 text-slate-200 focus:border-[var(--color-primary)]' : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10'}`}
                                            />
                                            <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Câu chào này sẽ hiện ra bên cạnh nút Chat khi khách chưa bấm mở.</p>
                                        </div>

                                        {/* Notification Settings */}
                                        <div className={`space-y-4 px-6 py-6 rounded-[14px] relative overflow-hidden transition-all duration-500 ${settings.notification_enabled ? 'ring-1 shadow-sm' : ''} ${isDarkTheme ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50/40 border border-slate-200/50'} ${settings.notification_enabled && !isDarkTheme ? 'ring-slate-200/60' : ''}`}>
                                            <div className="flex justify-between items-start relative z-10">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center shadow-sm transition-all duration-500 ${settings.notification_enabled ? 'bg-gradient-to-br from-[#2563eb] to-blue-600 text-white shadow-lg shadow-[#2563eb]/20' : (isDarkTheme ? 'bg-slate-800 text-slate-500 border border-slate-700' : 'bg-slate-100 text-slate-400')}`}>
                                                        <BellRing className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <h5 className={`text-base font-black tracking-tight ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>Email thông báo khi có thông tin khách</h5>
                                                        <p className="text-[10px] text-slate-500 font-medium">Thiết lập nơi nhận Khách hàng để đội Telesale CSKH khai thác.</p>
                                                    </div>
                                                </div>
                                                <div
                                                    onClick={() => setSettings({ ...settings, notification_enabled: settings.notification_enabled ? 0 : 1 })}
                                                    className={`flex items-center gap-3 cursor-pointer select-none p-1.5 px-3 rounded-xl border shadow-sm hover:shadow-md transition-all active:scale-95 ${isDarkTheme ? 'bg-slate-800 border-slate-700 hover:border-slate-600' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                                                >
                                                    <div className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 flex items-center ${settings.notification_enabled ? 'bg-emerald-500 justify-end' : 'bg-slate-200 justify-start'}`}>
                                                        <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                                                    </div>
                                                    <span className={`text-[9px] font-black uppercase tracking-widest ${settings.notification_enabled ? 'text-emerald-500' : 'text-slate-400'}`}>{settings.notification_enabled ? 'Đang bật' : 'Đang tắt'}</span>
                                                </div>
                                            </div>

                                            {settings.notification_enabled ? (
                                                <div className={`space-y-6 mt-6 pt-6 border-t relative z-10 animate-in fade-in slide-in-from-top-4 duration-500 ${isDarkTheme ? 'border-slate-700/50' : 'border-slate-200/50'}`}>
                                                    <Input
                                                        label="Tiêu đề (Subject) gửi thông báo"
                                                        icon={Edit3}
                                                        placeholder="VD: [AutoCapture] Có Khách hàng mới từ Hội thoại AI..."
                                                        value={settings.notification_subject || ''}
                                                        onChange={(e: any) => setSettings({ ...settings, notification_subject: e.target.value })}
                                                        className={isDarkTheme ? 'bg-slate-900/80' : 'bg-white/80'}
                                                    />

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                        <Input
                                                            label="Email nhận thông báo (Chính)"
                                                            icon={Mail}
                                                            multiline
                                                            rows={2}
                                                            placeholder={`support@domain.com\nsale@domain.com`}
                                                            value={settings.notification_emails || ''}
                                                            onChange={(e: any) => setSettings({ ...settings, notification_emails: e.target.value })}
                                                            className={isDarkTheme ? 'bg-slate-900/80' : 'bg-white/80'}
                                                        />
                                                        <Input
                                                            label="Email CC (Nhận bản sao)"
                                                            icon={Users}
                                                            multiline
                                                            rows={2}
                                                            placeholder={`manager@domain.com`}
                                                            value={settings.notification_cc_emails || ''}
                                                            onChange={(e: any) => setSettings({ ...settings, notification_cc_emails: e.target.value })}
                                                            className={isDarkTheme ? 'bg-slate-900/80' : 'bg-white/80'}
                                                        />
                                                    </div>

                                                    <div className={`p-4 shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] rounded-[14px] border ${isDarkTheme ? 'bg-slate-900/40 border-slate-700/50' : 'bg-white/40 border-amber-100/50'}`}>
                                                        <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                                                            * Nhập nhiều email bằng cách nhấn <kbd className={`px-1 inline-block pb-0.5 rounded font-bold border ${isDarkTheme ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>Enter</kbd> để xuống dòng. Phân cách bằng dấu phẩy sẽ được tự động hỗ trợ.
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>

                                        {/* Interface & Visibility Settings */}
                                        <VisibilitySettings
                                            settings={settings}
                                            setSettings={setSettings}
                                            handleSaveSettings={handleSaveSettings}
                                            loading={loading}
                                            isDarkTheme={isDarkTheme}
                                        />
                                    </div>
                                </div>


                                {/* Right Preview Column */}
                                <div className="space-y-8">
                                    <div className={`p-8 rounded-[14px] border shadow-xl space-y-6 relative overflow-hidden transition-all duration-500 ${isDarkTheme ? 'bg-slate-800/20 border-slate-700 shadow-none' : 'bg-white border-slate-100'}`}>
                                        <div className="absolute top-0 right-0 p-10 opacity-50"><Bot className={`w-40 h-40 ${isDarkTheme ? 'text-slate-800' : 'text-slate-50'}`} /></div>
                                        <h3 className={`text-lg font-black tracking-tight flex items-center gap-2 ${isDarkTheme ? 'text-slate-100' : 'text-slate-800'}`}>
                                            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center text-white"><Zap className="w-5 h-5" /></div>
                                            Chat Preview
                                        </h3>

                                        {/* Widget Preview Container (Glassmorphism Mode) */}
                                        <div className={`rounded-[14px] overflow-hidden border relative z-10 shadow-xl transition-all duration-500 ${isDarkTheme ? 'bg-slate-900 border-slate-700 shadow-none' : 'bg-white/95 backdrop-blur-xl border-slate-100'}`}>
                                            {/* Mock Header: Syncs with Brand Color & Style */}
                                            <div
                                                className="px-6 py-5 flex items-center gap-4 relative overflow-hidden"
                                                style={{ background: `linear-gradient(135deg, ${brandColor}, var(--brand-primary-dark))` }}
                                            >
                                                {/* Pattern overlay */}
                                                <div className="absolute inset-0 opacity-10 pointer-events-none">
                                                    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                                                        <defs>
                                                            <pattern id="grid-preview" width="15" height="15" patternUnits="userSpaceOnUse">
                                                                <path d="M 15 0 L 0 0 0 15" fill="none" stroke="white" strokeWidth="0.5" />
                                                            </pattern>
                                                        </defs>
                                                        <rect width="100%" height="100%" fill="url(#grid-preview)" />
                                                    </svg>
                                                </div>

                                                <div className="relative">
                                                    <div className="w-12 h-12 bg-white/15 backdrop-blur-md rounded-[14px] flex items-center justify-center shadow-xl border border-white/20 overflow-hidden shrink-0">
                                                        {settings.bot_avatar ? (
                                                            <img src={settings.bot_avatar} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Bot className="w-7 h-7 text-white" />
                                                        )}
                                                    </div>
                                                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 border-[3px] border-white rounded-full shadow-sm"></div>
                                                </div>
                                                <div className="relative z-10">
                                                    <h3 className="text-white font-bold text-base flex items-center gap-1.5 tracking-tight">
                                                        {settings.bot_name || 'AI Consultant'}
                                                        <ShieldCheck className="w-4 h-4 text-amber-300" />
                                                    </h3>
                                                    <div className="text-white/80 text-[11px] font-semibold uppercase tracking-wider">Sẵn sàng hỗ trợ 24/7</div>
                                                </div>
                                            </div>

                                            {/* Mock Body: Glassmorphism Style */}
                                            <div className={`p-6 space-y-6 min-h-[350px] transition-colors duration-500 ${isDarkTheme ? 'bg-slate-900' : 'bg-slate-50/40'}`}>
                                                {/* AI Message */}
                                                <div className="flex gap-3.5 justify-start">
                                                    <div style={{ color: 'var(--brand-primary)' }} className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm border ${isDarkTheme ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                                                        {settings.bot_avatar ? (
                                                            <img src={settings.bot_avatar} className="w-full h-full object-cover rounded-xl" />
                                                        ) : (
                                                            <Bot className="w-5 h-5" />
                                                        )}
                                                    </div>
                                                    <div className="space-y-2 max-w-[85%]">
                                                        <div className={`px-5 py-3.5 rounded-[1.5rem] rounded-tl-none text-[14px] leading-[1.6] border shadow-sm ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-100/80 text-slate-700 shadow-slate-200/50'}`}>
                                                            {settings.welcome_msg || 'Chào bạn, mình có thể giúp gì cho bạn?'}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Quick Actions (Synced with actual widget style) */}
                                                {settings.quick_actions.length > 0 && (
                                                    <div className="flex flex-wrap gap-2.5 justify-start pl-[50px]">
                                                        {settings.quick_actions.map((qa: string, idx: number) => (
                                                            <div key={idx} style={{ borderColor: isDarkTheme ? 'rgba(255,255,255,0.1)' : 'var(--brand-border)' }} className={`px-4 py-2 rounded-full text-[12px] font-bold transition-all flex items-center gap-2 shadow-sm group/qa ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white hover:bg-[var(--color-primary)] hover:bg-opacity-5 hover:border-[var(--color-primary)]-accent text-slate-600'}`}>
                                                                <Sparkles className="w-3.5 h-3.5 text-[var(--color-primary)]" /> {qa}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* User Message */}
                                                <div className="flex justify-end">
                                                    <div className={`max-w-[85%] px-5 py-3.5 text-[14px] leading-[1.6] rounded-[1.5rem] rounded-tr-none shadow-lg font-medium ${isDarkTheme ? 'bg-[var(--color-primary)] text-white' : 'bg-slate-900 text-white shadow-slate-900/10'}`}>
                                                        Còn tư vấn dịch vụ ạ
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-center text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Visual Simulation</p>
                                    </div>

                                    <div className="bg-slate-900 p-8 rounded-[14px] border border-slate-800 shadow-xl space-y-5 relative overflow-hidden group">
                                        <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/5 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
                                        <div className="flex items-center justify-between relative z-10">
                                            <h4 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-tight">Mã nhúng Website</h4>
                                            <button
                                                onClick={() => {
                                                    const v = Math.floor(Date.now() / 3600000); // Hourly versioning
                                                    navigator.clipboard.writeText(`<!-- MailFlow Pro Tracker & AI Chat -->
<script>
  window._mf_config = {
    property_id: "${selectedProperty}",
    ai_chat: true
  };
</script>
<script src=\"${EXTERNAL_API_BASE}/tracker.js?v=${v}\" async></script>`);
                                                    toast.success('Đã copy mã nhúng (Version mới nhất)');
                                                }}
                                                className="p-2 bg-white/10 hover:bg-[#9A1523] text-white rounded-lg transition-all"
                                                title="Copy mã nhúng"
                                            >
                                                <FileInput className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        <div className="bg-black/30 rounded-[14px] p-4 border border-white/5 font-mono text-[10px] leading-relaxed text-slate-400 overflow-x-auto custom-scrollbar">
                                            <pre>
                                                {`<script>
  window._mf_config = {
    property_id: "${selectedProperty}",
    ai_chat: true
  };
</script>
<script src=".../tracker.js?v=${Math.floor(Date.now() / 3600000)}" async></script>`}
                                            </pre>
                                        </div>
                                        <p className="text-[9px] text-slate-500 font-medium italic">Dán mã này vào trước thẻ {'</head>'} để kích hoạt Chatbot & Tracking.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

                <div className={activeTab === 'inbox' ? "block animate-in fade-in duration-300" : "hidden"}>
                    <UnifiedChat
                        key={selectedProperty}
                        propertyId={selectedProperty}
                        initialConversationId={props.initialConversationId}
                        initialVisitorId={props.initialVisitorId}
                        defaultShowAnalysis={triggerAnalysisModal}
                        isGroup={mainTab === 'chat'}
                        initialSource={mainTab === 'chat' || (chatbots || []).some(c => c.id === selectedProperty) ? 'org' : 'web'}
                        isDarkTheme={isDarkTheme}
                    />
                </div>

                <div className={activeTab === 'instruction' ? "block animate-in fade-in duration-300" : "hidden"}>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                        <div className="lg:col-span-2 space-y-8">
                            <div className={`p-8 rounded-[14px] border space-y-8 transition-all ${isDarkTheme ? 'bg-slate-800/20 border-slate-700 shadow-none' : 'bg-slate-50/50 border-slate-200'}`}>
                                <div className={`flex items-center justify-between border-b pb-5 ${isDarkTheme ? 'border-slate-800' : 'border-slate-200'}`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center shadow-sm border ${isDarkTheme ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-100 text-slate-800'}`}>
                                            <Bot className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className={`text-lg font-bold ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>Cấu hình Persona & Tone</h3>
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">ĐỊNH NGHĨA TÍNH CÁCH VÀ PHONG CÁCH TRẢ LỜI CHO AI</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="relative w-full group overflow-hidden rounded-[14px] border-2 border-slate-800 bg-[#1e1e1e] focus-within:border-blue-500 transition-all shadow-inner">
                                        <textarea
                                            value={localInstruction}
                                            onChange={(e: any) => {
                                                setLocalInstruction(e.target.value);
                                            }}
                                            rows={35}
                                            placeholder={`Bạn là tư vấn viên chuyên nghiệp của... \n\nPhong cách: Nhiệt tình, thân thiện...`}
                                            className="relative w-full p-5 bg-transparent text-[11px] font-mono text-[#FFB86C] caret-white outline-none resize-none leading-relaxed z-10 block"
                                            style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                                        />
                                    </div>
                                    <p className="text-[11px] text-slate-500 font-medium px-1 mt-3">
                                        <span className="font-bold text-emerald-500">Lưu ý:</span> Bạn chỉ cần nhập <span className={`font-bold ${isDarkTheme ? 'text-slate-300' : 'text-slate-700'}`}>Persona (Vai trò) & Tone (Giọng văn)</span>. Hệ thống sẽ tự động ghép nối với Knowledge Base và Context Khách hàng.
                                    </p>
                                </div>

                                <div className={`pt-6 border-t border-dashed ${isDarkTheme ? 'border-slate-800' : 'border-slate-200'}`}>
                                    {/* Toggle Advanced Settings */}
                                    <div
                                        onClick={() => setShowAdvanced(!showAdvanced)}
                                        className={`flex items-center justify-between cursor-pointer group select-none bg-slate-900 p-4 border border-slate-800 shadow-lg transition-all relative z-20 ${showAdvanced ? 'rounded-t-[20px] border-b-0' : 'rounded-[14px] hover:shadow-xl'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg transition-colors ${showAdvanced ? 'bg-[var(--color-primary)] text-slate-900' : 'bg-slate-800 text-slate-400 group-hover:text-[var(--color-primary)]'}`}>
                                                <Settings className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-white uppercase tracking-widest">CÀI ĐẶT CHUYÊN SÂU (ADVANCED)</h4>
                                                <p className="text-[10px] text-slate-400">Similarity, Top K, Chunk Size...</p>
                                            </div>
                                        </div>
                                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${showAdvanced ? 'rotate-180' : ''}`} />
                                    </div>

                                    {/* Advanced Settings Content */}
                                    {showAdvanced && (
                                        <div className="bg-slate-900 rounded-b-[20px] p-6 border-x border-b border-t-0 border-slate-800 shadow-xl relative overflow-hidden group space-y-6 animate-in slide-in-from-top-2 -mt-[1px] pt-8 z-10">
                                            {/* Decorative BG */}
                                            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 relative z-10">
                                                {/* 1. Similarity Threshold */}
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-end">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                                                            Độ chính xác (Min Score)
                                                        </label>
                                                        <span className="text-xs font-bold text-[var(--color-primary)] font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700 shadow-sm">{settings.similarity_threshold || 0.45}</span>
                                                    </div>
                                                    <div className="relative group/slider">
                                                        <input
                                                            type="range"
                                                            min="0.1"
                                                            max="0.9"
                                                            step="0.05"
                                                            value={settings.similarity_threshold || 0.45}
                                                            onChange={(e: any) => setSettings({ ...settings, similarity_threshold: parseFloat(e.target.value) })}
                                                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-600 relative z-10"
                                                        />
                                                        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1.5 bg-slate-800 rounded-lg overflow-hidden pointer-events-none">
                                                            <div className="h-full bg-gradient-to-r from-blue-500 to-[#9A1523] opacity-30" style={{ width: `${((settings.similarity_threshold || 0.45) - 0.1) / 0.8 * 100}%` }}></div>
                                                        </div>
                                                    </div>
                                                    <p className="text-[9px] text-slate-500 leading-relaxed font-medium bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                                                        <strong className="text-slate-300">Giải thích:</strong> Điểm tin cậy tối thiểu để AI sử dụng thông tin tìm thấy.
                                                        <br />• <span className="text-[var(--color-primary)] font-bold">Cao (0.7 - 0.9):</span> AI cực kỳ "khắt khe", chỉ trả lời khi thông tin tìm thấy gần như khớp hoàn toàn. Tránh bịa đặt nhưng dễ trả lời "Dạ em chưa rõ" nếu câu hỏi hơi khác dữ liệu.
                                                        <br />• <span className="text-blue-400 font-bold">Còn bằng (0.4 - 0.6):</span> Mức tiêu chuẩn giúp AI linh hoạt nhưng vẫn an toàn.
                                                        <br />• <span className="text-orange-400 font-bold">Thấp (0.1 - 0.3):</span> AI dễ dàng chấp nhận thông tin có liên quan mờ nhạt. Dễ gây sai lệch thông tin nếu dữ liệu không chuẩn.
                                                    </p>
                                                </div>

                                                {/* 2. Chunk Size & Overlap (Moved Up) */}
                                                <div className="space-y-2">
                                                    <div className={`p-3 border rounded-xl space-y-3 ${isDarkTheme ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-800/30 border-slate-800'}`}>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${isDarkTheme ? 'text-slate-400' : 'text-slate-800'}`}>Cấu hình cắt dữ liệu (Chunking)</span>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Chunk Size</label>
                                                                <input
                                                                    type="number"
                                                                    min="100"
                                                                    max="2000"
                                                                    step="50"
                                                                    value={settings.chunk_size || 1000}
                                                                    onChange={(e: any) => setSettings({ ...settings, chunk_size: parseInt(e.target.value) })}
                                                                    className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-[11px] font-bold text-slate-200 outline-none focus:border-[var(--color-primary)] shadow-inner font-mono"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Overlap</label>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max="500"
                                                                    value={settings.chunk_overlap || 150}
                                                                    onChange={(e: any) => setSettings({ ...settings, chunk_overlap: parseInt(e.target.value) })}
                                                                    className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-[11px] font-bold text-slate-200 outline-none focus:border-[var(--color-primary)] shadow-inner font-mono"
                                                                />
                                                            </div>
                                                        </div>
                                                        <p className="text-[9px] text-slate-500 leading-relaxed font-medium bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                                                            <strong className="text-slate-300">Hướng dẫn:</strong>
                                                            <br />• <span className="text-slate-300">Chunk Size:</span> Độ dài 1 đoạn văn bản AI "cắt nhỏ" để học. Chunk nhỏ giúp tìm kiếm chính xác, Chunk lớn giúp AI có ngữ cảnh rộng hơn.
                                                            <br />• <span className="text-slate-300">Overlap:</span> Đoạn văn bản gối đầu giữa các đoạn cắt để không làm mất mạch nội dung ở các khe cắt.
                                                            <br /><span className="text-[var(--color-primary)] italic">* Lưu ý: Chỉ áp dụng cho các dữ liệu được nạp MỚI sau khi chỉnh.</span>
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* 3. Top K */}
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                            Số đoạn trích xuất (Top K)
                                                        </label>
                                                        <span className="text-[9px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded border border-slate-700 font-mono">Max: 50</span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="50"
                                                        value={settings.top_k || 12}
                                                        onChange={(e: any) => setSettings({ ...settings, top_k: parseInt(e.target.value) })}
                                                        className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-[11px] font-bold text-slate-200 outline-none focus:border-[var(--color-primary)] focus:bg-slate-800/80 transition-all shadow-inner font-mono"
                                                    />
                                                    <p className="text-[9px] text-slate-500 leading-relaxed font-medium bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                                                        <strong className="text-slate-300">Giải thích:</strong> Số lượng "mảnh kiến thức" AI sẽ đọc để trả lời 1 câu hỏi.
                                                        <br />• <span className="text-slate-300">Tăng cao:</span> AI thông minh hơn, tổng hợp được nhiều ý từ nhiều tài liệu khác nhau nhưng sẽ tốn nhiều Token và chậm hơn một chút.
                                                    </p>
                                                </div>

                                                {/* 4. History Limit */}
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                            Lịch sử hội thoại (History Limit)
                                                        </label>
                                                        <span className="text-[9px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded border border-slate-700 font-mono">Rec: 10</span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="100"
                                                        value={settings.history_limit || 10}
                                                        onChange={(e: any) => setSettings({ ...settings, history_limit: parseInt(e.target.value) })}
                                                        className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-[11px] font-bold text-slate-200 outline-none focus:border-[var(--color-primary)] focus:bg-slate-800/80 transition-all shadow-inner font-mono"
                                                    />
                                                    <p className="text-[9px] text-slate-500 leading-relaxed font-medium bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                                                        <strong className="text-slate-300">Giải thích:</strong> Số lượng tin nhắn gần nhất AI sẽ ghi nhớ để duy trì mạch hội thoại (Context).
                                                        <br />• <span className="text-slate-300">Vượt quá:</span> Khi hội thoại dài hơn nấc này, AI sẽ bắt đầu "quên" các tin nhắn đầu tiên. 20 - 30 là mức tối ưu.
                                                    </p>
                                                </div>

                                                {/* 5. Temperature */}
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                            Độ sáng tạo (Temperature)
                                                        </label>
                                                        <span className="text-[9px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded border border-slate-700 font-mono">{settings.temperature || 0.9}</span>
                                                    </div>
                                                    <div className="relative group/slider">
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max="2"
                                                            step="0.1"
                                                            value={settings.temperature || 0.9}
                                                            onChange={(e: any) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
                                                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-600 relative z-10"
                                                        />
                                                        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1.5 bg-slate-800 rounded-lg overflow-hidden pointer-events-none">
                                                            <div className="h-full bg-gradient-to-r from-[#BD1D2D] to-[#9A1523] opacity-30" style={{ width: `${(settings.temperature || 0.9) / 2 * 100}%` }}></div>
                                                        </div>
                                                    </div>
                                                    <p className="text-[9px] text-slate-500 leading-relaxed font-medium bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                                                        <strong className="text-slate-300">Giải thích:</strong> Kiểm soát tính ngẫu nhiên và sáng tạo của AI.
                                                        <br />• <span className="text-[var(--color-primary)] font-bold">Chính xác (0.1 - 0.5):</span> AI bám sát 100% dữ liệu, trả lời nhất quán và nghiêm túc. Phù hợp cho hỗ trợ kỹ thuật, y tế hoặc tra cứu thông tin chính xác.
                                                        <br />• <span className="text-blue-400 font-bold">Còn bằng (0.6 - 1.2):</span> AI trả lời tự nhiên, linh hoạt trong cách dùng từ như người thật. Mức **khuyên dùng** cho tư vấn bán hàng và CSKH.
                                                        <br />• <span className="text-orange-400 font-bold">Sáng tạo (1.3 - 2.0):</span> Câu trả lời rất "bay bổng" và đa dạng. **Lưu ý:** Dễ bị hiện tượng "ảo giác" (nói những thông tin không có trong Knowledge Base).
                                                    </p>
                                                </div>

                                                {/* 6. Max Output Tokens */}
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                            Độ dài câu trả lời (Max Tokens)
                                                        </label>
                                                        <span className="text-[9px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded border border-slate-700 font-mono">Max: 16384</span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        min="256"
                                                        max="16384"
                                                        step="256"
                                                        value={settings.max_output_tokens || 16384}
                                                        onChange={(e: any) => setSettings({ ...settings, max_output_tokens: parseInt(e.target.value) })}
                                                        className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-[11px] font-bold text-slate-200 outline-none focus:border-[var(--color-primary)] shadow-inner font-mono"
                                                    />
                                                    <p className="text-[9px] text-slate-500 leading-relaxed font-medium bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                                                        <strong className="text-slate-300">Giải thích:</strong> Giới hạn độ dài tối đa của 1 câu trả lời.
                                                        <br />• <span className="text-slate-300">Lưu ý:</span> 2048 Tokens ~ 1500 chữ. Nếu đặt quá thấp, AI có thể trả lời lửng lơ giữa chừng do hết giới hạn.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                    )}
                                </div>

                            </div>
                            {!(chatbots || []).some(c => c.id === selectedProperty) && (
                                <FastRepliesSettings settings={settings} setSettings={setSettings} isDarkTheme={isDarkTheme} />
                            )}
                        </div>

                        {/* Right Sidebar: Helpers */}
                        <div className="space-y-6 sticky top-6 h-fit z-10">
                            <div className={`p-5 rounded-[18px] border shadow-xs space-y-4 relative group overflow-hidden ${isDarkTheme ? 'bg-slate-800/20 border-slate-700 shadow-none' : 'bg-[var(--color-surface)] border-[var(--color-border)]'}`}>
                                <h4 className={`text-xs font-bold flex items-center gap-2 relative z-10 ${isDarkTheme ? 'text-slate-200' : 'text-[var(--color-text)]'}`}>Các biến hỗ trợ</h4>
                                <div className="space-y-2.5 relative z-10">
                                    {[
                                        { var: '{$botName}', desc: 'Tên của Chatbot thiết lập ở tab Cài đặt.' },
                                        { var: '{$companyName}', desc: 'Tên doanh nghiệp công tác.' },
                                        { var: '{$today}', desc: 'Ngày hiện tại (Định dạng: dd/mm/yyyy).' },
                                        { var: '{$currentPage}', desc: 'URL trang web khách đang xem.' },
                                        { var: '{$activityContext}', desc: 'Lịch sử hành vi/click của khách.' },
                                        { var: "{$isIdentified}", desc: "Trạng thái ĐÃ ĐỊNH DANH hoặc CHƯA ĐỊNH DANH." },
                                    ].map((item, idx) => (
                                        <div key={idx} className={`p-2.5 rounded-[var(--radius-md)] border transition-all relative ${isDarkTheme ? 'bg-slate-800/40 border-slate-700' : 'bg-[var(--color-bg-subtle)] border-[var(--color-border)]'}`}>
                                            <div className="flex justify-between items-center mb-1">
                                                <code className={`font-bold text-[11px] font-mono text-[var(--color-primary)]`}>{item.var}</code>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(item.var);
                                                        toast.success(`Đã copy ${item.var}`);
                                                    }}
                                                    className={`p-1 border rounded-[var(--radius-sm)] transition-all shadow-xs ${isDarkTheme ? 'bg-slate-800 border-slate-600 text-slate-400 hover:text-[var(--color-primary)]' : 'bg-white border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)]'}`}
                                                    title="Copy nhanh"
                                                >
                                                    <Copy className="w-3 h-3" />
                                                </button>
                                            </div>
                                            <p className={`text-[11px] leading-relaxed text-[var(--color-text-muted)]`}>{item.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <button
                                onClick={handleLocalSaveSettings}
                                disabled={loading}
                                className="w-full h-11 rounded-[var(--radius-md)] text-white text-xs font-bold uppercase tracking-wider shadow-xs hover:brightness-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-[var(--color-primary)]"
                            >
                                {loading ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                {loading ? 'Đang lưu...' : 'Lưu toàn bộ cấu hình AI'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── SCENARIOS TAB ─────────────────────────────────────────────── */}
                <div className={activeTab === 'scenarios' ? "block animate-in fade-in duration-300" : "hidden"}>
                    <ScenarioManager
                        propertyId={selectedProperty}
                        isDarkTheme={isDarkTheme}
                        brandColor={brandColor}
                    />
                </div>
            </div>
            {/* END MAIN DASHBOARD CONTAINER */}
            </div>
        </div>

            {showAIStats && (
                <AIStatsModal 
                    onClose={() => setShowAIStats(false)} 
                    propertyId={selectedProperty} 
                    brandColor={brandColor}
                    onOpenAnalysis={() => {
                        setShowAIStats(false);
                        setActiveTab('inbox');
                        setTriggerAnalysisModal(Date.now());
                    }}
                />
            )}

            <InputModal
                isOpen={isRenameModalOpen}
                onClose={() => setIsRenameModalOpen(false)}
                onConfirm={(newName) => {
                    if (newName && newName.trim()) {
                        setSettings({ ...settings, bot_name: newName.trim() });
                        handleSaveSettings();
                        toast.success('Đã cập nhật tên AI!');
                    }
                }}
                title="Đổi tên AI"
                message="Nhập tên mới cho nhân sự AI của bạn:"
                defaultValue={currentProperty?.name || ''}
                placeholder="VD: Lan Hương"
            />
        </div >
    );
};

export default React.memo(AITrainingDetail);



