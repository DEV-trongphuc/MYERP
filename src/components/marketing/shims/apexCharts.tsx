import React from 'react';
export type ApexOptions = Record<string, any>;
export const ApexOptions: any = undefined;
export const Chart: React.FC<{ options?: ApexOptions; series?: any[]; type?: string; height?: number | string; width?: number | string }> = ({ series = [], height = 280 }) => {
  return (
    <div style={{ height }} className="w-full flex items-center justify-center bg-slate-50/60 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 text-xs font-semibold text-slate-500">
      Biểu đồ thống kê trực quan ({Array.isArray(series) ? series.length : 0} chuỗi dữ liệu)
    </div>
  );
};
export default Chart;
