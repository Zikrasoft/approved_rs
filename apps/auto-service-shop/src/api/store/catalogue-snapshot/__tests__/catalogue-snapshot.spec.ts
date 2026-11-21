import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';
import {
  CATALOGUE_SNAPSHOT_PATH,
  catalogueSnapshotResponseSchema,
  type Vehicle,
} from '@podbor/catalog-contract';

import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { PUBLISH_MODULE } from '../../../../modules/publish';
import type PublishModuleService from '../../../../modules/publish/service';

type Listed = { data: Record<string, unknown[]> & { next?: string | null } };

const requirementsById = (vehicles: Vehicle[]) =>
  vehicles.map((vehicle) => ({
    ...vehicle,
    requirements: [...vehicle.requirements].sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
  }));

medusaIntegrationTestRunner({
  moduleName: 'catalogue-snapshot',
  dbName: 'carlab_catalogue_snapshot',
  testSuite: ({ api, getContainer }) => {
    describe(`GET ${CATALOGUE_SNAPSHOT_PATH}`, () => {
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };
      let bmw: Awaited<ReturnType<typeof createVehicleFixture>>;
      let gone: Awaited<ReturnType<typeof createVehicleFixture>>;
      let requirementIds: string[];

      beforeAll(async () => {
        const container = getContainer();
        const catalog: CatalogModuleService = container.resolve(CATALOG_MODULE);
        const key = await container
          .resolve<IApiKeyModuleService>(Modules.API_KEY)
          .createApiKeys({
            title: 'catalogue-snapshot-tests',
            type: 'publishable',
            created_by: 'test',
          });
        storeHeaders = { headers: { 'x-publishable-api-key': key.token } };

        const [mann] = await catalog.createBrands([
          { name: 'Mann-Filter', slug: 'mann-filter' },
        ]);
        const oilFilters = await catalog.createCategories({
          slug: 'oil-filters',
          name: 'Масляные фильтры',
        });
        const height = await catalog.createCategoryFields({
          category_id: oilFilters.id,
          key: 'height',
          type: 'number',
          unit: 'mm',
          label: 'Высота',
        });
        const filterId = await catalog.createPartWithIdentifiers({
          name: 'Oil filter',
          category_id: oilFilters.id,
          attributes: { height: 75 },
          identifiers: [
            {
              type: 'manufacturer-number',
              brand_id: mann.id,
              value: 'HU 816 x',
            },
          ],
        });

        await catalog.createMakes({
          slug: 'mini',
          name: 'MINI',
          show_on_site: true,
        });
        bmw = await createVehicleFixture(catalog);
        await createVehicleFixture(catalog, {
          make: { slug: 'mercedes-benz', name: 'Mercedes-Benz' },
          identifierType: 'mercedes-baumuster',
          typeCode: '213004',
          modelSlug: 'w213-e220d',
          chassisCode: 'W213',
          engineCode: 'OM654D20',
          engineFamily: 'OM654',
        });
        gone = await createVehicleFixture(catalog, {
          typeCode: '8C31',
          modelSlug: 'f30-318d',
          modelName: '318d',
        });
        await catalog.createVehicleIdentifiers({
          vehicle_id: bmw.vehicle.id,
          type: 'supplier-vehicle-id',
          value: 'IC-1',
          supplier_id: 'supplier_1',
        });
        const requirements = await catalog.createRequirements([
          { field_id: height.id, vehicle_id: bmw.vehicle.id, min: 70, max: 80 },
          { field_id: height.id, chassis_id: bmw.chassis.id, min: 60, max: 90 },
          { field_id: height.id, engine_id: bmw.engine.id, min: 50, max: 99 },
        ]);
        requirementIds = requirements.map(({ id }) => id).reverse();

        const [, leftOver] = await catalog.createFitments([
          { part_id: filterId, vehicle_id: bmw.vehicle.id },
          { part_id: filterId, vehicle_id: gone.vehicle.id },
        ]);
        await catalog.softDeleteFitments([leftOver.id]);
        await catalog.softDeleteVehicles([gone.vehicle.id]);
        await container
          .resolve<PublishModuleService>(PUBLISH_MODULE)
          .publishAll();
      });

      const snapshot = async () =>
        catalogueSnapshotResponseSchema.parse(
          (await api.get(CATALOGUE_SNAPSHOT_PATH, storeHeaders)).data,
        );

      const listed = async (path: string, key: string) => {
        const all: unknown[] = [];
        for (let after: string | null | undefined; ;) {
          const query = after ? `?after=${after}` : '';
          const { data }: Listed = await api.get(
            `${path}${query}`,
            storeHeaders,
          );
          all.push(...data[key]);
          after = data.next;
          if (!after) return all;
        }
      };

      it('answers in one response what the paged store routes answer', async () => {
        const whole = await snapshot();

        expect(whole.categories).toEqual(
          (await api.get('/store/categories', storeHeaders)).data.categories,
        );
        expect(whole.pages).toEqual(await listed('/store/part-pages', 'pages'));
        expect(whole.fitments).toEqual(
          await listed('/store/fitments', 'fitments'),
        );
        expect(requirementsById(whole.vehicles)).toEqual(
          requirementsById(
            (await listed('/store/vehicles', 'vehicles')) as Vehicle[],
          ),
        );
      });

      it('leaves out deleted rows and supplier ids, and lists engine, chassis, then own requirements', async () => {
        const whole = await snapshot();
        const car = whole.vehicles.find(({ id }) => id === bmw.vehicle.id);

        expect(whole.vehicles).toHaveLength(2);
        expect(whole.fitments).toHaveLength(1);
        expect(car?.identifiers).toEqual([
          { type: 'bmw-type-code', value: '35BG' },
        ]);
        expect(car?.requirements.map(({ id }) => id)).toEqual(requirementIds);
        expect(car?.requirements[0]).toEqual({
          id: requirementIds[0],
          category_id: expect.any(String),
          field_key: 'height',
          option_keys: null,
          min: 50,
          max: 99,
          quantity: 1,
        });
      });

      it('lists every catalogue Make with its site flag, also one without vehicles', async () => {
        expect((await snapshot()).makes).toEqual([
          { slug: 'bmw', name: 'BMW', show_on_site: false },
          { slug: 'mercedes-benz', name: 'Mercedes-Benz', show_on_site: false },
          { slug: 'mini', name: 'MINI', show_on_site: true },
        ]);
      });

      it('answers only a caller with the publishable key', async () => {
        const response = await api
          .get(CATALOGUE_SNAPSHOT_PATH)
          .catch((error) => error.response);

        expect(response.status).toBe(400);
      });
    });
  },
});
