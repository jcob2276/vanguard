/**
 * Central type registry for Supabase Edge Function responses.
 *
 * When a Deno edge function changes its response contract, update the
 * corresponding type here — TypeScript will flag every mismatched call site
 * on the frontend.
 *
 * Usage: `invokeEdge<'analyze-training-load'>({ userId })` returns
 * `Promise<EdgeFunctionResponses['analyze-training-load']>`.
 * Unregistered function names fall back to `Record<string, unknown>`.
 */

// ── Per-function response types ──────────────────────────────────────

interface AnalyzeFoodQualitySingle {
  success?: boolean; mode: 'single'; date?: string; items_scored?: number;
  day_quality_score?: number; day_quality_analysis?: string;
  items: Array<{ name: string; food_quality_score: number; quality_reason: string }>;
  protein_distribution?: Array<{ meal: string; protein_g: number; mps?: boolean; note?: string }>;
  micronutrient_gaps?: string[]; training_sync?: string | null;
  swap_suggestions?: Array<{ from: string; to: string; reason: string }>;
}

interface AnalyzeFoodQualityRange {
  success?: boolean; mode: 'range'; dateFrom?: string; dateTo?: string;
  days: Array<{ date?: string; score?: number; summary?: string; incomplete?: boolean; fasting?: boolean }>;
  avg_score?: number; pattern_analysis?: string; top_issues?: string[]; strengths?: string[];
  action_steps?: string[]; nutrition_profile?: string; trend?: 'improving' | 'stable' | 'degrading';
  trend_note?: string; chronic_gaps?: string[]; best_day?: string; worst_day?: string; training_nutrition_note?: string;
}

interface AnalyzeFoodQualityError {
  success?: boolean;
  error?: string;
}

export type AnalyzeFoodQualityResponse = AnalyzeFoodQualitySingle | AnalyzeFoodQualityRange | AnalyzeFoodQualityError;

export interface AnalyzeTrainingLoadResponse {
  success?: boolean;
  stats?: {
    week_strain: number | null; base_strain: string | null;
    week_recovery: number | null; base_recovery: number | null;
    week_hrv: number | null; base_hrv: number | null;
    week_sleep: number | null; base_sleep: number | null;
    week_sets: number; base_sets_pw: number;
    week_run_km: number; base_run_km_pw: number;
    week_sauna: number; base_sauna_pw: number;
    muscle_tags: string[]; hr_max: number | null;
    z2_ceiling: number | null; today: string;
    day_of_week: number; day_of_week_label: string;
    week_progress: number; early_week: boolean;
    expected_run_km_to_date: number; expected_sets_to_date: number;
    expected_strain_to_date: number; coach_signals: Record<string, unknown>;
    km_trend: number[]; sets_trend: number[];
    strain_trend: (number | null)[]; acwr: number | null;
    acwr_band: string | null; monotony: number | null;
    acute_load: number | null; chronic_load: number | null;
  };
  load_status?: string;
  load_summary?: string | null;
  coach_decision_summary?: string | null;
  strength_note?: string | null;
  [key: string]: unknown;
}

interface RecapReflectionResponse { ok: true; mode: 'reflection'; id: string; manual: boolean; voice_count_24h: number; stream_count_24h: number; events_count: number; }
interface RecapWeeklySynthesisResponse { success: true; week: string; }
interface RecapWeeklyRecapPhase1 { phase1: { narrative: string; longterm_motif: string | null; question: string; }; }
export interface RecapWeeklyRecapPhase2 { phase2: { narrative_check: string; deepening_questions: string[]; block5_material: { cialo: string; duch: string; konto: string; }; }; }

type RecapWeeklyRecapResponse = RecapWeeklyRecapPhase1 | RecapWeeklyRecapPhase2;
export type RecapResponse = RecapReflectionResponse | RecapWeeklySynthesisResponse | RecapWeeklyRecapResponse;

interface AutoClassifyStreamResponse {
  success: boolean;
  classification: {
    importance_score: number; category: string; tags: string[]; temporality: string;
    fingerprint_text: string | null; is_closure: boolean;
    closed_topic_description: string | null; expiration_date: string | null;
    [key: string]: unknown;
  };
  friction_detected: boolean; event_kind: string | null;
  friction_type: string | null; extraction_quality: number | null;
}

interface AutoClassifyTodoClassifyResponse { ok: boolean; ai_bucket: string; ai_classified_at: string; due_date?: string; priority?: string; }
interface AutoClassifyTodoExtractResponse { tasks: Array<{ title: string; due_date: string | null; priority: string | null; }>; }

