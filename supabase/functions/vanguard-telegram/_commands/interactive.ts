import { safeSendTelegram } from "../_utils/helpers.ts";

export async function handleInteractivePromptCommand(
  lowerText: string,
  chatId: number,
  telegramToken: string,
): Promise<boolean> {
  if (lowerText === '🛋️ lenie' || lowerText === '/lenie') {
    await safeSendTelegram(chatId, "🛋️ **Zapis Lenie**\nPodaj bodziec i kontekst (np. `scrollowanie | zmęczenie`):", telegramToken, {
      reply_markup: {
        force_reply: true,
        selective: true,
        input_field_placeholder: "bodziec | kontekst"
      }
    });
    return true;
  }

  if (lowerText === '❓ wyrocznia') {
    await safeSendTelegram(chatId, "❓ **Zadaj pytanie Wyroczni**\nNapisz swoje pytanie do Vanguard Oracle:", telegramToken, {
      reply_markup: {
        force_reply: true,
        selective: true,
        input_field_placeholder: "Twoje pytanie..."
      }
    });
    return true;
  }

  if (lowerText === '📝 todo' || lowerText === '/todo') {
    await safeSendTelegram(chatId, "📝 **Nowe zadanie**\nWpisz co masz do zrobienia (opcjonalnie: `+jutro` `+tydzień` `!high`):", telegramToken, {
      reply_markup: {
        force_reply: true,
        selective: true,
        input_field_placeholder: "np. Zadzwoń do Marka +jutro !high"
      }
    });
    return true;
  }

  if (lowerText === '🍴 posiłek' || lowerText === '/posilek' || lowerText === '/posiłek') {
    await safeSendTelegram(chatId, "🍴 **Co zjadłeś?**\nOpisz posiłek (np. `makaron z serkiem tłustym piątnica`):", telegramToken, {
      reply_markup: {
        force_reply: true,
        selective: true,
        input_field_placeholder: "np. 2 jajka sadzone i kromka chleba",
      },
    });
    return true;
  }

  if (lowerText === '📒 keep' || lowerText === '/keep' || lowerText === '/notatka') {
    await safeSendTelegram(chatId, "📒 **Vanguard Keep**\nWpisz notatkę lub nagraj głosówkę:", telegramToken, {
      reply_markup: {
        force_reply: true,
        selective: true,
        input_field_placeholder: "Twoja notatka..."
      }
    });
    return true;
  }

  return false;
}
