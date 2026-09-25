import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

if (typeof window !== 'undefined') {
  const reloadOnChunkError = (msg: string) => {
    if (msg && (msg.includes('Failed to fetch dynamically imported module') || msg.includes('ChunkLoadError'))) {
      const lastReload = sessionStorage.getItem('last_chunk_reload');
      const now = Date.now();
      if (!lastReload || now - Number(lastReload) > 15000) {
        sessionStorage.setItem('last_chunk_reload', String(now));
        window.location.reload();
      }
    }
  };

  window.addEventListener('error', (e) => {
    reloadOnChunkError(e.message || '');
  }, true);

  window.addEventListener('unhandledrejection', (e) => {
    const msg = e.reason?.message || String(e.reason || '');
    reloadOnChunkError(msg);
  });
}

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  compact?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught component error:', error, errorInfo);
    
    const errorMsg = error?.message || String(error || '');
    const errorStack = error?.stack || '';
    const isChunkError = 
      errorMsg.includes('Failed to fetch dynamically imported module') ||
      errorMsg.includes('ChunkLoadError') ||
      error.name === 'ChunkLoadError' ||
      errorStack.includes('Failed to fetch dynamically imported module') ||
      errorStack.includes('ChunkLoadError');

    if (isChunkError) {
      const lastReload = sessionStorage.getItem('last_chunk_reload');
      const now = Date.now();
      if (!lastReload || now - Number(lastReload) > 15000) {
        sessionStorage.setItem('last_chunk_reload', String(now));
        window.location.reload();
        return;
      }
    }
  }

  public handleReset = () => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      if (this.props.compact) {
        return (
          <div style={{
            padding: '1.25rem',
            background: 'var(--color-bg, #f9fafb)',
            border: '1px solid var(--color-border-light, #e5e7eb)',
            borderRadius: 'var(--radius-md, 8px)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}>
            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-danger, #ef4444)' }}>
              Không thể tải nội dung này
            </p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted, #6b7280)' }}>
              Đã xảy ra sự cố khi hiển thị phần này.
            </p>
            <button
              onClick={this.handleReset}
              className="btn outline sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}
            >
              <RefreshCw size={13} /> Thử lại
            </button>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[380px] p-8 text-center bg-white rounded-2xl border border-gray-100 shadow-sm max-w-lg mx-auto my-8" style={{ background: 'var(--color-surface, #fff)', borderColor: 'var(--color-border, #e5e7eb)' }}>
          <div className="w-14 h-14 mb-4 text-red-500 bg-red-50 rounded-full flex items-center justify-center shadow-inner" style={{ background: 'var(--color-danger-light, #fee2e2)' }}>
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--color-danger, #ef4444)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2" style={{ color: 'var(--color-text, #111827)' }}>Đã xảy ra sự cố hiển thị</h3>
          <p className="text-gray-500 mb-6 max-w-md" style={{ color: 'var(--color-text-muted, #6b7280)', fontSize: '0.9rem', lineHeight: '1.5' }}>
            Hệ thống đã tự động ghi nhận lỗi. Bạn có thể thử tải lại thành phần này hoặc tải lại toàn bộ trang.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={this.handleReset}
              className="btn primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0 1.25rem', height: '40px', borderRadius: 'var(--radius-md, 8px)' }}
            >
              <RefreshCw size={16} /> Thử lại
            </button>
            <button
              onClick={() => window.location.reload()}
              className="btn outline"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0 1.25rem', height: '40px', borderRadius: 'var(--radius-md, 8px)' }}
            >
              Tải lại trang
            </button>
          </div>
          {this.state.error && import.meta.env.DEV && (
            <div className="mt-6 p-3 bg-red-50 rounded text-left w-full overflow-auto max-h-48 border border-red-100" style={{ background: 'var(--color-danger-light, #fee2e2)' }}>
              <p className="text-red-800 font-mono text-xs whitespace-pre-wrap" style={{ color: '#b91c1c', margin: 0 }}>
                <strong>{this.state.error.toString()}</strong>
                {this.state.error.stack && `\n\nStack Trace:\n${this.state.error.stack}`}
              </p>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
