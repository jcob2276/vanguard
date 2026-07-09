/**
 * @file time.ts
 * @role BARREL — czysty re-export z @vanguard/domain.
 * @why Zachowanie istniejących importów '../_shared/time.ts' po ekstrakcji.
 *      Nowy kod importuje bezpośrednio z '@vanguard/domain'.
 */
export * from '@vanguard/domain';
