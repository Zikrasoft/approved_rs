import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { PART_MODULE } from '../../../../modules/part';
import type PartModuleService from '../../../../modules/part/service';
import { VEHICLE_MODULE } from '../../../../modules/vehicle';
import type VehicleModuleService from '../../../../modules/vehicle/service';

medusaIntegrationTestRunner({
  moduleName: 'vehicle',
  testSuite: ({ api, getContainer }) => {
    describe('vehicle store API', () => {
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };
      let vehicleModuleService: VehicleModuleService;
      let partModuleService: PartModuleService;

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

        vehicleModuleService = getContainer().resolve(VEHICLE_MODULE);
        partModuleService = getContainer().resolve(PART_MODULE);
      });

      describe('GET /store/vehicles', () => {
        it('lists the seeded vehicles for the picker', async () => {
          const vehicle = await vehicleModuleService.createVehicles({
            make: 'BMW',
            model: '320d (F30)',
            engine_code: 'B47',
            year_from: 2015,
            year_to: 2018,
          });

          const response = await api.get('/store/vehicles', storeHeaders);

          expect(response.status).toBe(200);
          expect(response.data.vehicles).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: vehicle.id,
                make: 'BMW',
                model: '320d (F30)',
                engine_code: 'B47',
              }),
            ]),
          );
        });
      });

      describe('GET /store/vehicles/:id/parts', () => {
        it('returns only parts with an active fitment row for the vehicle', async () => {
          const vehicle = await vehicleModuleService.createVehicles({
            make: 'BMW',
            model: '320d (F30)',
            engine_code: 'B47',
            year_from: 2015,
            year_to: 2018,
          });

          const fittingPart = await partModuleService.createParts({
            name: 'Oil filter, BMW B47/B48 engines',
          });
          const unrelatedPart = await partModuleService.createParts({
            name: 'Cabin filter, unrelated vehicle',
          });

          await vehicleModuleService.createFitments({
            part_id: fittingPart.id,
            vehicle_id: vehicle.id,
            source: 'manual',
            status: 'active',
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
          const vehicle = await vehicleModuleService.createVehicles({
            make: 'BMW',
            model: '320d (F30)',
            engine_code: 'N47',
            year_from: 2010,
            year_to: 2012,
          });

          const part = await partModuleService.createParts({
            name: 'Oil filter, BMW N47 engines',
          });

          await vehicleModuleService.createFitments([
            {
              part_id: part.id,
              vehicle_id: vehicle.id,
              steering: 'left',
              source: 'manual',
              status: 'active',
            },
            {
              part_id: part.id,
              vehicle_id: vehicle.id,
              steering: 'right',
              source: 'manual',
              status: 'active',
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

        it('excludes a rejected fitment row', async () => {
          const vehicle = await vehicleModuleService.createVehicles({
            make: 'BMW',
            model: '320d (F30)',
            engine_code: 'B48',
            year_from: 2018,
            year_to: 2021,
          });

          const part = await partModuleService.createParts({
            name: 'Oil filter, BMW B48 engines',
          });

          await vehicleModuleService.createFitments({
            part_id: part.id,
            vehicle_id: vehicle.id,
            source: 'manual',
            status: 'rejected',
          });

          const response = await api.get(
            `/store/vehicles/${vehicle.id}/parts`,
            storeHeaders,
          );

          expect(response.status).toBe(200);
          expect(response.data.parts).toHaveLength(0);
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
