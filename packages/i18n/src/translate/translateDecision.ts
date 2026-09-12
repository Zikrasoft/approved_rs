export type Action<L extends string> =
  | { kind: 'skip' }
  | { kind: 'backfill' }
  | { kind: 'translate'; locales: readonly L[] };

export function decideAction<L extends string>(params: {
  targetLocales: readonly L[];
  storedHash: string | undefined;
  currentHash: string;
  hasReal: (locale: L) => boolean;
}): Action<L> {
  const { targetLocales, storedHash, currentHash, hasReal } = params;
  const ruChanged = storedHash !== undefined && storedHash !== currentHash;
  const missingLocales = targetLocales.filter((l) => !hasReal(l));
  const localesToTranslate = ruChanged ? targetLocales : missingLocales;

  if (localesToTranslate.length === 0) {
    return storedHash === currentHash ? { kind: 'skip' } : { kind: 'backfill' };
  }
  return { kind: 'translate', locales: localesToTranslate };
}
