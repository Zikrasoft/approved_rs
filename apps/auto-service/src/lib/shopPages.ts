import {
  PRODUCT_TYPES,
  landingPages,
  matchesFacets,
  type LandingPage,
  type ProductTypeDef,
} from '@podbor/shop-catalog/browser';
import type { CatalogProduct } from './catalog';

export const productsOfType = (
  products: CatalogProduct[],
  type: ProductTypeDef,
): CatalogProduct[] =>
  products.filter((product) => product.type.key === type.key);

export const shopTypes = (products: CatalogProduct[]): ProductTypeDef[] =>
  PRODUCT_TYPES.filter((type) => productsOfType(products, type).length > 0);

export const landingsFor = (
  products: CatalogProduct[],
  type: ProductTypeDef,
): LandingPage[] =>
  landingPages(
    type,
    productsOfType(products, type).map((product) => product.spec),
  );

export function landingProducts(
  products: CatalogProduct[],
  type: ProductTypeDef,
  landing: { key: string; value: string | number },
): CatalogProduct[] {
  const selection =
    typeof landing.value === 'number'
      ? { min: landing.value, max: landing.value }
      : { values: [landing.value] };
  return productsOfType(products, type).filter((product) =>
    matchesFacets(type, product.spec, { [landing.key]: selection }),
  );
}
