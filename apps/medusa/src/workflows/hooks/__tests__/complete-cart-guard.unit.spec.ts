import { MedusaError } from '@medusajs/framework/utils';

import { requireContact } from '../complete-cart-guard';

const CART = {
  email: 'kupac@example.com',
  shipping_address: {
    first_name: 'Marko',
    phone: '+381601234567',
    country_code: 'rs',
  },
  metadata: { website: '' },
};

const thrown = (cart: unknown): MedusaError => {
  try {
    requireContact(cart);
  } catch (error) {
    return error as MedusaError;
  }
  throw new Error('requireContact did not throw');
};

describe('requireContact', () => {
  it('lets a complete order through', () => {
    expect(() => requireContact(CART)).not.toThrow();
  });

  it('refuses a filled honeypot without saying why', () => {
    const error = thrown({ ...CART, metadata: { website: 'http://spam' } });

    expect(error).toBeInstanceOf(MedusaError);
    expect(error.type).toBe(MedusaError.Types.NOT_ALLOWED);
    expect(error.message).toBe('Заказ не принят');
  });

  it('names what is missing, in Russian', () => {
    const error = thrown({
      ...CART,
      email: null,
      shipping_address: { ...CART.shipping_address, phone: '0601234567' },
    });

    expect(error.type).toBe(MedusaError.Types.INVALID_DATA);
    expect(error.message).toBe(
      'Не заполнено или заполнено неверно: email, телефон в международном формате',
    );
  });
});
