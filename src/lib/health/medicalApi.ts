import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { fetchSprintContext } from '../goal/goalSpine';
import { computeAgeFromBirthDate, type MedicalUserContext } from './medicalRetestSuggestions';
import { HEALTH_THRESHOLDS } from '@vanguard/domain';

const medicalContextKeys = {
  all: ['medicalUserContext'] as const,
  forUser: (userId: string) => [...medicalContextKeys.all, userId] as const,
};

async function fetchMedicalUserContext(userId: string): Promise<MedicalUserContext> {
  const [profileRes, projectsRes, sprintCtx, strainRes] = await Promise.all([
    supabase.from('nutrition_profile').select('birth_date, sex').eq('user_id', userId).maybeSingle(),
    supabase.from('projects').select('name').eq('user_id', userId).eq('status', 'active').limit(5),
    fetchSprintContext(userId),
    supabase
      .from('daily_strain')
      .select('strain_score, recovery_score')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const strain = strainRes.data;
  let trainingHint: string | null = null;
  if (strain?.strain_score != null && strain.strain_score >= 14) {
    trainingHint = `wysokie obciążenie (strain ${strain.strain_score})`;
  } else if (strain?.recovery_score != null && strain.recovery_score < HEALTH_THRESHOLDS.RECOVERY_MEDICAL_ALERT) {
    trainingHint = `niska recovery (${strain.recovery_score})`;
  }

  return {
    age: computeAgeFromBirthDate(profileRes.data?.birth_date),
    sex: profileRes.data?.sex ?? null,
    activeProjectNames: (projectsRes.data ?? []).map((p) => p.name),
    sprintGoal: sprintCtx.goalText,
    trainingHint,
  };
}

export function useMedicalUserContext(userId: string | undefined) {
  return useQuery({
    queryKey: medicalContextKeys.forUser(userId || ''),
    queryFn: () => fetchMedicalUserContext(userId as string),
    enabled: !!userId,
  });
}

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
