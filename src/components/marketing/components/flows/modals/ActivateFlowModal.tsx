
import React, { useState } from 'react';
import { Rocket, CheckCircle2, AlertTriangle, Zap, PlayCircle, GitMerge } from 'lucide-react';
import Modal from '../../common/Modal';
import Button from '../../common/Button';

interface ActivateFlowModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (activateCampaign: boolean) => Promise<void>;
    flowName: string;
    linkedCampaignName?: string;
    isLoading?: boolean;
}

const ActivateFlowModal: React.FC<ActivateFlowModalProps> = ({
    isOpen, onClose, onConfirm, flowName, linkedCampaignName, isLoading
}) => {
    const [activateCampaign, setActivateCampaign] = useState(true);

    const handleConfirm = () => {
        onConfirm(activateCampaign);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Kích hoạt Flow tự động"
            size="md"
            footer={
                <div className="flex justify-between items-center w-full">
                    <Button variant="ghost" onClick={onClose} disabled={isLoading}>Để sau</Button>
                    <div className="flex gap-2">
                        <Button
                            variant="primary"
                            onClick={handleConfirm}
                            isLoading={isLoading}
                            disabled={isLoading}
                            className="bg-amber-600 hover:bg-amber-600 text-white shadow-lg shadow-amber-600/30 transition-all duration-500"
                            icon={Rocket}
                        >
                            {linkedCampaignName && activateCampaign ? 'Kích hoạt Cả hai' : 'Kích hoạt Flow'}
                        </Button>
                    </div>
                </div>
            }
        >
            <div className="space-y-6">
                <div className="bg-emerald-50 text-emerald-800 p-4 rounded-2xl flex gap-3 border border-emerald-100">
                    <div className="p-2 bg-white rounded-xl shadow-sm h-fit">
                        <Zap className="w-6 h-6 text-emerald-500 fill-emerald-500" />
                    </div>
                    <div>
                        <h4 className="font-bold text-sm mb-1">Flow đã sẵn sàng!</h4>
                        <p className="text-xs opacity-90 leading-relaxed">
                            Hệ thống sẽ bắt đầu theo dõi và xử lý tự động cho <strong>{flowName}</strong> ngay lập tức.
                        </p>
                    </div>
                </div>

                {linkedCampaignName && (
                    <div className="relative overflow-hidden group">
                        <div className={`absolute inset-0 bg-gradient-to-r from-amber-50 to-orange-50 border border-orange-200/60 rounded-2xl transition-all duration-300 ${activateCampaign ? 'opacity-100' : 'opacity-40 grayscale'}`} />

                        <label className="relative flex items-start gap-4 p-4 cursor-pointer z-10">
                            {/* Toggle Switch */}
                            <div className="pt-0.5">
                                <button
                                    type="button"
                                    onClick={() => setActivateCampaign(!activateCampaign)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${activateCampaign
                                        ? 'bg-gradient-to-r from-orange-500 to-amber-600 shadow-lg shadow-orange-500/30'
                                        : 'bg-gray-300'
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-all duration-300 ${activateCampaign ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                    />
                                </button>
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <h4 className={`font-bold text-sm transition-colors ${activateCampaign ? 'text-slate-800' : 'text-slate-500'}`}>
                                        Chiến dịch liên kết: {linkedCampaignName}
                                    </h4>
                                    {activateCampaign && <span className="px-1.5 py-0.5 bg-orange-100 text-[#ca7900] text-[10px] font-black uppercase tracking-wider rounded">Auto</span>}
                                </div>
                                <p className={`text-xs transition-colors ${activateCampaign ? 'text-slate-600' : 'text-slate-400'}`}>
                                    Tự động chuyển Trạng thái chiến dịch từ <strong>Waiting Flow</strong> sang <strong>Ready/Scheduled</strong>.
                                </p>
                            </div>
                            <div className={`p-2 bg-white rounded-xl shadow-sm transition-all ${activateCampaign ? 'text-orange-500' : 'text-slate-300'}`}>
                                <GitMerge className="w-5 h-5" />
                            </div>
                        </label>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default ActivateFlowModal;
