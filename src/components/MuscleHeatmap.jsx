import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { tagsForExercise } from '../data/exercises';

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

// Tags visible on the front vs back panel (for the legend)
const FRONT_TAGS = new Set(FRONT_REGIONS.map(r => r.tag));
const BACK_TAGS  = new Set(BACK_REGIONS.map(r => r.tag));

// Primary cyan color
const C = '#00f2ff';

function Shape({ s, opacity, glow }) {
  const fill   = opacity > 0.04 ? C : 'white';
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
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Silhouette — very faint structural shapes */}
      <circle cx="50" cy="14" r="11" fill="white" fillOpacity="0.04" />
      <rect x="44" y="24" width="12" height="8" rx="3" fill="white" fillOpacity="0.03" />
      <rect x="22" y="31" width="56" height="74" rx="8" fill="white" fillOpacity="0.025" />
      <rect x="7"  y="31" width="13" height="58" rx="6" fill="white" fillOpacity="0.02" />
      <rect x="80" y="31" width="13" height="58" rx="6" fill="white" fillOpacity="0.02" />
      <rect x="27" y="104" width="46" height="6"  rx="3" fill="white" fillOpacity="0.025" />
      <rect x="27" y="108" width="20" height="82" rx="9" fill="white" fillOpacity="0.02" />
      <rect x="53" y="108" width="20" height="82" rx="9" fill="white" fillOpacity="0.02" />

      {/* Muscle regions */}
      {regions.map(({ tag, shapes }) => {
        const raw = intensity[tag] ?? 0;
        const op  = raw > 0 ? 0.12 + raw * 0.58 : 0.04;
        const glow = raw > 0.25;
        return shapes.map((s, i) => (
          <Shape key={`${tag}-${i}`} s={s} opacity={op} glow={glow} />
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

export default function MuscleHeatmap({ session }) {
  const [period, setPeriod]     = useState(30);
  const [intensity, setIntensity] = useState({});   // tag → 0–1
  const [setsByTag, setSetsByTag] = useState({});   // tag → count
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
        if (!cancelled) { setIntensity({}); setSetsByTag({}); setLoading(false); }
        return;
      }

      // 2. Get all logs for those sessions
      const { data: logs } = await supabase
        .from('exercise_logs')
        .select('exercise_name, weight, reps')
        .in('session_id', sessions.map(s => s.id));

      if (cancelled) return;

      // 3. Aggregate sets per muscle tag
      const counts = {};
      for (const log of logs ?? []) {
        const tags = tagsForExercise(log.exercise_name);
        for (const tag of tags) {
          counts[tag] = (counts[tag] ?? 0) + 1;
        }
      }

      // 4. Normalise to 0–1 (max = 1)
      const max = Math.max(...Object.values(counts), 1);
      const norm = {};
      for (const [tag, n] of Object.entries(counts)) norm[tag] = n / max;

      setSetsByTag(counts);
      setIntensity(norm);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [userId, period]);

  // Sorted list for the legend (descending sets)
  const ranked = Object.entries(setsByTag)
    .sort((a, b) => b[1] - a[1])
    .filter(([, n]) => n > 0);

  const maxSets = ranked[0]?.[1] ?? 1;

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-neutral-950/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <div>
          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/35">Mapa mięśni</p>
          <p className="text-xs font-black text-white mt-0.5">Co trenowałeś</p>
        </div>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p.days}
              onClick={() => setPeriod(p.days)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                period === p.days
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'text-white/30 border border-white/[0.08] hover:text-white/60'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-white/20 text-xs">Ładowanie...</div>
      ) : (
        <>
          {/* Front + Back SVG bodies */}
          <div className="grid grid-cols-2 gap-4 px-5 pb-4">
            {[
              { label: 'Przód', regions: FRONT_REGIONS },
              { label: 'Tył',   regions: BACK_REGIONS  },
            ].map(({ label, regions }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <span className="text-[8px] font-black uppercase tracking-[0.18em] text-white/25">{label}</span>
                <div className="w-full" style={{ aspectRatio: '100/194' }}>
                  <BodySVG regions={regions} intensity={intensity} />
                </div>
              </div>
            ))}
          </div>

          {/* Ranked legend */}
          {ranked.length > 0 ? (
            <div className="border-t border-white/[0.06] px-5 py-4 space-y-2">
              {ranked.map(([tag, count]) => (
                <div key={tag} className="flex items-center gap-3">
                  <span className="w-20 text-[10px] font-bold text-white/50 capitalize shrink-0">{tag}</span>
                  <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(count / maxSets) * 100}%`,
                        background: `rgba(0,242,255,${0.3 + (count / maxSets) * 0.5})`,
                        boxShadow: count / maxSets > 0.5 ? `0 0 6px rgba(0,242,255,0.4)` : 'none',
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-black text-white/30 tabular-nums w-12 text-right">
                    {count} ser.
                  </span>
                </div>
              ))}
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
