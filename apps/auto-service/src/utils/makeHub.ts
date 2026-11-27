import type { AstroGlobal } from 'astro';
import { paginate } from '@podbor/site-kit/pagination';
import { localeFrom } from '../i18n/config.ts';
import { seriesName } from './carName';
import { loadCataloguePage } from './cataloguePage';

export const MAKE_HUB_PAGE_SIZE = 48;

const PAGE_SEGMENT = /^page-([2-9]|[1-9]\d+)$/;

export const makeHubPageNumber = (segment: string): number | null => {
  const found = PAGE_SEGMENT.exec(segment);
  return found ? Number(found[1]) : null;
};

export const makeHubPageCount = (series: number): number =>
  Math.max(1, Math.ceil(series / MAKE_HUB_PAGE_SIZE));

export const loadMakeHub = (
  astro: Pick<AstroGlobal, 'request' | 'url' | 'response' | 'params'>,
  number: number,
) =>
  loadCataloguePage(astro, async (catalogue, catalogueLocale) => {
    const hub = await catalogue.makeHub(
      astro.params.make ?? '',
      catalogueLocale,
    );
    if (!hub) return null;
    const locale = localeFrom(astro.url.pathname);
    const series = hub.series
      .map(({ slug, name }) => ({
        slug,
        label: seriesName({ name, translations: null }, hub.make, locale),
      }))
      .toSorted((a, b) =>
        a.label.localeCompare(b.label, 'en', { numeric: true }),
      );
    const listing = paginate(series, MAKE_HUB_PAGE_SIZE)[number - 1];
    return listing ? { make: hub.make, series, listing } : null;
  });

export type MakeHub = Exclude<
  Awaited<ReturnType<typeof loadMakeHub>>,
  Response
>;
