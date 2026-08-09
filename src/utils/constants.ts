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
  de: '🇩🇪', rs: '🇷🇸', es: '🇪🇸', ch: '🇨🇭',
  ru: '🇷🇺', en: '🇬🇧', sr: '🇷🇸',
  ua: '🇺🇦', by: '🇧🇾', kz: '🇰🇿', ba: '🇧🇦', hr: '🇭🇷', me: '🇲🇪', mk: '🇲🇰', tr: '🇹🇷',
};
