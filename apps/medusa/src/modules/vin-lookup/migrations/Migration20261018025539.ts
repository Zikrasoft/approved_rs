import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261018025539 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "vin_lookup" drop constraint if exists "vin_lookup_vin_unique";`,
    );
    this.addSql(
      `create table if not exists "vin_lookup" ("id" text not null, "vin" text not null, "vehicle_id" text not null, "decode_metadata" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "vin_lookup_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vin_lookup_deleted_at" ON "vin_lookup" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_vin_lookup_vin_unique" ON "vin_lookup" ("vin") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "vin_lookup" cascade;`);
  }
}
