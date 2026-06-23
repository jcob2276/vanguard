import { useState, useEffect, useCallback } from 'react';
import { getTodayWarsaw } from '../../lib/date';
import { supabase } from '../../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import type { ScheduleViewData, ScheduleItem } from '../../types/schedule';
import { sweepPastEventsInState } from '../../types/schedule';
import { HeroCard } from './HeroCard';
import { TimelineDay } from './TimelineDay';

const STORAGE_KEY = 'vanguard_schedule_view';

function loadFromStorage(): ScheduleViewData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveToStorage(data: ScheduleViewData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

function buildDefaultSchedule(session: Session): ScheduleViewData {
  const today = getTodayWarsaw();
  return {
    id: `default-${today}`,
    generatedAt: new Date().toISOString(),
    editorialIntro: 'Twój plan na najbliższe dni.',
    quoteBlocks: [],
    timeline: [{
      dayLabel: 'DZIŚ',
      dayDate: today,
      items: [],
    }],
    completed: [],
  };
}

export function ScheduleView({ session }: { session: Session }) {
  const [scheduleData, setScheduleData] = useState<ScheduleViewData | null>(null);
  const today = getTodayWarsaw();

  useEffect(() => {
    let data = loadFromStorage();
    if (data) {
      data = sweepPastEventsInState(data, new Date());
      saveToStorage(data);
    } else {
      data = buildDefaultSchedule(session);
    }
    setScheduleData(data);
  }, []);

  const handleToggleDone = useCallback((itemId: string) => {
    setScheduleData(prev => {
      if (!prev) return prev;
      const next: ScheduleViewData = {
        ...prev,
        timeline: prev.timeline.map(day => ({
          ...day,
          items: day.items.map((item): ScheduleItem =>
            item.id === itemId ? { ...item, done: !item.done } : item
          ),
        })),
      };
      saveToStorage(next);
      return next;
    });
  }, []);

  if (!scheduleData) return null;

  const hasTimeline = scheduleData.timeline.some(d => d.items.length > 0);

  return (
    <div className="space-y-5">
      {/* Hero event */}
      {scheduleData.hero && (
        <HeroCard
          title={scheduleData.hero.title}
          description={scheduleData.hero.description}
          startTime={scheduleData.hero.startTime}
          priority={scheduleData.hero.priority}
        />
      )}

      {/* Editorial intro */}
      {scheduleData.editorialIntro && (
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {scheduleData.editorialIntro}
        </p>
      )}

      {/* Quote blocks */}
      {scheduleData.quoteBlocks.slice(0, 2).map((qb, i) => (
        <div key={i} className="border-l-2 pl-4" style={{ borderColor: '#5B6CFF' }}>
          <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: '#5B6CFF' }}>{qb.title}</p>
          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{qb.content}</p>
        </div>
      ))}

      {/* Timeline */}
      {hasTimeline ? (
        <div className="space-y-5">
          {scheduleData.timeline.map(day => (
            <TimelineDay
              key={day.dayDate}
              dayLabel={day.dayLabel}
              dayDate={day.dayDate}
              items={day.items}
              isToday={day.dayDate === today}
              onToggleDone={handleToggleDone}
            />
          ))}
        </div>
      ) : (
        <p className="text-center text-[12px] py-6" style={{ color: 'var(--color-text-tertiary)' }}>
          Brak zaplanowanych wydarzeń
        </p>
      )}
    </div>
  );
}
