import { Migration } from '@medusajs/framework/mikro-orm/migrations';

const nameKey = (column: string) =>
  `upper(regexp_replace(btrim(normalize("${column}", NFKC)), '\\s+', ' ', 'g'))`;

const TRIGRAM_COLUMNS = [
  ['vehicle_model', 'name'],
  ['part', 'name'],
  ['part_identifier', 'normalized_value'],
] as const;

const trigramIndex = (table: string, column: string) =>
  `IDX_${table}_${column}_trigram`;

export class Migration20261025010100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "fitment" ALTER COLUMN "production_from" TYPE date, ALTER COLUMN "production_to" TYPE date;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_fitment_identity_unique" ON "fitment" ("vehicle_id", "part_id", "axle", "side", "production_from", "production_to", "gearbox", "steering") NULLS NOT DISTINCT WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_requirement_owner_field_unique" ON "requirement" ("field_id", "engine_id", "chassis_id", "vehicle_id") NULLS NOT DISTINCT WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_brand_name_key_unique" ON "brand" (${nameKey('name')}) WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_make_name_key_unique" ON "make" (${nameKey('name')}) WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_category_name_key_unique" ON "category" (${nameKey('name')}) WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_series_make_id_name_key_unique" ON "series" ("make_id", ${nameKey('name')}) WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_fitment_part_vehicle_all" ON "fitment" ("part_id", "vehicle_id");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_fitment_vehicle_all" ON "fitment" ("vehicle_id");`,
    );
    this.addSql(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
    for (const [table, column] of TRIGRAM_COLUMNS) {
      this.addSql(
        `CREATE INDEX IF NOT EXISTS "${trigramIndex(table, column)}" ON "${table}" USING gin ("${column}" gin_trgm_ops);`,
      );
    }
    this.addSql(
      `ALTER TABLE "requirement" ALTER COLUMN "min" TYPE numeric, ALTER COLUMN "max" TYPE numeric;`,
    );
    this.addSql(
      `ALTER TABLE "part" DROP CONSTRAINT IF EXISTS "part_category_id_foreign", ADD CONSTRAINT "part_category_id_foreign" FOREIGN KEY ("category_id") REFERENCES "category" ("id") ON UPDATE CASCADE ON DELETE RESTRICT;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `ALTER TABLE "part" DROP CONSTRAINT IF EXISTS "part_category_id_foreign", ADD CONSTRAINT "part_category_id_foreign" FOREIGN KEY ("category_id") REFERENCES "category" ("id") ON UPDATE CASCADE ON DELETE SET NULL;`,
    );
    this.addSql(
      `ALTER TABLE "requirement" ALTER COLUMN "min" TYPE real, ALTER COLUMN "max" TYPE real;`,
    );
    this.addSql(
      `ALTER TABLE "fitment" ALTER COLUMN "production_from" TYPE timestamptz, ALTER COLUMN "production_to" TYPE timestamptz;`,
    );
    for (const index of [
      'IDX_fitment_identity_unique',
      'IDX_requirement_owner_field_unique',
      'IDX_brand_name_key_unique',
      'IDX_make_name_key_unique',
      'IDX_category_name_key_unique',
      'IDX_series_make_id_name_key_unique',
      'IDX_fitment_part_vehicle_all',
      'IDX_fitment_vehicle_all',
      ...TRIGRAM_COLUMNS.map(([table, column]) => trigramIndex(table, column)),
    ]) {
      this.addSql(`DROP INDEX IF EXISTS "${index}";`);
    }
  }
}
