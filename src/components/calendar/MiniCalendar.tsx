import { Pressable } from '../ui/ControlPrimitives';
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toLocalISO, todayStr } from './calendarHelpers';
import { getMoonPhase } from '../../lib/solar';
import { Card } from '../ui/Card';

interface MiniCalendarProps {
  selectedDay: string;
  onSelectDay: (day: string) => void;
  eventDatesSet?: Set<string>;
}

export default function MiniCalendar({ selectedDay, onSelectDay, eventDatesSet }: MiniCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => {
    const [y, m] = selectedDay.split('-').map(Number);
    return new Date(y, m - 1, 1);
  });

  useEffect(() => {
    const [y, m] = selectedDay.split('-').map(Number);
    void (async () => { setCurrentDate(new Date(y, m - 1, 1)); })();
  }, [selectedDay]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  const daysGrid: { dayStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dNum = prevMonthTotalDays - i;
    const prevMonthDate = new Date(year, month - 1, dNum);
    daysGrid.push({
      dayStr: toLocalISO(prevMonthDate),
      dayNum: dNum,
      isCurrentMonth: false,
    });
  }

  for (let i = 1; i <= totalDays; i++) {
    const curDate = new Date(year, month, i);
    daysGrid.push({
      dayStr: toLocalISO(curDate),
      dayNum: i,
      isCurrentMonth: true,
    });
  }

  const remainingSlots = 42 - daysGrid.length;
  for (let i = 1; i <= remainingSlots; i++) {
    const nextMonthDate = new Date(year, month + 1, i);
    daysGrid.push({
      dayStr: toLocalISO(nextMonthDate),
      dayNum: i,
      isCurrentMonth: false,
    });
  }

  const monthNames = [
    'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
  ];

  const today = todayStr();

  return (
    <Card
      variant="outline"
      padding="1rem"
      className="!bg-surface-solid/5 dark:!bg-on-accent/[0.015] !border-border-custom/30 space-y-3.5 shadow-sm"
      style={{ borderRadius: 'var(--radius-md)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-black text-text-primary tracking-wide">
          {monthNames[month]} {year}
        </span>
        <div className="flex gap-1">
          <Pressable
            onClick={handlePrevMonth}
            aria-label="Poprzedni miesiąc"
            className="p-1 rounded-lg hover:bg-surface-2 active:scale-90 transition-all duration-[var(--motion-medium)] border border-border-custom/20 hover:scale-[var(--ds-arbitrary-1-05)]"
          >
            <ChevronLeft size={13} className="text-text-muted hover:text-text-primary" />
          </Pressable>
          <Pressable
            onClick={handleNextMonth}
            aria-label="Następny miesiąc"
            className="p-1 rounded-lg hover:bg-surface-2 active:scale-90 transition-all duration-[var(--motion-medium)] border border-border-custom/20 hover:scale-[var(--ds-arbitrary-1-05)]"
          >
            <ChevronRight size={13} className="text-text-muted hover:text-text-primary" />
          </Pressable>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1.5 text-center">
        {['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'].map((d, idx) => (
          <span key={idx} className="text-2xs font-bold text-text-muted/50 uppercase tracking-wider">
            {d}
          </span>
        ))}
        {daysGrid.map((item, idx) => {
          const isSelected = item.dayStr === selectedDay;
          const isToday = item.dayStr === today;
          const hasEvents = eventDatesSet?.has(item.dayStr);
          const moon = getMoonPhase(item.dayStr);
          // Pokazujemy emoji tylko dla 4 głównych faz i tylko dla dni bieżącego miesiąca
          const showMoon = moon.isMajor && item.isCurrentMonth;

          return (
            <div key={idx} className="relative flex flex-col items-center">
              <Pressable
                onClick={() => onSelectDay(item.dayStr)}
                title={showMoon ? moon.name : undefined}
                className={`h-6.5 w-6.5 mx-auto rounded-full flex items-center justify-center text-xs transition-all duration-[var(--motion-medium)] active:scale-90 ${
                  isSelected
                    ? 'bg-primary text-on-accent font-black shadow-md shadow-[var(--shadow-glow-primary)] scale-[var(--ds-arbitrary-1-08)] hover:scale-[var(--ds-arbitrary-1-12)]'
                    : isToday
                    ? 'bg-danger/10 text-danger font-black border border-danger/30 hover:scale-[var(--ds-arbitrary-1-08)]'
                    : item.isCurrentMonth
                    ? 'text-text-primary hover:bg-primary/10 hover:text-primary font-semibold hover:scale-[var(--ds-arbitrary-1-08)]'
                    : 'text-text-muted/30 hover:bg-primary/10 hover:text-primary/70'
                }`}
              >
                {item.dayNum}
              </Pressable>
              {/* Ikona fazy księżyca lub kropka wydarzeń */}
              {showMoon ? (
                <span
                  className="text-3xs leading-none mt-[var(--ds-arbitrary-1px)] opacity-[var(--opacity-80)]"
                  title={moon.name}
                >
                  {moon.emoji}
                </span>
              ) : hasEvents ? (
                <span className="h-1 w-1 rounded-full bg-primary mt-0.5" />
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
