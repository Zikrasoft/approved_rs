import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261018010453 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "part_identifier" drop constraint if exists "part_identifier_type_brand_value_unique";`,
    );
    this.addSql(
      `create table if not exists "part" ("id" text not null, "name" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "part_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_part_deleted_at" ON "part" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "part_identifier" ("id" text not null, "type" text check ("type" in ('oem', 'manufacturer-number', 'ean')) not null, "brand" text not null, "value" text not null, "part_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "part_identifier_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_part_identifier_part_id" ON "part_identifier" ("part_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_part_identifier_deleted_at" ON "part_identifier" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_part_identifier_type_brand_value_unique" ON "part_identifier" ("type", "brand", "value") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `create table if not exists "supplier_offer" ("id" text not null, "supplier" text not null, "supplier_article_id" text not null, "price" integer not null, "stock_quantity" integer not null, "lead_time" text not null, "identifier_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "supplier_offer_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_supplier_offer_identifier_id" ON "supplier_offer" ("identifier_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_supplier_offer_deleted_at" ON "supplier_offer" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `alter table if exists "part_identifier" add constraint "part_identifier_part_id_foreign" foreign key ("part_id") references "part" ("id") on update cascade;`,
    );

    this.addSql(
      `alter table if exists "supplier_offer" add constraint "supplier_offer_identifier_id_foreign" foreign key ("identifier_id") references "part_identifier" ("id") on update cascade;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "part_identifier" drop constraint if exists "part_identifier_part_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "supplier_offer" drop constraint if exists "supplier_offer_identifier_id_foreign";`,
    );

    this.addSql(`drop table if exists "part" cascade;`);

    this.addSql(`drop table if exists "part_identifier" cascade;`);

    this.addSql(`drop table if exists "supplier_offer" cascade;`);
  }
}
