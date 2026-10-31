import {
  cartFingerprint,
  checkoutContactSchema,
} from '@podbor/catalog-contract';

import type { CartItem, CartPlan } from '../cart-plan';
import { createCheckout } from '../offer-cart';

const contact = checkoutContactSchema.parse({ contact: '+381601234567' });

const ITEMS: CartItem[] = [
  { id: 'item_1', quantity: 2, unit_price: 1850, metadata: { offer_id: 'o' } },
];

const FINGERPRINT = cartFingerprint([
  { id: 'item_1', quantity: 2, unit_price: 1850 },
]);

const plan = (refusal: CartPlan['refusal'] = null): CartPlan => ({
  lines: [],
  fixes: { remove: [], update: [] },
  stamps: [{ itemId: 'item_1', metadata: { lead_time_days: 4 } }],
  refusal,
});

function memoryCheckout(planned: CartPlan = plan()) {
  const cart = {
    id: 'cart_1',
    completed_at: null as string | null,
    metadata: {} as Record<string, unknown>,
    items: ITEMS,
  };
  const calls = { plans: 0, stamps: [] as CartPlan['stamps'], completed: 0 };
  const shop = createCheckout({
    lock: (_key, job) => job(),
    cart: async () => ({ ...cart, items: [...cart.items] }),
    plan: async () => {
      calls.plans += 1;
      return planned;
    },
    stamp: async (stamps) => {
      calls.stamps.push(...stamps);
    },
    carFor: async () => 'BMW 3 (G20)',
    saveMetadata: async (_id, metadata) => {
      cart.metadata = metadata;
    },
    complete: async () => {
      await shop.refuseCheckout(cart);
      calls.completed += 1;
      cart.completed_at = '2026-11-01T00:00:00.000Z';
      return { id: 'order_1', display_id: 7 };
    },
  });
  return { shop, cart, calls };
}

const refusalOf = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: { type?: string; message: string; code?: string }) => error.code,
  );

describe('createCheckout', () => {
  it('plans the cart once, stamps it and completes with the contact and the car', async () => {
    const { shop, cart, calls } = memoryCheckout();

    expect(
      await shop.checkout('cart_1', { contact, fingerprint: FINGERPRINT }),
    ).toEqual({ id: 'order_1', display_id: 7 });
    expect(calls).toEqual({
      plans: 1,
      stamps: plan().stamps,
      completed: 1,
    });
    expect(cart.metadata).toMatchObject({
      contact: '+381601234567',
      car: 'BMW 3 (G20)',
      planned_fingerprint: FINGERPRINT,
    });
  });

  it('refuses a cart that changed since it was shown, before any supplier round', async () => {
    const { shop, calls } = memoryCheckout();

    expect(
      await refusalOf(
        shop.checkout('cart_1', { contact, fingerprint: 'stale' }),
      ),
    ).toBe('CART_CHANGED');
    expect(calls.plans).toBe(0);
  });

  it('refuses a plan with a moved price and stamps nothing', async () => {
    const { shop, calls } = memoryCheckout(plan('OFFER_PRICE_CHANGED'));

    expect(
      await refusalOf(
        shop.checkout('cart_1', { contact, fingerprint: FINGERPRINT }),
      ),
    ).toBe('OFFER_PRICE_CHANGED');
    expect(calls).toMatchObject({ stamps: [], completed: 0 });
  });

  it('re-plans in the guard a cart whose lines moved after the plan, and refuses one without a contact', async () => {
    const { shop, calls } = memoryCheckout();
    const changed = {
      id: 'cart_1',
      metadata: { contact: '+381601234567', planned_fingerprint: FINGERPRINT },
      items: [{ ...ITEMS[0]!, quantity: 3 }],
    };

    await shop.refuseCheckout(changed);
    expect(calls.plans).toBe(1);
    expect(
      await refusalOf(shop.refuseCheckout({ ...changed, metadata: {} })),
    ).toBe('CONTACT_MISSING');
  });
});
