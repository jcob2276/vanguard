/** Default single-user ID — override with env VANGUARD_USER_ID in production. */
export const DEFAULT_VANGUARD_USER_ID = "165ae341-670c-46ce-82dc-434c4dbfcdfd";

export function getVanguardUserId(): string {
  return Deno.env.get("VANGUARD_USER_ID") || DEFAULT_VANGUARD_USER_ID;
}
