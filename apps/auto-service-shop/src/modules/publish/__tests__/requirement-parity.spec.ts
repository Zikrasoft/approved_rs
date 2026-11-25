import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { requirementMatches } from '@podbor/catalog-contract';

import { createVehicleFixture } from '../../../../integration-tests/vehicleFixture';
import { vehiclesOfSeries } from '../../../lib/series-vehicles';
import { CATALOG_MODULE } from '../../catalog';
import type CatalogModuleService from '../../catalog/service';
import { PUBLISH_MODULE } from '..';
import type PublishModuleService from '../service';

medusaIntegrationTestRunner({
  moduleName: 'requirement_parity',
  testSuite: ({ getContainer }) => {
    describe('Requirement matching in SQL and in the contract', () => {
      let catalog: CatalogModuleService;
      let publish: PublishModuleService;
      let seriesId: string;
      const partOf = new Map<string, string>();
      const carOf = new Map<string, string>();

      beforeAll(async () => {
        catalog = getContainer().resolve(CATALOG_MODULE);
        publish = getContainer().resolve(PUBLISH_MODULE);
        const brand = await catalog.createBrands({ name: 'Oil', slug: 'oil' });
        const oils = await catalog.createCategories({
          slug: 'oils',
          name: 'Oils',
        });
        const field = (
          key: string,
          type: 'single-select' | 'multi-select' | 'number' | 'boolean',
          options: string[] = [],
        ) =>
          catalog
            .createCategoryFields({
              category_id: oils.id,
              key,
              type,
              label: key,
              facet: true,
              rank: 0,
            })
            .then(async (created) => {
              if (options.length) {
                await catalog.createCategoryFieldOptions(
                  options.map((option) => ({
                    field_id: created.id,
                    key: option,
                    label: option,
                  })),
                );
              }
              return created.id;
            });
        const viscosity = await field('viscosity', 'single-select', [
          '5w-30',
          '0w-20',
        ]);
        const approvals = await field('approvals', 'multi-select', [
          'll-04',
          '229-5',
          'll-01',
        ]);
        const capacity = await field('capacity', 'number');
        const synthetic = await field('synthetic', 'boolean');

        const parts: [string, Record<string, unknown>][] = [
          [
            'P1',
            {
              viscosity: '5w-30',
              approvals: ['ll-04', '229-5'],
              capacity: 5,
              synthetic: true,
            },
          ],
          [
            'P2',
            {
              viscosity: '0w-20',
              approvals: ['229-5'],
              capacity: 4.5,
              synthetic: false,
            },
          ],
          ['P3', { viscosity: '5w-30' }],
          ['P4', { approvals: ['ll-01'], capacity: 7 }],
        ];
        for (const [value, attributes] of parts) {
          const { part_id } = await catalog.findOrCreatePart({
            name: `Oil ${value}`,
            category_id: oils.id,
            attributes,
            identifier: {
              type: 'manufacturer-number',
              brand_id: brand.id,
              value,
            },
            source: 'test',
          });
          partOf.set(part_id, value);
        }

        const car = async (name: string) => {
          const fixture = await createVehicleFixture(catalog, {
            typeCode: `RP${name}`,
            seriesName: 'Parity series',
            modelSlug: `parity-${name}`,
            chassisCode: `C${name}`,
            engineCode: `E${name}`,
          });
          carOf.set(fixture.vehicle.id, name);
          seriesId = fixture.series.id;
          return fixture;
        };
        const rule = {
          option_keys: null,
          min: null,
          max: null,
          quantity: 1,
        };
        const v1 = await car('V1');
        await catalog.createRequirement({
          ...rule,
          field_id: viscosity,
          option_keys: ['5w-30'],
          vehicle_id: v1.vehicle.id,
        });
        const v2 = await car('V2');
        await catalog.createRequirement({
          ...rule,
          field_id: capacity,
          min: 5,
          engine_id: v2.engine.id,
        });
        const v3 = await car('V3');
        await catalog.createRequirement({
          ...rule,
          field_id: capacity,
          max: 5,
          chassis_id: v3.chassis.id,
        });
        const v4 = await car('V4');
        await catalog.createRequirement({
          ...rule,
          field_id: approvals,
          option_keys: ['ll-04', 'll-01'],
          chassis_id: v4.chassis.id,
        });
        await catalog.createRequirement({
          ...rule,
          field_id: synthetic,
          option_keys: ['true'],
          vehicle_id: v4.vehicle.id,
        });
        const v5 = await car('V5');
        await catalog.createRequirement({
          ...rule,
          field_id: viscosity,
          option_keys: ['5w-30'],
          engine_id: v5.engine.id,
        });
        await catalog.createRequirement({
          ...rule,
          field_id: capacity,
          min: 4,
          max: 6,
          chassis_id: v5.chassis.id,
        });
        await car('V6');
        await publish.publishAll();
      });

      const named = (rows: { vehicle_id: string; part_id: string }[]) =>
        rows
          .map(
            ({ vehicle_id, part_id }) =>
              `${carOf.get(vehicle_id)}:${partOf.get(part_id)}`,
          )
          .sort();

      it('matches the same cars to the same Parts', async () => {
        const vehicles = await vehiclesOfSeries(catalog, [seriesId]);
        const listed = await publish.listedPartsIn(
          (await catalog.listCategories({ slug: 'oils' }))[0].id,
        );
        const byContract = named(
          vehicles.flatMap((vehicle) =>
            requirementMatches(listed, vehicle.requirements).flatMap(
              ({ parts }) =>
                parts.map(({ id }) => ({
                  vehicle_id: vehicle.id,
                  part_id: id,
                })),
            ),
          ),
        );
        const bySql = named(
          (await publish.listedVehicleParts(seriesId)).filter(
            ({ fitted }) => !fitted,
          ),
        );

        expect(bySql).toEqual([
          'V1:P1',
          'V1:P3',
          'V2:P1',
          'V2:P4',
          'V3:P1',
          'V3:P2',
          'V4:P1',
          'V5:P1',
        ]);
        expect(byContract).toEqual(bySql);
      });
    });
  },
});
