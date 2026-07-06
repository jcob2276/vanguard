/**
 * VANGUARD CORE 2.0 - Unified Behavioral Engine (Deno/Supabase Shared version)
 *
 * Jedyne źródło prawdy dla klasyfikacji stanu i obliczania baseline.
 * Sprowadzona do _shared/ aby backend i frontend współdzieliły te same reguły z-score.
 * Plik nie posiada zewnętrznych zależności (np. date-fns) w celu maksymalnej zgodności z Deno i Vite.
 */

// --- TIMEZONE-SAFE DATE HELPERS ---
function getWarsawDateString(date: Date = new Date()): string {
  return date.toLocaleDateString('sv', { timeZone: 'Europe/Warsaw' });
}

function getWarsawDateMinusDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - days);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Jedyna taksonomia stanów w systemie
const VANGUARD_STATES = {
  LOCKED_IN:   'LOCKED_IN',   // Optymalna egzekucja + dobra biometria
  MOMENTUM:    'MOMENTUM',    // Konsekwentna egzekucja, stabilna biometria
  RECOVERY:    'RECOVERY',    // Niska biometria, celowy deload
  CHAOS:       'CHAOS',       // Bio + behawioralny collapse
  AVOIDANCE:   'AVOIDANCE',   // Zasoby są, egzekucja brak
  CONSUMING:   'CONSUMING',   // Cyfrowa dominacja nad outputem
  CALIBRATING: 'CALIBRATING'  // < 5 dni danych historycznych
};

// --- SIGNAL COMPUTATION ---
export function computeSignals(
  oura: any = null,
  todayWin: any = null,
  nutrition: any = null,
  lastTrainingDate: string | null = null,
  expectedDate: string = getWarsawDateString(new Date())
) {
  // Biological Vector
  const sleep = oura?.total_sleep_hours ?? null;
  const hrv = oura?.hrv_avg ?? null;
  const rhr = oura?.rhr_avg ?? null;
  const readiness = oura?.readiness_score ?? null;

  // Execution Vector (Power List)
  let completedTasks = 0;
  let timePenalty = 0;
  if (todayWin) {
    for (let i = 1; i <= 5; i++) {
      if (todayWin[`done_${i}`]) {
        completedTasks++;
        
        // Time Penalty Logic — use Warsaw hour, not UTC
        const completedAt = todayWin[`completed_at_${i}`];
        if (completedAt) {
          const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', hour: 'numeric', hour12: false }).formatToParts(new Date(completedAt));
          const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
          if (hour >= 21) timePenalty += 0.1;
          if (hour >= 23) timePenalty += 0.15;
        }
      }
    }
  }

  const executionRatio = Math.max(0, (completedTasks / 5) - timePenalty);
  const dailyRpe = todayWin?.daily_rpe || 5;

  // Nutrition Vector (Protein focus) — prefer coach target when available
  const proteinGoal = Number(nutrition?.protein_floor_g) || Number(nutrition?.protein_target) || 160;
  const proteinConsumed = nutrition?.protein || 0;
  const proteinRatio = Math.min(proteinConsumed / proteinGoal, 1.2);

  // Training Consistency Vector
  let trainingRatio = 0;
  if (lastTrainingDate) {
    const daysSince = Math.floor(
      (new Date(`${expectedDate}T12:00:00`).getTime() - new Date(`${lastTrainingDate}T12:00:00`).getTime()) /
      (1000 * 60 * 60 * 24)
    );
    if (daysSince === 0) trainingRatio = 1.0;
    else if (daysSince === 1) trainingRatio = 1.0;
    else if (daysSince === 2) trainingRatio = 0.8;
    else if (daysSince === 3) trainingRatio = 0.5;
    else trainingRatio = 0.2;
  }

  return {
    screen_time_min: null,
    fragmentation: null,
    dopamine_load: null,
    overlap_factor: 1.0,
    sleep,
    hrv,
    rhr,
    readiness,
    execution_ratio: parseFloat(executionRatio.toFixed(2)),
    daily_rpe: dailyRpe,
    protein_ratio: parseFloat(proteinRatio.toFixed(2)),
    protein_grams: proteinConsumed,
    training_ratio: trainingRatio,
    confidence: {
      digital: 0.0,
      biometrics: sleep != null ? 0.9 : 0.2,
      execution: todayWin != null ? 1.0 : 0.5,
      nutrition: nutrition != null ? 1.0 : 0.0,
      training: lastTrainingDate != null ? 1.0 : 0.0,
      is_stale: sleep != null && oura?.date !== expectedDate
    }
  };
}

