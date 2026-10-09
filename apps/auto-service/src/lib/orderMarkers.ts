import { deferOrderMarkers, type OrderMarkers } from '@podbor/lead-crm';
import { createBlobOrderMarkers } from '@podbor/lead-crm/storage/vercel-blob';
import { localOrBlob } from './localOrBlob';

export const orderMarkers = localOrBlob<OrderMarkers>(
  createBlobOrderMarkers,
  ({ createFileOrderMarkers }, dir) => createFileOrderMarkers({ dir }),
  deferOrderMarkers,
);
