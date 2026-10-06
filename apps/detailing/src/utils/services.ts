import {
  SERVICE_SLUGS_BY_BRAND,
  isBrandServiceSlug,
  type BrandServiceSlug,
} from '@podbor/brands';

export const SERVICE_SLUGS = SERVICE_SLUGS_BY_BRAND.details;

export type ServiceSlug = BrandServiceSlug<'details'>;

export const isServiceSlug = (value: string): value is ServiceSlug =>
  isBrandServiceSlug('details', value);
