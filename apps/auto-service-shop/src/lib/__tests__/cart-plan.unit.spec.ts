import type { AddonKind } from '@podbor/catalog-contract';

import {
  checkoutRefusal,
  planCart,
  type AddonPrices,
  type CartItem,
  type CartPlan,
  type Quote,
} from '../cart-plan';
import { addonLineMetadata } from '../line-metadata';

const INSTALLATION = 'installation';

const judgeCheckout = (...args: Parameters<typeof planCart>) => {
  const refusal = checkoutRefusal(planCart(...args));
  return refusal
    ? { refusal }
    : {
        lines: args[0].map(({ id, quantity, unit_price }) => ({
          id,
          quantity,
          unit_price,
        })),
      };
};

const part = (
  id: string,
  offerId: string,
  quantity = 1,
  unit_price = 1850,
) => ({
  id,
  quantity,
  unit_price,
  metadata: { offer_id: offerId, part_identifier_id: `pi_${offerId}` },
});

const addon = (
  id: string,
  offerId: string,
  kind: AddonKind,
  quantity = 1,
  unit_price = 500,
) => ({
  id,
  quantity,
  unit_price,
  metadata: addonLineMetadata({ lineId: `line_${offerId}`, offerId }, kind),
});

const quote = (overrides: Partial<Quote> = {}): Quote => ({
  unit_price: 1850,
  stock_quantity: 5,
  lead_time_days: 0,
  ...overrides,
});

const quotes = (entries: Record<string, Quote>) =>
  new Map(Object.entries(entries));

const addons = (entries: Record<string, AddonPrices> = {}) =>
  new Map(Object.entries(entries));

const SERVICE_AND_INSTALLATION: AddonPrices = {
  service: { label: 'Регистрация', translations: null, unit_price: 500 },
  installation: 1200,
};

