import type { CollectionEntry } from 'astro:content';
import type { Locale } from '@/i18n/config';
import { localizedEntry, publishedEntries } from './localized';
import { buildFitmentIndex as buildIndex } from './fitment';

export type { FitmentEntry, FitmentIndex } from './fitment';
export { fitmentMatches } from './fitment';

export type Product = CollectionEntry<'products'>;

export function localizedProduct(product: Product, locale: Locale) {
  return localizedEntry(product, locale);
}

export function publishedProducts(products: Product[]): Product[] {
  return publishedEntries(products).sort((a, b) => a.data.price - b.data.price);
}

export function buildFitmentIndex(products: Product[]) {
  return buildIndex(products.map((product) => product.data.fitment));
}

export function formatDimensions(product: Product['data']): string {
  return `${product.lengthMm} × ${product.widthMm} × ${product.heightMm}`;
}
