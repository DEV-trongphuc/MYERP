import React, { useEffect, useState } from 'react';

// ─── Simple hook for responsive skeletons ──────────────────────────────────
const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return isMobile;
};

// ─── Skeleton primitive ─────────────────────────────────────────────────────
interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}

export const Skeleton = ({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) => (
  <div
    className="skeleton"
    style={{
      width,
      height,
      borderRadius,
      flexShrink: 0,
      ...style,
    }}
  />
);

// ─── KPI card skeleton ───────────────────────────────────────────────────────
export const KpiCardSkeleton = () => (
  <div
    className="stat-card skeleton-card"
    style={{
      minHeight: '138px',
      padding: '1.15rem 1.25rem',
      borderRadius: 16,
      border: '1px solid #e2e8f0',
      background: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Skeleton width="58%" height={11} borderRadius={4} />
      <Skeleton width={32} height={32} borderRadius={8} />
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Skeleton width="48%" height={28} borderRadius={6} />
      <Skeleton width="28%" height={20} borderRadius={6} />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 'auto' }}>
      <Skeleton width="78%" height={10} borderRadius={4} />
      <Skeleton width="64%" height={10} borderRadius={4} />
    </div>
  </div>
);

// ─── Table row skeleton ──────────────────────────────────────────────────────
export const TableRowSkeleton = ({ cols = 4 }: { cols?: number }) => (
  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} style={{ padding: '1rem 1.25rem' }}>
        <Skeleton width={i === 0 ? 120 : i === cols - 1 ? 65 : 85} height={13} />
        {i === 0 && <Skeleton width={70} height={9} style={{ marginTop: 5 }} />}
      </td>
    ))}
  </tr>
);

// ─── Table skeleton (full) ───────────────────────────────────────────────────
export const TableSkeleton = ({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) => {
  const isMobile = useResponsive();
  const activeCols = isMobile ? Math.min(cols, 2) : cols;

  return (
    <div className="card skeleton-card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 16 }}>
        {Array.from({ length: activeCols }).map((_, i) => (
          <Skeleton key={i} width={i === 0 ? 100 : 70} height={11} />
        ))}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} cols={activeCols} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Card skeleton (general) ─────────────────────────────────────────────────
export const CardSkeleton = ({ height = 120 }: { height?: number }) => (
  <div className="card skeleton-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Skeleton width={40} height={40} borderRadius="50%" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton width="55%" height={13} />
        <Skeleton width="35%" height={11} />
      </div>
    </div>
    <Skeleton width="100%" height={height - 75} borderRadius={8} />
  </div>
);

// ─── Page header skeleton ────────────────────────────────────────────────────
export const PageHeaderSkeleton = () => {
  const isMobile = useResponsive();
  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 12, marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
        <Skeleton width={isMobile ? '60%' : 200} height={20} />
        <Skeleton width={isMobile ? '80%' : 280} height={12} />
      </div>
      {!isMobile && <Skeleton width={120} height={36} borderRadius={8} />}
    </div>
  );
};

// ─── Stat row skeleton ───────────────────────────────────────────────────────
export const StatRowSkeleton = () => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
    <Skeleton width={32} height={32} borderRadius="50%" />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Skeleton width="50%" height={12} />
      <Skeleton width="30%" height={10} />
    </div>
    <Skeleton width={45} height={20} borderRadius={10} />
  </div>
);

// ─── Round card skeleton ─────────────────────────────────────────────────────
export const RoundCardSkeleton = () => (
  <div className="card skeleton-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton width={140} height={16} />
        <Skeleton width={70} height={20} borderRadius={16} />
      </div>
      <Skeleton width={24} height={24} borderRadius={6} />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <StatRowSkeleton key={i} />
      ))}
    </div>
    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
      <Skeleton width={75} height={30} borderRadius={6} />
      <Skeleton width={90} height={30} borderRadius={6} />
    </div>
  </div>
);

