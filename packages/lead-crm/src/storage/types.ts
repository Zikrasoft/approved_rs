export class StorageConflictError extends Error {
  constructor(message = 'storage write conflict') {
    super(message);
    this.name = 'StorageConflictError';
  }
}

export interface StorageSnapshot {
  raw: unknown;
  version: string | undefined;
}

export interface LeadStorage {
  read(): Promise<StorageSnapshot>;
  write(leads: unknown, version: string | undefined): Promise<void>;
}
