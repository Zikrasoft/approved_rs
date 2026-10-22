import { asValue } from '@medusajs/framework/awilix';
import type { IApiKeyModuleService } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { createFakeSupplier } from '../../../../../integration-tests/fakeSupplierAdapter';
import { SUPPLIER_ADAPTERS_REGISTRATION } from '../../../../lib/suppliers/adapter';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../modules/supplier';
import type SupplierModuleService from '../../../../modules/supplier/service';

const intercars = createFakeSupplier('Intercars');
const warehouse = createFakeSupplier('Warehouse');

type Page = {
  normalized_value: string;
  part: { id: string; name: string; category_id: string | null };
  offers: unknown[];
  equivalents: unknown[];
  supplier_data: Record<string, unknown[]>;
};

medusaIntegrationTestRunner({
  moduleName: 'supplier-imports',
  dbName: 'medusa-supplier-imports-integration',
  hooks: {
    beforeServerStart: async (container) => {
      container.register(
        SUPPLIER_ADAPTERS_REGISTRATION,
        asValue([intercars.adapter, warehouse.adapter]),
      );
    },
  },
  testSuite: ({ api, getContainer }) => {
    describe('supplier import', () => {
      let adminHeaders: { headers: { authorization: string } };
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };
      let catalog: CatalogModuleService;
      let intercarsId: string;
      let oilFiltersId: string;

      beforeAll(async () => {
        const container = getContainer();
        catalog = container.resolve(CATALOG_MODULE);
        const suppliers: SupplierModuleService =
          container.resolve(SUPPLIER_MODULE);
        const apiKeys: IApiKeyModuleService = container.resolve(
          Modules.API_KEY,
        );
        adminHeaders = await createAdminAuth(
          container,
          api,
          'admin@supplier-imports.local',
          'supersecret',
        );
        const key = await apiKeys.createApiKeys({
          title: 'supplier-imports',
          type: 'publishable',
          created_by: 'test',
        });
        storeHeaders = { headers: { 'x-publishable-api-key': key.token } };

        const [ic, wh] = await suppliers.createSuppliers([
          { name: 'Intercars', markup_percentage: 20 },
          { name: 'Warehouse', markup_percentage: 10 },
        ]);
        intercarsId = ic.id;
        const [mann] = await catalog.createBrands([
          { name: 'Mann-Filter', slug: 'mann-filter' },
          { name: 'Bosch', slug: 'bosch' },
        ]);
        await catalog.createBrandSpellings([
          { brand_id: mann.id, supplier_id: ic.id, value: 'MANN-FILTER' },
          { brand_id: mann.id, supplier_id: wh.id, value: 'Mann' },
        ]);
        const oilFilters = await catalog.createCategories({
          slug: 'oil-filters',
          name: 'Масляные фильтры',
        });
        oilFiltersId = oilFilters.id;
        const strict = await catalog.createCategories({
          slug: 'engine-oil',
          name: 'Моторное масло',
        });
        await catalog.createCategoryFields({
          category_id: strict.id,
          key: 'viscosity',
          type: 'text',
          label: 'Вязкость',
          required: true,
        });
        await suppliers.createSupplierCategories([
          { supplier_id: ic.id, code: 'IC-OIL', category_id: oilFilters.id },
          { supplier_id: ic.id, code: 'IC-ENGINE-OIL', category_id: strict.id },
          { supplier_id: wh.id, code: 'filters', category_id: oilFilters.id },
        ]);
        await catalog.createPartWithIdentifiers({
          name: 'Oil filter',
          identifiers: [
            {
              type: 'manufacturer-number',
              brand_id: mann.id,
              value: 'HU 816 x',
            },
          ],
        });
      });

      beforeEach(() => {
        for (const fake of [intercars, warehouse]) {
          fake.articles.length = 0;
          fake.quotes.clear();
        }
      });

      const runImport = () =>
        api
          .post('/admin/supplier-imports', {}, adminHeaders)
          .catch((error) => error.response);

      const pages = async (): Promise<Page[]> =>
        (await api.get('/store/part-pages', storeHeaders)).data.pages;

      const page = async (normalized: string) =>
        (await pages()).find((entry) => entry.normalized_value === normalized);

      const offerHu816x = (
        fake: typeof intercars,
        article: { article_id: string; brand: string; category: string },
        quote: {
          cost_price: number;
          quantity: number;
          lead_time_days: number;
        },
      ) => {
        fake.articles.push({
          ...article,
          number: 'HU-816 X',
          name: 'Фильтр масляный',
        });
        fake.quotes.set(article.article_id, {
          article_id: article.article_id,
          cost_price: quote.cost_price,
          currency: 'RSD',
          stock: [{ location: 'Beograd', quantity: quote.quantity }],
          lead_time_days: quote.lead_time_days,
        });
      };

      it('attaches an offer to the existing PartIdentifier for a Brand alias and a spaced number', async () => {
        intercars.articles.push({
          article_id: 'IC-1',
          brand: 'MANN-FILTER',
          number: 'HU-816 X',
          name: 'Фильтр масляный MANN',
          category: 'IC-OIL',
        });
        intercars.quotes.set('IC-1', {
          article_id: 'IC-1',
          cost_price: 1000,
          currency: 'RSD',
          stock: [
            { location: 'Beograd', quantity: 3 },
            { location: 'Novi Sad', quantity: 2 },
          ],
          lead_time_days: 1,
        });

        const response = await runImport();

        expect(response.status).toBe(200);
        const all = await pages();
        expect(all).toHaveLength(1);
        expect(all[0].part.name).toBe('Oil filter');
        expect(all[0].offers).toEqual([
          {
            id: expect.any(String),
            price: 1200,
            currency: 'RSD',
            stock_quantity: 5,
            lead_time_days: 1,
          },
        ]);
      });

      it('stores no offer for an article quoted in another currency', async () => {
        intercars.articles.push({
          article_id: 'IC-EUR',
          brand: 'MANN-FILTER',
          number: 'HU-816 X',
          name: 'Фильтр масляный MANN',
          category: 'IC-OIL',
        });
        intercars.quotes.set('IC-EUR', {
          article_id: 'IC-EUR',
          cost_price: 9,
          currency: 'EUR',
          stock: [{ location: 'Beograd', quantity: 3 }],
          lead_time_days: 1,
        });

        const response = await runImport();

        expect(response.status).toBe(200);
        expect((await page('HU816X'))?.offers).toEqual([]);
      });

      it('creates a new Part in the mapped Category, stamped with its source, for an unknown number', async () => {
        intercars.articles.push({
          article_id: 'IC-2',
          brand: 'MANN-FILTER',
          number: 'W 712/95',
          name: 'Фильтр масляный W 712/95',
          category: 'IC-OIL',
        });

        await runImport();

        const created = await page('W71295');
        expect(created).toMatchObject({
          part: { name: 'Фильтр масляный W 712/95', category_id: oilFiltersId },
          offers: [],
        });
        const [part] = await catalog.listParts({ id: created!.part.id });
        expect(part.source).toBe('Intercars');
      });

      it('creates the Part without a Category whose required fields the article cannot fill', async () => {
        intercars.articles.push({
          article_id: 'IC-3',
          brand: 'MANN-FILTER',
          number: 'OIL 5W30',
          name: 'Масло моторное 5W-30',
          category: 'IC-ENGINE-OIL',
        });

        await runImport();

        expect((await page('OIL5W30'))?.part.category_id).toBeNull();
      });

      it('skips an article in an unmapped category or of an unlisted Brand', async () => {
        intercars.articles.push(
          {
            article_id: 'IC-4',
            brand: 'MANN-FILTER',
            number: 'C 30 005',
            name: 'Фильтр воздушный',
            category: 'IC-TYRES',
          },
          {
            article_id: 'IC-5',
            brand: 'BOSCH',
            number: 'F 026 407 157',
            name: 'Фильтр масляный BOSCH',
            category: 'IC-OIL',
          },
        );

        const response = await runImport();

        expect(response.data.imports).toEqual([
          {
            supplier: 'Intercars',
            imported: 0,
            created: 0,
            skipped: 2,
            skipped_by_reason: { category: 1, brand: 1, currency: 0 },
          },
          {
            supplier: 'Warehouse',
            imported: 0,
            created: 0,
            skipped: 0,
            skipped_by_reason: { category: 0, brand: 0, currency: 0 },
          },
        ]);
        expect(await pages()).toHaveLength(1);
      });

      it('matches a Brand spelling whatever its case and spacing', async () => {
        intercars.articles.push({
          article_id: 'IC-8',
          brand: ' mann-filter ',
          number: 'W 610/3',
          name: 'Фильтр W610',
          category: 'IC-OIL',
        });
        intercars.quotes.set('IC-8', {
          article_id: 'IC-8',
          cost_price: 900,
          currency: 'EUR',
          stock: [{ location: 'Beograd', quantity: 1 }],
          lead_time_days: 1,
        });

        const response = await runImport();

        expect(response.data.imports[0]).toMatchObject({
          created: 1,
          skipped: 0,
          skipped_by_reason: { currency: 1 },
        });
        expect(await page('W6103')).toBeDefined();
      });

      it('matches a supplier category code whatever its case and spacing', async () => {
        intercars.articles.push({
          article_id: 'IC-9',
          brand: 'MANN-FILTER',
          number: 'W 712/95',
          name: 'Фильтр W712',
          category: ' ic-oil ',
        });

        const response = await runImport();

        expect(response.data.imports[0]).toMatchObject({
          created: 1,
          skipped: 0,
        });
        expect((await page('W71295'))?.part.category_id).toBe(oilFiltersId);
      });

      it('keeps a name a person edited and refreshes one nobody touched', async () => {
        intercars.articles.push(
          {
            article_id: 'IC-6',
            brand: 'MANN-FILTER',
            number: 'W 712/95',
            name: 'Фильтр W712',
            category: 'IC-OIL',
          },
          {
            article_id: 'IC-7',
            brand: 'MANN-FILTER',
            number: 'W 719/30',
            name: 'Фильтр W719',
            category: 'IC-OIL',
          },
        );
        await runImport();
        const edited = await page('W71295');
        const update = await api.post(
          `/admin/parts/${edited!.part.id}`,
          { name: 'Масляный фильтр MANN W 712/95' },
          adminHeaders,
        );
        expect(update.status).toBe(200);
        intercars.articles[0].name = 'Фильтр W712 новый';
        intercars.articles[1].name = 'Фильтр W719 новый';

        await runImport();

        expect((await page('W71295'))?.part.name).toBe(
          'Масляный фильтр MANN W 712/95',
        );
        expect((await page('W71930'))?.part.name).toBe('Фильтр W719 новый');
      });

      it('holds TecDoc-derived data in staging until its kind is released', async () => {
        intercars.articles.push({
          article_id: 'IC-8',
          brand: 'MANN-FILTER',
          number: 'HU 816 x',
          name: 'Фильтр масляный',
          category: 'IC-OIL',
          cross_references: [{ brand: 'BMW', number: '11 42 7512 300' }],
          applicability: ['BMW E46 320d 2001-2005'],
          images: ['https://cdn.intercars.test/hu816x.jpg'],
        });
        await runImport();

        expect(await page('HU816X')).toMatchObject({
          equivalents: [],
          supplier_data: {
            cross_references: [],
            applicability: [],
            images: [],
          },
        });

        const released = await api.post(
          `/admin/suppliers/${intercarsId}`,
          { released_kinds: ['images'] },
          adminHeaders,
        );
        expect(released.status).toBe(200);

        expect((await page('HU816X'))?.supplier_data).toEqual({
          cross_references: [],
          applicability: [],
          images: ['https://cdn.intercars.test/hu816x.jpg'],
        });
      });

      it('returns offers best first without supplier names', async () => {
        offerHu816x(
          intercars,
          { article_id: 'IC-9', brand: 'MANN-FILTER', category: 'IC-OIL' },
          { cost_price: 1000, quantity: 0, lead_time_days: 3 },
        );
        offerHu816x(
          warehouse,
          { article_id: 'WH-1', brand: 'Mann', category: 'filters' },
          { cost_price: 1100, quantity: 2, lead_time_days: 0 },
        );

        await runImport();

        const offered = await page('HU816X');
        const expected = [
          {
            id: expect.any(String),
            price: 1210,
            currency: 'RSD',
            stock_quantity: 2,
            lead_time_days: 0,
          },
          {
            id: expect.any(String),
            price: 1200,
            currency: 'RSD',
            stock_quantity: 0,
            lead_time_days: 3,
          },
        ];
        expect(offered?.offers).toEqual(expected);
        const part = (
          await api.get(`/store/parts/${offered!.part.id}`, storeHeaders)
        ).data.part;
        expect(part.identifiers[0].offers).toEqual(expected);
        expect(JSON.stringify([offered, part])).not.toMatch(
          /Intercars|Warehouse|IC-9|WH-1/,
        );
      });

      it('drops the offer of an article the supplier no longer lists and keeps the page', async () => {
        offerHu816x(
          intercars,
          { article_id: 'IC-10', brand: 'MANN-FILTER', category: 'IC-OIL' },
          { cost_price: 1000, quantity: 1, lead_time_days: 0 },
        );
        await runImport();
        intercars.articles.length = 0;

        await runImport();

        expect((await page('HU816X'))?.offers).toEqual([]);
      });
    });
  },
});
