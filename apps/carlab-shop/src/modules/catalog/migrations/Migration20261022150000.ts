import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261022150000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "part" drop column if exists "images";`);

    this.addSql(
      `alter table if exists "part_identifier" add column if not exists "images" jsonb not null default '{"items":[]}';`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "part" add column if not exists "images" jsonb not null default '{"items":[]}';`,
    );

    this.addSql(
      `alter table if exists "part_identifier" drop column if exists "images";`,
    );
  }
}
