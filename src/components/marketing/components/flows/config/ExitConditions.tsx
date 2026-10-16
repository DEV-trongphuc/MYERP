
import React from 'react';
import { MailOpen, UserMinus, ShoppingCart, Ban, MousePointerClick, Eye } from 'lucide-react';

interface ExitConditionsProps {
  conditions: string[];
  bounceBehavior?: string;
  onChange: (conditions: string[], bounceBehavior?: string) => void;
  disabled?: boolean;
}

const ExitConditions: React.FC<ExitConditionsProps> = ({ conditions, bounceBehavior = 'stop', onChange, disabled }) => {
  const options = [
    {
      id: 'unsubscribed',
      label: 'Hủy đăng ký',
      desc: 'Bắt buộc. Dừng gửi nếu Khách hàng chọn Hủy đăng ký',
      icon: UserMinus,
      color: 'text-slate-600 bg-slate-200',
      disabled: true // Usually mandatory
    },
    {
      id: 'clicked',
      label: 'Khách hàng Click Link',
      desc: 'Ngắt flow ngay khi Khách hàng tương tác (Click) vào bất kỳ link nào.',
      icon: MousePointerClick,
      color: 'text-purple-600 bg-purple-100'
    },
    {
      id: 'opened',
      label: 'Khách hàng Mở Email',
      desc: 'Dừng flow chỉ cần Khách hàng mở email (Lưu ý: Pixel tracking có thể không chính xác 100%).',
      icon: Eye,
      color: 'text-teal-600 bg-teal-100'
    },
  ];

  const toggle = (id: string) => {
    if (disabled) return;
    if (conditions.includes(id)) onChange(conditions.filter(c => c !== id), bounceBehavior);
    else onChange([...conditions, id], bounceBehavior);
  };

  const handleBehaviorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(conditions, e.target.value);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {options.map((opt) => {
        const isChecked = conditions.includes(opt.id) || opt.disabled;
        return (
          <div
            key={opt.id}
            onClick={() => !opt.disabled && !disabled && toggle(opt.id)}
            className={`
              relative p-5 rounded-[24px] border-2 transition-all duration-300 group
              ${isChecked ? 'bg-white border-emerald-500 shadow-md' : 'bg-slate-50 border-transparent hover:bg-white hover:border-slate-200'}
              ${(opt.disabled || disabled) ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >

            {/* Toggle Switch Visual */}
            <div className="absolute top-5 right-5 z-10 pointer-events-none">
              <div className={`w-10 h-6 rounded-full transition-colors duration-300 relative ${isChecked ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-300 shadow-sm ${isChecked ? 'left-5' : 'left-1'}`}></div>
              </div>
            </div>

            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-4 ${opt.color}`}>
              <opt.icon className="w-5 h-5" />
            </div>

            <div className="mb-2 relative z-10 pointer-events-none">
              <h4 className={`text-sm font-black mb-1 ${isChecked ? 'text-slate-800' : 'text-slate-500'}`}>{opt.label}</h4>
              <p className="text-xs text-slate-400 font-medium leading-relaxed pr-8">{opt.desc}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ExitConditions;
