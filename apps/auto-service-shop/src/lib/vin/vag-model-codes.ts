import { z } from 'zod';

import rows from './vag-model-code-rows.json';

const VAG_MAKES = ['volkswagen', 'audi', 'skoda', 'seat', 'cupra'] as const;

type VagMake = (typeof VAG_MAKES)[number];

const MAKES_BY_WMI: Record<string, readonly VagMake[]> = {
  WVW: ['volkswagen'],
  WVG: ['volkswagen'],
  WV1: ['volkswagen'],
  WV2: ['volkswagen'],
  WV3: ['volkswagen'],
  '1VW': ['volkswagen'],
  '3VW': ['volkswagen'],
  '3VV': ['volkswagen'],
  WAU: ['audi'],
  WA1: ['audi'],
  WUA: ['audi'],
  WU1: ['audi'],
  TRU: ['audi'],
  TMB: ['skoda'],
  VSS: ['seat', 'cupra'],
};

const modelCode = z.string().regex(/^[A-Z0-9]{2}$/);
const typeDesignation = z.string().regex(/^[A-Z0-9]{2,3}$/);
const year = z.number().int().min(1950).max(2100).nullable();

export const vagModelCodeSchema = z
  .object({
    make: z.enum(VAG_MAKES),
    code: modelCode,
    model: z.string().min(1),
    generation: z.string().min(1),
    types: z.array(typeDesignation).min(1),
    from: year,
    to: year,
    market: z.enum(['eu', 'na', 'all']),
    sources: z.array(z.url()).min(1),
  })
  .strict()
  .refine(({ from, to }) => from === null || to === null || from <= to);

export type VagModelCode = z.infer<typeof vagModelCodeSchema>;

const MODEL_CODES = z.array(vagModelCodeSchema).parse(rows);

const NO_MAKES: readonly VagMake[] = [];

export const vagMakesOf = (wmi: string): readonly VagMake[] =>
  MAKES_BY_WMI[wmi] ?? NO_MAKES;

const makesSharingAWmiWith = (make: string): readonly VagMake[] =>
  Object.values(MAKES_BY_WMI).find((makes) =>
    makes.some((shared) => shared === make),
  ) ?? NO_MAKES;

export const vagModelCodes = (make: string, code: string): VagModelCode[] => {
  const makes = makesSharingAWmiWith(make);
  return MODEL_CODES.filter(
    (row) => row.code === code && makes.includes(row.make),
  );
};

const unique = (values: string[]) => [...new Set(values)];

const bound = (
  years: (number | null)[],
  pick: (...known: number[]) => number,
) => {
  const known = years.filter((value): value is number => value !== null);
  return known.length === years.length ? String(pick(...known)) : null;
};

export const vagReference = (make: string, code: string) => {
  const found = vagModelCodes(make, code);
  if (!found.length) return null;
  return {
    code,
    chassis: unique(found.flatMap(({ types }) => types)).join('/'),
    model: unique(found.map(({ generation }) => generation)).join(' / '),
    from: bound(
      found.map(({ from }) => from),
      Math.min,
    ),
    to: bound(
      found.map(({ to }) => to),
      Math.max,
    ),
  };
};
