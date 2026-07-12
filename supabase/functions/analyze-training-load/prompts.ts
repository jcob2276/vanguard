import { fmt } from "../_shared/trainingHelpers.ts";

export function buildSystemPrompt(): string {
  return `Jesteś elitarnym trenerem hybrydowym klasy premium (poziom opieki 10 000 USD/miesiąc): łączysz hipertrofię, siłę, sylwetkę, odporność tkanek, prewencję kontuzji i wydolność bez psucia pracy trenera biegowego.

KONTEKST WSPÓŁPRACY:
- Sportowiec MA bardzo dobrego trenera biegowego. Ten trener prowadzi plan biegowy.
- Nie jesteś od przepisywania planu biegowego ani od pouczania "biegaj więcej/mniej".
- Twoja główna wartość: co zrobić na siłowni, jak progresować, jakie ćwiczenia dobrać.

TWOJE PRIORYTETY — w tej kolejności:
1. SIŁOWNIA I SYLWETKA — progresja, dobór ćwiczeń, objętość, intensywność.
2. PREWENCJA KONTUZJI — łydki, stopy, piszczelowy, single-leg, core.
3. CONCURRENT TRAINING BALANCE — jak siłownia wspiera bieganie.
4. HOLISTYKA — sen, readiness, strain, HRV, żywienie.
5. BIEGANIE — tylko jako kontekst i druga opinia.

STYL ANALIZY:
- Brzmisz jak realny trener. Konkret, hierarchia, decyzje.
- Najpierw mów, co to oznacza dla siłowni.
- Konkretne liczby zawsze. Nie "za mało pracy", ale "0 serii siłowych vs norma 19".
- Diagnozy, nie opisy. Szukaj PRZYCZYNY.
- Rekomendacje biegowe formułuj miękko: "do omówienia z trenerem biegowym".
- Specyficzne sesje siłowe: ćwiczenie, serie, powtórzenia, ciężar/RPE/RIR.
- Flagi ryzyka kontuzji: brak ekscentrycznego treningu łydek, brak single-leg, brak nóg przez >2 tyg.
- Rozdzielaj cztery rzeczy: (1) wolumen km, (2) strukturę maratońską, (3) dystrybucję intensywności, (4) ciągłość siłowni.

KONTEKST DNIA TYGODNIA — BARDZO WAŻNE:
- W poniedziałek i wtorek nie wolno pisać, że "ten tydzień jest słaby" tylko dlatego, że W0 ma mało km/serii.
- Porównuj W0 do normy pro-rata do dzisiaj.
- Krytykuj opóźnienie tylko gdy jest realna zaległość.

W polu "strength_prescription" zawsze podajesz KONKRETNĄ następną sesję siłową:
- Minimalne 5-7 ćwiczeń (konkretne: wyciskanie płaskie, martwy ciąg, itp.)
- Każde ćwiczenie: obciążenie z e1RM (np. e1RM=97kg, seria 5 = ~83kg)
- Pole strength_prescription.exercises ma bazować na COACHBRAIN.session_blueprint.
- If critic_scores.interference_risk is high, use low-interference variant, RIR 3.

Mówisz po polsku. Jesteś bezpośredni. Nie motywujesz — analizujesz.`;
}

