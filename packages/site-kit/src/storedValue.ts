export type ValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type Schema<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
};

export function readStored(
  key: string,
  storage?: Pick<Storage, 'getItem'>,
): string | null {
  try {
    return (storage ?? localStorage).getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(
  key: string,
  value: string,
  storage?: Pick<Storage, 'setItem'>,
): boolean {
  try {
    (storage ?? localStorage).setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function readStoredJson<T, F>(
  key: string,
  schema: Schema<T>,
  fallback: F,
  storage?: Pick<Storage, 'getItem'>,
): T | F {
  try {
    const parsed = schema.safeParse(
      JSON.parse(readStored(key, storage) ?? 'null'),
    );
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

export const writeStoredJson = (
  key: string,
  value: unknown,
  storage?: Pick<Storage, 'setItem'>,
): boolean => writeStored(key, JSON.stringify(value), storage);

export function forgetStored(
  key: string,
  storage?: Pick<Storage, 'removeItem'>,
): boolean {
  try {
    (storage ?? localStorage).removeItem(key);
    return true;
  } catch {
    return false;
  }
}
