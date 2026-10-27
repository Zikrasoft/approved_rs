import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261027180000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "crawl_page" ADD COLUMN IF NOT EXISTS "body_key" text NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`ALTER TABLE "crawl_page" DROP COLUMN IF EXISTS "body_key";`);
  }
}
