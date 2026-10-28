import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import { publishAllNumbers } from '../../../../lib/publish/published';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../modules/supplier';
import type SupplierModuleService from '../../../../modules/supplier/service';

type Car = {
  kind: string;
  make: { slug: string };
  model: { slug: string } | null;
  vehicle: { id: string; engine: { code: string } } | null;
};

type Answer = {
  cars: Car[];
  results: { value: string; part: { id: string } }[];
};

const carKey = ({ kind, make, model, vehicle }: Car) =>
  kind === 'make'
    ? `make:${make.slug}`
    : kind === 'model'
      ? `model:${model?.slug}`
      : `vehicle:${vehicle?.engine.code}`;

medusaIntegrationTestRunner({
  moduleName: 'catalog',
  dbName: 'medusa-catalogue-search-integration',
  testSuite: ({ api, getContainer }) => {
    describe('GET /store/search over cars and parts', () => {
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };
      let fittingFilterId: string;
      let otherFilterId: string;

      const search = async (q: string): Promise<Answer> =>
        (
          await api.get(
            `/store/search?${new URLSearchParams({ q, locale: 'ru' })}`,
            storeHeaders,
          )
        ).data;

      const cars = async (q: string) => (await search(q)).cars.map(carKey);

      beforeAll(async () => {
        const container = getContainer();
        const catalog: CatalogModuleService = container.resolve(CATALOG_MODULE);
        const suppliers: SupplierModuleService =
          container.resolve(SUPPLIER_MODULE);
        const apiKeys: IApiKeyModuleService = container.resolve(
          Modules.API_KEY,
        );
        const key = await apiKeys.createApiKeys({
          title: 'catalogue-search-tests',
          type: 'publishable',
          created_by: 'test',
        });
        storeHeaders = { headers: { 'x-publishable-api-key': key.token } };

        const [mann, febi] = await catalog.createBrands([
          { name: 'Mann-Filter', slug: 'mann-filter' },
          { name: 'Febi', slug: 'febi' },
        ]);

        const x3N47 = await createVehicleFixture(catalog, {
          typeCode: 'PC31',
          modelSlug: 'e83-x3-20d',
          chassisCode: 'E83',
          engineCode: 'N47D20A',
          engineFamily: 'N47',
        });
        await catalog.updateVehicleModels({
          id: x3N47.model.id,
          name: 'X3 2.0d',
        });
        const x3M47 = await createVehicleFixture(catalog, {
          typeCode: 'PA91',
          modelSlug: 'e83-x3-20d',
          chassisCode: 'E83',
          engineCode: 'M47D20',
          engineFamily: 'M47',
        });
        const e90 = await createVehicleFixture(catalog, {
          typeCode: 'PG71',
          modelSlug: 'e90-320d',
          chassisCode: 'E90',
          engineCode: 'M47D20',
        });
        const f30 = await createVehicleFixture(catalog, {
          typeCode: 'T001',
          modelSlug: 'f30-320d',
          chassisCode: 'F30',
        });
        const audi = await createVehicleFixture(catalog, {
          make: { slug: 'audi', name: 'Audi' },
          typeCode: 'A4B8',
          modelSlug: 'b8-a4-20tdi',
          chassisCode: 'B8',
          engineCode: 'CAGA',
          engineFamily: 'EA189',
        });

        const part = async (
          name: string,
          value: string,
          vehicleIds: string[],
          brandId = febi.id,
        ) => {
          const id = await catalog.createPartWithIdentifiers({
            name,
            identifiers: [
              { type: 'manufacturer-number', brand_id: brandId, value },
            ],
          });
          if (vehicleIds.length) {
            await catalog.createFitments(
              vehicleIds.map((vehicle_id) => ({ part_id: id, vehicle_id })),
            );
          }
          return id;
        };

        const bothX3 = [x3N47.vehicle.id, x3M47.vehicle.id];
        fittingFilterId = await part('Масляный фильтр', 'HU 815/2 x', bothX3);
        await part('Воздушный фильтр', 'C 2440', bothX3);
        await part('Тормозные колодки', '16 236', bothX3);
        await part('Свеча накаливания', '15 957', [x3N47.vehicle.id]);
        for (const value of ['21 001', '21 002', '21 003']) {
          await part('Ремень', value, [e90.vehicle.id]);
        }
        await part('Щетка', '31 001', [f30.vehicle.id]);
        await part('Щетка', '31 002', [f30.vehicle.id]);
        await part('Щетка', '41 001', [audi.vehicle.id]);
        otherFilterId = await part('Масляный фильтр', 'HU 816 x', [], mann.id);
        const [supplier] = await suppliers.createSuppliers([
          { name: 'Intercars', markup_percentage: 20 },
        ]);
        const [otherNumber] = await catalog.listPartIdentifiers({
          part_id: otherFilterId,
        });
        await suppliers.createSupplierOffers([
          {
            part_identifier_id: otherNumber.id,
            supplier_id: supplier.id,
            supplier_article_id: 'IC-HU816X',
            cost_price: 900,
            stock_quantity: 5,
            lead_time_days: 0,
          },
        ]);

        await publishAllNumbers(container);
        await part('Щетка', '31 003', [f30.vehicle.id]);
        await container.resolve(Modules.SEARCH).reindex();
      });

      it('finds a Make by its name, ahead of its Models', async () => {
        expect((await cars('bmw'))[0]).toBe('make:bmw');
      });

      it('finds a Model by make and model, ahead of its Vehicles', async () => {
        const found = await cars('bmw x3');
        expect(found[0]).toBe('model:e83-x3-20d');
        expect(found).toContain('vehicle:N47D20A');
        expect(found).not.toContain('make:bmw');
      });

      it('finds a Model by its chassis code', async () => {
        expect((await cars('E90'))[0]).toBe('model:e90-320d');
      });

      it('reads a code typed in Cyrillic', async () => {
        expect((await cars('Е90'))[0]).toBe('model:e90-320d');
      });

      it('finds a Vehicle by its engine code', async () => {
        expect(await cars('N47')).toEqual(['vehicle:N47D20A']);
      });

      it('offers no page for a solitary Vehicle', async () => {
        expect(await cars('e90')).not.toContain('vehicle:M47D20');
      });

      it('offers no page for fewer than three published Parts', async () => {
        expect(await cars('f30')).toEqual([]);
        expect(await cars('audi')).toEqual([]);
      });

      it('finds no car in a part number', async () => {
        const { cars: found, results } = await search('HU 816 x');
        expect(found).toEqual([]);
        expect(results[0].part.id).toBe(otherFilterId);
      });

      it('ranks the Parts that fit the named car first', async () => {
        const { cars: found, results } = await search('масляный фильтр bmw x3');
        expect(found.map(carKey)[0]).toBe('model:e83-x3-20d');
        expect(results.map(({ part }) => part.id)).toEqual([
          fittingFilterId,
          otherFilterId,
        ]);
      });

      it('names the car whichever side of the part it is typed on', async () => {
        const { results } = await search('x3 масляный фильтр');
        expect(results[0].part.id).toBe(fittingFilterId);
      });

      it('lists the Parts that fit a car named alone', async () => {
        const { results } = await search('bmw x3');
        expect(results.map(({ value }) => value).sort()).toEqual([
          '15 957',
          '16 236',
          'C 2440',
          'HU 815/2 x',
        ]);
      });
    });
  },
});
