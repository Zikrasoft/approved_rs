import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Knex } from '@medusajs/framework/mikro-orm/knex';
import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { schemaProblems, SNAPSHOT_TABLES } from '../../../lib/schema-check';
import { codeKey, nameKey } from '../../_shared/keys';
import orderTimeIndexes from '../../../migration-scripts/order-time-indexes';
import checkSchema from '../../../scripts/check-schema';

const snapshotTableNames = (): string[] =>
  globSync('*/migrations/.snapshot-*.json', {
    cwd: path.resolve(__dirname, '../..'),
  }).flatMap((file) =>
    JSON.parse(
      readFileSync(path.resolve(__dirname, '../..', file), 'utf8'),
    ).tables.map(({ name }: { name: string }) => name),
  );

medusaIntegrationTestRunner({
  moduleName: 'hand_written_indexes',
  testSuite: ({ getContainer }) => {
    const pg = (): Knex =>
      getContainer().resolve(ContainerRegistrationKeys.PG_CONNECTION);

    describe('The hot lookups', () => {
      const plan = async (sql: string) => {
        const trx = await pg().transaction();
        await trx.raw('set local session_replication_role = replica');
        await trx.raw(
          `insert into vehicle_identifier (id, type, value, vehicle_id, source)
           select 'vi' || g, 'bmw-type-code', 'V' || g, 'v', 'feed' from generate_series(1, 1000) g`,
        );
        await trx.raw('analyze vehicle_identifier');
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
          `select make_key, code, count(*) from vin_lookup where vehicle_id is null and code is not null and deleted_at is null group by make_key, code`,
          /Index.*IDX_vin_lookup_make_key_code/,
        ],
        [
          'the VIN lookups of a Vehicle',
          `select id from vin_lookup where vehicle_id in ('v') and deleted_at is null`,
          /Index.*IDX_vin_lookup_vehicle_id/,
        ],
        [
          'whether a VIN code has its Vehicle',
          `select 1 from vehicle_identifier vi where vi.type = 'bmw-type-code' and vi.value = 'X' and vi.supplier_id is null and vi.deleted_at is null`,
          /Index.*IDX_vehicle_identifier_type_value_vehicle_id_unique/,
        ],
      ])('finds %s by an index', async (_, sql, index) => {
        expect(await plan(sql)).toMatch(index);
      });
    });

    describe('The migrated schema', () => {
      const problemsAfter = async (...statements: string[]) => {
        const trx = await pg().transaction();
        try {
          for (const statement of statements) await trx.raw(statement);
          return await schemaProblems(trx);
        } finally {
          await trx.rollback();
        }
      };

      beforeEach(async () => {
        await orderTimeIndexes({ container: getContainer() });
      });

      it('checks every module snapshot', () => {
        expect(SNAPSHOT_TABLES.map(({ name }) => name).sort()).toEqual(
          snapshotTableNames().sort(),
        );
      });

      it('finds nothing wrong with a freshly migrated database', async () => {
        expect(await schemaProblems(pg())).toEqual([]);
      });

      it('lets a deploy through a database the migrations built', async () => {
        await expect(
          checkSchema({ container: getContainer(), args: [] }),
        ).resolves.toBeUndefined();
      });

      it('stops a deploy on a database the migrations did not build, naming each problem', async () => {
        await pg().raw('drop index "IDX_part_description_hash"');

        await expect(
          checkSchema({ container: getContainer(), args: [] }),
        ).rejects.toThrow(
          'The database schema is not what the migrations build:\nIDX_part_description_hash is missing',
        );
      });

      it.each([
        [
          'a missing hand-written column type',
          ['alter table fitment drop column production_to'],
          'fitment.production_to: expected date, found nothing',
        ],
        [
          'a missing generated index',
          ['drop index "IDX_fitment_source"'],
          'fitment: index IDX_fitment_source is missing',
        ],
        [
          'a missing generated check',
          ['alter table fitment drop constraint fitment_quantity_positive'],
          'fitment: constraint fitment_quantity_positive is missing',
        ],
        [
          'a missing column',
          ['alter table vin_lookup drop column wmi'],
          'vin_lookup.wmi: expected text null, found nothing',
        ],
        [
          'a column the migrations do not create',
          ['alter table crawl_page add column body text'],
          'crawl_page.body: column not in the migrations',
        ],
        [
          'a missing table',
          ['drop table crawl_run'],
          'crawl_run: table is missing',
        ],
        [
          'a column left at the generated type',
          ['alter table requirement alter column min type real'],
          'requirement.min: expected numeric, found real',
        ],
        [
          'a retired-slug index left unique over nulls',
          [
            'drop index "IDX_slug_redirect_kind_scope_id_from_slug_unique"',
            `create unique index "IDX_slug_redirect_kind_scope_id_from_slug_unique" on slug_redirect (kind, scope_id, from_slug) where kind <> 'part' and deleted_at is null`,
          ],
          expect.stringMatching(
            /^IDX_slug_redirect_kind_scope_id_from_slug_unique is defined as/,
          ),
        ],
        [
          'a missing hand-written index',
          ['drop index "IDX_part_description_hash"'],
          'IDX_part_description_hash is missing',
        ],
        [
          'a hand-written index built the generated way',
          [
            'drop index "IDX_fitment_vehicle_all"',
            'create index "IDX_fitment_vehicle_all" on fitment (vehicle_id) where deleted_at is null',
          ],
          expect.stringMatching(
            /^IDX_fitment_vehicle_all is defined as .*WHERE/,
          ),
        ],
        [
          'a foreign key left at the generated action',
          [
            'alter table part drop constraint part_category_id_foreign, add constraint part_category_id_foreign foreign key (category_id) references category (id) on delete set null',
          ],
          expect.stringMatching(
            /^part_category_id_foreign is defined as .*SET NULL/,
          ),
        ],
        [
          'an order index the migration script did not build',
          ['drop index "IDX_order_created_at"'],
          'IDX_order_created_at is missing',
        ],
      ])('reports %s', async (_, statements, problem) => {
        expect(await problemsAfter(...statements)).toContainEqual(problem);
      });
    });

    describe('The checks on catalog rows', () => {
      const refusal = async (table: string, row: Record<string, unknown>) => {
        const trx = await pg().transaction();
        try {
          await trx.raw('set local session_replication_role = replica');
          await trx(table).insert(row);
          return null;
        } catch (error) {
          return (error as { constraint?: string }).constraint;
        } finally {
          await trx.rollback();
        }
      };
      const requirement = (row: Record<string, unknown>) => ({
        id: 'r',
        field_id: 'f',
        vehicle_id: 'v',
        ...row,
      });

      it.each([
        [
          'fitment',
          { id: 'f', part_id: 'p', vehicle_id: 'v', quantity: 0 },
          'fitment_quantity_positive',
        ],
        [
          'fitment',
          {
            id: 'f',
            part_id: 'p',
            vehicle_id: 'v',
            production_from: '2020-02-01',
            production_to: '2020-01-01',
          },
          'fitment_production_ordered',
        ],
        [
          'requirement',
          requirement({ min: 1, quantity: 0 }),
          'requirement_quantity_positive',
        ],
        [
          'requirement',
          requirement({ min: 5, max: 1 }),
          'requirement_bounds_ordered',
        ],
        [
          'requirement',
          requirement({ option_keys: ['a'], min: 1 }),
          'requirement_options_or_bounds',
        ],
        ['requirement', requirement({}), 'requirement_options_or_bounds'],
        [
          'requirement',
          requirement({ option_keys: [], max: 1, vehicle_id: null }),
          'requirement_one_target',
        ],
        [
          'vehicle',
          {
            id: 'v',
            slug: 'v',
            model_id: 'm',
            engine_id: 'e',
            year_from: 2010,
            year_to: 2009,
          },
          'vehicle_years_ordered',
        ],
        [
          'chassis',
          {
            id: 'c',
            code: 'c',
            series_id: 's',
            year_from: 2010,
            year_to: 2009,
          },
          'chassis_years_ordered',
        ],
        [
          'category',
          { id: 'c', slug: 'c', name: 'c', service_price: -1 },
          'category_service_price',
        ],
        [
          'category',
          { id: 'c', slug: 'c', name: 'c', installation_price: -1 },
          'category_installation_price',
        ],
        [
          'part',
          { id: 'p', name: 'p', installation_price: -1 },
          'part_installation_price',
        ],
        [
          'supplier',
          {
            id: 's',
            key: 'varta',
            name: 's',
            markup_percentage: 10,
            released_kinds: ['prices'],
          },
          'supplier_released_kinds',
        ],
        [
          'supplier',
          { id: 's', key: 'varta', name: 's', markup_percentage: -1 },
          'supplier_markup_percentage',
        ],
        [
          'supplier',
          { id: 's', key: 'Varta', name: 's', markup_percentage: 0 },
          'supplier_key_check',
        ],
        [
          'vin_lookup',
          { id: 'l', facts: {}, code_type: 'bmw-type-code' },
          'vin_lookup_code_type_needs_code',
        ],
        [
          'part',
          { id: 'p', name: 'p', replaced_by_id: 'p' },
          'part_not_replaced_by_itself',
        ],
        [
          'vin_lookup',
          { id: 'l', facts: {}, code: 'X', code_type: 'bogus' },
          'vin_lookup_code_type_check',
        ],
        [
          'part_identifier',
          {
            id: 'pi',
            type: 'oem',
            value: 'w 712',
            normalized_value: 'W 712',
            brand_id: 'b',
            part_id: 'p',
          },
          'part_identifier_normalized_value_key',
        ],
        [
          'rejected_number',
          { id: 'r', brand_id: 'b', normalized_value: '' },
          'rejected_number_normalized_value_key',
        ],
      ])('refuses a %s row breaking %#', async (table, row, constraint) => {
        expect(await refusal(table, row)).toBe(constraint);
      });

      it.each([
        ['fitment', { id: 'f', part_id: 'p', vehicle_id: 'v', quantity: 2 }],
        ['requirement', requirement({ option_keys: ['a'] })],
        ['requirement', requirement({ option_keys: [], min: 1, max: 1 })],
        [
          'vehicle',
          {
            id: 'v',
            slug: 'v',
            model_id: 'm',
            engine_id: 'e',
            year_from: 2010,
          },
        ],
        [
          'supplier',
          {
            id: 's',
            key: 'varta',
            name: 's',
            markup_percentage: 0,
            released_kinds: ['images'],
          },
        ],
        ['vin_lookup', { id: 'l', facts: {}, code: 'X', code_type: null }],
        ['vehicle', { id: 'v', slug: 'v', model_id: 'm', engine_id: null }],
      ])('accepts a valid %s row', async (table, row) => {
        expect(await refusal(table, row)).toBeNull();
      });

      it('refuses a second redirect from the same Part slug', async () => {
        const redirect = {
          kind: 'part',
          from_id: 'pi',
          from_slug: 'oil-filter-123',
        };
        await pg()('slug_redirect').insert({ id: 'sr1', ...redirect });
        await expect(
          pg()('slug_redirect').insert({ id: 'sr2', ...redirect }),
        ).rejects.toMatchObject({
          constraint: 'IDX_slug_redirect_kind_from_slug_unique',
        });
        await pg()('slug_redirect').where({ id: 'sr1' }).delete();
      });

      const secondRefusal = async (
        table: string,
        first: Record<string, unknown>,
        second: Record<string, unknown>,
      ) => {
        const trx = await pg().transaction();
        try {
          await trx.raw('set local session_replication_role = replica');
          await trx(table).insert(first);
          await trx(table).insert(second);
          return null;
        } catch (error) {
          return (error as { constraint?: string }).constraint;
        } finally {
          await trx.rollback();
        }
      };
      const engine = (id: string, code: string) => ({
        id,
        code,
        family: 'N47',
      });
      const chassis = (id: string, code: string, series_id = 's') => ({
        id,
        code,
        series_id,
      });
      const rejected = (id: string) => ({
        id,
        brand_id: 'b',
        normalized_value: 'W71295',
      });
      const retired = (
        id: string,
        kind: string,
        scope_id: string | null,
        deleted_at: string | null = null,
      ) => ({
        id,
        kind,
        from_id: `${id}-row`,
        from_slug: 'oil-filters',
        scope_id,
        deleted_at,
      });
      const spelling = (id: string, value: string, value_key: string) => ({
        id,
        supplier_id: 's',
        value,
        value_key,
        brand_id: 'b',
      });

      it.each([
        [
          'an engine code spelled with a space and a hyphen',
          'engine',
          engine('e1', 'N47 D20'),
          engine('e2', 'n47-d20'),
          'IDX_engine_code_key_unique',
        ],
        [
          'a chassis code of one series spelled another way',
          'chassis',
          chassis('c1', 'E90'),
          chassis('c2', 'e 90'),
          'IDX_chassis_series_id_code_key_unique',
        ],
        [
          'a Category slug retired twice',
          'slug_redirect',
          retired('sr1', 'category', null),
          retired('sr2', 'category', null),
          'IDX_slug_redirect_kind_scope_id_from_slug_unique',
        ],
        [
          'a Model slug retired twice under one Make',
          'slug_redirect',
          retired('sr1', 'model', 'make_1'),
          retired('sr2', 'model', 'make_1'),
          'IDX_slug_redirect_kind_scope_id_from_slug_unique',
        ],
        [
          'a number already rejected for the Brand',
          'rejected_number',
          rejected('r1'),
          rejected('r2'),
          'IDX_rejected_number_brand_id_normalized_value_unique',
        ],
      ])('refuses %s', async (_, table, first, second, constraint) => {
        expect(await secondRefusal(table, first, second)).toBe(constraint);
      });

      it.each([
        [
          'one chassis code in two series',
          'chassis',
          chassis('c1', 'E90', 's1'),
          chassis('c2', 'E90', 's2'),
        ],
        [
          'one Model slug retired under two Makes',
          'slug_redirect',
          retired('sr1', 'model', 'make_1'),
          retired('sr2', 'model', 'make_2'),
        ],
        [
          'a slug retired again after its redirect was deleted',
          'slug_redirect',
          retired('sr1', 'category', null, '2026-01-01'),
          retired('sr2', 'category', null),
        ],
        [
          'a Brand spelling key taken by the value check alone',
          'brand_spelling',
          spelling('bs1', 'MANN', 'MANN'),
          spelling('bs2', 'MANN', 'MANN-FILTER'),
        ],
      ])('accepts %s', async (_, table, first, second) => {
        expect(await secondRefusal(table, first, second)).toBeNull();
      });

      it.each([
        ['Lemförder', 'LEMFORDER'],
        ['Citroën', 'citroen'],
        ['MANN-FILTER', 'mann filter'],
        ['Febi  Bilstein', 'FEBI.BILSTEIN'],
        ['Ｂｏｓｃｈ', 'BOSCH'],
        ['Blue Print', 'Blueprint'],
        ['Febi', 'Febi Bilstein'],
      ])('keys Brand names %j and %j the way nameKey does', async (a, b) => {
        const brand = (id: string, name: string) => ({ id, name, slug: id });
        expect(
          await secondRefusal('brand', brand('b1', a), brand('b2', b)),
        ).toBe(nameKey(a) === nameKey(b) ? 'IDX_brand_name_key_unique' : null);
      });

      it.each([
        ['N47 D20', 'n47-d20'],
        ['OM 654.920', 'OM654920'],
        ['E90/E91', 'E90E91'],
        ['N47', 'N57'],
      ])('keys engine codes %j and %j the way codeKey does', async (a, b) => {
        expect(
          await secondRefusal('engine', engine('e1', a), engine('e2', b)),
        ).toBe(codeKey(a) === codeKey(b) ? 'IDX_engine_code_key_unique' : null);
      });

      it('refuses a second global alias with one key', async () => {
        const alias = (id: string, brand_id: string) => ({
          id,
          supplier_id: null,
          value: 'febi bilstein',
          value_key: 'FEBI BILSTEIN',
          brand_id,
        });
        expect(
          await secondRefusal(
            'brand_spelling',
            alias('a1', 'b1'),
            alias('a2', 'b2'),
          ),
        ).toBe('IDX_brand_spelling_value_key_unique');
      });

      it.each([
        ['brand', 'IDX_brand_name_unique'],
        ['brand_spelling', 'IDX_brand_spelling_supplier_id_value_unique'],
        ['make_spelling', 'IDX_make_spelling_supplier_id_value_unique'],
        ['engine', 'IDX_engine_code_unique'],
        ['chassis', 'IDX_chassis_series_id_code_unique'],
      ])(
        'keeps no raw unique index on %s beside its key',
        async (table, index) => {
          const { rows } = await pg().raw(
            'select indexname from pg_indexes where tablename = ?',
            [table],
          );
          expect(
            rows.map(({ indexname }: { indexname: string }) => indexname),
          ).not.toContain(index);
        },
      );
    });
  },
});
