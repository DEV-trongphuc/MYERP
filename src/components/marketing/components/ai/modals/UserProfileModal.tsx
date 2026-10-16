import * as React from 'react';
import { useState, useEffect } from 'react';
import { User, Lock, Sun, Moon, LogOut, Save, X, Shield, Mail, BarChart3, RefreshCcw, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../../../services/storageAdapter';

interface UserProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    orgUser: any;
    isDarkTheme: boolean;
    setIsDarkTheme: (isDark: boolean) => void;
    onLogout: () => void;
    onUpdateUser?: (updatedFields: { full_name?: string, gender?: string }) => void;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({
    isOpen,
    onClose,
    orgUser,
    isDarkTheme,
    setIsDarkTheme,
    onLogout,
    onUpdateUser
}) => {
    const [fullName, setFullName] = useState(orgUser?.full_name || '');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [gender, setGender] = useState(orgUser?.gender || null);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'appearance' | 'stats'>('profile');
    const [statsData, setStatsData] = useState<any>(null);
    const [isLoadingStats, setIsLoadingStats] = useState(false);
    const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
    const [resetStep, setResetStep] = useState(0); // 0: initial, 1: second confirm
    const [resetConfirmText, setResetConfirmText] = useState('');

    useEffect(() => {
        if (isOpen && orgUser) {
            setFullName(orgUser.full_name || '');
            setGender(orgUser.gender || null);
        }
    }, [isOpen, orgUser]);

    const fetchStats = async () => {
        if (isLoadingStats) return;
        setIsLoadingStats(true);
        try {
            const data = await api.get<any>('ai_org_chatbot?action=get_user_stats') as any;
            if (data.success) {
                setStatsData(data.stats ?? data.data?.stats);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingStats(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'stats' && !statsData) {
            fetchStats();
        }
    }, [activeTab]);

    if (!isOpen) return null;

    const handleUpdateProfile = async () => {
        if (activeTab === 'security') {
            if (!password) {
                toast.error('Vui lòng nhập mật khẩu mới');
                return;
            }
            if (password !== confirmPassword) {
                toast.error('Mật khẩu xác nhận không khớp');
                return;
            }
        }

        setIsSaving(true);
        try {
            const result = await api.post('ai_org_auth?action=update_profile', {
                full_name: activeTab === 'profile' ? fullName : undefined,
                gender: activeTab === 'profile' ? gender : undefined,
                password: activeTab === 'security' ? password : undefined
            });

            if (result.success) {
                toast.success('Cập nhật thông tin thành công');
                if (activeTab === 'profile' && onUpdateUser) {
                    onUpdateUser({ full_name: fullName, gender: gender });
                }
                if (activeTab === 'security') {
                    setPassword('');
                    setConfirmPassword('');
                }
            } else {
                toast.error(result.message || 'Cập nhật thất bại');
            }
        } catch (error) {
            toast.error('Lỗi kết nối máy chủ');
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetHistory = async () => {
        setIsSaving(true);
        try {
            const data = await api.post<any>('ai_org_chatbot?action=reset_history', {});
            if (data.success) {
                toast.success('Đã làm mới dữ liệu thành công');
                setIsResetConfirmOpen(false);
                setResetStep(0);
                setStatsData(null); // Reset local stats
                if (activeTab === 'stats') fetchStats();
                // Optionally reload page or update parent state to reflect messages are gone
                setTimeout(() => window.location.reload(), 1500);
            } else {
                toast.error(data.message || 'Lỗi khi reset');
            }
        } catch (e) {
            toast.error('Lỗi kết nối máy chủ');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/70 anim-backdrop-in" onClick={onClose} />

            <div className={`relative w-full max-w-4xl overflow-hidden rounded-[32px] shadow-2xl border transition-all duration-500 anim-modal-in ${isDarkTheme ? 'bg-[#0D1117] border-slate-800' : 'bg-white border-slate-100'}`}>

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-800/10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center text-brand">
                            <User className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className={`text-xl font-black uppercase tracking-tight ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>Tài khoản cá nhân</h2>
                            <p className="text-sm text-slate-400 font-medium">Quản lý thông tin và cài đặt của bạn</p>
                        </div>
                    </div>
                    <button onClick={onClose} className={`p-2 rounded-xl transition-colors ${isDarkTheme ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-50 text-slate-500'}`}>
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex flex-col md:flex-row min-h-[400px]">
                    {/* Sidebar Tabs */}
                    <div className={`w-full md:w-64 p-4 space-y-2 border-r ${isDarkTheme ? 'border-slate-800 bg-black/20' : 'border-slate-50 bg-slate-50/30'}`}>
                        <button
                            onClick={() => setActiveTab('profile')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${activeTab === 'profile' ? 'bg-brand text-white shadow-brand' : (isDarkTheme ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-white')}`}
                        >
                            <User className="w-4 h-4" /> Thông tin cá nhân
                        </button>
                        <button
                            onClick={() => setActiveTab('security')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${activeTab === 'security' ? 'bg-brand text-white shadow-brand' : (isDarkTheme ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-white')}`}
                        >
                            <Lock className="w-4 h-4" /> Bảo mật
                        </button>
                        <button
                            onClick={() => setActiveTab('appearance')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${activeTab === 'appearance' ? 'bg-brand text-white shadow-brand' : (isDarkTheme ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-white')}`}
                        >
                            {isDarkTheme ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />} Giao diện
                        </button>
                        <button
                            onClick={() => setActiveTab('stats')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${activeTab === 'stats' ? 'bg-brand text-white shadow-brand' : (isDarkTheme ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-white')}`}
                        >
                            <BarChart3 className="w-4 h-4" /> Thống kê
                        </button>

                        <div className="pt-4 mt-4 border-t border-slate-800/10 space-y-2">
                            <button
                                onClick={() => { setIsResetConfirmOpen(true); setResetStep(0); }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all text-orange-500 hover:bg-orange-500/10`}
                            >
                                <RefreshCcw className="w-4 h-4" /> Làm mới dữ liệu
                            </button>
                            <button
                                onClick={onLogout}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all text-rose-500 hover:bg-rose-500/10`}
                            >
                                <LogOut className="w-4 h-4" /> Đăng xuất
                            </button>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 p-8 overflow-y-auto max-h-[500px] custom-scrollbar">
                        {activeTab === 'profile' && (
                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                <div>
                                    <label className={`block text-xs font-black uppercase tracking-widest mb-2 ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>Tên hiển thị</label>
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand transition-colors" />
                                        <input
                                            type="text"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            className={`w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 outline-none transition-all font-bold ${isDarkTheme ? 'bg-slate-900 border-slate-800 text-white focus:border-brand/50' : 'bg-slate-50 border-slate-100 text-slate-900 focus:bg-white focus:border-brand/50'}`}
                                            placeholder="Nhập tên của bạn..."
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className={`block text-xs font-black uppercase tracking-widest mb-2 ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>Giới tính</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { id: 'male', label: 'Nam', icon: '👨' },
                                            { id: 'female', label: 'Nữ', icon: '👩' },
                                            { id: 'other', label: 'Khác', icon: '👤' }
                                        ].map(g => (
                                            <button
                                                key={g.id}
                                                type="button"
                                                onClick={() => setGender(g.id)}
                                                className={`flex flex-col items-center justify-center gap-1 p-3 rounded-2xl border-2 transition-all ${gender === g.id ? 'bg-brand/10 border-brand text-brand shadow-lg shadow-brand/10 scale-[1.02]' : (isDarkTheme ? 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700' : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-200')}`}
                                            >
                                                <span className="text-xl">{g.icon}</span>
                                                <span className="text-xs font-bold">{g.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className={`block text-xs font-black uppercase tracking-widest mb-2 ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>Email (Cố định)</label>
                                    <div className="relative opacity-60">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="email"
                                            value={orgUser?.email || ''}
                                            disabled
                                            className={`w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 outline-none font-bold ${isDarkTheme ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
                                        />
                                    </div>
                                </div>
                                <div className="pt-4">
                                    <button
                                        onClick={handleUpdateProfile}
                                        disabled={isSaving || (fullName === orgUser?.full_name && gender === orgUser?.gender)}
                                        className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black uppercase tracking-widest transition-all ${isSaving || (fullName === orgUser?.full_name && gender === orgUser?.gender) ? 'bg-slate-800 text-slate-600' : 'bg-brand text-white shadow-brand hover:scale-[1.02] active:scale-95'}`}
                                    >
                                        <Save className="w-5 h-5" /> {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'security' && (
                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                <div>
                                    <label className={`block text-xs font-black uppercase tracking-widest mb-2 ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>Mật khẩu mới</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand transition-colors" />
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className={`w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 outline-none transition-all font-bold ${isDarkTheme ? 'bg-slate-900 border-slate-800 text-white focus:border-brand/50' : 'bg-slate-50 border-slate-100 text-slate-900 focus:bg-white focus:border-brand/50'}`}
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className={`block text-xs font-black uppercase tracking-widest mb-2 ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>Xác nhận mật khẩu</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand transition-colors" />
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className={`w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 outline-none transition-all font-bold ${isDarkTheme ? 'bg-slate-900 border-slate-800 text-white focus:border-brand/50' : 'bg-slate-50 border-slate-100 text-slate-900 focus:bg-white focus:border-brand/50'}`}
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                                <div className="pt-4">
                                    <button
                                        onClick={handleUpdateProfile}
                                        disabled={isSaving || !password}
                                        className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black uppercase tracking-widest transition-all ${isSaving || !password ? 'bg-slate-800 text-slate-600' : 'bg-brand text-white shadow-brand hover:scale-[1.02] active:scale-95'}`}
                                    >
                                        <Shield className="w-5 h-5" /> {isSaving ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'appearance' && (
                            <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                                <div>
                                    <h4 className={`text-sm font-bold mb-4 ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Chủ đề ứng dụng</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => {
                                                setIsDarkTheme(false);
                                                localStorage.setItem('theme', 'light');
                                            }}
                                            className={`p-6 rounded-[24px] border-2 transition-all flex flex-col items-center gap-3 ${!isDarkTheme ? 'bg-brand/5 border-brand ring-4 ring-brand/10' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}
                                        >
                                            <div className={`p-4 rounded-2xl ${!isDarkTheme ? 'bg-brand text-white shadow-brand' : 'bg-slate-800 text-slate-400'}`}>
                                                <Sun className="w-8 h-8" />
                                            </div>
                                            <span className={`font-bold ${!isDarkTheme ? 'text-brand' : 'text-slate-400'}`}>Giao diện sáng</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsDarkTheme(true);
                                                localStorage.setItem('theme', 'dark');
                                            }}
                                            className={`p-6 rounded-[24px] border-2 transition-all flex flex-col items-center gap-3 ${isDarkTheme ? 'bg-brand/5 border-brand ring-4 ring-brand/10' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
                                        >
                                            <div className={`p-4 rounded-2xl ${isDarkTheme ? 'bg-brand text-white shadow-brand' : 'bg-white text-slate-400 border border-slate-200'}`}>
                                                <Moon className="w-8 h-8" />
                                            </div>
                                            <span className={`font-bold ${isDarkTheme ? 'text-brand' : 'text-slate-400'}`}>Giao diện tối</span>
                                        </button>
                                    </div>
                                </div>

                                <div className={`p-6 rounded-[24px] border-2 border-dashed ${isDarkTheme ? 'border-slate-800' : 'border-slate-200'}`}>
                                    <p className={`text-xs text-center leading-relaxed ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>
                                        Thay đổi giao diện sẽ được áp dụng ngay lặp tức và lưu lại cho lần đăng nhập sau của bạn.
                                    </p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'stats' && (
                            <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                                {/* Counters */}
                                <div className="grid grid-cols-3 gap-4">
                                    {[
                                        { label: 'Hội thoại', val: statsData?.counters?.total_convs || 0, color: 'text-brand' },
                                        { label: 'Tin nhắn', val: statsData?.counters?.total_msgs || 0, color: 'text-blue-500' },
                                        { label: 'Bot đã dùng', val: statsData?.counters?.total_bots || 0, color: 'text-emerald-500' },
                                    ].map((c, i) => (
                                        <div key={i} className={`p-4 rounded-2xl border ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">{c.label}</p>
                                            <p className={`text-xl font-black ${c.color}`}>{isLoadingStats ? '...' : c.val}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Heatmap */}
                                <div>
                                    <h4 className={`text-xs font-black uppercase tracking-widest mb-4 ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>Hoạt động 30 ngày qua</h4>
                                    <div className={`p-6 rounded-3xl border flex flex-col items-center ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                                        <div className="grid grid-cols-10 gap-2">
                                            {Array.from({ length: 30 }).map((_, i) => {
                                                const d = new Date();
                                                d.setDate(d.getDate() - (29 - i));
                                                const dStr = d.toISOString().split('T')[0];
                                                const hit = statsData?.heatmap?.find((h: any) => h.date === dStr);
                                                const count = hit ? parseInt(hit.count) : 0;

                                                // Level-based Emerald colors
                                                let bgColor = isDarkTheme ? 'bg-slate-800' : 'bg-slate-200';
                                                if (count > 0) {
                                                    if (count < 5) bgColor = 'bg-emerald-500/20';
                                                    else if (count < 10) bgColor = 'bg-emerald-500/40';
                                                    else if (count < 20) bgColor = 'bg-emerald-500/70';
                                                    else bgColor = 'bg-emerald-500';
                                                }

                                                return (
                                                    <div
                                                        key={i}
                                                        title={`${dStr}: ${count} tin nhắn`}
                                                        className={`w-6 h-6 sm:w-8 sm:h-8 rounded-md transition-all hover:scale-110 cursor-help ${bgColor}`}
                                                    />
                                                );
                                            })}
                                        </div>
                                        <p className="text-[9px] text-slate-500 mt-6 font-bold uppercase tracking-widest text-center">Biểu đồ mức độ tương tác cá nhân</p>
                                    </div>
                                </div>

                                {/* Top Bots Table */}
                                <div>
                                    <h4 className={`text-xs font-black uppercase tracking-widest mb-4 ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>Chatbot được dùng nhiều nhất</h4>
                                    <div className={`rounded-3xl border overflow-hidden ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                                        <table className="w-full text-left text-xs">
                                            <thead>
                                                <tr className={isDarkTheme ? 'bg-black/20' : 'bg-slate-100/50'}>
                                                    <th className="px-5 py-3 font-black uppercase tracking-widest text-slate-500">Tên Assistant</th>
                                                    <th className="px-5 py-3 font-black uppercase tracking-widest text-slate-500 text-right">Hội thoại</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800/10">
                                                {statsData?.bots?.map((b: any, i: number) => (
                                                    <tr key={i} className={isDarkTheme ? 'hover:bg-black/20' : 'hover:bg-slate-100/20'}>
                                                        <td className={`px-5 py-3 font-bold ${isDarkTheme ? 'text-slate-300' : 'text-slate-700'}`}>{b.name}</td>
                                                        <td className="px-5 py-3 text-right font-black text-brand">{b.conv_count}</td>
                                                    </tr>
                                                ))}
                                                {(!statsData?.bots || statsData.bots.length === 0) && !isLoadingStats && (
                                                    <tr><td colSpan={2} className="px-5 py-8 text-center text-slate-500 font-bold uppercase tracking-widest opacity-50 text-[10px]">Chưa có dữ liệu thống kê</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Reset Confirmation Overlay */}
                {isResetConfirmOpen && (
                    <div className="absolute inset-0 z-[100] bg-slate-950/85 flex items-center justify-center p-6 anim-fade-in">
                        <div className={`w-full max-w-md p-8 rounded-[32px] border text-center space-y-6 anim-scale-in ${isDarkTheme ? 'bg-[#0D1117] border-slate-700 shadow-2xl shadow-rose-500/20' : 'bg-white border-slate-200 shadow-2xl'}`}>
                            <div className="w-20 h-20 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 mx-auto">
                                <AlertTriangle className="w-10 h-10 animate-bounce" />
                            </div>

                            {resetStep === 0 ? (
                                <>
                                    <div className="space-y-2">
                                        <h3 className={`text-xl font-black uppercase tracking-tight ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>CẢNH BÁO LÀM MỚI</h3>
                                        <p className="text-sm text-slate-400 font-medium leading-relaxed">
                                            Hành động này sẽ <span className="text-rose-500 font-black">XÓA TOÀN BỘ</span> lịch sử hội thoại và tin nhắn của bạn. Dữ liệu Workspace Global sẽ được giữ lại.
                                        </p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-amber-600/10 border border-amber-600/20 text-xs font-bold text-amber-600 text-left flex items-start gap-3">
                                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                                        <span>Hãy sử dụng nút "Make Global" cho các file quan trọng trong Workspace trước khi thực hiện làm mới!</span>
                                    </div>
                                    <div className="flex gap-3">
                                        <button onClick={() => setIsResetConfirmOpen(false)} className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-xs ${isDarkTheme ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>Hủy bỏ</button>
                                        <button onClick={() => {
                                            setResetStep(1);
                                            setResetConfirmText('');
                                        }} className="flex-1 py-4 rounded-2xl bg-rose-500 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-rose-500/20">Tiếp tục</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="space-y-3">
                                        <h3 className="text-xl font-black uppercase tracking-tight text-rose-500">XÁC NHẬN LẦN CUỐI</h3>
                                        <p className="text-sm text-slate-400 font-medium leading-relaxed">
                                            Vui lòng nhập <span className="text-white font-black bg-rose-500 px-2 py-0.5 rounded">RESET</span> để xác nhận xóa vĩnh viễn. Hành động này không thể hoàn tác.
                                        </p>
                                        <input
                                            type="text"
                                            value={resetConfirmText}
                                            onChange={(e) => setResetConfirmText(e.target.value.toUpperCase())}
                                            placeholder="Gõ RESET tại đây..."
                                            className={`w-full px-4 py-3 rounded-xl border-2 text-center font-black tracking-widest outline-none transition-all ${isDarkTheme ? 'bg-slate-900 border-slate-700 text-white focus:border-rose-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-rose-500'}`}
                                        />
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button onClick={() => setResetStep(0)} className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-xs ${isDarkTheme ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>Quay lại</button>
                                        <button
                                            onClick={handleResetHistory}
                                            disabled={isSaving || resetConfirmText !== 'RESET'}
                                            className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl transition-all ${resetConfirmText === 'RESET' ? 'bg-rose-600 text-white shadow-rose-600/30' : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'}`}
                                        >
                                            {isSaving ? 'Đang xóa...' : 'XÓA NGAY'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserProfileModal;
