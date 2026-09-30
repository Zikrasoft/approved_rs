import { fitmentEntrySchema, fitmentSchema } from '@podbor/shop-catalog';
import type { FitmentEntry } from '@podbor/shop-catalog/browser';

export const EMPTY_ROW: FitmentEntry = {
  make: '',
  model: '',
  yearFrom: 0,
  yearTo: 0,
};

export function readFitment(value: unknown): FitmentEntry[] {
  const parsed = fitmentSchema.safeParse(value ?? []);
  return parsed.success ? parsed.data : [];
}

export const unfinishedRow = (rows: readonly FitmentEntry[]): number =>
  rows.findIndex((row) => !fitmentEntrySchema.safeParse(row).success);
