import { RotateCcw, Sparkles } from 'lucide-react';
import Button from '../../ui/Button';
import { Card } from '../../ui/Card';
import { getTodayWarsaw, getYesterdayWarsaw } from '../../../lib/date';
import { useQuickCaptureData } from './hooks/useQuickCaptureData';

import { useSession } from '../../../store/useStore';

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
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-black uppercase tracking-widest text-text-muted">Posiłek</p>
        <div className="flex gap-1">
          {([['Dziś', today], ['Wczoraj', yesterday]] as const).map(([label, date]) => (
            <button key={label} type="button" onClick={() => d.setLogDate(date)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${d.logDate === date ? 'bg-primary text-white' : 'text-text-muted border border-border-custom'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-bold text-text-muted">
          <span><span className="text-text-primary">{Math.round(d.totals.calories)}</span>{d.totals.targetKcal ? ` / ${d.totals.targetKcal}` : ''} kcal</span>
          {d.totals.targetProtein != null && (
            <span><span className="text-text-primary">{Math.round(d.totals.protein)}</span> / {d.totals.targetProtein} g B</span>
          )}
        </div>
        {d.totals.targetKcal && (
          <div className="h-1 rounded-full bg-border-custom overflow-hidden">
            <div className={`h-full rounded-full transition-all ${d.totals.calories > d.totals.targetKcal ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${Math.min(100, (d.totals.calories / d.totals.targetKcal) * 100)}%` }} />
          </div>
        )}
        {(d.qualityPending || d.totals.avgFoodQuality != null || d.totals.foodQualityAnalysis) && (
          <p className="text-[10px] leading-snug text-text-muted">
            {d.qualityPending && !d.totals.foodQualityAnalysis ? <span className="italic">Liczenie jakości…</span> : d.totals.avgFoodQuality != null ? (
              <><span className={`font-black ${d.totals.avgFoodQuality >= 70 ? 'text-success' : d.totals.avgFoodQuality >= 45 ? 'text-warning' : 'text-danger'}`}>Jakość {d.totals.avgFoodQuality}</span>{d.totals.foodQualityAnalysis && <span>{' — '}{d.totals.foodQualityAnalysis.split(/[.!?]/)[0]?.trim()}</span>}</>
            ) : null}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {d.MEAL_TYPES.map((m) => (
          <button key={m.id} type="button" onClick={() => d.setMealType(m.id)}
            className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${d.mealType === m.id ? 'bg-primary/15 text-primary' : 'text-text-muted border border-border-custom/60'}`}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input value={d.text} onChange={(e) => { d.setText(e.target.value); if (d.preview) d.setPreview(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); d.handleParse(); } }}
          placeholder="np. 2 jajka, twaróg 150g, kawa"
          className="min-w-0 flex-1 rounded-xl border border-border-custom bg-background/50 px-3 py-2.5 text-[13px] outline-none focus:border-primary/40 placeholder:text-text-muted/40" />
        <Button onClick={d.handleParse} loading={d.parsing} disabled={!d.text.trim() || d.saving} icon={<Sparkles size={16} />} className="shrink-0" title="Parsuj i zapisz" />
      </div>

      {d.QUICK_CAPTURE_FAVORITES.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1.5">
          {d.QUICK_CAPTURE_FAVORITES.map((f) => {
            const shortName = f.name.replace(/\s*\(\d+mg kofeiny\)/i, '');
            const label = f.is_pinned ? `★ ${shortName.length > 18 ? `${shortName.slice(0, 16)}…` : shortName}` : f.name.length > 22 ? `${f.name.slice(0, 20)}…` : f.name;
            return (
              <button key={f.id} type="button" disabled={d.saving} onClick={() => d.handleFavorite(f)}
                className="rounded-full border px-2.5 py-1 text-[10px] font-semibold disabled:opacity-50 border-primary/35 bg-primary/10 text-primary hover:bg-primary/15 cursor-pointer"
                title={f.brand ? `${f.name} — ${f.brand}` : f.name}>
                {label}
              </button>
            );
          })}
        </div>
      )}

      {d.yesterdayEntries.length > 0 && (
        <div className="space-y-1.5 pt-2.5 border-t border-border-custom/30 mt-1">
          <p className="text-[9px] font-black uppercase tracking-wider text-text-muted">
            {d.getYesterdayLabel(d.yesterdayEntries[0].date, d.mealType)}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {d.yesterdayEntries.map((entry) => (
              <button key={entry.id} type="button" disabled={d.saving} onClick={() => d.handleLogYesterdayEntry(entry)}
                className="rounded-full border border-border-custom bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-text-secondary hover:border-primary/30 hover:text-primary disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                title={`Zaloguj ponownie: ${entry.name}`}>
                <RotateCcw size={10} className="text-text-muted" />
                <span>{entry.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {d.preview && (
        <div className="space-y-2 border-t border-border-custom/50 pt-3">
          <p className="text-[9px] font-black uppercase tracking-wider text-text-muted">Sprawdź przed zapisem</p>
          {d.preview.map((item, i) => {
            if (d.removed.has(i)) return null;
            const badge = d.confidenceLabel(item);
            return (
              <div key={i} className="flex items-center gap-2 rounded-xl border border-border-custom/60 px-2.5 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold truncate">{item.name}</p>
                  <p className="text-[10px] text-text-muted">{item.grams}g · {item.calories} kcal · {item.protein}B</p>
                  {item.assumptions?.length && <p className="text-[9px] text-warning/90 mt-0.5 leading-snug">{item.assumptions.join(' · ')}</p>}
                </div>
                {badge && <span className={`text-[9px] font-bold uppercase ${badge === 'sprawdź' ? 'text-warning' : 'text-success'}`}>{badge}</span>}
                <button type="button" onClick={() => d.setRemoved((p) => new Set([...p, i]))} className="text-[10px] text-text-muted hover:text-danger">×</button>
              </div>
            );
          })}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { d.setPreview(null); d.setRemoved(new Set()); }} className="flex-1">Anuluj</Button>
            <Button variant="primary" size="sm" onClick={d.handleSavePreview} loading={d.saving} disabled={!d.activePreview.length} className="flex-1">Zapisz ({d.activePreview.length})</Button>
          </div>
        </div>
      )}

      {onOpenFullModal && (
        <Button variant="ghost" size="sm" onClick={onOpenFullModal} className="px-0 py-0 text-[10px] text-primary/80 hover:text-primary hover:bg-transparent">Skaner / wyszukiwarka →</Button>
      )}
    </Card>
  );
}
