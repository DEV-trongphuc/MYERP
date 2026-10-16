
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
    Check, FileSpreadsheet, AlertCircle, ChevronRight,
    Target, Plus, Trash2, HelpCircle, Zap, Clock
} from 'lucide-react';
import Button from '../common/Button';
import Select from '../common/Select';
import { api } from '../../services/storageAdapter';
import toast from 'react-hot-toast';
import { getMktPortalRoot } from '../../utils/portalRoot';

interface GoogleSheetsSetupProps {
    onBack: () => void;
    onComplete: () => void;
    initialData?: any;
}

// Thêm trường hệ thống cho custom_field
const CUSTOM_FIELD_PLACEHOLDER = '__cf_placeholder__'; // filled in dynamically

const BASE_SYSTEM_FIELDS = [
    { key: 'email', label: 'Email', required: true },
    { key: 'firstName', label: 'Họ (First Name)', required: false },
    { key: 'lastName', label: 'Tên (Last Name)', required: false },
    { key: 'fullName', label: 'Họ và tên (Full Name)', required: false },
    { key: 'phoneNumber', label: 'Số điện thoại', required: false },
    { key: 'source', label: 'Nguồn (Source)', required: false },
    { key: 'jobTitle', label: 'Chức danh', required: false },
    { key: 'companyName', label: 'Công ty', required: false },
    { key: 'info.salesperson', label: 'Sale phụ trách', required: false },
    { key: 'info.address', label: 'Địa chỉ', required: false },
    { key: 'info.website', label: 'Website', required: false },
    { key: 'country', label: 'Quốc gia', required: false },
    { key: 'city', label: 'Thành phố', required: false },
    { key: 'gender', label: 'Giới tính', required: false },
    { key: 'dateOfBirth', label: 'Ngày sinh', required: false },
    { key: 'tags', label: 'Thẻ (Tags)', required: false },
    { key: 'points', label: 'Điểm số', required: false },
    { key: 'notes', label: 'Ghi chú (Notes)', required: false },
];

