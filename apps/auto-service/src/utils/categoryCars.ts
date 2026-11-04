import { byModelName } from './carName';
import type { MakeHubEntry, ModelHubEntry } from './catalogueSnapshot';

export type CategoryCar = {
  make: { slug: string; name: string };
  models: ModelHubEntry['model'][];
};

export const categoryCars = (
  hubs: MakeHubEntry[],
  categorySlug: string,
): CategoryCar[] =>
  hubs.flatMap(({ make, models }) => {
    const fitting = models
      .filter(({ categories }) =>
        categories.some(({ category }) => category.slug === categorySlug),
      )
      .toSorted(byModelName)
      .map(({ model }) => model);
    return fitting.length
      ? [{ make: { slug: make.slug, name: make.name }, models: fitting }]
      : [];
  });
