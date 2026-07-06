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

    let sumAdherence = 0;
    let countAdherence = 0;

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
      
      if (facts) {
        for (const f of facts) {
          if (f.execution_score != null) {
            sumAdherence += f.execution_score;
            countAdherence++;
          }
        }
      }
    }

    if (countAdherence > 0) {
      const avgAdherence = Math.round((sumAdherence / countAdherence) * 100);
      const evidence_text = `Wystąpił ${events.length}x. Średnie wykonanie (adherence) w 9-dniowych oknach po wystąpieniu wynosi ${avgAdherence}%.`;
      
      await supabase.from('vanguard_behavioral_patterns').update({
        evidence_text
      }).eq('id', pattern.id);
      
      console.log(`[pattern-outcomes] Updated pattern ${pattern.id} with evidence: ${evidence_text}`);
    }
  }
};
