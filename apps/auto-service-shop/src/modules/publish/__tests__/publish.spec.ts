import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createVehicleFixture } from '../../../../integration-tests/vehicleFixture';
import { CATALOG_MODULE } from '../../catalog';
import type CatalogModuleService from '../../catalog/service';
import { PUBLISH_MODULE } from '..';
import type PublishModuleService from '../service';

medusaIntegrationTestRunner({
  moduleName: 'publish_module',
  testSuite: ({ getContainer }) => {
    describe('The publish module', () => {
      let catalog: CatalogModuleService;
      let publish: PublishModuleService;
      let brandId: string;

      const numberedPart = (value: string) =>
        catalog.findOrCreatePart({
          name: `Part ${value}`,
          identifier: { type: 'manufacturer-number', brand_id: brandId, value },
          source: 'test',
        });

      const listedOn = async (vehicleId: string) =>
        (await publish.listedPartCounts()).find(
          (row) => row.vehicle_id === vehicleId,
        )?.parts ?? 0;

      beforeAll(async () => {
        catalog = getContainer().resolve(CATALOG_MODULE);
        publish = getContainer().resolve(PUBLISH_MODULE);
        brandId = (await catalog.createBrands({ name: 'MANN', slug: 'mann' }))
          .id;
      });

      it('publishes every live number once and pages through them', async () => {
        const ids = [
          (await numberedPart('P 1')).part_identifier_id,
          (await numberedPart('P 2')).part_identifier_id,
        ].sort();

        const published = (await publish.publishAll()).sort();
        const again = await publish.publishAll();
        const firstPage = await publish.publishedPage({ limit: 1 });
        const secondPage = await publish.publishedPage({
          after: firstPage[0].id,
          limit: 10,
        });

        expect(published).toEqual(ids);
        expect(again).toEqual([]);
        expect([...firstPage, ...secondPage].map(({ id }) => id)).toEqual(ids);
      });

      it('lists a replaced Part only while its replacement is unpublished', async () => {
        const oldCar = (
          await createVehicleFixture(catalog, {
            typeCode: 'PB01',
            modelSlug: 'pb-old',
          })
        ).vehicle;
        const newCar = (
          await createVehicleFixture(catalog, {
            typeCode: 'PB02',
            modelSlug: 'pb-new',
          })
        ).vehicle;
        const old = await numberedPart('OLD 1');
        const replacement = await numberedPart('NEW 1');
        await catalog.updateParts({
          id: old.part_id,
          replaced_by_id: replacement.part_id,
        });
        await catalog.createFitments([
          { part_id: old.part_id, vehicle_id: oldCar.id },
          { part_id: replacement.part_id, vehicle_id: newCar.id },
        ]);

        await publish.publishAll();
        const bothPublished = [
          await listedOn(oldCar.id),
          await listedOn(newCar.id),
        ];
        await publish.unpublish([replacement.part_identifier_id]);
        const replacementHidden = [
          await listedOn(oldCar.id),
          await listedOn(newCar.id),
        ];

        expect(bothPublished).toEqual([0, 1]);
        expect(replacementHidden).toEqual([1, 0]);
      });
    });
  },
});
