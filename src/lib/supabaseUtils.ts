/**
 * Unwrap a Supabase query result that MUST return data (e.g. `.select().single()`).
 * Throws on error or when data is null/undefined.
 */
export function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  if (data === null || data === undefined) throw new Error('No data returned');
  return data;
}

/**
 * Unwrap a Supabase `.maybeSingle()` result where null is a valid business outcome.
 * Throws on error, returns T | null.
 */
export function unwrapMaybe<T>({ data, error }: { data: T | null; error: { message: string } | null }): T | null {
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Unwrap a Supabase list query result. Returns [] on null data.
 */
export function unwrapList<T>({ data, error }: { data: T[] | null; error: { message: string } | null }): T[] {
  if (error) throw new Error(error.message);
  return data ?? [];
}
