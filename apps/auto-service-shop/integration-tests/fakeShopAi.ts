import type { AttributeValues } from '@podbor/catalog-contract';

import type {
  ArticleFacts,
  CategoryChoice,
  QuoteReading,
  ShopAi,
} from '../src/lib/ai';

export type FakeShopAi = {
  ai: ShopAi;
  reading: QuoteReading;
  quotesRead: { pdf: Buffer; categories: CategoryChoice[]; brands: string[] }[];
  model: string;
  name: string | null;
  attributes: AttributeValues;
  description: string | null;
  articlesAsked: { article: ArticleFacts; category: CategoryChoice | null }[];
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
    attributes: {},
    description: null,
    articlesAsked: [],
    failure: null,
    questions: 0,
    delayMs: 0,
    inFlight: 0,
    mostInFlight: 0,
    ai: {
      readQuote: async (pdf, categories, brands) => {
        fake.quotesRead.push({ pdf, categories, brands });
        return fake.reading;
      },
      articleQuestion: (article, category) => ({
        model: fake.model,
        system: JSON.stringify(category),
        user: JSON.stringify(article),
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
          const article = JSON.parse(user) as ArticleFacts;
          fake.articlesAsked.push({
            article,
            category: JSON.parse(system) as CategoryChoice | null,
          });
          return {
            name: fake.name ?? article.name,
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
