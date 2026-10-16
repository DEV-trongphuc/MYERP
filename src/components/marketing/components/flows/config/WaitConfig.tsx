import React from 'react';
import { Clock } from 'lucide-react';
import Input from '../../common/Input';
import Select from '../../common/Select';

interface WaitConfigProps {
  config: Record<string, any>;
  onChange: (newConfig: Record<string, any>, newLabel?: string) => void;
  disabled?: boolean;
}

const WaitConfig: React.FC<WaitConfigProps> = ({ config, onChange, disabled }) => {
  const mode = config.mode || 'duration'; // 'duration' | 'until'

  const unitOptions = [
    { value: 'minutes', label: 'Phút' },
    { value: 'hours', label: 'Giờ' },
    { value: 'days', label: 'Ngày' },
    { value: 'weeks', label: 'Tuần' },
  ];

  const dayOptions = [
    { value: '1', label: 'Thứ Hai' },
    { value: '2', label: 'Thứ Ba' },
    { value: '3', label: 'Thứ Tư' },
    { value: '4', label: 'Thứ Năm' },
    { value: '5', label: 'Thứ Sáu' },
    { value: '6', label: 'Thứ Bảy' },
    { value: '0', label: 'Chủ Nhật' },
  ];

  const getDayLabel = (day: string) => dayOptions.find(d => d.value === String(day))?.label || '';

  const getAutoLabel = (cfg: Record<string, any>) => {
    if (cfg.mode === 'until') {
      let label = 'Chờ đến ';
      if (cfg.untilDay !== undefined && cfg.untilDay !== '') {
        label += `${getDayLabel(cfg.untilDay)} `;
      } else {
        label += 'ngày kế tiếp ';
      }
      if (cfg.untilTime) {
        label += `lúc ${cfg.untilTime}`;
      }
      return label;
    }
    if (cfg.mode === 'until_attribute') {
      const attrOption = [
        { value: 'date_of_birth', label: 'sinh nhật' },
        { value: 'anniversary_date', label: 'ngày kỷ niệm' },
        { value: 'joined_at', label: 'ngày gia nhập' }
      ].find(o => o.value === cfg.attributeKey);
      const attrLabel = attrOption ? attrOption.label : 'sinh nhật';

      if (cfg.offsetType === 'on') return `Đúng ${attrLabel}`;
      const typeLabel = cfg.offsetType === 'before' ? 'trước' : 'sau';
      return `${cfg.offsetValue || 0} ngày ${typeLabel} ${attrLabel}`;
    }
    if (cfg.mode === 'until_date') {
      return `Chờ đến ngày ${cfg.specificDate || ''} ${cfg.untilTime || ''}`;
    }
    const unit = cfg.unit || 'hours';
    const dur = cfg.duration || (unit === 'minutes' ? 10 : 1);
    const uLabel = unitOptions.find(o => o.value === unit)?.label || 'Giờ';
    return `Chờ ${dur} ${uLabel}`;
  };

  const updateConfig = (patch: Record<string, any>) => {
    if (disabled) return;
    const newConfig = { ...config, ...patch };
    onChange(newConfig, getAutoLabel(newConfig));
  };

  return (
    <div className="space-y-6 pb-32 animate-in fade-in duration-300">
      {/* MODE TOGGLE */}
      <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
        {[
          { id: 'duration', label: 'Khoảng Thời gian' },
          { id: 'until', label: 'Thời điểm cụ thể' },
          { id: 'until_attribute', label: 'Theo ngày kỷ niệm' },
          { id: 'until_date', label: 'Ngày cụ thể' }
        ].map(m => (
          <button
            key={m.id}
            onClick={() => updateConfig({ mode: m.id })}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${mode === m.id ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="p-5 bg-amber-50 text-amber-700 rounded-[28px] border border-amber-100 flex gap-4 shadow-sm items-center">
        <div className="p-3 bg-white rounded-2xl shadow-sm text-amber-600">
          <Clock className="w-6 h-6 shrink-0" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold leading-relaxed">
            {mode === 'duration' ? 'Thời gian tạm dừng' :
              mode === 'until' ? 'Chờ đến thời điểm' :
                mode === 'until_attribute' ? 'Chờ theo ngày kỷ niệm' : 'Chờ đến ngày cụ thể'}
          </p>
          <p className="text-[10px] opacity-70 font-medium leading-tight mt-0.5">
            {mode === 'duration'
              ? (config.unit === 'minutes' ? 'Đã chọn phút: Tối thiểu phải là 10 phút.' : 'Khách hàng sẽ đứng ở bước này trước khi sang bước tiếp theo (Tối thiểu 1 giờ).')
              : (mode === 'until'
                ? 'Hệ thống sẽ giữ Khách hàng lại cho đến khi đạt tới ngày/giờ đã thiết lập.'
                : (mode === 'until_attribute'
                  ? 'Chờ đến một khoảng Thời gian trước hoặc sau ngày sinh nhật/ngày kỷ niệm của Khách hàng.'
                  : 'Chờ đến một ngày cố định (ví dụ: ngày lễ 14/02, 08/03, Noel...) để bắt đầu khuyến mãi.'
                )
              )
            }
          </p>
        </div>
      </div>

      {mode === 'duration' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Giá trị"
            type="number"
            min={config.unit === 'minutes' ? 10 : 1}
            value={config.duration || (config.unit === 'minutes' ? 10 : 1)}
            onChange={(e) => updateConfig({ duration: Math.max(config.unit === 'minutes' ? 10 : 1, parseInt(e.target.value) || 0) })}
            disabled={disabled}
          />
          <Select
            label="Đơn vị"
            options={unitOptions}
            value={config.unit || 'hours'}
            onChange={(unit) => updateConfig({ unit, duration: unit === 'minutes' && (config.duration || 0) < 10 ? 10 : (config.duration || 1) })}
            disabled={disabled}
            direction="bottom"
          />
        </div>
      )}

      {mode === 'until' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Đợi đến Thứ (Tùy chọn)"
              options={[{ value: '', label: 'Hàng ngày' }, ...dayOptions]}
              value={config.untilDay || ''}
              onChange={(val) => updateConfig({ untilDay: val })}
              disabled={disabled}
            />
            <Input
              label="Vào lúc (Giờ:Phút)"
              type="time"
              value={config.untilTime || '09:00'}
              onChange={(e) => updateConfig({ untilTime: e.target.value })}
              disabled={disabled}
            />
          </div>
          <p className="text-[10px] text-slate-400 font-medium italic">
            * Nếu thời điểm thiết lập đã trôi qua trong ngày, Khách hàng sẽ đợi đến thời điểm đó của chu kỳ kế tiếp (ví dụ: Thứ Hai tuần sau).
          </p>
        </div>
      )}

      {mode === 'until_attribute' && (
        <div className="space-y-4">
          <div className={`grid grid-cols-1 ${config.offsetType === 'on' ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4`}>
            {config.offsetType !== 'on' && (
              <Input
                label="Số lượng"
                type="number"
                value={config.offsetValue || 0}
                onChange={(e) => updateConfig({ offsetValue: parseInt(e.target.value) || 0 })}
                disabled={disabled}
              />
            )}
            <Select
              label="Thời điểm"
              options={[
                { value: 'before', label: 'Trước' },
                { value: 'after', label: 'Sau' },
                { value: 'on', label: 'Đúng ngày' }
              ]}
              value={config.offsetType || 'before'}
              onChange={(val) => updateConfig({
                offsetType: val,
                offsetValue: val === 'on' ? 0 : config.offsetValue
              })}
              disabled={disabled}
            />
            <Select
              label="Ngày của khách"
              options={[
                { value: 'date_of_birth', label: 'Ngày sinh nhật' },
                { value: 'anniversary_date', label: 'Ngày kỷ niệm' },
                { value: 'joined_at', label: 'Ngày gia nhập' }
              ]}
              value={config.attributeKey || 'date_of_birth'}
              onChange={(val) => updateConfig({ attributeKey: val })}
              disabled={disabled}
            />
          </div>
          <div className="p-3 bg-blue-50 text-blue-700 rounded-xl text-[10px] font-medium border border-blue-100">
            Mẹo: Thiết lập "2 ngày Trước Ngày sinh nhật" đã gửi tin nhắn chúc mừng sớm hoặc chuẩn bị quà tặng.
          </div>
        </div>
      )}

      {mode === 'until_date' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Chọn ngày cụ thể"
              type="date"
              value={config.specificDate || ''}
              onChange={(e) => updateConfig({ specificDate: e.target.value })}
              disabled={disabled}
            />
            <Input
              label="Vào lúc (Giờ:Phút)"
              type="time"
              value={config.untilTime || '09:00'}
              onChange={(e) => updateConfig({ untilTime: e.target.value })}
              disabled={disabled}
            />
          </div>
          <p className="text-[10px] text-slate-400 font-medium italic">
            * Khách hàng sẽ chờ tại bước này cho đến đúng ngày và giờ bạn đã chọn. Nếu ngày đó đã trôi qua, Khách hàng sẽ đi tiếp ngay lập tức.
          </p>
        </div>
      )}
    </div>
  );
};

export default WaitConfig;