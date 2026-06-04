import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import IdentityVault from './IdentityVault';
import DataHub from './DataHub';

function SectionHeader({ icon: Icon, title, detail }) {
  return (
    <header className="space-y-1">
      <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.22em] text-white/35">
        <Icon size={12} /> {title}
      </p>
      {detail && <p className="text-[11px] font-semibold leading-relaxed text-white/40">{detail}</p>}
    </header>
  );
}

function TextAreaBlock({ label, value, onChange, placeholder, danger = false, rows = 4 }) {
  return (
    <label className="block space-y-2">
      <span className="text-[8px] font-black uppercase tracking-[0.18em] text-white/30">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`w-full resize-none rounded-lg border bg-black/45 p-4 text-[12px] font-bold leading-relaxed text-white outline-none transition-colors placeholder:text-white/18 ${
          danger ? 'border-dayB/25 focus:border-dayB/70' : 'border-white/[0.08] focus:border-primary/70'
        }`}
      />
    </label>
  );
}

export default function Fundament({ onBack, session, onSyncCalendar, isSyncing }) {
  const [identity, setIdentity] = useState({
    long_term_mission: '',
    pillars: ['', '', ''],
    avoidance_triggers: '',
    behavioral_baseline: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchIdentity();
  }, []);

  async function fetchIdentity() {
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session) return;

    const { data } = await supabase
      .from('vanguard_identity')
      .select('*')
      .eq('user_id', auth.session.user.id)
      .maybeSingle();

    if (data) {
      setIdentity({
        long_term_mission: data.long_term_mission || '',
        pillars: data.pillars || ['', '', ''],
        avoidance_triggers: data.avoidance_triggers || '',
        behavioral_baseline: data.behavioral_baseline ? JSON.stringify(data.behavioral_baseline, null, 2) : '',
      });
    }
    setLoading(false);
  }

  async function saveIdentity() {
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session) throw new Error('Brak aktywnej sesji.');

      let baselineJson = null;
      if (identity.behavioral_baseline.trim()) {
        try {
          baselineJson = JSON.parse(identity.behavioral_baseline);
        } catch {
          throw new Error('Baseline musi byc poprawnym JSON.');
        }
      }

      const { error } = await supabase.from('vanguard_identity').upsert({
        user_id: auth.session.user.id,
        long_term_mission: identity.long_term_mission,
        pillars: identity.pillars,
        avoidance_triggers: identity.avoidance_triggers,
        behavioral_baseline: baselineJson,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
      alert('Fundament zapisany.');
    } catch (err) {
      console.error('Save Identity Error:', err);
      alert(`Blad zapisu: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30">
      <div className="mx-auto flex min-h-screen max-w-md flex-col border-x border-white/5 pb-8">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/5 bg-black/80 px-5 py-4 backdrop-blur-xl">
          <button
            onClick={onBack}
            className="rounded-full border border-white/5 bg-white/5 p-2.5 text-white/45 transition-colors hover:text-white"
            title="Wroc"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-[16px] font-black uppercase tracking-tight text-white">Identity Fundament</h1>
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-primary">Core context</p>
          </div>
        </header>

        <main className="flex-1 space-y-6 p-5">
          <section className="rounded-lg border border-white/[0.08] bg-[linear-gradient(135deg,rgba(23,23,25,0.98),rgba(6,8,12,0.98))] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.24em] text-primary">Fundament</p>
                <h2 className="mt-2 text-[24px] font-black uppercase leading-none tracking-tight text-white">
                  Prawda systemu
                </h2>
              </div>
              <div className="rounded-lg border border-primary/20 bg-primary/10 p-3 text-primary">
                <Fingerprint size={20} />
              </div>
            </div>
            <p className="mt-4 text-[12px] font-semibold leading-relaxed text-white/48">
              To nie jest dashboard. To baza kontekstu, ktora ma ustawic interpretacje Mirror, Kierunku i raportow.
            </p>
          </section>

          <section className="space-y-3">
            <SectionHeader icon={Target} title="Misja" detail="Jedno zdanie lub akapit, ktory ustawia dlugi kierunek." />
            <TextAreaBlock
              label="Long-term mission"
              value={identity.long_term_mission}
              onChange={(value) => setIdentity({ ...identity, long_term_mission: value })}
              placeholder="Jaki jest ostateczny kierunek operacyjny?"
              rows={5}
            />
          </section>

          <section className="space-y-3">
            <SectionHeader icon={Shield} title="Filary identity" detail="Trzy stabilne deklaracje: kim jestes, kiedy system ma oceniac zachowanie." />
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
                  className="w-full rounded-lg border border-white/[0.08] bg-black/45 p-3 text-[12px] font-bold text-white outline-none transition-colors placeholder:text-white/18 focus:border-primary/70"
                />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <SectionHeader icon={Zap} title="Drifters" detail="Zachowania, ktore system ma traktowac jako odchylenie od kierunku." />
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
            <SectionHeader icon={Database} title="Zrodla danych" detail="Tu trafia kalendarz i importy, zamiast wisiec jako globalna ikona w headerze." />
            <div className="grid gap-3">
              <button
                onClick={onSyncCalendar}
                disabled={isSyncing}
                className="flex w-full items-center justify-between rounded-lg border border-white/[0.08] bg-neutral-950/80 p-4 text-left transition-colors hover:border-primary/35 disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.04] text-white/52">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/30">Calendar</p>
                    <p className="text-[12px] font-black uppercase tracking-[0.08em] text-white">Synchronizuj kalendarz</p>
                  </div>
                </div>
                <RefreshCw size={15} className={`text-primary ${isSyncing ? 'animate-spin' : ''}`} />
              </button>

              <DataHub session={session} embedded />
            </div>
          </section>

          <section className="space-y-3">
            <SectionHeader icon={UploadCloud} title="Identity Vault" detail="Dokumenty, ankiety, testy i dlugi kontekst do analiz." />
            <IdentityVault session={session} />
          </section>

          <section className="space-y-3">
            <SectionHeader icon={Brain} title="Behavioral baseline" detail="Opcjonalny JSON z baseline zachowania." />
            <textarea
              value={identity.behavioral_baseline}
              onChange={(event) => setIdentity({ ...identity, behavioral_baseline: event.target.value })}
              placeholder='{"baselineMode": "THE_BUILDER"}'
              rows={8}
              className="w-full resize-none rounded-lg border border-white/[0.08] bg-black/45 p-4 font-mono text-[10px] font-bold leading-relaxed text-primary outline-none placeholder:text-white/18 focus:border-primary/70"
            />
          </section>

          <button
            onClick={saveIdentity}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-4 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-primary/20 transition-transform active:scale-[0.99] disabled:opacity-50"
          >
            <Save size={16} /> {saving ? 'Zapisywanie...' : 'Zapisz fundament'}
          </button>

          <section className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-[10px] font-bold uppercase leading-relaxed text-white/45">
              Te dane sa warstwa deklaracji i kontekstu. System nadal powinien konfrontowac je z zachowaniem, nie traktowac jako automatycznej prawdy o wykonaniu.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
