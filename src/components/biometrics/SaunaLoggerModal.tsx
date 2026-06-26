import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ChevronLeft, Flame, Save } from 'lucide-react';
import { useHaptics } from '../../hooks/useHaptics';
import { notify } from '../../lib/notify';
import { saveSaunaSession } from '../../lib/workoutLogging';
import { numInput } from './workout/workoutUtils';

export default function SaunaLoggerModal({
  session,
  onBack,
  onSaved,
}: {
  session: Session;
  onBack: () => void;
  onSaved?: () => void;
}) {
  const userId = session.user.id;
  const haptics = useHaptics();
  const [minutes, setMinutes] = useState('15');
  const [celsius, setCelsius] = useState('80');
  const [sessionRpe, setSessionRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const adjust = (field: 'minutes' | 'celsius', step: number) => {
    haptics.light();
    const cur = parseFloat(field === 'minutes' ? minutes : celsius);
    const fallback = field === 'minutes' ? 15 : 80;
    const next = (Number.isFinite(cur) ? cur : fallback) + step;
    if (next < 1) return;
    if (field === 'minutes') setMinutes(String(Math.round(next)));
    else setCelsius(String(Math.round(next)));
  };

  async function save() {
    if (!userId || saving) return;
    const mins = parseInt(minutes, 10);
    const temp = celsius.trim() ? parseInt(celsius, 10) : null;
    if (!mins || mins < 1) {
      notify('Podaj czas w minutach', 'error');
      return;
    }

    setSaving(true);
    try {
      await saveSaunaSession(userId, {
        minutes: mins,
        celsius: temp,
        sessionRpe,
        notes,
      });
      haptics.success();
      notify('Zapisano saunę', 'success');
      onSaved?.();
      onBack();
    } catch (err) {
      haptics.error();
      notify(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 bg-background flex flex-col min-h-screen pb-32 transition-colors duration-300">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border-custom p-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-2 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <Flame size={16} className="text-orange-500" />
          <h1 className="text-xs font-black uppercase tracking-[0.2em] text-text-primary font-display">Sauna</h1>
        </div>
      </header>

      <main className="flex-1 p-5 space-y-8 max-w-md mx-auto w-full">
        <p className="text-[12px] text-text-secondary leading-relaxed">
          Osobny log od treningu siłowego. Po zapisie: strain (wellness ~1,5 pkt/min) + wymiar Regeneracja w profilu hybrydowym.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[9px] font-black uppercase tracking-widest text-text-secondary">Minuty</label>
            <input
              type="number"
              min={1}
              step={1}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className={numInput}
            />
            <div className="flex gap-1 justify-center">
              <button type="button" onClick={() => adjust('minutes', -5)} className="text-[11px] font-bold bg-surface border border-border-custom w-9 h-7 rounded-lg cursor-pointer">-5</button>
              <button type="button" onClick={() => adjust('minutes', 5)} className="text-[11px] font-bold bg-surface border border-border-custom w-9 h-7 rounded-lg cursor-pointer">+5</button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black uppercase tracking-widest text-text-secondary">Temperatura °C</label>
            <input
              type="number"
              min={1}
              step={1}
              value={celsius}
              onChange={(e) => setCelsius(e.target.value)}
              placeholder="80"
              className={numInput}
            />
            <div className="flex gap-1 justify-center">
              <button type="button" onClick={() => adjust('celsius', -5)} className="text-[11px] font-bold bg-surface border border-border-custom w-9 h-7 rounded-lg cursor-pointer">-5</button>
              <button type="button" onClick={() => adjust('celsius', 5)} className="text-[11px] font-bold bg-surface border border-border-custom w-9 h-7 rounded-lg cursor-pointer">+5</button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-text-secondary">Notatka</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="np. po treningu nóg, sucha sauna, zimny prysznic po"
            className="w-full bg-surface-solid border border-border-custom rounded-2xl px-4 py-3 text-sm text-text-primary min-h-[90px] outline-none focus:border-primary/50 resize-none placeholder:text-text-muted/40"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[9px] font-black uppercase tracking-widest text-text-secondary">RPE sesji</label>
            {sessionRpe && (
              <button type="button" onClick={() => setSessionRpe(null)} className="text-[9px] text-text-muted cursor-pointer">wyczyść</button>
            )}
          </div>
          <div className="grid grid-cols-10 gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
              const color =
                n <= 4
                  ? 'border-sky-500/30 text-sky-650 bg-sky-500/8'
                  : n <= 6
                    ? 'border-yellow-500/35 text-yellow-600 bg-yellow-500/8'
                    : n <= 8
                      ? 'border-orange-500/35 text-orange-600 bg-orange-500/8'
                      : 'border-dayB/35 text-dayB bg-dayB/8';
              const active = sessionRpe === n ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-105' : 'opacity-80';
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSessionRpe(sessionRpe === n ? null : n)}
                  className={`rounded-lg border py-2 text-[11px] font-black transition-all cursor-pointer ${color} ${active}`}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <p className="text-[9px] text-text-muted">
            {sessionRpe
              ? sessionRpe <= 4
                ? 'Lekko — dużo rezerwy'
                : sessionRpe <= 6
                  ? 'Umiarkowanie'
                  : sessionRpe <= 8
                    ? 'Ciężko — mało rezerwy'
                    : 'Maksymalnie'
              : 'Jak intensywnie była sesja?'}
          </p>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border-custom bg-background/90 backdrop-blur-md p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-md">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3.5 text-xs font-black uppercase tracking-wider text-white hover:bg-orange-600 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Zapisywanie…' : 'Zapisz saunę'}
          </button>
        </div>
      </div>
    </div>
  );
}
