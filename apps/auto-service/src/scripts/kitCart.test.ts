// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineKitCart } from './kitCart';
import { PRICES_FILLED_EVENT } from './shopPreview';

const { addToCart, addToPartsList } = vi.hoisted(() => ({
  addToCart: vi.fn(),
  addToPartsList: vi.fn(),
}));
vi.mock('./cartUi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./cartUi')>()),
  addToCart,
}));
vi.mock('./partsList', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./partsList')>()),
  addToPartsList,
}));

defineKitCart();

const part = (
  slug: string,
  offer: { id: string; price: number; currency?: string } | null,
  quantity = 1,
) => `
  <li data-kit-part="part_${slug}" data-slug="${slug}" data-brand="Mann" data-number="${slug}" data-name="Filter" data-quantity="${quantity}" ${offer ? `data-offer-id="${offer.id}"` : ''}>
    <span ${offer ? `data-kit-offer="${offer.id}" data-kit-price="${offer.price}" ${offer.currency ? `data-kit-currency="${offer.currency}"` : ''}` : ''}></span>
  </li>`;

const render = (items: string, kitAttrs = 'data-locale-tag="en-US"') => {
  document.body.innerHTML = `
    <parts-list-add-all data-car="BMW X3">
      <ul>${items}</ul>
      <kit-cart data-cart-href="/ru/parts/cart/" ${kitAttrs}>
        <button type="button"><span data-kit-total></span></button>
      </kit-cart>
      <div data-kit-added hidden></div>
    </parts-list-add-all>`;
  return {
    kit: document.querySelector<HTMLElement>('kit-cart')!,
    total: document.querySelector<HTMLElement>('[data-kit-total]')!,
    added: document.querySelector<HTMLElement>('[data-kit-added]')!,
    button: document.querySelector('button')!,
  };
};

const pricesFilled = () =>
  document.dispatchEvent(new Event(PRICES_FILLED_EVENT));

const assign = vi.fn();

beforeEach(() => {
  vi.stubGlobal('location', { search: '', assign });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('<kit-cart> once prices arrive', () => {
  it('offers the kit with its total in the offers currency', () => {
    const { kit, total } = render(
      part('a', { id: 'o1', price: 1000, currency: 'EUR' }, 2) +
        part('b', { id: 'o2', price: 500, currency: 'EUR' }),
    );
    pricesFilled();
    expect(kit.hidden).toBe(false);
    expect(kit.hasAttribute('data-buyable')).toBe(true);
    expect(total.textContent).toBe(' · 2,500 EUR');
  });

  it('withdraws the kit when one part has no offer', () => {
    const { kit, total } = render(
      part('a', { id: 'o1', price: 1000, currency: 'RSD' }) + part('b', null),
    );
    pricesFilled();
    expect(kit.hidden).toBe(true);
    expect(kit.hasAttribute('data-buyable')).toBe(false);
    expect(total.textContent).toBe('');
    expect(
      document.querySelector<HTMLElement>('[data-slug="b"]')!.dataset.offerId,
    ).toBeUndefined();
  });

  it.each([
    [
      'the offer names no currency',
      part('a', { id: 'o1', price: 10 }),
      undefined,
    ],
    [
      'the kit names no locale',
      part('a', { id: 'o1', price: 10, currency: 'RSD' }),
      '',
    ],
  ])('leaves the total alone when %s', (_, items, kitAttrs) => {
    const { total } = render(items, kitAttrs);
    pricesFilled();
    expect(total.textContent).toBe('');
  });
});

describe('<kit-cart> on a tap', () => {
  const tap = async (button: HTMLButtonElement) => {
    button.click();
    await vi.waitFor(() => expect(button.hasAttribute('aria-busy')).toBe(true));
    await new Promise((resolve) => setTimeout(resolve));
  };

  it('adds every part and shows the added note', async () => {
    addToCart.mockResolvedValue({ kind: 'cart' });
    const { kit, added, button } = render(
      part('a', { id: 'o1', price: 1, currency: 'RSD' }, 3) +
        part('b', { id: 'o2', price: 1, currency: 'RSD' }),
    );
    await tap(button);
    expect(addToCart.mock.calls).toEqual([
      [{ offer_id: 'o1', quantity: 3 }],
      [{ offer_id: 'o2', quantity: 1 }],
    ]);
    expect([kit.hidden, added.hidden]).toEqual([true, false]);
    expect(assign).not.toHaveBeenCalled();
  });

  it('moves a refused part to the parts list and opens the cart with a notice', async () => {
    addToCart
      .mockResolvedValueOnce({ kind: 'cart' })
      .mockResolvedValueOnce({ kind: 'refused' });
    const { button } = render(
      part('a', { id: 'o1', price: 1, currency: 'RSD' }) +
        part('b', { id: 'o2', price: 1, currency: 'RSD' }),
    );
    await tap(button);
    expect(addToPartsList).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'b', car: 'BMW X3' }),
    );
    expect(assign).toHaveBeenCalledWith('/ru/parts/cart/?notice=moved');
  });

  it('opens the cart when the page has no added note', async () => {
    addToCart.mockResolvedValue({ kind: 'cart' });
    const { button } = render(
      part('a', { id: 'o1', price: 1, currency: 'RSD' }),
    );
    document.querySelector('[data-kit-added]')!.remove();
    await tap(button);
    expect(assign).toHaveBeenCalledWith('/ru/parts/cart/');
  });

  it('ignores a second tap while the first is running', async () => {
    addToCart.mockReturnValue(new Promise(() => {}));
    const { button } = render(
      part('a', { id: 'o1', price: 1, currency: 'RSD' }),
    );
    button.click();
    button.click();
    await new Promise((resolve) => setTimeout(resolve));
    expect(addToCart).toHaveBeenCalledTimes(1);
  });
});
