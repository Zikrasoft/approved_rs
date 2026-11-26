import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261126124540 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_fitment_note_note_unique" ON "fitment_note" (md5("note"));`,
    );
    this.addSql(
      `ALTER TABLE "fitment" DROP CONSTRAINT IF EXISTS "fitment_note_id_foreign", ADD CONSTRAINT "fitment_note_id_foreign" FOREIGN KEY ("note_id") REFERENCES "fitment_note" ("id") ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_fitment_unlinked_note" ON "fitment" ("id") WHERE note IS NOT NULL AND note_id IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_fitment_part_all" ON "fitment" ("part_id");`,
    );
    this.addSql(`DROP INDEX IF EXISTS "IDX_fitment_part_vehicle_all";`);
  }

  override async down(): Promise<void> {
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_fitment_part_vehicle_all" ON "fitment" ("part_id", "vehicle_id");`,
    );
    for (const index of [
      'IDX_fitment_part_all',
      'IDX_fitment_unlinked_note',
      'IDX_fitment_note_note_unique',
    ]) {
      this.addSql(`DROP INDEX IF EXISTS "${index}";`);
    }
    this.addSql(
      `ALTER TABLE "fitment" DROP CONSTRAINT IF EXISTS "fitment_note_id_foreign";`,
    );
  }
}
