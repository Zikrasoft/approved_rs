import { GET } from '../vehicles/route';

const ROWS = [
  {
    id: 'vmake_2',
    name: 'Škoda',
    models: [
      {
        id: 'vmod_1',
        name: 'Octavia',
        generations: [
          { id: 'vgen_1', name: 'A7', year_from: 2012, year_to: 2020 },
        ],
      },
    ],
  },
  { id: 'vmake_1', name: 'Audi', models: null },
];

const answer = async (rows: unknown[]) => {
  const res = { json: jest.fn() };
  await GET(
    {
      scope: {
        resolve: () => ({
          listVehicleMakes: jest.fn().mockResolvedValue(rows),
        }),
      },
    } as never,
    res as never,
  );
  return res.json.mock.calls[0][0];
};

describe('GET /store/vehicles', () => {
  it('answers the tree sorted by name, without a single internal id', async () => {
    const body = await answer(ROWS);

    expect(body).toEqual({
      makes: [
        { name: 'Audi', models: [] },
        {
          name: 'Škoda',
          models: [
            {
              name: 'Octavia',
              generations: [{ name: 'A7', yearFrom: 2012, yearTo: 2020 }],
            },
          ],
        },
      ],
    });
    expect(JSON.stringify(body)).not.toContain('"id"');
  });

  it('answers an empty dictionary as an empty list', async () => {
    expect(await answer([])).toEqual({ makes: [] });
  });
});
