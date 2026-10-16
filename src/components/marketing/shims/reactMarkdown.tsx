import React from 'react';

export interface ReactMarkdownProps {
  children?: string | React.ReactNode;
  className?: string;
  components?: Record<string, React.ComponentType<any>>;
  [key: string]: any;
}

export const ReactMarkdown: React.FC<ReactMarkdownProps> = ({ children, className }) => {
  if (typeof children !== 'string') {
    return <div className={className}>{children}</div>;
  }

  const lines = children.split('\n');
  return (
    <div className={`space-y-1.5 leading-relaxed ${className || ''}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="font-bold text-slate-900 text-sm mt-2">
              {trimmed.slice(4)}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className="font-bold text-slate-900 text-base mt-2">
              {trimmed.slice(3)}
            </h3>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h2 key={idx} className="font-bold text-slate-900 text-lg mt-2">
              {trimmed.slice(2)}
            </h2>
          );
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-blue-600 mt-1">•</span>
              <span>{trimmed.slice(2)}</span>
            </div>
          );
        }
        return (
          <p key={idx} className="whitespace-pre-wrap break-words">
            {line}
          </p>
        );
      })}
    </div>
  );
};

export default ReactMarkdown;
