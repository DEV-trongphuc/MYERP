
import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, UserMinus, Edit3, ShieldCheck, Tag, Filter, ChevronLeft, ChevronRight, Tags, Trash2, Copy, Download, Mail, Check, Scissors, Loader2, Sparkles, BrainCircuit, Lightbulb, MessageSquareCode, FileText, Users2, ListPlus, FolderPlus, ListChecks, Phone } from 'lucide-react';
import Skeleton from '../common/Skeleton';
import Modal from '../common/Modal';
import Badge from '../common/Badge';
import Pagination from '../common/Pagination';
import Button from '../common/Button';
import Input from '../common/Input';
import Checkbox from '../common/Checkbox';
import Select from '../common/Select';
import ConfirmModal from '../common/ConfirmModal';
import toast from 'react-hot-toast';
import { Subscriber } from '../../types';

interface GroupDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    group: { id: string; name: string; type: 'list' | 'segment' | 'tag'; count: number } | null;
    members: Subscriber[];
    onRemoveFromList: (subscriberIds: string[], options?: { targetType: string, targetId: string }) => void;
    onRemoveFromTag?: (subscriberIds: string[], options?: { targetType: string, targetId: string }) => void;
    onExcludeFromSegment?: (subscriberIds: string[], segmentId: string) => void;
    onSplit?: (subscriberIds: string[], segment: { id: string, name: string }) => void;
    onViewProfile: (subscriber: Subscriber) => void;
    // ... rest
    currentPage: number;
    totalPages: number;
    totalCount: number;
    onPageChange: (page: number) => void;
    onSearch: (term: string) => void;
    onStatusFilter: (status: string) => void;
    activeStatusFilter?: string;
    onCleanup?: (id: string) => void;
    loading?: boolean;
}

