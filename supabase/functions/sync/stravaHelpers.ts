export async function resolveHrFromOura(
  supabase: any, userId: string, activity: any, detail: any, isDup: boolean, pairMap: Map<number, any>
): Promise<{ hrAvg: number | null; hrMax: number | null; hrSource: string; hrFrozen: boolean; splitsWithHR: any[] }> {
  let hrAvg = detail.has_heartrate ? detail.average_heartrate : null;
  let hrMax = detail.has_heartrate ? detail.max_heartrate : null;
  let hrSource = 'strava';
  let hrFrozen = false;
  let splitsWithHR = detail.splits_metric || [];

  if (isDup) {
    const ouraDetail = pairMap.get(activity.id);
    if (ouraDetail) {
      hrAvg = ouraDetail.average_heartrate ?? hrAvg;
      hrMax = ouraDetail.max_heartrate ?? hrMax;
      hrSource = 'oura';
      hrFrozen = detectFrozenSensor(ouraDetail.splits_metric || [], hrMax);
      splitsWithHR = mergeHRIntoSplits(detail.splits_metric || [], ouraDetail.splits_metric || []);
    }
  } else {
    const startTime = new Date(activity.start_date);
    const duration = activity.elapsed_time || activity.moving_time || 0;
    const endTime = new Date(startTime.getTime() + duration * 1000);
    const { data: dbHrSamples } = await supabase.from('oura_heartrate').select('ts, bpm').eq('user_id', userId).gte('ts', startTime.toISOString()).lte('ts', endTime.toISOString()).order('ts', { ascending: true });

    if (dbHrSamples && dbHrSamples.length > 0) {
      const bpms = dbHrSamples.map((r: any) => r.bpm);
      hrAvg = Math.round(bpms.reduce((sum: number, val: number) => sum + val, 0) / bpms.length);
      hrMax = Math.max(...bpms);
      hrSource = 'oura';
      hrFrozen = detectFrozenSensor(detail.splits_metric || [], hrMax);

      const splits = detail.splits_metric || [];
      let currentOffsetMs = 0;
      const newSplits = [];
      for (const split of splits) {
        const splitElapsed = split.elapsed_time || split.moving_time;
        const splitStart = new Date(startTime.getTime() + currentOffsetMs);
        const splitEnd = new Date(startTime.getTime() + currentOffsetMs + splitElapsed * 1000);
        currentOffsetMs += splitElapsed * 1000;
        const splitSamples = dbHrSamples.filter((r: any) => { const t = new Date(r.ts).getTime(); return t >= splitStart.getTime() && t < splitEnd.getTime(); });
        let splitAvg = null;
        if (splitSamples.length > 0) { splitAvg = Math.round(splitSamples.reduce((sum: number, val: any) => sum + val.bpm, 0) / splitSamples.length); }
        else { let nearest = null; let minDiff = Infinity; const splitMid = splitStart.getTime() + (splitElapsed * 1000) / 2; for (const r of dbHrSamples) { const diff = Math.abs(new Date(r.ts).getTime() - splitMid); if (diff < minDiff) { minDiff = diff; nearest = r.bpm; } } splitAvg = nearest; }
        newSplits.push({ ...split, average_heartrate: splitAvg });
      }
      splitsWithHR = newSplits;
    }
  }
  return { hrAvg, hrMax, hrSource, hrFrozen, splitsWithHR };
}

export function isOuraDuplicate(activity: any): boolean {
  const name = (activity.name || '').toLowerCase();
  const device = (activity.device_name || '').toLowerCase();
  return device.includes('oura') || /\d+%.*oura/i.test(name);
}

export function detectFrozenSensor(splits: any[], hrMax: number | null): boolean {
  if (!hrMax) return false;
  const hrValues = splits.map(s => s.average_heartrate).filter(h => h != null) as number[];
  if (hrValues.length < 3) return false;
  const frozenCount = hrValues.filter(h => Math.abs(h - hrMax) < 0.5).length;
  return frozenCount / hrValues.length > 0.6;
}

export function mergeHRIntoSplits(stravaSplits: any[], ouraSplits: any[]): any[] {
  if (!ouraSplits?.length) return stravaSplits;
  const ouraByIdx = new Map<number, number>(ouraSplits.map(s => [s.split, s.average_heartrate]));
  return stravaSplits.map(s => ({ ...s, average_heartrate: ouraByIdx.get(s.split) ?? s.average_heartrate ?? null }));
}

export function pairOuraDuplicates(primaries: any[], ouras: any[], detailMap: Record<number, any>): Map<number, any> {
  const pairs = new Map<number, any>();
  for (const oura of ouras) {
    const ouraStart = new Date(oura.start_date).getTime();
    const primary = primaries.find(p => p.sport_type === oura.sport_type && Math.abs(new Date(p.start_date).getTime() - ouraStart) < 120_000);
    if (primary) pairs.set(primary.id, detailMap[oura.id] || oura);
  }
  return pairs;
}
