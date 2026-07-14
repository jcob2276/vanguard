import { useCallback, useEffect, useState } from 'react';
import {
  Brain,
  Calendar,
  ChevronLeft,
  Database,
  Fingerprint,
  RefreshCw,
  Save,
  Shield,
  Target,
  UploadCloud,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { notify } from '../../lib/notify';
import IdentityVault from '../identity/IdentityVault';
import DataHub from './DataHub';
import { useUserId } from '../../store/useStore';
import Button from '../ui/Button';

function SectionHeader({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail?: string | null }) {
  return (
    <header className="space-y-1">
      <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.22em] text-text-muted">
        <Icon size={12} /> {title}
      </p>
      {detail && <p className="text-[11px] font-semibold leading-relaxed text-text-secondary">{detail}</p>}
    </header>
  );
}

function TextAreaBlock({ label, value, onChange, placeholder, danger = false, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; danger?: boolean; rows?: number }) {
  return (
    <label className="block space-y-2">
      <span className="text-[8px] font-black uppercase tracking-[0.18em] text-text-muted">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`w-full resize-none rounded-2xl border bg-surface p-4 text-[12px] font-bold leading-relaxed text-text-primary outline-none transition-colors placeholder:text-text-muted/40 ${
          danger 
            ? 'border-dayB/30 focus:border-dayB/60 focus:bg-surface-solid focus:shadow-[0_0_0_3px_rgba(244,63,94,0.1)]' 
            : 'border-border-custom focus:border-primary/50 focus:bg-surface-solid focus:shadow-[0_0_0_3px_rgba(79,70,229,0.1)]'
        }`}
      />
    </label>
  );
}