describe('checkoutRefusal over planCart', () => {
  it('passes a cart at live prices and returns its lines priced live', () => {
    expect(
      judgeCheckout(
        [part('l1', 'o1', 2), addon('a1', 'o1', 'service', 2)],
        quotes({ o1: quote() }),
        addons({ o1: SERVICE_AND_INSTALLATION }),
      ),
    ).toEqual({
      lines: [
        { id: 'l1', quantity: 2, unit_price: 1850 },
        { id: 'a1', quantity: 2, unit_price: 500 },
      ],
    });
  });

  it('passes an empty cart', () => {
    expect(judgeCheckout([], quotes({}), addons())).toEqual({ lines: [] });
  });

  it('refuses a line without an Offer', () => {
    expect(
      judgeCheckout(
        [{ id: 'l1', quantity: 1, unit_price: 100, metadata: null }],
        quotes({}),
        addons(),
      ),
    ).toEqual({ refusal: 'OFFER_MISSING' });
  });

  it('refuses a line whose Offer is no longer quoted', () => {
    expect(judgeCheckout([part('l1', 'o1')], quotes({}), addons())).toEqual({
      refusal: 'OFFER_MISSING',
    });
  });

  it('refuses an Offer that sells for nothing, even at the price the visitor saw', () => {
    expect(
      judgeCheckout(
        [part('l1', 'o1', 1, 0)],
        quotes({ o1: quote({ unit_price: 0 }) }),
        addons(),
      ),
    ).toEqual({ refusal: 'OFFER_MISSING' });
  });

  it('refuses more than the supplier has in stock', () => {
    expect(
      judgeCheckout(
        [part('l1', 'o1', 3)],
        quotes({ o1: quote({ stock_quantity: 2 }) }),
        addons(),
      ),
    ).toEqual({ refusal: 'OFFER_OUT_OF_STOCK' });
  });

  it('sells beyond stock what the supplier can bring in, up to the order cap', () => {
    const leadTime = quotes({
      o1: quote({ stock_quantity: 1, lead_time_days: 3 }),
    });

    expect(judgeCheckout([part('l1', 'o1', 10)], leadTime, addons())).toEqual({
      lines: [{ id: 'l1', quantity: 10, unit_price: 1850 }],
    });
    expect(judgeCheckout([part('l1', 'o1', 11)], leadTime, addons())).toEqual({
      refusal: 'OFFER_OUT_OF_STOCK',
    });
  });

  it('sells all the stock when it exceeds the order cap', () => {
    expect(
      judgeCheckout(
        [part('l1', 'o1', 15)],
        quotes({ o1: quote({ stock_quantity: 15, lead_time_days: 3 }) }),
        addons(),
      ),
    ).toEqual({ lines: [{ id: 'l1', quantity: 15, unit_price: 1850 }] });
  });

  it('refuses an Offer with neither stock nor a lead time', () => {
    expect(
      judgeCheckout(
        [part('l1', 'o1')],
        quotes({ o1: quote({ stock_quantity: 0 }) }),
        addons(),
      ),
    ).toEqual({ refusal: 'OFFER_OUT_OF_STOCK' });
  });

  it('refuses a line priced before the supplier changed the price', () => {
    expect(
      judgeCheckout(
        [part('l1', 'o1')],
        quotes({ o1: quote({ unit_price: 1900 }) }),
        addons(),
      ),
    ).toEqual({ refusal: 'OFFER_PRICE_CHANGED' });
  });

  it('reports the first refusing line when several refuse', () => {
    expect(
      judgeCheckout(
        [part('l1', 'o1', 9), part('l2', 'o2')],
        quotes({ o1: quote({ stock_quantity: 1 }) }),
        addons(),
      ),
    ).toEqual({ refusal: 'OFFER_OUT_OF_STOCK' });
    expect(
      judgeCheckout(
        [part('l1', 'o1'), part('l2', 'o2', 9)],
        quotes({ o1: quote({ unit_price: 1 }), o2: quote() }),
        addons(),
      ),
    ).toEqual({ refusal: 'OFFER_PRICE_CHANGED' });
  });

  it('judges the Offers before their Add-ons', () => {
    expect(
      judgeCheckout(
        [part('l1', 'o1'), addon('a1', 'o1', 'service', 1, 1)],
        quotes({ o1: quote({ stock_quantity: 0 }) }),
        addons({ o1: SERVICE_AND_INSTALLATION }),
      ),
    ).toEqual({ refusal: 'OFFER_OUT_OF_STOCK' });
  });

  describe('Add-ons', () => {
    const judge = (lines: CartItem[], prices = SERVICE_AND_INSTALLATION) =>
      judgeCheckout(
        [part('l1', 'o1', 2), ...lines],
        quotes({ o1: quote() }),
        addons({ o1: prices }),
      );

    it('passes the service and installation of a line at the Category prices', () => {
      expect(
        judge([
          addon('a1', 'o1', 'service', 2),
          addon('a2', 'o1', INSTALLATION, 2, 1200),
        ]),
      ).toEqual({
        lines: [
          { id: 'l1', quantity: 2, unit_price: 1850 },
          { id: 'a1', quantity: 2, unit_price: 500 },
          { id: 'a2', quantity: 2, unit_price: 1200 },
        ],
      });
    });

    it('refuses an Add-on the Category no longer sells', () => {
      expect(
        judge([addon('a1', 'o1', 'service', 2)], {
          service: null,
          installation: 1200,
        }),
      ).toEqual({ refusal: 'OFFER_MISSING' });
      expect(
        judge([addon('a1', 'o1', INSTALLATION, 2, 1200)], {
          service: SERVICE_AND_INSTALLATION.service,
          installation: null,
        }),
      ).toEqual({ refusal: 'OFFER_MISSING' });
    });

    it('refuses an Add-on whose line is not in the cart', () => {
      expect(judge([addon('a1', 'o_gone', 'service', 2)])).toEqual({
        refusal: 'OFFER_MISSING',
      });
    });

    it('refuses an Add-on without a line to name', () => {
      expect(
        judge([
          {
            id: 'a1',
            quantity: 2,
            unit_price: 500,
            metadata: { addon_kind: 'service', addon_offer_id: null },
          },
        ]),
      ).toEqual({ refusal: 'OFFER_MISSING' });
    });

    it('refuses an Add-on priced before the Category changed it', () => {
      expect(judge([addon('a1', 'o1', 'service', 2, 400)])).toEqual({
        refusal: 'OFFER_PRICE_CHANGED',
      });
    });

    it('refuses an Add-on for a different quantity than its line', () => {
      expect(judge([addon('a1', 'o1', 'service', 1)])).toEqual({
        refusal: 'OFFER_PRICE_CHANGED',
      });
    });

    it('refuses the same Add-on twice on one line', () => {
      expect(
        judge([
          addon('a1', 'o1', 'service', 2),
          addon('a2', 'o1', 'service', 2),
        ]),
      ).toEqual({ refusal: 'OFFER_PRICE_CHANGED' });
    });
  });
});

