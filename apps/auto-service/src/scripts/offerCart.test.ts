import { describe, it, expect, vi } from 'vitest';
import {
  readCartId,
  writeCartId,
  isOfferPriceChangedError,
  CART_ID_STORAGE_KEY,
} from './offerCart';

describe('readCartId', () => {
  it('returns the stored cart id', () => {
    const storage = { getItem: vi.fn().mockReturnValue('cart_123') };
    expect(readCartId(storage)).toBe('cart_123');
    expect(storage.getItem).toHaveBeenCalledWith(CART_ID_STORAGE_KEY);
  });

  it('returns null when storage throws', () => {
    const storage = {
      getItem: vi.fn().mockImplementation(() => {
        throw new Error('blocked');
      }),
    };
    expect(readCartId(storage)).toBeNull();
  });
});

describe('writeCartId', () => {
  it('stores the cart id', () => {
    const storage = { setItem: vi.fn() };
    writeCartId('cart_123', storage);
    expect(storage.setItem).toHaveBeenCalledWith(
      CART_ID_STORAGE_KEY,
      'cart_123',
    );
  });

  it('swallows a storage error', () => {
    const storage = {
      setItem: vi.fn().mockImplementation(() => {
        throw new Error('blocked');
      }),
    };
    expect(() => writeCartId('cart_123', storage)).not.toThrow();
  });
});

describe('isOfferPriceChangedError', () => {
  it('recognizes the structured stale-price error', () => {
    const error = {
      response: { status: 400, data: { code: 'OFFER_PRICE_CHANGED' } },
    };
    expect(isOfferPriceChangedError(error)).toBe(true);
  });

  it('rejects an unrelated error shape', () => {
    expect(
      isOfferPriceChangedError({ response: { data: { code: 'OTHER' } } }),
    ).toBe(false);
  });

  it('rejects a non-object value', () => {
    expect(isOfferPriceChangedError('nope')).toBe(false);
    expect(isOfferPriceChangedError(null)).toBe(false);
  });

  it('rejects an object without a response', () => {
    expect(isOfferPriceChangedError({})).toBe(false);
  });
});
