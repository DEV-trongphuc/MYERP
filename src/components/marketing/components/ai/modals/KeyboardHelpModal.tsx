import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutProps {
    keys: string[];
    description: string;
    isDarkTheme: boolean;
}

const ShortcutRow: React.FC<ShortcutProps> = ({ keys, description, isDarkTheme }) => (
    <div className={`flex items-center justify-between py-2 border-b last:border-0 ${isDarkTheme ? 'border-slate-800' : 'border-slate-100'}`}>
        <span className={`text-sm ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>{description}</span>
        <div className="flex gap-1">
            {keys.map((key, idx) => (
                <React.Fragment key={idx}>
                    <kbd className={`px-2 py-1 text-[10px] font-bold rounded border shadow-sm ${isDarkTheme
                        ? 'bg-slate-800 border-slate-700 text-slate-200'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}>
                        {key}
                    </kbd>
                    {idx < keys.length - 1 && <span className="text-slate-500 self-center">+</span>}
                </React.Fragment>
            ))}
        </div>
    </div>
);

interface KeyboardHelpModalProps {
    isOpen: boolean;
    onClose: () => void;
    isDarkTheme: boolean;
}

export const KeyboardHelpModal: React.FC<KeyboardHelpModalProps> = ({ isOpen, onClose, isDarkTheme }) => {
    if (!isOpen) return null;

    const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const modKey = isMac ? '⌘' : 'Ctrl';
    const altKey = isMac ? '⌥' : 'Alt';

    const shortcutGroups = [
        {
            title: 'Hệ thống & Giao diện',
            items: [
                { keys: [modKey, 'K'], description: 'Tìm kiếm tin nhắn' },
                { keys: [modKey, '/'], description: 'Ẩn/hiện Sidebar' },
                { keys: [modKey, '.'], description: 'Ẩn/hiện Workspace' },
                { keys: [altKey, 'L'], description: 'Đổi chế độ Sáng/Tối' },
                { keys: [altKey, 'Z'], description: 'Chế độ Tập trung (Zen Mode)' },
                { keys: ['?'], description: 'Mở hướng dẫn này' },
                { keys: ['Esc'], description: 'Đóng/Thoát' },
            ]
        },
        {
            title: 'Chế độ & Tiện ích',
            items: [
                { keys: [altKey, 'N'], description: 'Tạo cuộc trò chuyện mới' },
                { keys: [altKey, 'I'], description: 'Chế độ Nghiên cứu (Intelligence)' },
                { keys: [altKey, 'G'], description: 'Chế độ Tạo ảnh (Generation)' },
                { keys: [altKey, 'B'], description: 'Chế độ Kiến thức (KB Only)' },
                { keys: [altKey, 'M'], description: 'Chế độ Lập trình (Manual/Code)' },
            ]
        }
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 animate-in fade-in duration-300">
            <div
                className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 ${isDarkTheme ? 'bg-[#0F172A] border border-slate-800' : 'bg-white'}`}
            >
                {/* Header */}
                <div className={`px-6 py-4 flex items-center justify-between border-b ${isDarkTheme ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'}`}>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-brand/10 text-brand">
                            <Keyboard className="w-5 h-5" />
                        </div>
                        <h3 className={`font-bold ${isDarkTheme ? 'text-slate-100' : 'text-slate-900'}`}>Phím tắt hệ thống</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-full transition-colors ${isDarkTheme ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="px-6 py-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {shortcutGroups.map((group, gIdx) => (
                        <div key={gIdx} className="mb-6 last:mb-0">
                            <h4 className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>
                                {group.title}
                            </h4>
                            <div className="space-y-1">
                                {group.items.map((item, iIdx) => (
                                    <ShortcutRow
                                        key={iIdx}
                                        keys={item.keys}
                                        description={item.description}
                                        isDarkTheme={isDarkTheme}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className={`px-6 py-4 text-center border-t ${isDarkTheme ? 'border-slate-800 bg-slate-900/50 text-slate-500' : 'border-slate-100 bg-slate-50/50 text-slate-400'}`}>
                    <p className="text-xs">Mẹo: Sử dụng phím tắt giúp bạn làm việc nhanh hơn gấp 2 lần!</p>
                </div>
            </div>
        </div>
    );
};
