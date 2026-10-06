import {
  SERVICE_SLUGS_BY_BRAND,
  type BrandServiceSlug,
  type LabelledService,
} from '@podbor/brands';

export const SERVICE_SLUGS = SERVICE_SLUGS_BY_BRAND.carlab;

export type ServiceSlug = BrandServiceSlug<'carlab'>;

export function isServiceSlug(value: string): value is ServiceSlug {
  return (SERVICE_SLUGS as readonly string[]).includes(value);
}

export const SHOP_SERVICE = 'parts-order' satisfies LabelledService;
