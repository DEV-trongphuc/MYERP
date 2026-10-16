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
            <div className={`rounded-3xl overflow-hidden shadow-2xl flex flex-col border transition-colors duration-500 animate-in zoom-in-95 duration-200 ${isDarkTheme ? 'bg-[#0B0F17] border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="p-8 text-center bg-rose-50/30">
                    <div className="w-20 h-20 rounded-3xl bg-rose-500/10 flex items-center justify-center text-rose-500 mb-6 mx-auto animate-pulse shadow-xl shadow-rose-500/5">
                        <Trash2 className="w-10 h-10" />
                    </div>
                    <h3 className="font-black text-xl text-slate-800 tracking-tight leading-none mb-3">Dọn dẹp Workspace</h3>
                    <p className="text-sm text-slate-500 leading-relaxed px-6">
                        Bạn có chắc chắn muốn <span className="font-bold text-rose-600">xóa toàn bộ tệp workspace</span> (không bao gồm global) trong cuộc hội thoại này? Hành động này không thể hoàn tác.
                    </p>
                </div>

                <div className={`p-6 flex gap-4 ${isDarkTheme ? 'bg-[#161B24]' : 'bg-white'}`}>
                    <button
                        onClick={onClose}
                        className={`flex-1 py-4 px-6 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm ${isDarkTheme ? 'bg-slate-800 hover:bg-slate-700 text-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                    >
                        Hủy bỏ
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-4 px-6 bg-rose-600 hover:bg-rose-700 rounded-2xl text-[11px] font-black text-white uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-rose-600/20"
                    >
                        Xóa tất cả
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ClearWorkspaceModal;
