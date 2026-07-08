/**
 * solar.ts — wrapper nad suncalc dla danych astronomicznych
 * Wszystkie obliczenia są deterministyczne (czysta matematyka, zero API calls).
 * Domyślna lokalizacja: Warszawa
 */
import * as SunCalc from 'suncalc';

export const LAT_DEFAULT = 52.2297;  // Warszawa
export const LON_DEFAULT = 21.0122;  // Warszawa

export interface SunTimes {
  sunrise: Date;
  sunset: Date;
  solarNoon: Date;
  /** Minuty od północy */
  sunriseMin: number;
  sunsetMin: number;
}

export interface MoonPhaseInfo {
  /** 0–1: 0 = nów, 0.25 = pierwsza kwadra, 0.5 = pełnia, 0.75 = ostatnia kwadra */
  phase: number;
  /** Emoji odpowiadające fazie */
  emoji: string;
  /** Polska nazwa fazy */
  name: string;
  /** true jeśli to jedna z 4 głównych faz (nów/kwadra/pełnia) — ±1 dzień tolerancja */
  isMajor: boolean;
}

const MOON_EMOJIS = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'] as const;

function phaseToEmoji(phase: number): string {
  const idx = Math.round(phase * 8) % 8;
  return MOON_EMOJIS[idx];
}

function phaseToName(phase: number): string {
  if (phase < 0.03 || phase > 0.97) return 'Nów';
  if (phase < 0.22) return 'Przybywający sierp';
  if (phase < 0.28) return 'Pierwsza kwadra';
  if (phase < 0.47) return 'Przybywający gibbous';
  if (phase < 0.53) return 'Pełnia';
  if (phase < 0.72) return 'Ubywający gibbous';
  if (phase < 0.78) return 'Ostatnia kwadra';
  return 'Ubywający sierp';
}

function isMajorPhase(phase: number): boolean {
  // Tolerancja ~±0.04 (≈1 dzień) dla 4 głównych faz
  const checkpoints = [0, 0.25, 0.5, 0.75, 1];
  return checkpoints.some((cp) => Math.abs(phase - cp) < 0.04);
}

/**
 * Zwraca godziny wschodu i zachodu słońca dla danego dnia i lokalizacji.
 */
export function getSunTimes(
  date: Date | string,
  lat = LAT_DEFAULT,
  lon = LON_DEFAULT
): SunTimes {
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : date;
  const times = SunCalc.getTimes(d, lat, lon);

  // suncalc can return null for extreme latitudes (polar day/night) — fallback to sensible defaults
  const sunrise = times.sunrise ?? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 6, 0, 0);
  const sunset  = times.sunset  ?? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 18, 0, 0);
  const solarNoon = times.solarNoon ?? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);

  const sunriseMin = sunrise.getHours() * 60 + sunrise.getMinutes();
  const sunsetMin  = sunset.getHours()  * 60 + sunset.getMinutes();

  return {
    sunrise,
    sunset,
    solarNoon,
    sunriseMin,
    sunsetMin,
  };
}

/**
 * Zwraca dane o fazie księżyca dla danego dnia.
 */
export function getMoonPhase(date: Date | string): MoonPhaseInfo {
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : date;
  const moon = SunCalc.getMoonIllumination(d);
  const phase = moon.phase;

  return {
    phase,
    emoji: phaseToEmoji(phase),
    name: phaseToName(phase),
    isMajor: isMajorPhase(phase),
  };
}

/**
 * Formatuje datę (Date) do stringa HH:MM w strefie Warsaw.
 */
export function formatTimeWarsaw(date: Date): string {
  return date.toLocaleTimeString('pl-PL', {
    timeZone: 'Europe/Warsaw',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
