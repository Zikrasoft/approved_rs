import type { OrderMarkers } from '../orderMarkers.ts';
import { deferOrderMarkers, deferStorage } from './deferred.ts';
import { LOCAL_DATA_DIR, type LeadStorage } from './types.ts';

let loaded: Promise<typeof import('./file.ts')> | undefined;
const fileModule = () => (loaded ??= import('./file.ts'));

export const localLeadStorage = (
  path: string,
  dir = LOCAL_DATA_DIR,
): LeadStorage =>
  deferStorage(fileModule().then((f) => f.createFileStorage({ path, dir })));

export const localOrderMarkers = (dir = LOCAL_DATA_DIR): OrderMarkers =>
  deferOrderMarkers(
    fileModule().then((f) => f.createFileOrderMarkers({ dir })),
  );
