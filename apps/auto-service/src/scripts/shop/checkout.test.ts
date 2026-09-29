import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StoreError } from './store';

const api = vi.hoisted(() => ({
  saveContact: vi.fn(),
  choosePickup: vi.fn(),
  preparePayment: vi.fn(),
  completeCart: vi.fn(),
}));
const cart = vi.hoisted(() => ({
  currentCart: vi.fn(),
  applyCart: vi.fn(),
  clearCart: vi.fn(),
}));
vi.mock('./checkoutApi', () => api);
vi.mock('./cart', () => cart);

const { AmountChangedError, NoCartError, checkoutFailure, placeOrder } =
  await import('./checkout');

const CONTACT = {
  name: 'Marko',
  email: 'kupac@example.com',
  phone: '+381601234567',
  channel: 'phone' as const,
  comment: '',
  website: '',
};

beforeEach(() => {
  vi.clearAllMocks();
  cart.currentCart.mockReturnValue({ id: 'c1', total: 12690, items: [] });
  api.saveContact.mockResolvedValue({ id: 'c1' });
  api.choosePickup.mockResolvedValue({ id: 'c1' });
  api.preparePayment.mockResolvedValue(12690);
  api.completeCart.mockResolvedValue({ id: 'o1', display_id: 7, total: 12690 });
});

describe('placeOrder', () => {
  it('saves the contact, picks pickup, pays at the service and empties the cart', async () => {
    expect(await placeOrder(CONTACT, 12690)).toEqual({
      id: 'o1',
      display_id: 7,
      total: 12690,
    });
    expect(api.saveContact).toHaveBeenCalledWith('c1', CONTACT);
    expect(api.choosePickup).toHaveBeenCalledWith('c1');
    expect(cart.clearCart).toHaveBeenCalledTimes(1);
  });

  it('stops before ordering when the total moved since the shopper looked', async () => {
    api.preparePayment.mockResolvedValue(13000);

    await expect(placeOrder(CONTACT, 12690)).rejects.toBeInstanceOf(
      AmountChangedError,
    );
    expect(api.completeCart).not.toHaveBeenCalled();
    expect(cart.clearCart).not.toHaveBeenCalled();
  });

  it('keeps the cart when completing fails', async () => {
    api.completeCart.mockRejectedValue(new Error('boom'));

    await expect(placeOrder(CONTACT, 12690)).rejects.toThrow('boom');
    expect(cart.clearCart).not.toHaveBeenCalled();
  });

  it('refuses without a cart', async () => {
    cart.currentCart.mockReturnValue(null);

    await expect(placeOrder(CONTACT, 0)).rejects.toBeInstanceOf(NoCartError);
  });
});

describe('checkoutFailure', () => {
  it.each([
    [new StoreError(400, 'insufficient_inventory', 'x'), 'stock'],
    [new StoreError(429, null, 'x'), 'tooMany'],
    [new StoreError(400, null, 'Не заполнено'), 'invalid'],
    [new TypeError('Failed to fetch'), 'network'],
    [new AmountChangedError('x'), 'changed'],
    [new StoreError(500, null, 'x'), 'generic'],
    [new Error('x'), 'generic'],
  ])('maps %s to %s', (error, key) => {
    expect(checkoutFailure(error)).toBe(key);
  });
});
