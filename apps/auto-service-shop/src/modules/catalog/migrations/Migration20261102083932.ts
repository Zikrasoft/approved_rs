import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261102083932 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "vehicle_identifier" drop constraint if exists "vehicle_identifier_type_check";`,
    );

    this.addSql(
      `alter table if exists "vehicle_identifier" add constraint "vehicle_identifier_type_check" check("type" in ('bmw-type-code', 'mercedes-baumuster', 'vag-model-code', 'supplier-vehicle-id'));`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "vehicle_identifier" drop constraint if exists "vehicle_identifier_type_check";`,
    );

    this.addSql(
      `alter table if exists "vehicle_identifier" add constraint "vehicle_identifier_type_check" check("type" in ('bmw-type-code', 'mercedes-baumuster', 'supplier-vehicle-id'));`,
    );
  }
}
