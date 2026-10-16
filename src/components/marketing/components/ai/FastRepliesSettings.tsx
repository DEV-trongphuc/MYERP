import * as React from 'react';
import { useState } from 'react';
import { Zap, Plus, Hash, MessageSquare, Trash2, Edit2, CheckCircle2, CornerDownRight } from 'lucide-react';
import Button from '../common/Button';
import Input from '../common/Input';

interface FastReply {
    pattern: string;
    reply: string;
}

interface FastRepliesSettingsProps {
    settings: any;
    setSettings: (settings: any) => void;
    isDarkTheme?: boolean;
}

const FastRepliesSettings: React.FC<FastRepliesSettingsProps> = ({ settings, setSettings, isDarkTheme }) => {
    const [newFastReply, setNewFastReply] = useState<FastReply>({ pattern: '', reply: '' });
    const [editingIdx, setEditingIdx] = useState<number | null>(null);

    const addFastReply = () => {
        if (!newFastReply.pattern || !newFastReply.reply) return;
        setSettings({
            ...settings,
            fast_replies: [...(settings.fast_replies || []), newFastReply]
        });
        setNewFastReply({ pattern: '', reply: '' });
    };

    const removeFastReply = (idx: number) => {
        setSettings({
            ...settings,
            fast_replies: (settings.fast_replies || []).filter((_, i: number) => i !== idx)
        });
    };

    const updateFastReply = (idx: number, field: keyof FastReply, value: string) => {
        const newFR = [...(settings.fast_replies || [])];
        newFR[idx][field] = value;
        setSettings({ ...settings, fast_replies: newFR });
    };

    return (
        <div className={`pt-6 border-t border-dashed space-y-5 ${isDarkTheme ? 'border-slate-800' : 'border-slate-200'}`}>
            <div className="flex items-center gap-2 ml-1">
                <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>
                    Phối hợp phản hồi nhanh - Tiết kiệm TOKEN AI và tránh truy xuất Knowledge không cần thiết.
                </label>
                <Zap className="w-3.5 h-3.5 text-amber-600" />
            </div>

            {/* Input Area - Simplified */}
            <div className={`p-5 rounded-[24px] border shadow-sm space-y-4 transition-all duration-500 ${isDarkTheme ? 'bg-slate-800/20 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            Từ khóa (Cách nhau bằng dấu phẩy)
                        </label>
                        <input
                            className={`w-full h-11 px-4 border rounded-xl text-xs font-medium outline-none transition-all ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-600 focus:border-brand shadow-none' : 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-300 focus:border-amber-600 focus:ring-4 focus:ring-amber-600/5'}`}
                            placeholder="VD: chào, hi, hello"
                            value={newFastReply.pattern}
                            onChange={e => setNewFastReply({ ...newFastReply, pattern: e.target.value })}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            Nội dung phản hồi
                        </label>
                        <div className="flex gap-2">
                            <input
                                className={`flex-1 h-11 px-4 border rounded-xl text-xs font-medium outline-none transition-all ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-600 focus:border-brand shadow-none' : 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-300 focus:border-amber-600 focus:ring-4 focus:ring-amber-600/5'}`}
                                placeholder="Chào bạn! Mình có thể..."
                                value={newFastReply.reply}
                                onChange={e => setNewFastReply({ ...newFastReply, reply: e.target.value })}
                            />
                            <Button className="h-11 px-6 bg-gradient-to-r from-amber-600 to-amber-600 border-none text-white font-bold shadow-lg shadow-amber-600/20 hover:shadow-amber-600/40 transition-all" icon={Plus} onClick={addFastReply}>Thêm</Button>
                        </div>
                    </div>
                </div>

                {/* Variable Hint */}
                <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${isDarkTheme ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="w-1 h-1 bg-slate-400 rounded-full mt-1.5 shrink-0" />
                    <p className={`text-[10px] leading-relaxed ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                        Mẹo: Sử dụng biến <span className={`font-mono font-bold px-1 rounded border ${isDarkTheme ? 'text-slate-200 bg-slate-800 border-slate-700' : 'text-slate-700 bg-white border-slate-200'}`}>{`{botName}`}</span> và <span className={`font-mono font-bold px-1 rounded border ${isDarkTheme ? 'text-slate-200 bg-slate-800 border-slate-700' : 'text-slate-700 bg-white border-slate-200'}`}>{`{companyName}`}</span> để hệ thống tự động điền tên Bot và Công ty của bạn vào câu trả lời.
                    </p>
                </div>
            </div>

            {/* List Area */}
            <div className="space-y-3">
                {(settings.fast_replies || []).map((fr: FastReply, idx: number) => (
                    <div key={idx} className={`border rounded-[20px] p-1.5 hover:shadow-md transition-all duration-300 group ${isDarkTheme ? 'bg-slate-800/20 border-slate-700 hover:border-slate-600 hover:bg-slate-800/40' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                        {editingIdx === idx ? (
                            <div className="space-y-4 p-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                        Từ khóa (Keywords)
                                    </label>
                                    <input
                                        type="text"
                                        className={`w-full border rounded-xl px-4 py-3 text-xs font-bold outline-none transition-all shadow-sm ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-200 focus:border-brand shadow-none' : 'bg-white border-slate-200 text-slate-700 focus:border-amber-600 focus:ring-4 focus:ring-amber-600/5'}`}
                                        value={fr.pattern}
                                        onChange={e => updateFastReply(idx, 'pattern', e.target.value)}
                                        placeholder="chào, hi, hello..."
                                    />
                                    <div className="flex flex-wrap gap-1.5 mt-2 ml-1">
                                        {fr.pattern.split(',').map((kw: string, i: number) => kw.trim() ? (
                                            <span key={i} className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                                                {kw.trim()}
                                            </span>
                                        ) : null)}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                        Nội dung phản hồi
                                    </label>
                                    <textarea
                                        className={`w-full border rounded-xl px-4 py-3 text-xs font-medium leading-relaxed outline-none transition-all shadow-sm min-h-[80px] resize-none ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-600 focus:border-brand shadow-none' : 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-300 focus:border-amber-600 focus:ring-4 focus:ring-amber-600/5'}`}
                                        value={fr.reply}
                                        onChange={e => updateFastReply(idx, 'reply', e.target.value)}
                                        placeholder="Nhập nội dung..."
                                    />
                                </div>

                                {/* Helper Note in Editing Mode */}
                                <div className="ml-1">
                                    <p className="text-[10px] text-slate-400">
                                        Mẹo: Dùng <span className="font-mono text-slate-600 font-bold">{`{botName}`}</span>, <span className="font-mono text-slate-600 font-bold">{`{companyName}`}</span> để tự động điền.
                                    </p>
                                </div>

                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => setEditingIdx(null)}
                                        className={`px-6 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all shadow-lg ${isDarkTheme ? 'bg-brand hover:bg-brand-dark text-white' : 'bg-slate-900 hover:bg-black text-white'}`}
                                    >
                                        Hoàn tất
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-start justify-between p-3 pl-4">
                                <div className="flex-1 space-y-3">
                                    {/* Keywords Row */}
                                    <div className="flex items-center gap-3">
                                        <div className={`w-5 h-5 flex items-center justify-center rounded-md border shrink-0 ${isDarkTheme ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                            <Hash className="w-3 h-3 text-slate-400" />
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {fr.pattern.split(',').map((kw: string, i: number) => kw.trim() ? (
                                                <span key={i} className={`text-[11px] font-medium px-2 py-0.5 rounded-full border transition-colors cursor-default ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-brand hover:text-brand' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-200 hover:text-blue-600'}`}>
                                                    {kw.trim()}
                                                </span>
                                            ) : null)}
                                        </div>
                                    </div>

                                    {/* Reply Row */}
                                    <div className="flex items-start gap-3">
                                        <div className={`w-5 h-5 flex items-center justify-center rounded-md border shrink-0 mt-0.5 ${isDarkTheme ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                            <CornerDownRight className="w-3 h-3 text-slate-400" />
                                        </div>
                                        <p className={`text-[12px] font-medium leading-relaxed pt-0.5 ${isDarkTheme ? 'text-slate-300' : 'text-slate-600'}`}>{fr.reply}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity self-center">
                                    <button
                                        onClick={() => setEditingIdx(idx)}
                                        className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => removeFastReply(idx)}
                                        className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {(settings.fast_replies || []).length === 0 && (
                    <div className={`py-12 text-center border-2 border-dashed rounded-[24px] ${isDarkTheme ? 'bg-slate-800/20 border-slate-700' : 'bg-slate-50/50 border-slate-100'}`}>
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 border shadow-sm ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-600' : 'bg-white border-slate-50 text-slate-200'}`}>
                            <Zap className="w-6 h-6" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Chưa có phản hồi nhanh</h4>
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(FastRepliesSettings);
