import { leadHandoff, type LeadOrder } from '../order-lead';
import { carlabOrderView } from '../order-view';

const order = (overrides: Partial<LeadOrder> = {}): LeadOrder => ({
  id: 'order_1',
  display_id: 12,
  currency_code: 'rsd',
  metadata: {
    fulfillment: 'cash_at_pickup',
    contact: '+381601234567',
    contact_channel: 'whatsapp',
    name: 'Marko',
    vin: 'WBA35BG070N074158',
    car: 'BMW 3 серия F30 320d, B47D20O0',
    comment: 'Pozvati posle 17h',
    locale: 'sr',
  },
  items: [
    {
      title: 'Аккумулятор (Varta 580 901 080)',
      unit_price: 10000,
      quantity: 1,
      metadata: { offer_id: 'off_1', in_stock: false, lead_time_days: 3 },
    },
    {
      title: 'Регистрация аккумулятора',
      unit_price: 2500,
      quantity: 1,
      metadata: { addon_for: 'cali_1' },
    },
  ],
  ...overrides,
});

describe('carlabOrderView', () => {
  it('lays out the customer, the lines and the cash total for the staff', () => {
    expect(carlabOrderView(order())).toEqual({
      id: 'order_1',
      display_id: 12,
      currency: 'RSD',
      cash_at_pickup: true,
      customer: {
        name: 'Marko',
        contact: '+381601234567',
        contact_channel: 'whatsapp',
        vin: 'WBA35BG070N074158',
        car: 'BMW 3 серия F30 320d, B47D20O0',
        comment: 'Pozvati posle 17h',
      },
      lines: [
        {
          title: 'Аккумулятор (Varta 580 901 080)',
          quantity: 1,
          total: 10000,
          addon: false,
          in_stock: false,
          lead_time_days: 3,
        },
        {
          title: 'Регистрация аккумулятора',
          quantity: 1,
          total: 2500,
          addon: true,
          in_stock: null,
          lead_time_days: null,
        },
      ],
      total: 12500,
      lead: {
        handed_off_at: null,
        attempts: 0,
        error: null,
        gave_up: false,
        alerted_at: null,
      },
    });
  });

  it('lists each add-on under its Part, for a beta order carrying both parent keys and a new one alike', () => {
    const view = carlabOrderView(
      order({
        items: [
          {
            title: 'Установка в сервисе CarLab',
            unit_price: 1000,
            quantity: 1,
            metadata: {
              addon_for: 'cali_1',
              addon_offer_id: 'offer_oil',
              addon_kind: 'installation',
            },
          },
          {
            title: 'Varta',
            unit_price: 10000,
            quantity: 1,
            metadata: { offer_id: 'offer_battery' },
          },
          {
            title: 'Регистрация аккумулятора',
            unit_price: 2500,
            quantity: 1,
            metadata: {
              addon_offer_id: 'offer_battery',
              addon_kind: 'service',
            },
          },
          {
            title: 'Oil filter',
            unit_price: 1850,
            quantity: 1,
            metadata: { offer_id: 'offer_oil' },
          },
        ],
      }),
    );

    expect(view.lines.map(({ title, addon }) => [title, addon])).toEqual([
      ['Varta', false],
      ['Регистрация аккумулятора', true],
      ['Oil filter', false],
      ['Установка в сервисе CarLab', true],
    ]);
  });

  it('shows no customer for an order placed without the checkout form', () => {
    const view = carlabOrderView(order({ metadata: null }));

    expect(view.customer).toBeNull();
    expect(view.cash_at_pickup).toBe(false);
  });
});

describe('leadHandoff', () => {
  it('reads a handed off lead', () => {
    expect(
      leadHandoff({
        lead_handed_off_at: '2026-10-22T19:35:12.000Z',
        lead_handoff_error: '',
        lead_handoff_attempts: '',
      }),
    ).toEqual({
      handed_off_at: '2026-10-22T19:35:12.000Z',
      attempts: 0,
      error: null,
      gave_up: false,
      alerted_at: null,
    });
  });

  it('reads a lead the route kept refusing until the owner was alerted', () => {
    expect(
      leadHandoff({
        lead_handoff_error: 'The lead route answered 500',
        lead_handoff_attempts: 6,
        lead_owner_alerted_at: '2026-10-22T20:35:12.000Z',
      }),
    ).toEqual({
      handed_off_at: null,
      attempts: 6,
      error: 'The lead route answered 500',
      gave_up: true,
      alerted_at: '2026-10-22T20:35:12.000Z',
    });
  });
});
