import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261021114447 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "part" add column if not exists "replaced_by_id" text null;`,
    );
    this.addSql(
      `alter table if exists "part" add constraint "part_replaced_by_id_foreign" foreign key ("replaced_by_id") references "part" ("id") on update cascade on delete set null;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_part_replaced_by_id" ON "part" ("replaced_by_id") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `alter table if exists "part_identifier" add column if not exists "superseded" boolean not null default false;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "part" drop constraint if exists "part_replaced_by_id_foreign";`,
    );

    this.addSql(`drop index if exists "IDX_part_replaced_by_id";`);
    this.addSql(
      `alter table if exists "part" drop column if exists "replaced_by_id";`,
    );

    this.addSql(
      `alter table if exists "part_identifier" drop column if exists "superseded";`,
    );
  }
}
