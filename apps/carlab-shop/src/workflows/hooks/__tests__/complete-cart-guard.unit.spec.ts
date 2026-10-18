import { findMissingOrRepricedItems } from '../complete-cart-guard';

describe('findMissingOrRepricedItems', () => {
  it('returns no items when no offer-based item is in the cart', () => {
    const items = [{ id: 'item_1', unit_price: 1000, metadata: {} }];

    expect(findMissingOrRepricedItems(items, new Map())).toEqual([]);
  });

  it('returns no items when the recorded price still matches the offer', () => {
    const items = [
      { id: 'item_1', unit_price: 1850, metadata: { offer_id: 'offer_1' } },
    ];
    const currentPrices = new Map([['offer_1', 1850]]);

    expect(findMissingOrRepricedItems(items, currentPrices)).toEqual([]);
  });

  it('flags an item whose offer price changed since it was added', () => {
    const items = [
      { id: 'item_1', unit_price: 1850, metadata: { offer_id: 'offer_1' } },
    ];
    const currentPrices = new Map([['offer_1', 2200]]);

    expect(findMissingOrRepricedItems(items, currentPrices)).toEqual(items);
  });

  it('flags an item whose offer no longer exists', () => {
    const items = [
      { id: 'item_1', unit_price: 1850, metadata: { offer_id: 'offer_1' } },
    ];

    expect(findMissingOrRepricedItems(items, new Map())).toEqual(items);
  });

  it('only flags the items that actually drifted in a mixed cart', () => {
    const fresh = {
      id: 'item_1',
      unit_price: 1200,
      metadata: { offer_id: 'offer_1' },
    };
    const stale = {
      id: 'item_2',
      unit_price: 1150,
      metadata: { offer_id: 'offer_2' },
    };
    const currentPrices = new Map([
      ['offer_1', 1200],
      ['offer_2', 1300],
    ]);

    expect(findMissingOrRepricedItems([fresh, stale], currentPrices)).toEqual([
      stale,
    ]);
  });
});
