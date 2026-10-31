import { previewTokenFrom } from '@/utils/shopPreview';

export const PRICES_FILLED_EVENT = 'carlab:prices-filled';

export const shopPreview = (jar: { cookie: string } = document): boolean =>
  previewTokenFrom(jar.cookie) !== '';
