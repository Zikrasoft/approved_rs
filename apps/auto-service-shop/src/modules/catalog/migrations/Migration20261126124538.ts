import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261126124538 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`SET LOCAL lock_timeout = '5s';`);
  }

  override async down(): Promise<void> {}
}
