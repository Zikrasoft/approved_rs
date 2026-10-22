import { Migration } from '@medusajs/framework/mikro-orm/migrations';

const key = (column: string) =>
  `upper(regexp_replace(btrim("${column}"), '\\s+', ' ', 'g'))`;

export class Migration20261022080000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_brand_spelling_supplier_id_value_key_unique" ON "brand_spelling" ("supplier_id", ${key('value')}) WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_brand_name_key_unique" ON "brand" (${key('name')}) WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `drop index if exists "IDX_brand_spelling_supplier_id_value_key_unique";`,
    );
    this.addSql(`drop index if exists "IDX_brand_name_key_unique";`);
  }
}
