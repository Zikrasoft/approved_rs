import { asValue } from '@medusajs/framework/awilix';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import { bmwTypeCodeDecoder } from '../../../../lib/vin/bmw-type-code';
import { VIN_DECODERS_REGISTRATION } from '../../../../lib/vin/chain';
import type { VinDecoder } from '../../../../lib/vin/decoder';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { VIN_LOOKUP_MODULE } from '../../../../modules/vin-lookup';
import type VinLookupModuleService from '../../../../modules/vin-lookup/service';

const OWNER_VIN = 'WBA35BG070N074158';
const PAID_ONLY_VIN = 'WBA77XX070N000001';

const paidDecoder: VinDecoder = {
  name: 'fake-paid',
  version: 3,
  async decode(vin) {
    if (vin !== PAID_ONLY_VIN) return null;
    return {
      make: 'bmw',
      identifiers: [{ type: 'bmw-type-code', value: '8X11' }],
      facts: { steering: 'right' },
      raw: { answer: 'from the fake paid decoder' },
    };
  },
};

medusaIntegrationTestRunner({
  moduleName: 'vin_lookup',
  hooks: {
    beforeServerStart: async (container) => {
      container.register(
        VIN_DECODERS_REGISTRATION,
        asValue([bmwTypeCodeDecoder, paidDecoder]),
      );
    },
  },
  testSuite: ({ api, getContainer }) => {
    describe('VIN lookup', () => {
      let storeHeaders: { headers: { 'x-publishable-api-key': string } };
      let adminHeaders: { headers: { authorization: string } };
      let catalog: CatalogModuleService;
      let vinLookups: VinLookupModuleService;

      const lookUp = (vin: string) =>
        api.post('/store/vin-lookups', { vin }, storeHeaders);

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
        adminHeaders = await createAdminAuth(
          getContainer(),
          api,
          'admin@vin-lookup-tests.local',
          'supersecret',
        );
        catalog = getContainer().resolve(CATALOG_MODULE);
        vinLookups = getContainer().resolve(VIN_LOOKUP_MODULE);
      });

      it("resolves the owner's VIN to the Vehicle holding its BMW type code", async () => {
        const { vehicle } = await createVehicleFixture(catalog);

        const response = await lookUp(OWNER_VIN);

        expect(response.data).toEqual({
          resolved: true,
          facts: {},
          vehicle: expect.objectContaining({
            id: vehicle.id,
            steering: 'left',
            identifiers: [{ type: 'bmw-type-code', value: '35BG' }],
            engine: expect.objectContaining({ code: 'B47D20O0' }),
            model: expect.objectContaining({
              slug: 'f30-320d',
              chassis: expect.objectContaining({
                code: 'F30',
                series: expect.objectContaining({
                  make: { slug: 'bmw', name: 'BMW' },
                }),
              }),
            }),
          }),
        });
        const [stored] = await vinLookups.listVinLookups({ vin: OWNER_VIN });
        expect(stored).toMatchObject({
          decoder: 'bmw-type-code',
          decoder_version: 1,
          make: 'bmw',
          code: '35BG',
          vehicle_id: vehicle.id,
          raw: { wmi: 'WBA', typeCode: '35BG' },
        });

        const again = await lookUp(OWNER_VIN);
        expect(again.data).toEqual(response.data);
        expect(
          await vinLookups.listVinLookups({ vin: OWNER_VIN }),
        ).toHaveLength(1);
      });

      it('lets the next decoder in the chain answer when the own adapter is unresolved', async () => {
        const { vehicle } = await createVehicleFixture(catalog, {
          typeCode: '8X11',
        });

        const response = await lookUp(PAID_ONLY_VIN);

        expect(response.data).toMatchObject({
          resolved: true,
          vehicle: { id: vehicle.id },
          facts: { steering: 'right' },
        });
        const [stored] = await vinLookups.listVinLookups({
          vin: PAID_ONLY_VIN,
        });
        expect(stored).toMatchObject({
          decoder: 'fake-paid',
          decoder_version: 3,
          vehicle_id: vehicle.id,
        });
      });

      it('records an unknown type code as unresolved and resolves it once staff add the Vehicle', async () => {
        const vin = 'WBA99ZZ070N000002';

        const before = await lookUp(vin);
        expect(before.data).toEqual({
          resolved: false,
          make: 'bmw',
          code: '99ZZ',
        });

        const { vehicle } = await createVehicleFixture(catalog, {
          typeCode: '99ZZ',
        });
        const after = await lookUp(vin);

        expect(after.data).toMatchObject({
          resolved: true,
          vehicle: { id: vehicle.id },
        });
        expect(await vinLookups.listVinLookups({ vin })).toHaveLength(1);
      });

      it('leaves a VIN no decoder recognises unresolved without a make', async () => {
        const response = await lookUp('1HGCM82633A004352');

        expect(response.data).toEqual({
          resolved: false,
          make: null,
          code: null,
        });
      });

      it('resolves again a lookup recorded by an older decoder version', async () => {
        const stale = await createVehicleFixture(catalog, {
          typeCode: 'OLD1',
        });
        const { vehicle } = await createVehicleFixture(catalog, {
          typeCode: '7A55',
        });
        const vin = 'WBA7A55070N000003';
        await vinLookups.createVinLookups({
          vin,
          decoder: 'bmw-type-code',
          decoder_version: 0,
          facts: {},
          make: 'bmw',
          code: 'OLD1',
          vehicle_id: stale.vehicle.id,
        });

        const response = await lookUp(vin);

        expect(response.data).toMatchObject({
          resolved: true,
          vehicle: { id: vehicle.id },
        });
        const [stored] = await vinLookups.listVinLookups({ vin });
        expect(stored).toMatchObject({
          decoder_version: 1,
          code: '7A55',
          vehicle_id: vehicle.id,
        });
      });

      it('lists unresolved codes per Make, most searched first', async () => {
        await lookUp('WBA11AA070N000010');
        await lookUp('WBA22BB070N000011');
        await lookUp('WBA22BB070N000012');

        const response = await api.get(
          '/admin/vin-lookups/unresolved',
          adminHeaders,
        );

        expect(response.data.codes.slice(0, 2)).toEqual([
          { make: 'bmw', code: '22BB', count: 2 },
          { make: 'bmw', code: '11AA', count: 1 },
        ]);
      });

      it('drops a code from the unresolved list once staff add it to a Vehicle', async () => {
        await lookUp('WBA33CC070N000013');
        await createVehicleFixture(catalog, { typeCode: '33CC' });

        const response = await api.get(
          '/admin/vin-lookups/unresolved',
          adminHeaders,
        );

        expect(response.data.codes).not.toContainEqual(
          expect.objectContaining({ code: '33CC' }),
        );
      });

      it('dismisses an unresolved code of one Make', async () => {
        await lookUp('WBA44DD070N000014');
        await lookUp('WBA44DD070N000015');

        const dismissed = await api.delete(
          '/admin/vin-lookups/unresolved/bmw/44DD',
          adminHeaders,
        );

        expect(dismissed.data).toEqual({
          make: 'bmw',
          code: '44DD',
          deleted: 2,
        });
        expect(
          (await api.get('/admin/vin-lookups/unresolved', adminHeaders)).data
            .codes,
        ).not.toContainEqual(expect.objectContaining({ code: '44DD' }));
        expect(await vinLookups.listVinLookups({ code: '44DD' })).toHaveLength(
          0,
        );
      });

      it('returns a 400 for a VIN that is not 17 structurally valid characters', async () => {
        const response = await api
          .post('/store/vin-lookups', { vin: 'TOO-SHORT' }, storeHeaders)
          .catch((error) => error.response);

        expect(response.status).toBe(400);
      });
    });
  },
});
