import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';
import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import { VEHICLE_BATCH } from '../../../../lib/store-response';
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

        it('lists every Vehicle, past the default page of a list', async () => {
          for (let index = 0; index < 16; index += 1) {
            await createVehicleFixture(catalog, {
              typeCode: `L${String(index).padStart(3, '0')}`,
            });
          }

          const response = await api.get('/store/vehicles', storeHeaders);

          expect(response.data.vehicles.length).toBe(
            (await catalog.listVehicles({}, { take: null })).length,
          );
          expect(response.data.vehicles.length).toBeGreaterThanOrEqual(16);
        });

        it('lists every Vehicle, past one read batch', async () => {
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

          const response = await api.get('/store/vehicles', storeHeaders);
          const ids = response.data.vehicles.map(
            ({ id }: { id: string }) => id,
          );

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
            '/store/fitments?offset=0&limit=5000',
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
          expect(response.data).toMatchObject({ offset: 0, limit: 5000 });
        });
      });

      describe('GET /store/vehicles/:id/parts', () => {
        const partsOf = async (vehicleId: string, query = '') =>
          (
            await api.get(
              `/store/vehicles/${vehicleId}/parts${query}`,
              storeHeaders,
            )
          ).data.groups as {
            category_id: string | null;
            axle: string | null;
            side: string | null;
            ambiguous: boolean;
            fitments: { part: { id: string }; quantity: number }[];
          }[];

        const pads = async (slug: string) =>
          catalog.createCategories({ slug, name: 'Тормозные колодки' });

        it('lists only the Parts fitted to the Vehicle, with quantity', async () => {
          const vehicle = (
            await createVehicleFixture(catalog, { typeCode: 'T002' })
          ).vehicle;
          const fittingPart = await catalog.createParts({
            name: 'Oil filter, BMW B47/B48 engines',
          });
          await catalog.createParts({ name: 'Cabin filter, unrelated' });
          await catalog.createFitments({
            part_id: fittingPart.id,
            vehicle_id: vehicle.id,
            quantity: 2,
          });

          const groups = await partsOf(vehicle.id);

          expect(groups).toEqual([
            expect.objectContaining({
              category_id: null,
              ambiguous: false,
              fitments: [
                expect.objectContaining({
                  part: { id: fittingPart.id, name: fittingPart.name },
                  quantity: 2,
                }),
              ],
            }),
          ]);
        });

        it('does not call front and rear pads ambiguous', async () => {
          const vehicle = (
            await createVehicleFixture(catalog, { typeCode: 'T003' })
          ).vehicle;
          const category = await pads('pads-front-rear');
          const [front, rear] = await catalog.createParts([
            { name: 'Front pads', category_id: category.id },
            { name: 'Rear pads', category_id: category.id },
          ]);
          await catalog.createFitments([
            { part_id: front.id, vehicle_id: vehicle.id, axle: 'front' },
            { part_id: rear.id, vehicle_id: vehicle.id, axle: 'rear' },
          ]);

          const groups = await partsOf(vehicle.id);

          expect(
            groups.map(({ category_id, axle, ambiguous }) => [
              category_id,
              axle,
              ambiguous,
            ]),
          ).toEqual(
            expect.arrayContaining([
              [category.id, 'front', false],
              [category.id, 'rear', false],
            ]),
          );
        });

        it('calls two Parts at one position ambiguous', async () => {
          const vehicle = (
            await createVehicleFixture(catalog, { typeCode: 'T004' })
          ).vehicle;
          const category = await pads('pads-two-candidates');
          const [plain, sport] = await catalog.createParts([
            { name: 'Front pads', category_id: category.id },
            { name: 'Front pads, M Sport brakes', category_id: category.id },
          ]);
          await catalog.createFitments([
            { part_id: plain.id, vehicle_id: vehicle.id, axle: 'front' },
            { part_id: sport.id, vehicle_id: vehicle.id, axle: 'front' },
          ]);

          const [group] = await partsOf(vehicle.id);

          expect(group.ambiguous).toBe(true);
          expect(group.fitments).toHaveLength(2);
        });

        it('calls a Fitment with a note ambiguous', async () => {
          const vehicle = (
            await createVehicleFixture(catalog, { typeCode: 'T005' })
          ).vehicle;
          const part = await catalog.createParts({ name: 'Rear pads' });
          await catalog.createFitments({
            part_id: part.id,
            vehicle_id: vehicle.id,
            axle: 'rear',
            note: 'Только без электронного стояночного тормоза',
          });

          const [group] = await partsOf(vehicle.id);

          expect(group.ambiguous).toBe(true);
        });

        it('returns a 400 for a steering fact that does not exist', async () => {
          const vehicle = (
            await createVehicleFixture(catalog, { typeCode: 'T006' })
          ).vehicle;

          const response = await api
            .get(
              `/store/vehicles/${vehicle.id}/parts?steering=middle`,
              storeHeaders,
            )
            .catch((error) => error.response);

          expect(response.status).toBe(400);
        });

        it('returns a 404 for an unknown vehicle', async () => {
          const response = await api
            .get('/store/vehicles/vehicle_missing/parts', storeHeaders)
            .catch((error) => error.response);

          expect(response.status).toBe(404);
        });
      });
    });
  },
});
