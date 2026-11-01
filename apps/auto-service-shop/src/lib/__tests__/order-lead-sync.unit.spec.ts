import type { ShopOrderEvent } from '@podbor/lead-crm/shop-orders-wire';

import { LeadRouteRefusal, type LeadOrder } from '../order-lead';
import { SHOP_HANDOFFS_PER_CONTACT_HOUR } from '@podbor/lead-crm/limits';

import { createOrderLeadSync, type SyncOrder } from '../order-lead-sync';
import { MAX_HANDOFF_ATTEMPTS, readOrder } from '../order-metadata';

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
    expect(readOrder(metadataOf('order_1')).lead).toMatchObject({
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
      { length: SHOP_HANDOFFS_PER_CONTACT_HOUR + 1 },
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
      readOrder(metadataOf(flood[flood.length - 1].id)).lead.handed_off_at,
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
    expect(readOrder(metadataOf('order_1')).lead).toMatchObject({
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

describe('the order.handoff event', () => {
  const handoffs = () =>
    (console.log as jest.Mock).mock.calls
      .map(([line]) => JSON.parse(line))
      .filter(({ event }) => event === 'order.handoff')
      .map(({ outcome, reason, kind, order, cause }) => ({
        outcome,
        reason,
        kind,
        order,
        cause,
      }));

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs a delivered order and a delivered cancel, without the contact', async () => {
    const { sync, fakes } = memorySync([pending()]);

    await sync.placed('order_1');
    fakes.rows.get('order_1')!.status = 'canceled';
    await sync.canceled('order_1');

    expect(handoffs()).toEqual([
      {
        outcome: 'delivered',
        reason: null,
        kind: 'placed',
        order: 'order_1',
        cause: null,
      },
      {
        outcome: 'delivered',
        reason: null,
        kind: 'canceled',
        order: 'order_1',
        cause: null,
      },
    ]);
    expect(JSON.stringify(handoffs())).not.toContain('381601234567');
  });

  it.each([
    [
      new LeadRouteRefusal(502),
      'status_502',
      'Error: The lead route answered 502',
    ],
    [
      Object.assign(new Error('aborted'), { name: 'TimeoutError' }),
      'timeout',
      'TimeoutError: aborted',
    ],
    [new TypeError('fetch failed'), 'network', 'TypeError: fetch failed'],
    [
      new Error('LEAD_ROUTE_URL is not set'),
      'error',
      'Error: LEAD_ROUTE_URL is not set',
    ],
  ])('names why a hand-off failed: %s', async (error, reason, cause) => {
    const { sync, fakes } = memorySync([pending()]);
    fakes.answer = () => Promise.reject(error);

    await sync.placed('order_1');

    expect(handoffs()).toEqual([
      { outcome: 'failed', reason, kind: 'placed', order: 'order_1', cause },
    ]);
  });

  it('logs a contact held back past its hourly hand-offs as deferred', async () => {
    const flood = Array.from(
      { length: SHOP_HANDOFFS_PER_CONTACT_HOUR + 1 },
      (_, index) => ({
        ...pending({ contact: '+381601234567' }),
        id: `o_${index}`,
      }),
    );
    const { sync } = memorySync(flood);

    for (const { id } of flood) await sync.placed(id);

    expect(handoffs().pop()).toEqual({
      outcome: 'deferred',
      reason: 'contact_hourly_cap',
      kind: 'placed',
      order: `o_${SHOP_HANDOFFS_PER_CONTACT_HOUR}`,
      cause: null,
    });
  });

  it('logs the alert after giving up, and an alert Telegram refused', async () => {
    const { sync, fakes } = memorySync([
      pending({ lead_handoff_attempts: MAX_HANDOFF_ATTEMPTS }),
    ]);
    fakes.alertDelivers = false;

    await sync.retryDue(NOW);
    fakes.alertDelivers = true;
    await sync.retryDue(NOW);

    expect(handoffs().map(({ outcome, reason }) => [outcome, reason])).toEqual([
      ['alert_failed', 'gave_up'],
      ['alerted', 'gave_up'],
    ]);
  });

  it('logs a cancel the CRM refused, and a cancel that failed', async () => {
    const handedOff = {
      ...pending({ lead_handed_off_at: NOW.toISOString() }),
      status: 'canceled',
    };
    const refused = memorySync([handedOff]);
    refused.fakes.answer = () => Promise.reject(new LeadRouteRefusal(409));
    await refused.sync.canceled('order_1');
    const failed = memorySync([handedOff]);
    failed.fakes.answer = () => Promise.reject(new LeadRouteRefusal(500));
    await failed.sync.canceled('order_1');

    expect(
      handoffs().map(({ outcome, reason, kind }) => [outcome, reason, kind]),
    ).toEqual([
      ['refused', 'status_409', 'canceled'],
      ['failed', 'status_500', 'canceled'],
    ]);
  });

  it('logs a retry that threw before it could hand anything off', async () => {
    const { sync, fakes } = memorySync([
      { ...pending(), id: 'order_broken' },
      {
        ...pending({ lead_handed_off_at: NOW.toISOString() }),
        id: 'order_gone',
        status: 'canceled',
      },
    ]);
    fakes.unreadable.add('order_broken');
    fakes.unreadable.add('order_gone');

    await sync.retryDue(NOW);

    expect(handoffs()).toEqual([
      {
        outcome: 'failed',
        reason: 'error',
        kind: 'placed',
        order: 'order_broken',
        cause: 'Error: database gone',
      },
      {
        outcome: 'failed',
        reason: 'error',
        kind: 'placed',
        order: 'order_gone',
        cause: 'Error: database gone',
      },
      {
        outcome: 'failed',
        reason: 'error',
        kind: 'canceled',
        order: 'order_gone',
        cause: 'Error: database gone',
      },
    ]);
  });
});
