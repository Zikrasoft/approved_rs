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
  ['brake-pads', 'brakes-suspension'],
  ['control-arms', 'brakes-suspension'],
  ['bushings', 'brakes-suspension'],
  ['tie-rods', 'brakes-suspension'],
  ['shock-absorbers', 'brakes-suspension'],
  ['timing-belts', 'engine-gearbox'],
  ['poly-v-belts', 'engine-gearbox'],
  ['transmission', 'engine-gearbox'],
  ['body-parts', 'bodywork-painting'],
  ['maintenance-consumables', 'servicing'],
  ['oil-filters', 'servicing'],
  ['engine-oil', 'servicing'],
]);

export const partsCategoryFor = (
  service: ServiceSlug,
  categories: { slug: string; listed: number | null }[],
): string | null =>
  categories.find(
    ({ slug, listed }) =>
      (listed ?? 0) > 0 &&
      INSTALLATION_SERVICE_BY_CATEGORY.get(slug) === service,
  )?.slug ?? null;

export const installationService = (
  category: { slug: string } | null,
): ServiceSlug =>
  INSTALLATION_SERVICE_BY_CATEGORY.get(category?.slug ?? '') ?? 'servicing';
