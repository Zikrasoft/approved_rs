import type { Knex } from '@medusajs/framework/mikro-orm/knex';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { MIN_REQUIREMENT_MATCHES_FOR_PAGE } from '@podbor/catalog-contract';

import { createVehicleFixture } from '../../../../integration-tests/vehicleFixture';
import buildCatalogueSnapshotScript from '../../../scripts/build-catalogue-snapshot';
import { CATALOG_MODULE } from '../../catalog';
import {
  LISTED_PLACES,
  LISTED_VEHICLE_PARTS,
} from '../../catalog/cross-module-sql';
import type CatalogModuleService from '../../catalog/service';
import { PUBLISH_MODULE } from '..';
import type PublishModuleService from '../service';

const WALKED_SERIES_CATEGORY_COUNTS = `${LISTED_PLACES}
  select series_id, category_id, count(*)::int as parts,
    (count(*) filter (where fitted))::int as fitted,
    (count(*) filter (where required))::int as required
  from (
    select series_id, category_id, bool_or(fitted) as fitted,
      bool_or(not fitted) as required
    from places
    group by series_id, category_id, part_id
  ) held
  group by series_id, category_id`;

const WALKED_CATEGORY_PARTS = `${LISTED_PLACES}
  select category_id, part_id
  from places
  where category_id is not null
  group by category_id, part_id
  order by category_id, part_id`;

const sortedBy = <T>(rows: T[], key: (row: T) => string) =>
  [...rows].sort((a, b) => key(a).localeCompare(key(b)));

const countKey = ({
  series_id,
  category_id,
}: {
  series_id: string;
  category_id: string | null;
}) => `${series_id}/${category_id}`;

