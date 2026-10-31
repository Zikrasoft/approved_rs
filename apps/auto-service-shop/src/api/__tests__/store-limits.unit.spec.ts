import { StoreSearchParts } from '../store/validators';

describe('store search limits', () => {
  it('refuses an offset past the last reachable page', () => {
    expect(
      StoreSearchParts.safeParse({ q: 'mann', offset: '99999999999' }).success,
    ).toBe(false);
  });

  it('accepts an offset deep inside the results', () => {
    expect(
      StoreSearchParts.safeParse({ q: 'mann', offset: '1000' }).success,
    ).toBe(true);
  });
});
