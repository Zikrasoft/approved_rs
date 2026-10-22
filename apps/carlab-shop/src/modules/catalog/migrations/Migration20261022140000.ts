import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261022140000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "category" add column if not exists "image" jsonb null;`,
    );

    this.addSql(
      `alter table if exists "part" add column if not exists "images" jsonb not null default '{"items":[]}';`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "category" drop column if exists "image";`,
    );

    this.addSql(`alter table if exists "part" drop column if exists "images";`);
  }
}
