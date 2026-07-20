import { supabase } from './supabase';

export async function insertEndmyopiaMeasurement(input: {
  userId: string;
  eyeMeasured: 'left' | 'right' | 'both';
  blurDistanceCm: number;
  diopters: number;
}): Promise<void> {
  const { error } = await supabase.from('endmyopia_measurements').insert({
    user_id: input.userId,
    eye_measured: input.eyeMeasured,
    blur_distance_cm: input.blurDistanceCm,
    diopters: input.diopters,
  });
  if (error) throw error;
}
