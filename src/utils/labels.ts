export const SERVICES: { slug: string; label: string }[] = [
  { slug: 'autopodbor', label: 'Автоподбор' },
  { slug: 'vykup',      label: 'Выкуп'      },
  { slug: 'proverka',   label: 'Проверка'   },
];

// Primary nav order: Автоподбор first, then the single-page Автосервис
// (Belgrade only, not per-country like the rest), then the remaining
// per-country SERVICES. Shared by Header (desktop + mobile) and Footer.
// slug is exposed so consumers (Header) can map an icon per service without
// this plain .ts file importing Astro icon components.
export const getNavItems = (countryCode: string): { href: string; label: string; slug: string }[] => [
  { href: `/${countryCode}/autopodbor/`, label: 'Автоподбор', slug: 'autopodbor' },
  { href: '/avtoservis-belgrade/', label: 'Автосервис', slug: 'autoservice' },
  ...SERVICES.filter(s => s.slug !== 'autopodbor').map(s => ({
    href: `/${countryCode}/${s.slug}/`,
    label: s.label,
    slug: s.slug,
  })),
];

// Country-scoped items (autopodbor/vykup/proverka) can sit under a city
// segment too (/de/berlin/autopodbor/), so match the slug anywhere after
// the leading country segment — but require that leading segment to
// actually be the country, otherwise unrelated routes that happen to
// contain the same word (e.g. /cases/autopodbor/) would false-match.
export function isNavItemActive(item: { href: string }, navCountry: string, pathname: string): boolean {
  const isCountryScoped = item.href.startsWith(`/${navCountry}/`);
  if (!isCountryScoped) return pathname.startsWith(item.href);
  const segments = pathname.split('/').filter(Boolean);
  const slug = item.href.replace(/^\/|\/$/g, '').split('/').pop();
  return segments[0] === navCountry && segments.includes(slug!);
}

// Keyed by form/Telegram service value
export const SERVICE_LABELS: Record<string, string> = {
  autopodbor: 'Автоподбор',
  buyout:     'Выкуп',
  inspection: 'Проверка',
  autoservice: 'Автосервис', // still used: LeadForm on /avtoservis-belgrade/ submits service="autoservice", telegram.ts looks it up
};

export const AUTOSERVICE_SERVICES = ['diagnostics', 'maintenance', 'suspension', 'engine', 'prepurchase'] as const;

export const AUTOSERVICE_LABELS: Record<(typeof AUTOSERVICE_SERVICES)[number], string> = {
  diagnostics: 'Компьютерная диагностика',
  maintenance: 'Техническое обслуживание',
  suspension: 'Подвеска и тормоза',
  engine: 'Двигатель и трансмиссия',
  prepurchase: 'Проверка перед покупкой',
};

export const STATUS_LABELS: Record<string, string> = {
  in_progress: '✅ В работу',
  closed:      '❌ Закрыт',
  spam:        '🚫 Спам',
};

// Maps Telegram callback_query action → lead status in DB
export const ACTION_TO_STATUS: Record<string, 'in_progress' | 'closed' | 'spam'> = {
  accept: 'in_progress',
  close:  'closed',
  spam:   'spam',
};
