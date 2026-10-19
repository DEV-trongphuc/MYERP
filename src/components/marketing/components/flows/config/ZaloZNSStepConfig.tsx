import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, FileText, AlertCircle, ChevronDown, Check, UploadCloud, FileSpreadsheet, Send, HelpCircle, Eye, RefreshCw, X, Download, Clock, Zap, ShieldAlert, BadgeCheck, Braces, Calendar, User, ChevronRight, Search, ArrowRight } from 'lucide-react';
import { api } from '../../../services/storageAdapter';
import { getMktPortalRoot } from '../../../utils/portalRoot';

interface ZaloOA {
    id: string;
    name: string;
    status: string;
}

interface ZaloTemplate {
    id: string;
    template_id: string;
    template_name: string;
    template_type: string;
    status: string;
    preview_data?: any[]; // Array of params from Zalo
    template_data?: {
        detail?: {
            previewUrl?: string;
        };
        support_uid?: boolean;
        price_uid?: number | string;
        price?: number | string;
    };
}

interface ZaloZNSStepConfigProps {
    config: any;
    onChange: (config: any) => void;
    disabled?: boolean;
    flow?: any;
    onUpdateFlow?: (updates: any) => void;
}

interface Option {
    value: string;
    label: string;
    subLabel?: string;
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
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    const calculatePosition = useCallback(() => {
        if (!buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const dropdownHeight = Math.min(options.length * 56 + 8, 240);

        // Open upward if not enough space below
        if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
            setDropdownStyle({
                position: 'fixed',
                top: rect.top - dropdownHeight - 4,
                left: rect.left,
                width: rect.width,
                zIndex: 2147483647,
            });
        } else {
            setDropdownStyle({
                position: 'fixed',
                top: rect.bottom + 4,
                left: rect.left,
                width: rect.width,
                zIndex: 2147483647,
            });
        }
    }, [options.length]);

    const handleOpen = () => {
        if (disabled) return;
        if (!isOpen) {
            calculatePosition();
        }
        setIsOpen(v => !v);
    };

