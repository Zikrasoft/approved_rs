import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { PART_MODULE } from '../../../../modules/part';
import type PartModuleService from '../../../../modules/part/service';
import { VEHICLE_MODULE } from '../../../../modules/vehicle';
import type VehicleModuleService from '../../../../modules/vehicle/service';
import { VIN_LOOKUP_MODULE } from '../../../../modules/vin-lookup';
import type VinLookupModuleService from '../../../../modules/vin-lookup/service';

const B47_VIN = 'WBA3B1C50GL123456';
const UNKNOWN_MANUFACTURER_VIN = '1HGCM82633A004352';

medusaIntegrationTestRunner({
  moduleName: 'vin_lookup',
  testSuite: ({ api, getContainer }) => {
    describe('VIN lookup store API', () => {
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };
      let vehicleModuleService: VehicleModuleService;
      let partModuleService: PartModuleService;
      let vinLookupModuleService: VinLookupModuleService;

      beforeAll(async () => {
        const apiKeyModuleService: IApiKeyModuleService =
          getContainer().resolve(Modules.API_KEY);
        const publishableKey = await apiKeyModuleService.createApiKeys({
          title: 'vin-lookup-tests',
          type: 'publishable',
          created_by: 'test',
        });
        storeHeaders = {
          headers: { 'x-publishable-api-key': publishableKey.token },
        };

        vehicleModuleService = getContainer().resolve(VEHICLE_MODULE);
        partModuleService = getContainer().resolve(PART_MODULE);
        vinLookupModuleService = getContainer().resolve(VIN_LOOKUP_MODULE);
      });

      describe('POST /store/vin-lookups', () => {
        it('resolves a VIN to the seeded Vehicle it structurally decodes to, and creates a VinLookup', async () => {
          const b47 = await vehicleModuleService.createVehicles({
            make: 'BMW',
            model: '320d (F30)',
            engine_code: 'B47',
            year_from: 2015,
            year_to: 2018,
          });
          const n47 = await vehicleModuleService.createVehicles({
            make: 'BMW',
            model: '320d (F30)',
            engine_code: 'N47',
            year_from: 2010,
            year_to: 2012,
          });
          const part = await partModuleService.createParts({
            name: 'Oil filter, BMW B47/B48 engines',
          });
          await vehicleModuleService.createFitments({
            part_id: part.id,
            vehicle_id: b47.id,
            source: 'manual',
            status: 'active',
          });

          const response = await api.post(
            '/store/vin-lookups',
            { vin: B47_VIN },
            storeHeaders,
          );

          expect(response.status).toBe(200);
          expect(response.data.resolved).toBe(true);
          expect(response.data.vehicle).toMatchObject({
            id: b47.id,
            make: 'BMW',
            engine_code: 'B47',
          });
          expect(response.data.vehicle.id).not.toBe(n47.id);
          expect(response.data.vin_lookup_id).toBeTruthy();

          const [stored] = await vinLookupModuleService.listVinLookups({
            vin: B47_VIN,
          });
          expect(stored).toMatchObject({
            vin: B47_VIN,
            vehicle_id: b47.id,
          });

          const listingResponse = await api.get(
            `/store/vehicles/${response.data.vehicle.id}/parts`,
            storeHeaders,
          );
          expect(listingResponse.data.parts).toHaveLength(1);
          expect(listingResponse.data.parts[0]).toMatchObject({
            ambiguous: false,
            part: expect.objectContaining({ id: part.id }),
          });
        });

        it('reuses the cached VinLookup row on a second lookup of the same VIN', async () => {
          const vehicle = await vehicleModuleService.createVehicles({
            make: 'BMW',
            model: '320d (F30)',
            engine_code: 'B47',
            year_from: 2015,
            year_to: 2018,
          });
          const vin = 'WBA3B1C50GL654321';

          const first = await api.post(
            '/store/vin-lookups',
            { vin },
            storeHeaders,
          );
          const second = await api.post(
            '/store/vin-lookups',
            { vin },
            storeHeaders,
          );

          expect(first.data.vin_lookup_id).toBe(second.data.vin_lookup_id);
          expect(second.data.vehicle.id).toBe(vehicle.id);

          const stored = await vinLookupModuleService.listVinLookups({ vin });
          expect(stored).toHaveLength(1);
        });

        it('does not resolve or cache a VIN whose WMI is outside the stub decoder table', async () => {
          const response = await api.post(
            '/store/vin-lookups',
            { vin: UNKNOWN_MANUFACTURER_VIN },
            storeHeaders,
          );

          expect(response.status).toBe(200);
          expect(response.data.resolved).toBe(false);
          expect(response.data.vehicle).toBeNull();
          expect(response.data.vin_lookup_id).toBeNull();

          const stored = await vinLookupModuleService.listVinLookups({
            vin: UNKNOWN_MANUFACTURER_VIN,
          });
          expect(stored).toHaveLength(0);
        });

        it('rejects a VIN that is not 17 structurally valid characters', async () => {
          const response = await api
            .post('/store/vin-lookups', { vin: 'TOO-SHORT' }, storeHeaders)
            .catch((error) => error.response);

          expect(response.status).not.toBe(200);
        });
      });
    });
  },
});
