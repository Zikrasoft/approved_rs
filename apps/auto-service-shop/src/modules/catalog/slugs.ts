import { MedusaError } from '@medusajs/framework/utils';
import { RESERVED_PARTS_SEGMENTS } from '@podbor/catalog-contract';

import { adminError } from '../_shared/admin-error';
import type { SlugKind } from './models/slug-redirect';

export type SluggedKind = Exclude<SlugKind, 'part'>;

export type SlugInput = Record<string, unknown> & { slug?: string };

export type SluggedRow = { id: string; slug: string };

export type Retirement = {
  id: string;
  slug: string;
  scope_id: string | null;
  target_kind: SlugKind | null;
  target_id: string | null;
};

export const SLUG_COLUMNS = { select: ['id', 'slug'], take: null };

export const RETIRING_DELETES = {
  part_identifier: 'deletePartIdentifiers',
  part: 'deleteParts',
  vehicle: 'deleteVehicles',
  model: 'deleteVehicleModels',
  make: 'deleteMakes',
  brand: 'deleteBrands',
  category: 'deleteCategories',
} as const;

export type RetiringTable = keyof typeof RETIRING_DELETES;

export const scopedKind = (kind: SluggedKind) =>
  kind === 'vehicle' || kind === 'model';

export const slugScopeOf = (
  kind: SluggedKind,
  row: SlugInput,
): string | null =>
  kind === 'vehicle'
    ? String(row.model_id)
    : kind === 'model'
      ? String(row.make_id)
      : null;

// TODO: a move that lands a Model in a Make already holding its slug fails on the unique index; re-slug it as mergeModels does for Vehicles if staff hit it.
export const MODELS_FOLLOW_THEIR_MAKE = `update vehicle_model m set make_id = s.make_id
  from chassis c join series s on s.id = c.series_id
  where c.id = m.chassis_id and m.make_id <> s.make_id`;

export const slugInUse = () =>
  adminError(
    MedusaError.Types.CONFLICT,
    'SLUG_TAKEN',
    'This slug is taken or was used before',
  );

export const reservedSection = (kind: SluggedKind, slug: string) =>
  kind === 'make' &&
  RESERVED_PARTS_SEGMENTS.some((segment) => segment === slug);

export const refuseReservedSection = (kind: SluggedKind, slug: string) => {
  if (reservedSection(kind, slug)) {
    throw adminError(
      MedusaError.Types.INVALID_DATA,
      'SLUG_RESERVED',
      'This slug is a storefront section',
    );
  }
};
