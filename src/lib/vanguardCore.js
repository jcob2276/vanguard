/**
 * VANGUARD CORE 2.0 - Unified Behavioral Engine
 *
 * Jedyne źródło prawdy dla klasyfikacji stanu i obliczania baseline.
 * Zastępuje signalAnalytics.js i stateEngine.js jako silnik obliczeniowy.
 * stateEngine.js pozostaje dla eksportów UI (OPERATING_STATES, IDENTITY_MODES).
 */

import { format, subDays } from 'date-fns';

// Jedyna taksonomia stanów w systemie
export const VANGUARD_STATES = {
  LOCKED_IN:   'LOCKED_IN',   // Optymalna egzekucja + dobra biometria
  MOMENTUM:    'MOMENTUM',    // Konsekwentna egzekucja, stabilna biometria
  RECOVERY:    'RECOVERY',    // Niska biometria, celowy deload
  CHAOS:       'CHAOS',       // Bio + behawioralny collapse
  AVOIDANCE:   'AVOIDANCE',   // Zasoby są, egzekucja brak
  CONSUMING:   'CONSUMING',   // Cyfrowa dominacja nad outputem
  CALIBRATING: 'CALIBRATING' // < 5 dni danych historycznych
};

// --- SIGNAL COMPUTATION ---
// Czysta funkcja, zero side-effectów, deterministyczna.
// Pobiera surowe dane, zwraca znormalizowane sygnały.
export function computeSignals(stayfree = [], oura = null, todayWin = null) {
  // Digital Exposure Vector
  const totalSeconds = stayfree.reduce((a, b) => a + (b.duration_seconds || 0), 0);

  const byDevice = stayfree.reduce((acc, curr) => {
    acc[curr.device_name] = (acc[curr.device_name] || 0) + curr.duration_seconds;
    return acc;
  }, {});
  const realTimeSeconds = Object.values(byDevice).length > 0
    ? Math.max(...Object.values(byDevice))
    : totalSeconds;

  const overlapFactor = realTimeSeconds > 0 ? totalSeconds / realTimeSeconds : 1.0;
  const unlocks = stayfree.length > 0 ? Math.max(...stayfree.map(d => d.unlocks || 0)) : 0;
  const fragmentation = unlocks / ((realTimeSeconds / 3600) || 1);

  const socialSeconds = stayfree
    .filter(i => /messenger|facebook|instagram|tiktok|youtube|shorts/i.test(i.app_name))
    .reduce((a, b) => a + b.duration_seconds, 0);

  const dopamineLoad = totalSeconds > 0
    ? (socialSeconds / totalSeconds) * overlapFactor * Math.max(fragmentation, 0.1)
    : 0;

  // Biological Vector
  const sleep = oura?.total_sleep_hours ?? null;
  const hrv = oura?.hrv_avg ?? null;
  const rhr = oura?.rhr_avg ?? null;
  const readiness = oura?.readiness_score ?? null;

  // Execution Vector
  let completedTasks = 0;
  if (todayWin) {
    for (let i = 1; i <= 5; i++) if (todayWin[`done_${i}`]) completedTasks++;
  }

  return {
    screen_time_min: Math.round(totalSeconds / 60),
    fragmentation: parseFloat(fragmentation.toFixed(3)),
    dopamine_load: parseFloat(dopamineLoad.toFixed(3)),
    overlap_factor: parseFloat(overlapFactor.toFixed(2)),
    sleep,
    hrv,
    rhr,
    readiness,
    execution_ratio: completedTasks / 5,
    confidence: {
      digital: stayfree.length > 0 ? 0.95 : 0.1,
      biometrics: sleep != null ? 0.9 : 0.2,
      execution: todayWin != null ? 1.0 : 0.5,
      // Freshness check
      is_stale: sleep != null && oura?.date !== format(new Date(), 'yyyy-MM-dd')
    }
  };
}

// --- VANGUARD CORE CLASS ---
export class VanguardCore {
  constructor(userId, db) {
    this.userId = userId;
    this.db = db;
  }

