import type { VinFacts } from '@podbor/catalog-contract';
import { STEERING_SIDES } from '@podbor/catalog-contract/steering';
import { VIN_PATTERN } from '@podbor/catalog-contract/vin';

const STEERING_PARAM = 'steering';
const VIN_PARAM = 'vin';

export const steeringSide = (value: string | null | undefined) =>
  STEERING_SIDES.find((side) => side === value) ?? null;

export const carFactsQuery = ({ steering }: VinFacts, vin = ''): string => {
  const query = new URLSearchParams({
    ...(steering && { [STEERING_PARAM]: steering }),
    ...(vin && { [VIN_PARAM]: vin }),
  });
  return query.size ? `?${query}` : '';
};

export const vinFrom = (search: string): string => {
  const vin = new URLSearchParams(search).get(VIN_PARAM) ?? '';
  return VIN_PATTERN.test(vin) ? vin : '';
};

export const vinFactsFrom = (search: string): VinFacts => {
  const steering = steeringSide(
    new URLSearchParams(search).get(STEERING_PARAM),
  );
  return steering ? { steering } : {};
};
