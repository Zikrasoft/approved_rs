import {
  SERVICE_SLUGS_BY_BRAND,
  isBrandServiceSlug,
  type BrandServiceSlug,
  type LabelledService,
} from '@podbor/brands';

export const SERVICE_SLUGS = SERVICE_SLUGS_BY_BRAND.carlab;

export type ServiceSlug = BrandServiceSlug<'carlab'>;

export const isServiceSlug = (value: string): value is ServiceSlug =>
  isBrandServiceSlug('carlab', value);

export const SHOP_SERVICE = 'parts-order' satisfies LabelledService;
