/**
 * @function vanguard-eval-runner
 * @trigger HTTP POST / manual
 * @role Uruchamia testy ewaluacyjne Wyroczni i zapisuje wyniki dokładności odpowiedzi.
 * @reads vanguard_eval_questions, vanguard_eval_runs, vanguard_eval_results, entities, claims, daily_reconciliations, vanguard_daily_aggregates, daily_wins
 * @writes vanguard_eval_runs, vanguard_eval_results
 * @calls gpt-4o (jako sędzia w judgeAnswer), deepseek-v4-flash (wyrocznia testowana)
 * @consumer Wyniki ewaluacji widoczne w logach / bazie dla dewelopera
 * @status active
 */
import { createServiceClient } from "../_shared/supabase.ts"
import { serveJson } from "../_shared/http.ts"
import { getVanguardUserId } from "../_shared/constants.ts"
import { getWarsawDateString } from "../_shared/time.ts"
import { evaluateQuestion } from "./evalEngine.ts"

async function runEval(run_id: string, questions: any[], user_id: string, offset = 0, total = 0, isFinalBatch = true) {
  const supabase = createServiceClient();
  let passed = 0;
  let failed = 0;
  let totalScore = 0;

  try {
    const todayWarsawDate = getWarsawDateString();
    const [{ data: recentBiometrics }, { data: todayWin }, { data: planRows }] = await Promise.all([
      supabase.from('vanguard_daily_aggregates').select('date, final_state, sleep_hours, hrv_avg, execution_score, dopamine_load_index, readiness_score, sleep_score, activity_score').eq('user_id', user_id).order('date', { ascending: false }).limit(7),
      supabase.from('daily_wins').select('task_1, done_1, task_2, done_2, task_3, done_3, task_4, done_4, task_5, done_5, result').eq('user_id', user_id).eq('date', todayWarsawDate).maybeSingle(),
      supabase.from('daily_reconciliations').select('planning_summary, answered_at').eq('user_id', user_id).not('planning_summary', 'is', null).order('created_at', { ascending: false }).limit(5),
    ]);

    const todayPlan = (planRows || []).find((r: any) => r.planning_summary?.target_date === todayWarsawDate && !r.planning_summary?.parse_error)?.planning_summary || null;
    const stateVector = {
      biometrics: recentBiometrics || [],
      discipline: { today_wins: todayWin || 'Nie ustawiono celów' },
      ...(todayPlan ? { today_plan: todayPlan } : {}),
      eval_context: { source: 'vanguard_eval_runner', biometrics_days: recentBiometrics?.length || 0 }
    };

    const byCategory: Record<string, { passed: number; total: number; avg_score: number; total_score: number }> = {};
    const byDifficulty: Record<string, { passed: number; total: number }> = {};

    for (const q of questions) {
      try {
        const { data: oracleData, error: oracleErr } = await supabase.functions.invoke('vanguard-oracle', {
          body: { current_query: q.question, user_id, mode: 'chat', thinking: false, state_vector: stateVector, history: [] }
        });

        let actualAnswer = oracleErr ? `[ORACLE ERROR: ${oracleErr.message}]` : (oracleData?.text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

        const judgment = await evaluateQuestion(q, actualAnswer);

        const { error: insertResultErr } = await supabase.from('vanguard_eval_results').upsert({
          run_id, user_id, question_id: q.id, question: q.question,
          category: q.category || 'fact_recall', difficulty: q.difficulty || 'medium',
          answer: actualAnswer, score: judgment.score, passed: judgment.passed,
          sources: oracleData?.sources || [], claims: oracleData?.claims || [],
          judge_notes: judgment.notes, raw_response: { oracle: oracleData }
        }, { onConflict: 'run_id,question_id' });
        if (insertResultErr) throw insertResultErr;

        if (judgment.passed) passed++; else failed++;
        totalScore += judgment.score;

        const cat = q.category || 'fact_recall';
        if (!byCategory[cat]) byCategory[cat] = { passed: 0, total: 0, avg_score: 0, total_score: 0 };
        byCategory[cat].total++;
        byCategory[cat].total_score += judgment.score;
        byCategory[cat].avg_score = Math.round((byCategory[cat].total_score / byCategory[cat].total) * 1000) / 1000;
        if (judgment.passed) byCategory[cat].passed++;

        const diff = q.difficulty || 'medium';
        if (!byDifficulty[diff]) byDifficulty[diff] = { passed: 0, total: 0 };
        byDifficulty[diff].total++;
        if (judgment.passed) byDifficulty[diff].passed++;

        console.log(`[eval] Q[${q.id.substring(0,8)}] score=${judgment.score.toFixed(2)} passed=${judgment.passed}`);
        await new Promise(r => setTimeout(r, 300));
      } catch (err: any) {
        console.error(`[eval] Error on Q[${q.id}]:`, err);
        failed++;
        await supabase.from('vanguard_eval_results').upsert({
          run_id, user_id, question_id: q.id, question: q.question,
          category: q.category || 'fact_recall', difficulty: q.difficulty || 'medium',
          answer: '', score: 0, passed: false, judge_notes: `Runner exception: ${err.message}`
        }, { onConflict: 'run_id,question_id' });
      }
    }

    if (isFinalBatch) {
      const { data: allResults } = await supabase.from('vanguard_eval_results').select('score, passed, category, difficulty').eq('run_id', run_id);
      const allRes = allResults || [];
      const totalAll = allRes.length;
      const passedAll = allRes.filter(r => r.passed).length;
      const avgAll = totalAll > 0 ? allRes.reduce((s, r) => s + (r.score || 0), 0) / totalAll : 0;

      const byCategoryAll: Record<string, { passed: number; total: number; total_score?: number; avg_score?: number }> = {};
      const byDifficultyAll: Record<string, { passed: number; total: number; total_score?: number; avg_score?: number }> = {};
      for (const r of allRes) {
        const row = r as Record<string, unknown>;
        const cat = (row.category as string) || 'fact_recall';
        if (!byCategoryAll[cat]) byCategoryAll[cat] = { passed: 0, total: 0, total_score: 0 };
        const cd = byCategoryAll[cat];
        cd.total++; cd.total_score = (cd.total_score ?? 0) + ((r.score as number) || 0); if (r.passed) cd.passed++;
        const diff = (row.difficulty as string) || 'medium';
        if (!byDifficultyAll[diff]) byDifficultyAll[diff] = { passed: 0, total: 0, total_score: 0 };
        const dd = byDifficultyAll[diff];
        dd.total++; dd.total_score = (dd.total_score ?? 0) + ((r.score as number) || 0); if (r.passed) dd.passed++;
      }
      for (const cat of Object.keys(byCategoryAll)) { const d = byCategoryAll[cat]; d.avg_score = Math.round(((d.total_score ?? 0) / d.total) * 1000) / 1000; delete d.total_score; }
      for (const diff of Object.keys(byDifficultyAll)) { const d = byDifficultyAll[diff]; d.avg_score = Math.round(((d.total_score ?? 0) / d.total) * 1000) / 1000; delete d.total_score; }

      const summary = { total: totalAll, passed: passedAll, failed: totalAll - passedAll, avg_score: Math.round(avgAll * 1000) / 1000, pass_rate: totalAll > 0 ? Math.round((passedAll / totalAll) * 1000) / 1000 : 0, by_category: byCategoryAll, by_difficulty: byDifficultyAll, judge_model: 'gpt-4o-mini' };

      const { error: updateRunErr } = await supabase.from('vanguard_eval_runs').update({ status: 'completed', summary, completed_at: new Date().toISOString() }).eq('id', run_id);
      if (updateRunErr) throw updateRunErr;
      console.log(`[eval] DONE run=${run_id} pass_rate=${(totalAll > 0 ? passedAll/totalAll*100 : 0).toFixed(1)}% (${passedAll}/${totalAll})`);
    } else {
      console.log(`[eval] Batch done run=${run_id} offset=${offset} questions=${questions.length}`);
    }
  } catch (err: any) {
    console.error('[eval] Fatal in runEval:', err);
    await supabase.from('vanguard_eval_runs').update({ status: 'failed', summary: { error: err.message, passed, failed }, completed_at: new Date().toISOString() }).eq('id', run_id);
  }
}

Deno.serve(serveJson(async (req, ctx) => {
  const supabase = ctx.supabase;
  const body = await req.clone().json().catch(() => ({}));

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
    for (const r of results) { const cat = (r as Record<string, unknown>).category as string || 'unknown'; if (!byCategory[cat]) byCategory[cat] = { total: 0, passed: 0 }; byCategory[cat].total++; if (r.passed) byCategory[cat].passed++; }
    return { run: runRes.data, results_count: total, passed, avg_score: Math.round(avgScore * 1000) / 1000, by_category: byCategory };
  }

  const suite = body.suite || 'vanguard_v1';
  const user_id = body.user_id || getVanguardUserId();
  const oracle_version = body.oracle_version || 'v1';
  const model = body.model || 'deepseek-v4-flash';
  const batch_size = body.batch_size ? Number(body.batch_size) : 8;
  const offset = body.offset ? Number(body.offset) : 0;

  let run_id: string;
  let allQuestions: any[];

  if (body.run_id) {
    run_id = body.run_id;
    const { data: qs, error: qErr } = await supabase.from('vanguard_eval_questions').select('*').eq('suite', suite).eq('is_active', true).order('id');
    if (qErr) throw new Error(`Failed to fetch questions: ${qErr.message}`);
    allQuestions = qs || [];
  } else {
    const { data: qs, error: qErr } = await supabase.from('vanguard_eval_questions').select('*').eq('suite', suite).eq('is_active', true).order('id');
    if (qErr) throw new Error(`Failed to fetch questions: ${qErr.message}`);
    if (!qs || qs.length === 0) throw new Error(`No active questions in suite: ${suite}`);
    allQuestions = qs;

    const { data: runData, error: runErr } = await supabase.from('vanguard_eval_runs').insert({ user_id, suite, model, oracle_version, status: 'running', started_at: new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Warsaw' })).toISOString() }).select('id').single();
    if (runErr) throw new Error(`Failed to create run: ${runErr.message}`);
    run_id = runData.id;
  }

  const total = allQuestions.length;
  const batch = allQuestions.slice(offset, offset + batch_size);
  const finished = offset + batch.length >= total;
  await runEval(run_id, batch, user_id, offset, total, finished);

  return { success: true, run_id, offset_next: offset + batch.length, batch_done: batch.length, total, finished, message: `Batch ${offset}–${offset + batch.length - 1} of ${total} started` };
}, { auth: 'service' }));
