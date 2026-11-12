import { generationOf } from '../car-for';

const unresolved = (fields: object) =>
  ({
    resolved: false,
    make: 'audi',
    code: null,
    model_slug: null,
    vehicle_ids: [],
    ...fields,
  }) as Parameters<typeof generationOf>[0];

describe('generationOf', () => {
  it('exposes the shared model of an ambiguous VIN', () => {
    expect(
      generationOf(unresolved({ model_slug: 'a3', code: '8V' })),
    ).toMatchObject({ make: 'audi', model_slug: 'a3', code: '8V' });
  });

  it('carries the VAG reference chassis and generation', () => {
    const generation = generationOf(unresolved({ code: '8V' }));
    expect(generation?.model).toMatch(/A3/);
    expect(generation?.chassis).toBeTruthy();
  });

  it('keeps the slug without a reference', () => {
    expect(
      generationOf(unresolved({ make: 'bmw', model_slug: '3-series' })),
    ).toEqual({
      make: 'bmw',
      model_slug: '3-series',
      code: null,
      chassis: null,
      model: null,
    });
  });

  it('is null for an unknown make or nothing shared', () => {
    expect(generationOf(unresolved({ make: null, code: '8V' }))).toBeNull();
    expect(generationOf(unresolved({}))).toBeNull();
  });
});
