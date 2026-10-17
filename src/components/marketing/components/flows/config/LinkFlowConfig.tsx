
import React, { useEffect, useState } from 'react';
import { GitMerge, ArrowRight, Search, AlertOctagon, Activity, CheckCircle2 } from 'lucide-react';
import { api } from '../../../services/storageAdapter';
import { Flow } from '../../../types';
import Input from '../../common/Input';
import Badge from '../../common/Badge';

interface LinkFlowConfigProps {
  config: Record<string, any>;
  onChange: (newConfig: Record<string, any>) => void;
  currentFlowId: string;
  disabled?: boolean;
}

const LinkFlowConfig: React.FC<LinkFlowConfigProps> = ({ config, onChange, currentFlowId, disabled }) => {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFlows = async () => {
      setLoading(true);
      const res = await api.get<any>('flows');
      if (res.success) {
        const rawF = res.data as any;
        const allFlowsList: Flow[] = Array.isArray(rawF) ? rawF : (rawF?.data || []);
        setFlows(allFlowsList.filter(f => {
            const steps: any[] = Array.isArray(f.steps) ? f.steps : (typeof f.steps === 'string' ? (() => { try { return JSON.parse(f.steps as any); } catch { return []; } })() : []);
            const isSelf = f.id === currentFlowId;
            const isArchived = f.status === 'archived';
            const isActive = f.status === 'active';
            const isCampaignTriggered = steps.some(s => s.type === 'trigger' && s.config?.type === 'campaign');
            return !isSelf && !isArchived && isActive && !isCampaignTriggered;
        }));
      }
      setLoading(false);
    };
    fetchFlows();
  }, [currentFlowId]);

  const selectedFlow = flows.find(f => f.id === config.linkedFlowId);
  
  const filteredFlows = flows.filter(f => 
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
       <div className="p-4 bg-blue-50 text-blue-700 rounded-2xl border border-blue-100 flex gap-3">
          <GitMerge className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-xs font-medium leading-relaxed">
             Hành động này sẽ ngắt kịch bản hiện tại và đưa Khách hàng sang một quy trình mới.
             <br/><span className="text-[10px] opacity-70 italic">*Chỉ hiển thị các Flow đang hoạt động (Active) và không phụ thuộc vào Chiến dịch.</span>
          </p>
       </div>

       {config.linkedFlowId && !selectedFlow && !loading && !disabled && (
           <div className="p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl flex items-center gap-3">
               <AlertOctagon className="w-5 h-5 text-rose-600" />
               <div>
                    <p className="text-xs font-black text-rose-800 uppercase tracking-tight">Lỗi liên kết</p>
                    <p className="text-[10px] text-rose-700 font-medium">Flow đã chọn không còn hợp lệ (có thể đã bị tắt hoặc chuyển sang Campaign mode).</p>
               </div>
           </div>
       )}

       <div>
          <label className="block text-sm font-bold text-slate-700 mb-3 ml-1">Chọn kịch bản đích</label>
          <div className="mb-4">
            <Input 
                placeholder="Tìm kịch bản..." 
                icon={Search} 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-50 border-none shadow-inner"
                disabled={disabled}
            />
          </div>
          
          <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar p-1">
             {loading ? (
                 <div className="flex justify-center py-10"><Activity className="w-6 h-6 animate-spin text-slate-200" /></div>
             ) : filteredFlows.length === 0 ? (
                 <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                     <AlertOctagon className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                     <p className="text-xs font-bold text-slate-400">Không tìm thấy kịch bản phù hợp.</p>
                 </div>
             ) : filteredFlows.map((flow) => (
                <label 
                   key={flow.id}
                   onClick={() => { if (!disabled) onChange({ ...config, linkedFlowId: flow.id }); }}
                   className={`
                      flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all group
                      ${config.linkedFlowId === flow.id ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-500/10 shadow-lg' : 'border-slate-50 bg-white hover:border-blue-100'}
                      ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
                   `}
                >
                   <div className="flex items-center gap-4">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${config.linkedFlowId === flow.id ? 'bg-blue-600 border-blue-600' : 'border-slate-200'}`}>
                         {config.linkedFlowId === flow.id && <div className="w-2 h-2 bg-white rounded-full"></div>}
                      </div>
                      <div>
                         <p className="text-sm font-black text-slate-800">{flow.name}</p>
                         <div className="flex items-center gap-2 mt-1">
                             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{flow.steps?.length || 0} BƯỚC</span>
                             <Badge variant="success" className="text-[7px] py-0 px-1.5 h-3.5 uppercase">ACTIVE</Badge>
                         </div>
                      </div>
                   </div>
                   {config.linkedFlowId === flow.id && <CheckCircle2 className="w-5 h-5 text-blue-600" />}
                </label>
             ))}
          </div>
       </div>
    </div>
  );
};

export default LinkFlowConfig;
