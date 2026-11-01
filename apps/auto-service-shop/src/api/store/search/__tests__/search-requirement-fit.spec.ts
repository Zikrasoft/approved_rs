import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { PUBLISH_MODULE } from '../../../../modules/publish';
import type PublishModuleService from '../../../../modules/publish/service';

type Facet = { key: string; values: { value: string; count: number }[] };

medusaIntegrationTestRunner({
  moduleName: 'catalog',
  dbName: 'medusa-search-requirement-fit',
  testSuite: ({ api, getContainer }) => {
    describe('GET /store/search scoped to a car with Requirements', () => {
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };
      const part: Record<string, string> = {};
      let f30VehicleId: string;
      let g20VehicleId: string;

      const search = (params: Record<string, string>) =>
        api
          .get(
            `/store/search?${new URLSearchParams({ locale: 'ru', ...params })}`,
            storeHeaders,
          )
          .catch((error) => error.response);
      const partIds = (response: {
        data: { results: { part: { id: string } }[] };
      }) => response.data.results.map(({ part }) => part.id).sort();
      const brandCounts = (response: { data: { facets: Facet[] } }) =>
        Object.fromEntries(
          (
            response.data.facets.find(({ key }) => key === 'brand')?.values ??
            []
          ).map(({ value, count }) => [value, count]),
        );
      const f30 = { make: 'bmw', model: 'f30-320d' };

      beforeAll(async () => {
        const catalog: CatalogModuleService =
          getContainer().resolve(CATALOG_MODULE);
        const apiKeys: IApiKeyModuleService = getContainer().resolve(
          Modules.API_KEY,
        );
        const key = await apiKeys.createApiKeys({
          title: 'requirement-fit-tests',
          type: 'publishable',
          created_by: 'test',
        });
        storeHeaders = { headers: { 'x-publishable-api-key': key.token } };

        const brands = await catalog.createBrands([
          { name: 'VARTA', slug: 'varta' },
          { name: 'Bosch', slug: 'bosch' },
          { name: 'Exide', slug: 'exide' },
        ]);
        const brand = Object.fromEntries(brands.map((b) => [b.slug, b.id]));
        const batteries = await catalog.createCategories({
          slug: 'batteries',
          name: 'Аккумуляторы',
        });
        const [capacity, technology] = await catalog.createCategoryFields([
          {
            category_id: batteries.id,
            key: 'capacity',
            type: 'number',
            unit: 'А·ч',
            label: 'Емкость',
            facet: true,
            rank: 0,
          },
          {
            category_id: batteries.id,
            key: 'technology',
            type: 'single-select',
            label: 'Технология',
            facet: true,
            rank: 1,
          },
        ]);
        await catalog.createCategoryFieldOptions([
          { field_id: technology.id, key: 'agm', label: 'AGM' },
          { field_id: technology.id, key: 'efb', label: 'EFB' },
        ]);

        const battery = (
          slug: string,
          number: string,
          attributes: Record<string, string | number>,
        ) =>
          catalog.createPartWithIdentifiers({
            name: `Аккумулятор ${number}`,
            category_id: batteries.id,
            attributes,
            identifiers: [
              {
                type: 'manufacturer-number',
                brand_id: brand[slug],
                value: number,
              },
            ],
          });
        part.varta = await battery('varta', 'G14', {
          capacity: 80,
          technology: 'agm',
        });
        part.bosch = await battery('bosch', 'S5 A13', {
          capacity: 95,
          technology: 'agm',
        });
        part.exideSmall = await battery('exide', 'EK700', {
          capacity: 70,
          technology: 'agm',
        });
        part.exideFitted = await battery('exide', 'EB741', {
          capacity: 74,
          technology: 'efb',
        });

        const f30Car = await createVehicleFixture(catalog);
        f30VehicleId = f30Car.vehicle.id;
        g20VehicleId = (
          await createVehicleFixture(catalog, {
            typeCode: 'G001',
            modelSlug: 'g20-320d',
            chassisCode: 'G20',
            engineCode: 'B48A20',
          })
        ).vehicle.id;
        await catalog.createRequirement({
          field_id: capacity.id,
          chassis_id: f30Car.chassis.id,
          option_keys: null,
          min: 80,
          max: null,
          quantity: 1,
        });
        await catalog.createRequirement({
          field_id: technology.id,
          engine_id: f30Car.engine.id,
          option_keys: ['agm'],
          min: null,
          max: null,
          quantity: 1,
        });
        await catalog.createFitments({
          part_id: part.exideFitted,
          vehicle_id: f30VehicleId,
        });

        await getContainer()
          .resolve<PublishModuleService>(PUBLISH_MODULE)
          .publishAll();
        await getContainer()
          .resolve(Modules.SEARCH)
          .reindex({ index: 'part_identifier' });
      });

      it('lists the Parts that meet the Model’s Requirements beside its fitted ones', async () => {
        const response = await search({ category: 'batteries', ...f30 });

        expect(response.status).toBe(200);
        expect(partIds(response)).toEqual(
          [part.varta, part.bosch, part.exideFitted].sort(),
        );
        expect(response.data.count).toBe(3);
        expect(brandCounts(response)).toEqual({
          varta: 1,
          bosch: 1,
          exide: 1,
        });
      });

      it('counts and lists exactly the brand ticked on a Model page', async () => {
        const response = await search({
          category: 'batteries',
          ...f30,
          facets: 'brand:varta',
          limit: '1',
        });

        expect(response.data.count).toBe(1);
        expect(partIds(response)).toEqual([part.varta]);
      });

      it('narrows the Requirement matches by a ranged filter', async () => {
        const response = await search({
          category: 'batteries',
          ...f30,
          range: 'capacity:90:',
        });

        expect(partIds(response)).toEqual([part.bosch]);
      });

      it('finds the Requirement matches by text on a Model without a category', async () => {
        const response = await search({ q: 'аккумулятор', ...f30 });

        expect(partIds(response)).toEqual(
          [part.varta, part.bosch, part.exideFitted].sort(),
        );
      });

      it('applies the same fit to a single Vehicle', async () => {
        const response = await search({
          category: 'batteries',
          vehicle_id: f30VehicleId,
        });

        expect(partIds(response)).toEqual(
          [part.varta, part.bosch, part.exideFitted].sort(),
        );
      });

      it('finds nothing for a car with neither Fitments nor Requirements', async () => {
        const [byModel, byVehicle] = await Promise.all([
          search({ category: 'batteries', make: 'bmw', model: 'g20-320d' }),
          search({ category: 'batteries', vehicle_id: g20VehicleId }),
        ]);

        expect(byModel.data.results).toEqual([]);
        expect(byVehicle.data.results).toEqual([]);
      });
    });
  },
});
