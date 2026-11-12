import { Migration } from '@medusajs/framework/mikro-orm/migrations';

const withoutMarks = (column: string) =>
  `regexp_replace(normalize("${column}", NFKD), '[\\u0300-\\u036f]', '', 'g')`;

const nameKey = (column: string) =>
  `upper(btrim(regexp_replace(${withoutMarks(column)}, '[\\s._-]+', ' ', 'g')))`;

const codeKey = `upper(regexp_replace(${withoutMarks('code')}, '[\\s.-]+', '', 'g'))`;

const TRIGRAM_COLUMNS = [
  ['vehicle_model', 'name'],
  ['part', 'name'],
  ['part_identifier', 'normalized_value'],
] as const;

const trigramIndex = (table: string, column: string) =>
  `IDX_${table}_${column}_trigram`;

export class Migration20261112045155 extends Migration {
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
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_engine_code_key_unique" ON "engine" (${codeKey}) WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_chassis_series_id_code_key_unique" ON "chassis" ("series_id", ${codeKey}) WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_slug_redirect_kind_scope_id_from_slug_unique" ON "slug_redirect" ("kind", "scope_id", "from_slug") NULLS NOT DISTINCT WHERE kind <> 'part' AND deleted_at IS NULL;`,
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
      `CREATE INDEX IF NOT EXISTS "IDX_part_description_hash" ON "part" USING hash ("description");`,
    );
    this.addSql(
      `ALTER TABLE "requirement" ALTER COLUMN "min" TYPE numeric, ALTER COLUMN "max" TYPE numeric;`,
    );
    this.addSql(
      `ALTER TABLE "part" DROP CONSTRAINT IF EXISTS "part_category_id_foreign", ADD CONSTRAINT "part_category_id_foreign" FOREIGN KEY ("category_id") REFERENCES "category" ("id") ON UPDATE CASCADE ON DELETE RESTRICT;`,
    );
    this.addSql(
      `ALTER TABLE "vehicle" DROP CONSTRAINT IF EXISTS "vehicle_engine_id_foreign", ADD CONSTRAINT "vehicle_engine_id_foreign" FOREIGN KEY ("engine_id") REFERENCES "engine" ("id") ON UPDATE CASCADE ON DELETE RESTRICT;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `ALTER TABLE "vehicle" DROP CONSTRAINT IF EXISTS "vehicle_engine_id_foreign", ADD CONSTRAINT "vehicle_engine_id_foreign" FOREIGN KEY ("engine_id") REFERENCES "engine" ("id") ON UPDATE CASCADE ON DELETE SET NULL;`,
    );
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
      'IDX_engine_code_key_unique',
      'IDX_chassis_series_id_code_key_unique',
      'IDX_requirement_owner_field_unique',
      'IDX_brand_name_key_unique',
      'IDX_make_name_key_unique',
      'IDX_category_name_key_unique',
      'IDX_series_make_id_name_key_unique',
      'IDX_slug_redirect_kind_scope_id_from_slug_unique',
      'IDX_fitment_part_vehicle_all',
      'IDX_fitment_vehicle_all',
      'IDX_part_description_hash',
      ...TRIGRAM_COLUMNS.map(([table, column]) => trigramIndex(table, column)),
    ]) {
      this.addSql(`DROP INDEX IF EXISTS "${index}";`);
    }
  }
}
