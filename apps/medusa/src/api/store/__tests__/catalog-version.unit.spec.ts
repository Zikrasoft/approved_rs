import { GET } from '../catalog-version/route';

const get = async (rows: unknown[]) => {
  const res = { json: jest.fn() };
  await GET(
    {
      scope: {
        resolve: () => ({ graph: jest.fn().mockResolvedValue({ data: rows }) }),
      },
    } as never,
    res as never,
  );
  return res.json.mock.calls[0][0];
};

describe('GET /store/catalog-version', () => {
  it('answers the stamp the last catalogue change left', async () => {
    expect(
      await get([
        {
          id: 'store_1',
          metadata: { catalog_version: '2026-09-28T10:00:00.000Z' },
        },
      ]),
    ).toEqual({
      version: '2026-09-28T10:00:00.000Z',
    });
  });

  it('answers unstamped before the first change', async () => {
    expect(await get([{ id: 'store_1', metadata: null }])).toEqual({
      version: 'unstamped',
    });
    expect(await get([])).toEqual({ version: 'unstamped' });
  });
});
