export const ALLOWED_CATEGORIES = ['Ciało', 'Konto', 'Duch', 'Chaos', 'Relacje'] as const;
type VanguardCategory = typeof ALLOWED_CATEGORIES[number];

export const ALLOWED_EVENT_KINDS = [
  'friction_event', 
  'positive_micro_action', 
  'recovery_event', 
  'state_observation', 
  'micro_behavior_observation',
  'reflection'
] as const;
type EventKind = typeof ALLOWED_EVENT_KINDS[number];

export const ALLOWED_FRICTION_TYPES = [
  'sleep_disruption', 
  'avoidance', 
  'procrastination', 
  'habit_break', 
  'training_drop', 
  'social_hesitation', 
  'communication_drift',
  'emotional_spike', 
  'self_control_break',
  'positive_micro_action',
  'recovery_anchor',
  'adaptive_move',
  'other'
] as const;
type FrictionType = typeof ALLOWED_FRICTION_TYPES[number];

// Musi zgadzać się z CHECK constraintami vanguard_wiki_pages (page_type / status) —
// wartości pochodzą z LLM, więc każdy zapis musi przejść przez clamp na te listy.
export const ALLOWED_WIKI_PAGE_TYPES = [
  'identity', 'behavior_pattern', 'person', 'project', 'training', 'health',
  'decision', 'friction_loop', 'concept', 'source_summary', 'operating_model', 'goal',
] as const;
type WikiPageType = typeof ALLOWED_WIKI_PAGE_TYPES[number];

export const ALLOWED_WIKI_STATUSES = [
  'hypothesis', 'active', 'needs_review', 'user_confirmed', 'user_rejected', 'archived',
] as const;
type WikiStatus = typeof ALLOWED_WIKI_STATUSES[number];
