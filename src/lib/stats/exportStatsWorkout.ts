import type { Tables } from '../database.types';

export function renderWorkoutSessions(
  daySessions: (Tables<'workout_sessions'> & { exercise_logs?: Tables<'exercise_logs'>[] })[]
): string {
  let md = '';
  daySessions.forEach((s) => {
    md += `### 🏋️ Trening: Dzień ${s.workout_day}\n`;
    let totalSessionVolume = 0;

    let currentExerciseName = '';
    let currentExerciseVolume = 0;
    let currentSets: Tables<'exercise_logs'>[] = [];

    const renderCurrentExercise = () => {
      if (currentSets.length > 0) {
        md += `- **${currentExerciseName}** (Objętość: ${currentExerciseVolume.toLocaleString()} kg):\n`;
        currentSets.forEach((l, idx) => {
          const effort = l.rir ?? l.rpe ?? '--';
          md += `  - Seria ${idx + 1}: ${l.weight}kg x ${l.reps} (RIR/MSP: ${effort}) ${
            l.is_pws_or_msp ? '🔥' : ''
          }\n`;
        });
        currentSets = [];
        currentExerciseVolume = 0;
      }
    };

    const sortedLogs = [...(s.exercise_logs || [])].sort((a, b) => a.set_number - b.set_number);
    sortedLogs.forEach((l) => {
      const setVol = (Number(l.weight) || 0) * (Number(l.reps) || 0);
      totalSessionVolume += setVol;

      if (l.exercise_name !== currentExerciseName) {
        renderCurrentExercise();
        currentExerciseName = l.exercise_name;
      }
      currentSets.push(l);
      currentExerciseVolume += setVol;
    });
    renderCurrentExercise();

    if (totalSessionVolume > 0) {
      md += `**Łączna objętość treningu:** **${totalSessionVolume.toLocaleString()} kg**\n`;
    }
    if (s.session_notes && s.session_notes.trim()) {
      md += `**Notatki z treningu:** ${s.session_notes.trim()}\n`;
    }
    md += `\n`;
  });
  return md;
}
