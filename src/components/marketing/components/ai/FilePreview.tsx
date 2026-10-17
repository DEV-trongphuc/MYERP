import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
    FileText, ExternalLink, Loader2, Save, Edit3, Copy, X, History, RotateCcw,
    Sparkles, BookOpen, Wand2, Languages, RefreshCcw, Bug, Table, Trash2, Download,
    MessageSquare, Send, PanelRightClose, PanelRightOpen, Terminal, Code, Layout, LayoutPanelLeft, List, Settings, Search, Lightbulb, ChevronUp, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Prism as SyntaxHighlighter } from '../../shims/syntaxHighlighter';
import { vscDarkPlus } from '../../shims/syntaxHighlighter';
import * as XLSX from 'xlsx';
import Papa from '../../shims/papaparse';
import * as mammoth from '../../shims/docReaders';
import { GlobalWorkerOptions, getDocument } from '../../shims/docReaders';
import { toast } from 'react-hot-toast';
import ConfirmModal from '../common/ConfirmModal';
import InputModal from '../common/InputModal';

import { api } from '../../services/storageAdapter';
import { FileAttachment, ChatbotInfo, User } from '../../types';
import { formatFileSize } from '../../utils/formatters';

// Configure PDFjs Worker
GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@5.4.624/build/pdf.worker.min.mjs`;

interface FilePreviewProps {
    activeDoc: FileAttachment | null;
    activeBot: ChatbotInfo | null;
    sessionId: string;
    remoteConvId: string | null;
    currentUser: User | null;
    onUpdateDoc: (updatedDoc: FileAttachment) => void;
    setInput: (text: string) => void;
    isDocWorkspaceOpen: boolean;
    isCodeMode: boolean;
}

const FilePreview: React.FC<FilePreviewProps> = ({
    activeDoc,
    activeBot,
    sessionId,
    remoteConvId,
    currentUser,
    onUpdateDoc,
    setInput,
    isDocWorkspaceOpen,
    isCodeMode
}) => {
    // --- STATE ---
    const [docData, setDocData] = useState<any[] | null>(null); // For CSV/Excel
    const [docColumns, setDocColumns] = useState<string[]>([]);
    const [docContent, setDocContent] = useState<string>(''); // For Text/Code
    const [isProcessingDoc, setIsProcessingDoc] = useState(false);
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [activeSheet, setActiveSheet] = useState<string>('');
    const [isEditing, setIsEditing] = useState(false);
    const [selectedText, setSelectedText] = useState('');
    const [selectionCoords, setSelectionCoords] = useState<{ x: number, y: number } | null>(null);
    const [isSavingDoc, setIsSavingDoc] = useState(false);

    // Excel Selection State
    const [isSelectingCells, setIsSelectingCells] = useState(false);
    const [selectionRange, setSelectionRange] = useState<{ start: { r: number, c: number }, end: { r: number, c: number } } | null>(null);

    const [pdfViewMode, setPdfViewMode] = useState<'native' | 'reader'>('native');
    const [docWorkspaceView, setDocWorkspaceView] = useState<'code' | 'preview'>('code');
    const [pdfActivePage, setPdfActivePage] = useState(1);
    const [pdfSearch, setPdfSearch] = useState('');
    const [pdfSearchActive, setPdfSearchActive] = useState(false);
    const [pdfMatchIndex, setPdfMatchIndex] = useState(0);
    const [pdfNativeLoaded, setPdfNativeLoaded] = useState(false);
    const pdfSearchRef = React.useRef<HTMLInputElement>(null);
    const pageNavRef = React.useRef<HTMLDivElement>(null);

    // Version History State
    const [showHistory, setShowHistory] = useState(false);
    const [docVersions, setDocVersions] = useState<any[]>([]);
    const [isRestoring, setIsRestoring] = useState(false);

    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // AI Sidebar State
    const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);
    const [aiMessages, setAiMessages] = useState<any[]>([]);
    const [aiInput, setAiInput] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [docAnalysis, setDocAnalysis] = useState<any>(null);

    // Zoom and Navigation
    const [zoom, setZoom] = useState(1);
    const [activePage, setActivePage] = useState(1);

    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [versionToRestore, setVersionToRestore] = useState<number | null>(null);

    // --- EFFECTS ---

    // Process Document when activeDoc changes
    const lastProcessedUrl = useRef<string | null>(null);
    useEffect(() => {
        if (activeDoc && isDocWorkspaceOpen) {
            if (activeDoc.previewUrl === lastProcessedUrl.current && (docContent || docData)) return;
            processDocument(activeDoc);
            lastProcessedUrl.current = activeDoc.previewUrl || null;
        } else {
            setDocData(null);
            setDocContent('');
            lastProcessedUrl.current = null;
        }
    }, [activeDoc, isDocWorkspaceOpen]);

    // Reset native load state when document changes
    useEffect(() => {
        setPdfNativeLoaded(false);
    }, [activeDoc?.previewUrl]);

    // PDF Navigation Bridge
    useEffect(() => {
        (window as any).__navigateToPage = (pageNumber: number) => {
            // If in native mode, switch to reader first
            if (pdfViewMode !== 'reader') {
                setPdfViewMode('reader');
            }

            // Small delay to ensure DOM is rendered if mode changed
            setTimeout(() => {
                const container = document.querySelector('.pdf-content-container');
                const pageElement = document.getElementById(`pdf-page-${pageNumber}`);
                if (container && pageElement) {
                    pageElement.scrollIntoView({ behavior: 'auto', block: 'center' });
                    setPdfActivePage(pageNumber);
                    // Scroll page button into view in the navigator
                    setTimeout(() => {
                        const btn = pageNavRef.current?.querySelector(`[data-page="${pageNumber}"]`);
                        btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    }, 100);
                }
            }, pdfViewMode !== 'reader' ? 300 : 0);
        };
        return () => { delete (window as any).__navigateToPage; };
    }, [pdfViewMode]);

    // Track active page via IntersectionObserver
    useEffect(() => {
        if (pdfViewMode !== 'reader') return;
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter(e => e.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
                if (visible.length > 0) {
                    const id = visible[0].target.id; // 'pdf-page-N'
                    const n = parseInt(id.replace('pdf-page-', ''), 10);
                    if (!isNaN(n)) {
                        setPdfActivePage(n);
                        // Keep nav button centered
                        setTimeout(() => {
                            const btn = pageNavRef.current?.querySelector(`[data-page="${n}"]`);
                            btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                        }, 100);
                    }
                }
            },
            { threshold: 0.3 }
        );
        const pages = document.querySelectorAll('[id^="pdf-page-"]');
        pages.forEach(p => observer.observe(p));
        return () => observer.disconnect();
    }, [pdfViewMode, docContent]);

    // PDF text search
    const pdfSearchMatches = React.useMemo(() => {
        if (!pdfSearch.trim() || !docContent) return [];
        const q = pdfSearch.toLowerCase();
        const matches: { pageNum: number; charIdx: number }[] = [];
        const pages = docContent.split('[Page ').filter(p => p.trim());
        pages.forEach((page) => {
            const pageNum = parseInt(page.match(/^(\d+)\]/)?.[1] || '1', 10);
            const content = page.replace(/^\d+\]/, '').toLowerCase();
            let idx = content.indexOf(q);
            while (idx !== -1) {
                matches.push({ pageNum, charIdx: idx });
                idx = content.indexOf(q, idx + 1);
            }
        });
        return matches;
    }, [pdfSearch, docContent]);

    const goToSearchMatch = (matchIndex: number) => {
        const match = pdfSearchMatches[matchIndex];
        if (!match) return;
        (window as any).__navigateToPage?.(match.pageNum);
        setPdfMatchIndex(matchIndex);
    };

    // --- LOGIC ---

    const processDocument = async (file: FileAttachment) => {
        setIsProcessingDoc(true);
        setDocData(null);
        setDocContent('');
        setSheetNames([]);
        setPdfNativeLoaded(false); // reset skeleton for native PDF view

        // Handle virtual content immediately
        if (file.content !== undefined) {
            setDocContent(file.content);
            setIsProcessingDoc(false);
            return;
        }

        try {
            const nameLower = file.name.toLowerCase();
            const fileExt = nameLower.split('.').pop();
            const mimeType = file.type?.toLowerCase() || '';

            const isCsv = fileExt === 'csv' || mimeType === 'text/csv';
            const isExcel = ['xlsx', 'xls'].includes(fileExt || '') || mimeType.includes('spreadsheetml') || mimeType.includes('ms-excel');
            const isText = ['txt', 'md', 'json', 'js', 'html', 'css', 'py', 'sql', 'log', 'php', 'ts', 'tsx', 'java', 'cs', 'go', 'rs', 'rb', 'cpp', 'c', 'h', 'xml', 'yaml', 'yml', 'sh', 'bat', 'ps1', 'env', 'ini', 'conf', 'swift', 'kt'].includes(fileExt || '') || mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType.includes('xml');
            const isDocx = fileExt === 'docx' || mimeType.includes('officedocument.wordprocessingml');
            const isDoc = fileExt === 'doc' || mimeType === 'application/msword';
            const isPdf = fileExt === 'pdf' || mimeType === 'application/pdf';
            const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(fileExt || '') || mimeType.startsWith('image/');

            if (isCsv || isExcel || isText || isDocx || isDoc || isPdf || isImage) {
                let blob: Blob;
                if (file.base64) {
                    const res = await fetch(file.base64);
                    blob = await res.blob();
                } else if (file.previewUrl) {
                    const res = await fetch(file.previewUrl);
                    if (!res.ok) throw new Error("Network response was not ok: " + res.status);
                    blob = await res.blob();
                } else {
                    throw new Error("No file content");
                }

                if (isCsv) {
                    const text = await blob.text();
                    Papa.parse(text, {
                        header: true,
                        skipEmptyLines: true,
                        complete: (results) => {
                            setDocData(results.data);
                            if (results.meta.fields) setDocColumns(results.meta.fields);
                        }
                    });
                } else if (isExcel) {
                    const arrayBuffer = await blob.arrayBuffer();
                    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                    setSheetNames(workbook.SheetNames);
                    const firstSheet = workbook.SheetNames[0];
                    setActiveSheet(firstSheet);

                    const worksheet = workbook.Sheets[firstSheet];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    if (jsonData.length > 0) {
                        const headers = jsonData[0] as string[];
                        setDocColumns(headers);
                        const rows = jsonData.slice(1).map((row: any) => {
                            const obj: any = {};
                            headers.forEach((h, i) => { obj[h] = row[i]; });
                            return obj;
                        });
                        setDocData(rows);
                    }
                } else if (isText) {
                    const text = await blob.text();
                    setDocContent(text);
                } else if (isDocx) {
                    const arrayBuffer = await blob.arrayBuffer();
                    const result = await mammoth.convertToHtml({ arrayBuffer });
                    const html = result.value || '<p class="text-slate-400 italic text-center py-20">Văn bản này không có nội dung hiển thị được.</p>';
                    const text = (await mammoth.extractRawText({ arrayBuffer })).value;
                    setDocContent(html);
                    // Update main workspace state with extracted text for AI context
                    onUpdateDoc({ ...file, content: text });
                } else if (isPdf) {
                    const arrayBuffer = await blob.arrayBuffer();
                    const loadingTask = getDocument({
                        data: arrayBuffer,
                        cMapUrl: 'https://unpkg.com/pdfjs-dist@5.4.624/cmaps/',
                        cMapPacked: true,
                    });
                    const pdf = await loadingTask.promise;
                    let fullText = "";
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items.map((item: any) => item.str).join(' ');
                        fullText += `[Page ${i}]\n${pageText}\n\n`;
                    }
                    setDocContent(fullText || '[Tài liệu PDF rỗng]');
                    // Update main workspace state with extracted text for AI context
                    onUpdateDoc({ ...file, content: fullText });
                } else if (isDoc) {
                    setDocContent('DOC_LEGACY_FORMAT');
                } else if (isImage) {
                    // Images don't have text content for the editor, but we mark them valid
                    setDocContent('[IMAGE_PREVIEW]');
                }
            } else {
                toast.error(`Loại file .${fileExt} chưa được hỗ trợ xem trước.`);
            }
        } catch (e) {
            console.error("Error processing document", e);
            toast.error("Could not preview this file type");
        } finally {
            setIsProcessingDoc(false);
        }
    };

    const handleTextSelection = (e: React.MouseEvent | React.TouchEvent) => {
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            setSelectedText(selection.toString().trim());
            setSelectionCoords({
                x: rect.left + rect.width / 2,
                y: rect.top - 10
            });
        } else {
            setSelectionCoords(null);
        }
    };

    const handleSaveContent = async (newText: string) => {
        if (!activeDoc?.previewUrl) return;
        const tid = toast.loading('Đang lưu thay đổi...');
        try {
            const res = await api.post('ai_org_chatbot?action=workspace_save_content', {
                file_url: activeDoc.previewUrl,
                new_content: newText
            });
            if (res.success) {
                setDocContent(newText);
                setIsEditing(false);
                toast.success('Đã lưu thay đổi!', { id: tid });

                // Also update the parent state
                onUpdateDoc({ ...activeDoc, content: newText });
            } else {
                toast.error('Lỗi khi lưu: ' + ((res as any).error || 'Unknown error'), { id: tid });
            }
        } catch (e) {
            toast.error('Lỗi kết nối máy chủ', { id: tid });
        } finally {
            setIsSavingDoc(false);
        }
    };

    const handleSaveSnippet = async () => {
        if (!activeDoc || !activeDoc.previewUrl?.startsWith('virtual://')) return;
        setIsRenameModalOpen(true);
    };

    const confirmSaveSnippet = async (newName: string) => {
        if (!newName || !activeDoc) return;

        setIsSavingDoc(true);
        const tid = toast.loading('Đang lưu snippet...');
        const snippet = activeDoc;
        const blob = new Blob([snippet.content || ''], { type: 'text/plain' });
        // Use a File object for upload
        const file = new File([blob], newName, { type: 'text/plain' });

        const formData = new FormData();
        formData.append('file', file);
        formData.append('conversation_id', remoteConvId || sessionId);
        if (activeBot && activeBot.id) {
            formData.append('property_id', activeBot.id);
        }

        try {
            const uploadRes = await fetch(api.baseUrl + '/ai_org_chatbot.php?action=workspace_upload', {
                method: 'POST',
                body: formData
            });
            if (!uploadRes.ok) throw new Error("Upload failed with status: " + uploadRes.status);
            const uploadData = await uploadRes.json();

            if (uploadData.success && uploadData.url) {
                const finalUrl = uploadData.url;
                const finalName = uploadData.name || newName;
                const type = 'text/' + (finalName.split('.').pop() || 'plain');

                // Save metadata
                await api.post('ai_org_chatbot.php', {
                    action: 'workspace_save',
                    conversation_id: remoteConvId || sessionId,
                    property_id: activeBot.id,
                    name: finalName,
                    type: type,
                    size: blob.size,
                    url: finalUrl
                });

                // Update active doc in parent
                onUpdateDoc({ ...activeDoc, name: finalName, previewUrl: finalUrl });

                toast.success(`Đã lưu "${finalName}" vào workspace!`, { id: tid });
            } else {
                toast.error("Upload failed: " + (uploadData.error || 'Unknown'), { id: tid });
            }
        } catch (err) {
            console.error("Failed to save snippet", err);
            toast.error("Lỗi khi lưu snippet", { id: tid });
        } finally {
            setIsSavingDoc(false);
        }
    };

    const toggleVersionHistory = async () => {
        if (!activeDoc?.previewUrl) return;
        if (!showHistory) {
            try {
                const res = (await api.post('ai_org_chatbot.php?action=workspace_get_versions', {
                    file_url: activeDoc.previewUrl
                })) as any;
                if (res.success) setDocVersions(res.versions || []);
            } catch (e) {
                toast.error('Không thể tải lịch sử phiên bản');
            }
        }
        setShowHistory(!showHistory);
    };

    const handleRestoreVersion = (versionId: number) => {
        setVersionToRestore(versionId);
        setIsRestoreModalOpen(true);
    };

    const confirmRestoreVersion = async () => {
        if (versionToRestore === null) return;
        setIsRestoring(true);
        const tid = toast.loading('Đang khôi phục phiên bản...');
        try {
            const res = (await api.post('ai_org_chatbot.php?action=workspace_restore_version', {
                version_id: versionToRestore
            })) as any;
            if (res.success) {
                toast.success('Đã khôi phục phiên bản!', { id: tid });
                // Refresh content
                if (activeDoc) {
                    processDocument(activeDoc);
                }
                setShowHistory(false);
                setIsRestoreModalOpen(false);
            } else {
                toast.error(res.message || 'Lỗi khi khôi phục', { id: tid });
            }
        } catch (e) {
            toast.error('Lỗi khi khôi phục', { id: tid });
        } finally {
            setIsRestoring(false);
        }
    };

    const handleSendAi = async (customQ?: string) => {
        const question = customQ || aiInput;
        if (!question.trim()) return;

        const userMsg = { role: 'user', content: question, id: Date.now() };
        setAiMessages(prev => [...prev, userMsg]);
        setAiInput('');
        setIsAiLoading(true);

        try {
            // Using existing API structure for document context chat
            const res = await api.post('ai_org_chatbot?action=chat_with_doc', {
                conversation_id: remoteConvId || sessionId,
                property_id: activeBot?.id,
                file_name: activeDoc?.name,
                file_content: docContent.substring(0, 10000), // Limit context
                question: question,
                history: aiMessages.slice(-5) // Send last 5 messages for context
            }) as any;

            if (res.success) {
                setAiMessages(prev => [...prev, { role: 'assistant', content: res.answer || res.message, id: Date.now() + 1 }]);
            } else {
                toast.error(res.message || 'Lỗi xử lý AI');
            }
        } catch (err) {
            toast.error('Lỗi kết nối AI');
        } finally {
            setIsAiLoading(false);
        }
    };


    // --- RENDER ---

    if (!activeDoc) return null;

    if (isProcessingDoc) {
        return (
            <div className="flex flex-col gap-4 p-8 h-full animate-pulse">
                <div className="h-6 w-1/3 rounded-lg bg-slate-200/80 dark:bg-white/[0.08]" />
                <div className="h-4 w-2/3 rounded-md bg-slate-200/60 dark:bg-white/[0.05]" />
                <div className="h-4 w-full rounded-md bg-slate-200/60 dark:bg-white/[0.05]" />
                <div className="h-4 w-5/6 rounded-md bg-slate-200/60 dark:bg-white/[0.05]" />
                <div className="h-32 w-full rounded-xl bg-slate-200/50 dark:bg-white/[0.04] mt-2" />
            </div>
        );
    }

    // --- PDF / DOCX / TEXT / CODE ---
    const nameLower = activeDoc.name.toLowerCase();
    const fileExt = nameLower.split('.').pop();
    const mimeType = activeDoc.type?.toLowerCase() || '';
    const lang = (() => {
        const map: Record<string, string> = {
            'js': 'javascript', 'ts': 'typescript', 'tsx': 'typescript', 'py': 'python',
            'php': 'php', 'sql': 'sql', 'html': 'html', 'css': 'css', 'json': 'json',
            'sh': 'bash', 'md': 'markdown', 'java': 'java', 'cs': 'csharp', 'go': 'go',
            'rs': 'rust', 'rb': 'ruby', 'cpp': 'cpp', 'c': 'cpp', 'h': 'cpp',
            'xml': 'xml', 'yaml': 'yaml', 'yml': 'yaml', 'bat': 'batch', 'ps1': 'powershell',
            'swift': 'swift', 'kt': 'kotlin'
        };
        return map[fileExt || ''] || 'javascript';
    })();

    const isCsv = fileExt === 'csv' || mimeType === 'text/csv';
    const isExcel = ['xlsx', 'xls'].includes(fileExt || '') || mimeType.includes('spreadsheetml') || mimeType.includes('ms-excel');
    const isDocx = fileExt === 'docx' || mimeType.includes('officedocument.wordprocessingml');
    const isDoc = fileExt === 'doc' || mimeType === 'application/msword';
    const isPdf = fileExt === 'pdf' || mimeType === 'application/pdf';
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(fileExt || '') || mimeType.startsWith('image/');
    const isVirtual = activeDoc.previewUrl?.startsWith('virtual://');
    const isSnippet = nameLower.startsWith('snippet') || isVirtual;
    const isCode = isSnippet || ['js', 'ts', 'tsx', 'php', 'py', 'sql', 'html', 'css', 'json', 'java', 'cs', 'go', 'rs', 'rb', 'cpp', 'c', 'h', 'xml', 'yaml', 'yml', 'sh', 'bat', 'ps1', 'env', 'ini', 'conf', 'swift', 'kt', 'txt'].includes(fileExt || '');

    // --- Interaction Menu ---
    const SelectionMenu = selectionCoords && (
        <div
            className="fixed z-[100] bg-slate-900/95 backdrop-blur-xl text-white rounded-[14px] shadow-xl border border-white/10 p-2 flex items-center gap-1 animate-in zoom-in-95 duration-200"
            style={{ top: selectionCoords.y, left: selectionCoords.x, transform: 'translate(-50%, calc(-100% - 15px))' }}
        >
            <div className="flex items-center">
                <button
                    onClick={() => { setInput(`Giải thích đoạn này: "${selectedText}"`); setSelectionCoords(null); }}
                    className="px-2.5 py-1.5 hover:bg-white/10 rounded-lg text-[9px] font-bold uppercase tracking-wider flex flex-col items-center gap-1 min-w-[50px] transition-colors"
                    title="Explain"
                >
                    <Sparkles className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                    <span>Explain</span>
                </button>
                <button
                    onClick={() => { setInput(`Tóm tắt đoạn này: "${selectedText}"`); setSelectionCoords(null); }}
                    className="px-2.5 py-1.5 hover:bg-white/10 rounded-lg text-[9px] font-bold uppercase tracking-wider flex flex-col items-center gap-1 min-w-[50px] transition-colors"
                    title="Summary"
                >
                    <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                    <span>Summary</span>
                </button>
            </div>

            <div className="w-px h-8 bg-white/10 mx-1" />

            <div className="flex items-center">
                <button
                    onClick={() => { setInput(`Cải thiện văn bản này (sửa lỗi chính tả, trau chuốt câu từ): "${selectedText}"`); setSelectionCoords(null); }}
                    className="px-2.5 py-1.5 hover:bg-white/10 rounded-lg text-[9px] font-bold uppercase tracking-wider flex flex-col items-center gap-1 min-w-[50px] transition-colors"
                    title="Polish"
                >
                    <Wand2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Polish</span>
                </button>
                <button
                    onClick={() => { setInput(`Dịch đoạn này sang tiếng Việt (hoặc tiếng Anh nếu nó đã là tiếng Việt): "${selectedText}"`); setSelectionCoords(null); }}
                    className="px-2.5 py-1.5 hover:bg-white/10 rounded-lg text-[9px] font-bold uppercase tracking-wider flex flex-col items-center gap-1 min-w-[50px] transition-colors"
                    title="Translate"
                >
                    <Languages className="w-3.5 h-3.5 text-slate-400" />
                    <span>Translate</span>
                </button>
                <button
                    onClick={() => { setInput(`Viết lại đoạn này theo phong cách chuyên nghiệp hơn: "${selectedText}"`); setSelectionCoords(null); }}
                    className="px-2.5 py-1.5 hover:bg-white/10 rounded-lg text-[9px] font-bold uppercase tracking-wider flex flex-col items-center gap-1 min-w-[50px] transition-colors"
                    title="Rewrite"
                >
                    <RefreshCcw className="w-3.5 h-3.5 text-orange-400" />
                    <span>Rewrite</span>
                </button>
            </div>

            {isCode && (
                <>
                    <div className="w-px h-8 bg-white/10 mx-1" />
                    <button
                        onClick={() => { setInput(`Kiểm tra lỗi (bugs) và đề xuất cách sửa cho đoạn code này: "${selectedText}"`); setSelectionCoords(null); }}
                        className="px-2.5 py-1.5 hover:bg-white/10 rounded-lg text-[9px] font-bold uppercase tracking-wider flex flex-col items-center gap-1 min-w-[50px] transition-colors"
                        title="Fix Bugs"
                    >
                        <Bug className="w-3.5 h-3.5 text-rose-400" />
                        <span>Fix Bugs</span>
                    </button>
                </>
            )}

            <div className="w-px h-8 bg-white/10 mx-1" />

            <button
                onClick={() => { navigator.clipboard.writeText(selectedText); toast.success('Copied!'); setSelectionCoords(null); }}
                className="p-2.5 hover:bg-white/10 rounded-lg transition-colors group"
                title="Copy Selection"
            >
                <Copy className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
        </div>
    );

    // CSV / Excel Table View
    if (docData && docData.length > 0) {
        return (
            <div className={`flex flex-col w-full h-full relative ${isCodeMode ? 'bg-[#0B0F17]' : 'bg-slate-50'}`} onContextMenu={(e) => e.preventDefault()}>
                {selectionCoords && (
                    <div
                        className="fixed z-[100] bg-white text-slate-800 rounded-[14px] shadow-lg border border-slate-200 p-2 flex items-center gap-1 animate-in zoom-in-95 duration-200"
                        style={{ top: selectionCoords.y, left: selectionCoords.x, transform: 'translate(-50%, calc(-100% - 15px))' }}
                    >
                        <div className="flex items-center">
                            <button
                                onClick={() => {
                                    if (selectionRange) {
                                        const minR = Math.min(selectionRange.start.r, selectionRange.end.r);
                                        const maxR = Math.max(selectionRange.start.r, selectionRange.end.r);
                                        const minC = Math.min(selectionRange.start.c, selectionRange.end.c);
                                        const maxC = Math.max(selectionRange.start.c, selectionRange.end.c);
                                        const selectedData = docData.slice(minR, maxR + 1).map((row: any) => {
                                            const newRow: any = {};
                                            docColumns.forEach((col, idx) => {
                                                if (idx >= minC && idx <= maxC) newRow[col] = row[col];
                                            });
                                            return newRow;
                                        });
                                        setInput(`Giải thích dữ liệu này: ${JSON.stringify(selectedData)}`);
                                    }
                                    setSelectionCoords(null);
                                }}
                                className="px-3 py-2 hover:bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest flex flex-col items-center gap-1.5 min-w-[70px] transition-all group"
                            >
                                <Sparkles className="w-4 h-4 text-[var(--color-primary)] group-hover:scale-110" />
                                <span>Giải thích</span>
                            </button>
                            <button
                                onClick={() => {
                                    if (selectionRange) {
                                        const minR = Math.min(selectionRange.start.r, selectionRange.end.r);
                                        const maxR = Math.max(selectionRange.start.r, selectionRange.end.r);
                                        const minC = Math.min(selectionRange.start.c, selectionRange.end.c);
                                        const maxC = Math.max(selectionRange.start.c, selectionRange.end.c);
                                        const selectedData = docData.slice(minR, maxR + 1).map((row: any) => {
                                            const newRow: any = {};
                                            docColumns.forEach((col, idx) => {
                                                if (idx >= minC && idx <= maxC) newRow[col] = row[col];
                                            });
                                            return newRow;
                                        });
                                        setInput(`Tóm tắt các điểm đáng chú ý trong bảng dữ liệu này: ${JSON.stringify(selectedData)}`);
                                    }
                                    setSelectionCoords(null);
                                }}
                                className="px-3 py-2 hover:bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest flex flex-col items-center gap-1.5 min-w-[70px] transition-all group"
                            >
                                <BookOpen className="w-4 h-4 text-slate-400 group-hover:scale-110" />
                                <span>Tóm tắt</span>
                            </button>
                        </div>
                        <div className="w-px h-10 bg-slate-100 mx-1" />
                        <button
                            onClick={() => {
                                setSelectionRange(null);
                                setSelectionCoords(null);
                            }}
                            className="p-2.5 hover:bg-rose-50 hover:text-rose-600 rounded-xl text-slate-400 transition-all active:scale-95"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                )}
                {/* Toolbar */}
                <div className={`px-4 py-2.5 border-b flex items-center justify-between backdrop-blur-md shrink-0 z-20 ${isCodeMode ? 'bg-[#0B0F17] border-slate-800' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-2">
                        <Table className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-500">{docData.length} Rows</span>
                        {sheetNames.length > 1 && (
                            <select
                                className={`ml-2 text-xs border-none bg-transparent font-bold focus:ring-0 cursor-pointer ${isCodeMode ? 'text-slate-200' : 'text-slate-500'}`}
                                value={activeSheet}
                                onChange={(e) => setActiveSheet(e.target.value)}
                            >
                                {sheetNames.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                if (selectionRange) {
                                    const minR = Math.min(selectionRange.start.r, selectionRange.end.r);
                                    const maxR = Math.max(selectionRange.start.r, selectionRange.end.r);
                                    const minC = Math.min(selectionRange.start.c, selectionRange.end.c);
                                    const maxC = Math.max(selectionRange.start.c, selectionRange.end.c);
                                    const selectedData = docData.slice(minR, maxR + 1).map((row: any) => {
                                        const newRow: any = {};
                                        docColumns.forEach((col, idx) => {
                                            if (idx >= minC && idx <= maxC) newRow[col] = row[col];
                                        });
                                        return newRow;
                                    });
                                    setInput(`Analyze selection: ${JSON.stringify(selectedData)}`);
                                } else {
                                    setInput(`Analyze entire table: ${activeDoc.name}`);
                                }
                            }}
                            className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all shadow-md bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary)]-accent text-white hover:brightness-110 active:scale-95`}
                        >
                            {selectionRange ? 'Analyze Selection' : 'Analyze All'}
                        </button>
                    </div>
                </div>

                <div
                    className="flex-1 overflow-auto custom-scrollbar relative z-10"
                    onMouseUp={(e) => {
                        if (isSelectingCells && selectionRange) {
                            setSelectionCoords({ x: e.clientX, y: e.clientY });
                        }
                        setIsSelectingCells(false);
                    }}
                >
                    <table className={`w-full text-left text-xs border-collapse select-none ${isCodeMode ? 'bg-[#0B0F17]' : 'bg-white'}`}>
                        <thead className={`sticky top-0 z-20 shadow-sm ${isCodeMode ? 'bg-[#0B0F17]' : 'bg-white'}`}>
                            <tr>
                                <th className={`p-3 border-b border-r w-12 text-center font-mono text-slate-400 backdrop-blur-md ${isCodeMode ? 'bg-[#0B0F17] border-slate-800' : 'bg-slate-50/80 border-slate-100'}`}>#</th>
                                {docColumns.map((col, i) => (
                                    <th key={i} className={`p-3 font-bold border-b border-r whitespace-nowrap min-w-[150px] backdrop-blur-md uppercase tracking-wider transition-colors ${isCodeMode ? 'bg-[#0B0F17] border-slate-800 text-slate-300 hover:text-white' : 'bg-slate-50/80 border-slate-100 text-slate-600 hover:text-slate-900'}`}>
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isCodeMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                            {docData.slice(0, 500).map((row: any, rIdx: number) => (
                                <tr key={rIdx} className={`group transition-colors ${isCodeMode ? 'hover:bg-[#1E2532]/50' : 'hover:bg-slate-50'}`}>
                                    <td className={`p-3 border-r text-center font-mono text-[10px] text-slate-400 transition-all ${isCodeMode ? 'bg-[#0B0F17] border-slate-800' : 'bg-slate-50 border-slate-100 group-hover:bg-slate-100 group-hover:text-slate-600'}`}>
                                        {rIdx + 1}
                                    </td>
                                    {docColumns.map((col, cIdx) => {
                                        const isSelected = selectionRange &&
                                            rIdx >= Math.min(selectionRange.start.r, selectionRange.end.r) &&
                                            rIdx <= Math.max(selectionRange.start.r, selectionRange.end.r) &&
                                            cIdx >= Math.min(selectionRange.start.c, selectionRange.end.c) &&
                                            cIdx <= Math.max(selectionRange.start.c, selectionRange.end.c);

                                        return (
                                            <td
                                                key={cIdx}
                                                className={`p-3 border-r truncate max-w-[300px] cursor-cell transition-all duration-200 ${isCodeMode ? 'border-slate-800' : 'border-slate-100'} ${isSelected
                                                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] ring-1 ring-inset ring-[var(--color-primary)]/30 relative z-10'
                                                    : (isCodeMode ? 'text-slate-300 group-hover:text-white font-medium' : 'text-slate-600 group-hover:text-slate-900 font-medium')
                                                    }`}
                                                onMouseDown={(e) => {
                                                    if (e.buttons === 1) {
                                                        setSelectionCoords(null);
                                                        setIsSelectingCells(true);
                                                        setSelectionRange({ start: { r: rIdx, c: cIdx }, end: { r: rIdx, c: cIdx } });
                                                    }
                                                }}
                                                onMouseEnter={() => {
                                                    if (isSelectingCells) setSelectionRange(prev => prev ? { ...prev, end: { r: rIdx, c: cIdx } } : null);
                                                }}
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    if (selectionRange) {
                                                        setSelectionCoords({ x: e.clientX, y: e.clientY });
                                                    }
                                                }}
                                            >
                                                {row[col]}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {docData.length > 500 && (
                        <div className="p-8 text-center text-slate-500 font-mono text-[10px] uppercase tracking-widest border-t border-white/5">
                            Showing first 500 rows. Use AI to analyze full dataset.
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col w-full h-full relative overflow-hidden font-sans ${isCodeMode ? 'bg-[#0B0F17]' : 'bg-white'}`}>
            {/* Ambient Background Elements - Very subtle for light mode */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className={`absolute top-0 left-0 w-full h-full bg-gradient-to-b ${isCodeMode ? 'from-transparent' : 'from-slate-50/50'} to-transparent`} />
            </div>

            {SelectionMenu}

            {/* Header Toolbar - Glassmorphism Light */}
            <header className={`h-16 px-6 border-b flex items-center justify-between shrink-0 z-50 relative ${isCodeMode ? 'bg-[#0B0F17] border-slate-800' : 'bg-white/80 border-slate-100'} backdrop-blur-2xl`}>
                <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-[14px] border flex items-center justify-center shadow-sm ${isCodeMode ? 'bg-[#1E2532] border-slate-700' : 'bg-white border-slate-100'}`}>
                        {isCode ? <Code className={`w-5 h-5 ${isCodeMode ? 'text-[var(--color-primary)]' : 'text-[var(--color-primary)]'}`} /> : <FileText className={`w-5 h-5 ${isCodeMode ? 'text-slate-400' : 'text-slate-400'}`} />}
                    </div>
                    <div>
                        <h2 className={`text-xs font-black uppercase tracking-[0.2em] line-clamp-1 ${isCodeMode ? 'text-slate-200' : 'text-slate-800'}`}>{activeDoc.name}</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{formatFileSize(activeDoc.size || 0)}</span>
                            <div className="w-1 h-1 rounded-full bg-slate-200" />
                            <span className="text-[9px] font-bold text-[var(--color-primary)] uppercase tracking-widest">{isSnippet ? 'Virtual Sync' : 'Workspace File'}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    {/* View Controls */}
                    <div className={`flex items-center rounded-xl p-1 border mr-2 ${isCodeMode ? 'bg-[#1E2532] border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                        {isPdf && (
                            <>
                                <button
                                    onClick={() => setPdfViewMode('native')}
                                    className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${pdfViewMode === 'native' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    Native
                                </button>
                                <button
                                    onClick={() => setPdfViewMode('reader')}
                                    className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${pdfViewMode === 'reader' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    Reader
                                </button>
                            </>
                        )}
                        {(lang === 'html' || lang === 'htm' || fileExt === 'html' || fileExt === 'htm') && (
                            <>
                                <button
                                    onClick={() => setDocWorkspaceView('code')}
                                    className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${docWorkspaceView === 'code' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-slate-500 hover:text-[var(--color-primary)]'}`}
                                >
                                    Code
                                </button>
                                <button
                                    onClick={() => setDocWorkspaceView('preview')}
                                    className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${docWorkspaceView === 'preview' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-slate-500 hover:text-[var(--color-primary)]'}`}
                                >
                                    Preview
                                </button>
                            </>
                        )}
                    </div>

                    <div className="h-6 w-px bg-slate-200 mx-1" />

                    <div className="flex items-center gap-1">
                        {!isDocx && !isDoc && !isPdf && (
                            <button
                                onClick={() => setIsEditing(!isEditing)}
                                className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${isEditing ? 'bg-[var(--color-primary)] text-white' : (isCodeMode ? 'bg-[#1E2532] border border-slate-700 text-slate-400 hover:text-[var(--color-primary)]' : 'bg-white border border-slate-200 text-slate-500 hover:text-[var(--color-primary)]')}`}
                                title="Chỉnh sửa nội dung"
                            >
                                <Edit3 className="w-4 h-4" />
                            </button>
                        )}

                        <button
                            onClick={() => { navigator.clipboard.writeText(docContent); toast.success('Đã sao chép toàn bộ!'); }}
                            className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all group ${isCodeMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-[var(--color-primary)]' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-[var(--color-primary)] hover:bg-white'}`}
                            title="Sao chép toàn bộ"
                        >
                            <Copy className="w-4 h-4 group-hover:scale-110" />
                        </button>

                        <button
                            onClick={toggleVersionHistory}
                            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${showHistory ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : (isCodeMode ? 'bg-[#1E2532] border border-slate-700 text-slate-400 hover:text-[var(--color-primary)]' : 'bg-white border border-slate-200 text-slate-500 hover:text-[var(--color-primary)]')}`}
                            title="Lịch sử phiên bản"
                        >
                            <History className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="h-6 w-px bg-white/10 mx-1" />

                    <button
                        onClick={() => setIsAiSidebarOpen(!isAiSidebarOpen)}
                        className={`px-4 h-9 flex items-center gap-2 rounded-xl transition-all shadow-lg text-[10px] font-black uppercase tracking-widest group bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary)]-accent text-white hover:brightness-110 active:scale-95`}
                    >
                        <Sparkles className={`w-3.5 h-3.5 ${isAiSidebarOpen ? 'animate-pulse' : 'group-hover:rotate-12 transition-transform'}`} />
                        <span>AI Assistant</span>
                    </button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative">
                {/* Version History Sidebar */}
                <AnimatePresence>
                    {showHistory && (
                        <motion.div
                            initial={{ x: -320, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -320, opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className={`absolute inset-y-0 left-0 w-80 border-r z-[60] shadow-xl flex flex-col ${isCodeMode ? 'bg-[#0B0F17] border-slate-800' : 'bg-white border-slate-100'}`}
                        >
                            <div className={`p-5 border-b flex items-center justify-between ${isCodeMode ? 'bg-[#1E2532]/30 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                                <div className="flex items-center gap-2">
                                    <History className="w-4 h-4 text-[var(--color-primary)]" />
                                    <h4 className={`text-[11px] font-black uppercase tracking-widest ${isCodeMode ? 'text-slate-200' : 'text-slate-800'}`}>Version History</h4>
                                </div>
                                <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto p-3 space-y-2 custom-scrollbar-dark">
                                {docVersions.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs gap-4 opacity-50">
                                        <div className="w-12 h-12 rounded-full border border-dashed border-slate-700 flex items-center justify-center">
                                            <RotateCcw className="w-6 h-6" />
                                        </div>
                                        <span className="font-bold uppercase tracking-widest">No versions found</span>
                                    </div>
                                ) : (
                                    docVersions.map((v) => (
                                        <div key={v.id} className={`p-4 border rounded-[14px] hover:shadow-md transition-all group relative overflow-hidden ${isCodeMode ? 'bg-[#1E2532] border-slate-800 hover:bg-[#252D3D] hover:border-[var(--color-primary)]/40' : 'bg-slate-50 border-slate-100 hover:bg-white hover:shadow-md'}`}>
                                            <div className="flex justify-between items-center relative z-10">
                                                <div className="flex flex-col">
                                                    <span className={`text-[11px] font-bold ${isCodeMode ? 'text-white' : 'text-slate-800'}`}>{new Date(v.created_at).toLocaleString('vi-VN')}</span>
                                                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest mt-1.5 flex items-center gap-1.5">
                                                        <Save className="w-2.5 h-2.5" />
                                                        {formatFileSize(v.size)}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => handleRestoreVersion(v.id)}
                                                    disabled={isRestoring}
                                                    className="w-8 h-8 flex items-center justify-center bg-[var(--color-primary)] text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110 disabled:opacity-50 shadow-sm"
                                                    title="Khôi phục phiên bản này"
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Main Content Pane */}
                <div className="flex-1 overflow-auto custom-scrollbar-dark relative z-10 flex flex-col">
                    {/* Floating Save Button for Editor */}
                    <AnimatePresence>
                        {isEditing && (
                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: 20, opacity: 0 }}
                                className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[70]"
                            >
                                <button
                                    onClick={() => handleSaveContent(docContent)}
                                    disabled={isSavingDoc}
                                    className="px-8 py-3.5 bg-[var(--color-primary)] text-white rounded-[14px] shadow-xl hover:brightness-110 transition-all flex items-center gap-3 font-black text-xs uppercase tracking-widest active:scale-95 disabled:opacity-50"
                                >
                                    {isSavingDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    <span>Save Changes</span>
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {isEditing ? (
                        <div className={`w-full h-full relative flex flex-col group/editor animate-in fade-in duration-500 ${isCodeMode ? 'bg-[#0B0F17]' : 'bg-white'}`}>
                            {/* Ambient Glow Backgrounds - Subtle */}
                            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--color-primary)]/5 blur-[120px] rounded-full pointer-events-none" />
                            <div className={`absolute bottom-1/4 right-1/4 w-96 h-96 blur-[120px] rounded-full pointer-events-none ${isCodeMode ? 'bg-[var(--color-primary)]/5' : 'bg-slate-100'}`} />

                            {/* Top Accent Bar */}
                            <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-[var(--color-primary)] via-opacity-40 to-transparent shrink-0 z-20" />

                            <textarea
                                value={docContent}
                                onChange={(e) => setDocContent(e.target.value)}
                                className={`flex-1 w-full p-8 outline-none font-mono text-[13px] leading-relaxed resize-none bg-transparent caret-brand selection:bg-[var(--color-primary)] selection:bg-opacity-10 custom-scrollbar z-10 ${isCodeMode ? 'text-slate-300' : 'text-slate-700'}`}
                                placeholder="Write your code or content here..."
                                spellCheck={false}
                                autoFocus
                            />

                            {/* Editor Status Bar - Professional Look */}
                            <div className={`px-6 py-2.5 border-t flex items-center justify-between text-[10px] text-slate-400 font-mono tracking-widest shrink-0 z-20 ${isCodeMode ? 'bg-[#1E2532] border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse shadow-sm" />
                                        <span className={`font-bold uppercase ${isCodeMode ? 'text-slate-400' : 'text-slate-500'}`}>Editor Active</span>
                                    </div>
                                    <span className="hidden md:inline">LINE {docContent.split('\n').length}</span>
                                    <span className="hidden md:inline">UTF-8</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="opacity-60 truncate max-w-[150px]">{activeDoc.name}</span>
                                    <div className="px-2 py-0.5 rounded bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[var(--color-primary)] font-black">
                                        {activeDoc.name.split('.').pop()?.toUpperCase() || 'TXT'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : isPdf ? (
                        <div className="w-full h-full relative overflow-hidden">
                            {/* Native View Container */}
                            <div className={`w-full h-full flex flex-col ${pdfViewMode === 'native' ? 'relative z-10' : 'absolute inset-0 invisible -z-10'}`}>
                                <div className="flex items-center justify-end gap-2 px-4 py-2 bg-slate-800 shrink-0">
                                    <a
                                        href={activeDoc.previewUrl || ''}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        Open PDF
                                    </a>
                                </div>
                                <div className="relative flex-1 bg-slate-900">
                                    {/* Skeleton overlay while loading */}
                                    {!pdfNativeLoaded && (
                                        <div className="absolute inset-0 z-10 bg-slate-900 flex flex-col gap-6 p-8 overflow-hidden pointer-events-none">
                                            {/* Shimmer scan line */}
                                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--color-primary)]/5 to-transparent animate-[scan_2s_ease-in-out_infinite]" style={{ backgroundSize: '100% 60px' }} />
                                            {/* Fake header */}
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-slate-700 animate-pulse" />
                                                <div className="flex-1 space-y-2">
                                                    <div className="h-3 bg-slate-700 rounded-full animate-pulse w-1/3" />
                                                    <div className="h-2 bg-slate-800 rounded-full animate-pulse w-1/4" />
                                                </div>
                                            </div>
                                            {/* Fake document page */}
                                            <div className="mx-auto w-full max-w-xl bg-slate-800/50 rounded-xl p-6 space-y-4">
                                                <div className="h-4 bg-slate-700 rounded-full animate-pulse w-2/3 mx-auto" />
                                                <div className="space-y-2.5 pt-2">
                                                    {[100, 90, 95, 80, 88, 72, 92, 85, 78, 94].map((w, i) => (
                                                        <div key={i} className="h-2.5 bg-slate-700/70 rounded-full animate-pulse" style={{ width: `${w}%`, animationDelay: `${i * 60}ms` }} />
                                                    ))}
                                                </div>
                                                <div className="pt-2 space-y-2">
                                                    {[88, 75, 93, 60].map((w, i) => (
                                                        <div key={i} className="h-2.5 bg-slate-700/70 rounded-full animate-pulse" style={{ width: `${w}%`, animationDelay: `${(i + 10) * 60}ms` }} />
                                                    ))}
                                                </div>
                                            </div>
                                            {/* Loading indicator */}
                                            <div className="flex items-center justify-center gap-3 mt-auto">
                                                <Loader2 className="w-4 h-4 text-[var(--color-primary)] animate-spin" />
                                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Đang tải tài liệu...</span>
                                            </div>
                                        </div>
                                    )}
                                    <iframe
                                        key={activeDoc.previewUrl}
                                        src={`https://docs.google.com/viewer?url=${encodeURIComponent(activeDoc.previewUrl || '')}&embedded=true`}
                                        className="w-full h-full border-none"
                                        title="PDF Viewer"
                                        onLoad={() => setPdfNativeLoaded(true)}
                                    />
                                </div>
                            </div>
                            {/* Reader View Container */}
                            <div className={`pdf-content-container p-8 pb-32 space-y-12 absolute inset-0 scroll-smooth overflow-y-auto overflow-x-hidden custom-scrollbar transition-all duration-300 ${isCodeMode ? 'bg-[#0B0F17]' : 'bg-slate-100'} ${pdfViewMode === 'reader' ? 'z-10 opacity-100' : 'invisible opacity-0 -z-10'}`}>
                                {/* Ambient Background Glow for PDF - Subtle */}
                                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                    <div className="absolute top-1/4 -left-1/4 w-[800px] h-[800px] bg-[var(--color-primary)]/5 blur-[150px] rounded-full" />
                                </div>
                                {docContent.split('[Page ').filter(p => p.trim()).map((page, idx) => {
                                    const pageNum = page.match(/^(\d+)\]/)?.[1] || (idx + 1).toString();
                                    const content = page.replace(/^\d+\]/, '').trim();
                                    return (
                                        <motion.div
                                            initial={{ opacity: 0, y: 40 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true, margin: "-100px" }}
                                            transition={{ duration: 0.8, ease: "easeOut" }}
                                            key={idx}
                                            id={`pdf-page-${pageNum}`}
                                            className={`mx-auto max-w-[850px] min-h-[1100px] p-[80px] relative transition-all duration-500 border group/page ${isCodeMode ? 'bg-[#1E2532] border-slate-800 shadow-2xl shadow-black/40' : 'bg-white shadow-xl border-slate-100 shadow-slate-200/50'}`}
                                        >
                                            <div className="absolute top-10 left-0 right-0 px-16 text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] flex justify-between pointer-events-none select-none opacity-60 group-hover/page:opacity-100 transition-opacity">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />
                                                    <span>Premium AI Insight Mode</span>
                                                </div>
                                                <span>PAGE {pageNum}</span>
                                            </div>
                                            <div className={`text-[17px] leading-[1.9] font-serif whitespace-pre-wrap selection:bg-[var(--color-primary)]/10 mt-12 rounded-sm ${isCodeMode ? 'bg-[#1E2532] text-slate-200' : 'bg-white text-slate-800'}`}>
                                                {content}
                                            </div>

                                            {/* Page Bottom Accent */}
                                            <div className={`absolute bottom-10 left-1/2 -translate-x-1/2 w-48 h-1 rounded-full opacity-50 ${isCodeMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (isExcel || isCsv) ? (
                        <div className={`w-full h-full flex flex-col overflow-hidden ${isCodeMode ? 'bg-[#0B0F17]' : 'bg-white'}`}>
                            {/* Table Toolbar / Sheet Selector */}
                            {sheetNames.length > 1 && (
                                <div className={`p-3 border-b flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0 ${isCodeMode ? 'bg-[#1E2532] border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                                    {sheetNames.map(name => (
                                        <button
                                            key={name}
                                            onClick={() => setActiveSheet(name)}
                                            className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSheet === name ? 'bg-[var(--color-primary)] text-white shadow-sm' : (isCodeMode ? 'bg-[#0B0F17] border border-slate-700 text-slate-400 hover:bg-[#1E2532] hover:text-[var(--color-primary)]' : 'text-slate-500 hover:text-slate-800 bg-white border border-slate-200')}`}
                                        >
                                            {name}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Data Table */}
                            <div className="flex-1 overflow-auto custom-scrollbar relative group/table">
                                <table className={`w-full border-collapse text-[12px] min-w-max relative z-10 ${isCodeMode ? 'text-slate-300' : 'text-slate-600'}`}>
                                    <thead className="sticky top-0 z-20">
                                        <tr className={`backdrop-blur-3xl border-b shadow-sm ${isCodeMode ? 'bg-[#1E2532]/90 border-slate-800' : 'bg-slate-50/90 border-slate-200'}`}>
                                            {docColumns.map((col, i) => (
                                                <th key={i} className={`px-6 py-4 text-left border-b text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ${isCodeMode ? 'border-slate-800' : 'border-slate-100'}`}>
                                                    {col || `Column ${i + 1}`}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className={`divide-y ${isCodeMode ? 'divide-slate-800' : 'divide-slate-50'}`}>
                                        {docData?.map((row, ri) => (
                                            <motion.tr
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: ri * 0.01, duration: 0.3 }}
                                                key={ri}
                                                className={`transition-colors group/row ${isCodeMode ? 'hover:bg-[#1E2532]/50' : 'hover:bg-slate-50/50'}`}
                                            >
                                                {docColumns.map((col, ci) => (
                                                    <td key={ci} className={`px-6 py-3.5 whitespace-nowrap border-r last:border-0 transition-colors ${isCodeMode ? 'border-slate-800 group-hover/row:text-white' : 'border-slate-50 group-hover/row:text-slate-900'}`}>
                                                        {row[col] === null || row[col] === undefined ? '' : String(row[col])}
                                                    </td>
                                                ))}
                                            </motion.tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* Ambient Background Glow for Table */}
                                <div className="absolute inset-0 pointer-events-none opacity-20 group-hover/table:opacity-40 transition-opacity duration-1000">
                                    <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[var(--color-primary)]/5 blur-[120px] rounded-full" />
                                    <div className={`absolute bottom-0 right-1/4 w-[500px] h-[500px] blur-[120px] rounded-full ${isCodeMode ? 'bg-[var(--color-primary)]/5' : 'bg-slate-100'}`} />
                                </div>
                            </div>

                            {/* Table Status Bar */}
                            <div className={`px-6 py-2.5 border-t flex items-center justify-between text-[10px] text-slate-400 font-black uppercase tracking-widest shrink-0 ${isCodeMode ? 'bg-[#1E2532] border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                <div className="flex items-center gap-4">
                                    <span className="flex items-center gap-1.5"><Table className="w-3 h-3 text-[var(--color-primary)]" /> {docData?.length || 0} ROWS</span>
                                    <span className="flex items-center gap-1.5"><Layout className="w-3 h-3 text-slate-400" /> {docColumns.length} COLUMNS</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span>Dataset Analysis Ready</span>
                                </div>
                            </div>
                        </div>
                    ) : (isDoc || isDocx) ? (
                        <div className={`w-full h-full flex flex-col items-center justify-center p-10 text-center gap-6 ${isCodeMode ? 'bg-[#0B0F17]' : 'bg-slate-50'}`}>
                            <div className={`w-20 h-20 rounded-[18px] flex items-center justify-center border ${isCodeMode ? 'bg-[#1E2532] border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                                <FileText className={`w-10 h-10 ${isCodeMode ? 'text-slate-500' : 'text-slate-400'}`} />
                            </div>
                            <div className="space-y-2 max-w-sm">
                                <h3 className={`text-lg font-bold ${isCodeMode ? 'text-white' : 'text-slate-800'}`}>Word Document</h3>
                                <p className="text-sm text-slate-500">
                                    {isDoc
                                        ? 'Định dạng tệp này cần được đồng bộ với máy chủ để xem trước. Vui lòng tải lên lại hoặc chuyển sang định dạng .docx'
                                        : 'Tài liệu này không hỗ trợ xem trực tiếp. Vui lòng tải xuống để xem nội dung đầy đủ.'}
                                </p>
                                <a
                                    href={activeDoc.previewUrl || activeDoc.base64}
                                    download={activeDoc.name}
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-white rounded-[14px] text-xs font-black uppercase tracking-widest shadow-sm transition-all hover:scale-105 mt-4"
                                >
                                    <Download className="w-4 h-4" />
                                    Tải xuống tài liệu
                                </a>
                            </div>
                        </div>
                    ) : isImage ? (
                        <div className={`w-full h-full flex items-center justify-center p-4 ${isCodeMode ? 'bg-[#0B0F17]' : 'bg-slate-100'}`}>
                            <img
                                src={activeDoc.previewUrl || activeDoc.base64}
                                alt={activeDoc.name}
                                onClick={() => setPreviewImage(activeDoc.previewUrl || activeDoc.base64 || null)}
                                className="max-w-full max-h-full object-contain shadow-lg rounded-lg cursor-zoom-in hover:scale-[1.01] transition-transform duration-300"
                            />
                        </div>
                    ) : isCode ? (
                        docWorkspaceView === 'preview' && (lang === 'html' || lang === 'htm' || fileExt === 'html' || fileExt === 'htm') ? (
                            <div className="w-full h-full bg-white">
                                <iframe
                                    srcDoc={docContent}
                                    title="HTML Preview"
                                    className="w-full h-full border-none"
                                />
                            </div>
                        ) : (
                            <div className="w-full h-full overflow-auto custom-scrollbar-dark animate-in fade-in duration-500">
                                <SyntaxHighlighter
                                    language={lang || 'javascript'}
                                    style={vscDarkPlus}
                                    customStyle={{
                                        margin: 0,
                                        padding: '2rem',
                                        fontSize: '13.5px',
                                        lineHeight: '1.7',
                                        background: '#0B0F17',
                                        minHeight: '100%'
                                    }}
                                    showLineNumbers={true}
                                    lineNumberStyle={{ minWidth: '3.5em', paddingRight: '1.2em', color: '#334155', textAlign: 'right', opacity: 0.5 }}
                                >
                                    {docContent}
                                </SyntaxHighlighter>
                            </div>
                        )
                    ) : (
                        <div className={`p-8 text-sm leading-relaxed font-mono whitespace-pre-wrap selection:bg-[var(--color-primary)]/10 ${isCodeMode ? 'text-slate-300' : 'text-slate-400'}`}>
                            {docContent}
                        </div>
                    )}
                </div>

                {/* Floating PDF Page Navigator - Fixed in Workspace Center */}
                {isPdf && pdfViewMode === 'reader' && (
                    <AnimatePresence>
                        <motion.div
                            initial={{ y: 100, x: '-50%', opacity: 0 }}
                            animate={{ y: 0, x: '-50%', opacity: 1 }}
                            exit={{ y: 100, x: '-50%', opacity: 0 }}
                            className={`absolute bottom-8 left-1/2 backdrop-blur-2xl rounded-[14px] shadow-lg z-[80] border overflow-hidden ${isCodeMode ? 'bg-[#1E2532]/95 border-slate-700' : 'bg-white/95 border-slate-200'}`}
                            style={{ transform: 'translateX(-50%)' }}
                        >
                            {/* Search row */}
                            <div className={`flex items-center gap-2 px-3 py-2 border-b ${isCodeMode ? 'border-slate-700' : 'border-slate-100'}`}>
                                <Search className="w-3 h-3 text-slate-400 shrink-0" />
                                <input
                                    ref={pdfSearchRef}
                                    type="text"
                                    value={pdfSearch}
                                    onChange={e => { setPdfSearch(e.target.value); setPdfMatchIndex(0); }}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            if (pdfSearchMatches.length > 0) goToSearchMatch((pdfMatchIndex + 1) % pdfSearchMatches.length);
                                        }
                                        if (e.key === 'Escape') setPdfSearch('');
                                    }}
                                    placeholder="Tìm trong tài liệu..."
                                    className={`flex-1 min-w-[180px] text-[11px] font-medium bg-transparent outline-none placeholder:text-slate-400 ${isCodeMode ? 'text-slate-200' : 'text-slate-700'}`}
                                />
                                {pdfSearch && (
                                    <div className="flex items-center gap-1 shrink-0">
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${pdfSearchMatches.length > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-500 bg-rose-50'}`}>
                                            {pdfSearchMatches.length > 0 ? `${pdfMatchIndex + 1}/${pdfSearchMatches.length}` : '0'}
                                        </span>
                                        <button onClick={() => goToSearchMatch((pdfMatchIndex - 1 + pdfSearchMatches.length) % pdfSearchMatches.length)} disabled={pdfSearchMatches.length === 0} className="p-1 hover:text-[var(--color-primary)] disabled:opacity-30 transition-colors">
                                            <ChevronUp className="w-3 h-3" />
                                        </button>
                                        <button onClick={() => goToSearchMatch((pdfMatchIndex + 1) % pdfSearchMatches.length)} disabled={pdfSearchMatches.length === 0} className="p-1 hover:text-[var(--color-primary)] disabled:opacity-30 transition-colors">
                                            <ChevronDown className="w-3 h-3" />
                                        </button>
                                        <button onClick={() => setPdfSearch('')} className="p-1 hover:text-rose-500 text-slate-400 transition-colors">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            {/* Page nav row */}
                            <div className="flex items-center gap-1 p-2">
                                <div className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border-r shrink-0 ${isCodeMode ? 'text-slate-200 border-slate-700' : 'text-slate-800 border-slate-100'}`}>
                                    Explorer
                                </div>
                                <div ref={pageNavRef} className="flex items-center gap-1 px-2 overflow-x-auto max-w-[300px] no-scrollbar">
                                    {docContent.split('[Page ').filter(p => p.trim()).map((_, i) => {
                                        const num = i + 1;
                                        const isActive = pdfActivePage === num;
                                        return (
                                            <button
                                                key={i}
                                                data-page={num}
                                                onClick={() => (window as any).__navigateToPage(num)}
                                                className={`w-8 h-8 flex items-center justify-center rounded-xl text-[10px] font-bold transition-all shrink-0 ${isActive
                                                    ? 'bg-[var(--color-primary)] text-white shadow-md scale-110'
                                                    : `text-slate-400 hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] ${isCodeMode ? '' : ''}`
                                                    }`}
                                            >
                                                {num}
                                            </button>
                                        );
                                    })}
                                </div>
                                <button
                                    onClick={() => { const el = document.querySelector('.pdf-content-container'); el?.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                    className="w-9 h-9 bg-[var(--color-primary)] text-white rounded-xl flex items-center justify-center shadow-md hover:brightness-110 active:scale-95 transition-all shrink-0"
                                    title="Về đầu trang"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                )}

                {/* Integrated AI Assistant Sidebar */}
                <AnimatePresence>
                    {isAiSidebarOpen && (
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className={`w-96 border-l flex flex-col relative z-50 overflow-hidden shadow-xl ${isCodeMode ? 'bg-[#0B0F17] border-slate-800' : 'bg-white border-slate-100'}`}
                        >
                            {/* AI Sidebar Header */}
                            <div className={`h-16 px-6 border-b flex items-center justify-between ${isCodeMode ? 'bg-[#1E2532]/30 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isCodeMode ? 'bg-[var(--color-primary)]/20' : 'bg-[var(--color-primary)]/10'}`}>
                                        <Sparkles className="w-4 h-4 text-[var(--color-primary)]" />
                                    </div>
                                    <h4 className={`text-[11px] font-black uppercase tracking-widest ${isCodeMode ? 'text-slate-200' : 'text-slate-800'}`}>AI Assistant</h4>
                                </div>
                                <button
                                    onClick={() => setIsAiSidebarOpen(false)}
                                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-all hover:text-slate-600"
                                >
                                    <PanelRightClose className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Chat Messages */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                                {aiMessages.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center px-4">
                                        <div className="w-16 h-16 rounded-[18px] bg-slate-50 border border-slate-100 flex items-center justify-center mb-6">
                                            <MessageSquare className="w-8 h-8 text-slate-300" />
                                        </div>
                                        <h5 className="text-slate-800 text-sm font-bold mb-2 tracking-wide">Work with this document</h5>
                                        <p className="text-slate-500 text-[11px] leading-relaxed max-w-[220px]">
                                            Ask questions, summarize, or extract key insights from {activeDoc.name}.
                                        </p>
                                        <div className="mt-8 grid grid-cols-1 gap-2 w-full">
                                            {[
                                                { label: 'Summarize content', icon: BookOpen },
                                                { label: 'Explain key concepts', icon: Lightbulb },
                                                { label: 'Extract data points', icon: List }
                                            ].map((tip, i) => {
                                                const TipIcon = tip.icon;
                                                return (
                                                    <button
                                                        key={i}
                                                        onClick={() => handleSendAi(tip.label)}
                                                        className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-[14px] text-[10px] font-bold text-slate-500 hover:bg-white hover:border-[var(--color-primary)]/30 hover:text-[var(--color-primary)] transition-all text-left shadow-sm hover:shadow-md group"
                                                    >
                                                        <TipIcon className="w-3.5 h-3.5 group-hover:scale-110" />
                                                        {tip.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    aiMessages.map((msg, i) => (
                                        <div key={msg.id || i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                                            <div className={`max-w-[85%] p-4 rounded-[14px] text-[12px] leading-relaxed shadow-sm ${msg.role === 'user'
                                                ? 'bg-[var(--color-primary)] text-white rounded-br-none'
                                                : 'bg-slate-100 text-slate-700 border border-slate-200 rounded-bl-none'
                                                }`}>
                                                {msg.content}
                                            </div>
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2 px-1">
                                                {msg.role === 'user' ? 'You' : 'Assistant'}
                                            </span>
                                        </div>
                                    ))
                                )}
                                {isAiLoading && (
                                    <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-[14px] animate-pulse">
                                        <Loader2 className="w-4 h-4 text-[var(--color-primary)] animate-spin" />
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Analyzing document...</span>
                                    </div>
                                )}
                            </div>

                            {/* Chat Input */}
                            <div className="p-6 bg-slate-50/80 border-t border-slate-100">
                                <form
                                    onSubmit={(e) => { e.preventDefault(); handleSendAi(); }}
                                    className="relative flex items-center gap-2"
                                >
                                    <input
                                        type="text"
                                        value={aiInput}
                                        onChange={(e) => setAiInput(e.target.value)}
                                        placeholder="Ask about this doc..."
                                        className="flex-1 h-12 bg-white border border-slate-200 rounded-[14px] px-5 text-[12px] text-slate-800 placeholder:text-slate-400 focus:border-[var(--color-primary)]/40 outline-none transition-all pr-12 shadow-sm"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!aiInput.trim() || isAiLoading}
                                        className="absolute right-1.5 w-9 h-9 bg-[var(--color-primary)] text-white rounded-xl shadow-md flex items-center justify-center disabled:opacity-30 disabled:scale-95 transition-all active:scale-90"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                </form>
                                <p className="text-[9px] text-slate-400 mt-3 text-center uppercase font-black tracking-widest">Powered by Advanced Agentic AI</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <InputModal
                isOpen={isRenameModalOpen}
                onClose={() => setIsRenameModalOpen(false)}
                onConfirm={confirmSaveSnippet}
                title="Lưu tài liệu vào Workspace"
                message="Nhập tên cho document (kèm phần mở rộng ví dụ .html, .css):"
                defaultValue={activeDoc.name}
                placeholder="filename.html"
            />

            <ConfirmModal
                isOpen={isRestoreModalOpen}
                onClose={() => setIsRestoreModalOpen(false)}
                onConfirm={confirmRestoreVersion}
                title="Khôi phục phiên bản"
                message="Bạn có chắc muốn khôi phục phiên bản này? Nội dung hiện tại sẽ được lưu vào lịch sử."
                confirmText="Khôi phục"
                variant="warning"
                isLoading={isRestoring}
            />
        </div>
    );
};

export default FilePreview;
