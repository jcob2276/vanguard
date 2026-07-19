import { formatMedicalDate, type MarkerSeries } from './medicalAnalytics';
import { optimalStatus } from '../getBased/markerBridge';
import {
  SCORE_MARKER_KEYS,
  scoreHasEvidence,
  type FullPanelInfo,
} from './medicalRetestContext';

export type RetestSuggestion = {
  id: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  reason: string;
};

export type MedicalUserContext = {
  age: number | null;
  sex: string | null;
  activeProjectNames: string[];
  sprintGoal: string | null;
  trainingHint: string | null;
};

export function computeAgeFromBirthDate(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const born = new Date(`${birthDate.slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

export function buildRetestSuggestions(input: {
  series: MarkerSeries[];
  fullPanel: FullPanelInfo | null;
  user: MedicalUserContext;
}): RetestSuggestion[] {
  const out: RetestSuggestion[] = [];
  const byKey = new Map(input.series.map((s) => [s.marker_key, s]));
  const panelAge = input.fullPanel?.ageDays ?? null;

  if (panelAge != null && panelAge > 365) {
    out.push({
      id: 'panel-stale',
      priority: 'high',
      title: 'Odśwież panel bazowy (morfo + lipidogram + TSH + D)',
      reason: `Ostatni pełny panel (${formatMedicalDate(input.fullPanel!.date)}, ${panelAge} dni temu) jest archiwalny — nie opisuje dzisiejszego stanu.`,
    });
  } else if (panelAge != null && panelAge > 180) {
    out.push({
      id: 'panel-aging',
      priority: 'medium',
      title: 'Rozważ powtórzenie Pakietu 20+ (lub core panelu)',
      reason: `Pełny panel ma ${panelAge} dni — w granicy „stare” dla decyzji zdrowotnych.`,
    });
  }

  const ferritin = byKey.get('ferritin');
  if (ferritin && optimalStatus('ferritin', ferritin.latest.value, ferritin.latest.unit) === 'below') {
    if (ferritin.history.length < 2) {
      out.push({
        id: 'ferritin-followup',
        priority: 'medium',
        title: 'Ferrytyna — kontrola po suplementacji / diecie',
        reason: 'Wynik poniżej pasma optymalnego getbased; jeden pomiar — warto powtórzyć z morfologią.',
      });
    }
  }

  const ldl = byKey.get('ldl_cholesterol_calculated');
  if (ldl && optimalStatus('ldl_cholesterol_calculated', ldl.latest.value, ldl.latest.unit) !== 'in') {
    const panelFresh = input.fullPanel && (input.fullPanel.ageDays ?? 999) <= 180;
    if (panelFresh) {
      out.push({
        id: 'ldl-context',
        priority: 'low',
        title: 'LDL poza optymalnym — omów z lekarzem, nie tylko retest',
        reason: 'Świeży wynik już jest; kolejny krok to interpretacja + ewentualnie ApoB, nie ślepy repeat.',
      });
    }
  }

  if (!byKey.get('glucose') && panelAge != null && panelAge > 180) {
    out.push({
      id: 'metabolic-gap',
      priority: 'low',
      title: 'Brak świeżej glukozy na czczo',
      reason: 'Przy odświeżaniu panelu dodaj glukozę (i opcjonalnie insulina/HbA1c jeśli lekarz uzna).',
    });
  }

  const tsh = byKey.get('tsh');
  if (tsh && tsh.latest.value > 3.5) {
    out.push({
      id: 'thyroid-expand',
      priority: 'medium',
      title: 'TSH podwyższone / górne pasmo — FT3/FT4 przy kolejnym pobraniu',
      reason: `TSH ${tsh.latest.value} ${tsh.latest.unit ?? ''} — pełniejszy obraz tarczycy przy retescie.`,
    });
  }

  if (input.user.trainingHint && panelAge != null && panelAge > 120) {
    out.push({
      id: 'training-panel',
      priority: 'medium',
      title: 'Panel przy wysokim obciążeniu treningowym',
      reason: `${input.user.trainingHint} — świeże ferrytyna + morfologia + magnez mają sens operacyjnie.`,
    });
  }

  if (input.user.activeProjectNames.length > 0 && panelAge != null && panelAge > 180) {
    out.push({
      id: 'projects-energy',
      priority: 'low',
      title: 'Badania vs aktywne projekty',
      reason: `Projekty: ${input.user.activeProjectNames.slice(0, 2).join(', ')} — odświeżony panel daje twardy kontekst do energii i focusu.`,
    });
  }

  const staleScores = Object.entries(SCORE_MARKER_KEYS).filter(
    ([, keys]) => keys.some((k) => byKey.has(k)) && !scoreHasEvidence(byKey, keys),
  );
  if (staleScores.length > 0 && panelAge != null && panelAge <= 180) {
    out.push({
      id: 'repeat-for-trend',
      priority: 'low',
      title: 'Drugie pobranie za ~3–6 mies. (trendy)',
      reason: 'Masz świeży panel, ale Biology Scores potrzebują drugiego punktu w czasie.',
    });
  }

  const seen = new Set<string>();
  return out
    .filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    })
    .slice(0, 6);
}

function buildOracleLabPrompt(
  suggestions: RetestSuggestion[],
  user: MedicalUserContext,
  fullPanel: FullPanelInfo | null,
): string {
  const ageLine = user.age != null ? `${user.age} lat` : 'wiek nieznany';
  const sexLine = user.sex ? `, płeć: ${user.sex}` : '';
  const panelLine = fullPanel
    ? `Ostatni pełny panel: ${formatMedicalDate(fullPanel.date)} (${fullPanel.markerCount} markerów, ${fullPanel.ageDays ?? '?'} dni temu).`
    : 'Brak pełnego panelu w bazie.';

  const detList = suggestions.length
    ? suggestions.map((s) => `- [${s.priority}] ${s.title}: ${s.reason}`).join('\n')
    : '- Brak automatycznych propozycji — oceń od zera na podstawie medical_context.';

  return `[Badania — priorytetyzacja z kontekstem]

Masz pełny state_vector Vanguard (medical_context z datami, trening, sen, projekty, stream).

Profil: ${ageLine}${sexLine}.
${panelLine}
${user.sprintGoal ? `Sprint: ${user.sprintGoal}` : ''}
${user.trainingHint ? `Trening: ${user.trainingHint}` : ''}

Propozycje deterministyczne systemu (start, nie dogma):
${detList}

ZADANIE:
1. Oceń które badania / retesty mają dla mnie NAJWIĘKSZE przełożenie TERAZ — max 3–5 punktów.
2. Każdy punkt: jeden konkret z MOICH danych (data wyniku, luka, sprzeczność z zachowaniem) — bez diagnozy.
3. Odrzuć propozycje bez sensu w moim kontekście (wiek, brak objawów, świeży wynik).
4. Nie twierdz że coś „jest nie tak” — mów co warto odświeżyć i dlaczego operacyjnie.
5. Na końcu: jedna linia „nie robić teraz” (overtesting).`;
}
