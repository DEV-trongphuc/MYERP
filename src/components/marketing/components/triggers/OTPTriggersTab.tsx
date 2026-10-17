import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert, Plus, Edit3, Trash2, CheckCircle2, Copy, Settings2, Key, Clock, FileText } from 'lucide-react';
import { api } from '../../services/storageAdapter';
import { Template } from '../../types';
import Button from '../common/Button';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Select from '../common/Select';
import toast from 'react-hot-toast';
import ConfirmModal from '../common/ConfirmModal';
import EmailEditor from '../templates/EmailEditor/index';
import { getMktPortalRoot } from '../../utils/portalRoot';
import { AppIcon } from '../../../common/AppIcons';

export interface OTPProfile {
    id: string;
    targetListId?: string; // Optional: save verification to audience list
    name: string;
    token_length: number;
    token_type: 'numeric' | 'alpha' | 'alphanumeric';
    ttl_minutes: number;
    email_template_id: string;
    stats?: { generated: number; verified: number };
}

const OTPTriggersTab: React.FC = () => {
    const [profiles, setProfiles] = useState<OTPProfile[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<OTPProfile>>({
        name: '', token_length: 6, token_type: 'numeric', ttl_minutes: 5, email_template_id: ''
    });

    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    
    // Email Editor state
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

    useEffect(() => { fetchInitialData(); }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        const [profRes, tplRes] = await Promise.all([
            api.get<OTPProfile[]>('otp_profiles'),
            api.get<Template[]>('templates')
        ]);
        if (profRes.success) setProfiles(profRes.data);
        if (tplRes.success) setTemplates(tplRes.data);
        setLoading(false);
    };

    const handleCreateNew = () => {
        setEditingId(null);
        setFormData({ name: '', token_length: 6, token_type: 'numeric', ttl_minutes: 5, email_template_id: '' });
        setIsModalOpen(true);
    };

    const handleEditClick = (p: OTPProfile) => {
        setEditingId(p.id);
        setFormData({ ...p });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name) {
            toast.error('Vui lòng nhập tên Profile');
            return;
        }
        setIsSubmitting(true);
        let res;
        if (editingId) {
            res = await api.put<OTPProfile>(`otp_profiles/${editingId}`, formData);
        } else {
            res = await api.post<OTPProfile>('otp_profiles', formData);
        }

        if (res.success) {
            setIsModalOpen(false);
            toast.success(editingId ? 'Đã cập nhật Profile' : 'Đã tạo Profile mới');
            fetchInitialData();
        } else {
            toast.error(res.message || 'Lỗi lưu trữ');
        }
        setIsSubmitting(false);
    };

    const executeDelete = async () => {
        if (!confirmDeleteId) return;
        const res = await api.delete(`otp_profiles/${confirmDeleteId}`);
        if (res.success) {
            setProfiles(profiles.filter(p => p.id !== confirmDeleteId));
            toast.success('Đã xóa OTP Profile');
            setConfirmDeleteId(null);
        } else {
            toast.error('Lỗi khi xóa');
        }
    };

    const copyApiDoc = (id: string) => {
        const curl = `curl -X POST "https://your_domain.com/api/otp" \\
-H "Content-Type: application/json" \\
-d '{
    "action": "generate",
    "profile_id": "${id}",
    "receiver_email": "user@example.com"
}'`;
        navigator.clipboard.writeText(curl);
        toast.success('Đã copy API Code vào Clipboard');
    };

    const handleQuickEdit = () => {
        if (!formData.email_template_id) return;
        const tpl = templates.find(t => t.id === formData.email_template_id);
        if (tpl) {
            setEditingTemplate(tpl);
            setIsEditorOpen(true);
        }
    };

    const handleSaveTemplate = async (updated: Template) => {
        try {
            const res = await api.put(`templates/${updated.id}`, updated);
            if (res.success) {
                toast.success('Đã cập nhật mẫu Email');
                setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
                setIsEditorOpen(false);
            } else {
                toast.error(res.message || 'Lỗi khi lưu mẫu email');
            }
        } catch (error) {
            toast.error('Có lỗi xảy ra khi lưu mẫu email');
        }
    };

    return (
        <div className="space-y-6 pb-40">
            <div className="flex justify-between items-center bg-[var(--color-surface)] p-4 rounded-[20px] border border-[var(--color-border)] shadow-xs">
                <div className="flex items-center gap-3">
                    <AppIcon name="trigger_otp" size={38} className="shrink-0" />
                    <div>
                        <h3 className="text-base font-bold text-[var(--color-text)]">Cấu hình API sinh OTP</h3>
                        <p className="text-xs text-[var(--color-text-muted)] font-medium">Tạo profile thiết lập mật khẩu một lần (Mã xác thực).</p>
                    </div>
                </div>
                <Button icon={Plus} size="md" onClick={handleCreateNew}>Tạo OTP Profile</Button>
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
                ) : profiles.length === 0 ? (
                    <div className="col-span-full py-16 text-center border-2 border-dashed border-[var(--color-border)] rounded-[20px] bg-[var(--color-bg)]">
                        <div className="flex justify-center mb-3">
                            <AppIcon name="trigger_otp" size={44} />
                        </div>
                        <h3 className="text-[var(--color-text)] font-bold text-base">Chưa thiết lập Sinh OTP nào</h3>
                        <p className="text-[var(--color-text-muted)] mt-1 text-xs">Tạo profile để cấp mã xác thực qua Email.</p>
                    </div>
                ) : profiles.map(p => (
                    <div key={p.id} className="group hover-lift bg-[var(--color-surface)] p-5 rounded-[20px] border border-[var(--color-border)] shadow-xs hover:border-[var(--color-primary-light)] transition-all flex flex-col justify-between gap-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-purple-600 group-hover:scale-125 transition-transform"><Key className="w-32 h-32" /></div>

                        <div className="flex justify-between items-start relative z-10">
                            <div className="flex items-center gap-3">
                                <AppIcon name="trigger_otp" size={38} className="shrink-0 transition-transform group-hover:scale-105" />
                                <div className="min-w-0">
                                    <h4 className="text-sm font-bold text-[var(--color-text)] leading-tight truncate pr-2">{p.name}</h4>
                                    <p className="text-[10px] text-slate-400 font-mono mt-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 w-fit">ID: {p.id?.slice(0, 8)}...</p>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => handleEditClick(p)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Chỉnh sửa"><Edit3 className="w-3.5 h-3.5" /></button>
                                <button onClick={() => setConfirmDeleteId(p.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="Xóa"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                        </div>

                        <div className="space-y-3 relative z-10">
                            <div className="flex items-center justify-between p-2.5 bg-slate-50/70 rounded-xl border border-slate-200/60">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider"><Key className="w-3 h-3 inline mr-1"/>Định dạng</span>
                                    <span className="text-xs font-extrabold text-slate-800">{p.token_length} {p.token_type === 'numeric' ? 'Số' : 'Ký tự'}</span>
                                </div>
                                <div className="h-6 w-px bg-slate-200"></div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider"><Clock className="w-3 h-3 inline mr-1"/>Hiệu lực (TTL)</span>
                                    <span className="text-xs font-extrabold text-slate-800">{p.ttl_minutes} phút</span>
                                </div>
                            </div>

                            <button onClick={() => copyApiDoc(p.id)} className="w-full h-9 rounded-xl bg-[var(--color-bg)] text-slate-700 hover:text-[var(--color-primary)] border border-[var(--color-border)] text-xs font-semibold hover:bg-slate-100 hover:border-slate-300 transition-all flex items-center justify-center gap-1.5">
                                <Copy className="w-3.5 h-3.5 text-[var(--color-primary)]" /> Copy Mã Tích hợp (CURL)
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Cập nhật OTP Profile" : "Tạo mới OTP Profile"} size="md" footer={<div className="flex justify-between w-full"><Button variant="ghost" onClick={() => setIsModalOpen(false)}>Hủy</Button><Button icon={CheckCircle2} onClick={handleSave} isLoading={isSubmitting}>Lưu Cấu trúc</Button></div>}>
                <div className="space-y-6 py-2">
                    <Input label="Tên gợi nhớ" placeholder="VD: OTP Xác thực Landing Page..." value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} autoFocus />
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Độ dài mã (4-10)</label>
                            <Input
                                type="number" min={4} max={10} value={formData.token_length || 6}
                                onChange={e => setFormData({ ...formData, token_length: parseInt(e.target.value) || 6 })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Thời gian sống (Phút)</label>
                            <Input
                                type="number" min={1} max={60} value={formData.ttl_minutes || 5}
                                onChange={e => setFormData({ ...formData, ttl_minutes: parseInt(e.target.value) || 5 })}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Định dạng ký tự</label>
                        <Select
                            options={[
                                { value: 'numeric', label: 'Chỉ có SỐ (0-9) - Dễ nhập nhất' },
                                { value: 'alpha', label: 'Chỉ có CHỮ CÁI (A-Z)' },
                                { value: 'alphanumeric', label: 'Kết hợp CHỮ + SỐ' }
                            ]}
                            value={formData.token_type || 'numeric'}
                            onChange={v => setFormData({ ...formData, token_type: v as any })}
                            icon={Settings2}
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1 flex justify-between items-center w-full">
                            <span>Mẫu Email Gửi Mã (Template)</span>
                            {formData.email_template_id && (
                                <button type="button" onClick={handleQuickEdit} className="text-[var(--color-primary)] hover:opacity-80 flex items-center gap-1 transition-colors">
                                    <Edit3 className="w-3 h-3" /> Sửa nhanh
                                </button>
                            )}
                        </label>
                        <Select
                            options={[
                                { value: '', label: '-- Mẫu Email OTP Hệ thống (Mặc định) --' },
                                ...templates.map(t => ({ value: t.id, label: t.name }))
                            ]}
                            value={formData.email_template_id || ''}
                            onChange={v => setFormData({ ...formData, email_template_id: v })}
                            icon={FileText}
                        />
                        <p className="text-[10px] text-slate-400 mt-2 px-1">
                            Nếu tự thiết kế Email, đảm bảo chèn biến <code className="bg-red-50 text-[var(--color-primary)] px-1 py-0.5 rounded font-mono">[short_code]</code> vào nơi hiển thị mã.
                        </p>
                    </div>
                </div>
            </Modal>
            <ConfirmModal isOpen={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} onConfirm={executeDelete} title="Xác nhận xóa" message="Xóa OTP Profile này sẽ khiến các Form/API đang tích hợp không thể gửi mã xác nhận nữa." variant="danger" confirmLabel="Xóa Profile" />

            {/* Quick Edit Email Template Modal */}
            {isEditorOpen && editingTemplate && createPortal(
                <div className="fixed inset-0 z-[99999] bg-slate-50 flex flex-col">
                    <EmailEditor
                        template={editingTemplate}
                        groups={[]}
                        onSave={handleSaveTemplate}
                        onCancel={() => setIsEditorOpen(false)}
                    />
                </div>,
                getMktPortalRoot()
            )}
        </div>
    );
};

export default OTPTriggersTab;

// Dual value declarations for verbatimModuleSyntax compatibility
export const OTPProfile: any = undefined;