medusaIntegrationTestRunner({
  moduleName: 'catalogue_snapshot',
  testSuite: ({ getContainer }) => {
    describe('The catalogue snapshot Publish builds', () => {
      let catalog: CatalogModuleService;
      let publish: PublishModuleService;
      let pg: Knex;
      const seriesIds: string[] = [];
      let requiringCarId: string;

      const walked = async (sql: string, series: string[] | null = null) =>
        (
          await pg.raw(sql, {
            series,
            min_matches: MIN_REQUIREMENT_MATCHES_FOR_PAGE,
          })
        ).rows;

      const snapshotRows = async () =>
        Number(
          (await pg.raw('select count(*)::int as n from listed_series_part'))
            .rows[0].n,
        );

      const expectParity = async () => {
        expect(
          sortedBy(await publish.listedSeriesCategoryCounts(), countKey),
        ).toEqual(
          sortedBy(await walked(WALKED_SERIES_CATEGORY_COUNTS), countKey),
        );
        expect(await publish.listedCategoryParts(seriesIds)).toEqual(
          await walked(WALKED_CATEGORY_PARTS, seriesIds),
        );
        expect(
          await publish.listedCategoryParts(seriesIds.slice(0, 1)),
        ).toEqual(await walked(WALKED_CATEGORY_PARTS, seriesIds.slice(0, 1)));
        for (const id of seriesIds) {
          expect(await publish.listedVehicleParts(id)).toEqual(
            await walked(LISTED_VEHICLE_PARTS, [id]),
          );
        }
      };

      beforeAll(async () => {
        catalog = getContainer().resolve(CATALOG_MODULE);
        publish = getContainer().resolve(PUBLISH_MODULE);
        pg = getContainer().resolve(ContainerRegistrationKeys.PG_CONNECTION);
        const brand = await catalog.createBrands({
          name: 'Snap',
          slug: 'snap',
        });
        const filters = await catalog.createCategories({
          slug: 'snap-filters',
          name: 'Filters',
        });
        const pads = await catalog.createCategories({
          slug: 'snap-pads',
          name: 'Pads',
        });
        const part = async (value: string, category_id: string | null) =>
          (
            await catalog.findOrCreatePart({
              name: `Snap ${value}`,
              category_id,
              identifier: {
                type: 'manufacturer-number',
                brand_id: brand.id,
                value,
              },
              source: 'test',
            })
          ).part_id;
        const car = (code: string, seriesName: string) =>
          createVehicleFixture(catalog, {
            typeCode: `SN${code}`,
            seriesName,
            modelSlug: `snap-${code}`,
            chassisCode: `SC${code}`,
            engineCode: `SE${code}`,
          });
        const a1 = await car('A1', 'Snap A');
        const a2 = await car('A2', 'Snap A');
        const b1 = await car('B1', 'Snap B');
        const c1 = await car('C1', 'Snap C');
        seriesIds.push(a1.series.id, b1.series.id, c1.series.id);
        requiringCarId = a1.vehicle.id;
        const filter = await part('F1', filters.id);
        const shared = await part('F2', filters.id);
        const pad = await part('P1', pads.id);
        const loose = await part('L1', null);
        const replaced = await part('R1', filters.id);
        const successor = await part('R2', filters.id);
        const removed = await part('D1', pads.id);
        await catalog.updateParts({
          id: replaced,
          replaced_by_id: successor,
        });
        await catalog.createFitments([
          { part_id: filter, vehicle_id: a1.vehicle.id },
          { part_id: filter, vehicle_id: a2.vehicle.id },
          { part_id: shared, vehicle_id: a1.vehicle.id },
          { part_id: shared, vehicle_id: b1.vehicle.id },
          { part_id: pad, vehicle_id: b1.vehicle.id },
          { part_id: loose, vehicle_id: a2.vehicle.id },
          { part_id: replaced, vehicle_id: c1.vehicle.id },
          { part_id: successor, vehicle_id: c1.vehicle.id },
          { part_id: removed, vehicle_id: c1.vehicle.id },
        ]);
        const [gone] = await catalog.listFitments({ part_id: removed });
        await catalog.softDeleteFitments([gone.id]);
        await publish.publishAll();
      });

      it('holds no row before its first build', async () => {
        expect(await snapshotRows()).toBe(0);
        expect(await publish.listedSeriesCategoryCounts()).toEqual([]);
      });

      it('answers what walking every Fitment answered, while no Requirement exists', async () => {
        await publish.buildCatalogueSnapshot();

        expect(await publish.hasRequirements()).toBe(false);
        expect(await snapshotRows()).toBeGreaterThan(0);
        await expectParity();
      });

      it('replaces its rows on a rebuild, even two at once', async () => {
        await publish.buildCatalogueSnapshot();
        const before = await snapshotRows();

        await Promise.all([
          publish.buildCatalogueSnapshot(),
          publish.buildCatalogueSnapshot(),
        ]);

        expect(await snapshotRows()).toBe(before);
      });

      it('rebuilds a stale snapshot from the deploy script', async () => {
        await publish.buildCatalogueSnapshot();
        const full = await snapshotRows();
        await pg.raw(
          'delete from listed_series_part where category_id is null',
        );

        await buildCatalogueSnapshotScript({
          container: getContainer(),
          args: [],
        });

        expect(await snapshotRows()).toBe(full);
        await expectParity();
      });

      it('answers what walking every Fitment answered once Requirements exist', async () => {
        const oils = await catalog.createCategories({
          slug: 'snap-oils',
          name: 'Oils',
        });
        const field = await catalog.createCategoryFields({
          category_id: oils.id,
          key: 'viscosity',
          type: 'single-select',
          label: 'viscosity',
          facet: true,
          rank: 0,
        });
        await catalog.createCategoryFieldOptions({
          field_id: field.id,
          key: '5w-30',
          label: '5w-30',
        });
        const [brand] = await catalog.listBrands({ slug: 'snap' });
        for (const value of ['O1', 'O2']) {
          await catalog.findOrCreatePart({
            name: `Snap ${value}`,
            category_id: oils.id,
            attributes: { viscosity: '5w-30' },
            identifier: {
              type: 'manufacturer-number',
              brand_id: brand.id,
              value,
            },
            source: 'test',
          });
        }
        await catalog.createRequirement({
          field_id: field.id,
          option_keys: ['5w-30'],
          min: null,
          max: null,
          quantity: 1,
          vehicle_id: requiringCarId,
        });
        await publish.publishAll();

        await publish.buildCatalogueSnapshot();

        expect(await publish.hasRequirements()).toBe(true);
        expect(
          (await publish.listedSeriesCategoryCounts()).find(
            ({ category_id }) => category_id === oils.id,
          ),
        ).toMatchObject({ parts: 2, fitted: 0, required: 2 });
        await expectParity();
      });
    });
  },
});
