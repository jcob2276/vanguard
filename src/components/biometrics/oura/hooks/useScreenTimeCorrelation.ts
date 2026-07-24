import { useQuery } from '@tanstack/react-query';
import { useUserId } from '../../../../store/useStore';
import { shiftDateStr, getTodayWarsaw } from '../../../../lib/date';
import { fetchPhoneUsageRange } from '../../../../lib/phoneUsageApi';
import type { OuraHealthHubData } from '../types';

export interface PairedNight {
  date: string;
  sleepScore: number;
  deepSleepHours: number;
  latencyMins: number;
  lateNightMins: number;
  totalMins: number;
  topApps: Array<{ app: string; pkg?: string; min?: number }>;
}

interface CorrelationStats {
  avgScore: number | null;
  avgLatency: number | null;
  avgDeep: string | null;
  count: number;
}

function calcStats(nights: PairedNight[]): CorrelationStats {
  if (nights.length === 0) return { avgScore: null, avgLatency: null, avgDeep: null, count: 0 };
  const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  return {
    avgScore: avg(nights.map(d => d.sleepScore)),
    avgLatency: avg(nights.map(d => d.latencyMins)),
    avgDeep: (nights.reduce((a, b) => a + b.deepSleepHours, 0) / nights.length).toFixed(1),
    count: nights.length,
  };
}

export interface ScreenTimeCorrelation {
  paired: PairedNight[];
  low: CorrelationStats;
  high: CorrelationStats;
  dopamine: CorrelationStats;
  dopamineNights: PairedNight[];
  scoreDiff: number | null;
  latencyDiff: number | null;
  isLowSample: boolean;
  sampleWarning: string | null;
}

export function useScreenTimeCorrelation(ouraHistory: OuraHealthHubData['ouraHistory']): ScreenTimeCorrelation {
  const userId = useUserId();
  const today = getTodayWarsaw();
  const startDate = shiftDateStr(today, -30);

  const { data: phoneLogs = [] } = useQuery({
    queryKey: ['phone-usage-range', userId, startDate, today],
    queryFn: () => fetchPhoneUsageRange(userId!, startDate, today),
    enabled: !!userId,
  });

  const nights = ouraHistory ?? [];

  const paired: PairedNight[] = nights
    .map((night) => {
      const phone = phoneLogs.find((p) => p.date === night.date || p.date === shiftDateStr(night.date, -1));
      if (!phone || !night.sleep_score) return null;
      return {
        date: night.date,
        sleepScore: night.sleep_score,
        deepSleepHours: night.deep_sleep_hours ?? 0,
        latencyMins: night.latency_minutes ?? 0,
        lateNightMins: phone.late_night_minutes ?? 0,
        totalMins: phone.total_minutes ?? 0,
        topApps: (phone.top_apps as Array<{ app: string; pkg?: string; min?: number }>) || [],
      };
    })
    .filter((x): x is PairedNight => x !== null);

  const lowNights = paired.filter(d => d.lateNightMins < 30);
  const highNights = paired.filter(d => d.lateNightMins >= 30);
  
  // Align dopamine nights threshold with high screen time threshold (>= 30m)
  const dopamineNights = paired.filter(d =>
    d.lateNightMins >= 30 &&
    d.topApps.some(app => /pinterest|brave|musically|tiktok|badoo|xmobile|twitter/i.test(app.pkg || app.app))
  );

  const low = calcStats(lowNights);
  const high = calcStats(highNights);
  const dopamine = calcStats(dopamineNights);

  const isLowSample = paired.length < 7;
  const sampleWarning = isLowSample
    ? `Wskazówka statystyczna: Wyrywkowa próba N=${paired.length} nocy jest podatna na odchylenia. Jeśli 1 noc z wysokim wynikiem (np. 81 pkt po treningu) znajdzie się w grupie z ekranem, średnia ulega pozornemu zaburzeniu. Potrzeba min. 14 nocy z danymi, by potwierdzić ubytek fazy głębokiej.`
    : null;

  return {
    paired,
    low,
    high,
    dopamine,
    dopamineNights,
    scoreDiff: low.avgScore !== null && high.avgScore !== null ? low.avgScore - high.avgScore : null,
    latencyDiff: high.avgLatency !== null && low.avgLatency !== null ? high.avgLatency - low.avgLatency : null,
    isLowSample,
    sampleWarning,
  };
}
