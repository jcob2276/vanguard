import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { getSprintInfo, SPRINT_SEASON } from '../desktop/desktopUtils';

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

export default function OrientationFooter({ session }: { session: Session }) {
  const lived = Math.floor((Date.now() - BORN.getTime()) / 86400000);
  const quote = FUEL[lived % FUEL.length];
  const sprint = getSprintInfo();
  const [sprintGoal, setSprintGoal] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('sprint_goals')
      .select('goal_text')
      .eq('user_id', session.user.id)
      .eq('personal_year', sprint.personalYear)
      .eq('sprint_number', sprint.sprintNumber)
      .maybeSingle()
      .then(({ data }) => setSprintGoal(data?.goal_text ?? null));
  }, [session.user.id, sprint.personalYear, sprint.sprintNumber]);

  return (
    <footer className="animate-fadeIn mt-4 rounded-[24px] border border-primary/10 bg-primary/[0.02] dark:bg-primary/[0.04] overflow-hidden">
      <div className="px-5 py-4 border-l-4 border-primary/40">
        <p className="font-display text-[14px] font-medium leading-relaxed text-text-primary italic whitespace-pre-line">
          {quote}
        </p>
      </div>

      <div className="px-5 py-3.5 border-t border-primary/10 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted">
            PY{sprint.personalYear}
          </span>
          <span className="text-text-muted/30">·</span>
          <span className="text-[9px] font-black uppercase tracking-wider text-primary">
            Sprint {sprint.sprintNumber} · {SPRINT_SEASON[sprint.sprintNumber]}
          </span>
          <span className="ml-auto text-[9px] font-bold text-text-muted">
            tydz. {sprint.weekInSprint}/12 · {sprint.pct}%
          </span>
        </div>

        {sprintGoal && (
          <p className="text-[13px] font-bold text-text-primary leading-snug">{sprintGoal}</p>
        )}

        <div className="h-1.5 bg-border-custom rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-primary/80 transition-all" style={{ width: `${sprint.pct}%` }} />
        </div>

        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary/40">
          Dzień {lived.toLocaleString('pl-PL')}
        </p>
      </div>
    </footer>
  );
}
