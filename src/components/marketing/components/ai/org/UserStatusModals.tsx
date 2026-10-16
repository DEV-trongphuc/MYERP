import React from 'react';
import { ShieldAlert, LogOut, MessageCircle, Lock, AlertCircle, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';
import { useChatPage } from '../../../contexts/ChatPageContext';

export const BannedUserModal = () => {
    const { logoutOrgUser } = useChatPage();

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-2xl">
            <div className="max-w-xl w-full">
                {/* Decoration */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-rose-500/10 blur-[120px] rounded-full -z-10" />

                <div className="bg-white/5 border border-white/10 rounded-[48px] p-8 md:p-12 shadow-2xl backdrop-blur-md relative overflow-hidden group">
                    {/* Animated Border Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 via-transparent to-rose-500/5 pointer-events-none" />

                    <div className="relative z-10 flex flex-col items-center text-center">
                        <div className="w-24 h-24 rounded-[32px] bg-rose-500 flex items-center justify-center text-white shadow-2xl shadow-rose-500/40 mb-8 animate-bounce-subtle">
                            <Lock className="w-10 h-10" />
                        </div>

                        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-4 leading-tight">
                            Access Restricted
                        </h1>

                        <div className="bg-rose-500/10 border border-rose-500/20 px-6 py-4 rounded-3xl mb-8 w-full">
                            <p className="text-rose-200 text-sm font-medium leading-relaxed">
                                Your account has been <span className="text-rose-400 font-black uppercase tracking-widest text-xs">suspended</span> due to detected policy violations or administrative action.
                            </p>
                            {useChatPage().orgUser?.status_reason && (
                                <div className="mt-4 pt-4 border-t border-rose-500/20">
                                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1 text-left">Reason:</p>
                                    <p className="text-rose-100/80 text-xs font-medium text-left italic">"{useChatPage().orgUser?.status_reason}"</p>
                                </div>
                            )}
                            {useChatPage().orgUser?.status_expiry && (
                                <div className="mt-2 text-left">
                                    <p className="text-[9px] font-bold text-rose-400/60 uppercase tracking-wider">
                                        Restricted until: {new Date(useChatPage().orgUser!.status_expiry!).toLocaleString('vi-VN')}
                                    </p>
                                </div>
                            )}
                        </div>

                        <p className="text-slate-400 text-sm font-medium mb-10 max-w-sm">
                            If you believe this is a mistake or would like to request an appeal, please contact your organization administrator.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 w-full">
                            <button
                                onClick={() => window.open('mailto:support@example.com')}
                                className="flex-1 px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-white/10"
                            >
                                <HelpCircle className="w-4 h-4" />
                                Support Appeal
                            </button>
                            <button
                                onClick={() => logoutOrgUser()}
                                className="flex-1 px-8 py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl shadow-rose-600/20"
                            >
                                <LogOut className="w-4 h-4" />
                                Return Home
                            </button>
                        </div>
                    </div>

                    {/* Bottom accent */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-rose-500 to-transparent opacity-50" />
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes bounce-subtle {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                .animate-bounce-subtle {
                    animation: bounce-subtle 4s ease-in-out infinite;
                }
            `}} />
        </div>
    );
};

export const WarningUserModal = ({ onContentClick, isDarkTheme }: { onContentClick?: () => void, isDarkTheme?: boolean }) => {
    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-lg animate-in fade-in duration-500 ${isDarkTheme ? 'bg-black/60' : 'bg-slate-900/60'}`}>
            <div className={`max-w-md w-full rounded-[40px] p-10 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.3)] border relative overflow-hidden transition-colors duration-500 ${isDarkTheme ? 'bg-[#1E2532] border-slate-700' : 'bg-white border-white'}`}>
                <div className="absolute top-0 right-0 p-8">
                    <div className={`w-24 h-24 rounded-full blur-3xl ${isDarkTheme ? 'bg-amber-600/10' : 'bg-amber-600/5'}`} />
                </div>

                <div className="relative z-10 flex flex-col items-center text-center">
                    <div className={`w-20 h-20 rounded-[28px] flex items-center justify-center text-amber-600 mb-8 border-4 shadow-xl transition-colors ${isDarkTheme ? 'bg-amber-900/30 border-slate-700' : 'bg-amber-100 border-white'}`}>
                        <AlertCircle className="w-8 h-8" />
                    </div>

                    <h2 className={`text-2xl font-black tracking-tight mb-4 ${isDarkTheme ? 'text-slate-100' : 'text-slate-800'}`}>
                        Policy Reminder
                    </h2>

                    <p className={`text-sm font-bold leading-relaxed mb-4 ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                        Your account has received a <span className="text-amber-600">formal warning</span>. Please review our usage guidelines to ensure continued access to AI features.
                    </p>

                    {useChatPage().orgUser?.status_reason && (
                        <div className={`border p-4 rounded-2xl mb-8 w-full text-left transition-colors ${isDarkTheme ? 'bg-amber-900/10 border-amber-900/30' : 'bg-amber-50 border-amber-100'}`}>
                            <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Observation:</p>
                            <p className={`text-[11px] font-bold italic leading-relaxed ${isDarkTheme ? 'text-slate-300' : 'text-slate-600'}`}>"{useChatPage().orgUser?.status_reason}"</p>
                            {useChatPage().orgUser?.status_expiry && (
                                <p className={`mt-2 text-[9px] font-bold border-t pt-2 uppercase ${isDarkTheme ? 'text-amber-600/40 border-amber-900/30' : 'text-amber-600/60 border-amber-100'}`}>
                                    Valid until: {new Date(useChatPage().orgUser!.status_expiry!).toLocaleString('vi-VN')}
                                </p>
                            )}
                        </div>
                    )}

                    <button
                        onClick={onContentClick}
                        className={`w-full px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-xl ${isDarkTheme ? 'bg-slate-700 text-white hover:bg-slate-600 shadow-black/20' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20'}`}
                    >
                        Accept & Continue
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};
