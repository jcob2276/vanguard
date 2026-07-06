import { useCallback, useEffect, useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getTodayWarsaw } from '../../lib/date';
import { notify } from '../../lib/notify';
import { Panel } from './Panel';

export interface HexagonScores {
  zdrowie: number;
  finanse: number;
  kariera: number;
  relacje: number;
  rozwoj: number;
  duchowosc: number;
}

const DEFAULT_SCORES: HexagonScores = {
  zdrowie: 5,
  finanse: 5,
  kariera: 5,
  relacje: 5,
  rozwoj: 5,
  duchowosc: 5,
};

const SPHERES = [
  { key: 'zdrowie', label: 'Zdrowie & Ciało', color: 'accent-emerald-500' },
  { key: 'finanse', label: 'Finanse & Konto', color: 'accent-amber-500' },
  { key: 'kariera', label: 'Kariera & Praca', color: 'accent-indigo-500' },
  { key: 'relacje', label: 'Relacje', color: 'accent-pink-500' },
  { key: 'rozwoj', label: 'Rozwój Osobisty', color: 'accent-sky-500' },
  { key: 'duchowosc', label: 'Duchowość & Czas dla siebie', color: 'accent-violet-500' },
] as const;

const CHART_LABELS = [
  { label: 'Zdrowie & Ciało', xOffset: 0, yOffset: -15, align: 'middle' },
  { label: 'Finanse & Konto', xOffset: 12, yOffset: 5, align: 'start' },
  { label: 'Kariera & Praca', xOffset: 12, yOffset: 5, align: 'start' },
  { label: 'Relacje', xOffset: 0, yOffset: 15, align: 'middle' },
  { label: 'Rozwój Osobisty', xOffset: -12, yOffset: 5, align: 'end' },
  { label: 'Duchowość & Ja', xOffset: -12, yOffset: 5, align: 'end' },
];

const SCORE_KEYS = ['zdrowie', 'finanse', 'kariera', 'relacje', 'rozwoj', 'duchowosc'] as const;

function normalizeScores(raw: Partial<HexagonScores> | null | undefined): HexagonScores {
  return {
    zdrowie: raw?.zdrowie ?? 5,
    finanse: raw?.finanse ?? 5,
    kariera: raw?.kariera ?? 5,
    relacje: raw?.relacje ?? 5,
    rozwoj: raw?.rozwoj ?? 5,
    duchowosc: raw?.duchowosc ?? 5,
  };
}

function parseStoredPref(value: string): { scores: HexagonScores; savedAt: string | null } {
  const parsed = JSON.parse(value) as Record<string, unknown>;
  if (parsed.scores && typeof parsed.scores === 'object') {
    return {
      scores: normalizeScores(parsed.scores as Partial<HexagonScores>),
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : null,
    };
  }
  return { scores: normalizeScores(parsed as Partial<HexagonScores>), savedAt: null };
}

function formatSavedAt(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Warsaw',
  });
}

function HexagonChart({ scores, theme, grid }: { scores: HexagonScores; theme: string; grid: string }) {
  return (
    <svg width={300} height={300} className="overflow-visible">
      {[2, 4, 6, 8, 10].map((k) => {
        const points = [0, 1, 2, 3, 4, 5]
          .map((index) => {
            const angle = index * (2 * Math.PI / 6) - Math.PI / 2;
            const val = k / 10;
            return `${150 + 110 * val * Math.cos(angle)},${150 + 110 * val * Math.sin(angle)}`;
          })
          .join(' ');
        return (
          <polygon
            key={k}
            points={points}
            fill="none"
            stroke={grid}
            strokeWidth="1"
            strokeDasharray={k === 10 ? 'none' : '2,3'}
          />
        );
      })}

      {[0, 1, 2, 3, 4, 5].map((index) => {
        const angle = index * (2 * Math.PI / 6) - Math.PI / 2;
        const x = 150 + 110 * Math.cos(angle);
        const y = 150 + 110 * Math.sin(angle);
        return <line key={index} x1={150} y1={150} x2={x} y2={y} stroke={grid} strokeWidth="1" />;
      })}

      <polygon
        points={SCORE_KEYS.map((key, index) => {
          const angle = index * (2 * Math.PI / 6) - Math.PI / 2;
          const val = (scores[key] || 5) / 10;
          return `${150 + 110 * val * Math.cos(angle)},${150 + 110 * val * Math.sin(angle)}`;
        }).join(' ')}
        fill="rgba(79, 70, 229, 0.2)"
        stroke="rgba(79, 70, 229, 0.85)"
        strokeWidth="2"
      />

      {SCORE_KEYS.map((key, index) => {
        const angle = index * (2 * Math.PI / 6) - Math.PI / 2;
        const val = (scores[key] || 5) / 10;
        const x = 150 + 110 * val * Math.cos(angle);
        const y = 150 + 110 * val * Math.sin(angle);
        return (
          <circle
            key={key}
            cx={x}
            cy={y}
            r="4"
            fill="rgb(79, 70, 229)"
            stroke={theme === 'dark' ? '#000' : '#fff'}
            strokeWidth="1.5"
          />
        );
      })}

      {CHART_LABELS.map((lbl, index) => {
        const angle = index * (2 * Math.PI / 6) - Math.PI / 2;
        const x = 150 + 120 * Math.cos(angle) + lbl.xOffset;
        const y = 150 + 120 * Math.sin(angle) + lbl.yOffset;
        return (
          <text
            key={lbl.label}
            x={x}
            y={y}
            textAnchor={lbl.align as 'start' | 'middle' | 'end'}
            className="text-[9px] font-black uppercase tracking-wider fill-text-primary"
          >
            {lbl.label}
          </text>
        );
      })}
    </svg>
  );
}

