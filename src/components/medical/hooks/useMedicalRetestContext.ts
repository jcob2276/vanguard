import { useEffect, useState } from 'react';
import { groupRowsByDate, type MarkerSeries, type MedicalLabRow } from '../../../lib/health/medicalAnalytics';
import { findLatestFullPanel } from '../../../lib/health/medicalRetestContext';
import { useMedicalUserContext } from '../../../lib/health/medicalApi';
import {
  buildRetestSuggestions,
  type MedicalUserContext,
  type RetestSuggestion,
} from '../../../lib/health/medicalRetestSuggestions';

const EMPTY_CONTEXT: MedicalUserContext = {
  age: null,
  sex: null,
  activeProjectNames: [],
  sprintGoal: null,
  trainingHint: null,
};

export function useRetestSuggestions(userId: string | undefined, series: MarkerSeries[], labs: MedicalLabRow[]) {
  const { data: ctx = EMPTY_CONTEXT, isLoading: ctxLoading } = useMedicalUserContext(userId);
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
