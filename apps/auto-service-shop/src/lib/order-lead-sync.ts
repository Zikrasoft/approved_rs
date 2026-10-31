import type {
  ILockingModule,
  Logger,
  MedusaContainer,
} from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
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
import {
  alertOwner,
  LeadRouteRefusal,
  type LeadOrder,
  orderLeadPayload,
  readLeadOrder,
  sendShopOrderEvent,
} from './order-lead';
import { leadStamp, MAX_HANDOFF_ATTEMPTS, readOrder } from './order-metadata';

const LOCK_TIMEOUT_SECONDS = 30;
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
  lock: <T>(key: string, job: () => Promise<T>) => Promise<T>;
  send: (event: ShopOrderEvent) => Promise<void>;
  alert: (text: string) => Promise<boolean>;
  logger: Pick<Logger, 'info' | 'warn' | 'error'>;
  adminOrigin: string;
}

export type CrmSettlement = { settled: OrderOutcome } | { conflict: string };

export function createOrderLeadSync({
  orders,
  lock,
  send,
  alert,
  logger,
  adminOrigin,
}: OrderLeadSyncDeps) {
  const locked =
    <A extends unknown[], T>(job: (id: string, ...args: A) => Promise<T>) =>
    (id: string, ...args: A) =>
      lock(`order-lead:${id}`, () => job(id, ...args));

  const now = () => new Date().toISOString();

  async function alertOnce(
    id: string,
    stamp: (at: string) => Record<string, unknown>,
    text: string,
  ) {
    if (!(await alert(text))) {
      logger.error(
        `Order ${id} gave up on the lead pipeline, nobody alerted yet`,
      );
      return;
    }
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
    const handedOff = recent.filter(
      (order) =>
        order.id !== id &&
        readOrder(order.metadata).contact?.contact === contact &&
        readOrder(order.metadata).lead.handed_off_at,
    );
    return handedOff.length >= SHOP_HANDOFFS_PER_CONTACT_HOUR;
  }

  async function handOff(id: string): Promise<void> {
    const { status, metadata, display_id } = await orders.retrieve(id);
    const { lead } = readOrder(metadata);
    if (status === 'canceled' || lead.handed_off_at || lead.alerted_at) return;
    if (await contactHandedOffThisHour(id, metadata)) {
      logger.warn(
        `Order ${id} waits for a later retry: its contact reached the CRM ${SHOP_HANDOFFS_PER_CONTACT_HOUR} times this hour`,
      );
      return;
    }
    const undelivered = (reason: string) =>
      alertOnce(
        id,
        leadStamp.ownerAlerted,
        PARTS_ORDER_COPY.undelivered(display_id ?? id, reason),
      );
    if (lead.gave_up) return undelivered(lead.error ?? '');
    try {
      await send(orderLeadPayload(await orders.leadOrder(id), adminOrigin));
      logger.info(`Order ${id} handed to the lead pipeline`);
      await orders.patch(id, leadStamp.handedOff(now()));
    } catch (error) {
      const reason = errorMessage(error);
      logger.error(`Order ${id} did not reach the lead pipeline: ${reason}`);
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
        id,
        leadStamp.cancelAlerted,
        PARTS_ORDER_COPY.cancelUndelivered(display_id ?? id, reason),
      );
    const { attempts } = lost;
    if (attempts >= MAX_HANDOFF_ATTEMPTS) return undelivered(lost.error ?? '');
    try {
      await send({ event: 'canceled', order_id: id });
      await orders.patch(id, leadStamp.lost(now()));
    } catch (error) {
      if (error instanceof LeadRouteRefusal && cancelRefused(error.status)) {
        logger.warn(
          `Order ${id} is canceled, but the CRM refused it (${error.status}: its Lead is won or deleted)`,
        );
        await orders.patch(id, leadStamp.cancelRefused(now()));
        return;
      }
      const reason = errorMessage(error);
      logger.error(
        `Order ${id} cancel did not reach the lead pipeline: ${reason}`,
      );
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

  const retry = (job: (id: string) => Promise<void>, id: string) =>
    job(id).catch((error) =>
      logger.error(`Order ${id} retry failed: ${errorMessage(error)}`),
    );

  async function retryDue(at: Date): Promise<void> {
    const recent = await orders.createdBetween(
      new Date(at.getTime() - RETRY_WINDOW_MS),
      new Date(at.getTime() - SUBSCRIBER_GRACE_MS),
    );
    for (const { id } of recent) await retry(placed, id);
    const touched = await orders.updatedSince(
      new Date(at.getTime() - RETRY_WINDOW_MS),
    );
    for (const { id, status } of touched) {
      if (status === 'canceled') await retry(canceled, id);
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
  const locking = container.resolve<ILockingModule>(Modules.LOCKING);
  const { LEAD_ROUTE_URL, SHOP_LEAD_SECRET, ADMIN_CORS } = parseEnv(
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
    lock: (key, job) =>
      locking.execute(key, job, { timeout: LOCK_TIMEOUT_SECONDS }),
    async send(event) {
      if (!LEAD_ROUTE_URL || !SHOP_LEAD_SECRET)
        throw new Error('LEAD_ROUTE_URL or SHOP_LEAD_SECRET is not set');
      await sendShopOrderEvent(LEAD_ROUTE_URL, event, SHOP_LEAD_SECRET);
    },
    alert: (text) => alertOwner(text),
    logger: container.resolve(ContainerRegistrationKeys.LOGGER),
    adminOrigin: ADMIN_CORS.split(',')[0]!,
  });
}
