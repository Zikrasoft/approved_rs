import {
  EMPTY_DRAFT,
  EMPTY_ROW,
  draftOf,
  editRequest,
  fitmentToRows,
  generationLabel,
  generationsOf,
  isKnownCar,
  modelsOf,
  pickGeneration,
  pickMake,
  pickModel,
  rowsToFitment,
  unfinishedRow,
  withYearFrom,
  withYearTo,
  yearsOf,
} from '../vehicle-form';
import type { VehicleTree } from '../vehicle-tree';

const TREE: VehicleTree = [
  {
    id: 'mk_z',
    name: 'Zikra',
    models: [
      {
        id: 'md_p',
        name: 'Proto',
        generations: [
          { id: 'gn_1', name: 'I', yearFrom: 2006, yearTo: 2013 },
          { id: 'gn_2', name: 'II', yearFrom: 2013, yearTo: 2019 },
        ],
      },
    ],
  },
];

const ROW = {
  make: 'Zikra',
  model: 'Proto',
  generation: 'II',
  yearFrom: 2013,
  yearTo: 2019,
};

describe('the fitment rows', () => {
  it('finds the generation each stored car sits in', () => {
    expect(
      fitmentToRows(TREE, [
        { make: 'Zikra', model: 'Proto', yearFrom: 2014, yearTo: 2016 },
      ]),
    ).toEqual([
      {
        make: 'Zikra',
        model: 'Proto',
        generation: 'II',
        yearFrom: 2014,
        yearTo: 2016,
      },
    ]);
  });

  it('leaves the generation blank for a car the dictionary does not hold', () => {
    expect(
      fitmentToRows(TREE, [
        { make: 'Zikra', model: 'Proto', yearFrom: 2010, yearTo: 2015 },
        { make: 'Nomake', model: 'X', yearFrom: 2010, yearTo: 2011 },
      ]).map((row) => row.generation),
    ).toEqual(['', '']);
  });

  it('keeps the stored years and leaves the choice to the admin when the car fits several generations', () => {
    const rows = fitmentToRows(TREE, [
      { make: 'Zikra', model: 'Proto', yearFrom: 2013, yearTo: 2013 },
    ]);

    expect(rows).toEqual([
      {
        make: 'Zikra',
        model: 'Proto',
        generation: '',
        yearFrom: 2013,
        yearTo: 2013,
      },
    ]);
    expect(unfinishedRow(rows)).toBe(-1);
  });

  it('tells a car missing from the dictionary apart from one the admin still has to pick a generation for', () => {
    expect(
      isKnownCar(TREE, {
        make: 'Zikra',
        model: 'Proto',
        yearFrom: 2010,
        yearTo: 2015,
      }),
    ).toBe(false);
    expect(
      isKnownCar(TREE, {
        make: 'Nomake',
        model: 'X',
        yearFrom: 2010,
        yearTo: 2011,
      }),
    ).toBe(false);
    expect(
      isKnownCar(TREE, {
        make: 'Zikra',
        model: 'Proto',
        yearFrom: 2013,
        yearTo: 2013,
      }),
    ).toBe(true);
    expect(
      isKnownCar(TREE, {
        make: 'Zikra',
        model: 'Proto',
        yearFrom: 2014,
        yearTo: 2016,
      }),
    ).toBe(true);
  });

  it('starts empty when the product has no fitment', () => {
    expect(fitmentToRows(TREE, undefined)).toEqual([]);
    expect(fitmentToRows(TREE, null)).toEqual([]);
  });

  it('sends only what the storefront stores', () => {
    expect(rowsToFitment([ROW])).toEqual([
      { make: 'Zikra', model: 'Proto', yearFrom: 2013, yearTo: 2019 },
    ]);
  });

  it('points at the first row without a generation', () => {
    expect(unfinishedRow([ROW, EMPTY_ROW])).toBe(1);
    expect(unfinishedRow([ROW])).toBe(-1);
  });
});

