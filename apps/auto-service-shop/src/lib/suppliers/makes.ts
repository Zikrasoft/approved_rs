import { nameKey } from '../../modules/_shared/keys';

export const CAR_MAKES: Record<string, string[]> = {
  'Alfa Romeo': [],
  Alpina: ['BMW ALPINA B. BOVENSIEPEN'],
  'Aston Martin': [],
  Audi: [],
  Bentley: [],
  BMW: [],
  BMC: [],
  BYD: [],
  Cadillac: [],
  Chevrolet: ['CHEVROLET EUROPE / DAEWOO'],
  Chrysler: [],
  Citroën: ['CITROEN'],
  Cupra: [],
  Dacia: [],
  Daewoo: [],
  DAF: ['DAF TRUCKS'],
  Daihatsu: [],
  Dodge: [],
  Dongfeng: [],
  DS: ['DS AUTOMOBILES'],
  ERF: [],
  Ferrari: [],
  Fiat: [],
  Foden: [],
  Ford: ['FORD USA'],
  Freightliner: [],
  Genesis: [],
  Honda: [],
  Hyundai: [],
  Infiniti: [],
  Isuzu: [],
  Iveco: ['IVECO BUS', 'IRISBUS'],
  Jaguar: [],
  Jeep: [],
  KamAZ: [],
  Kia: ['KIA MOTORS'],
  Lada: [],
  Lamborghini: ['LAMBORGHINI AUTOMOBILI'],
  Lancia: [],
  'Land Rover': [],
  LDV: ['LDV LIMITED', 'LDV (Leyland-Daf Vans)'],
  Lexus: [],
  Lotus: [],
  'Lynk & Co': [],
  MAN: [],
  Maserati: [],
  Maxus: [],
  Mazda: [],
  McLaren: [],
  'Mercedes-Benz': ['MERCEDES-BENZ TRUCKS'],
  MG: [],
  MINI: [],
  Mitsubishi: [],
  Nissan: [],
  Opel: [],
  Peugeot: [],
  Polestar: [],
  Porsche: [],
  Ram: [],
  Renault: [],
  'Renault Trucks': [],
  'Rolls-Royce': [],
  Rover: [],
  Saab: [],
  Scania: [],
  SEAT: [],
  Sisu: ['SISU AUTO'],
  Škoda: ['SKODA'],
  Smart: [],
  SsangYong: ['KGM'],
  Subaru: [],
  Suzuki: [],
  'Tata Daewoo': ['DAEWOO / TATA-DAEWOO'],
  Tatra: [],
  Tesla: [],
  Toyota: [],
  'Van Hool': [],
  Vauxhall: ['VAUXHALL-BEDFORD'],
  VDL: ['VDL BUS + COACH', 'DAF BUS'],
  Volkswagen: ['VW', 'VW (VOLKSWAGEN)', 'Volkswagen (VW)'],
  Volvo: ['VOLVO CARS'],
  'Volvo Trucks': [],
  Zastava: [],
};

export const MAKE_ALIASES: Record<string, string> = Object.fromEntries(
  Object.entries(CAR_MAKES).flatMap(([name, spellings]) =>
    spellings.map((spelling) => [spelling, name]),
  ),
);

const withoutOwner = (spelling: string) =>
  spelling
    .replace(/\([^)]*\)/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

const CAR_MAKE_NAMES = new Map(
  [
    ...Object.keys(CAR_MAKES).map((name) => [name, name]),
    ...Object.entries(MAKE_ALIASES),
  ].map(([spelling, name]) => [nameKey(spelling), name]),
);

export const carMakeName = (spelling: string): string | null =>
  CAR_MAKE_NAMES.get(nameKey(spelling)) ??
  CAR_MAKE_NAMES.get(nameKey(withoutOwner(spelling))) ??
  null;