  // Prawdziwy z-score: (x - mu) / sigma
  // Wymaga historii do wyliczenia sigma. Bez sigma jest to tylko % delta.
  _zScore(value, mean, stdDev) {
    if (value == null || stdDev === 0) return 0;
    return (value - mean) / stdDev;
  }

  _mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  _stdDev(arr, mean) {
    if (arr.length < 2) return 0;
    const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
  }

  /**
   * Pobiera personalizowany baseline z ostatnich 30 dni.
   * Zwraca means + stdDevs dla każdej metryki.
   * Jeśli < 5 dni danych — tryb KALIBRACJA z bezpiecznymi domyślnymi.
   */
  async getPersonalBaseline() {
    const ninetyDaysAgo = format(subDays(new Date(), 90), 'yyyy-MM-dd');

    const { data: history } = await this.db
      .from('vanguard_daily_aggregates')
      .select('sleep_hours, hrv_avg, fragmentation_index, dopamine_load_index, screen_time_min, execution_score')
      .eq('user_id', this.userId)
      .gte('date', ninetyDaysAgo)
      .order('date', { ascending: false });

    const extract = (key) => (history || []).map(d => d[key]).filter(v => v != null);

    const sleepArr = extract('sleep_hours');
    const hrvArr   = extract('hrv_avg');
    const fragArr  = extract('fragmentation_index');
    const dopArr   = extract('dopamine_load_index');
    const stArr    = extract('screen_time_min');
    const execArr  = extract('execution_score');

    const sampleSize = sleepArr.length;

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

  /**
   * Klasyfikuje dzisiejszy stan względem personalnego baseline.
   * Przyjmuje signals z computeSignals().
   */
  async determineState(currentSignals, baseline) {
    const bl = baseline || await this.getPersonalBaseline();

    if (bl.calibrating) return VANGUARD_STATES.CALIBRATING;
    if (currentSignals.confidence.is_stale) return 'STALE_DATA';

    // Z-scores: dodatnie = lepsze od normy, ujemne = gorsze od normy
    // HRV i sen: wyższe = lepsze (standardowy kierunek)
    // Fragmentation i dopamine: wyższe = gorsze (odwracamy znak)
    const zSleep = this._zScore(currentSignals.sleep,         bl.means.sleep,        bl.stdDevs.sleep);
    const zHrv   = this._zScore(currentSignals.hrv,           bl.means.hrv,          bl.stdDevs.hrv);
    const zFrag  = -this._zScore(currentSignals.fragmentation, bl.means.fragmentation, bl.stdDevs.fragmentation);
    const zDopa  = -this._zScore(currentSignals.dopamine_load, bl.means.dopamine_load, bl.stdDevs.dopamine_load);

    const biologicalScore = (zSleep + zHrv) / 2;
    const digitalScore    = (zFrag + zDopa) / 2;
    const exec = currentSignals.execution_ratio ?? 0;

    if (biologicalScore < -2.0 && exec < 0.4)  return VANGUARD_STATES.CHAOS;
    if (biologicalScore < -1.0 && exec < 0.2)  return VANGUARD_STATES.RECOVERY;
    if (digitalScore < -1.5)                   return VANGUARD_STATES.CONSUMING;
    if (exec === 1.0 && biologicalScore >= 0)  return VANGUARD_STATES.LOCKED_IN;
    if (exec >= 0.8)                           return VANGUARD_STATES.MOMENTUM;
    if (biologicalScore >= -0.5 && exec < 0.4) return VANGUARD_STATES.AVOIDANCE;

    return VANGUARD_STATES.MOMENTUM;
  }

  /**
   * INTERPRETACJA BIOMETRII (Tłumacz sygnałów)
   * Zastępuje stare translateBiometrics ze stateEngine.js
   */
  static translateBiometrics(oura) {
    if (!oura) return [];
    const insights = [];
    
    if (oura.hrv_avg < 30) insights.push("🔴 Krytycznie niskie HRV - Układ współczulny w stresie. Priorytet: RECOVERY.");
    else if (oura.hrv_avg < 45) insights.push("🟡 Obniżone HRV - Organizm walczy z obciążeniem.");
    
    if (oura.temp_deviation > 0.5) insights.push("🔥 Podwyższona temperatura ciała - Możliwa infekcja lub silne przemęczenie.");
    
    if (oura.readiness_score < 70) insights.push("⚠️ Niski Readiness - Dziś nie jest dzień na rekordy. Tryb zachowawczy.");
    
    return insights;
  }

  /**
   * Formatuje kontekst baseline dla promptu AI.
   * AI widzi odchylenia procentowe i trend, nie surowe liczby.
   */
  formatBaselineContext(baseline, current) {
    if (baseline.calibrating) {
      return `--- PERSONAL BASELINE ---
STATUS: KALIBRACJA (${baseline.sampleSize}/5 wymaganych dni)
Baseline nieaktywny — uruchom save-daily-aggregate aby budować historię.`;
    }

    const fmt = (val, mean, stdDev, unit = '', invert = false) => {
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

  /**
   * SILNIK KORELACJI CZASOWEJ (Lag Correlation)
   */
  detectLagCorrelations(history) {
    if (!history || history.length < 3) return [];
    const correlations = [];
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

  async saveDailyAggregate(data) {
    const { error } = await this.db.from('vanguard_daily_aggregates').upsert({
      user_id: this.userId,
      date: format(new Date(), 'yyyy-MM-dd'),
      ...data
    });
    return !error;
  }

  /**
   * POBIERA KONTEKST TOŻSAMOŚCI (Identity Vault)
   */
  async evaluateIdentityVault() {
    const { data, error } = await this.db
      .from('life_goals')
      .select('vault_content')
      .eq('user_id', this.userId)
      .maybeSingle();

    if (error || !data) return "Brak zdefiniowanego Fundamentu.";
    return {
      philosophy: data.vault_content || "Nieokreślona"
    };
  }

  /**
   * HYBRYDOWY SILNIK PREDYKCJI (Vanguard 3.0)
   * Łączy Pearsona (Kręgosłup) z Cliff Detection (Refleks)
   */
  async computePredictions(current, history, baseline) {
    if (!history || history.length < 7) return null;

    // 1. Pobierz korelacje (Kręgosłup)
    const { data: corr } = await this.db
      .from('vanguard_correlations')
      .select('*')
      .eq('user_id', this.userId);

    // 2. Cliff Detection (Nieliniowe progi)
    const cliffFlags = [];
    if (current.sleep && current.sleep < 5.5) cliffFlags.push('CRITICAL_SLEEP_DEBT');
    if (current.dopamine_load > 1.8) cliffFlags.push('DOPAMINE_OVERLOAD_CLIFF');
    if (current.fragmentation > 2.0) cliffFlags.push('ATTENTION_FRAG_CLIFF');

    // 3. Synergy Engine (Interakcje sygnałów)
    let synergyRisk = 1.0;
    const isLowSleep = current.sleep && current.sleep < baseline.means.sleep;
    const isHighDopa = current.dopamine_load > baseline.means.dopamine_load;
    if (isLowSleep && isHighDopa) synergyRisk *= 1.5; // Synergia zniszczenia

    // 4. Momentum (Trend 7-dniowy)
    const last7 = history.slice(-7);
    const execTrend = this._mean(last7.map(d => d.execution_score));
    const isFalling = (current.execution_ratio || 0) < execTrend;

    // 5. Fusion (Statystyka + Refleks)
    let prediction = {
      predicted_state: 'STABLE',
      risk_score: 0.2,
      drivers: cliffFlags
    };

    if (cliffFlags.length > 0 || (synergyRisk > 1.2 && isFalling)) {
      prediction.predicted_state = 'AVOIDANCE_RISK';
      prediction.risk_score = 0.75 * synergyRisk;
    } else if (isFalling) {
      prediction.predicted_state = 'MOMENTUM_LOSS';
      prediction.risk_score = 0.4;
    }

    return prediction;
  }
}
