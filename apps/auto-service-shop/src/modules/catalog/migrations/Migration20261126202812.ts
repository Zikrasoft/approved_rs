import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20261126202812 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`SET LOCAL lock_timeout = '5s';`);
    this.addSql(`DROP TRIGGER IF EXISTS "fitment_note_unlink" ON "fitment";`);
    this.addSql(`DROP FUNCTION IF EXISTS fitment_note_unlink();`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_fitment_unlinked_note";`);
  }

  override async down(): Promise<void> {
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_fitment_unlinked_note" ON "fitment" ("id") WHERE note IS NOT NULL AND note_id IS NULL;`,
    );
    this.addSql(
      `CREATE OR REPLACE FUNCTION fitment_note_unlink() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.note IS DISTINCT FROM OLD.note AND NEW.note_id IS NOT DISTINCT FROM OLD.note_id THEN
          NEW.note_id := NULL;
        END IF;
        RETURN NEW;
      END $$;`,
    );
    this.addSql(
      `DROP TRIGGER IF EXISTS "fitment_note_unlink" ON "fitment"; CREATE TRIGGER "fitment_note_unlink" BEFORE UPDATE OF "note" ON "fitment" FOR EACH ROW EXECUTE FUNCTION fitment_note_unlink();`,
    );
  }
}
