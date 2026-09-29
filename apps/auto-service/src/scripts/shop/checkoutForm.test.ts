// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const checkout = vi.hoisted(() => ({
  placeOrder: vi.fn(),
  checkoutFailure: vi.fn(),
}));
const cart = vi.hoisted(() => ({ currentCart: vi.fn(), refreshCart: vi.fn() }));
const goals = vi.hoisted(() => ({
  GOALS: { beginCheckout: 'begin_checkout', orderPlaced: 'order_placed' },
  reachGoal: vi.fn(),
  markFieldValidity: vi.fn(),
}));
vi.mock('./checkout', () => checkout);
vi.mock('./cart', () => cart);
vi.mock('@podbor/site-kit/browser', () => goals);
vi.mock('@podbor/lead-crm/phone-input', () => ({
  bindPhoneCountry: vi.fn(),
  fillCountrySelect: vi.fn(),
}));
vi.mock('@podbor/lead-crm/phone-kit', () => ({
  loadPhoneKit: vi.fn().mockResolvedValue(undefined),
  deferSubmitUntilKit: () => false,
  phoneValue: () => '+381601234567',
  phoneKit: () => ({
    parse: () => ({ number: '+381601234567' }),
    isValidContact: () => true,
    countryOptions: () => [],
  }),
}));

const { defineCheckoutForm } = await import('./checkoutForm');

const ERRORS = { stock: 'Nema', invalid: 'Proverite', generic: 'Greška' };

const mount = () => {
  document.body.innerHTML = `
    <div id="page"><checkout-form data-errors='${JSON.stringify(ERRORS)}' data-submitting="Šaljemo…">
      <form novalidate>
        <input name="name" value="Marko"><p data-error="name" hidden></p>
        <input name="email" type="email" value="kupac@example.com"><p data-error="email" hidden></p>
        <select data-country><option value="RS" data-dial="381" selected>RS</option></select>
        <input data-phone value="060 123 4567"><p data-error="phone" hidden></p>
        <input type="radio" name="contact_channel" value="phone">
        <input type="radio" name="contact_channel" value="viber" checked>
        <textarea name="comment">Posle 17h</textarea>
        <input name="website" value="">
        <input type="checkbox" data-consent checked><p data-error="consent" hidden></p>
        <p data-form-error hidden></p>
        <button type="submit"><span data-submit-label>Poruči</span></button>
      </form>
    </checkout-form></div>`;
  const form = document.querySelector('form')!;
  const field = <T extends HTMLElement>(s: string) => form.querySelector<T>(s)!;
  return { form, field, submit: () => form.requestSubmit() };
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeAll(() => defineCheckoutForm());

beforeEach(() => {
  vi.clearAllMocks();
  cart.currentCart.mockReturnValue({ id: 'cart_1', total: 12690, items: [] });
  cart.refreshCart.mockResolvedValue(null);
  checkout.placeOrder.mockResolvedValue({
    id: 'o1',
    display_id: 7,
    total: 12690,
  });
});

describe('<checkout-form>', () => {
  it('places the order with the contact, against the total on screen, and announces it', async () => {
    const { submit } = mount();
    const placed = vi.fn();
    document.getElementById('page')!.addEventListener('order-placed', placed);

    submit();
    await settle();

    expect(checkout.placeOrder).toHaveBeenCalledWith(
      {
        name: 'Marko',
        email: 'kupac@example.com',
        phone: '+381601234567',
        channel: 'viber',
        comment: 'Posle 17h',
        website: '',
      },
      12690,
    );
    expect(placed.mock.calls[0][0].detail).toEqual({
      displayId: 7,
      total: 12690,
    });
    expect(goals.reachGoal).toHaveBeenCalledWith('order_placed', {
      total: 12690,
    });
  });

  it('passes a filled honeypot through for Medusa to refuse', async () => {
    const { field, submit } = mount();
    field<HTMLInputElement>('[name="website"]').value = 'http://spam.example';

    submit();
    await settle();

    expect(checkout.placeOrder.mock.calls[0][0].website).toBe(
      'http://spam.example',
    );
  });

  it.each([
    ['name', '[name="name"]', ''],
    ['email', '[name="email"]', 'kupac'],
  ])('stops on a missing or wrong %s', async (key, selector, value) => {
    const { field, submit } = mount();
    field<HTMLInputElement>(selector).value = value;

    submit();
    await settle();

    expect(checkout.placeOrder).not.toHaveBeenCalled();
    expect(field(`[data-error="${key}"]`).hidden).toBe(false);
  });

  it('stops without consent', async () => {
    const { field, submit } = mount();
    field<HTMLInputElement>('[data-consent]').checked = false;

    submit();
    await settle();

    expect(checkout.placeOrder).not.toHaveBeenCalled();
    expect(field('[data-error="consent"]').hidden).toBe(false);
  });

  it('shows its own translated error, never the server text, and re-reads the cart on a stock refusal', async () => {
    checkout.placeOrder.mockRejectedValue(new Error('Не заполнено'));
    checkout.checkoutFailure.mockReturnValue('stock');
    const { field, submit } = mount();

    submit();
    await settle();

    expect(field('[data-form-error]').textContent).toBe('Nema');
    expect(cart.refreshCart).toHaveBeenCalled();
    expect(goals.reachGoal).not.toHaveBeenCalledWith(
      'order_placed',
      expect.anything(),
    );
  });

  it('counts the start of checkout once', () => {
    const { field } = mount();
    field('[name="name"]').dispatchEvent(
      new FocusEvent('focusin', { bubbles: true }),
    );
    field('[name="email"]').dispatchEvent(
      new FocusEvent('focusin', { bubbles: true }),
    );

    expect(
      goals.reachGoal.mock.calls.filter(([goal]) => goal === 'begin_checkout'),
    ).toHaveLength(1);
  });
});
