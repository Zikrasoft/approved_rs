import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import type { VehicleIdentifierType } from '@podbor/catalog-contract';

import { createVehicleFixture } from '../../../../integration-tests/vehicleFixture';
import { CATALOG_MODULE } from '../../catalog';
import type CatalogModuleService from '../../catalog/service';
import { VIN_LOOKUP_MODULE } from '..';
import type VinLookupModuleService from '../service';

const SITE = { source: 'storefront', bot: false, visitor_id: null } as const;
const QUOTE = { source: 'workshop-quote' } as const;
const STAFF_VISITOR = '0b8a4f5e-6c1d-4e2f-9a3b-7c8d9e0f1a2b';
const CUSTOMER_VISITOR = '1c9b5a6f-7d2e-4f3a-8b4c-8d9e0f1a2b3c';

const lookup = (
  vin: string,
  make: string,
  code: string,
  codeType: VehicleIdentifierType,
) => ({
  vin,
  decoder: 'test',
  decoder_version: 1,
  raw: null,
  facts: {},
  make,
  code,
  code_type: codeType,
  vehicle_id: null,
});

medusaIntegrationTestRunner({
  moduleName: 'vin_lookup_module',
  testSuite: ({ getContainer }) => {
    describe('The VIN lookup module', () => {
      let catalog: CatalogModuleService;
      let vinLookups: VinLookupModuleService;

      beforeAll(() => {
        catalog = getContainer().resolve(CATALOG_MODULE);
        vinLookups = getContainer().resolve(VIN_LOOKUP_MODULE);
      });

      it('keeps one lookup per VIN however often it is saved', async () => {
        const vin = 'WBAAB12070N000001';

        await vinLookups.saveLookup(
          lookup(vin, 'bmw', 'AB12', 'bmw-type-code'),
          SITE,
        );
        await vinLookups.saveLookup(
          lookup(vin, 'bmw', 'AB13', 'bmw-type-code'),
          QUOTE,
        );

        expect(await vinLookups.listVinLookups({ vin })).toEqual([
          expect.objectContaining({ code: 'AB13', wmi: 'WBA' }),
        ]);
      });

      it('records the source of every lookup of a VIN, with no person behind it', async () => {
        const vin = 'WBAAB14070N000004';

        await vinLookups.saveLookup(
          lookup(vin, 'bmw', 'AB14', 'bmw-type-code'),
          { source: 'storefront', bot: true, visitor_id: CUSTOMER_VISITOR },
        );
        await vinLookups.saveLookup(
          lookup(vin, 'bmw', 'AB14', 'bmw-type-code'),
          QUOTE,
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
          { source: 'storefront', bot: true, visitor_id: CUSTOMER_VISITOR },
          { source: 'workshop-quote', bot: null, visitor_id: null },
        ]);
      });

      it('counts each unresolved code per source and only real customers as customers', async () => {
        const save = (
          vin: string,
          origin: Parameters<VinLookupModuleService['saveLookup']>[1],
        ) =>
          vinLookups.saveLookup(
            lookup(vin, 'bmw', 'EF56', 'bmw-type-code'),
            origin,
          );
        await save('WBAEF56070N000005', SITE);
        await save('WBAEF56070N000005', {
          source: 'storefront',
          bot: null,
          visitor_id: CUSTOMER_VISITOR,
        });
        await save('WBAEF56070N000006', {
          source: 'storefront',
          bot: true,
          visitor_id: null,
        });
        await save('WBAEF56070N000007', {
          source: 'storefront',
          bot: false,
          visitor_id: STAFF_VISITOR,
        });
        await save('WBAEF56070N000008', QUOTE);
        await save('WBAEF56070N000009', { source: 'admin' });

        const { codes } = await vinLookups.unresolvedCodes({
          offset: 0,
          limit: 50,
          all: false,
          staffVisitorIds: [STAFF_VISITOR],
        });

        expect(codes.find(({ code }) => code === 'EF56')).toEqual({
          make: 'bmw',
          code: 'EF56',
          count: 6,
          customers: 2,
          visitors: [CUSTOMER_VISITOR.slice(0, 8)],
          sources: { storefront: 4, 'workshop-quote': 1, admin: 1 },
          last_seen: expect.any(Date),
        });
      });

      it('hides a code no real customer searched until staff ask for every code', async () => {
        await vinLookups.saveLookup(
          lookup('WBAGH78070N000010', 'bmw', 'GH78', 'bmw-type-code'),
          QUOTE,
        );
        await vinLookups.saveLookup(
          lookup('WBAGH78070N000011', 'bmw', 'GH78', 'bmw-type-code'),
          { source: 'storefront', bot: false, visitor_id: STAFF_VISITOR },
        );
        await vinLookups.saveLookup(
          lookup('WBAGH79070N000012', 'bmw', 'GH79', 'bmw-type-code'),
          { source: 'storefront', bot: true, visitor_id: null },
        );
        const page = (all: boolean) =>
          vinLookups.unresolvedCodes({
            offset: 0,
            limit: 50,
            all,
            staffVisitorIds: [STAFF_VISITOR],
          });

        const customersOnly = (await page(false)).codes.map(({ code }) => code);
        const every = (await page(true)).codes.map(({ code }) => code);

        expect(customersOnly).not.toContain('GH78');
        expect(customersOnly).not.toContain('GH79');
        expect(every).toEqual(expect.arrayContaining(['GH78', 'GH79']));
      });

      it('forgets the lookups of a VIN together with the VIN', async () => {
        const vin = 'WBAJK90070N000013';
        await vinLookups.saveLookup(
          lookup(vin, 'bmw', 'JK90', 'bmw-type-code'),
          SITE,
        );
        const [{ id }] = await vinLookups.listVinLookups({ vin });

        await vinLookups.deleteVinLookups([id]);

        expect(
          await vinLookups.listVinLookupHits({ vin_lookup_id: id }),
        ).toEqual([]);
      });

      it('drops a code from the unresolved list only once a Vehicle has it under its own type', async () => {
        await createVehicleFixture(catalog, { typeCode: 'CD34' });
        await vinLookups.saveLookup(
          lookup('WBACD34070N000002', 'bmw', 'CD34', 'bmw-type-code'),
          SITE,
        );
        await vinLookups.saveLookup(
          lookup(
            'WDDCD34070N000003',
            'mercedes-benz',
            'CD34',
            'mercedes-baumuster',
          ),
          SITE,
        );

        const { codes } = await vinLookups.unresolvedCodes({
          offset: 0,
          limit: 50,
          all: true,
          staffVisitorIds: [],
        });

        expect(
          codes.filter(({ code }) => code === 'CD34').map(({ make }) => make),
        ).toEqual(['mercedes-benz']);
      });
    });
  },
});
