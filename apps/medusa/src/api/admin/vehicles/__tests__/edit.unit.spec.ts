import type { TreeEdit } from '../../../../lib/vehicle-tree';
import { type Mode, answer, readEdit, saveEdit } from '../edit';

const ROWS = [
  {
    id: 'mk_z',
    name: 'Zikra',
    models: [
      {
        id: 'md_p',
        name: 'Proto',
        generations: [
          { id: 'gn_1', name: 'I', year_from: 2006, year_to: 2013 },
        ],
      },
    ],
  },
  { id: 'mk_k', name: 'Kosava', models: [] },
];

const VARTA = {
  id: 'prod_1',
  title: 'Varta E12',
  metadata: {
    fitment: [{ make: 'Zikra', model: 'Proto', yearFrom: 2007, yearTo: 2010 }],
  },
};

const STRANDED =
  'Справочник не изменён: на эту запись опирается совместимость товаров (1): Varta E12. Сначала поправьте совместимость в их карточках.';

const store = {
  listVehicleMakes: jest.fn(),
  createVehicleMakes: jest.fn(),
  updateVehicleMakes: jest.fn(),
  deleteVehicleMakes: jest.fn(),
  createVehicleModels: jest.fn(),
  updateVehicleModels: jest.fn(),
  deleteVehicleModels: jest.fn(),
  createVehicleGenerations: jest.fn(),
  updateVehicleGenerations: jest.fn(),
  deleteVehicleGenerations: jest.fn(),
};

const scopeWith = (products: unknown[] = []) => ({
  resolve: (key: string) =>
    key === 'query'
      ? { graph: jest.fn().mockResolvedValue({ data: products }) }
      : store,
});

const thrown = (work: () => unknown) => {
  try {
    work();
  } catch (error) {
    return error;
  }
  return undefined;
};

beforeEach(() => {
  jest.clearAllMocks();
  store.listVehicleMakes.mockResolvedValue(ROWS);
});

describe('readEdit', () => {
  it('reads a new model with its make', () => {
    expect(
      readEdit(
        { level: 'models' },
        { make_id: 'mk_z', name: ' Vesna ' },
        'create',
      ),
    ).toEqual({
      kind: 'create',
      level: 'models',
      parentId: 'mk_z',
      change: { name: 'Vesna' },
    });
  });

  it('reads a new generation with its model and years', () => {
    expect(
      readEdit(
        { level: 'generations' },
        { vehicle_model_id: 'md_p', name: 'II', yearFrom: 2013, yearTo: 2019 },
        'create',
      ),
    ).toEqual({
      kind: 'create',
      level: 'generations',
      parentId: 'md_p',
      change: { name: 'II', yearFrom: 2013, yearTo: 2019 },
    });
  });

  it('reads part of a generation as an edit', () => {
    expect(
      readEdit(
        { level: 'generations', id: 'gn_1' },
        { yearTo: 2012 },
        'update',
      ),
    ).toEqual({
      kind: 'update',
      level: 'generations',
      id: 'gn_1',
      change: { yearTo: 2012 },
    });
  });

  it('reads a delete without looking at a body', () => {
    expect(
      readEdit({ level: 'makes', id: 'mk_z' }, undefined, 'delete'),
    ).toEqual({
      kind: 'delete',
      level: 'makes',
      id: 'mk_z',
    });
  });

  it('answers not found for a level it does not know', () => {
    expect(
      thrown(() => readEdit({ level: 'engines' }, {}, 'create')),
    ).toMatchObject({
      type: 'not_found',
      message: 'Такого раздела в справочнике нет',
    });
  });

  it.each([
    ['a make without a name', 'makes', { name: '  ' }, 'create'],
    ['a model without its make', 'models', { name: 'Vesna' }, 'create'],
    [
      'a year as text',
      'generations',
      { vehicle_model_id: 'md_p', name: 'II', yearFrom: '2013', yearTo: 2019 },
      'create',
    ],
    [
      'a field the level does not have',
      'makes',
      { name: 'Zikra', yearFrom: 2000 },
      'create',
    ],
    ['an edit that changes nothing', 'generations', {}, 'update'],
  ])('refuses %s in Russian', (_label, level, body, mode) => {
    expect(
      thrown(() => readEdit({ level, id: 'x' }, body, mode as Mode)),
    ).toMatchObject({
      type: 'invalid_data',
      message: expect.stringMatching(/^Справочник не сохранён: /),
    });
  });
});

