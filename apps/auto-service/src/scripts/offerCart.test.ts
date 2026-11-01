// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { CART_STORAGE_KEY, PENDING_CART_ADD_KEY } from './cartBadge';
import { readCart, rememberCart } from './cartStore';
import { capNotice, defineOfferCart, stepTarget } from './offerCart';
import { readPartsList } from './partsList';
import { formatPhone } from '@podbor/site-kit/format-phone';

describe('stepping a line quantity', () => {
  it('clamps a burst of taps past the cap to the cap and says so', () => {
    expect(stepTarget(1, 4, 3)).toEqual({ quantity: 3, capped: true });
    expect(stepTarget(1, 12, 10)).toEqual({ quantity: 10, capped: true });
  });

  it('steps freely below the cap and never under one', () => {
    expect(stepTarget(1, 1, 3)).toEqual({ quantity: 2, capped: false });
    expect(stepTarget(1, -1, 3)).toEqual({ quantity: 1, capped: false });
  });

  it('leaves the cap to the shop when it does not send one', () => {
    expect(stepTarget(1, 12, null)).toEqual({ quantity: 13, capped: false });
  });
});

describe('the notice at a line cap', () => {
  it('says the stock is all in the cart for a part in stock now', () => {
    expect(capNotice({ lead_time_days: 0 })).toBe('stock-limit');
  });

  it('says the order limit for a part ordered on a lead time', () => {
    expect(capNotice({ lead_time_days: 4 })).toBe('order-limit');
  });
});

describe('a cart the shop has swept', () => {
  it('moves its parts into the inquiry instead of dropping them', async () => {
    history.replaceState(null, '', '/ru/parts/cart/');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ kind: 'empty' })),
    );
    rememberCart({
      id: 'cart_old',
      completed: false,
      currency: 'RSD',
      total: 1430,
      items: [
        {
          id: 'item_1',
          offer_id: 'offer_1',
          quantity: 2,
          unit_price: 715,
          available: true,
          in_stock: true,
          lead_time_days: 0,
          max_quantity: null,
          addon: null,
          installation: null,
          part: {
            slug: 'knecht-ox371d',
            brand: 'Knecht',
            number: 'OX 371D',
            name: 'Масляный фильтр',
          },
        },
      ],
    });
    defineOfferCart();
    document.body.innerHTML = `
      <offer-cart>
        <div data-state="empty" hidden><p data-empty-notice="gone" hidden></p></div>
        <div data-state="loading"></div>
      </offer-cart>`;

    await vi.waitFor(() =>
      expect(
        document.querySelector<HTMLElement>('[data-empty-notice="gone"]')!
          .hidden,
      ).toBe(false),
    );
    expect(readCart()).toBeNull();
    expect(
      readPartsList().map(({ number, quantity }) => [number, quantity]),
    ).toEqual([['OX 371D', 2]]);
    vi.unstubAllGlobals();
  });
});

describe('the confirmation opened from a link alone', () => {
  it('says the order is taken without a number or date the tab cannot vouch for', () => {
    history.replaceState(null, '', '/ru/parts/cart/?notice=ordered&order=999');
    defineOfferCart();
    document.body.innerHTML = `
      <offer-cart data-order-template="Номер заказа: {number}">
        <div data-state="ordered" hidden>
          <p data-order-number hidden></p>
          <p data-order-date></p>
        </div>
      </offer-cart>`;

    const shown = (selector: string) =>
      !document.querySelector<HTMLElement>(selector)!.hidden;
    expect(shown('[data-state="ordered"]')).toBe(true);
    expect(shown('[data-order-number]')).toBe(false);
    expect(shown('[data-order-date]')).toBe(false);
  });

  it('names the tab after the order, not the cart', () => {
    history.replaceState(null, '', '/ru/parts/cart/?notice=ordered&order=7');
    document.title = 'Корзина | CarLab';
    defineOfferCart();
    document.body.innerHTML = `
      <offer-cart data-ordered-title="Заказ принят | CarLab">
        <div data-state="ordered" hidden></div>
      </offer-cart>`;

    expect(document.title).toBe('Заказ принят | CarLab');
  });

  it('names the heading and the last crumb after the order', () => {
    history.replaceState(null, '', '/ru/parts/cart/?notice=ordered&order=8');
    defineOfferCart();
    document.body.innerHTML = `
      <ol><li><a data-hero-crumb>Корзина</a></li></ol>
      <h1 data-hero-heading>Корзина</h1>
      <offer-cart data-ordered-heading="Заказ принят">
        <div data-state="ordered" hidden></div>
      </offer-cart>`;

    expect(document.querySelector('[data-hero-heading]')!.textContent).toBe(
      'Заказ принят',
    );
    expect(document.querySelector('[data-hero-crumb]')!.textContent).toBe(
      'Заказ принят',
    );
  });
});

