export const PARTS_CATEGORY_SLUGS = [
  'maintenance-consumables',
  'brakes',
  'suspension',
  'engine-parts',
  'electrics',
  'transmission',
  'body-parts',
  'tires-wheels',
] as const;

export type PartsCategorySlug = (typeof PARTS_CATEGORY_SLUGS)[number];

export const isPartsCategorySlug = (
  value: string,
): value is PartsCategorySlug =>
  (PARTS_CATEGORY_SLUGS as readonly string[]).includes(value);
