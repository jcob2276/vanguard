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
  'state', 'stability_score', 'confidence', 'now', 'metrics', 'last_14_days',
  'goal_alignment', 'today_plan', 'open_todos', 'upcoming_checkpoints', 'readiness',
  'goal_spine', 'strategic_gaps', 'weekly_protocol', 'active_signature',
  'desktop_footprint', 'lag_correlations', 'identity_vault',
]);

export function sanitizeStateVector(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (STATE_VECTOR_KEYS.has(k)) out[k] = v;
  }
  return out;
}