    useEffect(() => {
        if (!isOpen) return;
        const handleClose = (e: MouseEvent) => {
            if (
                dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        const handleScroll = () => { calculatePosition(); };
        document.addEventListener('mousedown', handleClose);
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', calculatePosition);
        return () => {
            document.removeEventListener('mousedown', handleClose);
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', calculatePosition);
        };
    }, [isOpen, calculatePosition]);

    const dropdown = isOpen ? (
        <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="bg-white border border-slate-100 rounded-xl shadow-2xl max-h-60 overflow-auto divide-y divide-slate-50 animate-in fade-in zoom-in-95 duration-100"
        >
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
                        className={`w-full px-4 py-3 flex items-start text-left hover:bg-blue-50 transition-colors group ${option.value === value ? 'bg-blue-50/50' : ''}`}
                    >
                        <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${option.value === value ? 'text-blue-700' : 'text-slate-700'}`}>
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
    ) : null;

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                type="button"
                onClick={handleOpen}
                disabled={disabled}
                className={`w-full px-4 py-3 flex items-center justify-between bg-white border-2 rounded-xl text-sm font-medium transition-all ${isOpen
                    ? 'border-blue-500 ring-4 ring-blue-500/10'
                    : 'border-slate-200 hover:border-blue-300'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                <span className={`block truncate ${!selectedOption ? 'text-slate-400' : 'text-slate-700'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} />
            </button>

            {typeof document !== 'undefined' && dropdown && createPortal(dropdown, getMktPortalRoot())}
        </div>
    );
};

const ZaloZNSStepConfig: React.FC<ZaloZNSStepConfigProps> = ({ config, onChange, disabled, flow, onUpdateFlow }) => {
    const [oas, setOas] = useState<ZaloOA[]>([]);
    const [templates, setTemplates] = useState<ZaloTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [csvStats, setCsvStats] = useState<{
        totalRows: number;
        validRows: number;
        missingRequired: string[];
    } | null>(null);

    // Variable picker state
    const [varPickerField, setVarPickerField] = useState<string | null>(null);
    const [varPickerSearch, setVarPickerSearch] = useState('');
    const [pickerButtonRect, setPickerButtonRect] = useState<DOMRect | null>(null);
    const [customFields, setCustomFields] = useState<{ key: string; label: string }[]>([]);
    const varPickerRef = useRef<HTMLDivElement>(null);

    // Simple UUID fallback
    const generateId = () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    };

    useEffect(() => {
        fetchOAs();
        fetchCustomFields();
    }, []);

    useEffect(() => {
        if (config.zalo_oa_id) {
            fetchTemplates(config.zalo_oa_id);
        }
    }, [config.zalo_oa_id]);

    useEffect(() => {
        if (config.template_id && templates.length > 0) {
            const selected = templates.find(t => t.template_id === config.template_id);
            if (selected && !selected.template_data?.detail?.previewUrl) {
                fetchTemplateDetail(selected.id);
            }

            // Sync required_params for validation
            if (selected) {
                const requiredParams = selected.preview_data?.filter((p: any) => p.require).map((p: any) => p.name) || [];
                const currentRequired = config.required_params || [];
                const isDifferent = JSON.stringify(requiredParams.sort()) !== JSON.stringify(currentRequired.sort());

                if (isDifferent) {
                    onChange({
                        ...config,
                        required_params: requiredParams
                    });
                }
            }
        }
    }, [config.template_id, templates]);

    const fetchOAs = async () => {
        setLoading(true);
        const res = await api.get<ZaloOA[]>('zalo_oa');
        if (res.success) {
            setOas(res.data.filter((oa: ZaloOA) => oa.status === 'active'));
        }
        setLoading(false);
    };

    const fetchCustomFields = async () => {
        try {
            // Fetch custom attribute keys from subscribers - take a sample to find keys
            const res = await api.get<any>('subscribers?limit=1&fields=custom_attributes');
            if (res.success && res.data?.length > 0) {
                const sample = res.data[0].custom_attributes;
                const attrs = typeof sample === 'string' ? JSON.parse(sample || '{}') : (sample || {});
                const fields = Object.keys(attrs).map(k => ({ key: k, label: k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) }));
                setCustomFields(fields);
            }
        } catch (e) {
            // Ignore if endpoint doesn't support
        }
    };

    const fetchTemplates = async (oaId: string) => {
        const res = await api.get<ZaloTemplate[]>(`zalo_templates?oa_id=${oaId}`);
        if (res.success) {
            setTemplates(res.data.filter((t: ZaloTemplate) => t.status === 'approved'));
        }
    };

    const fetchTemplateDetail = async (id: string) => {
        setLoadingDetail(true);
        try {
            const res = await api.post<{ previewUrl?: string }>(`zalo_templates?route=detail&id=${id}`, {});
            if (res.success && res.data) {
                setTemplates(prev => prev.map(t => t.id === id ? { ...t, template_data: { ...(t.template_data || {}), detail: res.data } } : t));
            }
        } catch (e) {
            console.error('Failed to fetch detail', e);
        }
        setLoadingDetail(false);
    };

    const handleSyncTemplates = async () => {
        if (!config.zalo_oa_id) return;
        setSyncing(true);
        try {
            const res = await api.post(`zalo_templates?route=sync&oa_id=${config.zalo_oa_id}`, {});
            if (res.success) {
                await fetchTemplates(config.zalo_oa_id);
            }
        } catch (e) {
            console.error('Sync failed', e);
        }
        setSyncing(false);
    };

    const handleOAChange = (oaId: string) => {
        onChange({
            ...config,
            zalo_oa_id: oaId,
            template_id: '',
            template_data: {},
            input_mode: config.input_mode || 'manual'
        });
    };

    const handleTemplateChange = (templateId: string) => {
        const selected = templates.find(t => t.template_id === templateId);
        const requiredParams = selected?.preview_data?.filter((p: any) => p.require).map((p: any) => p.name) || [];

        onChange({
            ...config,
            template_id: templateId,
            template_data: {},
            required_params: requiredParams
        });
    };

    const KNOWN_ZNS_LIMITS: Record<string, number> = {
        customer_name: 30,
        phone_number: 15,
        address: 80,
        product_code: 30,
        custom_field: 30,
        transaction_status: 30,
        contact: 50,
        personal_title: 5,
        product_name: 100,
        amount_vn_standard: 20,
        time: 20,
        bank_transfer_note: 90
    };

    const handleTemplateDataChange = (field: string, value: string) => {
        let safeValue = value;
        const limit = KNOWN_ZNS_LIMITS[field];
        
        if (limit && safeValue.length > limit) {
            safeValue = safeValue.substring(0, limit);
        }
        
        if (field === 'bank_transfer_note') {
            safeValue = safeValue.replace(/[@\[\]\^_!"•#\$%¥&'\(\)\*\+,€\-\.\/:;{\\|<}=~>\?]/g, '');
        }

        onChange({
            ...config,
            template_data: {
                ...config.template_data,
                [field]: safeValue
            }
        });
    };

    const handleInputModeChange = (mode: 'manual' | 'csv') => {
        onChange({
            ...config,
            input_mode: mode,
            template_data: {} // Reset params
        });
        setCsvFile(null);
        setCsvHeaders([]);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setCsvFile(file);
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
            if (lines.length > 0) {
                const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
                setCsvHeaders(headers);

                // Auto match logic
                const autoMapped: any = {};
                const selectedTemplate = templates.find(t => t.template_id === config.template_id);
                const params = selectedTemplate?.preview_data || [];
                const missingReq: string[] = [];

                params.forEach((p: any) => {
                    const match = headers.find(h => h === p.name.toLowerCase() || h.includes(p.name.toLowerCase()));
                    if (match) {
                        autoMapped[p.name] = `csv:${match}`;
                    } else if (p.require) {
                        missingReq.push(p.name);
                    }
                });

                // Check for phone and validate rows
                const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('sdt') || h.includes('số điện thoại'));
                let validCount = 0;

                if (phoneIdx !== -1) {
                    const phoneHeader = headers[phoneIdx];
                    autoMapped['phone_column'] = phoneHeader;

                    // Validate rows
                    const rows = lines.slice(1);
                    const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/; // Split by comma not inside quotes

                    rows.forEach(r => {
                        const cols = r.split(csvRegex);
                        const val = cols[phoneIdx]?.trim().replace(/^"|"$/g, '');
                        if (val && val.length >= 9 && val.length <= 15 && /^\d+$/.test(val)) {
                            validCount++;
                        }
                    });

                    setCsvStats({
                        totalRows: rows.length,
                        validRows: validCount,
                        missingRequired: missingReq
                    });
                } else {
                    setCsvStats({
                        totalRows: lines.length - 1,
                        validRows: 0,
                        missingRequired: missingReq
                    });
                }

                onChange({
                    ...config,
                    template_data: autoMapped,
                    csv_filename: file.name
                });
            }
        };
        reader.readAsText(file);
    };

    const handleFallbackChange = (behavior: string) => {
        onChange({
            ...config,
            fallback_behavior: behavior
        });
    };

    const handleDownloadTemplate = () => {
        if (!selectedTemplate) return;
        const params = selectedTemplate.preview_data || [];
        const headers = ['phone', ...params.map((p: any) => p.name)];
        const csvContent = headers.join(',') + '\n' + headers.map(() => 'sample_value').join(',');

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `zns_template_${selectedTemplate.template_id}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // All available variables grouped by category
    const allVariableGroups = [
        {
            label: 'Thông tin Contact',
            icon: 'user',
            vars: [
                { key: '{{first_name}}', label: 'Tên', desc: 'First name of contact' },
                { key: '{{last_name}}', label: 'Họ', desc: 'Last name of contact' },
                { key: '{{full_name}}', label: 'Họ và tên', desc: 'Full name' },
                { key: '{{email}}', label: 'Email', desc: 'Email address' },
                { key: '{{phone_number}}', label: 'Số điện thoại', desc: 'Phone number' },
                { key: '{{company_name}}', label: 'Công ty', desc: 'Company name' },
                { key: '{{job_title}}', label: 'Chức vụ', desc: 'Job title' },
                { key: '{{city}}', label: 'Thành phố', desc: 'City' },
                { key: '{{country}}', label: 'Quốc gia', desc: 'Country' },
                { key: '{{date_of_birth}}', label: 'Ngày sinh', desc: 'Date of birth' },
                { key: '{{gender}}', label: 'Giới tính', desc: 'Gender' },
                { key: '{{joined_at}}', label: 'Ngày tham gia', desc: 'Join date (dd/mm/yyyy)' },
            ]
        },
        {
            label: 'Ngày & Thời gian',
            icon: 'calendar',
            vars: [
                { key: '{{today}}', label: 'Hôm nay', desc: 'Today\'s date (dd/mm/yyyy)' },
                { key: '{{today_ymd}}', label: 'Hôm nay (yyyy-mm-dd)', desc: 'Today yyyy-mm-dd format' },
                { key: '{{today_dmy}}', label: 'Hôm nay (dd-mm-yyyy)', desc: 'Today dd-mm-yyyy format' },
                { key: '{{current_date}}', label: 'Ngày hiện tại', desc: 'Current date dd/mm/yyyy' },
                { key: '{{year}}', label: 'Năm hiện tại', desc: 'Current year' },
                { key: '{{time}}', label: 'Giờ hiện tại', desc: 'Current time HH:mm' },
            ]
        },
        {
            label: 'Hệ thống',
            icon: 'system',
            vars: [
                { key: '{{subscriber_id}}', label: 'ID Subscriber', desc: 'Unique ID of the contact' },
                { key: '{{contact_id}}', label: 'Contact ID', desc: 'Alias for subscriber_id' },
            ]
        },
        ...(customFields.length > 0 ? [{
            label: 'Custom Fields',
            icon: 'custom',
            vars: customFields.map(f => ({ key: `{{${f.key}}}`, label: f.label, desc: `Custom field: ${f.key}` }))
        }] : [])
    ];

    const personalizationTags = [
        { label: 'Tên', value: 'first_name' },
        { label: 'Họ', value: 'last_name' },
        { label: 'Email', value: 'email' },
        { label: 'SĐT', value: 'phone_number' },
        { label: 'Công ty', value: 'company_name' },
        { label: 'Hôm nay', value: 'today' },
        { label: 'ID', value: 'subscriber_id' },
    ];

    // Insert variable into a specific field
    const insertVariable = (fieldName: string, varKey: string) => {
        const currentVal = config.template_data?.[fieldName] || '';
        handleTemplateDataChange(fieldName, currentVal + varKey);
        setVarPickerField(null);
        setPickerButtonRect(null);
        setVarPickerSearch('');
    };

    // Open picker: track button rect for portal positioning
    const openPicker = (fieldName: string, e: React.MouseEvent<HTMLButtonElement>) => {
        if (varPickerField === fieldName) {
            setVarPickerField(null);
            setPickerButtonRect(null);
        } else {
            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
            setPickerButtonRect(rect);
            setVarPickerField(fieldName);
            setVarPickerSearch('');
        }
    };

    // Compute fixed position for the picker portal
    const getPickerStyle = (): React.CSSProperties => {
        if (!pickerButtonRect) return { display: 'none' };
        const W = 320;
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;
        const spaceBelow = viewportH - pickerButtonRect.bottom;
        const spaceAbove = pickerButtonRect.top;
        const estimatedH = 420;

        // Left: align right edge of picker with right edge of button, but clamp to viewport
        let left = pickerButtonRect.right - W;
        if (left < 8) left = 8;
        if (left + W > viewportW - 8) left = viewportW - W - 8;

        // Top: open upward if not enough space below
        let top: number;
        if (spaceBelow < estimatedH && spaceAbove > spaceBelow) {
            top = pickerButtonRect.top - estimatedH - 4;
            if (top < 8) top = 8;
        } else {
            top = pickerButtonRect.bottom + 4;
        }

        return { position: 'fixed', top, left, width: W, zIndex: 2147483647 };
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (oas.length === 0) {
        return (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center shadow-inner">
                <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                <p className="text-sm font-bold text-amber-800 mb-2">Chưa kết nối Zalo OA</p>
                <p className="text-xs text-amber-700 leading-relaxed mb-4 max-w-sm mx-auto">Vui lòng kết nối Zalo Official Account trong phần Cài đặt Hệ thống để bắt đầu thiết lập gửi tin nhắn ZNS.</p>
                <a href="/settings" target="_blank" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-amber-700 font-black text-[10px] uppercase tracking-widest rounded-xl shadow-[0_2px_10px_rgba(245,158,11,0.15)] border border-amber-200 hover:bg-amber-100 hover:-translate-y-0.5 hover:shadow-md transition-all active:scale-95">
                    Đến trang Quản lý Kết nối <ArrowRight className="w-3.5 h-3.5" />
                </a>
            </div>
        );
    }

    const oaOptions: Option[] = oas.map(oa => ({
        value: oa.id,
        label: oa.name,
        subLabel: 'Official Account'
    }));

    const templateOptions: Option[] = templates.map(t => ({
        value: t.template_id,
        label: t.template_name,
        subLabel: `ID: ${t.template_id} • Type: ${t.template_type}`
    }));

    const selectedTemplate = templates.find(t => t.template_id === config.template_id);
    const templateParams = selectedTemplate?.preview_data || [];
    const previewUrl = selectedTemplate?.template_data?.detail?.previewUrl;

    const isTimeInsecure = flow?.config?.startTime && flow?.config?.endTime && (
        flow.config.startTime < '06:00' || flow.config.endTime > '22:00'
    );

    const handleAutoAdjust = () => {
        if (!onUpdateFlow) return;
        onUpdateFlow({
            startTime: '06:00',
            endTime: '22:00'
        });
    };

    return (
        <div className="space-y-8">
            {/* ZNS Time Policy Warning with Auto-Adjust */}
            <div className={`p-5 rounded-2xl border shadow-sm animate-in zoom-in-95 duration-500 ${isTimeInsecure ? 'bg-orange-50 border-orange-200' : 'bg-emerald-50/50 border-emerald-100'}`}>
                <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0 ${isTimeInsecure ? 'text-orange-500' : 'text-emerald-500'}`}>
                        {isTimeInsecure ? <ShieldAlert className="w-5 h-5" /> : <BadgeCheck className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                            <h4 className={`text-[11px] font-black uppercase tracking-widest ${isTimeInsecure ? 'text-orange-900' : 'text-emerald-900'}`}>
                                {isTimeInsecure ? 'Cảnh báo khung giờ gửi ZNS' : 'Khung giờ Flow đã an toàn'}
                            </h4>
                            <Clock className={`w-4 h-4 ${isTimeInsecure ? 'text-orange-400' : 'text-emerald-400'}`} />
                        </div>
                        <p className={`text-[11px] font-bold leading-relaxed ${isTimeInsecure ? 'text-orange-800' : 'text-emerald-800'}`}>
                            {isTimeInsecure
                                ? `Theo chính sách Zalo, tin ZNS chỉ gửi được từ 06:00 - 22:00. Flow hiện tại (${flow.config.startTime} - ${flow.config.endTime}) có thể khiến tin nhắn bị tạm giữ hoặc thất bại.`
                                : 'Cấu hình Thời gian của Flow này đã tuân thủ chính sách của Zalo (06:00 - 22:00). Tin nhắn ZNS sẽ được gửi đi ngay lập tức.'
                            }
                        </p>

                        {isTimeInsecure && onUpdateFlow && !disabled && (
                            <button
                                onClick={handleAutoAdjust}
                                className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-[var(--color-primary-hover)] transition-all shadow-md shadow-[var(--color-primary)]/20 active:scale-95"
                            >
                                <Zap className="w-3.5 h-3.5" />
                                Tự động điều chỉnh Flow (06:00 - 22:00)
                            </button>
                        )}
                    </div>
                </div>
            </div>
            {/* Configuration Section */}
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* OA Selection */}
                    <div className="relative z-30">
                        <label className="block text-xs font-black text-slate-600 uppercase tracking-widest mb-3">
                            <MessageSquare className="w-4 h-4 inline mr-2 text-blue-500" />
                            Gửi từ Zalo OA
                        </label>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <CustomSelect
                                    value={config.zalo_oa_id || ''}
                                    options={oaOptions}
                                    onChange={handleOAChange}
                                    disabled={disabled}
                                    placeholder="-- Chọn Zalo OA --"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleSyncTemplates}
                                disabled={disabled || !config.zalo_oa_id || syncing}
                                className={`px-4 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all
                                    ${syncing ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100'}
                                `}
                            >
                                {syncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Sync'}
                            </button>
                        </div>
                    </div>

                    {/* Template Selection */}
                    {config.zalo_oa_id && (
                        <div className="relative z-20">
                            <div className="flex justify-between items-center mb-3">
                                <label className="block text-xs font-black text-slate-600 uppercase tracking-widest">
                                    <FileText className="w-4 h-4 inline mr-2 text-indigo-500" />
                                    Chọn Mẫu (Template)
                                </label>
                                {previewUrl && (
                                    <a href={previewUrl} target="_blank" rel="noreferrer" className="text-[10px] bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-600 font-bold px-3 py-1.5 rounded-[10px] flex items-center gap-1.5 transition-all shadow-sm active:scale-95">
                                        <Eye className="w-3.5 h-3.5" /> Xem trước thiết kế Mẫu
                                    </a>
                                )}
                            </div>
                            <CustomSelect
                                value={config.template_id || ''}
                                options={templateOptions}
                                onChange={handleTemplateChange}
                                disabled={disabled || templates.length === 0}
                                placeholder={templates.length === 0 ? "Không có template nào" : "-- Chọn Template --"}
                            />

                            {/* [NEW] UID Support Warning */}
                            {selectedTemplate && selectedTemplate.template_data?.support_uid === false && (
                                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-[11px] font-black text-amber-800 uppercase tracking-wide mb-1">
                                            Lưu ý: Template không hỗ trợ UID
                                        </p>
                                        <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
                                            Mẫu này sẽ <b>tự động chuyển sang gửi qua Số điện thoại</b> nếu bạn nhập UID.
                                            <br />
                                            Chi phí dự kiến: <b className="text-amber-900">{selectedTemplate.template_data?.price || 'theo quy định Zalo'} VND/tin</b>.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Input Mode Toggle & Config Area */}
                {config.template_id && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="flex p-1 bg-slate-100 rounded-2xl w-fit shadow-inner">
                                <button
                                    onClick={() => handleInputModeChange('manual')}
                                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${config.input_mode !== 'csv' ? 'bg-white text-blue-600 shadow-md ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <HelpCircle className="w-3.5 h-3.5 inline mr-1.5" />
                                    Cá nhân hóa
                                </button>
                                <button
                                    onClick={() => handleInputModeChange('csv')}
                                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${config.input_mode === 'csv' ? 'bg-white text-blue-600 shadow-md ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <FileSpreadsheet className="w-3.5 h-3.5 inline mr-1.5" />
                                    Gửi theo list CSV
                                </button>
                            </div>

                            {config.input_mode === 'csv' && (
                                <button
                                    type="button"
                                    onClick={handleDownloadTemplate}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 border border-emerald-100 transition-all active:scale-95"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Tải file Mẫu .CSV
                                </button>
                            )}
                        </div>

                        <div className="p-8 bg-white rounded-2xl border-2 border-slate-100 shadow-xl shadow-slate-200/20">
                            <div className="flex items-center justify-between mb-8">
                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                    Cấu hình Tham số (Parameters)
                                </h4>
                                {config.input_mode === 'manual' && (
                                    <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase tracking-widest">
                                        Manual Mode
                                    </span>
                                )}
                            </div>

                            {config.input_mode === 'csv' ? (
                                <div className="space-y-8">
                                    {/* CSV Upload */}
                                    <div className="relative group">
                                        <input
                                            type="file"
                                            accept=".csv"
                                            onChange={handleFileUpload}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            disabled={disabled}
                                        />
                                        <div className={`py-12 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 transition-all ${csvFile ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-100 bg-slate-50/50 group-hover:border-blue-300 group-hover:bg-blue-50/30'}`}>
                                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${csvFile ? 'bg-emerald-500 text-white' : 'bg-white text-slate-300'}`}>
                                                <UploadCloud className="w-8 h-8" />
                                            </div>
                                            <div className="text-center px-6">
                                                <p className="text-sm font-black text-slate-800 uppercase tracking-tight">
                                                    {csvFile ? csvFile.name : 'Chọn danh sách người nhận (.CSV)'}
                                                </p>
                                                <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest leading-relaxed">
                                                    {csvFile ? 'File đã sẵn sàng xử lý' : 'Chỉ chấp nhận file định dạng CSV có chứa cột SĐT'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* CSV Mapping Info */}
                                    {csvHeaders.length > 0 && (
                                        <div className="space-y-6 animate-in slide-in-from-bottom-4">
                                            <div className="flex items-center gap-3 px-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50"></div>
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Kết quả Mapping dữ liệu:</p>
                                            </div>
                                            {csvStats && (
                                                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <h5 className="text-[11px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                                            <FileText className="w-4 h-4 text-blue-500" />
                                                            Báo cáo kiểm tra File
                                                        </h5>
                                                        <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-2 py-1 rounded-lg">
                                                            Total: {csvStats.totalRows} hàng
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {/* Valid Rows */}
                                                        <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-[10px] font-bold text-emerald-600 uppercase">Hợp lệ (SĐT OK)</span>
                                                                <Check className="w-4 h-4 text-emerald-500" />
                                                            </div>
                                                            <p className="text-2xl font-black text-emerald-700">{csvStats.validRows}</p>
                                                        </div>

                                                        {/* Invalid Rows */}
                                                        <div className={`border p-3 rounded-xl ${csvStats.totalRows - csvStats.validRows > 0 ? 'bg-orange-50 border-orange-100' : 'bg-slate-50 border-slate-100'}`}>
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className={`text-[10px] font-bold uppercase ${csvStats.totalRows - csvStats.validRows > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                                                                    Lỗi (SĐT sai/trống)
                                                                </span>
                                                                {csvStats.totalRows - csvStats.validRows > 0 ? (
                                                                    <AlertCircle className="w-4 h-4 text-orange-500" />
                                                                ) : (
                                                                    <Check className="w-4 h-4 text-slate-300" />
                                                                )}
                                                            </div>
                                                            <p className={`text-2xl font-black ${csvStats.totalRows - csvStats.validRows > 0 ? 'text-orange-700' : 'text-slate-300'}`}>
                                                                {csvStats.totalRows - csvStats.validRows}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Missing Columns Warning */}
                                                    {csvStats.missingRequired.length > 0 && (
                                                        <div className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-100 rounded-xl">
                                                            <X className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                                                            <div>
                                                                <p className="text-[11px] font-black text-rose-700 uppercase mb-1">Thiếu cột bắt buộc</p>
                                                                <p className="text-[11px] text-rose-600 leading-relaxed">
                                                                    File CSV thiếu các tham số sau: <b>{csvStats.missingRequired.join(', ')}</b>.
                                                                    Tin nhắn có thể bị Zalo từ chối.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Fallback Logic Explanation */}
                                                    {(csvStats.totalRows - csvStats.validRows > 0) && (
                                                        <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                                                            <HelpCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                                                            <div>
                                                                <p className="text-[11px] font-black text-blue-700 uppercase mb-1">Xử lý hàng lỗi</p>
                                                                <p className="text-[11px] text-blue-600 leading-relaxed">
                                                                    Có <b>{csvStats.totalRows - csvStats.validRows}</b> hàng chứa SĐT không hợp lệ.
                                                                    Hệ thống sẽ <span className="font-black px-1.5 py-0.5 bg-white rounded border border-blue-200">
                                                                        {config.fallback_behavior === 'mark_failed' ? 'CẮT FLOW & BÁO LỖI' : 'Bỏ qua & TIẾP TỤC'}
                                                                    </span> đối với các liên hệ này.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {!csvHeaders.some(h => h.includes('phone') || h.includes('sdt')) && (
                                                <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex items-center gap-3">
                                                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                                                    <p className="text-[11px] text-rose-600 font-bold leading-relaxed">
                                                        Vui lòng chọn cột chứa Số điện thoại để hệ thống có thể gửi tin nhắn.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {/* Dynamic Inputs (Manual) */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {templateParams.map((param: any) => {
                                            const fieldName = param.name;
                                            const isPickerOpen = varPickerField === fieldName;
                                            return (
                                                <div key={fieldName} className="space-y-2 group relative">
                                                    <label className="flex justify-between items-center px-1">
                                                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">{fieldName}</span>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{param.type || 'text'}</span>
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={config.template_data?.[fieldName] || ''}
                                                            onChange={(e) => handleTemplateDataChange(fieldName, e.target.value)}
                                                            disabled={disabled}
                                                            placeholder={`Nhập nội dung cho ${fieldName}...`}
                                                            className="w-full px-5 py-4 pr-12 bg-slate-50 border-2 border-transparent rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all placeholder:font-medium"
                                                        />
                                                        {!disabled && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => openPicker(fieldName, e)}
                                                                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-xl transition-all ${isPickerOpen
                                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                                                    : 'bg-white text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-200'
                                                                    }`}
                                                                title="Chọn biến"
                                                            >
                                                                <Braces className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        {/* Variable Picker Portal */}
                                                        {isPickerOpen && typeof document !== 'undefined' && createPortal(
                                                            <>
                                                                <div
                                                                    className="fixed inset-0"
                                                                    style={{ zIndex: 2147483646 }}
                                                                    onClick={() => { setVarPickerField(null); setPickerButtonRect(null); }}
                                                                />
                                                                <div
                                                                    ref={varPickerRef}
                                                                    style={getPickerStyle()}
                                                                    className="bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                                                                >
                                                                    {/* Header */}
                                                                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3">
                                                                        <p className="text-[11px] font-black text-white uppercase tracking-widest mb-2">Chọn biến cho: <span className="text-blue-200">{fieldName}</span></p>
                                                                        <div className="relative">
                                                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-blue-300" />
                                                                            <input
                                                                                type="text"
                                                                                placeholder="Tìm biến..."
                                                                                value={varPickerSearch}
                                                                                onChange={e => setVarPickerSearch(e.target.value)}
                                                                                className="w-full pl-7 pr-3 py-1.5 bg-white/20 text-white placeholder-blue-300 text-xs rounded-lg outline-none focus:bg-white/30"
                                                                                autoFocus
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    {/* Variables grouped */}
                                                                    <div className="max-h-72 overflow-y-auto">
                                                                        {allVariableGroups.map((group, gi) => {
                                                                            const filtered = group.vars.filter(v =>
                                                                                !varPickerSearch ||
                                                                                v.label.toLowerCase().includes(varPickerSearch.toLowerCase()) ||
                                                                                v.key.toLowerCase().includes(varPickerSearch.toLowerCase())
                                                                            );
                                                                            if (filtered.length === 0) return null;
                                                                            return (
                                                                                <div key={gi} className="border-b border-slate-100 last:border-0">
                                                                                    <p className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50">
                                                                                        {group.label}
                                                                                    </p>
                                                                                    {filtered.map((v, vi) => (
                                                                                        <button
                                                                                            key={vi}
                                                                                            type="button"
                                                                                            onClick={() => insertVariable(fieldName, v.key)}
                                                                                            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-blue-50 hover:text-blue-700 transition-colors text-left group/var"
                                                                                        >
                                                                                            <div className="flex-1 min-w-0">
                                                                                                <p className="text-[11px] font-black text-slate-700 group-hover/var:text-blue-700">{v.label}</p>
                                                                                                <p className="text-[9px] text-slate-400 font-mono">{v.key}</p>
                                                                                            </div>
                                                                                            <ChevronRight className="w-3 h-3 text-slate-300 group-hover/var:text-blue-500 shrink-0 ml-2" />
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>

                                                                    {/* Quick insert shortcuts */}
                                                                    <div className="px-3 py-2 bg-slate-50 border-t border-slate-100">
                                                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nhập nhanh</p>
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {[{ k: '{{today}}', l: 'Hôm nay' }, { k: '{{first_name}}', l: 'Tên' }, { k: '{{subscriber_id}}', l: 'ID' }].map(q => (
                                                                                <button
                                                                                    key={q.k}
                                                                                    type="button"
                                                                                    onClick={() => insertVariable(fieldName, q.k)}
                                                                                    className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-lg text-[9px] font-bold hover:bg-blue-600 hover:text-white transition-colors"
                                                                                >{q.l}</button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </>,
                                                            getMktPortalRoot()
                                                        )}
                                                    </div>
                                                    <div className="flex justify-between items-center px-1">
                                                        <span className="text-[9px] font-medium text-slate-400 italic">
                                                            {param.require ? '* Bắt buộc nhập' : 'Không bắt buộc'}
                                                        </span>
                                                        <div className="flex items-center gap-3">
                                                            {param.maxLength && (
                                                                <span className="text-[9px] font-black text-slate-300 uppercase">Tối đa {param.maxLength} kí tự</span>
                                                            )}
                                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${(config.template_data?.[fieldName] || '').length > (param.maxLength || 1000) ? 'bg-rose-50 text-rose-500 border border-rose-100' : 'bg-slate-50 text-slate-400'}`}>
                                                                {(config.template_data?.[fieldName] || '').length} / {param.maxLength || '∞'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {templateParams.length === 0 && (
                                        <div className="text-center py-10 opacity-30">
                                            <RefreshCw className="w-12 h-12 mx-auto mb-4" />
                                            <p className="text-xs font-black uppercase tracking-widest">Không có tham số</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Fallback & Info Box Container */}
                {config.template_id && (
                    <div className="space-y-6">
                        {/* Fallback Behavior */}
                        <div className="space-y-4">
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1 px-1">
                                Hành động nếu dữ liệu lỗi
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    onClick={() => handleFallbackChange('skip')}
                                    disabled={disabled}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                                        (config.fallback_behavior || 'skip') === 'skip'
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200'
                                            : 'bg-white border-slate-100 text-slate-500 hover:border-blue-200'
                                    }`}
                                >
                                    <HelpCircle className={`w-6 h-6 ${(config.fallback_behavior || 'skip') === 'skip' ? 'text-blue-100' : 'text-slate-200'}`} />
                                    <div className="text-center">
                                        <p className="text-[10px] font-black uppercase tracking-tight">Bỏ qua</p>
                                        <p className={`text-[8px] font-bold ${(config.fallback_behavior || 'skip') === 'skip' ? 'text-blue-200' : 'text-slate-400'}`}>TIẾP TỤC FLOW</p>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleFallbackChange('mark_failed')}
                                    disabled={disabled}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                                        config.fallback_behavior === 'mark_failed'
                                            ? 'bg-rose-600 border-rose-600 text-white shadow-lg shadow-rose-200'
                                            : 'bg-white border-slate-100 text-slate-500 hover:border-rose-200'
                                    }`}
                                >
                                    <X className={`w-6 h-6 ${config.fallback_behavior === 'mark_failed' ? 'text-rose-100' : 'text-slate-200'}`} />
                                    <div className="text-center">
                                        <p className="text-[10px] font-black uppercase tracking-tight">Cắt flow</p>
                                        <p className={`text-[8px] font-bold ${config.fallback_behavior === 'mark_failed' ? 'text-rose-200' : 'text-slate-400'}`}>ĐÁNH DẤU LỖI</p>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Info Box */}
                        <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6 flex flex-col sm:flex-row items-start gap-4">
                            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-indigo-500 shrink-0">
                                <HelpCircle className="w-6 h-6" />
                            </div>
                            <div className="space-y-2 flex-1 min-w-0">
                                <p className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Mách nhỏ cho bạn</p>
                                <ul className="space-y-3 text-[11px] text-slate-500 font-bold leading-relaxed">
                                    <li className="flex items-start gap-2.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0"></div>
                                        <p className="flex-1">Dùng <b className="text-indigo-600">Cá nhân hóa</b> khi muốn gửi tự động theo sự kiện của khách.</p>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0"></div>
                                        <p className="flex-1">Dùng <b className="text-indigo-600">CSV</b> khi đã có sẵn danh sách SĐT trong file Excel/CSV.</p>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Preview Section - Massive and Beautiful */}
            {
                config.template_id && (
                    <div className="pt-10 border-t border-slate-100 space-y-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                                    <Eye className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-base font-black text-slate-800 tracking-tight">TRỰC QUAN GIAO DIỆN (PREVIEW)</h4>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Xác nhận nội dung sẽ hiển thị trên điện thoại</p>
                                </div>
                            </div>
                            {previewUrl && (
                                <a href={previewUrl} target="_blank" rel="noreferrer" className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
                                    Open in Full Tab
                                </a>
                            )}
                        </div>

                        <div className="bg-slate-50/50 rounded-2xl p-12 border border-slate-100 relative overflow-hidden flex flex-col items-center group">
                            {/* Background Decor */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100/30 rounded-full blur-3xl -mr-32 -mt-32"></div>
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-100/30 rounded-full blur-3xl -ml-32 -mb-32"></div>

                            {loadingDetail ? (
                                <div className="h-[600px] flex flex-col items-center justify-center text-slate-400 gap-4">
                                    <RefreshCw className="w-10 h-10 animate-spin text-blue-500" />
                                    <p className="text-xs font-black uppercase tracking-[0.2em] animate-pulse">Đang nạp bộ xem trước...</p>
                                </div>
                            ) : previewUrl ? (
                                <div className="w-full max-w-[400px] bg-slate-900 rounded-[60px] p-2.5 shadow-2xl relative z-10 scale-100 group-hover:scale-[1.02] transition-transform duration-500">
                                    {/* Device Details */}
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-900 rounded-b-2xl z-30"></div>
                                    <div className="absolute top-8 left-8 right-8 h-4 flex justify-between items-center text-[10px] text-slate-400 font-bold z-30">
                                        <span>9:41</span>
                                        <div className="flex gap-1.5 items-center">
                                            <div className="w-3.5 h-2 bg-slate-600 rounded-sm"></div>
                                            <div className="w-2.5 h-2.5 bg-slate-600 rounded-full"></div>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-2xl overflow-hidden relative pt-12 pb-2 h-[560px]">
                                        <iframe
                                            src={previewUrl}
                                            title="ZNS Preview"
                                            className="w-full h-full border-0 bg-white overflow-hidden"
                                            sandbox="allow-scripts allow-same-origin"
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                border: 'none',
                                                overflow: 'hidden'
                                            }}
                                        />
                                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-28 h-1 bg-slate-200 rounded-full z-20"></div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-[500px] flex flex-col items-center justify-center text-center max-w-sm mx-auto relative z-10">
                                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-8 shadow-2xl border-4 border-slate-50">
                                        <AlertCircle className="w-10 h-10 text-amber-600" />
                                    </div>
                                    <h5 className="text-lg font-black text-slate-800 tracking-tight mb-2">KHÔNG TÌM THẤY PREVIEW</h5>
                                    <p className="text-sm font-bold text-slate-400 leading-relaxed mb-8 uppercase tracking-wide px-4">
                                        Zalo chưa cung cấp bản xem trước cho Template này hoặc bộ nhớ đệm đang gặp lỗi.
                                    </p>
                                    <button
                                        onClick={() => fetchTemplateDetail(selectedTemplate?.id || '')}
                                        className="px-10 py-3 bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl active:scale-95"
                                    >
                                        Thử tải lại ngay
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default ZaloZNSStepConfig;
