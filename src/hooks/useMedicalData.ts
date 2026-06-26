import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { BodyCompositionRow, MedicalLabRow } from '../lib/medicalAnalytics';

export function useMedicalData(userId: string | undefined) {
  const [labs, setLabs] = useState<MedicalLabRow[]>([]);
  const [bodyComposition, setBodyComposition] = useState<BodyCompositionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [labRes, bodyRes] = await Promise.all([
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
      ]);

      if (labRes.error) throw new Error(labRes.error.message);
      if (bodyRes.error) throw new Error(bodyRes.error.message);

      setLabs(
        (labRes.data ?? []).map((r) => ({
          ...r,
          value: Number(r.value),
          ref_low: r.ref_low == null ? null : Number(r.ref_low),
          ref_high: r.ref_high == null ? null : Number(r.ref_high),
        })) as MedicalLabRow[],
      );
      setBodyComposition(
        (bodyRes.data ?? []).map((r) => ({
          ...r,
          weight_kg: r.weight_kg == null ? null : Number(r.weight_kg),
          body_fat_pct: r.body_fat_pct == null ? null : Number(r.body_fat_pct),
          fat_mass_kg: r.fat_mass_kg == null ? null : Number(r.fat_mass_kg),
          muscle_mass_kg: r.muscle_mass_kg == null ? null : Number(r.muscle_mass_kg),
          visceral_fat_rating: r.visceral_fat_rating == null ? null : Number(r.visceral_fat_rating),
          bmi: r.bmi == null ? null : Number(r.bmi),
          bmr_kcal: r.bmr_kcal == null ? null : Number(r.bmr_kcal),
        })) as BodyCompositionRow[],
      );
    } catch (e) {
      console.error('[useMedicalData]', e);
      setError(e instanceof Error ? e.message : 'Błąd ładowania badań');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { labs, bodyComposition, loading, error, refresh };
}
