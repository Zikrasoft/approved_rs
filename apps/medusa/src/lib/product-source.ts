import { sha256Hex } from '@podbor/i18n/translate/core';

export const TRANSLATED_FROM = 'translated_from';

const SOURCE_FIELDS = ['title', 'subtitle', 'description'] as const;

type SourceField = (typeof SOURCE_FIELDS)[number];

export type ProductSource = Partial<Record<SourceField, string>>;

export function productSource(
  product: Partial<Record<SourceField, string | null>>,
): ProductSource {
  return Object.fromEntries(
    SOURCE_FIELDS.flatMap((field) => {
      const value = product[field]?.trim();
      return value ? [[field, value]] : [];
    }),
  );
}

export function sourceHash(source: ProductSource): string {
  return sha256Hex(JSON.stringify(source));
}
