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

    const detectDelimiter = (str: string) => {
        const firstLine = str.split('\n')[0];
        if (firstLine.includes('\t')) return '\t';
        if (firstLine.includes(';')) return ';';
        return ',';
    };

    const formatNameFromEmail = (email: string) => {
        if (!email) return 'User';
        const localPart = email.split('@')[0];
        // Loại bỏ số và ký tự đặc biệt, chỉ giữ lại chữ cái
        const cleaned = localPart.replace(/[^a-zA-Z]/g, '');
        if (!cleaned) return 'User';
        // Viết hoa chữ đầu, còn lại viết thường
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
    };

    const VALID_HEADERS = {
        email: ['email', 'mail', 'hòm thư', 'hom thu', 'địa chỉ email', 'dia chi email', 'e-mail'],
        firstName: [
            'firstname', 'tên', 'first name', 'given name', 'ten', 'họ tên', 'ho ten',
            'họ và tên', 'ho va ten', 'full name', 'fullname', 'tên khách hàng', 'ten khach hang',
            'name', 'tên khách', 'ten khach', 'họ và tên khách hàng', 'ho va ten khach hang',
            'người liên hệ', 'nguoi lien he', 'customer name', 'customer_name', 'user name', 'username'
        ],
        lastName: ['lastname', 'họ', 'last name', 'family name', 'ho', 'họ đệm', 'ho dem', 'surname', 'last_name'],
        phoneNumber: ['phone', 'số điện thoại', 'sđt', 'telephone', 'mobile', 'dien thoai', 'so dien thoai', 'SDT', 'sdt', 'di động', 'di dong'],
        jobTitle: ['job', 'chức vụ', 'vị trí', 'title', 'cong viec', 'chuc vu', 'vi tri', 'chức danh', 'chuc danh'],
        companyName: ['company', 'công ty', 'tổ chức', 'organization', 'cong ty', 'to chuc', 'đơn vị', 'don vi'],
        city: ['city', 'thành phố', 'tỉnh', 'thanh pho', 'tinh'],
        country: ['country', 'quốc gia', 'quoc gia'],
        gender: ['gender', 'giới tính', 'sex', 'gioi tinh'],
        dateOfBirth: ['birth', 'ngày sinh', 'dob', 'birthday', 'ngay sinh', 'ngaysinh'],
        anniversaryDate: ['anniversary', 'ngày kỷ niệm', 'ngay kỷ niem'],
        tags: ['tags', 'nhãn', 'tag', 'nhan'],
        source: ['source', 'nguồn', 'origin', 'nguon'],
        salesperson: ['salesperson', 'sales', 'nhân viên', 'nv kinh doanh', 'nhan vien'],
        joinedAt: ['joinedat', 'ngày tham gia', 'date', 'ngày', 'ngay tham gia']
    };

    const parseCSV = (text: string, delimiter: string = ','): string[][] => {
        const result: string[][] = [];
        let row: string[] = [];
        let current = '';
        let inQuotes = false;
        
        const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const textToParse = cleanText.endsWith('\n') ? cleanText : cleanText + '\n';
        
        for (let i = 0; i < textToParse.length; i++) {
            const char = textToParse[i];
            
            if (char === '"') {
                if (inQuotes && textToParse[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === delimiter && !inQuotes) {
                row.push(current);
                current = '';
            } else if (char === '\n' && !inQuotes) {
                row.push(current);
                if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
                    result.push(row);
                }
                row = [];
                current = '';
            } else {
                current += char;
            }
        }
        return result;
    };

    const parseData = () => {
        if (!rawData.trim()) return;

        const delimiter = detectDelimiter(rawData);
        const parsedAll = parseCSV(rawData.trim(), delimiter);
        if (parsedAll.length === 0) return;

        const headerRow = parsedAll[0].map(h => h.trim());

        // Xác định các cột hợp lệ và cột tùy chỉnh
        const columnMapping: { [index: number]: string } = {};
        headerRow.forEach((header, index) => {
            const lowerHeader = header.toLowerCase().trim();
            let matched = false;
            for (const [key, patterns] of Object.entries(VALID_HEADERS)) {
                if (patterns.some(p => lowerHeader === p.toLowerCase() || lowerHeader.split(/[\s_-]+/).some(word => word === p.toLowerCase()))) {
                    columnMapping[index] = key;
                    matched = true;
                    break;
                }
            }
            // Nếu không khớp với trường chuẩn, giữ header gốc làm key tùy chỉnh
            if (!matched) {
                columnMapping[index] = header;
            }
        });

        const mappedKeys = Object.values(columnMapping);
        const hasEmail = mappedKeys.includes('email');
        const hasPhone = mappedKeys.includes('phoneNumber');
        const hasName = mappedKeys.includes('firstName') || mappedKeys.includes('lastName');

        // Check if first row contains data instead of headers
        const isHeaderRowData = headerRow.some(header => {
            if (header.includes('@') && header.includes('.')) return true;
            const cleanPhone = header.replace(/[^0-9]/g, '');
            if ((cleanPhone.startsWith('0') || cleanPhone.startsWith('84')) && cleanPhone.length >= 9 && cleanPhone.length <= 12) return true;
            return false;
        });

        if (!hasEmail && !hasPhone) {
            toast.error('Thiếu cả hai cột tiêu đề quan trọng: Email và Số điện thoại. Vui lòng bổ sung ít nhất một trong hai cột này.');
            return;
        }

        const currentWarnings: string[] = [];
        if (isHeaderRowData) {
            currentWarnings.push('Phát hiện dòng tiêu đề đầu tiên có thể chứa dữ liệu khách hàng (Email/SĐT). Có vẻ như tệp của bạn đang thiếu hàng tiêu đề cột.');
        }
        if (!hasEmail) {
            currentWarnings.push('Thiếu cột tiêu đề Email (hệ thống sẽ không thể gửi email cho các liên hệ này).');
        }
        if (!hasPhone) {
            currentWarnings.push('Thiếu cột tiêu đề Số điện thoại (hệ thống sẽ không thể gửi tin nhắn ZNS/SMS cho các liên hệ này).');
        }
        if (!hasName) {
            currentWarnings.push('Thiếu cột tiêu đề Họ & Tên (liên hệ sẽ được đặt tên tạm thời dựa trên Email/SĐT).');
        }
        setImportWarnings(currentWarnings);

        const dataRows = parsedAll.slice(1).map(values => {
            const trimmedValues = values.map(v => v.trim());
            if (trimmedValues.length === 0 || (trimmedValues.length === 1 && !trimmedValues[0])) return null;

            const rowObj: any = {};

            Object.keys(columnMapping).forEach(indexStr => {
                const index = parseInt(indexStr);
                const key = columnMapping[index];
                rowObj[key] = trimmedValues[index] || '';
            });

            if (rowObj.email && !rowObj.firstName) {
                rowObj.firstName = formatNameFromEmail(rowObj.email);
            }

            return rowObj;
        }).filter(r => r && ((r.email && r.email.includes('@')) || r.phoneNumber));

        let dupCount = 0;
        let updateCount = 0;
        let newCount = 0;
        const validRows: any[] = [];
        const seenEmailsInCsv = new Set<string>();
        const seenPhonesInCsv = new Set<string>();

        dataRows.forEach((row: any) => {
            const email = row.email?.toLowerCase()?.trim() || '';
            const phone = row.phoneNumber ? row.phoneNumber.toString().replace(/[^0-9]/g, '') : '';
            // Simple normalization for frontend check
            let normPhone = phone;
            if (phone.startsWith('84') && phone.length > 9) normPhone = '0' + phone.substring(2);

            const isDuplicateInCsv = (email && seenEmailsInCsv.has(email)) || (normPhone && seenPhonesInCsv.has(normPhone));
            
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

        // Chỉ hiển thị các label chuẩn trong setHeaders để preview đẹp hơn, 
        // hoặc hiển thị tất cả keys thực tế. Ở đây hiển thị tất cả keys thực tế từ rowObj đầu tiên.
        if (validRows.length > 0) {
            setHeaders(Object.keys(validRows[0]));
        } else {
            setHeaders(Object.values(columnMapping));
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
            await Promise.resolve(onImport({
                subscribers: parsedRows,
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
                            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${inputMethod === 'paste' ? 'bg-white text-[#ca7900] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <FileText className="w-4 h-4" /> Copy & Paste
                        </button>
                        <button
                            onClick={() => setInputMethod('file')}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${inputMethod === 'file' ? 'bg-white text-[#ca7900] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
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
                                {Object.keys(VALID_HEADERS).map(key => (
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
                                className="w-full h-64 p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-mono text-xs focus:bg-white focus:border-[#2563eb] focus:ring-4 focus:ring-orange-50/10 outline-none transition-all resize-none placeholder:text-slate-400"
                                placeholder={`Email, First Name, Last Name, Tags, Joined Date\nalice@example.com, Alice, Doe, "VIP, New", 2023-10-25\nbob@gmail.com, , Smith, Lead, 2023-11-01\n...`}
                                value={rawData}
                                onChange={(e) => setRawData(e.target.value)}
                                autoFocus
                            />
                        </div>
                    ) : (
                        <div
                            className="border-2 border-dashed border-slate-300 rounded-[32px] h-64 flex flex-col items-center justify-center bg-slate-50 hover:bg-white hover:border-[#2563eb] transition-all cursor-pointer group"
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
                                <Upload className="w-8 h-8 text-[#2563eb]" />
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

                    <div className="bg-white border-2 border-slate-100 rounded-[24px] p-5 space-y-4">
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
                                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${createVirtualEmail ? 'bg-orange-500 border-orange-500 text-white' : 'border-orange-200 bg-white group-hover:border-orange-300'}`}>
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
