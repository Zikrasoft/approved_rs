import type { CarHit } from '@podbor/catalog-contract';

import { fittedCarKeys, nearestPlace } from '../car-pages';

const make = { slug: 'bmw', name: 'BMW' };
const address = (id: string, series: string) => ({
  id,
  model: {
    slug: `${id}-model`,
    chassis: { series: { name: series, make: { slug: 'bmw' } } },
  },
});
const seriesCard = (name: string): CarHit => ({
  kind: 'series',
  make,
  series: { name, translations: null },
  model: null,
  vehicle: null,
});
const makeCard: CarHit = {
  kind: 'make',
  make,
  series: null,
  model: null,
  vehicle: null,
};

const paged = (...cards: CarHit[]) =>
  new Map(
    cards.map((card) => [
      card.kind === 'make'
        ? `make:${card.make.slug}`
        : `series:bmw/${card.series?.name.toLowerCase().replace(' ', '-')}`,
      card,
    ]),
  );

describe('fittedCarKeys', () => {
  it('names the Make, the Series, the Model and the Vehicle a Part fits', () => {
    expect(fittedCarKeys(address('veh_1', '3 Series'))).toEqual([
      'make:bmw',
      'series:bmw/3-series',
      'model:bmw/veh_1-model',
      'vehicle:veh_1',
    ]);
  });
});

describe('nearestPlace', () => {
  const one = [address('veh_1', '3 Series')];

  it('is the Series of the car when it has a page', () => {
    const series = seriesCard('3 Series');
    expect(nearestPlace(one, null, paged(series, makeCard))).toBe(series);
  });

  it('is the Make when the Series has no page', () => {
    expect(nearestPlace(one, null, paged(makeCard))).toBe(makeCard);
  });

  it('is nothing when no place of the car has a page', () => {
    expect(nearestPlace(one, null, paged())).toBeNull();
  });

  it('is the Series several candidates share', () => {
    const series = seriesCard('3 Series');
    const candidates = [
      address('veh_1', '3 Series'),
      address('veh_2', '3 Series'),
    ];
    expect(nearestPlace(candidates, null, paged(series, makeCard))).toBe(
      series,
    );
  });

  it('is the shared Make when the candidates sit in different Series', () => {
    const candidates = [
      address('veh_1', '3 Series'),
      address('veh_2', '5 Series'),
    ];
    expect(
      nearestPlace(
        candidates,
        null,
        paged(seriesCard('3 Series'), seriesCard('5 Series'), makeCard),
      ),
    ).toBe(makeCard);
  });

  it('is the decoded Make when neither a Vehicle nor a Series is known', () => {
    expect(nearestPlace([], null, paged(makeCard), 'bmw')).toBe(makeCard);
    expect(nearestPlace([], null, paged(), 'bmw')).toBeNull();
  });

  it('is the named Series when no candidate Vehicle is known', () => {
    const series = seriesCard('3 Series');
    expect(
      nearestPlace(
        [],
        { name: '3 Series', make: { slug: 'bmw' } },
        paged(series),
        'bmw',
      ),
    ).toBe(series);
  });
});
