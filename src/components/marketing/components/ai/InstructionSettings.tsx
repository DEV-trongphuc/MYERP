import React from 'react';
import { Bot, Settings, ChevronDown } from 'lucide-react';
import Button from '../common/Button';

interface InstructionSettingsProps {
    settings: any;
    setSettings: (s: any) => void;
    onSave: () => void;
    loading: boolean;
    showAdvanced: boolean;
    setShowAdvanced: (b: boolean) => void;
}

const InstructionSettings: React.FC<InstructionSettingsProps> = ({
    settings, setSettings, onSave, loading, showAdvanced, setShowAdvanced
}) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-8">
                <div className="bg-slate-50/50 p-8 rounded-[32px] border border-slate-200 space-y-8 transition-all">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-800 shadow-sm border border-slate-100">
                                <Bot className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">System Instruction</h3>
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Kịch bản & Hướng dẫn hành vi cho AI</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <div className="relative w-full group overflow-hidden rounded-[20px] border-2 border-slate-800 bg-[#1e1e1e] focus-within:border-amber-600 transition-all shadow-inner">
                            <textarea
                                value={settings.system_instruction || ''}
                                onChange={e => setSettings({ ...settings, system_instruction: e.target.value })}
                                rows={35}
                                placeholder={`Bạn là tư vấn viên chuyên nghiệp về lĩnh vực ...\nTONE: Chuyên nghiệp, lịch sự, tư vấn đầy đủ nhưng đúng trọng tâm, KHÔNG emoji, KHÔNG nói kiểu ("theo dữ liệu...").\nXưng 'em', gọi khách 'anh/chị'`}
                                className="relative w-full p-5 bg-transparent text-[11px] font-mono text-slate-300 caret-white outline-none resize-none leading-relaxed z-10 block focus:border-amber-600"
                                style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                            />
                        </div>
                    </div>

                    <div className="pt-6 border-t border-dashed border-slate-200">
                        <div
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className={`flex items-center justify-between cursor-pointer group select-none bg-slate-900 p-4 border border-slate-800 shadow-lg transition-all relative z-20 ${showAdvanced ? 'rounded-t-[20px] border-b-0' : 'rounded-[20px] hover:shadow-xl'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg transition-colors ${showAdvanced ? 'bg-amber-600 text-slate-900' : 'bg-slate-800 text-slate-400 group-hover:text-amber-600'}`}>
                                    <Settings className="w-4 h-4" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-white uppercase tracking-widest">Cài đặt chuyên sâu (Advanced)</h4>
                                    <p className="text-[10px] text-slate-400">Similarity, Top K, Chunk Size...</p>
                                </div>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${showAdvanced ? 'rotate-180' : ''}`} />
                        </div>

                        {showAdvanced && (
                            <div className="bg-slate-900 rounded-b-[20px] p-6 border-x border-b border-t-0 border-slate-800 shadow-xl relative overflow-hidden group space-y-6 animate-in slide-in-from-top-2 -mt-[1px] pt-8 z-10 text-white">
                                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 relative z-10">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-end">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                                                Độ chính xác (Min Score)
                                            </label>
                                            <span className="text-xs font-bold text-amber-600 font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700 shadow-sm">{settings.similarity_threshold || 0.45}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0.1"
                                            max="0.9"
                                            step="0.05"
                                            value={settings.similarity_threshold || 0.45}
                                            onChange={e => setSettings({ ...settings, similarity_threshold: parseFloat(e.target.value) })}
                                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-600 relative z-10"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-end">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                                Số lượng kết quả (Top K)
                                            </label>
                                            <span className="text-xs font-bold text-amber-600 font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700 shadow-sm">{settings.top_k || 12}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="1"
                                            max="30"
                                            step="1"
                                            value={settings.top_k || 12}
                                            onChange={e => setSettings({ ...settings, top_k: parseInt(e.target.value) })}
                                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-600 relative z-10"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-6">
                        <Button variant="primary" onClick={onSave} isLoading={loading}>Lưu cấu hình Script</Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InstructionSettings;
