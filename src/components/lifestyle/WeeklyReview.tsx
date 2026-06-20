import { useEffect, useMemo, useState } from 'react';
import { Shield, Zap, Wallet, Plus, X, Check, ChevronLeft, TrendingUp, TrendingDown, Minus, Settings, Trash2, Sparkles, AlertTriangle, Target } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

const PILLARS = [
  { id: 'cialo', label: 'Ciało', icon: Shield, text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/8', border: 'border-emerald-500/20', chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  { id: 'duch',  label: 'Duch',  icon: Zap,    text: 'text-indigo-600 dark:text-indigo-400',   bg: 'bg-indigo-500/8',  border: 'border-indigo-500/20',  chip: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'   },
  { id: 'konto', label: 'Konto', icon: Wallet, text: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/8',   border: 'border-amber-500/20',   chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400'       },
];

const PILLAR_BRIEF_KEYS: Record<string, string> = { cialo: 'cialo', duch: 'duch', konto: 'konto' };

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

function getPastWeekStarts(current: string, n: number): string[] {
  const result: string[] = [];
  const d = new Date(current + 'T00:00:00');
  for (let i = 0; i < n; i++) {
    result.unshift(d.toLocaleDateString('en-CA'));
    d.setDate(d.getDate() - 7);
  }
  return result;
}

function formatWeek(ws: string): string {
  const d = new Date(ws + 'T00:00:00');
  const sun = new Date(d); sun.setDate(d.getDate() + 6);
  const fmt = (x: Date) => x.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
  return `${fmt(d)} – ${fmt(sun)}`;
}

type Kpi = { id: string; pillar: string; name: string; unit: string; higher_is_better: boolean; sort_order: number; target: number | null };

function Sparkline({ data, higherIsBetter }: { data: number[]; higherIsBetter: boolean }) {
  if (data.length < 2) return null;
  const w = 56, h = 22, pad = 2;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const xs = data.map((_, i) => pad + (i / (data.length - 1)) * (w - pad * 2));
  const ys = data.map(v => h - pad - ((v - min) / range) * (h - pad * 2));
  const points = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
  const lastDelta = data[data.length - 1] - data[data.length - 2];
  const neutral = Math.abs(lastDelta) < 0.01;
  const good = neutral ? null : (higherIsBetter ? lastDelta > 0 : lastDelta < 0);
  const color = good === null ? 'stroke-[var(--color-text-muted)]/30' : good ? 'stroke-emerald-500' : 'stroke-rose-400';
  const dotColor = good === null ? 'fill-[var(--color-text-muted)]/30' : good ? 'fill-emerald-500' : 'fill-rose-400';
  return (
    <svg width={w} height={h} className="shrink-0 opacity-80">
      <polyline points={points} fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={color} />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="2.5" className={dotColor} />
    </svg>
  );
}

