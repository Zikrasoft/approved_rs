import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261022100001 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `drop index if exists "IDX_supplier_category_supplier_id_code_key_unique";`,
    );
    this.addSql(
      `alter table if exists "supplier_category" add column if not exists "code_key" text;`,
    );
    this.addSql(
      `update "supplier_category" set "code_key" = upper(regexp_replace(btrim(normalize("code", NFKC)), '\\s+', ' ', 'g')) where "code_key" is null;`,
    );
    this.addSql(
      `alter table if exists "supplier_category" alter column "code_key" set not null;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_supplier_category_supplier_id_code_key_unique" ON "supplier_category" ("supplier_id", "code_key") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `drop index if exists "IDX_supplier_category_supplier_id_code_key_unique";`,
    );
    this.addSql(
      `alter table if exists "supplier_category" drop column if exists "code_key";`,
    );
  }
}
