import Button from '../../ui/Button';
import { ControlInput } from '../../ui/ControlPrimitives';
import { Pencil, X } from 'lucide-react';
import { getTodayWarsaw } from '../../../lib/date';
import { Panel } from '../shell/Panel';
import HexagonChart from './HexagonChart';
import { useHexagonScores, formatSavedAt, DEFAULT_SCORES } from './hooks/useHexagonScores';
import type { HexagonScores } from '../../../lib/hexagonScoresApi';

export type { HexagonScores };

const SPHERES = [
  { key: 'zdrowie', label: 'Zdrowie & Ciało', color: 'accent-success' },
  { key: 'finanse', label: 'Finanse & Konto', color: 'accent-warning' },
  { key: 'kariera', label: 'Kariera & Praca', color: 'accent-primary' },
  { key: 'relacje', label: 'Relacje', color: 'accent-primary' },
  { key: 'rozwoj', label: 'Rozwój Osobisty', color: 'accent-info' },
  { key: 'duchowosc', label: 'Duchowość & Czas dla siebie', color: 'accent-primary' },
] as const;

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
  const {
    savedScores,
    draftScores, setDraftScores,
    savedAt,
    editing,
    saving,
    loading,
    startEdit,
    cancelEdit,
    saveScores,
  } = useHexagonScores(userId, onSaved);

  const displayScores = savedScores ?? DEFAULT_SCORES;
  const chartScores = editing ? draftScores : displayScores;
  const savedLabel = formatSavedAt(savedAt);

  return (
    <Panel title="Heksagon życia — koło sfer (Morita)">
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-3 border-b border-border-custom/60 mb-4">
        <p className="text-xs text-text-muted">
          {savedLabel ? (
            <>Ostatni zapis: <span className="font-bold text-text-secondary">{savedLabel}</span></>
          ) : (
            'Jeszcze nie zapisałeś ocen — to punkt odniesienia na kolejne tygodnie.'
          )}
        </p>
        {!editing && (
          <Button
            variant="tonal"
            size="sm"
            type="button"
            onClick={startEdit}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-1.5 text-xs font-black uppercase tracking-wider text-primary hover:bg-primary/10 transition-all cursor-pointer disabled:opacity-[var(--opacity-40)]"
            icon={<Pencil size={11} />}
          >
            Edytuj
          </Button>
        )}
      </div>

      <div className="grid grid-cols-[var(--ds-arbitrary-1fr-380px)] gap-8 items-center p-2">
        <div className="flex justify-center items-center">
          {loading ? (
            <div className="h-[var(--ds-h-300px)] w-[var(--ds-w-300px)] animate-pulse rounded-full bg-surface border border-border-custom" />
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
                  <ControlInput
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
              <Button
                variant="primary"
                size="lg"
                type="button"
                onClick={() => void saveScores()}
                disabled={saving}
                loading={saving}
                className="flex-1 rounded-xl py-2.5 text-xs font-black uppercase tracking-wider hover:bg-primary-hover active:scale-95 transition-all cursor-pointer"
              >
                {saving ? 'Zapisywanie…' : 'Zapisz'}
              </Button>
              <Button
                variant="outline"
                size="lg"
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-border-custom px-3 py-2.5 text-xs font-black uppercase tracking-wider text-text-muted hover:text-text-primary cursor-pointer"
                icon={<X size={12} />}
              >
                Anuluj
              </Button>
            </div>
          )}

          {editing && (
            <p className="text-2xs text-text-muted leading-relaxed">
              Suwaki nie zapisują się same — dopiero <span className="font-bold">Zapisz</span> ustawia nowy punkt odniesienia ({getTodayWarsaw()}).
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