// --- SystemFieldSelect: portal-based to fully escape modal transform ---
const SystemFieldSelect = ({ value, options, onChange }: {
    value: string;
    options: { key: string; label: string }[];
    onChange: (key: string) => void;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [rect, setRect] = useState<DOMRect | null>(null);
    const [isAddingCustom, setIsAddingCustom] = useState(false);
    const [customValue, setCustomValue] = useState('');
    const triggerRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (!containerRef.current?.contains(e.target as Node) && !dropdownRef.current?.contains(e.target as Node)) {
                setIsOpen(false);
                setIsAddingCustom(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleOpen = () => {
        if (!triggerRef.current) return;
        setRect(triggerRef.current.getBoundingClientRect());
        setIsOpen(p => !p);
        setIsAddingCustom(false);
    };

    const handleCustomAdd = () => {
        if (!customValue.trim()) return;
        const key = `custom_field.${customValue.trim().toLowerCase().replace(/\s+/g, '_')}`;
        onChange(key);
        setIsOpen(false);
        setIsAddingCustom(false);
        setCustomValue('');
    };

    const selected = options.find(o => o.key === value);

    const dropdown = isOpen && rect ? ReactDOM.createPortal(
        <div
            ref={dropdownRef}
            style={{
                position: 'fixed',
                top: rect.bottom + 6,
                left: rect.left,
                width: Math.max(rect.width, 240),
                zIndex: 999999,
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '0.75rem',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                maxHeight: '18rem',
                overflowY: 'auto'
            }}
        >
            <div className="p-1 space-y-0.5">
                {!isAddingCustom ? (
                    <>
                        <div className="max-h-52 overflow-y-auto">
                            {options.map(opt => (
                                <div key={opt.key} onClick={() => { onChange(opt.key); setIsOpen(false); }}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold cursor-pointer flex items-center justify-between transition-colors
                                        ${value === opt.key ? 'bg-amber-50 text-amber-600' : 'text-slate-700 hover:bg-slate-50'}`}>
                                    <span>{opt.label}</span>
                                    {opt.key.startsWith('custom_field.') && (
                                        <span className="ml-2 text-[9px] font-black uppercase text-blue-400 bg-blue-50 px-1.5 py-0.5 rounded">CF</span>
                                    )}
                                    {value === opt.key && <Check className="w-3 h-3 shrink-0 ml-1" />}
                                </div>
                            ))}
                        </div>
                        <div className="pt-1 mt-1 border-t border-slate-100">
                            <div
                                onClick={() => setIsAddingCustom(true)}
                                className="px-3 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider text-blue-600 hover:bg-blue-50 cursor-pointer flex items-center gap-2 transition-all"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Trường tùy chỉnh</span>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="p-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tên trường (vd: Ma_Vach)</label>
                            <input
                                autoFocus
                                value={customValue}
                                onChange={e => setCustomValue(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCustomAdd()}
                                placeholder="Nhập tên không dấu..."
                                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:bg-white focus:border-blue-400 outline-none"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsAddingCustom(false)}
                                className="flex-1 h-8 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50"
                            >
                                Quay lại
                            </button>
                            <button
                                onClick={handleCustomAdd}
                                className="flex-1 h-8 rounded-lg bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-sm"
                            >
                                Xác nhận
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        getMktPortalRoot()
    ) : null;

    return (
        <div className="relative w-[180px]" ref={containerRef}>
            <div
                ref={triggerRef}
                onClick={handleOpen}
                className={`h-9 px-3 flex items-center justify-between rounded-xl cursor-pointer transition-all text-xs font-bold border
                    ${isOpen ? 'border-amber-400 ring-2 ring-amber-100 text-amber-700 bg-amber-50' : 'border-transparent hover:bg-slate-100 text-slate-600 bg-transparent'}`}
            >
                <span className="truncate">{selected?.label || (value.startsWith('custom_field.') ? value.replace('custom_field.', '⚙ ') : value)}</span>
                <ChevronRight className={`w-3.5 h-3.5 ml-1 transition-transform shrink-0 ${isOpen ? 'rotate-[-90deg] text-amber-500' : 'rotate-90 text-slate-400'}`} />
            </div>
            {dropdown}
        </div>
    );
};
// ------------------------------

// --- SheetColumnSelect: portal-based to fully escape modal transform ---
const SheetColumnSelect = ({ value, options, onChange, placeholder = "Chọn cột..." }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const [rect, setRect] = useState<{ bottom: number, left: number, width: number } | null>(null);
    const triggerRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const inContainer = containerRef.current?.contains(event.target as Node);
            const inDropdown = dropdownRef.current?.contains(event.target as Node);
            if (!inContainer && !inDropdown) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleOpen = () => {
        if (!triggerRef.current) return;
        const r = triggerRef.current.getBoundingClientRect();
        setRect({ bottom: r.bottom, left: r.left, width: r.width });
        setIsOpen(prev => !prev);
    };

    const selectedLabel = value || <span className="text-slate-400 font-normal">{placeholder}</span>;

    const dropdown = isOpen && rect ? ReactDOM.createPortal(
        <div
            ref={dropdownRef}
            style={{
                position: 'fixed',
                top: rect.bottom + 6,
                left: rect.left,
                width: rect.width,
                zIndex: 999999,
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '0.75rem',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                maxHeight: '15rem',
                overflowY: 'auto'
            }}
        >
            <div className="p-1 space-y-0.5">
                <div
                    onClick={() => { onChange(''); setIsOpen(false); }}
                    className="px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-50 hover:text-slate-600 cursor-pointer transition-colors"
                >
                    -- Bỏ qua --
                </div>
                {options.map((opt: string) => (
                    <div
                        key={opt}
                        onClick={() => { onChange(opt); setIsOpen(false); }}
                        className={`
                            px-3 py-2.5 rounded-lg text-sm font-bold cursor-pointer transition-colors flex items-center justify-between
                            ${value === opt ? 'bg-amber-50 text-[#2563eb]' : 'text-slate-700 hover:bg-slate-50'}
                        `}
                    >
                        {opt}
                        {value === opt && <Check className="w-3.5 h-3.5" />}
                    </div>
                ))}
            </div>
        </div>,
        getMktPortalRoot()
    ) : null;

    return (
        <div className="relative" ref={containerRef}>
            <div
                ref={triggerRef}
                onClick={handleOpen}
                className={`
                    w-full h-11 bg-white border rounded-xl px-4 flex items-center justify-between cursor-pointer transition-all
                    ${isOpen ? 'border-[#2563eb] ring-4 ring-[#2563eb]/10' : 'border-slate-200 hover:border-slate-300'}
                `}
            >
                <div className="text-sm font-bold text-slate-700 truncate select-none">
                    {selectedLabel}
                </div>
                <ChevronRight
                    className={`
                        w-4 h-4 text-slate-400 transition-transform duration-200
                        ${isOpen ? 'rotate-[-90deg] text-[#2563eb]' : 'rotate-90'}
                    `}
                />
            </div>
            {dropdown}
        </div>
    );
};
// ------------------------------

const GoogleSheetsSetup: React.FC<GoogleSheetsSetupProps> = ({ onBack, onComplete, initialData }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Config State
    const [config, setConfig] = useState<any>({
        spreadsheetId: '',
        sheetName: 'Sheet1',
        syncInterval: '15',
        mapping: {
            email: ''
        },
        targetListId: '',
        targetListName: '',
        isCustomInterval: false,
        createVirtualEmail: false
    });

    const [activeMappings, setActiveMappings] = useState<string[]>(['firstName', 'phoneNumber']);
    const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
    const [lists, setLists] = useState<any[]>([]);
    // Dynamic custom fields fetched from API
    const [customFieldDefs, setCustomFieldDefs] = useState<{ key: string; label: string }[]>([]);

    // All available system fields = base + custom_fields
    const SYSTEM_FIELDS = React.useMemo(() => [
        ...BASE_SYSTEM_FIELDS,
        ...customFieldDefs.map(cf => ({ key: `custom_field.${cf.key}`, label: `⚙ ${cf.label}`, required: false }))
    ], [customFieldDefs]);

    useEffect(() => {
        const fetchLists = async () => {
            const res = await api.get<any[]>('lists');
            if (res.success) setLists(res.data);
        };
        const fetchCustomFields = async () => {
            const res = await api.get<any>('subscribers?route=field_definitions');
            if (res.success && Array.isArray(res.data)) {
                // The API returns both system and custom fields, we only want custom ones
                const customFields = res.data.filter((f: any) => f.is_custom);
                setCustomFieldDefs(customFields);
            }
        };
        fetchLists();
        fetchCustomFields();

        // Load Initial Data if Editing
        if (initialData) {
            try {
                const parsedConfig = typeof initialData.config === 'string' ? JSON.parse(initialData.config) : initialData.config;
                setConfig(parsedConfig);

                // Restore headings if we have them, otherwise we might need to refetch or show current mapping
                // For simplicity, we assume we can just edit the interval or target list mostly.
                // But to support full edit, we'd need headers.
                // Let's rely on the user clicking "Check connection" again if they want to remap.
                // OR, we can try to infer active mappings from the saved config.
                if (parsedConfig.mapping) {
                    const mappedKeys = Object.keys(parsedConfig.mapping);
                    setActiveMappings(mappedKeys.filter(k => k !== 'email'));
                }

                // If editing, start at Step 3 (Confirmation/Settings) or Step 1?
                // Step 1 allows changing ID. Step 3 allows changing Interval/List.
                // Let's start at Step 1 to allow full reconfiguration, but pre-fill data.
                // User can click "Check Connection" to proceed.
            } catch (e) {
                console.error("Error parsing initial config", e);
            }
        }
    }, [initialData]);

    const handleConnect = async () => {
        if (!config.spreadsheetId) {
            toast.error('Vui lòng nhập Spreadsheet ID');
            return;
        }
        setLoading(true);

        try {
            const res = await api.post('integrations?route=fetch_headers', {
                spreadsheetId: config.spreadsheetId,
                sheetName: config.sheetName
            });

            if (res.success) {
                const data = res.data as any;
                const headers = data.headers;
                setDetectedHeaders(headers);

                // Auto-mapping logic
                const newMapping = { ...config.mapping };
                headers.forEach((h: string) => {
                    const head = h.toLowerCase();
                    if (head.includes('email') || head.includes('mail')) newMapping.email = h;
                    if (head.includes('họ') || head.includes('tên') || head.includes('name')) newMapping.firstName = h;
                    if (head.includes('số') || head.includes('phone') || head.includes('đt')) newMapping.phoneNumber = h;
                    if (head.includes('công ty') || head.includes('company')) newMapping.companyName = h;
                });
                setConfig({
                    ...config,
                    mapping: newMapping,
                    targetListName: config.sheetName || 'Google Sheets Import'
                });

                setStep(2);
                toast.success(data.message || 'Đã kết nối và đọc được dữ liệu!');
            } else {
                toast.error(res.message || 'Không thể kết nối với Google Sheets');
            }
        } catch (err) {
            toast.error('Đã xảy ra lỗi khi kết nối với máy chủ');
        } finally {
            setLoading(false);
        }
    };

    const addMappingRow = () => {
        const remainingFields = SYSTEM_FIELDS.filter(f => f.key !== 'email' && !activeMappings.includes(f.key));
        if (remainingFields.length > 0) {
            setActiveMappings([...activeMappings, remainingFields[0].key]);
        } else {
            // Mặc định thêm một row trắng với key duy nhất để user tự nhập
            const placeholderKey = `temp_custom_${Date.now()}`;
            setActiveMappings([...activeMappings, placeholderKey]);
        }
    };

    const removeMappingRow = (key: string) => {
        setActiveMappings(activeMappings.filter(k => k !== key));
        const newMapping = { ...config.mapping };
        delete newMapping[key];
        setConfig({ ...config, mapping: newMapping });
    };

    const handleSave = async () => {
        if (!config.targetListName) {
            toast.error('Vui lòng nhập tên danh sách lưu trữ');
            return;
        }

        if (!config.mapping.email) {
            toast.error('Vui lòng mapping trường Email');
            return;
        }

        setLoading(true);
        try {
            // 1. Create or Identify the list
            let finalListId = config.targetListId;

            // Only create a new list if we don't have one yet
            if (!finalListId) {
                const newListId = crypto.randomUUID();
                const listRes = await api.post('lists', {
                    id: newListId,
                    name: config.targetListName,
                    source: 'Google Sheets',
                    type: 'sync',
                    count: 0
                });

                if (listRes.success) {
                    finalListId = (listRes.data as any).id;
                } else {
                    throw new Error(listRes.message || 'Không thể tạo danh sách mới');
                }
            } else {
                // If editing, optionally update the list name to match what's in the input
                await api.put(`lists?id=${finalListId}`, {
                    name: config.targetListName,
                    source: 'Google Sheets',
                    count: 0 // Count is handled by sync worker
                });
            }

            // 2. Save Integration
            const payload = {
                type: 'google_sheets',
                name: 'Google Sheets - ' + config.sheetName,
                config: JSON.stringify({ ...config, targetListId: finalListId }),
                status: 'active'
            };

            let res;
            if (initialData?.id) {
                res = await api.put(`integrations?id=${initialData.id}`, payload);
            } else {
                res = await api.post('integrations', payload);
            }

            if (res.success) {
                toast.success('Kết nối thành công! Đã tạo danh sách và kích hoạt đồng bộ.');
                onComplete();
            } else {
                toast.error(res.message || 'Lỗi khi lưu kết nối');
            }
        } catch (err: any) {
            toast.error(err.message || 'Đã xảy ra lỗi hệ thống');
        } finally {
            setLoading(false);
        }
    };

    // Helper to render content based on step
    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                    <div className="space-y-6">
                        <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl flex gap-3">
                            <Info className="w-5 h-5 text-blue-500 shrink-0" />
                            <div className="text-xs text-blue-700 leading-relaxed font-medium">
                                <p className="font-bold mb-1">Hướng dẫn nhanh:</p>
                                1. Bấm nút <b>Chia sẻ</b> (Share) trên file Google Sheets.<br />
                                2. Tại phần <b>Quyền truy cập chung</b>, chọn <b>Bất kỳ ai có liên kết</b> và đặt quyền là <b>Người xem</b>.<br />
                                3. Copy <b>Spreadsheet ID</b> từ URL trình duyệt (chuỗi ký tự nằm giữa d/ và /edit).
                            </div>
                        </div>

                        {/* Supported Apps */}
                        <div className="flex items-center gap-4 py-3 animate-in fade-in slide-in-from-top-1 duration-500 delay-100 pl-1">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Hỗ trợ đồng bộ từ:</span>

                            <div className="flex items-center gap-3">
                                {/* Sources */}
                                <div className="flex -space-x-2">
                                    <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-50 flex items-center justify-center overflow-hidden shadow-sm z-[2] relative" title="Facebook Lead Ads">
                                        <img src="https://upload.wikimedia.org/wikipedia/commons/b/b8/2021_Facebook_icon.svg" className="w-5 h-5 object-contain" alt="Facebook" />
                                    </div>
                                    <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-50 flex items-center justify-center overflow-hidden shadow-sm z-[1] relative" title="Google Forms">
                                        <img src="https://www.torontomu.ca/content/dam/google/teach-with-google-apps/quizzes-surveys/create-google-form/google-form.png" className="w-5 h-5 object-contain" alt="Google Forms" />
                                    </div>
                                </div>

                                {/* Connecting Line */}
                                <div className="flex items-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#2563eb]"></div>
                                    <div className="w-32 h-[2px] bg-amber-100 relative overflow-hidden mx-0.5">
                                        <div className="absolute top-0 left-0 h-full w-1/2 bg-gradient-to-r from-transparent via-[#2563eb] to-transparent animate-[shimmer_1.5s_infinite]"></div>
                                        {/* Inline style fallback for animation if Tailwind config misses 'shimmer' */}
                                        <style dangerouslySetInnerHTML={{
                                            __html: `
                                            @keyframes shimmer {
                                                0% { transform: translateX(-100%); }
                                                100% { transform: translateX(200%); }
                                            }
                                        `}} />
                                    </div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#2563eb]"></div>
                                </div>

                                {/* Destination */}
                                <div className="w-8 h-8 rounded-full border-2 border-white bg-white flex items-center justify-center overflow-hidden shadow-sm" title="Google Sheets">
                                    <img src="https://mailmeteor.com/logos/assets/PNG/Google_Sheets_Logo_512px.png" className="w-5 h-5 object-contain" alt="Google Sheets" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-700 uppercase tracking-widest ml-1">Đường dẫn Google Sheet (hoặc ID)</label>
                                <div className="relative group">
                                    <FileSpreadsheet className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#2563eb] transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Dán link hoặc Spreadsheet ID vào đây..."
                                        className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl pl-11 pr-4 text-sm font-bold focus:bg-white focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/5 outline-none transition-all"
                                        value={config.spreadsheetId}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            const match = val.match(/\/d\/([a-zA-Z0-9-_]+)/);
                                            const id = match ? match[1] : val;
                                            setConfig({ ...config, spreadsheetId: id });
                                        }}
                                    />
                                </div>
                                {config.spreadsheetId && config.spreadsheetId.length > 20 && !config.spreadsheetId.includes('/') && (
                                    <p className="text-[10px] text-emerald-600 font-bold mt-1 ml-1 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
                                        <Check className="w-3 h-3" /> Đã nhận diện Spreadsheet ID thành công
                                    </p>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-slate-700 uppercase tracking-widest ml-1">Tên trang tính (Sheet Name)</label>
                                    <input
                                        type="text"
                                        placeholder="Sheet1"
                                        className="w-full h-11 bg-slate-50 border border-slate-100 rounded-xl px-4 text-sm font-bold focus:bg-white focus:border-[#2563eb] outline-none transition-all"
                                        value={config.sheetName}
                                        onChange={(e) => setConfig({ ...config, sheetName: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-black text-slate-700 uppercase tracking-widest ml-1">Chu kỳ đồng bộ</label>
                                        <div className="flex items-center gap-1.5 group cursor-help">
                                            <HelpCircle className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#2563eb] transition-colors" />
                                            <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-600 transition-colors uppercase tracking-tight">Cơ chế hoạt động?</span>
                                            <div className="absolute right-0 bottom-full mb-2 w-64 p-3 bg-slate-900 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-20 shadow-xl leading-relaxed">
                                                <b>Cơ chế Polling:</b> MailFlow sẽ tự động "gõ cửa" Google Sheets theo chu kỳ bạn chọn để tìm dòng mới.
                                                <br /><br />
                                                • <b>5 phút:</b> Phù hợp Lead từ quảng cáo.
                                                <br />
                                                • <b>1 ngày:</b> Tiết kiệm tài nguyên cho bảng tính lớn.
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-5 gap-2">
                                        {[
                                            { val: '5', label: '5p', sub: 'Nhanh', icon: <Zap className="w-3 h-3" /> },
                                            { val: '15', label: '15p', sub: 'Chuẩn', icon: <Clock className="w-3 h-3" /> },
                                            { val: '60', label: '1h', sub: 'Ổn định', icon: <Clock className="w-3 h-3" /> },
                                            { val: '1440', label: '1 ngày', sub: 'Tiết kiệm', icon: <Target className="w-3 h-3" /> },
                                            { val: 'custom', label: 'Khác', sub: 'Tùy chỉnh', icon: <Plus className="w-3 h-3" /> }
                                        ].map((opt) => (
                                            <button
                                                key={opt.val}
                                                type="button"
                                                onClick={() => {
                                                    if (opt.val === 'custom') {
                                                        setConfig({ ...config, isCustomInterval: true });
                                                    } else {
                                                        setConfig({ ...config, syncInterval: opt.val, isCustomInterval: false });
                                                    }
                                                }}
                                                className={`
                                                    flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-xl border-2 transition-all duration-300
                                                    ${(config.syncInterval === opt.val && !config.isCustomInterval) || (opt.val === 'custom' && config.isCustomInterval)
                                                        ? 'bg-amber-50 border-[#2563eb] text-[#2563eb] shadow-sm'
                                                        : 'bg-white border-slate-50 text-slate-400 hover:border-slate-100'
                                                    }
                                                `}
                                            >
                                                <div className={`${(config.syncInterval === opt.val && !config.isCustomInterval) || (opt.val === 'custom' && config.isCustomInterval) ? 'text-[#2563eb]' : 'text-slate-300'} transition-colors`}>
                                                    {opt.icon}
                                                </div>
                                                <span className="text-[10px] font-black whitespace-nowrap">{opt.label}</span>
                                                <span className={`text-[7px] font-bold uppercase tracking-tighter ${(config.syncInterval === opt.val && !config.isCustomInterval) || (opt.val === 'custom' && config.isCustomInterval) ? 'text-[#2563eb]/60' : 'text-slate-300'}`}>
                                                    {opt.sub}
                                                </span>
                                            </button>
                                        ))}
                                    </div>

                                    {config.syncInterval === '1440' && !config.isCustomInterval && (
                                        <div className="flex items-center gap-3 p-3 bg-amber-50/50 rounded-2xl border border-amber-100 animate-in slide-in-from-top-2 mt-2">
                                            <div className="flex-1 space-y-1">
                                                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Giờ chạy cố định (Tùy chọn)</p>
                                                <div className="relative">
                                                    <select
                                                        className="w-full h-9 bg-white border border-amber-200 rounded-lg px-3 text-xs font-bold text-amber-900 focus:border-[#2563eb] outline-none"
                                                        value={config.syncTimeOfDay || ''}
                                                        onChange={(e) => setConfig({ ...config, syncTimeOfDay: e.target.value })}
                                                    >
                                                        <option value="">Tự động (Sau 24h kể từ lần cuối)</option>
                                                        {Array.from({ length: 24 }).map((_, i) => (
                                                            <option key={i} value={`${i.toString().padStart(2, '0')}:00`}>
                                                                {i.toString().padStart(2, '0')}:00
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="w-1/2 text-[9px] text-amber-600/80 leading-tight font-medium">
                                                Mặc định hệ thống sẽ đếm lùi 24h. Nếu chọn giờ cố định, hệ thống sẽ ghim đồng bộ 1 lần duy nhất vào đúng khung giờ này mỗi ngày.
                                            </div>
                                        </div>
                                    )}

                                    {config.isCustomInterval && (
                                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 animate-in slide-in-from-top-2">
                                            <div className="flex-1 space-y-1">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Số phút tùy chỉnh</p>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        placeholder="Ví dụ: 30"
                                                        className="w-full h-9 bg-white border border-slate-200 rounded-lg px-3 text-xs font-bold focus:border-[#2563eb] outline-none"
                                                        value={config.syncInterval}
                                                        onChange={(e) => setConfig({ ...config, syncInterval: e.target.value })}
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">phút</span>
                                                </div>
                                            </div>
                                            <div className="w-1/2 text-[9px] text-slate-400 leading-tight font-medium">
                                                Lưu ý: Thời gian quá ngắn (dưới 5 phút) có thể khiến Google giới hạn băng thông.
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 2:
                // --- STEP 2: MAPPING ---
                return (
                    <div className="space-y-6">
                        {/* Improved Table without overflow-hidden on container to allow dropdowns */}
                        <div className="bg-white border border-slate-100 rounded-[28px] shadow-sm relative z-0">
                            <table className="w-full">
                                <thead className="bg-slate-50/50 border-b border-slate-100">
                                    <tr>
                                        <th className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left px-8 py-4 first:rounded-tl-[28px]">Trường hệ thống</th>
                                        <th className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left px-8 py-4 last:rounded-tr-[28px]">Cột tương ứng trong Sheet</th>
                                        <th className="w-16"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {/* Email Row - Clean version without icon */}
                                    <tr className="bg-amber-50/20">
                                        <td className="px-8 py-5">
                                            <div className="h-[42px] flex flex-col justify-center px-3.5">
                                                <span className="text-sm font-bold text-slate-900 block leading-tight">Email</span>
                                                <span className="text-rose-500 text-[9px] font-black uppercase tracking-tighter leading-tight">Bắt buộc</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <SheetColumnSelect
                                                value={config.mapping.email}
                                                options={detectedHeaders}
                                                onChange={(val: string) => setConfig({
                                                    ...config,
                                                    mapping: { ...config.mapping, email: val }
                                                })}
                                                placeholder="Chọn cột Email"
                                            />
                                        </td>
                                        <td></td>
                                    </tr>

                                    {/* Dynamic Rows */}
                                    {activeMappings.filter(k => k !== '__custom_input__').map((mapKey) => {
                                        const isSystemField = SYSTEM_FIELDS.some(f => f.key === mapKey);
                                        const fieldLabel = SYSTEM_FIELDS.find(f => f.key === mapKey)?.label || mapKey;

                                        return (
                                            <tr key={mapKey} className="group hover:bg-slate-50/50 transition-colors">
                                                <td className="px-8 py-5">
                                                    {isSystemField || mapKey.startsWith('custom_field.') ? (
                                                        <SystemFieldSelect
                                                            value={mapKey}
                                                            options={SYSTEM_FIELDS.filter(f =>
                                                                f.key === mapKey ||
                                                                (!activeMappings.includes(f.key) && f.key !== 'email')
                                                            )}
                                                            onChange={(newKey) => {
                                                                const newVal = config.mapping[mapKey];
                                                                const newActive = activeMappings.map(k => k === mapKey ? newKey : k);
                                                                const newMapping = { ...config.mapping };
                                                                delete newMapping[mapKey];
                                                                newMapping[newKey] = newVal;
                                                                setActiveMappings(newActive);
                                                                setConfig({ ...config, mapping: newMapping });
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <div className="px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                                                                <span className="text-sm font-bold text-blue-700">{mapKey.startsWith('temp_custom_') ? 'Chọn trường...' : mapKey}</span>
                                                            </div>
                                                            <span className="text-[9px] font-bold text-blue-500 uppercase tracking-tight">Mới</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-8 py-5">
                                                    <SheetColumnSelect
                                                        value={config.mapping[mapKey] || ''}
                                                        options={detectedHeaders}
                                                        onChange={(val: string) => setConfig({
                                                            ...config,
                                                            mapping: { ...config.mapping, [mapKey]: val }
                                                        })}
                                                    />
                                                </td>
                                                <td className="px-4">
                                                    <button
                                                        onClick={() => removeMappingRow(mapKey)}
                                                        className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {/* Custom Field Input Row */}
                                    {activeMappings.includes('__custom_input__') && (
                                        <tr className="bg-blue-50/30">
                                            <td className="px-8 py-5">
                                                <input
                                                    type="text"
                                                    placeholder="Nhập tên trường tùy chỉnh (VD: Mã KH, Điểm thưởng...)"
                                                    className="w-full h-11 bg-white border-2 border-blue-200 rounded-xl px-4 text-sm font-bold focus:border-[#2563eb] outline-none"
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                                            const customKey = e.currentTarget.value.trim();
                                                            setActiveMappings(activeMappings.map(k => k === '__custom_input__' ? customKey : k));
                                                            setConfig({ ...config, mapping: { ...config.mapping, [customKey]: '' } });
                                                        }
                                                    }}
                                                />
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="text-xs text-slate-400 font-medium">Nhấn Enter để xác nhận</div>
                                            </td>
                                            <td className="px-4">
                                                <button
                                                    onClick={() => setActiveMappings(activeMappings.filter(k => k !== '__custom_input__'))}
                                                    className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    )}

                                    {/* Suggestion/Add Row Button at the bottom */}
                                    <tr>
                                        <td colSpan={3} className="p-4 last:rounded-bl-[28px] last:rounded-br-[28px]">
                                            <button
                                                onClick={addMappingRow}
                                                className="w-full py-4 border-2 border-dashed border-slate-100 rounded-2xl flex items-center justify-center gap-3 text-slate-400 hover:border-[#2563eb]/30 hover:bg-amber-50/30 hover:text-[#2563eb] transition-all group"
                                            >
                                                <div className="w-7 h-7 rounded-full bg-slate-50 group-hover:bg-amber-100 flex items-center justify-center transition-colors">
                                                    <Plus className="w-3.5 h-3.5" />
                                                </div>
                                                <span className="text-[11px] font-black uppercase tracking-widest">Thêm trường đồng bộ khác</span>
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-700 uppercase tracking-widest ml-1">Tên danh sách lưu trữ</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#0f9d58] transition-colors flex items-center justify-center">
                                        <img src="https://mailmeteor.com/logos/assets/PNG/Google_Sheets_Logo_512px.png" className="w-full h-full object-contain filter grayscale group-focus-within:grayscale-0 transition-all" alt="GS" />
                                    </div>
                                    <input
                                        type="text"
                                        className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl pl-11 pr-4 text-sm font-bold focus:bg-white focus:border-[#0f9d58] focus:ring-4 focus:ring-[#0f9d58]/5 outline-none transition-all"
                                        value={config.targetListName}
                                        onChange={(e) => setConfig({ ...config, targetListName: e.target.value })}
                                        placeholder="Nhập tên danh sách..."
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                        <span className="text-[10px] font-bold bg-slate-200 text-slate-500 px-2 py-1 rounded-md">Mới</span>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium ml-1">Hệ thống sẽ tự động tạo danh sách này và nạp dữ liệu vào.</p>
                            </div>

                            <div className="p-5 bg-slate-900 rounded-[24px] border border-slate-800 text-white flex gap-4 items-start relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-[#0f9d58] rounded-full blur-[60px] opacity-10 group-hover:opacity-20 transition-opacity"></div>
                                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md shrink-0 border border-white/10">
                                    <Zap className="w-5 h-5 text-[#0f9d58]" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold tracking-tight text-white/90">Cơ chế đồng bộ Real-time</h4>
                                    <p className="text-[11px] text-slate-400 font-medium mt-1 leading-relaxed">
                                        Hệ thống sẽ tự động quét Google Sheets mỗi <span className="text-[#0f9d58] font-bold">{config.syncInterval} phút</span>.
                                        <br />Các dòng dữ liệu mới sẽ được nạp ngay vào danh sách và kích hoạt Automation nếu có.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Virtual Email Toggle */}
                        <div className="space-y-4">
                            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">Nhận diện nâng cao</h4>
                            <div className="bg-orange-50/30 border border-orange-100 p-6 rounded-[28px] space-y-4">
                                <label className="flex items-center justify-between cursor-pointer group">
                                    <div className="flex-1 pr-8">
                                        <h5 className="text-sm font-bold text-slate-800 group-hover:text-orange-700 transition-colors">Tạo Email ảo cho người chỉ có SĐT</h5>
                                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">
                                            Nếu một liên hệ từ Google Sheets không có Email nhưng có Số điện thoại, hệ thống sẽ tự động tạo Email ảo dạng <code>phone@no-email.domation</code> để định danh.
                                        </p>
                                    </div>
                                    <div
                                        onClick={() => setConfig({ ...config, createVirtualEmail: !config.createVirtualEmail })}
                                        className={`relative w-14 h-8 rounded-full transition-all duration-300 ${config.createVirtualEmail ? 'bg-orange-500' : 'bg-slate-200'}`}
                                    >
                                        <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-sm transition-all duration-300 ${config.createVirtualEmail ? 'translate-x-6' : ''}`} />
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="flex flex-col animate-in fade-in slide-in-from-right-4 duration-500 relative min-h-[500px]">
            {/* Steps Indicator - Sticky Top */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-20 pt-4 pb-4 mb-2 px-6 border-b border-slate-50">
                <div className="flex items-center gap-2 px-1">
                    {[1, 2, 3].map((s) => (
                        <React.Fragment key={s}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= s ? 'bg-[#2563eb] text-white' : 'bg-slate-100 text-slate-400'
                                }`}>
                                {step > s ? <Check className="w-4 h-4" /> : s}
                            </div>
                            {s < 3 && <div className={`flex-1 h-0.5 rounded-full ${step > s ? 'bg-[#2563eb]' : 'bg-slate-100'}`} />}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 px-8 pb-32 pt-2">
                <div className="mb-6">
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold text-slate-800">
                            {step === 1 ? 'Cấu hình Google Sheets' : step === 2 ? 'Mapping dữ liệu' : 'Hoàn tất cấu hình'}
                        </h3>
                        <img src="https://mailmeteor.com/logos/assets/PNG/Google_Sheets_Logo_512px.png" className="w-6 h-6 object-contain" alt="Google Sheets" />
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                        {step === 1 ? 'Kết nối bảng tính của bạn để tự động nạp dữ liệu Khách hàng.' : step === 2 ? 'Gán tiêu đề cột trong Sheet vào các trường của hệ thống.' : 'Đặt tên cho danh sách Khách hàng mới.'}
                    </p>
                </div>

                {renderStepContent()}
            </div>

            {/* Sticky Footer Buttons */}
            <div className="sticky bottom-0 px-8 py-5 bg-white/95 backdrop-blur-sm border-t border-slate-100 flex gap-3 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] mt-auto">
                {step === 1 ? (
                    <>
                        <Button variant="ghost" onClick={onBack} className="flex-1 rounded-xl">Quay lại</Button>
                        {initialData && (
                            <Button
                                variant="outline"
                                className={`flex-1 rounded-xl ${initialData.status === 'active' ? 'text-rose-600 border-rose-200 hover:bg-rose-50' : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}
                                onClick={async () => {
                                    setLoading(true);
                                    try {
                                        const newStatus = initialData.status === 'active' ? 'inactive' : 'active';
                                        const res = await api.put(`integrations?id=${initialData.id}`, { status: newStatus });
                                        if (res.success) {
                                            toast.success(newStatus === 'active' ? 'Đã kích hoạt lại kết nối' : 'Đã ngưng kết nối');
                                            onComplete();
                                        } else {
                                            toast.error(res.message);
                                        }
                                    } catch (e) {
                                        toast.error('Lỗi khi cập nhật Trạng thái');
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                isLoading={loading}
                            >
                                {initialData.status === 'active' ? 'Ngưng kết nối' : 'Kích hoạt lại'}
                            </Button>
                        )}
                        <Button onClick={handleConnect} isLoading={loading} className="flex-[2] rounded-xl">Kiểm tra kết nối <ChevronRight className="w-4 h-4" /></Button>
                    </>
                ) : step === 2 ? (
                    <>
                        <Button variant="ghost" onClick={() => setStep(1)} className="flex-1 rounded-xl">Quay lại</Button>
                        <Button onClick={() => setStep(3)} className="flex-[2] rounded-xl">Tiếp theo <ChevronRight className="w-4 h-4" /></Button>
                    </>
                ) : (
                    <>
                        <Button variant="ghost" onClick={() => setStep(2)} className="flex-1 rounded-xl">Quay lại</Button>
                        <Button onClick={handleSave} isLoading={loading} className="flex-[2] rounded-xl">Lưu & Kích hoạt <Check className="w-4 h-4" /></Button>
                    </>
                )}
            </div>
        </div>
    );
};

const Info = ({ className }: { className?: string }) => (
    <div className={className}><AlertCircle className="w-full h-full" /></div>
);

export default GoogleSheetsSetup;
