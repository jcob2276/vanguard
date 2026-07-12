import { zScore } from './stats.ts';
import { getWarsawDateString } from './time.ts';

export function generateActiveSignature(footprint: any[] = [], metrics: any = {}) {
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
    if (metrics.hrv_ratio < 0.60) markers.push('BIOMETRIC_STRESS_BASE');
  } else if (metrics.hrv != null && metrics.hrv < 35) {
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

export function translateBiometrics(oura: any, baselineMeans?: { hrv?: number; sleep?: number }) {
  if (!oura) return [];
  const insights: string[] = [];

  const hrvBaseline = baselineMeans?.hrv ?? null;
  if (oura.hrv_avg != null) {
    if (hrvBaseline) {
      const ratio = oura.hrv_avg / hrvBaseline;
      if (ratio < 0.60) insights.push("🔴 HRV krytycznie poniżej Twojej normy (−" + Math.round((1 - ratio) * 100) + "%). Priorytet: RECOVERY.");
      else if (ratio < 0.80) insights.push("🟡 HRV obniżone vs Twoja norma (−" + Math.round((1 - ratio) * 100) + "%). Organizm w obciążeniu.");
    } else {
      if (oura.hrv_avg < 30) insights.push("🔴 Krytycznie niskie HRV — Układ współczulny w stresie. Priorytet: RECOVERY.");
      else if (oura.hrv_avg < 45) insights.push("🟡 Obniżone HRV — Organizm walczy z obciążeniem.");
    }
  }

  if (oura.temp_deviation > 0.5) insights.push("🔥 Podwyższona temperatura ciała — Możliwa infekcja lub silne przemęczenie.");
  if (oura.readiness_score < 70) insights.push("⚠️ Niski Readiness — Dziś nie jest dzień na rekordy. Tryb zachowawczy.");

  return insights;
}

export function formatBaselineContext(baseline: any, current: any) {
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

export function detectLagCorrelations(history: any[]) {
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

export async function evaluateIdentityVault(db: any, userId: string) {
  const today = getWarsawDateString(new Date());
  
  const [fundamentRes, journalRes, aggregateRes, knowledgeRes] = await Promise.all([
    db.from('user_fundament').select('*').eq('user_id', userId).maybeSingle(),
    db.from('daily_wins').select('journal_entry, gratitude_entry, mood_score').eq('user_id', userId).eq('date', today).maybeSingle(),
    db.from('vanguard_daily_aggregates').select('*').eq('user_id', userId).eq('date', today).maybeSingle(),
    db.from('vanguard_knowledge').select('*').eq('user_id', userId).order('importance_score', { ascending: false }).limit(3),
  ]);

  return {
    philosophy: fundamentRes.data?.philosophy || "Brak",
    mission: fundamentRes.data?.vision || "Nieokreślona",
    pillars: fundamentRes.data?.identity || "Nieokreślone",
    daily_reflection: {
      journal: journalRes.data?.journal_entry,
      gratitude: journalRes.data?.gratitude_entry,
      mood: journalRes.data?.mood_score,
    },
    today_metrics: aggregateRes.data || {},
    knowledge_vault: knowledgeRes.data || [],
  };
}

export async function getEpisodeForDate(db: any, userId: string, date: string) {
  const [oura, aggregate, wins] = await Promise.all([
    db.from('oura_daily_summary').select('*').eq('user_id', userId).eq('date', date).maybeSingle(),
    db.from('vanguard_daily_aggregates').select('*').eq('user_id', userId).eq('date', date).maybeSingle(),
    db.from('daily_wins').select('*').eq('user_id', userId).eq('date', date).maybeSingle(),
  ]);

  return {
    date,
    metrics: {
      hrv: aggregate.data?.hrv_avg || oura.data?.hrv_avg,
      sleep: aggregate.data?.sleep_hours || oura.data?.total_sleep_hours,
      readiness: aggregate.data?.readiness_score || oura.data?.readiness_score,
      identity_score: aggregate.data?.identity_score,
      state: aggregate.data?.final_state,
    },
    behavior: {
      tasks_done: aggregate.data?.execution_score ? aggregate.data.execution_score * 5 : 0,
      journal: wins.data?.journal_entry,
      mood: wins.data?.mood_score,
    },
  };
}

export function calculateGoalAlignment(todayWin: any) {
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
    gaps,
  };
}
