import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261112063539 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vin_lookup_scrub_due" ON "vin_lookup" ("updated_at") WHERE vin IS NOT NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vin_lookup_hit_visitor_scrub_due" ON "vin_lookup_hit" ("created_at") WHERE visitor_id IS NOT NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_vin_lookup_hit_visitor_scrub_due";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_vin_lookup_scrub_due";`);
  }
}
