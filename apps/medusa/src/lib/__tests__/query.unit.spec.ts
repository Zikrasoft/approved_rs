import { QUERY_PAGE, queryAll, queryOne } from '../query';

describe('queryOne', () => {
  it('asks for the given entity, fields and filters and returns the first row', async () => {
    const graph = jest
      .fn()
      .mockResolvedValue({ data: [{ id: 'a' }, { id: 'b' }] });
    const fields = ['id'] as const;

    const row = await queryOne({ graph } as never, 'product', fields, {
      handle: 'x',
    });

    expect(row).toEqual({ id: 'a' });
    expect(graph).toHaveBeenCalledWith({
      entity: 'product',
      fields: ['id'],
      filters: { handle: 'x' },
    });
  });

  it('returns undefined when nothing matches', async () => {
    const graph = jest.fn().mockResolvedValue({ data: [] });

    expect(
      await queryOne({ graph } as never, 'product', ['id'], {}),
    ).toBeUndefined();
  });
});

describe('queryAll', () => {
  it('pages through until a short page', async () => {
    const full = Array.from({ length: QUERY_PAGE }, (_, index) => ({
      id: `p${index}`,
    }));
    const graph = jest
      .fn()
      .mockResolvedValueOnce({ data: full })
      .mockResolvedValueOnce({ data: [{ id: 'last' }] });

    const rows = await queryAll({ graph } as never, 'product', ['id']);

    expect(rows).toHaveLength(QUERY_PAGE + 1);
    expect(graph).toHaveBeenLastCalledWith({
      entity: 'product',
      fields: ['id'],
      pagination: { take: QUERY_PAGE, skip: QUERY_PAGE },
    });
  });
});
