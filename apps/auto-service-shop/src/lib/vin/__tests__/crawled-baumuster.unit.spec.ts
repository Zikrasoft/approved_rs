import { baumusterListedIn } from '../crawled-baumuster';

describe('baumusterListedIn', () => {
  it.each([
    ['E 300 (212.054/254) Sistem: AIRMATIC', ['212054', '212254']],
    [
      'S 400 (W222.067/165/167) Sistem: AIRMATIC',
      ['222067', '222165', '222167'],
    ],
    ['A 250 e (V/W177.085/086/185)', ['177085', '177086', '177185']],
    ['1226 AF (MK,650.288)', ['650288']],
    [
      'B 200 BlueEFFICIENCY (246.243) Automatic gearbox Gearbox code: 7G-DCT',
      ['246243'],
    ],
  ])('reads the Baumuster %s lists', (name, expected) => {
    expect(baumusterListedIn(name)).toEqual(expected);
  });

  it.each([
    ['C 200 (205)', []],
    ['320d (G20, G21)', []],
    ['S 350 (W222.067/165) Engine Code: OM 222.167', ['222067', '222165']],
    ['1828 NTG (957) 05/13 → Series: 956.003/033', []],
  ])('reads only the parentheses of %s', (name, expected) => {
    expect(baumusterListedIn(name)).toEqual(expected);
  });
});
