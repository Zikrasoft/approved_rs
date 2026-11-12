import { type AttributeValues } from '@podbor/catalog-contract';

const BATTERY_NAME_PARTS: [key: string, suffix: string][] = [
  ['voltage', ' В'],
  ['capacity', ' А·ч'],
  ['cold-cranking', ' А'],
];

export const isBattery = (fields: { key: string }[]) =>
  fields.some(({ key }) => key === 'cold-cranking');

export function batteryName(
  attributes: AttributeValues,
  brand: string,
  number: string,
) {
  const specs = BATTERY_NAME_PARTS.flatMap(([key, suffix]) => {
    const value = attributes[key];
    return typeof value === 'number' ? [`${value}${suffix}`] : [];
  });
  return ['Аккумулятор', ...specs, brand, number].join(' ');
}
