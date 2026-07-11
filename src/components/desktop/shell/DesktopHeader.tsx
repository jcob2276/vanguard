import { Link } from 'react-router-dom';
import { RefreshCw, Moon, Sun, Fingerprint, ShieldCheck, Smartphone } from 'lucide-react';
import DashboardModuleShortcuts from '../../core/DashboardModuleShortcuts';

interface DesktopHeaderProps {
  now: string;
  syncing: boolean;
  pendingGrowthMustCount: number;
  theme: string;
  setTheme: React.Dispatch<React.SetStateAction<string>>;
  syncAll: () => void;
  setShowHealth: (v: boolean) => void;
  setShowFundament: (v: boolean) => void;
}

export default function DesktopHeader({
  now, syncing, pendingGrowthMustCount, theme,
  setTheme, syncAll, setShowHealth, setShowFundament,
}: DesktopHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border-custom bg-background/95 backdrop-blur-md px-8 py-3.5 flex items-center gap-4">
      <div className="flex items-center gap-4">
        <span className="font-display text-[13px] font-black uppercase tracking-[0.3em] text-primary">Vanguard OS</span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted hidden lg:block">{now}</span>
      </div>
      <div className="hidden xl:flex items-center gap-3 ml-4">
        {[['S','sync'], ['T','trening'], ['D','dark']].map(([k, l]) => (
          <span key={k} className="flex items-center gap-1 text-[8px] text-text-muted">
            <kbd className="rounded border border-border-custom bg-surface px-1.5 py-0.5 font-mono text-[9px] font-black leading-none">{k}</kbd>
            <span>{l}</span>
          </span>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <DashboardModuleShortcuts naukaBadge={pendingGrowthMustCount} />
        <button onClick={() => setShowHealth(true)}
          className="rounded-full border border-border-custom bg-surface-solid/40 p-2.5 text-text-secondary hover:text-text-primary transition-all active:scale-95 cursor-pointer flex items-center justify-center"
          title="Status zdrowia systemu"
        >
          <ShieldCheck size={14} />
        </button>
        <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
          className="rounded-full border border-border-custom bg-surface-solid/40 p-2.5 text-text-secondary hover:text-text-primary transition-all active:scale-95 cursor-pointer">
          {theme === 'light' ? <Moon size={14} /> : <Sun size={14} className="text-yellow-400" />}
        </button>
        <button onClick={syncAll} disabled={syncing}
          className="rounded-full border border-border-custom bg-surface-solid/40 p-2.5 text-text-secondary hover:text-text-primary transition-all active:scale-95 disabled:opacity-40 cursor-pointer">
          <RefreshCw size={14} className={syncing ? 'animate-spin text-primary' : ''} />
        </button>
        <button onClick={() => setShowFundament(true)}
          className="rounded-full border border-border-custom bg-surface-solid/40 p-2.5 text-text-secondary hover:text-text-primary transition-all active:scale-95 cursor-pointer"
          title="Fundament">
          <Fingerprint size={14} />
        </button>
        <Link to="/"
          className="flex items-center gap-1.5 rounded-full border border-border-custom px-3 py-2 text-[10px] font-black uppercase tracking-wider text-text-muted hover:text-text-primary hover:bg-surface-solid transition-all cursor-pointer">
          <Smartphone size={12} /> Mobile
        </Link>
      </div>
    </header>
  );
}
