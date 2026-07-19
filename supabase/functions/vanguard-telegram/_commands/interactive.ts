import { safeSendTelegram } from "../_utils/helpers.ts";

export async function handleInteractivePromptCommand(
  lowerText: string,
  chatId: number,
  telegramToken: string,
): Promise<boolean> {
  if (lowerText === '🛋️ lenie' || lowerText === '/lenie') {
    await safeSendTelegram(chatId, "• **Zapis Lenie**\nPodaj bodziec i kontekst (np. `scrollowanie | zmęczenie`):", telegramToken, {
      parse_mode: 'Markdown',
      reply_markup: {
        force_reply: true,
        selective: true,
        input_field_placeholder: "bodziec | kontekst"
      }
    });
    return true;
  }

  if (lowerText === '⏳ post' || lowerText === '/post') {
    await safeSendTelegram(chatId, "• **Zapis postu**\nWpisz opis postu (lub `wczoraj opis` / zostaw puste):", telegramToken, {
      parse_mode: 'Markdown',
      reply_markup: {
        force_reply: true,
        selective: true,
        input_field_placeholder: "np. wczoraj 18h albo głodówka"
      }
    });
    return true;
  }

  if (lowerText === '❓ wyrocznia') {
    await safeSendTelegram(chatId, "• **Zadaj pytanie Wyroczni**\nNapisz swoje pytanie do Vanguard Oracle:", telegramToken, {
      parse_mode: 'Markdown',
      reply_markup: {
        force_reply: true,
        selective: true,
        input_field_placeholder: "Twoje pytanie..."
      }
    });
    return true;
  }

  if (lowerText === '📝 todo' || lowerText === '/todo' || lowerText === '＋ zadanie' || lowerText === '+ zadanie') {
    await safeSendTelegram(chatId, "• **Nowe zadanie**\nWpisz co masz do zrobienia (opcjonalnie: `+jutro` `+tydzień` `!high`):", telegramToken, {
      parse_mode: 'Markdown',
      reply_markup: {
        force_reply: true,
        selective: true,
        input_field_placeholder: "np. Zadzwoń do Marka +jutro !high"
      }
    });
    return true;
  }

  if (lowerText === '🍴 posiłek' || lowerText === '🍽 posiłek' || lowerText === '🍽 posilek' || lowerText === '/posilek' || lowerText === '/posiłek') {
    await safeSendTelegram(chatId, "• **Co zjadłeś?**\nOpisz posiłek (np. `makaron z serkiem tłustym piątnica`):", telegramToken, {
      parse_mode: 'Markdown',
      reply_markup: {
        force_reply: true,
        selective: true,
        input_field_placeholder: "np. 2 jajka sadzone i kromka chleba",
      },
    });
    return true;
  }

  if (lowerText === '📒 keep' || lowerText === '📝 notatka' || lowerText === '/keep' || lowerText === '/notatka') {
    await safeSendTelegram(chatId, "• **Notatka**\nWpisz notatkę lub nagraj głosówkę:", telegramToken, {
      parse_mode: 'Markdown',
      reply_markup: {
        force_reply: true,
        selective: true,
        input_field_placeholder: "Twoja notatka..."
      }
    });
    return true;
  }

  if (lowerText === '••• więcej' || lowerText === '••• wiecej') {
    await safeSendTelegram(chatId, "• Więcej opcji:", telegramToken, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🛋️ Lenie", callback_data: "more_action:lenie" },
            { text: "⏳ Post", callback_data: "more_action:post" }
          ],
          [
            { text: "🍽️ Dieta", callback_data: "more_action:dieta" },
            { text: "💬 Wywiad", callback_data: "more_action:wywiad" }
          ],
          [
            { text: "🔚 Koniec dnia", callback_data: "more_action:koniec" }
          ]
        ]
      }
    });
    return true;
  }

  return false;
}
