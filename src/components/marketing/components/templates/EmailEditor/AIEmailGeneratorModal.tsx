// components/templates/EmailEditor/AIEmailGeneratorModal.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Sparkles, X, RefreshCw, Check, ChevronLeft,
    Wand2, AlertCircle, Monitor, Smartphone,
    Upload, ImagePlus, Trash2, Link2, Plus, ArrowRight,
    Library, RotateCcw, ToggleLeft, ToggleRight, Eye
} from 'lucide-react';
import { EmailBlock, EmailBodyStyle } from '../../../types';
import { compileHTML } from './utils/htmlCompiler';
import { DEFAULT_BODY_STYLE } from './constants/editorConstants';
import ImageLibraryModal from './components/Properties/ImageLibraryModal';
import { api } from '../../../services/storageAdapter';

interface AIEmailGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (blocks: EmailBlock[]) => void;
    onSaveSection?: (block: EmailBlock) => void;
    currentBlocks?: EmailBlock[];
    bodyStyle?: EmailBodyStyle;
    templateName?: string;
    emailId?: string | number;  // reset state khi đổi email
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

/* ─── keyframes ────────────────────────────────────────────────────────── */
const MODAL_STYLES = `
@keyframes modalIn {
    0%   { opacity: 0; transform: scale(0.88) translateY(24px); }
    60%  { opacity: 1; transform: scale(1.02) translateY(-3px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes backdropIn {
    from { opacity: 0; }
    to   { opacity: 1; }
}
@keyframes slideUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
}
@keyframes shimmerBar {
    0%   { background-position: -600px 0; }
    100% { background-position: 600px 0; }
}
@keyframes spin2    { to { transform: rotate(360deg); } }
@keyframes spin2rev { to { transform: rotate(-360deg); } }
@keyframes pulseRing {
    0%, 100% { transform: scale(1);    opacity: 0.5; }
    50%       { transform: scale(1.2);  opacity: 0; }
}
@keyframes dotBounce {
    0%, 80%, 100% { transform: scaleY(0.4); opacity: 0.3; }
    40%            { transform: scaleY(1.2); opacity: 1; }
}
@keyframes fadeTabIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
}
`;

const S = {
    btn: (active: boolean): React.CSSProperties => ({
        flex: 1, padding: '8px 12px', border: 'none', borderRadius: '10px',
        fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
        background: active ? 'linear-gradient(135deg, #8b5cf6, #2563eb)' : 'transparent',
        color: active ? '#fff' : '#94a3b8',
        boxShadow: active ? '0 2px 8px rgba(104,61,242,0.3)' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
    }),
};

const findFirstImageUrl = (blocks: any[]): string | null => {
    if (!blocks || !Array.isArray(blocks)) return null;
    for (const b of blocks) {
        if (b.type === 'image' && b.url && b.url.trim() !== '') {
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
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('data:')) {
        return trimmed;
    }
    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }
    if (trimmed.startsWith('//')) {
        return `https:${trimmed}`;
    }
    // Specially handle cPanel paths like uploadss/
    if (trimmed.includes('uploadss/')) {
        const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
        try {
            const origin = new URL(api.baseUrl).origin;
            return `${origin}${cleanPath}`;
        } catch {
            return `https://automation.ideas.edu.vn${cleanPath}`;
        }
    }
    if (trimmed.startsWith('/')) {
        try {
            const origin = new URL(api.baseUrl).origin;
            return `${origin}${trimmed}`;
        } catch {
            return `https://automation.ideas.edu.vn${trimmed}`;
        }
    }
    if (/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/i.test(trimmed)) {
        return `https://${trimmed}`;
    }
    try {
        const base = api.baseUrl.replace(/\/+$/, '');
        return `${base}/${trimmed}`;
    } catch {
        return `https://automation.ideas.edu.vn/${trimmed}`;
    }
};

const getThumbnailUrl = (t: any, index: number) => {
    let rawUrl = '';
    if (t.thumbnail && t.thumbnail.trim() !== '' && !t.thumbnail.includes('placehold.co')) {
        rawUrl = t.thumbnail;
    } else if (t.blocks && Array.isArray(t.blocks)) {
        const firstImg = findFirstImageUrl(t.blocks);
        if (firstImg) rawUrl = firstImg;
    }

    if (rawUrl) {
        return ensureAbsoluteUrl(rawUrl);
    }

    const defaults = [
        'https://images.unsplash.com/photo-1557200134-90327ee9fafa?w=500&h=300&fit=crop',
        'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?w=500&h=300&fit=crop',
        'https://images.unsplash.com/photo-1504711331083-9c895941bf81?w=500&h=300&fit=crop',
        'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=500&h=300&fit=crop'
    ];
    return defaults[index % defaults.length];
};

