import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getTodayWarsaw } from '../../lib/date';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { Panel, Tip } from './Panel';
import { C } from './desktopUtils';

const READINESS_COLOR: Record<string, string> = {
  primed: '#10b981',
  balanced: '#38bdf8',
  strained: '#f59e0b',
  rundown: '#f43f5e',
  insufficient: '#6b7280',
};

const FRICTION_COLOR: Record<string, string> = {
  sleep_disruption: '#f59e0b',
  avoidance: '#f43f5e',
  procrastination: '#fb923c',
  habit_break: '#a78bfa',
  training_drop: '#60a5fa',
  social_hesitation: '#34d399',
  emotional_spike: '#f472b6',
  positive_micro_action: '#10b981',
  other: '#9ca3af',
};

function ZBadge({ z }: { z: number | null | undefined }) {
  if (z == null) return <span className="text-text-muted text-[10px]">–</span>;
  const color = z >= 1 ? 'text-emerald-400' : z >= -1 ? 'text-sky-400' : z >= -2 ? 'text-amber-400' : 'text-rose-400';
  return <span className={`font-mono font-bold text-[11px] ${color}`}>{z >= 0 ? '+' : ''}{z.toFixed(2)}σ</span>;
}

function ScoreBar({ value, max = 100, color = '#38bdf8' }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="h-1.5 w-full rounded-full bg-surface-solid overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

export default function GeneralView({ userId }: { userId: string }) {
  const [strain, setStrain] = useState<any[]>([]);
  const [oura, setOura] = useState<any[]>([]);
  const [patterns, setPatterns] = useState<any[]>([]);
  const [wiki, setWiki] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [curiosity, setCuriosity] = useState<any[]>([]);
  const [friction, setFriction] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const today = getTodayWarsaw();
    const d90 = new Date(today + 'T12:00:00Z');
    d90.setUTCDate(d90.getUTCDate() - 89);
    const since90 = d90.toISOString().slice(0, 10);

    Promise.all([
      supabase.from('daily_strain').select('date, recovery_score, strain_score, readiness_level, components')
        .eq('user_id', userId).gte('date', since90).order('date', { ascending: true }),
      supabase.from('oura_daily_summary').select('date, hrv_avg, rhr_avg, total_sleep_hours, sleep_score, readiness_score, activity_score')
        .eq('user_id', userId).gte('date', since90).order('date', { ascending: true }),
      supabase.from('vanguard_behavioral_patterns').select('pattern_type, title, evidence_text, occurrence_count, confidence, status, last_seen')
        .eq('user_id', userId).in('status', ['active', 'candidate']).order('confidence', { ascending: false }).limit(20),
      supabase.from('vanguard_wiki_pages').select('title, page_type, status, confidence, summary, tags, last_seen_at')
        .eq('user_id', userId).in('status', ['active', 'needs_review']).order('last_seen_at', { ascending: false }).limit(30),
      supabase.from('vanguard_entity_links').select('source_entity, relation, target_entity, fact_text, confidence_score, evidence_count, temporal_status, last_seen')
        .eq('user_id', userId).eq('status', 'active').order('evidence_count', { ascending: false }).limit(40),
      supabase.from('vanguard_curiosity_queue').select('hypothesis, provocation, confidence_score, category, evidence_count, created_at')
        .eq('user_id', userId).eq('status', 'pending').order('confidence_score', { ascending: false }).limit(15),
      supabase.from('confirmed_friction_events').select('occurred_at, friction_type, actual_behavior, immediate_cost, deviation, confidence')
        .eq('user_id', userId).gte('occurred_at', since90 + 'T00:00:00Z').order('occurred_at', { ascending: true }),
    ]).then(([s, o, p, w, l, c, f]) => {
      setStrain(s.data || []);
      setOura(o.data || []);
      setPatterns(p.data || []);
      setWiki(w.data || []);
      setLinks(l.data || []);
      setCuriosity(c.data || []);
      setFriction(f.data || []);
      setLoading(false);
    });
  }, [userId]);

  if (loading) return (
    <div className="grid grid-cols-3 gap-5">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-48 animate-pulse rounded-[20px] bg-surface border border-border-custom" />
      ))}
    </div>
  );

  // Merge strain + oura by date
  const ouraMap = Object.fromEntries(oura.map(r => [r.date, r]));
  const timelineData = strain.map(s => {
    const o = ouraMap[s.date] || {};
    const comp = (s.components as any) || {};
    return {
      d: s.date.slice(5),
      recovery: s.recovery_score,
      strain: s.strain_score,
      readiness: s.readiness_level,
      hrv: o.hrv_avg,
      rhr: o.rhr_avg,
      sleepH: o.total_sleep_hours,
      sleepScore: o.sleep_score,
      hrv_z: comp.hrv_z,
      rhr_z: comp.rhr_z,
      sleep_z: comp.sleep_z,
      ouraReadiness: o.readiness_score,
    };
  });

  // Friction by type — last 90d counts
  const frictionCounts: Record<string, number> = {};
  friction.forEach(f => {
    const t = f.friction_type || 'other';
    frictionCounts[t] = (frictionCounts[t] || 0) + 1;
  });
  const frictionBar = Object.entries(frictionCounts)
    .map(([type, count]) => ({ type: type.replace(/_/g, ' '), count, color: FRICTION_COLOR[type] || '#9ca3af' }))
    .sort((a, b) => b.count - a.count);

  // Correlation: sleep → next-day HRV
  const sleepHrvCorr = oura.slice(0, -1).map((r, i) => ({
    sleep: r.total_sleep_hours,
    hrvNext: oura[i + 1]?.hrv_avg,
  })).filter(r => r.sleep && r.hrvNext);

  // Readiness distribution
  const readinessCounts: Record<string, number> = {};
  strain.forEach(s => {
    const l = s.readiness_level || 'insufficient';
    readinessCounts[l] = (readinessCounts[l] || 0) + 1;
  });

  const tick = 'var(--color-text-muted)';

  return (
    <div className="space-y-5">

      {/* ── SEKCJA: ZDROWIE ── */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border-custom" />
        <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Zdrowie — 90 dni</span>
        <div className="h-px flex-1 bg-border-custom" />
      </div>

      {/* Recovery + Strain timeline */}
      <Panel title="Recovery & Strain — 90 dni">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={timelineData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gRecovery" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.emerald} stopOpacity={0.3} />
                <stop offset="95%" stopColor={C.emerald} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gStrain" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.rose} stopOpacity={0.2} />
                <stop offset="95%" stopColor={C.rose} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-custom)" />
            <XAxis dataKey="d" tick={{ fontSize: 9, fill: tick }} interval={6} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: tick }} />
            <Tooltip content={<Tip />} />
            <ReferenceLine y={70} stroke={C.emerald} strokeDasharray="4 4" strokeOpacity={0.4} />
            <ReferenceLine y={40} stroke={C.rose} strokeDasharray="4 4" strokeOpacity={0.4} />
            <Area type="monotone" dataKey="recovery" stroke={C.emerald} fill="url(#gRecovery)" strokeWidth={2} dot={false} connectNulls />
            <Area type="monotone" dataKey="strain" stroke={C.rose} fill="url(#gStrain)" strokeWidth={1.5} dot={false} connectNulls />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 text-[10px] text-text-muted">
          <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />Recovery</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1" />Strain</span>
          <span className="ml-auto opacity-60">linia: 70 (dobry recovery) / 40 (niski)</span>
        </div>
      </Panel>

      <div className="grid grid-cols-3 gap-5">
        {/* VitalBands z-scores */}
        <Panel title="VitalBands z-scores — 90 dni">
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={timelineData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-custom)" />
              <XAxis dataKey="d" tick={{ fontSize: 9, fill: tick }} interval={9} />
              <YAxis domain={[-3, 3]} tick={{ fontSize: 9, fill: tick }} />
              <Tooltip content={<Tip />} />
              <ReferenceLine y={0} stroke="var(--color-text-muted)" strokeOpacity={0.3} />
              <ReferenceLine y={1} stroke={C.emerald} strokeDasharray="3 3" strokeOpacity={0.4} />
              <ReferenceLine y={-1} stroke={C.amber} strokeDasharray="3 3" strokeOpacity={0.4} />
              <ReferenceLine y={-2} stroke={C.rose} strokeDasharray="3 3" strokeOpacity={0.4} />
              <Line type="monotone" dataKey="hrv_z" stroke={C.emerald} strokeWidth={1.5} dot={false} connectNulls name="HRV z" />
              <Line type="monotone" dataKey="rhr_z" stroke={C.indigo} strokeWidth={1.5} dot={false} connectNulls name="RHR z" />
              <Line type="monotone" dataKey="sleep_z" stroke={C.sky} strokeWidth={1.5} dot={false} connectNulls name="Sleep z" />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-3 mt-1 text-[10px] text-text-muted">
            <span><span className="text-emerald-400">●</span> HRV z</span>
            <span><span className="text-indigo-400">●</span> RHR z</span>
            <span><span className="text-sky-400">●</span> Sleep z</span>
          </div>
        </Panel>

        {/* Sleep score */}
        <Panel title="Sleep Score — 90 dni">
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={oura.map(r => ({ d: r.date.slice(5), sleepScore: r.sleep_score }))} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gSleep" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.indigo} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={C.indigo} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-custom)" />
              <XAxis dataKey="d" tick={{ fontSize: 9, fill: tick }} interval={9} />
              <YAxis domain={[40, 100]} tick={{ fontSize: 9, fill: tick }} />
              <Tooltip content={<Tip />} />
              <ReferenceLine y={80} stroke={C.emerald} strokeDasharray="4 4" strokeOpacity={0.4} />
              <Area type="monotone" dataKey="sleepScore" stroke={C.indigo} fill="url(#gSleep)" strokeWidth={2} dot={false} connectNulls name="Sleep score" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        {/* Readiness distribution */}
        <Panel title="Readiness — rozkład">
          <div className="space-y-2.5 mt-2">
            {(['primed', 'balanced', 'strained', 'rundown', 'insufficient'] as const).map(level => {
              const count = readinessCounts[level] || 0;
              const total = strain.length || 1;
              const pct = Math.round((count / total) * 100);
              const labels: Record<string, string> = {
                primed: '⚡ Gotowy', balanced: '✓ Zbalansowany', strained: '⚠ Zmęczony',
                rundown: '↓ Wyczerpany', insufficient: '– Brak danych',
              };
              return (
                <div key={level}>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-text-secondary" style={{ color: READINESS_COLOR[level] }}>{labels[level]}</span>
                    <span className="text-text-muted">{count}d · {pct}%</span>
                  </div>
                  <ScoreBar value={pct} color={READINESS_COLOR[level]} />
                </div>
              );
            })}
          </div>
          <p className="text-[9px] text-text-muted mt-3">Łącznie: {strain.length} dni z danymi</p>
        </Panel>
      </div>

      {/* Korelacja: sen → HRV następnego dnia */}
      <div className="grid grid-cols-2 gap-5">
        <Panel title="Korelacja: długość snu → HRV następnego dnia">
          <ResponsiveContainer width="100%" height={200}>
            <ScatterChart margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-custom)" />
              <XAxis dataKey="sleep" name="Sen (h)" tick={{ fontSize: 9, fill: tick }} domain={[4, 10]} label={{ value: 'Sen (h)', position: 'insideBottom', offset: -2, fontSize: 9, fill: tick }} />
              <YAxis dataKey="hrvNext" name="HRV next" tick={{ fontSize: 9, fill: tick }} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<Tip />} />
              <Scatter data={sleepHrvCorr} fill={C.emerald} fillOpacity={0.6} />
            </ScatterChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-text-muted mt-1">Każdy punkt = jeden dzień. Więcej snu → wyższe HRV jutro?</p>
        </Panel>

        {/* HRV raw */}
        <Panel title="HRV & RHR — 90 dni">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={timelineData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-custom)" />
              <XAxis dataKey="d" tick={{ fontSize: 9, fill: tick }} interval={9} />
              <YAxis yAxisId="l" tick={{ fontSize: 9, fill: tick }} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 9, fill: tick }} />
              <Tooltip content={<Tip />} />
              <Line yAxisId="l" type="monotone" dataKey="hrv" stroke={C.emerald} strokeWidth={2} dot={false} connectNulls name="HRV" />
              <Line yAxisId="r" type="monotone" dataKey="rhr" stroke={C.rose} strokeWidth={2} dot={false} connectNulls name="RHR" />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-1 text-[10px] text-text-muted">
            <span><span className="text-emerald-400">●</span> HRV (L)</span>
            <span><span className="text-rose-400">●</span> RHR (R)</span>
          </div>
        </Panel>
      </div>

      {/* ── SEKCJA: TARCIA ── */}
      <div className="flex items-center gap-3 mt-2">
        <div className="h-px flex-1 bg-border-custom" />
        <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Tarcia — 90 dni ({friction.length} zdarzeń)</span>
        <div className="h-px flex-1 bg-border-custom" />
      </div>

      <div className="grid grid-cols-3 gap-5">
        <Panel title="Tarcia wg typu">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={frictionBar} margin={{ top: 4, right: 4, left: -20, bottom: 20 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-custom)" />
              <XAxis type="number" tick={{ fontSize: 9, fill: tick }} />
              <YAxis type="category" dataKey="type" tick={{ fontSize: 8, fill: tick }} width={90} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {frictionBar.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <div className="lg:col-span-2">
          <Panel title="Ostatnie tarcia">
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {friction.slice(-20).reverse().map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-[10px] py-1 border-b border-border-custom/40 last:border-0">
                  <span className="shrink-0 font-mono text-text-muted">{f.occurred_at?.slice(5, 10)}</span>
                  <span className="font-bold px-1.5 py-0.5 rounded text-[9px] shrink-0" style={{ backgroundColor: (FRICTION_COLOR[f.friction_type] || '#9ca3af') + '22', color: FRICTION_COLOR[f.friction_type] || '#9ca3af' }}>
                    {(f.friction_type || 'other').replace(/_/g, ' ')}
                  </span>
                  <span className="text-text-secondary truncate">{f.actual_behavior || f.immediate_cost || '–'}</span>
                </div>
              ))}
              {friction.length === 0 && <p className="text-text-muted text-[10px] py-2">Brak danych</p>}
            </div>
          </Panel>
        </div>
      </div>

      {/* ── SEKCJA: MEMEX ── */}
      <div className="flex items-center gap-3 mt-2">
        <div className="h-px flex-1 bg-border-custom" />
        <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Memex — Pamięć systemu</span>
        <div className="h-px flex-1 bg-border-custom" />
      </div>

      {/* Patterns + Curiosity */}
      <div className="grid grid-cols-2 gap-5">
        <Panel title={`Wzorce zachowań (${patterns.length})`}>
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {patterns.map((p, i) => (
              <div key={i} className="rounded-xl border border-border-custom bg-surface-solid/40 p-2.5">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-[11px] font-bold text-text-primary leading-tight">{p.title || p.pattern_type}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${p.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                    {p.status}
                  </span>
                </div>
                <div className="flex gap-3 text-[9px] text-text-muted">
                  <span>n={p.occurrence_count}</span>
                  <span>conf={Math.round((p.confidence || 0) * 100)}%</span>
                  <span className="ml-auto">{p.last_seen?.slice(0, 10)}</span>
                </div>
                <ScoreBar value={(p.confidence || 0) * 100} color={C.emerald} />
              </div>
            ))}
            {patterns.length === 0 && <p className="text-text-muted text-[10px] py-2">Brak wzorców — potrzeba więcej danych</p>}
          </div>
        </Panel>

        <Panel title={`Hipotezy do zbadania (${curiosity.length})`}>
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {curiosity.map((c, i) => (
              <div key={i} className="rounded-xl border border-border-custom bg-surface-solid/40 p-2.5">
                <p className="text-[10px] text-text-secondary leading-relaxed mb-1.5">{c.hypothesis}</p>
                {c.provocation && (
                  <p className="text-[9px] text-primary italic">→ {c.provocation}</p>
                )}
                <div className="flex gap-3 text-[9px] text-text-muted mt-1">
                  <span className="px-1.5 py-0.5 rounded bg-surface-solid text-[8px]">{c.category}</span>
                  <span>n={c.evidence_count}</span>
                  <span>conf={Math.round((c.confidence_score || 0) * 100)}%</span>
                </div>
              </div>
            ))}
            {curiosity.length === 0 && <p className="text-text-muted text-[10px] py-2">Brak hipotez — system generuje je stopniowo</p>}
          </div>
        </Panel>
      </div>

      {/* Wiki */}
      <Panel title={`Wiki — strony pamięci (${wiki.length})`}>
        <div className="grid grid-cols-3 gap-2 max-h-[260px] overflow-y-auto">
          {wiki.map((w, i) => (
            <div key={i} className="rounded-xl border border-border-custom bg-surface-solid/40 p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${w.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className="text-[10px] font-bold text-text-primary truncate">{w.title}</span>
              </div>
              <div className="flex gap-2 text-[9px] text-text-muted">
                <span className="px-1 py-0.5 rounded bg-surface-solid text-[8px]">{w.page_type}</span>
                <span>{Math.round((w.confidence || 0) * 100)}%</span>
              </div>
              {w.summary && <p className="text-[9px] text-text-muted mt-1 leading-relaxed line-clamp-2">{w.summary}</p>}
            </div>
          ))}
          {wiki.length === 0 && <p className="text-text-muted text-[10px] py-2 col-span-3">Brak stron wiki</p>}
        </div>
      </Panel>

      {/* Entity links */}
      <Panel title={`Graf wiedzy — relacje (${links.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-text-muted border-b border-border-custom">
                <th className="text-left pb-2 pr-3 font-medium">Podmiot A</th>
                <th className="text-left pb-2 pr-3 font-medium">Relacja</th>
                <th className="text-left pb-2 pr-3 font-medium">Podmiot B</th>
                <th className="text-left pb-2 pr-3 font-medium">Fakt</th>
                <th className="text-right pb-2 font-medium">n/conf</th>
              </tr>
            </thead>
            <tbody>
              {links.slice(0, 25).map((l, i) => (
                <tr key={i} className="border-b border-border-custom/40 last:border-0">
                  <td className="py-1.5 pr-3 font-bold text-text-primary">{l.source_entity}</td>
                  <td className="pr-3 text-primary italic">{l.relation}</td>
                  <td className="pr-3 text-text-secondary">{l.target_entity}</td>
                  <td className="pr-3 text-text-muted max-w-[200px] truncate">{l.fact_text}</td>
                  <td className="text-right text-text-muted whitespace-nowrap">
                    {l.evidence_count} · <ZBadge z={null} />
                    <span className="ml-1">{Math.round((l.confidence_score || 0) * 100)}%</span>
                  </td>
                </tr>
              ))}
              {links.length === 0 && (
                <tr><td colSpan={5} className="text-text-muted py-3">Brak relacji w grafie</td></tr>
              )}
            </tbody>
          </table>
          {links.length > 25 && <p className="text-[9px] text-text-muted mt-2">+{links.length - 25} więcej relacji</p>}
        </div>
      </Panel>

    </div>
  );
}
