import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261021105515 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "part_identifier" drop constraint if exists "part_identifier_type_brand_id_normalized_value_unique";`,
    );
    this.addSql(
      `alter table if exists "brand_spelling" drop constraint if exists "brand_spelling_supplier_id_value_unique";`,
    );
    this.addSql(
      `alter table if exists "brand" drop constraint if exists "brand_slug_unique";`,
    );
    this.addSql(
      `alter table if exists "brand" drop constraint if exists "brand_name_unique";`,
    );
    this.addSql(
      `create table if not exists "brand" ("id" text not null, "name" text not null, "slug" text not null, "source" text not null default 'manual', "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "brand_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_brand_name_unique" ON "brand" ("name") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_brand_slug_unique" ON "brand" ("slug") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_brand_deleted_at" ON "brand" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "brand_spelling" ("id" text not null, "supplier_id" text not null, "value" text not null, "brand_id" text not null, "source" text not null default 'manual', "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "brand_spelling_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_brand_spelling_brand_id" ON "brand_spelling" ("brand_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_brand_spelling_deleted_at" ON "brand_spelling" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_brand_spelling_supplier_id_value_unique" ON "brand_spelling" ("supplier_id", "value") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `alter table if exists "brand_spelling" add constraint "brand_spelling_brand_id_foreign" foreign key ("brand_id") references "brand" ("id") on update cascade on delete cascade;`,
    );

    this.addSql(
      `drop index if exists "IDX_part_identifier_type_brand_value_unique";`,
    );

    this.addSql(
      `alter table if exists "part_identifier" add column if not exists "brand_id" text not null;`,
    );
    this.addSql(
      `alter table if exists "part_identifier" add constraint "part_identifier_brand_id_foreign" foreign key ("brand_id") references "brand" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table if exists "part_identifier" drop column if exists "brand";`,
    );
    this.addSql(
      `alter table if exists "part_identifier" add column if not exists "normalized_value" text not null;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_part_identifier_brand_id" ON "part_identifier" ("brand_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_part_identifier_type_brand_id_normalized_value_unique" ON "part_identifier" ("type", "brand_id", "normalized_value") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "brand_spelling" drop constraint if exists "brand_spelling_brand_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "part_identifier" drop constraint if exists "part_identifier_brand_id_foreign";`,
    );

    this.addSql(`drop table if exists "brand" cascade;`);

    this.addSql(`drop table if exists "brand_spelling" cascade;`);

    this.addSql(`drop index if exists "IDX_part_identifier_brand_id";`);
    this.addSql(
      `drop index if exists "IDX_part_identifier_type_brand_id_normalized_value_unique";`,
    );
    this.addSql(
      `alter table if exists "part_identifier" drop column if exists "brand_id";`,
    );

    this.addSql(
      `alter table if exists "part_identifier" drop column if exists "normalized_value";`,
    );
    this.addSql(
      `alter table if exists "part_identifier" add column if not exists "brand" text not null;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_part_identifier_type_brand_value_unique" ON "part_identifier" ("type", "brand", "value") WHERE deleted_at IS NULL;`,
    );
  }
}
