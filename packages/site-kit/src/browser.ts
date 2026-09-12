import { readOrCreateVisitorId } from './visitorId.ts';

export function getOrCreateVisitorId(): string {
  return readOrCreateVisitorId({
    storage: localStorage,
    randomId: () => crypto.randomUUID(),
  });
}
