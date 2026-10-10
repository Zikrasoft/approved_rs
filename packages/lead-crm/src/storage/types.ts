import { z } from 'zod';

export const LOCAL_DATA_DIR = '.local-data';

export const storedRecordsSchema = z.array(z.unknown());

export class StorageConflictError extends Error {
  constructor(message = 'storage write conflict', options?: ErrorOptions) {
    super(message, options);
    this.name = 'StorageConflictError';
  }
}

export interface StorageSnapshot {
  raw: unknown;
  version: string | undefined;
}

export interface LeadStorage {
  read(): Promise<StorageSnapshot>;
  exists(): Promise<boolean>;
  write(leads: unknown, version: string | undefined): Promise<void>;
}
