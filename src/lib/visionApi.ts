import { supabase } from './supabase';
import type { Tables, TablesInsert } from './database.types';

export type Prescription = Tables<'endmyopia_prescriptions'>;
export type Measurement = Tables<'endmyopia_measurements'>;

export async function fetchPrescriptions(userId: string): Promise<Prescription[]> {
  const { data, error } = await supabase
    .from('endmyopia_prescriptions')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false });

  if (error) {
    console.error('[visionApi] fetchPrescriptions failed:', error.message);
    throw new Error(error.message);
  }

  return (data || []) as Prescription[];
}

export async function importPrescriptions(prescriptions: TablesInsert<'endmyopia_prescriptions'>[]): Promise<void> {
  const { error } = await supabase
    .from('endmyopia_prescriptions')
    .insert(prescriptions);

  if (error) {
    console.error('[visionApi] importPrescriptions failed:', error.message);
    throw new Error(error.message);
  }
}

export async function fetchMeasurements(): Promise<Measurement[]> {
  const { data, error } = await supabase
    .from('endmyopia_measurements')
    .select('*')
    .order('measured_at', { ascending: true });

  if (error) {
    console.error('[visionApi] fetchMeasurements failed:', error.message);
    throw new Error(error.message);
  }

  return (data || []) as Measurement[];
}
