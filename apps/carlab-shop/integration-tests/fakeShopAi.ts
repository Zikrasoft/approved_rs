import type { AttributeValues } from '@podbor/catalog-contract';

import type {
  ArticleFacts,
  CategoryChoice,
  CategoryFieldChoice,
  QuoteReading,
  ShopAi,
} from '../src/lib/ai';

export type FakeShopAi = {
  ai: ShopAi;
  reading: QuoteReading;
  quotesRead: { pdf: Buffer; categories: CategoryChoice[] }[];
  category: string | null;
  attributes: AttributeValues;
  description: string;
  categoryPicks: { article: ArticleFacts; categories: CategoryChoice[] }[];
  specsMapped: {
    specs: Record<string, string>;
    fields: CategoryFieldChoice[];
  }[];
  descriptionsWritten: ArticleFacts[];
  failure: Error | null;
};

export const createFakeShopAi = (): FakeShopAi => {
  const fake: FakeShopAi = {
    reading: { vin: null, vehicle: null, lines: [] },
    quotesRead: [],
    category: null,
    attributes: {},
    description: '',
    categoryPicks: [],
    specsMapped: [],
    descriptionsWritten: [],
    failure: null,
    ai: {
      readQuote: async (pdf, categories) => {
        fake.quotesRead.push({ pdf, categories });
        return fake.reading;
      },
      pickCategory: async (article, categories) => {
        if (fake.failure) throw fake.failure;
        fake.categoryPicks.push({ article, categories });
        return fake.category;
      },
      mapSpecs: async (specs, fields) => {
        if (fake.failure) throw fake.failure;
        fake.specsMapped.push({ specs, fields });
        return fake.attributes;
      },
      writeDescription: async (article) => {
        if (fake.failure) throw fake.failure;
        fake.descriptionsWritten.push(article);
        return fake.description;
      },
    },
  };
  return fake;
};
