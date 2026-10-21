import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261021155847 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "part_identifier" drop constraint if exists "part_identifier_brand_id_normalized_value_unique";`,
    );
    this.addSql(
      `drop index if exists "IDX_part_identifier_type_brand_id_normalized_value_unique";`,
    );

    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_part_identifier_brand_id_normalized_value_unique" ON "part_identifier" ("brand_id", "normalized_value") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `drop index if exists "IDX_part_identifier_brand_id_normalized_value_unique";`,
    );

    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_part_identifier_type_brand_id_normalized_value_unique" ON "part_identifier" ("type", "brand_id", "normalized_value") WHERE deleted_at IS NULL;`,
    );
  }
}
