import type { SteeringSide, VinFacts } from '@podbor/catalog-contract';

const STEERING_PARAM = 'steering';
const STEERING_SIDES: SteeringSide[] = ['left', 'right'];

export const steeringSide = (value: string | null | undefined) =>
  STEERING_SIDES.find((side) => side === value) ?? null;

export const carFactsQuery = ({ steering }: VinFacts): string =>
  steering ? `?${new URLSearchParams({ [STEERING_PARAM]: steering })}` : '';

export const vinFactsFrom = (search: string): VinFacts => {
  const steering = steeringSide(
    new URLSearchParams(search).get(STEERING_PARAM),
  );
  return steering ? { steering } : {};
};
