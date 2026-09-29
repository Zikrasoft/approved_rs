import type { CatalogProduct } from './catalog';

export function productJsonLd({
  product,
  url,
  description,
}: {
  product: CatalogProduct;
  url: string;
  description: string;
}): Record<string, unknown> {
  const brand = product.spec.brand;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    ...(product.image && { image: product.image }),
    ...(typeof brand === 'string' && {
      brand: { '@type': 'Brand', name: brand },
    }),
    description,
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'RSD',
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      url,
    },
  };
}