export default function WeeklyReview({ session, onBack }: { session: Session; onBack: () => void }) {
  const uid = session.user.id;
  const weekStart = getWeekStart();
  const prevWeek  = getPrevWeekStart(weekStart);

  const [kpis, setKpis]           = useState<Kpi[]>([]);
  const [thisWeek, setThisWeek]   = useState<Record<string, string>>({});
  const [lastWeek, setLastWeek]   = useState<Record<string, number | null>>({});
  const [history, setHistory]     = useState<Record<string, number[]>>({});
  const [review, setReview]       = useState({ what_worked: '', what_didnt_work: '' });
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [brief, setBrief]         = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError]   = useState<string | null>(null);
  const [autoSaved, setAutoSaved] = useState<Set<string>>(new Set());

  const [setupMode, setSetupMode] = useState(false);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [newKpi, setNewKpi]       = useState({ name: '', unit: '', higher_is_better: true, target: '' });
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestingKpis, setSuggestingKpis] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const db = supabase as any;

  useEffect(() => { loadAll(); }, [uid]);

  async function loadAll() {
    try {
    const histWeeks = getPastWeekStarts(weekStart, 8);
    const [{ data: k }, { data: thisEntries }, { data: prevEntries }, { data: rev }, { data: histEntries }] = await Promise.all([
      db.from('goal_kpis').select('*').eq('user_id', uid).order('sort_order').order('created_at'),
      db.from('kpi_entries').select('kpi_id, value').eq('user_id', uid).eq('week_start', weekStart),
      db.from('kpi_entries').select('kpi_id, value').eq('user_id', uid).eq('week_start', prevWeek),
      db.from('weekly_kpi_reviews').select('what_worked, what_didnt_work, ai_brief').eq('user_id', uid).eq('week_start', weekStart).maybeSingle(),
      db.from('kpi_entries').select('kpi_id, week_start, value').eq('user_id', uid).in('week_start', histWeeks),
    ]);

    setKpis(k ?? []);

    const thisMap: Record<string, string> = {};
    for (const e of thisEntries ?? []) thisMap[e.kpi_id] = e.value != null ? String(e.value) : '';
    // Pre-fill from current_value if no entry yet this week
    for (const kpi of (k ?? []) as any[]) {
      if (!(kpi.id in thisMap) && kpi.current_value != null) {
        thisMap[kpi.id] = String(kpi.current_value);
      }
    }
    setThisWeek(thisMap);

    const prevMap: Record<string, number | null> = {};
    for (const e of prevEntries ?? []) prevMap[e.kpi_id] = e.value;
    setLastWeek(prevMap);

    // Build sparkline history: kpi_id → sorted array of values
    const raw: Record<string, { week: string; value: number }[]> = {};
    for (const e of histEntries ?? []) {
      if (e.value === null) continue;
      if (!raw[e.kpi_id]) raw[e.kpi_id] = [];
      raw[e.kpi_id].push({ week: e.week_start, value: e.value });
    }
    const histValues: Record<string, number[]> = {};
    for (const id in raw) {
      histValues[id] = raw[id].sort((a, b) => a.week.localeCompare(b.week)).map(x => x.value);
    }
    setHistory(histValues);

    if (rev) {
      setReview({ what_worked: rev.what_worked ?? '', what_didnt_work: rev.what_didnt_work ?? '' });
      if (rev.ai_brief) setBrief(rev.ai_brief);
    }
    } catch (e) { console.error('loadAll failed', e); }
  }

  // C) Auto-save individual KPI on blur
  async function autoSaveKpi(kpiId: string, value: string) {
    if (value === '' || isNaN(parseFloat(value))) return;
    await db.from('kpi_entries').upsert(
      { user_id: uid, kpi_id: kpiId, week_start: weekStart, value: parseFloat(value) },
      { onConflict: 'kpi_id,week_start' },
    );
    setAutoSaved(prev => new Set([...prev, kpiId]));
  }

  async function addKpi(pillar: string) {
    if (!newKpi.name.trim()) return;
    const { data, error } = await db.from('goal_kpis').insert({
      user_id: uid, pillar, name: newKpi.name.trim(), unit: newKpi.unit.trim(),
      higher_is_better: newKpi.higher_is_better,
      sort_order: kpis.filter(k => k.pillar === pillar).length,
      target: newKpi.target !== '' ? parseFloat(newKpi.target) : null,
    }).select().single();
    if (!error && data) setKpis(prev => [...prev, data as Kpi]);
    setAddingFor(null);
    setNewKpi({ name: '', unit: '', higher_is_better: true, target: '' });
  }

  async function deleteKpi(id: string) {
    setKpis(prev => prev.filter(k => k.id !== id));
    await db.from('goal_kpis').delete().eq('id', id).eq('user_id', uid);
  }

  async function addKpiDirect(s: { pillar: string; name: string; unit: string; higher_is_better: boolean }) {
    const { data, error } = await db.from('goal_kpis').insert({
      user_id: uid, pillar: s.pillar, name: s.name, unit: s.unit,
      higher_is_better: s.higher_is_better, sort_order: kpis.filter(k => k.pillar === s.pillar).length,
    }).select().single();
    if (!error && data) {
      setKpis(prev => [...prev, data as Kpi]);
      setSuggestions(prev => prev.filter(sg => sg.name !== s.name));
    }
  }

  async function suggestKpis() {
    setSuggestingKpis(true);
    setSuggestError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vanguard-kpi-suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId: uid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.suggestions) setSuggestions(data.suggestions);
    } catch (e: any) {
      setSuggestError(e.message);
    } finally { setSuggestingKpis(false); }
  }

  async function save() {
    setSaving(true);
    try {
      // Only upsert KPIs not yet auto-saved
      const upserts = kpis
        .filter(k => thisWeek[k.id] !== undefined && thisWeek[k.id] !== '' && !autoSaved.has(k.id))
        .map(k => ({ user_id: uid, kpi_id: k.id, week_start: weekStart, value: parseFloat(thisWeek[k.id]) }));
      if (upserts.length > 0) {
        await db.from('kpi_entries').upsert(upserts, { onConflict: 'kpi_id,week_start' });
      }
      await db.from('weekly_kpi_reviews').upsert({
        user_id: uid, week_start: weekStart,
        what_worked: review.what_worked || null,
        what_didnt_work: review.what_didnt_work || null,
      }, { onConflict: 'user_id,week_start' });
      setSaved(true);
    } finally { setSaving(false); }
  }

  async function generateBrief() {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vanguard-weekly-brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId: uid, weekStart }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Błąd generowania');
      if (data.brief) setBrief(data.brief);
    } catch (e: any) {
      setGenError(e.message);
    } finally { setGenerating(false); }
  }

  // D) Header score: ile KPIs idzie w dobrą stronę
  const kpiScore = useMemo(() => {
    let total = 0, better = 0;
    for (const kpi of kpis) {
      const prev = lastWeek[kpi.id] ?? null;
      const curStr = thisWeek[kpi.id];
      const cur = curStr && curStr !== '' ? parseFloat(curStr) : null;
      if (cur === null || prev === null) continue;
      const delta = cur - prev;
      if (Math.abs(delta) < 0.01) continue;
      total++;
      if (kpi.higher_is_better ? delta > 0 : delta < 0) better++;
    }
    return { total, better };
  }, [kpis, thisWeek, lastWeek]);

  const noKpis = kpis.length === 0;

  const ratingStars = (n: number) =>
    Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < n ? 'text-amber-400' : 'text-text-muted/20'}>★</span>
    ));

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

        {/* D) Score badge */}
        {kpiScore.total > 0 && !setupMode && (
          <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black transition-colors ${
            kpiScore.better === kpiScore.total
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : kpiScore.better > 0
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : 'bg-rose-500/10 text-rose-500'
          }`}>
            {kpiScore.better}/{kpiScore.total} ↑
          </div>
        )}

        <button
          onClick={() => setSetupMode(s => !s)}
          className={`rounded-full p-2 transition-colors cursor-pointer ${setupMode ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text-primary'}`}
          title="Zarządzaj KPIs"
        >
          <Settings size={16} />
        </button>
      </div>

      <div className="px-5 py-5 space-y-6 pb-36">
        {noKpis && !setupMode && (
          <div className="rounded-[24px] border border-dashed border-border-custom p-6 text-center space-y-3">
            <p className="text-[14px] font-bold text-text-primary">Brak zdefiniowanych KPIs</p>
            <p className="text-[12px] text-text-muted">Dodaj mierzalne wskaźniki dla każdego filaru — tygodniowo będziesz widział czy się posuwasz do przodu.</p>
            <button onClick={() => setSetupMode(true)} className="rounded-xl bg-primary px-4 py-2.5 text-[12px] font-bold text-white cursor-pointer">
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
              <div className="flex items-center gap-2">
                <span className={`flex items-center justify-center w-7 h-7 rounded-xl ${pillar.bg} border ${pillar.border}`}>
                  <Icon size={13} className={pillar.text} />
                </span>
                <span className={`text-[11px] font-black uppercase tracking-widest ${pillar.text}`}>{pillar.label}</span>
                <div className="flex-1 border-t border-border-custom/40" />
                {setupMode && (
                  <button
                    onClick={() => { setAddingFor(pillar.id); setNewKpi({ name: '', unit: '', higher_is_better: true, target: '' }); }}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${pillar.chip} cursor-pointer`}
                  >
                    <Plus size={10} /> KPI
                  </button>
                )}
              </div>

              {pillarKpis.length === 0 && !setupMode && (
                <p className="pl-2 text-[11px] italic text-text-muted/40">Brak KPIs — kliknij ⚙ żeby dodać</p>
              )}

              <div className="space-y-2">
                {pillarKpis.map(kpi => {
                  const prev      = lastWeek[kpi.id] ?? null;
                  const curStr    = thisWeek[kpi.id] ?? '';
                  const cur       = curStr !== '' ? parseFloat(curStr) : null;
                  const delta     = cur !== null && prev !== null ? cur - prev : null;
                  const pct       = delta !== null && prev !== null && prev !== 0 ? (delta / Math.abs(prev) * 100) : null;
                  const better    = delta === null ? null : (kpi.higher_is_better ? delta > 0 : delta < 0);
                  const neutral   = delta !== null && Math.abs(delta) < 0.01;
                  const hist      = history[kpi.id] ?? [];
                  const targetPct = kpi.target && kpi.target > 0 && cur !== null
                    ? Math.min(Math.round((cur / kpi.target) * 100), 999)
                    : null;
                  const isSaved   = autoSaved.has(kpi.id);

                  return (
                    <div key={kpi.id} className={`rounded-[20px] border ${pillar.border} ${pillar.bg} px-4 py-3 space-y-2`}>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold text-text-primary flex-1">{kpi.name}</span>
                        {kpi.unit && <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">{kpi.unit}</span>}
                        {/* A) Sparkline */}
                        {!setupMode && hist.length >= 2 && (
                          <Sparkline data={hist} higherIsBetter={kpi.higher_is_better} />
                        )}
                        {setupMode && (
                          <button onClick={() => deleteKpi(kpi.id)} className="p-1 rounded text-text-muted/30 hover:text-rose-500 transition-colors cursor-pointer">
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>

                      {!setupMode && (
                        <>
                          <div className="flex items-center gap-3">
                            <div className="text-center">
                              <p className="text-[8px] font-bold uppercase tracking-widest text-text-muted/60 mb-0.5">poprz.</p>
                              <p className="text-[14px] font-black text-text-muted/50">{prev !== null ? prev : '—'}</p>
                            </div>
                            <div className="text-text-muted/30 text-lg">→</div>
                            <div className="flex-1">
                              <p className="text-[8px] font-bold uppercase tracking-widest text-text-muted/60 mb-0.5">ten tydzień</p>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  value={curStr}
                                  onChange={e => {
                                    setThisWeek(prev => ({ ...prev, [kpi.id]: e.target.value }));
                                    setAutoSaved(s => { const n = new Set(s); n.delete(kpi.id); return n; });
                                  }}
                                  onBlur={e => autoSaveKpi(kpi.id, e.target.value)}
                                  placeholder="wpisz..."
                                  className="w-full bg-transparent text-[18px] font-black text-text-primary outline-none placeholder:text-text-muted/25 placeholder:text-[14px] placeholder:font-medium"
                                />
                                {/* C) Auto-saved tick */}
                                {isSaved && (
                                  <span className="shrink-0 text-[10px] font-black text-emerald-500/60">✓</span>
                                )}
                              </div>
                            </div>
                            {delta !== null && !neutral && (
                              <div className={`flex items-center gap-1 rounded-xl px-2 py-1 text-[10px] font-black ${
                                better ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'
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

                          {/* B) Target progress */}
                          {kpi.target != null && (
                            <div className="space-y-1 pt-0.5">
                              <div className="h-[3px] w-full rounded-full bg-border-custom/30 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${targetPct !== null && targetPct >= 100 ? 'bg-emerald-500' : 'bg-primary/50'}`}
                                  style={{ width: `${Math.min(targetPct ?? 0, 100)}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[8px] text-text-muted/50">cel: {kpi.target}{kpi.unit ? ` ${kpi.unit}` : ''}</span>
                                {targetPct !== null && (
                                  <span className={`text-[8px] font-black ${targetPct >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-text-muted/60'}`}>
                                    {targetPct}%
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}

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
                    <input
                      type="number"
                      inputMode="decimal"
                      value={newKpi.target}
                      onChange={e => setNewKpi(f => ({ ...f, target: e.target.value }))}
                      placeholder="Cel (opcjonalnie, np. 100)"
                      className="w-full bg-transparent text-[12px] text-text-secondary outline-none placeholder:text-text-muted/40 border-b border-border-custom/50 pb-0.5"
                    />
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

        {/* AI suggestions in setup mode */}
        {setupMode && suggestions.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <Sparkles size={12} className="text-primary" />
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">Propozycje AI</p>
            </div>
            {PILLARS.map(pillar => {
              const pSugg = suggestions.filter(s => s.pillar === pillar.id);
              if (!pSugg.length) return null;
              const Icon = pillar.icon;
              return (
                <div key={pillar.id} className="space-y-2">
                  <div className="flex items-center gap-1.5 pl-1">
                    <Icon size={10} className={pillar.text} />
                    <span className={`text-[9px] font-black uppercase tracking-widest ${pillar.text}`}>{pillar.label}</span>
                  </div>
                  {pSugg.map((s: any, i: number) => (
                    <div key={i} className={`rounded-[18px] border ${pillar.border} ${pillar.bg} px-3.5 py-3`}>
                      <div className="flex items-start gap-2.5">
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[12px] font-bold text-text-primary">{s.name}</span>
                            {s.unit && <span className="text-[9px] font-black text-text-muted uppercase">{s.unit}</span>}
                            <span className={`text-[9px] font-black rounded-full px-1.5 py-0.5 ${s.higher_is_better ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-500'}`}>
                              {s.higher_is_better ? '↑ więcej' : '↓ mniej'}
                            </span>
                          </div>
                          <p className="text-[11px] text-text-muted leading-snug">{s.reason}</p>
                        </div>
                        <button
                          onClick={() => addKpiDirect(s)}
                          className={`shrink-0 rounded-xl px-3 py-1.5 text-[10px] font-black ${pillar.chip} cursor-pointer transition-all hover:opacity-80`}
                        >
                          + Dodaj
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Review notes */}
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

        {/* AI Brief */}
        {brief && !setupMode && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-primary" />
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">Analiza Antigravity</p>
            </div>
            <div className="rounded-[24px] border border-primary/15 bg-primary/[0.03] p-4 space-y-4">
              <div className="space-y-3">
                {PILLARS.map(p => {
                  const text = brief[PILLAR_BRIEF_KEYS[p.id]];
                  if (!text) return null;
                  const Icon = p.icon;
                  return (
                    <div key={p.id} className="flex gap-2.5">
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg ${p.bg} border ${p.border}`}>
                        <Icon size={10} className={p.text} />
                      </span>
                      <p className="text-[12.5px] text-text-primary leading-relaxed">{text}</p>
                    </div>
                  );
                })}
              </div>
              {brief.blocker && (
                <div className="rounded-[16px] border border-rose-500/20 bg-rose-500/6 px-3.5 py-3 flex gap-2.5">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5 text-rose-500" />
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-rose-500 mb-0.5">Bloker</p>
                    <p className="text-[12.5px] text-text-primary leading-relaxed">{brief.blocker}</p>
                  </div>
                </div>
              )}
              {brief.recommendation && (
                <div className="rounded-[16px] border border-primary/20 bg-primary/6 px-3.5 py-3 flex gap-2.5">
                  <Target size={13} className="shrink-0 mt-0.5 text-primary" />
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-0.5">Na przyszły tydzień</p>
                    <p className="text-[12.5px] font-semibold text-text-primary leading-relaxed">{brief.recommendation}</p>
                  </div>
                </div>
              )}
              {brief.week_rating && (
                <div className="flex items-center gap-2 pt-1 border-t border-border-custom/40">
                  <div className="flex text-[16px] leading-none">{ratingStars(brief.week_rating)}</div>
                  <span className="text-[11px] font-bold text-text-muted">{brief.week_rating}/5</span>
                  {brief.week_rating_reason && (
                    <span className="text-[11px] text-text-muted ml-1">— {brief.week_rating_reason}</span>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={generateBrief}
              disabled={generating}
              className="flex items-center gap-1.5 text-[10px] font-bold text-text-muted hover:text-primary transition-colors cursor-pointer disabled:opacity-40"
            >
              <Sparkles size={10} />
              {generating ? 'Regeneruję...' : 'Regeneruj analizę'}
            </button>
          </div>
        )}
      </div>

      {/* Sticky bottom — review mode */}
      {!setupMode && !noKpis && (
        <div className="fixed bottom-0 left-0 right-0 px-5 pb-6 pt-3 bg-gradient-to-t from-background via-background/95 to-transparent space-y-2">
          {genError && <p className="text-center text-[11px] text-rose-500">{genError}</p>}
          {saved && !brief && (
            <button
              onClick={generateBrief}
              disabled={generating}
              className="flex w-full items-center justify-center gap-2 rounded-[20px] border border-primary/20 bg-primary/8 py-3.5 text-[13px] font-black text-primary cursor-pointer hover:bg-primary/15 transition-all disabled:opacity-50"
            >
              <Sparkles size={14} className={generating ? 'animate-pulse' : ''} />
              {generating ? 'Antigravity analizuje...' : 'Generuj analizę AI →'}
            </button>
          )}
          <div className="flex gap-2">
            {saved && (
              <button onClick={onBack} className="flex-1 rounded-[20px] border border-border-custom py-4 text-[13px] font-black text-text-muted hover:text-text-primary transition-colors cursor-pointer">
                Gotowe
              </button>
            )}
            <button
              onClick={save}
              disabled={saving || saved}
              className={`flex-1 rounded-[20px] py-4 text-[13px] font-black tracking-wide transition-all cursor-pointer ${
                saved
                  ? 'bg-emerald-500 text-white'
                  : 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-[0.98]'
              } disabled:opacity-60`}
            >
              {saved ? '✓ Zapisano!' : saving ? 'Zapisuję...' : 'Zapisz przegląd tygodnia'}
            </button>
          </div>
          {saved && brief && (
            <button
              onClick={generateBrief}
              disabled={generating}
              className="flex w-full items-center justify-center gap-2 rounded-[20px] border border-primary/20 bg-primary/8 py-3 text-[12px] font-black text-primary cursor-pointer hover:bg-primary/15 transition-all disabled:opacity-50"
            >
              <Sparkles size={12} className={generating ? 'animate-pulse' : ''} />
              {generating ? 'Regeneruję...' : 'Odśwież analizę'}
            </button>
          )}
        </div>
      )}

      {/* Sticky bottom — setup mode */}
      {setupMode && (
        <div className="fixed bottom-0 left-0 right-0 px-5 pb-6 pt-3 bg-gradient-to-t from-background via-background/95 to-transparent space-y-2">
          {suggestError && <p className="text-center text-[11px] text-rose-500 px-2">{suggestError}</p>}
          <button
            onClick={suggestKpis}
            disabled={suggestingKpis}
            className="flex w-full items-center justify-center gap-2 rounded-[20px] border border-primary/20 bg-primary/8 py-3 text-[12px] font-black text-primary cursor-pointer hover:bg-primary/15 transition-all disabled:opacity-50"
          >
            <Sparkles size={12} className={suggestingKpis ? 'animate-pulse' : ''} />
            {suggestingKpis ? 'AI analizuje twoje cele...' : 'Zaproponuj KPI przez AI ✨'}
          </button>
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
