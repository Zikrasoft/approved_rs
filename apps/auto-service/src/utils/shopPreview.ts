export const PREVIEW_COOKIE = 'carlab_shop_preview';
export const PREVIEW_PARAM = 'dev';
export const PREVIEW_ON = '1';
export const PREVIEW_OFF = '0';

export function previewFrom(search: string, cookie: string | null): boolean {
  const asked = new URLSearchParams(search).get(PREVIEW_PARAM);
  if (asked === PREVIEW_ON || asked === PREVIEW_OFF)
    return asked === PREVIEW_ON;
  return (cookie ?? '')
    .split(/;\s*/)
    .includes(`${PREVIEW_COOKIE}=${PREVIEW_ON}`);
}

export const previewRequested = (request: Request): boolean =>
  previewFrom(new URL(request.url).search, request.headers.get('cookie'));