describe('the contact on the confirmation', () => {
  it.each([
    ['whatsapp', 'WhatsApp: '],
    ['viber', 'Viber: '],
    ['phone', 'Call: '],
  ])(
    'groups a %s number the way the phone is shown',
    async (channel, label) => {
      sessionStorage.setItem(
        'carlab_checkout_form',
        JSON.stringify({
          values: { '[name="contact"]': '+381641213188' },
          channel,
        }),
      );
      history.replaceState(null, '', '/ru/parts/cart/?notice=ordered&order=14');
      defineOfferCart();
      document.body.innerHTML = `
      <offer-cart data-ordered-contact='${JSON.stringify({
        phone: 'Call: {contact}',
        whatsapp: 'WhatsApp: {contact}',
        viber: 'Viber: {contact}',
      })}'>
        <div data-state="ordered" hidden><p data-ordered-contact hidden></p></div>
      </offer-cart>`;

      await vi.waitFor(() =>
        expect(
          document.querySelector('p[data-ordered-contact]')!.textContent,
        ).toBe(`${label}${formatPhone('381641213188')}`),
      );
    },
  );
});

describe('a cart changed in another tab', () => {
  const emptyCart = {
    id: 'cart_shared',
    completed: false,
    currency: 'RSD',
    total: 0,
    items: [],
  };

  it.each([
    [
      'when the other tab writes the cart',
      () =>
        window.dispatchEvent(
          new StorageEvent('storage', { key: CART_STORAGE_KEY }),
        ),
    ],
    [
      'when the visitor comes back to this tab',
      () => document.dispatchEvent(new Event('visibilitychange')),
    ],
  ])('is fetched again %s', async (_when, change) => {
    history.replaceState(null, '', '/ru/parts/cart/');
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ kind: 'cart', cart: emptyCart }))
      .mockResolvedValueOnce(Response.json({ kind: 'empty' }));
    vi.stubGlobal('fetch', fetch);
    rememberCart(emptyCart);
    defineOfferCart();
    document.body.innerHTML = `
      <offer-cart data-locale-tag="ru-RU">
        <div data-state="cart" hidden><ul data-lines></ul></div>
        <div data-state="empty" hidden></div>
        <div data-state="loading"></div>
      </offer-cart>`;
    const shown = (state: string) =>
      !document.querySelector<HTMLElement>(`[data-state="${state}"]`)!.hidden;
    await vi.waitFor(() => expect(shown('cart')).toBe(true));

    change();

    await vi.waitFor(() => expect(shown('empty')).toBe(true));
    expect(fetch).toHaveBeenCalledTimes(2);
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });
});

const sharedCart = (id: string) => ({
  id,
  completed: false,
  currency: 'RSD',
  total: 0,
  items: [],
});

const mountCart = () => {
  defineOfferCart();
  document.body.innerHTML = `
    <offer-cart data-locale-tag="ru-RU">
      <div data-state="cart" hidden><ul data-lines></ul></div>
      <div data-state="empty" hidden><p data-empty-notice="" hidden></p></div>
      <div data-state="loading" hidden></div>
    </offer-cart>`;
  return (state: string) =>
    !document.querySelector<HTMLElement>(`[data-state="${state}"]`)!.hidden;
};

describe('a cart page opened while an add is still on its way', () => {
  it('replays the pending add and shows the cart it created', async () => {
    history.replaceState(null, '', '/ru/parts/cart/');
    localStorage.clear();
    localStorage.setItem(
      PENDING_CART_ADD_KEY,
      JSON.stringify({ offer_id: 'offer_1', quantity: 1 }),
    );
    const fetch = vi.fn(async (_url: string) =>
      Response.json({ kind: 'cart', cart: sharedCart('cart_created') }),
    );
    vi.stubGlobal('fetch', fetch);
    const shown = mountCart();

    expect(shown('loading')).toBe(true);
    await vi.waitFor(() => expect(shown('cart')).toBe(true));
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      '/api/cart',
      '/api/cart?id=cart_created',
    ]);
    expect(readCart()?.id).toBe('cart_created');
    expect(localStorage.getItem(PENDING_CART_ADD_KEY)).toBeNull();
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });
});

describe('a cart dropped in another tab', () => {
  it('shows the empty cart without asking the shop again', async () => {
    history.replaceState(null, '', '/ru/parts/cart/');
    localStorage.clear();
    const fetch = vi.fn(async () =>
      Response.json({ kind: 'cart', cart: sharedCart('cart_dropped') }),
    );
    vi.stubGlobal('fetch', fetch);
    rememberCart(sharedCart('cart_dropped'));
    const shown = mountCart();
    await vi.waitFor(() => expect(shown('cart')).toBe(true));

    localStorage.removeItem(CART_STORAGE_KEY);
    window.dispatchEvent(
      new StorageEvent('storage', { key: CART_STORAGE_KEY }),
    );

    expect(shown('empty')).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it('ignores a change before the cart has loaded, and changes to other keys', () => {
    history.replaceState(null, '', '/ru/parts/cart/');
    localStorage.clear();
    rememberCart(sharedCart('cart_slow'));
    const fetch = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal('fetch', fetch);
    mountCart();

    window.dispatchEvent(
      new StorageEvent('storage', { key: CART_STORAGE_KEY }),
    );
    window.dispatchEvent(new StorageEvent('storage', { key: 'other' }));
    document.dispatchEvent(new Event('visibilitychange'));

    expect(fetch).toHaveBeenCalledTimes(1);
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });
});
