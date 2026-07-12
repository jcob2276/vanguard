/**
 * closureProposal.ts — Human gate for bi-temporal stream closures.
 *
 * When auto-classify detects is_closure=true, it inserts a proposal into
 * vanguard_stream_closure_proposals with status='pending' and sends a Telegram
 * message with these buttons.
 *
 * On ✅ approve: target records get valid_until = now() → removed from Oracle retrieval.
 * On ❌ reject:  proposal marked rejected, stream records untouched.
 */

import {
  answerCallbackQuery,
  clearInlineKeyboard,
} from "../../_shared/telegram.ts";
import { safeSendTelegram } from "../_utils/helpers.ts";
import { closeStreamRecords } from "../../_shared/repos/streamRepo.ts";

export function isClosureCallback(data: string): boolean {
  return data.startsWith("closure_approve_") || data.startsWith("closure_reject_");
}

export async function handleClosureCallback(
  data: string,
  chatId: number,
  messageId: number,
  callbackId: string,
  supabase: any,
  telegramToken: string,
): Promise<void> {
  const isApprove = data.startsWith("closure_approve_");
  const proposalId = isApprove
    ? data.slice("closure_approve_".length)
    : data.slice("closure_reject_".length);

  if (!proposalId) {
    await answerCallbackQuery(telegramToken, callbackId, { text: "❌ Brak ID propozycji" });
    return;
  }

  // Fetch proposal
  const { data: proposal, error: fetchErr } = await supabase
    .from("vanguard_stream_closure_proposals")
    .select("id, status, target_record_ids, closed_topic_description")
    .eq("id", proposalId)
    .maybeSingle();

  if (fetchErr || !proposal) {
    console.error("[closureProposal] fetch error:", fetchErr);
    await answerCallbackQuery(telegramToken, callbackId, { text: "❌ Nie znaleziono propozycji" });
    return;
  }

  if (proposal.status !== "pending") {
    await answerCallbackQuery(telegramToken, callbackId, {
      text: `Już rozpatrzone: ${proposal.status}`
    });
    await clearInlineKeyboard(telegramToken, chatId, messageId);
    return;
  }

  const now = new Date().toISOString();

  if (isApprove) {
    // Close the target stream records
    try {
      await closeStreamRecords(supabase, proposal.target_record_ids, now);
    } catch (streamErr) {
      console.error("[closureProposal] stream update error:", streamErr);
      await answerCallbackQuery(telegramToken, callbackId, { text: "❌ Błąd zamknięcia" });
      return;
    }

    // Approve the proposal — checked: the stream records are already closed above, so a
    // silently-failed status update here would leave this proposal stuck "pending" forever
    // while telling the user (and logging) that it succeeded.
    const { error: approveErr } = await supabase
      .from("vanguard_stream_closure_proposals")
      .update({ status: "approved", resolved_at: now })
      .eq("id", proposalId);
    if (approveErr) console.error("[closureProposal] proposal status update (approved) failed:", approveErr);

    await answerCallbackQuery(telegramToken, callbackId, { text: "✅ Wątek zamknięty" });
    await clearInlineKeyboard(telegramToken, chatId, messageId);
    await safeSendTelegram(
      chatId,
      `✅ Zamknięto wątek: _${proposal.closed_topic_description}_\n${proposal.target_record_ids.length} wpis(y) wygasły — Oracle już ich nie widzi.`,
      telegramToken,
    );

    console.log(`[closureProposal] approved proposal=${proposalId}, closed ${proposal.target_record_ids.length} records`);
  } else {
    // Reject — leave stream records untouched
    const { error: rejectErr } = await supabase
      .from("vanguard_stream_closure_proposals")
      .update({ status: "rejected", resolved_at: now })
      .eq("id", proposalId);
    if (rejectErr) console.error("[closureProposal] proposal status update (rejected) failed:", rejectErr);

    await answerCallbackQuery(telegramToken, callbackId, { text: "❌ Odrzucone — wątek otwarty" });
    await clearInlineKeyboard(telegramToken, chatId, messageId);
    await safeSendTelegram(
      chatId,
      `❌ Wątek pozostaje otwarty: _${proposal.closed_topic_description}_`,
      telegramToken,
    );

    console.log(`[closureProposal] rejected proposal=${proposalId}`);
  }
}
