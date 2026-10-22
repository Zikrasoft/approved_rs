import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261022120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "category" add column if not exists "service_label" text null, add column if not exists "service_price" integer null;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "category" drop column if exists "service_label", drop column if exists "service_price";`,
    );
  }
}
