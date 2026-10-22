import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261022090000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "supplier" add column if not exists "import_enabled" boolean not null default true;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "supplier" drop column if exists "import_enabled";`,
    );
  }
}
