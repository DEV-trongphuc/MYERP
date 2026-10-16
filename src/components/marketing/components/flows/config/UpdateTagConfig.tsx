
import React, { useEffect, useState, useMemo } from 'react';
import { Tag, Plus, X, AlertCircle, Sparkles, Search, Check, Minus, ArrowRightCircle, Info } from 'lucide-react';
import { api } from '../../../services/storageAdapter';
import { Flow } from '../../../types';

interface UpdateTagConfigProps {
  config: Record<string, any>;
  onChange: (newConfig: Record<string, any>) => void;
  disabled?: boolean;
  allFlows?: Flow[];
  currentFlowId?: string;
}

const UpdateTagConfig: React.FC<UpdateTagConfigProps> = ({ config, onChange, disabled, allFlows = [], currentFlowId }) => {
  const [globalTags, setGlobalTags] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const tags = config.tags || [];
  const action = config.action || 'add'; // 'add' | 'remove'

  useEffect(() => {
    const fetchTags = async () => {
        const res = await api.get<{id: string, name: string}[]>('tags');
        if (res.success && Array.isArray(res.data)) {
            setGlobalTags(res.data.map(t => t.name));
        }
    };
    fetchTags();
  }, []);

  // Map các nhãn đang làm Trigger cho các Flow khác
  const tagTriggerMap = useMemo(() => {
    const map: Record<string, string> = {};
    allFlows.forEach(f => {
      if (f.id === currentFlowId || f.status === 'archived') return;
      const trigger = f.steps?.find(s => s.type === 'trigger');
      if (trigger?.config.type === 'tag' && trigger.config.targetId) {
        map[trigger.config.targetId] = f.name;
      }
    });
    return map;
  }, [allFlows, currentFlowId]);

  const toggleTag = (t: string) => {
    if (disabled) return;
    if (tags.includes(t)) {
        onChange({ ...config, tags: tags.filter((x: string) => x !== t) });
    } else {
        onChange({ ...config, tags: [...tags, t] });
    }
    if (!tags.includes(t)) setSearch(''); 
  };

  const handleActionChange = (newAction: string) => {
      if (disabled) return;
      onChange({ ...config, action: newAction });
  };

  const filtered = globalTags.filter(t => t.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-20">
      <div className={`p-5 rounded-[28px] border flex gap-4 items-center shadow-sm transition-colors ${action === 'remove' ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
        <Sparkles className="w-6 h-6 shrink-0" />
        <p className="text-[11px] font-bold leading-relaxed">
            {action === 'remove' 
                ? 'Hệ thống sẽ GỠ bỏ các nhãn dưới đây khỏi hồ sơ Khách hàng (nếu có).' 
                : 'Hệ thống sẽ GẮN thêm các nhãn dưới đây vào hồ sơ Khách hàng để phân loại.'}
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
                onClick={() => handleActionChange('add')}
                disabled={disabled}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${action === 'add' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <Plus className="w-4 h-4" /> Gắn nhãn (Add)
            </button>
            <button
                onClick={() => handleActionChange('remove')}
                disabled={disabled}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${action === 'remove' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <Minus className="w-4 h-4" /> Gỡ nhãn (Remove)
            </button>
        </div>

        {/* Selected Tags Display */}
        <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Nhãn đã chọn ({tags.length})</label>
            <div className={`flex flex-col gap-2 p-2 rounded-2xl border-2 border-dashed bg-slate-50/50 ${action === 'remove' ? 'border-rose-200' : 'border-emerald-200'}`}>
                {tags.length > 0 ? tags.map((t: string) => {
                    const linkedFlowName = action === 'add' ? tagTriggerMap[t] : null;
                    return (
                        <div key={t} className="flex flex-col gap-1 p-2 bg-white border border-slate-200 rounded-xl shadow-sm animate-in zoom-in-95">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Tag className={`w-3.5 h-3.5 ${action === 'remove' ? 'text-rose-500' : 'text-emerald-500'}`} />
                                    <span className="text-xs font-bold text-slate-700">{t}</span>
                                </div>
                                <button 
                                    onClick={() => toggleTag(t)}
                                    disabled={disabled}
                                    className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X className="w-3 h-3 text-slate-400" />
                                </button>
                            </div>
                            
                            {linkedFlowName && (
                                <div className="mt-1 flex items-center gap-1.5 px-2 py-1 bg-orange-50 border border-orange-100 rounded-lg text-[9px] text-orange-700 font-bold animate-in slide-in-from-top-1">
                                    <ArrowRightCircle className="w-3 h-3" />
                                    <span>Lưu ý: Nhãn này sẽ kích hoạt tiếp Flow: <span className="underline italic">"{linkedFlowName}"</span></span>
                                </div>
                            )}
                        </div>
                    );
                }) : (
                    <span className="text-xs text-slate-400 font-medium italic w-full text-center py-4">Chưa có nhãn nào được chọn</span>
                )}
            </div>
        </div>

        {/* Search & Picker */}
        <div className="pt-4">
            <div className="flex justify-between items-center px-1 mb-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chọn Nhãn từ kho</label>
            </div>

            <div className="relative mb-4">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="Tìm nhãn nhanh..." 
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    disabled={disabled}
                />
            </div>

            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar p-1">
                {search && !globalTags.some(t => t.toLowerCase() === search.toLowerCase()) && (
                  <button 
                    onClick={() => {
                      const newTag = search.trim();
                      if (newTag) {
                        setGlobalTags(prev => [...prev, newTag]);
                        toggleTag(newTag);
                      }
                    }}
                    disabled={disabled}
                    className="px-4 py-2.5 rounded-xl text-xs font-black border-2 border-dashed border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all flex items-center gap-2 animate-in zoom-in-95"
                  >
                    <Plus className="w-4 h-4" /> Tạo nhãn mới: "{search}"
                  </button>
                )}
                {filtered.map(t => {
                    const isSelected = tags.includes(t);
                    const isTrigger = action === 'add' && !!tagTriggerMap[t];
                    return (
                        <button 
                            key={t}
                            onClick={() => toggleTag(t)}
                            className={`px-4 py-2.5 rounded-xl text-xs font-black border-2 transition-all flex items-center gap-2 relative ${isSelected ? (action === 'remove' ? 'border-rose-500 bg-rose-500 text-white shadow-lg shadow-rose-200' : 'border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-200') + ' order-first' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                            disabled={disabled}
                        >
                            {isSelected ? (action === 'remove' ? <Minus className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />) : <Tag className="w-3.5 h-3.5" />}
                            {t}
                            {!isSelected && isTrigger && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-500 rounded-full border-2 border-white ring-1 ring-orange-200" title="Nhãn này có kịch bản liên kết"></div>}
                        </button>
                    );
                })}
                {globalTags.length === 0 && !search && <p className="text-xs text-slate-400 italic">Chưa có nhãn nào trong kho. Hãy nhập để tạo mới.</p>}
            </div>
        </div>
      </div>

      {tags.length === 0 && !disabled && (
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 animate-pulse">
              <AlertCircle className="w-4 h-4 text-rose-500" />
              <p className="text-[10px] font-black text-rose-700 uppercase">Yêu cầu ít nhất 1 nhãn để lưu bước này</p>
          </div>
      )}
    </div>
  );
};

export default UpdateTagConfig;
