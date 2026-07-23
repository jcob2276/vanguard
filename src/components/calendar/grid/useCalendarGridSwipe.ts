import { useRef, type TouchEventHandler } from 'react';
import { addDays, weekMon } from '../calendarHelpers';

interface Options {
  calView: string;
  selectedDay: string;
  weekStart: string;
  setSelectedDay: (day: string) => void;
  setWeekStart: (day: string) => void;
}

export function useCalendarGridSwipe(options: Options) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart: TouchEventHandler<HTMLDivElement> = (event) => {
    if (event.touches.length === 1) {
      touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
  };

  const onTouchEnd: TouchEventHandler<HTMLDivElement> = (event) => {
    if (!touchStart.current || event.changedTouches.length !== 1) return;
    const deltaX = event.changedTouches[0].clientX - touchStart.current.x;
    const deltaY = event.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(deltaX) <= 60 || Math.abs(deltaY) >= 45) return;

    const direction = deltaX < 0 ? 1 : -1;
    if (options.calView === 'dzien') {
      const next = addDays(options.selectedDay, direction);
      options.setSelectedDay(next);
      options.setWeekStart(weekMon(next));
    } else if (options.calView === '3dni') {
      const next = addDays(options.selectedDay, direction * 3);
      options.setSelectedDay(next);
      options.setWeekStart(next);
    } else if (options.calView === 'tydzien') {
      const next = addDays(options.weekStart, direction * 7);
      options.setSelectedDay(next);
      options.setWeekStart(next);
    } else if (options.calView === 'miesiac') {
      const [year, month] = options.selectedDay.split('-').map(Number);
      const next = new Date(year, month - 1 + direction, 1);
      options.setSelectedDay(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`);
    }
  };

  return { onTouchStart, onTouchEnd };
}
