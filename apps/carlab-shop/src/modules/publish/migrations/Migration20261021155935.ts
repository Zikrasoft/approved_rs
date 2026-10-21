import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261021155935 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_publish_run_one_running" ON "publish_run" ("status") WHERE status = 'running' AND deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_publish_run_one_running";`);
  }
}
