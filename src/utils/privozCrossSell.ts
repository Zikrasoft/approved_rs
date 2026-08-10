export type PrivozSpoke = 'de' | 'eu' | 'china';

// Corridor-driven, not a blanket "also see privoz" everywhere — only these
// country/privoz-spoke pairs match a real corridor the business actually
// runs (EU/China→Serbia, Germany/EU→Spain/Portugal, China→Germany).
const PRIVOZ_CROSS_SELL: Record<string, PrivozSpoke[]> = {
  rs: ['eu', 'china'],
  es: ['de'],
  pt: ['de'],
  de: ['china'],
};

export function getPrivozCrossSellSpokes(countryCode: string): PrivozSpoke[] {
  return PRIVOZ_CROSS_SELL[countryCode] ?? [];
}
