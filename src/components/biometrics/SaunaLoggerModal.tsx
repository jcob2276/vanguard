import Button from '../ui/Button';
import { ControlInput, ControlTextarea } from '../ui/ControlPrimitives';
import { useState } from 'react';
import { ChevronLeft, Flame, Save } from 'lucide-react';
import { useHaptics } from '../../hooks/useHaptics';
import { notify } from '../../lib/notify';
import { saveSaunaSession } from '../../lib/health/workoutSauna';
import { numInput } from './workout/workoutUtils';
import { useUserId } from '../../store/useStore';
import SaunaRpePicker from './SaunaRpePicker';

export default function SaunaLoggerModal({
  onBack,
  onSaved,
}: {
  onBack: () => void;
  onSaved?: () => void;
}) {
  const userId = useUserId();
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
    } catch (err: unknown) {
      haptics.error();
      notify(err instanceof Error ? (err as Error).message : String(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 bg-background flex flex-col min-h-screen pb-32 transition-colors duration-[var(--motion-slow)]">
      <header className="sticky top-0 z-[var(--z-sticky)] bg-background/80 backdrop-blur-[var(--blur-md)] border-b border-border-custom p-4 flex items-center gap-3">
        <Button
          variant="ghost"
          onClick={onBack}
          icon={<ChevronLeft size={20} />}
          className="p-2 -ml-2 min-w-0 text-text-secondary hover:text-text-primary hover:bg-transparent"
        />
        <div className="flex items-center gap-2 flex-1">
          <Flame size={16} className="text-warning" />
          <h1 className="text-xs font-black uppercase tracking-[var(--legacy-arbitrary-002)] text-text-primary font-display">Sauna</h1>
        </div>
      </header>

      <main className="flex-1 p-5 space-y-8 max-w-md mx-auto w-full">
        <p className="text-sm text-text-secondary leading-relaxed">
          Osobny log od treningu siłowego. Po zapisie: strain (wellness ~1,5 pkt/min) + wymiar Regeneracja w profilu hybrydowym.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-2xs font-black uppercase tracking-widest text-text-secondary">Minuty</label>
            <ControlInput
              type="number"
              min={1}
              step={1}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className={numInput}
            />
            <div className="flex gap-1 justify-center">
              <Button variant="ghost" onClick={() => adjust('minutes', -5)} className="text-xs font-bold bg-surface border border-border-custom w-9 h-7 min-w-0 p-0 rounded-lg hover:bg-surface">-5</Button>
              <Button variant="ghost" onClick={() => adjust('minutes', 5)} className="text-xs font-bold bg-surface border border-border-custom w-9 h-7 min-w-0 p-0 rounded-lg hover:bg-surface">+5</Button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-2xs font-black uppercase tracking-widest text-text-secondary">Temperatura °C</label>
            <ControlInput
              type="number"
              min={1}
              step={1}
              value={celsius}
              onChange={(e) => setCelsius(e.target.value)}
              placeholder="80"
              className={numInput}
            />
            <div className="flex gap-1 justify-center">
              <Button variant="ghost" onClick={() => adjust('celsius', -5)} className="text-xs font-bold bg-surface border border-border-custom w-9 h-7 min-w-0 p-0 rounded-lg hover:bg-surface">-5</Button>
              <Button variant="ghost" onClick={() => adjust('celsius', 5)} className="text-xs font-bold bg-surface border border-border-custom w-9 h-7 min-w-0 p-0 rounded-lg hover:bg-surface">+5</Button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-2xs font-black uppercase tracking-widest text-text-secondary">Notatka</label>
          <ControlTextarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="np. po treningu nóg, sucha sauna, zimny prysznic po"
            className="w-full bg-surface-solid border border-border-custom rounded-2xl px-4 py-3 text-sm text-text-primary min-h-[var(--legacy-h-047)] outline-none focus:border-primary/50 resize-none placeholder:text-text-muted/40"
          />
        </div>

        <SaunaRpePicker sessionRpe={sessionRpe} setSessionRpe={setSessionRpe} />
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-[var(--z-modal)] border-t border-border-custom bg-background/90 backdrop-blur-[var(--blur-md)] p-4 pb-[var(--legacy-arbitrary-007)]">
        <div className="mx-auto max-w-md">
          <Button
            variant="ghost"
            onClick={() => void save()}
            disabled={saving}
            icon={<Save size={14} />}
            className="w-full min-w-0 rounded-2xl bg-warning py-3.5 text-xs font-black uppercase tracking-wider text-on-accent hover:bg-warning-hover hover:text-on-accent disabled:opacity-[var(--opacity-50)]"
          >
            {saving ? 'Zapisywanie…' : 'Zapisz saunę'}
          </Button>
        </div>
      </div>
    </div>
  );
}
