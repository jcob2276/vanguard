/**
 * Shared Telegram UI constants — keyboard definitions and other static payloads.
 * Kept in a separate file to avoid circular imports between `commands.ts` and `_commands/*.ts`.
 */

export const DEFAULT_REPLY_KEYBOARD = {
  keyboard: [
    [
      { text: "🛋️ Lenie" }
    ],
    [
      { text: "📝 Todo" },
      { text: "📒 Keep" }
    ],
    [
      { text: "🍴 Posiłek" }
    ],
    [
      { text: "💊 Suple" }
    ]
  ],
  resize_keyboard: true,
  is_persistent: true
};
