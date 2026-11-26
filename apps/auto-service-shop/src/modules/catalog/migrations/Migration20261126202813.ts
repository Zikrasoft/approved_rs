import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261126202813 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "fitment" drop column if exists "note", drop column if exists "translations", drop column if exists "translated_from";`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "fitment" add column if not exists "note" text null, add column if not exists "translations" jsonb null, add column if not exists "translated_from" jsonb null;`,
    );
  }
}