describe('picking a car', () => {
  it('lists the models of a make and the generations of a model', () => {
    expect(modelsOf(TREE, 'Zikra').map((model) => model.name)).toEqual([
      'Proto',
    ]);
    expect(modelsOf(TREE, 'Nomake')).toEqual([]);
    expect(generationsOf(TREE, 'Zikra', 'Proto').map(generationLabel)).toEqual([
      'I (2006–2013)',
      'II (2013–2019)',
    ]);
    expect(generationsOf(TREE, 'Zikra', 'Nomodel')).toEqual([]);
  });

  it('starts over below whatever was changed', () => {
    expect(pickMake('Zikra')).toEqual({ ...EMPTY_ROW, make: 'Zikra' });
    expect(pickModel(ROW, 'Proto')).toEqual({
      ...EMPTY_ROW,
      make: 'Zikra',
      model: 'Proto',
    });
  });

  it('fills the years from the generation', () => {
    expect(pickGeneration(TREE, pickModel(ROW, 'Proto'), 'I')).toEqual({
      make: 'Zikra',
      model: 'Proto',
      generation: 'I',
      yearFrom: 2006,
      yearTo: 2013,
    });
    expect(pickGeneration(TREE, ROW, '')).toEqual({
      ...ROW,
      generation: '',
      yearFrom: 0,
      yearTo: 0,
    });
  });

  it('offers only the years of the generation', () => {
    expect(yearsOf(TREE, ROW)).toEqual([
      2013, 2014, 2015, 2016, 2017, 2018, 2019,
    ]);
    expect(yearsOf(TREE, EMPTY_ROW)).toEqual([]);
  });

  it('keeps the range the right way round when one end passes the other', () => {
    expect(withYearFrom({ ...ROW, yearTo: 2015 }, 2017)).toMatchObject({
      yearFrom: 2017,
      yearTo: 2017,
    });
    expect(withYearFrom(ROW, 2015)).toMatchObject({
      yearFrom: 2015,
      yearTo: 2019,
    });
    expect(withYearTo({ ...ROW, yearFrom: 2016 }, 2014)).toMatchObject({
      yearFrom: 2014,
      yearTo: 2014,
    });
    expect(withYearTo(ROW, 2016)).toMatchObject({
      yearFrom: 2013,
      yearTo: 2016,
    });
  });
});

describe('the dictionary page', () => {
  it('adds a make, a model under its make and a generation under its model', () => {
    expect(
      editRequest('makes', { ...EMPTY_DRAFT, name: ' Zikra ' }, {}),
    ).toEqual({
      path: '/admin/vehicles/makes',
      body: { name: 'Zikra' },
    });
    expect(
      editRequest(
        'models',
        { ...EMPTY_DRAFT, name: 'Proto' },
        { parentId: 'mk_z' },
      ),
    ).toEqual({
      path: '/admin/vehicles/models',
      body: { name: 'Proto', make_id: 'mk_z' },
    });
    expect(
      editRequest(
        'generations',
        { name: 'III', yearFrom: '2019', yearTo: '2026' },
        { parentId: 'md_p' },
      ),
    ).toEqual({
      path: '/admin/vehicles/generations',
      body: {
        name: 'III',
        yearFrom: 2019,
        yearTo: 2026,
        vehicle_model_id: 'md_p',
      },
    });
  });

  it('edits by id and never moves the entry to another parent', () => {
    expect(
      editRequest(
        'models',
        { ...EMPTY_DRAFT, name: 'Proto X' },
        { id: 'md_p', parentId: 'mk_z' },
      ),
    ).toEqual({
      path: '/admin/vehicles/models/md_p',
      body: { name: 'Proto X' },
    });
  });

  it('fills the form from an entry', () => {
    expect(draftOf({ name: 'I', yearFrom: 2006, yearTo: 2013 })).toEqual({
      name: 'I',
      yearFrom: '2006',
      yearTo: '2013',
    });
    expect(draftOf({ name: 'Zikra' })).toEqual({
      ...EMPTY_DRAFT,
      name: 'Zikra',
    });
  });
});
