import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="rounded border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-start gap-3">
          <span className="text-destructive mt-0.5 shrink-0">⚠</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-destructive mb-0.5" style={{ fontFamily: 'var(--font-ui)' }}>
              Panel error
            </p>
            <p className="text-[12px] text-muted-foreground truncate" style={{ fontFamily: 'var(--font-data)' }}>
              {this.state.message}
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
