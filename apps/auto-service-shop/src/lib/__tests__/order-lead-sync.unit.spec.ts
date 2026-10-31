import type { ShopOrderEvent } from '@podbor/lead-crm/shop-orders-wire';

import { LeadRouteRefusal, type LeadOrder } from '../order-lead';
import {
  createOrderLeadSync,
  MAX_HANDOFF_ATTEMPTS,
  MAX_HANDOFFS_PER_CONTACT_HOUR,
  orderLeadStatus,
  type SyncOrder,
} from '../order-lead-sync';

const NOW = new Date('2026-10-31T12:00:00.000Z');

const leadOrder = (id: string): LeadOrder => ({
  id,
  display_id: 7,
  currency_code: 'rsd',
  metadata: { contact: '+381601234567' },
  items: [{ title: 'Oil filter', unit_price: 1850, quantity: 1 }],
});

function memorySync(seed: SyncOrder[]) {
  const rows = new Map(
    seed.map((order) => [order.id, { ...order, metadata: order.metadata }]),
  );
  const sent: ShopOrderEvent[] = [];
  const alerts: string[] = [];
  const held = new Map<string, Promise<unknown>>();
  const fakes = {
    rows,
    sent,
    alerts,
    answer: (_event: ShopOrderEvent): Promise<void> => Promise.resolve(),
    alertDelivers: true,
    unreadable: new Set<string>(),
    cancel: async (id: string) => {
      rows.get(id)!.status = 'canceled';
    },
  };
  const sync = createOrderLeadSync({
    orders: {
      retrieve: async (id) => {
        if (fakes.unreadable.has(id)) throw new Error('database gone');
        return { ...rows.get(id)! };
      },
      async patch(id, fields) {
        const row = rows.get(id)!;
        row.metadata = { ...row.metadata, ...fields };
        return row.metadata;
      },
      leadOrder: async (id) => leadOrder(id),
      complete: async (id) => {
        rows.get(id)!.status = 'completed';
      },
      cancel: (id) => fakes.cancel(id),
      createdBetween: async () => [...rows.values()],
      updatedSince: async () => [...rows.values()],
    },
    lock: (key, job) => {
      const run = (held.get(key) ?? Promise.resolve()).then(job, job);
      held.set(
        key,
        run.catch(() => undefined),
      );
      return run;
    },
    send: (event) => {
      sent.push(event);
      return fakes.answer(event);
    },
    alert: async (text) => {
      alerts.push(text);
      return fakes.alertDelivers;
    },
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    adminOrigin: 'https://admin.carlab.rs',
  });
  const metadataOf = (id: string) => rows.get(id)!.metadata ?? {};
  return { sync, fakes, metadataOf };
}

const pending = (metadata: Record<string, unknown> = {}): SyncOrder => ({
  id: 'order_1',
  display_id: 7,
  status: 'pending',
  metadata,
});

