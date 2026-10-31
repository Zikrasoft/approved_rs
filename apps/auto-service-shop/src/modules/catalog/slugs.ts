import { MedusaError } from '@medusajs/framework/utils';
import {
  RESERVED_PARTS_SEGMENTS,
  partPageSlug,
} from '@podbor/catalog-contract';

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

export const retirementOf = {
  part: ({
    id,
    brand,
    normalized_value,
    part,
  }: {
    id: string;
    brand: { slug: string };
    normalized_value: string;
    part: { category_id: string | null };
  }): Retirement => ({
    id,
    slug: partPageSlug(brand.slug, normalized_value),
    scope_id: null,
    target_kind: part.category_id ? 'category' : null,
    target_id: part.category_id,
  }),
  vehicle: ({
    id,
    slug,
    model_id,
  }: SluggedRow & { model_id: string }): Retirement => ({
    id,
    slug,
    scope_id: model_id,
    target_kind: 'model',
    target_id: model_id,
  }),
  model: ({
    id,
    slug,
    make_id,
  }: SluggedRow & { make_id: string }): Retirement => ({
    id,
    slug,
    scope_id: make_id,
    target_kind: 'make',
    target_id: make_id,
  }),
  unscoped: ({ id, slug }: SluggedRow): Retirement => ({
    id,
    slug,
    scope_id: null,
    target_kind: null,
    target_id: null,
  }),
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

export type MovedModel = {
  id: string;
  slug: string;
  name: string;
  chassis_id: string;
  from_make: string;
  to_make: string;
};

const modelsLeavingTheirMake = (edited: string) => `
  select m.id, m.slug, m.name, m.chassis_id, m.make_id as from_make,
    s.make_id as to_make
  from vehicle_model m
  join chassis c on c.id = m.chassis_id
  join series s on s.id = c.series_id
  where ${edited} = any(?::text[]) and m.deleted_at is null
    and m.make_id <> s.make_id`;

export const MODELS_LEAVING_THEIR_MAKE = {
  updateSeries: modelsLeavingTheirMake('s.id'),
  updateChassis: modelsLeavingTheirMake('c.id'),
  updateVehicleModels: modelsLeavingTheirMake('m.id'),
};

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
