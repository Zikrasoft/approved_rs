import {
  PRODUCT_TYPES,
  landingPages,
  matchesFacets,
  productType,
  type LandingPage,
} from '@podbor/shop-catalog/browser';
import type { CatalogProduct } from './catalog';

export const productsOfType = (
  products: CatalogProduct[],
  typeKey: string,
): CatalogProduct[] =>
  products.filter((product) => product.typeKey === typeKey);

export const shopTypeKeys = (products: CatalogProduct[]): string[] =>
  PRODUCT_TYPES.map((type) => type.key).filter(
    (key) => productsOfType(products, key).length > 0,
  );

export function landingsFor(
  products: CatalogProduct[],
  typeKey: string,
): LandingPage[] {
  const type = productType(typeKey);
  return type
    ? landingPages(
        type,
        productsOfType(products, typeKey).map((product) => product.spec),
      )
    : [];
}

export function landingProducts(
  products: CatalogProduct[],
  typeKey: string,
  landing: { key: string; value: string | number },
): CatalogProduct[] {
  const type = productType(typeKey)!;
  const selection =
    typeof landing.value === 'number'
      ? { min: landing.value, max: landing.value }
      : { values: [landing.value] };
  return productsOfType(products, typeKey).filter((product) =>
    matchesFacets(type, product.spec, { [landing.key]: selection }),
  );
}
