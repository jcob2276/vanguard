import { formatWarsawDate, getTodayWarsaw } from '../../../lib/date';

export async function syncYazioHistory({ supabase, supabaseUrl, userId, days = 25 }: { supabase: any; supabaseUrl: string; userId: string; days?: number }) {
  const { data: { session: authSession } } = await supabase.auth.getSession();
  const response = await fetch(`${supabaseUrl}/functions/v1/sync-yazio`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authSession.access_token}`
    },
    body: JSON.stringify({ userId, sync_history: true, days })
  });
  return response.json();
}

export async function analyzeFoodQuality({ supabase, supabaseUrl, userId, analyzeDate, analyzePeriod }: { supabase: any; supabaseUrl: string; userId: string; analyzeDate: string; analyzePeriod: number }) {
  const { data: { session: authSession } } = await supabase.auth.getSession();
  const body = analyzePeriod === 1
    ? { userId, date: analyzeDate }
    : (() => {
        const to = getTodayWarsaw();
        const from = formatWarsawDate(Date.now() - (analyzePeriod - 1) * 864e5);
        return { userId, dateFrom: from, dateTo: to };
      })();

  const response = await fetch(`${supabaseUrl}/functions/v1/analyze-food-quality`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authSession.access_token}`
    },
    body: JSON.stringify(body)
  });
  return response.json();
}

export async function analyzeTrainingLoad({ supabase, supabaseUrl, userId }: { supabase: any; supabaseUrl: string; userId: string }) {
  const { data: { session: authSession } } = await supabase.auth.getSession();
  const response = await fetch(`${supabaseUrl}/functions/v1/analyze-training-load`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authSession.access_token}`
    },
    body: JSON.stringify({ userId })
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || response.status);
  }
  return response.json();
}
