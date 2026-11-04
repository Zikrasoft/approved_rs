import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createVehicleFixture } from '../../../integration-tests/vehicleFixture';
import { CATALOG_MODULE } from '../../modules/catalog';
import type CatalogModuleService from '../../modules/catalog/service';
import { KEYSET_PAGE } from '../../modules/_shared/keyset-pages';
import { everyRequirementFit, requirementFits } from '../requirement-fit';

medusaIntegrationTestRunner({
  moduleName: 'requirement_fit',
  testSuite: ({ getContainer }) => {
    describe('Requirement fit', () => {
      let catalog: CatalogModuleService;
      let oilsId: string;
      let viscosityId: string;
      let wipersId: string;

      beforeAll(async () => {
        catalog = getContainer().resolve(CATALOG_MODULE);
        const [oils, wipers] = await catalog.createCategories([
          { slug: 'oils', name: 'Масла' },
          { slug: 'wipers', name: 'Щетки' },
        ]);
        oilsId = oils.id;
        wipersId = wipers.id;
        const viscosity = await catalog.createCategoryFields({
          category_id: oils.id,
          key: 'viscosity',
          type: 'single-select',
          label: 'Вязкость',
          facet: true,
          rank: 0,
        });
        viscosityId = viscosity.id;
        await catalog.createCategoryFieldOptions([
          { field_id: viscosity.id, key: '5w-30', label: '5W-30' },
          { field_id: viscosity.id, key: '0w-20', label: '0W-20' },
        ]);
      });

      const oil = (id: string, grade: string) => ({
        id,
        category_id: oilsId,
        attributes: { viscosity: grade },
      });

      const require = (owner: Record<string, string>, grade: string) =>
        catalog.createRequirement({
          field_id: viscosityId,
          option_keys: [grade],
          min: null,
          max: null,
          quantity: 1,
          ...owner,
        });

      const pairs = (fits: { part_id: string; vehicle: { id: string } }[]) =>
        fits.map(({ part_id, vehicle }) => `${part_id}@${vehicle.id}`).sort();

      it('fits nothing while no car has a Requirement', async () => {
        expect(await everyRequirementFit(catalog)).toEqual([]);
        expect(await requirementFits(catalog, [oil('p', '5w-30')])).toEqual([]);
      });

      it('fits nothing to a Part without a Category or in a Category without fields', async () => {
        expect(
          await requirementFits(catalog, [
            { id: 'loose', category_id: null, attributes: {} },
            { id: 'wiper', category_id: wipersId, attributes: {} },
          ]),
        ).toEqual([]);
      });

      it('fits a Part through a Requirement on the Vehicle, its Engine or its Chassis', async () => {
        const own = await createVehicleFixture(catalog, {
          typeCode: 'RF01',
          modelSlug: 'rf-own',
          chassisCode: 'RF1',
          engineCode: 'RF-E1',
        });
        const byEngine = await createVehicleFixture(catalog, {
          typeCode: 'RF02',
          modelSlug: 'rf-engine',
          chassisCode: 'RF2',
          engineCode: 'RF-E2',
        });
        const byChassis = await createVehicleFixture(catalog, {
          typeCode: 'RF03',
          modelSlug: 'rf-chassis',
          chassisCode: 'RF3',
          engineCode: 'RF-E3',
        });
        const sibling = await createVehicleFixture(catalog, {
          typeCode: 'RF04',
          modelSlug: 'rf-chassis',
          chassisCode: 'RF3',
          engineCode: 'RF-E4',
        });
        await require({ vehicle_id: own.vehicle.id }, '5w-30');
        await require({ engine_id: byEngine.engine.id }, '0w-20');
        await require({ chassis_id: byChassis.chassis.id }, '5w-30');

        const fits = await requirementFits(catalog, [
          oil('thin', '0w-20'),
          oil('thick', '5w-30'),
          { id: 'wiper', category_id: wipersId, attributes: {} },
        ]);

        expect(pairs(fits)).toEqual(
          [
            `thick@${own.vehicle.id}`,
            `thin@${byEngine.vehicle.id}`,
            `thick@${byChassis.vehicle.id}`,
            `thick@${sibling.vehicle.id}`,
          ].sort(),
        );
        expect(
          fits.find(({ vehicle }) => vehicle.id === sibling.vehicle.id)?.vehicle
            .model.slug,
        ).toBe('rf-chassis');
      });

      it('pages through every Part of a required Category', async () => {
        const car = await createVehicleFixture(catalog, {
          typeCode: 'RF05',
          modelSlug: 'rf-paged',
        });
        await require({ vehicle_id: car.vehicle.id }, '0w-20');
        const created = await catalog.createParts(
          Array.from({ length: KEYSET_PAGE + 1 }, (_, index) => ({
            name: `Масло ${index}`,
            category_id: oilsId,
            attributes: { viscosity: '0w-20' },
          })),
        );

        const fits = await everyRequirementFit(catalog);

        expect(fits.map(({ part_id }) => part_id).sort()).toEqual(
          created.map(({ id }) => id).sort(),
        );
        expect(new Set(fits.map(({ vehicle_id }) => vehicle_id))).toEqual(
          new Set([car.vehicle.id]),
        );
      });
    });
  },
});
