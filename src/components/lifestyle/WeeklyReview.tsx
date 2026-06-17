import { useEffect, useState } from 'react';
import { Shield, Zap, Wallet, Plus, X, Check, ChevronLeft, TrendingUp, TrendingDown, Minus, Settings, Trash2 } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

const PILLARS = [
  { id: 'cialo', label: 'Ciało', icon: Shield, text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/8', border: 'border-emerald-500/20', chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  { id: 'duch',  label: 'Duch',  icon: Zap,    text: 'text-indigo-600 dark:text-indigo-400',   bg: 'bg-indigo-500/8',  border: 'border-indigo-500/20',  chip: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'   },
  { id: 'konto', label: 'Konto', icon: Wallet, text: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/8',   border: 'border-amber-500/20',   chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400'       },
];

function getWeekStart(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  return mon.toLocaleDateString('en-CA');
}

function getPrevWeekStart(ws: string): string {
  const d = new Date(ws + 'T00:00:00');
  d.setDate(d.getDate() - 7);
  return d.toLocaleDateString('en-CA');
}

function formatWeek(ws: string): string {
  const d = new Date(ws + 'T00:00:00');
  const sun = new Date(d); sun.setDate(d.getDate() + 6);
  const fmt = (x: Date) => x.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
  return `${fmt(d)} – ${fmt(sun)}`;
}

type Kpi = { id: string; pillar: string; name: string; unit: string; higher_is_better: boolean; sort_order: number };
type Entry = { kpi_id: string; value: number | null };

