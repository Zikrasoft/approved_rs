import { describe, expect, it } from 'vitest';

import {
  cataloguePageListSchema,
  cataloguePartsHubSchema,
} from './pageList.ts';

const list = {
  parts: [{ slug: 'bmw-11428575211', indexable: true }],
  makes: [{ slug: 'bmw', name: 'BMW', hub: true, parts: 9 }],
  series: [
    { make: 'bmw', slug: '3-series', name: '3 Series', categories: ['brakes'] },
  ],
  categories: [{ slug: 'brakes', name: 'Brakes', listed: 4, demand: 12 }],
  catalogue_makes: [{ slug: 'bmw', name: 'BMW', show_on_site: true }],
};

describe('cataloguePageListSchema', () => {
  it('reads the list and strips a key a newer shop adds', () => {
    expect(
      cataloguePageListSchema.parse({
        ...list,
        generated_at: 'now',
        parts: [{ ...list.parts[0], noindex_reason: 'bare_number' }],
      }),
    ).toEqual(list);
  });

  it('reads a Category without the count an older shop leaves out as null', () => {
    const { listed: _listed, ...older } = list.categories[0];
    expect(
      cataloguePageListSchema.parse({ ...list, categories: [older] })
        .categories[0].listed,
    ).toBeNull();
  });

  it('reads a Category without the demand an older shop leaves out as null', () => {
    const { demand: _demand, ...older } = list.categories[0];
    expect(
      cataloguePageListSchema.parse({ ...list, categories: [older] })
        .categories[0].demand,
    ).toBeNull();
  });

  it('reads the Make counts and the Make list an older shop leaves out as null', () => {
    const { catalogue_makes: _makes, ...older } = list;
    const read = cataloguePageListSchema.parse({
      ...older,
      makes: [{ slug: 'bmw', name: 'BMW', hub: true }],
    });

    expect(read.makes[0].parts).toBeNull();
    expect(read.catalogue_makes).toBeNull();
  });

  it('refuses a list without its Parts', () => {
    const { parts: _parts, ...broken } = list;
    expect(cataloguePageListSchema.safeParse(broken).success).toBe(false);
  });
});

describe('cataloguePartsHubSchema', () => {
  const hub = { makes: list.makes, categories: list.categories };

  it('reads only the makes and Categories and strips a key a newer shop adds', () => {
    expect(
      cataloguePartsHubSchema.parse({
        ...hub,
        parts: list.parts,
        generated_at: 'now',
        makes: [{ ...list.makes[0], flag: true }],
      }),
    ).toEqual(hub);
  });

  it('reads the counts an older shop leaves out as null', () => {
    const { parts: _parts, ...older } = list.makes[0];
    const { listed: _listed, demand: _demand, ...bare } = list.categories[0];
    const parsed = cataloguePartsHubSchema.parse({
      makes: [older],
      categories: [bare],
    });
    expect(parsed.makes[0].parts).toBeNull();
    expect(parsed.categories[0]).toMatchObject({ listed: null, demand: null });
  });
});
