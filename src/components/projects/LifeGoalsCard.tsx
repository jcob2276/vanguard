import { useEffect, useState } from 'react';
import { Pencil, X, Star } from 'lucide-react';
import Button from '../ui/Button';
import { Card } from '../ui/Card';
import { PILLAR_META, PILLARS, type PillarId } from './projectUtils';
import { saveLifeGoalDeclarations } from '../../lib/goal/goalSpine.mutations';
import type { LifeGoalDeclarations } from '../../lib/goal/goalSpine.types';
import { notify } from '../../lib/notify';

interface Props {
  userId: string;
  lifeGoals: LifeGoalDeclarations | null;
}

type Draft = {
  goal_cialo: string;
  goal_duch: string;
  goal_konto: string;
  date_cialo: string;
  date_duch: string;
  date_konto: string;
  bhag_pillar: PillarId | null;
};

function draftFrom(lifeGoals: LifeGoalDeclarations | null): Draft {
  return {
    goal_cialo: lifeGoals?.goal_cialo ?? '',
    goal_duch: lifeGoals?.goal_duch ?? '',
    goal_konto: lifeGoals?.goal_konto ?? '',
    date_cialo: lifeGoals?.date_cialo ?? '',
    date_duch: lifeGoals?.date_duch ?? '',
    date_konto: lifeGoals?.date_konto ?? '',
    bhag_pillar: (lifeGoals?.bhag_pillar as PillarId | null) ?? null,
  };
}

function getGoalByPillar(lifeGoals: LifeGoalDeclarations | null, pillar: PillarId): string | null {
  if (!lifeGoals) return null;
  if (pillar === 'cialo') return lifeGoals.goal_cialo;
  if (pillar === 'duch') return lifeGoals.goal_duch;
  if (pillar === 'konto') return lifeGoals.goal_konto;
  return null;
}

function getDateByPillar(lifeGoals: LifeGoalDeclarations | null, pillar: PillarId): string | null {
  if (!lifeGoals) return null;
  if (pillar === 'cialo') return lifeGoals.date_cialo;
  if (pillar === 'duch') return lifeGoals.date_duch;
  if (pillar === 'konto') return lifeGoals.date_konto;
  return null;
}

/**
 * Editable "Cele Roczne" (yearly BHAG per pillar) — this is the missing write
 * path the goal-spine "Następny krok" nudge points to. Read-only display
 * doubles as the empty-state CTA, since previously there was nowhere in the
 * app to actually fill these in.
 */
export default function LifeGoalsCard({ userId, lifeGoals }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(lifeGoals));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) void (async () => { setDraft(draftFrom(lifeGoals)); })();
  }, [lifeGoals, editing]);

  const hasAnyGoal = PILLARS.some((p) => getGoalByPillar(lifeGoals, p)?.trim());

  const startEdit = () => {
    setDraft(draftFrom(lifeGoals));
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveLifeGoalDeclarations(userId, {
        goal_cialo: draft.goal_cialo.trim() || null,
        goal_duch: draft.goal_duch.trim() || null,
        goal_konto: draft.goal_konto.trim() || null,
        date_cialo: draft.date_cialo || null,
        date_duch: draft.date_duch || null,
        date_konto: draft.date_konto || null,
        bhag_pillar: draft.bhag_pillar,
      } as LifeGoalDeclarations);
      notify('Zapisano cele roczne', 'success');
      setEditing(false);
    } catch (err: unknown) {
      console.error('[LifeGoalsCard] save failed', err);
      notify('Błąd zapisu celów rocznych', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card variant="glass" padding="1.25rem" className="space-y-3.5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-[10px] font-black uppercase tracking-wider text-text-muted">
          <Star size={12} className="text-primary" /> Cele Roczne (BHAG)
        </h3>
        {!editing && (
          <Button
            variant="tonal"
            size="sm"
            onClick={startEdit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-primary hover:bg-primary/10 transition-all cursor-pointer"
            icon={<Pencil size={11} />}
          >
            {hasAnyGoal ? 'Edytuj' : 'Uzupełnij'}
          </Button>
        )}
      </div>

      {!editing ? (
        hasAnyGoal ? (
          <div className="space-y-2.5">
            {PILLARS.map((p) => {
              const goal = getGoalByPillar(lifeGoals, p);
              const date = getDateByPillar(lifeGoals, p);
              if (!goal) return null;
              const meta = PILLAR_META[p];
              const Icon = meta.icon;
              const isBhag = lifeGoals?.bhag_pillar === p;
              return (
                <div key={p} className={`rounded-2xl border p-3 ${isBhag ? meta.border : 'border-border-custom/50'} ${isBhag ? meta.bg : 'bg-surface-solid/20'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider ${meta.text}`}>
                      <Icon size={12} /> {meta.label}
                      {isBhag && <span className="rounded px-1 py-0.5 text-[8px] bg-primary/15 text-primary">BHAG</span>}
                    </span>
                    {date && <span className="text-[9px] font-bold text-text-muted">do {date}</span>}
                  </div>
                  <p className="text-[12px] font-semibold text-text-primary leading-snug">{goal}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[12px] text-text-muted py-2">
            Brak celów rocznych — bez nich sprint i tydzień nie mają kotwicy. Kliknij "Uzupełnij".
          </p>
        )
      ) : (
        <div className="space-y-3">
          {PILLARS.map((p) => {
            const meta = PILLAR_META[p];
            const Icon = meta.icon;
            return (
              <div key={p} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider ${meta.text}`}>
                    <Icon size={12} /> {meta.label}
                  </span>
                  <button
                    onClick={() => setDraft((d) => ({ ...d, bhag_pillar: d.bhag_pillar === p ? null : p }))}
                    className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider transition-colors ${
                      draft.bhag_pillar === p ? 'bg-primary text-white' : 'bg-border-custom/20 text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <Star size={9} /> BHAG
                  </button>
                </div>
                <textarea
                  value={draft[`goal_${p}` as const]}
                  onChange={(e) => setDraft((d) => ({ ...d, [`goal_${p}`]: e.target.value }))}
                  placeholder={`Twój roczny cel — ${meta.label.toLowerCase()}...`}
                  rows={2}
                  className="w-full rounded-xl border border-border-custom bg-surface-solid/40 px-3 py-2 text-[12px] text-text-primary outline-none focus:border-primary/40 placeholder:text-text-muted/40 resize-none"
                />
                <input
                  type="date"
                  value={draft[`date_${p}` as const]}
                  onChange={(e) => setDraft((d) => ({ ...d, [`date_${p}`]: e.target.value }))}
                  className="rounded-xl border border-border-custom bg-surface-solid/40 px-2.5 py-1.5 text-[11px] text-text-primary outline-none focus:border-primary/40 [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
            );
          })}

          <div className="flex gap-2 pt-1">
            <Button
              variant="primary"
              size="lg"
              onClick={save}
              disabled={saving}
              loading={saving}
              className="flex-1 rounded-xl py-2.5 text-[12px] font-black uppercase tracking-wider hover:bg-primary-hover active:scale-95 transition-all cursor-pointer"
            >
              {saving ? 'Zapisywanie…' : 'Zapisz'}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-border-custom px-3 py-2.5 text-[12px] font-black uppercase tracking-wider text-text-muted hover:text-text-primary cursor-pointer"
              icon={<X size={12} />}
            >
              Anuluj
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