// ─── Calendar skeleton ────────────────────────────────────────────────────────
export const CalendarSkeleton = () => {
  const isMobile = useResponsive();
  const totalCells = isMobile ? 7 : 28; // On mobile, just show one row/week skeleton

  return (
    <div className="skeleton-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: isMobile ? 'minmax(65px, 1fr)' : 'minmax(110px, 1fr)', width: '100%' }}>
      {Array.from({ length: totalCells }).map((_, i) => (
        <div
          key={i}
          style={{
            borderRight: '1px solid var(--color-border-light)',
            borderBottom: '1px solid var(--color-border-light)',
            padding: isMobile ? '0.375rem' : '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: isMobile ? 4 : 8,
            background: i % 7 === 5 || i % 7 === 6 ? 'var(--color-calendar-weekend, rgba(0,0,0,0.01))' : 'transparent'
          }}
        >
          <Skeleton width={15} height={10} />
          {!isMobile && (
            <>
              <Skeleton width="80%" height={9} style={{ marginTop: 4 }} />
              <Skeleton width="55%" height={9} />
            </>
          )}
        </div>
      ))}
    </div>
  );
};

// ─── Chart skeleton ──────────────────────────────────────────────────────────
export const ChartSkeleton = ({ height = 300 }: { height?: number }) => {
  const isMobile = useResponsive();
  const barsCount = isMobile ? 6 : 10;

  return (
    <div className="card skeleton-card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <Skeleton width={isMobile ? '68%' : 210} height={17} borderRadius={6} />
          <Skeleton width={isMobile ? '85%' : 280} height={11} borderRadius={5} />
        </div>
        <Skeleton width={88} height={26} borderRadius={8} />
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: isMobile ? 8 : 14, height: height - 65, padding: '12px 4px 0' }}>
        {Array.from({ length: barsCount }).map((_, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
            <Skeleton width="65%" height={10} borderRadius={3} />
            <Skeleton width="100%" height={`${Math.max(18, Math.round(Math.sin(i * 1.1) * 32 + 52))}%`} borderRadius="6px 6px 2px 2px" />
            <Skeleton width="75%" height={9} borderRadius={3} />
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Archetype 1 Skeleton: Ranked List (Left) + 162x162 Donut (Right) ────────
export const DonutAndRankedListSkeleton = ({ rows = 5 }: { rows?: number }) => {
  const isMobile = useResponsive();
  return (
    <div className="card skeleton-card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <Skeleton width={isMobile ? '70%' : 220} height={17} borderRadius={6} />
          <Skeleton width={isMobile ? '88%' : 270} height={11} borderRadius={5} />
        </div>
        <Skeleton width={76} height={26} borderRadius={8} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.15fr 0.85fr', gap: '1.1rem', alignItems: 'center' }}>
        {/* Left: Ranked List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 8px', borderRadius: 8, border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                  <Skeleton width={18} height={13} borderRadius={4} />
                  <Skeleton width={22} height={22} borderRadius={6} />
                  <Skeleton width={`${62 - (i % 3) * 10}%`} height={13} borderRadius={4} />
                </div>
                <Skeleton width={52} height={14} borderRadius={4} />
              </div>
              <div style={{ marginLeft: 26 }}>
                <Skeleton width={`${Math.max(25, 92 - i * 14)}%`} height={6} borderRadius={4} />
              </div>
            </div>
          ))}
        </div>

        {/* Right: Circular Donut Skeleton */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            paddingLeft: isMobile ? 0 : 12,
            paddingTop: isMobile ? 12 : 0,
            borderLeft: isMobile ? 'none' : '1px solid #f1f5f9',
            borderTop: isMobile ? '1px solid #f1f5f9' : 'none'
          }}
        >
          <div style={{ position: 'relative', width: 156, height: 156, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Skeleton width={156} height={156} borderRadius="50%" />
            <div
              style={{
                position: 'absolute',
                width: 108,
                height: 108,
                borderRadius: '50%',
                background: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <Skeleton width={46} height={18} borderRadius={5} />
              <Skeleton width={64} height={10} borderRadius={4} />
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 12 }}>
            <Skeleton width={68} height={14} borderRadius={4} />
            <Skeleton width={68} height={14} borderRadius={4} />
            <Skeleton width={68} height={14} borderRadius={4} />
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Archetype 2 Skeleton: 154x154 Donut (Left) + Vertical Column BarChart (Right) ──
export const DonutAndBarChartSkeleton = () => {
  const isMobile = useResponsive();
  return (
    <div className="card skeleton-card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <Skeleton width={isMobile ? '68%' : 210} height={17} borderRadius={6} />
          <Skeleton width={isMobile ? '85%' : 265} height={11} borderRadius={5} />
        </div>
        <Skeleton width={74} height={26} borderRadius={8} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '0.88fr 1.12fr', gap: '1.1rem', alignItems: 'center', flex: 1 }}>
        {/* Left: Donut + Legend Boxes */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            paddingRight: isMobile ? 0 : 10,
            paddingBottom: isMobile ? 12 : 0,
            borderRight: isMobile ? 'none' : '1px solid #f1f5f9',
            borderBottom: isMobile ? '1px solid #f1f5f9' : 'none'
          }}
        >
          <div style={{ position: 'relative', width: 146, height: 146, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Skeleton width={146} height={146} borderRadius="50%" />
            <div
              style={{
                position: 'absolute',
                width: 100,
                height: 100,
                borderRadius: '50%',
                background: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5
              }}
            >
              <Skeleton width={44} height={16} borderRadius={4} />
              <Skeleton width={58} height={10} borderRadius={4} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 195, marginTop: 10 }}>
            <Skeleton width="100%" height={26} borderRadius={7} />
            <Skeleton width="100%" height={26} borderRadius={7} />
          </div>
        </div>

        {/* Right: Vertical Column Bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: 215, justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton width={110} height={13} borderRadius={4} />
            <Skeleton width={65} height={11} borderRadius={4} />
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 10, paddingTop: 10 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                <Skeleton width="70%" height={9} borderRadius={3} />
                <Skeleton width="100%" height={`${Math.max(22, 35 + ((i * 23) % 58))}%`} borderRadius="6px 6px 2px 2px" />
                <Skeleton width="80%" height={9} borderRadius={3} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Interaction 6-Box Grid Skeleton (for Meta Ads Engagement & Video) ───────
export const InteractionGridSkeleton = () => {
  const isMobile = useResponsive();
  return (
    <div className="card skeleton-card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <Skeleton width={isMobile ? '75%' : 240} height={17} borderRadius={6} />
          <Skeleton width={isMobile ? '90%' : 290} height={11} borderRadius={5} />
        </div>
        <Skeleton width={120} height={26} borderRadius={8} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ padding: 14, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Skeleton width="58%" height={12} borderRadius={4} />
              <Skeleton width={26} height={26} borderRadius={7} />
            </div>
            <Skeleton width="72%" height={22} borderRadius={6} />
            <Skeleton width="85%" height={10} borderRadius={4} />
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Leaderboard Card Skeleton (Avatar + Medal + Progress Bar) ───────────────
export const LeaderboardCardSkeleton = ({ rows = 5 }: { rows?: number }) => {
  const isMobile = useResponsive();
  return (
    <div className="card skeleton-card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <Skeleton width={isMobile ? '72%' : 220} height={17} borderRadius={6} />
          <Skeleton width={isMobile ? '88%' : 280} height={11} borderRadius={5} />
        </div>
        <Skeleton width={isMobile ? 90 : 150} height={30} borderRadius={8} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <Skeleton width={20} height={16} borderRadius={4} />
                <Skeleton width={28} height={28} borderRadius="50%" />
                <Skeleton width={isMobile ? '55%' : 140} height={14} borderRadius={4} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Skeleton width={48} height={15} borderRadius={4} />
                <Skeleton width={38} height={20} borderRadius={6} />
              </div>
            </div>
            <div style={{ marginLeft: 30 }}>
              <Skeleton width={`${Math.max(30, 92 - i * 14)}%`} height={5} borderRadius={4} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Completeness / SLA Health Grid Skeleton ─────────────────────────────────
export const CompletenessGridSkeleton = ({ items = 6 }: { items?: number }) => {
  const isMobile = useResponsive();
  return (
    <div className="card skeleton-card" style={{ padding: '1.35rem', borderRadius: 16, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <Skeleton width={isMobile ? '70%' : 210} height={17} borderRadius={6} />
          <Skeleton width={isMobile ? '85%' : 260} height={11} borderRadius={5} />
        </div>
        <Skeleton width={86} height={26} borderRadius={8} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        {Array.from({ length: items }).map((_, i) => (
          <div key={i} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Skeleton width="56%" height={13} borderRadius={4} />
              <Skeleton width={42} height={18} borderRadius={999} />
            </div>
            <Skeleton width="100%" height={6} borderRadius={999} />
            <Skeleton width="42%" height={10} borderRadius={4} />
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Pipeline 4-Card + Spectrum Bar Skeleton ─────────────────────────────────
export const PipelineCardsAndSpectrumSkeleton = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skeleton width={210} height={17} borderRadius={6} />
        <Skeleton width={310} height={11} borderRadius={5} />
      </div>
      <Skeleton width={110} height={26} borderRadius={8} />
    </div>
    <div className="dashboard-kpi-grid" style={{ marginBottom: 0 }}>
      <KpiCardSkeleton />
      <KpiCardSkeleton />
      <KpiCardSkeleton />
      <KpiCardSkeleton />
    </div>
    <div className="card skeleton-card" style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Skeleton width={130} height={14} borderRadius={4} />
        <Skeleton width={85} height={20} borderRadius={6} />
        <Skeleton width={95} height={20} borderRadius={6} />
        <Skeleton width={95} height={20} borderRadius={6} />
      </div>
      <Skeleton width={280} height={8} borderRadius={999} />
    </div>
  </div>
);

// ─── Drawer skeleton (for Customer / Task / Expense Drawers) ─────────────────
export const DrawerSkeleton = () => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px', gap: '20px', background: 'var(--color-surface)' }}>
    {/* Drawer Header */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <Skeleton width={44} height={44} borderRadius="50%" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Skeleton width={180} height={18} />
          <Skeleton width={110} height={12} />
        </div>
      </div>
      <Skeleton width={70} height={28} borderRadius={6} />
    </div>

    {/* Navigation Tabs */}
    <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
      <Skeleton width={80} height={24} borderRadius={6} />
      <Skeleton width={90} height={24} borderRadius={6} />
      <Skeleton width={75} height={24} borderRadius={6} />
      <Skeleton width={100} height={24} borderRadius={6} />
    </div>

    {/* Form / Content Grid */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <Skeleton width={90} height={12} />
        <Skeleton width="100%" height={38} borderRadius={8} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <Skeleton width={110} height={12} />
        <Skeleton width="100%" height={38} borderRadius={8} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <Skeleton width={80} height={12} />
        <Skeleton width="100%" height={38} borderRadius={8} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <Skeleton width={100} height={12} />
        <Skeleton width="100%" height={38} borderRadius={8} />
      </div>
    </div>

    {/* Large description area */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
      <Skeleton width={130} height={14} />
      <Skeleton width="100%" height={120} borderRadius={10} />
    </div>

    {/* Activity Feed / Timeline items */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <Skeleton width={32} height={32} borderRadius="50%" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <Skeleton width="60%" height={12} />
          <Skeleton width="40%" height={10} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <Skeleton width={32} height={32} borderRadius="50%" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <Skeleton width="50%" height={12} />
          <Skeleton width="30%" height={10} />
        </div>
      </div>
    </div>
  </div>
);

// ─── Timeline skeleton ───────────────────────────────────────────────────────
export const TimelineSkeleton = ({ count = 4 }: { count?: number }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '12px 0' }}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
        <Skeleton width={34} height={34} borderRadius="50%" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--color-bg-secondary, rgba(0,0,0,0.02))', padding: '12px', borderRadius: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton width={130} height={14} />
            <Skeleton width={70} height={10} />
          </div>
          <Skeleton width="90%" height={12} />
          <Skeleton width="65%" height={12} />
        </div>
      </div>
    ))}
  </div>
);

// ─── Specialized Per-Tab Skeletons ───────────────────────────────────────────

export const DashboardTabSkeleton = () => {
  const isMobile = useResponsive();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      {/* Header + Period Filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Skeleton width={isMobile ? 180 : 240} height={24} borderRadius={8} />
          <Skeleton width={isMobile ? 220 : 320} height={13} borderRadius={6} />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Skeleton width={150} height={38} borderRadius={10} />
          {!isMobile && <Skeleton width={110} height={38} borderRadius={10} />}
        </div>
      </div>

      {/* 4-Card KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '1rem' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>

      {/* 2-Column Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr', gap: '1.25rem' }}>
        <ChartSkeleton height={280} />
        <ChartSkeleton height={280} />
      </div>

      {/* Bottom Table / Leaderboard Card */}
      <TableSkeleton rows={5} cols={5} />
    </div>
  );
};

export const WorkspaceTabSkeleton = () => {
  const isMobile = useResponsive();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      {/* Greeting Banner + Quick Stats Pills */}
      <div className="card skeleton-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Skeleton width={48} height={48} borderRadius="50%" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Skeleton width={220} height={20} borderRadius={6} />
            <Skeleton width={280} height={12} borderRadius={6} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} width={96} height={32} borderRadius={20} />
          ))}
        </div>
      </div>

      {/* 2-Column Split: Left Task List & Priorities, Right Activity Timeline & SLA */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.35fr 1fr', gap: '1.25rem' }}>
        <div className="card skeleton-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton width={180} height={18} />
            <div style={{ display: 'flex', gap: '6px' }}>
              <Skeleton width={70} height={26} borderRadius={14} />
              <Skeleton width={70} height={26} borderRadius={14} />
            </div>
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '10px', border: '1px solid var(--color-border-light)' }}>
              <Skeleton width={20} height={20} borderRadius={6} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <Skeleton width="70%" height={13} />
                <Skeleton width="45%" height={10} />
              </div>
              <Skeleton width={68} height={22} borderRadius={12} />
            </div>
          ))}
        </div>

        <div className="card skeleton-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton width={160} height={18} />
            <Skeleton width={60} height={22} borderRadius={10} />
          </div>
          <TimelineSkeleton count={4} />
        </div>
      </div>
    </div>
  );
};

