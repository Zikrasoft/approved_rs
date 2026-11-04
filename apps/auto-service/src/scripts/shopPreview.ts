import { PREVIEW_FLAG_COOKIE } from '@/utils/shopPreview';

export const PRICES_FILLED_EVENT = 'carlab:prices-filled';

export const shopPreview = (jar: { cookie: string } = document): boolean =>
  jar.cookie.split(/;\s*/).includes(`${PREVIEW_FLAG_COOKIE}=1`);
