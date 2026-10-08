import { sha256Hex } from '@podbor/i18n/translate/core';

import { TARGET_LOCALES, type TargetLocale } from './translate-config';

export const TRANSLATED_FROM = 'translated_from';

const SOURCE_KEYS = ['title', 'subtitle', 'description'] as const;

type SourceKey = (typeof SOURCE_KEYS)[number];

export type ProductSource = Partial<Record<SourceKey, string>>;

export function productSource(
  product: Partial<Record<SourceKey, string | null>>,
): ProductSource {
  return Object.fromEntries(
    SOURCE_KEYS.flatMap((field) => {
      const value = product[field]?.trim();
      return value ? [[field, value]] : [];
    }),
  );
}

export function sourceHash(source: ProductSource): string {
  return sha256Hex(JSON.stringify(source));
}

export const translatedFromKey = (locale: TargetLocale): string =>
  `${TRANSLATED_FROM}_${locale}`;

export function translationStamps(
  source: ProductSource,
  locales: readonly TargetLocale[] = TARGET_LOCALES,
): Record<string, string> {
  const hash = sourceHash(source);
  return Object.fromEntries(
    locales.map((locale) => [translatedFromKey(locale), hash]),
  );
}
