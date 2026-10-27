import type {
  SupplierAdapter,
  SupplierArticle,
  SupplierQuote,
  UnreadablePage,
} from '../src/lib/suppliers/adapter';

export type FakeSupplier = {
  adapter: SupplierAdapter;
  articles: SupplierArticle[];
  unreadable: UnreadablePage[];
  quotes: Map<string, SupplierQuote>;
};

export const createFakeSupplier = (
  name: string,
  pageSize = 2,
): FakeSupplier => {
  const fake: FakeSupplier = {
    articles: [],
    unreadable: [],
    quotes: new Map(),
    adapter: {
      name,
      listCatalogue: async (cursor) => {
        const start = Number(cursor ?? 0);
        const end = start + pageSize;
        return {
          articles: fake.articles.slice(start, end),
          unreadable: cursor ? [] : fake.unreadable,
          next: end < fake.articles.length ? String(end) : null,
        };
      },
      quote: async (articleIds) =>
        articleIds.flatMap((id) => fake.quotes.get(id) ?? []),
    },
  };
  return fake;
};
