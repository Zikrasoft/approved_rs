import { codeKey, nameKey, variantKey } from '../keys';

describe('nameKey', () => {
  it.each([
    ['Lemförder', 'LEMFORDER'],
    ['Citroën', 'CITROEN'],
    ['  febi   bilstein ', 'FEBI BILSTEIN'],
    ['MANN-FILTER', 'MANN FILTER'],
    ['Mann_Filter', 'MANN FILTER'],
    ['A.B.C.', 'A B C'],
    ['Mercedes-Benz', 'MERCEDES BENZ'],
    ['Ｂｏｓｃｈ', 'BOSCH'],
    ['Škoda', 'SKODA'],
    ['3 серия', '3 СЕРИЯ'],
    ['Blue Print', 'BLUE PRINT'],
    ['', ''],
  ])('keys %j as %j', (value, key) => {
    expect(nameKey(value)).toBe(key);
  });

  it.each([
    ['Febi Bilstein', 'FEBI BILSTEIN'],
    ['LEMFORDER', 'Lemförder'],
    ['Citroen', 'Citroën'],
    ['mann filter', 'MANN-FILTER'],
  ])('reads %j and %j as one name', (a, b) => {
    expect(nameKey(a)).toBe(nameKey(b));
  });

  it.each([
    ['Blue Print', 'Blueprint'],
    ['Febi', 'Febi Bilstein'],
  ])('keeps %j and %j apart', (a, b) => {
    expect(nameKey(a)).not.toBe(nameKey(b));
  });
});

describe('codeKey', () => {
  it.each([
    ['N47 D20', 'N47D20'],
    ['n47-d20', 'N47D20'],
    ['N47.D20', 'N47D20'],
    ['E90/E91', 'E90/E91'],
    [' e 90 ', 'E90'],
    ['OM 654.920', 'OM654920'],
  ])('keys %j as %j', (value, key) => {
    expect(codeKey(value)).toBe(key);
  });
});

describe('variantKey', () => {
  it.each([
    ['320d xDrive', '320DXDRIVE'],
    ['320 d (E90, E91)', '320D'],
    ['Citroën C4', 'CITROENC4'],
  ])('keys %j as %j', (value, key) => {
    expect(variantKey(value)).toBe(key);
  });
});
