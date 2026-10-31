import type { LeadOrder } from '../order-lead';
import { readPlacedOrder } from '../placed-order';

const order = (overrides: Partial<LeadOrder> = {}): LeadOrder => ({
  id: 'order_1',
  display_id: 12,
  currency_code: 'rsd',
  metadata: { contact: '+381601234567', vin: 'WBA35BG070N074158' },
  items: [
    {
      title: 'Установка в сервисе CarLab',
      unit_price: 1000,
      quantity: 2,
      metadata: { addon_offer_id: 'off_1', addon_kind: 'installation' },
    },
    {
      title: 'Аккумулятор (Varta 580 901 080)',
      unit_price: 10000,
      quantity: 2,
      metadata: {
        offer_id: 'off_1',
        slug: 'varta-580901080',
        brand: 'Varta',
        number: '580 901 080',
        name: 'Аккумулятор',
        in_stock: false,
        lead_time_days: 3,
        supplier: 'Intercars',
      },
    },
  ],
  ...overrides,
});

describe('readPlacedOrder', () => {
  it('reads the contact, each line under its Part and the total', () => {
    expect(readPlacedOrder(order())).toEqual({
      contact: expect.objectContaining({
        contact: '+381601234567',
        vin: 'WBA35BG070N074158',
      }),
      lines: [
        {
          title: 'Аккумулятор (Varta 580 901 080)',
          quantity: 2,
          unitPrice: 10000,
          total: 20000,
          addon: false,
          part: {
            slug: 'varta-580901080',
            brand: 'Varta',
            number: '580 901 080',
            name: 'Аккумулятор',
          },
          inStock: false,
          leadTimeDays: 3,
          supplier: 'Intercars',
        },
        {
          title: 'Установка в сервисе CarLab',
          quantity: 2,
          unitPrice: 1000,
          total: 2000,
          addon: true,
          part: {
            slug: '',
            brand: '',
            number: '',
            name: 'Установка в сервисе CarLab',
          },
          inStock: null,
          leadTimeDays: null,
          supplier: null,
        },
      ],
      total: 22000,
    });
  });

  it('reads no contact for an order placed without the checkout form', () => {
    expect(readPlacedOrder(order({ metadata: null })).contact).toBeNull();
  });
});
