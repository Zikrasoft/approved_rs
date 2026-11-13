import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from '@medusajs/framework/utils';
import type { SearchFilters } from '@medusajs/framework/types';
import {
  attributeValuesSchema,
  BRAND_FACET,
  brandNumberSchema,
  CATALOG_LOCALES,
  type CatalogLocale,
  categoryFieldSchema,
  describeFacet,
  IN_STOCK,
  IN_STOCK_FACET,
  partNumberQuery,
  PRICE_FACET,
  type RangeFilter,
  searchableQuery,
  searchResponseSchema,
  smallestImage,
  translated,
  translationsSchema,
  UNIVERSAL_FACET_KEYS,
  universalFacets,
  usefulFacets,
  vehicleSchema,
  type PartOffer,
} from '@podbor/catalog-contract';
import { vinOf } from '@podbor/lead-crm/vin';
import { z } from 'zod';

import {
  imagesSchema,
  publicFileUrl,
  storedImageSchema,
} from '../../../lib/images';
import {
  loggedQuery,
  logEvent,
  type SearchIntent,
} from '../../../lib/log-event';
import { demandModule, loadPartDemand } from '../../../lib/part-demand';
import { pricesShown } from '../../../lib/shop-gate';
import { CATALOG_MODULE } from '../../../modules/catalog';
import { SHOP_CURRENCY, SUPPLIER_MODULE } from '../../../modules/supplier';
import { releasedSupplierData } from '../../../modules/supplier/released';
import type SupplierModuleService from '../../../modules/supplier/service';
import type CatalogModuleService from '../../../modules/catalog/service';
import {
  makeKey,
  modelKey,
  pagedCars,
  seriesKey,
  vehicleKey,
} from '../../../lib/car-pages';
import { modelBySlug } from '../../../lib/store-response';
import { type CarMatch, matchCars } from '../../../search/catalogue-car';
import {
  PART_IDENTIFIER_INDEX,
  searchRanking,
} from '../../../search/part-identifier';
import type { StoreSearchPartsType } from '../validators';

const FACETS_FIELD = 'facets';
const UNIVERSAL_FACETS_FIELD = 'universal_facets';
const PRICE_FIELD = 'price';
const MEASURES_FIELD = 'measures';
const FACET_VALUE_LIMIT = 500;
const FACET_REQUESTS = [
  { field: FACETS_FIELD, limit: FACET_VALUE_LIMIT },
  { field: UNIVERSAL_FACETS_FIELD, limit: FACET_VALUE_LIMIT },
  { field: PRICE_FIELD, type: 'stats' as const },
];

const named = z.object({ name: z.string(), translations: translationsSchema });

const hitSchema = brandNumberSchema.extend({
  images: imagesSchema,
  part: named.extend({
    id: z.string(),
    attributes: attributeValuesSchema.nullable().catch(null),
    category: named
      .extend({ slug: z.string(), image: storedImageSchema.nullable() })
      .nullable(),
  }),
});

const thumbnail = (
  { images, part }: z.infer<typeof hitSchema>,
  [supplierImage]: string[],
) => {
  const [own] = images.items;
  if (own)
    return {
      thumbnail: publicFileUrl(smallestImage(own)),
      thumbnail_illustration: false,
    };
  if (supplierImage) {
    return {
      thumbnail: publicFileUrl(supplierImage),
      thumbnail_illustration: false,
    };
  }
  return part.category?.image
    ? {
        thumbnail: publicFileUrl(smallestImage(part.category.image)),
        thumbnail_illustration: true,
      }
    : { thumbnail: null, thumbnail_illustration: false };
};

const facetCountsSchema = z
  .object({
    type: z.literal('value'),
    values: z.array(z.object({ value: z.string(), count: z.number() })),
  })
  .optional();

const priceStatsSchema = z
  .object({
    type: z.literal('stats'),
    min: z.number(),
    max: z.number(),
    count: z.number(),
  })
  .optional();

const splitFacet = (facet: string) => {
  const at = facet.indexOf(':');
  return { key: facet.slice(0, at), value: facet.slice(at + 1) };
};

const facetGroups = (facets: string[]): Map<string, string[]> => {
  const byKey = new Map<string, string[]>();
  for (const facet of facets) {
    const { key } = splitFacet(facet);
    byKey.set(key, [...(byKey.get(key) ?? []), facet]);
  }
  return byKey;
};

