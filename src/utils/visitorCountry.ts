// ponytail: timezone → country lookup, not IP geolocation — no network call,
// no third-party dependency, good enough to pick a sensible default (phone
// dial code, preferred contact channel) that the visitor can still change by
// hand. Covers our curated list only (PHONE_COUNTRIES in LeadForm.astro);
// falls back to nothing (caller decides the default) when the zone isn't
// one of these. Shared by LeadForm.astro's phone-country default and
// contactChannel.ts's region-based channel preference — one detector
// instead of the same IANA-zone table duplicated per consumer.
const TIMEZONE_COUNTRY: Record<string, string> = {
  'Europe/Belgrade': 'rs',
  'Europe/Berlin': 'de',
  'Europe/Madrid': 'es',
  'Europe/Moscow': 'ru',
  'Europe/Kyiv': 'ua',
  'Europe/Kiev': 'ua',
  'Europe/Minsk': 'by',
  'Asia/Almaty': 'kz',
  'Asia/Aqtobe': 'kz',
  'Asia/Qyzylorda': 'kz',
  'Europe/Sarajevo': 'ba',
  'Europe/Zagreb': 'hr',
  'Europe/Podgorica': 'me',
  'Europe/Skopje': 'mk',
  'Europe/Istanbul': 'tr',
};

export function detectVisitorCountry(): string | undefined {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONE_COUNTRY[tz];
  } catch {
    return undefined;
  }
}
