
import React from 'react';
import { Play, ArrowRight, Zap, Mail, GitMerge, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Card from '../common/Card';
import { Campaign, Flow } from '../../types';

interface FlowReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    campaign: Campaign | null;
    flow: Flow | null;
    isProcessing?: boolean;
    isDarkTheme?: boolean;
}

const FlowReviewModal: React.FC<FlowReviewModalProps> = ({
    isOpen, onClose, onConfirm, campaign, flow, isProcessing, isDarkTheme
}) => {
    if (!campaign) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Khởi động Chiến dịch & Flow"
            size="lg"
            isDarkTheme={isDarkTheme}
            footer={
                <div className="flex justify-between w-full items-center">
                    <Button variant="ghost" onClick={onClose} disabled={isProcessing}>Để sau</Button>
                    <Button
                        onClick={onConfirm}
                        icon={Play}
                        isLoading={isProcessing}
                        className="shadow-lg shadow-amber-600/20 bg-amber-600 hover:bg-amber-700 text-white border-transparent transition-all duration-500"
                    >
                        Xác nhận & Chạy ngay
                    </Button>
                </div>
            }
        >
            <div className="space-y-8 py-2">
                {/* Connection Visual */}
                <div className="flex items-center justify-between gap-4">
                    {/* Campaign Card */}
                    <div className={`flex-1 border rounded-2xl p-4 shadow-sm relative group transition-colors ${isDarkTheme ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'}`}>
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${isDarkTheme ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-orange-50 text-[#ca7900] border-orange-100'}`}>
                                <Mail className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chiến dịch</p>
                                <p className={`text-sm font-bold truncate max-w-[150px] ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>{campaign.name}</p>
                            </div>
                        </div>
                        <div className={`text-[10px] px-2 py-1 rounded-lg truncate ${isDarkTheme ? 'text-slate-400 bg-slate-800/50' : 'text-slate-500 bg-slate-50'}`}>
                            {campaign.subject}
                        </div>
                    </div>

                    {/* Animation Connector */}
                    <div className="flex flex-col items-center justify-center text-slate-300">
                        <div className="flex -space-x-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                        <ArrowRight className="w-6 h-6 text-emerald-500 mt-1" />
                    </div>

                    {/* Flow Card */}
                    <div className={`flex-1 border rounded-2xl p-4 shadow-sm relative transition-colors ${isDarkTheme ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-100' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                        {flow ? (
                            <>
                                <div className="absolute -top-2 -right-2 bg-emerald-500 text-white p-1 rounded-full shadow-md">
                                    <CheckCircle2 className="w-4 h-4" />
                                </div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm ${isDarkTheme ? 'bg-slate-900 text-emerald-400 border-slate-800' : 'bg-white text-emerald-600 border-emerald-100'}`}>
                                        <GitMerge className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className={`text-[10px] font-bold uppercase tracking-wider ${isDarkTheme ? 'text-emerald-400' : 'text-emerald-700'}`}>Automation</p>
                                        <p className={`text-sm font-bold truncate max-w-[150px] ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>{flow.name}</p>
                                    </div>
                                </div>
                                <div className={`text-[10px] font-bold px-1 ${isDarkTheme ? 'text-emerald-400' : 'text-emerald-700'}`}>
                                    {flow.steps.length} bước xử lý
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center py-2 opacity-60">
                                <AlertTriangle className="w-8 h-8 text-rose-400 mb-1" />
                                <p className="text-xs font-bold text-rose-600">Chưa kết nối Flow</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Flow Preview Details */}
                {flow && (
                    <div className={`rounded-[24px] border p-6 ${isDarkTheme ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Layers className="w-4 h-4" /> Xem trước quy trình
                        </h4>
                        <div className="space-y-4 relative">
                            <div className={`absolute left-[19px] top-4 bottom-4 w-0.5 ${isDarkTheme ? 'bg-slate-800' : 'bg-slate-200'}`}></div>

                            {/* Trigger */}
                            <div className="relative flex items-center gap-4 z-10">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 shadow-sm ${isDarkTheme ? 'bg-slate-800 text-white border-slate-950' : 'bg-slate-800 text-white border-slate-50'}`}>
                                    <Zap className="w-4 h-4" />
                                </div>
                                <div className={`px-4 py-2 rounded-xl border shadow-sm flex-1 ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                                    <p className={`text-[10px] font-bold uppercase ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>Kích hoạt</p>
                                    <p className={`text-xs font-bold ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>Khi gửi thành công: {campaign.name}</p>
                                </div>
                            </div>

                            {/* First 2 Steps */}
                            {flow.steps.filter(s => s.type !== 'trigger').slice(0, 2).map((step, idx) => (
                                <div key={idx} className="relative flex items-center gap-4 z-10">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 shadow-sm ${isDarkTheme ? 'bg-slate-900 text-slate-400 border-slate-950' : 'bg-white text-slate-500 border-slate-55'}`}>
                                        <span className="text-[10px] font-bold">{idx + 1}</span>
                                    </div>
                                    <div className={`px-4 py-2 rounded-xl border shadow-sm flex-1 ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                                        <p className={`text-[10px] font-bold uppercase ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>{step.type}</p>
                                        <p className={`text-xs font-bold ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>{step.label}</p>
                                    </div>
                                </div>
                            ))}

                            {flow.steps.length > 3 && (
                                <div className="relative flex items-center gap-4 z-10">
                                    <div className="w-10 h-10 flex items-center justify-center ml-1">
                                        <span className="w-1 h-1 bg-slate-300 rounded-full mb-1"></span>
                                        <span className="w-1 h-1 bg-slate-300 rounded-full mb-1 mx-0.5"></span>
                                        <span className="w-1 h-1 bg-slate-300 rounded-full mb-1"></span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 italic font-medium">...và {flow.steps.length - 3} bước nữa</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className={`p-4 rounded-2xl flex gap-3 border ${isDarkTheme ? 'bg-blue-950/20 border-blue-900/40 text-blue-200' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
                    <Zap className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <p className={`text-xs font-bold ${isDarkTheme ? 'text-blue-400' : 'text-blue-800'}`}>Hành động này sẽ:</p>
                        <ul className={`text-[11px] list-disc pl-4 space-y-0.5 ${isDarkTheme ? 'text-blue-300/80' : 'text-blue-700'}`}>
                            <li>Chuyển Trạng thái chiến dịch sang <span className="font-bold">ĐANG GỬI</span>.</li>
                            <li>Kích hoạt Flow <span className="font-bold">{flow?.name}</span> sang Trạng thái <span className="font-bold">ACTIVE</span>.</li>
                            <li>Bắt đầu gửi email đầu tiên ngay lập tức.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default FlowReviewModal;
