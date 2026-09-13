import { isActiveNavPath } from '@podbor/site-kit';

const trimmed = (path: string) =>
  path.replace(/[?#].*$/, '').replace(/\/+$/, '');

export function navCurrent(
  pathname: string,
  href: string,
): 'page' | 'true' | undefined {
  if (!isActiveNavPath(pathname, href)) return undefined;
  return trimmed(pathname) === trimmed(href) ? 'page' : 'true';
}
