/**
 * CRUD + helpers dla tabeli vanguard_behavioral_patterns (Etap 1).
 */

import { safeExecute } from '../supabase.ts';
import { getWarsawDateString } from '../time.ts';
import type { PatternInsight, BehavioralPattern } from './types.ts';

/**
 * Helper: czy warto pokazać insight w danym kontekście (bridge / brief).
 */
export function shouldSurfaceInsight(insight: PatternInsight, minConfidence = 0.55, minSample = 3): boolean {
  if (insight.type === 'plan_adherence_gap') {
    return insight.confidence >= 0.6; // dla adherence nawet pojedynczy mocny dzień ma wartość
  }
  return insight.confidence >= minConfidence && insight.sampleSize >= minSample;
}

/**
 * Zapisuje wykryty wzorzec do dedykowanej tabeli vanguard_behavioral_patterns (Etap 1).
 * Zwraca id stworzonego wiersza (lub null przy błędzie).
 */
export async function recordBehavioralPattern(
  supabase: any,
  userId: string,
  insight: PatternInsight
): Promise<string | null> {
  try {
    const today = getWarsawDateString();

    // Prosty signature dla deduplikacji
    const signature = `${insight.type}:${insight.title.toLowerCase().replace(/\s+/g, '_').substring(0, 80)}`;

    const { data, error } = await supabase
      .from('vanguard_behavioral_patterns')
      .upsert({
        user_id: userId,
        pattern_type: insight.type,
        signature,
        title: insight.title,
        evidence_text: insight.evidenceText,
        first_seen: insight.lastSeenDate || today,
        last_seen: today,
        occurrence_count: 1,
        confidence: insight.confidence,
        status: 'visible',
        metadata: insight.metadata || {},
      }, {
        onConflict: 'user_id,signature',
        ignoreDuplicates: false
      })
      .select('id')
      .single();

    if (error) {
      console.warn('[vanguardPatterns] recordBehavioralPattern upsert error:', error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (e) {
    console.warn('[vanguardPatterns] recordBehavioralPattern failed (non-fatal):', e);
    return null;
  }
}

/**
 * Pobiera najświeższe, najsilniejsze wzorce behawioralne z dedykowanej tabeli (Etap 1).
 * Używane w morning-brief, Oracle i weekly synthesis.
 */
export async function getRecentStrongBehavioralPatterns(
  supabase: any,
  userId: string,
  limit = 5,
  includeRejected = false
): Promise<BehavioralPattern[]> {
  try {
    let query = supabase
      .from('vanguard_behavioral_patterns')
      .select('id, pattern_type, title, evidence_text, confidence, occurrence_count, status, last_seen')
      .eq('user_id', userId)
      .order('confidence', { ascending: false })
      .order('last_seen', { ascending: false })
      .limit(limit);

    if (!includeRejected) {
      query = query.in('status', ['visible', 'user_confirmed', 'pending']);
    }

    const data = await safeExecute(query);

    if (!data || data.length === 0) return [];

    return data.map((row: any) => ({
      id: row.id,
      pattern_type: row.pattern_type,
      title: row.title,
      evidence_text: row.evidence_text,
      confidence: row.confidence ?? 0.6,
      occurrence_count: row.occurrence_count ?? 1,
      status: row.status,
      last_seen: row.last_seen,
    }));
  } catch (e) {
    console.warn('[vanguardPatterns] getRecentStrongBehavioralPatterns failed:', e);
    return [];
  }
}

/**
 * Aktualizuje wzorzec na podstawie feedbacku użytkownika.
 * Używane przez patternFeedback handler.
 */
export async function updatePatternFeedback(
  supabase: any,
  userId: string,
  patternId: string,
  action: 'confirm' | 'reject' | 'snooze' | 'exception' | 'deception'
): Promise<boolean> {
  let newStatus: string;
  let confidenceDelta = 0;
  let extraMetadata: Record<string, any> = {};

  switch (action) {
    case 'confirm':
      newStatus = 'user_confirmed';
      confidenceDelta = 0.12;
      break;
    case 'reject':
      newStatus = 'user_rejected';
      confidenceDelta = -0.22;
      break;
    case 'snooze':
      newStatus = 'snoozed';
      confidenceDelta = -0.08;
      break;
    case 'exception':
      newStatus = 'user_rejected';
      confidenceDelta = -0.15;
      extraMetadata = { adherence_type: 'conscious_exception' };
      break;
    case 'deception':
      newStatus = 'user_confirmed';
      confidenceDelta = 0.20;
      extraMetadata = { adherence_type: 'self_deception' };
      break;
  }

  // Supabase query errors land in `error`, not a thrown exception — a try/catch around
  // the calls alone never sees an RLS rejection or bad patternId, so the caller (Telegram's
  // patternFeedback handler) would tell the user "saved" on a silently-failed update. Check
  // `error` explicitly and return success/failure so the caller can react.
  try {
    const { data: current, error: selectErr } = await supabase
      .from('vanguard_behavioral_patterns')
      .select('confidence, occurrence_count, metadata')
      .eq('id', patternId)
      .eq('user_id', userId)
      .single();

    if (selectErr) {
      console.warn('[vanguardPatterns] updatePatternFeedback select failed:', selectErr.message);
      return false;
    }

    const newConfidence = Math.max(0.1, Math.min(0.98,
      (current?.confidence ?? 0.6) + confidenceDelta
    ));

    const { error: updateErr } = await supabase
      .from('vanguard_behavioral_patterns')
      .update({
        status: newStatus,
        confidence: newConfidence,
        metadata: {
          ...(current?.metadata || {}),
          ...extraMetadata,
        },
        updated_at: new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Warsaw' })).toISOString(),
      })
      .eq('id', patternId)
      .eq('user_id', userId);

    if (updateErr) {
      console.warn('[vanguardPatterns] updatePatternFeedback update failed:', updateErr.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[vanguardPatterns] updatePatternFeedback failed:', e);
    return false;
  }
}

/**
 * Podstawowe logowanie/audyt przed testami Etapu 1.
 * Zaznacza, że dany wzorzec (szczególnie early warning) został faktycznie pokazany użytkownikowi.
 * Aktualizuje last_seen oraz last_shown w metadanych.
 */
export async function markPatternAsShown(
  supabase: any,
  patternId: string,
  date: string = getWarsawDateString()
): Promise<void> {
  try {
    const { data: current } = await supabase
      .from('vanguard_behavioral_patterns')
      .select('metadata')
      .eq('id', patternId)
      .single();

    await supabase
      .from('vanguard_behavioral_patterns')
      .update({
        last_seen: date,
        metadata: {
          ...(current?.metadata || {}),
          last_shown: date,
        },
      })
      .eq('id', patternId);
  } catch (e) {
    console.warn('[vanguardPatterns] markPatternAsShown failed:', e);
  }
}

/**
 * Mały helper do pobierania recent early warningów.
 * Używany w morning-brief i komendzie `wzorce` dla czystszego kodu.
 */
export async function getRecentEarlyWarnings(
  supabase: any,
  userId: string,
  limit = 5
): Promise<any[]> {
  try {
    const data = await safeExecute(
      supabase
        .from('vanguard_behavioral_patterns')
        .select('id, evidence_text, last_seen, confidence, status, metadata')
        .eq('user_id', userId)
        .eq('pattern_type', 'early_warning')
        .in('status', ['visible', 'user_confirmed'])
        .order('last_seen', { ascending: false })
        .limit(limit)
    );

    // Flatten last_shown for easier use in UI/history
    return (data || []).map((row: any) => ({
      ...row,
      last_shown: row.metadata?.last_shown || null,
    }));
  } catch (e) {
    console.warn('[vanguardPatterns] getRecentEarlyWarnings failed:', e);
    return [];
  }
}
