import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261027152133 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "part" add column if not exists "edited_fields" text[] not null default '{}';`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "part" drop column if exists "edited_fields";`,
    );
  }
}
