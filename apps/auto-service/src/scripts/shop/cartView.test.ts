// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let push: (cart: unknown) => void = () => undefined;
const cart = vi.hoisted(() => ({
  onCart: vi.fn(),
  currentCart: vi.fn(),
  loadCart: vi.fn(),
  setQuantity: vi.fn(),
  removeFromCart: vi.fn(),
  refreshCart: vi.fn(),
}));
const api = vi.hoisted(() => ({ isOutOfStock: vi.fn() }));
vi.mock('./cart', () => cart);
vi.mock('./cartApi', () => api);

const { defineCartView } = await import('./cartView');

const CART = {
  id: 'cart_1',
  locale: 'sr-RS',
  total: 12690,
  items: [
    {
      id: 'l1',
      variant_id: 'v1',
      product_handle: 'bosch-s4-024',
      product_title: 'Bosch S4 024',
      variant_title: 'Default',
      quantity: 1,
      unit_price: 11190,
      total: 11190,
    },
    {
      id: 'l2',
      variant_id: 'v2',
      product_handle: 'battery-installation',
      product_title: 'Установка аккумулятора',
      variant_title: 'Default',
      quantity: 1,
      unit_price: 1500,
      total: 1500,
    },
  ],
};

const ERRORS = { stock: 'Nema dovoljno', generic: 'Greška' };

const mount = () => {
  document.body.innerHTML = `
    <cart-view data-locale="sr" data-bcp47="sr-Latn-RS"
      data-services='{"battery-installation":"Ugradnja akumulatora"}'
      data-errors='${JSON.stringify(ERRORS)}'>
      <ul data-lines></ul>
      <template data-line>
        <li><span data-line-title></span><span data-line-price></span>
        <input type="number" data-line-quantity><button type="button" data-line-remove></button></li>
      </template>
      <div data-empty hidden></div>
      <div data-summary hidden><span data-total></span></div>
      <p data-cart-error hidden></p>
      <div data-checkout hidden><form><button id="inner">x</button></form></div>
      <div data-placed hidden><h2 data-placed-heading data-template="Porudžbina br. {number} je primljena"></h2></div>
    </cart-view>`;
  return document.querySelector<HTMLElement>('cart-view')!;
};

const q = (selector: string) => document.querySelector<HTMLElement>(selector)!;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeAll(() => {
  cart.onCart.mockImplementation((listener) => (push = listener));
  defineCartView();
});

beforeEach(() => {
  vi.clearAllMocks();
  cart.onCart.mockImplementation((listener) => (push = listener));
  cart.currentCart.mockReturnValue(null);
  cart.loadCart.mockResolvedValue(null);
  cart.setQuantity.mockResolvedValue(undefined);
  cart.removeFromCart.mockResolvedValue(undefined);
  cart.refreshCart.mockResolvedValue(null);
  api.isOutOfStock.mockReturnValue(false);
});

describe('<cart-view>', () => {
  it('lists the lines by product title, names installation from the site copy and shows the server total', () => {
    mount();
    push(CART);

    const titles = [...document.querySelectorAll('[data-line-title]')].map(
      (n) => n.textContent,
    );
    expect(titles).toEqual(['Bosch S4 024', 'Ugradnja akumulatora']);
    expect(document.body.textContent).not.toContain('Default');
    expect(q('[data-total]').textContent).toContain('12.690');
    expect(q('[data-checkout]').hidden).toBe(false);
    expect(q('[data-empty]').hidden).toBe(true);
  });

  it('asks for the cart in the page language', () => {
    mount();
    expect(cart.loadCart).toHaveBeenCalledWith('sr');
  });

  it('shows the empty state and hides checkout for an empty cart', () => {
    mount();
    push(null);

    expect(q('[data-empty]').hidden).toBe(false);
    expect(q('[data-checkout]').hidden).toBe(true);
  });

  it('changes and removes lines through the cart', () => {
    mount();
    push(CART);
    const quantity = document.querySelector<HTMLInputElement>(
      '[data-line-quantity]',
    )!;
    quantity.value = '3';
    quantity.dispatchEvent(new Event('change'));
    document
      .querySelectorAll<HTMLButtonElement>('[data-line-remove]')[1]
      .click();

    expect(cart.setQuantity).toHaveBeenCalledWith('l1', 3);
    expect(cart.removeFromCart).toHaveBeenCalledWith('l2');
  });

  it('explains a refused quantity and re-reads the cart', async () => {
    cart.setQuantity.mockRejectedValue(new Error('insufficient'));
    api.isOutOfStock.mockReturnValue(true);
    mount();
    push(CART);
    const quantity = document.querySelector<HTMLInputElement>(
      '[data-line-quantity]',
    )!;
    quantity.value = '9';
    quantity.dispatchEvent(new Event('change'));
    await settle();

    expect(q('[data-cart-error]').textContent).toBe('Nema dovoljno');
    expect(cart.refreshCart).toHaveBeenCalled();
  });

  it('switches to the numbered confirmation once the order is placed, and stays there', () => {
    mount();
    push(CART);
    q('#inner').dispatchEvent(
      new CustomEvent('order-placed', {
        bubbles: true,
        detail: { displayId: 7, total: 12690 },
      }),
    );
    push(null);

    expect(q('[data-placed]').hidden).toBe(false);
    expect(q('[data-placed-heading]').textContent).toBe(
      'Porudžbina br. 7 je primljena',
    );
    expect(q('[data-checkout]').hidden).toBe(true);
    expect(q('[data-empty]').hidden).toBe(true);
  });
});
