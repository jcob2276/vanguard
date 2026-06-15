import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // Check if it's a chunk load error and reload the page automatically
    if (error.name === 'ChunkLoadError' || error.message.includes('Failed to fetch dynamically imported module')) {
      window.location.reload();
    }
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
          <h2 className="text-[16px] font-black text-text-primary mb-2 font-display uppercase tracking-wide">Coś poszło nie tak</h2>
          <p className="text-[12px] font-semibold text-text-muted mb-4">Wystąpił nieoczekiwany błąd aplikacji.</p>
          <button 
            onClick={() => window.location.reload()}
            className="rounded-full bg-primary px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white shadow-md hover:bg-primary-hover transition-all active:scale-95 cursor-pointer"
          >
            Odśwież stronę
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
