import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex flex-col items-center justify-center p-8 bg-rose-50/50 rounded-2xl border border-rose-100 min-h-[200px]">
                    <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mb-4 text-rose-500">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <h2 className="text-sm font-bold text-slate-800 mb-2">Đã xảy ra lỗi hệ thống</h2>
                    <p className="text-xs text-slate-500 mb-4 max-w-md text-center">
                        {this.state.error?.message || 'Không thể hiển thị thành phần này do lỗi dữ liệu.'}
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-rose-600 text-xs font-bold rounded-lg border border-rose-200 hover:bg-rose-50 transition-colors"
                    >
                        <RefreshCcw className="w-4 h-4" /> Thử lại
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
