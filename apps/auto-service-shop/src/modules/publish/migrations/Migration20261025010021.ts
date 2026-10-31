import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261025010021 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "catalogue_run" ("id" text not null, "kind" text check ("kind" in ('import', 'publish', 'deletion', 'merge', 'rename')) not null, "supplier_id" text null, "status" text check ("status" in ('running', 'succeeded', 'failed')) not null, "failed_step" text null, "error" text null, "report" jsonb null, "heartbeat_at" timestamptz not null, "finished_at" timestamptz null, "created_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "catalogue_run_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_catalogue_run_deleted_at" ON "catalogue_run" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_catalogue_run_one_running" ON "catalogue_run" ("status") WHERE status = 'running' AND deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_catalogue_run_kind_supplier_id_created_at" ON "catalogue_run" ("kind", "supplier_id", "created_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "published_number" ("id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "published_number_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_published_number_deleted_at" ON "published_number" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "catalogue_run" cascade;`);

    this.addSql(`drop table if exists "published_number" cascade;`);
  }
}
