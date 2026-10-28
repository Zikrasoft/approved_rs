import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261025010101 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "supplier" ALTER COLUMN "markup_percentage" TYPE numeric(5, 2);`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `ALTER TABLE "supplier" ALTER COLUMN "markup_percentage" TYPE real;`,
    );
  }
}
