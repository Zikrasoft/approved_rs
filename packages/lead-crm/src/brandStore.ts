import { createLeadStore } from './store.ts';
import { createLedgerStore } from './ledgerStore.ts';
import { createNotifyLead, type NotifyLeadOptions } from './notifyLead.ts';

export interface BrandStoreOptions {
  brand: string;
  standaloneServices?: readonly string[];
  getNotifier: () => Promise<{
    notifier: NotifyLeadOptions['notifier'] & {
      sendLeadCountAlert(count: number, brand: string): Promise<void>;
    };
  }>;
}

export function createBrandStore({
  brand,
  getNotifier,
  standaloneServices,
}: BrandStoreOptions) {
  const leadStore = createLeadStore({
    standaloneServices,
    alertLeadCount: async (count) =>
      (await getNotifier()).notifier.sendLeadCountAlert(count, brand),
  });
  const ledgerStore = createLedgerStore();
  const notifyLead = createNotifyLead({
    store: leadStore,
    brand,
    notifier: {
      sendLeadNotification: async (lead) =>
        (await getNotifier()).notifier.sendLeadNotification(lead),
      refreshLeadCard: async (lead) =>
        (await getNotifier()).notifier.refreshLeadCard(lead),
    },
  });
  return { leadStore, ledgerStore, notifyLead };
}
