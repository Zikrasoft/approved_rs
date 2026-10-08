import { describe, expect, it } from 'vitest';
import { readCatalog } from './catalog';
import { battery, products } from './catalog.fixture';
import {
  landingProducts,
  landingsFor,
  productsOfType,
  shopTypes,
} from './shopPages';
import { typeView } from './typeView';

const BATTERIES = typeView('batteries', 'ru').type;
const FILTERS = typeView('filters', 'ru').type;

const withCapacity = (handle: string, capacityAh: number, price = 10000) => {
  const product = battery(handle);
  product.metadata = {
    ...product.metadata,
    spec: { ...product.metadata.spec, capacityAh },
  };
  product.variants[0].calculated_price = {
    calculated_amount: price,
    currency_code: 'rsd',
  };
  return product;
};

describe('shop pages', () => {
  it('lists only types that have something to sell, in registry order', () => {
    const { catalog } = readCatalog(products([withCapacity('a', 60)]));

    expect(shopTypes(catalog.products)).toEqual([BATTERIES]);
    expect(productsOfType(catalog.products, FILTERS)).toEqual([]);
  });

  it('opens a landing once enough priced products share a value', () => {
    const { catalog } = readCatalog(
      products([
        withCapacity('a', 60),
        withCapacity('b', 60),
        withCapacity('c', 60),
      ]),
    );

    expect(landingsFor(catalog.products, BATTERIES)).toEqual([
      { slug: '60ah', key: 'capacityAh', value: 60 },
    ]);
  });

  it('does not let a product without a price push a value over the landing threshold', () => {
    const { catalog } = readCatalog(
      products([
        withCapacity('a', 60),
        withCapacity('b', 60),
        withCapacity('c', 60, 0),
      ]),
    );

    expect(landingsFor(catalog.products, BATTERIES)).toEqual([]);
  });

  it('puts exactly the landing value on the landing', () => {
    const { catalog } = readCatalog(
      products([withCapacity('a', 60), withCapacity('b', 74)]),
    );

    expect(
      landingProducts(catalog.products, BATTERIES, {
        key: 'capacityAh',
        value: 60,
      }).map((product) => product.handle),
    ).toEqual(['a']);
  });
});
