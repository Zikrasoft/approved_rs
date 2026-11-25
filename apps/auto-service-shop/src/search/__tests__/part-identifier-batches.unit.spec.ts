import { partIdentifierSource } from '../part-identifier';

const mockResolve = jest.fn();

jest.mock('@medusajs/framework', () => ({
  ...jest.requireActual('@medusajs/framework'),
  container: { resolve: (...args: unknown[]) => mockResolve(...args) },
}));

const mockDemand = new Map<string, { score: number }>();

jest.mock('../../lib/part-demand', () => ({
  memoPartDemand: async () => mockDemand,
}));

const IDENTIFIERS = 1200;
const PARTS = 500;

const part = (index: number) => {
  const number = index % PARTS;
  return {
    id: `part_${number}`,
    name: `Part ${number}`,
    translations: {
      sr: { name: `Deo ${number}` },
      en: { name: `Part ${number}` },
    },
    attributes: { width: number, kind: ['a', 'b'] },
    category_id: number % 3 === 0 ? null : `cat_${number % 3}`,
    replaced_by_id: null,
    category:
      number % 3 === 0
        ? null
        : {
            slug: `cat-${number % 3}`,
            name: `Cat ${number % 3}`,
            translations: null,
          },
  };
};

const rows = Array.from({ length: IDENTIFIERS }, (_, index) => ({
  id: `pid_${index}`,
  value: `V-${index}`,
  normalized_value: `V${index}`,
  superseded: index % 7 === 0,
  brand: { name: `Brand ${index % 5}`, slug: `brand-${index % 5}` },
  part: part(index),
}));

const inFilter = (value: unknown, id: string) => [value].flat().includes(id);

const tables: Record<string, Record<string, unknown>[]> = {
  part_identifier: rows.map(
    ({ id, value, normalized_value, superseded, part }) => ({
      id,
      value,
      normalized_value,
      superseded,
      part_id: part.id,
    }),
  ),
  category_field: [
    { key: 'width', category_id: 'cat_1', type: 'number' },
    { key: 'kind', category_id: 'cat_2', type: 'keyword' },
    { key: 'width', category_id: 'cat_2', type: 'number' },
  ],
  supplier_offer: rows.flatMap(({ id }, index) =>
    index % 2
      ? [
          {
            id: `offer_${index}_a`,
            part_identifier_id: id,
            cost_price: 100 + index,
            stock_quantity: index % 4,
            lead_time_days: 2,
            supplier: { markup_percentage: 10 },
          },
          {
            id: `offer_${index}_b`,
            part_identifier_id: id,
            cost_price: 90 + index,
            stock_quantity: 0,
            lead_time_days: 5,
            supplier: { markup_percentage: 20 },
          },
        ]
      : [],
  ),
  fitment: Array.from({ length: PARTS }, (_, number) => ({
    part_id: `part_${number}`,
    vehicle: {
      id: `veh_${number % 9}`,
      model: {
        slug: `model-${number % 9}`,
        chassis: { series: { name: `S${number % 4}`, make: { slug: 'make' } } },
      },
    },
  })),
  published_number: rows.flatMap(({ id }, index) =>
    index % 3 ? [{ id, listed: index % 2 === 0 }] : [],
  ),
};

const query = {
  graph: async ({
    entity,
    filters,
  }: {
    entity: string;
    filters: Record<string, unknown>;
  }) => ({
    data: tables[entity].filter((row) =>
      Object.entries(filters).every(([key, value]) =>
        typeof value === 'boolean'
          ? row[key] === value || row[key] === undefined
          : inFilter(value, String(row[key])),
      ),
    ),
  }),
};

const STAGED = rows.flatMap(({ id }, index) =>
  index % 4
    ? [
        {
          part_identifier_id: id,
          kind: 'cross_references',
          supplier: { released_kinds: ['cross_references'] },
          payload: { items: [{ number: `X-${index}`, brand: 'B' }] },
        },
        {
          part_identifier_id: id,
          kind: 'images',
          supplier: { released_kinds: [] },
          payload: { items: [{ url: `u${index}` }] },
        },
      ]
    : [],
);

mockResolve.mockImplementation((name: string) =>
  name === 'publish'
    ? { partRequirementFits: async () => [] }
    : {
        listStagedRecords: async ({
          part_identifier_id,
        }: {
          part_identifier_id: string[];
        }) =>
          STAGED.filter((record) =>
            part_identifier_id.includes(record.part_identifier_id),
          ),
      },
);

for (const [index, { id }] of rows.entries()) {
  if (index % 5) mockDemand.set(id, { score: index });
}

const documentsInBatches = async (size: number) => {
  const documents: unknown[] = [];
  for (let start = 0; start < rows.length; start += size) {
    documents.push(
      ...(await partIdentifierSource.transform(
        rows.slice(start, start + size),
        {
          container: { query },
        } as never,
      )),
    );
  }
  return documents;
};

describe('the part_identifier index transform', () => {
  it('produces identical documents at batch size 100 and 1000', async () => {
    const small = await documentsInBatches(100);
    const large = await documentsInBatches(1000);
    expect(small).toHaveLength(IDENTIFIERS);
    expect(large).toEqual(small);
  });

  it('gives a document its siblings, offers and released supplier data', async () => {
    const [first, second] = await documentsInBatches(1000);
    expect(first).toMatchObject({
      id: 'pid_0',
      equivalent_numbers: ['V-500', 'V500', 'V-1000', 'V1000'],
      cross_reference_numbers: [],
    });
    expect(second).toMatchObject({
      id: 'pid_1',
      cross_reference_numbers: ['X-1', 'X1'],
      demand: 1,
    });
  });
});
