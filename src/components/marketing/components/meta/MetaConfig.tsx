import * as React from 'react';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, RefreshCw, CheckCircle, XCircle, AlertTriangle, Loader2, Globe as Facebook, ShieldCheck, Clock } from 'lucide-react';
import Button from '../common/Button';
import toast from 'react-hot-toast';
import ConfirmModal from '../common/ConfirmModal';
import axios from 'axios';
import { format } from '../../shims/dateFns';
import { API_BASE_URL } from '../../utils/config';
import { getMktPortalRoot } from '../../utils/portalRoot';

const SkRow = ({ w, h, r }: { w: number | string; h: number; r: number }) => (
    <div style={{ width: w, height: h, borderRadius: r, background: '#e2e8f0', position: 'relative', overflow: 'hidden', display: 'inline-block' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent)', animation: 'sk-shimmer 1.4s ease-in-out infinite', transform: 'translateX(-100%)' }} />
    </div>
);

interface MetaConfig {
    id: string;
    page_name: string;
    page_id: string;
    page_access_token: string;
    avatar_url?: string;
    status: 'active' | 'inactive';
    verify_token?: string;
    mode: 'live' | 'dev';
    token_expires_at?: number;
}

interface PageOption {
    page_id: string;
    page_name: string;
    page_access_token: string;
    avatar_url: string;
    token_expires_at: number;
}

const MetaConfig: React.FC = () => {
    const [configs, setConfigs] = useState<MetaConfig[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [isFetchingPages, setIsFetchingPages] = useState(false);

    // Form State
    const [userToken, setUserToken] = useState('');
    const [appId, setAppId] = useState('');
    const [appSecret, setAppSecret] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [availablePages, setAvailablePages] = useState<PageOption[]>([]);
    const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);

    // Debug Modal State
    const [debugModal, setDebugModal] = useState<{
        isOpen: boolean;
        pageName: string;
        data: any;
        isLoading: boolean;
    }>({
        isOpen: false,
        pageName: '',
        data: null,
        isLoading: false
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
        fetchConfigs();
    }, []);

    const fetchConfigs = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/meta_config.php`);
            if (res.data.success) {
                setConfigs(res.data.data);
            }
        } catch {
            toast.error('Lỗi khi tải danh sách Page');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFetchPages = async () => {
        if (!userToken.trim()) {
            toast.error('Vui lòng nhập User Access Token');
            return;
        }

        setIsFetchingPages(true);
        const toastId = toast.loading('Đang lấy danh sách Pages...');

        try {
            const res = await axios.post(`${API_BASE_URL}/meta_config.php?route=get-pages`, {
                user_access_token: userToken,
                app_id: appId,
                app_secret: appSecret
            });

            if (res.data.success && res.data.data.length > 0) {
                setAvailablePages(res.data.data);
                toast.success(`Tìm thấy ${res.data.data.length} Page(s)`, { id: toastId });
            } else {
                toast.error(res.data.message || 'Không tìm thấy Page nào', { id: toastId });
            }
        } catch {
            toast.error('Lỗi khi gọi API', { id: toastId });
        } finally {
            setIsFetchingPages(false);
        }
    };

    const handleSavePages = async () => {
        if (selectedPageIds.length === 0) {
            toast.error('Vui lòng chọn ít nhất một Page');
            return;
        }

        const toastId = toast.loading(`Đang lưu ${selectedPageIds.length} pages...`);
        let successCount = 0;

        for (const pageId of selectedPageIds) {
            const page = availablePages.find(p => p.page_id === pageId);
            if (!page) continue;

            try {
                const saveRes = await axios.post(`${API_BASE_URL}/meta_config.php?route=save`, {
                    page_id: page.page_id,
                    page_name: page.page_name,
                    avatar_url: page.avatar_url,
                    page_access_token: page.page_access_token,
                    app_id: appId,
                    app_secret: appSecret,
                    status: 'active',
                    mode: 'live',
                    token_expires_at: page.token_expires_at
                });

                if (saveRes.data.success) {
                    successCount++;
                }
            } catch (error) {
                console.error(`Failed to save page ${page.page_name}`, error);
            }
        }

        if (successCount > 0) {
            toast.success(`Đã thêm ${successCount} Page thành công!`, { id: toastId });
            setIsAdding(false);
            setUserToken('');
            setAppId('');
            setAppSecret('');
            setAvailablePages([]);
            setSelectedPageIds([]);
            fetchConfigs();
        } else {
            toast.error('Lỗi khi lưu các Pages. Vui lòng thử lại.', { id: toastId });
        }
    };

    const handleDeleteClick = (id: string, name: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Ngắt kết nối Page?',
            message: `Bạn có chắc chắn muốn ngắt kết nối "${name}"? Hệ thống sẽ ngừng nhận tin nhắn và các kịch bản tự động trên Page này sẽ bị dừng lại.`,
            variant: 'danger',
            requireConfirmText: 'DISCONNECT',
            onConfirm: () => handleDelete(id)
        });
    };

    const handleDelete = async (id: string) => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
            const res = await axios.delete(`${API_BASE_URL}/meta_config.php?id=${id}`);
            if (res.data.success) {
                toast.success('Đã xóa thành công');
                fetchConfigs();
            } else {
                toast.error('Lỗi khi xóa');
            }
        } catch {
            toast.error('Lỗi kết nối API');
        }
    };

    const handleDebugPage = async (cfg: MetaConfig) => {
        setDebugModal({
            isOpen: true,
            pageName: cfg.page_name,
            data: null,
            isLoading: true
        });

        try {
            const res = await axios.post(`${API_BASE_URL}/meta_config.php?route=debug-token`, {
                page_access_token: cfg.page_access_token
            });

            if (res.data.success) {
                setDebugModal(prev => ({ ...prev, data: res.data.data, isLoading: false }));
            } else {
                toast.error('Không thể lấy thông tin token');
                setDebugModal(prev => ({ ...prev, isLoading: false }));
            }
        } catch {
            toast.error('Lỗi kết nối khi debug');
            setDebugModal(prev => ({ ...prev, isLoading: false }));
        }
    };

    const formatExpiry = (val?: any) => {
        if (!val || val === '0' || val === 0) return 'Vĩnh viễn';

        const strVal = String(val);
        if (strVal.startsWith('0000')) return 'Vĩnh viễn';

        try {
            let dateObj: Date;
            if (strVal.includes('-')) {
                dateObj = new Date(strVal.replace(' ', 'T'));
            } else {
                const timestamp = parseInt(strVal);
                if (isNaN(timestamp)) return 'Không hợp lệ';
                dateObj = new Date(timestamp * 1000);
            }

            if (!dateObj || isNaN(dateObj.getTime())) return 'Không hợp lệ';
            return format(dateObj, 'dd/MM/yyyy HH:mm');
        } catch {
            return 'Lỗi định dạng';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-base font-black text-slate-900">Facebook Pages (Meta Config)</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">Quản lý kết nối Facebook Messenger</p>
                </div>
                <div className="flex gap-3">
                    <Button
                        icon={Plus}
                        onClick={() => {
                            setIsAdding(!isAdding);
                            setUserToken('');
                            setAvailablePages([]);
                            setSelectedPageIds([]);
                        }}
                        size="md"
                        className="bg-[var(--color-primary)] hover:brightness-110 !text-white rounded-[var(--radius-md)] shadow-lg shadow-[var(--color-primary)]/25 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] border-0"
                    >
                        {isAdding ? 'Hủy thêm mới' : 'Kết nối Page mới'}
                    </Button>
                </div>
            </div>

            {/* Add Form */}
            {isAdding && (
                <div className="bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 rounded-[18px] p-6 animate-in slide-in-from-top-4 fade-in duration-300">
                    <h4 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                        <Facebook className="w-5 h-5 text-[var(--color-primary)]" />
                        Kết nối tự động qua User Access Token
                    </h4>

                    <div className="space-y-4 max-w-3xl">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                                Nhập User Access Token
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-[var(--radius-md)] text-sm focus:ring-2 ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] outline-none bg-white"
                                    placeholder="Dán mã Token (EAAU...) từ Graph API Explorer..."
                                    value={userToken}
                                    onChange={e => setUserToken(e.target.value)}
                                />
                                <Button
                                    onClick={handleFetchPages}
                                    isLoading={isFetchingPages}
                                    icon={RefreshCw}
                                    size="md"
                                    className="bg-[var(--color-primary)] !text-white"
                                >
                                    Lấy danh sách Pages
                                </Button>
                            </div>
                        </div>

                        {/* Advanced Options */}
                        <div className="pt-2">
                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="text-xs font-bold text-slate-500 hover:text-[var(--color-primary)] flex items-center gap-1 transition-colors"
                            >
                                <span className={`transform transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>▶</span>
                                {showAdvanced ? 'Ẩn tùy chọn nâng cao' : 'Tùy chọn nâng cao (Dùng App ID / Secret để giữ quyền tốt nhất)'}
                            </button>

                            {showAdvanced && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 p-4 bg-white/50 rounded-[14px] border border-slate-200 animate-in slide-in-from-top-2 duration-200">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">App ID</label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-2.5 border-2 border-slate-100 rounded-[var(--radius-md)] text-sm focus:ring-2 ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none bg-white font-mono"
                                            placeholder="Nhập App ID của bạn..."
                                            value={appId}
                                            onChange={e => setAppId(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 ml-1">App Secret</label>
                                        <input
                                            type="password"
                                            className="w-full px-4 py-2.5 border-2 border-slate-100 rounded-[var(--radius-md)] text-sm focus:ring-2 ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none bg-white font-mono"
                                            placeholder="••••••••••••••••"
                                            value={appSecret}
                                            onChange={e => setAppSecret(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Step 2: Select Page */}
                        {availablePages.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-bold text-slate-600 uppercase">
                                        Bước 2: Chọn Page để kết nối
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setSelectedPageIds(availablePages.map(p => p.page_id))}
                                            className="text-[10px] text-[var(--color-primary)] font-bold hover:underline"
                                        >
                                            Chọn tất cả
                                        </button>
                                        <span className="text-slate-300 text-[10px]">|</span>
                                        <button
                                            onClick={() => setSelectedPageIds([])}
                                            className="text-[10px] text-slate-500 font-bold hover:underline"
                                        >
                                            Bỏ chọn
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {availablePages.map(page => {
                                        const isSelected = selectedPageIds.includes(page.page_id);
                                        return (
                                            <button
                                                key={page.page_id}
                                                onClick={() => {
                                                    if (isSelected) {
                                                        setSelectedPageIds(prev => prev.filter(id => id !== page.page_id));
                                                    } else {
                                                        setSelectedPageIds(prev => [...prev, page.page_id]);
                                                    }
                                                }}
                                                className={`p-4 rounded-[14px] border-2 transition-all text-left relative ${isSelected
                                                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 shadow-md'
                                                    : 'border-slate-200 bg-white hover:border-[var(--color-primary)]/40'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-sm bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] font-bold text-lg uppercase shrink-0">
                                                        {page.page_name ? page.page_name.charAt(0) : 'F'}
                                                        {page.avatar_url && (
                                                            <img
                                                                src={page.avatar_url}
                                                                alt=""
                                                                className="absolute inset-0 w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                                                                }}
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="flex-1">
                                                        <h5 className="font-bold text-slate-800 text-sm">{page.page_name}</h5>
                                                        <p className="text-[10px] text-slate-400 font-mono">ID: {page.page_id}</p>
                                                        {page.token_expires_at && (
                                                            <p className="text-[10px] text-emerald-600 flex items-center gap-1 mt-1">
                                                                <Clock className="w-3 h-3" />
                                                                Hết hạn: {formatExpiry(page.token_expires_at)}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {isSelected && (
                                                        <CheckCircle className="w-5 h-5 text-[var(--color-primary)] shrink-0" />
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Step 3: Save */}
                        {selectedPageIds.length > 0 && (
                            <div className="flex justify-end pt-2">
                                <Button
                                    onClick={handleSavePages}
                                    icon={CheckCircle}
                                    size="md"
                                    className="bg-emerald-600 hover:bg-emerald-700 !text-white"
                                >
                                    Lưu kết nối ({selectedPageIds.length} Page)
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* List Section */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-white border-2 border-slate-100 rounded-[18px] p-5 shadow-sm">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <SkRow w={48} h={48} r={24} />
                                    <div className="space-y-2">
                                        <SkRow w={120} h={14} r={6} />
                                        <SkRow w={80} h={11} r={5} />
                                    </div>
                                </div>
                                <SkRow w={50} h={20} r={10} />
                            </div>
                            <div className="space-y-2 mb-4">
                                <SkRow w="100%" h={48} r={12} />
                            </div>
                            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                <SkRow w="33%" h={32} r={10} />
                                <SkRow w="33%" h={32} r={10} />
                                <SkRow w={32} h={32} r={10} />
                            </div>
                        </div>
                    ))}
                </div>
            ) : configs.length === 0 && !isAdding ? (
                <div className="text-center py-12 bg-slate-50 rounded-[18px] border-2 border-dashed border-slate-200">
                    <Facebook className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">Chưa có Fanpage nào được kết nối</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {configs.map((cfg) => (
                        <div key={cfg.id} className="bg-white border-2 border-slate-100 rounded-[18px] p-5 shadow-sm hover:shadow-lg hover:border-[var(--color-primary)]/30 transition-all group">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] font-bold text-xl uppercase shrink-0">
                                        {cfg.page_name ? cfg.page_name.charAt(0) : 'F'}
                                        {cfg.avatar_url && (
                                            <img
                                                src={cfg.avatar_url}
                                                alt=""
                                                className="absolute inset-0 w-full h-full object-cover"
                                                onError={(e) => {
                                                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                                                }}
                                            />
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 line-clamp-1">{cfg.page_name}</h4>
                                        <p className="text-[10px] text-slate-400 font-mono">ID: {cfg.page_id}</p>
                                    </div>
                                </div>
                                <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${cfg.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                    {cfg.status}
                                </div>
                            </div>

                            <div className="space-y-2 mb-4">
                                <div className="bg-slate-50 rounded-[var(--radius-md)] p-2.5">
                                    <p className="text-[9px] text-slate-400 uppercase font-bold mb-1">Verify Token</p>
                                    <div className="flex items-center justify-between">
                                        <code className="text-[11px] text-slate-600 font-mono truncate max-w-[150px]">{cfg.verify_token}</code>
                                        <button
                                            onClick={() => { navigator.clipboard.writeText(cfg.verify_token || ''); toast.success('Copied!') }}
                                            className="text-[10px] text-[var(--color-primary)] font-bold hover:underline"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                </div>

                                {cfg.token_expires_at && (
                                    <div className="bg-emerald-50 border border-emerald-100 rounded-[var(--radius-md)] p-2.5">
                                        <p className="text-[9px] text-emerald-600 uppercase font-bold mb-1">Ngày hết hạn Token</p>
                                        <div className="flex items-center justify-between">
                                            <div className="text-[10px] text-emerald-800 font-bold">
                                                {formatExpiry(cfg.token_expires_at)}
                                            </div>
                                            <div className="flex items-center gap-1 text-[9px] text-emerald-500 font-medium">
                                                <Clock className="w-3 h-3" /> Auto Update
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                <Button size="sm" variant="secondary" className="flex-1" icon={ShieldCheck} onClick={() => handleDebugPage(cfg)}>Scopes</Button>
                                <Button size="sm" variant="secondary" className="flex-1" icon={RefreshCw} onClick={() => fetchConfigs()}>Refresh</Button>
                                <Button size="sm" variant="danger" icon={Trash2} onClick={() => handleDeleteClick(cfg.id, cfg.page_name)} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                variant={confirmModal.variant}
                requireConfirmText={confirmModal.requireConfirmText}
            />

            {/* Debug Scopes Modal */}
            {debugModal.isOpen && createPortal(
                <div
                    className="fixed inset-0 z-[2147483642] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px] animate-in fade-in duration-200"
                    style={{ zIndex: 2147483642 }}
                    onClick={() => setDebugModal(prev => ({ ...prev, isOpen: false }))}
                >
                    <div
                        className="bg-white rounded-[18px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-[var(--color-primary)] rounded-[14px] !text-white">
                                    <ShieldCheck className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900">Token Scopes & Permissions</h3>
                                    <p className="text-xs text-slate-500 font-bold">{debugModal.pageName}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setDebugModal(prev => ({ ...prev, isOpen: false }))}
                                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                            >
                                <XCircle className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>

                        <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            {debugModal.isLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-4">
                                    <Loader2 className="w-10 h-10 animate-spin text-[var(--color-primary)]" />
                                    <p className="text-sm text-slate-500 font-bold animate-pulse">Đang truy vấn Meta API...</p>
                                </div>
                            ) : debugModal.data ? (
                                <div className="space-y-6">
                                    {/* App Info */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-slate-50 rounded-[14px] border border-slate-100">
                                            <p className="text-[10px] text-slate-400 font-black uppercase mb-1">Facebook App</p>
                                            <p className="font-bold text-slate-800 break-all">{debugModal.data.debug?.application || 'N/A'}</p>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-[14px] border border-slate-100">
                                            <p className="text-[10px] text-slate-400 font-black uppercase mb-1">API Version</p>
                                            <p className="font-bold text-slate-800">{debugModal.data.debug?.version || 'v24.0'}</p>
                                        </div>
                                    </div>

                                    {/* Permissions List */}
                                    <div>
                                        <h4 className="text-xs font-black text-slate-800 uppercase mb-3 flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4 text-[var(--color-primary)]" />
                                            Danh sách Quyền hạn (Permissions & Scopes)
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {(() => {
                                                const permissionMap = new Map();

                                                debugModal.data.permissions?.forEach((p: any) => {
                                                    permissionMap.set(p.permission, {
                                                        name: p.permission,
                                                        status: p.status === 'granted' ? 'active' : 'inactive'
                                                    });
                                                });

                                                debugModal.data.debug?.scopes?.forEach((s: string) => {
                                                    if (!permissionMap.has(s)) {
                                                        permissionMap.set(s, { name: s, status: 'active' });
                                                    }
                                                });

                                                const allPerms = Array.from(permissionMap.values());

                                                if (allPerms.length === 0) {
                                                    return <p className="text-xs text-slate-400 font-bold col-span-2 py-4 text-center bg-slate-50 rounded-[14px] border border-dashed border-slate-200">Không tìm thấy thông tin quyền hạn chi tiết.</p>;
                                                }

                                                return allPerms.map((p: any, i: number) => (
                                                    <div key={i} className={`flex items-center gap-3 p-3 rounded-[14px] border-2 transition-all ${p.status === 'active' ? 'border-emerald-100 bg-emerald-50/50' : 'border-slate-100 bg-slate-50'}`}>
                                                        <div className={`p-1.5 rounded-lg ${p.status === 'active' ? 'bg-emerald-500 !text-white' : 'bg-slate-300 !text-white'}`}>
                                                            <CheckCircle className="w-3.5 h-3.5" />
                                                        </div>
                                                        <div className="flex-1 overflow-hidden">
                                                            <p className="text-[11px] font-black text-slate-800 truncate" title={p.name}>{p.name}</p>
                                                            <p className={`text-[9px] font-bold uppercase ${p.status === 'active' ? 'text-emerald-600' : 'text-slate-400'}`}>{p.status}</p>
                                                        </div>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    </div>

                                    {/* Missing Warning if needed */}
                                    {(() => {
                                        const hasMessaging =
                                            debugModal.data.permissions?.some((p: any) => p.permission === 'pages_messaging' && p.status === 'granted') ||
                                            debugModal.data.debug?.scopes?.includes('pages_messaging');

                                        if (!hasMessaging) {
                                            return (
                                                <div className="p-4 bg-red-50 border-2 border-red-100 rounded-[14px] flex items-start gap-3">
                                                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                                    <div>
                                                        <p className="text-xs font-black text-red-800">Cảnh báo: Thiếu quyền Messaging</p>
                                                        <p className="text-[11px] text-red-600 mt-0.5">Token này chưa có quyền 'pages_messaging'. Bạn sẽ không thể nhận hoặc gửi tin nhắn cho Page này.</p>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return (
                                            <div className="p-4 bg-emerald-50 border-2 border-emerald-100 rounded-[14px] flex items-start gap-3">
                                                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-xs font-black text-emerald-800">Messaging: Sẵn sàng</p>
                                                    <p className="text-[11px] text-emerald-600 mt-0.5">Quyền 'pages_messaging' đã được xác nhận. Bot có thể gửi và nhận tin nhắn.</p>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-slate-500 font-bold">Không có dữ liệu debug.</div>
                            )}
                        </div>

                        <div className="p-6 bg-slate-50 flex justify-end">
                            <Button
                                onClick={() => setDebugModal(prev => ({ ...prev, isOpen: false }))}
                                className="bg-slate-800 !text-white hover:bg-slate-900 border-none px-8"
                            >
                                Đóng
                            </Button>
                        </div>
                    </div>
                </div>,
                getMktPortalRoot()
            )}
        </div>
    );
};

export default MetaConfig;
