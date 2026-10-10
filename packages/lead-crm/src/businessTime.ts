export const BUSINESS_TIME_ZONE = 'Europe/Belgrade';

const DAY_MS = 24 * 60 * 60 * 1000;
const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
});

export function businessDay(at: Date, plusDays = 0): string {
  const midnight = Date.parse(`${dayFormat.format(at)}T00:00:00Z`);
  return new Date(midnight + plusDays * DAY_MS).toISOString().slice(0, 10);
}
