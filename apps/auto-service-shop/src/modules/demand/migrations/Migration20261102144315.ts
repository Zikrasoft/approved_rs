import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261102144315 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "demand_receipt" ("id" text not null, "day" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "demand_receipt_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_demand_receipt_deleted_at" ON "demand_receipt" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_demand_receipt_day" ON "demand_receipt" ("day") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "missed_query" ("id" text not null, "query" text not null, "day" text not null, "count" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "missed_query_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_missed_query_deleted_at" ON "missed_query" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_missed_query_day" ON "missed_query" ("day") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "part_demand_day" ("id" text not null, "part_identifier_id" text not null, "day" text not null, "inquiries" integer not null default 0, "orders" integer not null default 0, "picks" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "part_demand_day_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_part_demand_day_deleted_at" ON "part_demand_day" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_part_demand_day_day" ON "part_demand_day" ("day") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "demand_receipt" cascade;`);

    this.addSql(`drop table if exists "missed_query" cascade;`);

    this.addSql(`drop table if exists "part_demand_day" cascade;`);
  }
}
