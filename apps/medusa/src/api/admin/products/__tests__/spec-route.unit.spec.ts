import { updateProductMetadata } from '../../../../lib/metadata';
import { POST } from '../[id]/spec/route';

jest.mock('../../../../lib/metadata', () => ({
  updateProductMetadata: jest.fn(),
}));

const SPEC = {
  brand: 'Bosch',
  capacityAh: 60,
  crankingA: 540,
  polarity: 'left',
  lengthMm: 242,
  widthMm: 175,
  heightMm: 175,
  warrantyMonths: 24,
};

const FITMENT = [
  { make: 'Toyota', model: 'Corolla', yearFrom: 2013, yearTo: 2019 },
];

const post = async (body: unknown, rows: unknown[]) => {
  const res = { json: jest.fn() };
  const req = {
    params: { id: 'prod_1' },
    body,
    scope: {
      resolve: () => ({ graph: jest.fn().mockResolvedValue({ data: rows }) }),
    },
  };
  await POST(req as never, res as never);
  return res;
};

const BATTERY = [{ id: 'prod_1', type: { value: 'batteries' } }];

beforeEach(() => {
  (updateProductMetadata as jest.Mock).mockReset();
  (updateProductMetadata as jest.Mock).mockImplementation(
    async (_scope, _id, patch) => ({ translated_from: 'abc', ...patch }),
  );
});

describe('POST /admin/products/:id/spec', () => {
  it('saves a spec that fits and answers with the whole merged metadata', async () => {
    const res = await post({ spec: SPEC, fitment: FITMENT }, BATTERY);

    expect(updateProductMetadata).toHaveBeenCalledWith(
      expect.anything(),
      'prod_1',
      {
        spec: SPEC,
        fitment: FITMENT,
      },
    );
    expect(res.json).toHaveBeenCalledWith({
      metadata: { translated_from: 'abc', spec: SPEC, fitment: FITMENT },
    });
  });

  it('refuses a body that is not a spec and a fitment list', async () => {
    await expect(post({ spec: SPEC }, BATTERY)).rejects.toMatchObject({
      type: 'invalid_data',
      message: expect.stringMatching(/^Характеристики не сохранены: /),
    });
    expect(updateProductMetadata).not.toHaveBeenCalled();
  });

  it('refuses a spec that breaks the registry, naming the field', async () => {
    await expect(
      post({ spec: { ...SPEC, capacityAh: 0 }, fitment: [] }, BATTERY),
    ).rejects.toMatchObject({
      type: 'invalid_data',
      message: expect.stringContaining('capacityAh'),
    });
  });

  it('answers not found for a product that is gone', async () => {
    await expect(post({ spec: SPEC, fitment: [] }, [])).rejects.toMatchObject({
      type: 'not_found',
    });
  });
});