const renderMemberAvatar = (email: string, firstName?: string, lastName?: string) => {
    const fName = (firstName || '').trim();
    const lName = (lastName || '').trim();
    const cleanEmail = (email || '').trim();
    
    let fullName = '';
    if (fName || lName) {
        fullName = `${fName} ${lName}`.trim();
    } else {
        fullName = cleanEmail.split('@')[0] || '?';
    }

    const parts = fullName.split(/\s+/);
    let initials = '?';
    if (parts.length > 0 && parts[0]) {
        if (parts.length === 1) {
            initials = parts[0].substring(0, 2).toUpperCase();
        } else {
            initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
    }

    const colors = [
        'bg-blue-500', 'bg-rose-500', 'bg-emerald-500', 'bg-amber-500', 'bg-indigo-500', 'bg-blue-500'
    ];
    let hash = 0;
    const textToHash = fullName;
    for (let i = 0; i < textToHash.length; i++) {
        hash = textToHash.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorClass = colors[Math.abs(hash) % colors.length];

    return (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm ${colorClass}`}>
            {initials}
        </div>
    );
};

const GroupDetailModal: React.FC<GroupDetailModalProps> = ({
    isOpen, onClose, group, members, onRemoveFromList, onRemoveFromTag, onExcludeFromSegment, onSplit, onViewProfile,
    currentPage, totalPages, totalCount, onPageChange, onSearch, onStatusFilter, activeStatusFilter = 'all', onCleanup, loading = false
}) => {
    // CRITICAL: Early return MUST be before any hooks to prevent "Rendered fewer hooks than expected" error
    if (!group) return null;

    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isGlobalSelected, setIsGlobalSelected] = useState(false);

    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        ids: string[];
        message: string;
        type?: 'remove' | 'cleanup';
    }>({ isOpen: false, ids: [], message: '' });

    const [invalidCount, setInvalidCount] = useState(0);
    const [isCleaning, setIsCleaning] = useState(false);

    const [stats, setStats] = useState<Record<string, number>>({});
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const [analyzedAt, setAnalyzedAt] = useState<string | null>(null);
    const [showAnalysisResult, setShowAnalysisResult] = useState(false);
    const [previewScoreRange, setPreviewScoreRange] = useState<{ min: number; max: number; label: string } | null>(null);
    const [previewMembers, setPreviewMembers] = useState<any[]>([]);
    const [previewPage, setPreviewPage] = useState(1);
    const [totalPreviewPages, setTotalPreviewPages] = useState(1);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [isCreatingList, setIsCreatingList] = useState(false);
    const [showSaveOptions, setShowSaveOptions] = useState(false);
    const [saveTarget, setSaveTarget] = useState<{ min: number; max: number; label: string } | null>(null);
    const [saveMode, setSaveMode] = useState<'new' | 'existing'>('new');
    const [newListName, setNewListName] = useState('');
    const [selectedListId, setSelectedListId] = useState('');
    const [allLists, setAllLists] = useState<any[]>([]);

    useEffect(() => {
        setSelectedIds(new Set());
        setIsGlobalSelected(false);
        setSearch(''); // Reset search on new group
        setStats({}); // Reset stats

        if (group) {
            import('../../services/storageAdapter').then(({ api }) => {
                // Fetch Stats
                const endpoint = group.type === 'list' ? 'lists' : (group.type === 'tag' ? 'tags' : 'segments');
                api.get<any>(`${endpoint}.php?id=${group.id}&route=stats`).then(res => {
                    if (res.success) {
                        setStats(res.data);
                    }
                });
            });
        }

        if (group?.type === 'segment') {
            import('../../services/storageAdapter').then(({ api }) => {
                api.post<any>('segment_ai_analysis', { segment_id: group.id, fetch_only: true }).then(res => {
                    if (res.success && res.data.analysis) {
                        setAnalysisResult(res.data.analysis);
                        setAnalyzedAt(res.data.analyzed_at);
                    }
                });
            });
        }

        // Fetch invalid count for segments or lists
        if (group?.type === 'segment' || group?.type === 'list') {
            const query = new URLSearchParams({
                [group.type === 'segment' ? 'segment_id' : 'list_id']: group.id,
                status: 'unsubscribed,error,bounced,complaint',
                limit: '1'
            }).toString();
            import('../../services/storageAdapter').then(({ api }) => {
                api.get<any>(`subscribers?${query}`).then(res => {
                    if (res.success && res.data.pagination) {
                        setInvalidCount(res.data.pagination.total);
                    }
                });
            });
        } else {
            setInvalidCount(0);
        }
    }, [group?.id]);

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (onSearch) onSearch(search);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        if (type === 'success') toast.success(message);
        else if (type === 'error') toast.error(message);
        else toast(message);
    };

    // Selection Logic
    const toggleSelectAll = () => {
        const currentPageIds = members.map(m => m.id);
        const allSelected = currentPageIds.every(id => selectedIds.has(id));
        const newSet = new Set(selectedIds);

        if (allSelected) {
            currentPageIds.forEach(id => newSet.delete(id));
            setIsGlobalSelected(false);
        } else {
            currentPageIds.forEach(id => newSet.add(id));
        }
        setSelectedIds(newSet);
    };

    const toggleSelectOne = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
        if (isGlobalSelected) setIsGlobalSelected(false);
    };

    const isAllPageSelected = members.length > 0 && members.every(m => selectedIds.has(m.id));

    // Action Handlers
    const handleRemoveClick = (ids: string[]) => {
        if (!group) return;
        const isList = group.type === 'list';
        const isSegment = group.type === 'segment';
        const actionName = isList ? 'gỡ khỏi danh sách' : (isSegment ? 'gỡ khỏi phân khúc vĩnh viễn' : 'gỡ nhãn');
        const msg = ids.length === 1
            ? `Bạn có chắc chắn muốn ${actionName} "${group.name}" Khách hàng này?`
            : `Bạn có chắc chắn muốn ${actionName} "${group.name}" cho ${ids.length} Khách hàng đã chọn?`;

        setConfirmState({
            isOpen: true,
            ids: ids,
            message: msg
        });
    };

    const executeRemove = async () => {
        // Clear selection and close confirmation first
        setConfirmState({ ...confirmState, isOpen: false });
        setSelectedIds(new Set());
        setIsGlobalSelected(false);

        if (confirmState.type === 'cleanup' && onCleanup && group) {
            setIsCleaning(true);
            await onCleanup(group.id);
            setInvalidCount(0);
            setIsCleaning(false);
        } else {
            const options = isGlobalSelected && group ? { targetType: group.type, targetId: group.id } : undefined;
            if (group?.type === 'list') {
                onRemoveFromList(confirmState.ids, options);
            } else if (group?.type === 'tag' && onRemoveFromTag) {
                onRemoveFromTag(confirmState.ids, options);
            } else if (group?.type === 'segment' && onExcludeFromSegment) {
                onExcludeFromSegment(confirmState.ids, group.id);
            }
        }
    };

    const handleCleanupClick = () => {
        if (!group || invalidCount === 0) return;
        setConfirmState({
            isOpen: true,
            ids: [],
            message: `Hệ thống tìm thấy ${invalidCount} Khách hàng bị lỗi (Bounced/Error) hoặc đã Hủy đăng kýtrong phân khúc này. Bạn có muốn dọn dẹp (loại bỏ hoàn toàn) họ khỏi phân khúc không?`,
            type: 'cleanup'
        });
    };

    const handleCopyEmails = () => {
        const selectedMembers = members.filter(m => selectedIds.has(m.id));
        const emails = selectedMembers.map(m => m.email).join(', ');
        navigator.clipboard.writeText(emails);
        showToast(`Đã sao chép ${selectedIds.size} email`, 'success');
        setSelectedIds(new Set());
    };

    const handleExportCSV = () => {
        const selectedMembers = members.filter(m => selectedIds.has(m.id));
        const header = ['ID', 'Email', 'SĐT', 'First Name', 'Last Name', 'Giới tính', 'Địa chỉ', 'Công ty', 'Salesperson', 'Nguồn', 'Status', 'Joined At'];
        const rows = selectedMembers.map(s => [
            s.id,
            s.email,
            s.phoneNumber || '',
            s.firstName || '',
            s.lastName || '',
            s.gender || '',
            s.address || '',
            s.companyName || '',
            s.salesperson || '',
            s.source || '',
            s.status,
            s.joinedAt
        ]);

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
            + [header, ...rows].map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `export_${group?.name}_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast(`Đã xuất ${selectedIds.size} liên hệ`, 'success');
        setSelectedIds(new Set());
    };

    const handleSendEmail = () => {
        const selectedMembers = members.filter(m => selectedIds.has(m.id));
        const emails = selectedMembers.map(m => m.email).join(',');
        window.open(`mailto:?bcc=${emails}`);
        setSelectedIds(new Set());
    };

    const handleAIAnalysis = async () => {
        if (!group || group.type !== 'segment') return;

        setIsAnalyzing(true);
        try {
            const { api } = await import('../../services/storageAdapter');
            const res = await api.post<any>('segment_ai_analysis', { segment_id: group.id });
            if (res.success) {
                setAnalysisResult(res.data.analysis);
                setAnalyzedAt(res.data.analyzed_at);
                setShowAnalysisResult(true);
            } else {
                toast.error(res.message || 'Lỗi khi phân tích dữ liệu');
            }
        } catch (error) {
            toast.error('Không thể kết nối với máy chủ AI');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handlePreviewScoreRange = async (min: number, max: number, label: string, page: number = 1) => {
        if (!group) return;
        const cleanLabel = (label || '').replace(/^["'“””‘]+|["'“””‘]+$/g, '').trim() || "Phân khúc điểm";
        setPreviewScoreRange({ min, max, label: cleanLabel });
        setPreviewPage(page);
        setIsPreviewLoading(true);
        try {
            const { api } = await import('../../services/storageAdapter');
            const query = new URLSearchParams({
                [group.type === 'segment' ? 'segment_id' : (group.type === 'list' ? 'list_id' : 'tag')]: group.id,
                min_lead_score: min.toString(),
                max_lead_score: max.toString(),
                limit: '20',
                offset: ((page - 1) * 20).toString()
            }).toString();
            const res = await api.get<any>(`subscribers?${query}`);
            if (res.success) {
                setPreviewMembers(res.data.data || []);
                if (res.data.pagination) {
                    setTotalPreviewPages(res.data.pagination.totalPages || 1);
                }
            } else {
                toast.error('Lỗi khi lấy danh sách');
            }
        } catch (error) {
            toast.error('Lỗi kết nối');
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const handleQuickCreateList = (min: number, max: number, label: string) => {
        if (!group) return;
        setSaveTarget({ min, max, label });
        setNewListName(`${group.name} - ${label} [Score ${min}-${max}]`);
        setShowSaveOptions(true);

        // Fetch lists for existing selection
        import('../../services/storageAdapter').then(({ api }) => {
            api.get<any>('lists.php').then(res => {
                if (res.success) {
                    setAllLists(res.data || []);
                }
            });
        });
    };

    const executeSaveToList = async () => {
        if (!group || !saveTarget) return;
        if (saveMode === 'new' && !newListName) return toast.error('Vui lòng nhập tên danh sách');
        if (saveMode === 'existing' && !selectedListId) return toast.error('Vui lòng chọn danh sách');

        setIsCreatingList(true);
        try {
            const { api } = await import('../../services/storageAdapter');
            let targetListId = selectedListId;

            if (saveMode === 'new') {
                const createRes = await api.post<any>('lists', {
                    name: newListName,
                    description: `Tạo từ phân tích AI cho phạm vi điểm Lead Score ${saveTarget.min}-${saveTarget.max}`
                });
                if (!createRes.success) throw new Error(createRes.message || 'Lỗi khi tạo danh sách mới');
                targetListId = createRes.data.id;
            }

            // 2. Add members to list (Bulk op)
            const bulkRes = await api.post<any>('bulk_operations', {
                type: 'list_add',
                targetType: 'filter',
                listId: targetListId,
                filter: {
                    [group.type === 'segment' ? 'segment_id' : (group.type === 'list' ? 'list_id' : 'tag')]: group.id,
                    min_lead_score: saveTarget.min,
                    max_lead_score: saveTarget.max
                }
            });

            if (bulkRes.success) {
                toast.success(saveMode === 'new' ? `Đã tạo & lưu danh sách: ${newListName}` : 'Đã thêm thành viên vào danh sách thành công');
                setShowSaveOptions(false);
            } else {
                toast.error('Lỗi khi thêm thành viên vào danh sách');
            }
        } catch (error: any) {
            toast.error(error.message || 'Lỗi hệ thống khi lưu danh sách');
        } finally {
            setIsCreatingList(false);
        }
    };

    const handleExportWord = () => {
        const content = document.getElementById('ai-report-content');
        if (!content) return;

        // Create a copy of the content to manipulate for export
        const exportContent = content.cloneNode(true) as HTMLElement;

        // Remove elements that shouldn't be in the export (like icons or specific UI helpers)
        exportContent.querySelectorAll('.print\\:hidden, button, svg').forEach(el => el.remove());

        const now = new Date();
        const formattedDate = `${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;

        const header = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' 
                  xmlns:w='urn:schemas-microsoft-com:office:word' 
                  xmlns='http://www.w3.org/TR/REC-html40'>
            <head><meta charset='utf-8'><title>Báo cáo AI - ${group.name}</title>
            <style>
                body { font-family: 'Times New Roman', serif; line-height: 1.6; padding: 1in; color: #000; }
                @page { margin: 1in; }
                .report-header { font-size: 24pt; font-weight: bold; margin-bottom: 25pt; color: #2c3e50; border-bottom: 2pt solid #2c3e50; padding-bottom: 10pt; text-align: left; }
                .meta-info { font-size: 12pt; margin-bottom: 5pt; color: #334155; }
                .meta-label { font-weight: bold; }
                .analysis-title { font-size: 14pt; font-weight: bold; margin-top: 25pt; margin-bottom: 10pt; text-transform: uppercase; }
                
                table { border-collapse: collapse; width: 100%; margin: 15pt 0; border: 0.5pt solid #cbd5e1; }
                th { background-color: #f8fafc; border: 0.5pt solid #cbd5e1; padding: 10pt; text-align: left; font-size: 11pt; font-weight: bold; color: #000; }
                td { border: 0.5pt solid #cbd5e1; padding: 10pt; text-align: left; font-size: 11pt; color: #334155; vertical-align: top; }
                
                strong { font-weight: bold; }
                p { font-size: 12pt; margin-bottom: 12pt; display: block; }
                h3 { font-size: 16pt; font-weight: bold; margin-top: 30pt; margin-bottom: 15pt; display: block; color: #000; }
                ul, ol { margin-bottom: 15pt; margin-left: 20pt; }
                li { font-size: 12pt; margin-bottom: 6pt; }

                /* Layout Flattening */
                .print-section { border: none !important; margin-bottom: 40pt !important; }
                .section-header-box { margin-top: 30pt !important; }
                .content-box { padding: 0 !important; }
            </style>
            </head><body>
            <div class="report-header">Báo cáo Phân tích Chiến lược AI - Phân khúc: ${group.name}</div>
            
            <div class="meta-info"><span class="meta-label">Báo cáo PHÂN TÍCH CHUYÊN SÂU PHÂN KHÚC</span> '${group.name}'</div>
            <div class="meta-info"><span class="meta-label">Ngày:</span> ${formattedDate}</div>
            <div class="meta-info"><span class="meta-label">Người thực hiện:</span> Chuyên gia Marketing Strategy & AI Data Analyst</div>
        `;

        let innerHTML = exportContent.innerHTML;

        // Cleanup and transform content
        innerHTML = innerHTML.replace(/class="px-6 py-4/g, 'class="section-header-box');
        innerHTML = innerHTML.replace(/class="p-8/g, 'class="content-box');

        const footer = "</body></html>";
        const sourceHTML = header + innerHTML + footer;

        const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const fileDownload = document.createElement("a");
        fileDownload.href = url;
        fileDownload.download = `Bao_cao_AI_${group.name}_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.doc`;
        fileDownload.click();
        URL.revokeObjectURL(url);
    };

    // Simplified Markdown-like parser for the report
    const renderMarkdown = (content: string) => {
        const renderText = (text: string) => {
            // Functional helper to replace BR tags with React elements
            const handleBr = (input: string) => {
                const parts = input.split(/<br\s*\/?>/i);
                if (parts.length === 1) return input;
                return parts.map((p, i) => (
                    <React.Fragment key={i}>
                        {p}
                        {i < parts.length - 1 && <br />}
                    </React.Fragment>
                ));
            };

            const parts = text.split(/(\*\*.*?\*\*|\[SCORE:\s*(?:\d+-\d+\+?|[<>]\d+|\d+\+)\].*?)/i);
            let lastWasScore = false;
            return parts.map((part, i) => {
                if (!part) return null;

                let innerText = part.trim();
                if (part.startsWith('**') && part.endsWith('**')) {
                    innerText = part.slice(2, -2).trim();
                }

                // SPECIAL FEATURE: Detect [SCORE: min-max], [SCORE: >min], [SCORE: min+]
                // Robust regex to catch various formats
                const scoreMatch = innerText.match(/\[SCORE:\s*(?:(\d+)\s*-\s*(\d+)\+?|([<>])\s*(\d+)|(\d+)\s*(\+))\]\s*(.*?)$/i);

                if (scoreMatch) {
                    lastWasScore = true;
                    let min = 0;
                    let max = 10000;
                    let label = "";

                    if (scoreMatch[1] !== undefined) {
                        min = parseInt(scoreMatch[1]);
                        max = parseInt(scoreMatch[2]);
                    } else if (scoreMatch[3] !== undefined) {
                        const symbol = scoreMatch[3];
                        const val = parseInt(scoreMatch[4]);
                        if (symbol === '>') { min = val + 1; max = 10000; }
                        else { min = 0; max = val - 1; }
                    } else if (scoreMatch[5] !== undefined) {
                        min = parseInt(scoreMatch[5]);
                        max = 10000;
                    }

                    label = scoreMatch[7]?.trim();

                    if (!label) label = "Phân khúc điểm";

                    return (
                        <div key={i} className="my-4 p-4 bg-slate-50 border border-slate-200 rounded-[16px] flex flex-col gap-3 group/score hover:border-amber-200 hover:bg-amber-50/20 transition-all">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg">
                                        <BrainCircuit className="w-4 h-4" />
                                    </div>
                                    <h4 className="text-[12px] font-bold text-slate-800 uppercase tracking-tight">Nhóm {label} <span className="text-amber-600">({min === max ? min : `${min}-${max}`} điểm)</span></h4>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => handlePreviewScoreRange(min, max, label)}
                                        className="h-9 min-w-[90px] px-4 text-[10px] font-bold uppercase tracking-wider rounded-full bg-white border-slate-200 hover:border-slate-400 hover:bg-slate-50 flex items-center justify-center gap-2 transition-all whitespace-nowrap shadow-sm"
                                    >
                                        <Users2 className="w-3.5 h-3.5" />
                                        Xem
                                    </Button>
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => handleQuickCreateList(min, max, label)}
                                        disabled={isCreatingList}
                                        className="h-9 min-w-[90px] px-4 text-[10px] font-bold uppercase tracking-wider rounded-full flex items-center justify-center gap-2 transition-all whitespace-nowrap shadow-md hover:shadow-lg active:scale-95"
                                    >
                                        {isCreatingList ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ListPlus className="w-3.5 h-3.5" />}
                                        Lưu list
                                    </Button>
                                </div>
                            </div>
                            <div className="text-xs text-slate-500 font-medium leading-relaxed italic">
                                Giải pháp AI đề xuất bộ lọc này để tối ưu hóa tỷ lệ chuyển đổi cho phân khúc hiện tại.
                            </div>
                        </div>
                    );
                }

                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={i} className="font-bold text-slate-900">{handleBr(innerText)}</strong>;
                }

                // If the previous part was a score group, clean up the leading colon/whitespace
                let cleanPart = part;
                if (lastWasScore) {
                    cleanPart = part.replace(/^[:\s\-\*]+/, '');
                    lastWasScore = false;
                }

                return <React.Fragment key={i}>{handleBr(cleanPart)}</React.Fragment>;
            });
        };

        const lines = content.split('\n');
        const rendered: React.ReactNode[] = [];
        let currentList: string[] = [];
        let currentTable: string[][] = [];
        let inTable = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Table Detection
            if (line.startsWith('|') && line.includes('|')) {
                const cells = line.split('|')
                    .filter((c, idx, arr) => (idx > 0 && idx < arr.length - 1) || c.trim().length > 0)
                    .map(c => c.trim());

                // Better Table Separator Skip: matches |---| or | :--- | etc
                if (/^\|?\s*[:\-]+\s*\|/.test(line)) {
                    continue;
                }

                if (!inTable) {
                    inTable = true;
                    currentTable = [];
                }
                if (cells.length > 0) currentTable.push(cells);

                const nextLine = lines[i + 1]?.trim();
                if (!nextLine || !nextLine.startsWith('|')) {
                    rendered.push(
                        <div key={`table-${i}`} className="my-6 overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        {currentTable[0]?.map((cell, idx) => (
                                            <th key={idx} className="px-5 py-4 font-black text-slate-700 uppercase tracking-wider">{renderText(cell)}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentTable.slice(1).map((row, rIdx) => (
                                        <tr key={rIdx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                                            {row.map((cell, cIdx) => (
                                                <td key={cIdx} className="px-5 py-4 text-slate-600 leading-relaxed align-top">{renderText(cell)}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                    inTable = false;
                    currentTable = [];
                }
                continue;
            }

            // Headings
            if (line.startsWith('## ')) {
                const text = line.replace('## ', '').trim();
                if (text) rendered.push(<h2 key={i} className="text-2xl font-black text-slate-800 mt-10 mb-6 border-b-2 border-slate-100 pb-2">{renderText(text)}</h2>);
                continue;
            }
            if (line.startsWith('### ')) {
                const text = line.replace('### ', '').trim();
                if (text) rendered.push(<h3 key={i} className="text-xl font-bold text-slate-800 mt-8 mb-4">{renderText(text)}</h3>);
                continue;
            }
            if (line.startsWith('#### ')) {
                const text = line.replace('#### ', '').trim();
                if (text) rendered.push(<h4 key={i} className="text-lg font-bold text-slate-800 mt-6 mb-3">{renderText(text)}</h4>);
                continue;
            }

            // Horizontal Rules
            if (line === '---' || line === '***' || line === '___') {
                rendered.push(<hr key={i} className="my-10 border-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />);
                continue;
            }

            // Ordered Lists
            const orderedMatch = line.match(/^(\d+)\.\s+(.*)/);
            if (orderedMatch) {
                const num = orderedMatch[1];
                const content = orderedMatch[2];
                rendered.push(
                    <div key={i} className="flex gap-4 mb-4 items-start pl-1">
                        <span className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-800 text-[11px] font-black border border-slate-200 shadow-sm">{num}</span>
                        <div className="text-slate-600 leading-relaxed flex-1 pt-0.5">
                            {renderText(content)}
                        </div>
                    </div>
                );
                continue;
            }

            // Lists
            if (line.startsWith('- ') || line.startsWith('* ')) {
                currentList.push(line.replace(/^[-*]\s/, ''));
                const nextLine = lines[i + 1]?.trim();
                if (!nextLine || (!nextLine.startsWith('- ') && !nextLine.startsWith('* '))) {
                    rendered.push(
                        <ul key={i} className="list-disc pl-6 space-y-2 mb-6">
                            {currentList.map((item, idx) => (
                                <li key={idx} className="text-slate-600 leading-relaxed">{renderText(item)}</li>
                            ))}
                        </ul>
                    );
                    currentList = [];
                }
                continue;
            }

            // Regular Paragraphs
            if (line.length > 0) {
                rendered.push(<p key={i} className="text-slate-600 leading-relaxed mb-4">{renderText(line)}</p>);
            }
        }

        return rendered;
    };

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={group.type === 'list' ? 'Chi tiết Danh sách' : (group.type === 'tag' ? 'Thành viên gắn nhãn' : 'Chi tiết Phân khúc')}
                size="lg"
                footer={
                    <div className="w-full flex justify-between items-center">
                        <div className="text-xs text-slate-400 font-medium">
                            Hiển thị {members.length.toLocaleString()} / {totalCount.toLocaleString()} thành viên
                        </div>
                        <Button variant="secondary" onClick={onClose}>Đóng</Button>
                    </div>
                }
            >
                <div className="flex flex-col h-full relative">

                    {/* Header Summary */}
                    <div className="bg-slate-50 p-6 rounded-[24px] border border-slate-200 mb-6 shrink-0">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge variant={group.type === 'list' ? 'info' : (group.type === 'tag' ? 'success' : 'warning')} className="uppercase">
                                        {group.type === 'list' ? 'Static List' : (group.type === 'tag' ? 'System Tag' : 'Dynamic Segment')}
                                    </Badge>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ID: {group.id}</span>
                                </div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                                    {group.type === 'tag' && <Tag className="w-5 h-5 text-emerald-600" />}
                                    {group.name}
                                </h2>
                                {group.type === 'segment' && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                            onClick={handleAIAnalysis}
                                            disabled={isAnalyzing}
                                            className={`flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-lg hover:shadow-amber-200 transition-all active:scale-95 disabled:opacity-70 ${isAnalyzing ? 'animate-pulse' : ''}`}
                                        >
                                            {isAnalyzing ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <Sparkles className="w-3.5 h-3.5" />
                                            )}
                                            {isAnalyzing ? 'Đang phân tích...' : (analysisResult ? 'Phân tích ai' : 'Phân tích AI')}
                                        </button>

                                        {analysisResult && !isAnalyzing && (
                                            <button
                                                onClick={() => setShowAnalysisResult(true)}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-amber-200 text-amber-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-50 transition-all active:scale-95"
                                            >
                                                <BrainCircuit className="w-3.5 h-3.5" />
                                                Xem phân tích cũ
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="text-right flex flex-col items-end gap-1.5">
                                <div className="text-right">
                                    <p className="text-2xl font-black text-slate-800 tracking-tight">{((!search && activeStatusFilter === 'all' && Number(stats?.total) > 0) ? Number(stats.total) : (totalCount || Number(stats?.total) || 0)).toLocaleString()}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Thành viên</p>
                                </div>
                                {invalidCount > 0 && (
                                    <button
                                        onClick={handleCleanupClick}
                                        disabled={isCleaning}
                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 border border-rose-100 text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-rose-100 transition-all shadow-sm"
                                    >
                                        {isCleaning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                        Dọn dẹp {invalidCount.toLocaleString()} lỗi
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Interactive 4 KPI Quick-Filter Cards (TẤT CẢ, ACTIVE, UNSUB, CÓ SĐT) */}
                        {(() => {
                            const totalFromStats = Object.entries(stats)
                                .filter(([key]) => key !== 'has_phone' && key !== 'total')
                                .reduce((sum, [, value]) => sum + (Number(value) || 0), 0);
                            const allCount = totalFromStats || Number(stats.total) || totalCount || 0;
                            const activeCount = Number(stats.active ?? stats.Subscribed ?? 0);
                            const unsubCount = Number(stats.unsubscribed ?? stats.Unsubscribed ?? 0);
                            const phoneCount = Number(stats.has_phone ?? 0);

                            const kpiCards = [
                                {
                                    key: 'all',
                                    label: 'TẤT CẢ',
                                    count: allCount,
                                    dotColor: 'bg-amber-500',
                                    activeClass: 'bg-amber-50 border-amber-400 text-amber-700 ring-2 ring-amber-400/20 shadow-sm',
                                    textClass: 'text-amber-700'
                                },
                                {
                                    key: 'active',
                                    label: 'ACTIVE',
                                    count: activeCount,
                                    dotColor: 'bg-emerald-500',
                                    activeClass: 'bg-emerald-50 border-emerald-400 text-emerald-700 ring-2 ring-emerald-400/20 shadow-sm',
                                    textClass: 'text-emerald-700'
                                },
                                {
                                    key: 'unsubscribed',
                                    label: 'UNSUB',
                                    count: unsubCount,
                                    dotColor: 'bg-slate-400',
                                    activeClass: 'bg-slate-100 border-slate-400 text-slate-800 ring-2 ring-slate-400/20 shadow-sm',
                                    textClass: 'text-slate-700'
                                },
                                {
                                    key: 'has_phone',
                                    label: 'CÓ SĐT',
                                    count: phoneCount,
                                    isPhone: true,
                                    dotColor: 'bg-emerald-500',
                                    activeClass: 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-500/20 shadow-sm',
                                    textClass: 'text-emerald-700'
                                }
                            ];

                            return (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-200/80">
                                    {kpiCards.map(card => {
                                        const isActive =
                                            activeStatusFilter === card.key ||
                                            (card.key === 'active' && activeStatusFilter === 'Subscribed') ||
                                            (card.key === 'unsubscribed' && activeStatusFilter === 'Unsubscribed');
                                        return (
                                            <button
                                                key={card.key}
                                                type="button"
                                                onClick={() => onStatusFilter(isActive && card.key !== 'all' ? 'all' : card.key)}
                                                className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl border transition-all duration-200 cursor-pointer text-left ${
                                                    isActive
                                                        ? card.activeClass
                                                        : 'bg-white border-slate-200/80 hover:bg-slate-50 hover:border-slate-300'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    {card.isPhone ? (
                                                        <Phone className={`w-4 h-4 ${isActive ? 'text-emerald-600' : 'text-emerald-500'}`} />
                                                    ) : (
                                                        <div className={`w-2.5 h-2.5 rounded-full ${card.dotColor} ${isActive ? 'animate-pulse' : ''}`} />
                                                    )}
                                                    <div className="flex flex-col items-start leading-tight">
                                                        <span className={`text-[10px] font-black uppercase tracking-wider ${isActive ? 'text-slate-800' : 'text-slate-400'}`}>
                                                            {card.label}
                                                        </span>
                                                        <span className={`text-base font-black tabular-nums mt-0.5 ${isActive ? card.textClass : 'text-slate-700'}`}>
                                                            {card.count.toLocaleString('vi-VN')}
                                                        </span>
                                                    </div>
                                                </div>
                                                {isActive && (
                                                    <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-md bg-white/80 text-slate-700 border border-slate-200">
                                                        Đang lọc
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Toolbar */}
                    <div className="flex gap-4 mb-4 shrink-0 px-1">
                        <Input
                            placeholder="Tìm thành viên trong nhóm này..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            icon={Search}
                        />
                    </div>

                    {/* Members List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-100 rounded-2xl flex flex-col bg-white relative min-h-[400px]">
                        <table className="w-full text-left">
                            <thead className="sticky top-0 z-20">
                                {selectedIds.size > 0 ? (
                                    <tr className="bg-[#fffbf0] border-b border-orange-200 shadow-sm animate-in fade-in duration-200">
                                        <th colSpan={4} className="px-4 py-2.5">
                                            <div className="flex items-center justify-between w-full">
                                                <div className="flex items-center gap-3">
                                                    <Checkbox
                                                        checked={true}
                                                        onChange={() => setSelectedIds(new Set())}
                                                        size="sm"
                                                    />
                                                    <span className="text-xs font-bold text-slate-700">
                                                        Đã chọn <span className="text-orange-600 font-black text-sm">{selectedIds.size}</span> Khách hàng
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button onClick={handleCopyEmails} className="p-2 hover:bg-white rounded-lg text-slate-500 hover:text-blue-600 hover:shadow-sm transition-all" title="Sao chép Email">
                                                        <Copy className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={handleExportCSV} className="p-2 hover:bg-white rounded-lg text-slate-500 hover:text-emerald-600 hover:shadow-sm transition-all" title="Xuất CSV">
                                                        <Download className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={handleSendEmail} className="p-2 hover:bg-white rounded-lg text-slate-500 hover:text-indigo-600 hover:shadow-sm transition-all" title="Gửi Email">
                                                        <Mail className="w-4 h-4" />
                                                    </button>
                                                    {(group.type === 'segment' || group.type === 'list') && onSplit && (
                                                        <button
                                                            onClick={() => onSplit(Array.from(selectedIds), { id: group.id, name: group.name })}
                                                            className="p-2 hover:bg-white rounded-lg text-slate-500 hover:text-orange-600 hover:shadow-sm transition-all"
                                                            title="Tách các người dùng đã chọn"
                                                        >
                                                            <Scissors className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <div className="h-4 w-px bg-orange-200 mx-1"></div>
                                                    <button onClick={() => handleRemoveClick(Array.from(selectedIds))} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-100 text-rose-600 hover:bg-rose-50 hover:border-rose-200 rounded-lg text-xs font-bold shadow-sm transition-all">
                                                        {group.type === 'list' ? <UserMinus className="w-3.5 h-3.5" /> : (group.type === 'segment' ? <UserMinus className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />)}
                                                        <span>{group.type === 'list' ? 'Gỡ khỏi List' : (group.type === 'segment' ? 'Gỡ khỏi Phân khúc' : 'Gỡ Tag')}</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </th>
                                    </tr>
                                ) : (
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="px-4 py-3 w-10 pl-6">
                                            <Checkbox
                                                checked={isAllPageSelected}
                                                onChange={toggleSelectAll}
                                                size="sm"
                                            />
                                        </th>
                                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Khách hàng</th>
                                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Trạng thái</th>
                                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Thao tác</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isAllPageSelected && totalCount > members.length && (
                                    <tr className="bg-orange-50/50">
                                        <td colSpan={4} className="px-6 py-2.5 text-center">
                                            {isGlobalSelected ? (
                                                <p className="text-xs font-medium text-slate-600">
                                                    Đã chọn tất cả <span className="font-bold text-orange-600">{totalCount.toLocaleString()}</span> thành viên trong {group.type === 'tag' ? 'nhãn' : 'nhóm'} này.
                                                    <button onClick={() => setIsGlobalSelected(false)} className="ml-2 text-blue-600 font-bold hover:underline">Bỏ chọn</button>
                                                </p>
                                            ) : (
                                                <p className="text-xs font-medium text-slate-600">
                                                    Đã chọn {members.length} Khách hàng trên trang này.
                                                    <button onClick={() => setIsGlobalSelected(true)} className="ml-1 text-orange-600 font-bold hover:underline italic underline-offset-2">Chọn tất cả {totalCount.toLocaleString()} thành viên?</button>
                                                </p>
                                            )}
                                        </td>
                                    </tr>
                                )}
                                {loading ? (
                                    [...Array(6)].map((_, i) => (
                                        <tr key={i}>
                                            <td className="px-4 py-3 pl-6">
                                                <Skeleton variant="rounded" width={20} height={20} />
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="flex items-center gap-3">
                                                    <Skeleton variant="rounded" width={32} height={32} />
                                                    <div className="space-y-2">
                                                        <Skeleton variant="text" width={100} height={12} />
                                                        <Skeleton variant="text" width={150} height={10} />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-center"><Skeleton variant="circular" width={8} height={8} className="mx-auto" /></td>
                                            <td className="px-6 py-3 text-right"><Skeleton variant="rounded" width={24} height={24} className="ml-auto" /></td>
                                        </tr>
                                    ))
                                ) : members.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="py-10 text-center text-slate-400 text-xs font-medium italic">
                                            Không tìm thấy thành viên phù hợp.
                                        </td>
                                    </tr>
                                ) : members.map(member => (
                                    <tr key={member.id} className={`hover:bg-slate-50 transition-colors group ${selectedIds.has(member.id) ? 'bg-orange-50/20' : ''}`}>
                                        <td className="px-4 py-3 pl-6" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={selectedIds.has(member.id)}
                                                onChange={() => toggleSelectOne(member.id)}
                                                size="sm"
                                            />
                                        </td>
                                        <td className="px-6 py-3 cursor-pointer" onClick={() => onViewProfile(member)}>
                                            <div className="flex items-center gap-3">
                                                {renderMemberAvatar(member.email, member.firstName, member.lastName)}
                                                <div>
                                                    <p className="text-sm font-bold text-slate-700">{member.firstName} {member.lastName}</p>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-xs text-slate-400">{member.email}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            <span className={`inline-flex w-2 h-2 rounded-full ${member.status === 'active' ? 'bg-emerald-500' :
                                                member.status === 'lead' ? 'bg-blue-500' :
                                                    member.status === 'customer' ? 'bg-indigo-500' :
                                                        member.status === 'bounced' ? 'bg-rose-500' :
                                                            member.status === 'complained' ? 'bg-red-500' :
                                                                'bg-slate-500'
                                                }`} title={member.status}></span>
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            {group.type === 'list' ? (
                                                <button
                                                    onClick={() => handleRemoveClick([member.id])}
                                                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                    title="Xóa khỏi danh sách này"
                                                >
                                                    <UserMinus className="w-4 h-4" />
                                                </button>
                                            ) : group.type === 'tag' ? (
                                                <button
                                                    onClick={() => handleRemoveClick([member.id])}
                                                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                    title="Gỡ nhãn này"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            ) : group.type === 'segment' ? (
                                                <button
                                                    onClick={() => handleRemoveClick([member.id])}
                                                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                    title="Gỡ khỏi phân khúc vĩnh viễn"
                                                >
                                                    <UserMinus className="w-4 h-4" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => onViewProfile(member)}
                                                    className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                                    title="Chỉnh sửa hồ sơ"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalCount={totalCount}
                        itemsPerPage={20}
                        onPageChange={onPageChange}
                    />

                    {/* Segment Note */}
                    {group.type === 'segment' && (
                        <div className="mt-4 p-3 bg-orange-50 border border-orange-100 rounded-[18px] flex items-center gap-3 text-orange-700 text-[11px] shrink-0">
                            <ShieldCheck className="w-5 h-5 text-orange-500 shrink-0" />
                            <p><strong>Loại trừ thủ công:</strong> Khi gỡ thành viên khỏi Phân khúc, hệ thống sẽ <strong>chặn vĩnh viễn</strong> họ tham gia lại phân khúc này ngay cả khi khớp điều kiện lọc trong tương lai.</p>
                        </div>
                    )}
                </div>
            </Modal>

            {/* AI Analysis Modal - Using standard app Modal component for perfect synchronization */}
            <Modal
                isOpen={showAnalysisResult}
                onClose={() => setShowAnalysisResult(false)}
                title={
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
                            <BrainCircuit className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-base font-black text-slate-800 tracking-tight">Chiến lược Phân khúc AI</span>
                        </div>
                    </div>
                }
                size="xl"
                footer={
                    <div className="w-full flex justify-between items-center">
                        <Button
                            variant="secondary"
                            onClick={handleExportWord}
                            className="flex items-center gap-2 px-6 py-2 rounded-full text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-800"
                        >
                            <FileText className="w-4 h-4" />
                            Xuất Word
                        </Button>
                        <div className="flex gap-3">
                            <Button
                                variant="secondary"
                                onClick={() => setShowAnalysisResult(false)}
                                className="px-6 py-2 rounded-full font-black uppercase text-[11px] tracking-widest"
                            >
                                Đóng
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => {
                                    navigator.clipboard.writeText(analysisResult || '');
                                    toast.success('Đã sao chép nội dung');
                                }}
                                className="bg-slate-900 text-white hover:bg-black px-6 py-2 rounded-full font-black uppercase text-[11px] tracking-widest"
                            >
                                <Copy className="w-4 h-4 mr-2" />
                                Sao chép
                            </Button>
                        </div>
                    </div>
                }
            >

                <div id="ai-report-content" className="flex flex-col gap-10 py-4 custom-scrollbar">

                    <div className="space-y-10">
                        {/* Summary Header */}
                        <div className="p-6 bg-slate-50 border border-slate-200 rounded-[24px] flex items-center gap-6 print:hidden">
                            <div className="p-3.5 bg-white border border-slate-200 text-amber-600 rounded-2xl shadow-sm">
                                <Lightbulb className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Trạng thái Báo cáo</h4>
                                <div className="flex flex-col gap-0.5">
                                    <p className="text-[13px] text-slate-600 font-medium">Báo cáo phân tích hành vi dựa trên <span className="text-amber-600 font-bold">{totalCount} thành viên</span> trong phân khúc.</p>
                                    {analyzedAt && (
                                        <p className="text-[11px] text-slate-400 font-medium italic">Sử dụng dữ liệu cập nhật lúc: <span className="text-slate-500 font-bold">{new Date(analyzedAt).toLocaleString('vi-VN')}</span></p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sections Logic */}
                    {(() => {
                        const rawContent = (analysisResult || '').trim();
                        // Pre-process: remove external ```markdown or ``` wrappers if LLM still emits them
                        const cleanedContent = rawContent.replace(/^```(?:markdown)?\n?|```$/gi, '').trim();

                        const sections: { tag: string; content: string }[] = [];
                        const parts = cleanedContent.split(/\[(SUMMARY|CHARACTERISTICS|PERSONAS|STRATEGY|SCENARIOS|SCORE_GROUPS|SCORE-GROUPS)\]/i);
                        // Capture introductory content before the first tag
                        const introContent = parts[0]?.trim() || '';
                        const cleanIntro = introContent.replace(/^[\s\n\-\*\_]+|[\s\n\-\*\_]+$/g, '').trim();
                        if (cleanIntro && cleanIntro !== '---') {
                            sections.push({ tag: 'INTRO', content: cleanIntro });
                        }

                        for (let i = 1; i < parts.length; i += 2) {
                            const tag = parts[i].toUpperCase().replace('-', '_');
                            let content = parts[i + 1]?.trim() || '';

                            // CLEANUP: Remove potential ```markdown or ``` wrappers within section
                            content = content.replace(/^```(?:markdown)?\n?|```$/gi, '').trim();

                            // Enhanced cleaning: remove leading/trailing horizontal rules or extra newlines
                            content = content.replace(/^[\s\n\-\*\_]+|[\s\n\-\*\_]+$/g, '').trim();
                            if (content) sections.push({ tag, content });
                        }

                        const tagMetas: Record<string, { label: string; bg: string; text: string; icon: any }> = {
                            INTRO: { label: 'Tổng quan & Tổng số', bg: 'bg-slate-100', text: 'text-slate-600', icon: Sparkles },
                            SUMMARY: { label: 'Tóm tắt chiến lược AI', bg: 'bg-blue-50', text: 'text-blue-600', icon: Tags },
                            CHARACTERISTICS: { label: 'Đặc điểm & Hành vi', bg: 'bg-amber-50', text: 'text-amber-600', icon: BrainCircuit },
                            PERSONAS: { label: 'Chân dung Khách hàng', bg: 'bg-purple-50', text: 'text-purple-600', icon: Mail },
                            STRATEGY: { label: 'Giải pháp tiếp cận', bg: 'bg-emerald-50', text: 'text-emerald-600', icon: Check },
                            SCENARIOS: { label: 'Kịch bản Campaign', bg: 'bg-rose-50', text: 'text-rose-600', icon: FileText },
                            SCORE_GROUPS: { label: 'Tối ưu hóa Lead Score', bg: 'bg-emerald-50', text: 'text-emerald-600', icon: Lightbulb }
                        };
                        return sections.map((sec, idx) => {
                            const meta = tagMetas[sec.tag] || { label: sec.tag, bg: 'bg-slate-50', text: 'text-slate-600', icon: Sparkles };
                            return (
                                <div key={idx} className="print-section border border-slate-200 rounded-[20px] overflow-hidden bg-white hover:border-slate-300 transition-all">
                                    <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-100 flex items-center gap-3">
                                        <div className={`p-2 ${meta.bg} ${meta.text} rounded-lg`}>
                                            <meta.icon className="w-4 h-4" />
                                        </div>
                                        <h3 className="text-[12px] font-bold text-slate-800 uppercase tracking-wider">{meta.label}</h3>
                                    </div>
                                    <div className="p-8 prose prose-slate prose-sm max-w-none prose-strong:text-slate-800 prose-strong:font-bold prose-headings:font-bold prose-p:text-slate-600 prose-li:text-slate-600">
                                        {renderMarkdown(sec.content)}
                                    </div>
                                </div>
                            );
                        });
                    })()}
                </div>
            </Modal>

            {/* Score Segment Preview Modal */}
            <Modal
                isOpen={!!previewScoreRange}
                onClose={() => setPreviewScoreRange(null)}
                title={
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
                            <BrainCircuit className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-sm font-bold text-slate-800 tracking-tight">Thành viên nhóm "{previewScoreRange?.label}"</span>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">Khoảng điểm: {previewScoreRange?.min} - {previewScoreRange?.max}</p>
                        </div>
                    </div>
                }
                size="lg"
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <Button
                            variant="secondary"
                            onClick={() => setPreviewScoreRange(null)}
                            className="h-10 min-w-[120px] px-6 rounded-full font-bold uppercase text-[10px] tracking-wider flex items-center justify-center transition-all bg-white border-slate-200 hover:bg-slate-50"
                        >
                            Đóng
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() => {
                                if (previewScoreRange) {
                                    handleQuickCreateList(previewScoreRange.min, previewScoreRange.max, previewScoreRange.label);
                                    setPreviewScoreRange(null);
                                }
                            }}
                            disabled={isCreatingList || previewMembers.length === 0}
                            className="h-10 min-w-[160px] px-8 rounded-full font-bold uppercase text-[10px] tracking-wider flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isCreatingList ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListPlus className="w-4 h-4" />}
                            Lưu danh sách mới
                        </Button>
                    </div>
                }
            >
                <div className="min-h-[400px]">
                    {isPreviewLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="w-10 h-10 text-amber-600 animate-spin" />
                            <p className="text-sm text-slate-500 font-medium">Đang lọc danh sách thành viên...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {previewMembers.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                    <UserMinus className="w-12 h-12 mb-4 opacity-20" />
                                    <p className="text-sm font-medium">Không tìm thấy thành viên nào trong khoảng điểm này.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="border border-slate-100 rounded-[20px] overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 border-b border-slate-100">
                                                <tr>
                                                    <th className="px-6 py-3 text-left font-bold text-slate-400 uppercase tracking-widest text-[9px]">Thành viên</th>
                                                    <th className="px-6 py-3 text-center font-bold text-slate-400 uppercase tracking-widest text-[9px]">Trạng thái</th>
                                                    <th className="px-6 py-3 text-right font-bold text-slate-400 uppercase tracking-widest text-[9px]">Lead Score</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {previewMembers.map((m, i) => (
                                                    <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                {renderMemberAvatar(m.email, m.firstName, m.lastName)}
                                                                <div className="flex flex-col">
                                                                    <span className="font-bold text-slate-700">{m.firstName} {m.lastName}</span>
                                                                    <span className="text-[11px] text-slate-400 font-medium">{m.email}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex gap-1.5 justify-center">
                                                                {m.zalo_user_id && <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" title="Zalo" />}
                                                                {m.meta_psid && <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-sm" title="Meta" />}
                                                                <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${m.status === 'active' ? 'bg-emerald-500' :
                                                                    m.status === 'lead' ? 'bg-amber-600' :
                                                                        m.status === 'customer' ? 'bg-pink-500' :
                                                                            'bg-slate-300'
                                                                    }`} title={m.status} />
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full font-black text-[11px]">
                                                                {m.leadScore} pts
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Pagination Controls */}
                                    {totalPreviewPages > 1 && (
                                        <div className="flex items-center justify-between px-2 pt-2">
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                                Trang {previewPage} / {totalPreviewPages}
                                            </p>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    disabled={previewPage === 1 || isPreviewLoading}
                                                    onClick={() => handlePreviewScoreRange(previewScoreRange!.min, previewScoreRange!.max, previewScoreRange!.label, previewPage - 1)}
                                                    className="p-2 rounded-full"
                                                >
                                                    <ChevronLeft className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    disabled={previewPage === totalPreviewPages || isPreviewLoading}
                                                    onClick={() => handlePreviewScoreRange(previewScoreRange!.min, previewScoreRange!.max, previewScoreRange!.label, previewPage + 1)}
                                                    className="p-2 rounded-full"
                                                >
                                                    <ChevronRight className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {/* Status Legend */}
                            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-3 text-[10px] text-slate-500">
                                <span className="font-bold text-slate-400 uppercase tracking-widest">Chú thích:</span>
                                <div className="flex flex-wrap gap-x-6 gap-y-2">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm"></span> Zalo
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-sm"></span> Meta
                                    </div>
                                    <div className="w-px h-3 bg-slate-200 mx-2"></div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm"></span> Active
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-amber-600 shadow-sm"></span> Lead
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-pink-500 shadow-sm"></span> Qualified
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shadow-sm"></span> Inactive
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Modal: Save to List Options */}
            <Modal
                isOpen={showSaveOptions}
                onClose={() => setShowSaveOptions(false)}
                title="Lưu vào Danh sách"
                size="sm"
                footer={
                    <div className="w-full flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setShowSaveOptions(false)}>Hủy</Button>
                        <Button
                            variant="primary"
                            onClick={executeSaveToList}
                            disabled={isCreatingList}
                            className="px-8"
                        >
                            {isCreatingList ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                            Xác nhận lưu
                        </Button>
                    </div>
                }
            >
                <div className="space-y-6 py-2">
                    <div className="flex flex-col gap-4">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Hình thức lưu trữ</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setSaveMode('new')}
                                className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${saveMode === 'new'
                                    ? 'border-amber-600 bg-amber-50/50 shadow-sm'
                                    : 'border-slate-100 bg-white hover:border-slate-200 shadow-sm hover:shadow-md'
                                    }`}
                            >
                                <div className={`p-2 rounded-xl ${saveMode === 'new' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                                    <FolderPlus className="w-5 h-5" />
                                </div>
                                <span className={`text-xs font-bold ${saveMode === 'new' ? 'text-amber-900' : 'text-slate-600'}`}>Danh sách mới</span>
                            </button>
                            <button
                                onClick={() => setSaveMode('existing')}
                                className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${saveMode === 'existing'
                                    ? 'border-amber-600 bg-amber-50/50 shadow-sm'
                                    : 'border-slate-100 bg-white hover:border-slate-200 shadow-sm hover:shadow-md'
                                    }`}
                            >
                                <div className={`p-2 rounded-xl ${saveMode === 'existing' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                                    <ListChecks className="w-5 h-5" />
                                </div>
                                <span className={`text-xs font-bold ${saveMode === 'existing' ? 'text-amber-900' : 'text-slate-600'}`}>Thêm vào list cũ</span>
                            </button>
                        </div>
                    </div>

                    {saveMode === 'new' ? (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            <Input
                                label="Tên danh sách mới"
                                value={newListName}
                                onChange={(e) => setNewListName(e.target.value)}
                                placeholder="Nhập tên danh sách..."
                                icon={Edit3}
                            />
                        </div>
                    ) : (
                        <>
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                <Select
                                    label="Chọn danh sách đích"
                                    value={selectedListId}
                                    onChange={(val) => setSelectedListId(val)}
                                    options={[
                                        { value: '', label: '-- Chọn danh sách --' },
                                        ...allLists.map(l => ({ value: l.id, label: `${l.name} (${l.subscriber_count})` }))
                                    ]}
                                    searchable={true}
                                    icon={Search}
                                />
                            </div>

                            {/* Custom Style Helper Note */}
                            <div className="mt-2 p-3 bg-blue-50 rounded-xl text-[11px] text-blue-600 flex items-start gap-2">
                                <ListPlus className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>Hệ thống sẽ tự động ghép thêm <strong>{previewMembers.length} thành viên</strong> vào danh sách này.</span>
                            </div>
                        </>
                    )}
                </div>
            </Modal>

            <ConfirmModal
                isOpen={confirmState.isOpen}
                onClose={() => setConfirmState({ ...confirmState, isOpen: false })}
                onConfirm={executeRemove}
                title={group.type === 'list' ? "Xác nhận gỡ khỏi danh sách" : (group.type === 'segment' ? "Xác nhận gỡ khỏi phân khúc" : "Xác nhận gỡ nhãn")}
                message={confirmState.message}
                variant="danger"
                confirmLabel="Thực hiện ngay"
            />
        </>
    );
};

export default GroupDetailModal;
