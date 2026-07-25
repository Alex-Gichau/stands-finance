import React, { Component, ErrorInfo, ReactNode, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, X, AlertCircle, Bug } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[GlobalErrorBoundary] Uncaught React Error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-2xl w-full bg-slate-800 border border-red-500/30 rounded-xl p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-4 text-red-400">
              <div className="p-3 bg-red-500/10 rounded-lg">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Application Exception Caught</h1>
                <p className="text-sm text-slate-400">The UI encountered an unexpected error during rendering.</p>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-lg border border-slate-700/50 font-mono text-xs overflow-x-auto space-y-2">
              <div className="text-red-400 font-semibold">
                {this.state.error?.name || 'Error'}: {this.state.error?.message}
              </div>
              {this.state.errorInfo?.componentStack && (
                <pre className="text-slate-400 whitespace-pre-wrap text-[11px] leading-relaxed">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </button>
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        {this.props.children}
        <ApiErrorBanner />
      </>
    );
  }
}

interface ApiErrorItem {
  id: string;
  url: string;
  method: string;
  status: number;
  errorText: string;
  formattedError: string;
  timestamp: string;
}

export const ApiErrorBanner: React.FC = () => {
  const [apiErrors, setApiErrors] = useState<ApiErrorItem[]>([]);

  useEffect(() => {
    const handleApiError = (event: Event) => {
      const customEv = event as CustomEvent;
      if (customEv.detail) {
        const newError: ApiErrorItem = {
          id: `api-err-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          ...customEv.detail,
        };
        setApiErrors((prev) => [newError, ...prev].slice(0, 4));
      }
    };

    window.addEventListener('api-error-detected', handleApiError);
    return () => {
      window.removeEventListener('api-error-detected', handleApiError);
    };
  }, []);

  if (apiErrors.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-md w-full space-y-2 pointer-events-none">
      {apiErrors.map((err) => (
        <div
          key={err.id}
          className="pointer-events-auto bg-slate-900 border border-red-500/40 text-slate-100 rounded-lg p-3.5 shadow-2xl flex items-start justify-between gap-3 text-xs animate-in slide-in-from-bottom-2 duration-200"
        >
          <div className="flex gap-2.5 items-start">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-red-300">
                <span className="bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded text-[10px] font-mono">
                  {err.status ? `HTTP ${err.status}` : 'NETWORK ERROR'}
                </span>
                <span>{err.method.toUpperCase()} {err.url}</span>
              </div>
              <p className="text-slate-300 line-clamp-3 font-mono text-[11px] bg-slate-950/60 p-1.5 rounded border border-slate-800">
                {err.errorText || 'Internal Server Error'}
              </p>
              <span className="text-[10px] text-slate-500 block">
                {new Date(err.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
          <button
            onClick={() => setApiErrors((prev) => prev.filter((item) => item.id !== err.id))}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 shrink-0"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
