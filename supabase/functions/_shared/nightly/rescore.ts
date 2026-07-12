const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Edwards 5-zone TRIMP (StrainScorer.swift): %HRR thresholds → zone weight
function edwardsTrimp(samples: { ts: string; bpm: number }[], hrMax: number, restingHr: number): number {
  const hrr = hrMax - restingHr;
  if (hrr <= 0 || samples.length < 2) return 0;
  const sorted = [...samples].sort((a, b) => a.ts.localeCompare(b.ts));
  let trimp = 0;
  for (let i = 1; i < sorted.length; i++) {
    const dtMin = (new Date(sorted[i].ts).getTime() - new Date(sorted[i - 1].ts).getTime()) / 60000;
    if (dtMin <= 0 || dtMin > 10) continue; // gap guard — nie liczymy przerw w danych jako wysiłku
    const pctHrr = clamp(((sorted[i].bpm - restingHr) / hrr) * 100, 0, 100);
    const zoneWeight = pctHrr >= 90 ? 5 : pctHrr >= 80 ? 4 : pctHrr >= 70 ? 3 : pctHrr >= 60 ? 2 : pctHrr >= 50 ? 1 : 0;
    trimp += zoneWeight * dtMin;
  }
  return trimp;
}

// strain = 100 * ln(TRIMP+1) / ln(7201) — log-mapping z 4.3
function trimpToStrain(trimp: number): number {
  return clamp((100 * Math.log(trimp + 1)) / Math.log(7201), 0, 100);
}

// Keytel 2005 (uproszczone, per-minutę): kcal/min = f(HR, weight, age, sex)
function keytelKcalPerMin(bpm: number, weightKg: number, age: number, isMale: boolean): number {
  return isMale
    ? (-55.0969 + 0.6309 * bpm + 0.1988 * weightKg + 0.2017 * age) / 4.184
    : (-20.4022 + 0.4472 * bpm - 0.1263 * weightKg + 0.074 * age) / 4.184;
}

export async function runRescoreWorkoutSessionsInternal(supabase: any, userId: string, days: number): Promise<any> {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data: profile } = await supabase
    .from('nutrition_profile')
    .select('birth_date, sex')
    .eq('user_id', userId).maybeSingle();
  const age = profile?.birth_date
    ? Math.floor((Date.now() - new Date(profile.birth_date).getTime()) / 31557600000)
    : 30;
  const isMale = (profile?.sex || 'male').toLowerCase().startsWith('m');
  const hrMax = 208 - 0.7 * age; // Tanaka 2001

  const { data: bw } = await supabase.from('body_metrics')
    .select('weight').eq('user_id', userId).not('weight', 'is', null)
    .order('date', { ascending: false }).limit(1).maybeSingle();
  const weightKg = Number(bw?.weight) || 75;

  const { data: restRow } = await supabase.from('oura_daily_summary')
    .select('rhr_avg').eq('user_id', userId).not('rhr_avg', 'is', null)
    .order('date', { ascending: false }).limit(1).maybeSingle();
  const restingHr = Number(restRow?.rhr_avg) || 60;

  const { data: sessions, error: sErr } = await supabase
    .from('workout_sessions')
    .select('id, start_time, end_time, hr_strain_score')
    .eq('user_id', userId)
    .not('start_time', 'is', null)
    .not('end_time', 'is', null)
    .gte('start_time', since);
  if (sErr) throw sErr;

  const updates: any[] = [];
  for (const s of (sessions || [])) {
    const { data: hrSamples, error: hrErr } = await supabase
      .from('oura_heartrate')
      .select('ts, bpm')
      .eq('user_id', userId)
      .gte('ts', s.start_time).lte('ts', s.end_time);
    if (hrErr || !hrSamples?.length) continue;

    const bpms = hrSamples.map((r: any) => r.bpm);
    const avgHr = bpms.reduce((a: number, b: number) => a + b, 0) / bpms.length;
    const peakHr = Math.max(...bpms);
    const trimp = edwardsTrimp(hrSamples, hrMax, restingHr);
    const strain = trimpToStrain(trimp);

    const durMin = (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 60000;
    const kcal = Math.max(0, keytelKcalPerMin(avgHr, weightKg, age, isMale) * durMin);

    updates.push({
      id: s.id,
      hr_avg_bpm: Math.round(avgHr * 10) / 10,
      hr_peak_bpm: peakHr,
      hr_strain_score: Math.round(strain * 10) / 10,
      hr_kcal_est: Math.round(kcal),
      hr_rescored_at: new Date().toISOString(),
    });
  }

  for (const upd of updates) {
    const { id, ...patch } = upd;
    const { error: updErr } = await supabase.from('workout_sessions').update(patch).eq('id', id);
    if (updErr) console.error(`[rescore] session ${id} update failed`, updErr.message);
  }

  return { user_id: userId, sessions_checked: sessions?.length || 0, sessions_rescored: updates.length };
}

export async function runRescoreWorkoutSessions(
  supabase: any,
  scopedUserId: string | null,
  days: number
): Promise<{ success: boolean; results: any[] }> {
  let uq = supabase.from('user_settings').select('user_id').not('oura_token', 'is', null);
  if (scopedUserId) uq = uq.eq('user_id', scopedUserId);
  const { data: users, error: uErr } = await uq;
  if (uErr) throw uErr;

  const results: any[] = [];
  for (const u of (users || [])) {
    const uid = u.user_id;
    try {
      const res = await runRescoreWorkoutSessionsInternal(supabase, uid, days);
      results.push(res);
    } catch (error: any) {
      console.error(`[rescore] user ${uid} failed`, error);
      results.push({ user_id: uid, error: error.message || String(error) });
    }
  }

  const scopedError = scopedUserId && results.length === 1 && results[0]?.error;
  if (scopedError) {
    throw new Error(scopedError);
  }
  return { success: true, results };
}
