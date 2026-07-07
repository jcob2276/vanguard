/** Placeholder single-user ID. Override with env VANGUARD_USER_ID in production. */
const DEFAULT_VANGUARD_USER_ID = "00000000-0000-0000-0000-000000000000";

export function getVanguardUserId(): string {
  const userId = Deno.env.get("VANGUARD_USER_ID");
  if (!userId || userId === "00000000-0000-0000-0000-000000000000") {
    throw new Error("Fatal: VANGUARD_USER_ID is not configured or is the default ghost user ID.");
  }
  return userId;
}
