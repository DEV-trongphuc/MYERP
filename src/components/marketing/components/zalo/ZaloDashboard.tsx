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
        <div className="space-y-12 pb-10">
            {/* OA Manager Hero */}
            <div className="bg-slate-50/50 p-8 rounded-[40px] border border-slate-100 mb-8">
                <ZaloOAManager onSelect={(oa) => setSelectedOA(oa.id)} />
            </div>

            {selectedOA && (
                <div id="templates-section" className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-amber-600 rounded-[20px] shadow-xl shadow-amber-600/10 flex items-center justify-center rotate-3">
                                <Zap className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">ZNS Templates</h2>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Mẫu tin nhắn thông báo tự động (Zalo Notification Service)</p>
                            </div>
                        </div>

                        <button
                            onClick={() => fetchTemplates(selectedOA)}
                            disabled={templatesLoading}
                            className="p-3 bg-white hover:bg-slate-50 rounded-2xl border border-slate-100 shadow-sm transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Làm mới danh sách"
                        >
                            <RefreshCw className={`w-5 h-5 text-slate-400 group-hover:text-amber-600 ${templatesLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    <div className="bg-white rounded-[40px] border border-slate-100 p-8 shadow-sm">
                        {templatesLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <RefreshCw className="w-10 h-10 text-amber-600 animate-spin" />
                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Đang tải templates từ Zalo...</p>
                            </div>
                        ) : templates.length === 0 ? (
                            <div className="text-center py-20 bg-slate-50/50 rounded-[32px] border-2 border-dashed border-slate-100">
                                <MessageSquare className="w-16 h-16 text-slate-100 mx-auto mb-4" />
                                <p className="text-slate-400 text-xs font-black uppercase tracking-widest italic">Chưa có templates nào được đồng bộ</p>
                                <button disabled={templatesLoading} onClick={() => fetchTemplates(selectedOA)} className="mt-4 text-[10px] font-black text-amber-600 uppercase tracking-widest hover:underline px-6 py-2 bg-amber-50 rounded-full disabled:opacity-50">
                                    Đồng bộ ngay
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {templates.map(template => (
                                    <div key={template.id} className="p-6 bg-white rounded-[32px] border border-slate-100 hover:border-amber-100 hover:shadow-2xl transition-all group relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50/30 rounded-full -mr-12 -mt-12 group-hover:bg-amber-50 transition-colors"></div>

                                        <div className="flex items-start justify-between mb-6 relative z-10">
                                            <Badge
                                                variant={
                                                    template.status === 'approved' ? 'success' :
                                                        template.status === 'rejected' ? 'danger' :
                                                            template.status === 'disabled' ? 'secondary' : 'warning'
                                                }
                                                className="uppercase text-[9px] font-black tracking-widest px-3 py-1 rounded-lg"
                                            >
                                                {template.status}
                                            </Badge>
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100">
                                                <ShieldCheck className="w-3 h-3 text-slate-300" />
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{template.template_type}</span>
                                            </div>
                                        </div>

                                        <h3 className="text-sm font-black text-slate-800 mb-2 group-hover:text-amber-600 transition-colors uppercase tracking-tight line-clamp-2 min-h-[2.5rem]">
                                            {template.template_name}
                                        </h3>

                                        <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-50 relative z-10">
                                            <code className="text-[9px] bg-slate-50 px-2 py-1 rounded-lg text-slate-400 font-bold uppercase tracking-tighter">
                                                ID: {template.template_id}
                                            </code>
                                            <button className="p-2 bg-slate-50 text-slate-300 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition-all shadow-sm">
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

