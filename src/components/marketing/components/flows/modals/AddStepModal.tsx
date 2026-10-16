
import React from 'react';
import { Mail, Clock, GitMerge, Tag, Sparkles, AlertTriangle, Ban, Link as LinkIcon, Beaker, UserMinus, Trash2, List, MessageSquare } from 'lucide-react';
import Modal from '../../common/Modal';
import { FlowStep } from '../../../types';

interface AddStepModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (type: any) => void;
  parentStep?: FlowStep;
  isInsert?: boolean;
}

import { AppIcon } from '../../../../common/AppIcons';
import { STEP_DEFINITIONS } from '../flowConstants';

const STEP_TYPES = STEP_DEFINITIONS;

const AddStepModal: React.FC<AddStepModalProps> = ({ isOpen, onClose, onAdd, parentStep, isInsert }) => {

  const isTypeDisabled = (typeId: string) => {
    // Restriction when inserting between nodes (isInsert = true)
    if (isInsert && ['split_test', 'link_flow', 'remove_action'].includes(typeId)) {
      return "Không hỗ trợ chèn vào giữa.";
    }

    if (typeId === 'condition') {
      // Condition requires an immediate preceding Action (Email/ZNS) step OR a Campaign/Survey Trigger, or another Condition
      const isCampaignTrigger = parentStep?.type === 'trigger' && parentStep.config?.type === 'campaign';
      const isSurveyTrigger = parentStep?.type === 'trigger' && parentStep.config?.type === 'survey';
      if (!parentStep || (parentStep.type !== 'action' && parentStep.type !== 'zalo_zns' && parentStep.type !== 'condition' && !isCampaignTrigger && !isSurveyTrigger)) {
        return "Cần bước Email, ZNS, Khảo sát hoặc Rẽ nhánh trước đó.";
      }
    }

    if (typeId === 'remove_action') {
      // Remove action MUST follow a Condition step (for safety)
      if (!parentStep || parentStep.type !== 'condition') {
        return "Chỉ được đặt sau bước Rẽ nhánh (Condition).";
      }
    }

    return null;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isInsert ? "Chèn bước vào giữa" : "Thêm bước tiếp theo"}
      size="lg"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-2">
        {STEP_TYPES.map((type) => {
          const disabledReason = isTypeDisabled(type.id);
          const isDisabled = !!disabledReason;

          return (
            <button
              key={type.id}
              onClick={() => { if (!isDisabled) { onAdd(type.id as any); onClose(); } }}
              disabled={isDisabled}
              className={`
                flex flex-col items-center text-center p-5 rounded-2xl border transition-all relative group
                ${isDisabled
                  ? 'bg-slate-50 border-slate-200/60 opacity-50 cursor-not-allowed'
                  : 'bg-white border-slate-200 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-0.5'}
              `}
            >
              <div className="mb-3 transition-transform duration-300 group-hover:scale-105">
                <AppIcon name={type.iconName || type.id} size={50} />
              </div>

              <div className="space-y-1">
                <h4 className={`font-black text-sm uppercase tracking-tight ${isDisabled ? 'text-slate-400' : 'text-slate-800'}`}>{type.label}</h4>
                <p className={`text-[10px] font-medium leading-relaxed px-2 ${isDisabled ? 'text-slate-300' : 'text-slate-500'}`}>{type.desc}</p>
              </div>

              {isDisabled && (
                <div className="mt-3 bg-slate-100 px-3 py-1 rounded-full flex items-center gap-2 border border-slate-200">
                  <AlertTriangle className="w-3 h-3 text-slate-400" />
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{disabledReason}</span>
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
