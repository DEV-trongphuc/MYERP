
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Code2, Plus, Globe, Edit3, Trash2,
    Type, Mail, Phone, Calendar, Briefcase, Building, MapPin, Sparkles, FileInput,
    List, Braces, ChevronDown, CheckCircle2, Database, Wand2, Tag, Bell, BellRing, Users, Link, Power
} from 'lucide-react';
import { api } from '../../services/storageAdapter';
import { FormDefinition, FormField } from '../../types';
import Button from '../common/Button';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Select from '../common/Select';
import toast from 'react-hot-toast';
import ConfirmModal from '../common/ConfirmModal';
import InputModal from '../common/InputModal';
import IntegrationGuideModal from '../flows/modals/IntegrationGuideModal';
import { AppIcon } from '../../../common/AppIcons';

const DB_FIELDS = [
    { value: 'email', label: 'Địa chỉ Email (Bắt buộc)', type: 'email', required: true, icon: Mail },
    { value: 'firstName', label: 'Tên Khách hàng', type: 'text', required: false, icon: Type },
    { value: 'lastName', label: 'Họ Khách hàng', type: 'text', required: false, icon: Type },
    { value: 'phoneNumber', label: 'Số điện thoại', type: 'tel', required: false, icon: Phone },
    { value: 'jobTitle', label: 'Chức danh', type: 'text', required: false, icon: Briefcase },
    { value: 'companyName', label: 'Công ty', type: 'text', required: false, icon: Building },
    { value: 'country', label: 'Quốc gia', type: 'text', required: false, icon: Globe },
    { value: 'city', label: 'Thành phố', type: 'text', required: false, icon: MapPin },
    { value: 'dateOfBirth', label: 'Ngày sinh', type: 'date', required: false, icon: Calendar },
];