export default function WeeklyReview({ session, onBack }: { session: Session; onBack: () => void }) {
  const uid = session.user.id;
  const weekStart = getWeekStart();
  const prevWeek  = getPrevWeekStart(weekStart);

  const [kpis, setKpis]       = useState<Kpi[]>([]);
  const [thisWeek, setThisWeek] = useState<Record<string, string>>({});   // kpi_id → input string
  const [lastWeek, setLastWeek] = useState<Record<string, number | null>>({});
  const [review, setReview]   = useState({ what_worked: '', what_didnt_work: '' });
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  // Setup mode
  const [setupMode, setSetupMode] = useState(false);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [newKpi, setNewKpi]   = useState({ name: '', unit: '', higher_is_better: true });

  useEffect(() => {
    loadAll();
  }, [uid]);

  const db = supabase as any;

  async function loadAll() {
    const [{ data: k }, { data: thisEntries }, { data: prevEntries }, { data: rev }] = await Promise.all([
      db.from('goal_kpis').select('*').eq('user_id', uid).order('sort_order').order('created_at'),
      db.from('kpi_entries').select('kpi_id, value').eq('user_id', uid).eq('week_start', weekStart),
      db.from('kpi_entries').select('kpi_id, value').eq('user_id', uid).eq('week_start', prevWeek),
      db.from('weekly_kpi_reviews').select('*').eq('user_id', uid).eq('week_start', weekStart).maybeSingle(),
    ]);
    setKpis(k ?? []);
    const thisMap: Record<string, string> = {};
    for (const e of thisEntries ?? []) thisMap[e.kpi_id] = e.value != null ? String(e.value) : '';
    setThisWeek(thisMap);
    const prevMap: Record<string, number | null> = {};
    for (const e of prevEntries ?? []) prevMap[e.kpi_id] = e.value;
    setLastWeek(prevMap);
    if (rev) setReview({ what_worked: rev.what_worked ?? '', what_didnt_work: rev.what_didnt_work ?? '' });
  }

  async function addKpi(pillar: string) {
    if (!newKpi.name.trim()) return;
    const { data, error } = await db.from('goal_kpis').insert({
      user_id: uid, pillar, name: newKpi.name.trim(), unit: newKpi.unit.trim(),
      higher_is_better: newKpi.higher_is_better, sort_order: kpis.filter(k => k.pillar === pillar).length,
    }).select().single();
    if (!error && data) { setKpis(prev => [...prev, data as Kpi]); }
    setAddingFor(null);
    setNewKpi({ name: '', unit: '', higher_is_better: true });
  }

  async function deleteKpi(id: string) {
    setKpis(prev => prev.filter(k => k.id !== id));
    await db.from('goal_kpis').delete().eq('id', id).eq('user_id', uid);
  }

  async function save() {
    setSaving(true);
    try {
      const upserts = kpis
        .filter(k => thisWeek[k.id] !== undefined && thisWeek[k.id] !== '')
        .map(k => ({
          user_id: uid, kpi_id: k.id, week_start: weekStart,
          value: parseFloat(thisWeek[k.id]),
        }));
      if (upserts.length > 0) {
        await db.from('kpi_entries').upsert(upserts, { onConflict: 'kpi_id,week_start' });
      }
      await db.from('weekly_kpi_reviews').upsert({
        user_id: uid, week_start: weekStart,
        what_worked: review.what_worked || null,
        what_didnt_work: review.what_didnt_work || null,
      }, { onConflict: 'user_id,week_start' });
      setSaved(true);
      setTimeout(() => { setSaved(false); onBack(); }, 900);
    } finally { setSaving(false); }
  }

  const noKpis = kpis.length === 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border-custom bg-background/90 backdrop-blur-sm px-5 py-3.5">
        <button onClick={onBack} className="rounded-full p-1.5 text-text-muted hover:text-text-primary transition-colors cursor-pointer">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Weekly Review</p>
          <p className="text-[13px] font-semibold text-text-primary">{formatWeek(weekStart)}</p>
        </div>
        <button
          onClick={() => setSetupMode(s => !s)}
          className={`rounded-full p-2 transition-colors cursor-pointer ${setupMode ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text-primary'}`}
          title="Zarządzaj KPIs"
        >
          <Settings size={16} />
        </button>
      </div>

      <div className="px-5 py-5 space-y-6 pb-32">
        {/* No KPIs prompt */}
        {noKpis && !setupMode && (
          <div className="rounded-[24px] border border-dashed border-border-custom p-6 text-center space-y-3">
            <p className="text-[14px] font-bold text-text-primary">Brak zdefiniowanych KPIs</p>
            <p className="text-[12px] text-text-muted">Dodaj mierzalne wskaźniki dla każdego filaru — tygodniowo będziesz widział czy się posuwasz do przodu.</p>
            <button onClick={() => setSetupMode(true)}
              className="rounded-xl bg-primary px-4 py-2.5 text-[12px] font-bold text-white cursor-pointer">
              Zdefiniuj KPIs →
            </button>
          </div>
        )}

        {/* KPI sections */}
        {PILLARS.map(pillar => {
          const pillarKpis = kpis.filter(k => k.pillar === pillar.id);
          const Icon = pillar.icon;

          return (
            <div key={pillar.id} className="space-y-3">
              {/* Pillar header */}
              <div className="flex items-center gap-2">
                <span className={`flex items-center justify-center w-7 h-7 rounded-xl ${pillar.bg} border ${pillar.border}`}>
                  <Icon size={13} className={pillar.text} />
                </span>
                <span className={`text-[11px] font-black uppercase tracking-widest ${pillar.text}`}>{pillar.label}</span>
                <div className="flex-1 border-t border-border-custom/40" />
                {setupMode && (
                  <button
                    onClick={() => { setAddingFor(pillar.id); setNewKpi({ name: '', unit: '', higher_is_better: true }); }}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${pillar.chip} cursor-pointer`}
                  >
                    <Plus size={10} /> KPI
                  </button>
                )}
              </div>

              {/* KPI rows */}
              {pillarKpis.length === 0 && !setupMode && (
                <p className="pl-2 text-[11px] italic text-text-muted/40">Brak KPIs — kliknij ⚙ żeby dodać</p>
              )}

              <div className="space-y-2">
                {pillarKpis.map(kpi => {
                  const prev   = lastWeek[kpi.id] ?? null;
                  const curStr = thisWeek[kpi.id] ?? '';
                  const cur    = curStr !== '' ? parseFloat(curStr) : null;
                  const delta  = (cur !== null && prev !== null) ? cur - prev : null;
                  const pct    = (delta !== null && prev !== null && prev !== 0) ? (delta / Math.abs(prev) * 100) : null;
                  const better = delta === null ? null : (kpi.higher_is_better ? delta > 0 : delta < 0);
                  const neutral = delta !== null && Math.abs(delta) < 0.01;

                  return (
                    <div key={kpi.id} className={`rounded-[20px] border ${pillar.border} ${pillar.bg} px-4 py-3 space-y-2`}>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold text-text-primary flex-1">{kpi.name}</span>
                        {kpi.unit && <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">{kpi.unit}</span>}
                        {setupMode && (
                          <button onClick={() => deleteKpi(kpi.id)} className="p-1 rounded text-text-muted/30 hover:text-rose-500 transition-colors cursor-pointer">
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>

                      {!setupMode && (
                        <div className="flex items-center gap-3">
                          {/* Previous week */}
                          <div className="text-center">
                            <p className="text-[8px] font-bold uppercase tracking-widest text-text-muted/60 mb-0.5">poprz.</p>
                            <p className="text-[14px] font-black text-text-muted/50">
                              {prev !== null ? prev : '—'}
                            </p>
                          </div>

                          <div className="text-text-muted/30 text-lg">→</div>

                          {/* This week input */}
                          <div className="flex-1">
                            <p className="text-[8px] font-bold uppercase tracking-widest text-text-muted/60 mb-0.5">ten tydzień</p>
                            <input
                              type="number"
                              inputMode="decimal"
                              value={curStr}
                              onChange={e => setThisWeek(prev => ({ ...prev, [kpi.id]: e.target.value }))}
                              placeholder="wpisz..."
                              className="w-full bg-transparent text-[18px] font-black text-text-primary outline-none placeholder:text-text-muted/25 placeholder:text-[14px] placeholder:font-medium"
                            />
                          </div>

                          {/* Delta badge */}
                          {delta !== null && !neutral && (
                            <div className={`flex items-center gap-1 rounded-xl px-2 py-1 text-[10px] font-black ${
                              better === null ? 'text-text-muted' : better ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'
                            }`}>
                              {better ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                              {delta > 0 ? '+' : ''}{pct !== null ? `${pct.toFixed(0)}%` : delta.toFixed(1)}
                            </div>
                          )}
                          {neutral && delta !== null && (
                            <div className="flex items-center gap-1 rounded-xl px-2 py-1 text-[10px] font-black text-text-muted bg-surface">
                              <Minus size={11} /> bez zmian
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Inline add KPI form */}
                {setupMode && addingFor === pillar.id && (
                  <div className={`rounded-[20px] border ${pillar.border} bg-surface/60 p-3 space-y-2`}>
                    <input
                      autoFocus
                      value={newKpi.name}
                      onChange={e => setNewKpi(f => ({ ...f, name: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') addKpi(pillar.id); if (e.key === 'Escape') setAddingFor(null); }}
                      placeholder="Nazwa KPI (np. % tłuszczu, net worth)"
                      className="w-full bg-transparent text-[13px] font-semibold text-text-primary outline-none placeholder:text-text-muted/40"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        value={newKpi.unit}
                        onChange={e => setNewKpi(f => ({ ...f, unit: e.target.value }))}
                        placeholder="Jednostka (%, kg, PLN...)"
                        className="flex-1 bg-transparent text-[12px] text-text-secondary outline-none placeholder:text-text-muted/40 border-b border-border-custom/50 pb-0.5"
                      />
                      <button
                        onClick={() => setNewKpi(f => ({ ...f, higher_is_better: !f.higher_is_better }))}
                        className={`shrink-0 rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-widest cursor-pointer transition-colors ${
                          newKpi.higher_is_better ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-500'
                        }`}
                      >
                        {newKpi.higher_is_better ? '↑ więcej = lepiej' : '↓ mniej = lepiej'}
                      </button>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setAddingFor(null)} className="flex-1 rounded-xl border border-border-custom py-2 text-[11px] font-bold text-text-muted cursor-pointer">Anuluj</button>
                      <button onClick={() => addKpi(pillar.id)} disabled={!newKpi.name.trim()}
                        className="flex-1 rounded-xl bg-primary py-2 text-[11px] font-bold text-white disabled:opacity-30 cursor-pointer">
                        <Check size={12} className="inline mr-1" /> Dodaj
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Review notes — only in review mode with KPIs */}
        {!setupMode && !noKpis && (
          <div className="space-y-3 pt-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Przegląd tygodnia</p>

            <div className="rounded-[24px] border border-emerald-500/15 bg-emerald-500/5 p-4 space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Co zadziałało?</label>
              <textarea
                value={review.what_worked}
                onChange={e => setReview(r => ({ ...r, what_worked: e.target.value }))}
                rows={2}
                placeholder="Najlepsza decyzja / wynik / nawyk tego tygodnia..."
                className="w-full resize-none bg-transparent text-[13px] text-text-primary outline-none placeholder:text-text-muted/40 leading-relaxed"
              />
            </div>

            <div className="rounded-[24px] border border-rose-500/15 bg-rose-500/5 p-4 space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-rose-500">Co nie zadziałało?</label>
              <textarea
                value={review.what_didnt_work}
                onChange={e => setReview(r => ({ ...r, what_didnt_work: e.target.value }))}
                rows={2}
                placeholder="Co blokowało? Co odpuściłeś? Co powtarzasz bez efektu?"
                className="w-full resize-none bg-transparent text-[13px] text-text-primary outline-none placeholder:text-text-muted/40 leading-relaxed"
              />
            </div>
          </div>
        )}
      </div>

      {/* Sticky bottom CTA */}
      {!setupMode && !noKpis && (
        <div className="fixed bottom-0 left-0 right-0 px-5 pb-6 pt-3 bg-gradient-to-t from-background via-background/95 to-transparent">
          <button
            onClick={save}
            disabled={saving || saved}
            className={`w-full rounded-[20px] py-4 text-[13px] font-black tracking-wide transition-all cursor-pointer ${
              saved
                ? 'bg-emerald-500 text-white'
                : 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-[0.98]'
            } disabled:opacity-60`}
          >
            {saved ? '✓ Zapisano!' : saving ? 'Zapisuję...' : 'Zapisz przegląd tygodnia'}
          </button>
        </div>
      )}

      {setupMode && (
        <div className="fixed bottom-0 left-0 right-0 px-5 pb-6 pt-3 bg-gradient-to-t from-background via-background/95 to-transparent">
          <button
            onClick={() => setSetupMode(false)}
            className="w-full rounded-[20px] bg-primary py-4 text-[13px] font-black text-white shadow-lg shadow-primary/20 cursor-pointer"
          >
            Gotowe — przejdź do przeglądu →
          </button>
        </div>
      )}
    </div>
  );
}
