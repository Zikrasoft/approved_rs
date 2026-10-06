import { LOCAL_DATA_DIR, type OrderMarkers } from '@podbor/lead-crm';
import { createBlobOrderMarkers } from '@podbor/lead-crm/storage/vercel-blob';

function selectOrderMarkers(): OrderMarkers {
  if (import.meta.env.DEV) {
    const opened = import('@podbor/lead-crm/storage/file').then(
      ({ createFileOrderMarkers }) =>
        createFileOrderMarkers({ dir: LOCAL_DATA_DIR }),
    );
    return {
      has: async (orderId) => (await opened).has(orderId),
      add: async (orderId) => (await opened).add(orderId),
      release: async (orderId) => (await opened).release(orderId),
    };
  }
  return createBlobOrderMarkers();
}

export const orderMarkers: OrderMarkers = selectOrderMarkers();
