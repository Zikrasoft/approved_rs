import { AbstractSearchProviderService } from '@medusajs/framework/utils';
import type { Logger, SearchTypes } from '@medusajs/framework/types';
import { Client } from 'typesense';
import type { DocumentSchema } from 'typesense/lib/Typesense/Documents';
import { z } from 'zod';

import {
  collectSearchableFields,
  compileFacets,
  compileFilters,
  hasNestedFields,
  toFacetResults,
  toTypesenseFields,
} from './mapping';

const hitDocumentSchema = z.looseObject({ id: z.string() });

const refusalSchema = z.object({ error: z.string() });

const facetsOf = (input: SearchTypes.ProviderSearchQuery) =>
  (input.search_options?.facets ?? []).map((facet) =>
    typeof facet === 'string' ? { field: facet } : facet,
  );

const searchParams = (input: SearchTypes.ProviderSearchQuery) => {
  const queryByFields = collectSearchableFields(input.index.fields);
  const perPage = Math.max(input.pagination?.take ?? 20, 1);
  return {
    collection: input.index.physical_name,
    q: input.q && input.q.length ? input.q : '*',
    query_by: queryByFields.length ? queryByFields.join(',') : undefined,
    filter_by: compileFilters(input.filters),
    include_fields: input.attributes_to_retrieve.join(','),
    per_page: perPage,
    page: Math.floor((input.pagination?.skip ?? 0) / perPage) + 1,
    ...compileFacets(facetsOf(input)),
    ...input.search_options?.provider_options?.typesense,
  };
};

type InjectedDependencies = {
  logger: Logger;
};

type Options = {
  host: string;
  port: number;
  protocol: 'http' | 'https';
  apiKey: string;
};

class TypesenseSearchProviderService extends AbstractSearchProviderService {
  static identifier = 'typesense';

  protected logger_: Logger;
  protected client: Client;

  constructor({ logger }: InjectedDependencies, options: Options) {
    super();

    this.logger_ = logger;
    this.client = new Client({
      nodes: [
        { host: options.host, port: options.port, protocol: options.protocol },
      ],
      apiKey: options.apiKey,
      connectionTimeoutSeconds: 5,
    });
  }

  async upsertIndex({
    index,
  }: {
    index: SearchTypes.ResolvedSearchIndexDefinition;
  }): Promise<SearchTypes.SearchTask> {
    const exists = await this.client.collections(index.physical_name).exists();
    if (exists) {
      await this.client.collections(index.physical_name).delete();
    }

    await this.client.collections().create({
      name: index.physical_name,
      enable_nested_fields: hasNestedFields(index.fields),
      fields: toTypesenseFields(index.fields),
    });

    return { index: index.physical_name, status: 'succeeded' };
  }

  async deleteIndex({
    index,
  }: {
    index: string;
  }): Promise<SearchTypes.SearchTask> {
    const exists = await this.client.collections(index).exists();
    if (exists) {
      await this.client.collections(index).delete();
    }

    return { index, status: 'succeeded' };
  }

  async clearIndex({
    index,
  }: {
    index: string;
  }): Promise<SearchTypes.SearchTask> {
    await this.client.collections(index).documents().delete({ truncate: true });

    return { index, status: 'succeeded' };
  }

  async listIndexes(): Promise<SearchTypes.SearchIndexInfo[]> {
    const collections = await this.client.collections().retrieve();

    return collections.map((collection) => ({
      name: collection.name,
      provider: TypesenseSearchProviderService.identifier,
      document_count: collection.num_documents,
      created_at: new Date(collection.created_at * 1000),
    }));
  }

  async upsertDocuments({
    index,
    documents,
  }: {
    index: string;
    definition: SearchTypes.ResolvedSearchIndexDefinition;
    documents: SearchTypes.SearchDocument[];
  }): Promise<SearchTypes.SearchTask> {
    await this.client
      .collections(index)
      .documents()
      .import(documents, { action: 'upsert' });

    return { index, status: 'succeeded' };
  }

  async deleteDocuments({
    index,
    filters,
  }: SearchTypes.SearchDeleteDocumentsInput): Promise<SearchTypes.SearchTask> {
    const filterBy = compileFilters(filters);

    await this.client
      .collections(index)
      .documents()
      .delete(filterBy ? { filter_by: filterBy } : { truncate: true });

    return { index, status: 'succeeded' };
  }

  async search(
    input: SearchTypes.ProviderSearchQuery,
  ): Promise<SearchTypes.SearchResult> {
    const [result] = await this.searchMany([input]);
    return result;
  }

  async searchMany(
    inputs: SearchTypes.ProviderSearchQuery[],
  ): Promise<SearchTypes.SearchResult[]> {
    const { results } = await this.client.multiSearch.perform<DocumentSchema[]>(
      {
        searches: inputs.map(searchParams),
      },
    );
    return inputs.map((input, at) => {
      const refused = refusalSchema.safeParse(results[at]);
      if (refused.success) {
        throw new Error(
          `search-typesense: ${input.index.physical_name} refused a search: ${refused.data.error}`,
        );
      }
      const response = results[at];
      const take = input.pagination?.take ?? 20;
      return {
        hits: (response.hits ?? []).map((hit) => {
          const document = hitDocumentSchema.parse(hit.document);
          return { id: document.id, score: hit.text_match, document };
        }),
        facets: toFacetResults(facetsOf(input), response.facet_counts ?? []),
        metadata: {
          skip: input.pagination?.skip ?? 0,
          take,
          count: response.found ?? null,
        },
      };
    });
  }
}

export default TypesenseSearchProviderService;
