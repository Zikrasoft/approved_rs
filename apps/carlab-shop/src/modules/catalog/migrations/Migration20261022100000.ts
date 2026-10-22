import { Migration } from '@medusajs/framework/mikro-orm/migrations';

const key = (column: string) =>
  `upper(regexp_replace(btrim(normalize("${column}", NFKC)), '\\s+', ' ', 'g'))`;

export class Migration20261022100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `drop index if exists "IDX_brand_spelling_supplier_id_value_key_unique";`,
    );
    this.addSql(
      `alter table if exists "brand_spelling" add column if not exists "value_key" text;`,
    );
    this.addSql(
      `update "brand_spelling" set "value_key" = ${key('value')} where "value_key" is null;`,
    );
    this.addSql(
      `alter table if exists "brand_spelling" alter column "value_key" set not null;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_brand_spelling_supplier_id_value_key_unique" ON "brand_spelling" ("supplier_id", "value_key") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_requirement_owner_field_unique" ON "requirement" ("field_id", "engine_id", "chassis_id", "vehicle_id") NULLS NOT DISTINCT WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_make_name_key_unique" ON "make" (${key('name')}) WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_category_name_key_unique" ON "category" (${key('name')}) WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_series_make_id_name_key_unique" ON "series" ("make_id", ${key('name')}) WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_series_make_id_name_key_unique";`);
    this.addSql(`drop index if exists "IDX_category_name_key_unique";`);
    this.addSql(`drop index if exists "IDX_make_name_key_unique";`);
    this.addSql(`drop index if exists "IDX_requirement_owner_field_unique";`);
    this.addSql(
      `drop index if exists "IDX_brand_spelling_supplier_id_value_key_unique";`,
    );
    this.addSql(
      `alter table if exists "brand_spelling" drop column if exists "value_key";`,
    );
  }
}
