
import React from 'react';
import { Plus } from 'lucide-react';
import Button from '../common/Button';

interface FlowEmptyStateProps {
  onCreateClick: () => void;
}

const FlowEmptyState: React.FC<FlowEmptyStateProps> = ({ onCreateClick }) => (
  <div className="flex flex-col items-center justify-center py-20 px-6 bg-white rounded-2xl border border-slate-200 text-center">
    {/* Wireframe node preview */}
    <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/70 px-5 py-4" aria-hidden="true">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-xs">
          <span className="h-2 w-2 rounded-full bg-[#BD1D2D]" />
          <span className="h-1.5 w-10 rounded-full bg-slate-300" />
        </div>
        <div className="h-px w-4 bg-slate-300" />
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-xs">
          <span className="h-2 w-2 rounded-full bg-slate-400" />
          <span className="h-1.5 w-12 rounded-full bg-slate-200" />
        </div>
        <div className="h-px w-4 bg-slate-300" />
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-xs">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="h-1.5 w-9 rounded-full bg-slate-200" />
        </div>
      </div>
    </div>

    <h3 className="text-base font-semibold text-slate-900">Chưa có kịch bản automation</h3>
    <p className="text-[13px] text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
      Thiết lập luồng chăm sóc tự động theo hành vi để gửi Email, Zalo và cập nhật trạng thái khách hàng.
    </p>
    <Button
      icon={Plus}
      className="mt-6 transition-colors duration-150"
      onClick={onCreateClick}
    >
      Tạo kịch bản đầu tiên
    </Button>
  </div>
);

export default FlowEmptyState;
