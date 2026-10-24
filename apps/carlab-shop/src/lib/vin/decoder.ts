import type { VehicleIdentifierType, VinFacts } from '@podbor/catalog-contract';

export type VinDecode = {
  make: string;
  identifiers: { type: VehicleIdentifierType; value: string }[];
  code?: string;
  facts: VinFacts;
  raw: Record<string, unknown>;
};

export interface VinDecoder {
  readonly name: string;
  readonly version: number;
  decode(vin: string): Promise<VinDecode | null>;
}
