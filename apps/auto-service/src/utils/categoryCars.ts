import type { MakeHubEntry, SeriesHubEntry } from './catalogueSnapshot';

export type CategoryCar = {
  make: { slug: string; name: string };
  series: SeriesHubEntry['series'][];
};

export const categoryCars = (
  hubs: MakeHubEntry[],
  categorySlug: string,
): CategoryCar[] =>
  hubs.flatMap(({ make, series }) => {
    const fitting = series
      .filter(({ categories }) =>
        categories.some(({ category }) => category.slug === categorySlug),
      )
      .map((hub) => hub.series);
    return fitting.length
      ? [{ make: { slug: make.slug, name: make.name }, series: fitting }]
      : [];
  });
