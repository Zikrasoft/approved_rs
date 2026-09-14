import type { LeadStorage } from './storage/types.ts';

export const LEADS_PATH = 'data/leads.json';
export const QUARANTINE_PATH = 'data/leads-unreadable.json';

export interface QuarantineOptions {
  storage: LeadStorage;
  brand: string;
  getNotifier: () => Promise<{
    notifier: {
      sendQuarantinedLeadsToAdmin(
        count: number,
        path: string,
        brand: string,
      ): Promise<void>;
    };
  }>;
}

export function createQuarantine({
  storage,
  brand,
  getNotifier,
}: QuarantineOptions) {
  return async function quarantine(entries: unknown[]): Promise<void> {
    const { raw, version } = await storage.read();
    if (raw !== undefined && !Array.isArray(raw)) {
      throw new Error(
        `[lead-crm] the quarantine file is ${typeof raw}, not an array — refusing to overwrite`,
      );
    }
    const stored: unknown[] = raw ?? [];
    const seen = new Set(stored.map((entry) => JSON.stringify(entry)));
    const fresh = entries.filter((entry) => !seen.has(JSON.stringify(entry)));
    if (fresh.length === 0) return;

    await storage.write([...stored, ...fresh], version);
    console.error('[lead-crm] copied records it cannot parse', {
      count: fresh.length,
      entries: fresh,
    });
    const { notifier } = await getNotifier();
    await notifier
      .sendQuarantinedLeadsToAdmin(fresh.length, QUARANTINE_PATH, brand)
      .catch((error: unknown) =>
        console.error('[lead-crm] quarantine notice failed', { error }),
      );
  };
}
