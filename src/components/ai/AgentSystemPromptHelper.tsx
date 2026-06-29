const STORAGE_KEY = 'vanguard_oracle_user_conf';

/** Read user conf to inject into Oracle system prompt (call in gatherUserContext or OracleCard) */
export function getOracleUserConf(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw?.trim()) return '';
    return raw.trim();
  } catch {
    return '';
  }
}
