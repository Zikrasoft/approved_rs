import type { Context } from '@medusajs/framework/types';
import { MedusaError } from '@medusajs/framework/utils';

import { adminError } from '../_shared/admin-error';
import { nameKey } from '../_shared/keys';
import type { SlugKind } from './models/slug-redirect';
import type CatalogModuleService from './service';
import type { Provenance } from './service';
import type { Retirement } from './slugs';

export type MergeSteps = {
  catalog: CatalogModuleService;
  retireSlugs: (
    kind: SlugKind,
    retired: Retirement[],
    context: Context,
    provenance: Provenance,
  ) => Promise<void>;
  vehicleSlugIn: (
    vehicle: {
      id: string;
      slug: string;
      engine_id: string | null;
      power_kw: number | null;
    },
    modelId: string,
    context: Context,
  ) => Promise<string>;
  flush: (context: Context) => Promise<void>;
  purgeMake: (id: string, context: Context) => Promise<void>;
  purgeModel: (id: string, context: Context) => Promise<void>;
};

const sameName = (a: string, b: string) => nameKey(a) === nameKey(b);

async function mergeModels(
  steps: MergeSteps,
  source: { id: string; slug: string },
  targetId: string,
  makeId: string,
  provenance: Provenance,
  context: Context,
): Promise<void> {
  const { catalog } = steps;
  const renamed: { id: string; slug: string }[] = [];
  for (const vehicle of await catalog.listVehicles(
    { model_id: source.id },
    { select: ['id', 'slug', 'engine_id', 'power_kw'], take: null },
    context,
  )) {
    const slug = await steps.vehicleSlugIn(vehicle, targetId, context);
    if (slug !== vehicle.slug) renamed.push(vehicle);
    await catalog.updateVehicles(
      { id: vehicle.id, model_id: targetId, slug },
      context,
    );
  }
  await catalog.updateSlugRedirects(
    {
      selector: { kind: 'vehicle', scope_id: source.id },
      data: { scope_id: targetId },
    },
    context,
  );
  if (renamed.length) {
    await catalog.createSlugRedirects(
      renamed.map(({ id, slug }) => ({
        kind: 'vehicle' as const,
        from_id: id,
        from_slug: slug,
        scope_id: source.id,
        target_kind: 'vehicle' as const,
        target_id: id,
        ...provenance,
      })),
      context,
    );
  }
  await steps.retireSlugs(
    'model',
    [
      {
        id: source.id,
        slug: source.slug,
        scope_id: makeId,
        target_kind: 'model',
        target_id: targetId,
      },
    ],
    context,
    provenance,
  );
  await steps.flush(context);
  await steps.purgeModel(source.id, context);
}

async function mergeChassis(
  steps: MergeSteps,
  sourceId: string,
  targetId: string,
  makeId: string,
  provenance: Provenance,
  context: Context,
): Promise<void> {
  const { catalog } = steps;
  const targets = await catalog.listVehicleModels(
    { chassis_id: targetId },
    { take: null },
    context,
  );
  for (const model of await catalog.listVehicleModels(
    { chassis_id: sourceId },
    { take: null },
    context,
  )) {
    const same = targets.find(({ name }) => sameName(name, model.name));
    if (same) {
      await mergeModels(steps, model, same.id, makeId, provenance, context);
    } else {
      await catalog.updateVehicleModels(
        { id: model.id, chassis_id: targetId },
        context,
      );
    }
  }
  const required = new Set(
    (
      await catalog.listRequirements(
        { chassis_id: targetId },
        { select: ['field_id'], take: null },
        context,
      )
    ).map(({ field_id }) => field_id),
  );
  const movable = (
    await catalog.listRequirements(
      { chassis_id: sourceId },
      { select: ['id', 'field_id'], take: null },
      context,
    )
  ).filter(({ field_id }) => !required.has(field_id));
  if (movable.length) {
    await catalog.updateRequirements(
      {
        selector: { id: movable.map(({ id }) => id) },
        data: { chassis_id: targetId },
      },
      context,
    );
  }
  await steps.flush(context);
  await catalog.deleteChassis(sourceId, context);
}

async function mergeSeries(
  steps: MergeSteps,
  sourceId: string,
  targetId: string,
  makeId: string,
  provenance: Provenance,
  context: Context,
): Promise<void> {
  const { catalog } = steps;
  const targets = await catalog.listChassis(
    { series_id: targetId },
    { take: null },
    context,
  );
  for (const chassis of await catalog.listChassis(
    { series_id: sourceId },
    { take: null },
    context,
  )) {
    const same = targets.find(({ code }) => code === chassis.code);
    if (same) {
      await mergeChassis(
        steps,
        chassis.id,
        same.id,
        makeId,
        provenance,
        context,
      );
    } else {
      await catalog.updateChassis(
        { id: chassis.id, series_id: targetId },
        context,
      );
    }
  }
  await steps.flush(context);
  await catalog.deleteSeries(sourceId, context);
}

async function moveSpellings(
  catalog: CatalogModuleService,
  sourceId: string,
  targetId: string,
  context: Context,
): Promise<void> {
  const spellingsOf = (make_id: string) =>
    catalog.listMakeSpellings(
      { make_id },
      { select: ['id', 'supplier_id', 'value_key'], take: null },
      context,
    );
  const spelled = new Set(
    (await spellingsOf(targetId)).map(({ supplier_id, value_key }) =>
      JSON.stringify([supplier_id, value_key]),
    ),
  );
  for (const { id, supplier_id, value_key } of await spellingsOf(sourceId)) {
    if (spelled.has(JSON.stringify([supplier_id, value_key]))) {
      await catalog.deleteMakeSpellings(id, context);
    } else {
      await catalog.updateMakeSpellings({ id, make_id: targetId }, context);
    }
  }
}

export async function mergeMakes(
  steps: MergeSteps,
  sourceId: string,
  targetId: string,
  provenance: Provenance,
  context: Context,
): Promise<void> {
  const { catalog } = steps;
  if (sourceId === targetId) {
    throw adminError(
      MedusaError.Types.INVALID_DATA,
      'MERGE_INTO_SELF',
      'A Make cannot be merged into itself',
    );
  }
  const source = await catalog.retrieveMake(
    sourceId,
    { select: ['id', 'slug'] },
    context,
  );
  await catalog.retrieveMake(targetId, { select: ['id'] }, context);
  await moveSpellings(catalog, sourceId, targetId, context);
  await catalog.updateSlugRedirects(
    {
      selector: { kind: 'model', scope_id: sourceId },
      data: { scope_id: targetId },
    },
    context,
  );
  const seriesOf = (make_id: string) =>
    catalog.listSeries(
      { make_id },
      { select: ['id', 'name'], take: null },
      context,
    );
  const targetSeries = await seriesOf(targetId);
  for (const series of await seriesOf(sourceId)) {
    const same = targetSeries.find(({ name }) => sameName(name, series.name));
    if (same) {
      await mergeSeries(
        steps,
        series.id,
        same.id,
        targetId,
        provenance,
        context,
      );
    } else {
      await catalog.updateSeries({ id: series.id, make_id: targetId }, context);
    }
  }
  await steps.retireSlugs(
    'make',
    [
      {
        id: sourceId,
        slug: source.slug,
        scope_id: null,
        target_kind: 'make',
        target_id: targetId,
      },
    ],
    context,
    provenance,
  );
  await steps.flush(context);
  await steps.purgeMake(sourceId, context);
}
