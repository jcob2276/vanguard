import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MUSCLE_TAGS, TAG_SET_WEIGHTS, tagsForExercise } from '../data/exercises';

// ─── SVG body region definitions ──────────────────────────────────────────────
// viewBox="0 0 100 194"  (front and back use same coordinate space)

const FRONT_REGIONS = [
  { tag: 'barki', shapes: [
    { t: 'ellipse', cx: 20, cy: 42, rx: 12, ry: 9 },
    { t: 'ellipse', cx: 80, cy: 42, rx: 12, ry: 9 },
  ]},
  { tag: 'klatka', shapes: [
    { t: 'rect', x: 29, y: 32, w: 42, h: 26, r: 5 },
  ]},
  { tag: 'biceps', shapes: [
    { t: 'rect', x: 9,  y: 32, w: 11, h: 32, r: 5 },
    { t: 'rect', x: 80, y: 32, w: 11, h: 32, r: 5 },
  ]},
  { tag: 'przedramiona', shapes: [
    { t: 'rect', x: 6,  y: 65, w: 11, h: 24, r: 4 },
    { t: 'rect', x: 83, y: 65, w: 11, h: 24, r: 4 },
  ]},
  { tag: 'brzuch', shapes: [
    { t: 'rect', x: 31, y: 59, w: 38, h: 40, r: 4 },
  ]},
  { tag: 'czworogłowe', shapes: [
    { t: 'rect', x: 29, y: 106, w: 16, h: 48, r: 8 },
    { t: 'rect', x: 55, y: 106, w: 16, h: 48, r: 8 },
  ]},
  { tag: 'łydki', shapes: [
    { t: 'rect', x: 30, y: 157, w: 14, h: 32, r: 7 },
    { t: 'rect', x: 56, y: 157, w: 14, h: 32, r: 7 },
  ]},
];

const BACK_REGIONS = [
  { tag: 'barki', shapes: [
    { t: 'ellipse', cx: 20, cy: 42, rx: 12, ry: 9 },
    { t: 'ellipse', cx: 80, cy: 42, rx: 12, ry: 9 },
  ]},
  { tag: 'plecy', shapes: [
    { t: 'rect', x: 24, y: 32, w: 52, h: 54, r: 5 },
  ]},
  { tag: 'triceps', shapes: [
    { t: 'rect', x: 9,  y: 32, w: 11, h: 32, r: 5 },
    { t: 'rect', x: 80, y: 32, w: 11, h: 32, r: 5 },
  ]},
  { tag: 'pośladki', shapes: [
    { t: 'rect', x: 29, y: 106, w: 16, h: 18, r: 8 },
    { t: 'rect', x: 55, y: 106, w: 16, h: 18, r: 8 },
  ]},
  { tag: 'dwugłowe ud', shapes: [
    { t: 'rect', x: 29, y: 126, w: 16, h: 32, r: 8 },
    { t: 'rect', x: 55, y: 126, w: 16, h: 32, r: 8 },
  ]},
  { tag: 'łydki', shapes: [
    { t: 'rect', x: 30, y: 161, w: 14, h: 28, r: 7 },
    { t: 'rect', x: 56, y: 161, w: 14, h: 28, r: 7 },
  ]},
];

const HEAT_COLORS = {
  klatka: '#24b7ff',
  plecy: '#12d6c8',
  barki: '#21e7ff',
  biceps: '#7cc8ff',
  triceps: '#13cfe8',
  brzuch: '#2de0b8',
  czworogłowe: '#7ee56d',
  'dwugłowe ud': '#a8d66d',
  pośladki: '#32d99a',
  łydki: '#26d3c8',
  przedramiona: '#7ce0ff',
};

const fallbackHeat = '#00f2ff';

function Shape({ s, opacity, glow, color }) {
  const fill   = opacity > 0.04 ? color : 'white';
  const filter = glow ? 'url(#mglow)' : undefined;
  if (s.t === 'ellipse')
    return <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={fill} fillOpacity={opacity} filter={filter} />;
  return <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} fill={fill} fillOpacity={opacity} filter={filter} />;
}

