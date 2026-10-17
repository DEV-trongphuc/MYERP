import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { api } from '../../services/storageAdapter';
import { Search, Users, Layers, List, Plus, CheckCircle2, Upload, FileText, X, ArrowRight, Sparkles, Tag, RefreshCw, Zap, ChevronDown, Check, AlertTriangle } from 'lucide-react';
import Button from '../common/Button';
import Input from '../common/Input';
import Badge from '../common/Badge';
import { isManualList, isSyncList } from '../../utils/listHelpers';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface Option {
    value: string;
    label: string;
    subLabel?: string;
    icon?: React.ReactNode;
}

const CustomSelect: React.FC<{
    value: string;
    options: Option[];
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    icon?: React.ReactNode;
}> = ({ value, options, onChange, placeholder, disabled, icon }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.value === value);

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full px-4 py-3 flex items-center justify-between bg-white border-2 rounded-xl text-sm font-medium transition-all ${isOpen
                    ? 'border-blue-500 ring-4 ring-blue-500/10'
                    : 'border-slate-200 hover:border-blue-300'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    {icon}
                    <span className={`block truncate ${!selectedOption ? 'text-slate-400' : 'text-slate-700'}`}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-xl shadow-xl max-h-60 overflow-auto divide-y divide-slate-50 animate-in fade-in zoom-in-95 duration-100">
                    {options.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400 italic">
                            Không có dữ liệu
                        </div>
                    ) : (
                        options.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={`w-full px-4 py-3 flex items-start text-left hover:bg-blue-50 transition-colors group ${option.value === value ? 'bg-blue-50/50' : ''
                                    }`}
                            >
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate ${option.value === value ? 'text-blue-700' : 'text-slate-700'
                                        }`}>
                                        {option.label}
                                    </p>
                                    {option.subLabel && (
                                        <p className="text-xs text-slate-400 mt-0.5 truncate group-hover:text-blue-400">
                                            {option.subLabel}
                                        </p>
                                    )}
                                </div>
                                {option.value === value && (
                                    <Check className="w-4 h-4 text-blue-600 mt-0.5 ml-2 shrink-0" />
                                )}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

interface AudienceSelectorProps {
    allLists: any[];
    allSegments: any[];
    allTags?: any[];
    selectedTarget: { listIds: string[], segmentIds: string[], tagIds?: string[] };
    onTargetChange: (target: { listIds: string[], segmentIds: string[], tagIds: string[] }) => void;
    // Fix: Removed onPasteData as the functionality is now handled by onImport
    // onPasteData: (subscribers: any[], mode: 'new' | 'existing', listIdOrName: string) => void;
    error?: boolean;
    // Fix: Added existingEmails and onImport to props
    existingEmails: Set<string>;
    onImport: (data: {
        subscribers: any[],
        targetListId: string | null,
        newListName: string | null,
        duplicates: number
    }) => Promise<void>; // Changed return type to Promise<void>
    campaignType?: string;
}

const AudienceSelector: React.FC<AudienceSelectorProps> = ({
    allLists, allSegments, allTags = [], selectedTarget, onTargetChange, error,
    existingEmails, onImport, campaignType // Destructure campaignType
}) => {
    const [activeTab, setActiveTab] = useState<'lists' | 'segments' | 'tags' | 'sheets'>('lists');
    const [search, setSearch] = useState('');

    const [isImporting, setIsImporting] = useState(false);
    // Fix: Renamed importStep to step for consistency with usage
    const [step, setStep] = useState(1);
    const [rawData, setRawData] = useState('');
    const [fileName, setFileName] = useState('');
    // Fix: Add headers and setHeaders to state
    const [headers, setHeaders] = useState<string[]>([]);
    const [parsedRows, setParsedRows] = useState<any[]>([]);

    const [importMode, setImportMode] = useState<'new' | 'existing'>('new');
    const [targetListId, setTargetListId] = useState<string>('');
    const [newListName, setNewListName] = useState('');

    // Fix: Add stats and setStats to state
    const [stats, setStats] = useState({ valid: 0, duplicates: 0, total: 0 });
    // Fix: Declare inputMethod state
    const [inputMethod, setInputMethod] = useState<'paste' | 'file'>('paste');
    const [importWarnings, setImportWarnings] = useState<string[]>([]);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const downloadSampleCSV = () => {
        const headers = ['phone', 'fullname', 'email', 'tags'];
        const sampleRows = [
            ['0912345678', 'Nguyen Van A', 'vana@example.com', 'Khách hàng moi'],
            ['0987654321', 'Tran Thi B', 'thib@example.com', 'VIP']
        ];
        const csvContent = [headers, ...sampleRows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "sample_contacts.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    // Fix: existingEmails is a Set, no need for .has property, it's a direct method
    // const existingEmailsSet = useMemo(() => new Set(existingEmails), [existingEmails]);

    // Fix: Changed useEffect dependency from `isOpen` to `isImporting`
    useEffect(() => {
        if (isImporting) {
            setStep(1);
            setRawData('');
            setParsedRows([]);
            setFileName('');
            setStats({ valid: 0, duplicates: 0, total: 0 });
            setNewListName('');
            setImportMode('new');
            // Fix: Use defaultTab prop for initial input method
            // setInputMethod(defaultTab);
            // The prop defaultTab is not passed to AudienceSelector, so keep it as 'paste' for now.
            // It's likely intended for the ImportSubscribersModal.
            // Fix: `setInputMethod` is a state setter, ensuring it's available.
            setInputMethod('paste');
            setImportWarnings([]);
        }
    }, [isImporting]);

    const manualLists = allLists.filter(isManualList);
    const sheetLists = allLists.filter(isSyncList);

    const filteredLists = manualLists.filter(l => l.name.toLowerCase().includes(search.toLowerCase()));
    const filteredSheets = sheetLists.filter(l => l.name.toLowerCase().includes(search.toLowerCase()));
    const filteredSegs = allSegments.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
    // FIX: Ensure allTags is an array before filtering
    const filteredTags = Array.isArray(allTags) ? allTags.filter(t => t.name.toLowerCase().includes(search.toLowerCase())) : [];

    const selectedListCount = (selectedTarget.listIds || []).filter(id => manualLists.some(l => l.id === id)).length;
    const selectedSheetCount = (selectedTarget.listIds || []).filter(id => sheetLists.some(l => l.id === id)).length;
    const selectedSegCount = selectedTarget.segmentIds?.length || 0;
    // FIX: Ensure selectedTarget.tagIds is an array before checking length
    const selectedTagCount = (Array.isArray(selectedTarget.tagIds) ? selectedTarget.tagIds : []).length || 0;

    const toggle = (type: 'list' | 'segment' | 'tag', id: string) => {
        const newTarget = {
            listIds: selectedTarget.listIds || [],
            segmentIds: selectedTarget.segmentIds || [],
            // FIX: Ensure selectedTarget.tagIds is an array
            tagIds: Array.isArray(selectedTarget.tagIds) ? [...selectedTarget.tagIds] : []
        };

        const key = type === 'list' ? 'listIds' : (type === 'segment' ? 'segmentIds' : 'tagIds');

        if (newTarget[key].includes(id)) {
            newTarget[key] = newTarget[key].filter(x => x !== id);
        } else {
            newTarget[key] = [...newTarget[key], id];
        }
        onTargetChange(newTarget);
    };

    const [estimatedReach, setEstimatedReach] = useState<number>(0);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Debounce API call
    useEffect(() => {
        const handler = setTimeout(async () => {
            try {
                // Only query if we have at least one selection
                const hasSelection = (selectedTarget.listIds?.length || 0) +
                    (selectedTarget.segmentIds?.length || 0) +
                    (selectedTarget.tagIds?.length || 0) > 0;

                if (hasSelection) {
                    // Fix: Cast to any to access api.post which might not be fully typed in the adapter import
                    const res = await (api as any).post('campaigns.php?route=estimate_reach', {
                        ...selectedTarget,
                        campaignType
                    });
                    if (res && res.success) {
                        setEstimatedReach(res.data.count);
                    } else if (res && typeof res.count === 'number') {
                        setEstimatedReach(res.count);
                    }
                } else {
                    setEstimatedReach(0);
                }
            } catch (e) {
                console.error("Failed to estimate reach", e);
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(handler);
    }, [selectedTarget]);

    // P1 FIX: Manual refresh function
    const refreshEstimate = async () => {
        setIsRefreshing(true);
        try {
            const hasSelection = (selectedTarget.listIds?.length || 0) +
                (selectedTarget.segmentIds?.length || 0) +
                (selectedTarget.tagIds?.length || 0) > 0;

            if (hasSelection) {
                const res = await (api as any).post('campaigns.php?route=estimate_reach', {
                    ...selectedTarget,
                    campaignType
                });
                if (res && res.success) {
                    setEstimatedReach(res.data.count);
                } else if (res && typeof res.count === 'number') {
                    setEstimatedReach(res.count);
                }
            } else {
                setEstimatedReach(0);
            }
        } catch (e) {
            console.error("Failed to estimate reach", e);
        } finally {
            setIsRefreshing(false);
        }
    };

    // Removed local calculateTotal function

    const formatNameFromEmail = (email: string) => {
        if (!email) return 'User';
        const localPart = email.split('@')[0];
        // Loại bỏ số và ký tự đặc biệt, chỉ giữ lại chữ cái
        const cleaned = localPart.replace(/[^a-zA-Z]/g, '');
        if (!cleaned) return 'User';
        // Viết hoa chữ đầu, còn lại viết thường
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
    };

    const parseData = () => {
        if (!rawData.trim()) return;

        const delimiter = detectDelimiter(rawData);
        const lines = rawData.trim().split('\n');
        const headerRow = lines[0].split(delimiter).map(h => h.trim().replace(/['"]+/g, ''));
        // Fix: Use setHeaders for state update
        setHeaders(headerRow);

        let hasEmail = false;
        let hasPhone = false;
        let hasName = false;

        headerRow.forEach(header => {
            const key = header.toLowerCase().trim();
            if (key.includes('phone') || key.includes('sđt') || key.includes('số điện thoại') || key.includes('dien thoai')) hasPhone = true;
            else if (key.includes('mail')) hasEmail = true;
            else if (key.includes('full') || key.includes('tên') || key === 'name' || key.includes('first') || key.includes('last') || key.includes('họ')) hasName = true;
        });

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
            currentWarnings.push('Thiếu cột tiêu đề Email.');
        }
        if (!hasPhone) {
            currentWarnings.push('Thiếu cột tiêu đề Số điện thoại.');
        }
        if (!hasName) {
            currentWarnings.push('Thiếu cột tiêu đề Họ & Tên.');
        }
        setImportWarnings(currentWarnings);

        const dataRows = lines.slice(1).map(line => {
            if (!line.trim()) return null;
            // Handle quotes and commas properly for basic CSV
            // A more robust CSV parser would be better, but we aim for lightweight here
            const values = line.split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
            const rowObj: any = {};
            headerRow.forEach((header, index) => {
                const rawKey = header.trim();
                let key = rawKey.toLowerCase();
                // Smart auto-matching
                if (key.includes('phone') || key.includes('sđt') || key.includes('số điện thoại') || key.includes('dien thoai')) key = 'phone';
                else if (key.includes('mail')) key = 'email';
                else if (key.includes('full') || key.includes('tên') || key === 'name') key = 'fullName';
                else if (key.includes('first')) key = 'firstName';
                else if (key.includes('last') || key.includes('họ')) key = 'lastName';
                else if (key.includes('tag') || key.includes('nhãn')) key = 'tags';
                else if (key.includes('date') || key.includes('ngày')) key = 'joinedAt';
                else {
                    key = rawKey;
                }

                rowObj[key] = values[index] || '';
                if (key !== rawKey) {
                    rowObj[rawKey] = values[index] || '';
                }
            });

            // Tự động đặt tên nếu trống
            if (rowObj.email && !rowObj.fullName && !rowObj.firstName) {
                rowObj.fullName = formatNameFromEmail(rowObj.email);
            }
            if (rowObj.phone && !rowObj.email) {
                // If we ONLY have phone (typical for ZNS), we still need to store it 
                // In this system, subscribers are identified by email usually, but for ZNS we must support phone-first.
                // We'll use a placeholder email or ensure the system handles phone-only.
                rowObj.email = rowObj.email || `${rowObj.phone}@placeholder.com`;
            }

            return rowObj;
        }).filter(r => r && (r.email || r.phone));

        let dupCount = 0;
        const validRows: any[] = [];
        const seenEmailsInCsv = new Set<string>();

        dataRows.forEach((row: any) => {
            const email = (row.email || '').toLowerCase().trim();
            if (email && seenEmailsInCsv.has(email)) {
                dupCount++;
            } else {
                if (email) seenEmailsInCsv.add(email);
                validRows.push(row);
            }
        });

        setParsedRows(validRows);
        // Fix: Use setStats for state update
        setStats({ total: dataRows.length, valid: validRows.length, duplicates: dupCount });
        // Fix: Use setStep for state update
        setStep(2);
    };

    const detectDelimiter = (str: string) => {
        const firstLine = str.split('\n')[0];
        if (firstLine.includes('\t')) return '\t';
        if (firstLine.includes(';')) return ';';
        return ',';
    };

    const handleFinishImport = async () => {
        // Fix: Use onImport prop
        await onImport({
            subscribers: parsedRows,
            // Fix: Use importMode and targetListId from state
            targetListId: importMode === 'existing' ? targetListId : null,
            newListName: importMode === 'new' ? newListName : null,
            // Fix: Use stats from state
            duplicates: stats.duplicates
        });
        setIsImporting(false);
        setStep(1);
        setRawData('');
        setNewListName('');
    };

    return (
        <div className={`relative bg-white rounded-[18px] border shadow-sm overflow-hidden transition-all min-h-[520px] flex flex-col ${error ? 'border-rose-500 ring-4 ring-rose-50' : 'border-slate-200'}`}>
            <div className="px-6 pt-6 pb-2 flex justify-between items-center border-b border-slate-100">
                <div className="flex gap-6 overflow-x-auto scrollbar-hide">
                    <button onClick={() => setActiveTab('lists')} className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'lists' ? 'border-blue-600 text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                        <List className="w-4 h-4" /> Danh sách ({filteredLists.length})
                        {selectedListCount > 0 && <span className="ml-1 bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">{selectedListCount}</span>}
                    </button>
                    <button onClick={() => setActiveTab('sheets')} className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'sheets' ? 'border-blue-600 text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                        <Zap className="w-4 h-4" /> Nguồn đồng bộ ({filteredSheets.length})
                        {selectedSheetCount > 0 && <span className="ml-1 bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">{selectedSheetCount}</span>}
                    </button>
                    <button onClick={() => setActiveTab('segments')} className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'segments' ? 'border-blue-600 text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                        <Layers className="w-4 h-4" /> Phân khúc ({filteredSegs.length})
                        {selectedSegCount > 0 && <span className="ml-1 bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">{selectedSegCount}</span>}
                    </button>
                    <button onClick={() => setActiveTab('tags')} className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'tags' ? 'border-blue-600 text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                        <Tag className="w-4 h-4" /> Nhãn ({filteredTags.length})
                        {selectedTagCount > 0 && <span className="ml-1 bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">{selectedTagCount}</span>}
                    </button>
                </div>
                <div className="pb-2 pl-4">
                    <button onClick={() => setIsImporting(true)} className="text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 whitespace-nowrap">
                        <Plus className="w-3.5 h-3.5" /> Import Nhanh
                    </button>
                </div>
            </div>

            <div className="flex-1 p-6 bg-slate-50/50 relative">
                <div className="relative mb-5">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder={activeTab === 'lists' ? "Tìm danh sách..." : (activeTab === 'sheets' ? "Tìm nguồn đồng bộ..." : (activeTab === 'segments' ? "Tìm phân khúc..." : "Tìm nhãn..."))} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-600 transition-all" />
                </div>

                <div className="space-y-2.5 max-h-[480px] md:max-h-[520px] overflow-y-auto custom-scrollbar pr-1">
                    {activeTab === 'lists' && (
                        filteredLists.length > 0 ? filteredLists.map(l => (
                            <div key={l.id} onClick={() => toggle('list', l.id)} className={`group flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${selectedTarget.listIds?.includes(l.id) ? 'bg-blue-50/40 border-blue-200' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${selectedTarget.listIds?.includes(l.id) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                        <List className="w-4 h-4" />
                                    </div>
                                    <div><p className="text-xs font-bold text-slate-800">{l.name}</p><p className="text-[9px] text-slate-400 font-semibold">{l.count.toLocaleString()} liên hệ</p></div>
                                </div>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedTarget.listIds?.includes(l.id) ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'}`}>{selectedTarget.listIds?.includes(l.id) && <CheckCircle2 className="w-3.5 h-3.5" />}</div>
                            </div>
                        )) : <div className="text-center py-8 text-xs text-slate-400 font-medium">Không tìm thấy danh sách nào.</div>
                    )}
                    {activeTab === 'sheets' && (
                        filteredSheets.length > 0 ? filteredSheets.map(l => (
                            <div key={l.id} onClick={() => toggle('list', l.id)} className={`group flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${selectedTarget.listIds?.includes(l.id) ? 'bg-[#ebfdf4] border-[#d4f7e3]' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${selectedTarget.listIds?.includes(l.id) ? 'bg-emerald-100' : 'bg-[#ebfdf4]'}`}>
                                        <img src="https://mailmeteor.com/logos/assets/PNG/Google_Sheets_Logo_512px.png" className="w-5 h-5 object-contain" alt="GS" />
                                    </div>
                                    <div><p className="text-xs font-bold text-slate-800">{l.name}</p><p className="text-[9px] text-slate-400 font-semibold">{l.count.toLocaleString()} liên hệ</p></div>
                                </div>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedTarget.listIds?.includes(l.id) ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300'}`}>{selectedTarget.listIds?.includes(l.id) && <CheckCircle2 className="w-3.5 h-3.5" />}</div>
                            </div>
                        )) : <div className="text-center py-8 text-xs text-slate-400 font-medium">Không tìm thấy nguồn đồng bộ nào.</div>
                    )}
                    {activeTab === 'segments' && (
                        filteredSegs.length > 0 ? filteredSegs.map(s => (
                            <div key={s.id} onClick={() => toggle('segment', s.id)} className={`group flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${selectedTarget.segmentIds?.includes(s.id) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${selectedTarget.segmentIds?.includes(s.id) ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                        <Layers className="w-4 h-4" />
                                    </div>
                                    <div><p className="text-xs font-bold text-slate-800">{s.name}</p><p className="text-[9px] text-slate-400 font-semibold">{s.count.toLocaleString()} liên hệ</p></div>
                                </div>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedTarget.segmentIds?.includes(s.id) ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-300'}`}>{selectedTarget.segmentIds?.includes(s.id) && <CheckCircle2 className="w-3.5 h-3.5" />}</div>
                            </div>
                        )) : <div className="text-center py-8 text-xs text-slate-400 font-medium">Không tìm thấy phân khúc nào.</div>
                    )}
                    {activeTab === 'tags' && (
                        filteredTags.length > 0 ? filteredTags.map(t => (
                            <div key={t.id} onClick={() => toggle('tag', t.name)} className={`group flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${selectedTarget.tagIds?.includes(t.name) ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${selectedTarget.tagIds?.includes(t.name) ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                        <Tag className="w-4 h-4" />
                                    </div>
                                    <div><p className="text-xs font-bold text-slate-800">{t.name}</p><p className="text-[9px] text-slate-400 font-semibold">{(t.count || 0).toLocaleString()} liên hệ</p></div>
                                </div>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedTarget.tagIds?.includes(t.name) ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300'}`}>{selectedTarget.tagIds?.includes(t.name) && <CheckCircle2 className="w-3.5 h-3.5" />}</div>
                            </div>
                        )) : <div className="text-center py-8 text-xs text-slate-400 font-medium">Không tìm thấy nhãn nào.</div>
                    )}
                </div>

                <div className="absolute bottom-4 right-4 bg-slate-900/90 backdrop-blur-md text-white px-4 py-2.5 rounded-full shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom-2">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                    <div className="flex items-baseline gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Ước tính:</span>
                        <span className="text-sm font-bold">{estimatedReach.toLocaleString()}</span>
                    </div>
                    <button
                        onClick={refreshEstimate}
                        disabled={isRefreshing}
                        className="ml-2 p-1.5 hover:bg-white/20 rounded-full transition-all disabled:opacity-50"
                        title="Refresh estimate"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {isImporting && (
                    <div className="absolute inset-0 bg-white z-20 animate-in slide-in-from-bottom-full duration-300 flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h4 className="text-sm font-bold text-slate-800">Import Nhanh</h4>
                                <p className="text-[10px] text-slate-500 font-medium">Thêm liên hệ vào chiến dịch qua CSV hoặc dán trực tiếp.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={downloadSampleCSV}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                                >
                                    <FileText className="w-3 h-3 text-blue-500" /> Tải mẫu CSV
                                </button>
                                <button onClick={() => setIsImporting(false)} className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"><X className="w-4 h-4" /></button>
                            </div>
                        </div>

                        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                            {step === 1 ? (
                                <div className="space-y-5">
                                    <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                                        <button
                                            onClick={() => setInputMethod('paste')}
                                            className={`px-4 py-2 rounded-lg text-[11px] font-black transition-all ${inputMethod === 'paste' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Dán văn bản
                                        </button>
                                        <button
                                            onClick={() => setInputMethod('file')}
                                            className={`px-4 py-2 rounded-lg text-[11px] font-black transition-all ${inputMethod === 'file' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Tải tệp CSV
                                        </button>
                                    </div>

                                    {inputMethod === 'paste' ? (
                                        <div className="space-y-4">
                                            <div className="relative">
                                                <textarea
                                                    value={rawData}
                                                    onChange={e => setRawData(e.target.value)}
                                                    placeholder="Dán dữ liệu nhãn, họ tên, email, sđt... (Dòng đầu tiên là tiêu đề)"
                                                    className="w-full h-48 p-4 bg-slate-50 border-2 border-slate-200 rounded-[14px] text-[11px] font-mono focus:border-[#2563eb] outline-none resize-none transition-all"
                                                    autoFocus
                                                />
                                                {!rawData && (
                                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none opacity-30">
                                                        <Sparkles className="w-10 h-10 mx-auto mb-2" />
                                                        <p className="text-[10px] font-bold uppercase tracking-widest">Pasted area</p>
                                                    </div>
                                                )}
                                            </div>
                                            <Button fullWidth onClick={parseData} disabled={!rawData.trim()} icon={ArrowRight}>Kiểm tra dữ liệu</Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div
                                                onClick={() => fileInputRef.current?.click()}
                                                className={`h-48 border-2 border-dashed rounded-[14px] flex flex-col items-center justify-center cursor-pointer transition-all ${fileName ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}
                                            >
                                                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
                                                <div className={`w-14 h-14 rounded-[14px] flex items-center justify-center mb-4 transition-all ${fileName ? 'bg-blue-500 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                                                    <Upload className="w-7 h-7" />
                                                </div>
                                                <p className="text-[11px] font-bold text-slate-700">{fileName || 'Kéo thả hoặc nhấp để chọn tệp CSV'}</p>
                                                <p className="text-[9px] text-slate-400 mt-1">Hỗ trợ định dạng .csv (UTF-8)</p>
                                            </div>
                                            <Button fullWidth onClick={parseData} disabled={!rawData.trim()} icon={ArrowRight}>Tiếp theo</Button>
                                        </div>
                                    )}

                                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3">
                                        <Zap className="w-4 h-4 text-blue-500 shrink-0" />
                                        <p className="text-[10px] text-blue-700 font-medium leading-relaxed">
                                            <b>Mẹo:</b> Hệ thống tự động nhận diện các cột: <b>sđt, điện thoại, email, họ tên, nhãn</b>. Hãy đảm bảo dòng đầu tiên là tiêu đề cột.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                    <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-[14px] flex items-center gap-4">
                                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-emerald-600 shadow-sm"><CheckCircle2 className="w-5 h-5" /></div>
                                        <div>
                                            <p className="text-xs font-black text-emerald-800 uppercase tracking-tight">Dữ liệu sẵn sàng</p>
                                            <p className="text-[10px] text-emerald-600 font-medium">Tìm thấy {stats.total} dòng, có {parsedRows.length} liên hệ hợp lệ mới.</p>
                                        </div>
                                    </div>

                                    {importWarnings.length > 0 && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-800">
                                            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5 animate-bounce" />
                                            <div className="space-y-1">
                                                <h4 className="text-[10px] font-black uppercase tracking-wider text-amber-900">Cảnh báo tiêu đề cột</h4>
                                                <ul className="list-disc pl-4 text-[10px] font-medium space-y-1">
                                                    {importWarnings.map((w, idx) => (
                                                        <li key={idx}>{w}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-4 bg-white p-2">
                                        <div className="bg-slate-50 p-4 rounded-xl space-y-3">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Cấu hình danh sách</p>
                                            <div className="flex gap-2 mb-2">
                                                <button
                                                    onClick={() => setImportMode('new')}
                                                    className={`flex-1 p-3 rounded-lg border text-[11px] font-bold transition-all text-center ${importMode === 'new' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'bg-white border-slate-200 text-slate-500'}`}
                                                >
                                                    Tạo danh sách mới
                                                </button>
                                                <button
                                                    onClick={() => setImportMode('existing')}
                                                    className={`flex-1 p-3 rounded-lg border text-[11px] font-bold transition-all text-center ${importMode === 'existing' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'bg-white border-slate-200 text-slate-500'}`}
                                                >
                                                    Thêm vào sẵn có
                                                </button>
                                            </div>

                                            {importMode === 'new' ? (
                                                <Input
                                                    placeholder="VD: Data Khách hàng ZNS T03..."
                                                    value={newListName}
                                                    onChange={e => setNewListName(e.target.value)}
                                                    autoFocus
                                                    icon={Plus}
                                                />
                                            ) : (
                                                <CustomSelect
                                                    value={targetListId}
                                                    options={manualLists.map(l => ({ value: l.id, label: l.name, subLabel: `${l.count} liên hệ` }))}
                                                    onChange={val => setTargetListId(val)}
                                                    placeholder="Chọn danh sách đích..."
                                                />
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <Button variant="ghost" onClick={() => setStep(1)} className="flex-1">Quay lại</Button>
                                        <Button
                                            fullWidth
                                            onClick={handleFinishImport}
                                            disabled={(importMode === 'new' && !newListName.trim()) || (importMode === 'existing' && !targetListId)}
                                            className="flex-[2] bg-slate-900 text-white"
                                        >
                                            Hoàn tất & Chọn
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default AudienceSelector;