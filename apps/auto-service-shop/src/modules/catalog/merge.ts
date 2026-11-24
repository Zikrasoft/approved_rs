import type { Context } from '@medusajs/framework/types';
import { MedusaError } from '@medusajs/framework/utils';

import { adminError } from '../_shared/admin-error';
import { nameKey } from '../_shared/keys';
import type CatalogModuleService from './service';

export type MergeSteps = {
  catalog: CatalogModuleService;
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
};

const sameName = (a: string, b: string) => nameKey(a) === nameKey(b);

async function mergeModels(
  steps: MergeSteps,
  sourceId: string,
  targetId: string,
  context: Context,
): Promise<void> {
  const { catalog } = steps;
  for (const vehicle of await catalog.listVehicles(
    { model_id: sourceId },
    { select: ['id', 'slug', 'engine_id', 'power_kw'], take: null },
    context,
  )) {
    const slug = await steps.vehicleSlugIn(vehicle, targetId, context);
    await catalog.updateVehicles(
      { id: vehicle.id, model_id: targetId, slug },
      context,
    );
  }
  await steps.flush(context);
  await catalog.deleteVehicleModels(sourceId, context);
}

async function mergeChassis(
  steps: MergeSteps,
  sourceId: string,
  targetId: string,
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
      await mergeModels(steps, model.id, same.id, context);
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
      await mergeChassis(steps, chassis.id, same.id, context);
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
  await catalog.retrieveMake(sourceId, { select: ['id'] }, context);
  await catalog.retrieveMake(targetId, { select: ['id'] }, context);
  await moveSpellings(catalog, sourceId, targetId, context);
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
      await mergeSeries(steps, series.id, same.id, context);
    } else {
      await catalog.updateSeries({ id: series.id, make_id: targetId }, context);
    }
  }
  await steps.flush(context);
  await catalog.deleteMakes(sourceId, context);
}