type FacetCount = { value: string; count: number };
type PriceStats = z.infer<typeof priceStatsSchema>;
type Counted = { values: FacetCount[]; price: PriceStats };
type KeyFilter = (key: string) => boolean;
type SearchFacets = Record<string, unknown> | undefined;

const counted = (facets: SearchFacets): Counted => ({
  values: [FACETS_FIELD, UNIVERSAL_FACETS_FIELD].flatMap(
    (field) => facetCountsSchema.parse(facets?.[field])?.values ?? [],
  ),
  price: priceStatsSchema.parse(facets?.[PRICE_FIELD]),
});

const rangeSearchFilter = ({ key, min, max }: RangeFilter): SearchFilters => {
  const bounds = {
    ...(min === null ? {} : { $gte: min }),
    ...(max === null ? {} : { $lte: max }),
  };
  return key === PRICE_FACET
    ? { [PRICE_FIELD]: bounds }
    : { [MEASURES_FIELD]: { key, value: bounds } };
};

const isUniversal = (key: string) =>
  (UNIVERSAL_FACET_KEYS as readonly string[]).includes(key);

async function describeBrands(
  catalog: CatalogModuleService,
  values: { value: string; count: number }[],
) {
  const brands = values.length
    ? await catalog.listBrands(
        { slug: values.map(({ value }) => value) },
        { take: null },
      )
    : [];
  return values.map(({ value, count }) => ({
    value,
    label: brands.find(({ slug }) => slug === value)?.name ?? value,
    count,
  }));
}

async function describeFacets(
  catalog: CatalogModuleService,
  { values: counts, price }: Counted,
  locale: CatalogLocale,
  categoryId: string | undefined,
  chosen: string[],
) {
  const values = [
    ...counts,
    ...chosen
      .filter((facet) => !counts.some(({ value }) => value === facet))
      .map((value) => ({ value, count: 0 })),
  ].map(({ value, count }) => ({ ...splitFacet(value), count }));
  const of = (wanted: string) => values.filter(({ key }) => key === wanted);
  const universal = universalFacets({
    brands: await describeBrands(catalog, of(BRAND_FACET)),
    inStock:
      of(IN_STOCK_FACET).find(({ value }) => value === IN_STOCK)?.count ?? 0,
    price: price ?? null,
    currency: SHOP_CURRENCY,
  });
  const fieldKeys = [
    ...new Set(values.map(({ key }) => key).filter((key) => !isUniversal(key))),
  ];
  if (!fieldKeys.length) {
    return universal;
  }
  const fields = z.array(categoryFieldSchema).parse(
    await catalog.listCategoryFields(
      {
        facet: true,
        key: fieldKeys,
        ...(categoryId ? { category_id: categoryId } : {}),
      },
      { relations: ['options'], order: { rank: 'ASC' }, take: null },
    ),
  );
  const seen = new Set<string>();
  return [
    ...universal,
    ...fields
      .filter(({ key }) => !seen.has(key) && seen.add(key))
      .map((field) => describeFacet(field, of(field.key), locale)),
  ];
}

