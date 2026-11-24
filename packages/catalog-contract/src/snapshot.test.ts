import { describe, expect, it } from 'vitest';
import type { Fitment } from './fitment.ts';
import {
  catalogueSnapshotResponseSchema,
  compactFitment,
  readCatalogueSnapshot,
  SNAPSHOT_END_LINE,
  snapshotFitmentSchema,
  snapshotSectionLines,
  type SnapshotSection,
} from './snapshot.ts';

const empty = { categories: [], pages: [], fitments: [], vehicles: [] };

const fitment: Fitment = {
  id: 'fit_1',
  part_id: 'part_1',
  vehicle_id: 'veh_1',
  quantity: 1,
  axle: null,
  side: null,
  production_from: null,
  production_to: null,
  gearbox: null,
  steering: null,
  note: null,
  translations: null,
};

const noted: Fitment = {
  ...fitment,
  id: 'fit_2',
  quantity: 2,
  axle: 'front',
  side: 'left',
  production_from: '2015-03-01',
  note: 'Только с «M-пакетом»\nи ксеноном 🚗',
  translations: {
    sr: { note: 'Samo sa „M-paketom”\ni ksenonom' },
    en: { note: 'Only with the M package\nand xenon' },
  },
};

const withoutId = (row: Fitment) =>
  Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'id'));

const streamOf = (text: string, chunk = 7) => {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let at = 0; at < bytes.length; at += chunk) {
        controller.enqueue(bytes.slice(at, at + chunk));
      }
      controller.close();
    },
  });
};

const collect = async (generator: AsyncIterable<string>) => {
  let text = '';
  for await (const part of generator) text += part;
  return text;
};

const written = async (
  sections: Partial<Record<SnapshotSection, unknown[][]>>,
  end = true,
) => {
  let text = '';
  for (const [section, batches] of Object.entries(sections)) {
    text += await collect(
      snapshotSectionLines(section as SnapshotSection, batches),
    );
  }
  return end ? text + SNAPSHOT_END_LINE : text;
};

describe('catalogueSnapshotResponseSchema', () => {
  it('reads a shop that sends a key the storefront does not know yet', () => {
    expect(
      catalogueSnapshotResponseSchema.parse({ ...empty, redirects: [] }),
    ).toEqual({ ...empty, makes: null });
  });

  it('reads a shop that sends every catalogue Make with its site flag', () => {
    expect(
      catalogueSnapshotResponseSchema.parse({
        ...empty,
        makes: [{ slug: 'mini', name: 'MINI', show_on_site: true }],
      }).makes,
    ).toEqual([{ slug: 'mini', name: 'MINI', show_on_site: true }]);
  });

  it('refuses a snapshot missing a section rather than building without it', () => {
    expect(
      catalogueSnapshotResponseSchema.safeParse({
        ...empty,
        vehicles: undefined,
      }).success,
    ).toBe(false);
  });
});

describe('compactFitment', () => {
  it('drops the id, every null and a quantity of one', () => {
    expect(compactFitment(fitment)).toEqual({
      part_id: 'part_1',
      vehicle_id: 'veh_1',
    });
  });

  it('keeps every value that says something', () => {
    expect(compactFitment(noted)).toEqual({
      part_id: 'part_1',
      vehicle_id: 'veh_1',
      quantity: 2,
      axle: 'front',
      side: 'left',
      production_from: '2015-03-01',
      note: noted.note,
      translations: noted.translations,
    });
  });
});

describe('snapshotFitmentSchema', () => {
  it('restores what the compact row left out', () => {
    expect(
      snapshotFitmentSchema.parse({ part_id: 'part_1', vehicle_id: 'veh_1' }),
    ).toEqual(withoutId(fitment));
  });

  it('reads a shop that sends a key, a value and lacks a field the storefront does not know', () => {
    expect(
      snapshotFitmentSchema.parse({
        part_id: 'part_1',
        vehicle_id: 'veh_1',
        axle: 'middle',
        engine_side: 'left',
      }),
    ).toEqual(withoutId(fitment));
  });
});

describe('readCatalogueSnapshot', () => {
  const makes = [{ slug: 'mini', name: 'MINI', show_on_site: true }];

  it('reads back what the shop writes, a note with a newline and unicode cut across chunks included', async () => {
    const text = await written({
      categories: [],
      pages: [[], []],
      fitments: [[compactFitment(fitment)], [compactFitment(noted)]],
      vehicles: [],
      makes: [makes],
    });

    expect(text.split('\n').filter(Boolean)).toHaveLength(7);
    expect(await readCatalogueSnapshot(streamOf(text))).toEqual({
      ...empty,
      fitments: [withoutId(fitment), withoutId(noted)],
      makes,
    });
  });

  it('reads a shop that sends no Makes as null, and skips a section it does not know', async () => {
    const text = await written({
      categories: [],
      pages: [],
      fitments: [],
      vehicles: [],
      redirects: [[{ from: '/a' }]],
    } as Partial<Record<SnapshotSection, unknown[][]>>);

    expect(await readCatalogueSnapshot(streamOf(text, 4096))).toEqual({
      ...empty,
      makes: null,
    });
  });

  it('refuses a snapshot missing a section rather than building without it', async () => {
    const text = await written({ categories: [], pages: [], fitments: [] });

    await expect(readCatalogueSnapshot(streamOf(text))).rejects.toThrow(
      'without vehicles',
    );
  });

  it('refuses a snapshot cut off before its end line', async () => {
    const text = await written(
      { categories: [], pages: [], fitments: [], vehicles: [] },
      false,
    );

    await expect(readCatalogueSnapshot(streamOf(text))).rejects.toThrow(
      'without end',
    );
  });

  it('refuses a batch that breaks the contract', async () => {
    const text = await written({ vehicles: [[{ id: 'veh_1' }]] });

    await expect(readCatalogueSnapshot(streamOf(text))).rejects.toThrow();
  });
});
