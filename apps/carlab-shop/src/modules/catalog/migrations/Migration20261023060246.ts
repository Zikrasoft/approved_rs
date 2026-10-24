import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261023060246 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "category" add column if not exists "installation_price" integer null;`,
    );

    this.addSql(
      `alter table if exists "part" add column if not exists "installation_price" integer null, add column if not exists "no_installation" boolean not null default false;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "category" drop column if exists "installation_price";`,
    );

    this.addSql(
      `alter table if exists "part" drop column if exists "installation_price", drop column if exists "no_installation";`,
    );
  }
}
