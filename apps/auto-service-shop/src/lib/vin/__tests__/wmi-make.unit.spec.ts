import { makeOfWmi, wmiMakeDecoder } from '../wmi-make';

describe('makeOfWmi', () => {
  it.each([
    ['WF0AXXWPMA1234567', 'ford'],
    ['WF1AXXWPMA1234567', 'ford'],
    ['W0LAAAAAAA1234567', 'opel'],
    ['VF1AAAAAAA1234567', 'renault'],
    ['UU1AAAAAAA1234567', 'dacia'],
    ['VF3AAAAAAA1234567', 'peugeot'],
    ['VF7AAAAAAA1234567', 'citroen'],
    ['ZFAAAAAAAA1234567', 'fiat'],
    ['ZARAAAAAAA1234567', 'alfa-romeo'],
    ['JTDAAAAAAA1234567', 'toyota'],
    ['JN1AAAAAAA1234567', 'nissan'],
    ['KMHAAAAAAA1234567', 'hyundai'],
    ['KNAAAAAAAA1234567', 'kia'],
    ['TMBAAAAAAA1234567', 'skoda'],
    ['YV1AAAAAAA1234567', 'volvo'],
    ['SALAAAAAAA1234567', 'land-rover'],
    ['WP0AAAAAAA1234567', 'porsche'],
    ['WMWAAAAAAA1234567', 'mini'],
    ['5YJAAAAAAA1234567', 'tesla'],
    ['VX1AAAAAAA1234567', 'zastava'],
  ])('%s is %s', (vin, make) => {
    expect(makeOfWmi(vin)).toBe(make);
  });

  it('falls back to the two-character maker prefix', () => {
    expect(makeOfWmi('KNZAAAAAAA1234567')).toBe('kia');
    expect(makeOfWmi('JSZAAAAAAA1234567')).toBe('suzuki');
  });

  it('does not guess an unassigned WMI', () => {
    expect(makeOfWmi('XXXAAAAAAA1234567')).toBeNull();
    expect(makeOfWmi('JMXAAAAAAA1234567')).toBeNull();
  });
});

describe('wmiMakeDecoder', () => {
  it('decodes the make alone', async () => {
    expect(await wmiMakeDecoder.decode('WF0AXXWPMA1234567')).toEqual({
      make: 'ford',
      identifiers: [],
      facts: {},
      raw: { wmi: 'WF0' },
    });
  });

  it('declines an unknown WMI', async () => {
    expect(await wmiMakeDecoder.decode('XXXAAAAAAA1234567')).toBeNull();
  });
});
