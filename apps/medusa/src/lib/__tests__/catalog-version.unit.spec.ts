import {
  CATALOG_EVENTS,
  UNSTAMPED,
  catalogVersionOf,
  nextCatalogVersion,
} from '../catalog-version';

describe('the catalogue version', () => {
  it('is the moment of the last catalogue change', () => {
    expect(nextCatalogVersion(new Date('2026-09-28T10:00:00Z'))).toBe(
      '2026-09-28T10:00:00.000Z',
    );
  });

  it('reads the stamp from the store metadata', () => {
    expect(catalogVersionOf({ catalog_version: 'v1', other: 1 })).toBe('v1');
  });

  it.each([
    null,
    undefined,
    {},
    { catalog_version: '' },
    { catalog_version: 5 },
  ])('reads %p as never stamped', (metadata) => {
    expect(catalogVersionOf(metadata)).toBe(UNSTAMPED);
  });
});

describe('CATALOG_EVENTS', () => {
  it('covers everything the storefront bakes into its pages', () => {
    for (const event of [
      'product.created',
      'product.updated',
      'product.deleted',
      'product-variant.updated',
      'product-type.updated',
      'pricing.price.updated',
      'translation.created',
      'translation.updated',
    ]) {
      expect(CATALOG_EVENTS).toContain(event);
    }
  });

  it('never rebuilds for stock or orders, which the storefront reads live', () => {
    expect(
      CATALOG_EVENTS.filter((event) =>
        /inventory|reservation|stock|order|cart/.test(event),
      ),
    ).toEqual([]);
  });
});
