import type { CollectionEntry } from 'astro:content';
import type { Locale } from '@/i18n/config';
import { localizedEntry, publishedEntries } from './localized';

export type Product = CollectionEntry<'products'>;
export type FitmentEntry = Product['data']['fitment'][number];

export function localizedProduct(product: Product, locale: Locale) {
  return localizedEntry(product, locale);
}

export function publishedProducts(products: Product[]): Product[] {
  return publishedEntries(products).sort((a, b) => a.data.price - b.data.price);
}

export function fitmentMatches(
  fitment: FitmentEntry[],
  filter: { make?: string; model?: string; year?: number },
): boolean {
  if (!filter.make && !filter.model && !filter.year) return true;
  return fitment.some((entry) => {
    if (filter.make && entry.make !== filter.make) return false;
    if (filter.model && entry.model !== filter.model) return false;
    if (
      filter.year &&
      (filter.year < entry.yearFrom || filter.year > entry.yearTo)
    )
      return false;
    return true;
  });
}

export interface FitmentIndex {
  makes: string[];
  modelsByMake: Record<string, string[]>;
  yearsByModel: Record<string, number[]>;
}

export function buildFitmentIndex(products: Product[]): FitmentIndex {
  const modelsByMake = new Map<string, Set<string>>();
  const yearsByModel = new Map<string, Set<number>>();

  products.forEach((product) => {
    product.data.fitment.forEach((entry) => {
      const models = modelsByMake.get(entry.make) ?? new Set<string>();
      models.add(entry.model);
      modelsByMake.set(entry.make, models);

      const key = `${entry.make}|${entry.model}`;
      const years = yearsByModel.get(key) ?? new Set<number>();
      for (let year = entry.yearFrom; year <= entry.yearTo; year++) {
        years.add(year);
      }
      yearsByModel.set(key, years);
    });
  });

  const sortedStrings = (values: Iterable<string>) => [...values].sort();

  return {
    makes: sortedStrings(modelsByMake.keys()),
    modelsByMake: Object.fromEntries(
      [...modelsByMake].map(([make, models]) => [make, sortedStrings(models)]),
    ),
    yearsByModel: Object.fromEntries(
      [...yearsByModel].map(([key, years]) => [
        key,
        [...years].sort((a, b) => b - a),
      ]),
    ),
  };
}

export function formatDimensions(product: Product['data']): string {
  return `${product.lengthMm} × ${product.widthMm} × ${product.heightMm}`;
}
