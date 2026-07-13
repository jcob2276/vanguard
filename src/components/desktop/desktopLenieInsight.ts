import { daysBefore } from './desktopMath';

export interface LenieLogRow {
  date: string;
  final_stimulus?: string | null;
  context_note?: string | null;
}

export function computeLenieInsight(logs: LenieLogRow[]) {
  if (!logs?.length) return null;
  const DOW_PL_LOCAL = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
  const recent = logs.slice(0, 10);
  const total30 = logs.filter((l) => l.date >= daysBefore(30)).length;
  const total60 = logs.filter((l) => l.date >= daysBefore(60) && l.date < daysBefore(30)).length;

  // Day-of-week peak
  const dowCount: Record<number, number> = {};
  for (const l of recent) {
    const d = new Date(l.date + 'T12:00:00Z').getUTCDay();
    dowCount[d] = (dowCount[d] || 0) + 1;
  }
  const sorted = Object.entries(dowCount).sort((a, b) => b[1] - a[1]);
  const peakDay = sorted[0] ? DOW_PL_LOCAL[+sorted[0][0]] : null;
  const peakN = sorted[0] ? sorted[0][1] : 0;

  // Top trigger keywords
  const STOP = new Set(
    'i w z na do sie to ze a nie jest bylo mi jak po przez od o ich je co byl ta te ten ta to mnie bo ale go mu tak juz czy wiec az no wtedy kiedy wlaczyl wlaczalem mialem bylo'.split(
      ' '
    )
  );
  const wc: Record<string, number> = {};
  const entryCount: Record<string, number> = {};
  const entriesWithText = recent.filter((l) => l.final_stimulus || l.context_note).length;

  for (const l of recent) {
    const text = [l.context_note || '', l.context_note || '', l.final_stimulus || ''].join(' ');
    const seen = new Set<string>();
    for (const w of text.toLowerCase().split(/\W+/)) {
      if (w.length > 3 && !STOP.has(w) && !seen.has(w)) {
        wc[w] = (wc[w] || 0) + 1;
        entryCount[w] = (entryCount[w] || 0) + 1;
        seen.add(w);
      }
    }
  }
  const noiseThreshold = Math.max(2, Math.ceil(entriesWithText * 0.6));
  const topW = Object.entries(entryCount)
    .filter(([, c]) => c >= 2 && c < noiseThreshold)
    .sort((a, b) => (wc[b[0]] || 0) - (wc[a[0]] || 0))
    .slice(0, 3)
    .map(([w]) => w);

  // Trend
  const trend = total60 > 0 ? Math.round((total30 - total60) / total60 * 100) : null;

  // Build sentences
  const parts = [];

  if (trend !== null && Math.abs(trend) >= 20) {
    parts.push(`${trend > 0 ? 'Wzrost' : 'Spadek'} o ${Math.abs(trend)}% vs poprzedni miesiąc (${total30} vs ${total60} wpadek).`);
  } else if (total30 > 0) {
    parts.push(
      `${total30} wpadki/wpadek w ostatnich 30 dniach${
        total60 > 0 ? ` — stabilna częstotliwość (${total60} poprzednio)` : ''
      }.`
    );
  }

  if (peakDay && peakN > 1) {
    parts.push(`Najczęstszy dzień wpadki: ${peakDay} (${peakN}/${recent.length} ostatnich).`);
  }

  if (topW.length) {
    parts.push(`Dominujące słowa w triggerach: ${topW.join(', ')}.`);
  }

  if (!parts.length) return 'Za mało danych do wyciągnięcia wzorca.';
  return parts.join(' ');
}
