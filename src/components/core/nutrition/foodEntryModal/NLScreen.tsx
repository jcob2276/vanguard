import { Pressable, ControlTextarea } from '../../../ui/ControlPrimitives';
import type { Dispatch, SetStateAction } from 'react';
import { Sparkles, Trash2, Check } from 'lucide-react';
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
      <Pressable
        variant="ghost"
        size="sm"
        onClick={() => { setNlMode(false); setError(null); }}
        className="px-0 py-0 text-text-muted hover:text-text-primary"
      >
        ← Wstecz
      </Pressable>

      <div className="flex gap-1.5 flex-wrap mb-1">
        {MEAL_TYPES.map((m) => (
          <Pressable key={m.id} onClick={() => setMealType(m.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${mealType === m.id ? 'bg-primary text-on-accent' : 'border border-border-custom text-text-muted'}`}>
            {m.label}
          </Pressable>
        ))}
      </div>

      <div className="relative">
        <ControlTextarea
          autoFocus
          value={nlText}
          onChange={(e) => { setNlText(e.target.value); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); parseNL(); } }}
          placeholder={'Opisz co zjadłeś, np.:\n"2 jajka ugotowane, twaróg 150g, kawa z mlekiem"\n"miseczka owsianki z bananem i jogurtem"'}
          rows={4}
          className="w-full rounded-xl border border-border-custom bg-surface-solid/40 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-primary/40 placeholder:text-text-muted/40 resize-none"
        />
        <span className="absolute bottom-2 right-2 text-2xs text-text-muted/40">Ctrl+Enter</span>
      </div>

      <Pressable
        variant="tonal"
        onClick={parseNL}
        loading={nlParsing}
        disabled={!nlText.trim()}
        icon={<Sparkles size={14} />}
        className="w-full"
      >
        Parsuj
      </Pressable>

      {error && <p className="text-xs text-danger">{error}</p>}

      {nlItems && (
        <div className="space-y-2">
          <p className="text-2xs font-black uppercase tracking-wider text-text-muted">
            Znalezione ({nlActiveCount}/{nlItems.length})
          </p>
          {nlItems.map((item, i) => {
            const removed = nlRemovedIdx.has(i);
            return (
              <div key={i} className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-all ${removed ? 'opacity-[var(--opacity-30)] border-border-custom/30 bg-transparent' : 'border-border-custom bg-surface-solid/20'}`}>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${removed ? 'line-through text-text-muted' : 'text-text-primary'}`}>{item.name}</p>
                  <p className="text-2xs text-text-muted flex items-center gap-1.5">
                    <span>{item.grams}g</span>
                    {confidenceLabel(item) && (
                      <span className={`rounded px-1 py-0.5 text-2xs font-bold uppercase tracking-wide ${
                        item.confidence === 'low' ? 'bg-warning/15 text-warning' :
                        item.source === 'library' || item.source === 'database' ? 'bg-success/15 text-success' :
                        'bg-primary/10 text-primary/80'
                      }`}>
                        {confidenceLabel(item)}
                      </span>
                    )}
                  </p>
                  {item.assumptions?.length ? (
                    <p className="text-2xs text-warning/90 mt-0.5 leading-snug">{item.assumptions.join(' · ')}</p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-black text-text-secondary">{item.calories} kcal</p>
                  <p className="text-2xs text-text-muted">
                    {item.protein}B · {item.carbs ?? '?'}W · {item.fat ?? '?'}T
                  </p>
                </div>
                <Pressable
                  variant="ghost"
                  onClick={() => setNlRemovedIdx(prev => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i); else next.add(i);
                    return next;
                  })}
                  className="shrink-0 rounded-full p-1 text-text-muted hover:text-danger hover:bg-danger/10 active:scale-95 transition-all"
                >
                  {removed ? <Check size={13} className="text-success" /> : <Trash2 size={13} />}
                </Pressable>
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
                  <span className="text-xs text-text-muted">
                    Łącznie: <span className="font-black text-text-secondary">{totKcal} kcal</span>
                    {' · '}<span className="font-bold text-primary">{totB}B</span>
                    {' · '}<span className="font-bold text-warning">{totW}W</span>
                    {' · '}<span className="font-bold text-text-secondary">{totT}T</span>
                  </span>
                );
              })()}
            </div>
            <Pressable
              variant="primary"
              onClick={saveNLItems}
              loading={nlSaving}
              disabled={nlActiveCount === 0}
              className="w-full"
            >
              Dodaj {nlActiveCount} {nlActiveCount === 1 ? 'produkt' : nlActiveCount < 5 ? 'produkty' : 'produktów'}
            </Pressable>
          </div>
        </div>
      )}
    </div>
  );
}
