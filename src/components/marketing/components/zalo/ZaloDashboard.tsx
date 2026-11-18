import * as React from 'react';
import { useState, useEffect } from 'react';
import { MessageSquare, RefreshCw, Settings, ShieldCheck, Zap } from 'lucide-react';
import { api } from '../../services/storageAdapter';
import Card from '../common/Card';
import Badge from '../common/Badge';
import toast from 'react-hot-toast';
import ZaloOAManager from '../settings/ZaloOAManager';

interface ZaloTemplate {
    id: string;
    oa_config_id: string;
    template_id: string;
    template_name: string;
    template_type: 'transaction' | 'promotion' | 'customer_care';
    status: 'pending' | 'approved' | 'rejected' | 'disabled';
    oa_name: string;
}

const ZaloDashboard: React.FC = () => {
    const [templates, setTemplates] = useState<ZaloTemplate[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [selectedOA, setSelectedOA] = useState<string>('');

    useEffect(() => {
        if (selectedOA) {
            fetchTemplates(selectedOA);
            setTimeout(() => {
                document.getElementById('templates-section')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        } else {
            setTemplates([]);
        }
    }, [selectedOA]);

    const fetchTemplates = async (oaId: string) => {
        setTemplatesLoading(true);
        try {
            const res = await api.get<ZaloTemplate[]>(`zalo_templates?oa_id=${oaId}`);
            if (res.success) {
                const validTemplates = (res.data || []).filter((t: ZaloTemplate) => t.status?.toUpperCase() !== 'REJECT' && t.status?.toUpperCase() !== 'REJECTED');
                setTemplates(validTemplates);
            } else {
                showToast('Không thể tải templates', 'error');
            }
        } catch (error) {
            showToast('Lỗi kết nối API', 'error');
        } finally {
            setTemplatesLoading(false);
        }
    };

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        if (type === 'success') toast.success(message);
        else if (type === 'error') toast.error(message);
        else toast(message);
    };

    return (
        <div className="space-y-8 pb-10">
            {/* OA Manager Hero */}
            <div className="bg-slate-50/70 p-6 rounded-2xl border border-slate-200 mb-6">
                <ZaloOAManager onSelect={(oa) => setSelectedOA(oa.id)} />
            </div>

            {selectedOA && (
                <div id="templates-section" className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#BD1D2D] rounded-xl shadow-sm flex items-center justify-center">
                                <Zap className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">ZNS Templates</h2>
                                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">Mẫu tin nhắn thông báo tự động (Zalo Notification Service)</p>
                            </div>
                        </div>

                        <button
                            onClick={() => fetchTemplates(selectedOA)}
                            disabled={templatesLoading}
                            className="p-2.5 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-xs transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Làm mới danh sách"
                        >
                            <RefreshCw className={`w-5 h-5 text-slate-400 group-hover:text-[var(--color-primary)] ${templatesLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                        {templatesLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <RefreshCw className="w-10 h-10 text-[var(--color-primary)] animate-spin" />
                                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Đang tải templates từ Zalo...</p>
                            </div>
                        ) : templates.length === 0 ? (
                            <div className="text-center py-16 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                                <MessageSquare className="w-14 h-14 text-slate-200 mx-auto mb-4" />
                                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Chưa có templates nào được đồng bộ</p>
                                <button disabled={templatesLoading} onClick={() => fetchTemplates(selectedOA)} className="mt-4 text-[11px] font-bold text-[var(--color-primary)] uppercase tracking-wider hover:underline px-6 py-2 bg-rose-50 rounded-full disabled:opacity-50">
                                    Đồng bộ ngay
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {templates.map(template => (
                                    <div key={template.id} className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-[border-color,box-shadow] group relative overflow-hidden">
                                        <div className="flex items-start justify-between mb-5 relative z-10">
                                            <Badge
                                                variant={
                                                    template.status === 'approved' ? 'success' :
                                                        template.status === 'rejected' ? 'danger' :
                                                            template.status === 'disabled' ? 'secondary' : 'warning'
                                                }
                                                className="uppercase text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-lg"
                                            >
                                                {template.status}
                                            </Badge>
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-lg border border-slate-200">
                                                <ShieldCheck className="w-3 h-3 text-slate-400" />
                                                <span className="text-[10px] font-semibold text-slate-500 uppercase">{template.template_type}</span>
                                            </div>
                                        </div>

                                        <h3 className="text-sm font-bold text-slate-800 mb-2 group-hover:text-[var(--color-primary)] transition-colors line-clamp-2 min-h-[2.5rem]">
                                            {template.template_name}
                                        </h3>

                                        <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100 relative z-10">
                                            <code className="text-[10px] bg-slate-50 px-2 py-1 rounded-lg text-slate-500 font-semibold uppercase tabular-nums">
                                                ID: {template.template_id}
                                            </code>
                                            <button className="p-2 bg-slate-50 text-slate-400 rounded-xl group-hover:bg-[var(--color-primary)] group-hover:text-white transition-colors">
                                                <ExternalLink className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}


        </div>
    );
};

const ExternalLink = ({ className }: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
)

export default ZaloDashboard;

