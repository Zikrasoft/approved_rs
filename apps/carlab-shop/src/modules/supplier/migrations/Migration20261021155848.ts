import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261021155848 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "supplier" add column if not exists "created_by" text null, add column if not exists "updated_by" text null;`,
    );
    this.addSql(
      `alter table if exists "supplier" alter column "markup_percentage" type real using ("markup_percentage"::real);`,
    );

    this.addSql(
      `alter table if exists "supplier_category" add column if not exists "created_by" text null, add column if not exists "updated_by" text null;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "supplier" drop column if exists "created_by", drop column if exists "updated_by";`,
    );

    this.addSql(
      `alter table if exists "supplier" alter column "markup_percentage" type integer using ("markup_percentage"::integer);`,
    );

    this.addSql(
      `alter table if exists "supplier_category" drop column if exists "created_by", drop column if exists "updated_by";`,
    );
  }
}
