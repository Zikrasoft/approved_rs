import { checkoutContactSchema } from '@podbor/catalog-contract';

import {
  cashAtPickupMetadata,
  checkoutMetadata,
  leadStamp,
  readOrder,
} from '../order-metadata';

describe('readOrder', () => {
  it('reads a handed off lead', () => {
    expect(
      readOrder({
        lead_handed_off_at: '2026-10-22T19:35:12.000Z',
        lead_handoff_error: '',
        lead_handoff_attempts: '',
      }).lead,
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
      readOrder({
        lead_handoff_error: 'The lead route answered 500',
        lead_handoff_attempts: 6,
        lead_owner_alerted_at: '2026-10-22T20:35:12.000Z',
      }).lead,
    ).toEqual({
      handed_off_at: null,
      attempts: 6,
      error: 'The lead route answered 500',
      gave_up: true,
      alerted_at: '2026-10-22T20:35:12.000Z',
    });
  });

  it('reads the contact the checkout wrote, and none from a bag without one', () => {
    const metadata = checkoutMetadata(
      cashAtPickupMetadata(),
      checkoutContactSchema.parse({
        contact: '+381601234567',
        contact_channel: 'phone',
      }),
      'BMW 3 (G20)',
      'fingerprint',
    );

    expect(readOrder(metadata)).toMatchObject({
      contact: { contact: '+381601234567', contact_channel: 'phone' },
      cashAtPickup: true,
      plannedFingerprint: 'fingerprint',
    });
    expect(metadata.car).toBe('BMW 3 (G20)');
    expect(readOrder(null)).toMatchObject({
      contact: null,
      cashAtPickup: false,
      needsAttention: false,
    });
  });

  it('needs attention while a cash-at-pickup order has not reached the CRM', () => {
    const placed = cashAtPickupMetadata();

    expect(readOrder(placed).needsAttention).toBe(true);
    expect(
      readOrder({ ...placed, ...leadStamp.handedOff('2026-10-22T19:35:12Z') })
        .needsAttention,
    ).toBe(false);
  });

  it('reads back every cancel stamp it writes', () => {
    const at = '2026-10-22T19:35:12.000Z';

    expect(
      readOrder({
        ...leadStamp.lostFailed('down', 2),
        ...leadStamp.cancelRefused(at),
        ...leadStamp.cancelAlerted(at),
      }).cancel,
    ).toEqual({
      lost_at: null,
      error: 'down',
      attempts: 2,
      refused_at: at,
      alerted_at: at,
    });
    expect(readOrder(leadStamp.lost(at)).cancel.lost_at).toBe(at);
    expect(
      readOrder({ ...leadStamp.lost(at), ...leadStamp.lostUndone() }).cancel
        .lost_at,
    ).toBeNull();
  });
});
