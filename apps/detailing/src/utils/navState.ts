import { isActiveNavPath } from '@podbor/site-kit';

const isSamePage = (a: string, b: string) =>
  isActiveNavPath(a, b) && isActiveNavPath(b, a);

export function navCurrent(
  pathname: string,
  href: string,
): 'page' | 'true' | undefined {
  if (!isActiveNavPath(pathname, href)) return undefined;
  return isSamePage(pathname, href) ? 'page' : 'true';
}
