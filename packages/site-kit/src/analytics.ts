import {
  analyticsDeclined,
  CONSENT_EVENT,
  STORAGE_KEY,
  type ConsentDetail,
} from './consent.ts';

const YM_TAG_SRC = 'https://mc.yandex.ru/metrika/tag.js?id=';

export interface AnalyticsConfig {
  ymCounterId?: number;
}

type YmQueue = ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };

declare global {
  interface Window {
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

export function defineAnalytics({ ymCounterId }: AnalyticsConfig): void {
  if (window.loadAnalytics) return;

  window.ymReachGoal = (goal, params) => {
    if (ymCounterId) window.ym?.(ymCounterId, 'reachGoal', goal, params);
  };

  let started = false;
  const start = (): void => {
    if (started || !ymCounterId) return;
    started = true;

    stubYm();
    window.ym?.(ymCounterId, 'init', {
      ssr: true,
      webvisor: true,
      clickmap: true,
      accurateTrackBounce: true,
      trackLinks: true,
    });
    whenIdle(() => loadOnce(`${YM_TAG_SRC}${ymCounterId}`));
  };
  window.loadAnalytics = start;
  pendingStart = start;
  listenForConsent();

  if (!refused()) start();
}
