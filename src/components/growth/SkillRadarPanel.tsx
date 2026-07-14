import { useMemo } from 'react';
import type { LearningSkill } from '../../lib/growth/growth';
import { SCORE_LABELS, SCORE_RUBRICS } from '../../lib/growth/growth';
import { Card } from '../ui/Card';

const CHART_SIZE = 280;
const CENTER = CHART_SIZE / 2;
const RADIUS = 105;

function polar(index: number, total: number, val: number) {
  const angle = index * ((2 * Math.PI) / total) - Math.PI / 2;
  const r = (val / 5) * RADIUS;
  return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle), angle };
}

export default function SkillRadarPanel({
  skills,
  scores,
  prevScores,
  showPrev,
  editing,
  draftScores,
  onDraftChange,
  grid,
}: {
  skills: LearningSkill[];
  scores: Record<string, number>;
  prevScores: Record<string, number> | null;
  showPrev: boolean;
  editing: boolean;
  draftScores: Record<string, number>;
  onDraftChange: (key: string, val: number) => void;
  grid: string;
}) {
  const display = editing ? draftScores : scores;
  const n = skills.length;

  const polygon = useMemo(() => {
    if (n === 0) return '';
    return skills
      .map((s, i) => {
        const p = polar(i, n, display[s.key] ?? 0);
        return `${p.x},${p.y}`;
      })
      .join(' ');
  }, [skills, display, n]);

  const prevPolygon = useMemo(() => {
    if (!showPrev || !prevScores || n === 0) return '';
    return skills
      .map((s, i) => {
        const p = polar(i, n, prevScores[s.key] ?? 0);
        return `${p.x},${p.y}`;
      })
      .join(' ');
  }, [skills, prevScores, showPrev, n]);

  if (n === 0) {
    return (
      <Card variant="glass" padding="2rem" className="text-center text-sm text-text-muted">
        Dodaj skilli, żeby zobaczyć radar.
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6 items-start">
      <div className="flex justify-center overflow-visible">
        <svg width={CHART_SIZE} height={CHART_SIZE} className="overflow-visible">
          {[1, 2, 3, 4, 5].map((k) => {
            const points = Array.from({ length: n }, (_, i) => {
              const p = polar(i, n, k);
              return `${p.x},${p.y}`;
            }).join(' ');
            return (
              <polygon
                key={k}
                points={points}
                fill="none"
                stroke={grid}
                strokeWidth="1"
                strokeDasharray={k === 5 ? 'none' : '2,3'}
              />
            );
          })}
          {Array.from({ length: n }, (_, i) => {
            const p = polar(i, n, 5);
            return (
              <line
                key={i}
                x1={CENTER}
                y1={CENTER}
                x2={CENTER + RADIUS * Math.cos(p.angle)}
                y2={CENTER + RADIUS * Math.sin(p.angle)}
                stroke={grid}
                strokeWidth="1"
              />
            );
          })}
          {showPrev && prevPolygon && (
            <polygon
              points={prevPolygon}
              fill="rgba(148, 163, 184, 0.12)"
              stroke="rgba(148, 163, 184, 0.5)"
              strokeWidth="1.5"
              strokeDasharray="4,3"
            />
          )}
          <polygon
            points={polygon}
            fill="rgba(79, 70, 229, 0.18)"
            stroke="rgba(79, 70, 229, 0.85)"
            strokeWidth="2"
          />
          {skills.map((s, i) => {
            const p = polar(i, n, display[s.key] ?? 0);
            return <circle key={s.id} cx={p.x} cy={p.y} r="4" fill="rgb(79, 70, 229)" />;
          })}
          {skills.map((s, i) => {
            const p = polar(i, n, 5.8);
            const lx = CENTER + (RADIUS + 14) * Math.cos(p.angle);
            const ly = CENTER + (RADIUS + 14) * Math.sin(p.angle);
            const short = s.label.length > 14 ? `${s.label.slice(0, 12)}…` : s.label;
            return (
              <text
                key={`lbl-${s.id}`}
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-2xs font-bold fill-text-secondary"
              >
                {short}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
        {skills.map((s) => {
          const val = display[s.key] ?? 0;
          const prev = prevScores?.[s.key];
          const delta = prev != null && showPrev ? val - prev : null;
          return (
            <div key={s.id} className="space-y-1">
              <div className="flex justify-between items-center gap-2 text-xs">
                <span className="font-bold text-text-primary truncate">{s.label}</span>
                <span className="shrink-0 font-black text-primary">
                  {val}/5
                  {delta != null && delta !== 0 && (
                    <span className={`ml-1 text-2xs ${delta > 0 ? 'text-success' : 'text-danger'}`}>
                      {delta > 0 ? `+${delta}` : delta}
                    </span>
                  )}
                </span>
              </div>
              {editing ? (
                <input
                  type="range"
                  min={0}
                  max={5}
                  value={val}
                  onChange={(e) => onDraftChange(s.key, parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-border-custom rounded-lg appearance-none cursor-pointer accent-primary"
                />
              ) : (
                <div className="h-1.5 rounded-full bg-border-custom overflow-hidden">
                  <div className="h-full bg-primary/70 rounded-full transition-all" style={{ width: `${(val / 5) * 100}%` }} />
                </div>
              )}
              <p className="text-2xs text-text-muted leading-snug">
                {SCORE_RUBRICS[val] ?? SCORE_LABELS[val] ?? ''}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
