import React from 'react';
import { Layout, EyeOff, Save } from 'lucide-react';
import Button from '../common/Button';

interface VisibilitySettingsProps {
    settings: any;
    setSettings: (settings: any) => void;
    handleSaveSettings: () => void;
    loading: boolean;
    isDarkTheme?: boolean;
}

const VisibilitySettings: React.FC<VisibilitySettingsProps> = ({
    settings,
    setSettings,
    handleSaveSettings,
    loading,
    isDarkTheme
}) => {
    return (
        <div className={`p-8 rounded-[32px] border mt-8 space-y-6 transition-all duration-500 ${isDarkTheme ? 'bg-slate-800/20 border-slate-700' : 'bg-slate-50/60 border-slate-200'}`}>
            <div className={`flex items-center gap-4 border-b pb-5 ${isDarkTheme ? 'border-slate-800' : 'border-slate-200'}`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border ${isDarkTheme ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-100 text-slate-800'}`}>
                    <Layout className="w-6 h-6" />
                </div>
                <div>
                    <h3 className={`text-lg font-bold ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>Vị trí & Hiển thị</h3>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Tùy chỉnh nơi xuất hiện của Chatbot</p>
                </div>
            </div>

            <div>
                <label className={`text-[10px] font-black uppercase tracking-widest ml-1 mb-3 block ${isDarkTheme ? 'text-slate-300' : 'text-slate-800'}`}>Vị trí Widget trên màn hình</label>
                <div className="grid grid-cols-2 gap-4">
                    <div
                        onClick={() => setSettings({ ...settings, widget_position: 'bottom-right' })}
                        className={`cursor-pointer group relative p-4 rounded-2xl border-2 transition-all duration-300 ${(!settings.widget_position || settings.widget_position === 'bottom-right') ? (isDarkTheme ? 'bg-slate-800 border-brand shadow-lg shadow-brand/10' : 'bg-white border-amber-600 shadow-lg shadow-amber-600/10') : (isDarkTheme ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-slate-50 border-slate-200 hover:border-slate-300')}`}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${(!settings.widget_position || settings.widget_position === 'bottom-right') ? (isDarkTheme ? 'border-brand' : 'border-amber-600') : (isDarkTheme ? 'border-slate-700' : 'border-slate-300')}`}>
                                {(!settings.widget_position || settings.widget_position === 'bottom-right') && <div className={`w-2.5 h-2.5 rounded-full ${isDarkTheme ? 'bg-brand' : 'bg-amber-600'}`} />}
                            </div>
                            <span className={`text-xs font-bold ${(!settings.widget_position || settings.widget_position === 'bottom-right') ? (isDarkTheme ? 'text-slate-100' : 'text-slate-800') : (isDarkTheme ? 'text-slate-500' : 'text-slate-500')}`}>Góc Phải (Mặc định)</span>
                        </div>
                        <div className={`h-16 rounded-lg relative overflow-hidden border ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200/50'}`}>
                            <div className={`absolute bottom-2 right-2 w-6 h-6 rounded-full shadow-sm animate-pulse ${isDarkTheme ? 'bg-slate-700' : 'bg-slate-400'}`}></div>
                            <div className={`absolute top-2 left-2 w-8 h-1 rounded-full ${isDarkTheme ? 'bg-slate-800' : 'bg-slate-300'}`}></div>
                            <div className={`absolute top-4 left-2 w-5 h-1 rounded-full ${isDarkTheme ? 'bg-slate-800' : 'bg-slate-300'}`}></div>
                        </div>
                    </div>

                    <div
                        onClick={() => setSettings({ ...settings, widget_position: 'bottom-left' })}
                        className={`cursor-pointer group relative p-4 rounded-2xl border-2 transition-all duration-300 ${settings.widget_position === 'bottom-left' ? (isDarkTheme ? 'bg-slate-800 border-brand shadow-lg shadow-brand/10' : 'bg-white border-amber-600 shadow-lg shadow-amber-600/10') : (isDarkTheme ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-slate-50 border-slate-200 hover:border-slate-300')}`}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${settings.widget_position === 'bottom-left' ? (isDarkTheme ? 'border-brand' : 'border-amber-600') : (isDarkTheme ? 'border-slate-700' : 'border-slate-300')}`}>
                                {settings.widget_position === 'bottom-left' && <div className={`w-2.5 h-2.5 rounded-full ${isDarkTheme ? 'bg-brand' : 'bg-amber-600'}`} />}
                            </div>
                            <span className={`text-xs font-bold ${settings.widget_position === 'bottom-left' ? (isDarkTheme ? 'text-slate-100' : 'text-slate-800') : (isDarkTheme ? 'text-slate-500' : 'text-slate-500')}`}>Góc Trái</span>
                        </div>
                        <div className={`h-16 rounded-lg relative overflow-hidden border ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200/50'}`}>
                            <div className={`absolute bottom-2 left-2 w-6 h-6 rounded-full shadow-sm animate-pulse ${isDarkTheme ? 'bg-slate-700' : 'bg-slate-400'}`}></div>
                            <div className={`absolute top-2 right-2 w-8 h-1 rounded-full ${isDarkTheme ? 'bg-slate-800' : 'bg-slate-300'}`}></div>
                            <div className={`absolute top-4 right-2 w-5 h-1 rounded-full ${isDarkTheme ? 'bg-slate-800' : 'bg-slate-300'}`}></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className={`space-y-4 pt-4 border-t ${isDarkTheme ? 'border-slate-800' : 'border-slate-100'}`}>
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <label className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${isDarkTheme ? 'text-slate-300' : 'text-slate-800'}`}>
                            Tự động mở
                        </label>
                        <p className="text-[10px] text-slate-400 font-medium">Tự động bung widget khi khách vào web</p>
                    </div>
                    <div
                        onClick={() => setSettings({ ...settings, auto_open: settings.auto_open ? 0 : 1 })}
                        className={`relative w-11 h-6 transition-colors rounded-full cursor-pointer ${settings.auto_open ? 'bg-emerald-500' : (isDarkTheme ? 'bg-slate-700' : 'bg-slate-200')}`}
                    >
                        <span className={`content-[''] absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${settings.auto_open ? 'translate-x-full' : 'translate-x-0'}`} />
                    </div>
                </div>

                {settings.auto_open == 1 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="space-y-1.5">
                            <label className={`text-[10px] font-black uppercase tracking-widest ml-1 flex items-center gap-2 ${isDarkTheme ? 'text-slate-400' : 'text-slate-800'}`}>
                                <EyeOff className="w-3 h-3 text-slate-400" />
                                Tắt tự mở tại trang (URL Cụ thể)
                            </label>
                            <textarea
                                className={`w-full border rounded-xl px-4 py-3 text-[12px] font-mono leading-relaxed outline-none transition-all shadow-sm min-h-[80px] ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-600 focus:border-brand shadow-none' : 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-300 focus:border-amber-600 focus:ring-4 focus:ring-amber-600/5'}`}
                                value={(settings.auto_open_excluded_pages || []).join('\n')}
                                onChange={e => setSettings({ ...settings, auto_open_excluded_pages: e.target.value.split('\n') })}
                                placeholder={`/lien-he\n/gio-hang`}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className={`text-[10px] font-black uppercase tracking-widest ml-1 flex items-center gap-2 ${isDarkTheme ? 'text-slate-400' : 'text-slate-800'}`}>
                                <EyeOff className="w-3 h-3 text-slate-400" />
                                Tắt tự mở (Bắt đầu bằng...)
                            </label>
                            <textarea
                                className={`w-full border rounded-xl px-4 py-3 text-[12px] font-mono leading-relaxed outline-none transition-all shadow-sm min-h-[80px] ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-600 focus:border-brand shadow-none' : 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-300 focus:border-amber-600 focus:ring-4 focus:ring-amber-600/5'}`}
                                value={(settings.auto_open_excluded_paths || []).join('\n')}
                                onChange={e => setSettings({ ...settings, auto_open_excluded_paths: e.target.value.split('\n') })}
                                placeholder={`/checkout\n/payment`}
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 gap-6">
                <div className="space-y-1.5">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 flex items-center gap-2 ${isDarkTheme ? 'text-slate-400' : 'text-slate-800'}`}>
                        <EyeOff className="w-3 h-3 text-slate-400" />
                        Ẩn widget tại trang (URL Cụ thể)
                    </label>
                    <textarea
                        className={`w-full border rounded-xl px-4 py-3 text-[12px] font-mono leading-relaxed outline-none transition-all shadow-sm min-h-[80px] ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-600 focus:border-brand shadow-none' : 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-300 focus:border-amber-600 focus:ring-4 focus:ring-amber-600/5'}`}
                        value={(settings.excluded_pages || []).join('\n')}
                        onChange={e => setSettings({ ...settings, excluded_pages: e.target.value.split('\n') })}
                        placeholder={`/dang-nhap\n/admin/dashboard\nhttps://domain.com/landing-page`}
                    />
                    <p className="text-[9px] text-slate-400 px-1 font-medium italic">Nhập đường dẫn chính xác, mỗi mục 1 dòng.</p>
                </div>

                <div className="space-y-1.5">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 flex items-center gap-2 ${isDarkTheme ? 'text-slate-400' : 'text-slate-800'}`}>
                        <EyeOff className="w-3 h-3 text-slate-400" />
                        Ẩn widget tại trang (Bắt đầu bằng...)
                    </label>
                    <textarea
                        className={`w-full border rounded-xl px-4 py-3 text-[12px] font-mono leading-relaxed outline-none transition-all shadow-sm min-h-[80px] ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-600 focus:border-brand shadow-none' : 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-300 focus:border-amber-600 focus:ring-4 focus:ring-amber-600/5'}`}
                        value={(settings.excluded_paths || []).join('\n')}
                        onChange={e => setSettings({ ...settings, excluded_paths: e.target.value.split('\n') })}
                        placeholder={`/admin\n/private\n/account`}
                    />
                    <p className="text-[9px] text-slate-400 px-1 font-medium italic">Widget sẽ ẩn ở tất cả các trang bắt đầu bằng các đoạn này (Ví dụ: <b>/admin</b> sẽ ẩn cả <b>/admin/settings</b>).</p>
                </div>
            </div>

            <div className="flex gap-4 pt-4">
                <Button size="lg" className="w-full shadow-xl bg-orange-500 hover:bg-orange-600 border-none text-white font-bold shadow-orange-500/30 hover:-translate-y-0.5 transition-all active:translate-y-0" icon={Save} onClick={handleSaveSettings} isLoading={loading}>Lưu cấu hình AI</Button>
            </div>
        </div>
    );
};

export default React.memo(VisibilitySettings);
