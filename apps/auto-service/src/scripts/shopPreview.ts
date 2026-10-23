export const SHOP_PREVIEW_HEADER = 'x-shop-preview';
export const PRICES_FILLED_EVENT = 'carlab:prices-filled';

const COOKIE = 'carlab_shop_preview';
const PARAM = 'dev';
const ON = '1';
const COOKIE_ON = `${COOKIE}=${ON}`;

export function previewFrom(search: string, cookie: string | null): boolean {
  const asked = new URLSearchParams(search).get(PARAM);
  if (asked === ON || asked === '0') return asked === ON;
  return (cookie ?? '').split(/;\s*/).includes(COOKIE_ON);
}

export function shopPreview(
  search = location.search,
  jar: { cookie: string } = document,
): boolean {
  const asked = new URLSearchParams(search).get(PARAM);
  if (asked === ON) {
    jar.cookie = `${COOKIE_ON}; path=/; max-age=31536000; samesite=lax`;
  }
  if (asked === '0') jar.cookie = `${COOKIE}=; path=/; max-age=0`;
  return previewFrom(search, jar.cookie);
}

export const previewRequested = (request: Request): boolean =>
  previewFrom(new URL(request.url).search, request.headers.get('cookie'));
