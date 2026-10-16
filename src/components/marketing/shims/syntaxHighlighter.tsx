import React from 'react';

export const oneDark: Record<string, React.CSSProperties> = {};
export const vscDarkPlus: Record<string, React.CSSProperties> = {};

export interface SyntaxHighlighterProps {
  language?: string;
  style?: any;
  customStyle?: React.CSSProperties;
  children?: React.ReactNode;
  PreTag?: any;
  [key: string]: any;
}

export const Prism: React.FC<SyntaxHighlighterProps> = ({
  children,
  customStyle,
  className,
}) => {
  return (
    <pre
      style={customStyle}
      className={`bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto font-mono text-xs ${className || ''}`}
    >
      <code>{children}</code>
    </pre>
  );
};

export default Prism;
