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

export const SYSTEM_VERSION = '3.0';
export const NEURAL_LINK_VERSION = '3.1';

/** Fixed (non-parameterized) localStorage keys shared across components. */
export const STORAGE_KEYS = {
  THEME: 'vanguard_theme',
  KEEP_NOTES_LOCAL: 'vanguard_local_keep_notes',
  KEEP_NEW_DRAFT: 'vanguard_keep_new',
  SHUTDOWN_DISMISSED: 'vanguard_shutdown_dismissed',
  CALENDAR_SIDEBAR_COLLAPSED: 'vanguard_calendar_sidebar_collapsed',
  LAST_REMINDER_DATE: 'last_reminder_date',
  ENDMYOPIA_CALIBRATION: 'endmyopia_calibration',
  ENDMYOPIA_AUTO_CAPTURE: 'endmyopia_auto_capture',
} as const;

