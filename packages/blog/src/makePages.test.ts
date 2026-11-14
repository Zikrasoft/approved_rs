import { describe, expect, it } from 'vitest';
import { makePages } from './makePages.ts';

const BMW = { slug: 'bmw', name: 'BMW' };
const AUDI = { slug: 'audi', name: 'Audi' };
const SEAT = { slug: 'seat', name: 'Seat' };

const on = (make?: string | null, id?: string) => ({ id, data: { make } });

describe('makePages', () => {
  it('gives a Make with a Work a page holding its Works in the order given', () => {
    const works = [on('bmw', 'x3'), on('audi', 'a3'), on('bmw', 'x1')];

    expect(makePages([BMW], { works })).toEqual([
      { make: BMW, works: [on('bmw', 'x3'), on('bmw', 'x1')] },
    ]);
  });

  it('gives no page to a Make nothing names', () => {
    expect(makePages([BMW, AUDI], { works: [on('bmw')] })).toEqual([
      { make: BMW, works: [on('bmw')] },
    ]);
  });

  it('gives no page to a make missing from the list', () => {
    expect(makePages([BMW], { works: [on('tesla')] })).toEqual([]);
  });

  it('leaves an entry that names no Make on no page', () => {
    expect(makePages([BMW], { works: [on(), on(null), on('')] })).toEqual([]);
  });

  it('gives a page when any one source has material and holds every source', () => {
    expect(
      makePages([BMW, AUDI], {
        works: [on('audi')],
        articles: [on('bmw')],
      }),
    ).toEqual([
      { make: BMW, works: [], articles: [on('bmw')] },
      { make: AUDI, works: [on('audi')], articles: [] },
    ]);
  });

  it('lists the pages in the order of the Make list', () => {
    expect(
      makePages([SEAT, AUDI, BMW], {
        works: [on('bmw'), on('audi'), on('seat')],
      }).map(({ make }) => make.slug),
    ).toEqual(['seat', 'audi', 'bmw']);
  });

  it('gives no page at all without sources', () => {
    expect(makePages([BMW], {})).toEqual([]);
  });
});
