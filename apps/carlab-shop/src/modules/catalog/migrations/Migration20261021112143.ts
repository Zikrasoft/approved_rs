import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261021112143 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "part" add column if not exists "translations" jsonb null, add column if not exists "translated_from" jsonb null;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "part" drop column if exists "translations", drop column if exists "translated_from";`,
    );
  }
}
