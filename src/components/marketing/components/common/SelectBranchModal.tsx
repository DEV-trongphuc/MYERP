import * as React from 'react';
import { useState } from 'react';
import { GitBranch, Check } from 'lucide-react';
import Modal from './Modal';

interface Branch {
    id: string;
    label: string;
    description?: string;
}

interface SelectBranchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (branchId: string) => void;
    branches: Branch[];
    title: string;
    stepType: string;
    isDarkTheme?: boolean;
}

const SelectBranchModal: React.FC<SelectBranchModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    branches,
    title,
    isDarkTheme
}) => {
    const [selectedBranch, setSelectedBranch] = useState<string>('');

    React.useEffect(() => {
        if (isOpen) {
            setSelectedBranch('');
        }
    }, [isOpen]);

    const handleConfirm = () => {
        if (selectedBranch) {
            onConfirm(selectedBranch);
            onClose();
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="md"
            isDarkTheme={isDarkTheme}
            title={
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${isDarkTheme ? 'bg-slate-800 text-blue-400 shadow-blue-500/10' : 'bg-blue-50 text-blue-600 shadow-blue-500/5'} group`}>
                        <GitBranch className="w-6 h-6 transition-transform group-hover:rotate-12" />
                    </div>
                    <div className="flex-1">
                        <h3 className={`text-lg font-black tracking-tight ${isDarkTheme ? 'text-slate-100' : 'text-slate-800'}`}>{title}</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Chọn nhánh điều hướng</p>
                    </div>
                </div>
            }
            footer={
                <div className="flex items-center gap-3 w-full justify-end">
                    <button
                        onClick={onClose}
                        className={`px-5 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-sm ${isDarkTheme ? 'text-slate-400 bg-slate-800 border border-slate-700/50 hover:bg-slate-700 hover:text-slate-200' : 'text-slate-500 bg-slate-100 hover:bg-slate-200'} active:scale-95`}
                    >
                        Hủy bỏ
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedBranch}
                        className={`px-7 py-3 rounded-xl font-black uppercase tracking-widest text-[11px] transition-all shadow-lg active:scale-95
                            ${selectedBranch
                                ? 'bg-gradient-to-r from-[#2563eb] to-blue-600 text-white hover:from-[#561dd0] hover:to-blue-700 shadow-[#2563eb]/20'
                                : `${isDarkTheme ? 'bg-slate-800/40 text-slate-600 border border-slate-800' : 'bg-slate-100 text-slate-300'} cursor-not-allowed shadow-none`
                            }`}
                    >
                        Xác nhận chuyển
                    </button>
                </div>
            }
        >
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                {branches.map((branch) => (
                    <button
                        key={branch.id}
                        onClick={() => setSelectedBranch(branch.id)}
                        className={`w-full p-4 rounded-2xl border-2 transition-all text-left relative group ${selectedBranch === branch.id
                            ? (isDarkTheme 
                                ? 'border-blue-500 bg-blue-950/20 shadow-lg shadow-blue-500/5' 
                                : 'border-blue-600 bg-blue-50/30 shadow-lg shadow-blue-500/5')
                            : (isDarkTheme 
                                ? 'border-slate-800 hover:border-slate-700 hover:bg-slate-800/40' 
                                : 'border-slate-100 hover:border-blue-200 hover:bg-slate-50')
                            }`}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedBranch === branch.id
                                ? 'border-blue-600 bg-blue-600'
                                : (isDarkTheme ? 'border-slate-700 group-hover:border-blue-500' : 'border-slate-200 group-hover:border-blue-300')
                                }`}>
                                {selectedBranch === branch.id && (
                                    <Check className="w-3.5 h-3.5 text-white" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className={`font-black text-sm truncate ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>{branch.label}</div>
                                {branch.description && (
                                    <div className={`text-[11px] mt-0.5 line-clamp-1 font-medium ${isDarkTheme ? 'text-slate-500' : 'text-slate-500'}`}>{branch.description}</div>
                                )}
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </Modal>
    );
};

export default SelectBranchModal;
