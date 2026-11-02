import { searchRanking } from '../../search/part-identifier';

describe('searchRanking', () => {
  it('ranks by relevance, then standing, by default', () => {
    expect(searchRanking('ru').sort_by).toBe('_text_match:desc,standing:desc');
  });

  it('puts demand first for the popular sort, keeping the default order behind it', () => {
    expect(searchRanking('ru', [], 'popular').sort_by).toBe(
      'demand:desc,_text_match:desc,standing:desc',
    );
  });

  it('keeps fitting cars first and gives up standing within the three sort fields Typesense takes', () => {
    expect(searchRanking('ru', ['model:bmw/x3'], 'popular').sort_by).toBe(
      '_eval(cars:=[`model:bmw/x3`]):desc,demand:desc,_text_match:desc',
    );
    expect(searchRanking('ru', ['model:bmw/x3']).sort_by).toBe(
      '_eval(cars:=[`model:bmw/x3`]):desc,_text_match:desc,standing:desc',
    );
  });
});
