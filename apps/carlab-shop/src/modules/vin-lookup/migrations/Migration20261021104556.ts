import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261021104556 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "vin_lookup" add column if not exists "decoder" text null, add column if not exists "decoder_version" integer null, add column if not exists "raw" jsonb null, add column if not exists "make" text null, add column if not exists "code" text null;`,
    );
    this.addSql(
      `alter table if exists "vin_lookup" alter column "vehicle_id" type text using ("vehicle_id"::text);`,
    );
    this.addSql(
      `alter table if exists "vin_lookup" alter column "vehicle_id" drop not null;`,
    );
    this.addSql(
      `alter table if exists "vin_lookup" rename column "decode_metadata" to "facts";`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "vin_lookup" drop column if exists "decoder", drop column if exists "decoder_version", drop column if exists "raw", drop column if exists "make", drop column if exists "code";`,
    );

    this.addSql(
      `alter table if exists "vin_lookup" alter column "vehicle_id" type text using ("vehicle_id"::text);`,
    );
    this.addSql(
      `alter table if exists "vin_lookup" alter column "vehicle_id" set not null;`,
    );
    this.addSql(
      `alter table if exists "vin_lookup" rename column "facts" to "decode_metadata";`,
    );
  }
}
