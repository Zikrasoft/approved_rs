import type { CategoryChoice, QuoteReading, ShopAi } from '../src/lib/ai';

export type FakeShopAi = {
  ai: ShopAi;
  reading: QuoteReading;
  quotesRead: { pdf: Buffer; categories: CategoryChoice[] }[];
};

export const createFakeShopAi = (): FakeShopAi => {
  const fake: FakeShopAi = {
    reading: { vin: null, vehicle: null, lines: [] },
    quotesRead: [],
    ai: {
      readQuote: async (pdf, categories) => {
        fake.quotesRead.push({ pdf, categories });
        return fake.reading;
      },
    },
  };
  return fake;
};
