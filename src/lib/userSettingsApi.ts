import { supabase } from './supabase';
import type { Tables, TablesInsert } from './database.types';

export type UserSettings = Tables<'user_settings'>;
export type NutritionProfile = Tables<'nutrition_profile'>;

export async function fetchNutritionProfile(userId: string): Promise<NutritionProfile | null> {
  const { data, error } = await supabase
    .from('nutrition_profile')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[userSettingsApi] fetchNutritionProfile failed:', error.message);
    throw new Error(error.message);
  }

  return data;
}

export async function upsertUserSettings(settings: TablesInsert<'user_settings'>): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .upsert(settings);

  if (error) {
    console.error('[userSettingsApi] upsertUserSettings failed:', error.message);
    throw new Error(error.message);
  }
}

export async function upsertNutritionProfile(profile: TablesInsert<'nutrition_profile'>): Promise<void> {
  const { error } = await supabase
    .from('nutrition_profile')
    .upsert(profile);

  if (error) {
    console.error('[userSettingsApi] upsertNutritionProfile failed:', error.message);
    throw new Error(error.message);
  }
}
