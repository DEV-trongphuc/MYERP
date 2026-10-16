import React, { useState } from 'react';
import Modal from '../common/Modal';
import { Lightbulb, Link2, QrCode, Scan, Navigation2, MousePointerClick, ShieldCheck, PenTool } from 'lucide-react';

interface LinkGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const LinkGuideModal: React.FC<LinkGuideModalProps> = ({ isOpen, onClose }) => {
    const [step, setStep] = useState(1);

    const steps = [
        {
            id: 'link',
            icon: <Link2 className="w-8 h-8 text-indigo-500" />,
            title: "Rút gọn Link & Check Tracking",
            description: "Che giấu link gốc dài dòng, tạo link thân thiện với tỷ lệ click cao hơn. Theo dõi trực quan lịch sử Click, thiết bị và hệ điều hành.",
        },
        {
            id: 'qr',
            icon: <QrCode className="w-8 h-8 text-rose-500" />,
            title: "Thiết kế QR Code Độc quyền",
            description: "Tùy biến QR code với logo công ty, màu sắc thương hiệu nổi bật. Mã QR chất lượng cao sẵn sàng để in ấn bảng biển.",
        },
        {
            id: 'gateway',
            icon: <ShieldCheck className="w-8 h-8 text-emerald-500" />,
            title: "Cổng Gateway (Thu Lead X10)",
            description: "Bạn có link tài liệu hấp dẫn? Bắt khách hàng điền một Form ngắn (Survey) để trích xuất vé cứng hoặc file mềm.",
        }
    ];

    const currentStep = steps[step - 1];

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="xl" noPadding>
            <div className="flex flex-col md:flex-row min-h-[460px] bg-white rounded-[32px] overflow-hidden">
                {/* Left panel */}
                <div className="w-full md:w-2/5 bg-slate-50 p-8 flex flex-col border-r border-slate-100">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 mb-6 shrink-0">
                        <Lightbulb className="w-6 h-6" />
                    </div>
                    
                    <h3 className="text-xl font-black text-slate-800 leading-tight mb-2 tracking-tight">
                        Kiểm soát Lượt Kích, <br />Gấp bội Chuyển đổi
                    </h3>
                    <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                        Chỉ với thao tác cài đặt Link và QR nhanh chóng, bạn đã sẵn sàng chiếm lĩnh thị trường.
                    </p>

