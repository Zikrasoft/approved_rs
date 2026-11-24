import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Knex } from '@medusajs/framework/mikro-orm/knex';

import {
  LISTED_CATEGORY_PARTS,
  LISTED_MAKE_PART_COUNTS,
  LISTED_SERIES_CATEGORY_COUNTS,
  LISTED_VEHICLE_PARTS,
  ORPHAN_SWEEPS,
  PUBLISH_ALL,
  PUBLISHED_PAGE,
  REFRESH_LISTED,
  UNRESOLVED_VIN_CODES,
} from '../cross-module-sql';

const STATEMENTS: [string, string, Knex.RawBinding[]][] = [
  ['PUBLISH_ALL', PUBLISH_ALL, []],
  ['REFRESH_LISTED', REFRESH_LISTED, []],
  ['PUBLISHED_PAGE', PUBLISHED_PAGE, [null, null, 10]],
  ...(
    [
      ['LISTED_SERIES_CATEGORY_COUNTS', LISTED_SERIES_CATEGORY_COUNTS, []],
      ['LISTED_CATEGORY_PARTS', LISTED_CATEGORY_PARTS, []],
      ['LISTED_VEHICLE_PARTS', LISTED_VEHICLE_PARTS, []],
      ['LISTED_MAKE_PART_COUNTS', LISTED_MAKE_PART_COUNTS, [2, 2]],
    ] as [string, string, Knex.RawBinding[]][]
  ).map(([name, sql, own]): [string, string, Knex.RawBinding[]] => [
    name,
    sql,
    [[], [], 'category', 'category', 'category', 'category', ...own],
  ]),
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