const FormsTab: React.FC = () => {
    const navigate = useNavigate();
    const [forms, setForms] = useState<FormDefinition[]>([]);
    const [lists, setLists] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAddingList, setIsAddingList] = useState(false);
    const [editingFormId, setEditingFormId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<FormDefinition>>({
        name: '', targetListId: '', fields: [{ id: 'f-email', dbField: 'email', label: 'Địa chỉ Email', required: true, type: 'email' }],
        notificationEnabled: false, notificationEmails: '', notificationCcEmails: '', notificationSubject: ''
    });

    const [selectedFormForCode, setSelectedFormForCode] = useState<FormDefinition | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    useEffect(() => { fetchInitialData(); }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        const [formsRes, listsRes] = await Promise.all([
            api.get<FormDefinition[]>('forms'),
            api.get<any[]>('lists')
        ]);
        if (formsRes.success) setForms(formsRes.data);
        if (listsRes.success) setLists(listsRes.data);
        setLoading(false);
    };

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        if (type === 'success') toast.success(message);
        else if (type === 'error') toast.error(message);
        else toast(message);
    };

    const handleCreateNew = () => {
        setEditingFormId(null);
        setFormData({
            name: '', targetListId: '', fields: [{ id: 'f-email', dbField: 'email', label: 'Địa chỉ Email', required: true, type: 'email' }],
            notificationEnabled: false, notificationEmails: '', notificationCcEmails: '', notificationSubject: ''
        });
        setIsModalOpen(true);
    };

    const handleEditClick = (form: FormDefinition) => {
        setEditingFormId(form.id);
        setFormData({
            name: form.name,
            targetListId: form.targetListId,
            fields: [...form.fields],
            notificationEnabled: form.notificationEnabled || false,
            notificationEmails: form.notificationEmails || '',
            notificationCcEmails: form.notificationCcEmails || '',
            notificationSubject: form.notificationSubject || ''
        });
        setIsModalOpen(true);
    };

    const handleAddField = () => {
        setFormData({
            ...formData,
            fields: [...(formData.fields || []), { id: crypto.randomUUID(), dbField: 'firstName', label: 'Tên Khách hàng', required: false, type: 'text', isCustom: false }]
        });
    };

    const handleAddCustomField = () => {
        setFormData({
            ...formData,
            fields: [...(formData.fields || []), {
                id: crypto.randomUUID(),
                dbField: '__custom__',
                label: 'Trường tùy chỉnh',
                required: false,
                type: 'text',
                isCustom: true,
                customKey: `custom_field_${Date.now()}`
            }]
        });
    };

    const updateField = (id: string, updates: Partial<FormField>) => {
        setFormData({
            ...formData,
            fields: formData.fields?.map(f => {
                if (f.id !== id) return f;
                const newF = { ...f, ...updates };
                if (updates.dbField) {
                    const def = DB_FIELDS.find(d => d.value === updates.dbField);
                    if (def) {
                        newF.label = def.label;
                        newF.type = def.type as any;
                    }
                }
                return newF;
            })
        });
    };

    const handleSaveForm = async () => {
        if (!formData.name || !formData.targetListId) {
            showToast('Vui lòng điền đủ tên và list đích', 'error');
            return;
        }
        setIsSubmitting(true);

        let res;
        if (editingFormId) {
            res = await api.put<FormDefinition>(`forms/${editingFormId}`, formData);
        } else {
            res = await api.post<FormDefinition>('forms', formData);
        }

        if (res.success) {
            setIsModalOpen(false);
            showToast(editingFormId ? 'Đã cập nhật Form thành công' : 'Đã lưu cấu hình Form mới');
            fetchInitialData();
        } else {
            showToast(res.message || 'Lỗi khi lưu Form', 'error');
        }
        setIsSubmitting(false);
    };

    const executeDelete = async () => {
        if (!confirmDeleteId) return;
        const res = await api.delete(`forms/${confirmDeleteId}`);
        if (res.success) {
            setForms(forms.filter(f => f.id !== confirmDeleteId));
            showToast('Đã xóa biểu mẫu và tạm dừng các Flow liên quan');
            setConfirmDeleteId(null);
        } else {
            showToast('Lỗi khi xóa Form', 'error');
        }
    };

    const handleToggleStatus = async (form: FormDefinition) => {
        const res = await api.put(`forms/${form.id}?route=toggle_status`, {});
        if (res.success) {
            setForms(forms.map(f => f.id === form.id ? { ...f, status: (res.data as any)?.status } : f));
            showToast((res.data as any)?.status === 'active' ? 'Đã kích hoạt biểu mẫu' : 'Đã vô hiệu hoá biểu mẫu');
        } else {
            showToast('Lỗi khi thay đổi trạng thái', 'error');
        }
    };

    const getFieldIcon = (dbField: string) => {
        const field = DB_FIELDS.find(f => f.value === dbField);
        return field?.icon || Type;
    }

    return (
        <div className="space-y-6 pb-40">

            {/* Internal Toolbar */}
            <div className="flex justify-between items-center bg-[var(--color-surface)] p-4 rounded-[20px] border border-[var(--color-border)] shadow-xs">
                <div className="flex items-center gap-3">
                    <AppIcon name="trigger_form" size={38} className="shrink-0" />
                    <div>
                        <h3 className="text-base font-bold text-[var(--color-text)]">Danh sách Biểu mẫu</h3>
                        <p className="text-xs text-[var(--color-text-muted)] font-medium">Quản lý các điểm thu thập thông tin Khách hàng và mã nhúng Web.</p>
                    </div>
                </div>
                <Button icon={Plus} size="md" onClick={handleCreateNew}>Tạo Form mới</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    <>
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
                                <div className="flex justify-between items-start gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[12px]" />
                                        <div className="space-y-2">
                                            <div className="w-36 h-4 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[8px]" />
                                            <div className="w-24 h-3 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[6px]" />
                                        </div>
                                    </div>
                                    <div className="w-16 h-6 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[8px]" />
                                </div>
                                <div className="h-14 w-full animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[16px]" />
                                <div className="h-9 w-full animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[12px]" />
                            </div>
                        ))}
                    </>
                ) : forms.length === 0 ? (
                    <div className="col-span-full py-16 text-center border-2 border-dashed border-[var(--color-border)] rounded-[20px] bg-[var(--color-bg)]">
                        <div className="flex justify-center mb-3">
                            <AppIcon name="trigger_form" size={44} />
                        </div>
                        <h3 className="text-[var(--color-text)] font-bold text-base">Chưa có biểu mẫu nào</h3>
                        <p className="text-[var(--color-text-muted)] mt-1 text-xs">Tạo form để bắt đầu thu thập Khách hàng.</p>
                    </div>
                ) : forms.map(form => (
                    <div key={form.id} className="group hover-lift bg-[var(--color-surface)] p-5 rounded-[20px] border border-[var(--color-border)] shadow-xs hover:border-[var(--color-primary-light)] transition-all flex flex-col justify-between gap-4 relative overflow-hidden">
                        <div className="flex justify-between items-start relative z-10">
                            <div className="flex items-center gap-3">
                                <AppIcon
                                    name="trigger_form"
                                    size={38}
                                    className={`shrink-0 transition-transform group-hover:scale-105 ${
                                        form.status === 'inactive' ? 'opacity-50 grayscale' : ''
                                    }`}
                                />
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className={`text-sm font-bold leading-tight truncate pr-2 ${
                                            form.status === 'inactive' ? 'text-slate-400' : 'text-[var(--color-text)]'
                                        }`} title={form.name}>{form.name}</h4>
                                        {form.status === 'inactive' && (
                                            <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full border border-slate-200">TẠM DỪNG</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <div 
                                            onClick={() => {
                                                const listName = lists.find(l => l.id === form.targetListId)?.name || 'Danh sách';
                                                navigate('/marketing/audience', { state: { openListId: form.targetListId, openListName: listName } });
                                            }}
                                            className="px-2 py-0.5 rounded-md bg-blue-50/70 border border-blue-200/60 text-[10px] font-semibold text-blue-700 w-max max-w-full flex items-center gap-1.5 cursor-pointer hover:bg-blue-100 hover:border-blue-300 transition-all"
                                            title="Bấm để xem danh sách Audience"
                                        >
                                            <Link className="w-3 h-3 shrink-0" />
                                            <span className="truncate flex-1">
                                            {lists.find(l => l.id === form.targetListId)?.name || 'Unknown List'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handleToggleStatus(form)}
                                    title={form.status === 'inactive' ? 'Kích hoạt' : 'Tạm dừng'}
                                    className={`p-1.5 rounded-lg transition-all ${
                                        form.status === 'inactive'
                                            ? 'text-slate-300 hover:text-emerald-600 hover:bg-emerald-50'
                                            : 'text-emerald-500 hover:text-amber-600 hover:bg-amber-50'
                                    }`}
                                >
                                    <Power className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleEditClick(form)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Chỉnh sửa">
                                    <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setConfirmDeleteId(form.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="Xóa">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3 relative z-10">
                            <div className="flex items-center justify-between p-2.5 bg-slate-50/70 rounded-xl border border-slate-200/60">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chuyển đổi</span>
                                    <span className="text-xs font-extrabold text-slate-800">{(form.stats?.submissions || 0).toLocaleString()} <span className="text-[10px] font-medium text-slate-400">leads</span></span>
                                </div>
                                <div className="h-6 w-px bg-slate-200"></div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Số trường</span>
                                    <span className="text-xs font-extrabold text-slate-800">{(form.fields || []).length} <span className="text-[10px] font-medium text-slate-400">fields</span></span>
                                </div>
                            </div>

                            <button
                                onClick={() => setSelectedFormForCode(form)}
                                className="w-full h-9 rounded-xl bg-[var(--color-bg)] text-slate-700 hover:text-[var(--color-primary)] border border-[var(--color-border)] text-xs font-semibold hover:bg-slate-100 hover:border-slate-300 transition-all flex items-center justify-center gap-1.5"
                            >
                                <Code2 className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                                API & Nhúng Web
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingFormId ? "Chỉnh sửa biểu mẫu" : "Thiết kế biểu mẫu mới"}
                size="lg"
                footer={<div className="flex justify-between w-full"><Button variant="ghost" onClick={() => setIsModalOpen(false)}>Hủy</Button><Button icon={CheckCircle2} onClick={handleSaveForm} isLoading={isSubmitting}>{editingFormId ? 'Cập nhật Form' : 'Lưu cấu hình Form'}</Button></div>}
            >
                <div className="space-y-8 py-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <Input label="Tên định danh Form" placeholder="VD: Form Landing Page..." value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} autoFocus />
                        <div className="space-y-1">
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Danh sách lưu trữ đích</label>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setIsAddingList(true);
                                    }}
                                    className="text-[9px] font-black text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] uppercase tracking-tight flex items-center gap-1"
                                >
                                    <Plus className="w-3 h-3" /> Tạo danh sách nhanh
                                </button>
                            </div>
                            <Select options={lists.map(l => ({ value: l.id, label: l.name }))} value={formData.targetListId || ''} onChange={v => setFormData({ ...formData, targetListId: v })} placeholder="Chọn danh sách đích..." icon={Database} variant="outline" />
                        </div>
                    </div>

                    {/* SECTION 1.5: Email Notification */}
                    <div className={`space-y-4 bg-slate-50/40 border border-slate-200/50 px-6 py-6 rounded-[18px] relative overflow-hidden transition-all duration-500 ${formData.notificationEnabled ? 'ring-1 ring-slate-200/60' : ''}`}>
                        <div className="flex justify-between items-start relative z-10">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm transition-all duration-500 ${formData.notificationEnabled ? 'bg-gradient-to-br from-[#2563eb] to-blue-600 text-white shadow-lg shadow-[#2563eb]/20' : 'bg-slate-100 text-slate-400'}`}>
                                    <BellRing className="w-6 h-6" />
                                </div>
                                <div>
                                    <h5 className="text-base font-black text-slate-800 tracking-tight">Email thông báo khi có thông tin khách</h5>
                                    <p className="text-[10px] text-slate-500 font-medium">Thiết lập nơi nhận Khách hàng để đội Telesale CSKH khai thác.</p>
                                </div>
                            </div>
                            <div
                                onClick={() => setFormData({ ...formData, notificationEnabled: !formData.notificationEnabled })}
                                className="flex items-center gap-3 cursor-pointer select-none bg-white p-1.5 px-3 rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all active:scale-95"
                            >
                                <div className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 flex items-center ${formData.notificationEnabled ? 'bg-emerald-500 justify-end' : 'bg-slate-200 justify-start'}`}>
                                    <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                                </div>
                                <span className={`text-[9px] font-black uppercase tracking-widest ${formData.notificationEnabled ? 'text-emerald-500' : 'text-slate-400'}`}>{formData.notificationEnabled ? 'Đang bật' : 'Đang tắt'}</span>
                            </div>
                        </div>

                        {formData.notificationEnabled && (
                            <div className="space-y-6 mt-6 pt-6 border-t border-slate-200/50 relative z-10 animate-in fade-in slide-in-from-top-4 duration-500">
                                <Input
                                    label="Tiêu đề (Subject) gửi thông báo"
                                    icon={Edit3}
                                    placeholder={`VD: [${formData.name || 'Form'}] Lead mới cần xử lý`}
                                    value={formData.notificationSubject || ''}
                                    onChange={e => setFormData({ ...formData, notificationSubject: e.target.value })}
                                    className="bg-white/80"
                                />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <Input
                                        label="Email nhận thông báo (Chính)"
                                        icon={Mail}
                                        multiline
                                        rows={2}
                                        placeholder="tuvan1@cty.com, manager@cty.com"
                                        value={formData.notificationEmails || ''}
                                        onChange={e => setFormData({ ...formData, notificationEmails: e.target.value })}
                                        className="bg-white/80"
                                    />
                                    <Input
                                        label="Email CC (Nhận bản sao)"
                                        icon={Users}
                                        multiline
                                        rows={2}
                                        placeholder="giamdoc@cty.com"
                                        value={formData.notificationCcEmails || ''}
                                        onChange={e => setFormData({ ...formData, notificationCcEmails: e.target.value })}
                                        className="bg-white/80"
                                    />
                                </div>

                                <div className="p-4 bg-white/40 shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] rounded-2xl border border-slate-200/50">
                                    <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                                        * Nhập nhiều email bằng cách nhấn <kbd className="bg-slate-100 px-1 inline-block pb-0.5 rounded text-slate-700 font-bold border border-slate-200">Enter</kbd> để xuống dòng. Phân cách bằng dấu phẩy sẽ được tự động hỗ trợ.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-end px-1 pb-2 border-b border-slate-100">
                            <div>
                                <h5 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                    <Braces className="w-4 h-4 text-[#2563eb]" /> Cấu trúc trường dữ liệu
                                </h5>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleAddField} className="text-[10px] font-black text-blue-600 hover:text-white flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-600 rounded-lg transition-all border border-blue-100 active:scale-95 shadow-sm">
                                    <Plus className="w-3.5 h-3.5" /> TRƯỜNG CHUẨN
                                </button>
                                <button onClick={handleAddCustomField} className="text-[10px] font-black text-blue-600 hover:text-white flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-600 rounded-lg transition-all border border-blue-100 active:scale-95 shadow-sm">
                                    <Tag className="w-3.5 h-3.5" /> CUSTOM FIELD
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3 bg-slate-50/50 p-2 rounded-[18px] border border-slate-200/50 min-h-[200px]">
                            {formData.fields?.map((field, idx) => {
                                const FieldIcon = field.isCustom ? Tag : getFieldIcon(field.dbField);
                                const isEmail = field.dbField === 'email';
                                return (
                                    <div key={field.id} className={`group relative flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white p-4 rounded-2xl border shadow-sm hover:shadow-md transition-all animate-in slide-in-from-bottom-2 duration-300 ${field.isCustom ? 'border-blue-200 hover:border-blue-400' : 'border-slate-200 hover:border-blue-300'}`}>
                                        <div className={`absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm z-10 ${field.isCustom ? 'bg-blue-200 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>{idx + 1}</div>

                                        {/* Badge Custom */}
                                        {field.isCustom && (
                                            <div className="absolute top-2 left-6 px-1.5 py-0.5 bg-blue-100 text-blue-600 text-[8px] font-black uppercase tracking-widest rounded-md flex items-center gap-0.5">
                                                <Tag className="w-2.5 h-2.5" /> Custom
                                            </div>
                                        )}

                                        <div className={`pl-4 w-full shrink-0 ${field.isCustom ? 'sm:w-auto flex-1' : 'sm:w-56'} ${field.isCustom ? 'mt-4' : ''}`}>
                                            {field.isCustom ? (
                                                <div className="flex gap-3">
                                                    <div className="flex-1">
                                                        <label className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-1.5 block">Key (tên trường)</label>
                                                        <input
                                                            value={field.customKey || ''}
                                                            onChange={e => updateField(field.id, { customKey: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                                                            placeholder="vd: nguon_khach_hang"
                                                            className="w-full h-[38px] px-3 bg-blue-50 border-2 border-blue-100 rounded-xl text-xs font-bold text-blue-700 font-mono outline-none focus:bg-white focus:border-blue-400 transition-all"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Label hiển thị</label>
                                                        <input
                                                            value={field.label}
                                                            onChange={e => updateField(field.id, { label: e.target.value })}
                                                            placeholder="VD: Nguồn Khách hàng"
                                                            className="w-full h-[38px] px-3 bg-slate-50 border-2 border-transparent rounded-xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-[#2563eb] transition-all"
                                                        />
                                                    </div>
                                                    <div className="shrink-0">
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Kiểu</label>
                                                        <select value={field.type} onChange={e => updateField(field.id, { type: e.target.value as any })} className="h-[38px] px-2 bg-white border-2 border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-400 transition-all">
                                                            <option value="text">Text</option>
                                                            <option value="number">Number</option>
                                                            <option value="date">Date</option>
                                                            <option value="tel">Phone</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Trường Database</label>
                                                    <div className="relative">
                                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><FieldIcon className="w-4 h-4" /></div>
                                                        <select value={field.dbField} onChange={e => updateField(field.id, { dbField: e.target.value })} disabled={isEmail} className={`w-full pl-9 pr-8 py-2.5 rounded-xl text-xs font-bold appearance-none outline-none border-2 transition-all ${isEmail ? 'bg-slate-50 border-slate-100 text-slate-500' : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 focus:border-blue-500'}`}>
                                                            {DB_FIELDS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                        </select>
                                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {!field.isCustom && (
                                            <div className="flex-1 w-full">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Tiêu đề hiển thị (Label)</label>
                                                <input value={field.label} onChange={e => updateField(field.id, { label: e.target.value })} className="w-full h-[40px] px-4 bg-slate-50 border-2 border-transparent rounded-xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-[#2563eb] transition-all" />
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-4 border-t sm:border-t-0 border-slate-100 mt-1 sm:mt-0">
                                            {!field.isCustom && (
                                                <div onClick={() => !isEmail && updateField(field.id, { required: !field.required })} className={`flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg transition-all select-none ${isEmail ? 'opacity-50 pointer-events-none bg-slate-100' : 'hover:bg-slate-50'}`}>
                                                    <div className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 flex items-center ${field.required ? 'bg-[var(--color-primary)] justify-end' : 'bg-slate-300 justify-start'}`}><div className="w-4 h-4 bg-white rounded-full shadow-sm"></div></div>
                                                    <span className={`text-[9px] font-bold uppercase tracking-wider ${field.required ? 'text-[var(--color-primary)]' : 'text-slate-400'}`}>Bắt buộc</span>
                                                </div>
                                            )}
                                            {!isEmail ? (
                                                <button onClick={() => setFormData({ ...formData, fields: formData.fields?.filter(f => f.id !== field.id) })} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                                            ) : (<div className="w-8"></div>)}
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="p-4 bg-white/40 border-2 border-dashed border-slate-200 rounded-2xl text-center">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide flex items-center justify-center gap-2"><Sparkles className="w-3.5 h-3.5" /> Trường chuẩn → lưu vào hồ sơ. Custom Field → lưu vào bộ lọc tùy chỉnh.</p>
                            </div>
                        </div>
                    </div>

                </div>
            </Modal>

            {selectedFormForCode && (
                <IntegrationGuideModal isOpen={!!selectedFormForCode} onClose={() => setSelectedFormForCode(null)} formId={selectedFormForCode.id} formName={selectedFormForCode.name} fields={selectedFormForCode.fields} />
            )}

            <ConfirmModal isOpen={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} onConfirm={executeDelete} title="Xác nhận xóa biểu mẫu" message="Hành động này sẽ xóa vĩnh viễn biểu mẫu này." variant="danger" confirmLabel="Xóa vĩnh viễn" />

            <InputModal
                isOpen={isAddingList}
                onClose={() => setIsAddingList(false)}
                title="Tạo danh sách mới"
                placeholder="Nhập tên danh sách mới..."
                confirmLabel="Tạo mới"
                onConfirm={async (listName) => {
                    if (!listName) return;
                    try {
                        const res = await api.post<any>('lists', { name: listName, description: 'Created from Form Builder' });
                        if (res.success) {
                            toast.success('Đã tạo danh sách mới');
                            const listsRes = await api.get<any[]>('lists');
                            if (listsRes.success) {
                                setLists(listsRes.data);
                                setFormData(prev => ({ ...prev, targetListId: res.data.id }));
                            }
                        }
                    } catch (e) { toast.error('Lỗi khi tạo danh sách'); }
                }}
            />
        </div>
    );
};

export default FormsTab;
