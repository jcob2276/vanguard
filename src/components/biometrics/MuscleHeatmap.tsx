import { useState, useEffect, useMemo, useCallback } from 'react';
import Model from 'react-body-highlighter';
import type { IMuscleStats, Muscle } from 'react-body-highlighter';
import { supabase } from '../../lib/supabase';
import { getTodayWarsaw } from '../../lib/date';
import { notify } from '../../lib/notify';
import { unwrapList } from '../../lib/supabaseUtils';
import { MUSCLE_TAGS, rirEffectiveness, stimulusForExercise, tagsForExercise } from '../../data/exercises';
import { BODY_BASE, HEAT_SCALE, RB_MUSCLE_TO_TAGS, buildHighlighterData } from '../../lib/muscleMapData';

const PERIODS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

const TAG_COLORS: Record<string, string> = {
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

function tagsForLog(log: { muscle_tags?: string[] | null; exercise_name?: string | null }) {
  if (Array.isArray(log.muscle_tags) && log.muscle_tags.length > 0) {
    return log.muscle_tags;
  }
  return tagsForExercise(log.exercise_name ?? '');
}

function tagColor(tag: string) {
  return TAG_COLORS[tag] ?? '#22d3ee';
}

function BodyModel({
  view,
  loadByTag,
  onMuscleClick,
}: {
  view: 'anterior' | 'posterior';
  loadByTag: Record<string, number>;
  onMuscleClick: (stats: IMuscleStats) => void;
}) {
  const data = useMemo(() => buildHighlighterData(loadByTag, view), [loadByTag, view]);

  return (
    <Model
      type={view}
      data={data}
      bodyColor={BODY_BASE}
      highlightedColors={[...HEAT_SCALE]}
      onClick={onMuscleClick}
      style={{ width: '100%', padding: '0.5rem 0.25rem 0' }}
      svgStyle={{ display: 'block', overflow: 'visible' }}
    />
  );
}

export default function MuscleHeatmap({ session }: { session: { user?: { id?: string } } | null }) {
  const [period, setPeriod] = useState(30);
  const [setsByTag, setSetsByTag] = useState<Record<string, number>>({});
  const [directByTag, setDirectByTag] = useState<Record<string, number>>({});
  const [indirectByTag, setIndirectByTag] = useState<Record<string, number>>({});
  const [loadByTag, setLoadByTag] = useState<Record<string, number>>({});
  const [exercisesByTag, setExercisesByTag] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    const dateLimit = (() => {
      const d = new Date(getTodayWarsaw() + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() - period);
      return d.toISOString().split('T')[0];
    })();

    const fetchLogs = async () => {
      try {
        const exerciseLogs = unwrapList(await supabase
          .from('exercise_logs')
          .select('*, workout_sessions!inner(date)')
          .eq('user_id', userId)
          .gte('workout_sessions.date', dateLimit));

        const directSets: Record<string, number> = {};
        const indirectSets: Record<string, number> = {};
        const effectiveSets: Record<string, number> = {};
        const exerciseSets: Record<string, Set<string>> = {};
        MUSCLE_TAGS.forEach((t) => {
          directSets[t] = 0;
          indirectSets[t] = 0;
          effectiveSets[t] = 0;
          exerciseSets[t] = new Set();
        });

        exerciseLogs.forEach((log) => {
          const tags = tagsForLog(log);
          const stimulus = stimulusForExercise(log.exercise_name, tags);
          const exerciseName = (log.exercise_name || 'Ćwiczenie').trim();
          const effectiveness = rirEffectiveness(log.rir);

          Object.entries(stimulus as Record<string, { direct?: number; indirect?: number }>).forEach(([tag, value]) => {
            if (effectiveSets[tag] === undefined) return;
            const direct = Number(value.direct || 0) * effectiveness;
            const indirect = Number(value.indirect || 0) * effectiveness;
            if (direct + indirect <= 0) return;
            directSets[tag] += direct;
            indirectSets[tag] += indirect;
            effectiveSets[tag] += direct + indirect;
            exerciseSets[tag].add(exerciseName);
          });
        });

        setSetsByTag(effectiveSets);
        setDirectByTag(directSets);
        setIndirectByTag(indirectSets);
        setLoadByTag(effectiveSets);
        setExercisesByTag(
          Object.fromEntries(
            Object.entries(exerciseSets).map(([tag, names]) => [tag, [...names].sort()]),
          ),
        );
      } catch (err) {
        console.error('Heatmap fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    void fetchLogs();
  }, [userId, period]);

  const ranked = Object.entries(loadByTag)
    .sort((a, b) => b[1] - a[1])
    .filter(([, n]) => n > 0);

  const maxLoad = ranked[0]?.[1] ?? 1;
  const trainedTags = new Set(Object.entries(setsByTag).filter(([, n]) => n > 0).map(([tag]) => tag));
  const neglected = MUSCLE_TAGS.filter((tag) => !trainedTags.has(tag)).slice(0, 4);
  const topTag = ranked[0]?.[0] ?? null;
  const formatSetCount = (count: number) => (Number.isInteger(count) ? count : count.toFixed(1));

  const handleMuscleClick = useCallback(({ muscle, data }: IMuscleStats) => {
    const tags = RB_MUSCLE_TO_TAGS[muscle as Muscle] ?? [];
    const load = tags.reduce((sum: number, tag: string) => sum + (loadByTag[tag] ?? 0), 0);
    const names = [...new Set(tags.flatMap((tag: string) => exercisesByTag[tag] ?? []))];

    if (load <= 0 && data.frequency <= 0) {
      notify('Brak bodźca w tym okresie.', 'info');
      return;
    }

    const tagLabel = tags.length ? tags.join(' / ') : muscle;
    const exerciseLine = names.length ? names.slice(0, 4).join(' · ') : '—';
    notify(`${tagLabel}: ${load.toFixed(1)} eff · ${exerciseLine}`, 'info');
  }, [exercisesByTag, loadByTag]);

  return (
    <div className="overflow-hidden rounded-[24px] border border-border-custom bg-surface backdrop-blur-md shadow-sm">
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-text-muted font-display">Mapa mięśni</p>
            <h2 className="mt-1 font-display text-[18px] font-black tracking-tight text-text-primary">Co trenowałeś</h2>
          </div>
          <div className="flex shrink-0 gap-1">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                onClick={() => setPeriod(p.days)}
                className={`h-9 min-w-12 rounded-xl border px-3 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                  period === p.days
                    ? 'border-sky-400/40 bg-sky-400/15 text-sky-600 dark:text-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.1)]'
                    : 'border-border-custom bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-solid'
                }`}
              >
                {p.label.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {!loading && (
          <div className="mt-4 flex flex-wrap gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-border-custom bg-surface px-3 py-2 shadow-sm">
              <span
                className="h-2 w-2 rounded-full shadow-[0_0_10px_currentColor]"
                style={{ color: topTag ? tagColor(topTag) : 'rgba(150,150,150,0.3)', backgroundColor: 'currentColor' }}
              />
              <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Top</span>
              <span className="text-[11px] font-black capitalize text-text-primary">{topTag ?? 'brak'}</span>
            </div>
            {neglected.length > 0 && (
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border-custom bg-surface px-3 py-2 shadow-sm">
                <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Zaniedbane</span>
                <span className="truncate text-[11px] font-bold capitalize text-text-secondary">{neglected.join(', ')}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex h-56 items-center justify-center text-xs text-text-muted animate-pulse">Ładowanie...</div>
      ) : (
        <>
          <div className="relative grid grid-cols-2 gap-4 px-5 pb-4 pt-1">
            <div className="pointer-events-none absolute inset-x-5 bottom-3 top-2 rounded-2xl border border-border-custom bg-text-primary/[0.015]" />
            {([
              { label: 'Przód', view: 'anterior' as const },
              { label: 'Tył', view: 'posterior' as const },
            ]).map(({ label, view }) => (
              <div key={view} className="relative flex flex-col items-center gap-2">
                <span className="text-[8px] font-black uppercase tracking-[0.18em] text-text-muted">{label}</span>
                <div className="muscle-map-model w-full max-w-[168px]">
                  <BodyModel view={view} loadByTag={loadByTag} onMuscleClick={handleMuscleClick} />
                </div>
              </div>
            ))}
          </div>

          {ranked.length > 0 ? (
            <div className="space-y-3 border-t border-border-custom bg-text-primary/[0.01] px-5 py-4">
              {ranked.map(([tag, count]) => (
                <div key={tag} className="grid grid-cols-[90px_1fr_72px] items-center gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-[11px] font-black capitalize text-text-secondary">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: tagColor(tag), boxShadow: `0 0 8px ${tagColor(tag)}` }}
                    />
                    <span className="truncate">{tag}</span>
                  </span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-text-primary/10">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(count / maxLoad) * 100}%`,
                        background: `linear-gradient(90deg, ${tagColor(tag)}, rgba(255,255,255,0.82))`,
                        boxShadow: count / maxLoad > 0.5 ? `0 0 8px ${tagColor(tag)}80` : 'none',
                      }}
                    />
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-black tabular-nums text-text-secondary">
                      {formatSetCount(setsByTag[tag] ?? 0)} eff
                    </div>
                    <div className="text-[9px] font-bold tabular-nums text-text-muted/70">
                      {formatSetCount(directByTag[tag] ?? 0)}b · {formatSetCount(indirectByTag[tag] ?? 0)}p
                    </div>
                  </div>
                </div>
              ))}
              {neglected.length > 0 && (
                <div className="flex flex-wrap gap-1.5 border-t border-border-custom pt-3">
                  <span className="mr-1 text-[9px] font-black uppercase tracking-widest text-text-muted">Bez bodźca</span>
                  {neglected.map((tag) => (
                    <span key={tag} className="rounded-lg border border-border-custom bg-surface px-2 py-1 text-[10px] font-bold capitalize text-text-secondary shadow-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="border-t border-border-custom px-5 py-6 text-center text-xs text-text-muted">
              Brak danych treningowych w tym okresie
            </div>
          )}
        </>
      )}
    </div>
  );
}
