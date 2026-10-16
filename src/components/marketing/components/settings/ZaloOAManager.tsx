import * as React from 'react';
import { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, CheckCircle, XCircle, AlertTriangle, ExternalLink, HelpCircle, Loader2, Users, ShieldCheck, FileText } from 'lucide-react';
import Button from '../common/Button';
import toast from 'react-hot-toast';
import ZaloSetupGuide from '../common/ZaloSetupGuide';
import ConfirmModal from '../common/ConfirmModal';
import { api } from '../../services/storageAdapter';
import ZaloTemplateModal from './ZaloTemplateModal';

interface ZaloOA {
    id: string;
    name: string;
    avatar?: string;
    oa_id: string;
    app_id: string;
    daily_quota: number;
    remaining_quota: number;
    monthly_promo_quota: number;
    remaining_promo_quota: number;
    quality_48h: string;
    quality_7d: string;
    quota_used_today: number;
    status: 'active' | 'inactive' | 'suspended' | 'verifying';
    token_expires_at: string | null;
    created_at: string;
    updated_at_quota?: string;
}

interface ZaloOAManagerProps {
    onSelect?: (oa: ZaloOA) => void;
}

const ZaloOAManager: React.FC<ZaloOAManagerProps> = ({ onSelect }) => {
    const [oas, setOas] = useState<ZaloOA[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [templateModal, setTemplateModal] = useState<{ isOpen: boolean; oaId: string | null }>({
        isOpen: false,
        oaId: null
    });

    // Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: React.ReactNode;
        variant: 'danger' | 'warning' | 'info';
        onConfirm: () => void;
        requireConfirmText?: string;
    }>({
        isOpen: false,
        title: '',
        message: '',
        variant: 'danger',
        onConfirm: () => { }
    });

    useEffect(() => {
        fetchOAs();

        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'ZALO_AUTH_SUCCESS') {
                showToast('Kết nối Zalo OA thành công!', 'success');
                setIsConnecting(false);
                fetchOAs();
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const fetchOAs = async () => {
        setIsLoading(true);
        try {
            const res = await api.get<ZaloOA[]>('zalo_oa');
            if (res.success) {
                setOas(res.data);
            }
        } catch (error) {
            showToast('Lỗi khi tải danh sách OA', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleConnect = async () => {
        setIsConnecting(true);
        try {
            const res = await api.post<{ auth_url: string }>('zalo_oa?route=generate-auth-url', {});

            if (res.success && res.data?.auth_url) {
                const width = 600;
                const height = 700;
                const left = (window.screen.width - width) / 2;
                const top = (window.screen.height - height) / 2;

                window.open(
                    res.data.auth_url,
                    'ZaloOAuth',
                    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
                );

                showToast('Đang mở cửa sổ đăng nhập Zalo...', 'info');
            } else {
                showToast(res.message || 'Lỗi khi tạo URL kết nối', 'error');
                setIsConnecting(false);
            }
        } catch (error) {
            showToast('Lỗi kết nối API', 'error');
            setIsConnecting(false);
        }
    };

    const handleAuthorize = async (oaId: string) => {
        try {
            const res = await api.post<{ auth_url: string }>(`zalo_oa?route=generate-auth-url&id=${oaId}`, {});
            if (res.success && res.data?.auth_url) {
                const width = 600;
                const height = 700;
                const left = (window.screen.width - width) / 2;
                const top = (window.screen.height - height) / 2;

                window.open(
                    res.data.auth_url,
                    'ZaloOAuth',
                    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
                );
            } else {
                showToast(res.message || 'Lỗi khi tạo URL authorize', 'error');
            }
        } catch (error) {
            showToast('Lỗi kết nối API', 'error');
        }
    };

    const handleRefreshToken = async (oaId: string) => {
        try {
            const res = await api.post(`zalo_oa?route=refresh-token&id=${oaId}`, {});
            if (res.success) {
                showToast('Đã làm mới token thành công!', 'success');
                fetchOAs();
            } else {
                showToast(res.message || 'Lỗi khi refresh token', 'error');
            }
        } catch (error) {
            showToast('Lỗi kết nối API', 'error');
        }
    };

    const handleRefreshQuota = async (oaId: string) => {
        try {
            const res = await api.get<{
                daily_quota: number,
                remaining: number,
                monthly_promo_quota: number,
                remaining_promo_quota: number,
                quality_48h: string,
                quality_7d: string
            }>(`zalo_oa?route=quota&id=${oaId}`);
            if (res.success) {
                // Update local state deeply
                setOas(prev => prev.map(o => {
                    if (o.id === oaId) {
                        return {
                            ...o,
                            daily_quota: res.data.daily_quota,
                            remaining_quota: res.data.remaining,
                            monthly_promo_quota: res.data.monthly_promo_quota,
                            remaining_promo_quota: res.data.remaining_promo_quota,
                            quality_48h: res.data.quality_48h,
                            quality_7d: res.data.quality_7d,
                            quota_used_today: res.data.daily_quota - res.data.remaining // Update calculated
                        };
                    }
                    return o;
                }));
                showToast('Đã cập nhật Hạn mức và Chất lượng', 'success');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleDeleteClick = (oaId: string, oaName: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Ngắt kết nối Zalo OA?',
            message: `Bạn có chắc chắn muốn ngắt kết nối "${oaName}"? Mọi chiến dịch và tự động hóa liên quan đến OA này sẽ bị ảnh hưởng.`,
            variant: 'danger',
            requireConfirmText: 'DISCONNECT',
            onConfirm: () => handleDelete(oaId)
        });
    };

    const handleDelete = async (oaId: string) => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
            const res = await api.delete(`zalo_oa?id=${oaId}`);
            if (res.success) {
                showToast('Đã xóa OA thành công!', 'success');
                fetchOAs();
            } else {
                showToast(res.message || 'Lỗi khi xóa OA', 'error');
            }
        } catch (error) {
            showToast('Lỗi kết nối API', 'error');
        }
    };

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        if (type === 'success') toast.success(message);
        else if (type === 'error') toast.error(message);
        else toast(message);
    };

    const getStatusBadge = (oa: ZaloOA) => {
        if (oa.status === 'active') {
            return (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-wider border border-emerald-500/10">
                    <div className="relative flex">
                        <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                        <CheckCircle className="relative w-3 h-3" />
                    </div>
                    Active
                </div>
            );
        } else if (oa.status === 'inactive' || oa.status === 'verifying') {
            return (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-500/10 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-wider border border-slate-500/10">
                    <AlertTriangle className="w-3 h-3" />
                    Chưa authorize
                </div>
            );
        } else {
            return (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 text-rose-500 rounded-xl text-[10px] font-black uppercase tracking-wider border border-rose-500/10">
                    <XCircle className="w-3 h-3" />
                    Suspended
                </div>
            );
        };
    };

    const getQualityColor = (quality: string) => {
        switch (quality?.toUpperCase()) {
            case 'HIGH': return 'text-emerald-600 bg-emerald-100';
            case 'MEDIUM': return 'text-amber-600 bg-amber-100';
            case 'LOW': return 'text-rose-600 bg-rose-100';
            default: return 'text-slate-500 bg-slate-100';
        }
    };

    const isTokenExpired = (expiresAt: string | null) => {
        if (!expiresAt) return true;
        return new Date(expiresAt) < new Date();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-7 rounded-[32px] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] mb-8 transition-all hover:shadow-[0_15px_40px_rgb(0,0,0,0.04)]">
                <div>
                    <div className="flex items-center gap-3.5 mb-1.5">
                        <div className="w-11 h-11 bg-gradient-to-br from-amber-600 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-600/20 ring-4 ring-amber-50">
                            <Users className="w-5 h-5 !text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">Zalo Official Accounts</h3>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5 opacity-80">Quản lý kết nối OA</p>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    <Button
                        variant="secondary"
                        icon={HelpCircle}
                        onClick={() => setIsGuideOpen(true)}
                        size="md"
                        className="rounded-2xl border-slate-200 bg-slate-50/50 hover:bg-white transition-all"
                    >
                        Hướng dẫn
                    </Button>
                    <Button
                        icon={Plus}
                        onClick={handleConnect}
                        isLoading={isConnecting}
                        size="md"
                        variant="secondary"
                        className="bg-gradient-to-r from-amber-600 to-amber-600 hover:from-amber-600 hover:to-amber-700 !text-white rounded-2xl shadow-lg shadow-amber-600/25 px-8 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] border-0"
                    >
                        Kết nối ngay
                    </Button>
                </div>
            </div>

            {/* OA List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
                </div>
            ) : oas.length === 0 ? (
                <div className="relative overflow-hidden bg-white border border-slate-100 rounded-[40px] p-16 text-center shadow-sm">
                    {/* Background decoration */}
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-amber-50/50 to-transparent pointer-events-none" />
                    <div className="absolute -top-24 -left-24 w-64 h-64 bg-amber-600/5 blur-[80px] rounded-full" />
                    <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-amber-600/5 blur-[80px] rounded-full" />

                    <div className="relative z-10 max-w-sm mx-auto">
                        <div className="w-24 h-24 bg-gradient-to-br from-white to-slate-50 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-amber-600/5 border border-white relative group">
                            <div className="absolute inset-0 bg-amber-600/10 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <ExternalLink className="w-10 h-10 text-amber-600 relative z-10 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6" />
                        </div>
                        <h4 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Sẵn sàng kết nối?</h4>
                        <p className="text-sm text-slate-500 mb-10 leading-relaxed font-medium">Kết nối Zalo Official Account của bạn ngay hôm nay để bắt đầu khai thác sức mạnh của thông báo ZNS tự động.</p>
                        <Button
                            icon={Plus}
                            onClick={handleConnect}
                            isLoading={isConnecting}
                            size="lg"
                            variant="secondary"
                            className="bg-slate-900 hover:bg-black !text-white rounded-2xl shadow-xl shadow-slate-900/10 px-10 py-4 transition-all hover:-translate-y-1 active:scale-95 border-0"
                        >
                            Kết nối ngay 1 chạm
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {oas.map((oa) => (
                        <div
                            key={oa.id}
                            className="relative group bg-white border border-slate-100/80 rounded-[32px] p-7 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.04)] hover:shadow-[0_30px_70px_-15px_rgba(59,130,246,0.15)] hover:-translate-y-1.5 transition-all duration-500 overflow-hidden"
                        >
                            {/* Decorative Background Elements */}
                            <div className="absolute -top-12 -right-12 w-40 h-40 bg-amber-600/5 blur-[60px] rounded-full group-hover:bg-amber-600/10 transition-all duration-700" />
                            <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-amber-600/5 blur-[50px] rounded-full group-hover:bg-amber-600/8 transition-all duration-700" />

                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-8">
                                    <div className="flex items-center gap-5">
                                        <div className="relative">
                                            {oa.avatar ? (
                                                <div className="relative">
                                                    <img
                                                        src={oa.avatar}
                                                        alt={oa.name}
                                                        className="w-16 h-16 rounded-[22px] bg-slate-50 object-cover shadow-sm ring-4 ring-slate-50 transition-transform duration-500 group-hover:rotate-3"
                                                    />
                                                    <div className="absolute inset-0 rounded-[22px] shadow-inner" />
                                                </div>
                                            ) : (
                                                <div className="w-16 h-16 rounded-[22px] bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-600/20">
                                                    <Users className="w-8 h-8 !text-white" />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-black text-slate-800 tracking-tight mb-1">{oa.name}</h4>
                                            {oa.oa_id && (
                                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100/50 rounded-lg w-fit">
                                                    <p className="text-[10px] text-slate-400 font-mono font-bold tracking-tight">ID: {oa.oa_id}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="transform transition-all duration-500 group-hover:scale-105 group-hover:rotate-1">
                                        {getStatusBadge(oa)}
                                    </div>
                                </div>

                                {/* Token Expiry Warning */}
                                {oa.token_expires_at && isTokenExpired(oa.token_expires_at) && oa.status === 'active' && (
                                    <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 mb-6 flex items-start gap-3 animate-pulse">
                                        <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                                        <div>
                                            <p className="text-xs text-rose-800 font-bold uppercase tracking-wider mb-0.5">Hết hạn kết nối</p>
                                            <p className="text-[11px] text-rose-600 font-medium">Token đã hết hạn. Vui lòng authorize lại để tiếp tục sử dụng dịch vụ.</p>
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex items-center gap-3">
                                    {oa.status === 'active' ? (
                                        <>
                                            <Button
                                                size="md"
                                                variant="secondary"
                                                icon={FileText}
                                                onClick={() => setTemplateModal({ isOpen: true, oaId: oa.id })}
                                                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-600 hover:from-amber-600 hover:to-amber-700 !text-white shadow-lg shadow-amber-600/20 border-0"
                                            >
                                                Templates
                                            </Button>

                                            <button
                                                onClick={() => handleAuthorize(oa.id)}
                                                className="px-4 py-2.5 bg-slate-50 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-100 hover:text-slate-700 transition-all border border-slate-100 active:scale-95"
                                                title="Cập nhật quyền/Authorize lại"
                                            >
                                                <ShieldCheck className="w-3.5 h-3.5" />
                                            </button>

                                            <button
                                                onClick={() => handleRefreshToken(oa.id)}
                                                className="p-2.5 bg-white border border-slate-100 text-slate-400 rounded-2xl hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50/30 transition-all shadow-sm active:scale-95"
                                                title="Refresh Token"
                                            >
                                                <RefreshCw className="w-4 h-4" />
                                            </button>
                                        </>
                                    ) : (oa.status === 'inactive' || oa.status === 'verifying') ? (
                                        <div className="flex items-center gap-3 w-full">
                                            <Button
                                                size="md"
                                                variant="secondary"
                                                icon={ExternalLink}
                                                onClick={() => handleAuthorize(oa.id)}
                                                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-600 hover:from-amber-600 hover:to-amber-700 !text-white border-0 shadow-lg shadow-amber-600/20"
                                            >
                                                Kích hoạt ngay
                                            </Button>

                                            <Button
                                                size="md"
                                                variant="secondary"
                                                icon={FileText}
                                                onClick={() => setTemplateModal({ isOpen: true, oaId: oa.id })}
                                                className="px-5 py-3 rounded-2xl border-slate-100 bg-slate-50 text-slate-400 hover:bg-white hover:border-amber-200 hover:text-amber-600 shadow-sm"
                                            >
                                                Templates
                                            </Button>
                                        </div>
                                    ) : null}

                                    <button
                                        onClick={() => handleDeleteClick(oa.id, oa.name)}
                                        className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all active:scale-95"
                                        title="Ngắt kết nối"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Template Modal */}
            {templateModal.oaId && (
                <ZaloTemplateModal
                    isOpen={templateModal.isOpen}
                    onClose={() => setTemplateModal({ isOpen: false, oaId: null })}
                    oaId={templateModal.oaId}
                />
            )}

            {/* Setup Guide Modal */}
            <ZaloSetupGuide
                isOpen={isGuideOpen}
                onClose={() => setIsGuideOpen(false)}
            />

            {/* Confirmation Modal */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                variant={confirmModal.variant}
                requireConfirmText={confirmModal.requireConfirmText}
                confirmLabel="Ngắt kết nối"
            />
        </div>
    );
};

export default ZaloOAManager;

