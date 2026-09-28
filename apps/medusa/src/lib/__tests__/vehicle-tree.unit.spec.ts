import {
  type Generation,
  type VehicleTree,
  fitmentComplaint,
  generationOf,
  treeComplaint,
} from '../vehicle-tree';

const PROTO = {
  name: 'Proto',
  generations: [
    { name: 'I', yearFrom: 2006, yearTo: 2013 },
    { name: 'II', yearFrom: 2013, yearTo: 2019 },
  ],
};

const TREE: VehicleTree = [
  {
    name: 'Zikra',
    models: [
      PROTO,
      {
        name: 'Vesna',
        generations: [{ name: 'I', yearFrom: 2010, yearTo: 2016 }],
      },
    ],
  },
  {
    name: 'Kosava',
    models: [
      {
        name: 'Sever',
        generations: [{ name: 'A', yearFrom: 2001, yearTo: 2009 }],
      },
    ],
  },
];

const withGenerations = (generations: Generation[]): VehicleTree => [
  { name: 'Zikra', models: [{ name: 'Proto', generations }] },
];

const car = (
  make: string,
  model: string,
  yearFrom: number,
  yearTo: number,
) => ({
  make,
  model,
  yearFrom,
  yearTo,
});

describe('treeComplaint', () => {
  it('accepts generations that share only the changeover year', () => {
    expect(treeComplaint(TREE)).toBeUndefined();
  });

  it('reads the generations in year order, whatever order they were written in', () => {
    expect(
      treeComplaint(withGenerations([...PROTO.generations].reverse())),
    ).toBeUndefined();
  });

  it('refuses a make written twice', () => {
    expect(treeComplaint([...TREE, { name: 'Zikra', models: [] }])).toBe(
      'марка «Zikra» записана дважды',
    );
  });

  it('refuses a model written twice under one make', () => {
    expect(treeComplaint([{ name: 'Zikra', models: [PROTO, PROTO] }])).toBe(
      'модель «Zikra Proto» записана дважды',
    );
  });

  it('lets two makes carry a model of the same name', () => {
    expect(
      treeComplaint([...TREE, { name: 'Vihor', models: [PROTO] }]),
    ).toBeUndefined();
  });

  it('refuses a generation written twice under one model', () => {
    expect(
      treeComplaint(
        withGenerations([
          ...PROTO.generations,
          { name: 'II', yearFrom: 2020, yearTo: 2024 },
        ]),
      ),
    ).toBe('поколение «Zikra Proto II» записано дважды');
  });

  it('refuses a generation that ends before it starts', () => {
    expect(
      treeComplaint(
        withGenerations([{ name: 'I', yearFrom: 2013, yearTo: 2006 }]),
      ),
    ).toBe('у поколения «Zikra Proto I» год начала позже года конца');
  });

  it('refuses generations that overlap by more than the changeover year', () => {
    expect(
      treeComplaint(
        withGenerations([
          { name: 'I', yearFrom: 2006, yearTo: 2013 },
          { name: 'II', yearFrom: 2012, yearTo: 2019 },
        ]),
      ),
    ).toBe(
      'поколения «Zikra Proto I» (2006–2013) и «II» (2012–2019) пересекаются больше чем на год',
    );
  });
});

describe('fitmentComplaint', () => {
  it('accepts cars inside one generation, whole or narrowed', () => {
    expect(
      fitmentComplaint(TREE, [
        car('Zikra', 'Proto', 2013, 2019),
        car('Zikra', 'Proto', 2008, 2010),
        car('Kosava', 'Sever', 2005, 2005),
      ]),
    ).toBeUndefined();
  });

  it('accepts no cars at all', () => {
    expect(fitmentComplaint(TREE, [])).toBeUndefined();
  });

  it('names an unknown make', () => {
    expect(fitmentComplaint(TREE, [car('Nomake', 'Proto', 2008, 2010)])).toBe(
      '«Nomake Proto 2008–2010»: марки «Nomake» нет в справочнике',
    );
  });

  it('names a model filed under another make', () => {
    expect(fitmentComplaint(TREE, [car('Kosava', 'Proto', 2008, 2010)])).toBe(
      '«Kosava Proto 2008–2010»: у марки «Kosava» нет модели «Proto»',
    );
  });

  it('refuses years that run past one generation, even into the next', () => {
    expect(fitmentComplaint(TREE, [car('Zikra', 'Proto', 2010, 2015)])).toBe(
      '«Zikra Proto 2010–2015»: годы выходят за рамки поколений Zikra Proto (2006–2013, 2013–2019)',
    );
  });

  it('names the first car that does not fit', () => {
    expect(
      fitmentComplaint(TREE, [
        car('Zikra', 'Proto', 2008, 2010),
        car('Zikra', 'Proto', 2020, 2021),
      ]),
    ).toMatch(/^«Zikra Proto 2020–2021»/);
  });
});

describe('generationOf', () => {
  it('finds the generation a car sits in', () => {
    expect(generationOf(PROTO, car('Zikra', 'Proto', 2014, 2016))?.name).toBe(
      'II',
    );
  });

  it('finds none for a car across two generations', () => {
    expect(
      generationOf(PROTO, car('Zikra', 'Proto', 2010, 2015)),
    ).toBeUndefined();
  });
});