export function buildUserMsg(opts: {
  dataQualityNote: string;
  hrMax: number | null; z2Ceiling: number | null; thresholdHr: number | null;
  today: string; todayDowLabel: string; todayDow: number;
  baseRunKm: number; baseSets: number; baseStrain: number | null;
  expectedRunKmToDate: number; expectedSetsToDate: number; expectedStrainToDate: number | null;
  earlyWeek: boolean; midWeek: boolean;
  acwr: number | null; acwrLabel: Record<string, string>; acwrBand: (r: number) => string;
  monotony: number | null; acuteLoad: number | null; chronicLoad: number | null;
  w0: any; w1: any; w2: any; w3: any;
  dayLines: string[]; weekMuscleTags: string[];
  progressionLines: string[]; planText: string;
  complianceLines: string[]; exerciseHistoryLines: string;
  coachSignals: any;
}): string {
  const { dataQualityNote, hrMax, z2Ceiling, thresholdHr, today, todayDowLabel, todayDow,
    baseRunKm, baseSets, baseStrain, expectedRunKmToDate, expectedSetsToDate, expectedStrainToDate,
    earlyWeek, midWeek, acwr, acwrLabel, acwrBand, monotony, acuteLoad, chronicLoad,
    w0, w1, w2, w3, dayLines, weekMuscleTags, progressionLines, planText,
    complianceLines, exerciseHistoryLines, coachSignals } = opts;

  const fmtWeek = (w: any, label: string) =>
    `${label}: ${w.km}km bieganie (${w.runCount} biegów${w.hasLongRun ? ', w tym DŁUGI' : ', BEZ długiego'}, maks ${w.maxRunKm}km) | ${w.sets} serii siłowych | strain śr ${fmt(w.strainAvg)} | readiness śr ${fmt(w.recovAvg, 0)} | HRV śr ${fmt(w.hrvAvg, 0, 'ms')} | sen ${fmt(w.sleepAvg, 1, 'h')} | sauna ${w.saunaCount}x`;

  return `${dataQualityNote}PROFIL SPORTOWCA (szacunki z ostatnich 28 dni):
HRmax: ${hrMax ?? '—'} | Z2 ceiling: ${z2Ceiling ?? '—'} BPM | Próg tlenowy: ${thresholdHr ?? '—'} BPM

KALENDARZ ANALIZY:
Dzisiaj: ${today} (${todayDowLabel}, dzień ${todayDow}/7). W0 jest w toku.
Norma tygodniowa z W-1..W-3: bieganie ${baseRunKm.toFixed(1)}km/tydz, siłownia ${Math.round(baseSets)} serii/tydz${baseStrain != null ? `, strain ${baseStrain.toFixed(1)}` : ''}.
Oczekiwane pro-rata: bieganie ~${expectedRunKmToDate}km, siłownia ~${expectedSetsToDate} serii${expectedStrainToDate != null ? `, strain ~${expectedStrainToDate}` : ''}.
Status: ${earlyWeek ? 'WCZESNY TYDZIEŃ' : midWeek ? 'ŚRODEK TYGODNIA' : 'KOŃCÓWKA TYGODNIA'}.

WSKAŹNIKI OBCIĄŻENIA:
${acwr != null ? `ACWR: ${acwr.toFixed(2)} → ${acwrLabel[acwrBand(acwr)]}` : 'ACWR: brak danych'}
${monotony != null ? `Monotonia: ${monotony.toFixed(2)} → ${monotony >= 2.0 ? '⚠️ wysoka' : 'OK'}` : 'Monotonia: brak danych'}
Chronic: ${chronicLoad != null ? fmt(chronicLoad) : '—'}/21 | Acute: ${acuteLoad != null ? fmt(acuteLoad) : '—'}/21

TREND 4-TYGODNIOWY:
${fmtWeek(w3, 'W-3')}
${fmtWeek(w2, 'W-2')}
${fmtWeek(w1, 'W-1')}
${fmtWeek(w0, 'W0')}

TEN TYDZIEŃ — DZIEŃ PO DNIU:
${dayLines.length ? dayLines.join('\n\n') : '(brak danych)'}

PARTIE MIĘŚNIOWE: ${weekMuscleTags.length ? weekMuscleTags.join(', ') : '—'}

PROGRESJA SIŁOWA (e1RM vs 3-tygodniowy maks):
${progressionLines.length ? progressionLines.join('\n') : '(brak danych)'}

PLAN MARATOŃSKI:
${planText}

COMPLIANCE:
${complianceLines.length ? complianceLines.join('\n') : '(brak)'}

HISTORIA ĆWICZEŃ:
${exerciseHistoryLines || '(brak danych)'}

COACHBRAIN:
${JSON.stringify(coachSignals, null, 2)}

---
Odpowiedz WYŁĄCZNIE surowym obiektem JSON (bez markdown):
{
  "load_status": "elevated|optimal|undertrained",
  "volume_status": "low|ok|high",
  "structure_status": "missing_long_run|ok|chaotic|unknown",
  "intensity_status": "too_hard|ok|too_easy|unknown",
  "strength_continuity": "gap|ok|overloaded|unknown",
  "coach_decision_summary": "1 zdanie — najważniejsza decyzja CoachBrain",
  "load_summary": "1 zdanie — rozdziel km od bodźca",
  "recovery_status": "deficit|ok|surplus",
  "recovery_summary": "1 zdanie — stan gotowości",
  "training_trajectory": "1-2 zdania — trend siłowni i wpływ biegania",
  "marathon_readiness": "1 zdanie — druga opinia hybrydowa o bieganiu",
  "injury_risk": {
    "level": "low|moderate|high",
    "flags": ["sygnał ryzyka z liczbami"],
    "prevention": "1-2 zdania — co zrobić"
  },
  "strength_note": "1 zdanie — najważniejsza decyzja siłowa",
  "missing_muscles": ["partie brakujące — max 4"],
  "sauna_note": "1 zdanie — sauna vs norma",
  "key_insights": ["insight 1", "insight 2", "insight 3"],
  "strength_prescription": {
    "focus": "co ćwiczymy i dlaczego",
    "critic": "1 zdanie — ocena blueprintu",
    "exercises": [
      { "name": "nazwa ćwiczenia", "sets_reps": "4×5", "load": "92.5kg", "note": "e1RM ~97kg" }
    ]
  },
  "recommendations": [
    { "priority": 1, "action": "akcja siłowa max 10 słów", "reason": "1 zdanie z liczbami" },
    { "priority": 2, "action": "...", "reason": "..." },
    { "priority": 3, "action": "...", "reason": "..." }
  ]
}`;
}
