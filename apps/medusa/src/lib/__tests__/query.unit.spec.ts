import { z } from 'zod';

import { QUERY_PAGE, fieldsOf, selectAll, selectOne } from '../query';

const graphOf = (...pages: unknown[][]) => {
  const graph = jest.fn();
  for (const page of pages) {
    graph.mockResolvedValueOnce({ data: page });
  }
  return graph;
};

describe('fieldsOf', () => {
  it('reads a flat object as its keys', () => {
    expect(fieldsOf(z.object({ id: z.string(), title: z.string() }))).toEqual([
      'id',
      'title',
    ]);
  });

  it('walks nested objects and arrays through optional and nullable wrappers', () => {
    const schema = z.object({
      id: z.string(),
      metadata: z.record(z.string(), z.unknown()).nullish(),
      type: z.object({ value: z.string() }).nullish(),
      items: z.array(z.object({ quantity: z.unknown() }).nullable()).optional(),
      variants: z.array(
        z.looseObject({
          prices: z.array(z.object({ amount: z.number() })).nullish(),
        }),
      ),
    });

    expect(fieldsOf(schema)).toEqual([
      'id',
      'metadata',
      'type.value',
      'items.quantity',
      'variants.prices.amount',
    ]);
  });

  it('marks a scalar the default selection leaves out with +', () => {
    const schema = z.object({
      id: z.string(),
      variants: z.array(z.object({ inventory_quantity: z.number() })),
    });

    expect(fieldsOf(schema, { 'variants.inventory_quantity': '+' })).toEqual([
      'id',
      '+variants.inventory_quantity',
    ]);
  });

  it('asks for a whole relation with * and still parses what it returns', () => {
    const schema = z.object({
      id: z.string(),
      images: z.array(z.object({ url: z.string() })),
    });

    expect(fieldsOf(schema, { images: '*' })).toEqual(['id', '*images']);
  });

  it('refuses a prefix on a path the schema does not parse', () => {
    expect(() =>
      fieldsOf(z.object({ id: z.string() }), { thumbnail: '+' }),
    ).toThrow('Field prefix names no schema path: thumbnail');
  });

  it('refuses fulfillment_status, which query.graph cannot select', () => {
    expect(() =>
      fieldsOf(z.object({ id: z.string(), fulfillment_status: z.string() })),
    ).toThrow('fulfillment_status is not a queryable property');
  });

  const inner = z.object({ value: z.string() });

  it.each([
    ['default', inner.default({ value: '' })],
    ['transform', inner.transform((row) => row.value)],
    ['lazy', z.lazy(() => inner)],
    ['union', z.union([z.string(), inner])],
    ['intersection', z.intersection(z.string(), inner.nullish())],
    ['readonly', z.array(inner).readonly()],
  ])(
    'refuses an object behind a %s wrapper instead of reading it as a leaf',
    (_, wrapped) => {
      expect(() =>
        fieldsOf(z.object({ id: z.string(), type: wrapped })),
      ).toThrow('type wraps an object fieldsOf cannot walk');
    },
  );

  it('still reads a scalar behind a wrapper as a leaf', () => {
    expect(
      fieldsOf(
        z.object({
          display_id: z.union([z.number(), z.string()]),
          status: z.string().default('draft'),
          total: z.unknown().transform(Number),
          lines: z.intersection(z.string(), z.string()),
        }),
      ),
    ).toEqual(['display_id', 'status', 'total', 'lines']);
  });

  it('refuses a schema that is not an object', () => {
    expect(() => fieldsOf(z.string())).toThrow(
      'A Medusa read needs an object schema',
    );
  });
});

const rowSchema = z.object({ id: z.string(), title: z.string() });

