import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createMedusaContainer } from '@medusajs/framework/utils';

import { supplierAdapters } from '../suppliers/adapter';
import {
  DEMO_SUPPLIER_IMAGES,
  DEMO_SUPPLIERS,
  demoAdapters,
  readDemoOverrides,
} from '../suppliers/demo-adapter';

const FILE_URL = 'http://localhost:9009/static';

const overridesFile = (content: unknown): string => {
  const path = join(mkdtempSync(join(tmpdir(), 'demo-supplier-')), 'o.json');
  writeFileSync(path, JSON.stringify(content));
  return path;
};

const allArticles = async (
  adapter: ReturnType<typeof demoAdapters>[number],
) => {
  const ids: string[] = [];
  for (let cursor: string | null = null; ;) {
    const page = await adapter.listCatalogue(cursor);
    ids.push(...page.articles.map(({ article_id }) => article_id));
    if (!page.next) return ids;
    cursor = page.next;
  }
};

describe('demo supplier adapter', () => {
  it('pages through the whole catalogue without leaking offer data', async () => {
    const [intercars] = demoAdapters(undefined, FILE_URL);

    const first = await intercars.listCatalogue(null);

    expect(first.articles).toHaveLength(3);
    expect(first.articles[0]).not.toHaveProperty('offer');
    expect(await allArticles(intercars)).toEqual(
      DEMO_SUPPLIERS[0].articles.map(({ article_id }) => article_id),
    );
  });

  it('points supplier photos at the demo files under the public file URL', async () => {
    const [intercars] = demoAdapters(undefined, FILE_URL);

    const [mann] = (await intercars.listCatalogue(null)).articles;

    expect(mann.images).toEqual([`${FILE_URL}/demo-supplier/ic-1001.webp`]);
    expect(DEMO_SUPPLIER_IMAGES['IC-1001']).toBe('oil-filter');
  });

  it('quotes only the asked articles, with the built-in prices by default', async () => {
    const [intercars] = demoAdapters(
      join(tmpdir(), 'no-such-demo-file.json'),
      FILE_URL,
    );

    expect(await intercars.quote(['IC-1001', 'AD-2001'])).toEqual([
      {
        article_id: 'IC-1001',
        cost_price: 1000,
        currency: 'RSD',
        stock: [{ location: 'Beograd', quantity: 12 }],
        lead_time_days: 1,
      },
    ]);
  });

  it('reads price and stock overrides on every quote', async () => {
    const path = overridesFile({ 'IC-1001': { cost_price: 1300 } });
    const [intercars] = demoAdapters(path, FILE_URL);

    expect((await intercars.quote(['IC-1001']))[0].cost_price).toBe(1300);

    writeFileSync(path, JSON.stringify({ 'IC-1001': { stock: 0 } }));
    const [quote] = await intercars.quote(['IC-1001']);

    expect(quote.cost_price).toBe(1000);
    expect(quote.stock).toEqual([{ location: 'Beograd', quantity: 0 }]);
  });

  it('refuses a malformed overrides file', () => {
    expect(() =>
      readDemoOverrides(overridesFile({ 'IC-1001': { price: 1 } })),
    ).toThrow();
  });

  it('is what the container gets when SUPPLIER_ADAPTERS=demo and nothing is registered', () => {
    const previous = process.env;
    process.env = { ...previous, SUPPLIER_ADAPTERS: 'demo' };
    try {
      expect(
        supplierAdapters(createMedusaContainer()).map(({ name }) => name),
      ).toEqual(DEMO_SUPPLIERS.map(({ name }) => name));
    } finally {
      process.env = previous;
    }
  });
});
