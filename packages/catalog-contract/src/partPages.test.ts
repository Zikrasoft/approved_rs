import { describe, expect, it } from 'vitest';
import { smallestImage } from './images.ts';
import { partPageSchema } from './partPages.ts';

const page = {
  id: 'pi_1',
  type: 'manufacturer-number',
  value: 'HU 816 x',
  normalized_value: 'HU816X',
  superseded: false,
  brand: { name: 'Mann-Filter', slug: 'mann-filter' },
  images: [],
  part: {
    id: 'part_1',
    name: 'Масляный фильтр',
    description: null,
    translations: { sr: { name: 'Filter ulja' }, en: { name: 'Oil filter' } },
    replaced_by: null,
    category_id: null,
    attributes: {},
    installation_price: null,
  },
  equivalents: [],
  offers: [],
  supplier_data: { cross_references: [], applicability: [], images: [] },
};

describe('partPageSchema', () => {
  it('accepts a brand-number page', () => {
    expect(partPageSchema.parse(page)).toEqual(page);
  });

  it('carries what installing the Part at CarLab costs', () => {
    const installed = {
      ...page,
      part: { ...page.part, installation_price: 0 },
    };
    expect(partPageSchema.parse(installed)).toEqual(installed);
    expect(
      partPageSchema.parse({
        ...page,
        part: { ...page.part, installation_price: undefined },
      }).part.installation_price,
    ).toBeNull();
  });

  it('carries the Part description in every locale', () => {
    const described = {
      ...page,
      part: {
        ...page.part,
        description: 'Фильтр с обратным клапаном',
        translations: {
          sr: {
            name: 'Filter ulja',
            description: 'Filter sa nepovratnim ventilom',
          },
          en: { name: 'Oil filter', description: 'Filter with a check valve' },
        },
      },
    };
    expect(partPageSchema.parse(described)).toEqual(described);
    expect(
      partPageSchema.parse({
        ...page,
        part: { ...page.part, description: undefined },
      }).part.description,
    ).toBeNull();
  });

  it('accepts a superseded number whose Part has a replacement', () => {
    const replaced = {
      ...page,
      superseded: true,
      part: {
        ...page.part,
        replaced_by: {
          id: 'part_2',
          name: 'Oil filter, revised',
          translations: null,
          brand_number: {
            id: 'pi_2',
            type: 'manufacturer-number',
            value: 'HU 816 z',
            normalized_value: 'HU816Z',
            superseded: false,
            brand: page.brand,
          },
        },
      },
    };
    expect(partPageSchema.parse(replaced)).toEqual(replaced);
  });

  it('accepts the brand-number images and its equivalents images in order, without their stored files', () => {
    const image = {
      src: 'https://api.carlab.rs/static/hu816x-960.webp',
      width: 960,
      height: 960,
      srcset: [
        { url: 'https://api.carlab.rs/static/hu816x-160.webp', width: 160 },
        { url: 'https://api.carlab.rs/static/hu816x-960.webp', width: 960 },
      ],
    };
    const pictured = {
      ...page,
      images: [image],
      equivalents: [
        {
          id: 'pi_2',
          type: 'oem',
          value: '11 42 8575211',
          normalized_value: '11428575211',
          superseded: false,
          brand: { name: 'BMW', slug: 'bmw' },
          images: [image],
        },
      ],
    };
    expect(partPageSchema.parse(pictured)).toEqual(pictured);
    expect(smallestImage(image)).toBe(image.srcset[0].url);
    expect(smallestImage({ ...image, srcset: [] })).toBe(image.src);
    expect(
      partPageSchema.parse({
        ...page,
        images: [{ ...image, file_ids: ['f_1'] }],
      }).images,
    ).toEqual([image]);
  });

  it('accepts offers with a price, currency, stock and lead time', () => {
    const offered = {
      ...page,
      offers: [
        {
          id: 'offer_1',
          price: 1850,
          currency: 'RSD',
          stock_quantity: 4,
          lead_time_days: 0,
        },
      ],
    };
    expect(partPageSchema.parse(offered)).toEqual(offered);
  });

  it('refuses an offer that names its supplier', () => {
    expect(
      partPageSchema.safeParse({
        ...page,
        offers: [
          {
            id: 'offer_1',
            price: 1850,
            currency: 'RSD',
            stock_quantity: 4,
            lead_time_days: 0,
            supplier: 'Intercars',
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('refuses a page without its offers', () => {
    expect(
      partPageSchema.safeParse({ ...page, offers: undefined }).success,
    ).toBe(false);
  });

  it.each(['Mann Filter', 'mann--filter', '-mann', ''])(
    'refuses the Brand slug %j',
    (slug) => {
      expect(
        partPageSchema.safeParse({ ...page, brand: { ...page.brand, slug } })
          .success,
      ).toBe(false);
    },
  );
});
