/** Package-name heuristics — keep in sync with scripts/aw/aw-phone-import.cjs */
export const PHONE_USAGE_CATEGORY_KEYS = [
  'social',
  'messaging',
  'entertainment',
  'ai',
  'browser',
] as const;

export type PhoneUsageCategory = (typeof PHONE_USAGE_CATEGORY_KEYS)[number] | 'inne';

const CATEGORY_MATCHERS: Record<Exclude<PhoneUsageCategory, 'inne'>, string[]> = {
  social: ['musically', 'tiktok', 'twitter', 'xmobile', 'instagram', 'badoo', 'snapchat', 'pinterest'],
  messaging: ['orca', 'telegram', 'whatsapp', 'viber', 'signal'],
  entertainment: ['youtube', 'netflix', 'twitch', 'spotify', 'tidal', 'hbomax', 'prime'],
  ai: ['chatgpt', 'grok', 'claude', 'perplexity', 'gemini', 'copilot'],
  browser: ['chrome', 'brave', 'firefox', 'opera', 'edge', 'duckduckgo'],
};

export function categorizePhonePackage(packageName: string): PhoneUsageCategory {
  const pkg = packageName.toLowerCase();
  for (const key of PHONE_USAGE_CATEGORY_KEYS) {
    if (CATEGORY_MATCHERS[key].some((needle) => pkg.includes(needle))) return key;
  }
  return 'inne';
}

export interface PhoneUsagePackageRow {
  packageName: string;
  foregroundMs: number;
}

export interface PhoneUsageSnapshot {
  packages: PhoneUsagePackageRow[];
  unlocks: number;
  lateNightMs: number;
}

export interface PhoneUsageDailyPayload {
  user_id: string;
  date: string;
  total_minutes: number;
  late_night_minutes: number;
  social_minutes: number;
  messaging_minutes: number;
  entertainment_minutes: number;
  ai_minutes: number;
  browser_minutes: number;
  unlocks: number;
  top_apps: Array<{ app: string; pkg: string; min: number }>;
}

export function buildPhoneUsageDailyPayload(
  userId: string,
  date: string,
  snapshot: PhoneUsageSnapshot,
): PhoneUsageDailyPayload {
  const catMinutes: Record<Exclude<PhoneUsageCategory, 'inne'>, number> = {
    social: 0,
    messaging: 0,
    entertainment: 0,
    ai: 0,
    browser: 0,
  };

  let totalMs = 0;
  const ranked: Array<{ pkg: string; ms: number }> = [];

  for (const row of snapshot.packages) {
    if (row.foregroundMs <= 0) continue;
    totalMs += row.foregroundMs;
    ranked.push({ pkg: row.packageName, ms: row.foregroundMs });
    const cat = categorizePhonePackage(row.packageName);
    if (cat !== 'inne') catMinutes[cat] += row.foregroundMs;
  }

  ranked.sort((a, b) => b.ms - a.ms);
  const top_apps = ranked.slice(0, 10).map(({ pkg, ms }) => ({
    app: pkg.split('.').pop() ?? pkg,
    pkg,
    min: Math.round(ms / 60_000),
  }));

  const toMin = (ms: number) => Math.round(ms / 60_000);

  return {
    user_id: userId,
    date,
    total_minutes: toMin(totalMs),
    late_night_minutes: toMin(snapshot.lateNightMs),
    social_minutes: toMin(catMinutes.social),
    messaging_minutes: toMin(catMinutes.messaging),
    entertainment_minutes: toMin(catMinutes.entertainment),
    ai_minutes: toMin(catMinutes.ai),
    browser_minutes: toMin(catMinutes.browser),
    unlocks: snapshot.unlocks,
    top_apps,
  };
}
