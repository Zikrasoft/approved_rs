import { SITE_URL } from '@/utils/constants';
import { localeSet } from './config';

export function getAlternateLinks(
  pathname: string,
): { hreflang: string; href: string }[] {
  return localeSet.getAlternateLinks(SITE_URL, pathname);
}
