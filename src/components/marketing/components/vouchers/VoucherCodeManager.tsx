import React, { useState, useEffect } from 'react';
import { Gift, Zap, Users, CheckCircle, Search, Hash, Plus, RefreshCw, XCircle, Tag, Download } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';
import ConfirmModal from '../common/ConfirmModal';
import { VoucherCampaign, VoucherCode } from '../../types';
import { api } from '../../services/storageAdapter';
import toast from 'react-hot-toast';

interface VoucherCodeManagerProps {
    isOpen: boolean;
    onClose: () => void;
    campaign: VoucherCampaign;
}

const VoucherCodeManager: React.FC<VoucherCodeManagerProps> = ({ isOpen, onClose, campaign }) => {
    const [codes, setCodes] = useState<VoucherCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [generating, setGenerating] = useState(false);
    
    // Manual Redeem State
    const [redeemCodeInput, setRedeemCodeInput] = useState('');
    const [redeeming, setRedeeming] = useState(false);
    
    // Import CSV Mapping State
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [importing, setImporting] = useState(false);

    // Mass Action State
    const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [redeemModalOpen, setRedeemModalOpen] = useState(false);
    
    // Generate Codes State
    const [showGenModal, setShowGenModal] = useState(false);
    const [genAmount, setGenAmount] = useState(50);
    const [targetRewardId, setTargetRewardId] = useState<string>('all');

    const loadCodes = async () => {
        setLoading(true);
        try {
            const res = await api.get<VoucherCode[]>(`voucher_codes?campaign_id=${campaign.id}`);
            if (res.success && res.data) {
                setCodes(res.data);
            } else {
                setCodes([]); 
            }
        } catch (error) {
            console.error(error);
            setCodes([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) loadCodes();
    }, [isOpen, campaign.id]);

    const generateCodes = async (amount: number) => {
        if (campaign.codeType === 'static') {
            toast.error('Chiến dịch này dùng mã tĩnh (1 mã duy nhất), không cần sinh mã con.');
            return;
        }

        if (amount <= 0 || amount > 1000) {
            toast.error('Số lượng mã mỗi lần tạo phải từ 1 đến 1000.');
            return;
        }

        setGenerating(true);
        setShowGenModal(false);
        toast.loading(`Đang khởi tạo ${amount} mã...`, { id: 'gen-codes' });

        try {
            const res = await api.post('voucher_codes', {
                campaign_id: campaign.id,
                count: amount,
                target_reward_id: targetRewardId === 'all' ? null : targetRewardId
            });

            if (res.success) {
                toast.success(`Đã tự động thêm mã thành công!`, { id: 'gen-codes' });
                if (!campaign.stats) campaign.stats = { totalGenerated: 0, totalDistributed: 0, totalRedeemed: 0 };
                campaign.stats.totalGenerated += amount;
                loadCodes();
            } else {
                toast.error((res as any).message || 'Lỗi từ máy chủ', { id: 'gen-codes' });
            }
        } catch (error) {
            toast.error('Lỗi kết nối máy chủ.', { id: 'gen-codes' });
        } finally {
            setGenerating(false);
        }
    };

    const handleManualRedeem = async (e: React.FormEvent) => {
        e.preventDefault();
        const codeToRedeem = redeemCodeInput.trim();
        if (!codeToRedeem) {
            toast.error('Vui lòng nhập mã Voucher.');
            return;
        }

        setRedeeming(true);
        try {
            const res = await api.post('redeem_voucher', {
                code: codeToRedeem,
                campaign_id: campaign.id
            });
            if (res.success) {
                toast.success(res.message || 'Đã gạch mã thành công!');
                setRedeemCodeInput('');
                if (campaign.stats) campaign.stats.totalRedeemed += 1;
                loadCodes();
            } else {
                toast.error(res.message || 'Gạch mã thất bại.');
            }
        } catch (error) {
           toast.error('Lỗi kết nối khi gạch mã.');
        } finally {
            setRedeeming(false);
        }
    };

    const exportToCSV = () => {
        if (codes.length === 0) {
            toast.error('Không có mã nào để xuất!');
            return;
        }

        const headers = ['Mã (Code)', 'Phần Quà', 'Trạng thái', 'Người nhận', 'Ngày gửi', 'Ngày dùng', 'Ngày hết hạn'];
        const rows = codes.map(code => {
            let rewardName = '-';
            if (code.rewardItemId) {
                const r = campaign.rewards?.find(r => r.id === code.rewardItemId);
                if (r) {
                    if (r.giftTitle) rewardName = r.giftTitle;
                    else if (r.discountType === 'percentage') rewardName = `${r.discountValue}%`;
                    else rewardName = `${r.discountValue}đ`;
                }
            }
            return [
                code.code,
                rewardName,
                code.status,
                code.distributedToSubscriberId || '-',
                code.distributedAt ? new Date(code.distributedAt).toLocaleString('vi-VN') : '-',
                code.redeemedAt ? new Date(code.redeemedAt).toLocaleString('vi-VN') : '-',
                code.expiresAt ? new Date(code.expiresAt).toLocaleString('vi-VN') : '-'
            ].map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',');
        });

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `voucher_codes_${campaign.id}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const executeMassDelete = async () => {
        try {
            const response = await fetch(`${api.baseUrl}/voucher_codes.php`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('_mf_token')}` },
                body: JSON.stringify({ ids: selectedCodes })
            });
            if (!response.ok) throw new Error("Delete failed");
            const res = await response.json();
            if (res.success) {
                toast.success('Đã xóa các mã thành công!');
                if (campaign.stats) campaign.stats.totalGenerated -= selectedCodes.length;
                setSelectedCodes([]);
                loadCodes();
                setDeleteModalOpen(false);
            } else {
                toast.error(res.message || 'Lỗi khi xóa');
            }
        } catch (error) {
            toast.error('Lỗi kết nối mạng');
        }
    };

    const executeMassRedeem = async () => {
        try {
            const response = await fetch(`${api.baseUrl}/redeem_voucher.php`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('_mf_token')}` },
                body: JSON.stringify({ ids: selectedCodes })
            });
            if (!response.ok) throw new Error("Redeem failed");
            const res = await response.json();
            if (res.success) {
                toast.success('Gạch mã hàng loạt thành công!');
                if (campaign.stats) campaign.stats.totalRedeemed += selectedCodes.length;
                setSelectedCodes([]);
                loadCodes();
                setRedeemModalOpen(false);
            } else {
                toast.error(res.message || 'Lỗi khi gạch mã');
            }
        } catch (error) {
            toast.error('Lỗi kết nối mạng');
        }
    };

    const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        toast.loading('Đang xử lý tệp CSV...', { id: 'import-csv' });

        const formData = new FormData();
        formData.append('csv_file', file);
        formData.append('campaign_id', campaign.id);

        try {
            // using native fetch because api adapter might not handle FormData directly
            const response = await fetch(`${api.baseUrl}/voucher_import_mapping.php`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('_mf_token')}`
                },
                body: formData
            });
            if (!response.ok) throw new Error("Import failed");
            const res = await response.json();

            if (res.success) {
                toast.success(res.message || 'Import thành công!', { id: 'import-csv' });
                // If there are logs of failures
                if (res.data?.failed > 0) {
                    console.warn("Lỗi import:", res.data.logs);
                    toast.error(`Có ${res.data.failed} dòng lỗi. Ấn F12 để xem chi tiết.`);
                }
                loadCodes();
            } else {
                toast.error(res.message || 'Lỗi Import.', { id: 'import-csv' });
            }
        } catch (error) {
            toast.error('Lỗi kết nối khi import.', { id: 'import-csv' });
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const filteredCodes = codes.filter(c => 
        c.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.distributedToSubscriberId?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Kho mã: ${campaign.name}`}
            size="xl"
            footer={
                <div className="flex justify-end w-full">
                    <Button onClick={onClose} variant="outline">Đóng</Button>
                </div>
            }
        >
            <div className="space-y-6">
                {/* Stats Header */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> Tổng số mã</span>
                        <span className="text-xl font-black text-slate-800">{campaign.codeType === 'static' ? 1 : (campaign.stats?.totalGenerated || 0)}</span>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Đã tồn tại (Available)</span>
                        <span className="text-xl font-black text-blue-700">{campaign.codeType === 'static' ? 1 : (codes || []).filter(c => c.status === 'available').length}</span>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Đã phân phối (Sent)</span>
                        <span className="text-xl font-black text-amber-600">{campaign.stats?.totalDistributed || 0}</span>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> Đã sử dụng (Used)</span>
                        <span className="text-xl font-black text-emerald-600">{campaign.stats?.totalRedeemed || 0}</span>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <Input 
                        placeholder="Tìm theo mã hoặc ID khách hàng..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        icon={Search} 
                        className="w-full sm:w-64"
                    />
                    
                    <div className="flex flex-wrap gap-2">
                        <Button 
                            onClick={exportToCSV}
                            variant="outline"
                            icon={Download}
                            disabled={codes.length === 0}
                        >
                            Xuất CSV
                        </Button>
                        {campaign.codeType === 'dynamic' && (
                            <>
                                <input 
                                    type="file" 
                                    accept=".csv" 
                                    className="hidden" 
                                    ref={fileInputRef} 
                                    onChange={handleImportCSV} 
                                />
                                <Button 
                                    onClick={() => fileInputRef.current?.click()} 
                                    variant="outline"
                                    disabled={importing}
                                >
                                    {importing ? 'Đang Import...' : 'Nhập CSV (Map)'}
                                </Button>
                                <Button 
                                    onClick={() => setShowGenModal(true)} 
                                    disabled={generating} 
                                    icon={generating ? RefreshCw : Plus}
                                    className={generating ? 'animate-pulse bg-emerald-500' : 'bg-emerald-500 hover:bg-emerald-600 border-0'}
                                >
                                    {generating ? 'Đang tạo...' : 'Tạo thêm mã'}
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {selectedCodes.length > 0 && (
                    <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl flex items-center justify-between animate-in slide-in-from-top-2">
                        <div className="text-sm font-semibold text-indigo-800">
                            Đã chọn <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-md mx-1">{selectedCodes.length}</span> mã
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setRedeemModalOpen(true)} className="bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-200">
                                Gạch Mã Hàng Loạt
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setDeleteModalOpen(true)} className="bg-white hover:bg-rose-50 text-rose-700 border-rose-200">
                                Xóa Mục Đã Chọn
                            </Button>
                        </div>
                    </div>
                )}

                <form onSubmit={handleManualRedeem} className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <Input
                        placeholder="Nhập thủ công mã cần sử dụng (Ví dụ: ABC-123)"
                        value={redeemCodeInput}
                        onChange={(e) => setRedeemCodeInput(e.target.value)}
                        className="flex-1 bg-white"
                        icon={Tag}
                    />
                    <Button 
                        type="submit" 
                        disabled={redeeming || !redeemCodeInput.trim()} 
                        className="bg-indigo-600 hover:bg-indigo-700 whitespace-nowrap"
                    >
                        {redeeming ? 'Đang xử lý...' : 'Gạch Mã'}
                    </Button>
                </form>

                {loading ? (
                    <div className="py-20 text-center text-slate-400">Đang tải danh sách mã...</div>
                ) : campaign.codeType === 'static' ? (
                    <div className="bg-white border rounded-2xl p-8 text-center space-y-4">
                        <div className="mx-auto w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-600">
                            <Tag className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">Chiến dịch dùng mã cố định (Static)</h3>
                            <p className="text-sm text-slate-500 mt-1">Mã dùng chung cho mọi khách hàng nhận email.</p>
                        </div>
                        <div className="inline-block px-6 py-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl">
                            <span className="text-2xl font-black tracking-widest text-slate-800">{campaign.staticCode}</span>
                        </div>
                    </div>
                ) : filteredCodes.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-100 border-dashed rounded-2xl p-12 text-center text-slate-500 space-y-3">
                        <Gift className="w-10 h-10 mx-auto text-slate-300" />
                        <p className="font-medium text-sm">Chưa có mã ngẫu nhiên nào.<br/>Nhấn nút Generate để bổ sung kho.</p>
                    </div>
                ) : (
                    <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                        <div className="max-h-[350px] overflow-y-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-3 w-10 text-center">
                                            <input 
                                                type="checkbox" 
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedCodes(filteredCodes.map(c => c.id));
                                                    else setSelectedCodes([]);
                                                }} 
                                                checked={filteredCodes.length > 0 && selectedCodes.length === filteredCodes.length} 
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                                            />
                                        </th>
                                        <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-slate-500">Mã (Code)</th>
                                        <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-slate-500">Phần Quà</th>
                                        <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-slate-500">Trạng thái</th>
                                        <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-slate-500">Nguồn nhận</th>
                                        <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-slate-500">Người nhận</th>
                                        <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-slate-500">Ngày gửi</th>
                                        <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-slate-500">Hạn dùng</th>
                                        <th className="px-4 py-3 font-black text-[10px] uppercase tracking-widest text-slate-500">Ngày dùng</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 bg-white">
                                    {filteredCodes.map((code) => {
                                        const statusColors = {
                                            available: 'bg-blue-50 text-blue-600',
                                            distributed: 'bg-amber-50 text-amber-600',
                                            used: 'bg-emerald-50 text-emerald-600',
                                            expired: 'bg-rose-50 text-rose-600'
                                        };
                                        return (
                                            <tr key={code.id} className={`hover:bg-slate-50/50 transition-colors ${selectedCodes.includes(code.id) ? 'bg-indigo-50/30' : ''}`}>
                                                <td className="px-4 py-3 w-10 text-center">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedCodes.includes(code.id)} 
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedCodes(prev => [...prev, code.id]);
                                                            else setSelectedCodes(prev => prev.filter(id => id !== code.id));
                                                        }} 
                                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                                                    />
                                                </td>
                                                <td className="px-4 py-3 font-mono font-bold text-slate-700">{code.code}</td>
                                                <td className="px-4 py-3">
                                                    {code.rewardItemId ? (
                                                        <span className="text-xs font-bold text-amber-600">
                                                            {campaign.rewards?.find(r => r.id === code.rewardItemId)?.giftTitle || 
                                                             (campaign.rewards?.find(r => r.id === code.rewardItemId)?.discountType === 'percentage' 
                                                                 ? `${campaign.rewards?.find(r => r.id === code.rewardItemId)?.discountValue}%` 
                                                                 : `${campaign.rewards?.find(r => r.id === code.rewardItemId)?.discountValue?.toLocaleString() || 0}đ`)}
                                                        </span>
                                                    ) : <span className="text-slate-300">-</span>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest ${statusColors[code.status as keyof typeof statusColors] || 'bg-slate-100 text-slate-600'}`}>
                                                        {code.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-xs">
                                                    {code.claimedSource === 'survey' ? (
                                                        <span className="flex items-center gap-1 text-purple-600 font-semibold bg-purple-50 px-1.5 py-0.5 rounded w-fit" title={`Survey ID: ${code.claimedSourceId}`}>
                                                            Survey
                                                        </span>
                                                    ) : code.claimedSource ? (
                                                        <span className="text-slate-500 capitalize">{code.claimedSource}</span>
                                                    ) : <span className="text-slate-300">-</span>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {code.distributedToSubscriberId ? (
                                                        <span className="text-xs font-medium text-slate-700 max-w-[150px] truncate block" title={code.distributedToSubscriberId}>
                                                            {code.distributedToSubscriberId}
                                                        </span>
                                                    ) : <span className="text-slate-300">-</span>}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-slate-500 cursor-help" title={code.distributedAt ? new Date(code.distributedAt).toLocaleString('vi-VN') : ''}>{code.distributedAt ? new Date(code.distributedAt).toLocaleDateString('vi-VN') : '-'}</td>
                                                <td className="px-4 py-3 text-xs">
                                                    {code.expiresAt ? (
                                                        <span className={new Date(code.expiresAt) < new Date() ? 'text-rose-600 font-bold' : 'text-slate-500'} title={new Date(code.expiresAt).toLocaleString('vi-VN')}>
                                                            {new Date(code.expiresAt).toLocaleDateString('vi-VN')}
                                                        </span>
                                                    ) : <span className="text-slate-300">-</span>}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-slate-500 cursor-help" title={code.redeemedAt ? new Date(code.redeemedAt).toLocaleString('vi-VN') : ''}>{code.redeemedAt ? new Date(code.redeemedAt).toLocaleDateString('vi-VN') : '-'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <Modal 
                isOpen={showGenModal} 
                onClose={() => setShowGenModal(false)}
                title="Tạo mã ngẫu nhiên"
                size="sm"
                footer={
                    <div className="flex justify-between w-full">
                        <Button variant="outline" onClick={() => setShowGenModal(false)}>Hủy</Button>
                        <Button 
                            variant="primary" 
                            onClick={() => generateCodes(genAmount)}
                            disabled={genAmount <= 0 || genAmount > 1000}
                        >
                            Xác nhận Tạo
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <Input 
                        type="number"
                        label="Số lượng mã cần tạo"
                        value={genAmount.toString()}
                        onChange={e => setGenAmount(parseInt(e.target.value) || 0)}
                        min={1}
                        max={1000}
                        placeholder="Tối đa 1000 mã/lần"
                    />

                    {campaign.rewards && campaign.rewards.length > 1 && (
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Phân bổ quà tặng</label>
                            <Select 
                                value={targetRewardId}
                                onChange={setTargetRewardId}
                                options={[
                                    { value: 'all', label: 'Tự động (Ngẫu nhiên / Khuyên dùng)' },
                                    ...campaign.rewards.map(r => ({
                                        value: r.id,
                                        label: `Chỉ định 100% vào: ${r.discountType === 'percentage' ? `Giảm ${r.discountValue}%` : r.discountType === 'fixed_amount' ? `Giảm ${r.discountValue?.toLocaleString()}đ` : r.giftTitle}`
                                    }))
                                ]}
                            />
                            <p className="text-[10px] text-slate-400">Chọn "Tự động" nếu bạn muốn hệ thống rải mã ngẫu nhiên cho tất cả các phần quà.</p>
                        </div>
                    )}

                    <p className="text-xs text-slate-500">Do giới hạn hệ thống, mỗi lần bạn chỉ được tạo tối đa 1000 mã. Nếu bạn cần nhiều hơn, vui lòng chia làm nhiều lần tạo.</p>
                </div>
            </Modal>

            <ConfirmModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                title="Xác nhận xóa hàng loạt"
                message={`Bạn có chắc chắn muốn xóa ${selectedCodes.length} mã voucher đã chọn? Hành động này không thể hoàn tác.`}
                confirmLabel="Xóa ngay"
                variant="danger"
                onConfirm={executeMassDelete}
            />

            <ConfirmModal
                isOpen={redeemModalOpen}
                onClose={() => setRedeemModalOpen(false)}
                title="Xác nhận Gạch mã hàng loạt"
                message={`Bạn có chắc chắn muốn Gạch (đánh dấu đã sử dụng) ${selectedCodes.length} mã voucher đã chọn?`}
                confirmLabel="Xác nhận"
                variant="warning"
                onConfirm={executeMassRedeem}
            />
        </Modal>
    );
};

export default VoucherCodeManager;
