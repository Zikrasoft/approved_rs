import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createVehicleFixture } from '../../../../integration-tests/vehicleFixture';
import { CATALOG_MODULE } from '../../catalog';
import type CatalogModuleService from '../../catalog/service';
import { PUBLISH_MODULE } from '..';
import type { PartFit } from '../service';
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

      const listedOn = async (
        seriesId: string,
        requirementFits: PartFit[] = [],
      ) =>
        (await publish.listedPartCounts(requirementFits)).find(
          (row) => row.series_id === seriesId,
        )?.parts ?? 0;

      const listedById = async (ids: string[]) =>
        Object.fromEntries(
          (
            await publish.listPublishedNumbers(
              { id: ids },
              { select: ['id', 'listed'] },
            )
          ).map(({ id, listed }) => [id, listed]),
        );

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
        const { vehicle: oldCar, series: oldSeries } =
          await createVehicleFixture(catalog, {
            typeCode: 'PB01',
            seriesName: 'PB old',
            modelSlug: 'pb-old',
          });
        const { vehicle: newCar, series: newSeries } =
          await createVehicleFixture(catalog, {
            typeCode: 'PB02',
            seriesName: 'PB new',
            modelSlug: 'pb-new',
          });
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
          await listedOn(oldSeries.id),
          await listedOn(newSeries.id),
        ];
        await publish.unpublish([replacement.part_identifier_id]);
        const replacementHidden = [
          await listedOn(oldSeries.id),
          await listedOn(newSeries.id),
        ];

        expect(bothPublished).toEqual([0, 1]);
        expect(replacementHidden).toEqual([1, 0]);
      });

      it('writes once, at Publish, which numbers are listed', async () => {
        const current = await numberedPart('LS 1');
        const superseded = await catalog.createPartIdentifiers({
          part_id: current.part_id,
          type: 'manufacturer-number',
          brand_id: brandId,
          value: 'LS 0',
          normalized_value: 'LS0',
          superseded: true,
        });
        const alone = await numberedPart('LS 2');
        await catalog.updatePartIdentifiers({
          id: alone.part_identifier_id,
          superseded: true,
        });
        const replaced = await numberedPart('LS 3');
        const replacement = await numberedPart('LS 4');
        await catalog.updateParts({
          id: replaced.part_id,
          replaced_by_id: replacement.part_id,
        });
        const ids = [
          current.part_identifier_id,
          superseded.id,
          alone.part_identifier_id,
          replaced.part_identifier_id,
          replacement.part_identifier_id,
        ];

        const unpublished = await listedById(ids);
        await publish.publishAll();
        const published = await listedById(ids);
        await publish.unpublish([current.part_identifier_id]);
        const currentHidden = await listedById(ids);

        expect(unpublished).toEqual({});
        expect(published).toEqual({
          [current.part_identifier_id]: true,
          [superseded.id]: false,
          [alone.part_identifier_id]: true,
          [replaced.part_identifier_id]: false,
          [replacement.part_identifier_id]: true,
        });
        expect(currentHidden[superseded.id]).toBe(true);
      });

      it('counts Requirement matches only from two listed ones in a Category, a fitted Part once', async () => {
        const { vehicle: car, series } = await createVehicleFixture(catalog, {
          typeCode: 'PB03',
          seriesName: 'PB required',
          modelSlug: 'pb-required',
        });
        const { vehicle: lone, series: loneSeries } =
          await createVehicleFixture(catalog, {
            typeCode: 'PB04',
            seriesName: 'PB lone',
            modelSlug: 'pb-lone',
          });
        const fitted = await numberedPart('RQ 1');
        const required = await numberedPart('RQ 2');
        const retired = await numberedPart('RQ 3');
        const successor = await numberedPart('RQ 4');
        const oil = await numberedPart('RQ 5');
        await catalog.updateParts({
          id: retired.part_id,
          replaced_by_id: successor.part_id,
        });
        await catalog.createFitments({
          part_id: fitted.part_id,
          vehicle_id: car.id,
        });
        await publish.publishAll();

        const fit = (
          vehicle_id: string,
          { part_id }: { part_id: string },
          category_id: string,
        ) => ({ vehicle_id, part_id, category_id });
        const counts = await publish.listedPartCounts([
          fit(car.id, fitted, 'batteries'),
          fit(car.id, required, 'batteries'),
          fit(car.id, retired, 'batteries'),
          fit(car.id, oil, 'oils'),
          fit(lone.id, oil, 'oils'),
        ]);
        const placeOf = (seriesId: string) =>
          counts.find((row) => row.series_id === seriesId);

        expect(await listedOn(series.id)).toBe(1);
        expect(placeOf(series.id)).toMatchObject({ parts: 2, required: 2 });
        expect(placeOf(loneSeries.id)).toMatchObject({
          parts: 0,
          required: 1,
        });
      });
    });
  },
});
