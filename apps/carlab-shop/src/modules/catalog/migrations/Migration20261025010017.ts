import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261025010017 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "vehicle_identifier" drop constraint if exists "vehicle_identifier_type_value_unique";`,
    );
    this.addSql(
      `alter table if exists "vehicle_model" drop constraint if exists "vehicle_model_slug_unique";`,
    );
    this.addSql(
      `alter table if exists "chassis" drop constraint if exists "chassis_code_unique";`,
    );
    this.addSql(
      `alter table if exists "part_identifier" drop constraint if exists "part_identifier_brand_id_normalized_value_unique";`,
    );
    this.addSql(
      `alter table if exists "make" drop constraint if exists "make_slug_unique";`,
    );
    this.addSql(
      `alter table if exists "engine" drop constraint if exists "engine_code_unique";`,
    );
    this.addSql(
      `alter table if exists "category_field_option" drop constraint if exists "category_field_option_field_id_key_unique";`,
    );
    this.addSql(
      `alter table if exists "category_field" drop constraint if exists "category_field_category_id_key_unique";`,
    );
    this.addSql(
      `alter table if exists "category" drop constraint if exists "category_slug_unique";`,
    );
    this.addSql(
      `alter table if exists "brand_spelling" drop constraint if exists "brand_spelling_supplier_id_value_key_unique";`,
    );
    this.addSql(
      `alter table if exists "brand_spelling" drop constraint if exists "brand_spelling_supplier_id_value_unique";`,
    );
    this.addSql(
      `alter table if exists "brand" drop constraint if exists "brand_slug_unique";`,
    );
    this.addSql(
      `alter table if exists "brand" drop constraint if exists "brand_name_unique";`,
    );
    this.addSql(
      `create table if not exists "brand" ("id" text not null, "name" text not null, "slug" text not null, "source" text not null default 'manual', "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "brand_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_brand_name_unique" ON "brand" ("name") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_brand_slug_unique" ON "brand" ("slug") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_brand_deleted_at" ON "brand" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "brand_spelling" ("id" text not null, "supplier_id" text not null, "value" text not null, "value_key" text not null, "brand_id" text not null, "source" text not null default 'manual', "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "brand_spelling_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_brand_spelling_brand_id" ON "brand_spelling" ("brand_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_brand_spelling_deleted_at" ON "brand_spelling" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_brand_spelling_supplier_id_value_unique" ON "brand_spelling" ("supplier_id", "value") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_brand_spelling_supplier_id_value_key_unique" ON "brand_spelling" ("supplier_id", "value_key") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "category" ("id" text not null, "slug" text not null, "name" text not null, "text" text not null default '', "image" jsonb null, "translations" jsonb null, "translated_from" jsonb null, "maintenance_kit" boolean not null default false, "kit_rank" integer not null default 0, "service_label" text null, "service_price" integer null, "service_note" text null, "installation_price" integer null, "source" text not null default 'manual', "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "category_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_category_slug_unique" ON "category" ("slug") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_category_deleted_at" ON "category" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "category_field" ("id" text not null, "key" text not null, "type" text check ("type" in ('number', 'single-select', 'multi-select', 'boolean', 'text')) not null, "unit" text null, "label" text not null, "translations" jsonb null, "translated_from" jsonb null, "required" boolean not null default false, "facet" boolean not null default false, "rank" integer not null default 0, "category_id" text not null, "source" text not null default 'manual', "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "category_field_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_category_field_category_id" ON "category_field" ("category_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_category_field_deleted_at" ON "category_field" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_category_field_category_id_key_unique" ON "category_field" ("category_id", "key") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "category_field_option" ("id" text not null, "key" text not null, "label" text not null, "translations" jsonb null, "translated_from" jsonb null, "rank" integer not null default 0, "field_id" text not null, "source" text not null default 'manual', "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "category_field_option_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_category_field_option_field_id" ON "category_field_option" ("field_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_category_field_option_deleted_at" ON "category_field_option" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_category_field_option_field_id_key_unique" ON "category_field_option" ("field_id", "key") WHERE deleted_at IS NULL;`,
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
      `create table if not exists "part" ("id" text not null, "name" text not null, "category_id" text null, "attributes" jsonb not null default '{}', "installation_price" integer null, "no_installation" boolean not null default false, "translations" jsonb null, "translated_from" jsonb null, "replaced_by_id" text null, "source" text not null default 'manual', "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "part_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_part_category_id" ON "part" ("category_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_part_replaced_by_id" ON "part" ("replaced_by_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_part_deleted_at" ON "part" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "part_identifier" ("id" text not null, "type" text check ("type" in ('oem', 'manufacturer-number', 'ean')) not null, "value" text not null, "normalized_value" text not null, "superseded" boolean not null default false, "images" jsonb not null default '{"items":[]}', "brand_id" text not null, "part_id" text not null, "source" text not null default 'manual', "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "part_identifier_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_part_identifier_brand_id" ON "part_identifier" ("brand_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_part_identifier_part_id" ON "part_identifier" ("part_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_part_identifier_deleted_at" ON "part_identifier" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_part_identifier_brand_id_normalized_value_unique" ON "part_identifier" ("brand_id", "normalized_value") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "series" ("id" text not null, "name" text not null, "translations" jsonb null, "translated_from" jsonb null, "make_id" text not null, "source" text not null default 'manual', "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "series_pkey" primary key ("id"));`,
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
      `create table if not exists "vehicle" ("id" text not null, "model_id" text not null, "engine_id" text not null, "power_kw" integer null, "drive" text check ("drive" in ('rwd', 'fwd', 'awd')) null, "market" text null, "year_from" integer null, "year_to" integer null, "steering" text check ("steering" in ('left', 'right')) null, "source" text not null default 'manual', "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "vehicle_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vehicle_model_id" ON "vehicle" ("model_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vehicle_engine_id" ON "vehicle" ("engine_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vehicle_deleted_at" ON "vehicle" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "vehicle_identifier" ("id" text not null, "type" text check ("type" in ('bmw-type-code', 'mercedes-baumuster')) not null, "value" text not null, "vehicle_id" text not null, "source" text not null default 'manual', "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "vehicle_identifier_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vehicle_identifier_vehicle_id" ON "vehicle_identifier" ("vehicle_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vehicle_identifier_deleted_at" ON "vehicle_identifier" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_vehicle_identifier_type_value_unique" ON "vehicle_identifier" ("type", "value") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "requirement" ("id" text not null, "field_id" text not null, "engine_id" text null, "chassis_id" text null, "vehicle_id" text null, "option_keys" text[] null, "min" real null, "max" real null, "quantity" integer not null default 1, "source" text not null default 'manual', "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "requirement_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_requirement_field_id" ON "requirement" ("field_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_requirement_engine_id" ON "requirement" ("engine_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_requirement_chassis_id" ON "requirement" ("chassis_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_requirement_vehicle_id" ON "requirement" ("vehicle_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_requirement_deleted_at" ON "requirement" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "fitment" ("id" text not null, "part_id" text not null, "vehicle_id" text not null, "quantity" integer not null default 1, "axle" text check ("axle" in ('front', 'rear')) null, "side" text check ("side" in ('left', 'right')) null, "production_from" timestamptz null, "production_to" timestamptz null, "steering" text check ("steering" in ('left', 'right')) null, "gearbox" text check ("gearbox" in ('manual', 'automatic')) null, "note" text null, "translations" jsonb null, "translated_from" jsonb null, "source" text not null default 'manual', "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "fitment_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_fitment_part_id" ON "fitment" ("part_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_fitment_vehicle_id" ON "fitment" ("vehicle_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_fitment_deleted_at" ON "fitment" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `alter table if exists "brand_spelling" add constraint "brand_spelling_brand_id_foreign" foreign key ("brand_id") references "brand" ("id") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table if exists "category_field" add constraint "category_field_category_id_foreign" foreign key ("category_id") references "category" ("id") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table if exists "category_field_option" add constraint "category_field_option_field_id_foreign" foreign key ("field_id") references "category_field" ("id") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table if exists "part" add constraint "part_category_id_foreign" foreign key ("category_id") references "category" ("id") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table if exists "part" add constraint "part_replaced_by_id_foreign" foreign key ("replaced_by_id") references "part" ("id") on update cascade on delete set null;`,
    );

    this.addSql(
      `alter table if exists "part_identifier" add constraint "part_identifier_brand_id_foreign" foreign key ("brand_id") references "brand" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table if exists "part_identifier" add constraint "part_identifier_part_id_foreign" foreign key ("part_id") references "part" ("id") on update cascade on delete cascade;`,
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
      `alter table if exists "vehicle" add constraint "vehicle_model_id_foreign" foreign key ("model_id") references "vehicle_model" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table if exists "vehicle" add constraint "vehicle_engine_id_foreign" foreign key ("engine_id") references "engine" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table if exists "vehicle_identifier" add constraint "vehicle_identifier_vehicle_id_foreign" foreign key ("vehicle_id") references "vehicle" ("id") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table if exists "requirement" add constraint "requirement_field_id_foreign" foreign key ("field_id") references "category_field" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table if exists "requirement" add constraint "requirement_engine_id_foreign" foreign key ("engine_id") references "engine" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table if exists "requirement" add constraint "requirement_chassis_id_foreign" foreign key ("chassis_id") references "chassis" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table if exists "requirement" add constraint "requirement_vehicle_id_foreign" foreign key ("vehicle_id") references "vehicle" ("id") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table if exists "fitment" add constraint "fitment_part_id_foreign" foreign key ("part_id") references "part" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table if exists "fitment" add constraint "fitment_vehicle_id_foreign" foreign key ("vehicle_id") references "vehicle" ("id") on update cascade on delete cascade;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "brand_spelling" drop constraint if exists "brand_spelling_brand_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "part_identifier" drop constraint if exists "part_identifier_brand_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "category_field" drop constraint if exists "category_field_category_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "part" drop constraint if exists "part_category_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "category_field_option" drop constraint if exists "category_field_option_field_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "requirement" drop constraint if exists "requirement_field_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "vehicle" drop constraint if exists "vehicle_engine_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "requirement" drop constraint if exists "requirement_engine_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "series" drop constraint if exists "series_make_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "part" drop constraint if exists "part_replaced_by_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "part_identifier" drop constraint if exists "part_identifier_part_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "fitment" drop constraint if exists "fitment_part_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "chassis" drop constraint if exists "chassis_series_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "vehicle_model" drop constraint if exists "vehicle_model_chassis_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "requirement" drop constraint if exists "requirement_chassis_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "vehicle" drop constraint if exists "vehicle_model_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "vehicle_identifier" drop constraint if exists "vehicle_identifier_vehicle_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "requirement" drop constraint if exists "requirement_vehicle_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "fitment" drop constraint if exists "fitment_vehicle_id_foreign";`,
    );

    this.addSql(`drop table if exists "brand" cascade;`);

    this.addSql(`drop table if exists "brand_spelling" cascade;`);

    this.addSql(`drop table if exists "category" cascade;`);

    this.addSql(`drop table if exists "category_field" cascade;`);

    this.addSql(`drop table if exists "category_field_option" cascade;`);

    this.addSql(`drop table if exists "engine" cascade;`);

    this.addSql(`drop table if exists "make" cascade;`);

    this.addSql(`drop table if exists "part" cascade;`);

    this.addSql(`drop table if exists "part_identifier" cascade;`);

    this.addSql(`drop table if exists "series" cascade;`);

    this.addSql(`drop table if exists "chassis" cascade;`);

    this.addSql(`drop table if exists "vehicle_model" cascade;`);

    this.addSql(`drop table if exists "vehicle" cascade;`);

    this.addSql(`drop table if exists "vehicle_identifier" cascade;`);

    this.addSql(`drop table if exists "requirement" cascade;`);

    this.addSql(`drop table if exists "fitment" cascade;`);
  }
}
