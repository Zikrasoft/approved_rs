import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';
import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
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
      });

      describe('GET /store/vehicles/:id/parts', () => {
        it('returns only parts with a fitment row for the vehicle', async () => {
          const vehicle = (
            await createVehicleFixture(catalog, { typeCode: 'T002' })
          ).vehicle;

          const fittingPart = await catalog.createParts({
            name: 'Oil filter, BMW B47/B48 engines',
          });
          const unrelatedPart = await catalog.createParts({
            name: 'Cabin filter, unrelated vehicle',
          });

          await catalog.createFitments({
            part_id: fittingPart.id,
            vehicle_id: vehicle.id,
          });

          const response = await api.get(
            `/store/vehicles/${vehicle.id}/parts`,
            storeHeaders,
          );

          expect(response.status).toBe(200);
          expect(response.data.parts).toHaveLength(1);
          expect(response.data.parts[0]).toMatchObject({
            ambiguous: false,
            part: expect.objectContaining({ id: fittingPart.id }),
          });
          expect(
            response.data.parts.some(
              (entry: { part: { id: string } }) =>
                entry.part.id === unrelatedPart.id,
            ),
          ).toBe(false);
        });

        it('surfaces a confirm-your-variant state for an ambiguous fitment', async () => {
          const vehicle = (
            await createVehicleFixture(catalog, { typeCode: 'T003' })
          ).vehicle;

          const part = await catalog.createParts({
            name: 'Oil filter, BMW N47 engines',
          });

          await catalog.createFitments([
            {
              part_id: part.id,
              vehicle_id: vehicle.id,
              steering: 'left',
            },
            {
              part_id: part.id,
              vehicle_id: vehicle.id,
              steering: 'right',
            },
          ]);

          const response = await api.get(
            `/store/vehicles/${vehicle.id}/parts`,
            storeHeaders,
          );

          expect(response.status).toBe(200);
          expect(response.data.parts).toHaveLength(1);
          expect(response.data.parts[0].ambiguous).toBe(true);
          expect(response.data.parts[0].part.id).toBe(part.id);
          expect(response.data.parts[0].candidates).toHaveLength(2);
          expect(
            response.data.parts[0].candidates.map(
              (candidate: { steering: string }) => candidate.steering,
            ),
          ).toEqual(expect.arrayContaining(['left', 'right']));
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
