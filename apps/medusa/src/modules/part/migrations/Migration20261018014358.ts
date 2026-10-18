import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261018014358 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "supplier" drop constraint if exists "supplier_name_unique";`,
    );
    this.addSql(
      `create table if not exists "supplier" ("id" text not null, "name" text not null, "markup_percentage" integer not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "supplier_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_supplier_name_unique" ON "supplier" ("name") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_supplier_deleted_at" ON "supplier" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `insert into "supplier" ("id", "name", "markup_percentage") select concat('sup_', substr(md5(random()::text || clock_timestamp()::text), 1, 20)), "distinct_suppliers"."supplier", 0 from (select distinct "supplier" from "supplier_offer") as "distinct_suppliers";`,
    );

    this.addSql(
      `alter table if exists "supplier_offer" add column if not exists "supplier_id" text null;`,
    );
    this.addSql(
      `update "supplier_offer" set "supplier_id" = "s"."id" from "supplier" as "s" where "s"."name" = "supplier_offer"."supplier";`,
    );
    this.addSql(
      `alter table if exists "supplier_offer" alter column "supplier_id" set not null;`,
    );
    this.addSql(
      `alter table if exists "supplier_offer" add constraint "supplier_offer_supplier_id_foreign" foreign key ("supplier_id") references "supplier" ("id") on update cascade;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_supplier_offer_supplier_id" ON "supplier_offer" ("supplier_id") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `alter table if exists "supplier_offer" drop column if exists "supplier";`,
    );
    this.addSql(
      `alter table if exists "supplier_offer" rename column "price" to "cost_price";`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "supplier_offer" drop constraint if exists "supplier_offer_supplier_id_foreign";`,
    );

    this.addSql(
      `alter table if exists "supplier_offer" rename column "cost_price" to "price";`,
    );
    this.addSql(
      `alter table if exists "supplier_offer" add column if not exists "supplier" text null;`,
    );
    this.addSql(
      `update "supplier_offer" set "supplier" = "s"."name" from "supplier" as "s" where "s"."id" = "supplier_offer"."supplier_id";`,
    );
    this.addSql(
      `alter table if exists "supplier_offer" alter column "supplier" set not null;`,
    );

    this.addSql(`drop index if exists "IDX_supplier_offer_supplier_id";`);
    this.addSql(
      `alter table if exists "supplier_offer" drop column if exists "supplier_id";`,
    );

    this.addSql(`drop table if exists "supplier" cascade;`);
  }
}
