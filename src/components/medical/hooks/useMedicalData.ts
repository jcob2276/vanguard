import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { BodyCompositionRow, MedicalLabRow } from '../../../lib/health/medicalAnalytics';

export function useMedicalData(userId: string | undefined) {
  const query = useQuery({
    queryKey: ['medical-data', userId],
    queryFn: async () => {
      if (!userId) {
        return { labs: [], bodyComposition: [], documents: [] };
      }
      const [labRes, bodyRes, docRes] = await Promise.all([
        supabase
          .from('medical_lab_results')
          .select(
            'id, result_date, marker_key, marker_name, category, value, unit, ref_low, ref_high, ref_text, flag, source_name, provider, notes',
          )
          .eq('user_id', userId)
          .order('result_date', { ascending: false })
          .order('marker_name', { ascending: true })
          .limit(500),
        supabase
          .from('body_composition_measurements')
          .select(
            'id, measured_at, source, method, reliability, weight_kg, body_fat_pct, fat_mass_kg, muscle_mass_kg, visceral_fat_rating, bmi, bmr_kcal, notes',
          )
          .eq('user_id', userId)
          .order('measured_at', { ascending: false })
          .limit(20),
        supabase
          .from('medical_documents')
          .select(
            'id, document_date, document_type, source_name, source_path, provider, clinical_validity, summary, notes, created_at'
          )
          .eq('user_id', userId)
          .order('document_date', { ascending: false })
          .limit(50),
      ]);

      if (labRes.error) throw new Error(labRes.error.message);
      if (bodyRes.error) throw new Error(bodyRes.error.message);
      if (docRes.error) throw new Error(docRes.error.message);

      const labs = (labRes.data ?? []).map((r) => ({
        ...r,
        value: Number(r.value),
        ref_low: r.ref_low == null ? null : Number(r.ref_low),
        ref_high: r.ref_high == null ? null : Number(r.ref_high),
      })) as MedicalLabRow[];

      const bodyComposition = (bodyRes.data ?? []).map((r) => ({
        ...r,
        weight_kg: r.weight_kg == null ? null : Number(r.weight_kg),
        body_fat_pct: r.body_fat_pct == null ? null : Number(r.body_fat_pct),
        fat_mass_kg: r.fat_mass_kg == null ? null : Number(r.fat_mass_kg),
        muscle_mass_kg: r.muscle_mass_kg == null ? null : Number(r.muscle_mass_kg),
        visceral_fat_rating: r.visceral_fat_rating == null ? null : Number(r.visceral_fat_rating),
        bmi: r.bmi == null ? null : Number(r.bmi),
        bmr_kcal: r.bmr_kcal == null ? null : Number(r.bmr_kcal),
      })) as BodyCompositionRow[];

      const documents = docRes.data ?? [];

      return { labs, bodyComposition, documents };
    },
    enabled: !!userId,
  });

  const labs = query.data?.labs ?? [];
  const bodyComposition = query.data?.bodyComposition ?? [];
  const documents = query.data?.documents ?? [];
  const loading = query.isLoading;
  const error = query.error instanceof Error ? query.error.message : null;

  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return { labs, bodyComposition, documents, loading, error, refresh };
}

