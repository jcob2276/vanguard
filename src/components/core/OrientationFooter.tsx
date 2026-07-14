import { useEffect, useRef, useState } from 'react';
import { fetchSprintContext } from '../../lib/goal/goalSpine';
import { useGoalSpineInvalidation } from '../../hooks/useGoalSpineInvalidation';
import { getSprintInfo, SPRINT_SEASON } from '../../lib/growth/sprintUtils';
import { useUserId } from '../../store/useStore';
import { Card } from '../ui/Card';

const BORN = new Date('2002-07-06');

const FUEL = [
  'Przyszłe ty ma nadzieję,\nże dzisiejsze ty nie odpuści.',
  'Nie żałujesz decyzji które podjąłeś.\nTylko tych których nie podjąłeś.',
  'Za rok będziesz tu\nalbo znacznie dalej.\nTy decydujesz dziś.',
  'Każda wielka zmiana zaczęła się\nod jednego zwykłego dnia.',
  'Entuzjazm to nie nastrój.\nTo decyzja którą podejmujesz rano.',
  'Dyskomfort który czujesz\nto dowód że rośniesz.',
  'Nie musisz mieć ochoty.\nMusisz tylko zacząć.',
  'Jedyne o czym będziesz żałować\nto że nie zacząłeś wcześniej.',
  'Twoje najlepsze lata\nnie są za tobą.',
  'Za 5 lat docenisz\nkażdą decyzję którą podjąłeś dziś.',
  'To nie jest próba.\nTo jest twoje życie.',
  'Nikt za ciebie nie będzie żałował\nże nie spróbowałeś.',
];

export default function OrientationFooter() {
  const userId = useUserId();
  const [lived] = useState(() => Math.floor((Date.now() - BORN.getTime()) / 86400000));
  const quote = FUEL[lived % FUEL.length];
  const sprint = getSprintInfo();
  const [sprintGoal, setSprintGoal] = useState<string | null>(null);
  const loadRef = useRef(() => {
    if (userId) void fetchSprintContext(userId).then((ctx) => setSprintGoal(ctx.goalText));
  });

  useEffect(() => {
    loadRef.current = () => {
      if (userId) void fetchSprintContext(userId).then((ctx) => setSprintGoal(ctx.goalText));
    };
    loadRef.current();
  }, [userId, sprint.personalYear, sprint.sprintNumber]);

  useGoalSpineInvalidation(() => loadRef.current());

  return (
    <Card
      variant="outline"
      className="animate-fadeIn mt-4"
      style={{
        border: '1px solid color-mix(in oklch, var(--color-primary) 10%, transparent)',
        background: 'color-mix(in oklch, var(--color-primary) 2%, transparent)',
      }}
      padding="0"
    >
      <div className="px-5 py-4 border-l-4 border-primary/40">
        <p className="font-display text-base font-medium leading-relaxed text-text-primary italic whitespace-pre-line">
          {quote}
        </p>
      </div>

      <div className="px-5 py-3.5 border-t border-primary/10 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-2xs font-black uppercase tracking-[0.2em] text-text-muted">
            PY{sprint.personalYear}
          </span>
          <span className="text-text-muted/30">·</span>
          <span className="text-2xs font-black uppercase tracking-wider text-primary">
            Sprint {sprint.sprintNumber} · {SPRINT_SEASON[sprint.sprintNumber]}
          </span>
          <span className="ml-auto text-2xs font-bold text-text-muted">
            tydz. {sprint.weekInSprint}/12 · {sprint.pct}%
          </span>
        </div>

        {sprintGoal && (
          <p className="text-sm font-bold text-text-primary leading-snug">{sprintGoal}</p>
        )}

        <div className="h-1.5 bg-border-custom rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-primary/80 transition-all" style={{ width: `${sprint.pct}%` }} />
        </div>

        <p className="text-2xs font-bold uppercase tracking-[0.18em] text-primary/40">
          Dzień {lived.toLocaleString('pl-PL')}
        </p>
      </div>
    </Card>
  );
}
