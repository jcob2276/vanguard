/**
 * Shared types for Personal Pattern Memory detectors (Etap 1).
 */

export interface PatternInsight {
  type: 'recurring_blocker' | 'plan_adherence_gap' | 'morning_protocol_impact' | 'sleep_friction_link' | 'early_warning' | 'narrative_biometric_mismatch';
  title: string;                    // Krótki tytuł do pokazania
  evidenceText: string;             // Gotowy tekst do wstawienia w wiadomość (po polsku)
  confidence: number;               // 0.0 – 1.0
  sampleSize: number;               // ile dni / obserwacji
  lastSeenDate: string | null;      // data ostatniego wystąpienia (YYYY-MM-DD)
  metadata?: Record<string, any>;   // surowe dane dla debugu / dalszego przetwarzania
}

export interface BehavioralPattern {
  id: string;
  pattern_type: string;
  title: string | null;
  evidence_text: string;
  confidence: number;
  occurrence_count: number;
  status: string;
  last_seen: string | null;
}
