export const SITE_URL   = import.meta.env.SITE ?? 'https://approved.rs';
export const SITE_NAME  = 'Approved.rs';
export const SITE_BRAND = 'APPROVED';
export const SITE_TLD   = '.rs';
export const DEFAULT_COUNTRY = 'rs';

// Delivery from DE/CH isn't limited to this list (client confirmed "any country,
// deal with it as requests come in") — named explicitly for SEO (a named country
// ranks for its own search phrase; "any country" alone doesn't) plus a catch-all
// phrase in the copy that uses this list. Kept in sync with the client's own
// curated market list (see PHONE_COUNTRIES in LeadForm.astro), minus Montenegro
// (only relevant to Выкуп, not a delivery destination).
export const DELIVERY_DESTINATIONS_ACCUSATIVE = [
  'Россию', 'Казахстан', 'Кыргызстан', 'Украину', 'Беларусь',
  'Боснию и Герцеговину', 'Хорватию', 'Северную Македонию', 'Турцию',
];

// Single source of truth for flag emoji — keyed lowercase by whatever 2-letter
// code is in play (delivery country, locale, or phone-country ISO). `sr`
// (Serbian locale) and `rs` (Serbia country) are different keys that happen
// to share a flag — not an error, both are kept explicit.
export const FLAGS: Record<string, string> = {
  de: '🇩🇪', rs: '🇷🇸', es: '🇪🇸', ch: '🇨🇭',
  ru: '🇷🇺', en: '🇬🇧', sr: '🇷🇸',
  ua: '🇺🇦', by: '🇧🇾', kz: '🇰🇿', ba: '🇧🇦', hr: '🇭🇷', me: '🇲🇪', mk: '🇲🇰', tr: '🇹🇷',
};
