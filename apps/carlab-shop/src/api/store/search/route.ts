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
  searchResponseSchema,
  translated,
  translationsSchema,
} from '@podbor/catalog-contract';
import { z } from 'zod';

import { CATALOG_MODULE } from '../../../modules/catalog';
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

const facetFilters = (facets: string[]): SearchFilters[] => {
  const byKey = new Map<string, string[]>();
  for (const facet of facets) {
    const { key } = splitFacet(facet);
    byKey.set(key, [...(byKey.get(key) ?? []), facet]);
  }
  return [...byKey.values()].map((values) => ({
    [FACETS_FIELD]: { $in: values },
  }));
};

async function partIdsForVehicle(
  catalog: CatalogModuleService,
  vehicleId: string,
): Promise<string[]> {
  await catalog.retrieveVehicle(vehicleId);
  const fitments = await catalog.listFitments({ vehicle_id: vehicleId });
  return [...new Set(fitments.map((fitment) => fitment.part_id))];
}

async function describeFacets(
  catalog: CatalogModuleService,
  counts: z.infer<typeof facetCountsSchema>,
  locale: CatalogLocale,
) {
  const values = (counts?.values ?? []).map(({ value, count }) => ({
    ...splitFacet(value),
    count,
  }));
  if (!values.length) {
    return [];
  }
  const fields = z
    .array(categoryFieldSchema)
    .parse(
      await catalog.listCategoryFields(
        { facet: true, key: [...new Set(values.map(({ key }) => key))] },
        { relations: ['options'], order: { rank: 'ASC' } },
      ),
    );
  const seen = new Set<string>();
  return fields
    .filter(({ key }) => !seen.has(key) && seen.add(key))
    .map((field) => {
      const rank = (value: string) =>
        field.options.find(({ key }) => key === value)?.rank ?? 0;
      return {
        key: field.key,
        label: translated(field, 'label', locale),
        unit: field.unit,
        values: values
          .filter(({ key }) => key === field.key)
          .sort(
            (a, b) =>
              rank(a.value) - rank(b.value) || a.value.localeCompare(b.value),
          )
          .map(({ value, count }) => {
            const option = field.options.find(({ key }) => key === value);
            return {
              value,
              label: option ? translated(option, 'label', locale) : value,
              count,
            };
          }),
      };
    });
}

export async function GET(
  req: MedusaRequest<unknown, StoreSearchPartsType>,
  res: MedusaResponse,
): Promise<void> {
  const { q, vehicle_id, facets, offset, limit } =
    req.validatedQuery as StoreSearchPartsType;
  const parsedLocale = z.enum(CATALOG_LOCALES).safeParse(req.locale);
  if (!parsedLocale.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `locale must be one of: ${CATALOG_LOCALES.join(', ')}`,
    );
  }
  const locale = parsedLocale.data;
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const filters: SearchFilters = { q: q.toLowerCase() };
  const and = facetFilters(facets);

  if (vehicle_id) {
    const partIds = await partIdsForVehicle(catalog, vehicle_id);
    if (!partIds.length) {
      res.json(
        searchResponseSchema.parse({
          results: [],
          facets: [],
          count: 0,
          offset,
          limit,
        }),
      );
      return;
    }
    and.push({ part_id: { $in: partIds } });
  }
  if (and.length) {
    filters.$and = and;
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
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
    filters,
    pagination: { skip: offset, take: limit },
    search_options: {
      facets: [{ field: FACETS_FIELD, limit: 100 }],
      provider_options: { typesense: searchRanking(locale) },
    },
  });

  const rank = new Map(search_result.hits.map(({ id }, index) => [id, index]));
  const results = z
    .array(hitSchema)
    .parse(data)
    .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
    .map(({ part, ...brandNumber }) => ({
      ...brandNumber,
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
        facetCountsSchema.parse(search_result.facets?.[FACETS_FIELD]),
        locale,
      ),
      count: search_result.metadata.count ?? results.length,
      offset,
      limit,
    }),
  );
}
