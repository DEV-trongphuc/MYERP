import { EXTERNAL_ASSET_BASE } from '../../utils/config';
import * as React from 'react';
import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { getMktPortalRoot } from '../../utils/portalRoot';
import { api } from '../../services/storageAdapter';
import {
    Send, Plus, Calendar, Image as ImageIcon,
    Eye, MessageCircle, CheckCircle,
    RefreshCw, BarChart2, UploadCloud, X, Search, Filter,
    Share2, MousePointer2, Users, MailOpen, MousePointerClick, MessageSquare, Trash2, Info
} from 'lucide-react';
import Button from '../common/Button';
import Badge from '../common/Badge';
import toast from 'react-hot-toast';
import Input from '../common/Input';
import Select from '../common/Select';
import TabTransition from '../common/TabTransition';
import ConfirmModal from '../common/ConfirmModal';
import StatCard from '../common/StatCard';

const ZALO_LOGO = `${EXTERNAL_ASSET_BASE}/imgs/zalolog.png`;

interface ZaloBroadcastTabProps {
    initialSelectedIds?: string[];
    onCloseSelection?: () => void;
}

const ZaloBroadcastTab: React.FC<ZaloBroadcastTabProps> = ({ initialSelectedIds, onCloseSelection }) => {
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [oaList, setOaList] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Modals
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedCampaign, setSelectedCampaign] = useState<any | null>(null);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    // Create Form State
    const [newCamp, setNewCamp] = useState({
        oa_config_id: '',
        title: '',
        content: '',
        message_type: 'image',
        target_group: initialSelectedIds ? 'specific' : 'all',
        selected_ids: initialSelectedIds || [] as string[],
        buttons: [] as { title: string, url: string }[]
    });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [creating, setCreating] = useState(false);
    const [showSendConfirm, setShowSendConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Detail Modal State
    const [trackFilter, setTrackFilter] = useState<'all' | 'seen' | 'reacted'>('all');
    const [trackSearch, setTrackSearch] = useState('');

    useEffect(() => {
        fetchCampaigns();
        fetchOas();
        if (initialSelectedIds) {
            setIsCreateOpen(true);
        }
    }, [initialSelectedIds]);

    const fetchCampaigns = async () => {
        setLoading(true);
        const res = await api.get<any[]>('zalo_broadcast?route=list');
        if (res.success) setCampaigns(res.data);
        setLoading(false);
    };

    const fetchOas = async () => {
        const resList = await api.get<any[]>('zalo_audience?route=lists');
        if (resList.success) setOaList(resList.data);
    };

    const fetchDetails = async (id: string) => {
        const res = await api.get<any>(`zalo_broadcast?route=details&id=${id}`);
        if (res.success) setSelectedCampaign(res.data);
    };

    const handleCreate = async () => {
        if (!newCamp.oa_config_id) return showToast('Vui lòng chọn OA gửi', 'error');
        if (!newCamp.title) return showToast('Vui lòng nhập tiêu đề chiến dịch', 'error');
        if (!newCamp.content) return showToast('Vui lòng nhập nội dung tin nhắn', 'error');
        if (newCamp.message_type === 'image' && !selectedFile) return showToast('Vui lòng chọn hình ảnh', 'error');
        if (newCamp.target_group === 'specific' && newCamp.selected_ids.length === 0) return showToast('Chưa chọn người nhận cụ thể', 'error');

        setShowSendConfirm(true);
    };

    const confirmCreate = async () => {
        setShowSendConfirm(false);
        setCreating(true);
        try {
            let attachmentId = '';
            let imageUrl = '';

            if (newCamp.message_type === 'image' && selectedFile) {
                const formData = new FormData();
                formData.append('file', selectedFile);
                const list = oaList.find(l => l.oa_config_id === newCamp.oa_config_id);
                if (list) formData.append('list_id', list.id);

                // [SECURITY] Relative URL (no hardcoded domain) + inject auth token for multipart upload
                const _upToken = localStorage.getItem('auth_token') || '';
                const upRes = await fetch('/mail_api/zalo_audience.php?route=upload_image', {
                    method: 'POST',
                    headers: _upToken ? { 'Authorization': `Bearer ${_upToken}` } : {},
                    body: formData
                }).then(r => { if (!r.ok) throw new Error("Upload failed"); return r.json(); });

                if (upRes.success) {
                    attachmentId = upRes.attachment_id;
                    imageUrl = upRes.image_url;
                } else throw new Error(upRes.message || 'Upload ảnh thất bại');
            }

            const res = await api.post('zalo_broadcast?route=create', {
                ...newCamp,
                attachment_id: attachmentId,
                image_url: imageUrl
            });

            if (res.success) {
                showToast('Chiến dịch đã được gửi!', 'success');
                setIsCreateOpen(false);
                fetchCampaigns();
                resetForm();
                if (onCloseSelection) onCloseSelection();
            } else {
                showToast(res.message, 'error');
            }
        } catch (error: any) {
            showToast(error.message, 'error');
        }
        setCreating(false);
    };

    const handleDelete = async (id: string) => {
        setIsDeleting(true);
        try {
            const res = await api.delete(`zalo_broadcast?route=delete&id=${id}`);
            if (res.success) {
                showToast('Đã xóa chiến dịch thành công', 'success');
                fetchCampaigns();
                setDeleteTargetId(null);
                if (selectedCampaign && selectedCampaign.id === id) {
                    setSelectedCampaign(null);
                }
            } else {
                showToast(res.message || 'Xóa thất bại', 'error');
            }
        } catch (e: any) {
            showToast(e.message || 'Lỗi kết nối', 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    const resetForm = () => {
        setNewCamp({
            oa_config_id: '',
            title: '',
            content: '',
            message_type: 'image',
            target_group: 'all',
            selected_ids: [],
            buttons: []
        });
        setSelectedFile(null);
    };

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        if (type === 'success') toast.success(message);
        else if (type === 'error') toast.error(message);
        else toast(message);
    };

    const handleAddButton = () => {
        if (newCamp.buttons.length >= 3) return;
        setNewCamp({ ...newCamp, buttons: [...newCamp.buttons, { title: '', url: '' }] });
    };

    const filteredCampaigns = useMemo(() => {
        if (!searchTerm) return campaigns;
        const lowSearch = searchTerm.toLowerCase();
        return campaigns.filter(c => {
            const matchesTitle = (c.title || '').toLowerCase().includes(lowSearch);
            // Support searching by date format dd/mm/yyyy
            const dateStr = new Date(c.created_at).toLocaleDateString('vi-VN'); // dd/mm/yyyy
            const matchesDate = dateStr.includes(searchTerm);
            return matchesTitle || matchesDate;
        });
    }, [campaigns, searchTerm]);

    const globalStats = useMemo(() => {
        const sent = campaigns.reduce((acc, c) => acc + (c.stats_sent || 0), 0);
        const delivered = campaigns.reduce((acc, c) => acc + (c.stats_delivered || c.stats_sent || 0), 0);
        const seen = campaigns.reduce((acc, c) => acc + (c.stats_seen || 0), 0);
        const reacted = campaigns.reduce((acc, c) => acc + (c.stats_reacted || 0), 0);
        const openRate = delivered > 0 ? ((seen / delivered) * 100).toFixed(1) : 0;
        return { sent, delivered, seen, reacted, openRate };
    }, [campaigns]);

    const filteredTracking = useMemo(() => {
        if (!selectedCampaign?.tracking_sample) return [];
        return selectedCampaign.tracking_sample.filter((t: any) => {
            const matchesFilter = trackFilter === 'all' || t.status === trackFilter;
            const matchesSearch = !trackSearch ||
                (t.display_name || '').toLowerCase().includes(trackSearch.toLowerCase()) ||
                t.zalo_user_id.toLowerCase().includes(trackSearch.toLowerCase());
            return matchesFilter && matchesSearch;
        });
    }, [selectedCampaign, trackFilter, trackSearch]);

    return (
        <TabTransition className="space-y-8">
            {/* Beautiful Hero Section with Stats (Matching Email Campaigns) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <HeroStatCard 
                    label="Tin nhắn đã gửi" 
                    value={globalStats.sent} 
                    icon={Send} 
                    color="#C6333D" 
                    decor={
                        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                            <path d="M10 50 Q 50 10 90 50 T 90 90" stroke="currentColor" strokeWidth="2" stroke-dasharray="3 3" />
                            <circle cx="10" cy="50" r="6" fill="currentColor" />
                            <circle cx="50" cy="10" r="6" fill="currentColor" />
                            <circle cx="90" cy="50" r="6" fill="currentColor" />
                            <path d="M50 10 L 90 50" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                    }
                />
                <HeroStatCard 
                    label="Tỷ lệ xem (Read)" 
                    value={`${globalStats.openRate}%`} 
                    icon={MailOpen} 
                    color="#0f172a" 
                    decor={
                        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                            <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" stroke-dasharray="4 4" />
                            <circle cx="35" cy="45" r="15" fill="currentColor" fillOpacity="0.2" />
                            <circle cx="65" cy="45" r="15" fill="currentColor" fillOpacity="0.4" />
                            <circle cx="50" cy="70" r="18" fill="currentColor" fillOpacity="0.6" />
                        </svg>
                    }
                />
                <HeroStatCard 
                    label="Phản hồi / Chat" 
                    value={globalStats.reacted} 
                    icon={MessageCircle} 
                    color="#334155" 
                    decor={
                        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                            <rect x="20" y="20" width="60" height="15" rx="7.5" fill="currentColor" fillOpacity="0.6" />
                            <rect x="20" y="42" width="60" height="15" rx="7.5" fill="currentColor" fillOpacity="0.4" />
                            <rect x="20" y="64" width="60" height="15" rx="7.5" fill="currentColor" fillOpacity="0.2" />
                        </svg>
                    }
                />
                <HeroStatCard 
                    label="Thiết bị nhận" 
                    value={globalStats.delivered} 
                    icon={CheckCircle} 
                    color="#64748b" 
                    decor={
                        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                            <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="2" />
                            <path d="M50 35 V 65 M35 50 H 65" stroke="currentColor" strokeWidth="3" stroke-linecap="round" />
                        </svg>
                    }
                />
            </div>

            {/* Campaign Management Header (Compact) */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-2 border-b border-slate-50">
                <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Danh sách chiến dịch</h3>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative">
                        <Input
                            placeholder="Tìm theo tên hoặc ngày..."
                            className="w-48"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            icon={Search}
                            customSize="sm"
                        />
                    </div>
                    <Button
                        variant="primary"
                        icon={Plus}
                        onClick={() => setIsCreateOpen(true)}
                        className="rounded-lg shadow-lg shadow-blue-500/10 text-[10px] py-1 px-3"
                    >
                        Chiến dịch mới
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                    <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="text-slate-400 text-xs font-medium">Đang tải...</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredCampaigns.map(camp => (
                        <div
                            key={camp.id}
                            onClick={() => fetchDetails(camp.id)}
                            className="bg-white p-4 rounded-[18px] border border-slate-100 flex items-center gap-6 hover:shadow-xl hover:border-blue-100 transition-all cursor-pointer group relative overflow-hidden"
                        >
                            <div className="w-24 h-24 bg-slate-50 rounded-[14px] overflow-hidden flex-shrink-0 relative border border-slate-50 shadow-inner">
                                {camp.image_url ? (
                                    <img src={camp.image_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-200">
                                        <ImageIcon className="w-10 h-10" />
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-black text-slate-800 text-sm truncate uppercase tracking-tight">{camp.title}</h3>
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${camp.status === 'sent' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-[var(--color-primary)]'}`}>
                                        {camp.status}
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-400 truncate mb-3 font-medium">{camp.content}</p>

                                <div className="flex items-center gap-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                    <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-md"><Calendar className="w-3 h-3 text-slate-300" /> {new Date(camp.created_at).toLocaleDateString('vi-VN')}</span>
                                    <span className="text-blue-500">
                                        {(() => {
                                            if (camp.target_group === 'all') return 'Tất cả';
                                            if (camp.target_group === 'follower') return 'Người quan tâm';
                                            if (camp.target_group === 'interacted') return 'Tương tác';
                                            if (camp.target_group === 'specific') {
                                                let filter = camp.target_filter;
                                                if (typeof filter === 'string') {
                                                    try { filter = JSON.parse(filter); } catch (e) { filter = []; }
                                                }
                                                return `${(filter || []).length} Người chọn`;
                                            }
                                            return 'Tương tác';
                                        })()}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-6 px-6 border-l border-slate-50">
                                <ListStatItem label="Gửi" value={camp.stats_sent} icon={Send} />
                                <ListStatItem label="Nhận" value={camp.stats_delivered || camp.stats_sent} icon={CheckCircle} />
                                <ListStatItem label="Xem" value={camp.stats_seen} icon={MailOpen} />
                                <ListStatItem label="Chat" value={camp.stats_reacted} icon={MessageCircle} />
                            </div>

                            <div className="flex items-center gap-2 pr-4">
                                <div className="p-3 text-slate-200 group-hover:text-blue-500 transition-colors">
                                    <BarChart2 className="w-6 h-6" />
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteTargetId(camp.id);
                                    }}
                                    className="p-3 text-slate-200 hover:text-rose-500 transition-colors"
                                    title="Xóa chiến dịch"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {filteredCampaigns.length === 0 && (
                        <div className="py-20 text-center bg-slate-50/50 rounded-[18px] border-2 border-dashed border-slate-100">
                            <Share2 className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                            <p className="text-slate-400 text-xs font-black uppercase tracking-widest italic">Không có chiến dịch nào</p>
                        </div>
                    )}
                </div>
            )}

            {/* CREATE MODAL */}
            {isCreateOpen && createPortal(
                <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-[2147483642] flex items-center justify-center p-4 animate-in fade-in duration-300" style={{ zIndex: 2147483642 }}>
                    <div className="bg-white rounded-[18px] w-full max-w-4xl max-h-[95vh] overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-600 rounded-[14px] shadow-xl shadow-blue-500/20 flex items-center justify-center">
                                    <Send className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Tạo Chiến Dịch Mới</h3>
                                    <p className="text-xs font-medium text-slate-400">Thiết lập nội dung và đối tượng nhận tin</p>
                                </div>
                            </div>
                            <button onClick={() => setIsCreateOpen(false)} className="p-3 hover:bg-white rounded-full transition-colors text-slate-400 shadow-sm"><X className="w-6 h-6" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 bg-white cursor-default">
                            <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
                                <div className="lg:col-span-3 space-y-8">
                                    <div className="bg-red-50/50 border border-red-100 p-4 rounded-[14px] flex gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
                                        <div className="w-8 h-8 bg-white rounded-[var(--radius-md)] shadow-sm flex items-center justify-center text-[#2563eb] shrink-0 border border-red-50">
                                            <Info className="w-4 h-4" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Lưu ý chính sách Zalo</p>
                                            <p className="text-[11px] text-[var(--color-primary)] font-bold leading-relaxed">Tin nhắn chỉ được gửi tới người dùng đã tương tác với OA trong vòng 7 ngày gần nhất. Hệ thống sẽ tự động lọc danh sách này.</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Select
                                                label="Gửi từ OA"
                                                value={newCamp.oa_config_id}
                                                onChange={val => setNewCamp({ ...newCamp, oa_config_id: val })}
                                                options={[
                                                    { value: '', label: '-- Chọn Zalo OA --' },
                                                    ...oaList.map(oa => ({ value: oa.oa_config_id, label: oa.name }))
                                                ]}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Select
                                                label="Nhóm Khách hàng"
                                                value={newCamp.target_group}
                                                onChange={val => setNewCamp({ ...newCamp, target_group: val })}
                                                disabled={!!initialSelectedIds}
                                                options={[
                                                    { value: 'all', label: 'Tất cả mọi người' },
                                                    { value: 'follower', label: 'Chỉ người quan tâm' },
                                                    { value: 'interacted', label: 'Tương tác' },
                                                    ...(newCamp.target_group === 'specific' ? [{ value: 'specific', label: `Đã chọn ${newCamp.selected_ids.length} người` }] : [])
                                                ]}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Input
                                            label="Tên chiến dịch (Tiêu đề đậm)"
                                            placeholder="Ví dụ: ƯU ĐÃI NĂM MỚI 2026 🧨"
                                            value={newCamp.title}
                                            onChange={e => setNewCamp({ ...newCamp, title: e.target.value })}
                                            className="font-black"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Input
                                            label="Nội dung chi tiết"
                                            placeholder="Nhập nội dung tin nhắn của bạn tại đây..."
                                            value={newCamp.content}
                                            onChange={e => setNewCamp({ ...newCamp, content: e.target.value })}
                                            multiline
                                            rows={4}
                                        />
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center px-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nút bấm (Tối đa 3)</label>
                                            <button onClick={handleAddButton} className="text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-full transition-all hover:bg-blue-100">
                                                <Plus className="w-3.5 h-3.5" /> Thêm nút
                                            </button>
                                        </div>
                                        <div className="space-y-3">
                                            {newCamp.buttons.map((btn, i) => (
                                                <div key={i} className="flex gap-3 bg-slate-50 p-3 rounded-[14px] border border-slate-100 animate-in slide-in-from-left-2 duration-300">
                                                    <Input className="flex-1" placeholder="Tên nút" value={btn.title} onChange={e => {
                                                        const btns = [...newCamp.buttons]; btns[i].title = e.target.value; setNewCamp({ ...newCamp, buttons: btns });
                                                    }} />
                                                    <Input className="flex-[2]" placeholder="https://..." value={btn.url} onChange={e => {
                                                        const btns = [...newCamp.buttons]; btns[i].url = e.target.value; setNewCamp({ ...newCamp, buttons: btns });
                                                    }} />
                                                    <button onClick={() => {
                                                        const btns = newCamp.buttons.filter((_, idx) => idx !== i); setNewCamp({ ...newCamp, buttons: btns });
                                                    }} className="p-2.5 text-slate-300 hover:text-rose-500 transition-colors"><X className="w-5 h-5" /></button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="lg:col-span-2 space-y-10">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Hình ảnh đính kèm</label>
                                        <div className="relative aspect-video rounded-[18px] border-2 border-dashed border-slate-100 hover:bg-blue-50 transition-all flex flex-col items-center justify-center overflow-hidden bg-slate-50 group">
                                            {selectedFile ? (
                                                <>
                                                    <img src={URL.createObjectURL(selectedFile)} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }} className="p-3 bg-white rounded-full shadow-xl text-rose-500 hover:scale-110 transition-transform"><X className="w-6 h-6" /></button>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-center space-y-3">
                                                    <div className="w-12 h-12 bg-white rounded-[14px] shadow-sm flex items-center justify-center mx-auto text-slate-300">
                                                        <UploadCloud className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-slate-800">Tải ảnh lên</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kích thước khuyên dùng: 16:9</p>
                                                    </div>
                                                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setSelectedFile(e.target.files ? e.target.files[0] : null)} />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Xem trước tin nhắn</label>
                                        <div className="bg-slate-50 p-2 rounded-[18px] border border-slate-100 shadow-inner">
                                            <div className="bg-white rounded-[14px] shadow-sm overflow-hidden border border-slate-100">
                                                {selectedFile ? <img src={URL.createObjectURL(selectedFile)} className="w-full aspect-[16/9] object-cover" /> : <div className="w-full aspect-[16/9] bg-slate-50 flex items-center justify-center text-slate-200"><ImageIcon className="w-10 h-10" /></div>}
                                                <div className="p-5 space-y-2">
                                                    <p className="text-sm font-black text-slate-800 uppercase line-clamp-1">{newCamp.title || 'Tiêu đề'}</p>
                                                    <p className="text-[11px] text-slate-500 font-medium line-clamp-3 leading-relaxed">{newCamp.content || 'Nội dung tin nhắn...'}</p>
                                                </div>
                                                {newCamp.buttons.length > 0 && (
                                                    <div className="p-4 pt-0 space-y-2">
                                                        {newCamp.buttons.map((btn, i) => (
                                                            <div key={i} className="py-2 text-center text-blue-600 font-black text-xs border-t border-slate-50 uppercase tracking-widest">{btn.title || 'Button'}</div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-4 items-center">
                            <button onClick={() => setIsCreateOpen(false)} className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Hủy bỏ</button>
                            <Button
                                variant="primary"
                                icon={Send}
                                onClick={handleCreate}
                                isLoading={creating}
                                className="text-xs py-3 px-8 shadow-2xl shadow-blue-500/20 rounded-[var(--radius-md)]"
                            >
                                Gửi Chiến Dịch
                            </Button>
                        </div>
                    </div>
                </div>,
                getMktPortalRoot()
            )}

            {/* DETAIL MODAL (DRAWER) */}
            {selectedCampaign && createPortal(
                <div className="fixed inset-0 z-[2147483625] flex justify-end" style={{ zIndex: 2147483625 }}>
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] transition-opacity duration-300" onClick={() => setSelectedCampaign(null)} />

                    <div className="relative bg-white w-full max-w-[900px] h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 rounded-l-[18px] overflow-hidden">
                        <div className="p-5 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                            <div className="flex items-center gap-3">
                                <BarChart2 className="w-5 h-5 text-blue-600" />
                                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest truncate max-w-[400px]">{selectedCampaign.title}</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setDeleteTargetId(selectedCampaign.id)}
                                    className="p-2 hover:bg-rose-50 rounded-full transition-colors text-slate-400 hover:text-rose-500 shadow-sm"
                                    title="Xóa chiến dịch"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                                <button onClick={() => setSelectedCampaign(null)} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 shadow-sm"><X className="w-5 h-5" /></button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-10">
                            <div className="grid grid-cols-4 gap-4">
                                <DetailBox
                                    label="Số lượng gửi"
                                    value={selectedCampaign.stats_sent}
                                    subLabel="Tin nhắn đã bắn"
                                    color="blue"
                                    icon={Send}
                                />
                                <DetailBox
                                    label="Tỷ lệ nhận"
                                    value={selectedCampaign.stats_sent > 0 ? ((selectedCampaign.stats_delivered / selectedCampaign.stats_sent) * 100).toFixed(1) + '%' : '0%'}
                                    subLabel={`${selectedCampaign.stats_delivered}/${selectedCampaign.stats_sent} Thành công`}
                                    color="indigo"
                                    icon={CheckCircle}
                                />
                                <DetailBox
                                    label="Tỷ lệ mở (Read)"
                                    value={selectedCampaign.stats_delivered > 0 ? ((selectedCampaign.stats_seen / selectedCampaign.stats_delivered) * 100).toFixed(1) + '%' : '0%'}
                                    subLabel={`${selectedCampaign.stats_seen} Người xem`}
                                    color="green"
                                    icon={MailOpen}
                                />
                                <DetailBox
                                    label="Tương tác (Chat)"
                                    value={selectedCampaign.stats_delivered > 0 ? ((selectedCampaign.stats_reacted / selectedCampaign.stats_delivered) * 100).toFixed(1) + '%' : '0%'}
                                    subLabel={`${selectedCampaign.stats_reacted} Lượt phản hồi`}
                                    color="orange"
                                    icon={MessageCircle}
                                />
                            </div>

                            {/* MESSAGE PREVIEW */}
                            <div className="space-y-4">
                                <h4 className="font-black text-slate-800 uppercase tracking-widest text-[10px] flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4 text-indigo-500" /> Xem lại nội dung đã gửi
                                </h4>
                                <div className="bg-slate-50 p-1.5 rounded-[18px] border border-slate-100 shadow-inner max-w-[340px] mx-auto">
                                    <div className="bg-white rounded-[14px] shadow-sm overflow-hidden border border-slate-100">
                                        {selectedCampaign.image_url ? (
                                            <img src={selectedCampaign.image_url} className="w-full aspect-[16/9] object-cover" alt="" />
                                        ) : (
                                            <div className="w-full aspect-[16/9] bg-slate-50 flex items-center justify-center text-slate-200">
                                                <ImageIcon className="w-8 h-8" />
                                            </div>
                                        )}
                                        <div className="p-4 space-y-1.5">
                                            <p className="text-xs font-black text-slate-800 uppercase line-clamp-1">{selectedCampaign.title || 'Tiêu đề'}</p>
                                            <p className="text-[10px] text-slate-500 font-medium line-clamp-4 leading-relaxed whitespace-pre-wrap">{selectedCampaign.content || 'Nội dung tin nhắn...'}</p>
                                        </div>
                                        {(() => {
                                            let btns = [];
                                            try {
                                                btns = typeof selectedCampaign.buttons === 'string' ? JSON.parse(selectedCampaign.buttons) : (selectedCampaign.buttons || []);
                                            } catch (e) { btns = []; }

                                            return btns.length > 0 && (
                                                <div className="border-t border-slate-50 divide-y divide-slate-50">
                                                    {btns.map((btn: any, i: number) => (
                                                        <a key={i} href={btn.url} target="_blank" rel="noreferrer" className="block w-full py-2.5 text-center text-[10px] font-black text-blue-600 uppercase tracking-widest hover:bg-slate-50 transition-colors">
                                                            {btn.title}
                                                        </a>
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-black text-slate-800 uppercase tracking-widest text-[10px] flex items-center gap-2">
                                        <Users className="w-4 h-4 text-blue-500" /> Danh sách người nhận (100 gần nhất)
                                    </h4>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Tìm..."
                                            className="w-32"
                                            value={trackSearch}
                                            onChange={e => setTrackSearch(e.target.value)}
                                            icon={Search}
                                            customSize="sm"
                                        />
                                        <Select
                                            value={trackFilter}
                                            onChange={val => setTrackFilter(val as any)}
                                            options={[
                                                { value: 'all', label: 'Tất cả' },
                                                { value: 'seen', label: 'Đã xem' },
                                                { value: 'reacted', label: 'Tương tác' }
                                            ]}
                                            size="sm"
                                        />
                                    </div>
                                </div>

                                <div className="border border-slate-50 rounded-[18px] overflow-hidden shadow-sm">
                                    <table className="w-full text-[12px]">
                                        <thead className="bg-slate-50/50 text-slate-400 font-black text-[9px] uppercase tracking-widest text-left">
                                            <tr>
                                                <th className="p-4">Khách hàng</th>
                                                <th className="p-4 text-center">Trạng thái</th>
                                                <th className="p-4 text-right">Thời gian</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {filteredTracking.map((track: any) => (
                                                <tr key={track.id} className="hover:bg-slate-50/10 transition-colors group">
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-[14px] overflow-hidden border border-slate-100 flex-shrink-0 shadow-sm">
                                                                {track.avatar ? (
                                                                    <img src={track.avatar} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-300">
                                                                        <Users className="w-5 h-5" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className="font-bold text-slate-800 text-[11px] tracking-tight">{track.display_name || "Zalo User"}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${track.status === 'seen' ? 'bg-emerald-50 text-emerald-600' : track.status === 'reacted' ? 'bg-red-50 text-[var(--color-primary)]' : 'bg-blue-50 text-blue-600'}`}>
                                                            {track.status === 'seen' ? 'Xem' : track.status === 'reacted' ? 'Chat' : 'Gửi'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[10px] font-black text-slate-700">{track.seen_at ? new Date(track.seen_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : new Date(track.sent_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                            <span className="text-[8px] text-slate-300 font-bold uppercase">{track.sent_at ? new Date(track.sent_at).toLocaleDateString('vi-VN') : ''}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredTracking.length === 0 && (
                                                <tr>
                                                    <td colSpan={3} className="p-20 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Không có dữ liệu</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                getMktPortalRoot()
            )}



            {/* DELETE CONFIRMATION MODAL */}
            <ConfirmModal
                isOpen={!!deleteTargetId}
                onClose={() => setDeleteTargetId(null)}
                onConfirm={() => deleteTargetId && handleDelete(deleteTargetId)}
                title="Xóa chiến dịch?"
                message="Hành động này sẽ xóa vĩnh viễn dữ liệu chiến dịch và lịch sử theo dõi. Bạn chắc chắn chứ?"
                confirmLabel="Xác nhận xóa"
                variant="danger"
                isLoading={isDeleting}
            />

            {/* SEND CONFIRMATION MODAL */}
            <ConfirmModal
                isOpen={showSendConfirm}
                onClose={() => setShowSendConfirm(false)}
                onConfirm={confirmCreate}
                title="Gửi chiến dịch Zalo?"
                message="Chiến dịch của bạn sẽ được gửi ngay lập tức đến đối tượng đã chọn. Bạn có chắc chắn muốn thực hiện hành động này?"
                confirmLabel="Xác nhận gửi"
                variant="warning"
                isLoading={creating}
            />
        </TabTransition>
    );
};

// Sub-components
const HeroStatCard = ({ label, value, icon: Icon, color, decor }: any) => {
    return (
        <StatCard
            title={label}
            value={typeof value === 'number' ? value.toLocaleString('vi-VN') : value}
            icon={<Icon />}
            color={color}
            decor={decor}
            breakdown="Chiến dịch Zalo Broadcast"
        />
    );
};

const ListStatItem = ({ label, value, icon: Icon }: any) => (
    <div className="flex flex-col items-center">
        <div className="flex items-center gap-1.5 mb-1">
            <Icon className="w-3 h-3 text-slate-300" />
            <span className="text-[13px] font-black text-slate-800 tracking-tighter">{value.toLocaleString()}</span>
        </div>
        <span className="text-[8px] text-slate-400 uppercase font-black tracking-widest">{label}</span>
    </div>
);

const DetailBox = ({ label, value, subLabel, color, icon: Icon }: any) => {
    const themes: any = {
        blue: {
            bg: 'bg-white',
            text: 'text-slate-800',
            label: 'text-slate-400',
            iconColor: 'text-white',
            iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/20'
        },
        indigo: {
            bg: 'bg-white',
            text: 'text-slate-800',
            label: 'text-slate-400',
            iconColor: 'text-white',
            iconBg: 'bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-indigo-500/20'
        },
        green: {
            bg: 'bg-white',
            text: 'text-slate-800',
            label: 'text-slate-400',
            iconColor: 'text-white',
            iconBg: 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/20'
        },
        orange: {
            bg: 'bg-white',
            text: 'text-slate-800',
            label: 'text-slate-400',
            iconColor: 'text-white',
            iconBg: 'bg-[var(--color-primary)] shadow-[var(--color-primary)]/20'
        }
    };

    const theme = themes[color] || themes.blue;

    return (
        <div className={`p-5 rounded-[18px] border border-slate-100 shadow-sm flex items-center justify-between bg-white hover:shadow-md transition-all duration-300 group`}>
            <div className="flex-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                <h4 className="text-2xl font-black text-slate-800 tracking-tight">{value}</h4>
                {subLabel && <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tight">{subLabel}</p>}
            </div>
            <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center ${theme.iconBg} ${theme.iconColor} shadow-lg shrink-0 transition-transform group-hover:scale-110`}>
                <Icon className="w-6 h-6" />
            </div>
        </div>
    );
};

export default ZaloBroadcastTab;
