import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  choosePickup,
  completeCart,
  preparePayment,
  saveContact,
} from './checkoutApi';

const fetchMock = vi.fn();
const calls = () =>
  fetchMock.mock.calls.map(([url, init]) => ({
    path: new URL(String(url)).pathname,
    method: init.method,
    body: init.body ? JSON.parse(init.body) : undefined,
  }));

beforeEach(() => {
  vi.stubEnv('PUBLIC_MEDUSA_BACKEND_URL', 'http://store.test');
  vi.stubEnv('PUBLIC_MEDUSA_PUBLISHABLE_KEY', 'pk_test');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('checkout API', () => {
  it('saves the contact the way the Medusa guard expects it', async () => {
    fetchMock.mockResolvedValue(Response.json({ cart: { id: 'c1' } }));

    await saveContact('c1', {
      name: '  Marko Marković ',
      email: ' kupac@example.com ',
      phone: '+381601234567',
      channel: 'viber',
      comment: ' Posle 17h ',
      website: '',
    });

    expect(calls()[0]).toEqual({
      path: '/store/carts/c1',
      method: 'POST',
      body: {
        email: 'kupac@example.com',
        shipping_address: {
          first_name: 'Marko Marković',
          phone: '+381601234567',
          country_code: 'rs',
        },
        metadata: {
          comment: 'Posle 17h',
          contact_channel: 'viber',
          website: '',
        },
      },
    });
  });

  it('attaches the pickup option and no other', async () => {
    fetchMock
      .mockResolvedValueOnce(
        Response.json({
          shipping_options: [
            { id: 'so_other', type: { code: 'courier' } },
            { id: 'so_pickup', type: { code: 'pickup' } },
          ],
        }),
      )
      .mockResolvedValueOnce(Response.json({ cart: { id: 'c1' } }));

    await choosePickup('c1');

    expect(calls()[1]).toEqual({
      path: '/store/carts/c1/shipping-methods',
      method: 'POST',
      body: { option_id: 'so_pickup' },
    });
  });

  it('refuses to go on when the store offers no pickup', async () => {
    fetchMock.mockResolvedValue(Response.json({ shipping_options: [] }));

    await expect(choosePickup('c1')).rejects.toThrow(/pickup/);
  });

  it('opens a system payment session and reports its amount', async () => {
    fetchMock
      .mockResolvedValueOnce(
        Response.json({ payment_collection: { id: 'pc1' } }),
      )
      .mockResolvedValueOnce(
        Response.json({
          payment_collection: {
            payment_sessions: [
              { provider_id: 'pp_system_default', amount: 12690 },
            ],
          },
        }),
      );

    expect(await preparePayment('c1')).toBe(12690);
    expect(calls().map((call) => [call.path, call.body])).toEqual([
      ['/store/payment-collections', { cart_id: 'c1' }],
      [
        '/store/payment-collections/pc1/payment-sessions',
        { provider_id: 'pp_system_default' },
      ],
    ]);
  });

  it('returns the order, or fails when Medusa hands the cart back', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        type: 'order',
        order: { id: 'o1', display_id: 7, total: 12690 },
      }),
    );
    expect(await completeCart('c1')).toEqual({
      id: 'o1',
      display_id: 7,
      total: 12690,
    });

    fetchMock.mockResolvedValueOnce(
      Response.json({
        type: 'cart',
        error: { message: 'payment not authorized' },
      }),
    );
    await expect(completeCart('c1')).rejects.toThrow('payment not authorized');
  });
});
