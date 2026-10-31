import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';
import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import {
  listVehicleResponses,
  VEHICLE_BATCH,
} from '../../../../lib/store-response';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';

medusaIntegrationTestRunner({
  moduleName: 'catalog',
  testSuite: ({ api, getContainer }) => {
    describe('vehicle store API', () => {
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };
      let catalog: CatalogModuleService;

      beforeAll(async () => {
        const apiKeyModuleService: IApiKeyModuleService =
          getContainer().resolve(Modules.API_KEY);
        const publishableKey = await apiKeyModuleService.createApiKeys({
          title: 'vehicle-tests',
          type: 'publishable',
          created_by: 'test',
        });
        storeHeaders = {
          headers: { 'x-publishable-api-key': publishableKey.token },
        };

        catalog = getContainer().resolve(CATALOG_MODULE);
      });

      describe('GET /store/vehicles', () => {
        it('lists the seeded vehicles for the picker', async () => {
          const vehicle = (
            await createVehicleFixture(catalog, { typeCode: 'T001' })
          ).vehicle;

          const response = await api.get('/store/vehicles', storeHeaders);

          expect(response.status).toBe(200);
          expect(response.data.vehicles).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: vehicle.id,
                identifiers: [{ type: 'bmw-type-code', value: 'T001' }],
                engine: expect.objectContaining({ code: 'B47D20O0' }),
                model: expect.objectContaining({ slug: 'f30-320d' }),
              }),
            ]),
          );
        });

        it('gives Models of two Makes the same slug and tells them apart by Make', async () => {
          const modelsOf = await Promise.all(
            [
              { slug: 'alpha', name: 'Alpha' },
              { slug: 'beta', name: 'Beta' },
            ].map(async (make) => {
              const [made] = await catalog.createMakes([make]);
              const series = await catalog.createSeries({
                make_id: made.id,
                name: 'Series X',
              });
              const chassis = await catalog.createChassis({
                series_id: series.id,
                code: 'X1',
              });
              const model = await catalog.createVehicleModels({
                chassis_id: chassis.id,
                name: 'X1 20d',
              });
              const engine = await catalog.createEngines({
                code: `${make.slug.toUpperCase()}20D`,
                family: 'X20',
              });
              const vehicle = await catalog.createVehicles({
                model_id: model.id,
                engine_id: engine.id,
              });
              return { make: make.slug, model, vehicle };
            }),
          );

          expect(modelsOf.map(({ model }) => model.slug)).toEqual([
            'series-x-x1-20d',
            'series-x-x1-20d',
          ]);
          for (const { make, model, vehicle } of modelsOf) {
            const listed = await api.get(
              `/store/vehicles?make=${make}&model=${model.slug}`,
              storeHeaders,
            );
            expect(
              listed.data.vehicles.map(({ id }: { id: string }) => id),
            ).toEqual([vehicle.id]);
          }
        });

        it('pages through every Vehicle by cursor, one row per Vehicle', async () => {
          for (let index = 0; index < 3; index += 1) {
            const { vehicle } = await createVehicleFixture(catalog, {
              typeCode: `L${String(index).padStart(3, '0')}`,
            });
            await catalog.createVehicleIdentifiers({
              vehicle_id: vehicle.id,
              type: 'mercedes-baumuster',
              value: `M${index}`,
            });
          }
          const total = (await catalog.listVehicles({}, { take: null })).length;

          const page = async (after: string | null) =>
            (
              await api.get(
                `/store/vehicles?limit=2${after ? `&after=${after}` : ''}`,
                storeHeaders,
              )
            ).data;
          const pages: { vehicles: { id: string }[]; next: string | null }[] = [
            await page(null),
          ];
          while (pages[pages.length - 1].next) {
            pages.push(await page(pages[pages.length - 1].next));
          }
          const ids = pages.flatMap(({ vehicles }) =>
            vehicles.map(({ id }) => id),
          );

          expect(pages[0]).toMatchObject({ count: null, limit: 2 });
          expect(pages[0].vehicles).toHaveLength(2);
          expect(ids).toHaveLength(total);
          expect(new Set(ids).size).toBe(total);
        });

        it('answers one default page when no page is asked for', async () => {
          const response = await api.get('/store/vehicles', storeHeaders);

          expect(response.data).toMatchObject({ limit: 1000, next: null });
        });

        it('refuses a page past the largest limit', async () => {
          const response = await api
            .get('/store/vehicles?limit=5001', storeHeaders)
            .catch((error) => error.response);

          expect(response.status).toBe(400);
        });

        it('lists only the Vehicles of the Model asked for', async () => {
          const { vehicle, model } = await createVehicleFixture(catalog, {
            typeCode: 'M001',
            modelSlug: 'g20-330i',
          });

          const response = await api.get(
            `/store/vehicles?model=${model.slug}&limit=1`,
            storeHeaders,
          );

          expect(response.data).toMatchObject({ count: 1 });
          expect(response.data.vehicles).toEqual([
            expect.objectContaining({ id: vehicle.id }),
          ]);
        });

        it('lists no Vehicle for a Model that does not exist', async () => {
          const response = await api.get(
            '/store/vehicles?model=no-such-model',
            storeHeaders,
          );

          expect(response.data).toMatchObject({ vehicles: [], count: 0 });
        });

        it('reads every Vehicle past one read batch for the shop itself', async () => {
          const { model, engine } = await createVehicleFixture(catalog, {
            typeCode: 'B000',
          });
          await catalog.createVehicles(
            Array.from({ length: VEHICLE_BATCH }, (_, index) => ({
              model_id: model.id,
              engine_id: engine.id,
              power_kw: index + 1,
              drive: 'rwd' as const,
              market: 'EU',
              year_from: 2015,
              year_to: 2019,
              steering: 'left' as const,
            })),
          );

          const ids = (await listVehicleResponses(catalog)).map(({ id }) => id);

          expect(new Set(ids).size).toBe(ids.length);
          expect(ids.length).toBe(
            (await catalog.listVehicles({}, { take: null })).length,
          );
          expect(ids.length).toBeGreaterThan(VEHICLE_BATCH);
        });
      });

      describe('GET /store/fitments', () => {
        it('pages through every Fitment for the storefront build', async () => {
          const vehicle = (
            await createVehicleFixture(catalog, { typeCode: 'T010' })
          ).vehicle;
          const part = await catalog.createParts({ name: 'Paged part' });
          const fitment = await catalog.createFitments({
            part_id: part.id,
            vehicle_id: vehicle.id,
            axle: 'front',
            production_from: new Date('2016-03-01T00:00:00.000Z'),
            note: 'Только седан',
            translations: { sr: { note: 'Samo limuzina' } },
          });

          const response = await api.get(
            '/store/fitments?limit=5000',
            storeHeaders,
          );

          expect(response.data.fitments).toContainEqual({
            id: fitment.id,
            part_id: part.id,
            vehicle_id: vehicle.id,
            quantity: 1,
            axle: 'front',
            side: null,
            production_from: '2016-03-01T00:00:00.000Z',
            production_to: null,
            gearbox: null,
            steering: null,
            note: 'Только седан',
            translations: { sr: { note: 'Samo limuzina' } },
          });
          expect(response.data).toMatchObject({ limit: 5000, next: null });
        });
      });
    });
  },
});
