import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toLocalISO, todayStr } from './calendarHelpers';
import { getMoonPhase } from '../../lib/solar';
import { Card } from '../ui/Card';

interface MiniCalendarProps {
  selectedDay: string;
  onSelectDay: (day: string) => void;
}

export default function MiniCalendar({ selectedDay, onSelectDay }: MiniCalendarProps) {
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
      className="!bg-surface-solid/5 dark:!bg-white/[0.015] !border-border-custom/30 space-y-3.5 shadow-sm"
      style={{ borderRadius: 'var(--radius-md)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-black text-text-primary tracking-wide">
          {monthNames[month]} {year}
        </span>
        <div className="flex gap-1">
          <button
            onClick={handlePrevMonth}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] active:scale-90 transition-all duration-150 border border-border-custom/20 hover:scale-[1.05]"
          >
            <ChevronLeft size={13} className="text-text-muted hover:text-text-primary" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] active:scale-90 transition-all duration-150 border border-border-custom/20 hover:scale-[1.05]"
          >
            <ChevronRight size={13} className="text-text-muted hover:text-text-primary" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1.5 text-center">
        {['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'].map((d, idx) => (
          <span key={idx} className="text-[9px] font-bold text-text-muted/50 uppercase tracking-wider">
            {d}
          </span>
        ))}
        {daysGrid.map((item, idx) => {
          const isSelected = item.dayStr === selectedDay;
          const isToday = item.dayStr === today;
          const moon = getMoonPhase(item.dayStr);
          // Pokazujemy emoji tylko dla 4 głównych faz i tylko dla dni bieżącego miesiąca
          const showMoon = moon.isMajor && item.isCurrentMonth;

          return (
            <div key={idx} className="relative flex flex-col items-center">
              <button
                onClick={() => onSelectDay(item.dayStr)}
                title={showMoon ? moon.name : undefined}
                className={`h-6.5 w-6.5 mx-auto rounded-full flex items-center justify-center text-[10.5px] transition-all duration-150 active:scale-90 ${
                  isSelected
                    ? 'bg-primary text-white font-black shadow-md shadow-primary/25 scale-[1.08] hover:scale-[1.12]'
                    : isToday
                    ? 'bg-rose-500/10 text-rose-500 font-black border border-rose-500/30 hover:scale-[1.08]'
                    : item.isCurrentMonth
                    ? 'text-text-primary hover:bg-primary/10 hover:text-primary font-semibold hover:scale-[1.08]'
                    : 'text-text-muted/30 hover:bg-primary/10 hover:text-primary/70'
                }`}
              >
                {item.dayNum}
              </button>
              {/* Ikona fazy księżyca — tylko główne fazy */}
              {showMoon && (
                <span
                  className="text-[7px] leading-none mt-[1px] opacity-80"
                  title={moon.name}
                >
                  {moon.emoji}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
