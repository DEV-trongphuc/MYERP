import React from 'react';
import Modal from '../../../common/Modal';
import { Trash2, X } from 'lucide-react';

interface DeleteSessionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string; // Optional title of the session to display
    isDarkTheme?: boolean;
}

const DeleteSessionModal: React.FC<DeleteSessionModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    isDarkTheme
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            noHeader={true}
            noPadding={true}
            size="sm"
        >
            <div className={`border rounded-3xl overflow-hidden shadow-2xl transition-colors duration-500 ${isDarkTheme ? 'bg-[#0B0F17] border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className={`px-6 py-4 border-b flex justify-between items-center transition-colors duration-500 ${isDarkTheme ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'}`}>
                    <h3 className={`font-bold text-sm uppercase tracking-wide transition-colors duration-500 ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Xác nhận xóa</h3>
                    <button onClick={onClose} className={`transition-colors duration-500 ${isDarkTheme ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6">
                    <p className={`text-sm mb-6 leading-relaxed transition-colors duration-500 ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>
                        Bạn có chắc chắn muốn xóa cuộc trò chuyện này? Hành động này không thể hoàn tác.
                    </p>
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={onClose}
                            className={`px-4 py-2 rounded-xl transition-all text-xs font-bold uppercase tracking-wider ${isDarkTheme ? 'bg-slate-800 hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
                        >
                            Hủy bỏ
                        </button>
                        <button
                            onClick={onConfirm}
                            className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all text-xs font-bold shadow-lg shadow-red-500/20 uppercase tracking-wider flex items-center gap-2"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Xóa ngay</span>
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default DeleteSessionModal;