describe('saveEdit', () => {
  it('creates a model under its make', async () => {
    expect(
      await saveEdit(scopeWith() as never, {
        kind: 'create',
        level: 'models',
        parentId: 'mk_k',
        change: { name: 'Sever' },
      }),
    ).toBeUndefined();
    expect(store.createVehicleModels).toHaveBeenCalledWith({
      name: 'Sever',
      make_id: 'mk_k',
    });
  });

  it('writes a new generation with its years in the columns', async () => {
    await saveEdit(scopeWith() as never, {
      kind: 'create',
      level: 'generations',
      parentId: 'md_p',
      change: { name: 'II', yearFrom: 2013, yearTo: 2019 },
    });

    expect(store.createVehicleGenerations).toHaveBeenCalledWith({
      name: 'II',
      year_from: 2013,
      year_to: 2019,
      vehicle_model_id: 'md_p',
    });
  });

  it('refuses a duplicate and reversed years before writing anything', async () => {
    await expect(
      saveEdit(scopeWith() as never, {
        kind: 'create',
        level: 'makes',
        change: { name: 'Zikra' },
      }),
    ).rejects.toMatchObject({
      type: 'invalid_data',
      message: 'Справочник не сохранён: марка «Zikra» записана дважды',
    });
    await expect(
      saveEdit(scopeWith() as never, {
        kind: 'update',
        level: 'generations',
        id: 'gn_1',
        change: { yearFrom: 2014 },
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('год начала позже года конца'),
    });
    expect(store.createVehicleMakes).not.toHaveBeenCalled();
    expect(store.updateVehicleGenerations).not.toHaveBeenCalled();
  });

  it('accepts a generation that overlaps its neighbour, as the sources give them', async () => {
    await saveEdit(scopeWith() as never, {
      kind: 'create',
      level: 'generations',
      parentId: 'md_p',
      change: { name: 'II', yearFrom: 2011, yearTo: 2019 },
    });

    expect(store.createVehicleGenerations).toHaveBeenCalled();
  });

  it('answers not found for an entry that is gone', async () => {
    await expect(
      saveEdit(scopeWith() as never, {
        kind: 'update',
        level: 'models',
        id: 'md_gone',
        change: { name: 'X' },
      }),
    ).rejects.toMatchObject({
      type: 'not_found',
      message: 'Такой записи в справочнике нет',
    });
  });

  it.each([
    ['deleting the make', { kind: 'delete', level: 'makes', id: 'mk_z' }],
    [
      'renaming the model',
      {
        kind: 'update',
        level: 'models',
        id: 'md_p',
        change: { name: 'Proto X' },
      },
    ],
    [
      'narrowing the generation',
      {
        kind: 'update',
        level: 'generations',
        id: 'gn_1',
        change: { yearFrom: 2008 },
      },
    ],
    [
      'deleting the generation',
      { kind: 'delete', level: 'generations', id: 'gn_1' },
    ],
  ])(
    'refuses %s while a product relies on it, naming the product',
    async (_label, edit) => {
      expect(
        await saveEdit(scopeWith([VARTA]) as never, edit as TreeEdit),
      ).toBe(STRANDED);
      expect(store.deleteVehicleMakes).not.toHaveBeenCalled();
      expect(store.updateVehicleModels).not.toHaveBeenCalled();
      expect(store.updateVehicleGenerations).not.toHaveBeenCalled();
      expect(store.deleteVehicleGenerations).not.toHaveBeenCalled();
    },
  );

  it('names five products and counts the rest', async () => {
    const products = Array.from({ length: 7 }, (_, index) => ({
      ...VARTA,
      id: `prod_${index}`,
      title: `Varta ${index}`,
    }));

    expect(
      await saveEdit(scopeWith(products) as never, {
        kind: 'delete',
        level: 'makes',
        id: 'mk_z',
      }),
    ).toBe(
      'Справочник не изменён: на эту запись опирается совместимость товаров (7): Varta 0, Varta 1, Varta 2, Varta 3, Varta 4 и другие. Сначала поправьте совместимость в их карточках.',
    );
  });

  it('deletes a generation whose car still fits a neighbouring, overlapping one', async () => {
    const rows = [
      {
        id: 'mk_z',
        name: 'Zikra',
        models: [
          {
            id: 'md_p',
            name: 'Proto',
            generations: [
              { id: 'gn_1', name: 'I', year_from: 2006, year_to: 2013 },
              { id: 'gn_2', name: 'II', year_from: 2011, year_to: 2019 },
            ],
          },
        ],
      },
      { id: 'mk_k', name: 'Kosava', models: [] },
    ];
    store.listVehicleMakes.mockResolvedValue(rows);
    const car = {
      ...VARTA,
      metadata: {
        fitment: [
          { make: 'Zikra', model: 'Proto', yearFrom: 2012, yearTo: 2015 },
        ],
      },
    };

    expect(
      await saveEdit(scopeWith([car]) as never, {
        kind: 'delete',
        level: 'generations',
        id: 'gn_1',
      }),
    ).toBeUndefined();
    expect(store.deleteVehicleGenerations).toHaveBeenCalledWith('gn_1');
  });

  it('widens, renames and deletes what nothing relies on', async () => {
    const scope = scopeWith([VARTA]) as never;

    await saveEdit(scope, {
      kind: 'update',
      level: 'generations',
      id: 'gn_1',
      change: { yearTo: 2014 },
    });
    await saveEdit(scope, {
      kind: 'update',
      level: 'makes',
      id: 'mk_k',
      change: { name: 'Košava' },
    });
    await saveEdit(scope, { kind: 'delete', level: 'makes', id: 'mk_k' });

    expect(store.updateVehicleGenerations).toHaveBeenCalledWith({
      id: 'gn_1',
      year_to: 2014,
    });
    expect(store.updateVehicleMakes).toHaveBeenCalledWith({
      id: 'mk_k',
      name: 'Košava',
    });
    expect(store.deleteVehicleMakes).toHaveBeenCalledWith('mk_k');
  });
});

describe('answer', () => {
  const respond = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  });

  it('answers a new entry with 201 and the fresh tree', async () => {
    const res = respond();

    await answer(
      {
        scope: scopeWith(),
        params: { level: 'makes' },
        body: { name: 'Vihor' },
      } as never,
      res as never,
      'create',
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      makes: expect.arrayContaining([
        expect.objectContaining({ name: 'Zikra' }),
      ]),
    });
  });

  it('answers a stranding edit with 409 and the Russian reason', async () => {
    const res = respond();

    await answer(
      {
        scope: scopeWith([VARTA]),
        params: { level: 'makes', id: 'mk_z' },
        body: {},
      } as never,
      res as never,
      'delete',
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: STRANDED });
  });
});
