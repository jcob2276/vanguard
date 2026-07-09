import { answerCallbackQuery, clearInlineKeyboard } from "../../_shared/telegram.ts";
import { logAuditEvent } from "../../_shared/audit.ts";

export async function handleSaveClaimCallback(
  data: string,
  chatId: number,
  messageId: number,
  callbackId: string,
  supabase: any,
  telegramToken: string,
  vanguardUserId: string,
): Promise<void> {
  const auditEventId = data.replace("save_claim_", "");

  try {
    // 1. Fetch the proposed claim from audit_events
    const { data: auditEvent, error: fetchError } = await supabase
      .from("audit_events")
      .select("metadata")
      .eq("id", auditEventId)
      .maybeSingle();

    if (fetchError || !auditEvent || !auditEvent.metadata?.claim) {
      console.error("[telegram] Failed to fetch proposed claim:", fetchError);
      await answerCallbackQuery(telegramToken, callbackId, { text: "❌ Nie znaleziono faktu do zapisu." });
      return;
    }

    const claim = auditEvent.metadata.claim;

    // 2. Insert into public.vanguard_entity_links (so that triggers handle entities/relations/claims creation)
    const relationName = claim.type === "preference" ? "preferuje" : (claim.type === "recommendation" ? "ma_rekomendację" : "ma_fakt");
    const targetTruncated = claim.text.length > 100 ? claim.text.substring(0, 97) + "..." : claim.text;

    const { error: insertError } = await supabase
      .from("vanguard_entity_links")
      .insert({
        user_id: vanguardUserId,
        source_entity: "Jakub",
        source_type: "person",
        relation: relationName,
        target_entity: targetTruncated,
        target_type: "concept",
        fact_text: claim.text,
        confidence_score: 1.0,
        memory_type: claim.type === "preference" ? "preference" : "fact",
        status: "active",
        weight: 1.0,
        evidence_count: 1
      });

    if (insertError) {
      console.error("[telegram] Failed to insert entity link:", insertError);
      await answerCallbackQuery(telegramToken, callbackId, { text: "❌ Błąd zapisu faktu." });
      return;
    }

    // 3. Mark the audit event proposal as accepted
    const updatedMetadata = { ...auditEvent.metadata, status: "accepted" };
    await supabase
      .from("audit_events")
      .update({ metadata: updatedMetadata })
      .eq("id", auditEventId);

    // 4. Acknowledge and clear the button from Telegram message
    await answerCallbackQuery(telegramToken, callbackId, { text: "✅ Fakt został zapisany do bazy wiedzy!" });
    await clearInlineKeyboard(telegramToken, chatId, messageId);

    // 5. Log audit event of successful save
    await logAuditEvent({
      eventType: "claim_saved_from_chat",
      severity: "info",
      message: `User manually saved claim from conversation: "${claim.text}"`,
      userId: vanguardUserId,
      metadata: { claim_text: claim.text, audit_event_id: auditEventId }
    });

  } catch (err: any) {
    console.error("[telegram] Error saving claim callback:", err);
    await answerCallbackQuery(telegramToken, callbackId, { text: "❌ Wystąpił błąd." });
  }
}
