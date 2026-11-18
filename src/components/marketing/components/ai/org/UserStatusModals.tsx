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
                <div className="bg-slate-950 border border-white/10 rounded-2xl p-8 md:p-10 shadow-2xl relative overflow-hidden">
                    <div className="relative z-10 flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-xl bg-[#BD1D2D] flex items-center justify-center text-white mb-6">
                            <Lock className="w-8 h-8" strokeWidth={1.75} />
                        </div>

                        <h1 className="text-3xl font-bold text-white tracking-tight mb-4 leading-tight">
                            Access Restricted
                        </h1>

                        <div className="bg-rose-500/10 border border-rose-500/20 px-6 py-4 rounded-xl mb-6 w-full">
                            <p className="text-rose-200 text-sm font-medium leading-relaxed">
                                Your account has been <span className="text-rose-400 font-bold uppercase tracking-wider text-xs">suspended</span> due to detected policy violations or administrative action.
                            </p>
                            {orgUser?.status_reason && (
                                <div className="mt-4 pt-4 border-t border-rose-500/20">
                                    <p className="text-[10px] font-semibold text-rose-400 uppercase tracking-widest mb-1 text-left">Reason:</p>
                                    <p className="text-rose-100/80 text-xs font-medium text-left">"{orgUser?.status_reason}"</p>
                                </div>
                            )}
                            {orgUser?.status_expiry && (
                                <div className="mt-2 text-left">
                                    <p className="text-[10px] font-semibold text-rose-400/70 uppercase tracking-wider tabular-nums">
                                        Restricted until: {new Date(orgUser.status_expiry).toLocaleString('vi-VN')}
                                    </p>
                                </div>
                            )}
                        </div>

                        <p className="text-slate-400 text-sm font-medium mb-8 max-w-sm">
                            If you believe this is a mistake or would like to request an appeal, please contact your organization administrator.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-3 w-full">
                            <button
                                onClick={() => window.open('mailto:support@example.com')}
                                className="flex-1 px-6 py-3.5 bg-white/10 hover:bg-white/15 text-white rounded-[var(--radius-md)] font-semibold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border border-white/10"
                            >
                                <HelpCircle className="w-4 h-4" />
                                Support Appeal
                            </button>
                            <button
                                onClick={() => logoutOrgUser()}
                                className="flex-1 px-6 py-3.5 bg-[#BD1D2D] hover:bg-[#9A1523] text-white rounded-[var(--radius-md)] font-semibold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                            >
                                <LogOut className="w-4 h-4" />
                                Return Home
                            </button>
                        </div>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#BD1D2D]/60" />
                </div>
            </div>
        </div>,
        getMktPortalRoot()
    );
};

export const WarningUserModal = ({ onContentClick, isDarkTheme }: { onContentClick?: () => void, isDarkTheme?: boolean }) => {
    const { orgUser } = useChatPage();
    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px] animate-in fade-in duration-300">
            <div className={`max-w-md w-full rounded-2xl p-8 shadow-2xl border relative overflow-hidden transition-colors duration-300 ${isDarkTheme ? 'bg-[#1E2532] border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className="relative z-10 flex flex-col items-center text-center">
                    <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-[var(--color-primary)] mb-6 border transition-colors ${isDarkTheme ? 'bg-[var(--color-primary)]/15 border-slate-700' : 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20'}`}>
                        <AlertCircle className="w-8 h-8" strokeWidth={1.75} />
                    </div>

                    <h2 className={`text-2xl font-bold tracking-tight mb-4 ${isDarkTheme ? 'text-slate-100' : 'text-slate-800'}`}>
                        Policy Reminder
                    </h2>

                    <p className={`text-sm font-medium leading-relaxed mb-4 ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                        Your account has received a <span className="text-[var(--color-primary)] font-semibold">formal warning</span>. Please review our usage guidelines to ensure continued access to AI features.
                    </p>

                    {orgUser?.status_reason && (
                        <div className={`border p-4 rounded-xl mb-8 w-full text-left transition-colors ${isDarkTheme ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30' : 'bg-[var(--color-primary)]/5 border-[var(--color-primary)]/20'}`}>
                            <p className="text-[10px] font-semibold text-[var(--color-primary)] uppercase tracking-widest mb-1">Observation:</p>
                            <p className={`text-xs font-medium leading-relaxed ${isDarkTheme ? 'text-slate-300' : 'text-slate-600'}`}>"{orgUser?.status_reason}"</p>
                            {orgUser?.status_expiry && (
                                <p className={`mt-2 text-[10px] font-semibold border-t pt-2 uppercase tabular-nums ${isDarkTheme ? 'text-[var(--color-primary)]/70 border-[var(--color-primary)]/30' : 'text-[var(--color-primary)]/80 border-[var(--color-primary)]/20'}`}>
                                    Valid until: {new Date(orgUser.status_expiry).toLocaleString('vi-VN')}
                                </p>
                            )}
                        </div>
                    )}

                    <button
                        onClick={onContentClick}
                        className="w-full px-8 py-3.5 rounded-[var(--radius-md)] font-semibold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 bg-[var(--color-primary)] text-white hover:brightness-110"
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
