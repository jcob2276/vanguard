import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createServiceClient, corsHeaders } from "../_shared/supabase.ts"
import { getVanguardUserId } from "../_shared/constants.ts"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';

async function judgeAnswer(params: {
  question: string;
  expected_answer: string;
  expected_claims: string[];
  actual_answer: string;
}): Promise<{ score: number; passed: boolean; notes: string }> {
  const { question, expected_answer, expected_claims, actual_answer } = params;
  const claimsList = (expected_claims || []).map((c, i) => `${i + 1}. ${c}`).join('\n');

  const prompt = `Jesteś sędzią oceniającym jakość odpowiedzi systemu AI (Vanguard Oracle).

PYTANIE: ${question}

OCZEKIWANA ODPOWIEDŹ (wzorzec):
${expected_answer}

OCZEKIWANE TWIERDZENIA (każde musi być obecne):
${claimsList || '(brak)'}

FAKTYCZNA ODPOWIEDŹ SYSTEMU:
${actual_answer}

Oceń faktyczną odpowiedź w skali 0.0–1.0:
- 1.0 = zawiera wszystkie oczekiwane twierdzenia, jest spójna z wzorcem
- 0.7–0.9 = zawiera większość twierdzeń, drobne braki lub nieścisłości
- 0.4–0.6 = częściowo poprawna, brakuje kluczowych informacji
- 0.0–0.3 = zła odpowiedź, halucynacje, brakuje podstawowych faktów

Odpowiedz TYLKO w JSON:
{"score": 0.0, "passed": false, "notes": "uzasadnienie po polsku (max 2 zdania)"}

PRÓG ZALICZENIA: score >= 0.7`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!res.ok) {
    const err = await res.text();
    return { score: 0, passed: false, notes: `Judge API error: ${err.substring(0, 100)}` };
  }

  const data = await res.json();
  try {
    const parsed = JSON.parse(data.choices[0].message.content);
    return {
      score: Number(parsed.score ?? 0),
      passed: Boolean(parsed.passed ?? false),
      notes: String(parsed.notes ?? '')
    };
  } catch {
    return { score: 0, passed: false, notes: 'Failed to parse judge response' };
  }
}

