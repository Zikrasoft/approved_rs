export const SERVICE_SLUGS = [
  'diagnostics',
  'servicing',
  'brakes-suspension',
  'engine-gearbox',
  'bodywork-painting',
  'pre-purchase-inspection',
] as const;

export type ServiceSlug = (typeof SERVICE_SLUGS)[number];

export function isServiceSlug(value: string): value is ServiceSlug {
  return (SERVICE_SLUGS as readonly string[]).includes(value);
}

export const SHOP_SERVICE = 'parts-order';
