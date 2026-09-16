import { sha256Hex } from './sha256Hex.ts';

export type SectionData = Record<string, unknown>;

export function hashSource(data: SectionData): string {
  return sha256Hex(JSON.stringify(data));
}
