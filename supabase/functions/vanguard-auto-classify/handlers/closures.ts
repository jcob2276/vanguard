import { getEmbedding } from "../../_shared/openai.ts";
import { sendMessage } from "../../_shared/telegram.ts";
import { NormalizedClassification } from "./normalize.ts";

const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const TELEGRAM_CHAT_ID = parseInt(Deno.env.get('TELEGRAM_CHAT_ID') || '0');

export async function handleClosureProposals(
  record: any,
  classification: NormalizedClassification,
  embedding: number[],
  supabase: any
): Promise<void> {
  if (!classification.closed_topic_description) return;
  
  console.log(`[auto-classify] closing topic: ${classification.closed_topic_description}`);
  const closureEmbedding = await getEmbedding(classification.closed_topic_description, Deno.env.get('OPENAI_API_KEY') ?? '');

  if (closureEmbedding) {
    const CLOSURE_THRESHOLD = 0.65;
    const { data: matches, error: matchErr } = await supabase.rpc('match_vanguard_content', {
      query_embedding: closureEmbedding,
      match_threshold: CLOSURE_THRESHOLD,
      match_count: 5,
      user_id_param: record.user_id,
    });
    if (matchErr) console.error('[auto-classify] match_vanguard_content failed:', matchErr);
    const idsToClose = (matches || [])
      .filter((m: any) => m.table_name === 'vanguard_stream' && m.id !== record.id)
      .map((m: any) => m.id);
    if (idsToClose.length > 0) {
      const { data: proposalData } = await supabase
        .from('vanguard_stream_closure_proposals')
        .insert({
          user_id: record.user_id,
          proposed_by_record_id: record.id,
          target_record_ids: idsToClose,
          closed_topic_description: classification.closed_topic_description,
          similarity_threshold: CLOSURE_THRESHOLD,
          status: 'pending',
        })
        .select('id')
        .single();

      console.log(`[auto-classify] closure proposal created for ${idsToClose.length} record(s), topic: ${classification.closed_topic_description}`);

      // Send Telegram notification with approve/reject buttons
      if (proposalData?.id && TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
        const proposalId = proposalData.id;
        const topicSnippet = classification.closed_topic_description.substring(0, 120);
        await sendMessage(TELEGRAM_TOKEN, TELEGRAM_CHAT_ID,
          `🔄 *Zamknięcie wątku?*\n\nSystem wykrył że ta notatka może zamykać temat:\n_${topicSnippet}_\n\nDotyczy ${idsToClose.length} wpis(ów) w strumieniu.\n\nZatwierdzić? Wpisy przestaną być widoczne dla Oracle.`,
          {
            parseMode: 'Markdown',
            replyMarkup: {
              inline_keyboard: [[
                { text: '✅ Zamknij wątek', callback_data: `closure_approve_${proposalId}` },
                { text: '❌ Zostaw otwarty', callback_data: `closure_reject_${proposalId}` },
              ]],
            },
          }
        ).catch((err: Error) => console.warn('[auto-classify] closure Telegram notify failed:', err.message));
      }
    }
  }
}
