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

const MAKES = [
  {
    id: 'mk_t',
    name: 'Toyota',
    models: [
      {
        id: 'md_c',
        name: 'Corolla',
        generations: [
          { id: 'gn_2', name: 'II', year_from: 2013, year_to: 2019 },
        ],
      },
    ],
  },
];

const post = async (body: unknown, rows: unknown[]) => {
  const res = { json: jest.fn() };
  const req = {
    params: { id: 'prod_1' },
    body,
    scope: {
      resolve: () => ({
        graph: jest.fn().mockResolvedValue({ data: rows }),
        listVehicleMakes: jest.fn().mockResolvedValue(MAKES),
      }),
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

  it.each([
    [
      'an unknown make',
      { ...FITMENT[0], make: 'Nomake' },
      '«Nomake Corolla 2013–2019»: марки «Nomake» нет в справочнике',
    ],
    [
      'years outside the generation',
      { ...FITMENT[0], yearFrom: 2012 },
      '«Toyota Corolla 2012–2019»: годы выходят за рамки поколений Toyota Corolla (2013–2019)',
    ],
  ])('refuses %s before saving anything', async (_label, car, reason) => {
    await expect(
      post({ spec: SPEC, fitment: [car] }, BATTERY),
    ).rejects.toMatchObject({
      type: 'invalid_data',
      message: `Характеристики не сохранены: ${reason}`,
    });
    expect(updateProductMetadata).not.toHaveBeenCalled();
  });
});
