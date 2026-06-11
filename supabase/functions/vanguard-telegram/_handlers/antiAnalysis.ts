/**
 * antiAnalysis.ts — Anti-analysis guard + analysis action callbacks.
 * Zawiera:
 *  - checkAntiAnalysis(): LLM classifier wykrywający pure self-analysis
 *  - handleAnalysisActionCallback(): callbacks po wyzwaniu analizy
 *  - runAntiAnalysisGuard(): mid-flow guard wywoływany z message pipeline
 */

import { safeSendTelegram } from '../_utils/helpers.ts';
import { ackCallback } from '../_utils/callbackAck.ts';
import { deepseekChat } from '../../_shared/deepseek.ts';


export const ANALYSIS_ACTION_CALLBACKS = [
  'analysis_action_artifact', 'analysis_action_contact',
  'analysis_action_tension', 'analysis_action_finish'
];

export async function checkAntiAnalysis(text: string, deepseekApiKey: string): Promise<boolean> {
  try {
    const { content: answerRaw } = await deepseekChat({
      apiKey: deepseekApiKey,
      model: 'deepseek-v4-flash',
      temperature: 0.1,
      maxTokens: 10,
      messages: [{
        role: 'user',
        content: `Przeanalizuj tekst i określ, czy jest to czysta autoanaliza stanu psychicznego/emocjonalnego (self_analysis), projektowanie systemu/narzędzi (system_design), budowanie teorii/zasad/ram działania (framework_building), pre_mortem (teoretyzowanie o porażce przed działaniem) lub abstrakcyjne planowanie (abstract_planning) BEZ konkretnego, namacalnego fizycznego lub zewnętrznego działania (np. wysłanie maila, wdrożenie kodu, telefon do klienta, wykonanie zaplanowanego treningu). \nOdpowiedz TYLKO słowem "YES" jeśli to analiza bez namacalnego działania/artefaktu, lub "NO" w przeciwnym wypadku. Zero dodatkowych słów.\n\nTEKST DO OCENY:\n"${text.substring(0, 800)}"`
      }]
    });
    const answer = answerRaw.trim().toUpperCase();
    return answer.includes('YES');
  } catch (err) {
    console.error('[anti-analysis] Check failed:', err);
  }
  return false;
}


export async function handleAnalysisActionCallback(
  data: string,
  chatId: number,
  messageId: number,
  callbackId: string,
  telegramToken: string
): Promise<void> {
  let responseText = '';
  if (data === 'analysis_action_artifact') {
    responseText = 'Ok. Zdefiniuj go: co i kiedy konkretnie powstanie?';
  } else if (data === 'analysis_action_contact') {
    responseText = 'Kontakt. Do kogo dzwonisz/piszesz i z jakim pytaniem?';
  } else if (data === 'analysis_action_tension') {
    responseText = 'Ruch napięciowy. Jaka niewygodna akcja zostanie wykonana?';
  } else if (data === 'analysis_action_finish') {
    responseText = 'Koniec analizy. Wracaj do produkcji.';
  }

  await ackCallback(telegramToken, callbackId, chatId, messageId);
  await safeSendTelegram(chatId, responseText, telegramToken);
}

/**
 * Uruchamia guard w trakcie przetwarzania wiadomości.
 * Zwraca true jeśli guard przechwycił wiadomość (caller powinien return).
 */
export async function runAntiAnalysisGuard(
  cleanText: string,
  chatId: number,
  supabase: any,
  telegramToken: string,
  deepseekApiKey: string,
  userId: string
): Promise<boolean> {
  try {
    const isAnalysis = await checkAntiAnalysis(cleanText, deepseekApiKey);
    if (!isAnalysis) return false;

    console.log('[telegram] anti-analysis triggered');
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
    const { data: reconRows } = await supabase
      .from('daily_reconciliations')
      .select('id')
      .eq('user_id', userId)
      .eq('date', todayStr)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (reconRows?.id) {
      const { error: updateErr } = await supabase.from('daily_reconciliations')
        .update({ analysis_without_deployment: true })
        .eq('id', reconRows.id);
      if (updateErr) {
        console.error('[anti-analysis] failed to update analysis_without_deployment flag:', updateErr);
      }
    }

    await safeSendTelegram(chatId, 'To jest analiza. Jaki artefakt powstanie po niej w świecie?', telegramToken, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📄 Zbuduję artefakt', callback_data: 'analysis_action_artifact' },
            { text: '📞 Zadzwonię/napiszę', callback_data: 'analysis_action_contact' }
          ],
          [
            { text: '⚡ Zrobię ruch napięciowy', callback_data: 'analysis_action_tension' },
            { text: '✅ Kończę analizę', callback_data: 'analysis_action_finish' }
          ]
        ]
      }
    });
    return true;
  } catch (antiErr) {
    console.warn('[telegram] anti-analysis guard error (non-fatal):', antiErr);
    return false;
  }
}
