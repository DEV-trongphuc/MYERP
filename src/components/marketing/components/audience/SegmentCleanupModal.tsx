import React, { useState, useEffect, useRef } from 'react';
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
    const inFlightRef = useRef(false);

    useEffect(() => {
        const timer = setTimeout(() => setAnimateIn(true), 10);
        return () => clearTimeout(timer);
    }, []);

    // Synchronized 220ms smooth exit without visual clipping or flashes
    const onClose = () => {
        setAnimateIn(false);
        setTimeout(_onClose, 220);
    };

    const [days, setDays] = useState(90);
    const [moveToDormant, setMoveToDormant] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    const handleCleanup = async () => {
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        setIsLoading(true);
        try {
            // Forward & backward compatible payload: sends both 'type' and 'move_to_dormant'
            const res = await axios.post(`${API_BASE_URL}/segments.php?route=cleanup`, {
                segment_id: segment.id,
                days: Math.max(1, days || 90),
                type: moveToDormant ? 'dormant' : 'invalid_status',
                move_to_dormant: moveToDormant
            });
            if (res.data?.success) {
                toast.success(res.data.message || 'Dọn dẹp phân khúc thành công');
                onSuccess();
                onClose();
            } else {
                toast.error(res.data?.error || 'Dọn dẹp phân khúc thất bại');
            }
        } catch (error) {
            toast.error('Gặp lỗi khi dọn dẹp phân khúc');
        } finally {
            inFlightRef.current = false;
            setIsLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[2147483646] flex items-center justify-center p-4">
            <div
                className={`absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-200 ease-out ${
                    animateIn ? 'opacity-100' : 'opacity-0'
                }`}
                onClick={() => !isLoading && onClose()}
            />
            <div
                style={{
                    borderRadius: '16px',
                    boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05)',
                    transitionTimingFunction: 'cubic-bezier(0.25, 0.1, 0.25, 1)'
                }}
                className={`bg-white border border-[#E2E8F0] w-full max-w-md overflow-hidden transform transition-all duration-200 ${
                    animateIn ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'
                }`}
            >
                {/* Header: Clean Executive Slate style with Brand Red icon */}
                <div className="px-6 py-4 border-b border-[#E2E8F0] flex justify-between items-center bg-[#F8FAFC]">
                    <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#FEF2F2] flex items-center justify-center text-[#BD1D2D] shrink-0 border border-[#FECDD3]">
                            <Trash2 className="w-4 h-4" />
                        </div>
                        Dọn dẹp phân khúc
                    </h3>
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="p-1.5 hover:bg-slate-200/60 rounded-lg text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Amber Warning Banner */}
                    <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200/70 flex gap-3 text-amber-900 text-xs leading-relaxed">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                        <div>
                            Bạn đang dọn dẹp phân khúc <strong className="text-amber-950 font-bold">{segment.name}</strong>. Hành động này sẽ loại trừ các liên hệ không còn tương tác hoặc có trạng thái lỗi.
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#64748B] mb-1.5">
                                Không tương tác quá (ngày)
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={3650}
                                value={days}
                                onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full px-3.5 py-2 rounded-xl border border-[#CBD5E1] bg-white text-sm font-semibold text-[#0F172A] focus:border-[#BD1D2D] focus:ring-2 focus:ring-[#BD1D2D]/15 outline-none transition-all tabular-nums"
                            />
                        </div>

                        {/* Dormant Toggle Card: Executive Slate DNA (Clean #F8FAFC bg, #E2E8F0 border) */}
                        <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
                            <div className="flex gap-3 items-center">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                    moveToDormant ? 'bg-[#FEF2F2] text-[#BD1D2D] border border-[#FECDD3]' : 'bg-white text-slate-400 border border-slate-200'
                                }`}>
                                    <Moon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-xs text-[#0F172A]">Chuyển sang "Ngủ đông"</p>
                                    <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                                        Giữ lại dữ liệu để tái nuôi dưỡng thay vì loại trừ vĩnh viễn.
                                    </p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={moveToDormant}
                                    onChange={(e) => setMoveToDormant(e.target.checked)}
                                />
                                <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#BD1D2D]"></div>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="px-6 py-4 bg-[#F8FAFC] border-t border-[#E2E8F0] flex justify-end gap-2.5">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/60 transition-colors disabled:opacity-50"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleCleanup}
                        disabled={isLoading}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 text-white shadow-sm ${
                            moveToDormant
                                ? 'bg-[#BD1D2D] hover:bg-[#a31422] active:scale-[0.98]'
                                : 'bg-[#0F172A] hover:bg-slate-800 active:scale-[0.98]'
                        } disabled:opacity-50`}
                    >
                        {isLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : moveToDormant ? (
                            <Moon className="w-3.5 h-3.5" />
                        ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                        )}
                        {moveToDormant ? 'Chuyển sang Ngủ đông' : 'Dọn dẹp & Lưu trữ'}
                    </button>
                </div>
            </div>
        </div>,
        getMktPortalRoot()
    );
};

export default SegmentCleanupModal;