const applied = (items: CartItem[], { fixes, stamps }: CartPlan) =>
  items
    .filter(({ id }) => !fixes.remove.includes(id))
    .map((item) => ({
      ...item,
      ...fixes.update.find(({ itemId }) => itemId === item.id)?.update,
      metadata:
        stamps.find(({ itemId }) => itemId === item.id)?.metadata ??
        item.metadata,
    }));

describe('planCart', () => {
  const prices = addons({ o1: SERVICE_AND_INSTALLATION });

  it('shows an offer line with its add-ons and refuses nothing', () => {
    const plan = planCart(
      [
        { ...part('l1', 'o1', 2), title: 'Oil filter' },
        addon('a1', 'o1', 'service', 2),
      ],
      quotes({ o1: quote({ stock_quantity: 2, lead_time_days: 0 }) }),
      prices,
    );

    expect(plan.refusal).toBeNull();
    expect(plan.fixes).toEqual({ remove: [], update: [] });
    expect(plan.lines).toEqual([
      {
        id: 'l1',
        offer_id: 'o1',
        quantity: 2,
        unit_price: 1850,
        available: true,
        max_quantity: 2,
        in_stock: true,
        lead_time_days: 0,
        addon: { item_id: 'a1', ...SERVICE_AND_INSTALLATION.service },
        installation: { item_id: null, unit_price: 1200 },
        part: { slug: '', brand: '', number: '', name: 'Oil filter' },
      },
    ]);
  });

  it('shows a line whose Offer is gone at its stored price, unavailable', () => {
    const plan = planCart([part('l1', 'o1', 1, 900)], quotes({}), addons());

    expect(plan.lines[0]).toMatchObject({
      unit_price: 900,
      available: false,
      max_quantity: 0,
      in_stock: false,
      lead_time_days: 0,
      addon: null,
      installation: null,
    });
    expect(plan.fixes).toEqual({ remove: [], update: [] });
    expect(plan.stamps).toEqual([]);
    expect(plan.refusal).toBe('OFFER_MISSING');
  });

  it('reprices a line, follows its add-ons and keeps the last duplicate', () => {
    const plan = planCart(
      [
        part('l1', 'o1', 3, 1800),
        addon('a1', 'o1', 'service', 3),
        addon('a2', 'o1', 'service', 1, 400),
        addon('a3', 'o_gone', 'service', 3),
      ],
      quotes({ o1: quote() }),
      prices,
    );

    expect(plan.fixes).toEqual({
      remove: ['a1', 'a3'],
      update: [
        { itemId: 'l1', update: { unit_price: 1850 } },
        { itemId: 'a2', update: { unit_price: 500, quantity: 3 } },
      ],
    });
    expect(plan.lines[0]?.addon?.item_id).toBe('a2');
    expect(plan.refusal).toBe('OFFER_PRICE_CHANGED');
  });

  it('stamps how soon a line is ready when the Offer moved', () => {
    const plan = planCart(
      [part('l1', 'o1')],
      quotes({ o1: quote({ stock_quantity: 0, lead_time_days: 4 }) }),
      addons(),
    );

    expect(plan.stamps).toEqual([
      {
        itemId: 'l1',
        metadata: expect.objectContaining({
          offer_id: 'o1',
          in_stock: false,
          lead_time_days: 4,
        }),
      },
    ]);
    expect(checkoutRefusal(plan)).toBeNull();
  });

  it('refuses checkout on a fix even without a refusal', () => {
    expect(
      checkoutRefusal({
        lines: [],
        fixes: { remove: ['a1'], update: [] },
        stamps: [],
        refusal: null,
      }),
    ).toBe('OFFER_PRICE_CHANGED');
  });

  it('passes checkout for a cart that reads clean once its fixes are applied', () => {
    const items = [
      part('l1', 'o1', 2, 1700),
      addon('a1', 'o1', 'service', 1, 300),
      addon('a2', 'o1', 'service', 2),
      addon('a3', 'o1', INSTALLATION, 5, 1),
      addon('a4', 'o_gone', INSTALLATION, 2, 1200),
      part('l2', 'o2', 1, 990),
    ];
    const live = quotes({ o1: quote(), o2: quote({ unit_price: 1000 }) });
    const first = planCart(items, live, prices);
    const again = planCart(applied(items, first), live, prices);

    expect(checkoutRefusal(first)).not.toBeNull();
    expect(again.fixes).toEqual({ remove: [], update: [] });
    expect(again.stamps).toEqual([]);
    expect(again.lines.every(({ available }) => available)).toBe(true);
    expect(checkoutRefusal(again)).toBeNull();
  });
});
