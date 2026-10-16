// src/components/chat/ChatDynamicChart.tsx
// In-Chat Micro-BI Visual Charts for SI IDEAS using Recharts
// Supports: Multi-Dataset Tabs, Interactive Chart-Type Switcher (bar, hbar, line, area, pie, funnel, table, composed), Light Tooltip, Copy to Excel/TSV

import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  PieChart as PieIcon,
  Table as TableIcon,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  AlignLeft,
  Filter,
  Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { DynamicChartData } from './chatTagParsers';
import { copyTextSafely } from '../../utils/clipboard';

const PALETTE = ['#2563eb', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6'];

const formatNumberOrCurrency = (val: any) => {
  if (typeof val !== 'number' || Number.isNaN(val)) return val;
  if (Math.abs(val) >= 1e9) {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(val / 1e9) + ' Tỷ';
  }
  if (Math.abs(val) >= 1e6) {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(val / 1e6) + ' Tr';
  }
  return new Intl.NumberFormat('vi-VN').format(val);
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: any;
  totalSum?: number;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label, totalSum }) => {
  if (!active || !payload || payload.length === 0) return null;
  const headerText = label || payload[0]?.name || payload[0]?.payload?.name || '';

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '10px 14px',
        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.12)',
        color: '#0f172a',
        fontSize: 12,
        minWidth: 150,
        zIndex: 50,
      }}
    >
      {headerText && (
        <div
          style={{
            fontWeight: 700,
            color: '#475569',
            marginBottom: 6,
            paddingBottom: 4,
            borderBottom: '1px solid #f1f5f9',
            fontSize: 11.5,
          }}
        >
          {headerText}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {payload.map((entry: any, idx: number) => {
          const rawVal = Number(entry.value) || 0;
          const pct = totalSum && totalSum > 0 ? ((rawVal / totalSum) * 100).toFixed(1) : null;
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: entry.color || entry.fill || PALETTE[idx % PALETTE.length],
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: '#475569', fontWeight: 500 }}>{entry.name || entry.dataKey}:</span>
              </div>
              <span style={{ color: '#0f172a', fontWeight: 700 }}>
                {formatNumberOrCurrency(entry.value)}
                {pct && payload.length === 1 ? ` (${pct}%)` : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CHART_VIEW_OPTIONS: {
  id: 'bar' | 'hbar' | 'line' | 'area' | 'pie' | 'funnel' | 'table';
  label: string;
}[] = [
  { id: 'bar', label: 'Cột' },
  { id: 'hbar', label: 'Ngang' },
  { id: 'line', label: 'Đường' },
  { id: 'area', label: 'Miền' },
  { id: 'pie', label: 'Tròn' },
  { id: 'funnel', label: 'Phễu' },
  { id: 'table', label: 'Bảng' },
];

interface ChatDynamicChartProps {
  chart: DynamicChartData;
}

export const ChatDynamicChart: React.FC<ChatDynamicChartProps> = ({ chart }) => {
  const [activeDatasetIdx, setActiveDatasetIdx] = useState(0);
  const datasets = useMemo(() => (Array.isArray(chart?.datasets) && chart.datasets.length > 0 ? chart.datasets : null), [chart?.datasets]);
  const activeDataset = useMemo(() => (datasets ? datasets[activeDatasetIdx] || datasets[0] : null), [datasets, activeDatasetIdx]);

  const [viewType, setViewType] = useState<string>(activeDataset?.type || chart?.type || 'bar');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    const nextType = activeDataset?.type || chart?.type || 'bar';
    setViewType(nextType);
  }, [activeDatasetIdx, activeDataset?.type, chart?.type]);

  const activeData = useMemo(() => {
    const d = activeDataset?.data && activeDataset.data.length > 0 ? activeDataset.data : chart?.data;
    return Array.isArray(d) ? d : [];
  }, [activeDataset?.data, chart?.data]);

  const xAxisKey = useMemo(() => activeDataset?.xAxisKey || chart?.xAxisKey || 'name', [activeDataset?.xAxisKey, chart?.xAxisKey]);

  const series = useMemo(() => {
    if (activeDataset?.series && activeDataset.series.length > 0) return activeDataset.series;
    if (chart?.series && chart.series.length > 0) return chart.series;
    return [{ dataKey: 'value', name: 'Số lượng' }];
  }, [activeDataset?.series, chart?.series]);

  const primarySeriesKey = series[0]?.dataKey || 'value';

  const totalPrimarySum = useMemo(() => {
    return activeData.reduce((acc, row) => acc + (Number(row[primarySeriesKey]) || 0), 0);
  }, [activeData, primarySeriesKey]);

  const maxPrimaryVal = useMemo(() => {
    return activeData.reduce((max, row) => Math.max(max, Number(row[primarySeriesKey]) || 0), 0);
  }, [activeData, primarySeriesKey]);

  if (!chart || activeData.length === 0) {
    return null;
  }

  const displayTitle = activeDataset?.title || chart.title || 'Biểu đồ phân tích số liệu';
  const displaySubtitle = activeDataset?.subtitle || chart.subtitle || chart.description || '';

  const ChartIcon =
    viewType === 'pie'
      ? PieIcon
      : viewType === 'line'
        ? TrendingUp
        : viewType === 'area'
          ? Activity
          : viewType === 'hbar'
            ? AlignLeft
            : viewType === 'funnel'
              ? Filter
              : viewType === 'table'
                ? TableIcon
                : BarChart3;

  const handleCopyData = async () => {
    try {
      const headers = ['STT', 'Danh mục', ...series.map((s) => s.name || s.dataKey), 'Tỷ trọng (%)'];
      const rows = activeData.map((row, rIdx) => {
        const val = Number(row[primarySeriesKey]) || 0;
        const pct = totalPrimarySum > 0 ? ((val / totalPrimarySum) * 100).toFixed(1) + '%' : '0%';
        return [
          rIdx + 1,
          row[xAxisKey] || `Hàng #${rIdx + 1}`,
          ...series.map((s) => row[s.dataKey] ?? ''),
          pct,
        ];
      });
      const tsv = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
      const ok = await copyTextSafely(tsv);
      if (ok) {
        setIsCopied(true);
        toast.success('Đã sao chép bảng số liệu vào clipboard (dán ngay vào Excel)');
        setTimeout(() => setIsCopied(false), 2000);
      } else {
        toast.error('Không thể sao chép số liệu, vui lòng cấp quyền clipboard');
      }
    } catch {
      toast.error('Không thể sao chép số liệu');
    }
  };

  const chartHeight = isExpanded ? 360 : 240;

  return (
    <div
      style={{
        marginTop: '10px',
        marginBottom: '8px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        background: '#ffffff',
        padding: '12px 14px',
        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.05)',
        maxWidth: '100%',
        overflow: 'hidden',
        transition: 'all 0.25s ease',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '10px',
          flexWrap: 'wrap',
          marginBottom: datasets && datasets.length > 1 ? '8px' : '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: '1 1 200px' }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            <ChartIcon size={16} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h4
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: '#0f172a',
                margin: 0,
                lineHeight: 1.35,
              }}
            >
              {displayTitle}
            </h4>
            {displaySubtitle && (
              <p
                style={{
                  fontSize: '11px',
                  color: '#64748b',
                  margin: '2px 0 0 0',
                  lineHeight: 1.3,
                }}
              >
                {displaySubtitle}
              </p>
            )}
          </div>
        </div>

        {/* Interactive Chart-Type Switcher + Utility Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: '#f1f5f9',
              padding: '2px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              gap: '1px',
            }}
          >
            {CHART_VIEW_OPTIONS.map((opt) => {
              const active = viewType === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setViewType(opt.id)}
                  style={{
                    fontSize: '10.5px',
                    fontWeight: active ? 700 : 500,
                    padding: '3px 7px',
                    borderRadius: '6px',
                    border: 'none',
                    background: active ? '#ffffff' : 'transparent',
                    color: active ? '#2563eb' : '#64748b',
                    boxShadow: active ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Copy data button */}
          <button
            type="button"
            onClick={handleCopyData}
            title="Sao chép bảng số liệu vào clipboard (dán Excel)"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '5px 7px',
              borderRadius: '7px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: isCopied ? '#10b981' : '#475569',
              cursor: 'pointer',
            }}
          >
            {isCopied ? <Check size={12} /> : <Copy size={12} />}
          </button>

          {/* Expand/Collapse */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Thu nhỏ' : 'Mở rộng'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '5px 7px',
              borderRadius: '7px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#475569',
              cursor: 'pointer',
            }}
          >
            {isExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>

      {/* Multi-Dataset Pill Tab Bar */}
      {datasets && datasets.length > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            overflowX: 'auto',
            paddingBottom: '6px',
            marginBottom: '8px',
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          {datasets.map((ds, idx) => {
            const isSelected = idx === activeDatasetIdx;
            return (
              <button
                key={ds.key || idx}
                type="button"
                onClick={() => setActiveDatasetIdx(idx)}
                style={{
                  fontSize: '11px',
                  fontWeight: isSelected ? 700 : 600,
                  padding: '4px 10px',
                  borderRadius: '999px',
                  border: isSelected ? '1px solid #2563eb' : '1px solid #e2e8f0',
                  background: isSelected ? '#eff6ff' : '#f8fafc',
                  color: isSelected ? '#1d4ed8' : '#475569',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {ds.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Content Body */}
      {viewType === 'funnel' ? (
        /* Visual Conversion Funnel View */
        <div
          style={{
            marginTop: '6px',
            maxHeight: isExpanded ? '420px' : '280px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            paddingRight: '2px',
          }}
        >
          {activeData.map((row, idx) => {
            const label = String(row[xAxisKey] || `Bước ${idx + 1}`);
            const val = Number(row[primarySeriesKey]) || 0;
            const prevVal = idx > 0 ? Number(activeData[idx - 1]?.[primarySeriesKey]) || 0 : val;
            const shareOfTotal = totalPrimarySum > 0 ? ((val / totalPrimarySum) * 100).toFixed(1) : '0.0';
            const stepConversion = idx > 0 && prevVal > 0 ? ((val / prevVal) * 100).toFixed(1) : null;
            const barWidthPct = maxPrimaryVal > 0 ? Math.max(6, Math.round((val / maxPrimaryVal) * 100)) : 6;
            const barColor = PALETTE[idx % PALETTE.length];

            return (
              <div
                key={idx}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: '#f8fafc',
                  border: '1px solid #f1f5f9',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: barColor,
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#0f172a',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                      {formatNumberOrCurrency(val)}
                    </span>
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: '999px',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                      }}
                    >
                      {shareOfTotal}% tổng
                    </span>
                    {stepConversion && (
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 600,
                          padding: '1px 6px',
                          borderRadius: '999px',
                          background: '#ecfdf5',
                          color: '#047857',
                        }}
                        title="Tỷ lệ chuyển đổi từ bước liền trước"
                      >
                        ↳ {stepConversion}%
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ width: '100%', height: 7, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${barWidthPct}%`,
                      height: '100%',
                      background: barColor,
                      borderRadius: 999,
                      transition: 'width 0.35s ease',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : viewType === 'table' ? (
        /* Structured Ranked Data Table View */
        <div style={{ marginTop: '6px', maxHeight: isExpanded ? '420px' : '280px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <table
            style={{
              width: '100%',
              fontSize: '11.5px',
              borderCollapse: 'collapse',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ padding: '7px 10px', color: '#475569', fontWeight: 700, width: 42, textAlign: 'center' }}>STT</th>
                <th style={{ padding: '7px 10px', color: '#475569', fontWeight: 700 }}>Danh mục</th>
                {series.map((s) => (
                  <th key={s.dataKey} style={{ padding: '7px 10px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>
                    {s.name || s.dataKey}
                  </th>
                ))}
                <th style={{ padding: '7px 10px', color: '#475569', fontWeight: 700, width: 130, textAlign: 'right' }}>
                  Tỷ trọng (%)
                </th>
              </tr>
            </thead>
            <tbody>
              {activeData.map((row, rIdx) => {
                const rawVal = Number(row[primarySeriesKey]) || 0;
                const pct = totalPrimarySum > 0 ? (rawVal / totalPrimarySum) * 100 : 0;
                return (
                  <tr
                    key={rIdx}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: rIdx % 2 === 0 ? '#ffffff' : '#f8fafc',
                    }}
                  >
                    <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                      {rIdx + 1}
                    </td>
                    <td style={{ padding: '7px 10px', fontWeight: 600, color: '#0f172a' }}>
                      {row[xAxisKey] || `Hàng #${rIdx + 1}`}
                    </td>
                    {series.map((s) => (
                      <td key={s.dataKey} style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        {formatNumberOrCurrency(row[s.dataKey])}
                      </td>
                    ))}
                    <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        <div style={{ width: 52, height: 6, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min(100, Math.round(pct))}%`,
                              height: '100%',
                              background: PALETTE[rIdx % PALETTE.length],
                              borderRadius: 999,
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#334155', minWidth: 38 }}>
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f1f5f9', borderTop: '1px solid #cbd5e1', fontWeight: 700 }}>
                <td colSpan={2} style={{ padding: '8px 10px', color: '#0f172a' }}>
                  Tổng cộng ({activeData.length} mục)
                </td>
                {series.map((s) => {
                  const colSum = activeData.reduce((acc, r) => acc + (Number(r[s.dataKey]) || 0), 0);
                  return (
                    <td key={s.dataKey} style={{ padding: '8px 10px', textAlign: 'right', color: '#1d4ed8' }}>
                      {formatNumberOrCurrency(colSum)}
                    </td>
                  );
                })}
                <td style={{ padding: '8px 10px', textAlign: 'right', color: '#0f172a' }}>100.0%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        /* Recharts Visual Chart Modes: bar, hbar, line, area, pie, composed */
        <div style={{ width: '100%', height: `${chartHeight}px`, marginTop: '6px', transition: 'height 0.25s ease' }}>
          <ResponsiveContainer width="100%" height="100%">
            {viewType === 'line' ? (
              <LineChart data={activeData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey={xAxisKey} tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} tickFormatter={formatNumberOrCurrency} />
                <Tooltip content={<CustomTooltip totalSum={totalPrimarySum} />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px', color: '#334155' }} />
                {series.map((s, idx) => (
                  <Line
                    key={s.dataKey}
                    type="monotone"
                    dataKey={s.dataKey}
                    name={s.name || s.dataKey}
                    stroke={s.color || PALETTE[idx % PALETTE.length]}
                    strokeWidth={2.5}
                    dot={{ r: 3.5 }}
                    activeDot={{ r: 5.5 }}
                  />
                ))}
              </LineChart>
            ) : viewType === 'area' ? (
              <AreaChart data={activeData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey={xAxisKey} tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} tickFormatter={formatNumberOrCurrency} />
                <Tooltip content={<CustomTooltip totalSum={totalPrimarySum} />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px', color: '#334155' }} />
                {series.map((s, idx) => (
                  <Area
                    key={s.dataKey}
                    type="monotone"
                    dataKey={s.dataKey}
                    name={s.name || s.dataKey}
                    stroke={s.color || PALETTE[idx % PALETTE.length]}
                    fill={s.color || PALETTE[idx % PALETTE.length]}
                    fillOpacity={0.22}
                    strokeWidth={2}
                  />
                ))}
              </AreaChart>
            ) : viewType === 'pie' ? (
              <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <Tooltip content={<CustomTooltip totalSum={totalPrimarySum} />} />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#334155' }} />
                <Pie
                  data={activeData}
                  dataKey={primarySeriesKey}
                  nameKey={xAxisKey}
                  cx="50%"
                  cy="50%"
                  innerRadius={isExpanded ? 54 : 38}
                  outerRadius={isExpanded ? 104 : 74}
                  paddingAngle={3}
                  label={({ name, percent }: any) =>
                    percent && percent >= 0.05 ? `${String(name).slice(0, 14)}: ${(percent * 100).toFixed(0)}%` : ''
                  }
                  labelLine={false}
                >
                  {activeData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                  ))}
                </Pie>
              </PieChart>
            ) : viewType === 'hbar' ? (
              <BarChart data={activeData} layout="vertical" margin={{ top: 6, right: 24, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#475569' }} tickFormatter={formatNumberOrCurrency} />
                <YAxis
                  type="category"
                  dataKey={xAxisKey}
                  width={110}
                  tick={{ fontSize: 11, fill: '#334155' }}
                />
                <Tooltip content={<CustomTooltip totalSum={totalPrimarySum} />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px', color: '#334155' }} />
                {series.map((s, idx) => (
                  <Bar
                    key={s.dataKey}
                    dataKey={s.dataKey}
                    name={s.name || s.dataKey}
                    fill={s.color || PALETTE[idx % PALETTE.length]}
                    radius={[0, 4, 4, 0]}
                  />
                ))}
              </BarChart>
            ) : viewType === 'composed' ? (
              <ComposedChart data={activeData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey={xAxisKey} tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} tickFormatter={formatNumberOrCurrency} />
                <Tooltip content={<CustomTooltip totalSum={totalPrimarySum} />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px', color: '#334155' }} />
                {series.map((s, idx) =>
                  s.type === 'line' ? (
                    <Line
                      key={s.dataKey}
                      type="monotone"
                      dataKey={s.dataKey}
                      name={s.name || s.dataKey}
                      stroke={s.color || PALETTE[idx % PALETTE.length]}
                      strokeWidth={2.5}
                    />
                  ) : s.type === 'area' ? (
                    <Area
                      key={s.dataKey}
                      type="monotone"
                      dataKey={s.dataKey}
                      name={s.name || s.dataKey}
                      stroke={s.color || PALETTE[idx % PALETTE.length]}
                      fill={s.color || PALETTE[idx % PALETTE.length]}
                      fillOpacity={0.2}
                    />
                  ) : (
                    <Bar
                      key={s.dataKey}
                      dataKey={s.dataKey}
                      name={s.name || s.dataKey}
                      fill={s.color || PALETTE[idx % PALETTE.length]}
                      radius={[4, 4, 0, 0]}
                    />
                  )
                )}
              </ComposedChart>
            ) : (
              /* Default: Vertical BarChart ('bar') */
              <BarChart data={activeData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey={xAxisKey} tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} tickFormatter={formatNumberOrCurrency} />
                <Tooltip content={<CustomTooltip totalSum={totalPrimarySum} />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px', color: '#334155' }} />
                {series.map((s, idx) => (
                  <Bar
                    key={s.dataKey}
                    dataKey={s.dataKey}
                    name={s.name || s.dataKey}
                    fill={s.color || PALETTE[idx % PALETTE.length]}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
