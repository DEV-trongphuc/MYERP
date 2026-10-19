// src/components/marketing/components/templates/EmailEditor/AIEmailGeneratorModal.tsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    Sparkles, X, RefreshCw, Check, ChevronLeft,
    Wand2, AlertCircle, Monitor, Smartphone,
    Upload, ImagePlus, Trash2, Link2, Plus, ArrowRight,
    Library, RotateCcw, Eye, Search, Loader2, CheckSquare,
    Clock, Star, ClipboardCheck, Quote, ListChecks, Palette, MessageSquare
} from 'lucide-react';
import { EmailBlock, EmailBodyStyle } from '../../../types';
import { compileHTML } from './utils/htmlCompiler';
import { DEFAULT_BODY_STYLE } from './constants/editorConstants';
import ImageLibraryModal from './components/Properties/ImageLibraryModal';
import { api } from '../../../services/storageAdapter';
import { getMktPortalRoot } from '../../../utils/portalRoot';

interface AIEmailGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (blocks: EmailBlock[]) => void;
    onSaveSection?: (block: EmailBlock) => void;
    currentBlocks?: EmailBlock[];
    bodyStyle?: EmailBodyStyle;
    templateName?: string;
    emailId?: string | number;
}

type Step = 'prompt' | 'generating' | 'preview';
type Mode = 'generate' | 'redesign';
type PreviewTab = 'new' | 'old';

interface ImageItem {
    id: string;
    url: string;
    name: string;
    source: 'upload' | 'url';
}

const SMART_PRESETS = [
    {
        id: 'scholarship',
        badge: '🎓 Tuyển sinh & Học bổng',
        prompt: 'Thiết kế email thông báo Chương trình Tuyển sinh & Quỹ Học bổng Quản trị Kinh doanh Quốc tế (MBA / DBA). Nêu bật 3 lợi ích cốt lõi cho nhà quản lý, lộ trình xét duyệt 3 bước, khối cảm nhận cựu học viên và nút Đăng ký nhận tư vấn.',
        blocks: ['check_list', 'timeline', 'review'],
        tone: 'luxury',
    },
    {
        id: 'vip_event',
        badge: '🎫 Thư mời Hội thảo VIP',
        prompt: 'Thiết kế thư mời trang trọng tham dự Hội thảo Chuyên đề / Executive Workshop dành cho Lãnh đạo & Quản lý cấp cao. Có banner sự kiện nổi bật, lịch trình 3 phần (Timeline), giá trị nhận được và nút Xác nhận tham dự VIP.',
        blocks: ['timeline', 'check_list'],
        tone: 'luxury',
    },
    {
        id: 'flash_offer',
        badge: '🔥 Ưu đãi Giới hạn',
        prompt: 'Thiết kế email chương trình Ưu đãi Đặc biệt giới hạn thời gian. Có đồng hồ đếm ngược (Countdown), danh sách đặc quyền ưu đãi (Check-list), cam kết chất lượng và nút Nhận ưu đãi ngay nổi bật.',
        blocks: ['countdown', 'check_list'],
        tone: 'persuasive',
    },
    {
        id: 'onboarding',
        badge: '💌 Chào mừng Học viên mới',
        prompt: 'Thiết kế email Chào mừng Học viên / Khách hàng mới gia nhập hệ thống. Lời chào ấm áp cá nhân hóa {{first_name}}, 3 bước bắt đầu nhanh chóng (Timeline), danh mục tài liệu hướng dẫn và nút Truy cập cổng thông tin.',
        blocks: ['timeline', 'check_list'],
        tone: 'friendly',
    },
    {
        id: 'survey_csat',
        badge: '📊 Khảo sát Chất lượng',
        prompt: 'Thiết kế email tri ân khách hàng kết hợp Khảo sát nhanh mức độ hài lòng (Survey Card). Nội dung ngắn gọn, tinh tế, nhấn mạnh giá trị ý kiến đóng góp của học viên và khối thẻ Khảo sát nhanh nổi bật ở trung tâm.',
        blocks: ['survey_card'],
        tone: 'friendly',
    },
    {
        id: 'newsletter',
        badge: '📰 Bản tin Quản trị',
        prompt: 'Thiết kế Bản tin Tri thức & Xu hướng Quản trị hàng tháng. Bố cục hiện đại gồm 1 tiêu điểm chính, danh sách các góc nhìn chiến lược, 1 câu trích dẫn truyền cảm hứng (Quote) và nút Đọc chi tiết.',
        blocks: ['quote', 'check_list'],
        tone: 'professional',
    },
];

const TONE_OPTIONS = [
    { id: 'professional', label: 'Chuyên nghiệp' },
    { id: 'luxury', label: 'Sang trọng VIP' },
    { id: 'persuasive', label: 'Thuyết phục cao' },
    { id: 'friendly', label: 'Thân thiện' },
    { id: 'concise', label: 'Tinh gọn' },
];

const BRAND_COLORS = [
    { id: 'auto', label: 'Tự động', hex: '' },
    { id: '#BD1D2D', label: 'Đỏ IDEAS', hex: '#BD1D2D' },
    { id: '#1E3A8A', label: 'Xanh Navy', hex: '#1E3A8A' },
    { id: '#0F766E', label: 'Xanh Ngọc', hex: '#0F766E' },
    { id: '#B45309', label: 'Vàng Gold', hex: '#B45309' },
    { id: '#0F172A', label: 'Đen Slate', hex: '#0F172A' },
];

