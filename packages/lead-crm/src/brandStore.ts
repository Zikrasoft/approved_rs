import { storedLeadSchema } from './schema.ts';
import {
  createQuarantine,
  LEADS_PATH,
  QUARANTINE_PATH,
  type QuarantineOptions,
} from './quarantine.ts';
import { createLeadStore } from './store.ts';
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
  return { leadStore };
}
