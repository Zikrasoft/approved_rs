import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261025160000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `CREATE TABLE IF NOT EXISTS "crawl_run" ("site" text NOT NULL PRIMARY KEY, "status" text NOT NULL CHECK ("status" IN ('running', 'paused', 'done')), "paused_reason" text NULL, "seeded" boolean NOT NULL DEFAULT false, "started_at" timestamptz NOT NULL, "finished_at" timestamptz NULL);`,
    );
    this.addSql(
      `CREATE TABLE IF NOT EXISTS "crawl_page" ("site" text NOT NULL, "url" text NOT NULL, "status" text NOT NULL DEFAULT 'queued' CHECK ("status" IN ('queued', 'done', 'failed', 'gone')), "attempts" integer NOT NULL DEFAULT 0, "next_attempt_at" timestamptz NOT NULL, "http_status" integer NULL, "error" text NULL, "etag" text NULL, "last_modified" text NULL, "fetched_at" timestamptz NULL, "body" bytea NULL, PRIMARY KEY ("site", "url"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_crawl_page_due" ON "crawl_page" ("site", "next_attempt_at") WHERE "status" = 'queued';`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "crawl_page";`);
    this.addSql(`DROP TABLE IF EXISTS "crawl_run";`);
  }
}
