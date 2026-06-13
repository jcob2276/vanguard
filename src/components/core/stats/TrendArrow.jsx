import { ArrowUp, ArrowDown, ArrowRight } from 'lucide-react';

export function TrendArrow({ current, previous, better = 'up' }) {
  if (previous === undefined || previous === null || current === undefined || current === null) return null;

  const diff = current - previous;
  if (Math.abs(diff) < 0.01) return <ArrowRight size={10} className="inline-block ml-1 text-slate-400" />;

  const isImproving = better === 'up' ? diff > 0 : diff < 0;

  if (diff > 0) {
    return <ArrowUp size={11} className={`inline-block ml-0.5 ${isImproving ? 'text-dayC' : 'text-dayB'}`} />;
  } else {
    return <ArrowDown size={11} className={`inline-block ml-0.5 ${isImproving ? 'text-dayC' : 'text-dayB'}`} />;
  }
}
