import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261021112144 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "publish_run" ("id" text not null, "status" text check ("status" in ('running', 'succeeded', 'failed')) not null, "failed_step" text null, "error" text null, "finished_at" timestamptz null, "created_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "publish_run_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_publish_run_deleted_at" ON "publish_run" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "publish_run" cascade;`);
  }
}
