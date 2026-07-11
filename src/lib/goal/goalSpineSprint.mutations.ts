import { getSprintInfo } from '../growth/sprintUtils';
import { supabase } from '../supabase';
import type { SprintProjectDecision } from './goalSpine.types';
import { invalidateGoalSpineCache } from './goalSpine.queries';

async function saveSprintGoal(
  userId: string,
  goalText: string,
  opts?: { personalYear?: number; sprintNumber?: number; focusProjectIds?: string[] },
): Promise<void> {
  const sprint = getSprintInfo();
  const personalYear = opts?.personalYear ?? sprint.personalYear;
  const sprintNumber = opts?.sprintNumber ?? sprint.sprintNumber;
  const { error } = await supabase.from('sprint_goals').upsert(
    {
      user_id: userId,
      personal_year: personalYear,
      sprint_number: sprintNumber,
      goal_text: goalText,
      focus_project_ids: opts?.focusProjectIds ?? [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,personal_year,sprint_number' },
  );
  if (error) throw error;
  invalidateGoalSpineCache(userId);
}

async function saveSprintReview(
  userId: string,
  reflection: string,
  opts?: { complete?: boolean },
): Promise<void> {
  const sprint = getSprintInfo();
  const { error } = await supabase.from('sprint_reviews').upsert(
    {
      user_id: userId,
      personal_year: sprint.personalYear,
      sprint_number: sprint.sprintNumber,
      reflection: reflection.trim() || null,
      completed_at: opts?.complete ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,personal_year,sprint_number' },
  );
  if (error) throw error;
  invalidateGoalSpineCache(userId);
}

export async function completeSprintClose(
  userId: string,
  opts: {
    reflection?: string | null;
    nextSprintGoal: string;
    projectDecisions?: Record<string, SprintProjectDecision>;
  },
): Promise<void> {
  const sprint = getSprintInfo();
  await saveSprintReview(userId, opts.reflection?.trim() ?? '', { complete: true });
  const continuingIds = opts.projectDecisions
    ? Object.entries(opts.projectDecisions)
        .filter(([, d]) => d === 'continue')
        .map(([id]) => id)
    : [];
  await saveSprintGoal(userId, opts.nextSprintGoal.trim(), {
    personalYear: sprint.personalYear,
    sprintNumber: sprint.sprintNumber + 1,
    focusProjectIds: continuingIds,
  });

  if (opts.projectDecisions) {
    const deferIds = Object.entries(opts.projectDecisions)
      .filter(([, d]) => d === 'defer')
      .map(([id]) => id);
    if (deferIds.length > 0) {
      const { error } = await supabase
        .from('projects')
        .update({ status: 'paused' })
        .eq('user_id', userId)
        .in('id', deferIds);
      if (error) throw error;
    }
  }
  invalidateGoalSpineCache(userId);
}
