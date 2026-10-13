// src/components/chat/ChatDynamicChart.tsx
// In-Chat Micro-BI Visual Charts for SI IDEAS using Recharts

import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
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
import { BarChart3, TrendingUp, PieChart as PieIcon, Table as TableIcon, Eye } from 'lucide-react';
import type { DynamicChartData } from './chatTagParsers';

const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#ef4444'];

const formatNumberOrCurrency = (val: any) => {
  if (typeof val !== 'number') return val;
  if (Math.abs(val) >= 1e9) {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(val / 1e9) + ' Tỷ đ';
  }
  if (Math.abs(val) >= 1e6) {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(val / 1e6) + ' Tr đ';
  }
  return new Intl.NumberFormat('vi-VN').format(val);
};

interface ChatDynamicChartProps {
  chart: DynamicChartData;
}

export const ChatDynamicChart: React.FC<ChatDynamicChartProps> = ({ chart }) => {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  if (!chart || !Array.isArray(chart.data) || chart.data.length === 0) {
    return null;
  }

  const xAxisKey = chart.xAxisKey || 'name';
  const series = chart.series && chart.series.length > 0 ? chart.series : [{ dataKey: 'value', name: 'Số lượng' }];

  const ChartIcon = chart.type === 'pie' ? PieIcon : chart.type === 'line' ? TrendingUp : BarChart3;

  return (
    <div
      style={{
        marginTop: '10px',
        marginBottom: '6px',
        borderRadius: '12px',
        border: '1px solid rgba(148, 163, 184, 0.25)',
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(8px)',
        padding: '12px',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.04)',
        maxWidth: '100%',
        overflow: 'hidden',
      }}
      className="dark:!bg-slate-900/90 dark:!border-slate-800"
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
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
                fontWeight: 600,
                color: '#1e293b',
                margin: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              className="dark:!text-slate-100"
            >
              {chart.title}
            </h4>
            {chart.description && (
              <p
                style={{
                  fontSize: '11px',
                  color: '#64748b',
                  margin: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                className="dark:!text-slate-400"
              >
                {chart.description}
              </p>
            )}
          </div>
        </div>

        {/* View mode toggle */}
        <button
          onClick={() => setViewMode(viewMode === 'chart' ? 'table' : 'chart')}
          title={viewMode === 'chart' ? 'Xem dạng bảng' : 'Xem dạng biểu đồ'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            fontWeight: 500,
            padding: '4px 8px',
            borderRadius: '6px',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            background: 'transparent',
            color: '#475569',
            cursor: 'pointer',
          }}
          className="dark:!text-slate-300 dark:!border-slate-700 hover:!bg-slate-100 dark:hover:!bg-slate-800"
        >
          {viewMode === 'chart' ? (
            <>
              <TableIcon size={12} />
              <span>Bảng số liệu</span>
            </>
          ) : (
            <>
              <Eye size={12} />
              <span>Biểu đồ</span>
            </>
          )}
        </button>
      </div>

      {/* Main View */}
      {viewMode === 'chart' ? (
        <div style={{ width: '100%', height: '220px', marginTop: '6px' }}>
          <ResponsiveContainer width="100%" height="100%">
            {chart.type === 'line' ? (
              <LineChart data={chart.data} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey={xAxisKey} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={formatNumberOrCurrency} />
                <Tooltip
                  formatter={(val: any) => [formatNumberOrCurrency(val)]}
                  contentStyle={{
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    border: '1px solid #e2e8f0',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                {series.map((s, idx) => (
                  <Line
                    key={s.dataKey}
                    type="monotone"
                    dataKey={s.dataKey}
                    name={s.name || s.dataKey}
                    stroke={s.color || PALETTE[idx % PALETTE.length]}
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            ) : chart.type === 'area' ? (
              <AreaChart data={chart.data} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey={xAxisKey} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={formatNumberOrCurrency} />
                <Tooltip
                  formatter={(val: any) => [formatNumberOrCurrency(val)]}
                  contentStyle={{
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    border: '1px solid #e2e8f0',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                {series.map((s, idx) => (
                  <Area
                    key={s.dataKey}
                    type="monotone"
                    dataKey={s.dataKey}
                    name={s.name || s.dataKey}
                    stroke={s.color || PALETTE[idx % PALETTE.length]}
                    fill={s.color || PALETTE[idx % PALETTE.length]}
                    fillOpacity={0.25}
                  />
                ))}
              </AreaChart>
            ) : chart.type === 'pie' ? (
              <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <Tooltip
                  formatter={(val: any) => [formatNumberOrCurrency(val)]}
                  contentStyle={{
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    border: '1px solid #e2e8f0',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Pie
                  data={chart.data}
                  dataKey={series[0]?.dataKey || 'value'}
                  nameKey={xAxisKey}
                  cx="50%"
                  cy="50%"
                  innerRadius={36}
                  outerRadius={70}
                  paddingAngle={3}
                >
                  {chart.data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                  ))}
                </Pie>
              </PieChart>
            ) : (
              // Default: BarChart
              <BarChart data={chart.data} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey={xAxisKey} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={formatNumberOrCurrency} />
                <Tooltip
                  formatter={(val: any) => [formatNumberOrCurrency(val)]}
                  contentStyle={{
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    border: '1px solid #e2e8f0',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
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
      ) : (
        // Table View
        <div style={{ marginTop: '8px', maxHeight: '200px', overflowY: 'auto' }}>
          <table
            style={{
              width: '100%',
              fontSize: '11px',
              borderCollapse: 'collapse',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>
                <th style={{ padding: '6px 8px', color: '#64748b' }}>Tiêu chí</th>
                {series.map((s) => (
                  <th key={s.dataKey} style={{ padding: '6px 8px', color: '#64748b', textAlign: 'right' }}>
                    {s.name || s.dataKey}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chart.data.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}
                  className="hover:!bg-slate-50 dark:hover:!bg-slate-800/50"
                >
                  <td style={{ padding: '6px 8px', fontWeight: 500 }}>{row[xAxisKey] || `Hàng #${rIdx + 1}`}</td>
                  {series.map((s) => (
                    <td key={s.dataKey} style={{ padding: '6px 8px', textAlign: 'right' }}>
                      {formatNumberOrCurrency(row[s.dataKey])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
