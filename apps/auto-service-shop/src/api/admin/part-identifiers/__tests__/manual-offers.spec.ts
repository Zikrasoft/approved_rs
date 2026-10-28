import { asValue } from '@medusajs/framework/awilix';
import type { IApiKeyModuleService } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { createFakeSupplier } from '../../../../../integration-tests/fakeSupplierAdapter';
import { importRuns } from '../../../../../integration-tests/importRuns';
import { SUPPLIER_ADAPTERS_REGISTRATION } from '../../../../lib/suppliers/adapter';
import { liveOffers } from '../../../../lib/suppliers/live-quote';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../modules/supplier';
import type SupplierModuleService from '../../../../modules/supplier/service';
import { publishAllNumbers } from '../../../../lib/publish/published';

const intercars = createFakeSupplier('Intercars');

type AdminOffer = {
  source: string;
  manual: boolean;
  cost_price: number;
  price: number;
  stock_quantity: number;
  lead_time_days: number;
  updated_at: string;
  updated_by_user: { email: string } | null;
};

medusaIntegrationTestRunner({
  moduleName: 'manual-offers',
  dbName: 'carlab_manual_offers',
  hooks: {
    beforeServerStart: async (container) => {
      container.register(
        SUPPLIER_ADAPTERS_REGISTRATION,
        asValue([intercars.adapter]),
      );
    },
  },
  testSuite: ({ api, getContainer }) => {
    describe('manual offers', () => {
      let adminHeaders: { headers: { authorization: string } };
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };
      let identifierId: string;
      let intercarsId: string;
      let partId: string;

      const offersPath = () => `/admin/part-identifiers/${identifierId}/offers`;
      const manualPath = () =>
        `/admin/part-identifiers/${identifierId}/manual-offer`;
      const listOffers = async (): Promise<AdminOffer[]> =>
        (await api.get(offersPath(), adminHeaders)).data.offers;
      const save = (body: unknown) =>
        api
          .post(manualPath(), body, adminHeaders)
          .catch(({ response }) => response);
      const storeOffers = async () => {
        await publishAllNumbers(getContainer());
        const { data } = await api.get(
          '/store/part-pages?limit=50',
          storeHeaders,
        );
        return data.pages.find(
          ({ part }: { part: { id: string } }) => part.id === partId,
        ).offers;
      };

      beforeAll(async () => {
        const container = getContainer();
        const catalog: CatalogModuleService = container.resolve(CATALOG_MODULE);
        const suppliers: SupplierModuleService =
          container.resolve(SUPPLIER_MODULE);
        adminHeaders = await createAdminAuth(
          container,
          api,
          'manager@manual-offers.local',
          'supersecret',
        );
        const apiKeys: IApiKeyModuleService = container.resolve(
          Modules.API_KEY,
        );
        const key = await apiKeys.createApiKeys({
          title: 'manual-offers',
          type: 'publishable',
          created_by: 'test',
        });
        storeHeaders = { headers: { 'x-publishable-api-key': key.token } };

        const varta = await catalog.createBrands({
          name: 'Varta',
          slug: 'varta',
        });
        const category = await catalog.createCategories({
          slug: 'batteries',
          name: 'Аккумуляторы',
        });
        partId = await catalog.createPartWithIdentifiers({
          name: 'Аккумулятор 80Ah',
          identifiers: [
            {
              type: 'manufacturer-number',
              brand_id: varta.id,
              value: '580901080',
            },
          ],
        });
        [{ id: identifierId }] = await catalog.listPartIdentifiers({
          part_id: partId,
        });
        const supplier = await suppliers.createSuppliers({
          name: 'Intercars',
          markup_percentage: 20,
        });
        intercarsId = supplier.id;
        await suppliers.createSupplierCategories({
          supplier_id: supplier.id,
          code: 'IC-BATT',
          category_id: category.id,
        });
        await catalog.createBrandSpellings({
          supplier_id: supplier.id,
          value: 'VARTA',
          brand_id: varta.id,
        });
      });

      it('sells a manually entered purchase price with the manual markup', async () => {
        const response = await save({
          cost_price: 10000,
          stock_quantity: 3,
          lead_time_days: 0,
        });

        expect(response.status).toBe(200);
        expect(await listOffers()).toEqual([
          expect.objectContaining({
            source: 'manual',
            manual: true,
            cost_price: 10000,
            price: 12000,
            stock_quantity: 3,
            lead_time_days: 0,
            updated_by_user: expect.objectContaining({
              email: 'manager@manual-offers.local',
            }),
          }),
        ]);
        expect(await storeOffers()).toEqual([
          expect.objectContaining({ price: 12000, stock_quantity: 3 }),
        ]);
        const { data } = await api.get('/admin/suppliers', adminHeaders);
        expect(
          data.suppliers.find(
            ({ name }: { name: string }) => name === 'manual',
          ),
        ).toMatchObject({
          updated_by_user: { email: 'manager@manual-offers.local' },
        });
      });

      it('edits the one manual offer of a number instead of adding another', async () => {
        await save({ cost_price: 10000, stock_quantity: 3, lead_time_days: 0 });
        await save({ cost_price: 9000, stock_quantity: 0, lead_time_days: 7 });

        expect(await listOffers()).toEqual([
          expect.objectContaining({
            cost_price: 9000,
            price: 10800,
            stock_quantity: 0,
            lead_time_days: 7,
          }),
        ]);
      });

      it.each([
        [{ cost_price: 0, stock_quantity: 1, lead_time_days: 0 }, 'cost_price'],
        [
          { cost_price: 10_000_001, stock_quantity: 1, lead_time_days: 0 },
          'cost_price',
        ],
        [
          { cost_price: 100, stock_quantity: 1.5, lead_time_days: 0 },
          'stock_quantity',
        ],
        [
          { cost_price: 100, stock_quantity: -1, lead_time_days: 0 },
          'stock_quantity',
        ],
        [
          { cost_price: 100, stock_quantity: 1, lead_time_days: 366 },
          'lead_time_days',
        ],
        [
          { cost_price: 100, stock_quantity: 0, lead_time_days: 0 },
          'availability',
        ],
      ])('refuses %o on %s', async (body, field) => {
        const response = await save(body);

        expect(response.status).toBe(400);
        expect(response.data).toMatchObject({ code: 'INVALID_FIELD', field });
        expect(await listOffers()).toEqual([]);
      });

      it('answers 404 for a number that does not exist', async () => {
        const response = await api
          .post(
            '/admin/part-identifiers/missing/manual-offer',
            { cost_price: 100, stock_quantity: 1, lead_time_days: 0 },
            adminHeaders,
          )
          .catch(({ response }) => response);

        expect(response.status).toBe(404);
      });

      it('keeps the stored row as the live quote', async () => {
        await save({ cost_price: 9000, stock_quantity: 0, lead_time_days: 7 });

        const offers = await liveOffers(getContainer(), {
          part_identifier_id: identifierId,
        });

        expect(offers).toEqual([
          expect.objectContaining({ cost_price: 9000, lead_time_days: 7 }),
        ]);
      });

      it('survives an import that quotes the same number and one that drops it', async () => {
        await save({ cost_price: 9000, stock_quantity: 0, lead_time_days: 7 });
        intercars.articles.push({
          article_id: 'IC-1012',
          brand: 'VARTA',
          number: '580 901 080',
          name: 'Battery 80Ah',
          category: 'IC-BATT',
        });
        intercars.quotes.set('IC-1012', {
          article_id: 'IC-1012',
          cost_price: 14500,
          currency: 'RSD',
          stock: [{ location: 'Beograd', quantity: 6 }],
          lead_time_days: 1,
        });
        await importRuns(api, adminHeaders).run(intercarsId);

        expect(
          (await listOffers()).map(({ source, cost_price }) => [
            source,
            cost_price,
          ]),
        ).toEqual([
          ['manual', 9000],
          ['Intercars', 14500],
        ]);

        intercars.articles.length = 0;
        await importRuns(api, adminHeaders).run(intercarsId);

        expect(await listOffers()).toEqual([
          expect.objectContaining({ source: 'manual', cost_price: 9000 }),
        ]);
      });

      it('deletes the manual offer, and answers 404 when there is none', async () => {
        await save({ cost_price: 9000, stock_quantity: 1, lead_time_days: 0 });

        const response = await api
          .delete(manualPath(), adminHeaders)
          .catch(({ response }) => response);
        const again = await api
          .delete(manualPath(), adminHeaders)
          .catch(({ response }) => response);

        expect(response.status).toBe(200);
        expect(again.status).toBe(404);
        expect(await listOffers()).toEqual([]);
        expect(await storeOffers()).toEqual([]);
      });

      it('reindexes the Part when its manual offer changes', async () => {
        await publishAllNumbers(getContainer());
        await getContainer()
          .resolve(Modules.SEARCH)
          .reindex({ index: 'part_identifier' });
        const inStock = async () =>
          (
            await api.get(
              '/store/search?q=580901080&locale=ru&facets=in-stock:true',
              storeHeaders,
            )
          ).data.count;
        expect(await inStock()).toBe(0);

        await save({ cost_price: 500, stock_quantity: 2, lead_time_days: 0 });

        let count = 0;
        for (let attempt = 0; attempt < 20 && count !== 1; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          count = await inStock();
        }
        expect(count).toBe(1);
      });
    });
  },
});
