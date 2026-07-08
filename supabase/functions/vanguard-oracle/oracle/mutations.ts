import { logCriticalError } from "../../_shared/errorLogging.ts";

export async function logOracleRun(supabase: any, params: {
  user_id: string;
  query: string;
  intent: string;
  answer: string;
  confidence: string;
  claims: any[];
  sources: any[];
  retrieved_context: {
    semantic: any[];
    graph: any[];
    health_14d: any;
  };
  state_vector: any;
}) {
  try {
    const runId = crypto.randomUUID();
    const runRecord = { id: runId, ...params };
    await supabase.from('vanguard_oracle_runs').insert(runRecord).throwOnError();

    // Wyciągnij rekomendacje z claims
    const recommendations = (params.claims || []).filter((c: any) => c.type === 'recommendation');
    for (const rec of recommendations) {
      const text = rec.text || "";
      if (!text) continue;

      // Rozstrzygnij metrykę i próg
      let metric = rec.related_metric || "";
      let threshold = typeof rec.success_threshold === 'number' ? rec.success_threshold : null;
      const windowDays = typeof rec.evaluation_window_days === 'number' ? rec.evaluation_window_days : 7;

      if (!metric) {
        const t = text.toLowerCase();
        if (t.includes("sen") || t.includes("spać") || t.includes("sleep") || t.includes("zasyp")) {
          metric = "sleep_hours";
          if (threshold === null) threshold = 7.5;
        } else if (t.includes("trening") || t.includes("strain") || t.includes("sport") || t.includes("workout") || t.includes("ćwicz")) {
          metric = "readiness_score";
          if (threshold === null) threshold = 70.0;
        } else if (t.includes("zadania") || t.includes("wykonan") || t.includes("todo") || t.includes("task")) {
          metric = "execution_score";
          if (threshold === null) threshold = 0.8;
        } else {
          metric = "execution_score";
          if (threshold === null) threshold = 0.8;
        }
      } else {
        if (threshold === null) {
          if (metric === "sleep_hours") threshold = 7.5;
          else if (metric === "readiness_score") threshold = 70.0;
          else if (metric === "execution_score") threshold = 0.8;
          else threshold = 1.0;
        }
      }

      // Walidacja czy metryka jest na allowliście
      const ALLOWED_METRICS = ['sleep_hours', 'readiness_score', 'execution_score'];
      if (!ALLOWED_METRICS.includes(metric)) {
        console.warn(`[oracle] Discarding invalid/unsafe metric: ${metric}, defaulting to execution_score`);
        metric = "execution_score";
        if (threshold === null || threshold === 1.0) {
          threshold = 0.8;
        }
      }

      // Zapisz rekomendację jako obiekt w public.oracle_recommendations
      const { error: recErr } = await supabase
        .from('oracle_recommendations')
        .insert({
          user_id: params.user_id,
          oracle_run_id: runId,
          recommendation_text: text,
          related_metric: metric,
          success_threshold: threshold,
          evaluation_window_days: windowDays,
          status: 'pending'
        });

      if (recErr) {
        console.error('[oracle] Failed to save recommendation:', recErr.message);
      } else {
        console.log('[oracle] Saved recommendation:', text, 'for metric:', metric);
      }
    }
  } catch (e) {
    await logCriticalError({
      area: 'oracle',
      error: e,
      message: 'Failed to insert oracle run audit log',
    });
  }
}

export async function saveClarificationRequest(supabase: any, user_id: string, cr: any) {
  if (cr.question && cr.response_type && cr.dedupe_key) {
    const { error: crErr } = await supabase
      .from('oracle_clarification_requests')
      .upsert({
        user_id,
        question: cr.question,
        response_type: cr.response_type,
        options: cr.options || [],
        dedupe_key: cr.dedupe_key,
        evidence_fact_ids: cr.evidence_fact_ids || [],
        proposed_memory: cr.proposed_memory || null,
        confidence: cr.confidence ?? 0.5,
        status: 'pending',
      }, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true });
    if (crErr) {
      console.warn('[oracle] clarification_request insert failed (non-fatal):', crErr.message);
    } else {
      console.log('[oracle] clarification_request saved:', cr.dedupe_key);
    }
  }
}

export async function createPendingAction(supabase: any, user_id: string, action_type: string, payload: any) {
  try {
    const { data: paData, error: paErr } = await supabase
      .from('oracle_pending_actions')
      .insert({
        user_id,
        action_type,
        payload,
        status: 'pending'
      })
      .select('id, action_type, payload')
      .single();
    if (paErr) throw paErr;
    console.log('[oracle] created pending action:', paData.id);
    return paData;
  } catch (e: any) {
    console.warn('[oracle] failed to create pending action:', e.message);
    return null;
  }
}

export async function applyInsightCardsMutation(supabase: any, user_id: string, mut: any) {
  try {
    if ((mut.action === 'add' || mut.action === 'update') && Array.isArray(mut.cards)) {
      for (const card of mut.cards) {
        const row = {
          user_id,
          template_id: card.template_id ?? card.widget_type ?? 'compact',
          title: card.title,
          insight: card.insight ?? null,
          widget_type: card.widget_type ?? null,
          widget_data: card.widget_data ?? {},
          tags: card.tags ?? [],
        };
        if (card.id) {
          await supabase.from('knowledge_insight_cards').upsert({ id: card.id, ...row }, { onConflict: 'id' });
        } else {
          await supabase.from('knowledge_insight_cards').insert(row);
        }
      }
    }
    if (mut.action === 'delete' && Array.isArray(mut.delete_ids)) {
      await supabase.from('knowledge_insight_cards').delete().in('id', mut.delete_ids).eq('user_id', user_id);
    }
    console.log('[oracle] insight_cards_mutation applied:', mut.action);
  } catch (e: any) {
    console.warn('[oracle] insight_cards_mutation failed (non-fatal):', e.message);
  }
}
