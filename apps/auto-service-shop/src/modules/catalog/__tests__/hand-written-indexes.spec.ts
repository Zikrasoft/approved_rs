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

      it('keeps a Fitment production range in order', async () => {
        expect(await checks('fitment')).toContain(
          'CHECK ((production_from <= production_to))',
        );
      });
    });
  },
});
