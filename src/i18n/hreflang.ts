import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from './config';
import { SITE_URL } from '../utils/constants';

export function getAlternateLinks(pathname: string): { hreflang: string; href: string }[] {
  const segments = pathname.split('/').filter(Boolean);
  const rest = segments.slice(1).join('/');
  const suffix = rest ? `/${rest}/` : '/';

  const links = SUPPORTED_LOCALES.map(locale => ({
    hreflang: locale as string,
    href: `${SITE_URL}/${locale}${suffix}`,
  }));
  links.push({ hreflang: 'x-default', href: `${SITE_URL}/${DEFAULT_LOCALE}${suffix}` });
  return links;
}
