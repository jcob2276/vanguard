/**
 * @file types.ts
 * @role Definicje typów dla Oura / NOOP Health & Sleep Hub (110%) z pełną obsługą historii 30 dni.
 */
import type { Tables } from '../../../lib/database.types';


export interface OuraHealthHubData {
  strainRow: Tables<'daily_strain'> | null;
  oura: Tables<'oura_daily_summary'> | null;
  ouraYesterday?: Tables<'oura_daily_summary'> | null;
  enhanced?: Tables<'oura_enhanced'> | null;
  enhancedYesterday?: Tables<'oura_enhanced'> | null;
  ouraHistory?: Tables<'oura_daily_summary'>[];
  enhancedHistory?: Tables<'oura_enhanced'>[];
  birthDateStr?: string | null;
  garminVo2Max?: number | null;
  externalVo2Source?: string | null;
}

