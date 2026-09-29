// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const cart = vi.hoisted(() => ({ addToCart: vi.fn(), loadCart: vi.fn() }));
const api = vi.hoisted(() => ({ isOutOfStock: vi.fn() }));
const goals = vi.hoisted(() => ({
  GOALS: { addToCart: 'add_to_cart' },
  reachGoal: vi.fn(),
}));

vi.mock('./cart', () => cart);
vi.mock('./cartApi', () => api);
vi.mock('@podbor/site-kit/browser', () => goals);

const { defineAddToCart } = await import('./addToCart');
const { STOCK_EVENT } = await import('./stock');

const mount = (extra = '') => {
  document.body.innerHTML = `
    <add-to-cart data-region="reg_1" data-variant="var_1" data-type="batteries"
      data-locale="sr" data-added-label="U korpi" data-error-label="Greška"
      data-sold-out-label="Nema" data-install-error-label="Instalacija nije uspela" ${extra}>
      <input type="checkbox" data-install-toggle>
      <button type="button" data-add><span data-label>Dodaj</span></button>
      <p data-message hidden></p>
      <a data-go-cart hidden href="/sr/cart/"></a>
    </add-to-cart>`;
  const q = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;
  return {
    button: q<HTMLButtonElement>('[data-add]'),
    label: q('[data-label]'),
    message: q('[data-message]'),
    goCart: q('[data-go-cart]'),
    install: q<HTMLInputElement>('[data-install-toggle]'),
  };
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

beforeAll(() => defineAddToCart());

beforeEach(() => {
  vi.clearAllMocks();
  cart.addToCart.mockResolvedValue({ id: 'cart_1', items: [] });
  cart.loadCart.mockResolvedValue(null);
  api.isOutOfStock.mockReturnValue(false);
});

describe('<add-to-cart>', () => {
  it('adds the product in the page language and counts the goal once', async () => {
    const { button, label, goCart } = mount();

    button.click();
    await settle();

    expect(cart.addToCart).toHaveBeenCalledWith({
      regionId: 'reg_1',
      locale: 'sr',
      preview: false,
      variantId: 'var_1',
    });
    expect(label.textContent).toBe('U korpi');
    expect(goCart.hidden).toBe(false);
    expect(goals.reachGoal).toHaveBeenCalledTimes(1);
    expect(goals.reachGoal).toHaveBeenCalledWith('add_to_cart', {
      type: 'batteries',
    });
  });

  it('marks the cart as preview on a preview build', async () => {
    const { button } = mount('data-preview');

    button.click();
    await settle();

    expect(cart.addToCart.mock.calls[0][0].preview).toBe(true);
  });

  it('adds the installation line when the shopper ticks it', async () => {
    const { button, install } = mount('data-install-variant="var_install"');
    install.checked = true;

    button.click();
    await settle();

    expect(cart.addToCart.mock.calls.map(([input]) => input.variantId)).toEqual(
      ['var_1', 'var_install'],
    );
  });

  it('adds the installation line again on every add while it stays checked', async () => {
    const { button, install } = mount('data-install-variant="var_install"');
    install.checked = true;

    button.click();
    await settle();
    button.click();
    await settle();

    const installCalls = cart.addToCart.mock.calls.filter(
      ([input]) => input.variantId === 'var_install',
    );
    expect(installCalls).toHaveLength(2);
  });

  it('ignores a second click while the first is on its way', async () => {
    const { button } = mount();

    button.click();
    button.click();
    await settle();

    expect(cart.addToCart).toHaveBeenCalledTimes(1);
  });

  it('loads the cart before adding, so a stale cart is never posted to', async () => {
    const load = deferred<null>();
    cart.loadCart.mockReturnValueOnce(load.promise);
    const { button } = mount();

    button.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(cart.addToCart).not.toHaveBeenCalled();

    load.resolve(null);
    await settle();
    expect(cart.loadCart).toHaveBeenCalledWith('sr');
    expect(cart.addToCart).toHaveBeenCalledTimes(1);
  });

  it('says it is sold out, disables the button, and refuses another click until stock changes', async () => {
    const { button, message } = mount();
    cart.addToCart.mockRejectedValueOnce(new Error('insufficient'));
    api.isOutOfStock.mockReturnValueOnce(true);

    button.click();
    await settle();

    expect([message.hidden, message.textContent, button.disabled]).toEqual([
      false,
      'Nema',
      true,
    ]);

    button.click();
    await settle();
    expect(cart.addToCart).toHaveBeenCalledTimes(1);
  });

  it('says something went wrong on a network error, counts no goal, and stays clickable', async () => {
    const { button, message } = mount();
    cart.addToCart.mockRejectedValueOnce(new Error('network'));

    button.click();
    await settle();

    expect(message.textContent).toBe('Greška');
    expect(goals.reachGoal).not.toHaveBeenCalled();
    expect(button.disabled).toBe(false);
  });

  it('reports only the installation failure when the product line succeeds, without adding the product twice', async () => {
    const { button, label, goCart, message, install } = mount(
      'data-install-variant="var_install"',
    );
    install.checked = true;
    cart.addToCart
      .mockResolvedValueOnce({ id: 'cart_1', items: [] })
      .mockRejectedValueOnce(new Error('insufficient'));

    button.click();
    await settle();

    expect(cart.addToCart).toHaveBeenCalledTimes(2);
    expect(label.textContent).toBe('U korpi');
    expect(goCart.hidden).toBe(false);
    expect(goals.reachGoal).toHaveBeenCalledTimes(1);
    expect([message.hidden, message.textContent]).toEqual([
      false,
      'Instalacija nije uspela',
    ]);
  });

  it('follows the live stock of its own variant only', () => {
    const { button } = mount();
    const stock = (variantId: string, quantity: number | null) =>
      window.dispatchEvent(
        new CustomEvent(STOCK_EVENT, { detail: { variantId, quantity } }),
      );

    stock('var_other', 0);
    expect(button.disabled).toBe(false);
    stock('var_1', 0);
    expect(button.disabled).toBe(true);
    stock('var_1', 3);
    expect(button.disabled).toBe(false);
  });

  it('does not re-enable the button when stock drops to zero mid-request', async () => {
    const add = deferred<{ id: string; items: never[] }>();
    cart.addToCart.mockReturnValueOnce(add.promise);
    const { button } = mount();

    button.click();
    await Promise.resolve();
    await Promise.resolve();
    window.dispatchEvent(
      new CustomEvent(STOCK_EVENT, {
        detail: { variantId: 'var_1', quantity: 0 },
      }),
    );
    add.resolve({ id: 'cart_1', items: [] });
    await settle();

    expect(button.disabled).toBe(true);
  });
});
