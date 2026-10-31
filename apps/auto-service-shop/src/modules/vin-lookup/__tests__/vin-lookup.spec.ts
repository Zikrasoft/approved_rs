import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createVehicleFixture } from '../../../../integration-tests/vehicleFixture';
import { CATALOG_MODULE } from '../../catalog';
import type CatalogModuleService from '../../catalog/service';
import { VIN_LOOKUP_MODULE } from '..';
import type VinLookupModuleService from '../service';

const lookup = (vin: string, make: string, code: string, codeType: string) => ({
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
        );
        await vinLookups.saveLookup(
          lookup(vin, 'bmw', 'AB13', 'bmw-type-code'),
        );

        expect(await vinLookups.listVinLookups({ vin })).toEqual([
          expect.objectContaining({ code: 'AB13' }),
        ]);
      });

      it('drops a code from the unresolved list only once a Vehicle has it under its own type', async () => {
        await createVehicleFixture(catalog, { typeCode: 'CD34' });
        await vinLookups.saveLookup(
          lookup('WBACD34070N000002', 'bmw', 'CD34', 'bmw-type-code'),
        );
        await vinLookups.saveLookup(
          lookup(
            'WDDCD34070N000003',
            'mercedes-benz',
            'CD34',
            'mercedes-baumuster',
          ),
        );

        const { codes } = await vinLookups.unresolvedCodes({
          offset: 0,
          limit: 50,
        });

        expect(
          codes.filter(({ code }) => code === 'CD34').map(({ make }) => make),
        ).toEqual(['mercedes-benz']);
      });
    });
  },
});
