export const SERVICE_SLUGS = [
  'paint-protection-film',
  'colour-change-wrap',
  'polishing-ceramic',
  'steering-wheel-restoration',
] as const;

export type ServiceSlug = (typeof SERVICE_SLUGS)[number];

export function isServiceSlug(value: string): value is ServiceSlug {
  return (SERVICE_SLUGS as readonly string[]).includes(value);
}