async function runEval(run_id: string, questions: any[], user_id: string, offset = 0, total = 0, isFinalBatch = true) {
  const supabase = createServiceClient();
  let passed = 0;
  let failed = 0;
  let totalScore = 0;
  const byDifficulty: Record<string, { passed: number; total: number }> = {};
  const byCategory: Record<string, { passed: number; total: number; avg_score: number; total_score: number }> = {};

  try {
    const { data: recentBiometrics } = await supabase
      .from('vanguard_daily_aggregates')
      .select('date, final_state, sleep_hours, hrv_avg, execution_score, dopamine_load_index, readiness_score, sleep_score, activity_score')
      .eq('user_id', user_id)
      .order('date', { ascending: false })
      .limit(7);

    const stateVector = {
      biometrics: recentBiometrics || [],
      eval_context: {
        source: 'vanguard_eval_runner',
        biometrics_days: recentBiometrics?.length || 0
      }
    };

    for (const q of questions) {
      try {
        const { data: oracleData, error: oracleErr } = await supabase.functions.invoke('vanguard-oracle', {
          body: {
            current_query: q.question,
            user_id,
            mode: 'chat',
            thinking: false,
            state_vector: stateVector,
            history: []
          }
        });

        let actualAnswer = '';
        if (oracleErr) {
          actualAnswer = `[ORACLE ERROR: ${oracleErr.message}]`;
        } else {
          actualAnswer = (oracleData?.text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        }

        const judgment = await judgeAnswer({
          question: q.question,
          expected_answer: q.expected_answer || '',
          expected_claims: q.expected_claims || [],
          actual_answer: actualAnswer
        });

        const { error: insertResultErr } = await supabase.from('vanguard_eval_results').upsert({
          run_id,
          user_id,
          question_id: q.id,
          question: q.question,
          category: q.category || 'fact_recall',
          difficulty: q.difficulty || 'medium',
          answer: actualAnswer,
          score: judgment.score,
          passed: judgment.passed,
          sources: oracleData?.sources || [],
          claims: oracleData?.claims || [],
          judge_notes: judgment.notes,
          raw_response: { oracle: oracleData }
        }, { onConflict: 'run_id,question_id' });
        if (insertResultErr) {
          console.error(`[eval] Failed to insert result for Q[${q.id}]:`, insertResultErr);
          throw insertResultErr;
        }

        if (judgment.passed) passed++; else failed++;
        totalScore += judgment.score;

        const diff = q.difficulty || 'medium';
        if (!byDifficulty[diff]) byDifficulty[diff] = { passed: 0, total: 0 };
        byDifficulty[diff].total++;
        if (judgment.passed) byDifficulty[diff].passed++;

        const cat = q.category || 'fact_recall';
        if (!byCategory[cat]) byCategory[cat] = { passed: 0, total: 0, avg_score: 0, total_score: 0 };
        byCategory[cat].total++;
        byCategory[cat].total_score += judgment.score;
        byCategory[cat].avg_score = Math.round((byCategory[cat].total_score / byCategory[cat].total) * 1000) / 1000;
        if (judgment.passed) byCategory[cat].passed++;

        console.log(`[eval] Q[${q.id.substring(0,8)}] score=${judgment.score.toFixed(2)} passed=${judgment.passed}`);
        await new Promise(r => setTimeout(r, 300));

      } catch (err: any) {
        console.error(`[eval] Error on Q[${q.id}]:`, err);
        failed++;
        const { error: insertErr } = await supabase.from('vanguard_eval_results').upsert({
          run_id, user_id,
          question_id: q.id,
          question: q.question,
          category: q.category || 'fact_recall',
          difficulty: q.difficulty || 'medium',
          answer: '', score: 0, passed: false,
          judge_notes: `Runner exception: ${err.message}`
        }, { onConflict: 'run_id,question_id' });
        if (insertErr) {
          console.error(`[eval] Failed to save error result for Q[${q.id}]:`, insertErr);
        }
      }
    }

    // Finalizuj tylko jeśli to ostatni batch
    if (isFinalBatch) {
      // Policz summary ze WSZYSTKICH wyników w DB (nie tylko bieżącego batcha)
      const { data: allResults } = await supabase
        .from('vanguard_eval_results')
        .select('score, passed, category, difficulty')
        .eq('run_id', run_id);

      const allRes = allResults || [];
      const totalAll = allRes.length;
      const passedAll = allRes.filter(r => r.passed).length;
      const avgAll = totalAll > 0 ? allRes.reduce((s, r) => s + (r.score || 0), 0) / totalAll : 0;

      const byCategoryAll: Record<string, any> = {};
      const byDifficultyAll: Record<string, any> = {};
      for (const r of allRes) {
        const cat = (r as any).category || 'fact_recall';
        if (!byCategoryAll[cat]) byCategoryAll[cat] = { passed: 0, total: 0, total_score: 0 };
        byCategoryAll[cat].total++;
        byCategoryAll[cat].total_score += r.score || 0;
        if (r.passed) byCategoryAll[cat].passed++;

        const diff = (r as any).difficulty || 'medium';
        if (!byDifficultyAll[diff]) byDifficultyAll[diff] = { passed: 0, total: 0, total_score: 0 };
        byDifficultyAll[diff].total++;
        byDifficultyAll[diff].total_score += r.score || 0;
        if (r.passed) byDifficultyAll[diff].passed++;
      }
      for (const cat of Object.keys(byCategoryAll)) {
        const d = byCategoryAll[cat];
        d.avg_score = Math.round((d.total_score / d.total) * 1000) / 1000;
        delete d.total_score;
      }
      for (const diff of Object.keys(byDifficultyAll)) {
        const d = byDifficultyAll[diff];
        d.avg_score = Math.round((d.total_score / d.total) * 1000) / 1000;
        delete d.total_score;
      }

      const summary = {
        total: totalAll, passed: passedAll, failed: totalAll - passedAll,
        avg_score: Math.round(avgAll * 1000) / 1000,
        pass_rate: totalAll > 0 ? Math.round((passedAll / totalAll) * 1000) / 1000 : 0,
        by_category: byCategoryAll,
        by_difficulty: byDifficultyAll,
        judge_model: 'gpt-4o-mini'
      };

      const { error: updateRunErr } = await supabase.from('vanguard_eval_runs').update({
        status: 'completed', summary, completed_at: new Date().toISOString()
      }).eq('id', run_id);
      if (updateRunErr) {
        console.error(`[eval] Failed to update run status:`, updateRunErr);
        throw updateRunErr;
      }

      console.log(`[eval] DONE run=${run_id} pass_rate=${(totalAll > 0 ? passedAll/totalAll*100 : 0).toFixed(1)}% (${passedAll}/${totalAll})`);
    } else {
      console.log(`[eval] Batch done run=${run_id} offset=${offset} questions=${questions.length}`);
    }

  } catch (err: any) {
    console.error('[eval] Fatal in runEval:', err);
    const { error: updateErr } = await supabase.from('vanguard_eval_runs').update({
      status: 'failed',
      summary: { error: err.message, passed, failed },
      completed_at: new Date().toISOString()
    }).eq('id', run_id);
    if (updateErr) {
      console.error(`[eval] Failed to mark run ${run_id} as failed:`, updateErr);
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createServiceClient();

  try {
    const body = await req.json().catch(() => ({}));

    // STATUS action — zwraca progress bieżącego runa
    if (body.action === 'status' && body.run_id) {
      const run_id = body.run_id;
      const [runRes, resultsRes] = await Promise.all([
        supabase.from('vanguard_eval_runs').select('status, summary, started_at').eq('id', run_id).single(),
        supabase.from('vanguard_eval_results').select('score, passed, category, difficulty').eq('run_id', run_id)
      ]);
      const results = resultsRes.data || [];
      const total = results.length;
      const passed = results.filter(r => r.passed).length;
      const avgScore = total > 0 ? results.reduce((s, r) => s + (r.score || 0), 0) / total : 0;
      const byCategory: Record<string, { total: number; passed: number }> = {};
      for (const r of results) {
        const cat = (r as any).category || 'unknown';
        if (!byCategory[cat]) byCategory[cat] = { total: 0, passed: 0 };
        byCategory[cat].total++;
        if (r.passed) byCategory[cat].passed++;
      }
      return new Response(JSON.stringify({
        run: runRes.data,
        results_count: total,
        passed,
        avg_score: Math.round(avgScore * 1000) / 1000,
        by_category: byCategory
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const suite = body.suite || 'vanguard_v1';
    const user_id = body.user_id || getVanguardUserId();
    const oracle_version = body.oracle_version || 'v1';
    const model = body.model || 'deepseek-chat';
    const batch_size = body.batch_size ? Number(body.batch_size) : 8;
    const offset = body.offset ? Number(body.offset) : 0;

    // CONTINUE mode: run_id podany → kontynuuj istniejący run od offset
    let run_id: string;
    let allQuestions: any[];

    if (body.run_id) {
      run_id = body.run_id;
      // Pobierz wszystkie pytania i zastosuj offset
      const { data: qs, error: qErr } = await supabase
        .from('vanguard_eval_questions')
        .select('*')
        .eq('suite', suite)
        .eq('is_active', true)
        .order('id');
      if (qErr) throw new Error(`Failed to fetch questions: ${qErr.message}`);
      allQuestions = qs || [];
    } else {
      // NEW run
      const { data: qs, error: qErr } = await supabase
        .from('vanguard_eval_questions')
        .select('*')
        .eq('suite', suite)
        .eq('is_active', true)
        .order('id');
      if (qErr) throw new Error(`Failed to fetch questions: ${qErr.message}`);
      if (!qs || qs.length === 0) throw new Error(`No active questions in suite: ${suite}`);
      allQuestions = qs;

      const { data: runData, error: runErr } = await supabase
        .from('vanguard_eval_runs')
        .insert({ user_id, suite, model, oracle_version, status: 'running', started_at: new Date().toISOString() })
        .select('id')
        .single();
      if (runErr) throw new Error(`Failed to create run: ${runErr.message}`);
      run_id = runData.id;
    }

    const total = allQuestions.length;
    const batch = allQuestions.slice(offset, offset + batch_size);
    const finished = offset + batch.length >= total;

    // Synchronous batch — waitUntil is unreliable on Supabase Edge (work is cut off after response)
    await runEval(run_id, batch, user_id, offset, total, finished);

    return new Response(JSON.stringify({
      success: true,
      run_id,
      offset_next: offset + batch.length,
      batch_done: batch.length,
      total,
      finished,
      message: `Batch ${offset}–${offset + batch.length - 1} of ${total} started`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (err: any) {
    console.error('[eval-runner] Fatal error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
