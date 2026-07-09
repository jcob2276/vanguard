/**
 * @file telegram.ts
 * @role BARREL — czysty re-export z infra/telegram/send.ts.
 * @why Zachowanie istniejących importów '../_shared/telegram.ts' po ekstrakcji (2026-07-09).
 *      Nowy kod importuje bezpośrednio z './infra/telegram/send.ts'.
 */
export * from "./infra/telegram/send.ts";
