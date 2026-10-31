import type { SearchTypes } from '@medusajs/framework/types';

import {
  collectSearchableFields,
  compileFacets,
  compileFilters,
  toFacetResults,
  toTypesenseFields,
} from '../mapping';

describe('compileFacets', () => {
  it('asks for nothing without facets', () => {
    expect(compileFacets([])).toEqual({});
  });

  it('facets on every requested field with the largest limit', () => {
    expect(
      compileFacets([
        { field: 'facets', type: 'value', limit: 50 },
        { field: 'brand', limit: 10 },
      ]),
    ).toEqual({ facet_by: 'facets,brand', max_facet_values: 50 });
  });

  it('refuses a range facet', () => {
    expect(() =>
      compileFacets([{ field: 'price', type: 'range', ranges: [] }]),
    ).toThrow('unsupported "range" facet on "price"');
  });

  it('facets a stats field like a value field', () => {
    expect(compileFacets([{ field: 'price', type: 'stats' }])).toEqual({
      facet_by: 'price',
    });
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

  it('compiles a plain list the way the module deletes removed documents', () => {
    expect(compileFilters({ id: ['a', 'b'] })).toBe('id:=[`a`,`b`]');
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

  it('compiles inclusive bounds into comparisons', () => {
    expect(compileFilters({ price: { $gte: 1000, $lte: 2500 } })).toBe(
      'price:>=1000 && price:<=2500',
    );
    expect(compileFilters({ price: { $gte: 1000 } })).toBe('price:>=1000');
    expect(compileFilters({ price: { $lte: 2500 } })).toBe('price:<=2500');
  });
});

describe('toFacetResults', () => {
  it('reads value counts and the stats of a stats facet', () => {
    expect(
      toFacetResults(
        [{ field: 'facets' }, { field: 'price', type: 'stats' }],
        [
          {
            field_name: 'facets',
            counts: [{ value: 'brand:ate', count: 2 }],
          },
          {
            field_name: 'price',
            counts: [
              { value: '900', count: 2 },
              { value: '2400', count: 1 },
            ],
            stats: { min: 900, max: 2400 },
          },
        ],
      ),
    ).toEqual({
      facets: {
        type: 'value',
        values: [{ value: 'brand:ate', count: 2 }],
      },
      price: { type: 'stats', min: 900, max: 2400, count: 3 },
    });
  });

  it('leaves out a stats facet nothing has a value for', () => {
    expect(
      toFacetResults(
        [{ field: 'price', type: 'stats' }],
        [{ field_name: 'price', counts: [], stats: {} }],
      ),
    ).toEqual({});
  });
});
