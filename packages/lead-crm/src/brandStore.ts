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

export interface BrandStoreOptions {
  brand: string;
  storageFor: (path: string) => LeadStorage;
  getNotifier: QuarantineOptions['getNotifier'];
}

export function createBrandStore({
  brand,
  storageFor,
  getNotifier,
}: BrandStoreOptions) {
  const leadStore = createLeadStore({
    storage: storageFor(LEADS_PATH),
    schema: storedLeadSchema,
    quarantine: createQuarantine({
      storage: storageFor(QUARANTINE_PATH),
      brand,
      getNotifier,
    }),
  });
  const ledgerStore = createLedgerStore({ storage: storageFor(LEDGER_PATH) });
  return { leadStore, ledgerStore };
}
