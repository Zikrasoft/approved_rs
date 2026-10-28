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
          decoder_version: 2,
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

      const createCrawledVehicle = (
        modelSlug: string,
        modelName: string,
        supplierId: string,
        make = MERCEDES,
      ) =>
        createVehicleFixture(catalog, {
          make,
          identifierType: 'supplier-vehicle-id',
          steering: null,
          typeCode: supplierId,
          modelSlug,
          modelName,
          chassisCode: modelSlug,
          engineCode: `M-${supplierId}`,
          engineFamily: 'M274',
        });

      it('resolves a Baumuster VIN to the one crawled Vehicle whose Model lists it', async () => {
        const { vehicle } = await createCrawledVehicle(
          'e-300-212',
          'E 300 (212.054/254) Sistem: AIRMATIC',
          'filtron:e300',
        );

        const response = await lookUp('WDD2122541A000001');

        expect(response.data).toEqual({
          resolved: true,
          facts: { steering: 'left' },
          vehicle: expect.objectContaining({ id: vehicle.id }),
        });
        const [stored] = await vinLookups.listVinLookups({
          vin: 'WDD2122541A000001',
        });
        expect(stored).toMatchObject({ vehicle_id: vehicle.id });
      });

      it('stops resolving to a crawled Vehicle once a second one lists its Baumuster', async () => {
        const first = await createCrawledVehicle(
          'e-220-213',
          'E 220 d (213.004)',
          'filtron:e220-a',
        );
        await lookUp('WDD2130041A000001');
        const second = await createCrawledVehicle(
          'e-220-213',
          'E 220 d (213.004)',
          'filtron:e220-b',
        );

        const response = await lookUp('WDD2130041A000001');

        expect(response.data).toMatchObject({
          resolved: false,
          model_slug: 'e-220-213',
        });
        expect([...response.data.vehicle_ids].sort()).toEqual(
          [first.vehicle.id, second.vehicle.id].sort(),
        );
      });

      it('names the Model when several crawled Vehicles of one Model list the Baumuster', async () => {
        const first = await createCrawledVehicle(
          'g-63-amg-463',
          'G 63 AMG (W463.272/273)',
          'mann:g63-a',
        );
        const second = await createCrawledVehicle(
          'g-63-amg-463',
          'G 63 AMG (W463.272/273)',
          'mann:g63-b',
        );

        const response = await lookUp('WDB4632731X000001');

        expect(response.data).toEqual({
          resolved: false,
          make: 'mercedes-benz',
          code: '463273',
          model_slug: 'g-63-amg-463',
          vehicle_ids: expect.arrayContaining([
            first.vehicle.id,
            second.vehicle.id,
          ]),
        });
        expect(response.data.vehicle_ids).toHaveLength(2);
      });

      it('names no Model when the crawled Vehicles listing the Baumuster span Models', async () => {
        const first = await createCrawledVehicle(
          's-400-222',
          'S 400 (W222.067/165/167) Sistem: AIRMATIC',
          'filtron:s400',
        );
        const second = await createCrawledVehicle(
          's-400-4matic-222',
          'S 400 4MATIC (W222.167)',
          'mann:s400',
        );
        await createCrawledVehicle(
          'not-mercedes',
          'Lookalike (222.167)',
          'mann:other',
          { slug: 'other-make', name: 'Other' },
        );
        await createCrawledVehicle(
          's-350-222',
          'S 350 (W222.067/165) Engine Code: OM 222.167',
          'mann:s350',
        );

        const response = await lookUp('WDD2221671A000001');

        expect(response.data).toMatchObject({
          resolved: false,
          model_slug: null,
        });
        expect([...response.data.vehicle_ids].sort()).toEqual(
          [first.vehicle.id, second.vehicle.id].sort(),
        );
      });

      it('prefers a hand-entered Baumuster over a crawled Model that lists it', async () => {
        await createCrawledVehicle(
          'c-200-204',
          'C 200 CGI (204.048/248)',
          'mann:c200',
        );
        const { vehicle } = await createBaumusterVehicle('204248');

        const response = await lookUp('WDD2042481A000001');

        expect(response.data).toMatchObject({
          resolved: true,
          vehicle: { id: vehicle.id },
        });
      });

      it.each(['WDB', 'WDD', 'WDC', 'W1K', 'W1N'])(
        'routes the %s WMI to the Mercedes adapter',
        async (wmi) => {
          const response = await lookUp(`${wmi}9990011R000001`);

          expect(response.data).toEqual({
            resolved: false,
            make: 'mercedes-benz',
            code: '999001',
            model_slug: null,
            vehicle_ids: [],
          });
        },
      );

      it('leaves a 2023+ VIN without a Baumuster unresolved with its code on the Mercedes list', async () => {
        const response = await lookUp('W1K3G1CB9PJ403934');

        expect(response.data).toEqual({
          resolved: false,
          make: 'mercedes-benz',
          code: '3G1CB',
          model_slug: null,
          vehicle_ids: [],
        });
        const [stored] = await vinLookups.listVinLookups({
          vin: 'W1K3G1CB9PJ403934',
        });
        expect(stored).toMatchObject({
          decoder: 'mercedes-baumuster',
          make: 'mercedes-benz',
          code: '3G1CB',
          facts: {},
          vehicle_id: null,
        });
      });
    });
  },
});
