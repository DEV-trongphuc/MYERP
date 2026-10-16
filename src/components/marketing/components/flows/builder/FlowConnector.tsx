
import React from 'react';

interface ConnectorProps {
  height?: number;
  isError?: boolean;
}

export const StraightConnector: React.FC<ConnectorProps> = ({ height = 60, isError }) => {
  return (
    <div className="relative w-full flex justify-center pointer-events-none z-0" style={{ height, marginTop: -1, marginBottom: -1 }}>
      <svg width="10" height="100%" className="overflow-visible" style={{ position: 'absolute', top: 0 }}>
        <line x1="5" y1="-2" x2="5" y2="102%" stroke={isError ? "#f43f5e" : "#cbd5e1"} strokeWidth="2" strokeDasharray={isError ? "4 2" : "6 6"} className={!isError ? "animate-[dash_1s_linear_infinite]" : ""} strokeLinecap="round" />
        <circle r="2" fill={isError ? "#f43f5e" : "#2563eb"} className="animate-[moveDown_2s_infinite_linear]">
          <animateMotion path={`M 5 -10 L 5 ${height + 10}`} dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>
      <style>{`
        @keyframes dash { to { stroke-dashoffset: -12; } }
        @keyframes moveDown { 0% { opacity: 0; } 20% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
      `}</style>
    </div>
  );
};

interface BranchConnectorProps {
  height?: number;
  leftColor?: string;
  rightColor?: string;
  dashed?: boolean;
}

export const BranchConnector: React.FC<BranchConnectorProps> = ({
  height = 90,
  leftColor = "#8b5cf6", // Purple by default
  rightColor = "#8b5cf6",
  dashed = true // Dashed by default
}) => {
  const midX = 50;
  const leftTargetX = 25;
  const rightTargetX = 75;
  const midY = height / 2;
  const endY = height + 4;

  const leftPath = `M ${midX} -2 L ${midX} ${midY} L ${leftTargetX} ${midY} L ${leftTargetX} ${endY}`;
  const rightPath = `M ${midX} -2 L ${midX} ${midY} L ${rightTargetX} ${midY} L ${rightTargetX} ${endY}`;

  return (
    <div className="absolute top-0 left-0 w-full pointer-events-none z-0" style={{ height }}>
      <svg width="100%" height="100%" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
        <path d={leftPath} stroke={leftColor} strokeWidth="2" vectorEffect="non-scaling-stroke" fill="none" strokeDasharray={dashed ? "6 4" : "0"} />
        <path d={rightPath} stroke={rightColor} strokeWidth="2" vectorEffect="non-scaling-stroke" fill="none" strokeDasharray={dashed ? "6 4" : "0"} />
        <circle r="1" fill={leftColor}><animateMotion path={leftPath} dur="3s" repeatCount="indefinite" /></circle>
        <circle r="1" fill={rightColor}><animateMotion path={rightPath} dur="3s" repeatCount="indefinite" /></circle>
      </svg>
    </div>
  );
};

interface MultiBranchConnectorProps {
  height?: number;
  branches?: number;
  color?: string;
}

export const MultiBranchConnector: React.FC<MultiBranchConnectorProps> = ({
  height = 90,
  branches = 2,
  color = "#8b5cf6"
}) => {
  const midX = 50;
  const midY = height / 2;
  const endY = height + 4;

  const paths = [];

  for (let i = 0; i < branches; i++) {
    const targetX = ((2 * i + 1) * 100) / (2 * branches);
    const path = `M ${midX} -2 L ${midX} ${midY} L ${targetX} ${midY} L ${targetX} ${endY}`;
    paths.push(path);
  }

  return (
    <div className="absolute top-0 left-0 w-full pointer-events-none z-0" style={{ height }}>
      <svg width="100%" height="100%" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
        {paths.map((d, i) => (
          <React.Fragment key={i}>
            <path d={d} stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" fill="none" strokeDasharray="6 4" />
            <circle r="1" fill={color}><animateMotion path={d} dur="3s" repeatCount="indefinite" /></circle>
          </React.Fragment>
        ))}
      </svg>
    </div>
  );
};
