import { storedLeadSchema } from './schema.ts';
import {
  createQuarantine,
  LEADS_PATH,
  QUARANTINE_PATH,
  type QuarantineOptions,
} from './quarantine.ts';
import { createLeadStore } from './store.ts';
import { createLedgerStore, LEDGER_PATH } from './ledgerStore.ts';
import type { LeadStorage } from './storage/types.ts';
import { createNotifyLead, type NotifyLeadOptions } from './notifyLead.ts';

type QuarantineNotifier = Awaited<
  ReturnType<QuarantineOptions['getNotifier']>
>['notifier'];

export interface BrandStoreOptions {
  brand: string;
  storageFor: (path: string) => LeadStorage;
  standaloneServices?: readonly string[];
  getNotifier: () => Promise<{
    notifier: QuarantineNotifier &
      NotifyLeadOptions['notifier'] & {
        sendUnreadableLedgerToAdmin(path: string, brand: string): Promise<void>;
      };
  }>;
}

export function createBrandStore({
  brand,
  storageFor,
  getNotifier,
  standaloneServices,
}: BrandStoreOptions) {
  const leadStore = createLeadStore({
    storage: storageFor(LEADS_PATH),
    schema: storedLeadSchema,
    standaloneServices,
    quarantine: createQuarantine({
      storage: storageFor(QUARANTINE_PATH),
      brand,
      getNotifier,
    }),
  });
  const ledgerStore = createLedgerStore({
    storage: storageFor(LEDGER_PATH),
    onUnreadable: async () => {
      const { notifier } = await getNotifier();
      await notifier.sendUnreadableLedgerToAdmin(LEDGER_PATH, brand);
    },
  });
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
