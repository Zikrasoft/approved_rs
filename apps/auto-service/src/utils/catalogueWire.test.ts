import { describe, expect, it } from 'vitest';
import { cartOutcomeSchema, offersOutcomeSchema } from './catalogueWire';

describe('the browser wire of /api/cart and /api/part-offers', () => {
  it('reads only the refusal codes checkout knows', () => {
    const refused = { kind: 'refused', code: 'OFFER_MISSING', cartId: null };

    expect(cartOutcomeSchema.safeParse(refused).success).toBe(true);
    expect(
      cartOutcomeSchema.safeParse({ ...refused, code: 'SOMETHING_NEW' })
        .success,
    ).toBe(false);
  });

  it('reads an offer by the same shape the shop sends it in', () => {
    const offer = {
      id: 'offer_1',
      price: 1850,
      currency: 'RSD',
      stock_quantity: 2,
      lead_time_days: 0,
    };

    expect(
      offersOutcomeSchema.parse({
        kind: 'offers',
        offers: [{ ...offer, supplier: 'hidden' }],
      }),
    ).toEqual({ kind: 'offers', offers: [offer] });
    expect(
      offersOutcomeSchema.safeParse({
        kind: 'offers',
        offers: [{ ...offer, stock_quantity: -1 }],
      }).success,
    ).toBe(false);
  });
});
