/** Sanitize user-supplied strings before LLM system prompt injection. */

export function sanitizeUserConf(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
    .replace(/\[INSTRUKCJE|SYSTEM:|ignore previous/gi, '')
    .slice(0, 500)
    .trim();
}

/** User chat query — longer limit than user_conf, same injection strip. */
export function sanitizeUserQuery(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
    .replace(/\[INSTRUKCJE|SYSTEM:|ignore previous/gi, '')
    .slice(0, 4000)
    .trim();
}

const STATE_VECTOR_KEYS = new Set([
  'timestamp', 'date', 'user_id',
  'biometrics', 'execution', 'system', 'training', 'nutrition',
]);

export function sanitizeStateVector(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (STATE_VECTOR_KEYS.has(k)) out[k] = v;
  }
  return out;
}

/** Build todayPlan shape expected by systemPrompt from WorldState.execution.today_win. */
export function todayPlanFromWorldState(safeStateVector: Record<string, unknown>): Record<string, unknown> | null {
  const execution = safeStateVector.execution;
  if (!execution || typeof execution !== 'object' || Array.isArray(execution)) return null;
  const win = (execution as Record<string, unknown>).today_win;
  if (!win || typeof win !== 'object' || Array.isArray(win)) return null;
  const w = win as Record<string, unknown>;
  const top3 = [w.task_1, w.task_2, w.task_3].filter((t): t is string => typeof t === 'string' && t.trim().length > 0);
  if (top3.length === 0) return null;
  return {
    top3,
    first_move_morning: typeof w.task_1 === 'string' ? w.task_1 : null,
    minimum_viable_day: [w.task_1, w.task_2].filter((t): t is string => typeof t === 'string' && t.trim().length > 0).join(' + ') || null,
    biggest_risk: null,
    counterplan: null,
    open_loops: [w.task_4, w.task_5].filter((t): t is string => typeof t === 'string' && t.trim().length > 0),
  };
}
