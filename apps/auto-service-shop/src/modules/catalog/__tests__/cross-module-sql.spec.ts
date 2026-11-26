import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Knex } from '@medusajs/framework/mikro-orm/knex';

import {
  CATALOGUE_SNAPSHOT_LOCK,
  FILL_CATALOGUE_SNAPSHOT,
  FILL_FITTED_CATALOGUE_SNAPSHOT,
  LISTED_CATEGORY_PARTS,
  LISTED_FITTED_VEHICLE_PARTS,
  LISTED_SERIES_CATEGORY_COUNTS,
  LISTED_VEHICLE_PARTS,
  ORPHAN_SWEEPS,
  PART_REQUIREMENT_FITS,
  PUBLISH_ALL,
  PUBLISHED_PAGE,
  REFRESH_LISTED,
  UNRESOLVED_VIN_CODES,
} from '../cross-module-sql';

const STATEMENTS: [string, string, Knex.RawBinding[] | Knex.ValueDict][] = [
  ['PUBLISH_ALL', PUBLISH_ALL, []],
  ['REFRESH_LISTED', REFRESH_LISTED, []],
  ['PUBLISHED_PAGE', PUBLISHED_PAGE, [null, null, 10]],
  ...(
    [
      ['FILL_CATALOGUE_SNAPSHOT', FILL_CATALOGUE_SNAPSHOT],
      ['FILL_FITTED_CATALOGUE_SNAPSHOT', FILL_FITTED_CATALOGUE_SNAPSHOT],
      ['LISTED_VEHICLE_PARTS', LISTED_VEHICLE_PARTS],
    ] as [string, string][]
  ).map(([name, sql]): [string, string, Knex.ValueDict] => [
    name,
    sql,
    { series: null, min_matches: 2 },
  ]),
  ['CATALOGUE_SNAPSHOT_LOCK', CATALOGUE_SNAPSHOT_LOCK, []],
  ['LISTED_SERIES_CATEGORY_COUNTS', LISTED_SERIES_CATEGORY_COUNTS, []],
  ['LISTED_CATEGORY_PARTS', LISTED_CATEGORY_PARTS, [[]]],
  ['LISTED_FITTED_VEHICLE_PARTS', LISTED_FITTED_VEHICLE_PARTS, { series: 'x' }],
  ['PART_REQUIREMENT_FITS', PART_REQUIREMENT_FITS, [[]]],
  ['UNRESOLVED_VIN_CODES', UNRESOLVED_VIN_CODES, [[], true, 0, 10]],
  ...ORPHAN_SWEEPS.map((sql, index): [string, string, Knex.RawBinding[]] => [
    `ORPHAN_SWEEPS[${index}]`,
    sql,
    [],
  ]),
];

medusaIntegrationTestRunner({
  moduleName: 'cross_module_sql',
  testSuite: ({ getContainer }) => {
    describe('The SQL other modules run over catalog tables', () => {
      it.each(STATEMENTS)(
        'plans %s against the migrated schema',
        async (_, sql, bindings) => {
          const pg: Knex = getContainer().resolve(
            ContainerRegistrationKeys.PG_CONNECTION,
          );
          const { rows } = await pg.raw(`explain ${sql}`, bindings);

          expect(rows.length).toBeGreaterThan(0);
        },
      );
    });
  },
});
