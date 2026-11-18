import React from 'react';
import Modal from '../../../common/Modal';
import { Trash2 } from 'lucide-react';

interface ClearWorkspaceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isDarkTheme?: boolean;
}

const ClearWorkspaceModal: React.FC<ClearWorkspaceModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
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
            <div className={`rounded-2xl overflow-hidden shadow-2xl flex flex-col border transition-colors duration-300 animate-in zoom-in-95 duration-200 ${isDarkTheme ? 'bg-[#0B0F17] border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className={`p-8 text-center ${isDarkTheme ? 'bg-rose-500/10' : 'bg-rose-50/40'}`}>
                    <div className="w-16 h-16 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mb-5 mx-auto">
                        <Trash2 className="w-8 h-8" strokeWidth={1.75} />
                    </div>
                    <h3 className={`font-bold text-xl leading-none mb-3 ${isDarkTheme ? 'text-slate-100' : 'text-slate-800'}`}>Dọn dẹp Workspace</h3>
                    <p className={`text-sm leading-relaxed px-4 ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                        Bạn có chắc chắn muốn <span className="font-semibold text-rose-600">xóa toàn bộ tệp workspace</span> (không bao gồm global) trong cuộc hội thoại này? Hành động này không thể hoàn tác.
                    </p>
                </div>

                <div className={`p-6 flex gap-3 border-t ${isDarkTheme ? 'bg-[#161B24] border-slate-800' : 'bg-white border-slate-100'}`}>
                    <button
                        onClick={onClose}
                        className={`flex-1 py-3 px-5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors ${isDarkTheme ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                    >
                        Hủy bỏ
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-3 px-5 bg-[#BD1D2D] hover:bg-[#9A1523] rounded-xl text-xs font-semibold text-white uppercase tracking-wider transition-colors"
                    >
                        Xóa tất cả
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ClearWorkspaceModal;
