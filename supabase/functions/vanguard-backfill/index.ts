import { getEmbedding } from "../_shared/openai.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createServiceClient, corsHeaders } from "../_shared/supabase.ts"
import { deepseekChat } from "../_shared/deepseek.ts"


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createServiceClient();

    const body = await req.json().catch(() => ({}));
    const { table, mode, start_date, end_date, limit, dry_run = false } = body;

    if (mode === 'friction-backfill') {
      const start = start_date || '2026-05-24T00:00:00Z';
      const end = end_date || '2026-06-11T23:59:59Z';
      const frictionLimit = limit ?? 15;

      console.log(`🚀 Starting friction-backfill mode from ${start} to ${end} (dry_run: ${dry_run}, limit: ${frictionLimit})...`);

      // 1. Fetch stream records in the date range (excluding system source)
      const { data: records, error: fetchError } = await supabase
        .from('vanguard_stream')
        .select('id, created_at, content, user_id, source, metadata')
        .neq('source', 'system')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;
      if (!records || records.length === 0) {
        return new Response(JSON.stringify({ success: true, message: "No stream records found in this range" }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 2. Fetch existing friction events to filter out processed records
      const { data: frictionEvents, error: feError } = await supabase
        .from('friction_events')
        .select('stream_record_id');

      if (feError) throw feError;

      const processedStreamIds = new Set(frictionEvents.map(fe => fe.stream_record_id).filter(Boolean));

      // Filter out records that already have a friction event or have been processed by backfill
      const recordsToProcess = records.filter(r => {
        const meta = r.metadata as any || {};
        return !processedStreamIds.has(r.id) && meta.friction_backfilled !== true;
      });

      console.log(`Total stream records in range: ${records.length}. Records missing friction: ${recordsToProcess.length}`);

      if (recordsToProcess.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: "All stream records in range already have friction events or are marked as processed",
          total_in_range: records.length,
          remaining_to_process: 0
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const batch = recordsToProcess.slice(0, frictionLimit);
      const results: any[] = [];
      let successCount = 0;

      for (const record of batch) {
        if (dry_run) {
          results.push({
            record_id: record.id,
            created_at: record.created_at,
            content_preview: record.content.substring(0, 80),
            status: "dry_run_skipped"
          });
          continue;
        }

        console.log(`Processing record ${record.id} (${record.created_at})...`);

        const { content: rawContentParsed } = await deepseekChat({
          apiKey: Deno.env.get('DEEPSEEK_API_KEY') ?? '',
          model: 'deepseek-v4-flash',
          temperature: 0.1,
          maxTokens: 500,
          responseFormat: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `Jesteś detektorem obserwacji behawioralnych i mikrotarć Vanguard OS.
Analizujesz tekst i klasyfikujesz go do jednego z poniższych typów (\`event_kind\`):

1. \`friction_event\` — konkretne tarcie behawioralne (odchylenie zachowania od intencji).
   - **Musi** zawierać jednocześnie: (a) intencję/zamiar co miało być zrobione + (b) wyraźne odchylenie w zachowaniu.
   - Jeśli brak jednej z tych dwóch rzeczy → nie dawaj \`friction_event\`, daj \`state_observation\` lub \`micro_behavior_observation\`.
   - Przykład: "miałem napisać raport ale znowu odłożyłem" lub "chciałem poprosić do tańca ale się zawahałem".
2. \`positive_micro_action\` — dobry mikrogest, pozytywne mikrozachowanie.
   - Przykład: "podałem ramię przy schodach" lub "powiedziałem komplement".
3. \`state_observation\` — stan emocjonalny lub fizyczny użytkownika bez jawnego odchylenia intencji.
   - Przykład: "jadę na wesele, boli mnie brzuch, stresuję się" lub "jestem zmęczony, mam dziś mało energii".
4. \`micro_behavior_observation\` — zaobserwowane zachowanie bez jawnej intencji w danym momencie (nawykowe gesty, tiki, sposoby reakcji).
   - Przykład: "zauważyłem, że nie patrzę w oczy podczas mówienia".
5. \`reflection\` — refleksja, generalizacja, wniosek, przemyślenia.
   - Przykład: "ludzie boją się ciszy, więc gadają o byle czym".

Jeśli tekst nie opisuje żadnego z powyższych (np. jest to zwykłe neutralne powiadomienie, suchy plan dnia bez opisu wykonania, pytanie) → set \`is_relevant = false\` i \`event_kind = null\`.
W przeciwnym wypadku set \`is_relevant = true\`.

**Krytyczna zasada anty-fałszywych tarć:**
- \`friction_event\` tylko gdy w tekście jest **jawna lub jasno implikowana intencja** + **odchylenie od niej**.
- Czysty stan (ból, zmęczenie, stres) bez odchylenia → \`state_observation\`.
- Zaobserwowane nawykowe zachowanie bez intencji w momencie → \`micro_behavior_observation\`.

SŁOWNIK friction_type (dla wszystkich typów oprócz 'reflection' i neutralnych, jeśli pasuje):
- sleep_disruption: późne spanie, zaspanie, nocny ekran zamiast snu
- avoidance: unikanie sytuacji/osoby/tematu mimo że miał podejść
- procrastination: odkładanie zadania mimo że miał je zrobić
- habit_break: przerwanie rutyny (siłownia, dieta, nawyk)
- training_drop: skrócenie/pominięcie treningu
- social_hesitation: zawahanie w sytuacji społecznej (nie poprosił do tańca, nie zagadał, unikał kontaktu wzrokowego)
- communication_drift: nie odpisał, skrócił rozmowę, nie powiedział czegoś wprost
- emotional_spike: nieoczekiwana, silna reakcja emocjonalna
- self_control_break: złamanie własnej zasady (nie pić, nie sprawdzać telefonu, nie jeść X)
- positive_micro_action: dobry mikrogest (podał ramię, zaproponował napój, powiedział komplement)
- other: inne odchylenie lub stan niepasujący do powyższych

Zwróć TYLKO JSON:
{
  "is_relevant": boolean,
  "event_kind": "friction_event" | "positive_micro_action" | "state_observation" | "micro_behavior_observation" | "reflection" | null,
  "friction_type": "sleep_disruption"|"avoidance"|"procrastination"|"habit_break"|"training_drop"|"social_hesitation"|"communication_drift"|"emotional_spike"|"self_control_break"|"positive_micro_action"|"other"|null,
  "declared_intention": "dosłownie z tekstu co miało być zrobione (lub null jeśli nie podano)",
  "actual_behavior": "dosłownie z tekstu co się stało/co zaobserwowano (lub null)",
  "deviation": "różnica między intencją a zachowaniem — tylko jeśli obie strony są jawne w tekście (lub null)",
  "immediate_cost": "TYLKO jeśli koszt jest jawnie wymieniony w tekście (lub null)",
  "emotional_state": "stan emocjonalny jeśli wymieniony (lub null)",
  "people_involved": ["osoby jeśli wymienione z imienia"],
  "location_context": "miejsce jeśli wymienione (lub null)"
}`
            },
            {
              role: 'user',
              content: record.content
            }
          ]
        });

        const friction = JSON.parse(rawContentParsed || '{"is_relevant":false}');


        let isInserted = false;
        let extractionQuality: number | null = null;

        if (friction.event_kind !== null && friction.event_kind !== undefined) {
          let criticalFields: string[] = [];
          if (friction.event_kind === 'friction_event') {
            criticalFields = ['declared_intention', 'actual_behavior', 'deviation'];
          } else if (friction.event_kind === 'positive_micro_action') {
            criticalFields = ['actual_behavior'];
          } else if (friction.event_kind === 'state_observation' || friction.event_kind === 'micro_behavior_observation') {
            criticalFields = ['actual_behavior', 'emotional_state'];
          } else {
            criticalFields = ['actual_behavior'];
          }

          const present = criticalFields.filter(f => friction[f] && String(friction[f]).trim().length > 3);
          extractionQuality = criticalFields.length > 0
            ? Math.round((present.length / criticalFields.length) * 100)
            : 70;

          // Insert directly into friction_events
          const { error: insertError } = await supabase
            .from('friction_events')
            .insert({
              user_id: record.user_id,
              stream_record_id: record.id,
              occurred_at: record.created_at,
              raw_text: record.content,
              event_kind: friction.event_kind,
              friction_type: friction.friction_type || 'other',
              declared_intention: friction.declared_intention || null,
              actual_behavior: friction.actual_behavior || null,
              deviation: friction.deviation || null,
              immediate_cost: friction.immediate_cost || null,
              emotional_state: friction.emotional_state || null,
              people_involved: friction.people_involved?.length > 0 ? friction.people_involved : null,
              location_context: friction.location_context || null,
              confidence_source: 'inferred',
              confidence: null,
              status: 'raw',
              extraction_quality: extractionQuality,
              parser_version: 'backfill-friction-v41'
            });

          if (insertError) {
            console.error(`Insert error for record ${record.id}:`, insertError);
            results.push({ record_id: record.id, error: insertError.message });
          } else {
            successCount++;
            isInserted = true;
          }
        }

        // Always update metadata to mark as backfilled to avoid infinite reprocessing
        const currentMeta = record.metadata as any || {};
        const { error: metaError } = await supabase
          .from('vanguard_stream')
          .update({
            metadata: {
              ...currentMeta,
              friction_backfilled: true
            }
          })
          .eq('id', record.id);

        if (metaError) {
          console.error(`Metadata update error for record ${record.id}:`, metaError);
        }

        results.push({
          record_id: record.id,
          created_at: record.created_at,
          event_kind: friction.event_kind || null,
          friction_type: friction.friction_type || null,
          extraction_quality: extractionQuality,
          status: isInserted ? "inserted" : "processed_no_friction"
        });

        // Small rate limit avoidance delay
        await new Promise(r => setTimeout(r, 100));
      }

      return new Response(JSON.stringify({
        success: true,
        processed: batch.length,
        updated_friction_events: successCount,
        results,
        remaining_to_process: recordsToProcess.length - batch.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Embeddings backfill mode (original code)
    const embeddingLimit = limit ?? 50;

    if (!table || !['vanguard_knowledge', 'vanguard_stream', 'daily_wins'].includes(table)) {
      throw new Error(`Unsupported table: ${table || 'undefined'}`);
    }

    console.log(`🚀 Starting backfill for ${table}...`);

    // 1. Get records without embeddings
    const { data: records, error: fetchError } = await supabase
      .from(table)
      .select('*')
      .is('embedding', null)
      .limit(embeddingLimit);

    if (fetchError) throw fetchError;
    if (!records || records.length === 0) {
      return new Response(JSON.stringify({ message: `No missing embeddings in ${table}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${records.length} records to process.`);

    let successCount = 0;

    for (const record of records) {
      let text = "";
      if (table === 'vanguard_knowledge') {
        text = `${record.title}\n\n${record.content}`;
      } else if (table === 'vanguard_stream') {
        text = record.content;
      } else if (table === 'daily_wins') {
        text = `Dziennik: ${record.journal_entry}\n\nWdzięczność: ${record.gratitude_entry}`;
      }

      if (!text || text.trim() === "") continue;

      // 2. Generate embedding
      const embedding = await getEmbedding(text.substring(0, 3000), Deno.env.get('OPENAI_API_KEY') ?? '');

      if (embedding) {
        // 3. Update record
        const { error: updateError } = await supabase
          .from(table)
          .update({ embedding })
          .eq('id', record.id);

        if (updateError) {
          console.error(`Update Error for ${record.id}:`, updateError);
        } else {
          successCount++;
        }
      }

      // Basic rate limiting avoidance
      await new Promise(r => setTimeout(r, 50));
    }

    return new Response(JSON.stringify({
      success: true,
      processed: records.length,
      updated: successCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("Backfill Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
