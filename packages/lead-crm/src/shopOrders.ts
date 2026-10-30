import { isClosed, type StoredLead } from './schema.ts';
import type { LeadStore } from './store.ts';
import type { Notifier } from './telegram/notify.ts';

const SHOP_TIMEOUT_MS = 15_000;

const ORDER_OUTCOME = { won: 'completed', lost: 'canceled' } as const;

type ClosedLead = StoredLead & {
  orderId: string;
  status: keyof typeof ORDER_OUTCOME;
};

function orderUnsettled(lead: StoredLead): lead is ClosedLead {
  return (
    Boolean(lead.orderId) &&
    isClosed(lead) &&
    lead.orderSettled !== lead.status &&
    lead.orderConflict !== lead.status
  );
}

export interface ShopOrdersOptions {
  store: Pick<LeadStore, 'readLeads' | 'settleOrder' | 'markOrderConflict'>;
  notifier: Pick<Notifier, 'sendOrderConflict'>;
  shopUrl?: string;
  secret?: string;
}

export function createShopOrders({
  store,
  notifier,
  shopUrl,
  secret,
}: ShopOrdersOptions) {
  async function tellShop(lead: ClosedLead): Promise<'settled' | 'conflict'> {
    const response = await fetch(
      new URL(
        `/hooks/carlab-orders/${encodeURIComponent(lead.orderId)}/outcome`,
        shopUrl,
      ),
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ outcome: ORDER_OUTCOME[lead.status] }),
        signal: AbortSignal.timeout(SHOP_TIMEOUT_MS),
      },
    );
    await response.body?.cancel();
    if (response.status === 409) return 'conflict';
    if (!response.ok) throw new Error(`The shop answered ${response.status}`);
    return 'settled';
  }

  async function recordConflict(lead: ClosedLead): Promise<void> {
    if (lead.orderConflict === lead.status) return;
    console.error('[lead-crm] the shop holds the other order outcome', {
      leadId: lead.id,
      orderId: lead.orderId,
    });
    await store.markOrderConflict(lead.id, lead.status);
    await notifier.sendOrderConflict(lead);
  }

  async function settleOrder(lead: StoredLead): Promise<void> {
    if (!orderUnsettled(lead) || !shopUrl || !secret) return;
    try {
      if ((await tellShop(lead)) === 'conflict') await recordConflict(lead);
      else await store.settleOrder(lead.id, lead.status);
    } catch (error) {
      console.error('[lead-crm] the shop did not take the order outcome', {
        error,
        leadId: lead.id,
        orderId: lead.orderId,
      });
    }
  }

  async function settlePendingOrders(): Promise<number> {
    const pending = (await store.readLeads()).filter(orderUnsettled);
    for (const lead of pending) await settleOrder(lead);
    return (await store.readLeads()).filter(orderUnsettled).length;
  }

  return { settleOrder, settlePendingOrders, recordConflict };
}
