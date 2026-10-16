import * as React from 'react';
import { useEffect, useRef } from 'react';

interface RenameSessionModalProps {
    isOpen: boolean;
    onClose: () => void;
    sessionTitle: string;
    setSessionTitle: (title: string) => void;
    onConfirm: () => void;
    isDarkTheme?: boolean;
}

const RenameSessionModal: React.FC<RenameSessionModalProps> = ({
    isOpen,
    onClose,
    sessionTitle,
    setSessionTitle,
    onConfirm,
    isDarkTheme
}) => {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className={`relative rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200 ${isDarkTheme ? 'bg-[#1E2532] border border-slate-700' : 'bg-white'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-brand to-brand-primary-dark p-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                            </svg>
                        </div>
                        Đổi tên cuộc hội thoại
                    </h3>
                    <p className="text-white/80 text-sm mt-2">Nhập tên mới cho cuộc hội thoại của bạn</p>
                </div>

                {/* Body */}
                <div className="p-6">
                    <div className="space-y-4">
                        <div>
                            <label className={`block text-sm font-bold mb-2 ${isDarkTheme ? 'text-slate-300' : 'text-slate-700'}`}>
                                Tên cuộc hội thoại
                            </label>
                            <input
                                ref={inputRef}
                                type="text"
                                value={sessionTitle}
                                onChange={(e) => setSessionTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && sessionTitle.trim()) {
                                        onConfirm();
                                    } else if (e.key === 'Escape') {
                                        onClose();
                                    }
                                }}
                                className={`w-full px-4 py-3 border-2 rounded-xl placeholder-slate-400 outline-none transition-all font-medium ${isDarkTheme ? 'bg-slate-900 border-slate-700 text-slate-100 focus:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-brand focus:border-opacity-50 focus:ring-4 focus:ring-brand/10'}`}
                                placeholder="Ví dụ: Chiến lược Marketing 2024"
                                autoFocus
                            />
                            <p className={`text-xs mt-2 ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>
                                💡 Nhấn <kbd className={`px-2 py-0.5 rounded border font-mono text-xs ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-300 text-slate-600'}`}>Enter</kbd> để lưu, <kbd className={`px-2 py-0.5 rounded border font-mono text-xs ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-300 text-slate-600'}`}>Esc</kbd> để hủy
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 flex gap-3">
                    <button
                        onClick={onClose}
                        className={`flex-1 px-4 py-3 rounded-xl font-bold transition-all ${isDarkTheme ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                    >
                        Hủy
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={!sessionTitle.trim()}
                        className={`flex-1 px-4 py-3 rounded-xl font-bold transition-all ${sessionTitle.trim() ? 'bg-gradient-to-r from-brand to-brand-primary-dark text-white hover:brightness-110 shadow-lg shadow-brand/30' : (isDarkTheme ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-200 text-slate-400 cursor-not-allowed')}`}
                    >
                        Lưu thay đổi
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RenameSessionModal;
