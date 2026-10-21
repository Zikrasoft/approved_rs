import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261021121943 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "fitment" drop constraint if exists "fitment_identity_unique";`,
    );
    this.addSql(
      `alter table if exists "fitment" add column if not exists "quantity" integer not null default 1, add column if not exists "axle" text check ("axle" in ('front', 'rear')) null, add column if not exists "side" text check ("side" in ('left', 'right')) null, add column if not exists "note" text null, add column if not exists "translations" jsonb null, add column if not exists "translated_from" jsonb null;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_fitment_identity_unique" ON "fitment" ("vehicle_id", "part_id", "axle", "side", "production_from", "production_to", "gearbox", "steering") NULLS NOT DISTINCT WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_fitment_identity_unique";`);
    this.addSql(
      `alter table if exists "fitment" drop column if exists "quantity", drop column if exists "axle", drop column if exists "side", drop column if exists "note", drop column if exists "translations", drop column if exists "translated_from";`,
    );
  }
}
