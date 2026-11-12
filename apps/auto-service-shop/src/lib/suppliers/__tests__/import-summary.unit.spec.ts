import { importTally } from '../import-summary';

describe('importTally', () => {
  it('counts skipped articles by reason and only articles in the skipped total', () => {
    const tally = importTally('MANN-FILTER');

    tally.skip('brand', 2);
    tally.skip('excluded');
    tally.skip('not_in_scope', 3);
    tally.skip('currency');
    tally.skip('no_engine_code', 4);
    tally.skip('no_make', 5);

    expect(tally.summary).toMatchObject({
      skipped: 6,
      skipped_by_reason: {
        brand: 2,
        excluded: 1,
        not_in_scope: 3,
        currency: 1,
        no_engine_code: 4,
        no_make: 5,
        unmapped: 0,
        unreadable: 0,
      },
    });
  });

  it('lists unmapped codes once under their first spelling, most articles first', () => {
    const tally = importTally('MANN-FILTER');

    for (const code of [
      'EDM Filter',
      'Hydraulics',
      'hydraulics',
      'EDM Filter',
      'HYDRAULICS',
    ]) {
      tally.unmapped(code);
    }

    expect(tally.summary).toMatchObject({
      skipped: 5,
      skipped_by_reason: { unmapped: 5 },
      unmapped_categories: [
        { code: 'Hydraulics', count: 3 },
        { code: 'EDM Filter', count: 2 },
      ],
    });
  });

  it('counts each imported article as created, updated or unchanged', () => {
    const tally = importTally('MANN-FILTER');

    for (const outcome of [
      'created',
      'updated',
      'unchanged',
      'unchanged',
    ] as const) {
      tally.imported(outcome);
    }

    expect(tally.summary).toMatchObject({
      supplier: 'MANN-FILTER',
      created: 1,
      updated: 1,
      unchanged: 2,
      skipped: 0,
    });
  });
});
