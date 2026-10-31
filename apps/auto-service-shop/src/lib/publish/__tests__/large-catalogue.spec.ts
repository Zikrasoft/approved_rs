import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createVehicleFixture } from '../../../../integration-tests/vehicleFixture';
import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../modules/supplier';
import type SupplierModuleService from '../../../modules/supplier/service';
import { VIN_LOOKUP_MODULE } from '../../../modules/vin-lookup';
import type VinLookupModuleService from '../../../modules/vin-lookup/service';
import { sweepOrphans } from '../orphans';
import { publishAllNumbers, unmarkNumbersPublished } from '../published';

const PAST_THE_BIND_LIMIT = 70_000;

medusaIntegrationTestRunner({
  moduleName: 'large-catalogue',
  dbName: 'medusa-large-catalogue-integration',
  testSuite: ({ getContainer }) => {
    const pg = () =>
      getContainer().resolve(ContainerRegistrationKeys.PG_CONNECTION);
    const catalog = (): CatalogModuleService =>
      getContainer().resolve(CATALOG_MODULE);
    const countOf = async (table: string) =>
      Number((await pg()(table).count({ count: '*' }))[0].count);

    describe('a catalogue past the 65,535 bind-parameter limit', () => {
      it('publishes and unpublishes every number', async () => {
        const brand = await catalog().createBrands({ name: 'Bulk' });
        const part = await catalog().createParts({ name: 'Bulk part' });
        await pg().raw(
          `insert into part_identifier (id, type, value, normalized_value, brand_id, part_id)
           select 'pi_bulk_' || n, 'oem', 'B' || n, 'B' || n, ?, ?
           from generate_series(1, ?) n`,
          [brand.id, part.id, PAST_THE_BIND_LIMIT],
        );

        const fresh = await publishAllNumbers(getContainer());

        expect(fresh).toHaveLength(PAST_THE_BIND_LIMIT);
        expect(await publishAllNumbers(getContainer())).toEqual([]);
        await unmarkNumbersPublished(getContainer(), fresh);
        expect(await countOf('published_number')).toBe(0);
      });

      it('counts and deletes a source with more rows than one statement can name', async () => {
        const { vehicle } = await createVehicleFixture(catalog());
        const part = await catalog().createParts({ name: 'Bulk fitted part' });
        await pg().raw(
          `insert into fitment (id, part_id, vehicle_id, production_from, production_to, source)
           select 'fit_bulk_' || n, ?, ?, date '1900-01-01' + n, date '1900-01-01' + n, 'bulk'
           from generate_series(1, ?) n`,
          [part.id, vehicle.id, PAST_THE_BIND_LIMIT],
        );

        expect(await catalog().countRowsBySource()).toContainEqual({
          source: 'bulk',
          rows: PAST_THE_BIND_LIMIT,
        });
        expect(await catalog().deleteRowsBySource('bulk')).toBe(
          PAST_THE_BIND_LIMIT,
        );
        expect(await countOf('fitment')).toBe(0);
      });
    });

    describe('the orphan sweep', () => {
      it('drops supplier rows and Published marks of deleted numbers and unlinks VINs of deleted Vehicles', async () => {
        const suppliers: SupplierModuleService =
          getContainer().resolve(SUPPLIER_MODULE);
        const vinLookups: VinLookupModuleService =
          getContainer().resolve(VIN_LOOKUP_MODULE);
        const supplier = await suppliers.createSuppliers({
          name: 'Orphaned',
          markup_percentage: 10,
        });
        await suppliers.createSupplierOffers({
          supplier_id: supplier.id,
          supplier_article_id: 'A1',
          cost_price: 100,
          stock_quantity: 1,
          lead_time_days: 1,
          part_identifier_id: 'pi_gone',
        });
        await suppliers.createStagedRecords({
          supplier_id: supplier.id,
          part_identifier_id: 'pi_gone',
          kind: 'images',
          payload: {},
        });
        await pg()('published_number').insert({ id: 'pi_gone' });
        await vinLookups.createVinLookups({
          vin: 'WBA00000000000001',
          facts: {},
          vehicle_id: 'veh_gone',
        });

        await sweepOrphans(getContainer());

        expect(await countOf('supplier_offer')).toBe(0);
        expect(await countOf('staged_record')).toBe(0);
        expect(await countOf('published_number')).toBe(0);
        expect(
          (await vinLookups.listVinLookups({ vin: 'WBA00000000000001' }))[0],
        ).toMatchObject({ vehicle_id: null });
      });
    });
  },
});
