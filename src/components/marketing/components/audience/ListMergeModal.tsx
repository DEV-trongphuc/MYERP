import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { X, GitMerge, AlertTriangle, List, Plus, Trash2, Loader2 } from 'lucide-react';
import Select from '../common/Select';
import Input from '../common/Input';
import toast from 'react-hot-toast';
import { api } from '../../services/storageAdapter';

interface ListMergeModalProps {
    lists: any[];
    onClose: () => void;
    onSuccess: () => void;
}

const ListMergeModal: React.FC<ListMergeModalProps> = ({ lists, onClose: _onClose, onSuccess }) => {
    const [animateIn, setAnimateIn] = useState(false);
    useEffect(() => { setTimeout(() => setAnimateIn(true), 10); }, []);
    const onClose = () => { setAnimateIn(false); setTimeout(_onClose, 400); };

    const [mergeType, setMergeType] = useState<'existing' | 'new'>('new');
    const [targetListId, setTargetListId] = useState<string>(lists[0]?.id || '');
    const [newListName, setNewListName] = useState(`Merged - ${new Date().toLocaleDateString('vi-VN')}`);
    const [deleteSourceLists, setDeleteSourceLists] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const totalMembers = useMemo(() => {
        return lists.reduce((sum, list) => sum + (list.count || 0), 0);
    }, [lists]);

    const handleMerge = async () => {
        // Validation
        if (mergeType === 'new' && !newListName.trim()) {
            toast.error('Vui lòng nhập tên cho danh sách mới');
            return;
        }

        if (mergeType === 'existing' && !targetListId) {
            toast.error('Vui lòng chọn danh sách đích');
            return;
        }

        setIsLoading(true);
        try {
            const payload: any = {
                list_ids: lists.map(l => l.id),
                merge_type: mergeType
            };

            if (mergeType === 'existing') {
                payload.target_list_id = targetListId;
                payload.delete_source_lists = deleteSourceLists;
            } else {
                payload.new_list_name = newListName;
            }

            const res = await api.post('lists.php?route=merge', payload);

            if (res.success) {
                const data = res.data as any;
                toast.success(
                    `Đã gộp ${lists.length} danh sách thành công! ` +
                    `${data.duplicates_removed > 0 ? `Đã loại bỏ ${data.duplicates_removed} email trùng lặp.` : ''}`,
                    { duration: 5000 }
                );
                onSuccess();
                onClose();
            } else {
                toast.error(res.message || 'Có lỗi xảy ra khi gộp danh sách');
            }
        } catch (error) {
            console.error('Merge error:', error);
            toast.error('Có lỗi xảy ra khi thực hiện gộp. Vui lòng thử lại.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[110000] flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <div className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ease-out ${animateIn ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />

            {/* Modal Content */}
            <div
                style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                className={`relative bg-white rounded-[24px] shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden border border-slate-100 transform transition-all duration-500 ${animateIn ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-8'}`}>
                {isLoading && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-50 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="w-8 h-8 text-[#2563eb] animate-spin" />
                            <p className="text-xs font-bold text-slate-500 animate-pulse">Đang gộp...</p>
                        </div>
                    </div>
                )}
                {/* Header */}
                <div className="px-8 py-6 flex justify-between items-center bg-white border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                            <GitMerge className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 tracking-tight">Gộp danh sách</h3>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                {lists.length} danh sách đã chọn
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1 bg-white">
                    {/* Selected Lists Summary */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                            Danh sách được chọn
                        </label>
                        <div className="bg-slate-50 rounded-2xl p-4 space-y-2 border border-slate-200">
                            {lists.map(list => (
                                <div key={list.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <List className="w-4 h-4 text-indigo-600" />
                                        <span className="text-sm font-bold text-slate-800">{list.name}</span>
                                    </div>
                                    <span className="text-xs font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                                        {list.count?.toLocaleString() || 0}
                                    </span>
                                </div>
                            ))}
                            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-600">Tổng sốthành viên:</span>
                                <span className="text-sm font-black text-indigo-600">{totalMembers.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Important Notice */}
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold text-amber-900 mb-1">Lưu ý quan trọng</p>
                            <p className="text-xs text-amber-800 leading-relaxed">
                                Hệ thống sẽ <strong>tự động loại bỏ email trùng lặp</strong> khi gộp danh sách.
                                Số lượng thành viên cuối cùng có thể ít hơn Tổng sốtrên.
                            </p>
                        </div>
                    </div>

                    {/* Merge Type Selection */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                            Chọn phương thức gộp
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <div
                                onClick={() => setMergeType('new')}
                                className={`cursor-pointer p-4 rounded-2xl border-2 transition-all ${mergeType === 'new'
                                    ? 'border-indigo-500 bg-indigo-50'
                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                    }`}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <Plus className={`w-4 h-4 ${mergeType === 'new' ? 'text-indigo-600' : 'text-slate-400'}`} />
                                    <span className={`text-xs font-bold ${mergeType === 'new' ? 'text-slate-900' : 'text-slate-500'}`}>
                                        Tạo danh sách mới
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-tight">
                                    Tạo danh sách mới chứa tất cả thành viên
                                </p>
                            </div>
                            <div
                                onClick={() => setMergeType('existing')}
                                className={`cursor-pointer p-4 rounded-2xl border-2 transition-all ${mergeType === 'existing'
                                    ? 'border-emerald-500 bg-emerald-50'
                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                    }`}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <GitMerge className={`w-4 h-4 ${mergeType === 'existing' ? 'text-emerald-600' : 'text-slate-400'}`} />
                                    <span className={`text-xs font-bold ${mergeType === 'existing' ? 'text-slate-900' : 'text-slate-500'}`}>
                                        Gộp vào có sẵn
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-tight">
                                    Gộp vào một danh sách đã chọn
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Conditional Options */}
                    {mergeType === 'new' ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                            <Input
                                label="Tên danh sách mới"
                                value={newListName}
                                onChange={(e) => setNewListName(e.target.value)}
                                placeholder="Nhập tên cho danh sách mới..."
                                icon={List}
                                required
                            />
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                            <Select
                                label="Chọn danh sách đích"
                                value={targetListId}
                                onChange={setTargetListId}
                                options={lists.map(l => ({ value: l.id, label: `${l.name} (${l.count || 0})` }))}
                                icon={List}
                            />
                            <div
                                onClick={() => setDeleteSourceLists(!deleteSourceLists)}
                                className={`cursor-pointer p-4 rounded-2xl border-2 transition-all ${deleteSourceLists
                                    ? 'border-rose-500 bg-rose-50'
                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Trash2 className={`w-4 h-4 ${deleteSourceLists ? 'text-rose-600' : 'text-slate-400'}`} />
                                        <div>
                                            <p className={`text-xs font-bold ${deleteSourceLists ? 'text-slate-900' : 'text-slate-600'}`}>
                                                Xóa các danh sách còn lại
                                            </p>
                                            <p className="text-[10px] text-slate-500 mt-0.5">
                                                Xóa {lists.length - 1} danh sách khác sau khi gộp
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${deleteSourceLists
                                        ? 'bg-rose-500 border-rose-500'
                                        : 'border-slate-300'
                                        }`}>
                                        {deleteSourceLists && <div className="w-2 h-2 bg-white rounded-sm" />}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 py-4 bg-slate-50 flex justify-between gap-3 border-t border-slate-100 shrink-0">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-5 py-2 rounded-xl text-slate-500 font-bold hover:bg-slate-100 transition-all text-xs disabled:opacity-50"
                    >
                        Hủy bỏ
                    </button>
                    <button
                        onClick={handleMerge}
                        disabled={isLoading}
                        className="px-6 py-2 rounded-xl bg-slate-900 text-[#2563eb] font-bold text-[11px] uppercase tracking-widest hover:bg-black shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitMerge className="w-3.5 h-3.5" />}
                        Gộp ngay
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ListMergeModal;
