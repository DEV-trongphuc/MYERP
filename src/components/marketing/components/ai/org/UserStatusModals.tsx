import React from 'react';
import { createPortal } from 'react-dom';
import { LogOut, Lock, AlertCircle, ArrowRight, HelpCircle } from 'lucide-react';
import { useChatPage } from '../../../contexts/ChatPageContext';
import { getMktPortalRoot } from '../../../utils/portalRoot';

export const BannedUserModal = () => {
    const { logoutOrgUser, orgUser } = useChatPage();

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]">
            <div className="max-w-xl w-full">
                {/* Decoration */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-rose-500/10 blur-[120px] rounded-full -z-10" />

                <div className="bg-slate-950/95 border border-white/10 rounded-[18px] p-8 md:p-12 shadow-2xl backdrop-blur-md relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 via-transparent to-rose-500/5 pointer-events-none" />

                    <div className="relative z-10 flex flex-col items-center text-center">
                        <div className="w-20 h-20 rounded-[14px] bg-rose-500 flex items-center justify-center text-white shadow-2xl shadow-rose-500/40 mb-8 animate-bounce-subtle">
                            <Lock className="w-10 h-10" />
                        </div>

                        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-4 leading-tight">
                            Access Restricted
                        </h1>

                        <div className="bg-rose-500/10 border border-rose-500/20 px-6 py-4 rounded-[14px] mb-8 w-full">
                            <p className="text-rose-200 text-sm font-medium leading-relaxed">
                                Your account has been <span className="text-rose-400 font-black uppercase tracking-widest text-xs">suspended</span> due to detected policy violations or administrative action.
                            </p>
                            {orgUser?.status_reason && (
                                <div className="mt-4 pt-4 border-t border-rose-500/20">
                                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1 text-left">Reason:</p>
                                    <p className="text-rose-100/80 text-xs font-medium text-left italic">"{orgUser?.status_reason}"</p>
                                </div>
                            )}
                            {orgUser?.status_expiry && (
                                <div className="mt-2 text-left">
                                    <p className="text-[9px] font-bold text-rose-400/60 uppercase tracking-wider">
                                        Restricted until: {new Date(orgUser.status_expiry).toLocaleString('vi-VN')}
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
                                className="flex-1 px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-[var(--radius-md)] font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-white/10"
                            >
                                <HelpCircle className="w-4 h-4" />
                                Support Appeal
                            </button>
                            <button
                                onClick={() => logoutOrgUser()}
                                className="flex-1 px-8 py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-[var(--radius-md)] font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl shadow-rose-600/20"
                            >
                                <LogOut className="w-4 h-4" />
                                Return Home
                            </button>
                        </div>
                    </div>

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
        </div>,
        getMktPortalRoot()
    );
};

export const WarningUserModal = ({ onContentClick, isDarkTheme }: { onContentClick?: () => void, isDarkTheme?: boolean }) => {
    const { orgUser } = useChatPage();
    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px] animate-in fade-in duration-500">
            <div className={`max-w-md w-full rounded-[18px] p-8 shadow-2xl border relative overflow-hidden transition-colors duration-500 ${isDarkTheme ? 'bg-[#1E2532] border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className="absolute top-0 right-0 p-8">
                    <div className="w-24 h-24 rounded-full blur-3xl bg-[var(--color-primary)]/10" />
                </div>

                <div className="relative z-10 flex flex-col items-center text-center">
                    <div className={`w-16 h-16 rounded-[14px] flex items-center justify-center text-[var(--color-primary)] mb-6 border-2 shadow-xl transition-colors ${isDarkTheme ? 'bg-[var(--color-primary)]/20 border-slate-700' : 'bg-[var(--color-primary)]/10 border-white'}`}>
                        <AlertCircle className="w-8 h-8" />
                    </div>

                    <h2 className={`text-2xl font-black tracking-tight mb-4 ${isDarkTheme ? 'text-slate-100' : 'text-slate-800'}`}>
                        Policy Reminder
                    </h2>

                    <p className={`text-sm font-bold leading-relaxed mb-4 ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                        Your account has received a <span className="text-[var(--color-primary)]">formal warning</span>. Please review our usage guidelines to ensure continued access to AI features.
                    </p>

                    {orgUser?.status_reason && (
                        <div className={`border p-4 rounded-[14px] mb-8 w-full text-left transition-colors ${isDarkTheme ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30' : 'bg-[var(--color-primary)]/5 border-[var(--color-primary)]/20'}`}>
                            <p className="text-[9px] font-black text-[var(--color-primary)] uppercase tracking-widest mb-1">Observation:</p>
                            <p className={`text-[11px] font-bold italic leading-relaxed ${isDarkTheme ? 'text-slate-300' : 'text-slate-600'}`}>"{orgUser?.status_reason}"</p>
                            {orgUser?.status_expiry && (
                                <p className={`mt-2 text-[9px] font-bold border-t pt-2 uppercase ${isDarkTheme ? 'text-[var(--color-primary)]/60 border-[var(--color-primary)]/30' : 'text-[var(--color-primary)]/70 border-[var(--color-primary)]/20'}`}>
                                    Valid until: {new Date(orgUser.status_expiry).toLocaleString('vi-VN')}
                                </p>
                            )}
                        </div>
                    )}

                    <button
                        onClick={onContentClick}
                        className="w-full px-8 py-4 rounded-[var(--radius-md)] font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-xl bg-[var(--color-primary)] text-white hover:brightness-110"
                    >
                        Accept & Continue
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>,
        getMktPortalRoot()
    );
};
