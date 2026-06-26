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
  const [calendarEvents, setCalendarEvents] = useState<{ summary: string | null; start_time: string | null }[]>([]);
  const today = getTodayWarsaw();

  useEffect(() => {
    supabase
      .from('vanguard_calendar')
      .select('summary, start_time')
      .eq('user_id', session.user.id)
      .gte('start_time', `${today}T00:00:00`)
      .lte('start_time', `${today}T23:59:59`)
      .order('start_time', { ascending: true })
      .then(({ data }) => setCalendarEvents(data || []));
  }, [session.user.id, today]);

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

  let displayHero = scheduleData.hero;
  let timeline = scheduleData.timeline;

  if (!displayHero && timeline.length > 0) {
    const firstDay = timeline[0];
    const firstEventIdx = firstDay.items.findIndex(item => item.kind === 'event');
    if (firstEventIdx !== -1) {
      const eventItem = firstDay.items[firstEventIdx];
      displayHero = {
        cardId: eventItem.id,
        title: eventItem.title,
        description: 'Fokus dnia',
        startTime: eventItem.startTime,
        priority: 1
      };
      timeline = timeline.map((day, idx) => {
        if (idx === 0) {
          return {
            ...day,
            items: day.items.filter((_, i) => i !== firstEventIdx)
          };
        }
        return day;
      });
    }
  }

  const hasTimeline = timeline.some(d => d.items.length > 0);

  return (
    <div className="space-y-5">
      {calendarEvents.length > 0 && (
        <div className="rounded-2xl border border-border-custom bg-surface-solid/40 p-4 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-text-muted">Kalendarz (dziś)</p>
          {calendarEvents.map((ev, i) => (
            <div key={i} className="flex justify-between gap-2 text-[12px] text-text-secondary">
              <span className="font-semibold truncate">{ev.summary || 'Wydarzenie'}</span>
              <span className="shrink-0 text-text-muted">{ev.start_time ? new Date(ev.start_time).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' }) : '—'}</span>
            </div>
          ))}
        </div>
      )}
      {/* Hero event */}
      {displayHero && (
        <HeroCard
          title={displayHero.title}
          description={displayHero.description}
          startTime={displayHero.startTime}
          priority={displayHero.priority}
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
          {timeline.map(day => (
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
