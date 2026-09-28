import type { VehicleTree } from '../vehicle-tree';
import {
  fitmentComplaintFor,
  loadVehicleTree,
  orphanedProducts,
  productsOrphanedBy,
} from '../vehicles';

const ROWS = [
  {
    id: 'mk_z',
    name: 'Zikra',
    models: [
      { id: 'md_v', name: 'Vesna', generations: null },
      {
        id: 'md_p',
        name: 'Proto',
        generations: [
          { id: 'gn_2', name: 'II', year_from: 2013, year_to: 2019 },
          { id: 'gn_1', name: 'I', year_from: 2006, year_to: 2013 },
        ],
      },
    ],
  },
  { id: 'mk_c', name: 'Čavka', models: null },
  { id: 'mk_a', name: 'Alfa', models: [] },
];

const listVehicleMakes = jest.fn();

const scopeWith = (products: unknown[] = []) => ({
  resolve: (key: string) =>
    key === 'query'
      ? { graph: jest.fn().mockResolvedValue({ data: products }) }
      : { listVehicleMakes },
});

const car = (yearFrom: number, yearTo: number) => ({
  make: 'Zikra',
  model: 'Proto',
  yearFrom,
  yearTo,
});

const BEFORE: VehicleTree = [
  {
    name: 'Zikra',
    models: [
      {
        name: 'Proto',
        generations: [{ name: 'I', yearFrom: 2006, yearTo: 2013 }],
      },
    ],
  },
];

const AFTER: VehicleTree = [];

beforeEach(() => {
  listVehicleMakes.mockReset();
  listVehicleMakes.mockResolvedValue(ROWS);
});

describe('loadVehicleTree', () => {
  it('reads the three levels in one call and sorts them the Serbian way', async () => {
    const tree = await loadVehicleTree(scopeWith() as never);

    expect(listVehicleMakes).toHaveBeenCalledWith(
      {},
      { relations: ['models', 'models.generations'] },
    );
    expect(tree.map((make) => make.name)).toEqual(['Alfa', 'Čavka', 'Zikra']);
    expect(tree[1].models).toEqual([]);
    expect(tree[2].models.map((model) => model.name)).toEqual([
      'Proto',
      'Vesna',
    ]);
    expect(tree[2].models[0].generations).toEqual([
      { id: 'gn_1', name: 'I', yearFrom: 2006, yearTo: 2013 },
      { id: 'gn_2', name: 'II', yearFrom: 2013, yearTo: 2019 },
    ]);
    expect(tree[2].models[1].generations).toEqual([]);
  });
});

describe('fitmentComplaintFor', () => {
  it('does not read the dictionary for a product with no cars', async () => {
    expect(await fitmentComplaintFor(scopeWith() as never, [])).toBeUndefined();
    expect(listVehicleMakes).not.toHaveBeenCalled();
  });

  it('checks the cars against the dictionary', async () => {
    expect(
      await fitmentComplaintFor(scopeWith() as never, [car(2010, 2015)]),
    ).toMatch(/^«Zikra Proto 2010–2015»: годы выходят за рамки поколений/);
  });
});

describe('orphanedProducts', () => {
  it('names the products an edit would strand', () => {
    expect(
      orphanedProducts(BEFORE, AFTER, [
        {
          id: 'p1',
          title: 'Varta E12',
          metadata: { fitment: [car(2007, 2010)] },
        },
        { id: 'p2', title: 'Bosch S4', metadata: { spec: {} } },
        { id: 'p3', title: 'Exide', metadata: null },
      ]),
    ).toEqual(['Varta E12']);
  });

  it('does not blame an edit for a car that was already outside the dictionary', () => {
    expect(
      orphanedProducts(BEFORE, AFTER, [
        { id: 'p1', title: 'Old', metadata: { fitment: [car(1999, 2001)] } },
      ]),
    ).toEqual([]);
  });

  it('skips a fitment that is not a list of cars', () => {
    expect(
      orphanedProducts(BEFORE, AFTER, [
        { id: 'p1', title: 'Broken', metadata: { fitment: 'Zikra' } },
      ]),
    ).toEqual([]);
  });
});

describe('productsOrphanedBy', () => {
  it('reads every product with its metadata', async () => {
    const scope = scopeWith([
      {
        id: 'p1',
        title: 'Varta E12',
        metadata: { fitment: [car(2007, 2010)] },
      },
    ]);

    expect(await productsOrphanedBy(scope as never, BEFORE, AFTER)).toEqual([
      'Varta E12',
    ]);
  });
});