export default function HexagonPanel({
  userId,
  theme,
  grid,
  onSaved,
}: {
  userId: string;
  theme: string;
  grid: string;
  onSaved?: () => void;
}) {
  const [savedScores, setSavedScores] = useState<HexagonScores | null>(null);
  const [draftScores, setDraftScores] = useState<HexagonScores>(DEFAULT_SCORES);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const displayScores = savedScores ?? DEFAULT_SCORES;
  const chartScores = editing ? draftScores : displayScores;

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vanguard_preferences')
        .select('value, updated_at')
        .eq('user_id', userId)
        .eq('key', 'morning_hexagon_scores')
        .maybeSingle();

      if (error) throw error;

      if (data?.value) {
        try {
          const parsed = parseStoredPref(data.value);
          setSavedScores(parsed.scores);
          setDraftScores(parsed.scores);
          setSavedAt(parsed.savedAt || data.updated_at || null);
        } catch {
          setSavedScores(null);
          setDraftScores(DEFAULT_SCORES);
          setSavedAt(null);
        }
      } else {
        setSavedScores(null);
        setDraftScores(DEFAULT_SCORES);
        setSavedAt(null);
      }
    } catch (err: unknown) {
      console.error('[Action Error]', err);
      notify(err instanceof Error ? err.message : 'Wystąpił błąd', 'error');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = () => {
    setDraftScores(savedScores ?? DEFAULT_SCORES);
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraftScores(savedScores ?? DEFAULT_SCORES);
    setEditing(false);
  };

  const saveScores = async () => {
    if (!userId || saving) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const payload = { scores: draftScores, savedAt: now };
      const { error: prefErr } = await supabase
        .from('vanguard_preferences')
        .upsert(
          {
            user_id: userId,
            key: 'morning_hexagon_scores',
            value: JSON.stringify(payload),
            updated_at: now,
          },
          { onConflict: 'user_id,key' },
        );
      if (prefErr) throw prefErr;

      const streamText = `[Heksagon] Zaktualizowano ocenę sfer życia: Zdrowie & Ciało: ${draftScores.zdrowie}/10, Finanse: ${draftScores.finanse}/10, Kariera & Praca: ${draftScores.kariera}/10, Relacje: ${draftScores.relacje}/10, Rozwój: ${draftScores.rozwoj}/10, Duchowość & Czas dla siebie: ${draftScores.duchowosc}/10.`;
      const { error: streamErr } = await supabase.from('vanguard_stream').insert({
        user_id: userId,
        content: streamText,
        source: 'hexagon',
        category: 'productivity',
        classification: 'hexagon_update',
      });
      if (streamErr) throw streamErr;

      setSavedScores(draftScores);
      setSavedAt(now);
      setEditing(false);
      notify('Zapisano oceny sfer życia', 'success');
      onSaved?.();
    } catch (err: unknown) {
      console.error('[HexagonPanel] save failed', err);
      notify('Błąd zapisu ocen', 'error');
    } finally {
      setSaving(false);
    }
  };

  const savedLabel = formatSavedAt(savedAt);

  return (
    <Panel title="Heksagon życia — koło sfer (Morita)">
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-3 border-b border-border-custom/60 mb-4">
        <p className="text-[10px] text-text-muted">
          {savedLabel ? (
            <>Ostatni zapis: <span className="font-bold text-text-secondary">{savedLabel}</span></>
          ) : (
            'Jeszcze nie zapisałeś ocen — to punkt odniesienia na kolejne tygodnie.'
          )}
        </p>
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-primary hover:bg-primary/10 transition-all cursor-pointer disabled:opacity-40"
          >
            <Pencil size={11} /> Edytuj
          </button>
        )}
      </div>

      <div className="grid grid-cols-[1fr_380px] gap-8 items-center p-2">
        <div className="flex justify-center items-center">
          {loading ? (
            <div className="h-[300px] w-[300px] animate-pulse rounded-full bg-surface border border-border-custom" />
          ) : (
            <HexagonChart scores={chartScores} theme={theme} grid={grid} />
          )}
        </div>

        <div className="space-y-3.5">
          {SPHERES.map((item) => {
            const val = (editing ? draftScores : displayScores)[item.key as keyof HexagonScores] || 5;
            return (
              <div key={item.key} className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-text-primary">{item.label}</span>
                  <span className="font-black text-primary font-display">{val}/10</span>
                </div>
                {editing ? (
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={val}
                    onChange={(e) => {
                      const next = parseInt(e.target.value, 10);
                      setDraftScores((prev) => ({ ...prev, [item.key]: next }));
                    }}
                    className={`w-full h-1 bg-border-custom rounded-lg appearance-none cursor-pointer ${item.color}`}
                  />
                ) : (
                  <div className="h-1 rounded-full bg-border-custom overflow-hidden">
                    <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${val * 10}%` }} />
                  </div>
                )}
              </div>
            );
          })}

          {editing && (
            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => void saveScores()}
                disabled={saving}
                className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-primary-hover active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Zapisywanie…' : 'Zapisz'}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-border-custom px-3 py-2.5 text-xs font-black uppercase tracking-wider text-text-muted hover:text-text-primary cursor-pointer disabled:opacity-50"
              >
                <X size={12} /> Anuluj
              </button>
            </div>
          )}

          {editing && (
            <p className="text-[9px] text-text-muted leading-relaxed">
              Suwaki nie zapisują się same — dopiero <span className="font-bold">Zapisz</span> ustawia nowy punkt odniesienia ({getTodayWarsaw()}).
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
