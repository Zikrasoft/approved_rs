import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261031224105 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "vin_lookup" add column if not exists "code_type" text null;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "vin_lookup" drop column if exists "code_type";`,
    );
  }
}
