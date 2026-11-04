export const STEERING_SIDES = ['left', 'right'] as const;

export type SteeringSide = (typeof STEERING_SIDES)[number];
