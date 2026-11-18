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

const PALETTE = ['#C6333D', '#334155', '#E11D48', '#64748B', '#991B1B', '#475569', '#FB7185', '#94A3B8', '#1E293B', '#CBD5E1'];

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
              <span style={{ color: '#0F172A', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
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
        marginTop: '8px',
        marginBottom: '8px',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        background: '#FFFFFF',
        padding: '12px 16px',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
        maxWidth: '100%',
        overflow: 'hidden',
        transition: 'border-color 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          marginBottom: datasets && datasets.length > 1 ? '8px' : '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: '1 1 200px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(189, 29, 45, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#BD1D2D',
              flexShrink: 0,
            }}
          >
            <ChartIcon size={16} strokeWidth={1.75} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h4
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: '#0F172A',
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
                  color: '#64748B',
                  margin: '4px 0 0 0',
                  lineHeight: 1.35,
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
              background: '#F1F5F9',
              padding: '2px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              gap: '2px',
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
                    fontSize: '11px',
                    fontWeight: active ? 700 : 500,
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: 'none',
                    background: active ? '#FFFFFF' : 'transparent',
                    color: active ? '#BD1D2D' : '#64748B',
                    boxShadow: active ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s cubic-bezier(0.22, 1, 0.36, 1), color 0.15s cubic-bezier(0.22, 1, 0.36, 1)',
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
              padding: '6px 8px',
              borderRadius: '6px',
              border: '1px solid #E2E8F0',
              background: '#F8FAFC',
              color: isCopied ? '#10B981' : '#475569',
              cursor: 'pointer',
              transition: 'background-color 0.15s cubic-bezier(0.22, 1, 0.36, 1), color 0.15s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {isCopied ? <Check size={12} strokeWidth={2} /> : <Copy size={12} strokeWidth={1.75} />}
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
              padding: '6px 8px',
              borderRadius: '6px',
              border: '1px solid #E2E8F0',
              background: '#F8FAFC',
              color: '#475569',
              cursor: 'pointer',
              transition: 'background-color 0.15s cubic-bezier(0.22, 1, 0.36, 1), color 0.15s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {isExpanded ? <Minimize2 size={12} strokeWidth={1.75} /> : <Maximize2 size={12} strokeWidth={1.75} />}
          </button>
        </div>
      </div>

      {/* Multi-Dataset Pill Tab Bar */}
      {datasets && datasets.length > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '8px',
            marginBottom: '8px',
            borderBottom: '1px solid #F1F5F9',
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
                  padding: '4px 12px',
                  borderRadius: '8px',
                  border: isSelected ? '1px solid rgba(189, 29, 45, 0.35)' : '1px solid #E2E8F0',
                  background: isSelected ? 'rgba(189, 29, 45, 0.08)' : '#F8FAFC',
                  color: isSelected ? '#BD1D2D' : '#475569',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'background-color 0.15s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.15s cubic-bezier(0.22, 1, 0.36, 1), color 0.15s cubic-bezier(0.22, 1, 0.36, 1)',
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
            marginTop: '8px',
            maxHeight: isExpanded ? '420px' : '280px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            paddingRight: '4px',
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
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: barColor,
                        color: '#FFFFFF',
                        fontSize: 11,
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
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
                        color: '#0F172A',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
                      {formatNumberOrCurrency(val)}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: '#F1F5F9',
                        color: '#334155',
                      }}
                    >
                      {shareOfTotal}% tổng
                    </span>
                    {stepConversion && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: '#ECFDF5',
                          color: '#047857',
                        }}
                        title="Tỷ lệ chuyển đổi từ bước liền trước"
                      >
                        ↳ {stepConversion}%
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ width: '100%', height: 6, background: '#E2E8F0', borderRadius: 999, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${barWidthPct}%`,
                      height: '100%',
                      background: barColor,
                      borderRadius: 999,
                      transition: 'width 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : viewType === 'table' ? (
        /* Structured Ranked Data Table View */
        <div style={{ marginTop: '8px', maxHeight: isExpanded ? '420px' : '280px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
          <table
            style={{
              width: '100%',
              fontSize: '12px',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #CBD5E1' }}>
                <th style={{ padding: '8px 12px', color: '#475569', fontWeight: 700, width: 44, textAlign: 'center' }}>STT</th>
                <th style={{ padding: '8px 12px', color: '#475569', fontWeight: 700 }}>Danh mục</th>
                {series.map((s) => (
                  <th key={s.dataKey} style={{ padding: '8px 12px', color: '#475569', fontWeight: 700, textAlign: 'right' }}>
                    {s.name || s.dataKey}
                  </th>
                ))}
                <th style={{ padding: '8px 12px', color: '#475569', fontWeight: 700, width: 132, textAlign: 'right' }}>
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
                      borderBottom: '1px solid #F1F5F9',
                      background: rIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC',
                    }}
                  >
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: '#64748B', fontWeight: 600 }}>
                      {rIdx + 1}
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0F172A' }}>
                      {row[xAxisKey] || `Hàng #${rIdx + 1}`}
                    </td>
                    {series.map((s) => (
                      <td key={s.dataKey} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                        {formatNumberOrCurrency(row[s.dataKey])}
                      </td>
                    ))}
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                        <div style={{ width: 52, height: 6, background: '#E2E8F0', borderRadius: 999, overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min(100, Math.round(pct))}%`,
                              height: '100%',
                              background: PALETTE[rIdx % PALETTE.length],
                              borderRadius: 999,
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#334155', minWidth: 40 }}>
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#F1F5F9', borderTop: '1px solid #CBD5E1', fontWeight: 700 }}>
                <td colSpan={2} style={{ padding: '8px 12px', color: '#0F172A' }}>
                  Tổng cộng ({activeData.length} mục)
                </td>
                {series.map((s) => {
                  const colSum = activeData.reduce((acc, r) => acc + (Number(r[s.dataKey]) || 0), 0);
                  return (
                    <td key={s.dataKey} style={{ padding: '8px 12px', textAlign: 'right', color: '#BD1D2D' }}>
                      {formatNumberOrCurrency(colSum)}
                    </td>
                  );
                })}
                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#0F172A' }}>100.0%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        /* Recharts Visual Chart Modes: bar, hbar, line, area, pie, composed */
        <div style={{ width: '100%', height: `${chartHeight}px`, marginTop: '8px', transition: 'height 0.25s cubic-bezier(0.22, 1, 0.36, 1)', fontVariantNumeric: 'tabular-nums' }}>
          <ResponsiveContainer width="100%" height="100%">
            {viewType === 'line' ? (
              <LineChart data={activeData} margin={{ top: 12, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" strokeOpacity={0.7} vertical={false} />
                <XAxis dataKey={xAxisKey} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={formatNumberOrCurrency} />
                <Tooltip content={<CustomTooltip totalSum={totalPrimarySum} />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px', color: '#334155' }} />
                {series.map((s, idx) => (
                  <Line
                    key={s.dataKey}
                    type="monotone"
                    dataKey={s.dataKey}
                    name={s.name || s.dataKey}
                    stroke={s.color || PALETTE[idx % PALETTE.length]}
                    strokeWidth={2.25}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            ) : viewType === 'area' ? (
              <AreaChart data={activeData} margin={{ top: 12, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" strokeOpacity={0.7} vertical={false} />
                <XAxis dataKey={xAxisKey} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={formatNumberOrCurrency} />
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
                    fillOpacity={0.14}
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
              <BarChart data={activeData} layout="vertical" margin={{ top: 8, right: 24, left: 12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" strokeOpacity={0.7} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} tickFormatter={formatNumberOrCurrency} />
                <YAxis
                  type="category"
                  dataKey={xAxisKey}
                  width={110}
                  tick={{ fontSize: 11, fill: '#334155' }}
                  axisLine={false}
                  tickLine={false}
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
              <ComposedChart data={activeData} margin={{ top: 12, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" strokeOpacity={0.7} vertical={false} />
                <XAxis dataKey={xAxisKey} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={formatNumberOrCurrency} />
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
                      strokeWidth={2.25}
                    />
                  ) : s.type === 'area' ? (
                    <Area
                      key={s.dataKey}
                      type="monotone"
                      dataKey={s.dataKey}
                      name={s.name || s.dataKey}
                      stroke={s.color || PALETTE[idx % PALETTE.length]}
                      fill={s.color || PALETTE[idx % PALETTE.length]}
                      fillOpacity={0.14}
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
              <BarChart data={activeData} margin={{ top: 12, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" strokeOpacity={0.7} vertical={false} />
                <XAxis dataKey={xAxisKey} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={formatNumberOrCurrency} />
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
