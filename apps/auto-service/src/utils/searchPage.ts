import {
  CATALOG_KEY_PATTERN,
  filtersWithinCap,
  type RangeFilter,
  searchableQuery,
} from '@podbor/catalog-contract';
import type { Locale } from '@/i18n/config';
import type { createCatalogue } from './catalogue';
import {
  exactPart,
  nearVin,
  searchIntent,
  vinDestination,
} from './catalogueSearch';
import { searchEitherLayout } from './keyboardLayout';
import { PathBuilder } from './paths';
import { appendRange, partsQuery, rangesFromParams } from './partsSearch';

export type SearchCatalogue = Pick<
  ReturnType<typeof createCatalogue>,
  'resolveVin' | 'search' | 'listingScope'
>;

const catalogKey = (raw: string | null) =>
  raw && CATALOG_KEY_PATTERN.test(raw) ? raw : undefined;

type SearchRedirect = { redirect: string; status: 302 | 303 };

const redirectTo = (redirect: string, status: 302 | 303): SearchRedirect => ({
  redirect,
  status,
});

const lastPageOf = ({ count, limit }: { count: number; limit: number }) =>
  count > 0 ? Math.floor((count - 1) / limit) * limit : 0;

export async function planSearch({
  params,
  locale,
  catalogue,
}: {
  params: URLSearchParams;
  locale: Locale;
  catalogue: SearchCatalogue | null;
}) {
  const typed = partsQuery(params.get('q') ?? '');
  const category = catalogKey(params.get('category'));
  const requestedModel = catalogKey(params.get('model'));
  const make = requestedModel ? catalogKey(params.get('make')) : undefined;
  const model = make && requestedModel;
  const requestedFacets = params.getAll('facets');
  const requestedRanges = rangesFromParams(params);
  const { facets: chosen, ranges } = filtersWithinCap(
    requestedFacets,
    requestedRanges,
  );
  const offset = Math.max(
    0,
    Number.parseInt(params.get('offset') ?? '0', 10) || 0,
  );

  const intent = searchIntent(typed);
  const vin = intent.kind === 'vin' ? intent.vin : null;
  const vinOutcome = vin && catalogue ? await catalogue.resolveVin(vin) : null;
  const destination =
    vin && vinOutcome ? vinDestination(vinOutcome, vin, locale) : null;
  if (destination) {
    return redirectTo(destination, 303);
  }

  const searchable = !vin && (searchableQuery(typed) || Boolean(category));
  const { q, found } = await searchEitherLayout(typed, async (query) =>
    searchable && catalogue
      ? catalogue.search({
          q: query,
          category,
          make,
          model,
          locale,
          facets: chosen,
          ranges,
          offset,
        })
      : null,
  );

  const searchHref = (
    facets: string[],
    nextRanges: RangeFilter[],
    nextOffset = 0,
    scope = model,
  ) => {
    const next = new URLSearchParams({
      ...(q ? { q } : {}),
      ...(category ? { category } : {}),
      ...(scope ? { ...(make && { make }), model: scope } : {}),
    });
    for (const facet of facets) {
      next.append('facets', facet);
    }
    for (const range of nextRanges) {
      appendRange(next, range);
    }
    if (nextOffset) {
      next.set('offset', String(nextOffset));
    }
    return `${PathBuilder.partsSearch(locale)}?${next}`;
  };

  if (
    chosen.length !== requestedFacets.length ||
    ranges.length !== requestedRanges.length
  ) {
    return redirectTo(searchHref(chosen, ranges, offset), 302);
  }
  if (found && offset > lastPageOf(found)) {
    return redirectTo(searchHref(chosen, ranges, lastPageOf(found)), 302);
  }
  const exact =
    found && !category && !model && !chosen.length && !ranges.length && !offset
      ? exactPart(q, found.results)
      : null;
  if (exact) {
    return redirectTo(PathBuilder.partNumber(locale, exact), 302);
  }

  const scope =
    found ??
    (catalogue && (category || model)
      ? await catalogue.listingScope({ category, make, model }, locale)
      : null);
  const unknownScope =
    !found &&
    scope !== null &&
    Boolean((category && !scope.category) || (model && !scope.model));

  return {
    status: unknownScope ? 404 : 200,
    view: {
      q,
      category,
      make,
      model,
      chosen,
      ranges,
      offset,
      vin,
      vinHint: !vin && nearVin(typed),
      vinOutcome,
      searchable,
      found,
      scope,
      unknownScope,
      searchHref,
    },
  };
}
