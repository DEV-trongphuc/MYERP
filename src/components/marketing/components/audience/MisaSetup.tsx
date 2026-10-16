import * as React from 'react';
import { useState, useEffect } from 'react';
import {
    Users, Target, Link2, Layout, Database, CheckCircle2, AlertCircle, X, ArrowRight,
    Search, Filter, ChevronDown, Download, RefreshCw, Smartphone, Globe, Mail, MapPin, Building,
    ExternalLink, Briefcase, Plus, Save, Terminal, Shield, UserCheck, Check, ChevronRight, Trash2, HelpCircle, Zap, Clock, Key, Eye
} from 'lucide-react';
import Button from '../common/Button';
import Select from '../common/Select';
import { api } from '../../services/storageAdapter';
import toast from 'react-hot-toast';
import { SYSTEM_FIELDS } from './misaConstants';

interface MisaSetupProps {
    onBack: () => void;
    onComplete: () => void;
    initialData?: any;
}

// --- Custom Select Component with Search & Rich Display ---

// Common MISA Field Labels (Local helper for better UI)
const COMMON_LABELS: Record<string, string> = {
    'email': 'Email',
    'office_email': 'Email công ty',
    'email_address': 'Địa chỉ Email',
    'first_name': 'Tên',
    'last_name': 'Họ',
    'contact_name': 'Tên liên hệ',
    'account_name': 'Tên Khách hàng',
    'mobile': 'Số di động',
    'office_tel': 'ĐT văn phòng',
    'owner_name': 'Nhân viên phụ trách',
    'description': 'Mô tả/Ghi chú',
    'billing_address': 'Địa chỉ thanh toán',
    'date_of_birth': 'Ngày sinh',
    'celebrate_date': 'Ngày kỷ niệm'
};

