import { Link } from 'react-router-dom';
import { ArrowRight, Lightbulb } from 'lucide-react';
import type { GrowthSuggestion } from '../../lib/growthOverview';
import { setDashboardView } from '../../lib/growthOverview';

const VIEW_LABEL: Record<GrowthSuggestion['view'], string> = {
  tydzien: 'Tydzień',
  projekty: 'Projekty',
  todo: 'Todo',
  keep: 'Keep',
  dzis: 'Dziś',
};

const TONE_BORDER: Record<GrowthSuggestion['tone'], string> = {
  neutral: 'border-border-custom',
  warn: 'border-amber-500/25 bg-amber-500/[0.04]',
  action: 'border-primary/25 bg-primary/[0.04]',
};

export default function GrowthSuggestions({ items }: { items: GrowthSuggestion[] }) {
  if (items.length === 0) {
    return (
      <p className="text-[12px] text-text-muted rounded-xl border border-dashed border-border-custom px-4 py-3">
        Tydzień wygląda spójnie — egzekucja w Todo i PowerList, dowód w Projekty.
      </p>
    );
  }

  return (
    <section className="space-y-2">
      <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-text-muted px-1">
        <Lightbulb size={12} /> Propozycje · gdzie działać
      </p>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {items.map((s) => (
          <li
            key={s.id}
            className={`rounded-xl border p-3 flex flex-col gap-2 ${TONE_BORDER[s.tone]}`}
          >
            <div>
              <p className="text-[12px] font-bold text-text-primary">{s.title}</p>
              <p className="text-[11px] text-text-muted mt-0.5 leading-snug">{s.body}</p>
            </div>
            <Link
              to={`/?view=${s.view}`}
              onClick={() => setDashboardView(s.view)}
              className="inline-flex items-center gap-1 self-start text-[10px] font-black uppercase text-primary hover:underline"
            >
              {VIEW_LABEL[s.view]}
              <ArrowRight size={10} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
