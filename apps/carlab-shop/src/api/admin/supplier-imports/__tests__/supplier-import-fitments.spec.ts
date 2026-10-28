import { asValue } from '@medusajs/framework/awilix';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { createFakeShopAi } from '../../../../../integration-tests/fakeShopAi';
import { createFakeSupplier } from '../../../../../integration-tests/fakeSupplierAdapter';
import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import { SHOP_AI_REGISTRATION } from '../../../../lib/ai';
import {
  SUPPLIER_ADAPTERS_REGISTRATION,
  type SupplierArticle,
} from '../../../../lib/suppliers/adapter';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../modules/supplier';
import type SupplierModuleService from '../../../../modules/supplier/service';

const mann = createFakeSupplier('MANN-FILTER');
const bilstein = createFakeSupplier('bilstein group');
const shopAi = createFakeShopAi();

type VehicleFacts = NonNullable<SupplierArticle['vehicles']>[number];

const bmw125i: VehicleFacts = {
  make: 'BMW',
  model: '1',
  variant: '125i (E82/E88)',
  chassis_codes: ['E82', 'E88'],
  engine_codes: ['N52 B30A'],
  displacement_cc: 2996,
  power_kw: 160,
  fuel: null,
  body_style: null,
  year_from: 2008,
  year_to: 2013,
  notes: [],
};

