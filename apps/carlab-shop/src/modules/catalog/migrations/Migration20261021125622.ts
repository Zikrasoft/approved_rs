import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261021125622 extends Migration {
  override async up(): Promise<void> {
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
      `alter table if exists "category" add column if not exists "maintenance_kit" boolean not null default false, add column if not exists "kit_rank" integer not null default 0;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "requirement" cascade;`);

    this.addSql(
      `alter table if exists "category" drop column if exists "maintenance_kit", drop column if exists "kit_rank";`,
    );
  }
}
