import type { Locale } from '@/i18n/config';

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
export const FLAGS: Record<string, string> = {
  de: '🇩🇪', rs: '🇷🇸', es: '🇪🇸', ch: '🇨🇭', pt: '🇵🇹',
  ru: '🇷🇺', en: '🇬🇧', sr: '🇷🇸',
  ua: '🇺🇦', by: '🇧🇾', kz: '🇰🇿', ba: '🇧🇦', hr: '🇭🇷', me: '🇲🇪', mk: '🇲🇰', tr: '🇹🇷',
};

// China isn't in countries.json (no vehicle sourcing market there, no per-country
// name-case data needed) but vehicle-import sources cars from it — one shared name
// constant instead of the same inline locale map duplicated in every place
// that needs to mention it (schema areaServed on 2+ vehicle-import pages).
export const CHINA_NAME: Record<Locale, string> = { ru: 'Китай', en: 'China', sr: 'Kina' };
// Not in countries.json (see above) — used as the `country` value on
// vehicle-import cases sourced from China, so the china spoke page can filter
// for them the same way de/eu do.
export const CHINA_COUNTRY_CODE = 'cn';

// Explicit, not "every active country except rs/de" — countries.json's
// active list can grow for reasons that have nothing to do with where
// vehicle-import sources cars from (e.g. Portugal, added as a destination-only
// vehicle sourcing market). Deriving this by exclusion would silently claim new
// destination-only countries as EU sourcing markets too.
export const PRIVOZ_EU_SOURCE_CODES = ['es', 'ch'] as const;
