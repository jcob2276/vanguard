export const EPISTEMIC_THRESHOLDS = {
  // vanguard_behavioral_patterns: od kiedy wykryty wzorzec staje się widoczny w UI (status='visible' zamiast 'pending')
  PATTERN_VISIBLE_MIN_CONFIDENCE: 0.6,
  PATTERN_VISIBLE_MIN_SAMPLE_SIZE: 3,

  // vanguard_curiosity_queue: poniżej tego kandydat na wzorzec jest odrzucany, nie zapisywany wcale
  CURIOSITY_CANDIDATE_MIN_CONFIDENCE: 0.3,

  // vanguard_entity_links (graf, Architect): powyżej tego LLM oznacza triadę jako memory_type="fact", <= jako "hypothesis"
  GRAPH_HYPOTHESIS_MAX_CONFIDENCE: 0.65,
};