export const CalendarTabSkeleton = () => {
  const isMobile = useResponsive();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      {/* Header with Month/Week/Day switcher pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Skeleton width={200} height={22} />
          <Skeleton width={260} height={12} />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Skeleton width={120} height={36} borderRadius={8} />
          <div style={{ display: 'flex', gap: '4px', padding: '4px', background: 'var(--color-surface)', borderRadius: 10, border: '1px solid var(--color-border-light)' }}>
            <Skeleton width={64} height={28} borderRadius={6} />
            <Skeleton width={64} height={28} borderRadius={6} />
            {!isMobile && <Skeleton width={64} height={28} borderRadius={6} />}
          </div>
        </div>
      </div>

      {/* Weekday Header + 7-Column Calendar Grid */}
      <div className="card skeleton-card" style={{ padding: 0, overflow: 'hidden', borderRadius: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--color-border-light)', padding: '10px 0', background: 'var(--color-bg)' }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'center' }}>
              <Skeleton width={isMobile ? 24 : 48} height={12} borderRadius={4} />
            </div>
          ))}
        </div>
        <CalendarSkeleton />
      </div>
    </div>
  );
};

export const FeedTabSkeleton = () => {
  const isMobile = useResponsive();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '260px minmax(0, 1fr) 280px', gap: '1.25rem', width: '100%', alignItems: 'start' }}>
      {/* Left: Quick profile / groups card */}
      {!isMobile && (
        <div className="card skeleton-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Skeleton width={44} height={44} borderRadius="50%" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <Skeleton width="80%" height={14} />
              <Skeleton width="55%" height={11} />
            </div>
          </div>
          <div style={{ height: 1, background: 'var(--color-border-light)' }} />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Skeleton width={28} height={28} borderRadius={8} />
              <Skeleton width="70%" height={12} />
            </div>
          ))}
        </div>
      )}

      {/* Center: Post composer + 2 rich social post card skeletons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="card skeleton-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Skeleton width={40} height={40} borderRadius="50%" />
            <Skeleton width="100%" height={40} borderRadius={20} style={{ flex: 1 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--color-border-light)' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Skeleton width={85} height={28} borderRadius={8} />
              <Skeleton width={85} height={28} borderRadius={8} />
            </div>
            <Skeleton width={90} height={32} borderRadius={8} />
          </div>
        </div>

        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card skeleton-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Skeleton width={42} height={42} borderRadius="50%" />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <Skeleton width={160} height={14} />
                <Skeleton width={100} height={11} />
              </div>
              <Skeleton width={28} height={28} borderRadius={6} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Skeleton width="95%" height={12} />
              <Skeleton width="82%" height={12} />
              <Skeleton width="60%" height={12} />
            </div>
            <Skeleton width="100%" height={190} borderRadius={12} />
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--color-border-light)' }}>
              <Skeleton width={70} height={24} borderRadius={6} />
              <Skeleton width={90} height={24} borderRadius={6} />
              <Skeleton width={70} height={24} borderRadius={6} />
            </div>
          </div>
        ))}
      </div>

      {/* Right: Pinned announcements & birthday widget */}
      {!isMobile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card skeleton-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Skeleton width={140} height={15} />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px', borderRadius: 8, background: 'var(--color-bg)' }}>
                <Skeleton width="85%" height={12} />
                <Skeleton width="50%" height={10} />
              </div>
            ))}
          </div>
          <div className="card skeleton-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Skeleton width={130} height={15} />
            <StatRowSkeleton />
            <StatRowSkeleton />
          </div>
        </div>
      )}
    </div>
  );
};