// --- VANGUARD CORE CLASS ---
export class VanguardCore {
  private userId: string;
  private db: any;

  constructor(userId: string, db: any) {
    this.userId = userId;
    this.db = db;
  }

  _zScore(value: number | null, mean: number, stdDev: number): number {
    if (value == null || stdDev === 0) return 0;
    return (value - mean) / stdDev;
  }

  _mean(arr: number[]): number {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  _stdDev(arr: number[], mean: number): number {
    if (arr.length < 2) return 0;
    const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
  }

  async getPersonalBaseline() {
    const todayStr = getWarsawDateString(new Date());
    const ninetyDaysAgo = getWarsawDateMinusDays(todayStr, 90);

    const { data: history, error: historyErr } = await this.db
      .from('vanguard_daily_aggregates')
      .select('sleep_hours, hrv_avg, fragmentation_index, dopamine_load_index, screen_time_min, execution_score')
      .eq('user_id', this.userId)
      .gte('date', ninetyDaysAgo)
      .order('date', { ascending: false });

    if (historyErr) console.error('[vanguardCore] getPersonalBaseline history query failed, falling back to calibrating defaults:', historyErr.message);

    const extract = (key: string) => (history || []).map((d: any) => d[key]).filter((v: any) => v != null);

    const sleepArr = extract('sleep_hours');
    const hrvArr   = extract('hrv_avg');
    const fragArr  = extract('fragmentation_index');
    const dopArr   = extract('dopamine_load_index');
    const stArr    = extract('screen_time_min');
    const execArr  = extract('execution_score');

    const sampleSize = Math.max(sleepArr.length, execArr.length, hrvArr.length);

    if (sampleSize < 5) {
      return {
        means:   { sleep: 7.5, hrv: 40, fragmentation: 1.0, dopamine_load: 1.0, screen_time: 300, execution: 0.6 },
        stdDevs: { sleep: 0.8, hrv: 8,  fragmentation: 0.4, dopamine_load: 0.4, screen_time: 80,  execution: 0.2 },
        sampleSize,
        calibrating: true
      };
    }

    const sleepMean = this._mean(sleepArr);
    const hrvMean   = this._mean(hrvArr);
    const fragMean  = this._mean(fragArr);
    const dopMean   = this._mean(dopArr);
    const stMean    = this._mean(stArr);
    const execMean  = this._mean(execArr);

    return {
      means: {
        sleep:         sleepMean,
        hrv:           hrvMean,
        fragmentation: fragMean,
        dopamine_load: dopMean,
        screen_time:   stMean,
        execution:     execMean
      },
      stdDevs: {
        sleep:         Math.max(this._stdDev(sleepArr, sleepMean), 0.3),
        hrv:           Math.max(this._stdDev(hrvArr, hrvMean), 3),
        fragmentation: Math.max(this._stdDev(fragArr, fragMean), 0.1),
        dopamine_load: Math.max(this._stdDev(dopArr, dopMean), 0.1),
        screen_time:   Math.max(this._stdDev(stArr, stMean), 30),
        execution:     Math.max(this._stdDev(execArr, execMean), 0.1)
      },
      sampleSize,
      calibrating: false
    };
  }

  calculateStabilityScore(current: any, baseline: any): number {
    const bl = baseline;
    
    const executionScore = (current.execution_ratio || 0) * 35;
    const trainingScore = (current.training_ratio || 0) * 20;
    const proteinScore = (current.protein_ratio || 0) * 15;

    const zSleep = this._zScore(current.sleep, bl.means.sleep, bl.stdDevs.sleep);
    const sleepScore = Math.max(0, Math.min(20, (zSleep + 2) * 5.0));

    const zHrv = this._zScore(current.hrv, bl.means.hrv, bl.stdDevs.hrv);
    const hrvScore = Math.max(0, Math.min(10, (zHrv + 2) * 2.5));

    let balanceModifier = 1.0;
    if (current.daily_rpe >= 8 && (current.sleep < 6.5 || current.hrv < bl.means.hrv)) {
      balanceModifier = 0.8;
    }

    const total = (executionScore + trainingScore + proteinScore + sleepScore + hrvScore) * balanceModifier;
    return Math.round(total);
  }

  async determineState(currentSignals: any, baseline?: any): Promise<{ state: string, score: number }> {
    const bl = baseline || await this.getPersonalBaseline();

    if (bl.calibrating) return { state: VANGUARD_STATES.CALIBRATING, score: 50 };
    if (currentSignals.confidence.is_stale) return { state: 'STALE_DATA', score: 0 };

    const HARD_LIMITS = {
      sleep_critical:    5.5,
      sleep_recovery:    6.2,
      readiness_critical: 55,
      hrv_floor_ratio:   0.5,
    };

    if (currentSignals.sleep != null && currentSignals.sleep < HARD_LIMITS.sleep_critical) {
      return { state: VANGUARD_STATES.CHAOS, score: this.calculateStabilityScore(currentSignals, bl) };
    }
    if (currentSignals.readiness != null && currentSignals.readiness < HARD_LIMITS.readiness_critical) {
      return { state: VANGUARD_STATES.RECOVERY, score: this.calculateStabilityScore(currentSignals, bl) };
    }
    if (currentSignals.hrv != null && bl.means.hrv && currentSignals.hrv < (bl.means.hrv * HARD_LIMITS.hrv_floor_ratio)) {
      return { state: VANGUARD_STATES.RECOVERY, score: this.calculateStabilityScore(currentSignals, bl) };
    }
    if (currentSignals.sleep != null && currentSignals.sleep < HARD_LIMITS.sleep_recovery) {
      return { state: VANGUARD_STATES.RECOVERY, score: this.calculateStabilityScore(currentSignals, bl) };
    }

    const stabilityScore = this.calculateStabilityScore(currentSignals, bl);

    const zSleep = this._zScore(currentSignals.sleep,         bl.means.sleep,        bl.stdDevs.sleep);
    const zHrv   = this._zScore(currentSignals.hrv,           bl.means.hrv,          bl.stdDevs.hrv);

    const biologicalScore = (zSleep + zHrv) / 2;
    const exec = currentSignals.execution_ratio ?? 0;

    let state: string;

    if (biologicalScore < -2.0 && exec < 0.4)       state = VANGUARD_STATES.CHAOS;
    else if (biologicalScore < -1.0 && exec < 0.2)  state = VANGUARD_STATES.RECOVERY;
    else if (exec === 1.0 && biologicalScore >= 0)   state = VANGUARD_STATES.LOCKED_IN;
    else if (exec >= 0.8)                            state = VANGUARD_STATES.MOMENTUM;
    else if (biologicalScore >= -0.5 && exec < 0.4) state = VANGUARD_STATES.AVOIDANCE;
    else if (exec >= 0.4 && biologicalScore >= -0.5) state = VANGUARD_STATES.MOMENTUM;
    else                                             state = VANGUARD_STATES.RECOVERY;

    return { state, score: stabilityScore };
  }

  generateActiveSignature(footprint: any[] = [], metrics: any = {}) {
    if (footprint.length < 5) return { sequence: [] as string[], state: 'INSUFFICIENT_DATA' };

    const markers: string[] = [];
    const recent = footprint.slice(0, 10);
    
    const apps = recent.map(f => f.payload?.window?.app).filter(Boolean);
    const uniqueApps = new Set(apps).size;
    const switches = apps.reduce((acc: number, curr: any, i: number, arr: any[]) => (i > 0 && curr !== arr[i-1]) ? acc + 1 : acc, 0);
    
    if (switches > 7) markers.push('CRITICAL_SWITCHING');
    else if (switches > 4) markers.push('HIGH_FRAGMENTATION');
    
    if (uniqueApps > 5) markers.push('CONTEXT_DIVERSITY_OVERLOAD');

    const timestamps = recent.map(f => new Date(f.timestamp).getTime());
    const avgGap = (timestamps[0] - timestamps[timestamps.length-1]) / (recent.length - 1);
    
    if (avgGap > 300000) markers.push('EXTENDED_IDLE_BURSTS');
    
    if (metrics.hrv_ratio != null) {
      // hrv_ratio = current_hrv / baseline_hrv; używamy relatywnego odchylenia
      if (metrics.hrv_ratio < 0.60) markers.push('BIOMETRIC_STRESS_BASE');
    } else if (metrics.hrv != null && metrics.hrv < 35) {
      // fallback: brak baseline — absolutny próg
      markers.push('BIOMETRIC_STRESS_BASE');
    }
    if (metrics.readiness < 65) markers.push('LOW_ENERGY_VULNERABILITY');
    if (metrics.dopamine_load > 1.5) markers.push('DOPAMINE_SATURATION');

    let predictedOutcome = 'STABLE';
    if (markers.includes('CRITICAL_SWITCHING') && markers.includes('DOPAMINE_SATURATION')) {
      predictedOutcome = 'PRE-COLLAPSE-SIG';
    } else if (markers.includes('HIGH_FRAGMENTATION') || markers.includes('EXTENDED_IDLE_BURSTS')) {
      predictedOutcome = 'DRIFT_VULNERABILITY';
    }

    return {
      sequence: markers,
      trajectory: predictedOutcome,
      confidence: (recent.length / 10) * 0.9,
      timestamp: new Date().toISOString()
    };
  }

  static translateBiometrics(oura: any, baselineMeans?: { hrv?: number; sleep?: number }) {
    if (!oura) return [];
    const insights: string[] = [];

    // HRV: jeśli mamy baseline używamy go; jeśli nie — absolutne minimum 30ms
    const hrvBaseline = baselineMeans?.hrv ?? null;
    if (oura.hrv_avg != null) {
      if (hrvBaseline) {
        const ratio = oura.hrv_avg / hrvBaseline;
        if (ratio < 0.60) insights.push("🔴 HRV krytycznie poniżej Twojej normy (−" + Math.round((1 - ratio) * 100) + "%). Priorytet: RECOVERY.");
        else if (ratio < 0.80) insights.push("🟡 HRV obniżone vs Twoja norma (−" + Math.round((1 - ratio) * 100) + "%). Organizm w obciążeniu.");
      } else {
        // brak baseline — absolutne guardy
        if (oura.hrv_avg < 30) insights.push("🔴 Krytycznie niskie HRV — Układ współczulny w stresie. Priorytet: RECOVERY.");
        else if (oura.hrv_avg < 45) insights.push("🟡 Obniżone HRV — Organizm walczy z obciążeniem.");
      }
    }

    if (oura.temp_deviation > 0.5) insights.push("🔥 Podwyższona temperatura ciała — Możliwa infekcja lub silne przemęczenie.");
    if (oura.readiness_score < 70) insights.push("⚠️ Niski Readiness — Dziś nie jest dzień na rekordy. Tryb zachowawczy.");

    return insights;
  }

  formatBaselineContext(baseline: any, current: any) {
    if (baseline.calibrating) {
      return `--- PERSONAL BASELINE ---
STATUS: KALIBRACJA (${baseline.sampleSize}/5 wymaganych dni)
Baseline nieaktywny — uruchom save-daily-aggregate aby budować historię.`;
    }

    const fmt = (val: number | null, mean: number, stdDev: number, unit = '', invert = false) => {
      if (val == null) return 'brak danych';
      const z = invert ? -((val - mean) / stdDev) : ((val - mean) / stdDev);
      const pct = Math.round(((val - mean) / (mean || 1)) * 100);
      const trend = z > 1.0 ? 'POWYŻEJ NORMY' : z > 0.3 ? 'lekko powyżej' : z < -1.0 ? 'PONIŻEJ NORMY' : z < -0.3 ? 'lekko poniżej' : 'w normie';
      return `${typeof val === 'number' ? val.toFixed(1) : val}${unit} (${pct > 0 ? '+' : ''}${pct}% vs Twoja norma ${mean.toFixed(1)}${unit}) — ${trend}`;
    };

    return `--- PERSONAL BASELINE (${baseline.sampleSize}d rolling) ---
SEN:          ${fmt(current.sleep,         baseline.means.sleep,        baseline.stdDevs.sleep, 'h')}
HRV:          ${fmt(current.hrv,           baseline.means.hrv,          baseline.stdDevs.hrv, 'ms')}
FRAGMENTACJA: ${fmt(current.fragmentation, baseline.means.fragmentation, baseline.stdDevs.fragmentation, '', true)}
DOPAMINA:     ${fmt(current.dopamine_load, baseline.means.dopamine_load, baseline.stdDevs.dopamine_load, '', true)}
STATUS: AKTYWNY BASELINE`;
  }

  detectLagCorrelations(history: any[]) {
    if (!history || history.length < 3) return [];
    const correlations: { type: string, message: string }[] = [];
    const today = history[history.length - 1];
    const yesterday = history[history.length - 2];
    const twoDaysAgo = history[history.length - 3];

    if (twoDaysAgo.sleep_hours < 6 && today.dopamine_load_index > 1.2) {
      correlations.push({ type: 'SLEEP_DEBT_ECHO', message: 'Dzisiejszy skok dopaminy skorelowany z brakiem snu sprzed 48h.' });
    }
    if (yesterday.fragmentation_index > 1.5 && today.execution_score < 0.4) {
      correlations.push({ type: 'FOCUS_DEBT', message: 'Dzisiejszy spadek wydajności to "echo" wczorajszego rozproszenia uwagi.' });
    }
    return correlations;
  }

  async saveDailyAggregate(data: any) {
    const { error } = await this.db.from('vanguard_daily_aggregates').upsert({
      user_id: this.userId,
      date: getWarsawDateString(new Date()),
      ...data
    });
    return !error;
  }

  async evaluateIdentityVault(query: string | null = null) {
    const today = getWarsawDateString(new Date());
    
    const promises = [
      this.db.from('user_fundament').select('*').eq('user_id', this.userId).maybeSingle(),
      this.db.from('daily_wins').select('journal_entry, gratitude_entry, mood_score').eq('user_id', this.userId).eq('date', today).maybeSingle(),
      this.db.from('vanguard_daily_aggregates').select('*').eq('user_id', this.userId).eq('date', today).maybeSingle(),
      this.db.from('vanguard_knowledge').select('*').eq('user_id', this.userId).order('importance_score', { ascending: false }).limit(3)
    ];

    const [fundamentRes, journalRes, aggregateRes, knowledgeRes] = await Promise.all(promises);

    for (const [name, res] of Object.entries({ fundamentRes, journalRes, aggregateRes, knowledgeRes })) {
      if ((res as any).error) console.error(`[vanguardCore] evaluateIdentityVault query failed: ${name}:`, (res as any).error.message);
    }

    return {
      philosophy: fundamentRes.data?.philosophy || "Brak",
      mission: fundamentRes.data?.vision || "Nieokreślona",
      pillars: fundamentRes.data?.identity || "Nieokreślone",
      
      daily_reflection: {
        journal: journalRes.data?.journal_entry,
        gratitude: journalRes.data?.gratitude_entry,
        mood: journalRes.data?.mood_score
      },

      today_metrics: aggregateRes.data || {},
      
      knowledge_vault: knowledgeRes.data || []
    };
  }

  async getEpisodeForDate(date: string) {
    const [oura, aggregate, wins] = await Promise.all([
      this.db.from('oura_daily_summary').select('*').eq('user_id', this.userId).eq('date', date).maybeSingle(),
      this.db.from('vanguard_daily_aggregates').select('*').eq('user_id', this.userId).eq('date', date).maybeSingle(),
      this.db.from('daily_wins').select('*').eq('user_id', this.userId).eq('date', date).maybeSingle()
    ]);

    return {
      date,
      metrics: {
        hrv: aggregate.data?.hrv_avg || oura.data?.hrv_avg,
        sleep: aggregate.data?.sleep_hours || oura.data?.total_sleep_hours,
        readiness: aggregate.data?.readiness_score || oura.data?.readiness_score,
        identity_score: aggregate.data?.identity_score,
        state: aggregate.data?.final_state
      },
      behavior: {
        tasks_done: aggregate.data?.execution_score ? aggregate.data.execution_score * 5 : 0,
        journal: wins.data?.journal_entry,
        mood: wins.data?.mood_score
      }
    };
  }

  calculateGoalAlignment(todayWin: any) {
    if (!todayWin) return { alignment_score: 0, drift_score: 1.0, gaps: ["Brak Power Listy na dziś."] };

    const tasks = [
      { t: todayWin.task_1, c: todayWin.category_1, d: todayWin.done_1 },
      { t: todayWin.task_2, c: todayWin.category_2, d: todayWin.done_2 },
      { t: todayWin.task_3, c: todayWin.category_3, d: todayWin.done_3 },
      { t: todayWin.task_4, c: todayWin.category_4, d: todayWin.done_4 },
      { t: todayWin.task_5, c: todayWin.category_5, d: todayWin.done_5 },
    ];

    const completed = tasks.filter(t => t.d);
    const categoriesCovered = new Set(completed.map(t => t.c));
    
    const alignmentScore = (categoriesCovered.size / 3) * 100;
    const gaps: string[] = [];
    if (!categoriesCovered.has('cialo')) gaps.push('Brak progresu w obszarze CIAŁO');
    if (!categoriesCovered.has('duch')) gaps.push('Brak progresu w obszarze DUCH');
    if (!categoriesCovered.has('konto')) gaps.push('Brak progresu w obszarze KONTO');

    return {
      alignment_score: Math.round(alignmentScore),
      drift_score: parseFloat((1.0 - (categoriesCovered.size / 3)).toFixed(2)),
      gaps
    };
  }


}
