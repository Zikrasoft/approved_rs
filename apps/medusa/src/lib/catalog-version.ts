import { z } from 'zod';

export const CATALOG_VERSION_KEY = 'catalog_version';

export const UNSTAMPED = 'unstamped';

export const CATALOG_EVENTS = [
  'product.created',
  'product.updated',
  'product.deleted',
  'product-variant.created',
  'product-variant.updated',
  'product-variant.deleted',
  'product-type.created',
  'product-type.updated',
  'product-type.deleted',
  'pricing.price.created',
  'pricing.price.updated',
  'pricing.price.deleted',
  'translation.created',
  'translation.updated',
  'translation.deleted',
] as const;

const stampSchema = z.object({ [CATALOG_VERSION_KEY]: z.string().min(1) });

export const nextCatalogVersion = (now = new Date()): string =>
  now.toISOString();

export function catalogVersionOf(metadata: unknown): string {
  const stamp = stampSchema.safeParse(metadata);
  return stamp.success ? stamp.data[CATALOG_VERSION_KEY] : UNSTAMPED;
}
