import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261027120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "crawl_run" DROP CONSTRAINT IF EXISTS "crawl_run_status_check";`,
    );
    this.addSql(
      `ALTER TABLE "crawl_run" ADD CONSTRAINT "crawl_run_status_check" CHECK ("status" IN ('queued', 'running', 'paused', 'done'));`,
    );
    this.addSql(
      `ALTER TABLE "crawl_run" ADD COLUMN IF NOT EXISTS "queued_at" timestamptz NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`ALTER TABLE "crawl_run" DROP COLUMN IF EXISTS "queued_at";`);
    this.addSql(
      `UPDATE "crawl_run" SET "status" = 'paused' WHERE "status" = 'queued';`,
    );
    this.addSql(
      `ALTER TABLE "crawl_run" DROP CONSTRAINT IF EXISTS "crawl_run_status_check";`,
    );
    this.addSql(
      `ALTER TABLE "crawl_run" ADD CONSTRAINT "crawl_run_status_check" CHECK ("status" IN ('running', 'paused', 'done'));`,
    );
  }
}