export const ApprovalsTabSkeleton = () => {
  const isMobile = useResponsive();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem', width: '100%' }}>
      {/* Header: Quy trình hệ thống + Làm mới / Tạo đề xuất */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Skeleton width={210} height={24} borderRadius={8} />
          <Skeleton width={290} height={13} borderRadius={6} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Skeleton width={96} height={38} borderRadius={10} />
          <Skeleton width={130} height={38} borderRadius={10} />
        </div>
      </div>

      {/* Tabs Bar: Cần tôi duyệt, Đề xuất của tôi, Đang theo dõi, Tất cả */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', borderBottom: '1px solid var(--color-border-light)' }}>
        {[120, 130, 125, 90].map((w, i) => (
          <Skeleton key={i} width={w} height={36} borderRadius={10} />
        ))}
      </div>

      {/* Category Filter Pills: Tất cả phân loại, PO / Quy trình có tiền, Quy trình hành chính */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[125, 165, 160].map((w, i) => (
            <Skeleton key={i} width={w} height={30} borderRadius={20} />
          ))}
        </div>
        {!isMobile && <Skeleton width={240} height={36} borderRadius={10} />}
      </div>

      {/* 5 Approval Request Card/Row Skeletons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card skeleton-card" style={{ padding: '1rem 1.25rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px', borderRadius: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 280px' }}>
              <Skeleton width={40} height={40} borderRadius={10} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Skeleton width={48} height={18} borderRadius={5} />
                  <Skeleton width="55%" height={15} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Skeleton width={20} height={20} borderRadius="50%" />
                  <Skeleton width={110} height={11} />
                  <Skeleton width={80} height={11} />
                </div>
              </div>
            </div>
            {/* Step circles */}
            {!isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Skeleton width={26} height={26} borderRadius="50%" />
                <Skeleton width={14} height={4} />
                <Skeleton width={26} height={26} borderRadius="50%" />
                <Skeleton width={14} height={4} />
                <Skeleton width={26} height={26} borderRadius="50%" />
              </div>
            )}
            {/* Action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Skeleton width={90} height={28} borderRadius={8} />
              <Skeleton width={76} height={32} borderRadius={8} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const CrmContactsTabSkeleton = () => {
  const isMobile = useResponsive();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <Skeleton width={200} height={24} />
          <Skeleton width={260} height={12} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isMobile && <Skeleton width={100} height={36} borderRadius={8} />}
          <Skeleton width={130} height={36} borderRadius={8} />
        </div>
      </div>

      {/* Pipeline stage tabs strip (8 pill skeletons) */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} width={105} height={32} borderRadius={18} />
        ))}
      </div>

      {/* Search & Filter Toolbar */}
      <div className="card skeleton-card" style={{ padding: '0.75rem 1rem', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
        <Skeleton width={isMobile ? '100%' : 280} height={38} borderRadius={10} style={{ flex: isMobile ? '1 1 100%' : 1 }} />
        {!isMobile && (
          <>
            <Skeleton width={150} height={38} borderRadius={10} />
            <Skeleton width={150} height={38} borderRadius={10} />
            <Skeleton width={130} height={38} borderRadius={10} />
          </>
        )}
      </div>

      {/* 7-Column CRM Table Skeleton */}
      <div className="card skeleton-card" style={{ padding: 0, overflow: 'hidden', borderRadius: '14px' }}>
        <div style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid var(--color-border)', display: 'grid', gridTemplateColumns: isMobile ? '1.5fr 1fr' : '1.6fr 1.1fr 1fr 1.2fr 0.9fr 0.9fr 0.6fr', gap: '12px' }}>
          {Array.from({ length: isMobile ? 2 : 7 }).map((_, i) => (
            <Skeleton key={i} width="75%" height={11} />
          ))}
        </div>
        {Array.from({ length: 7 }).map((_, rowIdx) => (
          <div key={rowIdx} style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--color-border-light)', display: 'grid', gridTemplateColumns: isMobile ? '1.5fr 1fr' : '1.6fr 1.1fr 1fr 1.2fr 0.9fr 0.9fr 0.6fr', gap: '12px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Skeleton width={36} height={36} borderRadius="50%" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
                <Skeleton width="80%" height={13} />
                <Skeleton width="50%" height={10} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <Skeleton width="85%" height={12} />
              <Skeleton width="60%" height={10} />
            </div>
            {!isMobile && (
              <>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <Skeleton width={52} height={20} borderRadius={10} />
                  <Skeleton width={44} height={20} borderRadius={10} />
                </div>
                <Skeleton width="90%" height={12} />
                <Skeleton width={78} height={22} borderRadius={12} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Skeleton width={26} height={26} borderRadius="50%" />
                  <Skeleton width="65%" height={12} />
                </div>
                <Skeleton width={60} height={24} borderRadius={6} />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export const DealsKanbanTabSkeleton = () => {
  const isMobile = useResponsive();
  const cols = isMobile ? 1 : 4;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      {/* Header + Filter Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <Skeleton width={220} height={24} />
          <Skeleton width={280} height={12} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Skeleton width={160} height={38} borderRadius={10} />
          <Skeleton width={120} height={38} borderRadius={10} />
        </div>
      </div>

      {/* 4-Column Horizontal Kanban Board Skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(260px, 1fr))`, gap: '1rem', alignItems: 'start' }}>
        {Array.from({ length: cols }).map((_, colIdx) => (
          <div
            key={colIdx}
            className="card skeleton-card"
            style={{
              padding: '0.875rem',
              borderRadius: '14px',
              borderTop: '3px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              background: 'var(--color-bg-secondary, rgba(0,0,0,0.015))'
            }}
          >
            {/* Column header: title + count badge + revenue line */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Skeleton width={120} height={15} />
              <Skeleton width={28} height={20} borderRadius={10} />
            </div>
            <Skeleton width={100} height={11} />

            {/* 3 Kanban Card Skeletons */}
            {Array.from({ length: 3 }).map((__, cardIdx) => (
              <div
                key={cardIdx}
                className="kanban-skeleton-card"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '0.875rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Skeleton width={34} height={34} borderRadius="50%" />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <Skeleton width="75%" height={13} />
                    <Skeleton width="55%" height={10} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <Skeleton width={68} height={20} borderRadius={10} />
                  <Skeleton width={54} height={20} borderRadius={10} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid var(--color-border-light)' }}>
                  <Skeleton width={80} height={12} />
                  <Skeleton width={22} height={22} borderRadius="50%" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const ProjectsTabSkeleton = () => {
  const isMobile = useResponsive();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      {/* Header + Tabs (Chương trình đào tạo, Chiến dịch Marketing, Tài liệu) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <Skeleton width={230} height={24} />
          <Skeleton width={300} height={12} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Skeleton width={140} height={36} borderRadius={8} />
          <Skeleton width={140} height={36} borderRadius={8} />
          {!isMobile && <Skeleton width={95} height={36} borderRadius={8} />}
        </div>
      </div>

      {/* 3-Card KPI Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1rem' }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>

      {/* 3-Column Project/Course Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1.25rem' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} height={175} />
        ))}
      </div>
    </div>
  );
};

export const FinancialOpsTabSkeleton = ({ isCardGrid = false }: { isCardGrid?: boolean }) => {
  const isMobile = useResponsive();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      {/* Header with action buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <Skeleton width={210} height={24} />
          <Skeleton width={280} height={12} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Skeleton width={120} height={38} borderRadius={10} />
          <Skeleton width={135} height={38} borderRadius={10} />
        </div>
      </div>

      {/* 4 Financial/Ops KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '1rem' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>

      {/* Filter Toolbar */}
      <div className="card skeleton-card" style={{ padding: '0.85rem 1.25rem', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
        <Skeleton width={isMobile ? '100%' : 260} height={38} borderRadius={10} style={{ flex: 1 }} />
        {!isMobile && (
          <>
            <Skeleton width={160} height={38} borderRadius={10} />
            <Skeleton width={160} height={38} borderRadius={10} />
          </>
        )}
      </div>

      {/* Data Table or Card Grid Skeleton */}
      {isCardGrid ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1.25rem' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} height={180} />
          ))}
        </div>
      ) : (
        <TableSkeleton rows={6} cols={6} />
      )}
    </div>
  );
};

// ─── Route-Aware Per-Tab Skeleton Dispatcher ─────────────────────────────────
export const RouteTabSkeleton = ({ path }: { path?: string }) => {
  const currentPath = (path || (typeof window !== 'undefined' ? window.location.pathname : '/')).split('?')[0];

  if (
    currentPath === '/' ||
    currentPath === '/financial-dashboard' ||
    currentPath === '/reports-crm' ||
    currentPath === '/fair-share' ||
    currentPath === '/cash-flow'
  ) {
    return <DashboardTabSkeleton />;
  }

  if (currentPath === '/workspace') {
    return <WorkspaceTabSkeleton />;
  }

  if (
    currentPath === '/calendar' ||
    currentPath === '/personal-calendar' ||
    currentPath === '/account' ||
    currentPath === '/schedules' ||
    currentPath === '/attendance'
  ) {
    return <CalendarTabSkeleton />;
  }

  if (currentPath === '/feed') {
    return <FeedTabSkeleton />;
  }

  if (currentPath === '/approvals') {
    return <ApprovalsTabSkeleton />;
  }

  if (
    currentPath === '/contacts' ||
    currentPath === '/students' ||
    currentPath === '/data'
  ) {
    return <CrmContactsTabSkeleton />;
  }

  if (currentPath === '/deals') {
    return <DealsKanbanTabSkeleton />;
  }

  if (currentPath === '/projects') {
    return <ProjectsTabSkeleton />;
  }

  if (currentPath === '/rounds') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
        <PageHeaderSkeleton />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
          <RoundCardSkeleton />
          <RoundCardSkeleton />
          <RoundCardSkeleton />
        </div>
      </div>
    );
  }

  if (
    currentPath === '/companies' ||
    currentPath === '/suppliers' ||
    currentPath === '/files' ||
    currentPath === '/rules' ||
    currentPath === '/integrations' ||
    currentPath === '/settings' ||
    currentPath === '/ai-training'
  ) {
    return <FinancialOpsTabSkeleton isCardGrid={true} />;
  }

  // Default for /gatekeeper, /tickets, /support-tickets, /deposits, /sales-orders, /expenses, /quotes, /inventory, /purchase-orders, /products, /hrm, /consultants, /accounts, /my-payslips, /activities
  return <FinancialOpsTabSkeleton isCardGrid={false} />;
};

