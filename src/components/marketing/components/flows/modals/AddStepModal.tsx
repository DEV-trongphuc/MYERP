import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from '../../common/Modal';
import { FlowStep } from '../../../types';
import { AppIcon } from '../../../../common/AppIcons';
import { STEP_DEFINITIONS } from '../flowConstants';

interface AddStepModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (type: any) => void;
    parentStep?: FlowStep;
    isInsert?: boolean;
}

const STEP_TYPES = STEP_DEFINITIONS;

const AddStepModal: React.FC<AddStepModalProps> = ({
    isOpen,
    onClose,
    onAdd,
    parentStep,
    isInsert
}) => {
    const isTypeDisabled = (typeId: string) => {
        if (isInsert && ['split_test', 'link_flow', 'remove_action'].includes(typeId)) {
            return 'Không hỗ trợ chèn vào giữa.';
        }

        if (typeId === 'condition') {
            const isCampaignTrigger =
                parentStep?.type === 'trigger' && parentStep.config?.type === 'campaign';
            const isSurveyTrigger =
                parentStep?.type === 'trigger' && parentStep.config?.type === 'survey';
            if (
                !parentStep ||
                (parentStep.type !== 'action' &&
                    parentStep.type !== 'zalo_zns' &&
                    parentStep.type !== 'condition' &&
                    !isCampaignTrigger &&
                    !isSurveyTrigger)
            ) {
                return 'Cần bước Email, ZNS, Khảo sát hoặc Rẽ nhánh trước đó.';
            }
        }

        if (typeId === 'remove_action') {
            if (!parentStep || (parentStep.type !== 'condition' && parentStep.type !== 'advanced_condition')) {
                return 'Chỉ được đặt sau bước Rẽ nhánh (Condition).';
            }
        }

        return null;
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isInsert ? 'Chèn bước vào giữa' : 'Thêm bước tiếp theo'}
            size="lg"
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-2">
                {STEP_TYPES.map(type => {
                    const disabledReason = isTypeDisabled(type.id);
                    const isDisabled = !!disabledReason;
                    const IconComp = type.icon;

                    return (
                        <button
                            key={type.id}
                            onClick={() => {
                                if (!isDisabled) {
                                    onAdd(type.id as any);
                                    onClose();
                                }
                            }}
                            disabled={isDisabled}
                            className={`
                                flex flex-col items-center text-center p-5 rounded-[14px] border transition-all relative group cursor-pointer
                                ${
                                    isDisabled
                                        ? 'bg-slate-50 border-slate-200/60 opacity-50 cursor-not-allowed'
                                        : 'bg-white border-slate-200 hover:border-[var(--color-primary)] hover:shadow-lg hover:shadow-red-500/5 hover:-translate-y-0.5'
                                }
                            `}
                        >
                            <div className="mb-3 transition-transform duration-300 group-hover:scale-105">
                                {type.id === 'crm_action' ? (
                                    <div className="w-12 h-12 rounded-[14px] bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shadow-sm">
                                        <IconComp className="w-6 h-6" />
                                    </div>
                                ) : (
                                    <AppIcon name={(type as any).iconName || type.id} size={50} />
                                )}
                            </div>

                            <div className="space-y-1">
                                <h4
                                    className={`font-black text-sm uppercase tracking-tight ${
                                        isDisabled ? 'text-slate-400' : 'text-slate-800'
                                    }`}
                                >
                                    {type.label}
                                </h4>
                                <p
                                    className={`text-[10px] font-medium leading-relaxed px-2 ${
                                        isDisabled ? 'text-slate-300' : 'text-slate-500'
                                    }`}
                                >
                                    {type.desc}
                                </p>
                            </div>

                            {isDisabled && (
                                <div className="mt-3 bg-slate-100 px-3 py-1 rounded-full flex items-center gap-2 border border-slate-200">
                                    <AlertTriangle className="w-3 h-3 text-slate-400" />
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                        {disabledReason}
                                    </span>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </Modal>
    );
};

export default AddStepModal;
