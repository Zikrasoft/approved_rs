import { sellPrice } from '../store-response';

describe('sellPrice', () => {
  it('applies the markup percentage and rounds to the nearest unit', () => {
    expect(sellPrice(1542, 20)).toBe(1850);
  });

  it('returns the cost price unchanged at a zero markup', () => {
    expect(sellPrice(1000, 0)).toBe(1000);
  });
});
