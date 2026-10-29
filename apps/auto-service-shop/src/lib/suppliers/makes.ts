import { spellingKey } from './spelling';

export const CAR_MAKES: Record<string, string[]> = {
  'Alfa Romeo': [],
  Alpina: ['BMW ALPINA B. BOVENSIEPEN'],
  'Aston Martin': [],
  Audi: [],
  Bentley: [],
  BMW: [],
  BYD: [],
  Cadillac: [],
  Chevrolet: ['CHEVROLET EUROPE / DAEWOO'],
  Chrysler: [],
  Citroën: ['CITROEN'],
  Cupra: [],
  Dacia: [],
  Daewoo: [],
  Daihatsu: [],
  Dodge: [],
  DS: ['DS AUTOMOBILES'],
  Ferrari: [],
  Fiat: [],
  Ford: ['FORD USA'],
  Genesis: [],
  Honda: [],
  Hyundai: [],
  Infiniti: [],
  Isuzu: [],
  Iveco: [],
  Jaguar: [],
  Jeep: [],
  Kia: ['KIA MOTORS'],
  Lada: [],
  Lamborghini: ['LAMBORGHINI AUTOMOBILI'],
  Lancia: [],
  'Land Rover': [],
  LDV: ['LDV LIMITED', 'LDV (Leyland-Daf Vans)'],
  Lexus: [],
  Lotus: [],
  'Lynk & Co': [],
  Maserati: [],
  Maxus: [],
  Mazda: [],
  McLaren: [],
  'Mercedes-Benz': [],
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
  'Rolls-Royce': [],
  Rover: [],
  Saab: [],
  SEAT: [],
  Škoda: ['SKODA'],
  Smart: [],
  SsangYong: ['KGM'],
  Subaru: [],
  Suzuki: [],
  Tesla: [],
  Toyota: [],
  Vauxhall: [],
  Volkswagen: ['VW', 'VW (VOLKSWAGEN)', 'Volkswagen (VW)'],
  Volvo: ['VOLVO CARS'],
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
  ].map(([spelling, name]) => [spellingKey(spelling), name]),
);

export const carMakeName = (spelling: string): string | null =>
  CAR_MAKE_NAMES.get(spellingKey(spelling)) ??
  CAR_MAKE_NAMES.get(spellingKey(withoutOwner(spelling))) ??
  null;
