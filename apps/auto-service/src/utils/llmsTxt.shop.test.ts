import { describe, expect, it, vi } from 'vitest';

vi.mock('astro:content', () => ({
  getCollection: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/utils/shopStatus', () => ({ shopIndexed: () => true }));
vi.mock('@/lib/catalog', async () => {
  const { readCatalog } =
    await vi.importActual<typeof import('@/lib/catalog')>('@/lib/catalog');
  const { BATTERY, products } = await import('@/lib/catalog.fixture');
  return {
    shopCatalog: () => ({
      catalog: async () => readCatalog(products([BATTERY])).catalog,
    }),
  };
});

const { generateLlmsTxt } = await import('./llmsTxt');
const { content } = await import('@/i18n/content');

describe('llms.txt when the shop is live', () => {
  it('lists each type that has products, and no other', async () => {
    const body = await generateLlmsTxt('sr');

    expect(body).toContain(
      `[${content('sr').shop.types.batteries.name}](https://carlab.rs/sr/shop/batteries/)`,
    );
    expect(body).not.toContain('/sr/shop/filters/');
  });
});
