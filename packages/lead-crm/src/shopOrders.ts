import { isClosed, type StoredLead } from './schema.ts';
import type { LeadStore } from './store.ts';

const SHOP_TIMEOUT_MS = 15_000;

const ORDER_OUTCOME = { won: 'completed', lost: 'canceled' } as const;

type ClosedLead = StoredLead & {
  orderId: string;
  status: keyof typeof ORDER_OUTCOME;
};

function orderUnsettled(lead: StoredLead): lead is ClosedLead {
  return (
    Boolean(lead.orderId) && isClosed(lead) && lead.orderSettled !== lead.status
  );
}

export interface ShopOrdersOptions {
  store: Pick<LeadStore, 'readLeads' | 'settleOrder'>;
  shopUrl?: string;
  apiKey?: string;
}

export function createShopOrders({
  store,
  shopUrl,
  apiKey,
}: ShopOrdersOptions) {
  async function tellShop(lead: ClosedLead): Promise<void> {
    const response = await fetch(
      new URL(
        `/admin/carlab-orders/${encodeURIComponent(lead.orderId)}/outcome`,
        shopUrl,
      ),
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${btoa(`${apiKey}:`)}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ outcome: ORDER_OUTCOME[lead.status] }),
        signal: AbortSignal.timeout(SHOP_TIMEOUT_MS),
      },
    );
    await response.body?.cancel();
    if (response.status === 409)
      console.error('[lead-crm] the shop already holds the other outcome', {
        leadId: lead.id,
        orderId: lead.orderId,
      });
    else if (!response.ok)
      throw new Error(`The shop answered ${response.status}`);
  }

  async function settleOrder(lead: StoredLead): Promise<void> {
    if (!orderUnsettled(lead) || !shopUrl || !apiKey) return;
    try {
      await tellShop(lead);
      await store.settleOrder(lead.id, lead.status);
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

  return { settleOrder, settlePendingOrders };
}