export default function Fundament({ onBack, onSyncCalendar, isSyncing }: { onBack: () => void; onSyncCalendar: () => Promise<void> | void; isSyncing: boolean }) {
  const userId = useUserId();
  const [identity, setIdentity] = useState({
    long_term_mission: '',
    pillars: ['', '', ''],
    avoidance_triggers: '',
    behavioral_baseline: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchIdentity = useCallback(async () => {
    const { data } = await supabase
      .from('vanguard_identity')
      .select('*')
      .eq('user_id', userId!)
      .maybeSingle();

    if (data) {
      setIdentity({
        long_term_mission: data.long_term_mission || '',
        pillars: Array.isArray(data.pillars) ? data.pillars.map(String) : ['', '', ''],
        avoidance_triggers: typeof data.avoidance_triggers === 'string' ? data.avoidance_triggers : '',
        behavioral_baseline: data.behavioral_baseline ? JSON.stringify(data.behavioral_baseline, null, 2) : '',
      });
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchIdentity();
    }, 0);
    return () => clearTimeout(t);
  }, [fetchIdentity]);

  async function saveIdentity() {
    setSaving(true);
    try {
      let baselineJson = null;
      if (identity.behavioral_baseline.trim()) {
        try {
          baselineJson = JSON.parse(identity.behavioral_baseline);
        } catch {
          throw new Error('Baseline musi być poprawnym JSON.');
        }
      }

      const { error } = await supabase.from('vanguard_identity').upsert({
        user_id: userId!,
        long_term_mission: identity.long_term_mission,
        pillars: identity.pillars,
        avoidance_triggers: identity.avoidance_triggers,
        behavioral_baseline: baselineJson,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
      notify('Fundament zapisany.', 'success');
    } catch (err: unknown) {
      console.error('Save Identity Error:', err);
      notify(`Błąd zapisu: ${err instanceof Error ? (err as Error).message : String(err)}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background text-text-primary selection:bg-primary/30 transition-colors duration-300">
      <div className="mx-auto flex min-h-screen max-w-md flex-col border-x border-border-custom bg-background/40 backdrop-blur-3xl pb-8 shadow-sm">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border-custom bg-background/80 px-5 py-4 backdrop-blur-xl">
          <Button
            onClick={onBack}
            variant="secondary"
            icon={<ChevronLeft size={18} />}
            className="rounded-full p-2.5"
            title="Wróć"
          />
          <div className="min-w-0">
            <h1 className="truncate text-[16px] font-black uppercase tracking-tight text-text-primary font-display">Identity Fundament</h1>
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-primary">Core context</p>
          </div>
        </header>

        <main className="flex-1 space-y-6 p-5">
          <section className="card bg-gradient-to-br from-primary/[0.04] to-danger/[0.02] border-border-custom p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.24em] text-primary">Fundament</p>
                <h2 className="mt-2 font-display text-[24px] font-black uppercase leading-none tracking-tight text-text-primary">
                  Prawda systemu
                </h2>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-primary">
                <Fingerprint size={20} />
              </div>
            </div>
            <p className="mt-4 text-[12px] font-semibold leading-relaxed text-text-secondary">
              To nie jest dashboard. To baza kontekstu, która ma ustawić interpretację Mirror, Kierunku i raportów.
            </p>
          </section>

          <section className="space-y-3">
            <SectionHeader icon={Target} title="Misja" detail="Jedno zdanie lub akapit, który ustawia długi kierunek." />
            <TextAreaBlock
              label="Long-term mission"
              value={identity.long_term_mission}
              onChange={(value) => setIdentity({ ...identity, long_term_mission: value })}
              placeholder="Jaki jest ostateczny kierunek operacyjny?"
              rows={5}
            />
          </section>

          <section className="space-y-3">
            <SectionHeader icon={Shield} title="Filary identity" detail="Trzy stabilne deklaracje: kim jesteś, kiedy system ma oceniać zachowanie." />
            <div className="space-y-2">
              {identity.pillars.map((pillar, index) => (
                <input
                  key={index}
                  value={pillar}
                  onChange={(event) => {
                    const next = [...identity.pillars];
                    next[index] = event.target.value;
                    setIdentity({ ...identity, pillars: next });
                  }}
                  placeholder={`Filar ${index + 1}`}
                  className="w-full rounded-2xl border border-border-custom bg-surface p-3.5 text-[12.5px] font-bold text-text-primary outline-none transition-all placeholder:text-text-muted/40 focus:border-primary/50 focus:bg-surface-solid focus:shadow-[0_0_0_3px_rgba(79,70,229,0.1)]"
                />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <SectionHeader icon={Zap} title="Drifters" detail="Zachowania, które system ma traktować jako odchylenie od kierunku." />
            <TextAreaBlock
              label="System drifters"
              value={identity.avoidance_triggers}
              onChange={(value) => setIdentity({ ...identity, avoidance_triggers: value })}
              placeholder="Np. scrolling, lenie, brak snu, unikanie pracy, chaotyczne jedzenie."
              danger
              rows={5}
            />
          </section>

          <section className="space-y-3">
            <SectionHeader icon={Database} title="Źródła danych" detail="Tu trafia kalendarz i importy, zamiast wisieć jako globalna ikona w headerze." />
            <div className="grid gap-3">
              <button
                onClick={onSyncCalendar}
                disabled={isSyncing}
                className="flex w-full items-center justify-between rounded-2xl border border-border-custom bg-surface/50 p-4 text-left transition-all hover:bg-surface hover:border-primary/35 disabled:opacity-50 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-text-primary/[0.03] text-text-secondary">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-[0.18em] text-text-muted">Calendar</p>
                    <p className="text-[12.5px] font-black uppercase tracking-[0.08em] text-text-primary mt-0.5">Synchronizuj kalendarz</p>
                  </div>
                </div>
                <RefreshCw size={15} className={`text-primary ${isSyncing ? 'animate-spin' : ''}`} />
              </button>

              <DataHub embedded />
            </div>
          </section>

          <section className="space-y-3">
            <SectionHeader icon={UploadCloud} title="Identity Vault" detail="Dokumenty, ankiety, testy i długi kontekst do analiz." />
            <IdentityVault />
          </section>

          <section className="space-y-3">
            <SectionHeader icon={Brain} title="Behavioral baseline" detail="Opcjonalny JSON z baseline zachowania." />
            <textarea
              value={identity.behavioral_baseline}
              onChange={(event) => setIdentity({ ...identity, behavioral_baseline: event.target.value })}
              placeholder='{"baselineMode": "THE_BUILDER"}'
              rows={8}
              className="w-full resize-none rounded-2xl border border-border-custom bg-surface p-4 font-mono text-[10.5px] font-bold leading-relaxed text-primary outline-none placeholder:text-text-muted/40 focus:border-primary/50 focus:bg-surface-solid focus:shadow-[0_0_0_3px_rgba(79,70,229,0.1)]"
            />
          </section>

          <Button
            onClick={saveIdentity}
            loading={saving}
            icon={<Save size={16} />}
            className="w-full rounded-2xl px-4 py-4 text-[12px] font-bold tracking-wider shadow-lg shadow-primary/25 font-display"
          >
            Zapisz fundament
          </Button>

          <section className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
            <p className="text-[10px] font-bold uppercase leading-relaxed text-text-secondary">
              Te dane są warstwą deklaracji i kontekstu. System nadal powinien konfrontować je z zachowaniem, nie traktować jako automatycznej prawdy o wykonaniu.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
