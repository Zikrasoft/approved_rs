import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261025190000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "crawl_run" ADD COLUMN IF NOT EXISTS "pages_left" integer NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`ALTER TABLE "crawl_run" DROP COLUMN IF EXISTS "pages_left";`);
  }
}