function BodySVG({ regions, intensity }) {
  return (
    <svg viewBox="0 0 100 194" className="w-full h-full">
      <defs>
        <filter id="mglow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="bodyFade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.055" />
          <stop offset="100%" stopColor="white" stopOpacity="0.018" />
        </linearGradient>
      </defs>

      {/* Silhouette — very faint structural shapes */}
      <circle cx="50" cy="14" r="10.5" fill="url(#bodyFade)" />
      <rect x="44" y="24" width="12" height="8" rx="3" fill="white" fillOpacity="0.035" />
      <rect x="22" y="31" width="56" height="72" rx="10" fill="url(#bodyFade)" />
      <rect x="7"  y="32" width="13" height="56" rx="7" fill="white" fillOpacity="0.026" />
      <rect x="80" y="32" width="13" height="56" rx="7" fill="white" fillOpacity="0.026" />
      <rect x="27" y="104" width="46" height="6"  rx="3" fill="white" fillOpacity="0.03" />
      <rect x="28" y="108" width="19" height="82" rx="10" fill="url(#bodyFade)" />
      <rect x="53" y="108" width="19" height="82" rx="10" fill="url(#bodyFade)" />

      {/* Muscle regions */}
      {regions.map(({ tag, shapes }) => {
        const raw = intensity[tag] ?? 0;
        const op  = raw > 0 ? 0.16 + raw * 0.52 : 0.035;
        const glow = raw > 0.18;
        const color = HEAT_COLORS[tag] ?? fallbackHeat;
        return shapes.map((s, i) => (
          <Shape key={`${tag}-${i}`} s={s} opacity={op} glow={glow} color={color} />
        ));
      })}
    </svg>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

const PERIODS = [
  { label: '7d',  days: 7  },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

function tagsForLog(log) {
  if (Array.isArray(log.muscle_tags) && log.muscle_tags.length > 0) {
    return log.muscle_tags;
  }
  return tagsForExercise(log.exercise_name);
}

function tagColor(tag) {
  return HEAT_COLORS[tag] ?? fallbackHeat;
}

export default function MuscleHeatmap({ session }) {
  const [period, setPeriod]     = useState(30);
  const [intensity, setIntensity] = useState({});   // tag → 0–1
  const [setsByTag, setSetsByTag] = useState({});   // tag → count
  const [loadByTag, setLoadByTag] = useState({});    // tag → weighted stimulus
  const [loading, setLoading]   = useState(true);
  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const since = new Date(Date.now() - period * 86_400_000).toISOString();

      // 1. Get sessions in window
      const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('id')
        .eq('user_id', userId)
        .gte('start_time', since);

      if (!sessions?.length) {
        if (!cancelled) { setIntensity({}); setSetsByTag({}); setLoadByTag({}); setLoading(false); }
        return;
      }

      // 2. Get all logs for those sessions
      let { data: logs, error: logsError } = await supabase
        .from('exercise_logs')
        .select('exercise_name, weight, reps, muscle_tags')
        .in('session_id', sessions.map(s => s.id));

      if (logsError?.message?.includes('muscle_tags')) {
        const fallback = await supabase
          .from('exercise_logs')
          .select('exercise_name, weight, reps')
          .in('session_id', sessions.map(s => s.id));
        logs = fallback.data;
        logsError = fallback.error;
      }

      if (logsError) {
        console.error('[MuscleHeatmap] logs query failed', logsError);
      }

      if (cancelled) return;

      // 3. Aggregate sets per muscle tag
      const counts = {};
      const weighted = {};
      for (const log of logs ?? []) {
        const tags = tagsForLog(log).filter(tag => MUSCLE_TAGS.includes(tag));
        for (const [idx, tag] of tags.entries()) {
          counts[tag] = (counts[tag] ?? 0) + 1;
          weighted[tag] = (weighted[tag] ?? 0) + (TAG_SET_WEIGHTS[idx] ?? 0.2);
        }
      }

      // 4. Normalise to 0–1 (max = 1)
      const max = Math.max(...Object.values(weighted), 1);
      const norm = {};
      for (const [tag, n] of Object.entries(weighted)) norm[tag] = n / max;

      setSetsByTag(counts);
      setLoadByTag(weighted);
      setIntensity(norm);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [userId, period]);

  // Sorted list for the legend (descending sets)
  const ranked = Object.entries(loadByTag)
    .sort((a, b) => b[1] - a[1])
    .filter(([, n]) => n > 0);

  const maxLoad = ranked[0]?.[1] ?? 1;
  const trainedTags = new Set(Object.keys(setsByTag));
  const neglected = MUSCLE_TAGS.filter(tag => !trainedTags.has(tag)).slice(0, 4);
  const topTag = ranked[0]?.[0] ?? null;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[radial-gradient(circle_at_50%_8%,rgba(34,211,238,0.08),transparent_34%),linear-gradient(180deg,rgba(18,18,18,0.86),rgba(4,4,4,0.96))] shadow-2xl shadow-black/40">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[8px] font-black uppercase tracking-[0.22em] text-white/35">Mapa mięśni</p>
            <p className="mt-0.5 text-sm font-black text-white">Co trenowałeś</p>
          </div>
          <div className="flex shrink-0 gap-1">
            {PERIODS.map(p => (
              <button
                key={p.days}
                onClick={() => setPeriod(p.days)}
                className={`h-9 min-w-12 rounded-xl border px-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                  period === p.days
                    ? 'border-sky-400/40 bg-sky-400/15 text-sky-300 shadow-[0_0_18px_rgba(56,189,248,0.16)]'
                    : 'border-white/[0.08] bg-black/20 text-white/28 hover:text-white/60'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {!loading && (
          <div className="mt-4 flex flex-wrap gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.035] px-3 py-2">
              <span
                className="h-2 w-2 rounded-full shadow-[0_0_10px_currentColor]"
                style={{ color: topTag ? tagColor(topTag) : 'rgba(255,255,255,0.3)', backgroundColor: 'currentColor' }}
              />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/32">Top</span>
              <span className="text-[11px] font-black capitalize text-white/75">{topTag ?? 'brak'}</span>
            </div>
            {neglected.length > 0 && (
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/28">Braki</span>
                <span className="truncate text-[11px] font-bold capitalize text-white/45">{neglected.join(', ')}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-white/20 text-xs">Ładowanie...</div>
      ) : (
        <>
          {/* Front + Back SVG bodies */}
          <div className="relative grid grid-cols-2 gap-5 px-5 pb-5 pt-1">
            <div className="pointer-events-none absolute inset-x-7 bottom-4 top-7 rounded-2xl border border-white/[0.035] bg-black/10" />
            {[
              { label: 'Przód', regions: FRONT_REGIONS },
              { label: 'Tył',   regions: BACK_REGIONS  },
            ].map(({ label, regions }) => (
              <div key={label} className="relative flex flex-col items-center gap-2">
                <span className="text-[8px] font-black uppercase tracking-[0.18em] text-white/25">{label}</span>
                <div className="w-full max-w-[132px]" style={{ aspectRatio: '100/194' }}>
                  <BodySVG regions={regions} intensity={intensity} />
                </div>
              </div>
            ))}
          </div>

          {/* Ranked legend */}
          {ranked.length > 0 ? (
            <div className="space-y-2.5 border-t border-white/[0.06] bg-black/20 px-5 py-4">
              {ranked.map(([tag, count]) => (
                <div key={tag} className="grid grid-cols-[86px_1fr_44px] items-center gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-[10px] font-black capitalize text-white/58">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: tagColor(tag), boxShadow: `0 0 8px ${tagColor(tag)}` }}
                    />
                    <span className="truncate">{tag}</span>
                  </span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.055]">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(count / maxLoad) * 100}%`,
                        background: `linear-gradient(90deg, ${tagColor(tag)}, rgba(255,255,255,0.82))`,
                        boxShadow: count / maxLoad > 0.5 ? `0 0 8px ${tagColor(tag)}80` : 'none',
                      }}
                    />
                  </div>
                  <span className="text-right text-[10px] font-black tabular-nums text-white/35">
                    {setsByTag[tag] ?? 0} ser.
                  </span>
                </div>
              ))}
              {neglected.length > 0 && (
                <div className="flex flex-wrap gap-1.5 border-t border-white/[0.05] pt-3">
                  <span className="mr-1 text-[9px] font-black uppercase tracking-widest text-white/24">Bez bodźca</span>
                  {neglected.map(tag => (
                    <span key={tag} className="rounded-md border border-white/[0.07] bg-white/[0.025] px-2 py-0.5 text-[9px] font-black capitalize text-white/34">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="border-t border-white/[0.06] px-5 py-6 text-center text-xs text-white/20">
              Brak danych treningowych w tym okresie
            </div>
          )}
        </>
      )}
    </div>
  );
}
