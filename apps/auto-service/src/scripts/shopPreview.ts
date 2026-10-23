import {
  PREVIEW_COOKIE,
  PREVIEW_OFF,
  PREVIEW_ON,
  PREVIEW_PARAM,
  previewFrom,
} from '@/utils/shopPreview';

export const PRICES_FILLED_EVENT = 'carlab:prices-filled';

export function shopPreview(
  search = location.search,
  jar: { cookie: string } = document,
): boolean {
  const asked = new URLSearchParams(search).get(PREVIEW_PARAM);
  if (asked === PREVIEW_ON) {
    jar.cookie = `${PREVIEW_COOKIE}=${PREVIEW_ON}; path=/; max-age=31536000; samesite=lax`;
  }
  if (asked === PREVIEW_OFF)
    jar.cookie = `${PREVIEW_COOKIE}=; path=/; max-age=0`;
  return previewFrom(search, jar.cookie);
}
