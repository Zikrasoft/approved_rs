import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Knex } from '@medusajs/framework/mikro-orm/knex';

import { createVehicleFixture } from '../../../../integration-tests/vehicleFixture';
import linkFitmentNotesOnce from '../../../migration-scripts/link-fitment-notes';
import { CATALOG_MODULE } from '..';
import { linkFitmentNotes, rawOf } from '../fitment-notes';
import type CatalogModuleService from '../service';

jest.setTimeout(60_000);

medusaIntegrationTestRunner({
  moduleName: 'fitment_notes',
  testSuite: ({ getContainer }) => {
    describe('The Fitment note backfill', () => {
      let catalog: CatalogModuleService;
      const pg = (): Knex =>
        getContainer().resolve(ContainerRegistrationKeys.PG_CONNECTION);

      beforeEach(() => {
        catalog = getContainer().resolve(CATALOG_MODULE);
      });

      const olderFitments = async (typeCode: string) => {
        const { vehicle } = await createVehicleFixture(catalog, { typeCode });
        const part = await catalog.createParts({ name: `Part ${typeCode}` });
        const fitment = (row: Record<string, unknown>) => ({
          part_id: part.id,
          vehicle_id: vehicle.id,
          ...row,
        });
        const translated = {
          translations: { sr: { note: 'Samo sa M paketom' } },
          translated_from: { sr: 'hash-sr' },
        };
        const rows = await catalog.createFitments([
          fitment({ axle: 'front', note: 'Только с M-пакетом' }),
          fitment({ axle: 'rear', note: 'Только с M-пакетом', ...translated }),
          fitment({ side: 'left', note: 'Только слева' }),
          fitment({ side: 'right' }),
        ]);
        return { part, rows, translated };
      };

      const stored = (partId: string) =>
        catalog.listFitments(
          { part_id: partId },
          {
            select: ['id', 'axle', 'side', 'note', 'note_id', 'translations'],
            order: { id: 'ASC' },
          },
        );

      it('moves each distinct note into one Fitment note with its translations, leaving the old columns as they were', async () => {
        const { part, translated } = await olderFitments('BACKFILL');

        await linkFitmentNotesOnce({ container: getContainer() });
        await linkFitmentNotesOnce({ container: getContainer() });

        const notes = await catalog.listFitmentNotes(
          {},
          { select: ['id', 'note', 'translations', 'translated_from'] },
        );
        expect(
          notes
            .map(({ note, translations, translated_from }) => ({
              note,
              translations,
              translated_from,
            }))
            .sort((a, b) => a.note.localeCompare(b.note)),
        ).toEqual([
          { note: 'Только с M-пакетом', ...translated },
          { note: 'Только слева', translations: null, translated_from: null },
        ]);
        const idOf = new Map(notes.map(({ id, note }) => [note, id]));
        const rows = await stored(part.id);
        expect(
          rows.map(({ note, note_id, translations }) => ({
            note,
            note_id,
            translations,
          })),
        ).toEqual(
          expect.arrayContaining([
            {
              note: 'Только с M-пакетом',
              note_id: idOf.get('Только с M-пакетом'),
              translations: null,
            },
            {
              note: 'Только с M-пакетом',
              note_id: idOf.get('Только с M-пакетом'),
              translations: translated.translations,
            },
            {
              note: 'Только слева',
              note_id: idOf.get('Только слева'),
              translations: null,
            },
            { note: null, note_id: null, translations: null },
          ]),
        );
      });

      it('links every Fitment across batches and joins the note a newer image already made', async () => {
        const [existing] = await catalog.createFitmentNotes([
          { note: 'Только слева' },
        ]);
        const { part } = await olderFitments('BATCHES');

        expect(await linkFitmentNotes(rawOf(pg()), 1)).toBe(3);

        const rows = await stored(part.id);
        expect(rows.filter(({ note_id }) => note_id)).toHaveLength(3);
        expect(rows.find(({ note }) => note === 'Только слева')?.note_id).toBe(
          existing.id,
        );
        expect(await linkFitmentNotes(rawOf(pg()), 1)).toBe(0);
      });

      it('reads a note and its translations through the link', async () => {
        const { part } = await olderFitments('READ');
        await catalog.linkFitmentNotes();
        const [note] = await catalog.listFitmentNotes({
          note: 'Только слева',
        });
        await catalog.updateFitmentNotes({
          id: note.id,
          translations: { en: { note: 'Left only' } },
        });

        const read = await catalog.listNotedFitments(
          { part_id: part.id },
          { order: { id: 'ASC' } },
        );

        expect(
          read.map(({ note, translations }) => ({ note, translations })),
        ).toEqual(
          expect.arrayContaining([
            {
              note: 'Только слева',
              translations: { en: { note: 'Left only' } },
            },
            { note: null, translations: null },
          ]),
        );
      });

      it('reads the note an older image wrote until it is linked', async () => {
        const { part } = await olderFitments('UNLINKED');

        const read = await catalog.listNotedFitments(
          { part_id: part.id },
          { order: { id: 'ASC' } },
        );

        expect(
          read.map(({ note, translations }) => ({ note, translations })),
        ).toEqual(
          expect.arrayContaining([
            { note: 'Только с M-пакетом', translations: null },
            {
              note: 'Только с M-пакетом',
              translations: { sr: { note: 'Samo sa M paketom' } },
            },
            { note: 'Только слева', translations: null },
            { note: null, translations: null },
          ]),
        );
      });

      it('unlinks a note an older image rewrote or cleared, and links the new text again', async () => {
        const { part, rows } = await olderFitments('EDITED');
        await catalog.linkFitmentNotes();
        const [front, , left] = rows;

        await catalog.updateFitments([
          { id: front.id, note: 'Только седан' },
          { id: left.id, note: null },
        ]);
        const edited = await stored(part.id);
        const noteOf = (id: string) =>
          edited.find((row) => row.id === id)?.note_id;
        expect(noteOf(front.id)).toBeNull();
        expect(noteOf(left.id)).toBeNull();
        expect(
          (await catalog.listNotedFitments({ id: front.id }))[0].note,
        ).toBe('Только седан');

        await catalog.linkFitmentNotes();

        const [sedan] = await catalog.listFitmentNotes({
          note: 'Только седан',
        });
        const relinked = await stored(part.id);
        expect(relinked.find(({ id }) => id === front.id)?.note_id).toBe(
          sedan.id,
        );
        expect(relinked.find(({ id }) => id === left.id)?.note_id).toBeNull();
      });

      it('creates no note when the Fitment that wanted it fails', async () => {
        const { vehicle } = await createVehicleFixture(catalog, {
          typeCode: 'ROLLBACK',
        });
        const part = await catalog.createParts({ name: 'Part ROLLBACK' });

        await expect(
          catalog.attachPartToVehicles(
            part.id,
            { vehicle_id: vehicle.id },
            { quantity: 0, note: 'Только для отката' },
          ),
        ).rejects.toThrow();

        expect(
          await catalog.listFitmentNotes({ note: 'Только для отката' }),
        ).toEqual([]);
      });
    });
  },
});
