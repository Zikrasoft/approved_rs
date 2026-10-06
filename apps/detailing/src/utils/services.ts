import { SERVICE_SLUGS_BY_BRAND, type BrandServiceSlug } from '@podbor/brands';

export const SERVICE_SLUGS = SERVICE_SLUGS_BY_BRAND.details;

export type ServiceSlug = BrandServiceSlug<'details'>;

export function isServiceSlug(value: string): value is ServiceSlug {
  return (SERVICE_SLUGS as readonly string[]).includes(value);
}
