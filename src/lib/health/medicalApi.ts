import { supabase } from '../supabase';

export interface EndmyopiaPrescriptionInsert {
  type: string;
  status: string;
  sphere_l: number | null;
  cyl_l: number | null;
  axis_l: number | null;
  sphere_r: number | null;
  cyl_r: number | null;
  axis_r: number | null;
  started_at: string;
  notes: string | null;
}

export async function createPrescription(userId: string, data: EndmyopiaPrescriptionInsert): Promise<void> {
  if (data.status === 'active') {
    // Mark existing active as past
    const { error: updateError } = await supabase
      .from('endmyopia_prescriptions')
      .update({ status: 'past', ended_at: data.started_at })
      .eq('user_id', userId)
      .eq('type', data.type)
      .eq('status', 'active');
    if (updateError) throw updateError;
  }

  const { error } = await supabase.from('endmyopia_prescriptions').insert({
    user_id: userId,
    ...data,
  });

  if (error) throw error;
}
