// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
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
