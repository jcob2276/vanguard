import Button from '../../ui/Button';
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
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-border-custom bg-background/95 backdrop-blur-[var(--blur-md)] px-8 py-3.5 flex items-center gap-4">
      <div className="flex items-center gap-4">
        <span className="font-display text-sm font-black uppercase tracking-[var(--legacy-arbitrary-044)] text-primary">Vanguard OS</span>
        <span className="text-2xs font-bold uppercase tracking-wider text-text-muted hidden lg:block">{now}</span>
      </div>
      <div className="hidden xl:flex items-center gap-3 ml-4">
        {[['S','sync'], ['T','trening'], ['D','dark']].map(([k, l]) => (
          <span key={k} className="flex items-center gap-1 text-2xs text-text-muted">
            <kbd className="rounded border border-border-custom bg-surface px-1.5 py-0.5 font-mono text-2xs font-black leading-none">{k}</kbd>
            <span>{l}</span>
          </span>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <DashboardModuleShortcuts naukaBadge={pendingGrowthMustCount} />
        <Button onClick={() => setShowHealth(true)} variant="secondary" icon={<ShieldCheck size={14} />} className="rounded-full p-2.5" title="Status zdrowia systemu" />
        <Button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} variant="secondary" icon={theme === 'light' ? <Moon size={14} /> : <Sun size={14} className="text-warning" />} className="rounded-full p-2.5" aria-label={theme === 'light' ? 'Włącz ciemny motyw' : 'Włącz jasny motyw'} />
        <Button onClick={syncAll} variant="secondary" icon={<RefreshCw size={14} className={syncing ? 'animate-spin text-primary' : ''} />} className="rounded-full p-2.5" disabled={syncing} aria-label="Synchronizuj dane" />
        <Button onClick={() => setShowFundament(true)} variant="secondary" icon={<Fingerprint size={14} />} className="rounded-full p-2.5" title="Fundament" />
        <Link to="/"
          className="flex items-center gap-1.5 rounded-full border border-border-custom px-3 py-2 text-xs font-black uppercase tracking-wider text-text-muted hover:text-text-primary hover:bg-surface-solid transition-all cursor-pointer">
          <Smartphone size={12} /> Mobile
        </Link>
      </div>
    </header>
  );
}
