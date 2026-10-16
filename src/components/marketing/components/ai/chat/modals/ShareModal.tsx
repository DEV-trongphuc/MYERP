import React from 'react';
import Modal from '../../../common/Modal';
import { X, Share2, Copy, Globe } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    shareUrl: string;
    isDarkTheme?: boolean;
}

const ShareModal: React.FC<ShareModalProps> = ({
    isOpen,
    onClose,
    shareUrl,
    isDarkTheme
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            noHeader={true}
            noPadding={true}
            size="md"
        >
            <div className={`border rounded-3xl overflow-hidden shadow-2xl relative transition-colors duration-500 ${isDarkTheme ? 'bg-[#0B0F17] border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="absolute top-0 right-0 p-4">
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-8 pb-0 flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-600/30 mb-6 animate-bounce-slow">
                        <Share2 className="w-8 h-8" />
                    </div>
                    <h3 className={`text-xl font-black mb-2 ${isDarkTheme ? 'text-slate-100' : 'text-slate-800'}`}>Chia sẻ cuộc trò chuyện</h3>
                    <p className="text-sm text-slate-500 max-w-sm mb-8 leading-relaxed">
                        Bất kỳ ai có liên kết này đều có thể xem và nhân bản cuộc trò chuyện này để tiếp tục chat.
                    </p>

                    <div className={`w-full border rounded-2xl p-4 flex items-center gap-3 mb-8 ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex-1 min-w-0 flex flex-col items-start gap-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Public Link</span>
                            <code className={`w-full text-xs font-mono truncate bg-transparent outline-none text-left ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>
                                {shareUrl}
                            </code>
                        </div>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(shareUrl);
                                toast.success('Đã sao chép liên kết!');
                                onClose();
                            }}
                            className={`shrink-0 p-2.5 border rounded-xl transition-all shadow-sm group ${isDarkTheme ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-400 hover:text-slate-200' : 'bg-white border-slate-200 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-600'}`}
                            title="Copy Link"
                        >
                            <Copy className="w-4 h-4 text-slate-500 group-hover:text-amber-600" />
                        </button>
                    </div>
                </div>

                <div className={`px-8 py-5 border-t flex justify-between items-center ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-emerald-500" />
                        <span className={`text-xs font-bold ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>Public Access</span>
                    </div>
                    <button onClick={onClose} className={`text-xs font-bold ${isDarkTheme ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-800'}`}>Đóng</button>
                </div>
            </div>
        </Modal>
    );
};

export default ShareModal;