type AutoClassifyResponse = AutoClassifyStreamResponse | AutoClassifyTodoClassifyResponse | AutoClassifyTodoExtractResponse;

interface CalendarWriteResponse { success: boolean; eventId?: string; error?: string; }

export interface KeepTriageResponse {
  suggestions: Array<{ id: string; action: 'keep' | 'archive' | 'todo'; category: string; takeaways: string[]; reasoning: string; }>;
  totalStale: number;
}

interface ParseFoodNLResponse {
  items?: Array<{
    name: string; grams: number; calories: number; protein: number; carbs: number; fat: number;
    fiber?: number; sugar?: number; barcode?: string | null; brand?: string | null;
    confidence: 'high' | 'medium' | 'low'; source: 'llm' | 'database' | 'library'; assumptions?: string[];
    parseMeta?: { macroSource: string; matchScore?: number; matchedName?: string; parserVersion: string; };
  }>;
  label?: {
    barcode: null; name: string; brand: string | null;
    calories: number; protein: number; carbs: number; fat: number;
    fiber: number | null; sugar: number | null; defaultGrams: number;
    source: 'label_ocr'; confidence: 'high' | 'medium' | 'low';
  };
}

interface CaptureVaultResponse { success: true; chunks: number; triads: number; message: string; }
interface CaptureLinkResponse { ok: true; type: 'link'; data: Record<string, unknown>; }
interface CaptureStreamResponse { ok: true; type: 'stream'; data: Record<string, unknown>; }
interface CaptureTranscriptionResponse { ok: true; type: 'transcription'; transcript: string; }
interface CaptureOcrResponse { ok: true; type: 'ocr'; text: string; }

type CaptureResponse = CaptureVaultResponse | CaptureLinkResponse | CaptureStreamResponse | CaptureTranscriptionResponse | CaptureOcrResponse;

interface NightlyResponse {
  success: boolean; run_id: string;
  freshness: { oura_fresh: boolean; nutrition_fresh: boolean; warnings: string[]; };
  [key: string]: unknown;
}

interface NutritionCoachResponse {
  success: boolean; date: string;
  signals: {
    today: { target_kcal: number; deficit_kcal: number; protein_floor_g: number; remaining_kcal: number; remaining_protein: number; intake_so_far?: number; };
    energy: { est_maintenance: number; underlog_gap_kcal: number; };
    body: { weight_trend_kg_per_week: number; };
    forecast: { days_to_goal_est: number | null; adaptive_correction_kcal: number | null; [key: string]: unknown; };
    [key: string]: unknown;
  };
  verdict: {
    summary: string; trajectory: 'on_track' | 'behind' | 'ahead'; trajectory_note: string;
    forecast_note: string; today_focus: string; flags: string[]; protein_note: string; food_suggestions: string[];
  } | null;
  verdictError: string | null; notified: boolean; persistError: string | null;
}

interface SyncOuraResponse { success: true; total_upserted: number; batches: number; warnings?: string[]; }
interface SyncStravaResponse { ok: true; synced: number; primary: number; oura_duplicates: number; paired: number; rate_limited: boolean; }
interface SyncCalendarResponse { success: true; calendarCount?: number; }

type SyncResponse = SyncOuraResponse | SyncStravaResponse | SyncCalendarResponse;

interface LookupFoodResponse {
  results: Array<{
    barcode: string | null; name: string; brand: string | null;
    calories: number | null; protein: number | null; carbs: number | null; fat: number | null;
    fiber: number | null; sugar: number | null; defaultGrams: number | null;
    source?: 'generic' | 'reference_pl' | 'off';
    incomplete?: boolean;
  }>;
  status: 'ok' | 'unavailable' | 'rate_limited';
  incompleteCount: number;
}

// ── Registry ─────────────────────────────────────────────────────────

export interface EdgeFunctionResponses {
  'analyze-food-quality': AnalyzeFoodQualityResponse;
  'analyze-training-load': AnalyzeTrainingLoadResponse;
  'recap': RecapResponse;
  'vanguard-auto-classify': AutoClassifyResponse;
  'calendar-write': CalendarWriteResponse;
  'vanguard-keep-triage': KeepTriageResponse;
  'parse-food-nl': ParseFoodNLResponse;
  'vanguard-capture': CaptureResponse;
  'vanguard-nightly': NightlyResponse;
  'vanguard-nutrition-coach': NutritionCoachResponse;
  'sync': SyncResponse;
  'lookup-food': LookupFoodResponse;
}
