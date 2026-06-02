/** Placeholder single-user ID. Override with env VANGUARD_USER_ID in production. */
export const DEFAULT_VANGUARD_USER_ID = "00000000-0000-0000-0000-000000000000";

export function getVanguardUserId(): string {
  return Deno.env.get("VANGUARD_USER_ID") || DEFAULT_VANGUARD_USER_ID;
}
