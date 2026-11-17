import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertTriangle, ArrowRight, List, Plus, X, Database, FileSpreadsheet, DownloadCloud, Loader2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Select from '../common/Select';
import Input from '../common/Input';
import Badge from '../common/Badge';
import { attachCustomAttributesForImport, parseSubscriberImportData, VALID_SUBSCRIBER_HEADERS } from '../../utils/importMapping';

interface ImportSubscribersModalProps {
    isOpen: boolean;
    onClose: () => void;
    existingLists: any[];
    existingEmails: Set<string>;
    existingPhones?: Set<string>;
    defaultTab?: 'paste' | 'file';
    onImport: (data: {
        subscribers: any[],
        targetListId: string | null,
        newListName: string | null,
        duplicates: number,
        createVirtualEmail: boolean
    }) => void;
}

const ImportSubscribersModal: React.FC<ImportSubscribersModalProps> = ({
    isOpen, onClose, existingLists, existingEmails, existingPhones = new Set(), onImport, defaultTab = 'paste'
}) => {
    const [step, setStep] = useState(1);
    const [inputMethod, setInputMethod] = useState<'paste' | 'file'>('paste');
    const [rawData, setRawData] = useState('');
    const [fileName, setFileName] = useState('');
    const [parsedRows, setParsedRows] = useState<any[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [importMode, setImportMode] = useState<'new' | 'existing'>('new');
    const [targetListId, setTargetListId] = useState<string>('');
    const [newListName, setNewListName] = useState('');

    const [stats, setStats] = useState({ valid: 0, duplicates: 0, total: 0, missingPhone: 0, virtualCandidates: 0, updateCount: 0, newCount: 0 });
    const [createVirtualEmail, setCreateVirtualEmail] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [importWarnings, setImportWarnings] = useState<string[]>([]);
    const [importColumnMeta, setImportColumnMeta] = useState<{
        columnMapping: Record<number, string>;
        originalHeaders: Record<number, string>;
    }>({ columnMapping: {}, originalHeaders: {} });

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setRawData('');
            setParsedRows([]);
            setFileName('');
            setStats({ valid: 0, duplicates: 0, total: 0, missingPhone: 0, virtualCandidates: 0, updateCount: 0, newCount: 0 });
            setCreateVirtualEmail(false);
            setNewListName('');
            setImportMode('new');
            setInputMethod(defaultTab);
            setImportWarnings([]);
            setImportColumnMeta({ columnMapping: {}, originalHeaders: {} });
        }
    }, [isOpen, defaultTab]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);

        const fileExt = file.name.split('.').pop()?.toLowerCase();
        if (fileExt === 'xlsx' || fileExt === 'xls') {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = new Uint8Array(event.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const csv = XLSX.utils.sheet_to_csv(worksheet);
                    setRawData(csv);
                } catch (error) {
                    toast.error('Lỗi khi đọc file Excel. Vui lòng kiểm tra lại định dạng tệp.');
                    setFileName('');
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result as string;
                setRawData(text);
            };
            reader.readAsText(file);
        }
    };

    const parseData = () => {
        if (!rawData.trim()) return;

        const parsed = parseSubscriberImportData(rawData);
        if (parsed.missingRequiredIdentifiers) {
            if (parsed.headers.length > 0) {
                toast.error('Thiếu cả hai cột tiêu đề quan trọng: Email và Số điện thoại. Vui lòng bổ sung ít nhất một trong hai cột này.');
            }
            return;
        }

        setImportWarnings(parsed.warnings);
        setImportColumnMeta({
            columnMapping: parsed.columnMapping,
            originalHeaders: parsed.originalHeaders,
        });

        const dataRows = parsed.rows;
        let dupCount = 0;
        let updateCount = 0;
        let newCount = 0;
        const validRows: any[] = [];
        const seenEmailsInCsv = new Set<string>();
        const seenPhonesInCsv = new Set<string>();

        dataRows.forEach((row: any) => {
            const email = row.email?.toLowerCase()?.trim() || '';
            const rawDigits = row.phoneNumber ? row.phoneNumber.toString().replace(/[^0-9]/g, '') : '';
            const phone = (rawDigits.length < 7 || /^0+$/.test(rawDigits)) ? '' : rawDigits;
            if (!phone) {
                row.phoneNumber = '';
            }
            let normPhone = phone;
            if (phone.startsWith('84') && phone.length > 9) normPhone = '0' + phone.substring(2);

            if (!email && !normPhone) {
                return;
            }

            // Only treat phone as CSV-duplicate when the row does NOT have a distinct email
            const isDuplicateInCsv = (email && seenEmailsInCsv.has(email)) || (!email && normPhone && seenPhonesInCsv.has(normPhone));

            if (isDuplicateInCsv) {
                dupCount++;
            } else {
                if (email) seenEmailsInCsv.add(email);
                if (normPhone) seenPhonesInCsv.add(normPhone);

                const isExisting = (email && (existingEmails.has(row.email) || existingEmails.has(email))) ||
                    (normPhone && (existingPhones.has(phone) || existingPhones.has(normPhone)));
                if (isExisting) {
                    updateCount++;
                } else {
                    newCount++;
                }

                validRows.push(row);
            }
        });

        if (validRows.length > 0) {
            setHeaders(Object.keys(validRows[0]));
        } else {
            setHeaders(parsed.headers);
        }

        setParsedRows(validRows);
        setStats({
            total: dataRows.length,
            valid: validRows.length,
            newCount: newCount,
            updateCount: updateCount,
            duplicates: dupCount,
            missingPhone: validRows.filter(r => !r.phoneNumber).length,
            virtualCandidates: validRows.filter(r => !r.email || !r.email.includes('@')).length
        });
        setStep(2);
    };

    const handleFinish = async () => {
        if (isLoading) return;
        setIsLoading(true);
        try {
            const subscribersPayload = attachCustomAttributesForImport(
                parsedRows,
                importColumnMeta.columnMapping,
                importColumnMeta.originalHeaders
            );
            await Promise.resolve(onImport({
                subscribers: subscribersPayload,
                targetListId: importMode === 'existing' ? targetListId : null,
                newListName: importMode === 'new' ? newListName : null,
                duplicates: stats.duplicates,
                createVirtualEmail: createVirtualEmail
            }));

            onClose();
        } catch (error) {
            toast.error('Lỗi khi import dữ liệu');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Import danh sách liên hệ"
            size="lg"
            isLoading={isLoading}
            footer={
                <div className="flex justify-between w-full items-center">
                    <div className="flex gap-2">
                        {[1, 2].map(i => (
                            <div key={i} className={`h-1.5 w-8 rounded-full transition-colors ${step >= i ? 'bg-[#2563eb]' : 'bg-slate-200'}`}></div>
                        ))}
                    </div>
                    <div className="flex gap-3">
                        {step === 2 && <Button variant="ghost" onClick={() => setStep(1)}>Quay lại</Button>}
                        {step === 1 ? (
                            <Button onClick={parseData} disabled={!rawData.trim()} icon={ArrowRight}>Tiếp tục</Button>
                        ) : (
                            <Button
                                onClick={handleFinish}
                                disabled={(importMode === 'new' && !newListName) || (importMode === 'existing' && !targetListId) || isLoading}
                                icon={isLoading ? Loader2 : CheckCircle2}
                            >
                                {importMode === 'new' ? 'Tạo & Import' : 'Cập nhật danh sách'}
                            </Button>
                        )}
                    </div>
                </div>
            }
        >
            {step === 1 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="flex bg-slate-100 p-1 rounded-xl w-full">
                        <button
                            onClick={() => setInputMethod('paste')}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${inputMethod === 'paste' ? 'bg-white text-[var(--color-primary)] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <FileText className="w-4 h-4" /> Copy & Paste
                        </button>
                        <button
                            onClick={() => setInputMethod('file')}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${inputMethod === 'file' ? 'bg-white text-[var(--color-primary)] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <FileSpreadsheet className="w-4 h-4" /> Upload CSV/Excel
                        </button>
                    </div>

                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex gap-4">
                        <FileText className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="space-y-2">
                            <h4 className="text-sm font-bold text-blue-800 uppercase tracking-tight">Quy định định dạng (Hợp lệ)</h4>
                            <p className="text-xs text-blue-600 leading-relaxed font-medium flex flex-wrap gap-1.5 items-center mt-1">
                                Hệ thống hỗ trợ:
                                {Object.keys(VALID_SUBSCRIBER_HEADERS).map(key => (
                                    <Badge key={key} variant="brand" className="text-[8px] px-1.5 py-0.5">{key}</Badge>
                                ))}
                            </p>
                            <p className="text-[10px] text-blue-500/80 italic font-medium">
                                Dòng đầu tiên phải là Header. Các cột không nằm trong danh sách trên sẽ được tự động tạo thành <span className="font-bold underline text-blue-700">Trường tùy chỉnh (Custom Fields)</span>.
                            </p>
                        </div>
                    </div>

                    {inputMethod === 'paste' ? (
                        <div>
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Dán dữ liệu vào đây</label>
                            <textarea
                                className="w-full h-64 p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-mono text-xs focus:bg-white focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 outline-none transition-all resize-none placeholder:text-slate-400"
                                placeholder={`Email, First Name, Last Name, Tags, Joined Date\nalice@example.com, Alice, Doe, "VIP, New", 2023-10-25\nbob@gmail.com, , Smith, Lead, 2023-11-01\n...`}
                                value={rawData}
                                onChange={(e) => setRawData(e.target.value)}
                                autoFocus
                            />
                        </div>
                    ) : (
                        <div
                            className="border-2 border-dashed border-slate-300 rounded-[18px] h-64 flex flex-col items-center justify-center bg-slate-50 hover:bg-white hover:border-[var(--color-primary)] transition-all cursor-pointer group"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                type="file"
                                accept=".csv,.txt,.xlsx,.xls"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                            />
                            <div className="p-4 bg-white rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform">
                                <Upload className="w-8 h-8 text-[var(--color-primary)]" />
                            </div>
                            {fileName ? (
                                <div className="text-center">
                                    <p className="text-sm font-black text-slate-800">{fileName}</p>
                                    <p className="text-xs text-emerald-500 font-bold mt-1">Đã tải lên thành công</p>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setRawData(''); setFileName(''); }}
                                        className="mt-4 text-[10px] font-bold text-rose-500 hover:underline"
                                    >
                                        Hủy bỏ
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <p className="text-sm font-black text-slate-800">Bấm để tải tệp lên</p>
                                    <p className="text-xs text-slate-400 mt-1 font-medium">Hỗ trợ định dạng .CSV, .TXT, .XLSX, .XLS</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {step === 2 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                            <p className="text-2xl font-black text-emerald-600">{stats.valid.toLocaleString()}</p>
                            <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest">Hợp lệ (Nhập vào)</p>
                        </div>
                        <div className="p-3.5 bg-blue-50 rounded-2xl border border-blue-100 text-center">
                            <p className="text-2xl font-black text-blue-600">{stats.updateCount.toLocaleString()}</p>
                            <p className="text-[10px] font-bold text-blue-800 uppercase tracking-widest">Cập nhật / Thay tên</p>
                        </div>
                        <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-100 text-center">
                            <p className="text-2xl font-black text-rose-500">{stats.duplicates.toLocaleString()}</p>
                            <p className="text-[10px] font-bold text-rose-700 uppercase tracking-widest">Trùng file (Bỏ qua)</p>
                        </div>
                        <div className="p-3.5 bg-orange-50 rounded-2xl border border-orange-100 text-center">
                            <p className="text-2xl font-black text-orange-500">{stats.missingPhone || 0}</p>
                            <p className="text-[10px] font-bold text-orange-700 uppercase tracking-widest">Thiếu SĐT (Bỏ qua ZNS)</p>
                        </div>
                    </div>

                    {importWarnings.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 text-amber-800">
                            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5 animate-bounce" />
                            <div className="space-y-1">
                                <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">Cảnh báo tiêu đề cột</h4>
                                <ul className="list-disc pl-4 text-xs font-medium space-y-1">
                                    {importWarnings.map((w, idx) => (
                                        <li key={idx}>{w}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    <div className="bg-white border-2 border-slate-100 rounded-[18px] p-5 space-y-4">
                        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <Database className="w-4 h-4 text-[#2563eb]" />
                            Chọn nơi lưu trữ
                        </h4>

                        <div className="grid grid-cols-2 gap-4">
                            <div
                                onClick={() => setImportMode('new')}
                                className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex items-center gap-3 ${importMode === 'new' ? 'border-[#2563eb] bg-orange-50 shadow-sm' : 'border-slate-100 bg-slate-50 hover:bg-white hover:border-slate-300'}`}
                            >
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${importMode === 'new' ? 'border-[#2563eb] bg-[#2563eb] text-white' : 'border-slate-300'}`}>
                                    {importMode === 'new' && <div className="w-2 h-2 bg-white rounded-full" />}
                                </div>
                                <span className="text-xs font-bold text-slate-700">Tạo danh sách mới</span>
                            </div>
                            <div
                                onClick={() => setImportMode('existing')}
                                className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex items-center gap-3 ${importMode === 'existing' ? 'border-[#2563eb] bg-orange-50 shadow-sm' : 'border-slate-100 bg-slate-50 hover:bg-white hover:border-slate-300'}`}
                            >
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${importMode === 'existing' ? 'border-[#2563eb] bg-[#2563eb] text-white' : 'border-slate-300'}`}>
                                    {importMode === 'existing' && <div className="w-2 h-2 bg-white rounded-full" />}
                                </div>
                                <span className="text-xs font-bold text-slate-700">Thêm vào danh sách có sẵn</span>
                            </div>
                        </div>

                        {importMode === 'new' ? (
                            <Input
                                placeholder="VD: Khách hàng sự kiện Tech Expo..."
                                value={newListName}
                                onChange={(e) => setNewListName(e.target.value)}
                                autoFocus
                                icon={Plus}
                            />
                        ) : (
                            <Select
                                options={existingLists.filter(l => l.source !== 'Google Sheets').map(l => ({ value: l.id, label: `${l.name} (${(l.count || 0).toLocaleString()} subscribers)` }))}
                                value={targetListId}
                                onChange={setTargetListId}
                                placeholder="Chọn danh sách đích..."
                                icon={List}
                            />
                        )}

                        {stats.virtualCandidates > 0 && (
                            <div className="pt-2 border-t border-slate-50">
                                <label className="flex items-start gap-3 p-4 bg-orange-50/50 rounded-2xl border border-orange-100 cursor-pointer group hover:bg-orange-50 transition-all">
                                    <div className="pt-0.5">
                                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${createVirtualEmail ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white' : 'border-orange-200 bg-white group-hover:border-orange-300'}`}>
                                            {createVirtualEmail && <Check className="w-3.5 h-3.5" />}
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={createVirtualEmail}
                                            onChange={(e) => setCreateVirtualEmail(e.target.checked)}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-orange-800">Tạo email ảo cho {stats.virtualCandidates} người chỉ có SĐT</p>
                                        <p className="text-[10px] text-orange-600 font-medium mt-0.5">Hệ thống sẽ tự động tạo email dạng <code>{"{phone}@no-email.domation"}</code> để định danh.</p>
                                    </div>
                                </label>
                            </div>
                        )}
                    </div>

                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Xem trước 3 dòng đầu</p>
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase">
                                    <tr>
                                        {parsedRows.length > 0 && Object.keys(parsedRows[0]).map((key, i) => (
                                            <th key={i} className="px-4 py-3">{key}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {parsedRows.slice(0, 3).map((row, i) => (
                                        <tr key={i}>
                                            {Object.values(row).map((val: any, j) => (
                                                <td key={j} className="px-4 py-2 text-slate-700">{val}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default ImportSubscribersModal;
