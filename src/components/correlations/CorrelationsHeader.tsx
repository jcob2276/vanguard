import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import Button from '../ui/Button';

interface CorrelationsHeaderProps {
  loading: boolean;
  onRefresh: () => void;
}

export default function CorrelationsHeader({ loading, onRefresh }: CorrelationsHeaderProps) {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-border-custom bg-background/95 backdrop-blur-md">
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
        <Link
          to="/"
          className="rounded-xl border border-border-custom p-2.5 text-text-muted hover:text-text-primary shrink-0"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-base font-black tracking-tight text-text-primary">
            Korelacje
          </h1>
          <p className="text-xs text-text-muted truncate">
            Skan odkrywczy · 90 dni · obserwacje, nie diagnozy
          </p>
        </div>
        <Button
          onClick={onRefresh}
          variant="ghost"
          icon={<RefreshCw size={16} className={loading ? 'animate-spin' : ''} />}
          className="rounded-xl p-2.5 text-primary"
          title="Odśwież"
        />
      </div>
    </header>
  );
}