const VisualTemplate: React.FC<{ template: any; bodyStyle: any }> = ({ template, bodyStyle }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0.25);

    const html = template.htmlContent || (template.blocks ? compileHTML(template.blocks, bodyStyle || template.bodyStyle || DEFAULT_BODY_STYLE, template.name) : '');

    useEffect(() => {
        const updateScale = () => {
            if (containerRef.current) {
                setScale(containerRef.current.offsetWidth / 800);
            }
        };
        updateScale();
        const timer = setTimeout(updateScale, 100);
        window.addEventListener('resize', updateScale);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updateScale);
        };
    }, []);

    return (
        <div ref={containerRef} style={{ width: '100%', height: '100%', backgroundColor: '#fff', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
            <div style={{
                position: 'absolute',
                top: 0,
                transformOrigin: 'top center',
                width: '800px',
                height: '1000px',
                transform: `scale(${scale})`,
                pointerEvents: 'none'
            }}>
                <iframe
                    srcDoc={html}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title="preview"
                    scrolling="no"
                />
            </div>
        </div>
    );
};

const AIEmailGeneratorModal: React.FC<AIEmailGeneratorModalProps> = ({
    isOpen, onClose, onApply, onSaveSection, currentBlocks, bodyStyle = DEFAULT_BODY_STYLE, templateName = 'Email', emailId
}) => {
    const [mode, setMode] = useState<Mode>('redesign');
    const [step, setStep] = useState<Step>('prompt');
    const [prompt, setPrompt] = useState('');
    const [improveContent, setImproveContent] = useState(false);
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
    const [visible, setVisible] = useState(false);
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
    const [previewingTemplate, setPreviewingTemplate] = useState<any | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const iframeNewRef = useRef<HTMLIFrameElement>(null);
    const iframeOldRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => setVisible(true), 10);
            // Compile old HTML on open if redesign blocks exist
            if (currentBlocks && currentBlocks.length > 0) {
                setMode('redesign');
                setOldHtml(compileHTML(currentBlocks, bodyStyle, templateName));
            } else {
                setMode('generate');
            }

            // Fetch templates for reference
            const fetchTemplates = async () => {
                try {
                    const res = await api.get('templates');
                    if (res.success && Array.isArray(res.data)) {
                        const editorTpls = res.data.filter((t: any) => t.blocks && Array.isArray(t.blocks) && t.blocks.length > 0);
                        setTemplates(editorTpls);
                    }
                } catch (err) {
                    console.error('Failed to fetch templates for AI reference:', err);
                }
            };
            fetchTemplates();
        } else {
            setVisible(false);
        }
    }, [isOpen]);

    const handleToggleTemplateSelection = (id: string) => {
        setSelectedTemplateIds(prev => {
            if (prev.includes(id)) {
                return prev.filter(tId => tId !== id);
            }
            if (prev.length >= 3) {
                return prev;
            }
            return [...prev, id];
        });
    };

    const reset = useCallback(() => {
        setStep('prompt'); setGeneratedBlocks(null);
        setPreviewHtml(''); setError(''); setPreviewTab('new');
    }, []);

    // Reset khi chuyển sang email khác (emailId thay đổi)
    const prevEmailIdRef = useRef<string | number | undefined>(undefined);
    useEffect(() => {
        if (emailId !== undefined && prevEmailIdRef.current !== undefined && emailId !== prevEmailIdRef.current) {
            reset();
        }
        prevEmailIdRef.current = emailId;
    }, [emailId]);

    const handleClose = () => {
        setVisible(false);
        setTimeout(() => { onClose(); }, 280);
        // State được giữ nguyên — mở lại sẽ thấy đúng Trạng thái cũ
    };

    /* ── image handlers ──────────────────────────────────────────────────── */
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        Array.from(e.target.files || []).forEach(file => {
            const reader = new FileReader();
            reader.onload = ev => setImages(prev => [...prev, {
                id: crypto.randomUUID(), url: ev.target?.result as string,
                name: file.name, source: 'upload'
            }]);
            reader.readAsDataURL(file);
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleAddUrl = () => {
        if (!urlInput.trim()) return;
        setImages(prev => [...prev, {
            id: crypto.randomUUID(), url: urlInput.trim(),
            name: urlInput.trim().split('/').pop() || 'Image', source: 'url'
        }]);
        setUrlInput(''); setShowUrlInput(false);
    };

    /* ── generate ─────────────────────────────────────────────────────────── */
    const handleGenerate = async (useExisting = false) => {
        if (!prompt.trim() && mode === 'generate') return;
        setStep('generating'); setError('');
        try {
            let fullPrompt = prompt.trim();
            const urlImages = images.filter(i => i.source === 'url');
            if (urlImages.length) {
                fullPrompt += `\n\nDanh sách ảnh sử dụng:\n${urlImages.map((u, i) => `${i + 1}. ${u.url}`).join('\n')}`;
                fullPrompt += '\nĐặt các ảnh này vào block image phù hợp.';
            }
            const payload: any = {
                prompt: fullPrompt || 'Redesign email hiện tại đẹp hơn, chuyên nghiệp hơn.',
                improve_content: improveContent,
            };
            if (selectedTemplateIds.length > 0) {
                payload.reference_template_ids = selectedTemplateIds;
            }
            if (useExisting && currentBlocks?.length) {
                payload.existing_blocks = currentBlocks;
                payload.body_style = bodyStyle;
            }
            const data = await api.post('ai_email_generator', payload);
            if (data.success && Array.isArray(data.data)) {
                setGeneratedBlocks(data.data);
                setPreviewHtml(compileHTML(data.data, bodyStyle, templateName));
                setPreviewTab('new');
                setStep('preview');
            } else {
                setError(data.message || 'AI không thể tạo email. Thử lại với prompt rõ hơn!');
                setStep('prompt');
            }
        } catch {
            setError('Lỗi kết nối server. Vui lòng thử lại.');
            setStep('prompt');
        }
    };

    const handleApply = () => {
        if (generatedBlocks) { onApply(generatedBlocks); handleClose(); }
    };

    if (!isOpen) return null;

    const isPreview = step === 'preview';
    const isDesigning = mode === 'redesign';

    /* ── loading text ─────────────────────────────────────────────────────── */
    const loadingTitle = isDesigning ? 'AI đang thiết kế lại email' : 'AI đang thiết kế email mới';
    const loadingDesc = isDesigning
        ? (improveContent ? 'Phân tích & cải thiện nội dung, áp dụng layout mới...' : 'Giữ nguyên nội dung, làm đẹp layout & màu sắc...')
        : 'Phân tích yêu cầu và tạo layout thông minh...';

    return (
        <>
            <style>{MODAL_STYLES}</style>

            {/* Backdrop */}
            <div onClick={handleClose} style={{
                position: 'fixed', inset: 0, zIndex: 200000,
                background: 'rgba(15,23,42,0.5)',
                backdropFilter: 'blur(10px)',
                animation: 'backdropIn 0.25s ease forwards',
            }} />

            {/* Modal container */}
            <div style={{
                position: 'fixed', inset: 0, zIndex: 200001,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '16px', pointerEvents: 'none',
            }}>
                <div style={{
                    pointerEvents: 'all',
                    background: '#fff',
                    borderRadius: '28px',
                    boxShadow: '0 32px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden',
                    width: '100%',
                    maxWidth: isPreview ? '1000px' : '520px',
                    maxHeight: isPreview ? '90vh' : 'auto',
                    animation: visible ? 'modalIn 0.42s cubic-bezier(0.34,1.56,0.64,1) forwards' : 'none',
                    opacity: visible ? 1 : 0,
                }}>
                    {/* Shimmer top bar */}
                    <div style={{
                        height: '4px', flexShrink: 0,
                        background: 'linear-gradient(90deg, #8b5cf6, #2563eb, #8b5cf6, #2563eb)',
                        backgroundSize: '600px 100%',
                        animation: 'shimmerBar 2.5s linear infinite',
                    }} />

                    {/* Header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '18px 24px 14px', borderBottom: '1px solid #f1f5f9', flexShrink: 0,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '38px', height: '38px', borderRadius: '12px',
                                background: 'linear-gradient(135deg, #f5f3ff, #ddd6fe)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                boxShadow: '0 4px 12px rgba(104,61,242,0.2)',
                            }}>
                                <Sparkles style={{ width: 18, height: 18, color: '#2563eb' }} />
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
                                    {isPreview ? 'Xem trước & So sánh' : 'AI Email Designer'}
                                </h2>
                                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
                                    {step === 'generating' ? loadingDesc : isPreview ? 'So sánh phiên bản cũ và mới trước khi áp dụng' : 'Mô tả email bạn muốn tạo'}
                                </p>
                            </div>
                        </div>
                        <button onClick={handleClose} style={{
                            width: '32px', height: '32px', border: 'none', borderRadius: '10px',
                            background: '#f8fafc', cursor: 'pointer', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                        }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                            onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}>
                            <X style={{ width: 15, height: 15, color: '#64748b' }} />
                        </button>
                    </div>

                    {/* ══ PROMPT STEP ════════════════════════════════════════ */}
                    {step === 'prompt' && (
                        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: '18px', animation: 'slideUp 0.3s ease', overflowY: 'auto' }}>

                            {error && (
                                <div style={{ display: 'flex', gap: '10px', padding: '12px 14px', background: '#fff1f2', borderRadius: '12px', border: '1px solid #fecdd3' }}>
                                    <AlertCircle style={{ width: 15, height: 15, color: '#f43f5e', flexShrink: 0, marginTop: '1px' }} />
                                    <p style={{ margin: 0, fontSize: '12px', color: '#e11d48', fontWeight: 500 }}>{error}</p>
                                </div>
                            )}

                            {/* Mode tabs — only show if there are existing blocks */}
                            {currentBlocks && currentBlocks.length > 0 && (
                                <div style={{ display: 'flex', gap: '6px', padding: '4px', background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                                    <button style={S.btn(mode === 'redesign')} onClick={() => setMode('redesign')}>
                                        <RotateCcw style={{ width: 13, height: 13 }} /> Redesign hiện tại
                                    </button>
                                    <button style={S.btn(mode === 'generate')} onClick={() => setMode('generate')}>
                                        <Sparkles style={{ width: 13, height: 13 }} /> Tạo mới
                                    </button>
                                </div>
                            )}

                            {/* ── REDESIGN MODE ── */}
                            {mode === 'redesign' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                                    {/* Toggle: Cải thiện nội dung */}
                                    <button onClick={() => setImproveContent(!improveContent)}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '14px 16px', borderRadius: '14px', cursor: 'pointer', border: 'none',
                                            background: improveContent ? 'linear-gradient(135deg, #f5f3ff, #ede9fe)' : '#f8fafc',
                                            outline: `1.5px solid ${improveContent ? '#ddd6fe' : '#e2e8f0'}`,
                                            transition: 'all 0.2s',
                                        }}>
                                        <div style={{ textAlign: 'left' }}>
                                            <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: improveContent ? '#5b21b6' : '#374151' }}>
                                                Cải thiện nội dung
                                            </p>
                                            <p style={{ margin: '2px 0 0', fontSize: '11px', color: improveContent ? '#7c3aed' : '#94a3b8' }}>
                                                {improveContent ? 'AI sẽ viết lại nội dung hay hơn' : 'Giữ nguyên văn bản, chỉ đổi layout & màu sắc'}
                                            </p>
                                        </div>
                                        {improveContent
                                            ? <ToggleRight style={{ width: 28, height: 28, color: '#2563eb', flexShrink: 0 }} />
                                            : <ToggleLeft style={{ width: 28, height: 28, color: '#cbd5e1', flexShrink: 0 }} />
                                        }
                                    </button>

                                    {/* Optional prompt */}
                                    <div style={{ padding: '14px 16px', borderRadius: '14px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                        <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                            Gợi ý tùy chỉnh (không bắt buộc)
                                        </p>
                                        <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
                                            placeholder="VD: Làm màu trẻ trung hơn, thêm section đánh giá Khách hàng, dùng font sans-serif..."
                                            style={{
                                                width: '100%', height: '80px', border: '1.5px solid #e2e8f0',
                                                borderRadius: '10px', padding: '10px 12px', fontSize: '13px',
                                                resize: 'none', outline: 'none', background: '#fff',
                                                color: '#1e293b', fontFamily: 'inherit', boxSizing: 'border-box',
                                            }}
                                            onFocus={e => e.currentTarget.style.borderColor = '#8b5cf6'}
                                            onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                                        />
                                    </div>

                                    <button onClick={() => handleGenerate(true)} style={{
                                        height: '50px', border: 'none', borderRadius: '14px', cursor: 'pointer',
                                        background: 'linear-gradient(135deg, #8b5cf6, #2563eb)',
                                        color: '#fff', fontSize: '14px', fontWeight: 800, fontFamily: 'inherit',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        boxShadow: '0 8px 24px rgba(104,61,242,0.35)', transition: 'transform 0.15s',
                                    }}
                                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
                                        <Wand2 style={{ width: 18, height: 18 }} />
                                        Xác nhận — AI Redesign ngay
                                        <ArrowRight style={{ width: 16, height: 16 }} />
                                    </button>
                                </div>

                            ) : (
                                /* ── GENERATE MODE ── */
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                                            Mô tả email
                                        </label>
                                        <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
                                            placeholder="Mô tả chi tiết email bạn muốn. VD: Email flash sale 48h cho shop thời trang, màu đỏ rượu vang, có 3 sản phẩm bán chạy, CTA mua ngay..."
                                            rows={4}
                                            style={{
                                                width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '14px',
                                                padding: '12px 14px', fontSize: '13px', resize: 'none', outline: 'none',
                                                color: '#1e293b', fontFamily: 'inherit', lineHeight: 1.6,
                                                background: '#f8fafc', boxSizing: 'border-box', transition: 'border-color 0.2s',
                                            }}
                                            onFocus={e => e.currentTarget.style.borderColor = '#8b5cf6'}
                                            onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                                            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate(false); }}
                                        />
                                        <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#cbd5e1', textAlign: 'right' }}>Ctrl+Enter để Generate</p>
                                    </div>

                                    {/* Reference templates selection (1-3 templates) */}
                                    {templates.length > 0 && (
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <label style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                    Chọn mẫu thiết kế tham khảo (Chọn tối đa 3 mẫu)
                                                </label>
                                                <span style={{ fontSize: '10px', fontWeight: 700, color: selectedTemplateIds.length > 0 ? '#2563eb' : '#94a3b8' }}>
                                                    Đã chọn: {selectedTemplateIds.length}/3
                                                </span>
                                            </div>
                                            <div style={{ 
                                                display: 'grid', 
                                                gridTemplateColumns: 'repeat(2, 1fr)', 
                                                gap: '12px', 
                                                maxHeight: '230px', 
                                                overflowY: 'auto', 
                                                padding: '8px',
                                                border: '1.5px solid #e2e8f0', 
                                                borderRadius: '16px',
                                                background: '#f8fafc',
                                                boxSizing: 'border-box'
                                            }}>
                                                {templates.map((t, idx) => {
                                                    const isSelected = selectedTemplateIds.includes(t.id);
                                                    const isDisabled = !isSelected && selectedTemplateIds.length >= 3;
                                                    const thumb = getThumbnailUrl(t, idx);
                                                    return (
                                                        <div 
                                                            key={t.id}
                                                            style={{
                                                                position: 'relative',
                                                                borderRadius: '12px',
                                                                overflow: 'hidden',
                                                                border: `2px solid ${isSelected ? '#2563eb' : '#e2e8f0'}`,
                                                                boxShadow: isSelected ? '0 4px 12px rgba(104,61,242,0.15)' : 'none',
                                                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                                                opacity: isDisabled ? 0.6 : 1,
                                                                transition: 'all 0.25s ease',
                                                                aspectRatio: '16/10',
                                                                background: '#fff',
                                                            }}
                                                            onClick={() => {
                                                                if (!isDisabled) {
                                                                    handleToggleTemplateSelection(t.id);
                                                                }
                                                            }}
                                                        >
                                                            {/* Live Preview Email Template */}
                                                            <VisualTemplate template={t} bodyStyle={bodyStyle} />
                                                            
                                                            {/* Shadow Overlay */}
                                                            <div style={{
                                                                position: 'absolute',
                                                                inset: 0,
                                                                background: 'linear-gradient(to top, rgba(15,23,42,0.85) 0%, rgba(15,23,42,0.3) 60%, rgba(15,23,42,0) 100%)',
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                justifyContent: 'end',
                                                                padding: '8px 12px',
                                                                boxSizing: 'border-box',
                                                            }}>
                                                                <p style={{
                                                                    margin: 0,
                                                                    fontSize: '11px',
                                                                    fontWeight: 700,
                                                                    color: '#fff',
                                                                    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    display: '-webkit-box',
                                                                    WebkitLineClamp: 2,
                                                                    WebkitBoxOrient: 'vertical',
                                                                    lineHeight: '1.3',
                                                                }}>
                                                                    {t.name}
                                                                </p>
                                                            </div>

                                                            {/* Top Left: Preview Button */}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setPreviewingTemplate(t);
                                                                }}
                                                                title="Xem trước mẫu"
                                                                style={{
                                                                    position: 'absolute',
                                                                    top: '8px',
                                                                    left: '8px',
                                                                    width: '26px',
                                                                    height: '26px',
                                                                    borderRadius: '8px',
                                                                    border: 'none',
                                                                    background: 'rgba(15,23,42,0.6)',
                                                                    backdropFilter: 'blur(4px)',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    zIndex: 10,
                                                                }}
                                                            >
                                                                <Eye style={{ width: 13, height: 13, color: '#fff' }} />
                                                            </button>

                                                            {/* Top Right: Selection Badge */}
                                                            <div style={{
                                                                position: 'absolute',
                                                                top: '8px',
                                                                right: '8px',
                                                                width: '20px',
                                                                height: '20px',
                                                                borderRadius: '50%',
                                                                background: isSelected ? '#2563eb' : 'rgba(255,255,255,0.8)',
                                                                border: isSelected ? 'none' : '1px solid #cbd5e1',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                                                zIndex: 10,
                                                            }}>
                                                                {isSelected && <Check style={{ width: 11, height: 11, color: '#fff', strokeWidth: 3 }} />}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Images section */}
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <label style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                Hình ảnh sử dụng
                                            </label>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                {[
                                                    { icon: <Upload style={{ width: 11, height: 11 }} />, label: 'Tải lên', action: () => fileInputRef.current?.click(), amber: true },
                                                    { icon: <Library style={{ width: 11, height: 11 }} />, label: 'Thư viện', action: () => setShowLibrary(true), amber: false },
                                                    { icon: <Link2 style={{ width: 11, height: 11 }} />, label: 'URL', action: () => setShowUrlInput(!showUrlInput), amber: false },
                                                ].map(b => (
                                                    <button key={b.label} onClick={b.action} style={{
                                                        display: 'flex', alignItems: 'center', gap: '4px',
                                                        padding: '5px 9px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 700,
                                                        border: `1.5px solid ${b.amber ? '#ddd6fe' : '#e2e8f0'}`,
                                                        background: b.amber ? '#f5f3ff' : '#f8fafc',
                                                        color: b.amber ? '#2563eb' : '#64748b',
                                                        transition: 'all 0.15s',
                                                    }}
                                                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#ddd6fe'; e.currentTarget.style.background = '#f5f3ff'; e.currentTarget.style.color = '#2563eb'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.borderColor = b.amber ? '#ddd6fe' : '#e2e8f0'; e.currentTarget.style.background = b.amber ? '#f5f3ff' : '#f8fafc'; e.currentTarget.style.color = b.amber ? '#2563eb' : '#64748b'; }}>
                                                        {b.icon} {b.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {showUrlInput && (
                                            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', animation: 'slideUp 0.2s ease' }}>
                                                <input type="url" value={urlInput} onChange={e => setUrlInput(e.target.value)}
                                                    placeholder="https://example.com/banner.jpg"
                                                    autoFocus
                                                    style={{
                                                        flex: 1, border: '1.5px solid #e2e8f0', borderRadius: '10px',
                                                        padding: '8px 12px', fontSize: '12px', outline: 'none',
                                                        color: '#1e293b', fontFamily: 'inherit', background: '#f8fafc',
                                                    }}
                                                    onFocus={e => e.currentTarget.style.borderColor = '#8b5cf6'}
                                                    onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                                                    onKeyDown={e => { if (e.key === 'Enter') handleAddUrl(); }}
                                                />
                                                <button onClick={handleAddUrl} style={{
                                                    padding: '8px 14px', border: 'none', borderRadius: '10px',
                                                    background: 'linear-gradient(135deg, #8b5cf6, #2563eb)',
                                                    cursor: 'pointer', color: '#fff',
                                                }}>
                                                    <Plus style={{ width: 14, height: 14 }} />
                                                </button>
                                            </div>
                                        )}

                                        {images.length > 0 ? (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '8px' }}>
                                                {images.map(img => (
                                                    <div key={img.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: '10px', overflow: 'hidden', border: '1.5px solid #e2e8f0' }}
                                                        onMouseEnter={e => { const b = e.currentTarget.querySelector('button') as HTMLElement; if (b) b.style.opacity = '1'; }}
                                                        onMouseLeave={e => { const b = e.currentTarget.querySelector('button') as HTMLElement; if (b) b.style.opacity = '0'; }}>
                                                        <img src={img.url} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        <button onClick={() => setImages(prev => prev.filter(i => i.id !== img.id))}
                                                            style={{ position: 'absolute', inset: 0, border: 'none', background: 'rgba(15,23,42,0.55)', cursor: 'pointer', opacity: 0, transition: 'opacity 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <Trash2 style={{ width: 15, height: 15, color: '#fff' }} />
                                                        </button>
                                                    </div>
                                                ))}
                                                <button onClick={() => fileInputRef.current?.click()} style={{
                                                    aspectRatio: '1', border: '1.5px dashed #cbd5e1', borderRadius: '10px',
                                                    background: '#f8fafc', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                                                    alignItems: 'center', justifyContent: 'center', gap: '3px',
                                                }}
                                                    onMouseEnter={e => e.currentTarget.style.borderColor = '#8b5cf6'}
                                                    onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}>
                                                    <ImagePlus style={{ width: 15, height: 15, color: '#94a3b8' }} />
                                                    <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600 }}>Thêm</span>
                                                </button>
                                            </div>
                                        ) : (
                                            <button onClick={() => fileInputRef.current?.click()} style={{
                                                width: '100%', padding: '18px', border: '1.5px dashed #cbd5e1', borderRadius: '14px',
                                                background: '#f8fafc', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                                                alignItems: 'center', gap: '5px', boxSizing: 'border-box', transition: 'all 0.2s',
                                            }}
                                                onMouseEnter={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.background = '#f5f3ff'; }}
                                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#f8fafc'; }}>
                                                <ImagePlus style={{ width: 20, height: 20, color: '#cbd5e1' }} />
                                                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>Kéo thả hoặc click để chọn ảnh</span>
                                                <span style={{ fontSize: '10px', color: '#cbd5e1' }}>PNG, JPG, GIF, WebP</span>
                                            </button>
                                        )}
                                        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileUpload} style={{ display: 'none' }} />
                                    </div>

                                    <button onClick={() => handleGenerate(false)} disabled={!prompt.trim()} style={{
                                        height: '52px', border: 'none', borderRadius: '16px',
                                        cursor: prompt.trim() ? 'pointer' : 'not-allowed',
                                        background: prompt.trim() ? 'linear-gradient(135deg, #8b5cf6, #2563eb)' : '#f1f5f9',
                                        color: prompt.trim() ? '#fff' : '#94a3b8',
                                        fontSize: '14px', fontWeight: 800, fontFamily: 'inherit',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        boxShadow: prompt.trim() ? '0 8px 24px rgba(104,61,242,0.3)' : 'none',
                                        transition: 'all 0.2s',
                                    }}
                                        onMouseEnter={e => { if (prompt.trim()) e.currentTarget.style.transform = 'scale(1.02)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
                                        <Wand2 style={{ width: 18, height: 18 }} />
                                        Generate Email với AI
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ══ GENERATING STEP ════════════════════════════════════ */}
                    {step === 'generating' && (
                        <div style={{
                            padding: '48px 40px 52px', display: 'flex', flexDirection: 'column',
                            alignItems: 'center', gap: '24px', animation: 'slideUp 0.3s ease',
                        }}>
                            {/* Spinning rings */}
                            <div style={{ position: 'relative', width: '96px', height: '96px' }}>
                                <div style={{ position: 'absolute', inset: '-14px', borderRadius: '50%', border: '2px solid rgba(104,61,242,0.12)', animation: 'pulseRing 2s ease-in-out infinite' }} />
                                <div style={{ position: 'absolute', inset: '4px', borderRadius: '50%', border: '2.5px solid transparent', borderTopColor: '#2563eb', borderRightColor: 'rgba(139,92,246,0.25)', animation: 'spin2 1.1s linear infinite' }} />
                                <div style={{ position: 'absolute', inset: '15px', borderRadius: '50%', border: '2px solid transparent', borderBottomColor: '#2563eb', borderLeftColor: 'rgba(104,61,242,0.2)', animation: 'spin2rev 0.75s linear infinite' }} />
                                <div style={{ position: 'absolute', inset: '26px', borderRadius: '50%', background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(104,61,242,0.15)' }}>
                                    <Sparkles style={{ width: 17, height: 17, color: '#2563eb' }} />
                                </div>
                            </div>

                            <div style={{ textAlign: 'center' }}>
                                <p style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>{loadingTitle}</p>
                                <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>{loadingDesc}</p>
                            </div>

                            {/* Bouncing dots */}
                            <div style={{ display: 'flex', gap: '5px', alignItems: 'center', height: '20px' }}>
                                {[0, 1, 2, 3, 4].map(i => (
                                    <div key={i} style={{
                                        width: i === 2 ? '26px' : '7px', height: '7px', borderRadius: '4px',
                                        background: i === 2 ? 'linear-gradient(90deg, #8b5cf6, #2563eb)' : '#e2e8f0',
                                        animation: 'dotBounce 1.2s ease-in-out infinite',
                                        animationDelay: `${i * 0.12}s`,
                                    }} />
                                ))}
                            </div>

                            {/* Step badges */}
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                {(isDesigning
                                    ? ['Phân tích email gốc', 'Thiết kế layout mới', 'Áp dụng màu sắc']
                                    : ['Phân tích prompt', 'Tạo section layout', 'Áp dụng màu sắc']
                                ).map(t => (
                                    <span key={t} style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, color: '#64748b', background: '#f1f5f9', border: '1px solid #e2e8f0' }}>{t}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ══ PREVIEW STEP ═══════════════════════════════════════ */}
                    {step === 'preview' && generatedBlocks && (
                        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', animation: 'slideUp 0.3s ease' }}>

                            {/* Left sidebar */}
                            <div style={{
                                width: '230px', flexShrink: 0, overflowY: 'auto',
                                borderRight: '1px solid #f1f5f9', padding: '14px',
                                display: 'flex', flexDirection: 'column', gap: '10px',
                                background: '#fafafa',
                            }}>
                                {/* Success badge */}
                                <div style={{ padding: '10px 12px', borderRadius: '12px', background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1px solid #bbf7d0', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                    <Check style={{ width: 14, height: 14, color: '#16a34a', flexShrink: 0, marginTop: '1px' }} />
                                    <div>
                                        <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: '#15803d' }}>Tạo thành công!</p>
                                        <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#16a34a' }}>{generatedBlocks.length} sections</p>
                                    </div>
                                </div>

                                {/* Refine */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Tinh chỉnh thêm</label>
                                    <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
                                        placeholder="Thay đổi yêu cầu..." rows={4}
                                        style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '8px 10px', fontSize: '11px', resize: 'none', outline: 'none', color: '#1e293b', fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box' }}
                                        onFocus={e => e.currentTarget.style.borderColor = '#8b5cf6'}
                                        onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                                    />
                                </div>

                                <button onClick={() => handleGenerate(mode === 'redesign')} style={{
                                    height: '34px', border: 'none', borderRadius: '10px', cursor: 'pointer',
                                    background: 'linear-gradient(135deg, #8b5cf6, #2563eb)', color: '#fff',
                                    fontSize: '11px', fontWeight: 800, fontFamily: 'inherit',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    boxShadow: '0 4px 12px rgba(104,61,242,0.3)',
                                }}>
                                    <RefreshCw style={{ width: 11, height: 11 }} /> Generate lại
                                </button>

                                <button onClick={() => setStep('prompt')} style={{
                                    height: '30px', border: '1.5px solid #e2e8f0', borderRadius: '10px',
                                    background: '#fff', cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                                    color: '#64748b', fontFamily: 'inherit',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                }}>
                                    <ChevronLeft style={{ width: 11, height: 11 }} /> Quay lại
                                </button>

                                {/* Structure list */}
                                <div style={{ paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                                    <p style={{ margin: '0 0 8px', fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cấu trúc</p>
                                    {generatedBlocks.map((b, i) => (
                                        <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', group: 'true' } as any}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                                <span style={{ width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0, background: 'linear-gradient(135deg, #8b5cf6, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 900, color: '#fff' }}>{i + 1}</span>
                                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, textTransform: 'capitalize', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.type}</span>
                                            </div>
                                            <button
                                                onClick={() => onSaveSection?.(b)}
                                                style={{
                                                    padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#cbd5e1',
                                                    transition: 'all 0.2s', display: 'flex', alignItems: 'center'
                                                }}
                                                title="Lưu vào thư viện"
                                                onMouseEnter={e => e.currentTarget.style.color = '#2563eb'}
                                                onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}
                                            >
                                                <Library style={{ width: 12, height: 12 }} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Preview pane */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                {/* Toolbar with compare tabs */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #f1f5f9', flexShrink: 0, background: '#fff', gap: '10px' }}>

                                    {/* Compare tabs: Mới / Cũ */}
                                    <div style={{ display: 'flex', gap: '4px', padding: '3px', background: '#f1f5f9', borderRadius: '10px' }}>
                                        <button onClick={() => setPreviewTab('new')} style={{
                                            padding: '5px 14px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: 700,
                                            background: previewTab === 'new' ? 'linear-gradient(135deg, #8b5cf6, #2563eb)' : 'transparent',
                                            color: previewTab === 'new' ? '#fff' : '#94a3b8', transition: 'all 0.2s',
                                            display: 'flex', alignItems: 'center', gap: '5px',
                                        }}>
                                            <Sparkles style={{ width: 11, height: 11 }} /> Mới
                                        </button>
                                        <button onClick={() => setPreviewTab('old')} disabled={!oldHtml} style={{
                                            padding: '5px 14px', border: 'none', borderRadius: '7px', cursor: oldHtml ? 'pointer' : 'not-allowed', fontSize: '11px', fontWeight: 700,
                                            background: previewTab === 'old' ? '#1e293b' : 'transparent',
                                            color: previewTab === 'old' ? '#fff' : '#94a3b8', transition: 'all 0.2s',
                                            display: 'flex', alignItems: 'center', gap: '5px',
                                            opacity: oldHtml ? 1 : 0.4,
                                        }}>
                                            <Eye style={{ width: 11, height: 11 }} /> Cũ
                                        </button>
                                    </div>

                                    {/* Viewport toggle */}
                                    <div style={{ display: 'flex', gap: '2px', padding: '3px', background: '#f1f5f9', borderRadius: '10px' }}>
                                        {(['desktop', 'mobile'] as const).map(v => (
                                            <button key={v} onClick={() => setViewMode(v)} style={{
                                                padding: '5px 10px', border: 'none', borderRadius: '7px', cursor: 'pointer',
                                                background: viewMode === v ? 'linear-gradient(135deg, #8b5cf6, #2563eb)' : 'transparent',
                                                color: viewMode === v ? '#fff' : '#94a3b8', transition: 'all 0.2s',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                {v === 'desktop' ? <Monitor style={{ width: 13, height: 13 }} /> : <Smartphone style={{ width: 13, height: 13 }} />}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Apply button */}
                                    <button onClick={handleApply} style={{
                                        height: '34px', padding: '0 18px', border: 'none', borderRadius: '10px', cursor: 'pointer',
                                        background: 'linear-gradient(135deg, #8b5cf6, #2563eb)',
                                        color: '#fff', fontSize: '12px', fontWeight: 800, fontFamily: 'inherit',
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        boxShadow: '0 4px 16px rgba(104,61,242,0.35)', transition: 'transform 0.15s', marginLeft: 'auto',
                                    }}
                                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
                                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                                        <Check style={{ width: 13, height: 13 }} />
                                        Áp dụng vào Builder
                                    </button>
                                </div>

                                {/* Tỷ lệ banner */}
                                {previewTab === 'old' && (
                                    <div style={{ padding: '6px 16px', background: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                        <Eye style={{ width: 12, height: 12, color: '#94a3b8' }} />
                                        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Xem email gốc — chưa được chỉnh sửa</span>
                                    </div>
                                )}
                                {previewTab === 'new' && (
                                    <div style={{ padding: '6px 16px', background: 'linear-gradient(90deg, #f5f3ff, #fff)', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, borderBottom: '1px solid #ddd6fe' }}>
                                        <Sparkles style={{ width: 12, height: 12, color: '#2563eb' }} />
                                        <span style={{ fontSize: '11px', color: '#5b21b6', fontWeight: 600 }}>Phiên bản mới — AI đã thiết kế</span>
                                    </div>
                                )}

                                {/* Iframe */}
                                <div style={{ flex: 1, overflowY: 'auto', background: '#f1f5f9', padding: '20px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
                                    <div style={{
                                        background: '#fff', borderRadius: '14px', overflow: 'hidden',
                                        width: viewMode === 'mobile' ? '375px' : '100%',
                                        maxWidth: '640px',
                                        boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
                                        transition: 'width 0.3s ease',
                                        animation: 'fadeTabIn 0.25s ease',
                                    }}>
                                        {previewTab === 'new' ? (
                                            <iframe ref={iframeNewRef} srcDoc={previewHtml} title="Preview mới"
                                                style={{ width: '100%', border: 'none', minHeight: '480px', display: 'block' }}
                                                sandbox="allow-same-origin"
                                                onLoad={() => { const f = iframeNewRef.current; if (f?.contentDocument) f.style.height = f.contentDocument.documentElement.scrollHeight + 'px'; }}
                                            />
                                        ) : (
                                            <iframe ref={iframeOldRef} srcDoc={oldHtml} title="Preview cũ"
                                                style={{ width: '100%', border: 'none', minHeight: '480px', display: 'block' }}
                                                sandbox="allow-same-origin"
                                                onLoad={() => { const f = iframeOldRef.current; if (f?.contentDocument) f.style.height = f.contentDocument.documentElement.scrollHeight + 'px'; }}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Image Library Modal */}
            <ImageLibraryModal
                isOpen={showLibrary}
                onClose={() => setShowLibrary(false)}
                onSelect={(url) => {
                    setImages(prev => [...prev, { id: crypto.randomUUID(), url, name: url.split('/').pop() || 'Image', source: 'url' }]);
                    setShowLibrary(false);
                }}
            />

            {/* Template Live Preview Dialog */}
            {previewingTemplate && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 200002,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px',
                    boxSizing: 'border-box',
                }}>
                    {/* Dark backdrop */}
                    <div 
                        onClick={() => setPreviewingTemplate(null)}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'rgba(15,23,42,0.6)',
                            backdropFilter: 'blur(4px)',
                            animation: 'backdropIn 0.2s ease forwards',
                        }} 
                    />
                    
                    {/* Preview box */}
                    <div style={{
                        position: 'relative',
                        width: '100%',
                        maxWidth: '680px',
                        height: '80vh',
                        background: '#fff',
                        borderRadius: '24px',
                        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        animation: 'modalIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards',
                    }}>
                        {/* Header */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '16px 20px',
                            borderBottom: '1px solid #f1f5f9',
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                                    Xem trước mẫu: {previewingTemplate.name}
                                </h3>
                                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                                    Mẫu thiết kế tham khảo cho AI
                                </p>
                            </div>
                            <button 
                                onClick={() => setPreviewingTemplate(null)}
                                style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: '#f8fafc',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <X style={{ width: 14, height: 14, color: '#64748b' }} />
                            </button>
                        </div>

                        {/* Iframe View */}
                        <div style={{ flex: 1, background: '#f1f5f9', position: 'relative' }}>
                            <iframe
                                title="Template Preview"
                                srcDoc={compileHTML(previewingTemplate.blocks, bodyStyle, previewingTemplate.name, { isPreview: true })}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    border: 'none',
                                    background: '#fff',
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AIEmailGeneratorModal;
