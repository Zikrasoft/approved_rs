import type { OrderMarkers } from '@podbor/lead-crm';
import { createBlobOrderMarkers } from '@podbor/lead-crm/storage/vercel-blob';
import { localOrBlob } from './localOrBlob';

export const orderMarkers = localOrBlob<OrderMarkers>(
  createBlobOrderMarkers,
  ({ createFileOrderMarkers }, dir) => createFileOrderMarkers({ dir }),
  (opened) => ({
    has: async (orderId) => (await opened).has(orderId),
    add: async (orderId) => (await opened).add(orderId),
    release: async (orderId) => (await opened).release(orderId),
  }),
);
