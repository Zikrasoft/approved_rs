import type { Vehicle } from '@podbor/catalog-contract';
import { byModelName } from './carName';
import type { Fit } from './catalogueSnapshot';

type Make = Vehicle['model']['chassis']['series']['make'];

export type ModelFits = { model: Vehicle['model']; fits: Fit[] };

export type MakeFits = { make: Make; models: ModelFits[] };

const byName = new Intl.Collator('en', { numeric: true }).compare;

export function fitGroups(fits: Fit[]): MakeFits[] {
  const makes = new Map<string, MakeFits>();
  for (const fit of fits) {
    const { model } = fit.vehicle;
    const { make } = model.chassis.series;
    const group = makes.get(make.slug) ?? { make, models: [] };
    makes.set(make.slug, group);
    const known = group.models.find((entry) => entry.model.slug === model.slug);
    if (known) {
      known.fits.push(fit);
    } else {
      group.models.push({ model, fits: [fit] });
    }
  }
  return [...makes.values()]
    .sort((a, b) => byName(a.make.name, b.make.name))
    .map((group) => ({ ...group, models: group.models.sort(byModelName) }));
}

const SUMMARY_MODELS = 2;

export function fitSummary(
  groups: MakeFits[],
  name: (model: Vehicle['model']) => string,
): { names: string; more: number } | null {
  const models = groups.flatMap((group) => group.models);
  if (models.length === 0) return null;
  return {
    names: models
      .slice(0, SUMMARY_MODELS)
      .map(({ model }) => name(model))
      .join(', '),
    more: Math.max(0, models.length - SUMMARY_MODELS),
  };
}
