export const STEERING_SIDES = ['left', 'right'] as const;

export type SteeringSide = (typeof STEERING_SIDES)[number];

export const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;
