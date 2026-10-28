import type { Logger, SearchTypes } from '@medusajs/framework/types';

import TypesenseSearchProviderService from '../service';

const index = {
  physical_name: `provider_spec_${process.pid}`,
  fields: {
    id: { type: 'keyword', filterable: true, retrievable: true },
    name: { type: 'text', searchable: true, retrievable: true },
  },
} as unknown as SearchTypes.ResolvedSearchIndexDefinition;

const provider = new TypesenseSearchProviderService(
  { logger: console as unknown as Logger },
  {
    host: process.env.TYPESENSE_HOST ?? 'localhost',
    port: Number(process.env.TYPESENSE_PORT),
    protocol: 'http',
    apiKey: process.env.TYPESENSE_API_KEY ?? 'xyz',
  },
);

const query = (
  q: string,
  filters: SearchTypes.ProviderSearchQuery['filters'] = {},
) =>
  ({
    index,
    q,
    filters,
    attributes_to_retrieve: ['id', 'name'],
    pagination: { skip: 0, take: 10 },
  }) as unknown as SearchTypes.ProviderSearchQuery;

const ids = (result: SearchTypes.SearchResult) =>
  result.hits.map(({ id }) => id).sort();

describe('the Typesense search provider', () => {
  beforeAll(async () => {
    await provider.upsertIndex({ index });
    await provider.upsertDocuments({
      index: index.physical_name,
      definition: index,
      documents: [
        { id: 'oil', name: 'oil filter' },
        { id: 'air', name: 'air filter' },
        { id: 'pad', name: 'brake pad' },
      ],
    });
  });

  afterAll(async () => {
    await provider.deleteIndex({ index: index.physical_name });
  });

  it('answers a filter longer than a URL can carry', async () => {
    const many = Array.from({ length: 400 }, (_, at) => `car-${at}-padding`);

    const result = await provider.search(
      query('filter', { id: { $in: [...many, 'oil'] } }),
    );

    expect(ids(result)).toEqual(['oil']);
  });

  it('answers several searches at once, each with its own hits', async () => {
    const [filters, brakes] = await provider.searchMany([
      query('filter'),
      query('brake'),
    ]);

    expect(ids(filters)).toEqual(['air', 'oil']);
    expect(ids(brakes)).toEqual(['pad']);
  });

  it('fails a search the engine refuses', async () => {
    await expect(
      provider.search({
        ...query('filter'),
        search_options: {
          provider_options: { typesense: { query_by: 'missing' } },
        },
      }),
    ).rejects.toThrow();
  });
});
