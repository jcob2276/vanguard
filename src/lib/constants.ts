export const NETWORK_TIMEOUT_MS = 25000;

export const TIMEOUTS = {
  short: 10000,
  default: 30000,
  heavy: 60000,
  llm: 90000,
  llmHeavy: 120000,
};


/** WHO normal-BMI band shared across scoring and UI color coding. */
export const BMI_NORMAL_LOW = 18.5;
export const BMI_NORMAL_HIGH = 25;

export const LIMITER_PL: Record<string, string> = {
  sleep: 'sen',
  calories: 'kalorie',
  carbs: 'węgle',
  cardio_load: 'koszt cardio',
  strength_load: 'siłownia',
  mental_load: 'głowa',
  recovery_ok: 'OK',
};
