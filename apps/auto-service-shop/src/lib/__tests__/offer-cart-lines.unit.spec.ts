import type { CartItem, CartPlan } from '../cart-plan';
import {
  type CartDeps,
  createCartLines,
  type LiveOfferRow,
} from '../offer-cart';

const OFFER: LiveOfferRow = {
  id: 'offer_1',
  part_identifier_id: 'pi_1',
  cost_price: 1000,
  stock_quantity: 3,
  lead_time_days: 0,
  supplier: { key: 'demo-intercars', markup_percentage: 10 },
};

const emptyPlan = (items: CartItem[]): CartPlan => ({
  lines: items.map((item) => ({ id: item.id }) as never),
  fixes: { remove: [], update: [] },
  stamps: [],
  refusal: null,
});

function memoryCart(items: CartItem[] = []) {
  const cart = {
    id: 'cart_1',
    currency_code: 'rsd',
    completed_at: null as string | null,
    metadata: {},
    items,
  };
  const calls = {
    added: [] as unknown[],
    updated: [] as unknown[],
    deleted: [] as string[][],
    payments: 0,
  };
  const deps: CartDeps = {
    lock: (_key, job) => job(),
    cart: async () => ({ ...cart, items: [...cart.items] }),
    plan: async (planned) => emptyPlan(planned),
    stamp: async () => {},
    carFor: async () => null,
    saveMetadata: async () => {},
    complete: async () => ({ id: 'order_1', display_id: 1 }),
    createCart: async () => cart.id,
    liveOffer: async (id) => (id === OFFER.id ? OFFER : undefined),
    services: async () =>
      new Map([['offer_1', { service: null, installation: 1500 }]]),
    partOf: async () => ({
      identifierId: 'pi_1',
      slug: 'mann-hu816x',
      brand: 'MANN',
      number: 'HU 816 x',
      name: 'Oil filter',
    }),
    addLines: async (_id, lines) => {
      calls.added.push(...lines);
      cart.items.push(
        ...lines.map((line, at) => ({ id: `new_${at}`, ...line })),
      );
    },
    updateLine: async (_id, itemId, update) => {
      calls.updated.push({ itemId, ...update });
      cart.items = cart.items.map((item) =>
        item.id === itemId ? { ...item, ...update } : item,
      );
    },
    deleteLines: async (_id, ids) => {
      calls.deleted.push(ids);
    },
    openPayment: async () => {
      calls.payments += 1;
    },
  };
  return { lines: createCartLines(deps), cart, calls };
}

const refusalOf = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: { code?: string; type?: string }) => error.code ?? error.type,
  );

const offerLine = {
  id: 'item_1',
  quantity: 1,
  unit_price: 1100,
  metadata: { offer_id: 'offer_1', part_identifier_id: 'pi_1' },
};

describe('the offer cart lines', () => {
  it('adds a new offer as a priced line naming its part', async () => {
    const { lines, calls } = memoryCart();

    await lines.addOffer('cart_1', 'offer_1', 2);

    expect(calls.added).toEqual([
      expect.objectContaining({ quantity: 2, unit_price: 1100 }),
    ]);
    expect(calls.payments).toBe(1);
  });

  it('adds to the line already holding the offer, and refuses more than the stock', async () => {
    const { lines, calls } = memoryCart([offerLine]);

    await lines.addOffer('cart_1', 'offer_1', 2);
    const refused = await refusalOf(lines.addOffer('cart_1', 'offer_1', 3));

    expect(calls.updated).toEqual([
      { itemId: 'item_1', quantity: 3, unit_price: 1100 },
    ]);
    expect(refused).toBe('OFFER_OUT_OF_STOCK');
  });

  it('refuses an offer that cannot be sold before making a cart', async () => {
    const { lines, calls } = memoryCart();

    expect(
      await refusalOf(
        lines.createOfferCart({ offer_id: 'offer_gone', quantity: 1 }),
      ),
    ).toBe('OFFER_MISSING');
    expect(calls.added).toEqual([]);
  });

  it('adds the installation add-on once and removes it with its line', async () => {
    const addon = {
      id: 'item_2',
      quantity: 1,
      unit_price: 1500,
      metadata: {
        addon_kind: 'installation',
        addon_offer_id: 'offer_1',
        addon_for: 'item_1',
      },
    };
    const { lines, calls } = memoryCart([offerLine]);
    await lines.addLineAddon('cart_1', 'item_1', 'installation');
    const withAddon = memoryCart([offerLine, addon]);

    await withAddon.lines.addLineAddon('cart_1', 'item_1', 'installation');
    await withAddon.lines.removeOfferLine('cart_1', 'item_1');

    expect(calls.added).toEqual([
      expect.objectContaining({ quantity: 1, unit_price: 1500 }),
    ]);
    expect(withAddon.calls.added).toEqual([]);
    expect(withAddon.calls.deleted).toEqual([['item_1', 'item_2']]);
  });

  it('refuses an add-on the line has no price for, and a line the cart lacks', async () => {
    const { lines } = memoryCart([offerLine]);

    expect(
      await refusalOf(lines.addLineAddon('cart_1', 'item_1', 'service')),
    ).toBe('invalid_data');
    expect(await refusalOf(lines.setOfferQuantity('cart_1', 'item_9', 1))).toBe(
      'not_found',
    );
  });
});
