import type { Locale } from '@/i18n/config';

// Single source for the Yandex.Metrika counter — referenced by BaseLayout's
// tag init, LeadFormModal's lead_modal_open goal, and the contact_click goal.
export const YM_COUNTER_ID = 111800377;

export const SITE_URL   = import.meta.env.SITE ?? 'https://approved.rs';
export const SITE_NAME  = 'Approved.rs';
export const SITE_BRAND = 'APPROVED';
export const SITE_TLD   = '.rs';
export const DEFAULT_COUNTRY = 'rs';

export const TG_MANAGER = import.meta.env.PUBLIC_TG_MANAGER!;
export const THREADS_CHANNEL = import.meta.env.PUBLIC_THREADS_CHANNEL!;
export const WHATSAPP_NUMBER = import.meta.env.PUBLIC_WHATSAPP_NUMBER!;
export const VIBER_NUMBER = import.meta.env.PUBLIC_VIBER_NUMBER!;
// Same physical number as WhatsApp/Viber today — aliased separately since a
// direct phone call is a distinct channel from those apps, and the two could
// diverge later (e.g. a dedicated landline).
export const PHONE_NUMBER = import.meta.env.PUBLIC_WHATSAPP_NUMBER!;

// Official brand colors — kept true regardless of theme/hover state so the
// icons stay instantly recognizable (that's the whole point of a brand
// mark), unlike the site's own UI chrome which follows light/dark tokens.
export const BRAND_COLORS = {
  telegram: '#26A5E4',
  whatsapp: '#25D366',
  viber: '#7360F2',
} as const;

// Single source of truth for flag emoji — keyed lowercase by whatever 2-letter
// code is in play (delivery country, locale, or phone-country ISO). `sr`
// (Serbian locale) and `rs` (Serbia country) are different keys that happen
// to share a flag — not an error, both are kept explicit.
// `ch` is an inline SVG, not the 🇨🇭 emoji: Switzerland's flag is the one
// non-rectangular national flag, and several emoji fonts (notably on
// Windows) fall back to a generic monochrome placeholder glyph for it while
// every rectangular flag here renders fine — an SVG renders identically on
// every platform. Consumers must render FLAGS/getCountryFlag output with
// `set:html`, not as plain text, to support this.
export const FLAGS: Record<string, string> = {
  de: '🇩🇪', rs: '🇷🇸', es: '🇪🇸',
  ch: '<svg viewBox="0 0 32 32" width="1em" height="1em" style="display:inline-block;vertical-align:-0.125em" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" fill="#D52B1E"/><rect x="13" y="6" width="6" height="20" fill="#fff"/><rect x="6" y="13" width="20" height="6" fill="#fff"/></svg>',
  pt: '🇵🇹',
  ru: '🇷🇺', en: '🇬🇧', sr: '🇷🇸',
  ua: '🇺🇦', by: '🇧🇾', kz: '🇰🇿', ba: '🇧🇦', hr: '🇭🇷', me: '🇲🇪', mk: '🇲🇰', tr: '🇹🇷',
  // Not real countries.json entries (no per-country page) — just the
  // vehicle-import hub cards' "Europe"/"China" groupings.
  eu: '🇪🇺', cn: '🇨🇳',
};

// China isn't in countries.json (no vehicle sourcing market there, no per-country
// name-case data needed) but vehicle-import sources cars from it — one shared name
// constant instead of the same inline locale map duplicated in every place
// that needs to mention it (schema areaServed on 2+ vehicle-import pages).
export const CHINA_NAME: Record<Locale, string> = { ru: 'Китай', en: 'China', sr: 'Kina', es: 'China', de: 'China' };
// Not in countries.json (see above) — used as the `country` value on
// vehicle-import cases sourced from China, so the china spoke page can filter
// for them the same way de/eu do.
export const CHINA_COUNTRY_CODE = 'cn';

// Explicit, not "every active country except rs/de" — countries.json's
// active list can grow for reasons that have nothing to do with where
// vehicle-import sources cars from (e.g. Portugal, added as a destination-only
// vehicle sourcing market). Deriving this by exclusion would silently claim new
// destination-only countries as EU sourcing markets too.
export const VEHICLE_IMPORT_EU_SOURCE_CODES = ['es', 'ch'] as const;
