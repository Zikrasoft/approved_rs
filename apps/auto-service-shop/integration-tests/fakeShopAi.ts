import type { AttributeValues } from '@podbor/catalog-contract';

import type {
  ArticleInput,
  CategoryChoice,
  QuoteReading,
  ShopAi,
} from '../src/lib/ai';

export type FakeShopAi = {
  ai: ShopAi;
  reading: QuoteReading;
  quotesRead: { pdf: Buffer; categories: CategoryChoice[] }[];
  model: string;
  name: string | null;
  category: string | null;
  attributes: AttributeValues;
  description: string | null;
  articlesAsked: { article: ArticleInput; categories: CategoryChoice[] }[];
  failure: Error | null;
  questions: number;
  delayMs: number;
  inFlight: number;
  mostInFlight: number;
};

export const createFakeShopAi = (): FakeShopAi => {
  const fake: FakeShopAi = {
    reading: { vin: null, vehicle: null, lines: [] },
    quotesRead: [],
    model: 'fake',
    name: null,
    category: null,
    attributes: {},
    description: null,
    articlesAsked: [],
    failure: null,
    questions: 0,
    delayMs: 0,
    inFlight: 0,
    mostInFlight: 0,
    ai: {
      readQuote: async (pdf, categories) => {
        fake.quotesRead.push({ pdf, categories });
        return fake.reading;
      },
      articleQuestion: (article, categories) => ({
        model: fake.model,
        system: JSON.stringify(categories),
        user: JSON.stringify(article),
        categoryIds: categories.map(({ id }) => id),
      }),
      answerArticle: async ({ system, user }) => {
        fake.questions += 1;
        fake.inFlight += 1;
        fake.mostInFlight = Math.max(fake.mostInFlight, fake.inFlight);
        try {
          if (fake.delayMs) {
            await new Promise((resolve) => setTimeout(resolve, fake.delayMs));
          }
          if (fake.failure) throw fake.failure;
          const article = JSON.parse(user) as ArticleInput;
          fake.articlesAsked.push({
            article,
            categories: JSON.parse(system) as CategoryChoice[],
          });
          return {
            name: fake.name ?? article.name,
            category_id: fake.category,
            attributes: fake.attributes,
            description: fake.description,
          };
        } finally {
          fake.inFlight -= 1;
        }
      },
    },
  };
  return fake;
};
