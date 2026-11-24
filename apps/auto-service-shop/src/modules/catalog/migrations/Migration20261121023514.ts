import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261121023514 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "make" add column if not exists "show_on_site" boolean not null default false;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "make" drop column if exists "show_on_site";`,
    );
  }
}
