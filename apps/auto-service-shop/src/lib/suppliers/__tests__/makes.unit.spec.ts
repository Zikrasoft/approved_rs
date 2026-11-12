import { carMakeName } from '../makes';

describe('carMakeName', () => {
  it('names the truck, bus and van makes a workshop that also services trucks fits parts to', () => {
    expect(
      [
        'DAF TRUCKS',
        'DAF BUS (VDL BUS GROUP)',
        'MAN',
        'SCANIA',
        'IVECO BUS',
        'IRISBUS (IVECO)',
        'VOLVO TRUCKS',
        'RENAULT TRUCKS (RVI)',
        'MERCEDES-BENZ TRUCKS',
        'TATRA',
        'ERF (E.R.F.)',
        'FODEN',
        'FREIGHTLINER',
        'SISU AUTO',
        'KAMAZ',
        'DONGFENG',
        'BMC (TR)',
        'DAEWOO / TATA-DAEWOO',
        'VDL BUS + COACH',
        'VAN HOOL',
        'VAUXHALL-BEDFORD (LCV)',
      ].map(carMakeName),
    ).toEqual([
      'DAF',
      'VDL',
      'MAN',
      'Scania',
      'Iveco',
      'Iveco',
      'Volvo Trucks',
      'Renault Trucks',
      'Mercedes-Benz',
      'Tatra',
      'ERF',
      'Foden',
      'Freightliner',
      'Sisu',
      'KamAZ',
      'Dongfeng',
      'BMC',
      'Tata Daewoo',
      'VDL',
      'Van Hool',
      'Vauxhall',
    ]);
  });

  it('names no agricultural, construction or industrial machinery maker', () => {
    expect(
      [
        'NEW HOLLAND',
        'LIEBHERR',
        'KOMATSU',
        'JOHN DEERE',
        'DEUTZ-FAHR (SAME DEUTZ-FAHR)',
        'VOLVO CONSTRUCTION EQUIPMENT',
        'HYUNDAI CONSTRUCTION',
        'CASE CONSTRUCTION',
        'CUMMINS',
        'BECKER-KOMPRESSOREN',
      ].map(carMakeName),
    ).toEqual(Array(10).fill(null));
  });
});
