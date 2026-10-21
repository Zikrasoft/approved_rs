import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { VIN_LOOKUP_MODULE } from '../../../../modules/vin-lookup';
import type VinLookupModuleService from '../../../../modules/vin-lookup/service';

const MERCEDES = { slug: 'mercedes-benz', name: 'Mercedes-Benz' };

medusaIntegrationTestRunner({
  moduleName: 'vin_lookup_mercedes',
  testSuite: ({ api, getContainer }) => {
    describe('Mercedes VIN lookup', () => {
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };
      let catalog: CatalogModuleService;
      let vinLookups: VinLookupModuleService;

      const lookUp = (vin: string) =>
        api.post('/store/vin-lookups', { vin }, storeHeaders);

      const createBaumusterVehicle = (baumuster: string) =>
        createVehicleFixture(catalog, {
          make: MERCEDES,
          identifierType: 'mercedes-baumuster',
          steering: null,
          typeCode: baumuster,
          modelSlug: `w205-${baumuster}`,
          chassisCode: 'W205',
          engineCode: 'OM651921',
          engineFamily: 'OM651',
        });

      beforeAll(async () => {
        const apiKeyModuleService: IApiKeyModuleService =
          getContainer().resolve(Modules.API_KEY);
        const publishableKey = await apiKeyModuleService.createApiKeys({
          title: 'mercedes-vin-tests',
          type: 'publishable',
          created_by: 'test',
        });
        storeHeaders = {
          headers: { 'x-publishable-api-key': publishableKey.token },
        };
        catalog = getContainer().resolve(CATALOG_MODULE);
        vinLookups = getContainer().resolve(VIN_LOOKUP_MODULE);
      });

      it('resolves a left-hand Baumuster VIN and reports left steering', async () => {
        const { vehicle } = await createBaumusterVehicle('205004');

        const response = await lookUp('WDD2050041R316333');

        expect(response.data).toEqual({
          resolved: true,
          facts: { steering: 'left' },
          vehicle: expect.objectContaining({
            id: vehicle.id,
            steering: null,
            identifiers: [{ type: 'mercedes-baumuster', value: '205004' }],
          }),
        });
        const [stored] = await vinLookups.listVinLookups({
          vin: 'WDD2050041R316333',
        });
        expect(stored).toMatchObject({
          decoder: 'mercedes-baumuster',
          decoder_version: 1,
          make: 'mercedes-benz',
          code: '205004',
          facts: { steering: 'left' },
          vehicle_id: vehicle.id,
        });
      });

      it('resolves a right-hand Baumuster VIN and reports right steering', async () => {
        const { vehicle } = await createBaumusterVehicle('205014');

        const response = await lookUp('W1K2050142R000001');

        expect(response.data).toMatchObject({
          resolved: true,
          facts: { steering: 'right' },
          vehicle: { id: vehicle.id },
        });
      });

      it('removes the left-hand candidate for a right-hand VIN', async () => {
        const { vehicle } = await createBaumusterVehicle('205024');
        const category = await catalog.createCategories({
          slug: 'wiper-blades',
          name: 'Щетки стеклоочистителя',
        });
        const [lhd, rhd] = await catalog.createParts([
          { name: 'Wiper set, left-hand drive', category_id: category.id },
          { name: 'Wiper set, right-hand drive', category_id: category.id },
        ]);
        await catalog.createFitments([
          { part_id: lhd.id, vehicle_id: vehicle.id, steering: 'left' },
          { part_id: rhd.id, vehicle_id: vehicle.id, steering: 'right' },
        ]);
        const partsFor = async (query: string) =>
          (
            await api.get(
              `/store/vehicles/${vehicle.id}/parts${query}`,
              storeHeaders,
            )
          ).data.groups;

        const lookup = await lookUp('W1K2050242R000002');
        const [before] = await partsFor('');
        const [after] = await partsFor(
          `?steering=${lookup.data.facts.steering}`,
        );

        expect(lookup.data.facts).toEqual({ steering: 'right' });
        expect(before.ambiguous).toBe(true);
        expect(after.ambiguous).toBe(false);
        expect(
          after.fitments.map(({ part }: { part: { id: string } }) => part.id),
        ).toEqual([rhd.id]);
      });

      it.each(['WDB', 'WDD', 'WDC', 'W1K', 'W1N'])(
        'routes the %s WMI to the Mercedes adapter',
        async (wmi) => {
          const response = await lookUp(`${wmi}9990011R000001`);

          expect(response.data).toEqual({
            resolved: false,
            make: 'mercedes-benz',
            code: '999001',
          });
        },
      );

      it('leaves a 2023+ VIN without a Baumuster unresolved', async () => {
        const response = await lookUp('W1K3G1CB9PJ403934');

        expect(response.data).toEqual({
          resolved: false,
          make: null,
          code: null,
        });
      });
    });
  },
});
