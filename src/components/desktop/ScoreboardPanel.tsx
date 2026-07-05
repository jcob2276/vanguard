import { useLifeScoreboard, type SphereScore } from '../../hooks/useLifeScoreboard';
import { Panel } from './Panel';

const AXES = 5;
const R = 84;
const CX = 110;
const CY = 104;

function polar(i: number, r: number) {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / AXES;
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)];
}

function polygonPoints(scores: (number | null)[]) {
  return scores
    .map((s, i) => polar(i, ((s ?? 0) / 100) * R))
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
}

function scoreTone(s: number | null) {
  if (s == null) return 'text-text-muted/40';
  if (s >= 75) return 'text-emerald-500';
  if (s >= 55) return 'text-amber-500';
  return 'text-rose-500';
}

function barTone(s: number | null) {
  if (s == null) return 'bg-border-custom/40';
  if (s >= 75) return 'bg-emerald-500';
  if (s >= 55) return 'bg-amber-500';
  return 'bg-rose-500';
}

function Delta({ cur, prev }: { cur: number | null; prev: number | null }) {
  if (cur == null || prev == null) return null;
  const d = cur - prev;
  if (Math.abs(d) < 2) return <span className="text-[9px] font-bold text-text-muted/40 tabular-nums">→</span>;
  return (
    <span className={`text-[9px] font-black tabular-nums ${d > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
      {d > 0 ? '▲' : '▼'}{Math.abs(Math.round(d))}
    </span>
  );
}

function SphereRow({ s }: { s: SphereScore }) {
  return (
    <div className="py-2 border-b border-border-custom/20 last:border-0 rounded-lg px-1.5 -mx-1.5 hover:bg-surface-solid/40 transition-all duration-150">
      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-[10px] font-black uppercase tracking-wider text-text-secondary">{s.label}</span>
        <div className="flex-1 h-[4px] rounded-full bg-surface-solid overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${barTone(s.score)}`} style={{ width: `${s.score ?? 0}%` }} />
        </div>
        <span className={`w-8 text-right text-[13px] font-black tabular-nums ${scoreTone(s.score)}`}>
          {s.score ?? '—'}
        </span>
        <span className="w-7 text-right"><Delta cur={s.score} prev={s.prev} /></span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 pl-[88px]">
        {s.subs.map(sub => (
          <span key={sub.label} className="text-[9px] text-text-muted/60">
            {sub.label}: <span className={`font-bold ${scoreTone(sub.score)}`}>{sub.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ScoreboardPanel({ userId }: { userId: string | undefined }) {
  const { data, loading } = useLifeScoreboard(userId);

  if (loading || !data) {
    return (
      <Panel title="Scoreboard tygodnia">
        <div className="h-[220px] animate-pulse rounded-xl bg-surface-solid/40" />
      </Panel>
    );
  }

  const { spheres, lifeScore, lifeScorePrev } = data;

  return (
    <Panel title="Scoreboard tygodnia — ostatnie 7 dni vs poprzednie">
      <div className="flex flex-col lg:flex-row gap-6 items-center">
        {/* Radar + Life Score */}
        <div className="shrink-0 relative">
          <svg width={220} height={208} viewBox="0 0 220 208">
            {[0.25, 0.5, 0.75, 1].map(f => (
              <polygon
                key={f}
                points={Array.from({ length: AXES }, (_, i) => polar(i, R * f).map(n => n.toFixed(1)).join(',')).join(' ')}
                fill="none"
                stroke="var(--color-border-custom, #33333322)"
                strokeWidth={0.7}
                opacity={0.5}
              />
            ))}
            {Array.from({ length: AXES }, (_, i) => {
              const [x, y] = polar(i, R);
              return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke="var(--color-border-custom, #33333322)" strokeWidth={0.7} opacity={0.4} />;
            })}
            {/* poprzedni tydzień — duch */}
            <polygon points={polygonPoints(spheres.map(s => s.prev))} fill="none" stroke="currentColor" strokeDasharray="3 3" strokeWidth={1} className="text-text-muted/40" />
            {/* bieżący tydzień */}
            <polygon points={polygonPoints(spheres.map(s => s.score))} fill="rgba(99,102,241,0.18)" stroke="rgb(99,102,241)" strokeWidth={1.5} />
            {spheres.map((s, i) => {
              const [x, y] = polar(i, R + 14);
              return (
                <text key={s.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-current text-text-muted" style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {s.label}
                </text>
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingBottom: 8 }}>
            <span className={`text-[30px] font-black leading-none tabular-nums ${scoreTone(lifeScore)}`}>{lifeScore ?? '—'}</span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted/60">Life Score</span>
              <Delta cur={lifeScore} prev={lifeScorePrev} />
            </div>
          </div>
        </div>

        {/* Sfery */}
        <div className="flex-1 w-full min-w-0">
          {spheres.map(s => <SphereRow key={s.key} s={s} />)}
        </div>
      </div>
    </Panel>
  );
}
