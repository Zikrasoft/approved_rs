import { vagModelCodeDecoder } from '../vag-model-code';

describe('vagModelCodeDecoder', () => {
  it('reads the make from the WMI and the model code from characters 7 and 8', async () => {
    expect(await vagModelCodeDecoder.decode('WVWZZZAUZHW374138')).toEqual({
      make: 'volkswagen',
      identifiers: [{ type: 'vag-model-code', value: 'AU' }],
      facts: {},
      raw: { wmi: 'WVW', code: 'AU', modelYear: 'H' },
    });
    expect(await vagModelCodeDecoder.decode('TMBJR8NX1PY000001')).toMatchObject(
      { make: 'skoda', identifiers: [{ value: 'NX' }] },
    );
  });

  it('names Cupra for a SEAT WMI whose code only Cupra uses', async () => {
    expect((await vagModelCodeDecoder.decode('VSSZZZKMZMR000001'))?.make).toBe(
      'cupra',
    );
  });

  it('names SEAT for a SEAT WMI whose code the open data lacks', async () => {
    expect((await vagModelCodeDecoder.decode('VSSZZZ00ZMR000001'))?.make).toBe(
      'seat',
    );
  });

  it('keeps a code the open data lacks, for staff to see', async () => {
    expect(await vagModelCodeDecoder.decode('WAUZZZ00ZKA000001')).toMatchObject(
      { make: 'audi', identifiers: [{ value: '00' }] },
    );
  });

  it('leaves a VIN outside the group to the other decoders', async () => {
    expect(await vagModelCodeDecoder.decode('WBA8C51070N000001')).toBeNull();
  });
});
