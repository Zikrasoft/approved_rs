type Entry = { value: Promise<unknown>; expires: number };

let entries = new Map<string, Entry>();

export function clearCatalogueMemo(): void {
  entries = new Map();
}

export function memoized<T>(
  name: string,
  compute: () => Promise<T>,
  ttlMs = Infinity,
): Promise<T> {
  const current = entries;
  const known = current.get(name);
  if (known && known.expires > Date.now()) return known.value as Promise<T>;
  const value = compute();
  current.set(name, { value, expires: Date.now() + ttlMs });
  value.catch(() => current.delete(name));
  return value;
}
