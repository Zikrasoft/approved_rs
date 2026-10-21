import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261021101943 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "vehicle_identifier" drop constraint if exists "vehicle_identifier_type_value_unique";`,
    );
    this.addSql(
      `alter table if exists "part_identifier" drop constraint if exists "part_identifier_type_brand_value_unique";`,
    );
    this.addSql(
      `create table if not exists "part" ("id" text not null, "name" text not null, "source" text not null default 'manual', "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "part_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_part_deleted_at" ON "part" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "part_identifier" ("id" text not null, "type" text check ("type" in ('oem', 'manufacturer-number', 'ean')) not null, "brand" text not null, "value" text not null, "part_id" text not null, "source" text not null default 'manual', "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "part_identifier_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_part_identifier_part_id" ON "part_identifier" ("part_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_part_identifier_deleted_at" ON "part_identifier" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_part_identifier_type_brand_value_unique" ON "part_identifier" ("type", "brand", "value") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "vehicle" ("id" text not null, "make" text not null, "model" text not null, "engine_code" text not null, "year_from" integer null, "year_to" integer null, "source" text not null default 'manual', "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "vehicle_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vehicle_deleted_at" ON "vehicle" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "fitment" ("id" text not null, "part_id" text not null, "vehicle_id" text not null, "production_from" timestamptz null, "production_to" timestamptz null, "steering" text check ("steering" in ('left', 'right')) null, "gearbox" text check ("gearbox" in ('manual', 'automatic')) null, "source" text not null default 'manual', "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "fitment_pkey" primary key ("id"));`,
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
      `create table if not exists "vehicle_identifier" ("id" text not null, "type" text check ("type" in ('ktype', 'oem-type-code')) not null, "value" text not null, "vehicle_id" text not null, "source" text not null default 'manual', "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "vehicle_identifier_pkey" primary key ("id"));`,
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
      `alter table if exists "part_identifier" add constraint "part_identifier_part_id_foreign" foreign key ("part_id") references "part" ("id") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table if exists "fitment" add constraint "fitment_part_id_foreign" foreign key ("part_id") references "part" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table if exists "fitment" add constraint "fitment_vehicle_id_foreign" foreign key ("vehicle_id") references "vehicle" ("id") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table if exists "vehicle_identifier" add constraint "vehicle_identifier_vehicle_id_foreign" foreign key ("vehicle_id") references "vehicle" ("id") on update cascade on delete cascade;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "part_identifier" drop constraint if exists "part_identifier_part_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "fitment" drop constraint if exists "fitment_part_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "fitment" drop constraint if exists "fitment_vehicle_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "vehicle_identifier" drop constraint if exists "vehicle_identifier_vehicle_id_foreign";`,
    );

    this.addSql(`drop table if exists "part" cascade;`);

    this.addSql(`drop table if exists "part_identifier" cascade;`);

    this.addSql(`drop table if exists "vehicle" cascade;`);

    this.addSql(`drop table if exists "fitment" cascade;`);

    this.addSql(`drop table if exists "vehicle_identifier" cascade;`);
  }
}
