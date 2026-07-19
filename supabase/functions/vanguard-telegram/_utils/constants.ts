/**
 * Shared Telegram UI constants — keyboard definitions and other static payloads.
 * Kept in a separate file to avoid circular imports between `commands.ts` and `_commands/*.ts`.
 */

export const DEFAULT_REPLY_KEYBOARD = {
  keyboard: [
    [
      { text: "＋ Zadanie" },
      { text: "🍽 Posiłek" },
      { text: "📝 Notatka" }
    ],
    [
      { text: "💊 Suplement" },
      { text: "••• Więcej" }
    ]
  ],
  resize_keyboard: true,
  is_persistent: true
};
