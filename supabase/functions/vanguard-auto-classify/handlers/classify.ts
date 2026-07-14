import { getEmbedding } from "../../_shared/openai.ts";
import { safeExecute } from "../../_shared/supabase.ts";
import { getAggregateByDate } from "../../_shared/repos/aggregatesRepo.ts";
import { logAuditEvent } from "../../_shared/audit.ts";
import { updateStreamClassification } from "../../_shared/repos/streamRepo.ts";
import { deepseekChat, parseJsonFromContent } from "../../_shared/deepseek.ts";
import { LLM_TASKS } from "../../_shared/llm/tasks.ts";
import { getWarsawDateString } from "../../_shared/time.ts";
import { CLASSIFY_SYSTEM, FRICTION_SYSTEM } from "../prompts.ts";
import { normalizeClassification, normalizeFriction } from "./normalize.ts";
import { handleClosureProposals } from "./closures.ts";

export async function handleStreamRecord(record: any, supabase: any): Promise<unknown> {
  if (!record || !record.content || !record.user_id) {
    return { message: 'No content to classify' };
  }

  // Skip system-generated entries (anchors, planning summaries, Oracle responses, etc.)
  // These are written by Vanguard itself and don't represent user behaviour to classify.
  if (record.source === 'system') {
    console.log(`[auto-classify] skipping system record: ${record.id}`);
    return { message: 'system source, skipped' };
  }

  // Idempotency gate: skip if already classified (webhook retry / double-trigger protection)
  // != null (not truthy) — importance_score: 0 is a valid score and must not look "unclassified"
  if (record.classification != null && record.importance_score != null) {
    console.log(`[auto-classify] already classified, skipping: ${record.id}`);
    return { message: 'already classified' };
  }

  console.log(`[auto-classify] start for record: ${record.id}`);

  const today = getWarsawDateString();

  const aggregate = await getAggregateByDate(supabase, record.user_id, today);

  const contextStr = aggregate
    ? `BIOMETRIA DZIŚ: HRV ${aggregate.hrv_avg}, Sen ${aggregate.sleep_hours}h, Stan: ${aggregate.final_state}.`
    : 'BIOMETRIA DZIŚ: Brak danych.';

  const apiKey = Deno.env.get('DEEPSEEK_API_KEY') || '';

  // === KROK 1: Klasyfikacja i KROK 2: Friction detection (równolegle) ===
  let classifyRes, frictionRes;
  try {
    [classifyRes, frictionRes] = await Promise.all([
      deepseekChat({
        apiKey,
        ...LLM_TASKS.classify,
        messages: [
          { role: 'system', content: CLASSIFY_SYSTEM },
          { role: 'user', content: `KONTEKST: ${contextStr}\nNOTATKA: ${record.content}` },
        ],
        maxTokens: null,
      }),
      deepseekChat({
        apiKey,
        ...LLM_TASKS.classify,
        messages: [
          { role: 'system', content: FRICTION_SYSTEM },
          { role: 'user', content: record.content },
        ],
        maxTokens: null,
      }),
    ]);
  } catch (err: any) {
    console.error(`[auto-classify] DeepSeek error:`, err);
    throw new Error(`DeepSeek upstream error (record_id=${record.id}): ${err.message}`);
  }

  // === Parse klasyfikacja ===
  let classificationRaw = parseJsonFromContent(classifyRes.content || '{}');
  if (!classificationRaw) {
    console.error(`[auto-classify] classify JSON parse failed, using fallback. Raw: ${(classifyRes.content || '').slice(0, 200)}`);
    await logAuditEvent({
      eventType: 'classify_parse_fallback',
      severity: 'warning',
      message: 'auto-classify: classify JSON parse failed, used Chaos fallback',
      userId: record.user_id,
      relatedTable: 'vanguard_stream',
      relatedId: record.id,
      metadata: { raw_response: (classifyRes.content || '').slice(0, 500) },
    });
    classificationRaw = {
      importance_score: 5,
      category: 'Chaos',
      tags: [],
      temporality: 'tymczasowe',
      fingerprint_text: null,
      is_closure: false,
      closed_topic_description: null,
      expiration_date: null,
    };
  }
  const classification = normalizeClassification(classificationRaw);

  // Tymczasowe wpisy bez wyraźnej daty wygaśnięcia dostają domyślne +3 dni
  if (classification.temporality === 'tymczasowe' && !classification.expiration_date) {
    const fallbackExpiry = new Date();
    fallbackExpiry.setDate(fallbackExpiry.getDate() + 3);
    classification.expiration_date = fallbackExpiry.toISOString();
  }

  // === Parse friction ===
  let frictionRaw = parseJsonFromContent(frictionRes.content || '{"is_relevant":false}');
  if (!frictionRaw) {
    console.error(`[auto-classify] friction JSON parse failed, using fallback. Raw: ${(frictionRes.content || '').slice(0, 200)}`);
    await logAuditEvent({
      eventType: 'friction_parse_fallback',
      severity: 'warning',
      message: 'auto-classify: friction JSON parse failed, used is_relevant=false fallback',
      userId: record.user_id,
      relatedTable: 'vanguard_stream',
      relatedId: record.id,
      metadata: { raw_response: (frictionRes.content || '').slice(0, 500) },
    });
    frictionRaw = { is_relevant: false, event_kind: null, friction_type: null };
  }
  const friction = normalizeFriction(frictionRaw);

  console.log(`[auto-classify] category=${classification.category}, is_relevant=${friction.is_relevant}, kind=${friction.event_kind}, type=${friction.friction_type}`);

  // === Wektoryzacja fingerprint ===
  let embedding: number[] | null = null;
  if (classification.fingerprint_text) {
    const rawEmbedding = await getEmbedding(classification.fingerprint_text, Deno.env.get('OPENAI_API_KEY') ?? '');
    if (rawEmbedding && Array.isArray(rawEmbedding) && typeof rawEmbedding[0] === 'number') {
      embedding = rawEmbedding as number[];
    }
  }

  // === Bi-temporalna logika: zamykanie wątków ===
  if (classification.is_closure && classification.closed_topic_description && embedding) {
    await handleClosureProposals(record, classification, embedding, supabase);
  }

  // === INSERT friction_event jeśli wykryto mikrotarcie, gest lub obserwację ===
  const shouldLog = friction.event_kind !== null && friction.event_kind !== undefined;
  let extractionQuality: number | null = null;

  if (shouldLog) {
    const existingFriction = await safeExecute(
      supabase
        .from('friction_events')
        .select('id')
        .eq('stream_record_id', record.id)
        .maybeSingle()
    );

    if (existingFriction) {
      console.log(`[auto-classify] friction_event already exists for stream record: ${record.id}`);
    } else {
      let criticalFields: string[] = [];

      if (friction.event_kind === 'friction_event') {
        criticalFields = ['declared_intention', 'actual_behavior', 'deviation'];
      } else if (friction.event_kind === 'positive_micro_action' || friction.event_kind === 'recovery_event') {
        criticalFields = ['actual_behavior'];
      } else if (friction.event_kind === 'state_observation' || friction.event_kind === 'micro_behavior_observation') {
        criticalFields = ['actual_behavior', 'emotional_state'];
      } else {
        criticalFields = ['actual_behavior'];
      }

      const present = criticalFields.filter(f => {
        const val = friction[f];
        return val && String(val).trim().length > 3;
      });
      extractionQuality = criticalFields.length > 0
        ? Math.round((present.length / criticalFields.length) * 100)
        : 70;

      const finalStatus = 'raw';

      let dbEventKind = friction.event_kind;
      if (dbEventKind === 'recovery_event') {
        dbEventKind = 'positive_micro_action';
      }

      const dbAllowedEventKinds = [
        'friction_event',
        'positive_micro_action',
        'state_observation',
        'micro_behavior_observation',
        'reflection'
      ];
      if (dbEventKind !== null && !dbAllowedEventKinds.includes(dbEventKind)) {
        console.warn(`[auto-classify] Warning: event_kind '${dbEventKind}' not allowed in DB check constraint. Clamping to null.`);
        dbEventKind = null;
      }

      await safeExecute(
        supabase
          .from('friction_events')
          .insert({
            user_id: record.user_id,
            stream_record_id: record.id,
            occurred_at: record.created_at || new Date().toISOString(),
            raw_text: record.content,
            event_kind: dbEventKind,
            friction_type: friction.friction_type || 'other',
            declared_intention: friction.declared_intention || null,
            actual_behavior: friction.actual_behavior || null,
            deviation: friction.deviation || null,
            immediate_cost: friction.immediate_cost || null,
            emotional_state: friction.emotional_state || null,
            people_involved: Array.isArray(friction.people_involved) && friction.people_involved.length > 0
              ? friction.people_involved
              : typeof friction.people_involved === 'string' && friction.people_involved.length > 0
                ? [friction.people_involved]
                : null,
            location_context: friction.location_context || null,
            confidence_source: 'inferred',
            confidence: null,
            status: finalStatus,
            extraction_quality: extractionQuality,
            parser_version: 'auto-classify-v41',
          })
      );
      console.log(`[auto-classify] friction_event inserted: ${dbEventKind} (raw: ${friction.event_kind}) | ${friction.friction_type} | quality=${extractionQuality}% | status=${finalStatus}`);
    }
  }

  // === Update stream record (mint-then-fill: zapisane na końcu) ===
  await updateStreamClassification(supabase, record.id, {
    importance_score: classification.importance_score,
    category: classification.category,
    tags: classification.tags,
    situation_fingerprint: embedding,
    classification: classification.category?.toLowerCase(),
    valid_from: record.valid_from || record.created_at || new Date().toISOString(),
    valid_until: classification.expiration_date || null,
  });

  return {
    success: true,
    classification,
    friction_detected: friction.is_relevant && (friction.event_kind === 'friction_event' || friction.event_kind === 'positive_micro_action' || friction.event_kind === 'recovery_event'),
    event_kind: friction.event_kind || null,
    friction_type: friction.friction_type || null,
    extraction_quality: extractionQuality,
  };
}
