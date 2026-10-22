import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import {
  ContainerRegistrationKeys,
  MedusaError,
} from '@medusajs/framework/utils';
import type { SearchFilters } from '@medusajs/framework/types';
import {
  brandNumberSchema,
  CATALOG_LOCALES,
  type CatalogLocale,
  categoryFieldSchema,
  describeFacet,
  searchableQuery,
  searchResponseSchema,
  translated,
  translationsSchema,
} from '@podbor/catalog-contract';
import { z } from 'zod';

import { CATALOG_MODULE } from '../../../modules/catalog';
import { SUPPLIER_MODULE } from '../../../modules/supplier';
import { storeOffers } from '../../../modules/supplier/pricing';
import type SupplierModuleService from '../../../modules/supplier/service';
import type CatalogModuleService from '../../../modules/catalog/service';
import {
  PART_IDENTIFIER_INDEX,
  searchRanking,
} from '../../../search/part-identifier';
import type { StoreSearchPartsType } from '../validators';

const FACETS_FIELD = 'facets';

const named = z.object({ name: z.string(), translations: translationsSchema });

const hitSchema = brandNumberSchema.extend({
  part: named.extend({
    id: z.string(),
    category: named.extend({ slug: z.string() }).nullable(),
  }),
});

const facetCountsSchema = z
  .object({
    type: z.literal('value'),
    values: z.array(z.object({ value: z.string(), count: z.number() })),
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
type KeyFilter = (key: string) => boolean;

async function partIdsForVehicle(
  catalog: CatalogModuleService,
  vehicleId: string,
): Promise<string[]> {
  await catalog.retrieveVehicle(vehicleId);
  const fitments = await catalog.listFitments(
    { vehicle_id: vehicleId },
    { take: null },
  );
  return [...new Set(fitments.map((fitment) => fitment.part_id))];
}

async function describeFacets(
  catalog: CatalogModuleService,
  counted: FacetCount[],
  locale: CatalogLocale,
  categoryId: string | undefined,
  chosen: string[],
) {
  const values = [
    ...counted,
    ...chosen
      .filter((facet) => !counted.some(({ value }) => value === facet))
      .map((value) => ({ value, count: 0 })),
  ].map(({ value, count }) => ({ ...splitFacet(value), count }));
  if (!values.length) {
    return [];
  }
  const fields = z.array(categoryFieldSchema).parse(
    await catalog.listCategoryFields(
      {
        facet: true,
        key: [...new Set(values.map(({ key }) => key))],
        ...(categoryId ? { category_id: categoryId } : {}),
      },
      { relations: ['options'], order: { rank: 'ASC' }, take: null },
    ),
  );
  const seen = new Set<string>();
  return fields
    .filter(({ key }) => !seen.has(key) && seen.add(key))
    .map((field) =>
      describeFacet(
        field,
        values.filter(({ key }) => key === field.key),
        locale,
      ),
    );
}

export async function GET(
  req: MedusaRequest<unknown, StoreSearchPartsType>,
  res: MedusaResponse,
): Promise<void> {
  const {
    q = '',
    category,
    vehicle_id,
    facets,
    offset,
    limit,
  } = req.validatedQuery as StoreSearchPartsType;
  const parsedLocale = z.enum(CATALOG_LOCALES).safeParse(req.locale);
  if (!parsedLocale.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `locale must be one of: ${CATALOG_LOCALES.join(', ')}`,
    );
  }
  const locale = parsedLocale.data;
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

  const filters: SearchFilters = searchableQuery(q)
    ? { q: q.toLowerCase() }
    : {};
  const groups = facetGroups(facets);
  const scope: SearchFilters[] = [];
  const nothing = () =>
    res.json(
      searchResponseSchema.parse({
        results: [],
        facets: [],
        category: narrowedTo,
        count: 0,
        offset,
        limit,
      }),
    );

  if (!filters.q && !found) {
    nothing();
    return;
  }
  if (found) {
    scope.push({ category: found.slug });
  }
  if (vehicle_id) {
    const partIds = await partIdsForVehicle(catalog, vehicle_id);
    if (!partIds.length) {
      nothing();
      return;
    }
    scope.push({ part_id: { $in: partIds } });
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const filtersFor = (applied: KeyFilter): SearchFilters => {
    const and = [
      ...scope,
      ...[...groups]
        .filter(([key]) => applied(key))
        .map(([, values]) => ({ [FACETS_FIELD]: { $in: values } })),
    ];
    return and.length ? { ...filters, $and: and } : filters;
  };
  const countFacets = async (applied: KeyFilter): Promise<FacetCount[]> => {
    const { search_result } = await query.search({
      entity: PART_IDENTIFIER_INDEX,
      fields: ['id'],
      filters: filtersFor(applied),
      pagination: { skip: 0, take: 1 },
      search_options: { facets: [{ field: FACETS_FIELD, limit: 100 }] },
    });
    return (
      facetCountsSchema.parse(search_result.facets?.[FACETS_FIELD])?.values ??
      []
    );
  };
  const disjunctiveCounts = async (
    counted: FacetCount[],
  ): Promise<FacetCount[]> => {
    if (!groups.size) {
      return counted;
    }
    const chosenKeys = [...groups.keys()];
    const [everything, ...perKey] = await Promise.all([
      countFacets(() => false),
      ...chosenKeys.map((chosen) => countFacets((key) => key !== chosen)),
    ]);
    return everything.map(({ value }) => {
      const at = chosenKeys.indexOf(splitFacet(value).key);
      const source = at === -1 ? counted : perKey[at];
      return {
        value,
        count: source.find((entry) => entry.value === value)?.count ?? 0,
      };
    });
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
      'part.category.slug',
      'part.category.name',
      'part.category.translations',
    ],
    filters: filtersFor(() => true),
    pagination: { skip: offset, take: limit },
    search_options: {
      facets: [{ field: FACETS_FIELD, limit: 100 }],
      provider_options: { typesense: searchRanking(locale) },
    },
  });

  const rank = new Map(search_result.hits.map(({ id }, index) => [id, index]));
  const hits = z.array(hitSchema).parse(data);
  const suppliers: SupplierModuleService = req.scope.resolve(SUPPLIER_MODULE);
  const offers = hits.length
    ? await suppliers.listSupplierOffers(
        { part_identifier_id: hits.map(({ id }) => id) },
        { relations: ['supplier'], take: null },
      )
    : [];
  const results = hits
    .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
    .map(({ part, ...brandNumber }) => ({
      ...brandNumber,
      offers: storeOffers(
        offers.filter((offer) => offer.part_identifier_id === brandNumber.id),
      ),
      part: {
        id: part.id,
        name: translated(part, 'name', locale),
        category: part.category && {
          slug: part.category.slug,
          name: translated(part.category, 'name', locale),
        },
      },
    }));

  res.json(
    searchResponseSchema.parse({
      results,
      facets: await describeFacets(
        catalog,
        await disjunctiveCounts(
          facetCountsSchema.parse(search_result.facets?.[FACETS_FIELD])
            ?.values ?? [],
        ),
        locale,
        found?.id,
        facets,
      ),
      category: narrowedTo,
      count: Math.max(
        0,
        (search_result.metadata.count ?? results.length) -
          (search_result.hits.length - hits.length),
      ),
      offset,
      limit,
    }),
  );
}
