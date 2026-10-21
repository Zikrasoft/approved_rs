import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261021113109 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "series" alter column "translated_from" type jsonb using ("translated_from"::jsonb);`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "series" alter column "translated_from" type text using ("translated_from"::text);`,
    );
  }
}
