/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Tables } from '../database.types';
import { toWarsawTime } from './exportStatsHelpers';

interface RenderJournalParams {
  dayJournal: any;
  dayTelegramLogs: any[];
  dayHabitLogs: any[];
  habits: any[];
  includeJournal: boolean;
  includeHabits: boolean;
}

export function renderJournalAndHabits({
  dayJournal,
  dayTelegramLogs,
  dayHabitLogs,
  habits,
  includeJournal,
  includeHabits,
}: RenderJournalParams): string {
  let md = '';

  if (includeJournal && dayTelegramLogs.length > 0) {
    md += `### Notatnik (Telegram)\n`;
    md += `#### Logi z Telegrama\n`;
    dayTelegramLogs.forEach((log) => {
      const meta = log.metadata as Record<string, unknown> | null;
      const mode = meta?.mode ? ` [${meta.mode}]` : '';
      const content = (log.content || '').trim().replace(/\n/g, '\n  ');
      if (content) {
        md += `- **${toWarsawTime(log.created_at ?? '')}**${mode}: ${content}\n`;
      }
    });
    md += `\n`;
  }

  if (includeJournal && dayJournal) {
    md += `### 📓 Notatnik & Plan dnia\n`;
    md += `**Wynik Dnia:** ${dayJournal.result === 'Z' ? 'WYGRANA (Z)' : 'PORAŻKA (P)'}\n\n`;

    md += `#### Plan dnia:\n`;
    for (let i = 1; i <= 5; i++) {
      const task = dayJournal[`task_${i}` as keyof Tables<'daily_wins'>];
      const cat = dayJournal[`category_${i}` as keyof Tables<'daily_wins'>];
      const done = dayJournal[`done_${i}` as keyof Tables<'daily_wins'>];
      if (task) {
        md += `- [${done ? 'x' : ' '}] (${cat}) ${task}\n`;
      }
    }
    md += `\n`;

    if (dayJournal.mood_score) {
      const moods = ['Źle', 'Słabo', 'Ok', 'Dobrze', 'Świetnie'];
      md += `**Nastrój:** ${moods[dayJournal.mood_score - 1] || 'Nieokreślony'}\n`;
    }
    if (dayJournal.gratitude_entry) {
      md += `**Wdzięczność:** ${dayJournal.gratitude_entry}\n`;
    }
    if (dayJournal.journal_entry) {
      md += `**Refleksja:** ${dayJournal.journal_entry}\n`;
    }
    md += `\n`;
  }

  if (includeHabits && dayHabitLogs?.length > 0) {
    md += `### ✅ Nawyki Dnia\n`;
    dayHabitLogs.forEach((log) => {
      const habit = (habits ?? []).find((h) => h.id === log.habit_id);
      if (habit) {
        const label = habit.is_positive ? 'Wykonano' : 'Wpadka';
        const stimulus = log.final_stimulus ? ` — bodziec: "${log.final_stimulus}"` : '';
        const ctx = log.context_note ? ` (${log.context_note})` : '';
        md += `- ${habit.icon} ${habit.name}: ${label}${stimulus}${ctx}\n`;
      }
    });
    md += `\n`;
  }

  return md;
}
