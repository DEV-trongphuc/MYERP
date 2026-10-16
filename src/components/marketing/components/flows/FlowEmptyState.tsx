
import React from 'react';
import { Sparkles, Plus } from 'lucide-react';
import Button from '../common/Button';

interface FlowEmptyStateProps {
  onCreateClick: () => void;
}

const FlowEmptyState: React.FC<FlowEmptyStateProps> = ({ onCreateClick }) => (
  <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[40px] border-2 border-dashed border-slate-200 text-center animate-in fade-in zoom-in-95 duration-500">
    <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mb-8">
      <Sparkles className="w-10 h-10 text-orange-500" />
    </div>
    <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Chưa có kịch bản automation</h3>
    <p className="text-slate-400 mt-2 max-w-xs mx-auto">Bắt đầu tạo luồng làm việc tự động để tối ưu hóa quy trình chăm sóc Khách hàng của bạn.</p>
    <Button icon={Plus} className="mt-8 shadow-xl shadow-amber-600/20 transition-all duration-500" onClick={onCreateClick}>Tạo ngay kịch bản đầu tiên</Button>
  </div>
);

export default FlowEmptyState;
