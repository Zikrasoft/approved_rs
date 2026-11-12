import type { MedusaContainer } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';
import {
  cancelOrderWorkflow,
  completeOrderWorkflow,
} from '@medusajs/medusa/core-flows';
import { SHOP_HANDOFFS_PER_CONTACT_HOUR } from '@podbor/lead-crm/limits';
import { PARTS_ORDER_COPY } from '@podbor/lead-crm/parts-order-copy';
import {
  cancelRefused,
  type OrderOutcome,
  type ShopOrderEvent,
} from '@podbor/lead-crm/shop-orders-wire';
import { parseEnv } from './env';
import { errorMessage } from './errors';
import { type Lock, lockedBy, lockOf } from './lock';
import { causeOf, logEvent, type ShopEvents } from './log-event';
import {
  alertOwner,
  LeadRouteRefusal,
  type LeadOrder,
  orderLeadPayload,
  readLeadOrder,
  sendShopOrderEvent,
} from './order-lead';
import { leadStamp, MAX_HANDOFF_ATTEMPTS, readOrder } from './order-metadata';

const RETRY_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
const SUBSCRIBER_GRACE_MS = 2 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

type Metadata = Record<string, unknown> | null | undefined;

export interface SyncOrder {
  id: string;
  display_id?: number | null;
  status: string;
  metadata?: Metadata;
}

export interface SyncOrders {
  retrieve(id: string): Promise<SyncOrder>;
  patch(id: string, fields: Record<string, unknown>): Promise<Metadata>;
  leadOrder(id: string): Promise<LeadOrder>;
  complete(id: string): Promise<void>;
  cancel(id: string): Promise<void>;
  createdBetween(from: Date, to: Date): Promise<SyncOrder[]>;
  updatedSince(from: Date): Promise<SyncOrder[]>;
}

export interface OrderLeadSyncDeps {
  orders: SyncOrders;
  lock: Lock;
  send: (event: ShopOrderEvent) => Promise<void>;
  alert: (text: string) => Promise<boolean>;
  adminOrigin: string;
}

export type CrmSettlement = { settled: OrderOutcome } | { conflict: string };

type Handoff = ShopEvents['order.handoff'];
type HandoffKind = Handoff['kind'];

const handoffReason = (error: unknown): string => {
  if (error instanceof LeadRouteRefusal) return `status_${error.status}`;
  if (error instanceof Error && error.name === 'TimeoutError') return 'timeout';
  if (error instanceof TypeError) return 'network';
  return 'error';
};

const logHandoff = (
  kind: HandoffKind,
  order: string,
  outcome: Handoff['outcome'],
  {
    reason = null,
    cause = null,
  }: Partial<Pick<Handoff, 'reason' | 'cause'>> = {},
) => logEvent('order.handoff', { outcome, reason, kind, order, cause });

const logHandoffFailure = (kind: HandoffKind, order: string, error: unknown) =>
  logHandoff(kind, order, 'failed', {
    reason: handoffReason(error),
    cause: causeOf(error),
  });

