
import React from 'react';
import { Ban, FastForward, ShieldAlert } from 'lucide-react';
import Card from '../../common/Card';

interface BounceHandlingProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

const BounceHandling: React.FC<BounceHandlingProps> = ({ value, onChange, disabled }) => {
    // Default to 'stop' if empty
    const currentValue = value || 'stop';

    const options = [
        {
            id: 'stop',
            label: 'Dừng Flow ngay lập tức (Stop)',
            desc: 'Hệ thống sẽ gắn nhãn lỗi (Hard Bounce) cho Khách hàng và dừng toàn bộ Automation. Bảo vệ điểm uy tín tên miền.',
            icon: Ban,
            color: 'text-rose-600 bg-rose-50 border-rose-200',
            activeBorder: 'border-rose-500 ring-4 ring-rose-50',
            subtext: 'Khuyến nghị cho hầu hết trường hợp'
        },
        {
            id: 'continue',
            label: 'Tự động Bỏ qua & Tiếp tục (Auto Next Step)',
            desc: 'Ghi nhận lỗi nhưng vẫn cho phép Khách hàng chuyển sang bước tiếp theo (Lưu ý: Hệ thống sẽ tự động Bỏ qua các bước gửi Email).',
            icon: FastForward,
            color: 'text-amber-600 bg-amber-50 border-amber-200',
            activeBorder: 'border-amber-600 ring-4 ring-amber-50',
            subtext: 'Sử dụng nếu bạn có bước kiểm tra điều kiện sau đó'
        }
    ];

    return (
        <div className={`space-y-4 ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
            <div className="flex items-center gap-2 px-1">
                <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-100 shadow-sm">
                    <ShieldAlert className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">Xử lý Email Lỗi (Hard Bounce)</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {options.map((opt) => {
                    const isActive = currentValue === opt.id;
                    return (
                        <div
                            key={opt.id}
                            onClick={() => !disabled && onChange(opt.id)}
                            className={`
                                relative p-5 rounded-[20px] border-2 cursor-pointer transition-all duration-300
                                flex flex-col justify-between h-full
                                ${isActive ? `bg-white ${opt.activeBorder} shadow-lg` : 'bg-slate-50 border-transparent hover:bg-white hover:border-slate-200'}
                            `}
                        >
                            <div className="flex items-start gap-4 mb-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${opt.color}`}>
                                    <opt.icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className={`text-sm font-bold mb-1 ${isActive ? 'text-slate-900' : 'text-slate-600'}`}>
                                        {opt.label}
                                    </h4>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        {opt.desc}
                                    </p>
                                </div>
                            </div>

                            {/* Radial Selection Indicator */}
                            <div className="absolute top-4 right-4">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isActive ? 'border-[#2563eb] bg-[#2563eb]' : 'border-slate-300'}`}>
                                    {isActive && <div className="w-2 h-2 rounded-full bg-white" />}
                                </div>
                            </div>

                            {opt.subtext && (
                                <div className={`mt-2 pt-2 border-t text-[10px] font-bold uppercase tracking-wide ${isActive ? 'border-slate-100 text-slate-400' : 'border-transparent text-transparent'}`}>
                                    {isActive && opt.subtext}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default BounceHandling;
