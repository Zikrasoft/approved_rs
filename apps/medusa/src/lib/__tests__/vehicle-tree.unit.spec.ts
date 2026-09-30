import {
  type Generation,
  type VehicleTree,
  applyEdit,
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
  it('accepts a well-formed tree', () => {
    expect(treeComplaint(TREE)).toBeUndefined();
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

  it('accepts generations that overlap, as production years of one model do', () => {
    expect(
      treeComplaint(
        withGenerations([
          { name: 'I', yearFrom: 2006, yearTo: 2013 },
          { name: 'II', yearFrom: 2011, yearTo: 2019 },
        ]),
      ),
    ).toBeUndefined();
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

  it('accepts an entry that fits only the second of two overlapping generations', () => {
    const overlapping: VehicleTree = [
      {
        name: 'Zikra',
        models: [
          {
            name: 'Vesna',
            generations: [
              { name: 'I', yearFrom: 2006, yearTo: 2013 },
              { name: 'II', yearFrom: 2011, yearTo: 2019 },
            ],
          },
        ],
      },
    ];

    expect(
      fitmentComplaint(overlapping, [car('Zikra', 'Vesna', 2014, 2016)]),
    ).toBeUndefined();
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

describe('applyEdit', () => {
  const STORED: VehicleTree = [
    {
      id: 'mk_z',
      name: 'Zikra',
      models: [
        {
          id: 'md_p',
          name: 'Proto',
          generations: [
            { id: 'gn_1', name: 'I', yearFrom: 2006, yearTo: 2013 },
          ],
        },
      ],
    },
    { id: 'mk_k', name: 'Kosava', models: [] },
  ];

  it('adds a make at the end', () => {
    expect(
      applyEdit(STORED, {
        kind: 'create',
        level: 'makes',
        change: { name: 'Vihor' },
      })?.map((make) => make.name),
    ).toEqual(['Zikra', 'Kosava', 'Vihor']);
  });

  it('adds a model under its make only', () => {
    const next = applyEdit(STORED, {
      kind: 'create',
      level: 'models',
      parentId: 'mk_k',
      change: { name: 'Sever' },
    });

    expect(next?.[1].models).toEqual([{ name: 'Sever', generations: [] }]);
    expect(next?.[0].models).toEqual(STORED[0].models);
  });

  it('adds a generation with its years', () => {
    const next = applyEdit(STORED, {
      kind: 'create',
      level: 'generations',
      parentId: 'md_p',
      change: { name: 'II', yearFrom: 2013, yearTo: 2019 },
    });

    expect(next?.[0].models[0].generations).toEqual([
      STORED[0].models[0].generations[0],
      { name: 'II', yearFrom: 2013, yearTo: 2019 },
    ]);
  });

  it('changes an entry in place', () => {
    const next = applyEdit(STORED, {
      kind: 'update',
      level: 'generations',
      id: 'gn_1',
      change: { yearTo: 2012 },
    });

    expect(next?.[0].models[0].generations).toEqual([
      { id: 'gn_1', name: 'I', yearFrom: 2006, yearTo: 2012 },
    ]);
  });

  it('deletes a make with everything under it', () => {
    expect(
      applyEdit(STORED, { kind: 'delete', level: 'makes', id: 'mk_z' }),
    ).toEqual([STORED[1]]);
  });

  it('knows nothing of an id or a parent it does not hold', () => {
    expect(
      applyEdit(STORED, {
        kind: 'update',
        level: 'models',
        id: 'md_gone',
        change: { name: 'X' },
      }),
    ).toBeUndefined();
    expect(
      applyEdit(STORED, {
        kind: 'create',
        level: 'generations',
        parentId: 'md_gone',
        change: { name: 'X', yearFrom: 2000, yearTo: 2001 },
      }),
    ).toBeUndefined();
  });

  it('never touches the tree it was given', () => {
    const before = JSON.stringify(STORED);

    applyEdit(STORED, {
      kind: 'update',
      level: 'makes',
      id: 'mk_z',
      change: { name: 'Zikra Motors' },
    });

    expect(JSON.stringify(STORED)).toBe(before);
  });
});
