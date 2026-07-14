import { Card } from '../../ui/Card';

interface PowerListHeaderProps {
  today: string;
}

const WEEKDAYS = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
const MONTHS_SHORT = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
const MONTHS_FULL = [
  'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'
];

export default function PowerListHeader({ today }: PowerListHeaderProps) {
  const parsedDate = (() => {
    const d = new Date();
    const parts = today.split('-');
    if (parts.length === 3) {
      d.setFullYear(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    return d;
  })();

  return (
    <Card padding="0.75rem" className="flex items-center gap-3.5" style={{ background: 'rgba(17, 24, 39, 0.5)' }}>
      <div className="flex h-12 w-12 flex-col overflow-hidden rounded-xl border border-border-custom bg-surface text-center shadow-sm">
        <span className="bg-primary py-0.5 text-2xs font-black uppercase tracking-wider text-white">
          {MONTHS_SHORT[parsedDate.getMonth()]}
        </span>
        <span className="flex-1 font-display text-lg font-black text-text-primary flex items-center justify-center leading-none">
          {parsedDate.getDate()}
        </span>
      </div>
      <div>
        <h4 className="text-sm font-bold text-text-primary leading-tight">
          Dzisiaj jest {WEEKDAYS[parsedDate.getDay()]}
        </h4>
        <p className="text-xs font-semibold text-text-muted">
          {parsedDate.getDate()} {MONTHS_FULL[parsedDate.getMonth()]} {parsedDate.getFullYear()}
        </p>
      </div>
    </Card>
  );
}
