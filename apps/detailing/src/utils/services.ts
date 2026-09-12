export const SERVICE_SLUGS = [
  'zastitna-folija',
  'promena-boje',
  'poliranje-keramika',
  'restauracija-volana',
] as const;

export type ServiceSlug = (typeof SERVICE_SLUGS)[number];

export function isServiceSlug(value: string): value is ServiceSlug {
  return (SERVICE_SLUGS as readonly string[]).includes(value);
}
