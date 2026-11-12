import { prefixedNumber } from '../quote-line';

describe('prefixedNumber', () => {
  it.each([
    ['FE12281', 'Febi', '12281'],
    ['EL567640', 'Elring', '567640'],
    ['HEP21-0644', 'HEPU', '21-0644'],
    ['HEPP909', 'HEPU', 'P909'],
    ['SW33104268', 'SWAG', '33104268'],
    ['KYB3340313', 'KYB', '3340313'],
    ['NGK97434', 'NGK', '97434'],
    ['BOS265-827', 'Bosal', '265-827'],
    ['LMI37890', 'Lemförder', '37890'],
  ])('strips the quoting software code from %s', (printed, brand, number) => {
    expect(prefixedNumber(printed)).toEqual({ brand, number });
  });

  it('keeps a code that is part of the number', () => {
    expect(prefixedNumber(' DRM01587 ')).toEqual({
      brand: 'Dr.Motor',
      number: 'DRM01587',
    });
  });

  it.each(['HU 816 x', 'TC3009', 'GDB1548', 'FEBI', 'EL', 'el567640'])(
    'leaves %s alone',
    (printed) => {
      expect(prefixedNumber(printed)).toBeNull();
    },
  );
});
