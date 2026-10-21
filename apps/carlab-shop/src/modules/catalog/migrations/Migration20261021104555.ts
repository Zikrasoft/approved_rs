import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261021104555 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "vehicle_model" drop constraint if exists "vehicle_model_slug_unique";`,
    );
    this.addSql(
      `alter table if exists "chassis" drop constraint if exists "chassis_code_unique";`,
    );
    this.addSql(
      `alter table if exists "make" drop constraint if exists "make_slug_unique";`,
    );
    this.addSql(
      `alter table if exists "engine" drop constraint if exists "engine_code_unique";`,
    );
    this.addSql(
      `create table if not exists "engine" ("id" text not null, "code" text not null, "family" text not null, "fuel" text check ("fuel" in ('petrol', 'diesel', 'hybrid', 'electric')) not null, "displacement_cc" integer null, "source" text not null default 'manual', "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "engine_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_engine_code_unique" ON "engine" ("code") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_engine_deleted_at" ON "engine" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "make" ("id" text not null, "slug" text not null, "name" text not null, "source" text not null default 'manual', "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "make_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_make_slug_unique" ON "make" ("slug") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_make_deleted_at" ON "make" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "series" ("id" text not null, "name" text not null, "translations" jsonb null, "translated_from" text null, "make_id" text not null, "source" text not null default 'manual', "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "series_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_series_make_id" ON "series" ("make_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_series_deleted_at" ON "series" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "chassis" ("id" text not null, "code" text not null, "body_style" text check ("body_style" in ('sedan', 'touring', 'hatchback', 'coupe', 'convertible', 'gran-coupe', 'suv', 'van')) not null, "year_from" integer null, "year_to" integer null, "series_id" text not null, "source" text not null default 'manual', "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "chassis_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_chassis_code_unique" ON "chassis" ("code") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_chassis_series_id" ON "chassis" ("series_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_chassis_deleted_at" ON "chassis" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "vehicle_model" ("id" text not null, "slug" text not null, "name" text not null, "chassis_id" text not null, "source" text not null default 'manual', "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "vehicle_model_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_vehicle_model_slug_unique" ON "vehicle_model" ("slug") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vehicle_model_chassis_id" ON "vehicle_model" ("chassis_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vehicle_model_deleted_at" ON "vehicle_model" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `alter table if exists "series" add constraint "series_make_id_foreign" foreign key ("make_id") references "make" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table if exists "chassis" add constraint "chassis_series_id_foreign" foreign key ("series_id") references "series" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table if exists "vehicle_model" add constraint "vehicle_model_chassis_id_foreign" foreign key ("chassis_id") references "chassis" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table if exists "vehicle_identifier" drop constraint if exists "vehicle_identifier_type_check";`,
    );

    this.addSql(
      `alter table if exists "vehicle" drop column if exists "make", drop column if exists "model", drop column if exists "engine_code";`,
    );

    this.addSql(
      `alter table if exists "vehicle" add column if not exists "model_id" text not null, add column if not exists "engine_id" text not null, add column if not exists "power_kw" integer null, add column if not exists "drive" text check ("drive" in ('rwd', 'fwd', 'awd')) null, add column if not exists "market" text null, add column if not exists "steering" text check ("steering" in ('left', 'right')) null;`,
    );
    this.addSql(
      `alter table if exists "vehicle" add constraint "vehicle_model_id_foreign" foreign key ("model_id") references "vehicle_model" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table if exists "vehicle" add constraint "vehicle_engine_id_foreign" foreign key ("engine_id") references "engine" ("id") on update cascade;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vehicle_model_id" ON "vehicle" ("model_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vehicle_engine_id" ON "vehicle" ("engine_id") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `alter table if exists "vehicle_identifier" add constraint "vehicle_identifier_type_check" check("type" in ('bmw-type-code', 'mercedes-baumuster'));`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "vehicle" drop constraint if exists "vehicle_engine_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "series" drop constraint if exists "series_make_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "chassis" drop constraint if exists "chassis_series_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "vehicle_model" drop constraint if exists "vehicle_model_chassis_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "vehicle" drop constraint if exists "vehicle_model_id_foreign";`,
    );

    this.addSql(`drop table if exists "engine" cascade;`);

    this.addSql(`drop table if exists "make" cascade;`);

    this.addSql(`drop table if exists "series" cascade;`);

    this.addSql(`drop table if exists "chassis" cascade;`);

    this.addSql(`drop table if exists "vehicle_model" cascade;`);

    this.addSql(
      `alter table if exists "vehicle_identifier" drop constraint if exists "vehicle_identifier_type_check";`,
    );

    this.addSql(`drop index if exists "IDX_vehicle_model_id";`);
    this.addSql(`drop index if exists "IDX_vehicle_engine_id";`);
    this.addSql(
      `alter table if exists "vehicle" drop column if exists "model_id", drop column if exists "engine_id", drop column if exists "power_kw", drop column if exists "drive", drop column if exists "market", drop column if exists "steering";`,
    );

    this.addSql(
      `alter table if exists "vehicle" add column if not exists "make" text not null, add column if not exists "model" text not null, add column if not exists "engine_code" text not null;`,
    );

    this.addSql(
      `alter table if exists "vehicle_identifier" add constraint "vehicle_identifier_type_check" check("type" in ('ktype', 'oem-type-code'));`,
    );
  }
}
