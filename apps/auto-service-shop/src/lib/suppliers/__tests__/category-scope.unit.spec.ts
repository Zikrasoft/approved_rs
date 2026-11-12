import { categoryScope, scopedCodeOf } from '../category-scope';

describe('categoryScope', () => {
  const scopeOf = categoryScope([
    { code: 'Oil Filter', category_id: 'cat_oil' },
    { code: 'Hydraulics', category_id: null },
    { code: 'Filter goriva', category_id: 'cat_fuel' },
    { code: 'Filter goriva | Za benzin', category_id: null },
  ]);

  it('files an article of a mapped code under its Category, whatever its case and spacing', () => {
    expect(scopeOf(' oil  filter ')).toEqual({ categoryId: 'cat_oil' });
  });

  it('skips an article of an excluded or an unmapped code and says which', () => {
    expect(scopeOf('HYDRAULICS')).toEqual({ skipped: 'excluded' });
    expect(scopeOf('EDM Filter')).toEqual({ skipped: 'unmapped' });
  });

  it('decides a code with a subtype by its base code when the whole code is not mapped', () => {
    expect(scopeOf('Filter goriva | Za dizel')).toEqual({
      categoryId: 'cat_fuel',
    });
    expect(scopeOf('Hydraulics | Pumps')).toEqual({ skipped: 'excluded' });
    expect(scopeOf('EDM Filter | Wire')).toEqual({ skipped: 'unmapped' });
  });

  it('decides a code with a subtype by the whole code first', () => {
    expect(scopeOf('Filter goriva | Za benzin')).toEqual({
      skipped: 'excluded',
    });
  });

  it('skips every article of a supplier that maps no category', () => {
    expect(categoryScope([])('anything')).toEqual({ skipped: 'unmapped' });
  });
});

describe('scopedCodeOf', () => {
  const codeOf = scopedCodeOf(['Filter goriva', 'Fuel Filter | For diesel']);

  it('finds the listed code a supplier code is decided by', () => {
    expect(codeOf('fuel filter | for diesel')).toBe('Fuel Filter | For diesel');
    expect(codeOf('Filter goriva | Za dizel')).toBe('Filter goriva');
    expect(codeOf('Fuel Filter | For gasoline')).toBeNull();
    expect(codeOf('Filter ulja')).toBeNull();
  });
});
