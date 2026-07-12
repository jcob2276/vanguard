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
  const ouraByIdx = new Map<number, number>(
    ouraSplits.map(s => [s.split, s.average_heartrate])
  );
  return stravaSplits.map(s => ({
    ...s,
    average_heartrate: ouraByIdx.get(s.split) ?? s.average_heartrate ?? null,
  }));
}

export function pairOuraDuplicates(
  primaries: any[],
  ouras: any[],
  detailMap: Record<number, any>
): Map<number, any> {
  const pairs = new Map<number, any>();
  for (const oura of ouras) {
    const ouraStart = new Date(oura.start_date).getTime();
    const primary = primaries.find(p => {
      const pStart = new Date(p.start_date).getTime();
      return (
        p.sport_type === oura.sport_type &&
        Math.abs(pStart - ouraStart) < 120_000
      );
    });
    if (primary) {
      const ouraDetail = detailMap[oura.id] || oura;
      pairs.set(primary.id, ouraDetail);
    }
  }
  return pairs;
}
