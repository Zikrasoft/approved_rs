import { cleanAdText } from '@podbor/lead-crm/ad-text';
import { STORAGE_KEY as CONSENT_KEY, analyticsDeclined } from './consent.ts';

export const AD_TOUCH_STORAGE_KEY = 'ad_touch';
export const AD_TOUCH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const PAID_MEDIUMS = ['paid', 'cpc', 'ppc', 'paid_social'];
const CLICK_IDS = [
  ['fbclid', 'facebook'],
  ['gclid', 'google'],
] as const;

export interface AdTouch {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  at: string;
  fbc?: string;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const browserStorage = (): StorageLike => localStorage;

export function paidTouch(href: string, at: Date): AdTouch | null {
  const params = new URL(href).searchParams;
  const param = (name: string): string | undefined =>
    cleanAdText(params.get(name));
  const clickSource = CLICK_IDS.find(([id]) => params.has(id))?.[1];
  const medium = param('utm_medium')?.toLowerCase();
  if (!clickSource && !PAID_MEDIUMS.some((paid) => paid === medium))
    return null;
  return {
    source: param('utm_source')?.toLowerCase() ?? clickSource,
    medium,
    campaign: param('utm_campaign'),
    content: param('utm_content'),
    at: at.toISOString(),
    fbc: params.has('fbclid')
      ? `fb.1.${at.getTime()}.${params.get('fbclid')}`
      : undefined,
  };
}

export function storedAdTouch(
  storage: () => StorageLike = browserStorage,
  now = new Date(),
): string {
  try {
    const store = storage();
    if (analyticsDeclined(store.getItem(CONSENT_KEY))) return '';
    const raw = store.getItem(AD_TOUCH_STORAGE_KEY);
    if (!raw) return '';
    const { at } = JSON.parse(raw) as { at?: unknown };
    return now.getTime() - Date.parse(String(at)) < AD_TOUCH_MAX_AGE_MS
      ? raw
      : '';
  } catch {
    return '';
  }
}

export function rememberAdTouch(
  href = location.href,
  storage: () => StorageLike = browserStorage,
  now = new Date(),
): void {
  if (storedAdTouch(storage, now)) return;
  const touch = paidTouch(href, now);
  if (!touch) return;
  try {
    const store = storage();
    if (!analyticsDeclined(store.getItem(CONSENT_KEY)))
      store.setItem(AD_TOUCH_STORAGE_KEY, JSON.stringify(touch));
  } catch {
    return;
  }
}

export function forgetAdTouch(storage: Pick<Storage, 'removeItem'>): void {
  try {
    storage.removeItem(AD_TOUCH_STORAGE_KEY);
  } catch {
    return;
  }
}

function cookie(cookies: string, name: string): string | undefined {
  for (const pair of cookies.split(';')) {
    const [key, ...value] = pair.trim().split('=');
    if (key === name) return value.join('=') || undefined;
  }
  return undefined;
}

export function storedMetaIds(
  cookies = document.cookie,
  storage: () => StorageLike = browserStorage,
  now = new Date(),
): string {
  try {
    if (analyticsDeclined(storage().getItem(CONSENT_KEY))) return '';
  } catch {
    return '';
  }
  const touch = storedAdTouch(storage, now);
  const fbc =
    cookie(cookies, '_fbc') ??
    (touch ? (JSON.parse(touch) as AdTouch).fbc : undefined);
  const fbp = cookie(cookies, '_fbp');
  return fbc || fbp ? JSON.stringify({ fbc, fbp }) : '';
}
