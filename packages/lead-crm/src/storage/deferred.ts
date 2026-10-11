import type { OrderMarkers } from '../orderMarkers.ts';
import type { LeadStorage } from './types.ts';

export const deferStorage = (opened: Promise<LeadStorage>): LeadStorage => ({
  read: async () => (await opened).read(),
  exists: async () => (await opened).exists(),
  write: async (leads, version) => (await opened).write(leads, version),
});

export const deferOrderMarkers = (
  opened: Promise<OrderMarkers>,
): OrderMarkers => ({
  has: async (orderId) => (await opened).has(orderId),
  add: async (orderId) => (await opened).add(orderId),
  release: async (orderId) => (await opened).release(orderId),
});
