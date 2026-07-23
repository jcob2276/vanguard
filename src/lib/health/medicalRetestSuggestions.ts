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
