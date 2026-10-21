import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261021101944 extends Migration {
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
      `create table if not exists "supplier_offer" ("id" text not null, "supplier_id" text not null, "supplier_article_id" text not null, "cost_price" integer not null, "stock_quantity" integer not null, "lead_time" text not null, "part_identifier_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "supplier_offer_pkey" primary key ("id"));`,
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
      `alter table if exists "supplier_offer" add constraint "supplier_offer_supplier_id_foreign" foreign key ("supplier_id") references "supplier" ("id") on update cascade;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "supplier_offer" drop constraint if exists "supplier_offer_supplier_id_foreign";`,
    );

    this.addSql(`drop table if exists "supplier" cascade;`);

    this.addSql(`drop table if exists "supplier_offer" cascade;`);
  }
}
