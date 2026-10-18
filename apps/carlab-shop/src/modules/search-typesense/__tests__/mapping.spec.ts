import type { SearchTypes } from '@medusajs/framework/types';

import {
  compactValue,
  collectSearchableFields,
  compileFilters,
  toTypesenseFields,
} from '../mapping';

describe('compactValue', () => {
  it('strips spaces and punctuation and lowercases', () => {
    expect(compactValue('HU 816 x')).toBe('hu816x');
    expect(compactValue('11 42 8575211')).toBe('11428575211');
  });

  it('strips internal punctuation such as slashes and dots', () => {
    expect(compactValue('B47/B48')).toBe('b47b48');
  });
});

describe('toTypesenseFields', () => {
  it('maps a filterable keyword field to a Typesense string field', () => {
    const fields: Record<string, SearchTypes.SearchFieldDefinition> = {
      id: { type: 'keyword', filterable: true },
    };

    expect(toTypesenseFields(fields)).toEqual([
      {
        name: 'id',
        type: 'string',
        optional: false,
        facet: false,
        sort: false,
      },
    ]);
  });

  it('maps integer and float leaves to Typesense numeric types', () => {
    const fields: Record<string, SearchTypes.SearchFieldDefinition> = {
      stock_quantity: { type: 'integer', sortable: true },
      price: { type: 'float', facetable: true },
    };

    expect(toTypesenseFields(fields)).toEqual([
      {
        name: 'stock_quantity',
        type: 'int32',
        optional: true,
        facet: false,
        sort: true,
      },
      {
        name: 'price',
        type: 'float',
        optional: true,
        facet: true,
        sort: false,
      },
    ]);
  });

  it('expands a nested object array into dotted child fields, array-suffixed', () => {
    const fields: Record<string, SearchTypes.SearchFieldDefinition> = {
      identifiers: {
        type: 'object',
        array: true,
        retrievable: false,
        fields: {
          value: { type: 'text', searchable: true, retrievable: false },
        },
      },
    };

    expect(toTypesenseFields(fields)).toEqual([
      { name: 'identifiers', type: 'object[]', optional: true },
      {
        name: 'identifiers.value',
        type: 'string[]',
        optional: true,
        facet: false,
        sort: false,
      },
    ]);
  });

  it('propagates the array suffix to leaves nested two levels deep', () => {
    const fields: Record<string, SearchTypes.SearchFieldDefinition> = {
      identifiers: {
        type: 'object',
        array: true,
        fields: {
          offers: {
            type: 'object',
            array: true,
            fields: {
              price: { type: 'float' },
            },
          },
        },
      },
    };

    expect(toTypesenseFields(fields)).toEqual([
      { name: 'identifiers', type: 'object[]', optional: true },
      { name: 'identifiers.offers', type: 'object[]', optional: true },
      {
        name: 'identifiers.offers.price',
        type: 'float[]',
        optional: true,
        facet: false,
        sort: false,
      },
    ]);
  });

  it('throws for a field kind it cannot hold', () => {
    const fields: Record<string, SearchTypes.SearchFieldDefinition> = {
      location: { type: 'geo' },
    };

    expect(() => toTypesenseFields(fields)).toThrow(/geo/);
  });
});

describe('collectSearchableFields', () => {
  it('collects dotted paths of searchable leaves, skipping non-searchable ones', () => {
    const fields: Record<string, SearchTypes.SearchFieldDefinition> = {
      id: { type: 'keyword', filterable: true },
      name: { type: 'text', searchable: true },
      identifiers: {
        type: 'object',
        array: true,
        fields: {
          value: { type: 'text', searchable: true },
          brand: { type: 'keyword', filterable: true },
        },
      },
    };

    expect(collectSearchableFields(fields)).toEqual([
      'name',
      'identifiers.value',
    ]);
  });
});

describe('compileFilters', () => {
  it('returns undefined for no filters', () => {
    expect(compileFilters(undefined)).toBeUndefined();
  });

  it('ignores the free-text q key, already lifted out by the module', () => {
    expect(compileFilters({ q: 'anything' })).toBeUndefined();
  });

  it('compiles a plain equality filter', () => {
    expect(compileFilters({ status: 'published' })).toBe('status:=`published`');
  });

  it('compiles a numeric equality filter without quoting', () => {
    expect(compileFilters({ stock_quantity: 5 })).toBe('stock_quantity:=5');
  });

  it('compiles an $in filter into a bracketed list', () => {
    expect(compileFilters({ brand: { $in: ['BMW', 'Mann-Filter'] } })).toBe(
      'brand:=[`BMW`,`Mann-Filter`]',
    );
  });

  it('compiles $and into a conjunction', () => {
    expect(
      compileFilters({
        $and: [{ status: 'published' }, { stock_quantity: 5 }],
      }),
    ).toBe('status:=`published` && stock_quantity:=5');
  });

  it('throws for an unsupported operator', () => {
    expect(() => compileFilters({ title: { $like: 'shirt' } })).toThrow(
      /\$like/,
    );
  });

  it('throws for an unsupported logical operator', () => {
    expect(() => compileFilters({ $or: [{ a: 1 }] })).toThrow(/\$or/);
  });
});
