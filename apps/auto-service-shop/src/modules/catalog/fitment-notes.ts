import type { Knex } from '@medusajs/framework/mikro-orm/knex';

export type RawSql = (
  sql: string,
  bindings?: readonly Knex.RawBinding[],
) => PromiseLike<{ rows: Record<string, unknown>[]; rowCount: number }>;

export const rawOf =
  (pg: Knex): RawSql =>
  (sql, bindings = []) =>
    pg.raw(sql, bindings);

const NEW_NOTE_ID = `'fnote_' || replace(gen_random_uuid()::text, '-', '')`;

const CREATE_NOTES = `
  insert into fitment_note (id, note)
  select ${NEW_NOTE_ID}, note from unnest(?::text[]) note
  on conflict (md5(note)) do nothing`;

const NOTES_NAMED = `
  select id, note from fitment_note
  where md5(note) = any(select md5(note) from unnest(?::text[]) note)`;

const FITMENT_INDEXES = [['IDX_fitment_part_all', '("part_id")']] as const;

const VALID_INDEX = `
  select i.indisvalid as valid from pg_index i
  join pg_class c on c.oid = i.indexrelid
  where c.relname = ?`;

export async function noteIdsOf(
  raw: RawSql,
  notes: string[],
): Promise<Map<string, string>> {
  const distinct = [...new Set(notes)];
  if (!distinct.length) return new Map();
  await raw(CREATE_NOTES, [distinct]);
  const { rows } = await raw(NOTES_NAMED, [distinct]);
  return new Map(rows.map((row) => [String(row.note), String(row.id)]));
}

export const linkFitmentNotes = async (_raw: RawSql): Promise<number> => 0;

const indexValidity = async (raw: RawSql, name: string) =>
  (await raw(VALID_INDEX, [name])).rows[0]?.valid as boolean | undefined;

export async function buildFitmentIndexes(raw: RawSql): Promise<void> {
  for (const [name, definition] of FITMENT_INDEXES) {
    if ((await indexValidity(raw, name)) === false) {
      await raw(`DROP INDEX CONCURRENTLY IF EXISTS "${name}"`);
    }
    await raw(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${name}" ON "fitment" ${definition}`,
    );
  }
  if (await indexValidity(raw, 'IDX_fitment_part_all')) {
    await raw(
      'DROP INDEX CONCURRENTLY IF EXISTS "IDX_fitment_part_vehicle_all"',
    );
  }
}
