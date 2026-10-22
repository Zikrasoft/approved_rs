import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261022130000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "category" add column if not exists "service_note" text null;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "category" drop column if exists "service_note";`,
    );
  }
}
