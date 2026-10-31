import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Knex } from '@medusajs/framework/mikro-orm/knex';
import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';

type SnapshotTable = {
  name: string;
  columns: Record<string, { name: string; type: string; nullable: boolean }>;
  indexes: { keyName: string }[];
  checks: { name: string }[];
  foreignKeys: Record<string, { constraintName: string }>;
};

const snapshotTables = (): SnapshotTable[] =>
  globSync('*/migrations/.snapshot-*.json', {
    cwd: path.resolve(__dirname, '../..'),
  }).flatMap(
    (file) =>
      JSON.parse(readFileSync(path.resolve(__dirname, '../..', file), 'utf8'))
        .tables as SnapshotTable[],
  );

const UDT_OF: Record<string, string> = {
  integer: 'int4',
  real: 'float4',
  boolean: 'bool',
  'text[]': '_text',
};

const HAND_WRITTEN_TYPES: Record<string, string> = {
  'supplier.markup_percentage': 'numeric',
  'fitment.production_from': 'date',
  'fitment.production_to': 'date',
  'requirement.min': 'numeric',
  'requirement.max': 'numeric',
};

const columnSignature = (type: string, nullable: boolean) =>
  `${type} ${nullable ? 'null' : 'not null'}`;

medusaIntegrationTestRunner({
  moduleName: 'hand_written_indexes',
  testSuite: ({ getContainer }) => {
    const pg = (): Knex =>
      getContainer().resolve(ContainerRegistrationKeys.PG_CONNECTION);

    describe('The catalog indexes the generator cannot express', () => {
      const definition = async (name: string): Promise<string> => {
        const { rows } = await pg().raw(
          'select indexdef from pg_indexes where indexname = ?',
          [name],
        );
        return rows[0]?.indexdef ?? '';
      };

      it.each([
        'IDX_fitment_identity_unique',
        'IDX_requirement_owner_field_unique',
      ])('keeps %s unique across NULL columns', async (name) => {
        expect(await definition(name)).toMatch(
          /^CREATE UNIQUE INDEX .* NULLS NOT DISTINCT WHERE \(deleted_at IS NULL\)$/,
        );
      });

      it.each([
        'IDX_brand_name_key_unique',
        'IDX_make_name_key_unique',
        'IDX_category_name_key_unique',
        'IDX_series_make_id_name_key_unique',
      ])('keeps %s on the NFKC-normalised name', async (name) => {
        expect(await definition(name)).toMatch(
          /^CREATE UNIQUE INDEX .*upper\(regexp_replace\(btrim\(NORMALIZE\(name, NFKC\)\)/,
        );
      });

      it.each(['IDX_fitment_part_vehicle_all', 'IDX_fitment_vehicle_all'])(
        'keeps %s over tombstoned Fitments too',
        async (name) => {
          expect(await definition(name)).toMatch(/^CREATE INDEX .*btree/);
          expect(await definition(name)).not.toContain('WHERE');
        },
      );

      it.each([
        'IDX_vehicle_model_name_trigram',
        'IDX_part_name_trigram',
        'IDX_part_identifier_normalized_value_trigram',
      ])('keeps %s for substring search', async (name) => {
        expect(await definition(name)).toMatch(/USING gin .*gin_trgm_ops/);
      });

      it('finds a Part by its whole description', async () => {
        expect(await definition('IDX_part_description_hash')).toMatch(
          /USING hash \(description\)/,
        );
      });
    });

    describe('The hot lookups', () => {
      const plan = async (sql: string) => {
        const trx = await pg().transaction();
        await trx.raw('set local enable_seqscan = off');
        const { rows } = await trx.raw(`explain ${sql}`);
        await trx.rollback();
        return JSON.stringify(rows);
      };

      it.each([
        [
          'a tombstone-aware Fitment',
          `select id from fitment where part_id = 'p' and vehicle_id in ('v')`,
          /Index.*IDX_fitment_(part_vehicle|vehicle)_all/,
        ],
        [
          'a decoded Vehicle identifier',
          `select vehicle_id from vehicle_identifier where type = 'bmw-type-code' and value = 'X' and supplier_id is null and deleted_at is null`,
          /Index.*IDX_vehicle_identifier_type_value_vehicle_id_unique/,
        ],
        [
          'the unresolved VIN codes',
          `select make, code, count(*) from vin_lookup where vehicle_id is null and code is not null and deleted_at is null group by make, code`,
          /Index.*IDX_vin_lookup_make_code/,
        ],
        [
          'the VIN lookups of a Vehicle',
          `select id from vin_lookup where vehicle_id in ('v') and deleted_at is null`,
          /Index.*IDX_vin_lookup_vehicle_id/,
        ],
      ])('finds %s by an index', async (_, sql, index) => {
        expect(await plan(sql)).toMatch(index);
      });
    });

    describe('The column types the generator cannot express', () => {
      const columnType = async (table: string, column: string) => {
        const { rows } = await pg().raw(
          `select format_type(atttypid, atttypmod) as type from pg_attribute
           where attrelid = ?::regclass and attname = ? and not attisdropped`,
          [table, column],
        );
        return rows[0]?.type ?? null;
      };

      it('keeps the Supplier markup an exact decimal', async () => {
        expect(await columnType('supplier', 'markup_percentage')).toBe(
          'numeric(5,2)',
        );
      });

      it.each(['production_from', 'production_to'])(
        'keeps the Fitment %s a calendar date',
        async (column) => {
          expect(await columnType('fitment', column)).toBe('date');
        },
      );

      it.each(['min', 'max'])(
        'keeps the Requirement %s an exact decimal',
        async (column) => {
          expect(await columnType('requirement', column)).toBe('numeric');
        },
      );

      it('keeps no page body in the crawl table', async () => {
        expect(await columnType('crawl_page', 'body')).toBeNull();
      });
    });

    describe('The migrated schema', () => {
      const tables = snapshotTables();
      const namesOf = (rows: Record<string, string>[], column: string) =>
        rows.map((row) => row[column]);

      it('reads every module snapshot', () => {
        expect(tables.map(({ name }) => name)).toEqual(
          expect.arrayContaining([
            'fitment',
            'supplier',
            'catalogue_run',
            'vin_lookup',
          ]),
        );
      });

      it.each(tables.map((table) => [table.name, table] as const))(
        'builds %s exactly as its snapshot says',
        async (name, table) => {
          const { rows: columns } = await pg().raw(
            `select column_name, udt_name, is_nullable from information_schema.columns
             where table_schema = 'public' and table_name = ?`,
            [name],
          );
          const { rows: indexes } = await pg().raw(
            `select indexname from pg_indexes where schemaname = 'public' and tablename = ?`,
            [name],
          );
          const { rows: constraints } = await pg().raw(
            'select conname from pg_constraint where conrelid = ?::regclass',
            [name],
          );

          expect(
            Object.fromEntries(
              columns.map((column: Record<string, string>) => [
                column.column_name,
                columnSignature(column.udt_name, column.is_nullable === 'YES'),
              ]),
            ),
          ).toEqual(
            Object.fromEntries(
              Object.values(table.columns).map((column) => [
                column.name,
                columnSignature(
                  HAND_WRITTEN_TYPES[`${name}.${column.name}`] ??
                    UDT_OF[column.type] ??
                    column.type,
                  column.nullable,
                ),
              ]),
            ),
          );
          expect(namesOf(indexes, 'indexname')).toEqual(
            expect.arrayContaining(table.indexes.map(({ keyName }) => keyName)),
          );
          expect(namesOf(constraints, 'conname')).toEqual(
            expect.arrayContaining([
              ...table.checks.map((check) => check.name),
              ...Object.values(table.foreignKeys).map(
                (key) => key.constraintName,
              ),
            ]),
          );
        },
      );
    });

    describe('The checks on catalog rows', () => {
      const checks = async (table: string) => {
        const { rows } = await pg().raw(
          `select pg_get_constraintdef(oid) as definition from pg_constraint
           where conrelid = ?::regclass and contype = 'c'`,
          [table],
        );
        return rows.map((row: { definition: string }) => row.definition);
      };

      it('gives a Requirement exactly one target', async () => {
        expect(await checks('requirement')).toContain(
          'CHECK ((num_nonnulls(engine_id, chassis_id, vehicle_id) = 1))',
        );
      });

      it('refuses to delete a Category a Part still uses', async () => {
        const { rows } = await pg().raw(
          `select confdeltype from pg_constraint where conname = 'part_category_id_foreign'`,
        );
        expect(rows).toEqual([{ confdeltype: 'r' }]);
      });

      it('keeps a Fitment production range in order', async () => {
        expect(await checks('fitment')).toContain(
          'CHECK ((production_from <= production_to))',
        );
      });
    });
  },
});