const COMPONENT_TOGGLES = [
    { id: 'check_list', label: 'Danh sách Lợi ích ✓', icon: ListChecks },
    { id: 'timeline', label: 'Lộ trình / Lịch trình', icon: Clock },
    { id: 'review', label: 'Cảm nhận Học viên', icon: Star },
    { id: 'survey_card', label: 'Thẻ Khảo sát nhanh', icon: ClipboardCheck },
    { id: 'countdown', label: 'Đồng hồ Đếm ngược', icon: CheckSquare },
    { id: 'quote', label: 'Trích dẫn Nổi bật', icon: Quote },
];

const QUICK_REFINES = [
    'Cắt gọn văn bản ngắn hơn 30%',
    'Làm nút bấm CTA nổi bật và thu hút hơn',
    'Thêm khối Thẻ Khảo sát nhanh (survey_card)',
    'Thêm khối Cảm nhận Học viên (review)',
    'Đổi bố cục sang phong cách sang trọng tối giản',
];

const findFirstImageUrl = (blocks: any[]): string | null => {
    if (!blocks || !Array.isArray(blocks)) return null;
    for (const b of blocks) {
        if (!b || typeof b !== 'object') continue;
        if (b.type === 'image' && b.url && typeof b.url === 'string' && b.url.trim() !== '') {
            return b.url;
        }
        if (b.children && Array.isArray(b.children) && b.children.length > 0) {
            const childUrl = findFirstImageUrl(b.children);
            if (childUrl) return childUrl;
        }
    }
    return null;
};

const ensureAbsoluteUrl = (url: string): string => {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('data:') || /^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }
    if (trimmed.startsWith('//')) {
        return `https:${trimmed}`;
    }
    if (trimmed.startsWith('/')) {
        return trimmed;
    }
    return `/${trimmed}`;
};

const getThumbnailUrl = (t: any): string => {
    if (t?.thumbnail && typeof t.thumbnail === 'string' && t.thumbnail.trim() !== '' && !t.thumbnail.includes('placehold.co')) {
        return ensureAbsoluteUrl(t.thumbnail);
    }
    if (t?.blocks && Array.isArray(t.blocks)) {
        const firstImg = findFirstImageUrl(t.blocks);
        if (firstImg) return ensureAbsoluteUrl(firstImg);
    }
    return '';
};

const hasRealBlockObjects = (blocks?: any[]): boolean => {
    return Boolean(Array.isArray(blocks) && blocks.length > 0 && blocks[0] && typeof blocks[0] === 'object' && blocks[0].type);
};

// Module cache for reference templates list so reopening modal is 0ms instant
let cachedRefTemplates: any[] | null = null;
const fullRefTemplateCache = new Map<string, any>();

