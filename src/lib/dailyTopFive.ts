import { supabase } from './supabase';
import { invalidateGoalSpineCache } from './goal/goalSpine.queries';

type DraftTask = {
  task: string;
  todoId: string | null;
  checkpointId: string | null;
  projectId: string | null;
  pinId: string | null;
  targetValue: string;
  timeSlot: 'morning' | 'noon' | 'afternoon' | 'evening';
};

type PowerListDraft = {
  tasks: DraftTask[];
  yesterdayNote: string;
  savedAt: number;
};

export type AddToTopFiveResult = 'draft' | 'today';

const emptyTask = (): DraftTask => ({
  task: '',
  todoId: null,
  checkpointId: null,
  projectId: null,
  pinId: null,
  targetValue: '',
  timeSlot: 'morning',
});

function draftKey(userId: string, date: string) {
  return `vanguard_powerlist_draft_${userId}_${date}`;
}

function addToDraft(userId: string, date: string, title: string, projectId: string): void {
  const key = draftKey(userId, date);
  let draft: PowerListDraft = {
    tasks: Array.from({ length: 5 }, emptyTask),
    yesterdayNote: '',
    savedAt: Date.now(),
  };

  try {
    const stored = localStorage.getItem(key);
    if (stored) draft = JSON.parse(stored) as PowerListDraft;
  } catch {
    // A broken draft should not block planning today.
  }

  const tasks = Array.isArray(draft.tasks) && draft.tasks.length === 5
    ? [...draft.tasks]
    : Array.from({ length: 5 }, emptyTask);
  const slot = tasks.findIndex((task) => !task.task.trim());
  if (slot < 0) throw new Error('Top 5 jest już pełne.');

  tasks[slot] = { ...emptyTask(), task: title, projectId };
  localStorage.setItem(key, JSON.stringify({ ...draft, tasks, savedAt: Date.now() }));
}

export async function addProjectActionToTopFive(
  userId: string,
  date: string,
  title: string,
  projectId: string,
  category: 'cialo' | 'duch' | 'konto',
): Promise<AddToTopFiveResult> {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) throw new Error('Projekt nie ma następnego działania.');

  const { data: day, error } = await supabase
    .from('daily_wins')
    .select('id, daily_win_tasks(slot)')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();
  if (error) throw error;

  if (!day) {
    addToDraft(userId, date, trimmedTitle, projectId);
    return 'draft';
  }

  const occupied = new Set((day.daily_win_tasks ?? []).map((task) => task.slot));
  const slot = [1, 2, 3, 4, 5].find((candidate) => !occupied.has(candidate));
  if (!slot) throw new Error('Top 5 jest już pełne.');

  const { error: insertError } = await supabase.from('daily_win_tasks').insert({
    day_win_id: day.id,
    user_id: userId,
    slot,
    title: trimmedTitle,
    project_id: projectId,
    category,
    done: false,
  });
  if (insertError) throw insertError;
  invalidateGoalSpineCache(userId);
  return 'today';
}
