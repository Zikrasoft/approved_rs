import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../modules/supplier';
import type SupplierModuleService from '../../../modules/supplier/service';
import { publishAllNumbers } from '../../../lib/publish/published';

type Priced = { offers: { price: number }[] };

medusaIntegrationTestRunner({
  moduleName: 'catalog',
  dbName: 'medusa-closed-shop',
  testSuite: ({ api, getContainer }) => {
    describe('prices while the shop is closed', () => {
      let publishable: string;
      const identifiers: string[] = [];
      const parts: string[] = [];

      const get = (path: string, preview = false) =>
        api
          .get(path, {
            headers: {
              'x-publishable-api-key': publishable,
              ...(preview && { 'x-shop-preview': '1' }),
            },
          })
          .catch((error) => error.response);
      const searchPath = '/store/search?category=oil-filters&locale=ru';
      const offersPath = () =>
        `/store/offers?${identifiers.map((id) => `part_identifier_id=${id}`).join('&')}`;
      const prices = (rows: Priced[]) =>
        rows.flatMap(({ offers }) => offers.map(({ price }) => price)).sort();
      const facetKeys = (facets: { key: string }[]) =>
        facets.map(({ key }) => key);

      const installations = (
        pages: { id: string; part: { installation_price: number | null } }[],
      ) =>
        identifiers.map(
          (id) => pages.find((page) => page.id === id)?.part.installation_price,
        );

      beforeAll(async () => {
        const catalog: CatalogModuleService =
          getContainer().resolve(CATALOG_MODULE);
        const suppliers: SupplierModuleService =
          getContainer().resolve(SUPPLIER_MODULE);
        const apiKeys: IApiKeyModuleService = getContainer().resolve(
          Modules.API_KEY,
        );
        publishable = (
          await apiKeys.createApiKeys({
            title: 'closed-shop-tests',
            type: 'publishable',
            created_by: 'test',
          })
        ).token;
        const [mann, mahle] = await catalog.createBrands([
          { name: 'Mann-Filter', slug: 'mann-filter' },
          { name: 'Mahle', slug: 'mahle' },
        ]);
        const category = await catalog.createCategories({
          slug: 'oil-filters',
          name: 'Масляные фильтры',
          service_label: 'Замена фильтра',
          service_price: 900,
          installation_price: 700,
        });
        for (const [brand, number] of [
          [mann.id, 'HU 1'],
          [mahle.id, 'OX 1'],
        ]) {
          const partId = await catalog.createPartWithIdentifiers({
            name: `Масляный фильтр ${number}`,
            category_id: category.id,
            identifiers: [
              { type: 'manufacturer-number', brand_id: brand, value: number },
            ],
          });
          parts.push(partId);
          const [identifier] = await catalog.listPartIdentifiers({
            part_id: partId,
          });
          identifiers.push(identifier.id);
        }
        await catalog.updateParts({ id: parts[1], installation_price: 0 });
        const supplier = await suppliers.createSuppliers({
          name: 'Intercars',
          markup_percentage: 20,
        });
        await suppliers.createSupplierOffers(
          identifiers.map((part_identifier_id, index) => ({
            supplier_id: supplier.id,
            supplier_article_id: `A-${index}`,
            part_identifier_id,
            cost_price: 1000 * (index + 1),
            stock_quantity: 3,
            lead_time_days: 1,
          })),
        );
        await publishAllNumbers(getContainer());
        await getContainer()
          .resolve(Modules.SEARCH)
          .reindex({ index: 'part_identifier' });
        process.env.SHOP_OPEN = 'false';
      });

      afterAll(() => {
        delete process.env.SHOP_OPEN;
      });

      it('keeps every price out of the store API for a visitor without the preview flag', async () => {
        const search = await get(`${searchPath}&range=price:1000:1500`);
        const pages = await get('/store/part-pages');
        const categories = await get('/store/categories');
        const live = await get(
          `/store/part-identifiers/${identifiers[0]}/offers`,
        );
        const batch = await get(offersPath());

        expect(search.data.count).toBe(2);
        expect(prices(search.data.results)).toEqual([]);
        expect(facetKeys(search.data.facets)).not.toContain('price');
        expect(prices(pages.data.pages)).toEqual([]);
        expect(categories.data.categories[0].service_price).toBeNull();
        expect(categories.data.categories[0].installation_price).toBeNull();
        expect(installations(pages.data.pages)).toEqual([null, null]);
        expect(batch.data.installation).toEqual({
          [identifiers[0]]: null,
          [identifiers[1]]: null,
        });
        expect(live.data.offers).toEqual([]);
        expect(batch.data.offers).toEqual({
          [identifiers[0]]: [],
          [identifiers[1]]: [],
        });
      });

      it('shows the prices to a visitor with the preview flag', async () => {
        const search = await get(searchPath, true);
        const narrowed = await get(`${searchPath}&range=price:1000:1500`, true);
        const pages = await get('/store/part-pages', true);
        const categories = await get('/store/categories', true);
        const live = await get(
          `/store/part-identifiers/${identifiers[0]}/offers`,
          true,
        );
        const batch = await get(offersPath(), true);

        expect(prices(search.data.results)).toEqual([1200, 2400]);
        expect(facetKeys(search.data.facets)).toContain('price');
        expect(narrowed.data.count).toBe(1);
        expect(prices(pages.data.pages)).toEqual([1200, 2400]);
        expect(categories.data.categories[0].service_price).toBe(900);
        expect(categories.data.categories[0].installation_price).toBe(700);
        expect(installations(pages.data.pages)).toEqual([700, 0]);
        expect(batch.data.installation).toEqual({
          [identifiers[0]]: 700,
          [identifiers[1]]: 0,
        });
        expect(prices([live.data])).toEqual([1200]);
        expect(prices([{ offers: batch.data.offers[identifiers[1]] }])).toEqual(
          [2400],
        );
      });

      it('refuses a batch of offers without an identifier', async () => {
        expect((await get('/store/offers', true)).status).toBe(400);
      });
    });
  },
});
