export interface PlanningFrame {
  preferred_days: number[];
  preferred_start: string | null;
  preferred_end: string | null;
  frame_strength: string;
}

export interface FrameEvaluation {
  matches: boolean;
  reason: string | null;
  strength: 'prefer' | 'only';
}

function isoWeekday(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

export function evaluatePlanningFrame(
  frame: PlanningFrame | undefined,
  date: string,
  startMinutes: number,
): FrameEvaluation {
  const strength = frame?.frame_strength === 'only' ? 'only' : 'prefer';
  if (!frame) return { matches: true, reason: null, strength };

  const days = frame.preferred_days || [];
  if (days.length && !days.includes(isoWeekday(date))) {
    return { matches: false, reason: 'Ten dzień jest poza ustawionym rytmem tego obszaru.', strength };
  }

  const toMinutes = (time: string | null) => {
    if (!time) return null;
    const [hours, minutes] = time.slice(0, 5).split(':').map(Number);
    return hours * 60 + minutes;
  };
  const start = toMinutes(frame.preferred_start);
  const end = toMinutes(frame.preferred_end);
  if (start !== null && startMinutes < start) {
    return { matches: false, reason: `Preferowane okno zaczyna się o ${frame.preferred_start?.slice(0, 5)}.`, strength };
  }
  if (end !== null && startMinutes >= end) {
    return { matches: false, reason: `Preferowane okno kończy się o ${frame.preferred_end?.slice(0, 5)}.`, strength };
  }
  return { matches: true, reason: null, strength };
}

