import type { Knex } from '@medusajs/framework/mikro-orm/knex';

const NEW_NOTE_ID = `'fnote_' || replace(gen_random_uuid()::text, '-', '')`;

const CREATE_NOTES = `
  insert into fitment_note (id, note)
  select ${NEW_NOTE_ID}, note from unnest(?::text[]) note
  on conflict (md5(note)) do nothing`;

const NOTES_NAMED = `
  select id, note from fitment_note
  where md5(note) = any(select md5(note) from unnest(?::text[]) note)`;

const CREATE_UNLINKED_NOTES = `
  insert into fitment_note (id, note, translations, translated_from)
  select ${NEW_NOTE_ID}, note, translations, translated_from from (
    select distinct on (md5(note)) note, translations, translated_from
    from fitment where note is not null and note_id is null
    order by md5(note), translated_from is null, translations is null, id
  ) unlinked
  on conflict (md5(note)) do nothing`;

const LINK_NOTES = `
  update fitment f set note_id = n.id
  from fitment_note n
  where f.id in (
    select id from fitment where note is not null and note_id is null
    order by id limit ?
  ) and md5(n.note) = md5(f.note) and n.note = f.note`;

export const LINK_BATCH = 20_000;

export async function noteIdsOf(
  pg: Knex,
  notes: string[],
): Promise<Map<string, string>> {
  const distinct = [...new Set(notes)];
  if (!distinct.length) return new Map();
  await pg.raw(CREATE_NOTES, [distinct]);
  const { rows } = await pg.raw(NOTES_NAMED, [distinct]);
  return new Map(
    rows.map((row: { id: string; note: string }) => [row.note, row.id]),
  );
}

export async function linkFitmentNotes(
  pg: Knex,
  batch = LINK_BATCH,
): Promise<number> {
  await pg.raw(CREATE_UNLINKED_NOTES);
  let linked = 0;
  for (;;) {
    const { rowCount } = await pg.raw(LINK_NOTES, [batch]);
    linked += rowCount;
    if (rowCount < batch) return linked;
  }
}
