import maintenanceConsumables from '@/assets/parts/maintenance-consumables.jpg';
import brakes from '@/assets/parts/brakes.jpg';
import suspension from '@/assets/parts/suspension.jpg';
import engineParts from '@/assets/parts/engine-parts.jpg';
import electrics from '@/assets/parts/electrics.jpg';
import transmission from '@/assets/parts/transmission.jpg';
import bodyParts from '@/assets/parts/body-parts.png';
import tiresWheels from '@/assets/parts/tires-wheels.jpg';

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

export const PARTS_CATEGORY_IMAGES = {
  'maintenance-consumables': maintenanceConsumables,
  brakes,
  suspension,
  'engine-parts': engineParts,
  electrics,
  transmission,
  'body-parts': bodyParts,
  'tires-wheels': tiresWheels,
} satisfies Record<PartsCategorySlug, ImageMetadata>;
