import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Knex } from '@medusajs/framework/mikro-orm/knex';

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
