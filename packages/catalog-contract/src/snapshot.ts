import { z } from 'zod';
import { categorySchema, translationsSchema } from './categories.ts';
import { fitmentSchema, type Fitment } from './fitment.ts';
import { makeListSchema, type CatalogueMake } from './makeList.ts';
import { partPageSchema } from './partPages.ts';
import { vehicleSchema } from './vehicle.ts';

export const CATALOGUE_SNAPSHOT_PATH = '/store/catalogue-snapshot';

export const CATALOGUE_SNAPSHOT_CONTENT_TYPE = 'application/x-ndjson';

export const catalogueSnapshotResponseSchema = z.object({
  categories: z.array(categorySchema),
  pages: z.array(partPageSchema),
  fitments: z.array(fitmentSchema),
  vehicles: z.array(vehicleSchema),
  makes: makeListSchema.nullable().default(null),
});

export type CatalogueSnapshotResponse = z.infer<
  typeof catalogueSnapshotResponseSchema
>;

export const snapshotFitmentSchema = fitmentSchema.omit({ id: true }).extend({
  quantity: fitmentSchema.shape.quantity.default(1),
  production_from: fitmentSchema.shape.production_from.default(null),
  production_to: fitmentSchema.shape.production_to.default(null),
  note: fitmentSchema.shape.note.default(null),
  translations: translationsSchema.default(null),
});

export type SnapshotFitment = z.infer<typeof snapshotFitmentSchema>;

export type CatalogueSnapshot = Omit<CatalogueSnapshotResponse, 'fitments'> & {
  fitments: SnapshotFitment[];
};

export const compactFitment = ({ quantity, ...fitment }: Fitment) =>
  Object.fromEntries([
    ...Object.entries(fitment).filter(
      ([key, value]) => key !== 'id' && value !== null,
    ),
    ...(quantity === 1 ? [] : [['quantity', quantity]]),
  ]);

const snapshotLineSchema = z.object({
  categories: z.array(categorySchema).optional(),
  pages: z.array(partPageSchema).optional(),
  fitments: z.array(snapshotFitmentSchema).optional(),
  vehicles: z.array(vehicleSchema).optional(),
  makes: makeListSchema.optional(),
  end: z.literal(true).optional(),
});

export type SnapshotSection = Exclude<
  keyof z.infer<typeof snapshotLineSchema>,
  'end'
>;

const REQUIRED_SECTIONS = [
  'categories',
  'pages',
  'fitments',
  'vehicles',
] as const satisfies readonly SnapshotSection[];

const line = (fields: object) => `${JSON.stringify(fields)}\n`;

export const SNAPSHOT_END_LINE = line({ end: true });

export async function* snapshotSectionLines(
  section: SnapshotSection,
  batches: Iterable<unknown[]> | AsyncIterable<unknown[]>,
) {
  let empty = true;
  for await (const batch of batches) {
    if (batch.length) {
      empty = false;
      yield line({ [section]: batch });
    }
  }
  if (empty) yield line({ [section]: [] });
}

async function* lines(body: ReadableStream<Uint8Array>) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let rest = '';
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    const text = rest + read.value;
    const cut = text.lastIndexOf('\n') + 1;
    rest = text.slice(cut);
    yield* text.slice(0, cut).split('\n');
  }
  yield rest;
}

export async function readCatalogueSnapshot(
  body: ReadableStream<Uint8Array>,
): Promise<CatalogueSnapshot> {
  const snapshot: CatalogueSnapshot = {
    categories: [],
    pages: [],
    fitments: [],
    vehicles: [],
    makes: null,
  };
  const makes: CatalogueMake[] = [];
  const seen = new Set<string>();
  for await (const text of lines(body)) {
    if (!text) continue;
    const batch = snapshotLineSchema.parse(JSON.parse(text));
    Object.keys(batch).forEach((key) => seen.add(key));
    snapshot.categories.push(...(batch.categories ?? []));
    snapshot.pages.push(...(batch.pages ?? []));
    snapshot.fitments.push(...(batch.fitments ?? []));
    snapshot.vehicles.push(...(batch.vehicles ?? []));
    makes.push(...(batch.makes ?? []));
  }
  const missing = [...REQUIRED_SECTIONS, 'end'].filter((key) => !seen.has(key));
  if (missing.length) {
    throw new Error(
      `The catalogue snapshot ended without ${missing.join(', ')}`,
    );
  }
  return { ...snapshot, makes: seen.has('makes') ? makes : null };
}
