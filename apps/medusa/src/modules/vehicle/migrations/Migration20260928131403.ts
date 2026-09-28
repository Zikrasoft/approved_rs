import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260928131403 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "vehicle_generation" drop constraint if exists "vehicle_generation_vehicle_model_id_name_unique";`,
    );
    this.addSql(
      `alter table if exists "vehicle_model" drop constraint if exists "vehicle_model_make_id_name_unique";`,
    );
    this.addSql(
      `alter table if exists "vehicle_make" drop constraint if exists "vehicle_make_name_unique";`,
    );
    this.addSql(
      `create table if not exists "vehicle_make" ("id" text not null, "name" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "vehicle_make_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_vehicle_make_name_unique" ON "vehicle_make" ("name") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vehicle_make_deleted_at" ON "vehicle_make" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "vehicle_model" ("id" text not null, "name" text not null, "make_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "vehicle_model_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vehicle_model_make_id" ON "vehicle_model" ("make_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vehicle_model_deleted_at" ON "vehicle_model" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_vehicle_model_make_id_name_unique" ON "vehicle_model" ("make_id", "name") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "vehicle_generation" ("id" text not null, "name" text not null, "year_from" integer not null, "year_to" integer not null, "vehicle_model_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "vehicle_generation_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vehicle_generation_vehicle_model_id" ON "vehicle_generation" ("vehicle_model_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vehicle_generation_deleted_at" ON "vehicle_generation" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_vehicle_generation_vehicle_model_id_name_unique" ON "vehicle_generation" ("vehicle_model_id", "name") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `alter table if exists "vehicle_model" add constraint "vehicle_model_make_id_foreign" foreign key ("make_id") references "vehicle_make" ("id") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table if exists "vehicle_generation" add constraint "vehicle_generation_vehicle_model_id_foreign" foreign key ("vehicle_model_id") references "vehicle_model" ("id") on update cascade on delete cascade;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "vehicle_model" drop constraint if exists "vehicle_model_make_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "vehicle_generation" drop constraint if exists "vehicle_generation_vehicle_model_id_foreign";`,
    );

    this.addSql(`drop table if exists "vehicle_make" cascade;`);

    this.addSql(`drop table if exists "vehicle_model" cascade;`);

    this.addSql(`drop table if exists "vehicle_generation" cascade;`);
  }
}
