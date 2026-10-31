import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../modules/supplier';
import type SupplierModuleService from '../../../../modules/supplier/service';

type Row = {
  value: string;
  enriched: boolean;
  reasons: string[];
};

type Listing = {
  part_identifiers: Row[];
  count: number;
  counts: { enriched: number; not_enriched: number };
};

medusaIntegrationTestRunner({
  moduleName: 'catalog',
  dbName: 'carlab_enrichment',
  testSuite: ({ api, getContainer }) => {
    describe('GET /admin/part-identifiers', () => {
      let adminHeaders: { headers: { authorization: string } };
      let catalog: CatalogModuleService;
      let oilId: string;
      let fittedPartId: string;

      const list = async (query = ''): Promise<Listing> =>
        (await api.get(`/admin/part-identifiers${query}`, adminHeaders)).data;
      const values = ({ part_identifiers }: Listing) =>
        part_identifiers.map(({ value }) => value).sort();

      beforeAll(async () => {
        const container = getContainer();
        adminHeaders = await createAdminAuth(
          container,
          api,
          'enrichment@carlab.rs',
          'secret-password',
        );
        catalog = container.resolve(CATALOG_MODULE);
        const suppliers: SupplierModuleService =
          container.resolve(SUPPLIER_MODULE);
        const post = async (path: string, body: unknown) =>
          (await api.post(path, body, adminHeaders)).data;

        const mann = await catalog.createBrands({
          name: 'Mann-Filter',
          slug: 'mann-filter',
        });
        const bmw = await catalog.createBrands({ name: 'BMW', slug: 'bmw' });
        oilId = (
          await post('/admin/categories', {
            slug: 'engine-oil',
            name: 'Моторное масло',
          })
        ).category.id;
        const approvals = (
          await post(`/admin/categories/${oilId}/fields`, {
            key: 'approvals',
            type: 'multi-select',
            label: 'Допуски',
          })
        ).field;
        await post(
          `/admin/categories/${oilId}/fields/${approvals.id}/options`,
          { key: 'bmw-ll-04', label: 'BMW LL-04' },
        );
        const b47 = await createVehicleFixture(catalog, { typeCode: '8C31' });
        await post('/admin/requirements', {
          field_id: approvals.id,
          engine_id: b47.engine.id,
          option_keys: ['bmw-ll-04'],
        });

        const part = (
          name: string,
          numbers: [string, string][],
          extra: {
            category_id?: string;
            attributes?: Record<string, unknown>;
          } = {},
        ) =>
          catalog.createPartWithIdentifiers({
            name,
            identifiers: numbers.map(([brand_id, value]) => ({
              type: 'manufacturer-number' as const,
              brand_id,
              value,
            })),
            ...extra,
          });
        const described = async (name: string, value: string) => {
          const id = await part(name, [[mann.id, value]]);
          await catalog.updateParts({ id, description: 'Описание детали' });
        };

        fittedPartId = await part('Фильтр с машиной', [[mann.id, 'HU 816 X']], {
          category_id: oilId,
        });
        await catalog.createFitments({
          part_id: fittedPartId,
          vehicle_id: b47.vehicle.id,
        });
        await part('Масло по допуску', [[mann.id, 'OIL-LL04']], {
          category_id: oilId,
          attributes: { approvals: ['bmw-ll-04'] },
        });
        await part(
          'Масло с аналогом',
          [
            [mann.id, 'EQ-1'],
            [bmw.id, 'EQ-2'],
          ],
          { category_id: oilId },
        );
        await part('Голый номер', [[mann.id, 'BARE-1']]);
        const loose = await part('Без категории с машиной', [
          [mann.id, 'LOOSE-1'],
        ]);
        await catalog.createFitments({
          part_id: loose,
          vehicle_id: b47.vehicle.id,
        });
        await part('Только категория', [[mann.id, 'CAT-ONLY']], {
          category_id: oilId,
        });
        await described('С описанием', 'DESC-1');

        const [fitted] = await catalog.listPartIdentifiers({
          part_id: fittedPartId,
        });
        const supplier = await suppliers.createSuppliers({
          name: 'Inter Cars',
          markup_percentage: 10,
        });
        await suppliers.createSupplierOffers({
          part_identifier_id: fitted.id,
          supplier_id: supplier.id,
          supplier_article_id: 'IC-HU816X',
          cost_price: 1000,
          stock_quantity: 3,
          lead_time_days: 1,
        });
      });

      it('reports every brand-number with its enrichment and both counts', async () => {
        const listing = await list();

        expect(listing.count).toBe(8);
        expect(listing.counts).toEqual({ enriched: 6, not_enriched: 2 });
        expect(
          listing.part_identifiers.find(({ value }) => value === 'HU 816 X'),
        ).toEqual(
          expect.objectContaining({
            value: 'HU 816 X',
            brand: expect.objectContaining({ name: 'Mann-Filter' }),
            part: {
              id: fittedPartId,
              name: 'Фильтр с машиной',
              source_missing_since: null,
            },
            category: { id: oilId, name: 'Моторное масло' },
            enriched: true,
            reasons: [],
            photos: 0,
            offers: 1,
            updated_at: expect.any(String),
          }),
        );
      });

      it('lists the brand-numbers that are not enriched with what each lacks', async () => {
        const listing = await list('?enriched=false');

        expect(listing.count).toBe(2);
        expect(
          Object.fromEntries(
            listing.part_identifiers.map(({ value, reasons }) => [
              value,
              reasons,
            ]),
          ),
        ).toEqual({
          'BARE-1': ['bare_number'],
          'CAT-ONLY': ['bare_number'],
        });
      });

      it('counts a description, an attribute, a Fitment or an equivalent as enrichment, with or without a Category', async () => {
        expect(values(await list('?enriched=true'))).toEqual([
          'DESC-1',
          'EQ-1',
          'EQ-2',
          'HU 816 X',
          'LOOSE-1',
          'OIL-LL04',
        ]);
      });

      it('searches by number and by Part name', async () => {
        expect(values(await list('?q=hu816'))).toEqual(['HU 816 X']);
        expect(values(await list('?q=допуску'))).toEqual(['OIL-LL04']);
        expect((await list('?q=bare')).counts).toEqual({
          enriched: 0,
          not_enriched: 1,
        });
      });

      it('filters by Category', async () => {
        const listing = await list(`?category_id=${oilId}`);

        expect(listing.counts).toEqual({ enriched: 4, not_enriched: 1 });
      });

      it('lists the brand-numbers of Parts without a Category for staff to classify', async () => {
        expect(values(await list('?uncategorized=true'))).toEqual([
          'BARE-1',
          'DESC-1',
          'LOOSE-1',
        ]);
      });

      it('narrows to the brand-numbers of one Part', async () => {
        const listing = await list(`?part_id=${fittedPartId}`);

        expect(values(listing)).toEqual(['HU 816 X']);
        expect(listing.counts).toEqual({ enriched: 1, not_enriched: 0 });
      });

      it('pages the list', async () => {
        const first = await list('?limit=3');
        const rest = await list('?offset=3&limit=10');

        expect(first.part_identifiers).toHaveLength(3);
        expect(rest.part_identifiers).toHaveLength(5);
        expect(first.count).toBe(8);
        expect(new Set([...values(first), ...values(rest)]).size).toBe(8);
      });

      it('refuses an unknown enriched value with a 400', async () => {
        const response = await api
          .get('/admin/part-identifiers?enriched=maybe', adminHeaders)
          .catch((error) => error.response);

        expect(response.status).toBe(400);
      });
    });
  },
});
