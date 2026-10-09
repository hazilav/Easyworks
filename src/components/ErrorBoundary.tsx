'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { generateRequestId } from '@/lib/api/client';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  renderFallback?: (error: Error, reset: () => void) => ReactNode;
  componentName?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  requestId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    requestId: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      requestId: generateRequestId(),
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const requestId = this.state.requestId || generateRequestId();
    console.error(`[ErrorBoundary] Caught render exception:`, error, errorInfo);

    // Report error telemetry to server
    try {
      fetch('/api/telemetry/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          message: error.message || 'React render crash',
          stackTrace: error.stack,
          route: typeof window !== 'undefined' ? window.location.pathname : undefined,
          componentStack: errorInfo.componentStack,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        }),
      }).catch(() => {
        // Silently swallow telemetry send failure
      });
    } catch {
      // Ignore
    }
  }

  public handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      requestId: null,
    });
    this.props.onReset?.();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.renderFallback && this.state.error) {
        return this.props.renderFallback(this.state.error, this.handleReset);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[280px] p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex flex-col items-center justify-center text-center my-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-4 shadow-sm">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <h3 className="text-lg font-bold text-foreground mb-1">
            {this.props.componentName ? `${this.props.componentName} encountered an issue` : 'Something went wrong'}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mb-4">
            An unexpected error occurred in this view. Your saved documents and account settings are safe.
          </p>

          {this.state.requestId && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background/80 border border-border/60 text-xs font-mono text-muted-foreground mb-6 shadow-xs">
              <span>Request ID:</span>
              <strong className="text-foreground">{this.state.requestId}</strong>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') window.location.reload();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary/80 text-secondary-foreground text-sm font-medium hover:bg-secondary transition border border-border/40 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
