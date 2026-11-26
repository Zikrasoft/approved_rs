import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createVehicleFixture } from '../../../../integration-tests/vehicleFixture';
import { CATALOG_MODULE } from '..';
import type CatalogModuleService from '../service';

jest.setTimeout(60_000);

medusaIntegrationTestRunner({
  moduleName: 'fitment_notes',
  testSuite: ({ getContainer }) => {
    describe('Fitment notes', () => {
      let catalog: CatalogModuleService;

      beforeEach(() => {
        catalog = getContainer().resolve(CATALOG_MODULE);
      });

      it('stores a note by its link alone and reads it back with its translations', async () => {
        const { vehicle } = await createVehicleFixture(catalog, {
          typeCode: 'READ',
        });
        const part = await catalog.createParts({ name: 'Part READ' });
        const rows = await catalog.notedFitments([
          { part_id: part.id, vehicle_id: vehicle.id, note: 'Только слева' },
          { part_id: part.id, vehicle_id: vehicle.id, side: 'right' as const },
        ]);
        expect(rows[0]).not.toHaveProperty('note');
        await catalog.createFitments(rows);
        const [note] = await catalog.listFitmentNotes({ note: 'Только слева' });
        await catalog.updateFitmentNotes({
          id: note.id,
          translations: { en: { note: 'Left only' } },
        });

        const read = await catalog.listNotedFitments(
          { part_id: part.id },
          { order: { id: 'ASC' } },
        );

        expect(
          read.map(({ note, note_id, translations }) => ({
            note,
            note_id,
            translations,
          })),
        ).toEqual(
          expect.arrayContaining([
            {
              note: 'Только слева',
              note_id: note.id,
              translations: { en: { note: 'Left only' } },
            },
            { note: null, note_id: null, translations: null },
          ]),
        );
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
