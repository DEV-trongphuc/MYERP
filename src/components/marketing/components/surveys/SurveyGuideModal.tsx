import React, { useState } from 'react';
import Modal from '../common/Modal';
import { Lightbulb, MousePointerClick, MessageSquareText, PenTool, Link2, Sparkles, Navigation2, ClipboardList, Mail } from 'lucide-react';

interface SurveyGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SurveyGuideModal: React.FC<SurveyGuideModalProps> = ({ isOpen, onClose }) => {
    const [step, setStep] = useState(1);

    const steps = [
        {
            id: 'canvas',
            icon: <PenTool className="w-8 h-8 text-amber-500" />,
            title: "Trải nghiệm Tùy biến Không giới hạn",
            description: "Thêm logo, sửa màu sắc thương hiệu, tải ảnh nền và điều chỉnh từng khối khảo sát trực tiếp (Kéo - Thả) với thanh công cụ bên trái.",
        },
        {
            id: 'export',
            icon: <Link2 className="w-8 h-8 text-blue-500" />,
            title: "Tích hợp và Xuất bản Bất cứ đâu",
            description: "Sau khi thiết kế xong, lấy link gốc để chia sẻ qua Email, SMS hoặc Zalo. Hệ thống sẽ tự động bắt ID khách hàng (uid) để theo dõi kết quả chuẩn xác.",
        },
        {
            id: 'automation',
            icon: <Sparkles className="w-8 h-8 text-emerald-500" />,
            title: "Kích hoạt Kịch bản (Automation Flow)",
            description: "Khảo sát có thể trở thành điểm chạm đầu tiên! Tự động gắn tag, phân luồng khách hàng hoặc gửi Email cảm ơn ngay lập tức khi họ nộp phản hồi.",
        }
    ];

    const currentStep = steps[step - 1];

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="xl" noPadding>
            <div className="flex flex-col md:flex-row min-h-[460px] bg-white rounded-[32px] overflow-hidden">
                {/* Left panel */}
                <div className="w-full md:w-2/5 bg-slate-50 p-8 flex flex-col border-r border-slate-100">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 mb-6 shrink-0">
                        <Lightbulb className="w-6 h-6" />
                    </div>
                    
                    <h3 className="text-xl font-black text-slate-800 leading-tight mb-2 tracking-tight">
                        Kiến tạo Khảo sát, <br />Thấu hiểu Khách hàng
                    </h3>
                    <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                        Chỉ với 3 bước cơ bản, bạn có thể thiết lập hệ thống thu thập phản hồi chuyên nghiệp và mượt mà.
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
                                    step === idx + 1 ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'
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
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-amber-50 rounded-full blur-3xl opacity-60"></div>
                    
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
                            {currentStep.id === 'canvas' && (
                                <div className="w-full h-full p-4 flex gap-3 opacity-90 hover:opacity-100 transition-opacity bg-slate-100">
                                    <div className="w-1/3 bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex flex-col gap-2">
                                        <div className="h-2 w-16 bg-amber-100 rounded-full mb-2"></div>
                                        <div className="flex gap-2">
                                            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center"><PenTool className="w-4 h-4 text-slate-400" /></div>
                                            <div className="w-8 h-8 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-center"><Sparkles className="w-4 h-4 text-amber-500" /></div>
                                        </div>
                                        <div className="h-6 w-full border-2 border-dashed border-slate-200 rounded-md mt-4 flex items-center justify-center">
                                            <div className="w-4 h-0.5 bg-slate-300 rounded"></div>
                                        </div>
                                    </div>
                                    <div className="w-2/3 bg-white rounded-xl shadow-sm border border-slate-200 p-4 border-t-4 border-t-amber-400 relative overflow-hidden">
                                        <div className="absolute top-2 right-2 w-12 h-12 bg-amber-500/5 blur-xl rounded-full"></div>
                                        <div className="h-4 w-32 bg-slate-100 rounded mb-2"></div>
                                        <div className="h-2 w-48 bg-slate-50 rounded mb-6"></div>
                                        <div className="w-full h-10 border border-amber-200 rounded-lg bg-amber-50/50 flex flex-col justify-center px-3 mb-2 shadow-sm">
                                            <div className="w-24 h-1.5 bg-amber-200/60 rounded"></div>
                                        </div>
                                        <div className="w-full h-10 border border-slate-100 rounded-lg bg-slate-50 flex flex-col justify-center px-3">
                                            <div className="w-16 h-1.5 bg-slate-200 rounded"></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {currentStep.id === 'export' && (
                                <div className="w-full h-full p-6 flex flex-col items-center justify-center gap-4 bg-slate-100">
                                   <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl shadow-blue-900/5 border border-blue-100 p-5 scale-95 hover:scale-100 transition-transform">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center ring-4 ring-blue-50/50">
                                                <Link2 className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="h-3 w-24 bg-slate-800 rounded-full mb-1.5"></div>
                                                <div className="h-2 w-32 bg-slate-400 rounded-full"></div>
                                            </div>
                                        </div>
                                        <div className="w-full bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between mb-3">
                                            <span className="text-[10px] text-slate-500 font-mono truncate">https://domation.vn/s/xy72k</span>
                                            <div className="px-3 py-1 bg-white border border-slate-200 rounded shadow-sm text-[10px] font-bold text-slate-700">Copy</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="flex-1 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-center text-[10px] font-bold">Zalo ZNS</div>
                                            <div className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-lg text-center text-[10px] font-bold">Email</div>
                                        </div>
                                   </div>
                                </div>
                            )}

                            {currentStep.id === 'automation' && (
                                <div className="w-full h-full p-6 flex items-center justify-center bg-[#f8f9fa] relative overflow-hidden">
                                     {/* Background grid */}
                                    <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
                                    <div className="relative flex flex-col gap-6 items-center">
                                        <div className="px-5 py-3 bg-white border-2 border-emerald-500 rounded-xl shadow-lg flex items-center gap-3 z-10 hover:-translate-y-1 transition-transform">
                                            <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                                                <ClipboardList className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold text-slate-800">Trigger: Nộp khảo sát</div>
                                                <div className="text-[10px] text-slate-500">Form: Phản hồi sản phẩm</div>
                                            </div>
                                        </div>
                                        
                                        <div className="w-px h-6 bg-slate-300 z-10 -my-6"></div>
                                        
                                        <div className="px-5 py-3 bg-white border border-slate-200 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center gap-3 z-10 ml-16 opacity-90 scale-95">
                                            <div className="w-8 h-8 bg-orange-50 text-orange-500 rounded-lg flex items-center justify-center">
                                                <Mail className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold text-slate-700">Action: Gửi Email</div>
                                                <div className="text-[10px] text-slate-400">Template: Thank you</div>
                                            </div>
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
                                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/40 transition-all hover:scale-105"
                            >
                                Bắt đầu ngay!
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default SurveyGuideModal;
