import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261126124539 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "fitment_note" ("id" text not null, "note" text not null, "translations" jsonb null, "translated_from" jsonb null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "fitment_note_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_fitment_note_deleted_at" ON "fitment_note" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `alter table if exists "fitment" add column if not exists "note_id" text null;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "fitment_note" cascade;`);

    this.addSql(
      `alter table if exists "fitment" drop column if exists "note_id";`,
    );
  }
}
