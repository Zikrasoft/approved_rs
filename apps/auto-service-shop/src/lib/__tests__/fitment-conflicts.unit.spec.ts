import { requirementConflicts } from '../fitment-conflicts';

const capacity = {
  id: 'req_capacity',
  category_id: 'cat_battery',
  field_key: 'capacity',
  option_keys: null,
  min: 80,
  max: null,
  quantity: 1,
};

const technology = {
  id: 'req_technology',
  category_id: 'cat_battery',
  field_key: 'technology',
  option_keys: ['agm'],
  min: null,
  max: null,
  quantity: 1,
};

const fields = [
  { key: 'capacity', label: 'Емкость', unit: 'А·ч', options: [] },
  {
    key: 'technology',
    label: 'Технология',
    unit: null,
    options: [
      { key: 'efb', label: 'EFB' },
      { key: 'agm', label: 'AGM' },
    ],
  },
];

describe('requirementConflicts', () => {
  it('names each field the part breaks and the cars that require it', () => {
    expect(
      requirementConflicts(
        {
          category_id: 'cat_battery',
          attributes: { capacity: 70, technology: 'efb' },
        },
        fields,
        [
          { label: 'BMW 3 F30 320d', requirements: [capacity, technology] },
          { label: 'BMW 3 F30 330i', requirements: [capacity] },
        ],
      ),
    ).toEqual([
      {
        field_key: 'capacity',
        field: 'Емкость',
        unit: 'А·ч',
        value: '70',
        options: null,
        min: 80,
        max: null,
        vehicles: ['BMW 3 F30 320d', 'BMW 3 F30 330i'],
      },
      {
        field_key: 'technology',
        field: 'Технология',
        unit: null,
        value: 'EFB',
        options: ['AGM'],
        min: null,
        max: null,
        vehicles: ['BMW 3 F30 320d'],
      },
    ]);
  });

  it('finds nothing when the part meets the requirements or leaves the field empty', () => {
    expect(
      requirementConflicts(
        { category_id: 'cat_battery', attributes: { capacity: 80 } },
        fields,
        [{ label: 'BMW 3 F30 320d', requirements: [capacity, technology] }],
      ),
    ).toEqual([]);
  });

  it('ignores requirements of other categories', () => {
    expect(
      requirementConflicts(
        { category_id: 'cat_oil', attributes: { capacity: 4 } },
        fields,
        [{ label: 'BMW 3 F30 320d', requirements: [capacity] }],
      ),
    ).toEqual([]);
  });
});
