/**
 * adversary.ts — Reality Adversary: analiza ostatnich 72h vs plan.
 * Wykrywa rozjazd między intencją a wykonaniem i rekomenduje tension action.
 */

export const ADVERSARY_FALLBACK = 'W ostatnich 72h widać rozjazd między planem a wykonaniem. Wybierz jeden mały ruch, który zamknie najbliższą otwartą pętlę.';

export const FORBIDDEN_ADVERSARY = /masz centralny wzorzec|to wynika z traumy|twoim problemem jest|od lat robisz|musisz przepracować|dzieci[eń]stwo|głęboka przyczyna|osobowo[sś][cć]|diagnoza/i;

export type AdversaryResult = {
  biggest_inconsistency: string;
  most_relevant_open_loop: string;
  recommended_tension_action: {
    action: string;
    why_it_matters: string;
    minimum_version: string;
    due_time: string;
    verification: 'self' | 'human' | 'external_result';
  };
};

export function sanitizeAdversaryOutput<T extends Record<string, any>>(output: T): T {
  const result = { ...output } as Record<string, any>;

  for (const field of ['biggest_inconsistency', 'most_relevant_open_loop', 'adversary_note']) {
    if (typeof result[field] === 'string' && FORBIDDEN_ADVERSARY.test(result[field])) {
      console.warn(`[adversary] sanitized "${field}" — forbidden phrase detected`);
      result[field] = ADVERSARY_FALLBACK;
    }
  }

  if (result.recommended_tension_action && typeof result.recommended_tension_action === 'object') {
    const ta = { ...result.recommended_tension_action } as Record<string, any>;
    for (const field of ['action', 'why_it_matters', 'minimum_version']) {
      if (typeof ta[field] === 'string' && FORBIDDEN_ADVERSARY.test(ta[field])) {
        console.warn(`[adversary] sanitized "recommended_tension_action.${field}" — forbidden phrase detected`);
        ta[field] = ADVERSARY_FALLBACK;
      }
    }
    result.recommended_tension_action = ta;
  }

  return result as T;
}

export async function runRealityAdversary(
  yesterdayPlan: any | null,
  stream72h: any[],
  deepseekApiKey: string
): Promise<AdversaryResult | null> {
  try {
    const planContext = yesterdayPlan
      ? `PLAN NA WCZORAJ (${yesterdayPlan.target_date}):
- First move: ${yesterdayPlan.first_move_morning || '—'}
- Top 3: ${(yesterdayPlan.top3 || []).join(' | ')}
- Open loops: ${(yesterdayPlan.open_loops || []).join(' | ') || '—'}
- Tension action: ${yesterdayPlan.tension_action?.action || '—'} [status: ${yesterdayPlan.tension_action?.status || '—'}]`
      : 'BRAK planu na wczoraj.';

    const streamLines = stream72h
      .filter(s => s.content && s.content.trim().length > 10)
      .slice(0, 25)
      .map(s => {
        const dt = new Date(s.created_at).toLocaleString('pl', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
        return `[${dt}] ${s.content.substring(0, 180)}`;
      })
      .join('\n');

    const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deepseekApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        temperature: 0.2,
        max_tokens: 500,
        messages: [
          {
            role: 'system',
            content: `Jesteś Reality Adversary. Analizujesz TYLKO dane z ostatnich 72h.

DOZWOLONE: "W ostatnich 72h powtarza się...", "Wczoraj plan był X, wykonanie było Y...", "To zadanie wraca trzeci raz...", "Najmniejszy ruch teraz to..."
ZAKAZANE: "Masz centralny wzorzec...", "To wynika z traumy...", "Twoim problemem jest...", "Od lat robisz...", "Musisz przepracować...", "Twój problem to..."

Odpowiedz TYLKO poprawnym JSON, zero markdown, zero dodatkowego tekstu.`
          },
          {
            role: 'user',
            content: `${planContext}

STRUMIEŃ OSTATNICH 72H:
${streamLines || 'Brak wpisów.'}

Wygeneruj JSON:
{
  "biggest_inconsistency": "rozjazd między planem a wykonaniem — jedno zdanie, tylko fakty z 72h",
  "most_relevant_open_loop": "co wraca 2-3 razy w ostatnich 72h — jedno zdanie, konkretna rzecz",
  "recommended_tension_action": {
    "action": "jeden konkretny ruch który jest odkładany — jedno zdanie imperatywne",
    "why_it_matters": "dlaczego ten ruch — oparte na danych z 72h, jedno zdanie",
    "minimum_version": "absolutne minimum — np. jedno zdanie zamiast całej odpowiedzi",
    "due_time": "konkretny czas np. 'do 14:00 jutro'",
    "verification": "self"
  }
}`
          }
        ]
      })
    });

    if (!dsRes.ok) {
      console.warn('[adversary] DeepSeek error:', dsRes.status);
      return null;
    }
    const dsData = await dsRes.json().catch(() => null);
    const raw = dsData?.choices?.[0]?.message?.content || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[adversary] no JSON in response');
      return null;
    }
    const parsed = JSON.parse(jsonMatch[0]);
    const sanitized = sanitizeAdversaryOutput(parsed);
    console.log('[adversary] output:', JSON.stringify(sanitized).substring(0, 200));
    return sanitized;
  } catch (err) {
    console.error('[adversary] error:', err);
    return null;
  }
}
