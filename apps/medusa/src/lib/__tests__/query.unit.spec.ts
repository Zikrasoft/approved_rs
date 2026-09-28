import { queryOne } from '../query';

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
