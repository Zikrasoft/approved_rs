import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261126120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "listed_series_part" ("series_id" text not null, "category_id" text null, "part_id" text not null, "fitted" boolean not null, "required" boolean not null);`,
    );
    this.addSql(
      `create index if not exists "IDX_listed_series_part_series" on "listed_series_part" ("series_id");`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "listed_series_part";`);
  }
}
