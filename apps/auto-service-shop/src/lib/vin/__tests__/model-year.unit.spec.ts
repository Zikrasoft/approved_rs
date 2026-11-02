import { vinModelYears } from '../model-year';

describe('vinModelYears', () => {
  it('reads the model years the tenth character can stand for', () => {
    expect(vinModelYears('WVWZZZAUZHW374138')).toEqual([1987, 2017, 2047]);
    expect(vinModelYears('WVWZZZ1KZ9W000001')).toEqual([2009, 2039, 2069]);
  });

  it('reads none from a character no model year uses', () => {
    expect(vinModelYears('WVWZZZ1KZZW000001')).toEqual([]);
    expect(vinModelYears('WVWZZZ1KZ0W000001')).toEqual([]);
  });
});
