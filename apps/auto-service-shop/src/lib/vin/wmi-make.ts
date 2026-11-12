import type { VinDecoder } from './decoder';

const BY_WMI: Record<string, string[]> = {
  ford: [
    'WF0',
    'WF1',
    'SFA',
    'VS6',
    'NM0',
    '6FP',
    '1FA',
    '1FB',
    '1FC',
    '1FD',
    '1FM',
    '1FT',
    '3FA',
    '3FM',
    '3FT',
  ],
  opel: ['W0L', 'W0V'],
  renault: ['VF1', '93Y'],
  dacia: ['UU1'],
  peugeot: ['VF3', 'VR3'],
  citroen: ['VF7', 'VR7'],
  fiat: ['ZFA', '9BD'],
  'alfa-romeo': ['ZAR'],
  lancia: ['ZLA'],
  maserati: ['ZAM'],
  ferrari: ['ZFF'],
  lamborghini: ['ZHW'],
  bentley: ['SCB'],
  'rolls-royce': ['SCA'],
  'aston-martin': ['SCF'],
  toyota: [
    'JTD',
    'JTE',
    'JTK',
    'JTM',
    'JTN',
    'JT2',
    'JT3',
    'JT4',
    'SB1',
    'VNK',
    'NMT',
    'MR0',
    '2T1',
    '4T1',
    '5TD',
    '5TF',
  ],
  lexus: ['JTH', 'JTJ', '2T2'],
  nissan: [
    'JN1',
    'JN6',
    'JN8',
    'SJN',
    'VSK',
    'MNT',
    '1N4',
    '1N6',
    '3N1',
    '5N1',
  ],
  hyundai: ['TMA', 'NLH', '5NP', '5NM'],
  kia: ['U5Y', '5XY', '3KP'],
  skoda: ['TMB'],
  seat: ['VSS'],
  volvo: ['LVY'],
  mazda: ['JM1', 'JM3', 'JMZ', '3MZ', '1YV'],
  honda: ['SHH', 'SHS', '1HG', '2HG', '5J6'],
  suzuki: ['TSM', 'MA3'],
  mitsubishi: ['JMB', 'JA3', 'JA4', 'MMB', 'MMC', '4A3'],
  subaru: ['4S3', '4S4'],
  chevrolet: ['1G1', '1GC', '1GN', '2G1', '3G1', 'KL1'],
  'land-rover': ['SAL'],
  jaguar: ['SAJ'],
  porsche: ['WP0', 'WP1'],
  mini: ['WMW'],
  smart: ['WME'],
  tesla: ['5YJ', '7SA', 'LRW', 'XP7'],
  zastava: ['VX1'],
  lada: ['XTA'],
  ssangyong: ['KPT'],
};

const BY_COUNTRY_MAKER_PREFIX: Record<string, string[]> = {
  ford: ['WF'],
  kia: ['KN'],
  hyundai: ['KM'],
  suzuki: ['JS'],
  subaru: ['JF'],
  honda: ['JH'],
  volvo: ['YV'],
  porsche: ['WP'],
};

const indexed = (groups: Record<string, string[]>) =>
  new Map(
    Object.entries(groups).flatMap(([make, prefixes]) =>
      prefixes.map((prefix) => [prefix, make] as const),
    ),
  );

const WMIS = indexed(BY_WMI);
const PREFIXES = indexed(BY_COUNTRY_MAKER_PREFIX);

export const makeOfWmi = (vin: string): string | null =>
  WMIS.get(vin.slice(0, 3)) ?? PREFIXES.get(vin.slice(0, 2)) ?? null;

export const wmiMakeDecoder: VinDecoder = {
  name: 'wmi-make',
  version: 1,
  async decode(vin) {
    const make = makeOfWmi(vin);
    return make
      ? { make, identifiers: [], facts: {}, raw: { wmi: vin.slice(0, 3) } }
      : null;
  },
};
