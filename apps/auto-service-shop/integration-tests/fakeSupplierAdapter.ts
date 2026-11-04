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
  notInScope: number;
  quotes: Map<string, SupplierQuote>;
  laterPages: Promise<void> | null;
  pageSize: number;
};

export const createFakeSupplier = (
  name: string,
  pageSize = 2,
): FakeSupplier => {
  const fake: FakeSupplier = {
    articles: [],
    unreadable: [],
    notInScope: 0,
    quotes: new Map(),
    laterPages: null,
    pageSize,
    adapter: {
      name,
      listCatalogue: async (cursor) => {
        if (cursor) await fake.laterPages;
        const start = Number(cursor ?? 0);
        const end = start + fake.pageSize;
        return {
          articles: fake.articles.slice(start, end),
          unreadable: cursor ? [] : fake.unreadable,
          not_in_scope: cursor ? 0 : fake.notInScope,
          next: end < fake.articles.length ? String(end) : null,
        };
      },
      quote: async (articleIds) =>
        articleIds.flatMap((id) => fake.quotes.get(id) ?? []),
    },
  };
  return fake;
};
