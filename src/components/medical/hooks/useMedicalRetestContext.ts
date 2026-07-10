import { useEffect, useState } from 'react';
import { fetchSprintContext } from '../../../lib/goal/goalSpine';
import { supabase } from '../../../lib/supabase';
import { groupRowsByDate, type MarkerSeries, type MedicalLabRow } from '../../../lib/health/medicalAnalytics';
import { findLatestFullPanel } from '../../../lib/health/medicalRetestContext';
import {
  buildRetestSuggestions,
  computeAgeFromBirthDate,
  type MedicalUserContext,
  type RetestSuggestion,
} from '../../../lib/health/medicalRetestSuggestions';

function useMedicalUserContext(userId: string | undefined) {
  const [ctx, setCtx] = useState<MedicalUserContext>({
    age: null,
    sex: null,
    activeProjectNames: [],
    sprintGoal: null,
    trainingHint: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
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
        if (cancelled) return;
        const strain = strainRes.data;
        let trainingHint: string | null = null;
        if (strain?.strain_score != null && strain.strain_score >= 14) {
          trainingHint = `wysokie obciążenie (strain ${strain.strain_score})`;
        } else if (strain?.recovery_score != null && strain.recovery_score < 40) {
          trainingHint = `niska recovery (${strain.recovery_score})`;
        }
        setCtx({
          age: computeAgeFromBirthDate(profileRes.data?.birth_date),
          sex: profileRes.data?.sex ?? null,
          activeProjectNames: (projectsRes.data ?? []).map((p) => p.name),
          sprintGoal: sprintCtx.goalText,
          trainingHint,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { ctx, loading };
}

export function useRetestSuggestions(userId: string | undefined, series: MarkerSeries[], labs: MedicalLabRow[]) {
  const { ctx, loading: ctxLoading } = useMedicalUserContext(userId);
  const [suggestions, setSuggestions] = useState<RetestSuggestion[]>([]);
  const [fullPanel, setFullPanel] = useState<ReturnType<typeof findLatestFullPanel>>(null);

  useEffect(() => {
    if (!labs.length) {
      void (async () => {
        setSuggestions([]);
        setFullPanel(null);
      })();
      return;
    }
    const byDate = groupRowsByDate(labs);
    const panel = findLatestFullPanel(byDate);
    void (async () => {
      setFullPanel(panel);
      setSuggestions(buildRetestSuggestions({ series, fullPanel: panel, user: ctx }));
    })();
  }, [series, labs, ctx]);

  return { suggestions, fullPanel, userContext: ctx, loading: ctxLoading };
}
