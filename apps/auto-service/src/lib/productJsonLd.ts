import { productSchema } from '@podbor/site-kit';
import type { CatalogProduct } from './catalog';

export const productJsonLd =
  ({
    product,
    description,
  }: {
    product: CatalogProduct;
    description: string;
  }) =>
  (url: string) => {
    const brand = product.spec.brand;
    return productSchema({
      name: product.title,
      image: product.image || undefined,
      brand: typeof brand === 'string' ? brand : undefined,
      description,
      price: product.price,
      currency: 'RSD',
      inStock: product.inStock,
      condition: 'NewCondition',
      url,
    });
  };
