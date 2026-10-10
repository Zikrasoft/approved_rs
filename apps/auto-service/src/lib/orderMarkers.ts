import { localOrderMarkers, type OrderMarkers } from '@podbor/lead-crm';
import { createBlobOrderMarkers } from '@podbor/lead-crm/storage/vercel-blob';

function openOrderMarkers(): OrderMarkers {
  if (import.meta.env.DEV) return localOrderMarkers();
  return createBlobOrderMarkers();
}

export const orderMarkers = openOrderMarkers();
