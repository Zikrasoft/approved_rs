export interface VinDecodeResult {
  wmi: string;
  manufacturer: string | null;
  plantCode: string;
  yearCandidates: number[];
  bestYearCandidate: number | null;
}

export interface VinDecoder {
  readonly name: string;
  decode(vin: string, now?: Date): VinDecodeResult;
}

// TODO: no decode vendor is chosen yet (#325) — this tiny table only covers
// the WMIs the seeded fixtures use. Swap in a real vendor's WMI/manufacturer
// lookup when one is picked; this map is illustrative, not exhaustive.
const WMI_MANUFACTURERS: Record<string, string> = {
  WBA: 'BMW',
  WBS: 'BMW',
  WBX: 'BMW',
  WBY: 'BMW',
};

const YEAR_CODE_ORDER = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'J',
  'K',
  'L',
  'M',
  'N',
  'P',
  'R',
  'S',
  'T',
  'V',
  'W',
  'X',
  'Y',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
] as const;
const YEAR_CODE_CYCLE_LENGTH = YEAR_CODE_ORDER.length;
const FIRST_CYCLE_START_YEAR = 1980;

function yearCandidatesForCode(code: string, now = new Date()): number[] {
  const index = YEAR_CODE_ORDER.indexOf(
    code.toUpperCase() as (typeof YEAR_CODE_ORDER)[number],
  );
  if (index === -1) return [];

  const currentYear = now.getFullYear();
  const candidates: number[] = [];
  for (
    let base = FIRST_CYCLE_START_YEAR;
    base <= currentYear;
    base += YEAR_CODE_CYCLE_LENGTH
  ) {
    const year = base + index;
    if (year <= currentYear) candidates.push(year);
  }
  return candidates;
}

export class StructuralOnlyVinDecoder implements VinDecoder {
  readonly name = 'structural-only-iso3779';

  decode(vin: string, now = new Date()): VinDecodeResult {
    const normalized = vin.toUpperCase();
    const wmi = normalized.slice(0, 3);
    const yearCode = normalized[9] ?? '';
    const plantCode = normalized[10] ?? '';
    const yearCandidates = yearCandidatesForCode(yearCode, now);

    return {
      wmi,
      manufacturer: WMI_MANUFACTURERS[wmi] ?? null,
      plantCode,
      yearCandidates,
      bestYearCandidate: yearCandidates[yearCandidates.length - 1] ?? null,
    };
  }
}
