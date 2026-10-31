import {
  StoreAddOfferCartItem,
  StoreListOffers,
  StoreSearchParts,
  StoreSetOfferCartItem,
} from '../store/validators';

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

describe('store cart and id limits', () => {
  it('refuses a cart quantity past 999', () => {
    expect(StoreSetOfferCartItem.safeParse({ quantity: 999 }).success).toBe(
      true,
    );
    expect(StoreSetOfferCartItem.safeParse({ quantity: 1000 }).success).toBe(
      false,
    );
    expect(
      StoreAddOfferCartItem.safeParse({ offer_id: 'offer_1', quantity: 1000 })
        .success,
    ).toBe(false);
  });

  it.each(['offer\u0000', 'a/b', 'x'.repeat(65), ''])(
    'refuses %j as a record id',
    (id) => {
      expect(StoreAddOfferCartItem.safeParse({ offer_id: id }).success).toBe(
        false,
      );
      expect(
        StoreListOffers.safeParse({ part_identifier_id: id }).success,
      ).toBe(false);
    },
  );
});
