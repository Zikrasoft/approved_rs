import { StructuralOnlyVinDecoder } from '../vin-decoder';

describe('StructuralOnlyVinDecoder', () => {
  const decoder = new StructuralOnlyVinDecoder();
  const now = new Date('2026-10-18T00:00:00.000Z');

  it('reads the WMI, maps it to a known manufacturer, and the plant code', () => {
    const result = decoder.decode('WBA3B1C50GL123456');

    expect(result.wmi).toBe('WBA');
    expect(result.manufacturer).toBe('BMW');
    expect(result.plantCode).toBe('L');
  });

  it('resolves the position-10 year code to its most recent 30-year cycle', () => {
    const result = decoder.decode('WBA3B1C50GL123456', now);

    expect(result.yearCandidates).toEqual(expect.arrayContaining([1986, 2016]));
    expect(result.bestYearCandidate).toBe(2016);
  });

  it('reports an unknown manufacturer for a WMI outside its small table', () => {
    const result = decoder.decode('1HGCM82633A004352');

    expect(result.manufacturer).toBeNull();
  });

  it('is case-insensitive on the raw VIN', () => {
    const upper = decoder.decode('WBA3B1C50GL123456');
    const lower = decoder.decode('wba3b1c50gl123456');

    expect(lower).toEqual(upper);
  });

  it('returns no year candidates for a code outside the table', () => {
    const result = decoder.decode('WBA3B1C50IL123456');

    expect(result.yearCandidates).toEqual([]);
    expect(result.bestYearCandidate).toBeNull();
  });
});
