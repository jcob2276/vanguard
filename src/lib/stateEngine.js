export const OPERATING_STATES = {
  LOCKED_IN: { 
    label: 'LOCKED IN', 
    color: 'text-dayC', 
    bg: 'bg-dayC/10', 
    border: 'border-dayC/50',
    description: 'Maksymalna synchronizacja tożsamości z egzekucją.' 
  },
  MOMENTUM: { 
    label: 'MOMENTUM', 
    color: 'text-primary', 
    bg: 'bg-primary/10', 
    border: 'border-primary/50',
    description: 'Budujesz falę. Każdy kolejny dzień jest łatwiejszy.' 
  },
  RECOVERY: { 
    label: 'RECOVERY', 
    color: 'text-dayD', 
    bg: 'bg-dayD/10', 
    border: 'border-dayD/50',
    description: 'Planowe wycofanie. Regeneracja zasobów.' 
  },
  CHAOS: { 
    label: 'CHAOS', 
    color: 'text-dayB', 
    bg: 'bg-dayB/10', 
    border: 'border-dayB/50',
    description: 'Dryfowanie. Brak kontroli nad systemem.' 
  },
  AVOIDANCE: { 
    label: 'AVOIDANCE', 
    color: 'text-orange-500', 
    bg: 'bg-orange-500/10', 
    border: 'border-orange-500/50',
    description: 'Masz zasoby, ale unikasz konfrontacji.' 
  },
  STABLE: { 
    label: 'STABLE', 
    color: 'text-neutral-400', 
    bg: 'bg-neutral-900', 
    border: 'border-neutral-800',
    description: 'System działa w trybie podtrzymania.' 
  }
};

export function calculateIdentityScore(data) {
  const { todayWin, hasWorkoutToday, protein, ouraToday, streak } = data;
  let score = 100;

  if (todayWin?.result === 'P') score -= 30;
  if (!todayWin) score -= 10; // Brak planowania
  if (!hasWorkoutToday && streak > 0) score -= 10; // Dzień bez treningu przy streaku
  if (protein < 140) score -= 15;
  if (ouraToday?.total_sleep_hours < 6.5) score -= 15;
  if (ouraToday?.readiness_score < 60) score -= 10;
  
  // Biometric Penalties
  if (ouraToday?.hrv_avg < 30) score -= 10; // Przykładowy próg
  if (ouraToday?.rhr_avg > 65) score -= 10; // Przykładowy próg
  if (ouraToday?.temp_deviation > 0.5) score -= 15; // Potencjalna infekcja/przeciążenie

  return Math.max(0, Math.min(100, score));
}

export function translateBiometrics(oura) {
  if (!oura) return null;
  const insights = [];
  
  if (oura.temp_deviation > 0.5) insights.push("Wykryto podwyższoną temperaturę – organizm walczy ze stresem lub infekcją.");
  if (oura.hrv_avg && oura.hrv_avg < 40) insights.push("Niskie HRV wskazuje na zmęczenie układu nerwowego.");
  if (oura.deep_sleep_hours < 1) insights.push("Deficyt snu głębokiego – regeneracja tkankowa upośledzona.");
  if (oura.rhr_avg > 60) insights.push("Podwyższone tętno spoczynkowe – serce pracuje ciężko.");

  return insights;
}

export function discoverPatterns(history, bodyMetrics, ouraData) {
  const patterns = [];
  
  if (!ouraData || ouraData.length < 3) return patterns;

  // 1. Sleep vs Readiness Correlation (Simplified)
  const avgReadiness = ouraData.reduce((acc, d) => acc + (d.readiness_score || 0), 0) / ouraData.length;
  const goodSleepDays = ouraData.filter(d => d.total_sleep_hours >= 7.5);
  
  if (goodSleepDays.length > 0) {
    const avgReadinessAfterGoodSleep = goodSleepDays.reduce((acc, d) => acc + (d.readiness_score || 0), 0) / goodSleepDays.length;
    const diff = ((avgReadinessAfterGoodSleep - avgReadiness) / avgReadiness) * 100;
    
    if (diff > 5) {
      patterns.push({
        id: 'sleep-performance',
        icon: '🌙',
        text: `Twoja gotowość (Readiness) jest średnio o ${Math.round(diff)}% wyższa po 7.5h+ snu.`
      });
    }
  }

  // 2. Discipline Streak Pattern
  const disciplinedDays = ouraData.filter(d => d.is_disciplined).length;
  const totalDays = ouraData.length;
  const consistency = (disciplinedDays / totalDays) * 100;

  if (consistency > 70) {
    patterns.push({
      id: 'high-discipline',
      icon: '🔥',
      text: `Utrzymujesz dyscyplinę kładzenia się spać w ${Math.round(consistency)}% dni. System jest stabilny.`
    });
  } else if (consistency < 30 && totalDays > 5) {
    patterns.push({
      id: 'low-discipline',
      icon: '⚠️',
      text: `Niska spójność pory snu (${Math.round(consistency)}%). Ryzyko dryfu systemu (Chaos) rośnie.`
    });
  }

  // 3. Shadow Pattern - Post Win Collapse (Real check)
  if (history && history.length > 5) {
    let winStreak = 0;
    let sabotageAfterStreak = false;
    
    for (let i = history.length - 1; i >= 1; i--) {
      if (history[i].result === 'Z') winStreak++;
      else winStreak = 0;

      if (winStreak >= 3 && history[i-1]?.result === 'P') {
        sabotageAfterStreak = true;
        break;
      }
    }

    if (sabotageAfterStreak) {
      patterns.push({
        id: 'shadow-momentum',
        icon: '🕵️',
        text: 'Wykryto wzorzec sabotażu: Twoja czujność spada po serii 3+ zwycięstw.'
      });
    }
  }

  return patterns;
}

export function detectState(data) {
  const { todayWin, oura, workoutToday, streak, protein } = data;
  
  const hasWin = todayWin?.result === 'Z';
  const goodReadiness = oura?.readiness_score >= 80;
  const lowReadiness = oura?.readiness_score < 70;
  const goodSleep = oura?.total_sleep_hours >= 7;
  const hasWorkout = workoutToday;
  const hasProtein = protein >= 150;
  const highStreak = streak >= 3;
  const biometricStrain = oura?.hrv_avg < 35 || oura?.temp_deviation > 0.4 || oura?.rhr_avg > 62;

  // 1. LOCKED IN
  if (hasWin && hasWorkout && hasProtein && goodSleep && !biometricStrain) return 'LOCKED_IN';

  // 2. MOMENTUM
  if (highStreak && hasWin && !biometricStrain) return 'MOMENTUM';

  // 3. RECOVERY
  if ((lowReadiness || biometricStrain) && !hasWorkout) return 'RECOVERY';

  // 4. AVOIDANCE
  if (goodReadiness && !hasWin && !hasWorkout && !biometricStrain) return 'AVOIDANCE';

  // 5. CHAOS
  if (!hasWin && (!goodSleep || biometricStrain) && streak === 0) return 'CHAOS';

  return 'STABLE';
}