                    <div className="mt-auto space-y-4">
                        {steps.map((s, idx) => (
                            <button
                                key={idx}
                                onClick={() => setStep(idx + 1)}
                                className={`w-full text-left flex items-center gap-3 p-3 rounded-xl transition-all ${
                                    step === idx + 1 
                                        ? 'bg-white shadow-sm border border-slate-200 ring-2 ring-transparent' 
                                        : 'hover:bg-slate-100/50 text-slate-400 border border-transparent'
                                }`}
                            >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                                    step === idx + 1 ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-500'
                                }`}>
                                    {idx + 1}
                                </div>
                                <span className={`text-xs font-bold leading-tight ${step === idx + 1 ? 'text-slate-800' : ''}`}>
                                    {s.title}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right panel */}
                <div className="w-full md:w-3/5 p-8 flex flex-col relative overflow-hidden bg-white">
                    {/* Background blob */}
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-60"></div>
                    
                    <div className="relative flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500 key={step}">
                        <div className="mb-6">
                            {currentStep.icon}
                        </div>
                        <h4 className="text-2xl font-black text-slate-800 mb-3">{currentStep.title}</h4>
                        <p className="text-sm text-slate-600 leading-relaxed max-w-sm mb-6">
                            {currentStep.description}
                        </p>
                        
                        {/* Code-based feature previews */}
                        <div className="mt-auto w-full rounded-2xl border border-slate-200 overflow-hidden shadow-lg shadow-slate-200/50 bg-slate-50 flex items-center justify-center h-[280px] relative shrink-0">
                            {currentStep.id === 'link' && (
                                <div className="w-full h-full p-4 flex gap-4 bg-slate-100 items-center justify-center">
                                    <div className="w-full max-w-[280px] bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                                        <div className="flex justify-between items-center mb-3">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Click Stats</div>
                                            <div className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md hidden md:block">+234 Clicks</div>
                                        </div>
                                        <div className="flex items-end gap-1.5 h-20 border-b border-slate-100 pb-2">
                                            <div className="w-1/6 bg-indigo-100 rounded-t-sm h-[30%]"></div>
                                            <div className="w-1/6 bg-indigo-200 rounded-t-sm h-[50%]"></div>
                                            <div className="w-1/6 bg-indigo-300 rounded-t-sm h-[65%]"></div>
                                            <div className="w-1/6 bg-indigo-400 rounded-t-sm h-[80%]"></div>
                                            <div className="w-1/6 bg-indigo-500 rounded-t-sm h-[100%] shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                                            <div className="w-1/6 bg-indigo-300 rounded-t-sm h-[70%]"></div>
                                        </div>
                                        <div className="mt-3 flex items-center gap-2">
                                            <MousePointerClick className="w-4 h-4 text-slate-400" />
                                            <div className="h-1.5 w-full bg-slate-100 rounded-full"></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {currentStep.id === 'qr' && (
                                <div className="w-full h-full p-6 flex flex-col items-center justify-center gap-4 bg-slate-100 relative">
                                   <div className="absolute top-4 left-4 flex flex-col gap-2 opacity-50 hidden md:flex">
                                        <div className="w-8 h-8 rounded-full bg-indigo-200"></div>
                                        <div className="w-8 h-8 rounded-full bg-emerald-200"></div>
                                        <div className="w-8 h-8 rounded-full bg-rose-200"></div>
                                   </div>
                                   <div className="relative group hover:scale-105 transition-transform duration-300">
                                        <div className="absolute inset-0 bg-rose-500/20 blur-xl rounded-2xl group-hover:bg-rose-500/40 transition-colors"></div>
                                        <div className="w-32 h-32 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 flex flex-wrap gap-1 relative z-10">
                                            {/* Simulate QR code blocks */}
                                            {Array.from({ length: 49 }).map((_, i) => (
                                                <div key={i} className={`w-[13.5%] h-[13.5%] rounded-sm ${Math.random() > 0.5 ? 'bg-slate-800' : 'bg-transparent'} ${(i===0 || i===6 || i===42) ? 'ring-2 ring-inset ring-rose-500 bg-rose-50' : ''}`}></div>
                                            ))}
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <div className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center shadow-lg">
                                                    <PenTool className="w-4 h-4 text-rose-500" />
                                                </div>
                                            </div>
                                        </div>
                                   </div>
                                </div>
                            )}

                            {currentStep.id === 'gateway' && (
                                <div className="w-full h-full p-6 flex items-center justify-center bg-[#f8f9fa] relative overflow-hidden">
                                     {/* Background grid */}
                                    <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
                                    
                                    <div className="relative flex items-center gap-2">
                                        <div className="w-24 h-32 bg-white border border-slate-200 rounded-xl shadow-md p-3 flex flex-col z-10 scale-90">
                                            <Scan className="w-5 h-5 text-indigo-500 mb-2" />
                                            <div className="h-1.5 w-full bg-slate-200 rounded mb-1.5 mt-auto"></div>
                                            <div className="h-1.5 w-2/3 bg-slate-100 rounded mb-4"></div>
                                            <div className="w-full h-4 bg-indigo-50 rounded border border-indigo-100"></div>
                                        </div>
                                        
                                        <div className="flex flex-col items-center gap-1 z-10">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                        </div>
                                        
                                        <div className="w-28 h-36 bg-white border-2 border-emerald-400 rounded-xl shadow-xl p-3 flex flex-col z-10 relative group hover:-translate-y-1 transition-transform">
                                            <div className="absolute -top-2 -right-2 w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow">
                                                <ShieldCheck className="w-3 h-3" />
                                            </div>
                                            <div className="w-8 h-8 bg-emerald-50 rounded-lg mb-2"></div>
                                            <div className="h-2 w-full bg-slate-800 rounded mb-2 mt-auto"></div>
                                            <div className="h-1.5 w-1/2 bg-slate-400 rounded"></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="absolute bottom-8 right-8 flex gap-2 z-10">
                        {step < steps.length ? (
                            <button
                                onClick={() => setStep(s => s + 1)}
                                className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-lg hover:shadow-xl hover:bg-slate-800 transition-all flex items-center gap-2"
                            >
                                Xem tiếp <Navigation2 className="w-3.5 h-3.5 rotate-90" />
                            </button>
                        ) : (
                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/40 transition-all hover:scale-105"
                            >
                                Đã rõ, bắt đầu ngay!
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default LinkGuideModal;
