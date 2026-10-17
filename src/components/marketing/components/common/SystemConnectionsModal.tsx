import { EXTERNAL_ASSET_BASE } from '../../utils/config';
import React, { useState, useEffect } from 'react';
import { Mail, MessageSquare, Code, Globe, CheckCircle2, ArrowRight, Bot, Link, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/storageAdapter';
import Modal from './Modal';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    isDarkTheme?: boolean;
}

export const SystemConnectionsModal: React.FC<Props> = ({ isOpen, onClose, isDarkTheme }) => {
    const navigate = useNavigate();
    const [fetchedStatus, setFetchedStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        if (isOpen) {
            setLoading(true);
            setFetchedStatus(null);
            api.get<any>('system_connections')
                .then(res => {
                    if (!isMounted) return;
                    if (res.success && res.data) {
                        setFetchedStatus(res.data);
                    }
                })
                .catch(error => {
                    console.error('Failed to fetch connections status', error);
                })
                .finally(() => {
                    if (isMounted) setLoading(false);
                });
        }
        return () => { isMounted = false; };
    }, [isOpen]);

    if (!isOpen) return null;

    const connections = [
        {
            id: 'smtp',
            name: 'Máy chủ Gửi Email',
            desc: 'Cấu hình SMTP (Amazon SES, SendGrid...) để gửi chiến dịch tự động.',
            icon: Mail,
            color: 'bg-[var(--color-primary)]',
            status: fetchedStatus ? Boolean(fetchedStatus.smtp) : false,
            path: '/settings?tab=marketing_automation'
        },
        {
            id: 'zalo',
            name: 'Zalo OA (ZNS)',
            desc: 'Kết nối Official Account gửi tin nhắn Zalo chăm sóc khách hàng.',
            icon: MessageSquare,
            imageUrl: `${EXTERNAL_ASSET_BASE}/imgs/zalolog.png`,
            color: 'bg-[#0068FF]',
            status: fetchedStatus ? Boolean(fetchedStatus.zalo) : false,
            path: '/settings?tab=marketing_automation'
        },
        {
            id: 'mess',
            name: 'Messenger',
            desc: 'Gửi tin nhắn chăm sóc tự động và thu thập Khách hàng từ Fanpage.',
            icon: Smartphone,
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/2021_Facebook_icon.svg',
            color: 'bg-[#0668E1]',
            status: fetchedStatus ? Boolean(fetchedStatus.meta) : false,
            path: '/marketing/social-bot'
        },
        {
            id: 'api',
            name: 'Forms & API Webhooks',
            desc: 'Thu thập Khách hàng trực tiếp từ Form hoặc qua ứng dụng thứ ba (CRM, POS...).',
            icon: Code,
            color: 'bg-indigo-600',
            status: fetchedStatus ? Boolean(fetchedStatus.api) : false,
            path: '/marketing/api-triggers'
        },
        {
            id: 'tracking',
            name: 'Website Tracking Pixel',
            desc: 'Gắn mã theo dõi hành vi Khách truy cập web, giỏ hàng, mua hàng.',
            icon: Globe,
            color: 'bg-cyan-600',
            status: fetchedStatus ? Boolean(fetchedStatus.tracking) : false,
            path: '/marketing/web-tracking'
        },
        {
            id: 'ai',
            name: 'AI Chatbot Assistant',
            desc: 'Triển khai tư vấn viên tự động sử dụng trí tuệ nhân tạo riêng biệt.',
            icon: Bot,
            color: 'bg-[var(--color-primary)]',
            status: fetchedStatus ? Boolean(fetchedStatus.ai) : false,
            path: '/marketing/ai-training'
        }
    ];

    const handleNavigate = (path: string) => {
        onClose();
        navigate(path);
        window.scrollTo(0, 0);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="xl"
            isDarkTheme={isDarkTheme}
            noPadding
            title={
                <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-[14px] bg-[var(--color-primary)] flex items-center justify-center text-white shadow-sm">
                        <Link className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className={`text-lg font-black tracking-tight ${isDarkTheme ? 'text-slate-100' : 'text-slate-800'}`}>KẾT NỐI SẴN SÀNG</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                            Điểm kiểm tra tích hợp các kênh truyền thông & API
                        </p>
                    </div>
                </div>
            }
        >
            <div className={`overflow-y-auto p-6 relative custom-scrollbar ${isDarkTheme ? 'bg-[#11151d]' : 'bg-slate-50/50'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {connections.map((item, idx) => (
                        <div key={idx} className={`p-5 rounded-[18px] border transition-all flex flex-col group ${isDarkTheme ? 'bg-slate-900 border-slate-800 hover:border-slate-700 shadow-sm hover:shadow-md' : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300'}`}>
                            <div className="flex items-start gap-4 mb-4">
                                <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-105 overflow-hidden ${item.imageUrl ? (isDarkTheme ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-100') : `${item.color} text-white`}`}>
                                    {item.imageUrl ? (
                                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain p-1.5" />
                                    ) : (
                                        <item.icon className="w-6 h-6" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className={`font-bold text-[15px] truncate ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>{item.name}</h3>
                                    <p className={`text-[11px] font-medium leading-relaxed mt-1 line-clamp-2 ${isDarkTheme ? 'text-slate-500' : 'text-slate-500'}`}>
                                        {item.desc}
                                    </p>
                                </div>
                            </div>

                            <div className={`mt-auto pt-4 border-t flex items-center justify-between ${isDarkTheme ? 'border-slate-800/80' : 'border-slate-100'}`}>
                                {loading ? (
                                    <div className="h-7 w-28 rounded-[var(--radius-md)] bg-slate-100 animate-pulse" />
                                ) : item.status ? (
                                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] border text-xs font-bold ${isDarkTheme ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span>Sẵn sàng</span>
                                    </div>
                                ) : (
                                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-bold ${isDarkTheme ? 'bg-slate-850 text-slate-400 border border-slate-800' : 'bg-slate-100 text-slate-500 border border-slate-200/50'}`}>
                                        <div className="w-2 h-2 rounded-full bg-slate-400" />
                                        <span>Chưa liên kết</span>
                                    </div>
                                )}

                                <button
                                    onClick={() => handleNavigate(item.path)}
                                    disabled={loading}
                                    className={`flex items-center gap-1.5 text-xs font-semibold h-9 px-4 rounded-[var(--radius-md)] transition-all active:scale-[0.97] ${loading ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-400' : item.status ? (isDarkTheme ? 'text-slate-300 hover:bg-slate-850 hover:text-slate-100 border border-slate-700' : 'text-slate-600 hover:bg-slate-100 border border-slate-200') : 'bg-[var(--color-primary)] hover:opacity-95 text-white shadow-sm'}`}
                                >
                                    {item.status ? 'Cấu hình' : 'Thiết lập ngay'} <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Modal>
    );
};
