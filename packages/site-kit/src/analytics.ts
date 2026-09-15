import {
  analyticsDeclined,
  CONSENT_EVENT,
  STORAGE_KEY,
  type ConsentDetail,
} from './consent.ts';

const YM_TAG_SRC = 'https://mc.yandex.ru/metrika/tag.js?id=';
const GA_TAG_SRC = 'https://www.googletagmanager.com/gtag/js?id=';

export interface AnalyticsConfig {
  ymCounterId?: number;
  gaMeasurementId?: string;
}

type YmQueue = ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
    ym?: (...args: unknown[]) => void;
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

function stubGtag(): void {
  window.dataLayer = window.dataLayer ?? [];
  // gtag.js tells its own commands apart from other dataLayer messages by
  // the Arguments object, so the vendor shape has to survive here.
  window.gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  };
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
  gaMeasurementId,
}: AnalyticsConfig): void {
  if (window.loadAnalytics) return;

  stubGtag();

  window.ymReachGoal = (goal, params) => {
    if (ymCounterId) window.ym?.(ymCounterId, 'reachGoal', goal, params);
  };

  let started = false;
  const start = (): void => {
    if (started) return;
    started = true;

    if (gaMeasurementId) {
      loadOnce(`${GA_TAG_SRC}${gaMeasurementId}`);
      window.gtag('js', new Date());
      window.gtag('config', gaMeasurementId);
    }

    if (ymCounterId) {
      stubYm();
      loadOnce(`${YM_TAG_SRC}${ymCounterId}`);
      window.ym?.(ymCounterId, 'init', {
        ssr: true,
        webvisor: true,
        clickmap: true,
        ecommerce: 'dataLayer',
        accurateTrackBounce: true,
        trackLinks: true,
      });
    }
  };
  window.loadAnalytics = start;
  pendingStart = start;
  listenForConsent();

  if (!refused()) start();
}
