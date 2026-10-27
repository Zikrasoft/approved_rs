import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261028120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "crawl_run" ADD COLUMN IF NOT EXISTS "heartbeat_at" timestamptz NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `ALTER TABLE "crawl_run" DROP COLUMN IF EXISTS "heartbeat_at";`,
    );
  }
}
