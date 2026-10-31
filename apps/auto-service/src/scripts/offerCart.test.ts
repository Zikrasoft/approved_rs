// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { capNotice, defineOfferCart, stepTarget } from './offerCart';

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
});
