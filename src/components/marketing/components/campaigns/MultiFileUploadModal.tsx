import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, UploadCloud, CheckCircle2, AlertTriangle, Loader2, File as FileIcon, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../services/storageAdapter';
import { getMktPortalRoot } from '../../utils/portalRoot';

interface MultiFileUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUploadComplete: (attachments: any[]) => void;
    targetConfig: any; // formData.target
}

export const MultiFileUploadModal: React.FC<MultiFileUploadModalProps> = ({ isOpen, onClose, onUploadComplete, targetConfig }) => {
    const [files, setFiles] = useState<{ file: File; email: string | null; status: 'pending' | 'error' | 'matched' | 'unmatched' | 'uploading' | 'success' | 'failed' }[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) {
            setFiles([]);
            setIsChecking(false);
            setIsUploading(false);
        }
    }, [isOpen]);

    const EXTRACT_REGEX = /_([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;

    const processFiles = async (selectedFiles: File[]) => {
        setIsChecking(true);
        const parsedFiles = selectedFiles.map(file => {
            const lastDotIndex = file.name.lastIndexOf('.');
            const nameWithoutExt = lastDotIndex !== -1 ? file.name.substring(0, lastDotIndex) : file.name;
            const match = EXTRACT_REGEX.exec(nameWithoutExt);
            if (match && match[1]) {
                return { file, email: match[1], status: 'pending' as const };
            }
            return { file, email: null, status: 'error' as const };
        });

        const emailsToCheck = parsedFiles.filter(f => f.email).map(f => f.email) as string[];

        let matchedEmails = new Set<string>();

        if (emailsToCheck.length > 0) {
            try {
                const res = await api.post<any>('check_file_matches.php', { target: targetConfig, emails: emailsToCheck });
                if (res.success && res.data?.matched) {
                    matchedEmails = new Set(res.data.matched.map((e: string) => e.toLowerCase()));
                }
            } catch (err) {
                console.error("Match check failed", err);
            }
        }

        const evaluatedFiles = parsedFiles.map(f => {
            if (f.status === 'error') return f;
            if (f.email && matchedEmails.has(f.email.toLowerCase())) {
                return { ...f, status: 'matched' as const };
            }
            return { ...f, status: 'unmatched' as const };
        });

        setFiles(prev => [...prev, ...evaluatedFiles]);
        setIsChecking(false);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            processFiles(Array.from(e.target.files));
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) {
            processFiles(Array.from(e.dataTransfer.files));
        }
    };

    const handleUploadExecution = async () => {
        const filesToUpload = files.filter(f => f.status === 'matched' || f.status === 'unmatched');
        if (filesToUpload.length === 0) {
            toast.error('Không có tệp hợp lệ nào để tải lên.');
            return;
        }

        setIsUploading(true);
        const results: any[] = [];
        
        // Update status to uploading
        setFiles(prev => prev.map(f => filesToUpload.includes(f) ? { ...f, status: 'uploading' } : f));

        // Chunk upload array to prevent memory exhaustion / timeout
        const CHUNK_SIZE = 5;
        for (let i = 0; i < filesToUpload.length; i += CHUNK_SIZE) {
            const chunk = filesToUpload.slice(i, i + CHUNK_SIZE);
            const uploadPromises = chunk.map(async (fileObj) => {
                const formData = new FormData();
                formData.append('file', fileObj.file);
                try {
                    const res = await api.post('upload', formData);
                    if (res.success) {
                        return { fileObj, success: true, data: res.data };
                    }
                    return { fileObj, success: false };
                } catch {
                    return { fileObj, success: false };
                }
            });

            const batchResults = await Promise.all(uploadPromises);
            
            setFiles(prev => prev.map(f => {
                const match = batchResults.find(b => b.fileObj === f);
                if (match) {
                     return { ...f, status: match.success ? 'success' : 'failed' };
                }
                return f;
            }));

            const successes = batchResults
                .filter(b => b.success && b.data)
                .map((b: any) => ({
                    id: crypto.randomUUID(),
                    name: b.data.name,
                    url: b.data.url,
                    path: b.data.path,
                    size: b.data.size,
                    type: b.data.type,
                    logic: 'match_email'
                }));
            results.push(...successes);
        }

        if (results.length > 0) {
            toast.success(`Tải lên thành công ${results.length} tệp.`);
            onUploadComplete(results);
            setTimeout(() => onClose(), 1500);
        } else {
            toast.error('Không tải lên được tệp nào.');
        }
        setIsUploading(false);
    };

    if (!isOpen) return null;

    // Sorting logic: Error -> Unmatched -> Matched -> Uploading -> Success/Failed
    const sortedFiles = [...files].sort((a, b) => {
        const order = { error: 0, unmatched: 1, matched: 2, uploading: 3, failed: 4, success: 5 };
        return (order[a.status] ?? 99) - (order[b.status] ?? 99);
    });

    const errorCount = files.filter(f => f.status === 'error').length;
    const unmatchedCount = files.filter(f => f.status === 'unmatched').length;
    const matchedCount = files.filter(f => f.status === 'matched').length;
    const successCount = files.filter(f => f.status === 'success').length;

    const modalContent = (
        <div className="fixed inset-0 z-[2147483646] flex items-center justify-center p-4 bg-slate-950/70 animate-in fade-in duration-300" style={{ zIndex: 2147483646 }}>
            <div className="bg-white rounded-[18px] shadow-2xl w-full max-w-5xl h-[85vh] min-h-[600px] flex flex-col overflow-hidden animate-in zoom-in-95">
                
                {/* HEAD */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100 rounded-bl-full -mr-16 -mt-16 opacity-50"></div>
                    <div className="flex items-center gap-4 relative z-10">
                         <div className="w-12 h-12 bg-blue-600 text-white rounded-[14px] flex items-center justify-center shadow-lg shadow-blue-200">
                             <UploadCloud className="w-6 h-6" />
                         </div>
                         <div>
                             <h2 className="text-xl font-black text-slate-800">Tải lên tệp cá nhân hóa</h2>
                             <p className="text-xs text-slate-500 font-medium">DOMATION sẽ tự động phân tích và đối soát khách hàng trước khi tải lên</p>
                         </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 bg-white rounded-xl shadow-sm relative z-10 transition-colors"><X className="w-5 h-5"/></button>
                </div>

                {/* BODY */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-white">
                     
                     {/* LEFT PANEL */}
                     <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-100 p-6 flex flex-col bg-slate-50/50">
                        <div 
                            onDragEnter={() => setIsDragging(true)}
                            onDragOver={(e) => e.preventDefault()}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-[18px] p-6 text-center cursor-pointer transition-all duration-300 ${isDragging ? 'border-blue-500 bg-blue-50 scale-105' : 'border-slate-300 hover:border-blue-400 bg-white hover:bg-slate-50'}`}
                        >
                            <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} disabled={isChecking || isUploading}/>
                            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
                               <UploadCloud className="w-8 h-8" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-700 mb-2">Thêm tệp đính kèm</h3>
                            <p className="text-[10px] text-slate-400 font-medium px-4">Kéo thả tệp vào đây hoặc bấm để chọn tệp từ máy tính.</p>
                        </div>
                        
                        <div className="mt-6 space-y-3">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 block">Thống kê đối soát</h4>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5"/> Đã khớp (Matched)</span>
                                    <span className="text-sm font-black text-slate-800">{matchedCount}</span>
                                </div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-amber-600 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5"/> Chưa khớp (Unmatched)</span>
                                    <span className="text-sm font-black text-slate-800">{unmatchedCount}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-rose-600 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5"/> Tên sai (Error)</span>
                                    <span className="text-sm font-black text-slate-800">{errorCount}</span>
                                </div>
                            </div>
                        </div>
                     </div>

                     {/* RIGHT PANEL - LIST */}
                     <div className="flex-1 p-6 flex flex-col overflow-hidden relative">
                         {isChecking && (
                             <div className="absolute inset-0 bg-white/95 z-10 flex flex-col items-center justify-center">
                                 <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                                 <p className="text-sm font-bold text-slate-700">Đang phân tích và đối soát Database...</p>
                             </div>
                         )}

                         <div className="flex items-center justify-between mb-4">
                             <h4 className="text-[11px] font-black uppercase text-slate-500 tracking-widest">Danh sách các tệp ({files.length})</h4>
                             {files.length > 0 && <button onClick={() => setFiles([])} disabled={isUploading} className="text-[10px] text-rose-500 hover:underline font-bold uppercase transition-all">Xóa tất cả</button>}
                         </div>

                         {files.length === 0 ? (
                             <div className="flex-1 flex flex-col items-center justify-center opacity-40">
                                 <FileIcon className="w-16 h-16 mb-4 text-slate-300" />
                                 <p className="text-sm font-bold">Chưa có tệp nào</p>
                             </div>
                         ) : (
                             <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
                                 {sortedFiles.map((fileObj, idx) => (
                                     <div key={idx} className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                                         fileObj.status === 'error' ? 'bg-rose-50 border-rose-200' :
                                         fileObj.status === 'unmatched' ? 'bg-amber-50 border-amber-200' :
                                         fileObj.status === 'success' ? 'bg-emerald-50 border-emerald-200' :
                                         fileObj.status === 'matched' ? 'bg-blue-50/50 border-blue-100' :
                                         'bg-slate-50 border-slate-200 opacity-60'
                                     }`}>
                                         <div className="flex items-center gap-3 overflow-hidden flex-1">
                                             <FileIcon className={`w-5 h-5 shrink-0 ${fileObj.status === 'error' ? 'text-rose-500' : fileObj.status === 'unmatched' ? 'text-amber-500' : fileObj.status === 'success' ? 'text-emerald-500' : 'text-blue-500'}`} />
                                             <div className="truncate">
                                                 <p className="text-xs font-bold text-slate-700 truncate" title={fileObj.file.name}>{fileObj.file.name}</p>
                                                 {fileObj.email ? <p className="text-[9px] text-slate-500 font-mono mt-0.5">{fileObj.email}</p> : <p className="text-[9px] text-rose-500 font-mono mt-0.5">Không tìm thấy đuôi _email@domain</p>}
                                             </div>
                                         </div>
                                         <div className="shrink-0 pl-3">
                                             {fileObj.status === 'error' && <span className="text-[9px] font-bold px-2 py-1 rounded bg-rose-100 text-rose-700 uppercase">Sai Định Dạng</span>}
                                             {fileObj.status === 'unmatched' && <span className="text-[9px] font-bold px-2 py-1 rounded bg-amber-100 text-amber-700 uppercase" title="Email này không nằm trong danh sách Chọn Mục Tiêu của Chiến dịch">Ko Thuộc Tập Gửi</span>}
                                             {fileObj.status === 'matched' && <span className="text-[9px] font-bold px-2 py-1 rounded bg-blue-100 text-blue-700 uppercase">Hợp Lệ</span>}
                                             {fileObj.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                                             {fileObj.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                             {fileObj.status === 'failed' && <X className="w-4 h-4 text-rose-500" />}
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         )}
                     </div>
                </div>

                {/* FOOTER */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                    <p className="text-[10px] font-medium text-slate-400">
                        {isUploading ? `Đang tải lên... Thành công: ${successCount}` : `Có ${errorCount + unmatchedCount} tệp không đạt chuẩn có thể không được gửi đi.`}
                    </p>
                    <div className="flex gap-3">
                        <button onClick={onClose} disabled={isUploading} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 bg-white border border-slate-200 hover:bg-slate-50">Hủy bỏ</button>
                        <button 
                            onClick={handleUploadExecution} 
                            disabled={isUploading || isChecking || files.length === 0 || (matchedCount === 0 && unmatchedCount === 0)}
                            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200 flex items-center gap-2 disabled:opacity-50 transition-all"
                        >
                            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                            {isUploading ? 'Đang Upload...' : `Tải lên ${matchedCount + unmatchedCount} tệp hợp lệ`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, getMktPortalRoot());
};
