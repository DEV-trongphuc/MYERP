import React, { useState } from 'react';
import { Trash2, Save, Sparkles, Beaker, AlertCircle } from 'lucide-react';
import { FlowStep, Flow } from '../../../types';
import Modal from '../../common/Modal';
import Button from '../../common/Button';
import EmailActionConfig from '../config/EmailActionConfig';
import TriggerConfig from '../config/TriggerConfig';
import WaitConfig from '../config/WaitConfig';
import ConditionConfig from '../config/ConditionConfig';
import UpdateTagConfig from '../config/UpdateTagConfig';
import LinkFlowConfig from '../config/LinkFlowConfig';
import RemoveActionConfig from '../config/RemoveActionConfig';
import ListActionConfig from '../config/ListActionConfig';
import AdvancedConditionConfig from '../config/AdvancedConditionConfig';
import ZaloZNSStepConfig from '../config/ZaloZNSStepConfig';
import CrmActionConfig from '../config/CrmActionConfig';

const SplitTestConfig = ({ config, onChange, disabled }: any) => {
  const handleRatioChange = (val: string, isA: boolean) => {
    if (disabled) return;
    if (val === '') {
      if (isA) onChange({ ...config, ratioA: '', ratioB: '' });
      else onChange({ ...config, ratioB: '', ratioA: '' });
      return;
    }
    let v = parseInt(val);
    if (isNaN(v)) return;
    if (v < 0) v = 0;
    if (v > 100) v = 100;
    if (isA) {
      onChange({ ...config, ratioA: v, ratioB: 100 - v });
    } else {
      onChange({ ...config, ratioB: v, ratioA: 100 - v });
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-5 bg-blue-50 text-blue-700 rounded-[14px] border border-blue-100 flex gap-4">
        <Beaker className="w-6 h-6 shrink-0" />
        <p className="text-xs font-bold leading-relaxed">Phân chia lưu lượng Khách hàng ngẫu nhiên để thử nghiệm 2 kịch bản khác nhau.</p>
      </div>
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-400">Tỷ lệ nhánh A (%)</label>
          <input
            type="number"
            value={config.ratioA === '' ? '' : (config.ratioA ?? 50)}
            onChange={(e) => handleRatioChange(e.target.value, true)}
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-[14px] font-black text-xl text-blue-600 outline-none focus:ring-2 focus:ring-blue-200 transition-all"
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-400">Tỷ lệ nhánh B (%)</label>
          <input
            type="number"
            value={config.ratioB === '' ? '' : (config.ratioB ?? 50)}
            onChange={(e) => handleRatioChange(e.target.value, false)}
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-[14px] font-black text-xl text-slate-400 outline-none focus:ring-2 focus:ring-blue-200 transition-all"
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
};

interface StepEditorProps {
  step: FlowStep | null;
  onClose: () => void;
  onSave: (updatedStep: FlowStep) => void;
  onDelete: (id: string) => void;
  onUpdateFlow?: (config: any) => void;
  currentFlowId?: string;
  flow?: Flow;
  allFlows?: Flow[];
  validationErrors?: any[];
  isFlowArchived?: boolean;
  isViewMode?: boolean;
}

const StepEditor: React.FC<StepEditorProps> = ({ 
  step, onClose, onSave, onDelete, onUpdateFlow, flow, allFlows = [], validationErrors = [], isFlowArchived, isViewMode = false
}) => {
  const [localStep, setLocalStep] = useState<FlowStep | null>(step);
  const [showActiveWarning, setShowActiveWarning] = useState(false);

  React.useEffect(() => { setLocalStep(step); }, [step]);

  if (!localStep) return null;

  const handleConfigChange = (newConfig: any, newLabel?: string) => {
    if (isFlowArchived) return;
    setLocalStep(prev => {
      if (!prev) return null;
      const updated = { ...prev, config: newConfig };
      if (newLabel) updated.label = newLabel;
      return updated;
    });
  };

  const stepErrors = validationErrors.filter(e => e.stepId === localStep.id);

  const hasEnrollment = (flow?.stats?.enrolled || 0) > 0;
  const isTriggerLocked = localStep.type === 'trigger' && hasEnrollment;
  const isDisabledForEditing = isFlowArchived || isTriggerLocked || isViewMode;

  const renderConfig = () => {
    switch (localStep.type as string) {
      case 'trigger': return <TriggerConfig config={localStep.config} onChange={handleConfigChange} disabled={isDisabledForEditing} locked={isTriggerLocked} allFlows={allFlows} currentFlowId={flow?.id} />;
      case 'action': return <EmailActionConfig config={localStep.config} onChange={handleConfigChange} disabled={isDisabledForEditing} />;
      case 'wait': return <WaitConfig config={localStep.config} onChange={handleConfigChange} disabled={isDisabledForEditing} />;
      case 'condition': return <ConditionConfig config={localStep.config} onChange={handleConfigChange} flow={flow} stepId={localStep.id} disabled={isDisabledForEditing} />;
      case 'split_test': return <SplitTestConfig config={localStep.config} onChange={handleConfigChange} disabled={isDisabledForEditing} />;
      case 'update_tag': return <UpdateTagConfig config={localStep.config} onChange={handleConfigChange} disabled={isDisabledForEditing} allFlows={allFlows} currentFlowId={flow?.id} />;
      case 'list_action': return <ListActionConfig config={localStep.config} onChange={handleConfigChange} disabled={isDisabledForEditing} />;
      case 'link_flow': return <LinkFlowConfig config={localStep.config} onChange={handleConfigChange} currentFlowId={flow?.id || ''} disabled={isDisabledForEditing} />;
      case 'advanced_condition': return <AdvancedConditionConfig config={localStep.config} onChange={handleConfigChange} flow={flow} stepId={localStep.id} disabled={isDisabledForEditing} />;
      case 'remove_action': return <RemoveActionConfig config={localStep.config} onChange={handleConfigChange} disabled={isDisabledForEditing} />;
      case 'zalo_zns': return <ZaloZNSStepConfig config={localStep.config} onChange={handleConfigChange} disabled={isDisabledForEditing} flow={flow} onUpdateFlow={onUpdateFlow} />;
      case 'crm_action': return <CrmActionConfig config={localStep.config} onChange={handleConfigChange} disabled={isDisabledForEditing} />;
      default: return null;
    }
  };

  const isTrigger = localStep.type === 'trigger';

  const getHeaderStyle = () => {
    if (localStep.type === 'action') return 'from-blue-600 to-indigo-700';
    switch (localStep.type as string) {
      case 'trigger': return 'from-slate-800 to-slate-950';
      case 'update_tag': return 'from-emerald-500 to-emerald-700';
      case 'list_action': return 'from-orange-500 to-orange-700';
      case 'wait': return 'from-amber-400 to-amber-600';
      case 'condition': return 'from-indigo-500 to-indigo-700';
      case 'split_test': return 'from-blue-500 to-blue-700';
      case 'link_flow': return 'from-slate-700 to-slate-900';
      case 'remove_action': return 'from-rose-500 to-rose-700';
      case 'advanced_condition': return 'from-blue-600 to-fuchsia-600';
      case 'zalo_zns': return 'from-blue-500 to-blue-700';
      case 'crm_action': return 'from-indigo-600 to-slate-900';
      default: return 'from-slate-800 to-slate-950';
    }
  };

  const getModalSize = () => {
    if ((localStep.type as string) === 'advanced_condition' || (localStep.type as string) === 'crm_action') return 'xl';
    return 'lg';
  };

  return (
    <>
      <Modal
        isOpen={!!step}
        onClose={onClose}
        title={isTrigger ? "Bắt đầu quy trình" : "Cấu hình bước"}
        size={getModalSize()}
        footer={
          <div className="flex justify-between w-full items-center">
            <div>
              {!isTrigger && (
                <Button 
                  variant="danger" 
                  size="md" 
                  icon={Trash2} 
                  disabled={isDisabledForEditing}
                  onClick={() => {
                    if (flow?.status === 'active') {
                      setShowActiveWarning(true);
                      return;
                    }
                    onDelete(localStep.id);
                  }}
                >
                  Xóa bước
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" size="md" onClick={onClose}>Hủy</Button>
              <Button 
                variant="custom"
                size="md" 
                icon={Save} 
                onClick={() => onSave(localStep)} 
                disabled={isDisabledForEditing}
                className={`flex items-center justify-center font-bold tracking-tight select-none rounded-[var(--radius-md)] px-5 py-2.5 text-xs md:text-sm gap-2 transition-all active:scale-[0.95] ${
                  isDisabledForEditing
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none border-none'
                    : 'bg-[var(--color-primary)] hover:opacity-95 text-white shadow-md border-none'
                }`}
              >
                Lưu thay đổi
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          <div className={`relative p-8 rounded-xl text-white shadow-xl overflow-hidden bg-gradient-to-br ${getHeaderStyle()}`}>
            <div className="absolute -top-10 -right-10 opacity-10 rotate-12"><Sparkles className="w-40 h-40" /></div>
            <div className="relative z-10">
              <input
                className="text-2xl font-black bg-transparent border-none outline-none w-full placeholder:text-white/20 focus:ring-0 p-0 tracking-tight"
                placeholder="Tên gợi nhớ..."
                value={localStep.label}
                onChange={(e) => setLocalStep({ ...localStep, label: e.target.value })}
                disabled={isDisabledForEditing}
              />
              <p className="text-[10px] font-black uppercase text-white/40 mt-3 tracking-[0.3em]">{localStep.type.replace('_', ' ')}</p>
            </div>
          </div>

          {isDisabledForEditing && (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-[14px] flex gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-black text-amber-800 uppercase tracking-wider">Chế độ xem chi tiết</p>
                <p className="text-[11px] font-medium text-amber-700 leading-relaxed">
                  {isFlowArchived 
                    ? "Flow này đã được lưu trữ (Archived) nên không thể thay đổi cấu hình." 
                    : "Bước Trigger này không thể sửa đổi vì đã có khách hàng tham gia vào luồng. Hãy nhân bản Flow nếu bạn muốn thay đổi điều kiện bắt đầu."}
                </p>
              </div>
            </div>
          )}

          {stepErrors.length > 0 && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-[14px] flex gap-3 animate-in fade-in zoom-in-95">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
              <div className="space-y-1">
                {stepErrors.map((e, i) => <p key={i} className="text-xs font-bold text-rose-700">{e.msg}</p>)}
              </div>
            </div>
          )}

          <div className="px-1 pt-2">
            {renderConfig()}
          </div>
        </div>
      </Modal>

      {showActiveWarning && (
        <Modal
          isOpen={true}
          onClose={() => setShowActiveWarning(false)}
          title="KHÔNG THỂ XÓA BƯỚC"
          size="sm"
          footer={
            <Button
              variant="custom"
              size="md"
              onClick={() => setShowActiveWarning(false)}
              className="bg-[var(--color-primary)] hover:opacity-95 text-white shadow-md border-none transition-all active:scale-[0.95] rounded-[var(--radius-md)] px-5 py-2.5 text-xs md:text-sm font-bold"
            >
              Đã hiểu
            </Button>
          }
        >
          <div className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
            <p className="text-sm font-bold text-slate-800 mb-2">Flow đang hoạt động</p>
            <p className="text-xs text-slate-500 leading-relaxed">Bạn cần Tạm dừng (Pause) Flow trước khi có thể xóa các bước bên trong để đảm bảo tính toàn vẹn dữ liệu.</p>
          </div>
        </Modal>
      )}
    </>
  );
};

export default StepEditor;