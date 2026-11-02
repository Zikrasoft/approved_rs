import {
  CATALOG_KEY_PATTERN,
  facetFilter,
  filtersWithinCap,
  type RangeFilter,
  type SearchFacet,
  searchableQuery,
} from '@podbor/catalog-contract';
import { vinText } from '@podbor/lead-crm/vin';
import type { Locale } from '@/i18n/config';
import type { createCatalogue } from './catalogue';
import {
  exactPart,
  listingCrumbs,
  nearVin,
  searchIntent,
  vinDestination,
} from './catalogueSearch';
import { searchEitherLayout } from './keyboardLayout';
import { PathBuilder } from './paths';
import {
  appendRange,
  partsQuery,
  rangesAsWritten,
  rangesFromParams,
} from './partsSearch';

export type SearchCatalogue = Pick<
  ReturnType<typeof createCatalogue>,
  'resolveVin' | 'search' | 'listingScope'
>;

const SHOP_MAX_OFFSET = 10_000;

const catalogKey = (raw: string | null) => {
  const key = raw?.toLowerCase();
  return key && CATALOG_KEY_PATTERN.test(key) ? key : undefined;
};

const capitalised = (params: URLSearchParams) =>
  ['category', 'make', 'model'].some((name) => {
    const raw = params.get(name);
    return raw !== null && raw !== raw.toLowerCase();
  });

const keyOf = (facet: string) => facet.slice(0, facet.indexOf(':'));

const listedSpelling = ({ key, values }: SearchFacet, filter: string) => {
  const wanted = filter.slice(key.length + 1).toLowerCase();
  const [listed] = values
    .filter(({ value }) => value.toLowerCase() === wanted)
    .sort((a, b) => b.count - a.count);
  return listed ? facetFilter(key, listed.value) : filter;
};

const knownFilters = (
  facets: SearchFacet[],
  requested: string[],
  ranges: RangeFilter[],
  spellings: SearchFacet[],
) => {
  const byKey = new Map(facets.map((facet) => [facet.key, facet]));
  const spellingByKey = new Map(spellings.map((facet) => [facet.key, facet]));
  return filtersWithinCap(
    requested.flatMap((filter) => {
      const key = keyOf(filter);
      const facet = byKey.get(key);
      return facet
        ? [listedSpelling(spellingByKey.get(key) ?? facet, filter)]
        : [];
    }),
    ranges.filter(({ key }) => byKey.get(key)?.type === 'number'),
  );
};

const sheetOf = (live: SearchFacet[], scope: SearchFacet[]) => {
  const liveByKey = new Map(live.map((facet) => [facet.key, facet]));
  const scopeKeys = new Set(scope.map(({ key }) => key));
  return {
    sheetFacets: [
      ...scope.map((facet) => liveByKey.get(facet.key) ?? facet),
      ...live.filter(({ key }) => !scopeKeys.has(key)),
    ],
    dormant: [...scopeKeys].filter((key) => !liveByKey.has(key)),
  };
};

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
  const misspeltCategory = Boolean(params.get('category')) && !category;
  const requestedModel = catalogKey(params.get('model'));
  const make = requestedModel ? catalogKey(params.get('make')) : undefined;
  const model = make && requestedModel;
  const strayScope = (params.has('make') || params.has('model')) && !model;
  const requestedFacets = params.getAll('facets');
  const requestedRanges = rangesFromParams(params);
  const capped = filtersWithinCap(requestedFacets, requestedRanges);
  const offset = Math.min(
    Math.max(0, Number.parseInt(params.get('offset') ?? '0', 10) || 0),
    SHOP_MAX_OFFSET,
  );

  const intent = searchIntent(typed);
  const vin = intent.kind === 'vin' ? intent.vin : null;
  const vinOutcome = vin && catalogue ? await catalogue.resolveVin(vin) : null;
  const destination =
    vin && vinOutcome ? vinDestination(vinOutcome, vin, locale) : null;
  if (destination) {
    return redirectTo(destination, 303);
  }

  if (
    model &&
    make &&
    !category &&
    !misspeltCategory &&
    !searchableQuery(typed)
  ) {
    return redirectTo(PathBuilder.partsModel(locale, make, model), 302);
  }

  const searchable =
    !vin && (searchableQuery(typed) || Boolean(category) || misspeltCategory);
  const searchScope = { category, make, model, locale };
  const { q, found } = await searchEitherLayout(typed, async (query) =>
    searchable && catalogue && !misspeltCategory
      ? catalogue.search({
          ...searchScope,
          q: query,
          facets: capped.facets,
          ranges: capped.ranges,
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

  const unfiltered =
    found && (requestedFacets.length || requestedRanges.length)
      ? await catalogue?.search({
          ...searchScope,
          q,
          facets: [],
          ranges: [],
          limit: 1,
        })
      : null;
  const applied = found
    ? knownFilters(
        found.facets,
        requestedFacets,
        requestedRanges,
        unfiltered?.facets ?? [],
      )
    : capped;
  const emptyScope =
    found?.count === 0 &&
    unfiltered?.count === 0 &&
    (applied.facets.length > 0 || applied.ranges.length > 0);
  const chosen = emptyScope ? [] : applied.facets;
  const ranges = emptyScope ? [] : applied.ranges;
  const listing =
    !q && found?.category
      ? listingCrumbs({
          locale,
          model: found.model,
          modelName: null,
          category: found.category,
          pages: found.scope_pages,
          searchLabel: '',
        }).at(-1)?.href
      : undefined;
  const filtersHref = (facets: string[], nextRanges: RangeFilter[]) =>
    listing && !facets.length && !nextRanges.length
      ? listing
      : searchHref(facets, nextRanges);
  const listingKeepsModel =
    !model || Boolean(found?.model && found.scope_pages?.model);
  const page = found ? Math.min(offset, lastPageOf(found)) : offset;
  if (emptyScope) {
    return redirectTo(filtersHref([], []), 302);
  }
  if (
    !misspeltCategory &&
    (JSON.stringify(chosen) !== JSON.stringify(requestedFacets) ||
      !rangesAsWritten(params, ranges) ||
      (params.get('offset') ?? '') !== (page ? String(page) : '') ||
      strayScope ||
      capitalised(params))
  ) {
    return redirectTo(
      page || !listingKeepsModel
        ? searchHref(chosen, ranges, page)
        : filtersHref(chosen, ranges),
      302,
    );
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
    misspeltCategory ||
    (!found &&
      scope !== null &&
      Boolean((category && !scope.category) || (model && !scope.model)));
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
      vinTypo: !vin && nearVin(typed) ? vinText(typed) : null,
      vinOutcome,
      searchable,
      found,
      scope,
      unknownScope,
      ...sheetOf(found?.facets ?? [], unfiltered?.facets ?? []),
      searchHref,
      filtersHref,
    },
  };
}
