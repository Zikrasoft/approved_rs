import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261102083933 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "vin_lookup" drop constraint if exists "vin_lookup_code_type_check";`,
    );

    this.addSql(
      `alter table if exists "vin_lookup" add constraint "vin_lookup_code_type_check" check("code_type" in ('bmw-type-code', 'mercedes-baumuster', 'vag-model-code', 'supplier-vehicle-id'));`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "vin_lookup" drop constraint if exists "vin_lookup_code_type_check";`,
    );

    this.addSql(
      `alter table if exists "vin_lookup" add constraint "vin_lookup_code_type_check" check("code_type" in ('bmw-type-code', 'mercedes-baumuster', 'supplier-vehicle-id'));`,
    );
  }
}