const AIEmailGeneratorModal: React.FC<AIEmailGeneratorModalProps> = ({
    isOpen,
    onClose,
    onApply,
    onSaveSection,
    currentBlocks,
    bodyStyle = DEFAULT_BODY_STYLE,
    templateName = 'Email',
    emailId,
}) => {
    const hasExistingBlocks = hasRealBlockObjects(currentBlocks);
    const [mode, setMode] = useState<Mode>(hasExistingBlocks ? 'redesign' : 'generate');
    const [step, setStep] = useState<Step>('prompt');
    const [prompt, setPrompt] = useState('');
    const [tone, setTone] = useState<string>('professional');
    const [brandColor, setBrandColor] = useState<string>('#BD1D2D');
    const [includeBlocks, setIncludeBlocks] = useState<string[]>(['check_list']);
    const [improveContent, setImproveContent] = useState(true);
    const [images, setImages] = useState<ImageItem[]>([]);
    const [urlInput, setUrlInput] = useState('');
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [showLibrary, setShowLibrary] = useState(false);
    const [generatedBlocks, setGeneratedBlocks] = useState<EmailBlock[] | null>(null);
    const [previewHtml, setPreviewHtml] = useState('');
    const [oldHtml, setOldHtml] = useState('');
    const [previewTab, setPreviewTab] = useState<PreviewTab>('new');
    const [error, setError] = useState('');
    const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
    const [templates, setTemplates] = useState<any[]>(cachedRefTemplates || []);
    const [refSearch, setRefSearch] = useState('');
    const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
    const [previewingTemplate, setPreviewingTemplate] = useState<any | null>(null);
    const [loadingPreviewTpl, setLoadingPreviewTpl] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const iframeNewRef = useRef<HTMLIFrameElement>(null);
    const iframeOldRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        if (hasRealBlockObjects(currentBlocks)) {
            setMode('redesign');
            try {
                setOldHtml(compileHTML(currentBlocks!, bodyStyle, templateName));
            } catch {
                setOldHtml('');
            }
        } else {
            setMode('generate');
            setOldHtml('');
        }

        const fetchTemplates = async () => {
            try {
                const res = await api.get('templates');
                if (res.success && Array.isArray(res.data)) {
                    const editorTpls = res.data.filter((t: any) =>
                        t && (t.hasBlocks || (Array.isArray(t.blocks) && t.blocks.length > 0))
                    );
                    cachedRefTemplates = editorTpls;
                    setTemplates(editorTpls);
                }
            } catch (err) {
                console.error('Failed to fetch templates for AI reference:', err);
            }
        };
        fetchTemplates();
    }, [isOpen, currentBlocks, bodyStyle, templateName]);

    const reset = useCallback(() => {
        setStep('prompt');
        setGeneratedBlocks(null);
        setPreviewHtml('');
        setError('');
        setPreviewTab('new');
    }, []);

    const prevEmailIdRef = useRef<string | number | undefined>(undefined);
    useEffect(() => {
        if (emailId !== undefined && prevEmailIdRef.current !== undefined && emailId !== prevEmailIdRef.current) {
            reset();
        }
        prevEmailIdRef.current = emailId;
    }, [emailId, reset]);

    const handleToggleTemplateSelection = (id: string) => {
        setSelectedTemplateIds(prev => {
            if (prev.includes(id)) return prev.filter(tId => tId !== id);
            if (prev.length >= 3) return prev;
            return [...prev, id];
        });
    };

    const handleToggleComponentBlock = (blockType: string) => {
        setIncludeBlocks(prev =>
            prev.includes(blockType) ? prev.filter(b => b !== blockType) : [...prev, blockType]
        );
    };

    const handlePreviewReferenceTemplate = async (t: any) => {
        const cached = fullRefTemplateCache.get(String(t.id)) || t;
        setPreviewingTemplate(cached);

        const hasFull = Boolean(cached.htmlContent || hasRealBlockObjects(cached.blocks));
        if (hasFull || String(t.id).startsWith('sys_')) return;

        setLoadingPreviewTpl(true);
        try {
            const res = await api.get(`templates/${t.id}`);
            if (res.success && res.data) {
                fullRefTemplateCache.set(String(t.id), res.data);
                setPreviewingTemplate(res.data);
            }
        } catch {
            // Keep thumbnail fallback
        } finally {
            setLoadingPreviewTpl(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        Array.from(e.target.files || []).forEach(file => {
            const reader = new FileReader();
            reader.onload = ev => setImages(prev => [...prev, {
                id: crypto.randomUUID(),
                url: ev.target?.result as string,
                name: file.name,
                source: 'upload'
            }]);
            reader.readAsDataURL(file);
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleAddUrl = () => {
        if (!urlInput.trim()) return;
        setImages(prev => [...prev, {
            id: crypto.randomUUID(),
            url: urlInput.trim(),
            name: urlInput.trim().split('/').pop() || 'Image',
            source: 'url'
        }]);
        setUrlInput('');
        setShowUrlInput(false);
    };

    const handleGenerate = async (useExisting = false, customRefinePrompt?: string) => {
        const effectivePrompt = (customRefinePrompt ?? prompt).trim();
        if (!effectivePrompt && mode === 'generate' && !useExisting) return;
        setStep('generating');
        setError('');
        try {
            let fullPrompt = effectivePrompt;
            const urlImages = images.filter(i => i.source === 'url');
            if (urlImages.length > 0) {
                fullPrompt += `\n\nDanh sách hình ảnh sử dụng trong email:\n${urlImages.map((u, i) => `${i + 1}. ${u.url}`).join('\n')}`;
                fullPrompt += '\nHãy đặt các URL ảnh này vào các block image phù hợp trong bố cục.';
            }

            const payload: Record<string, any> = {
                prompt: fullPrompt || 'Thiết kế lại (Redesign) mẫu email hiện tại chuyên nghiệp, hiện đại và thu hút hơn.',
                improve_content: improveContent,
                tone,
                brand_color: brandColor,
                include_blocks: includeBlocks,
            };

            if (selectedTemplateIds.length > 0) {
                payload.reference_template_ids = selectedTemplateIds;
            }
            if (useExisting && hasRealBlockObjects(currentBlocks)) {
                payload.existing_blocks = currentBlocks;
                payload.body_style = bodyStyle;
            } else if (step === 'preview' && hasRealBlockObjects(generatedBlocks || undefined)) {
                payload.existing_blocks = generatedBlocks;
                payload.body_style = bodyStyle;
            }

            const data = await api.post('ai_email_generator', payload);
            if (data.success && Array.isArray(data.data) && data.data.length > 0) {
                setGeneratedBlocks(data.data);
                setPreviewHtml(compileHTML(data.data, bodyStyle, templateName));
                setPreviewTab('new');
                setStep('preview');
            } else {
                setError(data.message || 'AI chưa tạo được cấu trúc email phù hợp. Vui lòng thử mô tả rõ hơn!');
                setStep('prompt');
            }
        } catch {
            setError('Lỗi kết nối tới máy chủ AI. Vui lòng thử lại sau giây lát.');
            setStep('prompt');
        }
    };

    const handleApply = () => {
        if (generatedBlocks && generatedBlocks.length > 0) {
            onApply(generatedBlocks);
            onClose();
        }
    };

    const filteredTemplates = useMemo(() => {
        const q = refSearch.trim().toLowerCase();
        if (!q) return templates.slice(0, 24);
        return templates.filter(t => (t.name || '').toLowerCase().includes(q)).slice(0, 24);
    }, [templates, refSearch]);

    const referencePreviewHtml = useMemo(() => {
        if (!previewingTemplate) return '';
        if (previewingTemplate.htmlContent) return previewingTemplate.htmlContent;
        if (hasRealBlockObjects(previewingTemplate.blocks)) {
            return compileHTML(
                previewingTemplate.blocks,
                previewingTemplate.bodyStyle || bodyStyle || DEFAULT_BODY_STYLE,
                previewingTemplate.name,
                { isPreview: true }
            );
        }
        return '';
    }, [previewingTemplate, bodyStyle]);

    if (!isOpen) return null;

    const isPreview = step === 'preview';
    const isDesigning = mode === 'redesign';

    const loadingTitle = isDesigning ? 'AI đang thiết kế lại giao diện Email' : 'AI đang kiến tạo mẫu Email mới';
    const loadingDesc = isDesigning
        ? (improveContent ? 'Đang tối ưu hóa văn bản, phân bổ bố cục & đồng bộ màu thương hiệu...' : 'Đang giữ nguyên nội dung, nâng cấp bố cục & khoảng cách chuẩn quốc tế...')
        : 'Đang phân tích yêu cầu, xây dựng cấu trúc Section & tối ưu hiển thị đa thiết bị...';

    const modalNode = (
        <div
            className="fixed inset-0 flex items-center justify-center p-3 sm:p-5"
            style={{ zIndex: 2147483646 }}
        >
            {/* App-Standard Dark Blur Backdrop (100% matched with CustomerProfileDrawer) */}
            <div
                onClick={onClose}
                className="fixed inset-0 transition-opacity duration-200"
                style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                }}
            />

            {/* Main Modal Container */}
            <div
                onClick={(e) => e.stopPropagation()}
                className={`relative w-full bg-white rounded-[22px] border border-slate-200 shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
                    isPreview ? 'max-w-[1080px] h-[88vh]' : 'max-w-[820px] max-h-[90vh]'
                }`}
            >
                {/* Top Brand Accent Line */}
                <div className="h-1 w-full bg-gradient-to-r from-[#BD1D2D] via-rose-500 to-[#BD1D2D] shrink-0" />

                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-[12px] bg-rose-50 border border-rose-200/80 flex items-center justify-center shrink-0">
                            <Sparkles className="w-5 h-5 text-[#BD1D2D]" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-[16px] font-bold text-slate-900 tracking-tight leading-tight">
                                    {isPreview ? 'Xem trước & Tinh chỉnh Mẫu Email AI' : 'Trợ lý Thiết kế Email AI (SI IDEAS)'}
                                </h2>
                                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-full bg-rose-50 text-[#BD1D2D] border border-rose-200">
                                    AI Studio
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                {step === 'generating'
                                    ? loadingDesc
                                    : isPreview
                                        ? 'Kiểm tra hiển thị Desktop / Mobile hoặc yêu cầu AI tinh chỉnh thêm trước khi áp dụng'
                                        : 'Khởi tạo bố cục Email Marketing chuẩn quốc tế chỉ trong vài giây'}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-[10px] bg-slate-100 hover:bg-slate-200/80 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors outline-none focus:outline-none cursor-pointer"
                        title="Đóng"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* ══ STEP 1: PROMPT & CONFIGURATION ═══════════════════════════════════════ */}
                {step === 'prompt' && (
                    <>
                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 custom-scrollbar">
                            {error && (
                                <div className="flex items-start gap-2.5 p-3.5 rounded-[14px] bg-rose-50 border border-rose-200 text-rose-700">
                                    <AlertCircle className="w-4 h-4 text-[#BD1D2D] shrink-0 mt-0.5" />
                                    <p className="text-xs font-semibold leading-relaxed">{error}</p>
                                </div>
                            )}

                            {/* Mode Switcher if Editor already has blocks */}
                            {hasExistingBlocks && (
                                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 border border-slate-200/80 rounded-[14px]">
                                    <button
                                        type="button"
                                        onClick={() => setMode('redesign')}
                                        className={`h-9 rounded-[10px] text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer outline-none focus:outline-none ${
                                            mode === 'redesign'
                                                ? 'bg-[#BD1D2D] text-white shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                                        }`}
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        <span>Làm đẹp & Thiết kế lại mẫu hiện tại</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setMode('generate')}
                                        className={`h-9 rounded-[10px] text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer outline-none focus:outline-none ${
                                            mode === 'generate'
                                                ? 'bg-[#BD1D2D] text-white shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                                        }`}
                                    >
                                        <Sparkles className="w-3.5 h-3.5" />
                                        <span>Tạo mẫu Email hoàn toàn mới</span>
                                    </button>
                                </div>
                            )}

                            {mode === 'redesign' ? (
                                /* ── REDESIGN MODE ── */
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setImproveContent(true)}
                                            className={`p-4 rounded-[14px] border text-left transition-all cursor-pointer outline-none focus:outline-none ${
                                                improveContent
                                                    ? 'bg-rose-50/70 border-[#BD1D2D] ring-2 ring-[#BD1D2D]/10'
                                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs font-bold text-slate-900">Nâng cấp cả Bố cục & Văn bản</span>
                                                <div className={`w-4 h-4 rounded-full flex items-center justify-center ${improveContent ? 'bg-[#BD1D2D] text-white' : 'border border-slate-300'}`}>
                                                    {improveContent && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                                </div>
                                            </div>
                                            <p className="text-[11px] text-slate-500 leading-relaxed">
                                                AI sẽ biên tập lại câu chữ súc tích, chuyên nghiệp hơn và thiết kế lại toàn bộ bố cục.
                                            </p>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setImproveContent(false)}
                                            className={`p-4 rounded-[14px] border text-left transition-all cursor-pointer outline-none focus:outline-none ${
                                                !improveContent
                                                    ? 'bg-rose-50/70 border-[#BD1D2D] ring-2 ring-[#BD1D2D]/10'
                                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs font-bold text-slate-900">Giữ nguyên Văn bản, chỉ đổi Layout</span>
                                                <div className={`w-4 h-4 rounded-full flex items-center justify-center ${!improveContent ? 'bg-[#BD1D2D] text-white' : 'border border-slate-300'}`}>
                                                    {!improveContent && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                                </div>
                                            </div>
                                            <p className="text-[11px] text-slate-500 leading-relaxed">
                                                Bảo toàn nội dung gốc, chỉ chuẩn hóa khoảng cách, cỡ chữ, màu sắc và nút bấm CTA.
                                            </p>
                                        </button>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Yêu cầu tùy chỉnh thêm (Không bắt buộc)
                                        </label>
                                        <textarea
                                            value={prompt}
                                            onChange={e => setPrompt(e.target.value)}
                                            placeholder="VD: Đổi sang tông màu Đỏ IDEAS sang trọng, thêm khối Khảo sát nhanh ở cuối, làm nổi bật nút Đăng ký..."
                                            rows={3}
                                            className="w-full rounded-[14px] border border-slate-300 bg-slate-50/60 focus:bg-white px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#BD1D2D] transition-colors resize-none"
                                        />
                                    </div>
                                </div>
                            ) : (
                                /* ── GENERATE NEW EMAIL MODE ── */
                                <div className="space-y-4">
                                    {/* 1. Smart Prompt Presets */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                                <Wand2 className="w-3.5 h-3.5 text-[#BD1D2D]" />
                                                <span>Gợi ý kịch bản mẫu (1-Click)</span>
                                            </label>
                                            <span className="text-[11px] text-slate-400 font-medium">Bấm để điền nhanh nội dung chuẩn</span>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {SMART_PRESETS.map(preset => {
                                                const isActive = prompt === preset.prompt;
                                                return (
                                                    <button
                                                        key={preset.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setPrompt(preset.prompt);
                                                            setIncludeBlocks(preset.blocks);
                                                            setTone(preset.tone);
                                                        }}
                                                        className={`px-3 py-2 rounded-[11px] border text-left text-xs font-semibold transition-all cursor-pointer outline-none focus:outline-none truncate ${
                                                            isActive
                                                                ? 'bg-rose-50 border-[#BD1D2D] text-[#BD1D2D]'
                                                                : 'bg-slate-50/80 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300'
                                                        }`}
                                                        title={preset.prompt}
                                                    >
                                                        {preset.badge}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* 2. Main Prompt Textarea */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                                Nội dung & Mục tiêu Email cần tạo <span className="text-[#BD1D2D]">*</span>
                                            </label>
                                            <span className="text-[11px] text-slate-400">Nhấn Ctrl + Enter để tạo nhanh</span>
                                        </div>
                                        <textarea
                                            value={prompt}
                                            onChange={e => setPrompt(e.target.value)}
                                            placeholder="Mô tả nội dung email bạn muốn tạo. VD: Thiết kế email mời tham dự Hội thảo AI trong Quản trị Doanh nghiệp ngày 25/11 tại TP.HCM, có 3 diễn giả, lịch trình chi tiết và nút Đăng ký..."
                                            rows={3}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                                    handleGenerate(false);
                                                }
                                            }}
                                            className="w-full rounded-[14px] border border-slate-300 bg-slate-50/50 focus:bg-white px-3.5 py-2.5 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#BD1D2D] transition-colors resize-none leading-relaxed"
                                        />
                                    </div>

                                    {/* 3. Tone & Brand Color Row */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3.5 rounded-[14px] bg-slate-50/80 border border-slate-200/90">
                                        {/* Tone selector */}
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                                                <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                                                <span>Giọng văn (Tone of Voice)</span>
                                            </label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {TONE_OPTIONS.map(t => (
                                                    <button
                                                        key={t.id}
                                                        type="button"
                                                        onClick={() => setTone(t.id)}
                                                        className={`px-2.5 py-1.5 rounded-[8px] text-[11px] font-semibold border transition-all cursor-pointer outline-none focus:outline-none ${
                                                            tone === t.id
                                                                ? 'bg-[#BD1D2D] border-[#BD1D2D] text-white'
                                                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                                        }`}
                                                    >
                                                        {t.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Brand color selector */}
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                                                <Palette className="w-3.5 h-3.5 text-slate-500" />
                                                <span>Tông màu Chủ đạo</span>
                                            </label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {BRAND_COLORS.map(c => {
                                                    const active = brandColor === c.id;
                                                    return (
                                                        <button
                                                            key={c.id}
                                                            type="button"
                                                            onClick={() => setBrandColor(c.id)}
                                                            className={`px-2.5 py-1.5 rounded-[8px] text-[11px] font-semibold border inline-flex items-center gap-1.5 transition-all cursor-pointer outline-none focus:outline-none ${
                                                                active
                                                                    ? 'bg-slate-900 border-slate-900 text-white'
                                                                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                                                            }`}
                                                        >
                                                            {c.hex && (
                                                                <span
                                                                    className="w-3 h-3 rounded-full border border-white/40 shrink-0"
                                                                    style={{ backgroundColor: c.hex }}
                                                                />
                                                            )}
                                                            <span>{c.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 4. Component Blocks to Include */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                                            Khối thành phần muốn đưa vào Email (Tùy chọn)
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {COMPONENT_TOGGLES.map(item => {
                                                const Icon = item.icon;
                                                const selected = includeBlocks.includes(item.id);
                                                return (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        onClick={() => handleToggleComponentBlock(item.id)}
                                                        className={`h-8 px-3 rounded-[10px] border text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer outline-none focus:outline-none ${
                                                            selected
                                                                ? 'bg-rose-50 border-[#BD1D2D] text-[#BD1D2D]'
                                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <Icon className="w-3.5 h-3.5 shrink-0" />
                                                        <span>{item.label}</span>
                                                        {selected && <Check className="w-3 h-3 stroke-[2.5] ml-0.5" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* 5. Reference Templates Picker (.webp Thumbnails — 0 Iframes!) */}
                                    {templates.length > 0 && (
                                        <div className="border border-slate-200 rounded-[16px] p-3.5 bg-slate-50/60">
                                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                                                <div>
                                                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                                                        Học theo phong cách mẫu có sẵn (Tối đa 3 mẫu)
                                                    </label>
                                                    <p className="text-[11px] text-slate-500">
                                                        AI sẽ kế thừa bố cục Header, Font chữ, Màu sắc và Footer từ mẫu bạn chọn
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="relative">
                                                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                                        <input
                                                            type="text"
                                                            value={refSearch}
                                                            onChange={e => setRefSearch(e.target.value)}
                                                            placeholder="Tìm mẫu tham khảo..."
                                                            data-no-autofocus="true"
                                                            className="h-8 pl-8 pr-3 text-xs rounded-[9px] border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#BD1D2D] w-44"
                                                        />
                                                    </div>
                                                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                                        selectedTemplateIds.length > 0
                                                            ? 'bg-[#BD1D2D] text-white'
                                                            : 'bg-slate-200/80 text-slate-600'
                                                    }`}>
                                                        Đã chọn {selectedTemplateIds.length}/3
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[195px] overflow-y-auto pr-1 custom-scrollbar">
                                                {filteredTemplates.map((t) => {
                                                    const isSelected = selectedTemplateIds.includes(t.id);
                                                    const isDisabled = !isSelected && selectedTemplateIds.length >= 3;
                                                    const thumb = getThumbnailUrl(t);
                                                    return (
                                                        <div
                                                            key={t.id}
                                                            onClick={() => {
                                                                if (!isDisabled) handleToggleTemplateSelection(t.id);
                                                            }}
                                                            className={`group relative rounded-[12px] overflow-hidden border-2 aspect-[16/10] bg-white transition-all ${
                                                                isSelected
                                                                    ? 'border-[#BD1D2D] ring-2 ring-[#BD1D2D]/15'
                                                                    : 'border-slate-200 hover:border-slate-300'
                                                            } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                        >
                                                            {thumb ? (
                                                                <img
                                                                    src={thumb}
                                                                    alt={t.name}
                                                                    loading="lazy"
                                                                    className="w-full h-full object-cover object-top"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full bg-slate-100 flex items-center justify-center p-3 text-center">
                                                                    <span className="text-[11px] font-semibold text-slate-500 line-clamp-2">{t.name}</span>
                                                                </div>
                                                            )}

                                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/90 via-slate-900/50 to-transparent p-2 pt-5">
                                                                <p className="text-[11px] font-semibold text-white truncate leading-tight">
                                                                    {t.name}
                                                                </p>
                                                            </div>

                                                            {/* Quick Eye Preview Button */}
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handlePreviewReferenceTemplate(t);
                                                                }}
                                                                title="Xem trước mẫu này"
                                                                className="absolute top-2 left-2 w-6 h-6 rounded-[7px] bg-slate-900/65 hover:bg-slate-900 text-white flex items-center justify-center transition-colors outline-none focus:outline-none cursor-pointer"
                                                            >
                                                                <Eye className="w-3.5 h-3.5" />
                                                            </button>

                                                            {/* Selection Check Badge */}
                                                            <div
                                                                className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                                                                    isSelected
                                                                        ? 'bg-[#BD1D2D] text-white'
                                                                        : 'bg-white/90 border border-slate-300 text-transparent'
                                                                }`}
                                                            >
                                                                <Check className="w-3 h-3 stroke-[3]" />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* 6. Optional Images Section */}
                                    <div className="border border-slate-200 rounded-[14px] p-3.5 bg-white">
                                        <div className="flex items-center justify-between mb-2">
                                            <div>
                                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                                                    Hình ảnh đính kèm vào Email (Tùy chọn)
                                                </label>
                                                <p className="text-[11px] text-slate-400">Chèn ảnh Banner hoặc sản phẩm từ Thư viện / URL</p>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowLibrary(true)}
                                                    className="h-7 px-2.5 rounded-[8px] border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer outline-none focus:outline-none"
                                                >
                                                    <Library className="w-3 h-3 text-[#BD1D2D]" />
                                                    <span>Thư viện ảnh</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowUrlInput(!showUrlInput)}
                                                    className="h-7 px-2.5 rounded-[8px] border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer outline-none focus:outline-none"
                                                >
                                                    <Link2 className="w-3 h-3" />
                                                    <span>Dán URL</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="h-7 px-2.5 rounded-[8px] border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer outline-none focus:outline-none"
                                                >
                                                    <Upload className="w-3 h-3" />
                                                    <span>Tải lên</span>
                                                </button>
                                            </div>
                                        </div>

                                        {showUrlInput && (
                                            <div className="flex gap-2 mb-2.5">
                                                <input
                                                    type="url"
                                                    value={urlInput}
                                                    onChange={e => setUrlInput(e.target.value)}
                                                    placeholder="https://example.com/banner.jpg"
                                                    onKeyDown={e => { if (e.key === 'Enter') handleAddUrl(); }}
                                                    className="flex-1 h-8 px-3 rounded-[9px] border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-[#BD1D2D]"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleAddUrl}
                                                    className="h-8 px-3 rounded-[9px] bg-[#BD1D2D] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Plus className="w-3.5 h-3.5" /> Thêm
                                                </button>
                                            </div>
                                        )}

                                        {images.length > 0 && (
                                            <div className="grid grid-cols-6 gap-2 mt-2">
                                                {images.map(img => (
                                                    <div key={img.id} className="group relative aspect-square rounded-[9px] overflow-hidden border border-slate-200">
                                                        <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                                                        <button
                                                            type="button"
                                                            onClick={() => setImages(prev => prev.filter(i => i.id !== img.id))}
                                                            className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                                                        >
                                                            <Trash2 className="w-4 h-4 text-white" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={handleFileUpload}
                                            className="hidden"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                            <button
                                type="button"
                                onClick={onClose}
                                className="h-9 px-4 rounded-[11px] border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-600 transition-colors cursor-pointer outline-none focus:outline-none"
                            >
                                Hủy bỏ
                            </button>

                            <button
                                type="button"
                                onClick={() => handleGenerate(mode === 'redesign')}
                                disabled={mode === 'generate' && !prompt.trim()}
                                className={`h-10 px-6 rounded-[12px] text-xs font-bold inline-flex items-center gap-2 transition-all outline-none focus:outline-none ${
                                    mode === 'redesign' || prompt.trim()
                                        ? 'bg-[#BD1D2D] hover:bg-[#a61927] text-white shadow-sm cursor-pointer'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                            >
                                <Sparkles className="w-4 h-4" />
                                <span>{mode === 'redesign' ? 'Bắt đầu Thiết kế lại bằng AI' : 'Khởi tạo Mẫu Email với AI'}</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </>
                )}

                {/* ══ STEP 2: GENERATING STATE ════════════════════════════════════════════ */}
                {step === 'generating' && (
                    <div className="px-8 py-16 flex flex-col items-center justify-center text-center gap-5">
                        <div className="relative w-20 h-20 flex items-center justify-center">
                            <div className="absolute inset-0 rounded-full border-2 border-rose-100 animate-ping opacity-40" />
                            <div className="w-16 h-16 rounded-[18px] bg-rose-50 border border-rose-200 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 text-[#BD1D2D] animate-spin" />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-base font-bold text-slate-900">{loadingTitle}</h3>
                            <p className="text-xs text-slate-500 mt-1 max-w-md">{loadingDesc}</p>
                        </div>

                        <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                            {[
                                '1. Phân tích ngữ cảnh & thương hiệu',
                                '2. Dựng cấu trúc Section & CTA',
                                '3. Tối ưu tương thích Gmail / Outlook',
                            ].map(label => (
                                <span
                                    key={label}
                                    className="px-3 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200"
                                >
                                    {label}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* ══ STEP 3: PREVIEW & QUICK REFINE ══════════════════════════════════════ */}
                {step === 'preview' && generatedBlocks && (
                    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                        {/* Left Control Sidebar */}
                        <div className="w-full md:w-[270px] shrink-0 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50/70 p-4 flex flex-col gap-3.5 overflow-y-auto custom-scrollbar">
                            <div className="p-3 rounded-[12px] bg-emerald-50 border border-emerald-200 flex items-start gap-2.5">
                                <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-emerald-900">Đã thiết kế hoàn tất!</p>
                                    <p className="text-[11px] text-emerald-700 mt-0.5">
                                        Gồm {generatedBlocks.length} phân đoạn (Sections) chuẩn hiển thị.
                                    </p>
                                </div>
                            </div>

                            {/* 1-Click Quick Refinements */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Tinh chỉnh nhanh (1-Click)
                                </label>
                                <div className="flex flex-col gap-1.5">
                                    {QUICK_REFINES.map(chip => (
                                        <button
                                            key={chip}
                                            type="button"
                                            onClick={() => {
                                                setPrompt(chip);
                                                handleGenerate(true, chip);
                                            }}
                                            className="px-2.5 py-1.5 rounded-[9px] border border-slate-200 bg-white hover:border-[#BD1D2D] hover:text-[#BD1D2D] text-left text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer outline-none focus:outline-none"
                                        >
                                            ✨ {chip}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Custom Refine Input */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Hoặc nhập yêu cầu chỉnh sửa
                                </label>
                                <textarea
                                    value={prompt}
                                    onChange={e => setPrompt(e.target.value)}
                                    placeholder="Nhập thay đổi bạn muốn..."
                                    rows={3}
                                    className="w-full rounded-[10px] border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#BD1D2D] resize-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleGenerate(true)}
                                    className="mt-2 w-full h-9 rounded-[10px] bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer outline-none focus:outline-none"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    <span>Tạo lại theo yêu cầu</span>
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={() => setStep('prompt')}
                                className="h-8 rounded-[10px] border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-600 flex items-center justify-center gap-1 transition-colors cursor-pointer outline-none focus:outline-none"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                                <span>Quay lại cấu hình</span>
                            </button>

                            {/* Section Structure */}
                            <div className="pt-2 border-t border-slate-200">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Cấu trúc các khối ({generatedBlocks.length})
                                </p>
                                <div className="space-y-1">
                                    {generatedBlocks.map((b, i) => (
                                        <div
                                            key={b.id || i}
                                            className="flex items-center justify-between px-2.5 py-1.5 rounded-[8px] bg-white border border-slate-200/80 text-xs"
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                <span className="w-4 h-4 rounded bg-rose-50 text-[#BD1D2D] text-[10px] font-bold flex items-center justify-center shrink-0">
                                                    {i + 1}
                                                </span>
                                                <span className="text-[11px] font-semibold text-slate-700 capitalize truncate">
                                                    {b.type}
                                                </span>
                                            </div>
                                            {onSaveSection && (
                                                <button
                                                    type="button"
                                                    onClick={() => onSaveSection(b)}
                                                    title="Lưu Section này vào thư viện"
                                                    className="text-slate-400 hover:text-[#BD1D2D] p-0.5 cursor-pointer"
                                                >
                                                    <Library className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right Live Preview Canvas */}
                        <div className="flex-1 flex flex-col overflow-hidden bg-slate-100">
                            {/* Preview Toolbar */}
                            <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
                                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-[10px] border border-slate-200/70">
                                    <button
                                        type="button"
                                        onClick={() => setPreviewTab('new')}
                                        className={`h-7 px-3 rounded-[7px] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer outline-none focus:outline-none ${
                                            previewTab === 'new'
                                                ? 'bg-[#BD1D2D] text-white'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        <Sparkles className="w-3 h-3" />
                                        <span>Phiên bản AI mới</span>
                                    </button>
                                    {oldHtml && (
                                        <button
                                            type="button"
                                            onClick={() => setPreviewTab('old')}
                                            className={`h-7 px-3 rounded-[7px] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer outline-none focus:outline-none ${
                                                previewTab === 'old'
                                                    ? 'bg-slate-800 text-white'
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            <Eye className="w-3 h-3" />
                                            <span>Phiên bản trước</span>
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-[10px] border border-slate-200/70">
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('desktop')}
                                        className={`h-7 px-2.5 rounded-[7px] text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer outline-none focus:outline-none ${
                                            viewMode === 'desktop' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                                        }`}
                                        title="Xem giao diện Máy tính"
                                    >
                                        <Monitor className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Desktop</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('mobile')}
                                        className={`h-7 px-2.5 rounded-[7px] text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer outline-none focus:outline-none ${
                                            viewMode === 'mobile' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                                        }`}
                                        title="Xem giao diện Điện thoại"
                                    >
                                        <Smartphone className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Mobile</span>
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleApply}
                                    className="h-9 px-5 rounded-[11px] bg-[#BD1D2D] hover:bg-[#a61927] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer outline-none focus:outline-none ml-auto"
                                >
                                    <Check className="w-4 h-4 stroke-[2.5]" />
                                    <span>Áp dụng vào Trình thiết kế</span>
                                </button>
                            </div>

                            {/* Preview Iframe Container */}
                            <div className="flex-1 overflow-y-auto p-5 flex justify-center items-start custom-scrollbar">
                                <div
                                    className="bg-white rounded-[16px] border border-slate-200/90 shadow-sm overflow-hidden transition-all duration-200"
                                    style={{
                                        width: viewMode === 'mobile' ? '375px' : '100%',
                                        maxWidth: '640px',
                                    }}
                                >
                                    {previewTab === 'new' ? (
                                        <iframe
                                            ref={iframeNewRef}
                                            srcDoc={previewHtml}
                                            title="Preview Email AI"
                                            className="w-full border-0 min-h-[500px] block"
                                            sandbox="allow-same-origin"
                                            onLoad={() => {
                                                const f = iframeNewRef.current;
                                                if (f?.contentDocument) {
                                                    f.style.height = Math.max(500, f.contentDocument.documentElement.scrollHeight) + 'px';
                                                }
                                            }}
                                        />
                                    ) : (
                                        <iframe
                                            ref={iframeOldRef}
                                            srcDoc={oldHtml}
                                            title="Preview Email Gốc"
                                            className="w-full border-0 min-h-[500px] block"
                                            sandbox="allow-same-origin"
                                            onLoad={() => {
                                                const f = iframeOldRef.current;
                                                if (f?.contentDocument) {
                                                    f.style.height = Math.max(500, f.contentDocument.documentElement.scrollHeight) + 'px';
                                                }
                                            }}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Image Library Modal */}
            <ImageLibraryModal
                isOpen={showLibrary}
                onClose={() => setShowLibrary(false)}
                onSelect={(url) => {
                    setImages(prev => [...prev, {
                        id: crypto.randomUUID(),
                        url,
                        name: url.split('/').pop() || 'Image',
                        source: 'url'
                    }]);
                    setShowLibrary(false);
                }}
            />

            {/* Reference Template Live Preview Dialog */}
            {previewingTemplate && (
                <div
                    className="fixed inset-0 flex items-center justify-center p-4"
                    style={{ zIndex: 2147483647 }}
                >
                    <div
                        onClick={() => setPreviewingTemplate(null)}
                        className="fixed inset-0"
                        style={{
                            backgroundColor: 'rgba(0, 0, 0, 0.6)',
                            backdropFilter: 'blur(6px)',
                            WebkitBackdropFilter: 'blur(6px)',
                        }}
                    />
                    <div
                        onClick={e => e.stopPropagation()}
                        className="relative w-full max-w-[680px] h-[82vh] bg-white rounded-[20px] border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
                    >
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-white shrink-0">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">
                                    Xem trước mẫu tham khảo: {previewingTemplate.name}
                                </h3>
                                <p className="text-[11px] text-slate-500">
                                    Mẫu thiết kế tham khảo cấu trúc cho AI
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleToggleTemplateSelection(previewingTemplate.id);
                                        setPreviewingTemplate(null);
                                    }}
                                    className="h-8 px-3 rounded-[9px] bg-[#BD1D2D] text-white text-xs font-bold cursor-pointer"
                                >
                                    {selectedTemplateIds.includes(previewingTemplate.id) ? 'Bỏ chọn mẫu này' : 'Chọn làm mẫu tham khảo'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPreviewingTemplate(null)}
                                    className="w-8 h-8 rounded-[9px] bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 bg-slate-100 relative overflow-y-auto">
                            {loadingPreviewTpl ? (
                                <div className="p-6 space-y-4">
                                    <div className="h-44 rounded-[14px] bg-slate-200/80 animate-pulse" />
                                    <div className="h-6 w-2/3 rounded bg-slate-200/80 animate-pulse" />
                                    <div className="h-24 rounded-[14px] bg-slate-200/80 animate-pulse" />
                                </div>
                            ) : referencePreviewHtml ? (
                                <iframe
                                    title="Reference Template Preview"
                                    srcDoc={referencePreviewHtml}
                                    className="w-full h-full border-0 bg-white"
                                />
                            ) : getThumbnailUrl(previewingTemplate) ? (
                                <img
                                    src={getThumbnailUrl(previewingTemplate)}
                                    alt={previewingTemplate.name}
                                    className="w-full h-auto object-contain"
                                />
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    return typeof document !== 'undefined' ? createPortal(modalNode, getMktPortalRoot()) : modalNode;
};

export default AIEmailGeneratorModal;