const FieldSelect = ({ value, options, onChange, sampleData = {}, placeholder = "Chọn trường MISA..." }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Enrich options with labels and sample data
    const richOptions = options.map((opt: string) => {
        const sampleValue = sampleData[opt];
        const displayValue = sampleValue !== null && sampleValue !== undefined && sampleValue !== ''
            ? (typeof sampleValue === 'object' ? JSON.stringify(sampleValue).substring(0, 30) : String(sampleValue).substring(0, 50))
            : null;

        return {
            value: opt,
            label: COMMON_LABELS[opt] || opt,
            originalKey: opt,
            sample: displayValue
        };
    });

    const filteredOptions = richOptions.filter((opt: any) =>
        opt.label.toLowerCase().includes(search.toLowerCase()) ||
        opt.originalKey.toLowerCase().includes(search.toLowerCase())
    );

    const selectedOption = richOptions.find((opt: any) => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative w-full" ref={containerRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`
w-full h-[42px] bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 rounded-xl px-3.5 flex items-center justify-between cursor-pointer transition-all select-none
                    ${isOpen ? 'bg-white border-blue-500 ring-4 ring-blue-500/10' : ''}
`}
            >
                <div className="flex flex-col justify-center overflow-hidden w-full pr-6">
                    {selectedOption ? (
                        <div className="flex items-center gap-2 w-full">
                            <span className="text-sm font-bold text-slate-700 truncate block">{selectedOption.label}</span>
                        </div>
                    ) : (
                        <span className="text-sm font-medium text-slate-400">{placeholder}</span>
                    )}
                    {selectedOption && <span className="text-[10px] font-medium text-slate-400 leading-none mt-0.5 truncate">{selectedOption.originalKey}</span>}
                </div>
                <ChevronRight className={`absolute right-3 w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2 border-b border-slate-50 bg-slate-50/50 sticky top-0">
                        <input
                            type="text"
                            placeholder="Tìm kiếm trường..."
                            className="w-full h-9 bg-white border border-slate-200 rounded-lg px-3 text-xs font-bold focus:border-blue-500 outline-none"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="max-h-[280px] overflow-y-auto custom-scrollbar p-1">
                        <div
                            onClick={() => { onChange(''); setIsOpen(false); }}
                            className="px-3 py-2.5 rounded-lg text-xs font-bold text-slate-400 hover:bg-slate-50 hover:text-slate-600 cursor-pointer transition-colors mb-1"
                        >
                            -- Bỏ qua --
                        </div>
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt: any) => (
                                <div
                                    key={opt.value}
                                    onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                    className={`
px-3 py-2.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors group mb-0.5
                                        ${value === opt.value ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}
`}
                                >
                                    <div className="flex flex-col gap-0.5 overflow-hidden">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold truncate">{opt.label}</span>
                                            {opt.label !== opt.originalKey && (
                                                <span className="text-[9px] text-slate-400 font-medium">({opt.originalKey})</span>
                                            )}
                                        </div>
                                        {opt.sample && (
                                            <span className={`text-[10px] font-medium truncate ${value === opt.value ? 'text-blue-400' : 'text-slate-400'}`}>
                                                Ví dụ: {opt.sample}
                                            </span>
                                        )}
                                    </div>
                                    {value === opt.value && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                                </div>
                            ))
                        ) : (
                            <div className="py-8 text-center">
                                <p className="text-xs font-medium text-slate-400">Không tìm thấy kết quả</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const MisaSetup: React.FC<MisaSetupProps> = ({ onBack, onComplete, initialData }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [sampleContact, setSampleContact] = useState<any>(null);
    const [showJsonModal, setShowJsonModal] = useState(false);

    const [config, setConfig] = useState<any>({
        clientId: '',
        clientSecret: '',
        endpoint: 'https://crmconnect.misa.vn/api/v2',
        syncInterval: '1440',
        mapping: {
            email: 'email'
        },
        targetListId: '',
        targetListName: 'MISA CRM Contacts',
        entity: 'Contacts',
        isCustomInterval: false,
        createVirtualEmail: false
    });

    const [activeMappings, setActiveMappings] = useState<string[]>(['firstName', 'lastName', 'phoneNumber', 'companyName']);
    const [detectedFields, setDetectedFields] = useState<string[]>([]);

    useEffect(() => {
        if (initialData) {
            try {
                const parsedConfig = typeof initialData.config === 'string' ? JSON.parse(initialData.config) : initialData.config;
                setConfig(parsedConfig);
                if (parsedConfig.mapping) {
                    const mappedKeys = Object.keys(parsedConfig.mapping);
                    setActiveMappings(mappedKeys.filter(k => k !== 'email'));
                }
            } catch (e) {
                console.error("Error parsing initial config", e);
            }
        }
    }, [initialData]);

    const handleConnect = async () => {
        if (!config.clientId || !config.clientSecret) {
            toast.error('Vui lòng nhập đầy đủ Client ID và Secret');
            return;
        }
        setLoading(true);

        try {
            const res = await api.post('integrations?route=test_misa', {
                clientId: config.clientId,
                clientSecret: config.clientSecret,
                endpoint: config.endpoint,
                entity: config.entity
            });

            if (res.success) {
                const data = res.data as any;
                const fields = data.fields || [];

                setDetectedFields(fields);

                // Get sample contact for smart mapping
                const sample = data.data?.[0] || {};
                setSampleContact(sample);

                // Smart auto-mapping - only run for NEW integrations
                let newMapping = { ...config.mapping };
                if (!initialData?.id) {
                    // Helper to check if field has meaningful data
                    const hasData = (fieldName: string) => {
                        const value = sample[fieldName];
                        return value !== null && value !== undefined && value !== '';
                    };

                    // Email Priority
                    const emailCandidates = ['custom_field1', 'office_email', 'email'];
                    for (const field of emailCandidates) {
                        if (fields.includes(field) && hasData(field) && !newMapping.email) {
                            newMapping.email = field;
                            break;
                        }
                    }

                    // Name fields
                    const firstNameCandidates = ['first_name', 'custom_field31'];
                    for (const field of firstNameCandidates) {
                        if (fields.includes(field) && hasData(field) && !newMapping.firstName) {
                            newMapping.firstName = field;
                            break;
                        }
                    }

                    const lastNameCandidates = ['last_name', 'contact_name', 'account_name'];
                    for (const field of lastNameCandidates) {
                        if (fields.includes(field) && hasData(field) && !newMapping.lastName) {
                            newMapping.lastName = field;
                            break;
                        }
                    }

                    // Phone Priority: mobile > office_tel > other_phone
                    const phoneCandidates = ['mobile', 'office_tel', 'other_phone', 'tel', 'phone'];
                    for (const field of phoneCandidates) {
                        if (fields.includes(field) && hasData(field) && !newMapping.phoneNumber) {
                            newMapping.phoneNumber = field;
                            break;
                        }
                    }

                    // Company
                    const companyCandidates = ['custom_field32', 'custom_field14', 'account_name', 'company_name'];
                    for (const field of companyCandidates) {
                        if (fields.includes(field) && hasData(field) && !newMapping.companyName) {
                            newMapping.companyName = field;
                            break;
                        }
                    }

                    // Address
                    const addressCandidates = ['billing_address', 'mailing_address', 'shipping_address', 'address'];
                    for (const field of addressCandidates) {
                        if (fields.includes(field) && hasData(field) && !newMapping.address) {
                            newMapping.address = field;
                            break;
                        }
                    }

                    // Website
                    if (fields.includes('website') && hasData('website') && !newMapping['info.website']) {
                        newMapping['info.website'] = 'website';
                    }

                    // DOB
                    const dobCandidates = ['date_of_birth', 'custom_field34', 'birthday', 'dob', 'celebrate_date'];
                    for (const field of dobCandidates) {
                        if (fields.includes(field) && hasData(field) && !newMapping.dateOfBirth) {
                            newMapping.dateOfBirth = field;
                            break;
                        }
                    }

                    // Notes
                    const notesCandidates = ['description', 'notes', 'note'];
                    for (const field of notesCandidates) {
                        if (fields.includes(field) && hasData(field) && !newMapping.notes) {
                            newMapping.notes = field;
                            break;
                        }
                    }

                    // Salesperson
                    if (fields.includes('owner_name') && hasData('owner_name') && !newMapping.salesperson) {
                        newMapping.salesperson = 'owner_name';
                    }
                }

                setConfig({ ...config, mapping: newMapping });

                // Synchronize activeMappings with new mapping keys (excluding email)
                const mappedKeys = Object.keys(newMapping).filter(k => k !== 'email');
                setActiveMappings(Array.from(new Set([...activeMappings, ...mappedKeys])));

                setStep(2);
                toast.success('Kết nối MISA thành công!');
            } else {
                toast.error(res.message || 'Không thể kết nối với MISA CRM');
            }
        } catch (err) {
            toast.error('Đã xảy ra lỗi khi kết nối');
        } finally {
            setLoading(false);
        }
    };

    const removeMappingRow = (key: string) => {
        setActiveMappings(activeMappings.filter(k => k !== key));
        const newMapping = { ...config.mapping };
        delete newMapping[key];
        setConfig({ ...config, mapping: newMapping });
    };

    // NEW: Fetch fresh sample contact for preview
    const fetchPreviewContact = async () => {
        setLoading(true);
        try {
            const res = await api.post('integrations?route=preview_misa', {
                clientId: config.clientId,
                clientSecret: config.clientSecret,
                endpoint: config.endpoint,
                entity: config.entity
            });

            const data = res.data as any;
            if (res.success && data.contact) {
                setSampleContact(data.contact);
                setStep(4);
            } else {
                toast.error('Không thể lấy dữ liệu mẫu');
            }
        } catch (err) {
            toast.error('Đã xảy ra lỗi khi lấy dữ liệu');
        } finally {
            setLoading(false);
        }
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
            let finalListId = config.targetListId;
            if (!initialData) {
                const listRes = await api.post('lists', {
                    name: config.targetListName,
                    source: 'MISA CRM',
                    count: 0
                });
                if (listRes.success) {
                    finalListId = (listRes.data as any).id;
                } else {
                    throw new Error('Không thể tạo danh sách');
                }
            }

            const payload = {
                type: 'misa',
                name: 'MISA CRM - ' + config.targetListName,
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
                toast.success('Đã lưu cấu hình MISA CRM');
                onComplete();
            } else {
                toast.error(res.message || 'Lỗi khi lưu cấu hình');
            }
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                    <div className="space-y-6">
                        <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl flex gap-3">
                            <AlertCircle className="w-5 h-5 text-blue-500 shrink-0" />
                            <div className="text-xs text-blue-700 leading-relaxed font-medium">
                                <p className="font-bold mb-1">Hướng dẫn nhanh:</p>
                                1. Truy cập <b>AMIS CRM {'>'} Thiết lập {'>'} Kết nối API</b>.<br />
                                2. Copy <b>AppID</b> và <b>Mã bảo mật</b>.<br />
                                3. Dán vào form bên dưới và bấm "Kiểm tra kết nối".
                            </div>
                        </div>

                        {/* Connection Visual & Entity Selection */}
                        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-8">
                            <div className="flex flex-col items-center">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-14 h-14 rounded-2xl border-2 border-white bg-white flex items-center justify-center overflow-hidden shadow-lg shadow-blue-500/10 z-[2] relative group">
                                        <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRlIpztniIEN5ZYvLlwwqBvhzdodvu2NfPSbg&s" className="w-10 h-10 object-contain" alt="MISA" />
                                    </div>

                                    <div className="flex items-center">
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                        <div className="w-32 h-[3px] bg-blue-100 relative overflow-hidden mx-1 rounded-full">
                                            <div className="absolute top-0 left-0 h-full w-1/2 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-[shimmer_1.5s_infinite]"></div>
                                        </div>
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                    </div>

                                    <div className="w-14 h-14 rounded-2xl border-2 border-white bg-slate-900 flex items-center justify-center overflow-hidden shadow-lg z-[2] relative">
                                        <div className="text-white font-black text-sm tracking-tighter">MF</div>
                                    </div>
                                </div>
                                <p className="text-sm font-bold text-slate-700 bg-slate-50 px-4 py-1.5 rounded-full border border-slate-100">Kích hoạt kết nối đồng bộ MISA AMIS CRM</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Entity Selection */}
                                <div className="space-y-4">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">1. Loại bộ dữ liệu cần đồng bộ</label>
                                    <div className="grid grid-cols-1 gap-3">
                                        <button
                                            onClick={() => setConfig({ ...config, entity: 'Contacts', targetListName: 'MISA CRM Contacts' })}
                                            className={`flex items-start gap-4 p-4 rounded-2xl border-2 transition-all text-left group ${config.entity === 'Contacts' ? 'border-blue-500 bg-blue-50/50' : 'border-slate-50 bg-slate-50/50 hover:border-slate-200 hover:bg-white'}`}
                                        >
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${config.entity === 'Contacts' ? 'bg-blue-500 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>
                                                <Users className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <span className={`text-sm font-black block ${config.entity === 'Contacts' ? 'text-blue-700' : 'text-slate-600'}`}>Contacts</span>
                                                <span className="text-[10px] text-slate-400 font-medium leading-tight block mt-0.5">/api/v2/Contacts</span>
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => setConfig({ ...config, entity: 'Accounts', targetListName: 'MISA CRM Khách hàng (Accounts)' })}
                                            className={`flex items-start gap-4 p-4 rounded-2xl border-2 transition-all text-left group ${config.entity === 'Accounts' ? 'border-blue-500 bg-blue-50/50' : 'border-slate-50 bg-slate-50/50 hover:border-slate-200 hover:bg-white'}`}
                                        >
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${config.entity === 'Accounts' ? 'bg-blue-500 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>
                                                <Target className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <span className={`text-sm font-black block ${config.entity === 'Accounts' ? 'text-blue-700' : 'text-slate-600'}`}>Accounts</span>
                                                <span className="text-[10px] text-slate-400 font-medium leading-tight block mt-0.5">/api/v2/Account</span>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => setConfig({ ...config, entity: 'Customers', targetListName: 'MISA CRM Customers' })}
                                            className={`flex items-start gap-4 p-4 rounded-2xl border-2 transition-all text-left group ${config.entity === 'Customers' ? 'border-blue-500 bg-blue-50/50' : 'border-slate-50 bg-slate-50/50 hover:border-slate-200 hover:bg-white'}`}
                                        >
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${config.entity === 'Customers' ? 'bg-blue-500 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>
                                                <UserCheck className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <span className={`text-sm font-black block ${config.entity === 'Customers' ? 'text-blue-700' : 'text-slate-600'}`}>Customers</span>
                                                <span className="text-[10px] text-slate-400 font-medium leading-tight block mt-0.5">/api/v2/Customers</span>
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                {/* Credentials */}
                                <div className="space-y-4">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">2. Thông tin đăng nhập API</label>
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-500 ml-1">AppID (Client ID)</label>
                                            <div className="relative group">
                                                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                                <input
                                                    type="text"
                                                    value={config.clientId}
                                                    onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
                                                    placeholder="Nhập AppID..."
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-300"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-500 ml-1">Mã bảo mật (Client Secret)</label>
                                            <div className="relative group">
                                                <Zap className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                                <input
                                                    type="password"
                                                    value={config.clientSecret}
                                                    onChange={(e) => setConfig({ ...config, clientSecret: e.target.value })}
                                                    placeholder="Nhập mã bảo mật..."
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-300"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 2:
                return (
                    <div className="space-y-6">
                        <div className="bg-white border border-slate-100 rounded-[28px] shadow-sm relative z-0">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50/50 border-b border-slate-100">
                                    <tr>
                                        <th className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left px-8 py-4 first:rounded-tl-[28px]">Trường MailFlow</th>
                                        <th className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left px-8 py-4 last:rounded-tr-[28px]">Trường MISA Contact</th>
                                        <th className="w-16"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {/* Email Row - Fixed */}
                                    <tr className="bg-amber-50/20">
                                        <td className="px-8 py-5">
                                            <div className="h-[42px] flex flex-col justify-center px-3.5">
                                                <span className="text-sm font-bold text-slate-900 block leading-tight">Email</span>
                                                <span className="text-red-500 text-[9px] font-black uppercase tracking-tighter leading-tight">Bắt buộc</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <FieldSelect
                                                value={config.mapping.email}
                                                options={detectedFields}
                                                sampleData={sampleContact}
                                                onChange={(val: string) => setConfig({ ...config, mapping: { ...config.mapping, email: val } })}
                                            />
                                        </td>
                                        <td></td>
                                    </tr>

                                    {/* Dynamic Mapping Rows */}
                                    {activeMappings.filter(k => k !== '__custom_input__').map(mapKey => {
                                        const isSystemField = SYSTEM_FIELDS.some(f => f.key === mapKey);
                                        const fieldLabel = SYSTEM_FIELDS.find(f => f.key === mapKey)?.label || mapKey;

                                        return (
                                            <tr key={mapKey} className="group hover:bg-slate-50/50 transition-colors">
                                                <td className="px-8 py-5">
                                                    {isSystemField ? (
                                                        <div className="w-[180px]">
                                                            <Select
                                                                options={[
                                                                    ...SYSTEM_FIELDS.filter(f => f.key === mapKey || (!activeMappings.includes(f.key) && f.key !== 'email')).map(f => ({ value: f.key, label: f.label })),
                                                                    { value: '__create_custom__', label: '+ Tạo trường mới (Custom)' }
                                                                ]}
                                                                value={mapKey}
                                                                onChange={(newKey) => {
                                                                    if (newKey === '__create_custom__') {
                                                                        const newActive = activeMappings.filter(k => k !== mapKey);
                                                                        setActiveMappings([...newActive, '__custom_input__']);
                                                                        const newMapping = { ...config.mapping };
                                                                        delete newMapping[mapKey];
                                                                        setConfig({ ...config, mapping: newMapping });
                                                                    } else {
                                                                        const newVal = config.mapping[mapKey];
                                                                        const newActive = activeMappings.map(k => k === mapKey ? newKey : k);
                                                                        const newMapping = { ...config.mapping };
                                                                        delete newMapping[mapKey];
                                                                        newMapping[newKey] = newVal;
                                                                        setActiveMappings(newActive);
                                                                        setConfig({ ...config, mapping: newMapping });
                                                                    }
                                                                }}
                                                                variant="ghost"
                                                                size="sm"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <div className="px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                                                                <span className="text-sm font-bold text-blue-700">{fieldLabel}</span>
                                                            </div>
                                                            <span className="text-[9px] font-bold text-blue-500 uppercase tracking-tight">Custom</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-8 py-5">
                                                    <FieldSelect
                                                        value={config.mapping[mapKey] || ''}
                                                        options={detectedFields}
                                                        sampleData={sampleContact}
                                                        onChange={(val: string) => setConfig({ ...config, mapping: { ...config.mapping, [mapKey]: val } })}
                                                    />
                                                </td>
                                                <td className="px-4">
                                                    <button
                                                        onClick={() => removeMappingRow(mapKey)}
                                                        className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}

                                    {/* Custom Field Input Row */}
                                    {activeMappings.includes('__custom_input__') && (
                                        <tr className="bg-blue-50/30">
                                            <td className="px-8 py-5">
                                                <input
                                                    type="text"
                                                    placeholder="Nhập tên trường tùy chỉnh..."
                                                    className="w-full h-11 bg-white border-2 border-blue-200 rounded-xl px-4 text-sm font-bold focus:border-blue-500 outline-none"
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
                                                    className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    )}

                                    {/* Add Button */}
                                    <tr>
                                        <td colSpan={3} className="p-4 last:rounded-bl-[28px] last:rounded-br-[28px]">
                                            <button
                                                onClick={() => {
                                                    const remainingFields = SYSTEM_FIELDS.filter(f => f.key !== 'email' && !activeMappings.includes(f.key));
                                                    if (remainingFields.length > 0) {
                                                        setActiveMappings([...activeMappings, remainingFields[0].key]);
                                                    } else {
                                                        setActiveMappings([...activeMappings, '__custom_input__']);
                                                    }
                                                }}
                                                className="w-full py-4 border-2 border-dashed border-slate-100 rounded-2xl flex items-center justify-center gap-3 text-slate-400 hover:border-blue-500/30 hover:bg-blue-50/30 hover:text-blue-500 transition-all group"
                                            >
                                                <div className="w-7 h-7 rounded-full bg-slate-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
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
                    <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
                        {/* List Name */}
                        <div className="space-y-4">
                            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">Tên danh sách (List Name)</h4>
                            <div className="bg-slate-50/50 p-1.5 rounded-2xl border border-slate-100">
                                <input
                                    type="text"
                                    value={config.targetListName}
                                    onChange={(e) => setConfig({ ...config, targetListName: e.target.value })}
                                    className="w-full text-lg font-bold text-slate-700 placeholder:text-slate-300 px-4 py-3 bg-white rounded-xl border border-dashed border-slate-200 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                                    placeholder="Nhập tên danh sách..."
                                />
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium pl-2">
                                * Danh sách mới sẽ được tạo tự động với tên này để chứa dữ liệu đồng bộ
                            </p>
                        </div>

                        {/* Sync Interval */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-1">
                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Chu kỳ đồng bộ</h4>
                                <button className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full hover:bg-blue-100 transition-colors">
                                    <HelpCircle className="w-3 h-3" />
                                    Cơ chế hoạt động?
                                </button>
                            </div>

                            <div className="grid grid-cols-4 gap-3">
                                <div
                                    onClick={() => setConfig({ ...config, syncInterval: '5' })}
                                    className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 ${config.syncInterval === '5' ? 'bg-white border-blue-500 shadow-lg shadow-blue-500/10 transform -translate-y-1' : 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50'}`}
                                >
                                    <div className="flex flex-col items-center gap-2 text-center">
                                        <Zap className={`w-5 h-5 ${config.syncInterval === '5' ? 'text-blue-500' : 'text-slate-300'}`} />
                                        <div>
                                            <div className={`text-sm font-black ${config.syncInterval === '5' ? 'text-slate-800' : 'text-slate-500'}`}>5p</div>
                                            <div className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">Nhanh</div>
                                        </div>
                                    </div>
                                    {config.syncInterval === '5' && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
                                </div>

                                <div
                                    onClick={() => setConfig({ ...config, syncInterval: '15' })}
                                    className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 ${config.syncInterval === '15' ? 'bg-white border-blue-500 shadow-lg shadow-blue-500/10 transform -translate-y-1' : 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50'}`}
                                >
                                    <div className="flex flex-col items-center gap-2 text-center">
                                        <Clock className={`w-5 h-5 ${config.syncInterval === '15' ? 'text-blue-500' : 'text-slate-300'}`} />
                                        <div>
                                            <div className={`text-sm font-black ${config.syncInterval === '15' ? 'text-slate-800' : 'text-slate-500'}`}>15p</div>
                                            <div className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">Chuẩn</div>
                                        </div>
                                    </div>
                                    {config.syncInterval === '15' && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
                                </div>

                                <div
                                    onClick={() => setConfig({ ...config, syncInterval: '60' })}
                                    className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 ${config.syncInterval === '60' ? 'bg-white border-blue-500 shadow-lg shadow-blue-500/10 transform -translate-y-1' : 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50'}`}
                                >
                                    <div className="flex flex-col items-center gap-2 text-center">
                                        <Clock className={`w-5 h-5 ${config.syncInterval === '60' ? 'text-blue-500' : 'text-slate-300'}`} />
                                        <div>
                                            <div className={`text-sm font-black ${config.syncInterval === '60' ? 'text-slate-800' : 'text-slate-500'}`}>1h</div>
                                            <div className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">Ổn định</div>
                                        </div>
                                    </div>
                                    {config.syncInterval === '60' && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
                                </div>

                                <div
                                    onClick={() => setConfig({ ...config, syncInterval: '1440' })}
                                    className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 ${config.syncInterval === '1440' ? 'bg-white border-[#2563eb] shadow-lg shadow-[#2563eb]/10 transform -translate-y-1' : 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50'}`}
                                >
                                    <div className="flex flex-col items-center gap-2 text-center">
                                        <Target className={`w-5 h-5 ${config.syncInterval === '1440' ? 'text-[#2563eb]' : 'text-slate-300'}`} />
                                        <div>
                                            <div className={`text-sm font-black ${config.syncInterval === '1440' ? 'text-slate-800' : 'text-slate-500'}`}>1 ngày</div>
                                            <div className={`text-[9px] font-bold uppercase tracking-wider ${config.syncInterval === '1440' ? 'text-[#2563eb]' : 'text-slate-300'}`}>Tiết kiệm</div>
                                        </div>
                                    </div>
                                    {config.syncInterval === '1440' && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#2563eb] animate-pulse" />}
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
                                            Nếu một liên hệ từ MISA không có Email nhưng có Số điện thoại, hệ thống sẽ tự động tạo Email ảo dạng <code>phone@no-email.domation</code> để định danh và cho phép tham gia Flow (ZNS/Zalo).
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

            case 4:
                return (
                    <div className="space-y-6">
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-100">
                            <div className="flex items-center gap-3 mb-2">
                                <Eye className="w-6 h-6 text-blue-600" />
                                <h4 className="text-lg font-bold text-blue-900">Xem trước kết quả mapping</h4>
                            </div>
                            <p className="text-sm text-blue-700">Dữ liệu mẫu từ MISA CRM của bạn sau khi được mapping</p>
                        </div>

                        {sampleContact && (
                            <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm">
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Dynamically render ALL mapped fields */}
                                    {Object.entries(config.mapping).map(([systemField, misaField]: [string, any]) => {
                                        if (!misaField) return null;

                                        // Get field label
                                        const fieldDef = SYSTEM_FIELDS.find(f => f.key === systemField);
                                        const label = fieldDef?.label || systemField;

                                        // Get MISA field info (No longer using MISA_FIELDS)
                                        const misaLabel = COMMON_LABELS[misaField] || misaField;

                                        // Get value from sample contact
                                        const value = sampleContact[misaField];
                                        const displayValue = value !== null && value !== undefined && value !== ''
                                            ? String(value)
                                            : null;

                                        // Determine if this should span 2 columns (for long text fields)
                                        const isLongText = systemField === 'notes' || systemField.includes('address');

                                        return (
                                            <div key={systemField} className={`space-y-1 ${isLongText ? 'col-span-2' : ''}`}>
                                                <div className="flex items-center justify-between">
                                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{label}</div>
                                                    <div className="text-[9px] font-medium text-slate-300 italic">{misaLabel}</div>
                                                </div>
                                                <div className={`text-sm font-bold text-slate-800 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 ${isLongText ? 'max-h-24 overflow-y-auto' : ''}`}>
                                                    {displayValue ? (
                                                        isLongText && displayValue.length > 200 ? (
                                                            <div className="whitespace-pre-wrap">{displayValue.substring(0, 200)}...</div>
                                                        ) : (
                                                            <div className={isLongText ? 'whitespace-pre-wrap' : ''}>{displayValue}</div>
                                                        )
                                                    ) : (
                                                        <span className="text-slate-300 italic">Không có dữ liệu</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                            <p className="text-xs text-amber-800 font-medium">
                                ⚠️ Nếu thông tin không chính xác, bấm <b>"Quay lại"</b> để điều chỉnh mapping.
                            </p>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="flex flex-col animate-in fade-in slide-in-from-right-4 duration-500 relative min-h-[500px]">
            {/* Steps Indicator - Sticky Top */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-20 pt-4 pb-4 mb-2 px-6 border-b border-slate-50">
                <div className="flex items-center gap-2 px-1">
                    {[1, 2, 3, 4].map((s) => (
                        <React.Fragment key={s}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= s ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                {step > s ? <Check className="w-4 h-4" /> : s}
                            </div>
                            {s < 4 && <div className={`flex-1 h-0.5 rounded-full ${step > s ? 'bg-blue-500' : 'bg-slate-100'}`} />}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 px-8 pb-32 pt-2">
                <div className="mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-slate-800">
                                {step === 1 ? 'Kết nối MISA AMIS CRM' : step === 2 ? 'Mapping dữ liệu' : step === 3 ? 'Hoàn tất cấu hình' : 'Xem trước kết quả'}
                            </h3>
                            <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRlIpztniIEN5ZYvLlwwqBvhzdodvu2NfPSbg&s" className="w-6 h-6 object-contain rounded" alt="MISA" />
                        </div>

                        {/* JSON Viewer Button - Only show in Step 2 */}
                        {step === 2 && (
                            <button
                                onClick={() => setShowJsonModal(true)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                </svg>
                                Xem JSON gốc MISA
                            </button>
                        )}
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                        {step === 1 ? 'Kết nối với MISA CRM để tự động đồng bộ Khách hàng.' : step === 2 ? 'Gán trường MISA vào các trường của hệ thống.' : step === 3 ? 'Đặt tên cho danh sách và chu kỳ đồng bộ.' : 'Kiểm tra kết quả mapping trước khi lưu.'}
                    </p>
                </div>

                {renderStepContent()}
            </div>

            {/* Sticky Footer Buttons */}
            <div className="sticky bottom-0 px-8 py-5 bg-white/95 backdrop-blur-sm border-t border-slate-100 flex gap-3 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] mt-auto">
                {step === 1 ? (
                    <>
                        <Button variant="ghost" onClick={onBack} className="flex-1 rounded-xl">Quay lại</Button>
                        <Button onClick={handleConnect} isLoading={loading} className="flex-[2] rounded-xl">Kiểm tra kết nối <ChevronRight className="w-4 h-4" /></Button>
                    </>
                ) : step === 2 ? (
                    <>
                        <Button variant="ghost" onClick={() => setStep(1)} className="flex-1 rounded-xl">Quay lại</Button>
                        <Button onClick={() => setStep(3)} className="flex-[2] rounded-xl">Tiếp theo <ChevronRight className="w-4 h-4" /></Button>
                    </>
                ) : step === 3 ? (
                    <>
                        <Button variant="ghost" onClick={() => setStep(2)} className="flex-1 rounded-xl">Quay lại</Button>
                        <Button onClick={fetchPreviewContact} isLoading={loading} className="flex-[2] rounded-xl">Xem trước <Eye className="w-4 h-4" /></Button>
                    </>
                ) : (
                    <>
                        <Button variant="ghost" onClick={() => setStep(2)} className="flex-1 rounded-xl">← Quay lại chỉnh sửa</Button>
                        <Button onClick={handleSave} isLoading={loading} className="flex-[2] rounded-xl">Xác nhận & Lưu <Check className="w-4 h-4" /></Button>
                    </>
                )}
            </div>

            {/* JSON Viewer Modal */}
            {showJsonModal && sampleContact && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowJsonModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Dữ liệu JSON gốc từ MISA CRM</h3>
                                <p className="text-sm text-slate-500 mt-1">Raw API Response</p>
                            </div>
                            <button
                                onClick={() => setShowJsonModal(false)}
                                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
                            >
                                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* JSON Content */}
                        <div className="flex-1 overflow-auto p-6">
                            <div className="relative">
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(JSON.stringify(sampleContact, null, 2));
                                        toast.success('Đã sao chép JSON');
                                    }}
                                    className="absolute top-2 right-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    Sao chép
                                </button>
                                <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto text-xs font-mono leading-relaxed">
                                    {JSON.stringify(sampleContact, null, 2)}
                                </pre>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
                            <p className="text-xs text-slate-500 text-center">
                                💡 <b>Mẹo:</b> Sử dụng dữ liệu này để kiểm tra tên trường chính xác từ MISA API
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MisaSetup;