export async function GET(
  req: MedusaRequest<unknown, StoreSearchPartsType>,
  res: MedusaResponse,
): Promise<void> {
  const {
    q = '',
    category,
    vehicle_id,
    make,
    model,
    facets: requestedFacets,
    range: requestedRanges,
    offset,
    limit,
    sort = null,
  } = req.validatedQuery as StoreSearchPartsType;
  const parsedLocale = z.enum(CATALOG_LOCALES).safeParse(req.locale);
  if (!parsedLocale.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `locale must be one of: ${CATALOG_LOCALES.join(', ')}`,
    );
  }
  const locale = parsedLocale.data;
  const shown = pricesShown(req);
  const facetRequests = FACET_REQUESTS.filter(
    ({ field }) => shown || field !== PRICE_FIELD,
  );
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const [found] = category
    ? await catalog.listCategories({ slug: category })
    : [];
  if (category && !found) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Category ${category} not found`,
    );
  }
  const narrowedTo = found
    ? { slug: found.slug, name: translated(found, 'name', locale) }
    : null;
  const vehicleModel =
    make && model
      ? await modelBySlug(catalog, make, model, {
          relations: ['chassis', 'chassis.series', 'chassis.series.make'],
        })
      : null;
  if (model && !vehicleModel) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Model ${model} not found`,
    );
  }
  const scopedTo = vehicleModel
    ? vehicleSchema.shape.model.parse(vehicleModel)
    : null;
  const scopeMake = scopedTo?.chassis.series.make.slug;
  const scopeModelKey =
    scopedTo && scopeMake ? modelKey(scopeMake, scopedTo.slug) : null;
  const scopeSeriesKey = scopedTo ? seriesKey(scopedTo.chassis.series) : null;
  const scopePaged =
    scopeSeriesKey && scopeMake
      ? await pagedCars(req.scope.resolve(Modules.SEARCH), [
          scopeSeriesKey,
          makeKey(scopeMake),
        ])
      : null;
  const scopePages =
    scopeSeriesKey && scopeMake && scopePaged
      ? {
          make: scopePaged.has(makeKey(scopeMake)),
          series: scopePaged.has(scopeSeriesKey),
        }
      : null;

  const number = partNumberQuery(q);
  const cars: CarMatch =
    searchableQuery(q) && !number && !found && !vehicleModel && !vehicle_id
      ? await matchCars(req.scope.resolve(Modules.SEARCH), q)
      : { cars: [], keys: [], rest: [] };
  const partQuery = number ?? (cars.keys.length ? cars.rest.join(' ') : q);
  const intent: SearchIntent = vinOf(q)
    ? 'vin'
    : number
      ? 'number'
      : cars.keys.length
        ? 'car'
        : searchableQuery(q)
          ? 'text'
          : 'browse';
  const logSearch = (results: number) =>
    logEvent(
      'search',
      {
        outcome: results ? 'found' : 'empty',
        intent,
        results,
        zero: !results,
        query: loggedQuery(q),
        category: found?.slug ?? null,
        scoped: Boolean(vehicleModel || vehicle_id),
      },
      req.requestId ?? null,
    );
  const filters: SearchFilters = searchableQuery(partQuery)
    ? { q: partQuery.toLowerCase() }
    : {};
  const fieldKeys = [
    ...new Set([
      ...requestedFacets.map((facet) => splitFacet(facet).key),
      ...requestedRanges.map(({ key }) => key),
    ]),
  ].filter((key) => !isUniversal(key));
  const knownFields = fieldKeys.length
    ? await catalog.listCategoryFields(
        {
          facet: true,
          key: fieldKeys,
          ...(found ? { category_id: found.id } : {}),
        },
        { select: ['key', 'type'], take: null },
      )
    : [];
  const knownKeys = new Set(knownFields.map(({ key }) => key));
  const rangeKeys = new Set([
    ...(shown ? [PRICE_FACET] : []),
    ...knownFields
      .filter(({ type }) => type === 'number')
      .map(({ key }) => key),
  ]);
  const facetKeys = new Set([
    BRAND_FACET,
    ...(shown ? [IN_STOCK_FACET] : []),
    ...knownKeys,
  ]);
  const facets = requestedFacets.filter((facet) =>
    facetKeys.has(splitFacet(facet).key),
  );
  const range = requestedRanges.filter(({ key }) => rangeKeys.has(key));
  const groups = facetGroups(facets);
  const scope: SearchFilters[] = [{ published: true }];
  const nothing = () => {
    logSearch(0);
    res.json(
      searchResponseSchema.parse({
        results: [],
        facets: [],
        category: narrowedTo,
        model: scopedTo,
        cars: cars.cars,
        scope_pages: scopePages,
        count: 0,
        offset,
        limit,
      }),
    );
  };

  if (!filters.q && !found && !cars.keys.length && !scopeModelKey) {
    nothing();
    return;
  }
  if (!filters.q) {
    scope.push({ listed: true });
  }
  if (!filters.q && cars.keys.length) {
    scope.push({ cars: { $in: cars.keys } });
  }
  if (found) {
    scope.push({ category: found.slug });
  }
  if (vehicle_id) {
    await catalog.retrieveVehicle(vehicle_id, { select: ['id'] });
    scope.push({ cars: vehicleKey(vehicle_id) });
  }
  if (scopeModelKey) {
    scope.push({ cars: scopeModelKey });
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const priceRange = range.find(({ key }) => key === PRICE_FACET);
  const filtersFor = (applied: KeyFilter): SearchFilters => ({
    ...filters,
    $and: [
      ...scope,
      ...[...groups]
        .filter(([key]) => applied(key))
        .map(([key, values]) => ({
          [isUniversal(key) ? UNIVERSAL_FACETS_FIELD : FACETS_FIELD]: {
            $in: values,
          },
        })),
      ...range.filter(({ key }) => applied(key)).map(rangeSearchFilter),
    ],
  });
  const countFacets = async (applied: KeyFilter): Promise<Counted> => {
    const { search_result } = await query.search({
      entity: PART_IDENTIFIER_INDEX,
      fields: ['id'],
      filters: filtersFor(applied),
      pagination: { skip: 0, take: 1 },
      search_options: { facets: facetRequests },
    });
    return counted(search_result.facets);
  };
  const chosenKeys = [
    ...new Set([
      ...groups.keys(),
      ...range.filter(({ key }) => key !== PRICE_FACET).map(({ key }) => key),
    ]),
  ];
  const everything = chosenKeys.length
    ? (await countFacets(() => false)).values
    : [];
  const disjunctiveCounts = async (main: Counted): Promise<Counted> => {
    const [perKey, withoutPrice] = await Promise.all([
      Promise.all(
        chosenKeys.map((chosen) => countFacets((key) => key !== chosen)),
      ),
      priceRange ? countFacets((key) => key !== PRICE_FACET) : main,
    ]);
    const values = chosenKeys.length
      ? everything.map(({ value }) => {
          const at = chosenKeys.indexOf(splitFacet(value).key);
          const source = at === -1 ? main : perKey[at];
          return {
            value,
            count:
              source.values.find((entry) => entry.value === value)?.count ?? 0,
          };
        })
      : main.values;
    return { values, price: withoutPrice.price };
  };

  const { data, search_result } = await query.search({
    entity: PART_IDENTIFIER_INDEX,
    fields: [
      'id',
      'type',
      'value',
      'normalized_value',
      'superseded',
      'brand.name',
      'brand.slug',
      'part.id',
      'part.name',
      'part.translations',
      'part.attributes',
      'part.category.slug',
      'part.category.name',
      'part.category.translations',
      'images',
      'part.category.image',
    ],
    filters: filtersFor(() => true),
    pagination: { skip: offset, take: limit },
    search_options: {
      facets: facetRequests,
      provider_options: {
        typesense: searchRanking(locale, cars.keys, sort),
      },
    },
  });

  const rank = new Map(search_result.hits.map(({ id }, index) => [id, index]));
  const hits = z.array(hitSchema).parse(data);
  const suppliers: SupplierModuleService = req.scope.resolve(SUPPLIER_MODULE);
  const offers =
    shown && hits.length
      ? await suppliers.storeOffersFor(hits.map(({ id }) => id))
      : new Map<string, PartOffer[]>();
  const demand = await loadPartDemand(req.scope);
  const supplierData = await releasedSupplierData(
    suppliers,
    hits.map(({ id }) => id),
  );
  const results = hits
    .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
    .map((hit) => ({
      ...brandNumberSchema.parse(hit),
      offers: offers.get(hit.id) ?? [],
      ...thumbnail(hit, supplierData(hit.id).images),
      demand: demand.get(hit.id) ?? null,
      part: {
        id: hit.part.id,
        name: translated(hit.part, 'name', locale),
        attributes: hit.part.attributes,
        category: hit.part.category && {
          slug: hit.part.category.slug,
          name: translated(hit.part.category, 'name', locale),
        },
      },
    }));
  const count = Math.max(
    0,
    (search_result.metadata.count ?? results.length) -
      (search_result.hits.length - hits.length),
  );

  logSearch(count);
  const missed = loggedQuery(q);
  if (!count && missed && !offset && !facets.length && !range.length) {
    await demandModule(req.scope).recordMissedQuery(missed);
  }
  res.json(
    searchResponseSchema.parse({
      results,
      facets: usefulFacets(
        (
          await describeFacets(
            catalog,
            await disjunctiveCounts(counted(search_result.facets)),
            locale,
            found?.id,
            facets,
          )
        ).filter(({ key }) => shown || key !== IN_STOCK_FACET),
        count,
        [
          ...facets.map((facet) => splitFacet(facet).key),
          ...range.map(({ key }) => key),
        ],
      ),
      category: narrowedTo,
      model: scopedTo,
      cars: cars.cars,
      scope_pages: scopePages,
      count,
      offset,
      limit,
    }),
  );
}
