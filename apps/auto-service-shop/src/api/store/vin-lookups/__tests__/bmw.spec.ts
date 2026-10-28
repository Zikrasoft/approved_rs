import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';

medusaIntegrationTestRunner({
  moduleName: 'vin_lookup_bmw',
  testSuite: ({ api, getContainer }) => {
    describe('BMW VIN lookup through open type-key data', () => {
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };
      let catalog: CatalogModuleService;

      const lookUp = (vin: string) =>
        api.post('/store/vin-lookups', { vin }, storeHeaders);

      const createCrawledVehicle = (
        modelSlug: string,
        modelName: string,
        supplierId: string,
        {
          chassisCode = 'F30/F31',
          engineCode = 'B47D20A',
          powerKw = 140,
        }: { chassisCode?: string; engineCode?: string; powerKw?: number } = {},
      ) =>
        createVehicleFixture(catalog, {
          identifierType: 'supplier-vehicle-id',
          steering: null,
          typeCode: supplierId,
          modelSlug,
          modelName,
          chassisCode,
          engineCode,
          engineFamily: 'B47',
          powerKw,
        });

      beforeAll(async () => {
        const apiKeyModuleService: IApiKeyModuleService =
          getContainer().resolve(Modules.API_KEY);
        const publishableKey = await apiKeyModuleService.createApiKeys({
          title: 'bmw-vin-tests',
          type: 'publishable',
          created_by: 'test',
        });
        storeHeaders = {
          headers: { 'x-publishable-api-key': publishableKey.token },
        };
        catalog = getContainer().resolve(CATALOG_MODULE);
      });

      it('resolves a type code to the one crawled Vehicle its open-data facts describe', async () => {
        const { vehicle } = await createCrawledVehicle(
          'f30-320d-crawled',
          '320 d (F30, F31) Gearbox code: ZF 8HP45Z/50Z Automatic gearbox',
          'mann:320d',
        );

        const response = await lookUp('WBA8C51070N000001');

        expect(response.data).toEqual({
          resolved: true,
          facts: { steering: 'left' },
          vehicle: expect.objectContaining({ id: vehicle.id }),
        });
      });

      it('names the Model when its several Vehicles all fit the type code', async () => {
        const options = { chassisCode: 'F30/F31/F34', powerKw: 85 };
        const first = await createCrawledVehicle(
          'f30-316d-crawled',
          '316 d (F30, F31)',
          'mann:316d-a',
          { ...options, engineCode: 'B47D20A' },
        );
        const second = await createCrawledVehicle(
          'f30-316d-crawled',
          '316 d (F30, F31)',
          'mann:316d-b',
          { ...options, engineCode: 'B47D20B' },
        );

        const response = await lookUp('WBA3W31070N000001');

        expect(response.data).toEqual({
          resolved: false,
          make: 'bmw',
          code: '3W31',
          model_slug: 'f30-316d-crawled',
          vehicle_ids: expect.arrayContaining([
            first.vehicle.id,
            second.vehicle.id,
          ]),
        });
        expect(response.data.vehicle_ids).toHaveLength(2);
      });

      it('prefers the Vehicle staff linked the type code to over the open-data match', async () => {
        await createCrawledVehicle(
          'f31-318d-crawled',
          '318 d (F30, F31)',
          'mann:318d',
          { chassisCode: 'F31', powerKw: 110 },
        );
        const { vehicle } = await createVehicleFixture(catalog, {
          typeCode: '8H71',
          modelSlug: 'f31-318d-staff',
          chassisCode: 'F31',
        });

        const response = await lookUp('WBA8H71070N000001');

        expect(response.data).toMatchObject({
          resolved: true,
          vehicle: { id: vehicle.id },
        });
      });

      it('leaves a type code staff linked to several Vehicles for the customer to choose', async () => {
        const first = await createVehicleFixture(catalog, {
          typeCode: '35BG',
          modelSlug: 'g20-320d-staff',
          chassisCode: 'G20',
        });
        const second = await createVehicleFixture(catalog, {
          typeCode: '35BG',
          modelSlug: 'g21-320d-staff',
          chassisCode: 'G21',
        });

        const response = await lookUp('WBA35BG070N074158');

        expect(response.data).toMatchObject({
          resolved: false,
          code: '35BG',
          model_slug: null,
        });
        expect([...response.data.vehicle_ids].sort()).toEqual(
          [first.vehicle.id, second.vehicle.id].sort(),
        );
      });
    });
  },
});