describe('createOrderLeadSync', () => {
  it('hands a placed Order to the CRM once, however often it is asked', async () => {
    const { sync, fakes, metadataOf } = memorySync([pending()]);

    await Promise.all([sync.placed('order_1'), sync.retryDue(NOW)]);
    await sync.placed('order_1');

    expect(fakes.sent).toEqual([
      expect.objectContaining({ event: 'placed', order_id: 'order_1' }),
    ]);
    expect(orderLeadStatus(metadataOf('order_1'))).toMatchObject({
      handed_off_at: expect.any(String),
      attempts: 0,
      error: null,
    });
  });

  it('holds back a contact past its hourly hand-offs and still hands off another contact', async () => {
    const order = (id: string, contact: string): SyncOrder => ({
      ...pending({ contact }),
      id,
    });
    const flood = Array.from(
      { length: MAX_HANDOFFS_PER_CONTACT_HOUR + 1 },
      (_, index) => order(`order_${index}`, '+381601234567'),
    );
    const { sync, fakes, metadataOf } = memorySync([
      ...flood,
      order('order_other', '+381609999999'),
    ]);

    for (const { id } of flood) await sync.placed(id);
    await sync.placed('order_other');

    expect(fakes.sent.map(({ order_id }) => order_id)).toEqual([
      ...flood.slice(0, -1).map(({ id }) => id),
      'order_other',
    ]);
    expect(
      orderLeadStatus(metadataOf(flood[flood.length - 1].id)).handed_off_at,
    ).toBeNull();
  });

  it('alerts the owner exactly once after six refusals', async () => {
    const { sync, fakes, metadataOf } = memorySync([pending()]);
    fakes.answer = () => Promise.reject(new LeadRouteRefusal(503));

    await sync.placed('order_1');
    for (let run = 0; run < 15; run += 1) await sync.retryDue(NOW);

    expect(fakes.sent).toHaveLength(MAX_HANDOFF_ATTEMPTS);
    expect(fakes.alerts).toEqual([
      expect.stringContaining('The lead route answered 503'),
    ]);
    expect(orderLeadStatus(metadataOf('order_1'))).toMatchObject({
      gave_up: true,
      alerted_at: expect.any(String),
    });
  });

  it('keeps trying to alert while Telegram refuses the alert', async () => {
    const { sync, fakes } = memorySync([
      pending({ lead_handoff_attempts: MAX_HANDOFF_ATTEMPTS }),
    ]);
    fakes.alertDelivers = false;

    await sync.retryDue(NOW);
    fakes.alertDelivers = true;
    await sync.retryDue(NOW);
    await sync.retryDue(NOW);

    expect(fakes.sent).toEqual([]);
    expect(fakes.alerts).toHaveLength(2);
  });

  it('never hands a canceled Order to the CRM', async () => {
    const { sync, fakes } = memorySync([{ ...pending(), status: 'canceled' }]);

    await sync.placed('order_1');

    expect(fakes.sent).toEqual([]);
  });

  it('tells the CRM about a shop-side cancel once', async () => {
    const { sync, fakes, metadataOf } = memorySync([
      {
        ...pending({ lead_handed_off_at: NOW.toISOString() }),
        status: 'canceled',
      },
    ]);

    await sync.canceled('order_1');
    await sync.retryDue(NOW);

    expect(fakes.sent).toEqual([{ event: 'canceled', order_id: 'order_1' }]);
    expect(metadataOf('order_1').lead_lost_at).toEqual(expect.any(String));
  });

  it('says nothing of a cancel for an Order the CRM never had', async () => {
    const { sync, fakes } = memorySync([{ ...pending(), status: 'canceled' }]);

    await sync.canceled('order_1');

    expect(fakes.sent).toEqual([]);
  });

  it.each([404, 409, 410])(
    'stops telling the CRM a cancel it refused with %i',
    async (status) => {
      const { sync, fakes, metadataOf } = memorySync([
        {
          ...pending({ lead_handed_off_at: NOW.toISOString() }),
          status: 'canceled',
        },
      ]);
      fakes.answer = () => Promise.reject(new LeadRouteRefusal(status));

      await sync.canceled('order_1');
      await sync.retryDue(NOW);

      expect(fakes.sent).toHaveLength(1);
      expect(metadataOf('order_1').lead_cancel_refused_at).toEqual(
        expect.any(String),
      );
    },
  );

  it('gives up on a cancel the CRM keeps failing, with one alert', async () => {
    const { sync, fakes } = memorySync([
      {
        ...pending({ lead_handed_off_at: NOW.toISOString() }),
        status: 'canceled',
      },
    ]);
    fakes.answer = () => Promise.reject(new Error('timeout'));

    for (let run = 0; run < 15; run += 1) await sync.canceled('order_1');

    expect(fakes.sent).toHaveLength(MAX_HANDOFF_ATTEMPTS);
    expect(fakes.alerts).toHaveLength(1);
  });

  it('settles a CRM outcome once and refuses the other one', async () => {
    const { sync, fakes } = memorySync([pending()]);

    expect(await sync.settleFromCrm('order_1', 'completed')).toEqual({
      settled: 'completed',
    });
    expect(await sync.settleFromCrm('order_1', 'completed')).toEqual({
      settled: 'completed',
    });
    expect(await sync.settleFromCrm('order_1', 'canceled')).toEqual({
      conflict: 'completed',
    });
    expect(fakes.rows.get('order_1')!.status).toBe('completed');
  });

  it('never echoes a CRM-side cancel back to the CRM', async () => {
    const { sync, fakes } = memorySync([
      pending({ lead_handed_off_at: NOW.toISOString() }),
    ]);
    fakes.cancel = async (id) => {
      fakes.rows.get(id)!.status = 'canceled';
      void sync.canceled(id);
    };

    await sync.settleFromCrm('order_1', 'canceled');
    await sync.canceled('order_1');
    await sync.retryDue(NOW);

    expect(fakes.rows.get('order_1')!.status).toBe('canceled');
    expect(fakes.sent).toEqual([]);
  });

  it('keeps keys written while a failed cancel was running', async () => {
    const { sync, fakes, metadataOf } = memorySync([
      pending({ contact: '+381601234567' }),
    ]);
    fakes.cancel = async (id) => {
      const row = fakes.rows.get(id)!;
      row.metadata = { ...row.metadata, written_meanwhile: 'yes' };
      throw new Error('fulfillments must be canceled');
    };

    await expect(sync.settleFromCrm('order_1', 'canceled')).rejects.toThrow(
      'fulfillments must be canceled',
    );

    expect(metadataOf('order_1')).toMatchObject({
      contact: '+381601234567',
      written_meanwhile: 'yes',
      lead_lost_at: '',
    });
    expect(fakes.rows.get('order_1')!.status).toBe('pending');
  });

  it('retries every other Order when one of them throws', async () => {
    const { sync, fakes } = memorySync([
      { ...pending(), id: 'order_broken' },
      pending(),
      {
        ...pending({ lead_handed_off_at: NOW.toISOString() }),
        id: 'order_canceled',
        status: 'canceled',
      },
    ]);
    fakes.unreadable.add('order_broken');

    await sync.retryDue(NOW);

    expect(fakes.sent).toEqual([
      expect.objectContaining({ event: 'placed', order_id: 'order_1' }),
      { event: 'canceled', order_id: 'order_canceled' },
    ]);
  });
});
