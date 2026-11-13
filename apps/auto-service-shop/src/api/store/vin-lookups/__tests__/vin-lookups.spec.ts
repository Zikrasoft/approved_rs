import { asValue } from '@medusajs/framework/awilix';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import type { IApiKeyModuleService } from '@medusajs/framework/types';
import { VIN_REFUSAL } from '@podbor/catalog-contract';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import {
  loggedEvents,
  watchEvents,
} from '../../../../../integration-tests/loggedEvents';
import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import { PUBLISH_MODULE } from '../../../../modules/publish';
import type PublishModuleService from '../../../../modules/publish/service';
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
          place: null,
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
          decoder_version: 2,
          make_key: 'BMW',
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

      describe('the vin.lookup event', () => {
        watchEvents();

        it('logs a resolved VIN by its maker prefix and a hash, never in full', async () => {
          await createVehicleFixture(catalog);

          await lookUp(OWNER_VIN);

          const [logged] = loggedEvents('vin.lookup');
          expect(logged).toEqual({
            event: 'vin.lookup',
            at: expect.any(String),
            request_id: expect.any(String),
            outcome: 'resolved',
            reason: null,
            make: 'bmw',
            code: null,
            wmi: 'WBA',
            vin: expect.stringMatching(/^[0-9a-f]{12}$/),
            candidates: 1,
          });
          expect(JSON.stringify(loggedEvents())).not.toContain(OWNER_VIN);
        });

        it('says why a VIN stayed unresolved', async () => {
          await lookUp('WBA99ZZ070N000002');
          await lookUp('1HGCM82633A004352');

          expect(
            loggedEvents('vin.lookup').map(
              ({ outcome, reason, make, code, wmi, candidates }) => ({
                outcome,
                reason,
                make,
                code,
                wmi,
                candidates,
              }),
            ),
          ).toEqual([
            {
              outcome: 'unresolved',
              reason: 'no_vehicle',
              make: 'bmw',
              code: '99ZZ',
              wmi: 'WBA',
              candidates: 0,
            },
            {
              outcome: 'unresolved',
              reason: 'not_decoded',
              make: null,
              code: null,
              wmi: '1HG',
              candidates: 0,
            },
          ]);
        });
      });

      it('names the Series page of the resolved car once it has one', async () => {
        const owner =
          (await catalog.listVehicles({}, { take: 1 }))[0] ??
          (await createVehicleFixture(catalog)).vehicle;
        const { vehicle: sibling } = await createVehicleFixture(catalog, {
          typeCode: '35BH',
        });
        const [febi] = await catalog.createBrands([
          { name: 'Febi', slug: 'febi' },
        ]);
        for (const vehicleId of [owner.id, sibling.id]) {
          for (const value of ['1', '2', '3']) {
            const partId = await catalog.createPartWithIdentifiers({
              name: 'Фильтр',
              identifiers: [
                {
                  type: 'manufacturer-number',
                  brand_id: febi.id,
                  value: `${vehicleId}-${value}`,
                },
              ],
            });
            await catalog.createFitments({
              part_id: partId,
              vehicle_id: vehicleId,
            });
          }
        }
        await getContainer()
          .resolve<PublishModuleService>(PUBLISH_MODULE)
          .publishAll();
        await getContainer().resolve(Modules.SEARCH).reindex();

        expect((await lookUp(OWNER_VIN)).data.place).toMatchObject({
          kind: 'series',
          series: { name: '3 серия' },
        });
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

      it('records an unknown type code as unresolved, places it on its Make, and resolves it once staff add the Vehicle', async () => {
        const vin = 'WBA99ZZ070N000002';

        const before = await lookUp(vin);
        expect(before.data).toEqual({
          resolved: false,
          place: {
            kind: 'make',
            make: { slug: 'bmw', name: 'BMW' },
            series: null,
            model: null,
            vehicle: null,
          },
          make: 'bmw',
          code: '99ZZ',
          model_slug: null,
          vehicle_ids: [],
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
          place: null,
          make: null,
          code: null,
          model_slug: null,
          vehicle_ids: [],
        });
        expect(
          await vinLookups.listVinLookups({ vin: '1HGCM82633A004352' }),
        ).toEqual([]);
      });

      it('records one lookup for the same VIN sent twice at once', async () => {
        const vin = 'WBA77EE070N000030';

        const answers = await Promise.all([lookUp(vin), lookUp(vin)]);

        expect(answers.map(({ status }) => status)).toEqual([200, 200]);
        expect(await vinLookups.listVinLookups({ vin })).toHaveLength(1);
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
          make_key: 'BMW',
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
          decoder_version: 2,
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

        expect(response.data.codes.slice(0, 2)).toMatchObject([
          { make: 'bmw', code: '22BB', count: 2 },
          { make: 'bmw', code: '11AA', count: 1 },
        ]);
      });

      it('records a storefront lookup with what the site knows of its visitor', async () => {
        const vin = 'WBA5M11070N000040';

        await api.post(
          '/store/vin-lookups',
          {
            vin,
            bot: true,
            visitor_id: '1c9b5a6f-7d2e-4f3a-8b4c-8d9e0f1a2b3c',
          },
          storeHeaders,
        );
        await api.post(
          '/store/vin-lookups',
          { vin, visitor_id: 'not-an-id' },
          storeHeaders,
        );

        const [{ id }] = await vinLookups.listVinLookups({ vin });
        const hits = await vinLookups.listVinLookupHits(
          { vin_lookup_id: id },
          { order: { created_at: 'ASC' } },
        );
        expect(
          hits.map(({ source, bot, visitor_id }) => ({
            source,
            bot,
            visitor_id,
          })),
        ).toEqual([
          {
            source: 'storefront',
            bot: true,
            visitor_id: '1c9b5a6f-7d2e-4f3a-8b4c-8d9e0f1a2b3c',
          },
          { source: 'storefront', bot: null, visitor_id: null },
        ]);
      });

      it('lists only codes real customers searched unless staff ask for all', async () => {
        const staff = '0b8a4f5e-6c1d-4e2f-9a3b-7c8d9e0f1a2b';
        process.env.STAFF_VISITOR_IDS = staff;
        await api.post(
          '/store/vin-lookups',
          { vin: 'WBA6N22070N000041', visitor_id: staff },
          storeHeaders,
        );
        await api.post(
          '/store/vin-lookups',
          { vin: 'WBA6N23070N000042', bot: true },
          storeHeaders,
        );

        const codesOf = async (query: string) =>
          (
            await api.get(`/admin/vin-lookups/unresolved${query}`, adminHeaders)
          ).data.codes.map(({ code }: { code: string }) => code);

        try {
          expect(await codesOf('')).not.toEqual(
            expect.arrayContaining(['6N22']),
          );
          expect(await codesOf('')).not.toEqual(
            expect.arrayContaining(['6N23']),
          );
          expect(await codesOf('?all=true')).toEqual(
            expect.arrayContaining(['6N22', '6N23']),
          );
        } finally {
          delete process.env.STAFF_VISITOR_IDS;
        }
      });

      it('pages the unresolved codes and counts them all', async () => {
        await lookUp('WBA44CC070N000013');
        await lookUp('WBA45CD070N000014');
        await lookUp('WBA46CE070N000015');
        const { codes: all } = (
          await api.get('/admin/vin-lookups/unresolved', adminHeaders)
        ).data;

        const { data } = await api.get(
          '/admin/vin-lookups/unresolved?offset=1&limit=1',
          adminHeaders,
        );

        expect(data).toMatchObject({
          codes: [all[1]],
          count: all.length,
          offset: 1,
          limit: 1,
        });
        expect(
          (
            await api
              .get('/admin/vin-lookups/unresolved?limit=0', adminHeaders)
              .catch((error) => error.response)
          ).status,
        ).toBe(400);
      });

      it('says when an unresolved code was last searched and what the open data calls it', async () => {
        const before = Date.now();
        await api.post(
          '/store/vin-lookups',
          {
            vin: 'WBA3K11070N000020',
            visitor_id: '5a6b7c8d-1e2f-4a3b-8c4d-5e6f7a8b9c0d',
          },
          storeHeaders,
        );
        await lookUp('WBA22BB070N000021');

        const { codes } = (
          await api.get('/admin/vin-lookups/unresolved', adminHeaders)
        ).data;

        const entry = codes.find(
          ({ code }: { code: string }) => code === '3K11',
        );
        expect(entry).toEqual({
          make_key: 'BMW',
          make: 'bmw',
          code: '3K11',
          count: 1,
          customers: 1,
          visitors: ['5a6b7c8d'],
          sources: { storefront: 1, 'workshop-quote': 0, admin: 0 },
          last_seen: expect.any(String),
          reference: {
            code: '3K11',
            chassis: 'F31',
            model: '318d',
            body: 'Touring',
            engine: 'N47D20U1',
            power_kw: 105,
            drivetrain: 'rwd',
            steering: 'left',
            from: null,
            to: null,
          },
        });
        expect(Date.parse(entry.last_seen)).toBeGreaterThanOrEqual(
          before - 1000,
        );
        expect(
          codes.find(({ code }: { code: string }) => code === '22BB'),
        ).toMatchObject({ reference: null });
      });

      it('links an unresolved code to the Vehicles staff choose', async () => {
        const vin = 'WBA55EE070N000016';
        await lookUp(vin);
        const crawled = (supplierId: string, modelSlug: string) =>
          createVehicleFixture(catalog, {
            identifierType: 'supplier-vehicle-id',
            typeCode: supplierId,
            modelSlug,
            chassisCode: 'G20',
          });
        const first = await crawled('mann:g20-a', 'g20-320d-link');
        const second = await crawled('mann:g20-b', 'g20-320d-xdrive-link');

        const linked = await api.post(
          '/admin/vin-lookups/unresolved/bmw/55EE',
          { vehicle_ids: [first.vehicle.id, second.vehicle.id] },
          adminHeaders,
        );

        expect(linked.data).toEqual({ make: 'bmw', code: '55EE', linked: 2 });
        const after = await lookUp(vin);
        expect(after.data).toMatchObject({ resolved: false, code: '55EE' });
        expect([...after.data.vehicle_ids].sort()).toEqual(
          [first.vehicle.id, second.vehicle.id].sort(),
        );
        expect(
          (await api.get('/admin/vin-lookups/unresolved', adminHeaders)).data
            .codes,
        ).not.toContainEqual(expect.objectContaining({ code: '55EE' }));
      });

      it('refuses to link a code to a Vehicle of another Make', async () => {
        const { vehicle } = await createVehicleFixture(catalog, {
          make: { slug: 'mercedes-benz', name: 'Mercedes-Benz' },
          identifierType: 'mercedes-baumuster',
          typeCode: '205004',
          modelSlug: 'w205-link',
          chassisCode: 'W205',
        });

        const response = await api
          .post(
            '/admin/vin-lookups/unresolved/bmw/66FF',
            { vehicle_ids: [vehicle.id] },
            adminHeaders,
          )
          .catch((error) => error.response);

        expect(response.status).toBe(400);
        expect(
          await catalog.listVehicleIdentifiers({ value: '66FF' }),
        ).toHaveLength(0);
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
        for (const vin of ['TOO-SHORT', 'ЖЖЖ123', '12345678901234567', ' ']) {
          const response = await api
            .post('/store/vin-lookups', { vin }, storeHeaders)
            .catch((error) => error.response);

          expect(response.status).toBe(400);
          expect(response.data.message).toContain(VIN_REFUSAL);
          expect(response.data.message).not.toContain('Expected type');
        }
      });
    });
  },
});
