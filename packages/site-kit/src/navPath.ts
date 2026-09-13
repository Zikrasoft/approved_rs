function normalise(path: string): string {
  const bare = path.replace(/[?#].*$/, '');
  return bare.endsWith('/') ? bare : `${bare}/`;
}

export function swapLocalePath(pathname: string, locale: string): string {
  const rest = pathname.split('/').filter(Boolean).slice(1).join('/');
  return rest ? `/${locale}/${rest}/` : `/${locale}/`;
}

export function isActiveNavPath(current: string, target: string): boolean {
  if (target.includes('#')) return false;

  const here = normalise(current);
  const there = normalise(target);
  if (here === there) return true;

  const depth = there.split('/').filter(Boolean).length;
  return depth > 1 && here.startsWith(there);
}
