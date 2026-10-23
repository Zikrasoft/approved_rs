import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261023060342 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "published_number" ("id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "published_number_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_published_number_deleted_at" ON "published_number" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "published_number" cascade;`);
  }
}
