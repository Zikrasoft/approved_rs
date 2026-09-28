import type { Field, ProductTypeDef, Spec } from './registry.ts';

export const LANDING_MIN_PRODUCTS = 3;

export interface LandingPage {
  slug: string;
  key: string;
  value: string | number;
}

export function landingSlug(field: Field, value: string | number): string {
  const raw = field.kind === 'number' ? `${value}${field.unit}` : String(value);
  return raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function compareValues(a: string | number, b: string | number): number {
  return typeof a === 'number' && typeof b === 'number'
    ? a - b
    : String(a).localeCompare(String(b), 'en');
}

export function landingPages(
  type: ProductTypeDef,
  specs: readonly Spec[],
  minProducts = LANDING_MIN_PRODUCTS,
): LandingPage[] {
  const pages: LandingPage[] = [];
  const taken = new Set<string>();
  for (const field of type.fields) {
    if (!field.landing) continue;
    const counts = new Map<string | number, number>();
    for (const spec of specs) {
      const value = spec[field.key];
      const values: (string | number)[] = Array.isArray(value)
        ? [...new Set<string>(value)]
        : typeof value === 'string' || typeof value === 'number'
          ? [value]
          : [];
      for (const item of values) counts.set(item, (counts.get(item) ?? 0) + 1);
    }
    const order: (string | number)[] =
      field.kind === 'enum'
        ? field.values.map((option) => option.value)
        : [...counts.keys()].sort(compareValues);
    for (const value of order) {
      if ((counts.get(value) ?? 0) < minProducts) continue;
      const slug = landingSlug(field, value);
      if (!slug || taken.has(slug)) {
        throw new Error(
          `landing slug "${slug}" is empty or taken in ${type.key} (${field.key}=${value})`,
        );
      }
      taken.add(slug);
      pages.push({ slug, key: field.key, value });
    }
  }
  return pages;
}
