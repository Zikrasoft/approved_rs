import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { VIN_LOOKUP_MODULE } from '../../modules/vin-lookup';
import type VinLookupModuleService from '../../modules/vin-lookup/service';
import scrubVinLookups, {
  scrubVinLookupsAt,
  VIN_KEPT_FOR_DAYS,
} from '../scrub-vin-lookups';

const DAY_MS = 86_400_000;
const VISITOR = '1c9b5a6f-7d2e-4f3a-8b4c-8d9e0f1a2b3c';
const SITE = { source: 'storefront', bot: false, visitor_id: VISITOR } as const;

const lookup = (vin: string) => ({
  vin,
  decoder: 'test',
  decoder_version: 1,
  raw: { decoded: vin },
  facts: { model_year: 2018 },
  make_key: 'BMW',
  code: 'AB12',
  code_type: 'bmw-type-code' as const,
  vehicle_id: 'vehicle_1',
});

medusaIntegrationTestRunner({
  moduleName: 'scrub-vin-lookups',
  dbName: 'medusa-scrub-vin-lookups-integration',
  testSuite: ({ getContainer }) => {
    describe('the VIN retention sweep', () => {
      let vinLookups: VinLookupModuleService;
      const backdate = (vin: string, days: number) =>
        getContainer()
          .resolve(ContainerRegistrationKeys.PG_CONNECTION)('vin_lookup')
          .where({ vin })
          .update({ updated_at: new Date(Date.now() - days * DAY_MS) });

      beforeAll(() => {
        vinLookups = getContainer().resolve(VIN_LOOKUP_MODULE);
      });

      it('forgets the VIN and the raw decode once the lookup is older than the retention, keeping what counts codes', async () => {
        await vinLookups.saveLookup(lookup('WBAAB12070N000001'), SITE);
        await backdate('WBAAB12070N000001', VIN_KEPT_FOR_DAYS + 1);
        const [old] = await vinLookups.listVinLookups({
          vin: 'WBAAB12070N000001',
        });

        expect(await scrubVinLookupsAt(getContainer(), new Date())).toBe(1);

        expect(await vinLookups.retrieveVinLookup(old.id)).toMatchObject({
          vin: null,
          wmi: 'WBA',
          raw: null,
          facts: {},
          make_key: 'BMW',
          code: 'AB12',
          code_type: 'bmw-type-code',
          vehicle_id: 'vehicle_1',
          decoder: 'test',
        });
      });

      it('forgets the visitor of an old lookup with its VIN, keeping its source', async () => {
        await vinLookups.saveLookup(lookup('WBAAB12070N000005'), SITE);
        const [row] = await vinLookups.listVinLookups({
          vin: 'WBAAB12070N000005',
        });
        await getContainer()
          .resolve(ContainerRegistrationKeys.PG_CONNECTION)('vin_lookup_hit')
          .where({ vin_lookup_id: row.id })
          .update({
            created_at: new Date(Date.now() - (VIN_KEPT_FOR_DAYS + 1) * DAY_MS),
          });

        await scrubVinLookupsAt(getContainer(), new Date());

        expect(
          await vinLookups.listVinLookupHits({ vin_lookup_id: row.id }),
        ).toEqual([
          expect.objectContaining({ source: 'storefront', visitor_id: null }),
        ]);
      });

      it('keeps a lookup younger than the retention and scrubs nothing twice', async () => {
        await vinLookups.saveLookup(lookup('WBAAB12070N000002'), SITE);
        await backdate('WBAAB12070N000002', VIN_KEPT_FOR_DAYS - 1);

        await scrubVinLookups(getContainer());

        expect(
          await vinLookups.listVinLookups({ vin: 'WBAAB12070N000002' }),
        ).toEqual([
          expect.objectContaining({
            wmi: 'WBA',
            raw: { decoded: 'WBAAB12070N000002' },
          }),
        ]);
        expect(await scrubVinLookupsAt(getContainer(), new Date())).toBe(0);
      });

      it('scrubs a lookup that was deleted too', async () => {
        await vinLookups.saveLookup(lookup('WBAAB12070N000003'), SITE);
        const [row] = await vinLookups.listVinLookups({
          vin: 'WBAAB12070N000003',
        });
        await vinLookups.softDeleteVinLookups(row.id);
        await backdate('WBAAB12070N000003', VIN_KEPT_FOR_DAYS + 1);

        expect(await scrubVinLookupsAt(getContainer(), new Date())).toBe(1);
      });

      it('saves a later lookup of a scrubbed VIN as a new row beside the counted one', async () => {
        await vinLookups.saveLookup(lookup('WBAAB12070N000004'), SITE);
        await backdate('WBAAB12070N000004', VIN_KEPT_FOR_DAYS + 1);
        await scrubVinLookupsAt(getContainer(), new Date());

        await vinLookups.saveLookup(lookup('WBAAB12070N000004'), SITE);

        const rows = await vinLookups.listVinLookups({ code: 'AB12' });
        expect(rows.map(({ vin }) => vin).sort()).toEqual([
          'WBAAB12070N000004',
          null,
        ]);
      });
    });
  },
});
