import { ALLOWED_CATEGORIES, ALLOWED_EVENT_KINDS, ALLOWED_FRICTION_TYPES } from "../../_shared/domain.ts";

export interface NormalizedClassification {
  importance_score: number;
  category: string;
  tags: string[];
  temporality: 'trwałe' | 'tymczasowe';
  fingerprint_text: string | null;
  is_closure: boolean;
  closed_topic_description: string | null;
  expiration_date: string | null;
}

export interface NormalizedFriction {
  is_relevant: boolean;
  event_kind: string | null;
  friction_type: string;
  declared_intention: string | null;
  actual_behavior: string | null;
  deviation: string | null;
  immediate_cost: string | null;
  emotional_state: string | null;
  people_involved: string | string[] | null;
  location_context: string | null;
  [key: string]: string | string[] | boolean | null;
}

// Normalizuje output LLM dla klasyfikacji: wymusza zamknięte słowniki i bezpieczne typy.
export function normalizeClassification(raw: any): NormalizedClassification {
  const category = ALLOWED_CATEGORIES.includes(raw?.category) ? raw.category : 'Chaos';
  const tags = Array.isArray(raw?.tags)
    ? [...new Set(raw.tags.map((t: any) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 5)
    : [];

  let importance_score = parseInt(raw?.importance_score);
  if (isNaN(importance_score) || importance_score < 1 || importance_score > 10) {
    importance_score = 5;
  }

  const temporality = (raw?.temporality === 'trwałe' || raw?.temporality === 'tymczasowe')
    ? raw.temporality
    : 'tymczasowe';

  return {
    ...raw,
    category,
    tags,
    importance_score,
    temporality,
    is_closure: !!raw?.is_closure,
    closed_topic_description: typeof raw?.closed_topic_description === 'string' ? raw.closed_topic_description : null,
    expiration_date: typeof raw?.expiration_date === 'string' ? raw.expiration_date : null,
  };
}

// Normalizuje output LLM dla mikrotarć.
export function normalizeFriction(raw: any): NormalizedFriction {
  const event_kind = ALLOWED_EVENT_KINDS.includes(raw?.event_kind) ? raw.event_kind : null;
  const friction_type = ALLOWED_FRICTION_TYPES.includes(raw?.friction_type) ? raw.friction_type : 'other';
  const is_relevant = typeof raw?.is_relevant === 'boolean' ? raw.is_relevant : (event_kind !== null);

  return {
    ...raw,
    event_kind,
    friction_type,
    is_relevant,
  };
}
