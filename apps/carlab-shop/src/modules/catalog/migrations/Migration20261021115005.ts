import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261021115005 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "category_field_option" drop constraint if exists "category_field_option_field_id_key_unique";`,
    );
    this.addSql(
      `alter table if exists "category_field" drop constraint if exists "category_field_category_id_key_unique";`,
    );
    this.addSql(
      `alter table if exists "category" drop constraint if exists "category_slug_unique";`,
    );
    this.addSql(
      `create table if not exists "category" ("id" text not null, "slug" text not null, "name" text not null, "text" text not null default '', "translations" jsonb null, "translated_from" jsonb null, "source" text not null default 'manual', "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "category_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_category_slug_unique" ON "category" ("slug") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_category_deleted_at" ON "category" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "category_field" ("id" text not null, "key" text not null, "type" text check ("type" in ('number', 'single-select', 'multi-select', 'boolean', 'text')) not null, "unit" text null, "label" text not null, "translations" jsonb null, "translated_from" jsonb null, "required" boolean not null default false, "facet" boolean not null default false, "rank" integer not null default 0, "category_id" text not null, "source" text not null default 'manual', "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "category_field_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_category_field_category_id" ON "category_field" ("category_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_category_field_deleted_at" ON "category_field" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_category_field_category_id_key_unique" ON "category_field" ("category_id", "key") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "category_field_option" ("id" text not null, "key" text not null, "label" text not null, "translations" jsonb null, "translated_from" jsonb null, "rank" integer not null default 0, "field_id" text not null, "source" text not null default 'manual', "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "category_field_option_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_category_field_option_field_id" ON "category_field_option" ("field_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_category_field_option_deleted_at" ON "category_field_option" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_category_field_option_field_id_key_unique" ON "category_field_option" ("field_id", "key") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `alter table if exists "category_field" add constraint "category_field_category_id_foreign" foreign key ("category_id") references "category" ("id") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table if exists "category_field_option" add constraint "category_field_option_field_id_foreign" foreign key ("field_id") references "category_field" ("id") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table if exists "part" add column if not exists "category_id" text null, add column if not exists "attributes" jsonb not null default '{}';`,
    );
    this.addSql(
      `alter table if exists "part" add constraint "part_category_id_foreign" foreign key ("category_id") references "category" ("id") on update cascade on delete set null;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_part_category_id" ON "part" ("category_id") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "category_field" drop constraint if exists "category_field_category_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "part" drop constraint if exists "part_category_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "category_field_option" drop constraint if exists "category_field_option_field_id_foreign";`,
    );

    this.addSql(`drop table if exists "category" cascade;`);

    this.addSql(`drop table if exists "category_field" cascade;`);

    this.addSql(`drop table if exists "category_field_option" cascade;`);

    this.addSql(`drop index if exists "IDX_part_category_id";`);
    this.addSql(
      `alter table if exists "part" drop column if exists "category_id", drop column if exists "attributes";`,
    );
  }
}
