import { GOALS, type Goal } from './goals.ts';
import {
  analyticsDeclined,
  CONSENT_EVENT,
  STORAGE_KEY,
  type ConsentDetail,
} from './consent.ts';

const META_PIXEL_SRC = 'https://connect.facebook.net/en_US/fbevents.js';
const GOOGLE_TAG_SRC = 'https://www.googletagmanager.com/gtag/js?id=';

const META_EVENTS: Readonly<Record<string, string>> = {
  [GOALS.formSubmit]: 'Lead',
  [GOALS.contactClick]: 'Contact',
  [GOALS.addToCart]: 'AddToCart',
  [GOALS.beginCheckout]: 'InitiateCheckout',
  [GOALS.purchase]: 'Purchase',
};

export interface AnalyticsConfig {
  metaPixelId?: string;
  googleAdsId?: string;
  gaMeasurementId?: string;
  googleConversionLabels?: Partial<Record<Goal, string>>;
}

type FbqQueue = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: FbqQueue;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    trackGoal?: (goal: string, params?: Record<string, unknown>) => void;
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
  window.gtag = function gtag() {
    dataLayer.push(arguments);
  };
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
  const { value, currency } = params ?? {};
  if (typeof value === 'number' && typeof currency === 'string')
    window.fbq?.('track', event, {
      value,
      currency: currency.toUpperCase(),
    });
  else window.fbq?.('track', event);
}

function startGoogleTag(googleAdsId?: string, gaMeasurementId?: string): void {
  const id = googleAdsId ?? gaMeasurementId;
  if (!id) return;
  stubGtag();
  window.gtag?.('js', new Date());
  if (googleAdsId) window.gtag?.('config', googleAdsId);
  if (gaMeasurementId) window.gtag?.('config', gaMeasurementId);
  whenIdle(() => loadOnce(`${GOOGLE_TAG_SRC}${id}`));
}

function trackGa4Goal(goal: string, params?: Record<string, unknown>): void {
  window.gtag?.('event', goal, params);
}

function trackGoogleAdsGoal(
  googleAdsId: string,
  labels: Partial<Record<Goal, string>>,
  goal: string,
  params?: Record<string, unknown>,
): void {
  const label = labels[goal as Goal];
  if (!label) return;
  const { value, currency } = params ?? {};
  const event: Record<string, unknown> = { send_to: `${googleAdsId}/${label}` };
  if (typeof value === 'number' && typeof currency === 'string') {
    event.value = value;
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
  metaPixelId,
  googleAdsId,
  gaMeasurementId,
  googleConversionLabels,
}: AnalyticsConfig): void {
  if (window.loadAnalytics) return;

  window.trackGoal = (goal, params) => {
    if (metaPixelId) trackMetaGoal(goal, params);
    if (gaMeasurementId) trackGa4Goal(goal, params);
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
    if (metaPixelId) startMetaPixel(metaPixelId);
    startGoogleTag(googleAdsId, gaMeasurementId);
  };
  window.loadAnalytics = start;
  pendingStart = start;
  listenForConsent();

  if (!refused()) start();
}
