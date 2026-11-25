import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createVehicleFixture } from '../../../../integration-tests/vehicleFixture';
import { seriesPartCounts } from '../../../lib/catalogue-structure';
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

      const listedOn = async (seriesId: string) =>
        (await seriesPartCounts(publish)).find(
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

        const published = (await publish.publishAll()).fresh.sort();
        const again = (await publish.publishAll()).fresh;
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

      const categoryWith = async (
        slug: string,
        field: {
          key: string;
          type: 'single-select' | 'multi-select' | 'number' | 'boolean';
        },
        options: string[] = [],
      ) => {
        const category = await catalog.createCategories({ slug, name: slug });
        const created = await catalog.createCategoryFields({
          category_id: category.id,
          ...field,
          label: field.key,
          facet: false,
          rank: 0,
        });
        if (options.length) {
          await catalog.createCategoryFieldOptions(
            options.map((key) => ({ field_id: created.id, key, label: key })),
          );
        }
        return { category: category.id, field: created.id };
      };

      const partIn = async (
        value: string,
        category_id: string,
        attributes: Record<string, unknown>,
      ) => {
        const part = await numberedPart(value);
        await catalog.updateParts({
          id: part.part_id,
          category_id,
          attributes,
        });
        return part;
      };

      const requiring = (
        field_id: string,
        owner: Record<string, string>,
        bounds: { option_keys?: string[]; min?: number; max?: number },
      ) =>
        catalog.createRequirement({
          field_id,
          option_keys: bounds.option_keys ?? null,
          min: bounds.min ?? null,
          max: bounds.max ?? null,
          quantity: 1,
          ...owner,
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
        const batteries = await categoryWith(
          'pb-batteries',
          { key: 'type', type: 'single-select' },
          ['agm'],
        );
        const oils = await categoryWith(
          'pb-oils',
          { key: 'viscosity', type: 'single-select' },
          ['5w-30'],
        );
        const agm = { type: 'agm' };
        const fitted = await partIn('RQ 1', batteries.category, agm);
        const required = await partIn('RQ 2', batteries.category, agm);
        const retired = await partIn('RQ 3', batteries.category, agm);
        const successor = await numberedPart('RQ 4');
        const oil = await partIn('RQ 5', oils.category, {
          viscosity: '5w-30',
        });
        await catalog.updateParts({
          id: retired.part_id,
          replaced_by_id: successor.part_id,
        });
        await catalog.createFitments({
          part_id: fitted.part_id,
          vehicle_id: car.id,
        });
        await requiring(
          batteries.field,
          { vehicle_id: car.id },
          { option_keys: ['agm'] },
        );
        for (const { id } of [car, lone]) {
          await requiring(
            oils.field,
            { vehicle_id: id },
            { option_keys: ['5w-30'] },
          );
        }
        await publish.publishAll();

        const counts = await seriesPartCounts(publish, {
          series: [series.id, loneSeries.id],
        });
        const placeOf = (seriesId: string) =>
          counts.find((row) => row.series_id === seriesId);

        expect(placeOf(series.id)).toMatchObject({ parts: 2, required: 2 });
        expect(placeOf(loneSeries.id)).toMatchObject({
          parts: 0,
          required: 1,
        });
        expect(
          (await publish.listedVehicleParts(series.id))
            .filter(({ fitted: own }) => !own)
            .map(({ part_id }) => part_id)
            .sort(),
        ).toEqual([fitted.part_id, required.part_id, oil.part_id].sort());
      });

      it('fits a Part through a Requirement on the Vehicle, its Engine or its Chassis, by options or bounds', async () => {
        const own = await createVehicleFixture(catalog, {
          typeCode: 'RS01',
          seriesName: 'RS',
          modelSlug: 'rs-own',
          chassisCode: 'RS1',
          engineCode: 'RS-E1',
        });
        const byEngine = await createVehicleFixture(catalog, {
          typeCode: 'RS02',
          seriesName: 'RS',
          modelSlug: 'rs-engine',
          chassisCode: 'RS2',
          engineCode: 'RS-E2',
        });
        const byChassis = await createVehicleFixture(catalog, {
          typeCode: 'RS03',
          seriesName: 'RS',
          modelSlug: 'rs-chassis',
          chassisCode: 'RS3',
          engineCode: 'RS-E3',
        });
        const sibling = await createVehicleFixture(catalog, {
          typeCode: 'RS04',
          seriesName: 'RS',
          modelSlug: 'rs-chassis',
          chassisCode: 'RS3',
          engineCode: 'RS-E4',
        });
        const wipers = await categoryWith(
          'rs-wipers',
          { key: 'sizes', type: 'multi-select' },
          ['500', '600'],
        );
        const bulbs = await categoryWith('rs-bulbs', {
          key: 'watts',
          type: 'number',
        });
        const long = await partIn('RS 1', wipers.category, {
          sizes: ['600', '650'],
        });
        const short = await partIn('RS 2', wipers.category, { sizes: ['500'] });
        const bright = await partIn('RS 3', bulbs.category, { watts: 60 });
        const dim = await partIn('RS 4', bulbs.category, { watts: 21 });
        await requiring(
          wipers.field,
          { vehicle_id: own.vehicle.id },
          { option_keys: ['600'] },
        );
        await requiring(
          bulbs.field,
          { engine_id: byEngine.engine.id },
          { min: 50 },
        );
        await requiring(
          bulbs.field,
          { chassis_id: byChassis.chassis.id },
          { max: 30 },
        );
        await publish.publishAll();

        const pairs = (await publish.listedVehicleParts(own.series.id))
          .filter(({ fitted }) => !fitted)
          .map(({ vehicle_id, part_id }) => `${part_id}@${vehicle_id}`)
          .sort();

        expect(pairs).toEqual(
          [
            `${long.part_id}@${own.vehicle.id}`,
            `${bright.part_id}@${byEngine.vehicle.id}`,
            `${dim.part_id}@${byChassis.vehicle.id}`,
            `${dim.part_id}@${sibling.vehicle.id}`,
          ].sort(),
        );
        expect(pairs.join()).not.toContain(short.part_id);
      });
    });
  },
});
