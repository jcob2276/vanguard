import React from 'react';
import { Sparkles, Shield, Check } from 'lucide-react';
import {
  HOUR_START,
  HOUR_END,
  PX_PER_MIN,
  eventColor,
  formatTime,
  parseTime,
} from '../calendarHelpers';
import { GOAL_ICON } from '../../todo/todoUtils';
import type {
  CalendarGridEventBlockProps,
  CalendarGridTodoBlockProps,
} from './types';

export const renderEventBlock = ({
  ev,
  left,
  width,
  handleEventMouseDown,
}: CalendarGridEventBlockProps) => {
  if (!ev.start_time || !ev.end_time) return null;
  const startMin = parseTime(ev.start_time);
  const endMin = parseTime(ev.end_time);

  if (endMin <= HOUR_START * 60 || startMin >= HOUR_END * 60) return null;

  const visibleStartMin = Math.max(HOUR_START * 60, startMin);
  const visibleEndMin = Math.min(HOUR_END * 60, endMin);
  const top = (visibleStartMin - HOUR_START * 60) * PX_PER_MIN;
  const height = Math.max(20, (visibleEndMin - visibleStartMin) * PX_PER_MIN);
  const tooShort = height < 32;
  const isAIScheduled = ev.summary?.includes('✨') || ev.summary?.includes('[AI]');
  const isFocusTime = ev.summary?.includes('Focus Time') || ev.summary?.includes('🛡️');

  let displaySummary = ev.summary;
  if (tooShort) {
    const isSleep = ev.summary?.toLowerCase().includes('sen') || ev.summary?.toLowerCase().includes('sleep');
    if (isSleep) {
      displaySummary = `${formatTime(ev.start_time)}-${formatTime(ev.end_time)}`;
    } else {
      displaySummary = `${ev.summary} (${formatTime(ev.start_time)}–${formatTime(ev.end_time)})`;
    }
  }

  return (
    <div
      key={ev.id}
      onMouseDown={(e) => handleEventMouseDown(ev, e, 'move')}
      className={`absolute rounded-md shadow-sm ${tooShort ? 'px-1 py-0.5 flex items-center justify-start' : 'px-1.5 py-1'} overflow-hidden cursor-move hover:shadow-md hover:brightness-110 hover:scale-[1.01] active:scale-[0.99] active:brightness-95 transition-all duration-150 hover:z-20 select-none ${eventColor(ev)}`}
      style={{ top, height, left: `calc(${left} + 1px)`, width: `calc(${width} - 2px)` }}
      title={ev.summary || ''}
    >
      <div className="flex items-start gap-0.5 min-w-0 w-full justify-start flex-wrap">
        {isAIScheduled && !tooShort && <Sparkles size={9} className="shrink-0 animate-pulse opacity-90 mt-0.5" />}
        {isFocusTime && !tooShort && <Shield size={9} className="shrink-0 opacity-90 mt-0.5" />}
        <p className={`${tooShort ? 'text-[8.5px]' : 'text-[9.5px]'} font-extrabold leading-tight break-all whitespace-normal line-clamp-3`}>
          {displaySummary}
        </p>
      </div>
      {!tooShort && (
        <div className="opacity-85 text-[8.5px] font-bold leading-none mt-0.5 break-all whitespace-normal">
          <span>{formatTime(ev.start_time)}–{formatTime(ev.end_time)}</span>
        </div>
      )}
      <div
        onMouseDown={(e) => handleEventMouseDown(ev, e, 'resize')}
        className="absolute bottom-0 left-0 right-0 h-1.5 cursor-s-resize hover:bg-black/10 dark:hover:bg-white/10 z-30"
      />
    </div>
  );
};

export const renderTodoBlock = ({
  todo,
  goalChipFor,
  completedTodoIds,
  handleToggleTodo,
  setEditingTodo,
  setEditingTodoTitle,
  setToastMessage,
}: CalendarGridTodoBlockProps) => {
  if (!todo.scheduled_time) return null;
  const startMin = parseTime(todo.scheduled_time);
  const duration = todo.duration_minutes || 30;
  const visibleStartMin = Math.max(HOUR_START * 60, startMin);
  const visibleEndMin = Math.min(HOUR_END * 60, startMin + duration);
  if (visibleEndMin <= visibleStartMin) return null;
  const top = (visibleStartMin - HOUR_START * 60) * PX_PER_MIN;
  const height = Math.max(18, (visibleEndMin - visibleStartMin) * PX_PER_MIN);
  const chip = goalChipFor(todo.section_id);
  const GoalIcon = chip ? GOAL_ICON[chip.pillar] : null;
  const isCompleting = todo.status === 'done' || completedTodoIds.has(todo.id);
  return (
    <div
      key={`todo-${todo.id}`}
      title={`${todo.title}${chip?.dreamTitle ? ` · ${chip.dreamTitle}` : ''}`}
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.setData('text/plain', JSON.stringify({ id: todo.id, title: todo.title, duration_minutes: todo.duration_minutes }));
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={(e) => {
        e.stopPropagation();
        setEditingTodo(todo);
        setEditingTodoTitle(todo.title);
      }}
      className={`absolute rounded-md border border-dashed border-primary/50 bg-primary/10 hover:bg-primary/20 hover:scale-[1.01] hover:shadow-md px-1 py-0.5 overflow-hidden transition-all duration-150 z-10 cursor-grab active:cursor-grabbing ${isCompleting ? 'opacity-50' : ''}`}
      style={{ top, height, left: '75%', width: '24%' }}
    >
      <div className="flex items-start gap-0.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleToggleTodo(todo.id);
            setToastMessage(`Ukończono: "${todo.title}" ✅`);
          }}
          className={`relative after:absolute after:-inset-2 mt-0.5 h-2.5 w-2.5 shrink-0 rounded-sm border flex items-center justify-center transition-colors ${isCompleting ? 'bg-emerald-500 border-emerald-500' : 'border-primary/50 hover:bg-primary/20'}`}
        >
          {isCompleting && <Check size={6} className="text-white" strokeWidth={4} />}
        </button>
        <p className={`flex items-center gap-0.5 text-[8px] font-bold text-primary leading-tight line-clamp-2 ${isCompleting ? 'line-through' : ''}`}>
          {GoalIcon && <GoalIcon size={7} className="shrink-0" />}
          <span className="truncate">{todo.title}</span>
        </p>
      </div>
    </div>
  );
};
