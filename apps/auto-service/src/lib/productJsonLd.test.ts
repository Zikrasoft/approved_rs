import { describe, expect, it } from 'vitest';
import { jsonLdText } from '@podbor/site-kit';
import { readCatalog } from './catalog';
import { BATTERY, products } from './catalog.fixture';
import { productJsonLd } from './productJsonLd';

const [product] = readCatalog(products([BATTERY])).catalog.products;
const URL_ = 'https://carlab.rs/sr/shop/batteries/bosch-s4-024/';

describe('productJsonLd', () => {
  it('describes one offer in whole dinars with the baked availability', () => {
    expect(
      JSON.parse(
        jsonLdText(productJsonLd({ product, description: 'Opis' })(URL_)),
      ),
    ).toEqual({
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
    const ld = JSON.parse(
      jsonLdText(
        productJsonLd({
          product: { ...product, inStock: false, image: null },
          description: 'Opis',
        })(URL_),
      ),
    );

    expect(ld).not.toHaveProperty('image');
    expect(ld.offers.availability).toBe('https://schema.org/OutOfStock');
  });
});
