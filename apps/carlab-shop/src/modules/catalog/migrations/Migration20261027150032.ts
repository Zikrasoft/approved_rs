import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261027150032 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "engine" alter column "fuel" type text using ("fuel"::text);`,
    );
    this.addSql(
      `alter table if exists "engine" alter column "fuel" drop not null;`,
    );

    this.addSql(
      `alter table if exists "part" add column if not exists "source_name" text null;`,
    );

    this.addSql(
      `alter table if exists "chassis" alter column "body_style" type text using ("body_style"::text);`,
    );
    this.addSql(
      `alter table if exists "chassis" alter column "body_style" drop not null;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "engine" alter column "fuel" type text using ("fuel"::text);`,
    );
    this.addSql(
      `alter table if exists "engine" alter column "fuel" set not null;`,
    );

    this.addSql(
      `alter table if exists "part" drop column if exists "source_name";`,
    );

    this.addSql(
      `alter table if exists "chassis" alter column "body_style" type text using ("body_style"::text);`,
    );
    this.addSql(
      `alter table if exists "chassis" alter column "body_style" set not null;`,
    );
  }
}
