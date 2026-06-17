export function unwrap<T>({ data, error }: { data: T | null; error: any }): T {
  if (error) throw new Error(error.message);
  if (data === null || data === undefined) throw new Error('No data returned');
  return data;
}

export function unwrapList<T>({ data, error }: { data: T[] | null; error: any }): T[] {
  if (error) throw new Error(error.message);
  return data ?? [];
}
