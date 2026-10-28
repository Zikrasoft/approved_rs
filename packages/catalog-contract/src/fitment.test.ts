import { describe, expect, it } from 'vitest';
import { positionGroups } from './ambiguity.ts';
import { fitmentsResponseSchema } from './fitment.ts';

const row = (
  part_id: string,
  overrides: Partial<Parameters<typeof positionGroups>[0][number]> = {},
) => ({
  part_id,
  category_id: 'category_pads',
  axle: null,
  side: null,
  steering: null,
  note: null,
  ...overrides,
});

describe('positionGroups', () => {
  it('keeps front and rear pads apart and calls neither ambiguous', () => {
    const groups = positionGroups(
      [
        row('part_front', { axle: 'front' }),
        row('part_rear', { axle: 'rear' }),
      ],
      {},
    );

    expect(
      groups.map(({ axle, ambiguous, fitments }) => [
        axle,
        ambiguous,
        fitments.map(({ part_id }) => part_id),
      ]),
    ).toEqual([
      ['front', false, ['part_front']],
      ['rear', false, ['part_rear']],
    ]);
  });

  it('calls two Parts at one Category and position ambiguous', () => {
    const [group] = positionGroups(
      [
        row('part_a', { axle: 'front', side: 'left' }),
        row('part_b', { axle: 'front', side: 'left' }),
      ],
      {},
    );

    expect(group).toMatchObject({
      category_id: 'category_pads',
      axle: 'front',
      side: 'left',
      ambiguous: true,
    });
  });

  it('calls one Part with a noted Fitment ambiguous', () => {
    const [group] = positionGroups(
      [row('part_a', { note: 'Только для спортивного пакета' })],
      {},
    );

    expect(group.ambiguous).toBe(true);
  });

  it('keeps two Fitments of the same Part unambiguous', () => {
    const [group] = positionGroups(
      [
        row('part_a', { steering: 'left' }),
        row('part_a', { steering: 'right' }),
      ],
      {},
    );

    expect(group.ambiguous).toBe(false);
    expect(group.fitments).toHaveLength(2);
  });

  it('drops the candidate the revealed steering rules out', () => {
    const rows = [
      row('part_lhd', { steering: 'left' }),
      row('part_rhd', { steering: 'right' }),
      row('part_any'),
    ];

    expect(positionGroups(rows, {})[0].ambiguous).toBe(true);

    const [group] = positionGroups(rows, { steering: 'right' });
    expect(group.fitments.map(({ part_id }) => part_id)).toEqual([
      'part_rhd',
      'part_any',
    ]);
  });

  it('settles the choice when the revealed steering leaves one Part', () => {
    const [group] = positionGroups(
      [
        row('part_lhd', { steering: 'left' }),
        row('part_rhd', { steering: 'right' }),
      ],
      { steering: 'left' },
    );

    expect(group.ambiguous).toBe(false);
    expect(group.fitments.map(({ part_id }) => part_id)).toEqual(['part_lhd']);
  });

  it('separates Categories and leaves out an unclassified Part', () => {
    const groups = positionGroups(
      [
        row('part_pads'),
        row('part_filter', { category_id: 'category_filters' }),
        row('part_loose', { category_id: null }),
      ],
      {},
    );

    expect(groups.map(({ category_id }) => category_id)).toEqual([
      'category_pads',
      'category_filters',
      null,
    ]);
    expect(groups.every(({ ambiguous }) => !ambiguous)).toBe(true);
  });
});

describe('fitmentsResponseSchema', () => {
  const fitment = {
    id: 'fit_1',
    part_id: 'part_1',
    vehicle_id: 'veh_1',
    quantity: 2,
    axle: 'front',
    side: null,
    production_from: '2015-03-01T00:00:00.000Z',
    production_to: null,
    gearbox: 'automatic',
    steering: null,
    note: 'Только с M-пакетом',
    translations: { sr: { note: 'Samo sa M paketom' } },
  };

  it('reads a page of Fitments', () => {
    expect(
      fitmentsResponseSchema.parse({
        fitments: [fitment],
        count: 1,
        offset: 0,
        limit: 1000,
      }).fitments,
    ).toEqual([fitment]);
  });

  it('reads a vocabulary value newer than the contract as null', () => {
    expect(
      fitmentsResponseSchema.parse({
        fitments: [
          {
            ...fitment,
            axle: 'middle',
            side: 'centre',
            gearbox: 'cvt',
            steering: 'centre',
          },
        ],
        count: 1,
        offset: 0,
        limit: 1000,
      }).fitments[0],
    ).toMatchObject({ axle: null, side: null, gearbox: null, steering: null });
  });
});
