import { GOALS } from './goals.ts';
import {
  analyticsDeclined,
  CONSENT_EVENT,
  STORAGE_KEY,
  type ConsentDetail,
} from './consent.ts';

const YM_TAG_SRC = 'https://mc.yandex.ru/metrika/tag.js?id=';
const META_PIXEL_SRC = 'https://connect.facebook.net/en_US/fbevents.js';
const GOOGLE_ADS_SRC = 'https://www.googletagmanager.com/gtag/js?id=';

const META_EVENTS: Readonly<Record<string, string>> = {
  [GOALS.formSubmit]: 'Lead',
  [GOALS.contactClick]: 'Contact',
  [GOALS.addToCart]: 'AddToCart',
  [GOALS.beginCheckout]: 'InitiateCheckout',
  [GOALS.orderPlaced]: 'Purchase',
};

export interface AnalyticsConfig {
  ymCounterId?: number;
  metaPixelId?: string;
  googleAdsId?: string;
  googleConversionLabels?: Partial<Record<string, string>>;
}

type YmQueue = ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };
type FbqQueue = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: FbqQueue;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    ym?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    _fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    ymReachGoal?: (goal: string, params?: Record<string, unknown>) => void;
    loadAnalytics?: () => void;
  }
}

function loadOnce(src: string): void {
  for (const script of document.scripts) if (script.src === src) return;
  const element = document.createElement('script');
  element.async = true;
  element.src = src;
  document.head.appendChild(element);
}

function whenIdle(run: () => void): void {
  const schedule = (): void => {
    if (typeof requestIdleCallback === 'function')
      requestIdleCallback(run, { timeout: 4000 });
    else setTimeout(run, 1200);
  };
  if (document.readyState === 'complete') schedule();
  else addEventListener('load', schedule, { once: true });
}

function stubYm(): void {
  if (window.ym) return;
  const queue: unknown[][] = [];
  const ym: YmQueue = (...args) => {
    queue.push(args);
  };
  ym.a = queue;
  ym.l = Date.now();
  window.ym = ym;
}

function stubFbq(): void {
  if (window.fbq) return;
  const fbq = ((...args: unknown[]) => {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  }) as FbqQueue;
  fbq.queue = [];
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  window.fbq = fbq;
  window._fbq = fbq;
}

function stubGtag(): void {
  if (window.gtag) return;
  const dataLayer = (window.dataLayer ??= []);
  window.gtag = (...args: unknown[]) => {
    dataLayer.push(args);
  };
}

function startYm(ymCounterId: number): void {
  stubYm();
  window.ym?.(ymCounterId, 'init', {
    ssr: true,
    webvisor: true,
    clickmap: true,
    accurateTrackBounce: true,
    trackLinks: true,
  });
  whenIdle(() => loadOnce(`${YM_TAG_SRC}${ymCounterId}`));
}

function startMetaPixel(metaPixelId: string): void {
  stubFbq();
  window.fbq?.('init', metaPixelId);
  window.fbq?.('track', 'PageView');
  whenIdle(() => loadOnce(META_PIXEL_SRC));
}

function trackMetaGoal(goal: string, params?: Record<string, unknown>): void {
  const event = META_EVENTS[goal];
  if (!event) return;
  const { total, currency } = params ?? {};
  if (typeof total === 'number' && typeof currency === 'string')
    window.fbq?.('track', event, {
      value: total,
      currency: currency.toUpperCase(),
    });
  else window.fbq?.('track', event);
}

function startGoogleAds(googleAdsId: string): void {
  stubGtag();
  window.gtag?.('js', new Date());
  window.gtag?.('config', googleAdsId);
  whenIdle(() => loadOnce(`${GOOGLE_ADS_SRC}${googleAdsId}`));
}

function trackGoogleAdsGoal(
  googleAdsId: string,
  labels: Partial<Record<string, string>>,
  goal: string,
  params?: Record<string, unknown>,
): void {
  const label = labels[goal];
  if (!label) return;
  const { total, currency } = params ?? {};
  const event: Record<string, unknown> = { send_to: `${googleAdsId}/${label}` };
  if (typeof total === 'number' && typeof currency === 'string') {
    event.value = total;
    event.currency = currency.toUpperCase();
  }
  window.gtag?.('event', 'conversion', event);
}

let pendingStart: (() => void) | undefined;
let listening = false;

function listenForConsent(): void {
  if (listening) return;
  listening = true;
  document.addEventListener(CONSENT_EVENT, (event) => {
    if ((event as CustomEvent<ConsentDetail>).detail.analytics)
      pendingStart?.();
  });
}

function refused(): boolean {
  try {
    return analyticsDeclined(localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

export function defineAnalytics({
  ymCounterId,
  metaPixelId,
  googleAdsId,
  googleConversionLabels,
}: AnalyticsConfig): void {
  if (window.loadAnalytics) return;

  window.ymReachGoal = (goal, params) => {
    if (ymCounterId) window.ym?.(ymCounterId, 'reachGoal', goal, params);
    if (metaPixelId) trackMetaGoal(goal, params);
    if (googleAdsId)
      trackGoogleAdsGoal(
        googleAdsId,
        googleConversionLabels ?? {},
        goal,
        params,
      );
  };

  let started = false;
  const start = (): void => {
    if (started) return;
    started = true;
    if (ymCounterId) startYm(ymCounterId);
    if (metaPixelId) startMetaPixel(metaPixelId);
    if (googleAdsId) startGoogleAds(googleAdsId);
  };
  window.loadAnalytics = start;
  pendingStart = start;
  listenForConsent();

  if (!refused()) start();
}
