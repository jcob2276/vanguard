import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getTodayWarsaw } from '../../lib/date';
import { useGrowthData } from './hooks/useGrowthData';
import { getWeekStartWarsaw, shiftWeekStart } from '../../lib/growth/growth';
import GrowthViewHeader from './GrowthViewHeader';
import GrowthViewMainContent from './GrowthViewMainContent';
import GrowthViewModals from './GrowthViewModals';
import { useDirectionContext } from '../lifestyle/direction/hooks/useDirectionContext';
import { useGrowthActions } from './hooks/useGrowthActions';
import { useGrowthViewDerived } from './useGrowthViewDerived';

export default function GrowthView({ session }: { session: Session }) {
  const userId = session.user.id;
  const [weekStart, setWeekStart] = useState(() => getWeekStartWarsaw(getTodayWarsaw()));
  const [showMore, setShowMore] = useState(false);
  const direction = useDirectionContext(userId, weekStart);
  const data = useGrowthData(userId, weekStart);
  const { skills, snapshots, focus, pins, unreadLinks, readLinks, openTodos, activeProjects, weekNotes, loading, refresh } = data;

  const [expandedParentId, setExpandedParentId] = useState<string | null>(null);

  const derived = useGrowthViewDerived({
    weekStart,
    skills,
    snapshots,
    focus,
    pins,
    unreadLinks,
    readLinks,
    openTodos,
    activeProjects,
    weekNotes,
  });
  const { readOnly, currentScores, focusProjectId } = derived;

  const actions = useGrowthActions({ userId, weekStart, pins, focusProjectId, refresh });
  const { startEditScores } = actions;

  return (
    <div className="min-h-screen w-full bg-background text-text-primary flex flex-col">
      <GrowthViewHeader
        weekStart={weekStart}
        onShiftWeek={(dir) => setWeekStart((w) => shiftWeekStart(w, dir))}
        readOnly={readOnly}
        onEditScores={() => startEditScores(currentScores)}
      />

      <div className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-6 pb-16 space-y-6">
        <GrowthViewMainContent
          loading={loading}
          userId={userId}
          direction={direction}
          data={data}
          derived={derived}
          actions={actions}
          showMore={showMore}
          setShowMore={setShowMore}
        />
      </div>

      <GrowthViewModals
        skills={skills}
        pins={pins}
        focus={focus}
        activeProjects={activeProjects}
        unreadLinks={unreadLinks}
        openTodos={openTodos}
        derived={derived}
        actions={actions}
        expandedParentId={expandedParentId}
        setExpandedParentId={setExpandedParentId}
      />
    </div>
  );
}
