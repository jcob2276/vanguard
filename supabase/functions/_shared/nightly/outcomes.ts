import { createServiceClient } from '../supabase.ts';

const supabase = createServiceClient();

export const runPatternOutcomes = async (): Promise<void> => {
  console.log('[pattern-outcomes] Starting windowed join analysis');
  const { data: patterns } = await supabase.from('vanguard_behavioral_patterns').select('id, title, status');
  if (!patterns) return;

  for (const pattern of patterns) {
    if (pattern.status === 'user_rejected') continue;
    
    // Get all events for this pattern
    const { data: events } = await supabase.from('pattern_events').select('occurred_on').eq('pattern_id', pattern.id);
    if (!events || events.length === 0) continue;

    let successfulWindows = 0;
    let globalSumAdherence = 0;
    let globalCountAdherence = 0;

    for (const ev of events) {
      const start = new Date(ev.occurred_on);
      const end = new Date(start);
      end.setDate(end.getDate() + 9);

      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];

      const { data: facts } = await supabase
        .from('vanguard_daily_aggregates')
        .select('execution_score')
        .gte('date', startStr)
        .lte('date', endStr);
      
      if (facts && facts.length > 0) {
        let windowSum = 0;
        let windowCount = 0;
        for (const f of facts) {
          if (f.execution_score != null) {
            windowSum += f.execution_score;
            windowCount++;
            globalSumAdherence += f.execution_score;
            globalCountAdherence++;
          }
        }
        if (windowCount > 0) {
          const windowAvg = windowSum / windowCount;
          if (windowAvg >= 0.80) {
            successfulWindows++;
          }
        }
      }
    }

    if (events.length > 0) {
      const totalAvgAdherence = globalCountAdherence > 0 
        ? Math.round((globalSumAdherence / globalCountAdherence) * 100)
        : 0;
      
      const evidence_text = `Wystąpił ${events.length}×, w ${successfulWindows}/${events.length} przypadków średnie wykonanie (adherence) w 9-dniowym oknie po wystąpieniu wynosiło >= 80% (średnia w oknach: ${totalAvgAdherence}%).`;
      
      await supabase.from('vanguard_behavioral_patterns').update({
        evidence_text
      }).eq('id', pattern.id);
      
      console.log(`[pattern-outcomes] Updated pattern ${pattern.id} with evidence: ${evidence_text}`);
    }
  }
};
