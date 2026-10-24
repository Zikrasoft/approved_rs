import type {
  SupplierAdapter,
  SupplierArticle,
  SupplierQuote,
} from '../src/lib/suppliers/adapter';

export type FakeSupplier = {
  adapter: SupplierAdapter;
  articles: SupplierArticle[];
  quotes: Map<string, SupplierQuote>;
};

export const createFakeSupplier = (
  name: string,
  pageSize = 2,
): FakeSupplier => {
  const fake: FakeSupplier = {
    articles: [],
    quotes: new Map(),
    adapter: {
      name,
      listCatalogue: async (cursor) => {
        const start = Number(cursor ?? 0);
        const end = start + pageSize;
        return {
          articles: fake.articles.slice(start, end),
          next: end < fake.articles.length ? String(end) : null,
        };
      },
      quote: async (articleIds) =>
        articleIds.flatMap((id) => fake.quotes.get(id) ?? []),
    },
  };
  return fake;
};
