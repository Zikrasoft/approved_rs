import {
  TRANSLATABLE_LOCALES,
  type TranslatableLocale,
} from '../../src/i18n/config.ts';

const TARGET_LOCALES = TRANSLATABLE_LOCALES;

export type Action =
  | { kind: 'skip' }
  | { kind: 'backfill' } // no locale needs translating, just record the hash
  | { kind: 'translate'; locales: readonly TranslatableLocale[] };

// Pure decision logic, shared by every translate-*.ts script (was hand-
// duplicated verbatim between translate-cases.ts and translate-i18n.ts) —
// pulled out so it's testable without touching the filesystem or network.
// `hasReal` must check actual content, not just key presence: a blank
// field saves as '' rather than omitting the key, so a brand-new entry can
// already have translations.en = '' the moment it's created — treating
// that as "already translated" would leave it permanently blank.
export function decideAction(params: {
  storedHash: string | undefined;
  currentHash: string;
  hasReal: (locale: TranslatableLocale) => boolean;
}): Action {
  const { storedHash, currentHash, hasReal } = params;
  // Only a *present* hash that disagrees means "ru changed since we last
  // translated it" — a missing hash means this file predates hash-tracking
  // (e.g. the original manual backfill), not "ru changed". Treating
  // undefined as stale would overwrite perfectly good existing
  // translations with fresh AI output the very first time this ran.
  const ruChanged = storedHash !== undefined && storedHash !== currentHash;
  const missingLocales = TARGET_LOCALES.filter((l) => !hasReal(l));
  const localesToTranslate = ruChanged ? TARGET_LOCALES : missingLocales;

  if (localesToTranslate.length === 0) {
    return storedHash === currentHash ? { kind: 'skip' } : { kind: 'backfill' };
  }
  return { kind: 'translate', locales: localesToTranslate };
}
