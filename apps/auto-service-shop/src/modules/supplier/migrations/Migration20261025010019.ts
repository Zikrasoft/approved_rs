import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261025010019 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "supplier_offer" drop constraint if exists "supplier_offer_supplier_id_supplier_article_id_unique";`,
    );
    this.addSql(
      `alter table if exists "supplier_category" drop constraint if exists "supplier_category_supplier_id_code_key_unique";`,
    );
    this.addSql(
      `alter table if exists "supplier_category" drop constraint if exists "supplier_category_supplier_id_code_unique";`,
    );
    this.addSql(
      `alter table if exists "staged_record" drop constraint if exists "staged_record_supplier_id_part_identifier_id_kind_unique";`,
    );
    this.addSql(
      `alter table if exists "supplier" drop constraint if exists "supplier_name_unique";`,
    );
    this.addSql(
      `create table if not exists "supplier" ("id" text not null, "name" text not null, "markup_percentage" real not null, "released_kinds" text[] not null default '{}', "import_enabled" boolean not null default true, "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "supplier_pkey" primary key ("id"), constraint supplier_markup_percentage check (markup_percentage >= 0));`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_supplier_name_unique" ON "supplier" ("name") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_supplier_deleted_at" ON "supplier" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "staged_record" ("id" text not null, "supplier_id" text not null, "part_identifier_id" text not null, "kind" text check ("kind" in ('cross_references', 'applicability', 'images')) not null, "payload" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "staged_record_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_staged_record_supplier_id" ON "staged_record" ("supplier_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_staged_record_part_identifier_id" ON "staged_record" ("part_identifier_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_staged_record_deleted_at" ON "staged_record" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_staged_record_supplier_id_part_identifier_id_kind_unique" ON "staged_record" ("supplier_id", "part_identifier_id", "kind") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "supplier_category" ("id" text not null, "supplier_id" text not null, "code" text not null, "code_key" text not null, "category_id" text not null, "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "supplier_category_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_supplier_category_supplier_id" ON "supplier_category" ("supplier_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_supplier_category_category_id" ON "supplier_category" ("category_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_supplier_category_deleted_at" ON "supplier_category" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_supplier_category_supplier_id_code_unique" ON "supplier_category" ("supplier_id", "code") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_supplier_category_supplier_id_code_key_unique" ON "supplier_category" ("supplier_id", "code_key") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "supplier_offer" ("id" text not null, "supplier_id" text not null, "supplier_article_id" text not null, "cost_price" integer not null, "currency" text not null default 'RSD', "stock_quantity" integer not null, "stock_by_location" jsonb not null default '{}', "lead_time_days" integer not null, "part_identifier_id" text not null, "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "supplier_offer_pkey" primary key ("id"), constraint supplier_offer_cost_price check (cost_price >= 0), constraint supplier_offer_stock check (stock_quantity >= 0), constraint supplier_offer_lead_time check (lead_time_days >= 0), constraint supplier_offer_currency check (currency similar to '[A-Z]{3}'));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_supplier_offer_supplier_id" ON "supplier_offer" ("supplier_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_supplier_offer_part_identifier_id" ON "supplier_offer" ("part_identifier_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_supplier_offer_deleted_at" ON "supplier_offer" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_supplier_offer_supplier_id_supplier_article_id_unique" ON "supplier_offer" ("supplier_id", "supplier_article_id") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `alter table if exists "staged_record" add constraint "staged_record_supplier_id_foreign" foreign key ("supplier_id") references "supplier" ("id") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table if exists "supplier_category" add constraint "supplier_category_supplier_id_foreign" foreign key ("supplier_id") references "supplier" ("id") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table if exists "supplier_offer" add constraint "supplier_offer_supplier_id_foreign" foreign key ("supplier_id") references "supplier" ("id") on update cascade on delete cascade;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "staged_record" drop constraint if exists "staged_record_supplier_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "supplier_category" drop constraint if exists "supplier_category_supplier_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "supplier_offer" drop constraint if exists "supplier_offer_supplier_id_foreign";`,
    );

    this.addSql(`drop table if exists "supplier" cascade;`);

    this.addSql(`drop table if exists "staged_record" cascade;`);

    this.addSql(`drop table if exists "supplier_category" cascade;`);

    this.addSql(`drop table if exists "supplier_offer" cascade;`);
  }
}
