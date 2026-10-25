import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Knex } from '@medusajs/framework/mikro-orm/knex';

medusaIntegrationTestRunner({
  moduleName: 'hand_written_indexes',
  testSuite: ({ getContainer }) => {
    describe('The catalog indexes the generator cannot express', () => {
      const definition = async (name: string): Promise<string> => {
        const pg: Knex = getContainer().resolve(
          ContainerRegistrationKeys.PG_CONNECTION,
        );
        const { rows } = await pg.raw(
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
      ])('keeps %s on the normalised name', async (name) => {
        expect(await definition(name)).toMatch(
          /^CREATE UNIQUE INDEX .*upper\(regexp_replace\(btrim\(/,
        );
      });
    });
  },
});
