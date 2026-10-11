import { storedLeadSchema } from './schema.ts';
import {
  createQuarantine,
  LEADS_PATH,
  QUARANTINE_PATH,
  type QuarantineOptions,
} from './quarantine.ts';
import { createLeadStore } from './store.ts';
import { createLedgerStore, LEDGER_PATH } from './ledgerStore.ts';
import { legacyOwed } from './legacyIncomes.ts';
import { storedRecordsSchema, type LeadStorage } from './storage/types.ts';

export const OPENING_NOTE = 'Перенос со старой системы';

type QuarantineNotifier = Awaited<
  ReturnType<QuarantineOptions['getNotifier']>
>['notifier'];

export interface BrandStoreOptions {
  brand: string;
  storageFor: (path: string) => LeadStorage;
  getNotifier: () => Promise<{
    notifier: QuarantineNotifier & {
      sendUnreadableLedgerToAdmin(path: string, brand: string): Promise<void>;
    };
  }>;
}

export function createBrandStore({
  brand,
  storageFor,
  getNotifier,
}: BrandStoreOptions) {
  const leadsStorage = storageFor(LEADS_PATH);
  const ledgerStore = createLedgerStore({
    storage: storageFor(LEDGER_PATH),
    opening: async () => {
      const { raw } = await leadsStorage.read();
      const owed = legacyOwed(storedRecordsSchema.parse(raw ?? []));
      return owed > 0
        ? [{ type: 'payout', amount: owed, note: OPENING_NOTE, by: 'owner' }]
        : [];
    },
    onUnreadable: async () => {
      const { notifier } = await getNotifier();
      await notifier.sendUnreadableLedgerToAdmin(LEDGER_PATH, brand);
    },
  });
  const leadStore = createLeadStore({
    storage: leadsStorage,
    schema: storedLeadSchema,
    quarantine: createQuarantine({
      storage: storageFor(QUARANTINE_PATH),
      brand,
      getNotifier,
    }),
    // TODO: drop beforeWrite, the opening and legacyIncomes.ts once data/ledger.json exists in production.
    beforeWrite: () => ledgerStore.ensureOpened(),
  });
  return { leadStore, ledgerStore };
}
