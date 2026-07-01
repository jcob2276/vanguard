/**
 * Redirection router for Telegram slash-command handlers.
 * Imports handlers from modular files in `_commands/`.
 */

export { DEFAULT_REPLY_KEYBOARD } from "../_utils/constants.ts";

export { handleStartMenuCommand } from "../_commands/start.ts";
export { handleKoniecCommand } from "../_commands/koniec.ts";
export { handlePytanieCommand } from "../_commands/pytanie.ts";
export { handleDietaCommand } from "../_commands/dieta.ts";
export { handleInteractivePromptCommand } from "../_commands/interactive.ts";
export { handleTodoCommand } from "../_commands/todo.ts";
export { handleKeepCommand } from "../_commands/keep.ts";
export { handlePostCommand } from "../_commands/post.ts";
export { handlePosilekCommand } from "../_commands/posilek.ts";
export { handleLenieCommand } from "../_commands/lenie.ts";
