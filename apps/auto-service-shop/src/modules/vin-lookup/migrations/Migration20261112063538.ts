import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261112063538 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "vin_lookup" drop constraint if exists "vin_lookup_vin_unique";`,
    );
    this.addSql(
      `create table if not exists "vin_lookup" ("id" text not null, "vin" text null, "wmi" text null, "decoder" text null, "decoder_version" integer null, "raw" jsonb null, "facts" jsonb not null, "make_key" text null, "code" text null, "code_type" text check ("code_type" in ('bmw-type-code', 'mercedes-baumuster', 'vag-model-code', 'supplier-vehicle-id')) null, "vehicle_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "vin_lookup_pkey" primary key ("id"), constraint vin_lookup_code_type_needs_code check (code_type is null or code is not null));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vin_lookup_deleted_at" ON "vin_lookup" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_vin_lookup_vin_unique" ON "vin_lookup" ("vin") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vin_lookup_vehicle_id" ON "vin_lookup" ("vehicle_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vin_lookup_make_key_code" ON "vin_lookup" ("make_key", "code") WHERE vehicle_id IS NULL AND deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "vin_lookup_hit" ("id" text not null, "vin_lookup_id" text not null, "source" text check ("source" in ('storefront', 'workshop-quote', 'admin')) not null, "bot" boolean null, "visitor_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "vin_lookup_hit_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vin_lookup_hit_vin_lookup_id" ON "vin_lookup_hit" ("vin_lookup_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vin_lookup_hit_deleted_at" ON "vin_lookup_hit" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vin_lookup_hit_visitor_id" ON "vin_lookup_hit" ("visitor_id") WHERE visitor_id IS NOT NULL AND deleted_at IS NULL;`,
    );

    this.addSql(
      `alter table if exists "vin_lookup_hit" add constraint "vin_lookup_hit_vin_lookup_id_foreign" foreign key ("vin_lookup_id") references "vin_lookup" ("id") on update cascade on delete cascade;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "vin_lookup_hit" drop constraint if exists "vin_lookup_hit_vin_lookup_id_foreign";`,
    );

    this.addSql(`drop table if exists "vin_lookup" cascade;`);

    this.addSql(`drop table if exists "vin_lookup_hit" cascade;`);
  }
}
