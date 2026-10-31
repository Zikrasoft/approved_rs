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
import { PARTS_ORDER_COPY } from '@podbor/lead-crm/parts-order-copy';
import {
  cancelRefused,
  type OrderOutcome,
  type ShopOrderEvent,
} from '@podbor/lead-crm/shop-orders-wire';
import { z } from 'zod';

import { parseEnv } from './env';
import { errorMessage } from './errors';
import { filled } from './line-metadata';
import {
  alertOwner,
  LeadRouteRefusal,
  type LeadOrder,
  orderLeadPayload,
  readLeadOrder,
  sendShopOrderEvent,
} from './order-lead';

export const MAX_HANDOFF_ATTEMPTS = 6;
export const MAX_HANDOFFS_PER_CONTACT_HOUR = 3;

const HANDED_OFF_AT = 'lead_handed_off_at';
const HANDOFF_ERROR = 'lead_handoff_error';
const HANDOFF_ATTEMPTS = 'lead_handoff_attempts';
const OWNER_ALERTED_AT = 'lead_owner_alerted_at';
const LOST_AT = 'lead_lost_at';
const LOST_ERROR = 'lead_lost_error';
const LOST_ATTEMPTS = 'lead_lost_attempts';
const CANCEL_REFUSED_AT = 'lead_cancel_refused_at';
const CANCEL_ALERTED_AT = 'lead_cancel_alerted_at';

const LOCK_TIMEOUT_SECONDS = 30;
const RETRY_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
const SUBSCRIBER_GRACE_MS = 2 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

type Metadata = Record<string, unknown> | null | undefined;

const attemptsSchema = z.coerce.number().int().nonnegative().catch(0);

const attemptsAt = (metadata: Metadata, key: string): number =>
  attemptsSchema.parse(metadata?.[key] ?? 0);

export const orderLeadStatus = (metadata: Metadata) => {
  const attempts = attemptsAt(metadata, HANDOFF_ATTEMPTS);
  return {
    handed_off_at: filled.parse(metadata?.[HANDED_OFF_AT]),
    attempts,
    error: filled.parse(metadata?.[HANDOFF_ERROR]),
    gave_up: attempts >= MAX_HANDOFF_ATTEMPTS,
    alerted_at: filled.parse(metadata?.[OWNER_ALERTED_AT]),
  };
};

const cancelStatus = (metadata: Metadata) => ({
  lost_at: filled.parse(metadata?.[LOST_AT]),
  error: filled.parse(metadata?.[LOST_ERROR]),
  attempts: attemptsAt(metadata, LOST_ATTEMPTS),
  refused_at: filled.parse(metadata?.[CANCEL_REFUSED_AT]),
  alerted_at: filled.parse(metadata?.[CANCEL_ALERTED_AT]),
});

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

  async function alertOnce(id: string, stamp: string, text: string) {
    if (!(await alert(text))) {
      logger.error(
        `Order ${id} gave up on the lead pipeline, nobody alerted yet`,
      );
      return;
    }
    await orders.patch(id, { [stamp]: now() });
  }

  async function contactHandedOffThisHour(id: string, metadata: Metadata) {
    const contact = filled.parse(metadata?.contact);
    if (!contact) return false;
    const at = new Date();
    const recent = await orders.createdBetween(
      new Date(at.getTime() - HOUR_MS),
      at,
    );
    const handedOff = recent.filter(
      (order) =>
        order.id !== id &&
        filled.parse(order.metadata?.contact) === contact &&
        orderLeadStatus(order.metadata).handed_off_at,
    );
    return handedOff.length >= MAX_HANDOFFS_PER_CONTACT_HOUR;
  }

  async function handOff(id: string): Promise<void> {
    const { status, metadata, display_id } = await orders.retrieve(id);
    const lead = orderLeadStatus(metadata);
    if (status === 'canceled' || lead.handed_off_at || lead.alerted_at) return;
    if (await contactHandedOffThisHour(id, metadata)) {
      logger.warn(
        `Order ${id} waits for a later retry: its contact reached the CRM ${MAX_HANDOFFS_PER_CONTACT_HOUR} times this hour`,
      );
      return;
    }
    const undelivered = (reason: string) =>
      alertOnce(
        id,
        OWNER_ALERTED_AT,
        PARTS_ORDER_COPY.undelivered(display_id ?? id, reason),
      );
    if (lead.gave_up) return undelivered(lead.error ?? '');
    try {
      await send(orderLeadPayload(await orders.leadOrder(id), adminOrigin));
      logger.info(`Order ${id} handed to the lead pipeline`);
      await orders.patch(id, {
        [HANDED_OFF_AT]: now(),
        [HANDOFF_ERROR]: '',
        [HANDOFF_ATTEMPTS]: '',
      });
    } catch (error) {
      const reason = errorMessage(error);
      logger.error(`Order ${id} did not reach the lead pipeline: ${reason}`);
      const recorded = await orders.patch(id, {
        [HANDOFF_ERROR]: reason,
        [HANDOFF_ATTEMPTS]: lead.attempts + 1,
      });
      if (orderLeadStatus(recorded).gave_up) await undelivered(reason);
    }
  }

  async function handCancel(id: string): Promise<void> {
    const { metadata, display_id } = await orders.retrieve(id);
    const lost = cancelStatus(metadata);
    if (
      !orderLeadStatus(metadata).handed_off_at ||
      lost.lost_at ||
      lost.refused_at ||
      lost.alerted_at
    )
      return;
    const undelivered = (reason: string) =>
      alertOnce(
        id,
        CANCEL_ALERTED_AT,
        PARTS_ORDER_COPY.cancelUndelivered(display_id ?? id, reason),
      );
    const { attempts } = lost;
    if (attempts >= MAX_HANDOFF_ATTEMPTS) return undelivered(lost.error ?? '');
    try {
      await send({ event: 'canceled', order_id: id });
      await orders.patch(id, { [LOST_AT]: now(), [LOST_ERROR]: '' });
    } catch (error) {
      if (error instanceof LeadRouteRefusal && cancelRefused(error.status)) {
        logger.warn(
          `Order ${id} is canceled, but the CRM refused it (${error.status}: its Lead is won or deleted)`,
        );
        await orders.patch(id, { [CANCEL_REFUSED_AT]: now() });
        return;
      }
      const reason = errorMessage(error);
      logger.error(
        `Order ${id} cancel did not reach the lead pipeline: ${reason}`,
      );
      await orders.patch(id, {
        [LOST_ERROR]: reason,
        [LOST_ATTEMPTS]: attempts + 1,
      });
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
    await orders.patch(id, { [LOST_AT]: now() });
    try {
      await orders.cancel(id);
    } catch (error) {
      await orders.patch(id, { [LOST_AT]: '' });
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
