import * as React from 'react';
import { useState } from 'react';
import { Users, CheckCircle2, XCircle, AlertTriangle, ArrowRight, GitBranch, Info } from 'lucide-react';
import Modal from '../../common/Modal';
import Button from '../../common/Button';

interface FlowContinuationModalProps {
    isOpen: boolean;
    onClose: () => void;
    completedUsers: {
        total: number;
        byBranch: { [key: string]: number };
    };
    newStepInfo: {
        type: string;
        label: string;
        parentStepLabel: string;
        branch?: string;
    };
    isAffected?: boolean;
    onContinue: (options: { continueAll: boolean; branches?: string[] }) => void;
    onStop: () => void;
}

const FlowContinuationModal: React.FC<FlowContinuationModalProps> = ({
    isOpen,
    onClose,
    completedUsers,
    newStepInfo,
    isAffected = true,
    onContinue,
    onStop
}) => {
    const [selectedOption, setSelectedOption] = useState<'continue' | 'stop' | 'choose'>('continue');
    const [selectedBranches, setSelectedBranches] = useState<string[]>(Object.keys(completedUsers.byBranch || {}));

    const handleConfirm = () => {
        if (!isAffected) {
            onContinue({ continueAll: true }); // Just proceed, doesn't matter as nobody moves
        } else if (selectedOption === 'continue') {
            onContinue({ continueAll: true });
        } else if (selectedOption === 'choose') {
            onContinue({ continueAll: false, branches: selectedBranches });
        } else {
            onStop();
        }
        onClose();
    };

    const toggleBranch = (branch: string) => {
        setSelectedBranches(prev =>
            prev.includes(branch) ? prev.filter(b => b !== branch) : [...prev, branch]
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isAffected ? "Flow đang chạy - Quyết định tiếp tục" : "Thông báo thêm bước"}>
            <div className="space-y-6">
                {/* Warning/Info Banner */}
                {isAffected ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold text-amber-900 mb-1">Flow đang hoạt động</h4>
                            <p className="text-xs text-amber-700 leading-relaxed">
                                Bạn đang thêm bước mới vào flow đang chạy Hiện có <strong>{completedUsers.total} người dùng</strong> đã Hoàn thành flow cũ.
                                Họ có nên tiếp tục thực hiện các bước mới không?
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                        <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold text-emerald-900 mb-1">Không ảnh hưởng người dùng cũ</h4>
                            <p className="text-xs text-emerald-700 leading-relaxed">
                                Có <strong>{completedUsers.total} người dùng</strong> đã Hoàn thành, nhưng họ kết thúc ở nhánh khác.
                                Việc thêm bước này sẽ <strong>không ảnh hưởng</strong> đến họ.
                            </p>
                        </div>
                    </div>
                )}

                {/* New Step Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wide mb-2">Bước mới được thêm</h4>
                    <div className="flex items-center gap-2 text-sm">
                        <span className="font-bold text-blue-800">{newStepInfo.label}</span>
                        <ArrowRight className="w-4 h-4 text-blue-400" />
                        <span className="text-blue-600">sau "{newStepInfo.parentStepLabel}"</span>
                        {newStepInfo.branch && (
                            <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-md font-bold">
                                Nhánh: {newStepInfo.branch}
                            </span>
                        )}
                    </div>
                </div>

                {/* Completed Users by Branch (Only show if affected or simply to inform) */}
                {isAffected && Object.keys(completedUsers.byBranch || {}).length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <GitBranch className="w-4 h-4" />
                            Người dùng đã Hoàn thành theo nhánh
                        </h4>
                        <div className="space-y-2">
                            {Object.entries(completedUsers.byBranch).map(([branch, count]) => (
                                <div key={branch} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-200">
                                    <span className="text-sm font-semibold text-slate-700">{branch}</span>
                                    <span className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded-md font-bold">
                                        {count} người
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Options - Only show if Affected */}
                {isAffected ? (
                    <div className="space-y-3">
                        <h4 className="text-sm font-bold text-slate-800">Chọn hành động:</h4>

                        {/* Option 1: Continue All */}
                        <button
                            onClick={() => setSelectedOption('continue')}
                            className={`w-full text-left p-4 rounded-xl border-2 transition-all ${selectedOption === 'continue'
                                ? 'border-emerald-500 bg-emerald-50'
                                : 'border-slate-200 bg-white hover:border-emerald-300'
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${selectedOption === 'continue' ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'
                                    }`}>
                                    {selectedOption === 'continue' && <div className="w-2 h-2 bg-white rounded-full" />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                        <h5 className="text-sm font-bold text-slate-800">Tiếp tục tất cả</h5>
                                    </div>
                                    <p className="text-xs text-slate-600">
                                        Tất cả {completedUsers.total} người dùng đã Hoàn thành sẽ tiếp tục thực hiện các bước mới từ nhánh họ đã Hoàn thành.
                                    </p>
                                </div>
                            </div>
                        </button>

                        {/* Option 2: Stop All */}
                        <button
                            onClick={() => setSelectedOption('stop')}
                            className={`w-full text-left p-4 rounded-xl border-2 transition-all ${selectedOption === 'stop'
                                ? 'border-rose-500 bg-rose-50'
                                : 'border-slate-200 bg-white hover:border-rose-300'
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${selectedOption === 'stop' ? 'border-rose-500 bg-rose-500' : 'border-slate-300'
                                    }`}>
                                    {selectedOption === 'stop' && <div className="w-2 h-2 bg-white rounded-full" />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <XCircle className="w-4 h-4 text-rose-600" />
                                        <h5 className="text-sm font-bold text-slate-800">Dừng tại đây</h5>
                                    </div>
                                    <p className="text-xs text-slate-600">
                                        Giữ Báo cáo những người đã Hoàn thành flow cũ. Họ sẽ không thực hiện các bước mới.
                                        Chỉ người dùng mới sẽ chạy flow đầy đủ.
                                    </p>
                                </div>
                            </div>
                        </button>

                        {/* Option 3: Choose by Branch (if multiple branches) */}
                        {Object.keys(completedUsers.byBranch || {}).length > 1 && (
                            <button
                                onClick={() => setSelectedOption('choose')}
                                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${selectedOption === 'choose'
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-slate-200 bg-white hover:border-blue-300'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${selectedOption === 'choose' ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
                                        }`}>
                                        {selectedOption === 'choose' && <div className="w-2 h-2 bg-white rounded-full" />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <GitBranch className="w-4 h-4 text-blue-600" />
                                            <h5 className="text-sm font-bold text-slate-800">Chọn theo nhánh</h5>
                                        </div>
                                        <p className="text-xs text-slate-600 mb-3">
                                            Chọn nhánh nào sẽ tiếp tục, nhánh nào sẽ dừng lại.
                                        </p>

                                        {selectedOption === 'choose' && (
                                            <div className="space-y-2 mt-3 pt-3 border-t border-blue-200">
                                                {Object.entries(completedUsers.byBranch).map(([branch, count]) => (
                                                    <label key={branch} className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedBranches.includes(branch)}
                                                            onChange={() => toggleBranch(branch)}
                                                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-2 focus:ring-blue-500"
                                                        />
                                                        <span className="text-xs font-semibold text-slate-700">{branch}</span>
                                                        <span className="text-xs text-slate-500">({count} người)</span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </button>
                        )}
                    </div>
                ) : (
                    /* Not Affected - Simple Continue */
                    <div className="pt-2">
                        <Button
                            variant="custom"
                            onClick={handleConfirm}
                            className="w-full justify-center bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20 active:scale-[0.95] rounded-2xl px-5 py-2.5 text-xs md:text-sm font-bold border-none transition-all"
                        >
                            Tiếp tục và Thêm bước
                        </Button>
                    </div>
                )}

                {/* Action Buttons for Affected Case only - Already inside Options div above? No, separate buttons */}
                {isAffected && (
                    <div className="flex gap-3 pt-4 border-t border-slate-200">
                        <Button variant="secondary" onClick={onClose} className="flex-1">
                            Hủy
                        </Button>
                        <Button
                            variant="custom"
                            onClick={handleConfirm}
                            className="flex-1 bg-gradient-to-r from-[#ffbe1a] to-[#2563eb] hover:from-[#2563eb] hover:to-[#e69800] text-white shadow-lg shadow-yellow-500/20 active:scale-[0.95] rounded-2xl px-5 py-2.5 text-xs md:text-sm font-bold border-none transition-all"
                        >
                            Xác nhận
                        </Button>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default FlowContinuationModal;
