import * as React from 'react';
import { useState, useEffect } from 'react';
import { X, Search, FileText, CheckCircle, AlertTriangle, XCircle, Code, RefreshCw, Plus, Layout, Smartphone, Edit, Download } from 'lucide-react';
import { api } from '../../services/storageAdapter';
import Button from '../common/Button';
import ZaloTemplateCreateModal from './ZaloTemplateCreateModal';
import Modal from '../common/Modal';

interface ZaloTemplate {
    id: string;
    template_id: string;
    template_name: string;
    status: string;
    template_type: string;
    preview_data: any; // JSON
    template_data: any; // JSON with detail
    updated_at: string;
}

interface ZaloTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    oaId: string;
}

const ZaloTemplateModal: React.FC<ZaloTemplateModalProps> = ({ isOpen, onClose, oaId }) => {
    const [templates, setTemplates] = useState<ZaloTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<ZaloTemplate | null>(null);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingTemplate, setEditingTemplate] = useState<ZaloTemplate | null>(null);

    useEffect(() => {
        if (isOpen && oaId) {
            fetchTemplates();
        }
    }, [isOpen, oaId]);

    const fetchTemplates = async () => {
        setIsLoading(true);
        try {
            const res = await api.get<ZaloTemplate[]>(`zalo_templates?oa_id=${oaId}`);
            if (res.success) {
                let list = Array.isArray(res.data) ? res.data : (res.data as any)?.templates || [];

                // Parse JSON fields if they come as strings to avoid data corruption later
                list = list.map((t: any) => ({
                    ...t,
                    template_type: t.template_type || '',
                    template_data: typeof t.template_data === 'string' ? JSON.parse(t.template_data) : t.template_data,
                    preview_data: typeof t.preview_data === 'string' ? JSON.parse(t.preview_data) : t.preview_data
                })).filter((t: any) => t.status?.toUpperCase() !== 'REJECT' && t.status?.toUpperCase() !== 'REJECTED');

                setTemplates(list);
            }
        } catch (error) {
            console.error('Failed to fetch templates', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const res = await api.post(`zalo_templates?route=sync&oa_id=${oaId}`, {});
            if (res.success) {
                await fetchTemplates();
            }
        } catch (error) {
            console.error('Sync failed', error);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleDownloadCsv = () => {
        if (!selectedTemplate) return;

        // 1. Get Params -> Headers
        // Ensure we always have a phone number column first
        const params = selectedTemplate.preview_data || [];
        const headers = ['phone_number', ...params.map((p: any) => p.name)];

        // 2. Create CSV Content (Header only for template)
        // Add BOM for Excel compatibility with UTF-8
        const csvContent = "\uFEFF" + headers.join(",");

        // 3. Trigger Download
        const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `zns_template_${selectedTemplate.template_id}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSelectTemplate = async (template: ZaloTemplate) => {
        setSelectedTemplate(template);

        // Check if we have detail/previewUrl already
        const tData = template.template_data || {};
        const hasPreview = tData.detail && tData.detail.previewUrl;

        if (!hasPreview) {
            setIsLoadingDetail(true);
            try {
                const res = await api.post<{ previewUrl?: string }>(`zalo_templates?route=detail&id=${template.id}`, {});
                if (res.success && res.data) {
                    // Update local state to reflect new detail
                    const updatedTemplates = templates.map(t => {
                        if (t.id === template.id) {
                            return {
                                ...t,
                                template_data: {
                                    ...(t.template_data || {}),
                                    detail: res.data
                                }
                            };
                        }
                        return t;
                    });
                    setTemplates(updatedTemplates);

                    // Update selected template reference
                    setSelectedTemplate(prev => prev ? ({
                        ...prev,
                        template_data: {
                            ...(prev.template_data || {}),
                            detail: res.data
                        }
                    }) : null);
                }
            } catch (error) {
                console.error("Failed to fetch template detail", error);
            } finally {
                setIsLoadingDetail(false);
            }
        }
    };

    const getStatusBadge = (status: string) => {
        const s = status?.toUpperCase();
        if (s === 'ENABLE' || s === 'APPROVED') {
            return (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-wider border border-emerald-100 shadow-sm">
                    <CheckCircle className="w-3 h-3" />
                    APPROVED
                </div>
            );
        } else if (s === 'REJECT' || s === 'REJECTED') {
            return (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-black uppercase tracking-wider border border-rose-100 shadow-sm">
                    <XCircle className="w-3 h-3" />
                    REJECTED
                </div>
            );
        } else if (s === 'PENDING_REVIEW') {
            return (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-wider border border-amber-100 shadow-sm">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    PENDING
                </div>
            );
        } else {
            return (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-wider border border-slate-100">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    {s}
                </div>
            );
        }
    };

    const filteredTemplates = templates.filter(t =>
        (t.template_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.template_id || '').includes(searchTerm)
    );

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="4xl"
            noHeader
            noPadding
        >
            <div className="bg-white w-full flex flex-col overflow-hidden" style={{ height: '85vh' }}>
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10 shrink-0">
                    <div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                            <Layout className="w-6 h-6 text-slate-400" />
                            Thư viện Template
                        </h3>
                        <p className="text-sm text-slate-500 font-medium mt-1">Quản lý, đồng bộ và xem trước các mẫu tin ZNS</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Tìm kiếm template..."
                                className="pl-9 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-medium w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:bg-white transition-all placeholder:text-slate-400"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="h-8 w-px bg-slate-200 mx-2" />
                        <Button
                            variant="secondary"
                            icon={Download}
                            onClick={handleDownloadCsv}
                            disabled={!selectedTemplate}
                            className={`bg-white border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm whitespace-nowrap ${!selectedTemplate ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            CSV Mẫu
                        </Button>
                        <Button
                            variant="secondary"
                            icon={RefreshCw}
                            onClick={handleSync}
                            isLoading={isSyncing}
                            className="bg-white border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm"
                        >
                            Đồng bộ
                        </Button>
                        <Button
                            variant="primary"
                            // size="md"
                            icon={Plus}
                            onClick={() => {
                                setEditingTemplate(null);
                                setIsCreateOpen(true);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20"
                        >
                            Tạo mới
                        </Button>
                        <button onClick={onClose} className="ml-2 w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 hover:bg-rose-50 hover:text-rose-500 transition-colors text-slate-400">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex flex-1 overflow-hidden bg-slate-50/30">
                    {/* Left: Template List */}
                    <div className="w-[320px] shrink-0 border-r border-slate-200/60 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {isLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
                                ))}
                            </div>
                        ) : filteredTemplates.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                    <Search className="w-6 h-6 text-slate-400" />
                                </div>
                                <p className="text-slate-500 font-medium">Không tìm thấy template nào</p>
                                <p className="text-xs text-slate-400 mt-1">Thử đồng bộ lại hoặc tạo mới</p>
                            </div>
                        ) : (
                            filteredTemplates.map(t => (
                                <div
                                    key={t.id}
                                    onClick={() => handleSelectTemplate(t)}
                                    className={`
                                        group relative p-3.5 rounded-xl border transition-all cursor-pointer select-none
                                        ${selectedTemplate?.id === t.id
                                            ? 'bg-blue-50/80 border-blue-500 shadow-sm ring-1 ring-blue-500 z-10'
                                            : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'
                                        }
                                    `}
                                >
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="flex-1 min-w-0">
                                            <h4 className={`font-semibold text-sm leading-snug mb-2 ${selectedTemplate?.id === t.id ? 'text-blue-700' : 'text-slate-800 group-hover:text-blue-600'}`}>
                                                {t.template_name}
                                            </h4>

                                            <div className="flex items-center flex-wrap gap-2">
                                                <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100/80 rounded-md border border-slate-200/50">
                                                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">ID</span>
                                                    <span className="text-[11px] font-mono text-slate-600 font-medium">{t.template_id}</span>
                                                </div>

                                                {Number(t.template_data?.detail?.price) > 0 && (
                                                    <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-md border border-blue-100/60">
                                                        <span className="text-[11px] font-bold text-blue-600 font-mono">
                                                            {Number(t.template_data?.detail?.price).toLocaleString()}đ
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="shrink-0 flex flex-col items-end gap-1">
                                            <span className={`
                                                px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border shadow-sm
                                                ${t.status === 'ENABLE' || t.status === 'approved'
                                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                    : t.status === 'REJECT'
                                                        ? 'bg-rose-50 text-rose-600 border-rose-100'
                                                        : 'bg-amber-50 text-amber-600 border-amber-100'
                                                }
                                            `}>
                                                {t.status === 'ENABLE' || t.status === 'approved' ? 'Active' : t.status === 'REJECT' ? 'Reject' : 'Pending'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Right: Preview & Details */}
                    <div className="flex-1 bg-white overflow-hidden flex flex-col relative">
                        {selectedTemplate ? (
                            <div className="flex h-full">
                                {/* Details Column */}
                                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                    <div className="mb-8">
                                        <div className="flex items-center gap-2 mb-2">
                                            {getStatusBadge(selectedTemplate.status)}
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">•</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                Cập nhật: {new Date(selectedTemplate.updated_at).toLocaleDateString('vi-VN')}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-start gap-4">
                                            <h2 className="text-2xl font-black text-slate-800 leading-tight mb-2">
                                                {selectedTemplate.template_name}
                                            </h2>
                                            {/* [Hán/Ẩn tạm thời] Chỉnh sửa template ZNS
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                icon={Edit}
                                                onClick={() => {
                                                    setEditingTemplate(selectedTemplate);
                                                    setIsCreateOpen(true);
                                                }}
                                                className="shrink-0"
                                            >
                                                Chỉnh sửa
                                            </Button> */}
                                        </div>
                                        <p className="text-sm text-slate-500 font-mono flex items-center gap-2">
                                            ID: <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 select-all">{selectedTemplate.template_id}</span>
                                        </p>
                                    </div>

                                    {/* Parameters Section */}
                                    <div className="mb-8">
                                        <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                                            <Code className="w-4 h-4" />
                                            Tham số (Parameters)
                                        </h5>

                                        {selectedTemplate.preview_data && selectedTemplate.preview_data.length > 0 ? (
                                            <div className="grid grid-cols-1 gap-2">
                                                {selectedTemplate.preview_data.map((param: any, idx: number) => (
                                                    <div key={idx} className="flex items-center gap-3 bg-white rounded-lg p-2 border border-slate-200 hover:border-blue-300 transition-all shadow-sm">
                                                        <div className="w-6 h-6 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center text-[10px] font-mono font-bold text-slate-500 shrink-0">
                                                            {idx + 1}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-baseline justify-between">
                                                                <p className="text-xs font-bold text-slate-700 truncate font-mono" title={param.name}>{param.name}</p>
                                                                <p className="text-[9px] text-slate-400 font-bold uppercase ml-2">{param.type || 'String'}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center">
                                                <p className="text-sm text-slate-500 italic">Không có tham số nào</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* JSON Payload (Collapsed by default idea, but here full) */}
                                    {/* <div className="p-5 bg-slate-900 rounded-2xl text-slate-300 font-mono text-[10px] leading-relaxed overflow-x-auto shadow-inner">
                                        <p className="text-slate-500 font-bold mb-2 uppercase tracking-wider text-[9px]">Payload Example</p>
                                        <pre>
                                            {JSON.stringify(
                                                (selectedTemplate.preview_data || []).reduce((acc: any, p: any) => {
                                                    acc[p.name] = p.sample_value || "value";
                                                    return acc;
                                                }, {}),
                                                null, 2
                                            )}
                                        </pre>
                                     </div> */}
                                </div>

                                { /* Preview Phone Column */}
                                <div className="w-[420px] shrink-0 bg-slate-100 border-l border-slate-200/60 p-8 flex flex-col items-center justify-center relative bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]">
                                    <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-200 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Zalo Preview</span>
                                    </div>

                                    {isLoadingDetail ? (
                                        <div className="w-[300px] h-[550px] bg-white rounded-[40px] shadow-2xl border-8 border-slate-800 flex items-center justify-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                                                <p className="text-xs font-bold text-slate-400">Đang tải preview...</p>
                                            </div>
                                        </div>
                                    ) : selectedTemplate.template_data?.detail?.previewUrl ? (
                                        <div className="relative group">
                                            <div className="w-[360px] h-[600px] bg-white rounded-[40px] shadow-2xl border-[10px] border-slate-800 overflow-hidden relative transform transition-transform duration-500 hover:scale-[1.02]">
                                                {/* Notch */}
                                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-xl z-20" />

                                                <iframe
                                                    src={selectedTemplate.template_data.detail.previewUrl}
                                                    title="ZNS Preview"
                                                    className="w-full h-full border-0 bg-slate-50 overflow-hidden"
                                                    sandbox="allow-scripts allow-same-origin allow-popups"
                                                    scrolling="no"
                                                />
                                            </div>
                                            <a
                                                href={selectedTemplate.template_data.detail.previewUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] text-slate-400 font-medium hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100 whitespace-nowrap"
                                            >
                                                Mở trong tab mới &rarr;
                                            </a>
                                        </div>
                                    ) : (
                                        <div className="w-[300px] h-[580px] bg-white rounded-[40px] shadow-xl border-[8px] border-slate-200/50 flex flex-col items-center justify-center p-8 text-center gap-4">
                                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-2">
                                                <AlertTriangle className="w-8 h-8 text-slate-300" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-600">Không có bản xem trước</p>
                                                <p className="text-xs text-slate-400 mt-2 leading-relaxed">Template này chưa được Zalo tạo bản preview. Vui lòng kiểm tra lại Trạng thái duyệt.</p>
                                            </div>
                                            <Button size="sm" variant="secondary" onClick={() => handleSelectTemplate(selectedTemplate)}>
                                                Tỷ lệ

                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                                <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-100">
                                    <Smartphone className="w-12 h-12 text-slate-300" />
                                </div>
                                <h3 className="text-xl font-black text-slate-800 mb-2">Chọn Template để xem chi tiết</h3>
                                <p className="text-slate-500 max-w-sm mx-auto mb-8">
                                    Xem trước giao diện tin nhắn ZNS thực tế trên điện thoại và kiểm tra các tham số kỹ thuật.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ZaloTemplateCreateModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                oaId={oaId}
                editData={editingTemplate}
                onSuccess={() => {
                    fetchTemplates();
                    setIsCreateOpen(false);
                    setEditingTemplate(null);
                }}
            />

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>
        </Modal>
    );
};

export default ZaloTemplateModal;
