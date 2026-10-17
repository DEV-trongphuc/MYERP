import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, Moon, AlertTriangle, Loader2 } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Segment } from '../../types';
import { API_BASE_URL } from '../../utils/config';
import { getMktPortalRoot } from '../../utils/portalRoot';

interface SegmentCleanupModalProps {
    segment: Segment;
    onClose: () => void;
    onSuccess: () => void;
}

const SegmentCleanupModal: React.FC<SegmentCleanupModalProps> = ({ segment, onClose: _onClose, onSuccess }) => {
    const [animateIn, setAnimateIn] = useState(false);
    useEffect(() => { setTimeout(() => setAnimateIn(true), 10); }, []);
    const onClose = () => { setAnimateIn(false); setTimeout(_onClose, 400); };

    const [days, setDays] = useState(90);
    const [moveToDormant, setMoveToDormant] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    const handleCleanup = async () => {
        setIsLoading(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/segments.php?route=cleanup`, {
                segment_id: segment.id,
                days,
                move_to_dormant: moveToDormant
            });
            if (res.data.success) {
                toast.success(res.data.message || 'Cleanup completed');
                onSuccess();
                onClose();
            } else {
                toast.error(res.data.error || 'Cleanup failed');
            }
        } catch (error) {
            toast.error('Gặp lỗi khi dọn dẹp');
        } finally {
            setIsLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[110000] flex items-center justify-center p-4">
            <div
                className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ease-out ${animateIn ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
            />
            <div
                style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                className={`bg-white rounded-[18px] shadow-xl w-full max-w-md overflow-hidden transform transition-all duration-500 ${animateIn ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-8'}`}
            >
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Trash2 className="w-5 h-5 text-rose-500" />
                        Dọn dẹp phân khúc
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3 text-amber-800 text-sm">
                        <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
                        <div>
                            Bạn đang dọn dẹp phân khúc <strong>{segment.name}</strong>. Hành động này sẽ lọc những người dùng không tương tác trong Thời gian dài.
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                Không tương tác quá (ngày)
                            </label>
                            <input
                                type="number"
                                value={days}
                                onChange={(e) => setDays(parseInt(e.target.value) || 0)}
                                className="w-full px-4 py-2.5 rounded-[var(--radius-md)] border border-slate-200 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15 outline-none transition-all font-bold text-slate-800"
                            />
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-xl border border-indigo-100 bg-indigo-50/50">
                            <div className="flex gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${moveToDormant ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'bg-white text-slate-400 border border-slate-200'}`}>
                                    <Moon className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-slate-800">Chuyển sang danh sách "Ngủ đông"</p>
                                    <p className="text-xs text-slate-500 leading-tight mt-0.5">
                                        Khuyến nghị: Giữ lại data để tái chăm sóc sau này thay vì xóa bỏ hoàn toàn.
                                    </p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={moveToDormant} onChange={(e) => setMoveToDormant(e.target.checked)} />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="p-6 pt-0 flex justify-between gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-[var(--radius-md)] text-slate-600 font-bold hover:bg-slate-100 transition-colors">
                        Hủy
                    </button>
                    <button
                        onClick={handleCleanup}
                        disabled={isLoading}
                        className={`px-5 py-2.5 rounded-[var(--radius-md)] font-bold hover:shadow-md transition-all flex items-center gap-2 text-white ${moveToDormant ? 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]' : 'bg-rose-500 hover:bg-rose-600'}`}
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (moveToDormant ? <Moon className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />)}
                        {moveToDormant ? 'Chuyển sang Ngủ đông' : 'Dọn dẹp & Lưu trữ'}
                    </button>
                </div>
            </div>
        </div>,
        getMktPortalRoot()
    );
};

export default SegmentCleanupModal;
