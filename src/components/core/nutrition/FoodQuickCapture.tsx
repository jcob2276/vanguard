import { Pressable, ControlInput } from '../../ui/ControlPrimitives';
import { RotateCcw, Sparkles } from 'lucide-react';
import { Card } from '../../ui/Card';
import { getTodayWarsaw, getYesterdayWarsaw } from '../../../lib/date';
import { useQuickCaptureData } from './hooks/useQuickCaptureData';
import { useSession } from '../../../store/useStore';
import Spinner from '../../ui/Spinner';

export default function FoodQuickCapture({ onSaved, onOpenFullModal, refreshSignal = 0 }: {
  onSaved?: () => void;
  onOpenFullModal?: () => void;
  refreshSignal?: number;
}) {
  const session = useSession();
  const d = useQuickCaptureData(onSaved, refreshSignal);
  const today = getTodayWarsaw();
  const yesterday = getYesterdayWarsaw();

  if (!session) return null;

  return (
    <Card className="space-y-3.5 p-5 shadow-sm border-border-custom/80 bg-surface">
      
      {/* Header: Title + Date Selector */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-widest text-text-primary font-display">POSIŁEK</p>
        <div className="flex items-center gap-1.5">
          {([['Dziś', today], ['Wczoraj', yesterday]] as const).map(([label, date]) => (
            <Pressable
              key={label}
              type="button"
              onClick={() => d.setLogDate(date)}
              className={`rounded-full px-3 py-1 text-2xs font-bold transition-all ${
                d.logDate === date
                  ? 'bg-primary text-on-accent shadow-sm'
                  : 'text-text-secondary border border-border-custom hover:bg-surface-solid'
              }`}
            >
              {label}
            </Pressable>
          ))}
        </div>
      </div>

      {/* Calorie & Protein Progress HUD */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-text-secondary">
          <div>
            <span className="text-sm font-black text-text-primary font-display">{Math.round(d.totals.calories)}</span>
            <span className="text-text-muted"> / {d.totals.targetKcal ?? 2000} kcal</span>
          </div>
          {d.totals.targetProtein != null && (
            <div>
              <span className="text-sm font-black text-text-primary font-display">{Math.round(d.totals.protein)}</span>
              <span className="text-text-muted"> / {d.totals.targetProtein} g B</span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 rounded-full bg-border-custom/40 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              d.totals.targetKcal && d.totals.calories > d.totals.targetKcal ? 'bg-warning' : 'bg-primary'
            }`}
            style={{ width: `${Math.min(100, ((d.totals.calories / (d.totals.targetKcal || 2000)) * 100))}%` }}
          />
        </div>

        {/* AI Food Quality Banner */}
        {(d.qualityPending || d.totals.avgFoodQuality != null || d.totals.foodQualityAnalysis) && (
          <div className="pt-0.5 text-xs leading-relaxed text-text-secondary font-medium">
            {d.qualityPending && !d.totals.foodQualityAnalysis ? (
              <span className="italic text-text-muted animate-pulse">Liczenie jakości posiłków…</span>
            ) : d.totals.avgFoodQuality != null ? (
              <div>
                <span className="font-black text-amber-500 dark:text-amber-400 mr-1.5 font-display">
                  Jakość {d.totals.avgFoodQuality}
                </span>
                {d.totals.foodQualityAnalysis && (
                  <span>— {d.totals.foodQualityAnalysis.split(/[.!?]/)[0]?.trim()}</span>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Meal Type Selection Pills */}
      <div className="flex flex-wrap gap-1.5">
        {d.MEAL_TYPES.map((m) => {
          const isActive = d.mealType === m.id;
          return (
            <Pressable
              key={m.id}
              type="button"
              onClick={() => d.setMealType(m.id)}
              className={`rounded-full px-3 py-1.5 text-2xs font-black uppercase tracking-wider transition-all ${
                isActive
                  ? 'bg-primary/20 text-primary border border-primary/40 shadow-sm'
                  : 'text-text-muted border border-border-custom hover:border-border-custom/80 hover:text-text-primary'
              }`}
            >
              {m.label}
            </Pressable>
          );
        })}
      </div>

      {/* Direct Quick Input Field + AI Sparkles Button */}
      <div className="flex items-center gap-2 pt-1">
        <ControlInput
          value={d.text}
          onChange={(e) => {
            d.setText(e.target.value);
            if (d.preview) d.setPreview(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              d.handleParse();
            }
          }}
          placeholder="np. 2 jajka, twaróg 150g, kawa"
          className="min-w-0 flex-1 rounded-2xl border border-border-custom bg-surface-solid/50 px-4 py-3 text-xs outline-none focus:border-primary/50 focus:bg-surface placeholder:text-text-muted/50 transition-all"
        />
        <button
          type="button"
          onClick={d.handleParse}
          disabled={!d.text.trim() || d.parsing || d.saving}
          title="Parsuj i zapisz przez AI"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-accent hover:bg-primary-hover active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-md shadow-primary/20 cursor-pointer"
        >
          {d.parsing ? <Spinner size="sm" className="!border-on-accent/30 !border-t-on-accent" /> : <Sparkles size={18} />}
        </button>
      </div>

      {/* Starred Favorites Quick Chips */}
      {d.QUICK_CAPTURE_FAVORITES.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {d.QUICK_CAPTURE_FAVORITES.map((f) => {
            const shortName = f.name.replace(/\s*\(\d+mg kofeiny\)/i, '');
            const label = `★ ${shortName.length > 18 ? `${shortName.slice(0, 16)}…` : shortName}`;
            return (
              <Pressable
                key={f.id}
                type="button"
                disabled={d.saving}
                onClick={() => d.handleFavorite(f)}
                className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/20 hover:border-primary/40 disabled:opacity-50 transition-all cursor-pointer"
                title={f.brand ? `${f.name} — ${f.brand}` : f.name}
              >
                {label}
              </Pressable>
            );
          })}
        </div>
      )}

      {/* Recent Meals for Selected Meal Type */}
      {d.yesterdayEntries.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-border-custom/40">
          <p className="text-2xs font-black uppercase tracking-wider text-text-muted font-display">
            {d.getYesterdayLabel(d.yesterdayEntries[0].date, d.mealType)}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {d.yesterdayEntries.map((entry) => (
              <Pressable
                key={entry.id}
                type="button"
                disabled={d.saving}
                onClick={() => d.handleLogYesterdayEntry(entry)}
                className="rounded-full border border-border-custom bg-surface-solid/40 px-3 py-1 text-xs font-semibold text-text-secondary hover:border-primary/40 hover:text-primary disabled:opacity-50 flex items-center gap-1.5 transition-all cursor-pointer"
                title={`Zaloguj ponownie: ${entry.name}`}
              >
                <RotateCcw size={10} className="text-text-muted shrink-0" />
                <span>{entry.name}</span>
              </Pressable>
            ))}
          </div>
        </div>
      )}

      {/* AI Preview Confirmation Box */}
      {d.preview && (
        <div className="space-y-2 border-t border-border-custom/50 pt-3">
          <p className="text-2xs font-black uppercase tracking-wider text-text-muted font-display">Sprawdź przed zapisem</p>
          {d.preview.map((item, i) => {
            if (d.removed.has(i)) return null;
            const badge = d.confidenceLabel(item);
            return (
              <div key={i} className="flex items-center gap-2 rounded-xl border border-border-custom/60 px-3 py-2 bg-surface-solid/40">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate">{item.name}</p>
                  <p className="text-2xs text-text-muted">{item.grams}g · {item.calories} kcal · {item.protein}g B</p>
                  {item.assumptions?.length ? <p className="text-2xs text-warning mt-0.5 leading-snug">{item.assumptions.join(' · ')}</p> : null}
                </div>
                {badge && <span className={`text-2xs font-bold uppercase ${badge === 'sprawdź' ? 'text-warning' : 'text-success'}`}>{badge}</span>}
                <button type="button" onClick={() => d.setRemoved((p) => new Set([...p, i]))} className="text-xs text-text-muted hover:text-danger p-1">×</button>
              </div>
            );
          })}
          <div className="flex gap-2 pt-1">
            <Pressable variant="outline" size="sm" onClick={() => { d.setPreview(null); d.setRemoved(new Set()); }} className="flex-1 text-xs">Anuluj</Pressable>
            <Pressable variant="primary" size="sm" onClick={d.handleSavePreview} loading={d.saving} disabled={!d.activePreview.length} className="flex-1 text-xs">Zapisz ({d.activePreview.length})</Pressable>
          </div>
        </div>
      )}

      {/* Footer Link */}
      {onOpenFullModal && (
        <div className="pt-1">
          <button
            type="button"
            onClick={onOpenFullModal}
            className="text-xs font-bold text-primary hover:underline transition-all flex items-center gap-1"
          >
            <span>Skaner / wyszukiwarka →</span>
          </button>
        </div>
      )}
    </Card>
  );
}
