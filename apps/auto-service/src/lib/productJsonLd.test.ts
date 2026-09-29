import { describe, expect, it } from 'vitest';
import { readCatalog } from './catalog';
import { BATTERY, products } from './catalog.fixture';
import { productJsonLd } from './productJsonLd';

const [product] = readCatalog(products([BATTERY])).catalog.products;
const URL_ = 'https://carlab.rs/sr/shop/batteries/bosch-s4-024/';

describe('productJsonLd', () => {
  it('describes one offer in whole dinars with the baked availability', () => {
    expect(productJsonLd({ product, url: URL_, description: 'Opis' })).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Bosch S4 024',
      image: BATTERY.thumbnail,
      brand: { '@type': 'Brand', name: 'Bosch' },
      description: 'Opis',
      offers: {
        '@type': 'Offer',
        price: 11190,
        priceCurrency: 'RSD',
        availability: 'https://schema.org/InStock',
        itemCondition: 'https://schema.org/NewCondition',
        url: URL_,
      },
    });
  });

  it('says out of stock and leaves out an image it does not have', () => {
    const ld = productJsonLd({
      product: { ...product, inStock: false, image: null },
      url: URL_,
      description: 'Opis',
    });

    expect(ld).not.toHaveProperty('image');
    expect((ld.offers as Record<string, unknown>).availability).toBe(
      'https://schema.org/OutOfStock',
    );
  });
});
