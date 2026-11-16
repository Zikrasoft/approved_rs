import { createLeadStore } from './store.ts';
import { createLedgerStore } from './ledgerStore.ts';
import { crmDatabase, type CrmDatabase } from './database.ts';
import { createNotifyLead, type NotifyLeadOptions } from './notifyLead.ts';

export interface BrandStoreOptions {
  brand: string;
  database?: CrmDatabase;
  standaloneServices?: readonly string[];
  getNotifier: () => Promise<{
    notifier: NotifyLeadOptions['notifier'] & {
      sendLeadCountAlert(count: number, brand: string): Promise<void>;
    };
  }>;
}

export function createBrandStore({
  brand,
  database = crmDatabase,
  getNotifier,
  standaloneServices,
}: BrandStoreOptions) {
  const leadStore = createLeadStore({
    database,
    standaloneServices,
    alertLeadCount: async (count) =>
      (await getNotifier()).notifier.sendLeadCountAlert(count, brand),
  });
  const ledgerStore = createLedgerStore({ database });
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