medusaIntegrationTestRunner({
  moduleName: 'supplier-import-fitments',
  dbName: 'medusa-supplier-import-fitments-integration',
  hooks: {
    beforeServerStart: async (container) => {
      container.register(
        SUPPLIER_ADAPTERS_REGISTRATION,
        asValue([mann.adapter, bilstein.adapter]),
      );
      container.register(SHOP_AI_REGISTRATION, asValue(shopAi.ai));
    },
  },
  testSuite: ({ api, getContainer }) => {
    describe('supplier import of applicability', () => {
      let adminHeaders: { headers: { authorization: string } };
      let catalog: CatalogModuleService;
      const supplierIds: Record<string, string> = {};

      beforeAll(async () => {
        const container = getContainer();
        catalog = container.resolve(CATALOG_MODULE);
        const suppliers: SupplierModuleService =
          container.resolve(SUPPLIER_MODULE);
        adminHeaders = await createAdminAuth(
          container,
          api,
          'admin@supplier-import-fitments.local',
          'supersecret',
        );
        const created = await suppliers.createSuppliers([
          { name: 'MANN-FILTER', markup_percentage: 0 },
          { name: 'bilstein group', markup_percentage: 0 },
        ]);
        for (const { id, name } of created) supplierIds[name] = id;
        const [mannBrand, febi] = await catalog.createBrands([
          { name: 'Mann-Filter', slug: 'mann-filter' },
          { name: 'febi', slug: 'febi' },
        ]);
        await catalog.createBrandSpellings([
          {
            brand_id: mannBrand.id,
            supplier_id: supplierIds['MANN-FILTER'],
            value: 'MANN-FILTER',
          },
          {
            brand_id: febi.id,
            supplier_id: supplierIds['bilstein group'],
            value: 'febi',
          },
        ]);
      });

      beforeEach(() => {
        for (const fake of [mann, bilstein]) fake.articles.length = 0;
        Object.assign(shopAi, { name: null, namesWritten: [], failure: null });
      });

      const runImport = async (supplier: string) => {
        const response = await api.post(
          `/admin/suppliers/${supplierIds[supplier]}/import`,
          {},
          adminHeaders,
        );
        expect(response.status).toBe(200);
        return response.data.import;
      };

      const partOf = async (number: string) => {
        const [identifier] = await catalog.listPartIdentifiers(
          { value: number },
          { relations: ['part'] },
        );
        return identifier.part;
      };

      const fitmentsOf = async (number: string) =>
        catalog.listFitments(
          { part_id: (await partOf(number)).id },
          {
            relations: [
              'vehicle',
              'vehicle.identifiers',
              'vehicle.engine',
              'vehicle.model',
              'vehicle.model.chassis',
              'vehicle.model.chassis.series',
              'vehicle.model.chassis.series.make',
            ],
          },
        );

      it('creates the Vehicle and its reference rows from parsed applicability, stamped with the Supplier, without a type code', async () => {
        mann.articles.push({
          article_id: 'HU816X',
          brand: 'MANN-FILTER',
          number: 'HU 816 x',
          name: 'Oil Filter HU 816 x',
          category: 'Oil Filter',
          vehicles: [bmw125i],
        });

        await runImport('MANN-FILTER');

        const [fitment] = await fitmentsOf('HU 816 x');
        expect(fitment).toMatchObject({
          source: 'MANN-FILTER',
          note: null,
          vehicle: {
            source: 'MANN-FILTER',
            power_kw: 160,
            year_from: 2008,
            year_to: 2013,
            identifiers: [],
            engine: {
              code: 'N52 B30A',
              family: 'N52',
              fuel: null,
              displacement_cc: 2996,
              source: 'MANN-FILTER',
            },
            model: {
              name: '125i (E82/E88)',
              source: 'MANN-FILTER',
              chassis: {
                code: 'E82/E88',
                body_style: null,
                source: 'MANN-FILTER',
                series: {
                  name: '1',
                  source: 'MANN-FILTER',
                  make: { slug: 'bmw', name: 'BMW', source: 'MANN-FILTER' },
                },
              },
            },
          },
        });
      });

      it('fits the same car from a second site, named by its engine family, to the one Vehicle, and a staff Vehicle sharing chassis and engine code', async () => {
        const staff = await createVehicleFixture(catalog, {
          typeCode: '1B11',
          modelSlug: 'e90-325i',
          chassisCode: 'E90',
          engineCode: 'N52 B30A',
          engineFamily: 'N52',
        });
        await catalog.updateVehicles({
          id: staff.vehicle.id,
          power_kw: 160,
          year_from: 2007,
          year_to: 2010,
        });
        mann.articles.push({
          article_id: 'HU816X',
          brand: 'MANN-FILTER',
          number: 'HU 816 x',
          name: 'Oil Filter HU 816 x',
          category: 'Oil Filter',
          vehicles: [
            bmw125i,
            {
              ...bmw125i,
              model: '3',
              variant: '325i (E90)',
              chassis_codes: ['E90'],
              year_from: 2005,
              year_to: 2008,
            },
          ],
        });
        bilstein.articles.push({
          article_id: 'febi/27699',
          brand: 'febi',
          number: '27699',
          name: 'uljni filter',
          category: 'uljni filter',
          vehicles: [
            {
              make: 'BMW',
              model: '1 (E82)',
              variant: '125 i - 160 kW / 218 hp',
              chassis_codes: ['E82'],
              engine_codes: ['N52'],
              displacement_cc: 2996,
              power_kw: 160,
              fuel: 'petrol',
              body_style: 'coupe',
              year_from: 2007,
              year_to: 2013,
              notes: ['za vozila sa: sportskim paketom'],
            },
          ],
        });

        await runImport('MANN-FILTER');
        await runImport('bilstein group');

        const mannVehicles = (await fitmentsOf('HU 816 x')).map(
          ({ vehicle_id }) => vehicle_id,
        );
        const [febiFitment] = await fitmentsOf('27699');
        expect(mannVehicles).toContain(staff.vehicle.id);
        expect(mannVehicles).toContain(febiFitment.vehicle_id);
        expect(febiFitment.note).toBe('za vozila sa: sportskim paketom');
        expect(await catalog.listEngines({ family: 'N52' })).toHaveLength(1);
      });

      it('never recreates a Fitment staff deleted and leaves a manual Fitment alone', async () => {
        mann.articles.push({
          article_id: 'HU7020',
          brand: 'MANN-FILTER',
          number: 'HU 7020',
          name: 'Oil Filter HU 7020',
          category: 'Oil Filter',
          vehicles: [bmw125i],
        });
        await runImport('MANN-FILTER');
        const [imported] = await fitmentsOf('HU 7020');
        const deleted = await api.delete(
          `/admin/fitments/${imported.id}`,
          adminHeaders,
        );
        expect(deleted.status).toBe(200);
        const manual = await createVehicleFixture(catalog, {
          typeCode: '9Z99',
          modelSlug: 'f30-330d',
          chassisCode: 'F30',
          engineCode: 'N57D30A',
          engineFamily: 'N57',
        });
        const added = await api.post(
          '/admin/fitments',
          {
            part_id: (await partOf('HU 7020')).id,
            vehicle_id: manual.vehicle.id,
            note: 'проверено',
          },
          adminHeaders,
        );
        expect(added.status).toBe(200);

        await runImport('MANN-FILTER');

        expect(await fitmentsOf('HU 7020')).toEqual([
          expect.objectContaining({
            vehicle_id: manual.vehicle.id,
            source: 'manual',
            note: 'проверено',
          }),
        ]);
      });

      it('drops its Fitments and Vehicles the source no longer lists, never recreates a staff deletion, and leaves manual ones', async () => {
        const audi = (variant: string, engine: string): VehicleFacts => ({
          ...bmw125i,
          make: 'Audi',
          model: 'A4',
          variant,
          chassis_codes: ['B8'],
          engine_codes: [engine],
          power_kw: null,
        });
        const kept = audi('2.0 TDI', 'CAGA');
        const dropped = audi('1.8 TFSI', 'CDHA');
        const article = {
          article_id: 'W712',
          brand: 'MANN-FILTER',
          number: 'W 712',
          name: 'Oil Filter W 712',
          category: 'Oil Filter',
          vehicles: [kept, dropped],
        };
        mann.articles.push(article);
        await runImport('MANN-FILTER');
        const fitted = await fitmentsOf('W 712');
        const fittedTo = (variant: string) =>
          fitted.find(({ vehicle }) => vehicle.model.name === variant)!;
        const staffDeleted = fittedTo(kept.variant);
        const unlisted = fittedTo(dropped.variant);
        await api.delete(`/admin/fitments/${staffDeleted.id}`, adminHeaders);
        const manual = await createVehicleFixture(catalog, {
          typeCode: '8K22',
          modelSlug: 'b8-20-tdi-manual',
          chassisCode: 'F31',
          engineCode: 'N47D20C',
          engineFamily: 'N47',
        });
        await api.post(
          '/admin/fitments',
          {
            part_id: (await partOf('W 712')).id,
            vehicle_id: manual.vehicle.id,
          },
          adminHeaders,
        );
        article.vehicles = [];

        await runImport('MANN-FILTER');

        expect(await fitmentsOf('W 712')).toEqual([
          expect.objectContaining({ vehicle_id: manual.vehicle.id }),
        ]);
        expect(
          await catalog.listVehicles({
            id: [staffDeleted.vehicle_id, unlisted.vehicle_id],
          }),
        ).toEqual([expect.objectContaining({ id: staffDeleted.vehicle_id })]);

        article.vehicles = [kept, dropped];
        await runImport('MANN-FILTER');

        expect(
          (await fitmentsOf('W 712')).map(({ vehicle }) => vehicle.model.name),
        ).toEqual(expect.arrayContaining([dropped.variant, manual.model.name]));
        expect(await fitmentsOf('W 712')).toHaveLength(2);
      });

      it('fits no Vehicle for a row without an engine code and counts the row', async () => {
        mann.articles.push({
          article_id: 'K1477',
          brand: 'MANN-FILTER',
          number: 'K 1477',
          name: 'Cabin Air Filter K 1477',
          category: 'Cabin Air Filter',
          vehicles: [
            {
              ...bmw125i,
              make: 'FORD USA',
              model: 'F-150 Lightning',
              variant: 'EV',
              chassis_codes: [],
              engine_codes: [],
            },
          ],
        });

        const summary = await runImport('MANN-FILTER');

        expect(await fitmentsOf('K 1477')).toEqual([]);
        expect(summary.skipped_by_reason.no_engine_code).toBe(1);
      });

      it('names an imported Part in Russian and renames it only when the source name changes', async () => {
        shopAi.name = 'Масляный фильтр MANN-FILTER W 712/95';
        mann.articles.push({
          article_id: 'W71295',
          brand: 'MANN-FILTER',
          number: 'W 712/95',
          name: 'Oil Filter W 712/95',
          category: 'Oil Filter',
        });

        await runImport('MANN-FILTER');
        shopAi.name = 'Фильтр масляный W 712/95';
        await runImport('MANN-FILTER');

        expect((await partOf('W 712/95')).name).toBe(
          'Масляный фильтр MANN-FILTER W 712/95',
        );
        expect(shopAi.namesWritten).toEqual([
          expect.objectContaining({ name: 'Oil Filter W 712/95' }),
        ]);

        mann.articles[0].name = 'Oil Filter W 712/95 new';
        await runImport('MANN-FILTER');

        expect((await partOf('W 712/95')).name).toBe(
          'Фильтр масляный W 712/95',
        );
      });
    });
  },
});