describe('selectOne', () => {
  it('asks for the schema fields with the filters and returns the parsed first row', async () => {
    const graph = graphOf([
      { id: 'a', title: 'A', extra: true },
      { id: 'b', title: 'B' },
    ]);

    const row = await selectOne({ graph } as never, 'product', rowSchema, {
      handle: 'x',
    });

    expect(row).toEqual({ id: 'a', title: 'A' });
    expect(graph).toHaveBeenCalledWith({
      entity: 'product',
      fields: ['id', 'title'],
      filters: { handle: 'x' },
    });
  });

  it('passes the prefix escape through to the query', async () => {
    const graph = graphOf([{ id: 'a', title: 'A' }]);

    await selectOne(
      { graph } as never,
      'product',
      rowSchema,
      {},
      {
        fieldPrefix: { title: '+' },
      },
    );

    expect(graph.mock.calls[0][0].fields).toEqual(['id', '+title']);
  });

  it('returns undefined when nothing matches', async () => {
    expect(
      await selectOne(
        { graph: graphOf([]) } as never,
        'product',
        rowSchema,
        {},
      ),
    ).toBeUndefined();
  });

  it('throws on a row that does not fit, naming the entity, the id and the path', async () => {
    const graph = graphOf([{ id: 'prod_1', title: null }]);

    await expect(
      selectOne({ graph } as never, 'product', rowSchema, {}),
    ).rejects.toThrow(/^product prod_1 does not fit its read: title: /);
  });

  it('says so when the misfit row has no id to name', async () => {
    const graph = graphOf([null]);

    await expect(
      selectOne({ graph } as never, 'store', rowSchema, {}),
    ).rejects.toThrow(/^store \(no id\) does not fit its read: \(row\): /);
  });
});

describe('selectAll', () => {
  it('pages by id until a short page and parses every row', async () => {
    const full = Array.from({ length: QUERY_PAGE }, (_, index) => ({
      id: `p${index}`,
      title: `P${index}`,
    }));
    const graph = graphOf(full, [{ id: 'last', title: 'Last', extra: 1 }]);

    const rows = await selectAll({ graph } as never, 'product', rowSchema);

    expect(rows).toHaveLength(QUERY_PAGE + 1);
    expect(rows[rows.length - 1]).toEqual({ id: 'last', title: 'Last' });
    expect(graph).toHaveBeenLastCalledWith({
      entity: 'product',
      fields: ['id', 'title'],
      pagination: { take: QUERY_PAGE, skip: QUERY_PAGE, order: { id: 'ASC' } },
    });
  });

  it('sends the filters and the prefix escape on every page', async () => {
    const graph = graphOf([]);

    await selectAll(
      { graph } as never,
      'product',
      rowSchema,
      { status: 'published' },
      { fieldPrefix: { title: '*' } },
    );

    expect(graph).toHaveBeenCalledWith({
      entity: 'product',
      fields: ['id', '*title'],
      filters: { status: 'published' },
      pagination: { take: QUERY_PAGE, skip: 0, order: { id: 'ASC' } },
    });
  });

  it('throws on the first row that does not fit', async () => {
    const graph = graphOf([
      { id: 'a', title: 'A' },
      { id: 'b', title: 7 },
    ]);

    await expect(
      selectAll({ graph } as never, 'product', rowSchema),
    ).rejects.toThrow(/^product b does not fit its read: title: /);
  });

  it('hands a misfit row to skipUnfit and keeps paging past it', async () => {
    const full = Array.from({ length: QUERY_PAGE }, (_, index) =>
      index === 0 ? { id: 'bad', title: 7 } : { id: `p${index}`, title: 'P' },
    );
    const graph = graphOf(full, [{ id: 'last', title: 'Last' }]);
    const skipUnfit = jest.fn();

    const rows = await selectAll(
      { graph } as never,
      'product',
      rowSchema,
      undefined,
      { skipUnfit },
    );

    expect(rows).toHaveLength(QUERY_PAGE);
    expect(rows.map((row) => row.id)).not.toContain('bad');
    expect(skipUnfit).toHaveBeenCalledTimes(1);
    expect(skipUnfit).toHaveBeenCalledWith(
      expect.stringMatching(/^product bad does not fit its read: title: /),
    );
    expect(graph.mock.calls[1][0].pagination.skip).toBe(QUERY_PAGE);
  });
});
