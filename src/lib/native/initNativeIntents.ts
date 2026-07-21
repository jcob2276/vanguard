/**
 * Android share target + deep links (shortcuts, https://localhost/...).
 */
import { App } from '@capacitor/app';
import { isNativePlatform } from './platform';
import { ShareIntent } from './shareIntentPlugin';

const PATH_PREFIX = '__path__=';

type NavigateFn = (path: string) => void;

let navigateHandler: NavigateFn | null = null;

export function registerNativeNavigate(handler: NavigateFn | null): void {
  navigateHandler = handler;
}

function navigateFromNativeTarget(target: string): void {
  navigateHandler?.(target);
}

function navigateFromUrl(url: string): void {
  try {
    const parsed = new URL(url);
    if (parsed.host !== 'localhost') return;
    const path = `${parsed.pathname}${parsed.search}`;
    navigateFromNativeTarget(path.startsWith('/') ? path : `/${path}`);
  } catch {
    /* ignore malformed launch URLs */
  }
}

function parseNativePendingRoute(query: string | undefined): string | null {
  if (!query) return null;
  if (query.startsWith(PATH_PREFIX)) {
    return decodeURIComponent(query.slice(PATH_PREFIX.length));
  }
  const shared = query.includes('share_url') || query.includes('share_text') || query.includes('share_title');
  if (shared) {
    const params = new URLSearchParams(query);
    const blob = `${params.get('share_url') ?? ''} ${params.get('share_text') ?? ''}`;
    const hasUrl = /https?:\/\/[^\s]+/.test(blob);
    return hasUrl ? `/links?${query}` : `/keep?${query}`;
  }
  return null;
}

export async function initNativeIntents(): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    const pending = await ShareIntent.consumePending();
    const route = parseNativePendingRoute(pending.query);
    if (route) navigateFromNativeTarget(route);
  } catch {
    /* plugin unavailable on non-Android builds */
  }

  await App.addListener('appUrlOpen', ({ url }) => {
    navigateFromUrl(url);
  });
}

export async function consumeNativeShareOnResume(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    const pending = await ShareIntent.consumePending();
    const route = parseNativePendingRoute(pending.query);
    if (route) navigateFromNativeTarget(route);
  } catch {
    /* noop */
  }
}
