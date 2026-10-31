import type { CarHit } from '@podbor/catalog-contract';

import { nearestPlace } from '../car-pages';

const make = { slug: 'bmw', name: 'BMW' };
const model = (slug: string) => ({
  slug,
  name: '320d',
  chassis: {
    code: 'F30',
    body_style: null,
    series: { name: '3', translations: null, make },
  },
});
const address = (id: string, modelSlug: string) => ({
  id,
  model: { slug: modelSlug, chassis: { series: { make: { slug: 'bmw' } } } },
});
const vehicleCard = (id: string, modelSlug: string): CarHit => ({
  kind: 'vehicle',
  make,
  model: model(modelSlug),
  vehicle: {
    id,
    slug: id,
    engine: { code: 'B47' },
    power_kw: null,
    year_from: null,
    year_to: null,
  },
});
const modelCard = (slug: string): CarHit => ({
  kind: 'model',
  make,
  model: model(slug),
  vehicle: null,
});
const makeCard: CarHit = { kind: 'make', make, model: null, vehicle: null };

const paged = (...cards: CarHit[]) =>
  new Map(
    cards.map((card) => [
      card.kind === 'make'
        ? `make:${card.make.slug}`
        : card.kind === 'model'
          ? `model:bmw/${card.model?.slug}`
          : `vehicle:${card.vehicle?.id}`,
      card,
    ]),
  );

describe('nearestPlace', () => {
  const one = [address('veh_1', 'f30-320d')];

  it('is the Vehicle when it has a page', () => {
    const vehicle = vehicleCard('veh_1', 'f30-320d');
    expect(
      nearestPlace(one, null, paged(vehicle, modelCard('f30-320d'), makeCard)),
    ).toBe(vehicle);
  });

  it('is the Model when the Vehicle has no page', () => {
    const f30 = modelCard('f30-320d');
    expect(nearestPlace(one, null, paged(f30, makeCard))).toBe(f30);
  });

  it('is the Make when neither the Vehicle nor the Model has a page', () => {
    expect(nearestPlace(one, null, paged(makeCard))).toBe(makeCard);
  });

  it('is nothing when no place of the car has a page', () => {
    expect(nearestPlace(one, null, paged())).toBeNull();
  });

  it('is the Model several candidates share, never one of them', () => {
    const f30 = modelCard('f30-320d');
    const candidates = [
      address('veh_1', 'f30-320d'),
      address('veh_2', 'f30-320d'),
    ];
    expect(
      nearestPlace(
        candidates,
        null,
        paged(vehicleCard('veh_1', 'f30-320d'), f30, makeCard),
      ),
    ).toBe(f30);
  });

  it('is the shared Make when the candidates sit in different Models', () => {
    const candidates = [
      address('veh_1', 'f30-320d'),
      address('veh_2', 'g20-320d'),
    ];
    expect(
      nearestPlace(
        candidates,
        null,
        paged(modelCard('f30-320d'), modelCard('g20-320d'), makeCard),
      ),
    ).toBe(makeCard);
  });

  it('is the decoded Make when neither a Vehicle nor a Model is known', () => {
    expect(nearestPlace([], null, paged(makeCard), 'bmw')).toBe(makeCard);
    expect(nearestPlace([], null, paged(), 'bmw')).toBeNull();
  });

  it('is the named Model when no candidate Vehicle is known', () => {
    const f30 = modelCard('f30-320d');
    expect(nearestPlace([], 'f30-320d', paged(f30), 'bmw')).toBe(f30);
  });
});
