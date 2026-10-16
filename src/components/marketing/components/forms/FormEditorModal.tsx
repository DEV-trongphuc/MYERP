
import React, { useState, useEffect } from 'react';
import {
    Code2, Plus, Globe, CheckCircle2, ChevronDown, Sparkles, FileInput, Braces, Trash2, Database, Type, Mail, Phone, Briefcase, Building, MapPin, Calendar, Bell, BellRing, Users, Edit3
} from 'lucide-react';
import { api } from '../../services/storageAdapter';
import { FormDefinition, FormField } from '../../types';
import Button from '../common/Button';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Select from '../common/Select';
import toast from 'react-hot-toast';
import InputModal from '../common/InputModal';

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

interface FormEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingFormId: string | null;
    initialData?: Partial<FormDefinition>;
    lists: any[];
    onSuccess: () => void;
}

const FormEditorModal: React.FC<FormEditorModalProps> = ({
    isOpen, onClose, editingFormId, initialData, lists, onSuccess
}) => {
    const [formData, setFormData] = useState<Partial<FormDefinition>>({
        name: '', targetListId: '', fields: [{ id: 'f-email', dbField: 'email', label: 'Địa chỉ Email', required: true, type: 'email' }],
        notificationEnabled: false, notificationEmails: '', notificationCcEmails: '', notificationSubject: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAddingList, setIsAddingList] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    ...initialData,
                    notificationEnabled: initialData.notificationEnabled || false,
                    notificationEmails: initialData.notificationEmails || '',
                    notificationCcEmails: initialData.notificationCcEmails || '',
                    notificationSubject: initialData.notificationSubject || ''
                });
            } else {
                setFormData({
                    name: '', targetListId: '', fields: [{ id: 'f-email', dbField: 'email', label: 'Địa chỉ Email', required: true, type: 'email' }],
                    notificationEnabled: false, notificationEmails: '', notificationCcEmails: '', notificationSubject: ''
                });
            }
        }
    }, [isOpen, initialData]);

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        if (type === 'success') toast.success(message);
        else if (type === 'error') toast.error(message);
        else toast(message);
    };

    const handleAddField = () => {
        setFormData({
            ...formData,
            fields: [...(formData.fields || []), { id: crypto.randomUUID(), dbField: 'firstName', label: 'Tên Khách hàng', required: false, type: 'text' }]
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
            onSuccess();
            onClose();
        } else {
            showToast(res.message || 'Lỗi khi lưu Form', 'error');
        }
        setIsSubmitting(false);
    };

    const getFieldIcon = (dbField: string) => {
        const field = DB_FIELDS.find(f => f.value === dbField);
        return field?.icon || Type;
    }

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={editingFormId ? "Chỉnh sửa biểu mẫu" : "Thiết kế biểu mẫu mới"}
                size="lg"
                footer={<div className="flex justify-between w-full"><Button variant="ghost" onClick={onClose}>Hủy</Button><Button icon={CheckCircle2} onClick={handleSaveForm} isLoading={isSubmitting}>{editingFormId ? 'Cập nhật Form' : 'Lưu cấu hình Form'}</Button></div>}
            >
                <div className="space-y-8 py-2">
                    {/* SECTION 1: General Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <Input
                            label="Tên định danh Form"
                            placeholder="VD: Form Landing Page..."
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            autoFocus
                        />
                        <div className="flex-1">
                            <Select
                                label="Danh sách lưu trữ đích"
                                options={[
                                    ...lists.map(l => ({ value: l.id, label: l.name })),
                                    { value: 'CREATE_NEW_LIST', label: '+ Tạo danh sách mới...' }
                                ]}
                                value={formData.targetListId || ''}
                                onChange={v => {
                                    if (v === 'CREATE_NEW_LIST') {
                                        setIsAddingList(true);
                                    } else {
                                        setFormData({ ...formData, targetListId: v });
                                    }
                                }}
                                placeholder="Chọn danh sách đích..."
                                icon={Database}
                                variant="outline"
                            />
                        </div>
                    </div>

                    {/* SECTION 1.5: Email Notification */}
                    <div className={`space-y-4 bg-slate-50/40 border border-slate-200/50 px-6 py-6 rounded-[32px] relative overflow-hidden transition-all duration-500 ${formData.notificationEnabled ? 'ring-1 ring-slate-200/60' : ''}`}>
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

                                <div className="p-4 bg-white/40 shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] rounded-2xl border border-amber-100/50">
                                    <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                                        * Nhập nhiều email bằng cách nhấn <kbd className="bg-slate-100 px-1 inline-block pb-0.5 rounded text-slate-700 font-bold border border-slate-200">Enter</kbd> để xuống dòng. Phân cách bằng dấu phẩy sẽ được tự động hỗ trợ.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* SECTION 2: Fields Structure */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-end px-1 pb-2 border-b border-slate-100">
                            <div>
                                <h5 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                    <Braces className="w-4 h-4 text-[#2563eb]" /> Cấu trúc trường dữ liệu
                                </h5>
                                <p className="text-[10px] text-slate-400 font-medium mt-1">Định nghĩa các trường thông tin bạn muốn thu thập từ Khách hàng.</p>
                            </div>
                            <button onClick={handleAddField} className="text-[10px] font-black text-blue-600 hover:text-white flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-600 rounded-lg transition-all border border-blue-100 active:scale-95 shadow-sm">
                                <Plus className="w-3.5 h-3.5" /> THÊM TRƯỜNG
                            </button>
                        </div>

                        <div className="space-y-3 bg-slate-50/50 p-2 rounded-[24px] border border-slate-200/50 min-h-[200px]">
                            {formData.fields?.map((field, idx) => {
                                const FieldIcon = getFieldIcon(field.dbField);
                                return (
                                    <div key={field.id} className="group relative flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all animate-in slide-in-from-bottom-2 duration-300">
                                        <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500 border-2 border-white shadow-sm z-10">{idx + 1}</div>

                                        <div className="pl-4 w-full sm:w-56 shrink-0">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Trường Database</label>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><FieldIcon className="w-4 h-4" /></div>
                                                <select
                                                    value={field.dbField}
                                                    onChange={e => updateField(field.id, { dbField: e.target.value })}
                                                    disabled={field.dbField === 'email'}
                                                    className={`w-full pl-9 pr-8 py-2.5 rounded-xl text-xs font-bold appearance-none outline-none border-2 transition-all ${field.dbField === 'email' ? 'bg-slate-50 border-slate-100 text-slate-500' : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'}`}
                                                >
                                                    {DB_FIELDS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                </select>
                                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                            </div>
                                        </div>

                                        <div className="flex-1 w-full">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Tiêu đề hiển thị (Label)</label>
                                            <input
                                                value={field.label}
                                                onChange={e => updateField(field.id, { label: e.target.value })}
                                                className="w-full h-[40px] px-4 bg-slate-50 border-2 border-transparent rounded-xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-[#2563eb] transition-all placeholder:text-slate-300"
                                                placeholder="Nhập tên trường..."
                                            />
                                        </div>

                                        <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pt-2 sm:pt-6 border-t sm:border-t-0 border-slate-100 mt-2 sm:mt-0">
                                            <div
                                                onClick={() => field.dbField !== 'email' && updateField(field.id, { required: !field.required })}
                                                className={`flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg transition-all select-none ${field.dbField === 'email' ? 'opacity-50 pointer-events-none bg-slate-100' : 'hover:bg-slate-50'}`}
                                            >
                                                <div className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 flex items-center ${field.required ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'}`}>
                                                    <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                                                </div>
                                                <span className={`text-[9px] font-bold uppercase tracking-wider ${field.required ? 'text-emerald-600' : 'text-slate-400'}`}>Bắt buộc</span>
                                            </div>

                                            {field.dbField !== 'email' ? (
                                                <button onClick={() => setFormData({ ...formData, fields: formData.fields?.filter(f => f.id !== field.id) })} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                                            ) : (
                                                <div className="w-8"></div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="p-4 bg-white/40 border-2 border-dashed border-slate-200 rounded-2xl text-center">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide flex items-center justify-center gap-2">
                                    <Sparkles className="w-3.5 h-3.5" /> Dữ liệu sẽ tự động đồng bộ vào hồ sơ Khách hàng.
                                </p>
                            </div>
                        </div>
                    </div>

                </div>
            </Modal>

            <InputModal
                isOpen={isAddingList}
                onClose={() => setIsAddingList(false)}
                title="Tạo danh sách mới"
                placeholder="Nhập tên danh sách mới..."
                confirmLabel="Tạo mới"
                onConfirm={async (newName) => {
                    if (newName) {
                        toast.promise(
                            api.post('lists', { name: newName, status: 1 }),
                            {
                                loading: 'Đang tạo danh sách...',
                                success: (res: any) => {
                                    if (res.success) {
                                        setFormData(prev => ({ ...prev, targetListId: res.data.id }));
                                        onSuccess();
                                        return 'Đã tạo danh sách mới!';
                                    }
                                    throw new Error(res.message);
                                },
                                error: (err) => `Lỗi: ${err.message}`
                            }
                        );
                    }
                }}
            />

        </>
    );
};

export default FormEditorModal;
