import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261023003940 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "supplier_offer" add column if not exists "created_by" text null, add column if not exists "updated_by" text null;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "supplier_offer" drop column if exists "created_by", drop column if exists "updated_by";`,
    );
  }
}
