export {
  APPROVED,
  BRAND_LOCALES,
  CARLAB,
  DETAILS,
  DEVELOPER,
  WORKSHOP_ADDRESS,
  brandLocale,
  developerCreditUrl,
  splitDeveloperCredit,
  isBrandLocale,
} from './brands.ts';
export type { Brand, BrandKey, BrandLocale } from './brands.ts';

export { BRAND_SITES, BRANDS } from './registry.ts';

export {
  PARTNER_SERVICE,
  PARTS_ORDER_SERVICE,
  SERVICE_LABELS_RU,
  SERVICE_SLUGS_BY_BRAND,
  isBrandServiceSlug,
  isPartnerService,
  serviceLabel,
} from './serviceLabels.ts';
export type {
  BrandServiceSlug,
  LabelledService,
  PartnerService,
} from './serviceLabels.ts';
