import { getI18n } from '../i18n/getI18n';
import type { Locale } from '../i18n/config';

export const SERVICES: { slug: 'autopodbor' | 'vykup' | 'proverka' }[] = [
  { slug: 'autopodbor' },
  { slug: 'vykup' },
  { slug: 'proverka' },
];

// Primary nav order: Автоподбор first, then the single-page Автосервис
// (Belgrade only, not per-country like the rest), then the remaining
// per-country SERVICES. Shared by Header (desktop + mobile) and Footer.
export const getNavItems = (
  locale: Locale,
  countryCode: string
): { href: string; label: string; slug: string }[] => {
  const nav = getI18n(locale).nav;
  return [
    { href: `/${locale}/${countryCode}/autopodbor/`, label: nav.autopodbor, slug: 'autopodbor' },
    { href: `/${locale}/avtoservis-belgrade/`, label: nav.autoservice, slug: 'autoservice' },
    ...SERVICES.filter(s => s.slug !== 'autopodbor').map(s => ({
      href: `/${locale}/${countryCode}/${s.slug}/`,
      label: nav[s.slug],
      slug: s.slug,
    })),
  ];
};

// Country-scoped items (autopodbor/vykup/proverka) can sit under a city
// segment too (/ru/de/berlin/autopodbor/), so match the slug anywhere after
// the leading locale+country segments — but require those leading segments
// to actually be locale+country, otherwise unrelated routes that happen to
// contain the same word (e.g. /ru/cases/autopodbor/) would false-match.
export function isNavItemActive(
  item: { href: string },
  locale: Locale,
  navCountry: string,
  pathname: string
): boolean {
  const isCountryScoped = item.href.startsWith(`/${locale}/${navCountry}/`);
  if (!isCountryScoped) return pathname.startsWith(item.href);
  const segments = pathname.split('/').filter(Boolean);
  const slug = item.href.replace(/^\/|\/$/g, '').split('/').pop();
  return segments[0] === locale && segments[1] === navCountry && segments.includes(slug!);
}

// Keyed by form/Telegram service value — internal/ops-facing (Telegram bot
// messages), not part of the public site's i18n scope.
export const SERVICE_LABELS: Record<string, string> = {
  autopodbor: 'Автоподбор',
  buyout:     'Выкуп',
  inspection: 'Проверка',
  autoservice: 'Автосервис',
};

export const AUTOSERVICE_SERVICES = ['diagnostics', 'maintenance', 'suspension', 'engine', 'prepurchase'] as const;

export const STATUS_LABELS: Record<string, string> = {
  in_progress: '✅ В работу',
  closed:      '❌ Закрыт',
  spam:        '🚫 Спам',
};

export const ACTION_TO_STATUS: Record<string, 'in_progress' | 'closed' | 'spam'> = {
  accept: 'in_progress',
  close:  'closed',
  spam:   'spam',
};
