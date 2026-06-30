export interface ScheduleItem {
  id: string;
  kind: 'todo' | 'event';
  title: string;
  startTime?: string;
  dueAt?: string;
  pastAfter?: string;
  sourceFact?: string;
  color?: string;
  done?: boolean;
}

export interface CompletedItem {
  id: string;
  title: string;
  completedAt: string;
}

export interface ScheduleViewData {
  id: string;
  generatedAt: string;
  hero?: {
    cardId: string;
    title: string;
    description?: string;
    startTime?: string;
    priority: number;
  };
  editorialIntro: string;
  monthTheme?: string;
  monthThemeLabel?: string;
  sprintWeekBridge?: string;
  longTermBridge?: string;
  quoteBlocks: Array<{
    title: string;
    content: string;
    priority: 'low' | 'normal' | 'high';
  }>;
  timeline: Array<{
    dayLabel: string;
    dayDate: string;
    items: ScheduleItem[];
  }>;
  completed: CompletedItem[];
}

export function sweepPastEventsInState(state: ScheduleViewData, now: Date): ScheduleViewData {
  const nowIso = now.toISOString();
  const newTimeline = state.timeline.map(day => ({
    ...day,
    items: day.items.filter(item => {
      if (item.kind !== 'event') return true;
      if (!item.pastAfter) return true;
      return item.pastAfter > nowIso;
    }),
  }));

  const swept: CompletedItem[] = state.timeline.flatMap(day =>
    day.items.filter(item => {
      if (item.kind !== 'event') return false;
      if (!item.pastAfter) return false;
      return item.pastAfter <= nowIso;
    }).map(item => ({
      id: item.id,
      title: item.title,
      completedAt: item.pastAfter!,
    }))
  );

  return {
    ...state,
    timeline: newTimeline,
    completed: [...state.completed, ...swept],
  };
}
