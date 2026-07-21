import { registerPlugin } from '@capacitor/core';
import type { PhoneUsageSnapshot } from '@vanguard/domain';

interface UsageStatsAccessResult {
  granted: boolean;
}

export interface UsageStatsPlugin {
  hasAccess(): Promise<UsageStatsAccessResult>;
  openAccessSettings(): Promise<void>;
  getDailySnapshot(options: { beginMs: number; endMs: number }): Promise<PhoneUsageSnapshot>;
}

export const UsageStats = registerPlugin<UsageStatsPlugin>('UsageStats');
