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

export const VIN_INQUIRY_SERVICE =
  'vin-parts-inquiry' satisfies LabelledService;

const INSTALLATION_SERVICE_BY_CATEGORY = new Map<string, ServiceSlug>([
  ['brakes', 'brakes-suspension'],
  ['suspension', 'brakes-suspension'],
  ['transmission', 'engine-gearbox'],
]);

export const installationService = (
  category: { slug: string } | null,
): ServiceSlug =>
  INSTALLATION_SERVICE_BY_CATEGORY.get(category?.slug ?? '') ?? 'servicing';
