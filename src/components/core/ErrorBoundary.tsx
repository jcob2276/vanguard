import { Component, ErrorInfo, ReactNode } from 'react';
import Button from '../ui/Button';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  chunkFailed: boolean;
}

const CHUNK_RELOAD_KEY = 'vanguard_chunk_reload_ts';

function isChunkLoadError(error: Error): boolean {
  return (
    error.name === 'ChunkLoadError' ||
    error.message.includes('Failed to fetch dynamically imported module') ||
    error.message.includes('Importing a module script failed')
  );
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    chunkFailed: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      chunkFailed: isChunkLoadError(error),
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);

    if (!isChunkLoadError(error)) return;

    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0');
    const now = Date.now();
    if (now - last > 30_000) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
      window.location.reload();
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
          <h2 className="text-lg font-black text-text-primary mb-2 font-display uppercase tracking-wide">
            Coś poszło nie tak
          </h2>
          <p className="text-sm font-semibold text-text-muted mb-4 max-w-sm">
            {this.state.chunkFailed
              ? 'Nowa wersja aplikacji — odśwież stronę (Ctrl+F5), jeśli problem wraca.'
              : 'Wystąpił nieoczekiwany błąd aplikacji.'}
          </p>
          <Button
            variant="primary"
            onClick={() => window.location.reload()}
            className="rounded-full"
          >
            Odśwież stronę
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
