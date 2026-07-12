/**
 * @function vanguard-metabolism
 * @trigger HTTP POST / manual
 * @role Metabolizm: kondensuje i trawi historyczne dane ze streamu, budując beliefs i narracje.
 * @reads vanguard_stream, entities, claims, vanguard_daily_aggregates, vanguard_entity_links
 * @writes vanguard_stream (condensed/archived status), vanguard_daily_aggregates, vanguard_entity_links
 * @calls deepseek-v4-flash
 * @consumer Baza danych i RAG Wyroczni (zmniejszenie szumu)
 * @status active
 */
import { deepseekChat } from "../_shared/deepseek.ts";
import { serveJson } from "../_shared/http.ts";
import { getVanguardUserId } from "../_shared/constants.ts";
import { getWarsawDateString } from "../_shared/time.ts";

Deno.serve(serveJson(async (_req, ctx) => {
  const supabase = ctx.supabase;
  const userId = getVanguardUserId();
  const now = new Date();
  // 90 days ago
  const cutoffDate = getWarsawDateString(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000));

  // 1. Pobieramy max 30 nieskondensowanych dni starszych niż 90 dni
  const { data: rawDays, error } = await supabase
    .from('vanguard_daily_aggregates')
    .select('date, execution_score, sleep_hours, hrv_avg, readiness_score, final_state')
    .eq('user_id', userId)
    .eq('condensed', false)
    .lt('date', cutoffDate)
    .order('date', { ascending: true })
    .limit(30);

  if (error) throw error;
  if (!rawDays || rawDays.length === 0) {
    return { status: "No old data to condense" };
  }

  const firstDate = rawDays[0].date;
  const lastDate = rawDays[rawDays.length - 1].date;

  const dataDump = rawDays.map(d =>
    `Data: ${d.date} | Exec: ${d.execution_score ?? '-'} | Sen(h): ${d.sleep_hours ?? '-'} | HRV: ${d.hrv_avg ?? '-'} | Readiness: ${d.readiness_score ?? '-'} | Stan: ${d.final_state ?? '-'}`
  ).join('\n');

  const prompt = `Jesteś procesem "Vanguard Metabolism". Twoim zadaniem jest skondensowanie starych, surowych logów z okresu (${firstDate} do ${lastDate}) do jednego wartościowego "wspomnienia" (Narrative Belief).

SUROWE DANE:
${dataDump}

INSTRUKCJA:
Przeanalizuj te ${rawDays.length} dni. Wyciągnij GŁÓWNE WNIOSKI: co Jakuba w tym okresie najczęściej blokowało? Jakie było jego średnie wykonanie, sen i gotowość (readiness)? Czy widoczny jest jakiś schemat (np. "gdy sen był krótszy, execution_score spadał")?
Napisz 1 zwięzły paragraf (max 500 znaków), który zostanie zapisany jako "Belief" w jego grafie wiedzy. Ma to być informacja przydatna w przyszłości.
Odpowiedz TYLKO JSONem w formacie:
{"narrative_belief": "..."}`;

  const { content } = await deepseekChat({
    apiKey: Deno.env.get('DEEPSEEK_API_KEY') ?? '',
    model: 'deepseek-chat',
    responseFormat: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
    timeoutMs: 30000,
  });

  const parsed = JSON.parse(content);
  const beliefText = parsed.narrative_belief;

  if (!beliefText) throw new Error("No belief generated");

  // 2. Wrzucenie jako belief do vanguard_entity_links (lub zapamiętanie w wiedzy)
  const { error: insertErr } = await supabase
    .from('vanguard_entity_links')
    .insert({
      user_id: userId,
      source_entity: `Kondensacja: ${firstDate} - ${lastDate}`,
      target_entity: 'Jakub',
      relation: 'HISTORYCZNY_WRAŻLIWY_PUNKT',
      fact_text: beliefText,
      confidence_score: 0.9,
      evidence_count: rawDays.length,
      status: 'active'
    });

  if (insertErr) throw insertErr;

  // 3. Oznaczenie dni jako 'condensed' = true
  const idsToUpdate = rawDays.map(d => d.date);
  const { error: updateErr } = await supabase
    .from('vanguard_daily_aggregates')
    .update({ condensed: true })
    .in('date', idsToUpdate)
    .eq('user_id', userId);

  if (updateErr) throw updateErr;

  return {
    status: "Condensed successfully",
    days_processed: rawDays.length,
    belief_generated: beliefText
  };
}, { auth: 'service' }));
