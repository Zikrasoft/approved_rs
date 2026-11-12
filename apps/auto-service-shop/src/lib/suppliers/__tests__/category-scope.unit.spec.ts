import { categoryScope } from '../category-scope';

describe('categoryScope', () => {
  const scopeOf = categoryScope([
    { code: 'Oil Filter', category_id: 'cat_oil' },
    { code: 'Hydraulics', category_id: null },
  ]);

  it('files an article of a mapped code under its Category, whatever its case and spacing', () => {
    expect(scopeOf(' oil  filter ')).toEqual({ categoryId: 'cat_oil' });
  });

  it('skips an article of an excluded or an unmapped code and says which', () => {
    expect(scopeOf('HYDRAULICS')).toEqual({ skipped: 'excluded' });
    expect(scopeOf('EDM Filter')).toEqual({ skipped: 'unmapped' });
  });

  it('skips every article of a supplier that maps no category', () => {
    expect(categoryScope([])('anything')).toEqual({ skipped: 'unmapped' });
  });
});
