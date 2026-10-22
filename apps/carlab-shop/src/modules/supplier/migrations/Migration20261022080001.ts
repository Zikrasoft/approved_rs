import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261022080001 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_supplier_category_supplier_id_code_key_unique" ON "supplier_category" ("supplier_id", upper(regexp_replace(btrim("code"), '\\s+', ' ', 'g'))) WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `drop index if exists "IDX_supplier_category_supplier_id_code_key_unique";`,
    );
  }
}
