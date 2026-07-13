import type { Dispatch, SetStateAction } from 'react';
import { Sparkles, Trash2, Check } from 'lucide-react';
import Spinner from '../../../ui/Spinner';
import { confidenceLabel } from '../../../../lib/health/foodLogging';
import type { ParsedFoodItem } from '../../../../lib/health/foodLogging';

const MEAL_TYPES = [
  { id: 'breakfast', label: 'Śniadanie' },
  { id: 'lunch', label: 'Obiad' },
  { id: 'dinner', label: 'Kolacja' },
  { id: 'snack', label: 'Przekąska' },
];

interface NLScreenProps {
  setNlMode: (v: boolean) => void;
  setError: (v: string | null) => void;
  mealType: string;
  setMealType: (v: string) => void;
  nlText: string;
  setNlText: (v: string) => void;
  parseNL: () => void;
  nlParsing: boolean;
  error: string | null;
  nlItems: ParsedFoodItem[] | null;
  nlRemovedIdx: Set<number>;
  setNlRemovedIdx: Dispatch<SetStateAction<Set<number>>>;
  nlSaving: boolean;
  saveNLItems: () => void;
}

export default function NLScreen({
  setNlMode, setError,
  mealType, setMealType,
  nlText, setNlText,
  parseNL, nlParsing,
  error, nlItems, nlRemovedIdx, setNlRemovedIdx,
  nlSaving, saveNLItems,
}: NLScreenProps) {
  const nlActiveCount = nlItems ? nlItems.filter((_, i) => !nlRemovedIdx.has(i)).length : 0;

  return (
    <div className="space-y-4">
      <button onClick={() => { setNlMode(false); setError(null); }}
        className="text-[11px] font-bold text-text-muted hover:text-text-primary cursor-pointer">← Wstecz</button>

      <div className="flex gap-1.5 flex-wrap mb-1">
        {MEAL_TYPES.map((m) => (
          <button key={m.id} onClick={() => setMealType(m.id)}
            className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${mealType === m.id ? 'bg-primary text-white' : 'border border-border-custom text-text-muted'}`}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <textarea
          autoFocus
          value={nlText}
          onChange={(e) => { setNlText(e.target.value); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); parseNL(); } }}
          placeholder={'Opisz co zjadłeś, np.:\n"2 jajka ugotowane, twaróg 150g, kawa z mlekiem"\n"miseczka owsianki z bananem i jogurtem"'}
          rows={4}
          className="w-full rounded-xl border border-border-custom bg-surface-solid/40 px-3 py-2.5 text-[13px] text-text-primary outline-none focus:border-primary/40 placeholder:text-text-muted/40 resize-none"
        />
        <span className="absolute bottom-2 right-2 text-[9px] text-text-muted/40">Ctrl+Enter</span>
      </div>

      <button
        onClick={parseNL}
        disabled={!nlText.trim() || nlParsing}
        className="w-full rounded-2xl border border-primary/30 bg-primary/[0.08] py-2.5 text-[12px] font-black uppercase tracking-wider text-primary disabled:opacity-40 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
      >
        {nlParsing ? <><Spinner size="sm" className="h-3.5 w-3.5" />Parsowanie...</> : <><Sparkles size={14} />Parsuj</>}
      </button>

      {error && <p className="text-[11px] text-rose-500">{error}</p>}

      {nlItems && (
        <div className="space-y-2">
          <p className="text-[9px] font-black uppercase tracking-wider text-text-muted">
            Znalezione ({nlActiveCount}/{nlItems.length})
          </p>
          {nlItems.map((item, i) => {
            const removed = nlRemovedIdx.has(i);
            return (
              <div key={i} className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-all ${removed ? 'opacity-30 border-border-custom/30 bg-transparent' : 'border-border-custom bg-surface-solid/20'}`}>
                <div className="flex-1 min-w-0">
                  <p className={`text-[12px] font-semibold truncate ${removed ? 'line-through text-text-muted' : 'text-text-primary'}`}>{item.name}</p>
                  <p className="text-[9px] text-text-muted flex items-center gap-1.5">
                    <span>{item.grams}g</span>
                    {confidenceLabel(item) && (
                      <span className={`rounded px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide ${
                        item.confidence === 'low' ? 'bg-amber-500/15 text-amber-400' :
                        item.source === 'library' || item.source === 'database' ? 'bg-emerald-500/15 text-emerald-400' :
                        'bg-primary/10 text-primary/80'
                      }`}>
                        {confidenceLabel(item)}
                      </span>
                    )}
                  </p>
                  {item.assumptions?.length ? (
                    <p className="text-[9px] text-amber-600/90 mt-0.5 leading-snug">{item.assumptions.join(' · ')}</p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[11px] font-black text-text-secondary">{item.calories} kcal</p>
                  <p className="text-[9px] text-text-muted">
                    {item.protein}B · {item.carbs ?? '?'}W · {item.fat ?? '?'}T
                  </p>
                </div>
                <button
                  onClick={() => setNlRemovedIdx(prev => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i); else next.add(i);
                    return next;
                  })}
                  className="shrink-0 rounded-full p-1 transition-all cursor-pointer text-text-muted hover:text-rose-400 hover:bg-rose-500/10"
                >
                  {removed ? <Check size={13} className="text-emerald-400" /> : <Trash2 size={13} />}
                </button>
              </div>
            );
          })}

          <div className="pt-1">
            <div className="flex items-center justify-between mb-2">
              {(() => {
                const active = nlItems.filter((_, i) => !nlRemovedIdx.has(i));
                const totKcal = active.reduce((s, item) => s + item.calories, 0);
                const totB = Math.round(active.reduce((s, item) => s + item.protein, 0) * 10) / 10;
                const totW = Math.round(active.reduce((s, item) => s + (item.carbs ?? 0), 0) * 10) / 10;
                const totT = Math.round(active.reduce((s, item) => s + (item.fat ?? 0), 0) * 10) / 10;
                return (
                  <span className="text-[10px] text-text-muted">
                    Łącznie: <span className="font-black text-text-secondary">{totKcal} kcal</span>
                    {' · '}<span className="font-bold text-primary">{totB}B</span>
                    {' · '}<span className="font-bold text-amber-400">{totW}W</span>
                    {' · '}<span className="font-bold text-text-secondary">{totT}T</span>
                  </span>
                );
              })()}
            </div>
            <button
              onClick={saveNLItems}
              disabled={nlSaving || nlActiveCount === 0}
              className="w-full rounded-2xl bg-primary py-3 text-[12px] font-black uppercase tracking-wider text-white disabled:opacity-50 active:scale-95 transition-all cursor-pointer"
            >
              {nlSaving ? 'Zapisuję...' : `Dodaj ${nlActiveCount} ${nlActiveCount === 1 ? 'produkt' : nlActiveCount < 5 ? 'produkty' : 'produktów'}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