export function createOrderLeadSync({
  orders,
  lock,
  send,
  alert,
  adminOrigin,
}: OrderLeadSyncDeps) {
  const locked = lockedBy(lock, 'order-lead');

  const now = () => new Date().toISOString();

  async function alertOnce(
    kind: HandoffKind,
    id: string,
    stamp: (at: string) => Record<string, unknown>,
    text: string,
  ) {
    if (!(await alert(text))) {
      logHandoff(kind, id, 'alert_failed', { reason: 'gave_up' });
      return;
    }
    logHandoff(kind, id, 'alerted', { reason: 'gave_up' });
    await orders.patch(id, stamp(now()));
  }

  async function contactHandedOffThisHour(id: string, metadata: Metadata) {
    const contact = readOrder(metadata).contact?.contact;
    if (!contact) return false;
    const at = new Date();
    const recent = await orders.createdBetween(
      new Date(at.getTime() - HOUR_MS),
      at,
    );
    const handedOff = recent.filter((order) => {
      const read = readOrder(order.metadata);
      return (
        order.id !== id &&
        read.contact?.contact === contact &&
        read.lead.handed_off_at
      );
    });
    return handedOff.length >= SHOP_HANDOFFS_PER_CONTACT_HOUR;
  }

  async function handOff(id: string): Promise<void> {
    const { status, metadata, display_id } = await orders.retrieve(id);
    const { lead } = readOrder(metadata);
    if (status === 'canceled' || lead.handed_off_at || lead.alerted_at) return;
    if (await contactHandedOffThisHour(id, metadata)) {
      logHandoff('placed', id, 'deferred', { reason: 'contact_hourly_cap' });
      return;
    }
    const undelivered = (reason: string) =>
      alertOnce(
        'placed',
        id,
        leadStamp.ownerAlerted,
        PARTS_ORDER_COPY.undelivered(display_id ?? id, reason),
      );
    if (lead.gave_up) return undelivered(lead.error ?? '');
    try {
      await send(orderLeadPayload(await orders.leadOrder(id), adminOrigin));
      logHandoff('placed', id, 'delivered');
      await orders.patch(id, leadStamp.handedOff(now()));
    } catch (error) {
      const reason = errorMessage(error);
      logHandoffFailure('placed', id, error);
      const recorded = await orders.patch(
        id,
        leadStamp.handOffFailed(reason, lead.attempts + 1),
      );
      if (readOrder(recorded).lead.gave_up) await undelivered(reason);
    }
  }

  async function handCancel(id: string): Promise<void> {
    const { metadata, display_id } = await orders.retrieve(id);
    const { lead, cancel: lost } = readOrder(metadata);
    if (
      !lead.handed_off_at ||
      lost.lost_at ||
      lost.refused_at ||
      lost.alerted_at
    )
      return;
    const undelivered = (reason: string) =>
      alertOnce(
        'canceled',
        id,
        leadStamp.cancelAlerted,
        PARTS_ORDER_COPY.cancelUndelivered(display_id ?? id, reason),
      );
    const { attempts } = lost;
    if (attempts >= MAX_HANDOFF_ATTEMPTS) return undelivered(lost.error ?? '');
    try {
      await send({ event: 'canceled', order_id: id });
      logHandoff('canceled', id, 'delivered');
      await orders.patch(id, leadStamp.lost(now()));
    } catch (error) {
      if (error instanceof LeadRouteRefusal && cancelRefused(error.status)) {
        logHandoff('canceled', id, 'refused', {
          reason: `status_${error.status}`,
        });
        await orders.patch(id, leadStamp.cancelRefused(now()));
        return;
      }
      const reason = errorMessage(error);
      logHandoffFailure('canceled', id, error);
      await orders.patch(id, leadStamp.lostFailed(reason, attempts + 1));
      if (attempts + 1 >= MAX_HANDOFF_ATTEMPTS) await undelivered(reason);
    }
  }

  async function settle(
    id: string,
    outcome: OrderOutcome,
  ): Promise<CrmSettlement> {
    const order = await orders.retrieve(id);
    if (order.status === outcome) return { settled: outcome };
    if (order.status === 'completed' || order.status === 'canceled')
      return { conflict: order.status };
    if (outcome === 'completed') {
      await orders.complete(id);
      return { settled: outcome };
    }
    await orders.patch(id, leadStamp.lost(now()));
    try {
      await orders.cancel(id);
    } catch (error) {
      await orders.patch(id, leadStamp.lostUndone());
      throw error;
    }
    return { settled: outcome };
  }

  const placed = locked(handOff);
  const canceled = locked(handCancel);

  const retry = (
    kind: HandoffKind,
    job: (id: string) => Promise<void>,
    id: string,
  ) => job(id).catch((error) => logHandoffFailure(kind, id, error));

  async function retryDue(at: Date): Promise<void> {
    const recent = await orders.createdBetween(
      new Date(at.getTime() - RETRY_WINDOW_MS),
      new Date(at.getTime() - SUBSCRIBER_GRACE_MS),
    );
    for (const { id } of recent) await retry('placed', placed, id);
    const touched = await orders.updatedSince(
      new Date(at.getTime() - RETRY_WINDOW_MS),
    );
    for (const { id, status } of touched) {
      if (status === 'canceled') await retry('canceled', canceled, id);
    }
  }

  return {
    placed,
    canceled,
    settleFromCrm: locked(settle),
    retryDue,
  };
}

export function orderLeadSync(container: MedusaContainer) {
  const orderModule = container.resolve(Modules.ORDER);
  const { STOREFRONT_ORIGIN, SHOP_LEAD_SECRET, ADMIN_CORS } = parseEnv(
    process.env,
  );
  return createOrderLeadSync({
    orders: {
      retrieve: (id) => orderModule.retrieveOrder(id),
      async patch(id, fields) {
        const { metadata } = await orderModule.retrieveOrder(id);
        const next = { ...metadata, ...fields };
        await orderModule.updateOrders(id, { metadata: next });
        return next;
      },
      leadOrder: (id) => readLeadOrder(container, id),
      async complete(id) {
        await completeOrderWorkflow(container).run({
          input: { orderIds: [id] },
        });
      },
      async cancel(id) {
        await cancelOrderWorkflow(container).run({ input: { order_id: id } });
      },
      createdBetween: (from, to) =>
        orderModule.listOrders(
          {
            created_at: { $gte: from.toISOString(), $lte: to.toISOString() },
          },
          { select: ['id', 'status', 'metadata'] },
        ),
      updatedSince: (from) =>
        orderModule.listOrders(
          { updated_at: { $gte: from.toISOString() } },
          { select: ['id', 'status'] },
        ),
    },
    lock: lockOf(container),
    async send(event) {
      if (!STOREFRONT_ORIGIN || !SHOP_LEAD_SECRET)
        throw new Error('STOREFRONT_ORIGIN or SHOP_LEAD_SECRET is not set');
      await sendShopOrderEvent(STOREFRONT_ORIGIN, event, SHOP_LEAD_SECRET);
    },
    alert: (text) => alertOwner(text),
    adminOrigin: ADMIN_CORS.split(',')[0]!,
  });
}
