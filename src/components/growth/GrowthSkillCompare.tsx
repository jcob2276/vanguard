import { useMemo } from 'react';
import type { LearningSkill, LearningSkillSnapshot } from '../../lib/growth';
import {
  computeScoreDeltas,
  formatSnapshotDate,
  scoresFromSnapshot,
} from '../../lib/growth';

export default function GrowthSkillCompare({
  skills,
  snapshots,
  compareFromId,
  compareToId,
  onCompareFromChange,
  onCompareToChange,
}: {
  skills: LearningSkill[];
  snapshots: LearningSkillSnapshot[];
  compareFromId: string;
  compareToId: string;
  onCompareFromChange: (id: string) => void;
  onCompareToChange: (id: string) => void;
}) {
  const snapA = snapshots.find((s) => s.id === compareFromId) ?? snapshots[1] ?? snapshots[0];
  const snapB = snapshots.find((s) => s.id === compareToId) ?? snapshots[0];

  const scoresA = useMemo(() => scoresFromSnapshot(skills, snapA ?? null), [skills, snapA]);
  const scoresB = useMemo(() => scoresFromSnapshot(skills, snapB ?? null), [skills, snapB]);
  const deltas = useMemo(() => computeScoreDeltas(skills, scoresA, scoresB), [skills, scoresA, scoresB]);

  if (snapshots.length < 2) {
    return (
      <div className="rounded-xl border border-dashed border-border-custom p-4 text-center">
        <p className="text-[11px] text-text-muted">
          Porównanie wymaga co najmniej 2 snapshotów ocen. Zapisz oceny w różnych dniach.
        </p>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-border-custom p-4 space-y-3">
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted">Compare snapshotów</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-[9px] font-bold text-text-muted uppercase">Od</span>
          <select
            value={snapA?.id ?? ''}
            onChange={(e) => onCompareFromChange(e.target.value)}
            className="w-full rounded-lg border border-border-custom bg-surface-solid px-2 py-1.5 text-[11px]"
          >
            {snapshots.map((s) => (
              <option key={s.id} value={s.id}>
                {formatSnapshotDate(s.snapshot_date)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[9px] font-bold text-text-muted uppercase">Do</span>
          <select
            value={snapB?.id ?? ''}
            onChange={(e) => onCompareToChange(e.target.value)}
            className="w-full rounded-lg border border-border-custom bg-surface-solid px-2 py-1.5 text-[11px]"
          >
            {snapshots.map((s) => (
              <option key={s.id} value={s.id}>
                {formatSnapshotDate(s.snapshot_date)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {deltas.length === 0 ? (
        <p className="text-[11px] text-text-muted text-center py-2">Brak zmian między snapshotami.</p>
      ) : (
        <ul className="space-y-1.5 max-h-40 overflow-y-auto">
          {deltas.map((d) => (
            <li
              key={d.key}
              className="flex items-center justify-between gap-2 rounded-lg bg-surface/50 px-2.5 py-1.5 text-[11px]"
            >
              <span className="font-bold text-text-primary truncate">{d.label}</span>
              <span className="shrink-0 tabular-nums">
                {d.from}→{d.to}{' '}
                <span className={d.delta > 0 ? 'text-emerald-600 font-black' : 'text-rose-500 font-black'}>
                  {d.delta > 0 ? `+${d.delta}` : d.delta}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
