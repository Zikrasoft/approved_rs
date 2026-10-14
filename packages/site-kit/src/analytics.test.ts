// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { defineAnalytics } from './analytics.ts';
import { CONSENT_EVENT, newConsent, STORAGE_KEY } from './consent.ts';

const GA = 'G-TEST12345';

const srcs = () => [...document.scripts].map((script) => script.src);
const refuse = () =>
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(newConsent(false, '2026-09-12', new Date())),
  );

let idleTasks: (() => void)[] = [];
const runIdle = () => {
  const queued = idleTasks;
  idleTasks = [];
  queued.forEach((task) => task());
};

beforeEach(() => {
  document.head.innerHTML = '';
  localStorage.clear();
  idleTasks = [];
  vi.stubGlobal('requestIdleCallback', (task: () => void) => {
    idleTasks.push(task);
  });
  delete (window as Partial<Window>).loadAnalytics;
  delete (window as Partial<Window>).trackGoal;
  delete (window as Partial<Window>).fbq;
  delete (window as Partial<Window>)._fbq;
  delete (window as Partial<Window>).gtag;
  delete (window as Partial<Window>).dataLayer;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const GTAG_SRC = (id: string) =>
  `https://www.googletagmanager.com/gtag/js?id=${id}`;
const dataLayer = () => window.dataLayer as unknown[][];

describe('defineAnalytics with GA4', () => {
  it('loads the tag on the first page view when nothing was refused', () => {
    defineAnalytics({ gaMeasurementId: GA });
    runIdle();
    expect(srcs()).toEqual([GTAG_SRC(GA)]);
  });

  it('keeps the tag out of the critical path until the browser goes idle', () => {
    defineAnalytics({ gaMeasurementId: GA });
    expect(srcs()).toEqual([]);
    runIdle();
    expect(srcs()).toEqual([GTAG_SRC(GA)]);
  });

  it('queues config before the script downloads, so nothing is lost', () => {
    defineAnalytics({ gaMeasurementId: GA });
    expect(
      dataLayer().some((call) => call[0] === 'config' && call[1] === GA),
    ).toBe(true);
    runIdle();
    expect(srcs()).toEqual([GTAG_SRC(GA)]);
  });

  it('falls back to a timer where requestIdleCallback is missing', () => {
    vi.stubGlobal('requestIdleCallback', undefined);
    vi.useFakeTimers();
    defineAnalytics({ gaMeasurementId: GA });
    expect(srcs()).toEqual([]);
    vi.runAllTimers();
    expect(srcs()).toEqual([GTAG_SRC(GA)]);
    vi.useRealTimers();
  });

  it('waits for load before scheduling when the page is still parsing', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    defineAnalytics({ gaMeasurementId: GA });
    runIdle();
    expect(srcs()).toEqual([]);
    dispatchEvent(new Event('load'));
    runIdle();
    expect(srcs()).toEqual([GTAG_SRC(GA)]);
  });

  it('holds the tag back when the visitor refused analytics', () => {
    refuse();
    defineAnalytics({ gaMeasurementId: GA });
    runIdle();
    expect(srcs()).toEqual([]);
  });

  it('starts once a later acceptance answers the banner', () => {
    refuse();
    defineAnalytics({ gaMeasurementId: GA });
    document.dispatchEvent(
      new CustomEvent(CONSENT_EVENT, { detail: { analytics: true } }),
    );
    runIdle();
    expect(srcs()).toEqual([GTAG_SRC(GA)]);
  });

  it('stays held back when the banner answer is another refusal', () => {
    refuse();
    defineAnalytics({ gaMeasurementId: GA });
    document.dispatchEvent(
      new CustomEvent(CONSENT_EVENT, { detail: { analytics: false } }),
    );
    runIdle();
    expect(srcs()).toEqual([]);
  });

  it('ignores a second call rather than resetting what is already running', () => {
    defineAnalytics({ gaMeasurementId: GA });
    defineAnalytics({ gaMeasurementId: 'G-OTHER' });
    runIdle();
    expect(srcs()).toEqual([GTAG_SRC(GA)]);
  });

  it('starts when the refusal cannot be read rather than failing closed', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('private mode');
    });
    defineAnalytics({ gaMeasurementId: GA });
    runIdle();
    expect(srcs()).toEqual([GTAG_SRC(GA)]);
  });

  it('lets a later acceptance start what the refusal held back', () => {
    refuse();
    defineAnalytics({ gaMeasurementId: GA });
    expect(srcs()).toEqual([]);
    window.loadAnalytics?.();
    runIdle();
    expect(srcs()).toEqual([GTAG_SRC(GA)]);
  });

  it('initialises the tag once however often it is asked', () => {
    defineAnalytics({ gaMeasurementId: GA });
    window.loadAnalytics?.();
    window.loadAnalytics?.();
    runIdle();
    expect(srcs()).toEqual([GTAG_SRC(GA)]);
    expect(dataLayer().filter((call) => call[0] === 'js')).toHaveLength(1);
  });

  it('does nothing on a site with no id configured', () => {
    defineAnalytics({});
    window.loadAnalytics?.();
    runIdle();
    expect(srcs()).toEqual([]);
    expect(window.gtag).toBeUndefined();
  });

  it('queues a goal fired before the tag arrives, so it is not lost', () => {
    defineAnalytics({ gaMeasurementId: GA });
    window.trackGoal?.('lead_submit', { channel: 'phone' });
    expect(dataLayer().at(-1)).toEqual([
      'event',
      'lead_submit',
      { channel: 'phone' },
    ]);
  });

  it('drops a goal fired under an active refusal instead of queueing it for later', () => {
    refuse();
    defineAnalytics({ gaMeasurementId: GA });
    expect(() => window.trackGoal?.('lead_submit')).not.toThrow();
    expect(window.gtag).toBeUndefined();
  });

  it('swallows a goal on a site with no GA4 id instead of throwing', () => {
    defineAnalytics({});
    expect(() => window.trackGoal?.('lead_submit')).not.toThrow();
  });

  it('keeps an already-installed gtag/dataLayer instead of replacing it', () => {
    const existing = vi.fn();
    window.gtag = existing;
    defineAnalytics({ gaMeasurementId: GA });
    expect(window.gtag).toBe(existing);
    expect(existing).toHaveBeenCalledWith('config', GA);
  });

  it('reuses a tag another script already put on the page', () => {
    const script = document.createElement('script');
    script.src = GTAG_SRC(GA);
    document.head.appendChild(script);
    defineAnalytics({ gaMeasurementId: GA });
    runIdle();
    expect(srcs()).toEqual([GTAG_SRC(GA)]);
  });
});

const PIXEL = '29229430643330595';
const FBQ = 'https://connect.facebook.net/en_US/fbevents.js';
const fbqQueue = () => (window.fbq as unknown as { queue: unknown[][] }).queue;

describe('defineAnalytics with a Meta Pixel', () => {
  it('loads the pixel beside the tag once the browser goes idle', () => {
    defineAnalytics({ gaMeasurementId: GA, metaPixelId: PIXEL });
    expect(srcs()).toEqual([]);
    runIdle();
    expect(srcs()).toEqual([FBQ, GTAG_SRC(GA)]);
  });

  it('loads the pixel alone on a site with no GA4 id', () => {
    defineAnalytics({ metaPixelId: PIXEL });
    runIdle();
    expect(srcs()).toEqual([FBQ]);
    expect(window.gtag).toBeUndefined();
  });

  it('records init and the page view once before the script downloads', () => {
    defineAnalytics({ metaPixelId: PIXEL });
    window.loadAnalytics?.();
    window.loadAnalytics?.();
    runIdle();
    expect(fbqQueue()).toEqual([
      ['init', PIXEL],
      ['track', 'PageView'],
    ]);
    expect(window._fbq).toBe(window.fbq);
    expect(srcs()).toEqual([FBQ]);
  });

  it('leaves the pixel out on a site with no pixel id', () => {
    defineAnalytics({ gaMeasurementId: GA });
    runIdle();
    expect(srcs()).toEqual([GTAG_SRC(GA)]);
    expect(window.fbq).toBeUndefined();
  });

  it('holds the pixel back under the same refusal as the tag', () => {
    refuse();
    defineAnalytics({ gaMeasurementId: GA, metaPixelId: PIXEL });
    window.trackGoal?.('form_submit');
    runIdle();
    expect(srcs()).toEqual([]);
    expect(window.fbq).toBeUndefined();
    document.dispatchEvent(
      new CustomEvent(CONSENT_EVENT, { detail: { analytics: true } }),
    );
    runIdle();
    expect(srcs()).toEqual([FBQ, GTAG_SRC(GA)]);
  });

  it('keeps an already-installed fbq instead of replacing it', () => {
    const existing = vi.fn();
    window.fbq = existing;
    defineAnalytics({ metaPixelId: PIXEL });
    expect(window.fbq).toBe(existing);
    expect(existing).toHaveBeenCalledWith('init', PIXEL);
  });

  it('hands calls to the loaded script once it takes over the queue', () => {
    defineAnalytics({ metaPixelId: PIXEL });
    const callMethod = vi.fn();
    (window.fbq as unknown as { callMethod: typeof callMethod }).callMethod =
      callMethod;
    window.trackGoal?.('contact_click', { channel: 'phone' });
    expect(callMethod).toHaveBeenCalledWith('track', 'Contact');
  });

  it.each([
    ['form_submit', { service: 'brakes' }, 'Lead'],
    ['contact_click', { channel: 'viber', placement: 'hero' }, 'Contact'],
    ['add_to_cart', { currency: 'rsd', value: 5990, items: [] }, 'AddToCart'],
    ['begin_checkout', undefined, 'InitiateCheckout'],
    ['purchase', { value: 12690 }, 'Purchase'],
  ])('maps %s onto the standard %s event', (goal, params, event) => {
    defineAnalytics({ gaMeasurementId: GA, metaPixelId: PIXEL });
    window.trackGoal?.(goal, params);
    const value = (params as { value?: unknown } | undefined)?.value;
    const currency = (params as { currency?: unknown } | undefined)?.currency;
    expect(fbqQueue().at(-1)).toEqual(
      typeof value === 'number' && typeof currency === 'string'
        ? ['track', event, { value, currency: currency.toUpperCase() }]
        : ['track', event],
    );
    expect(dataLayer().at(-1)).toEqual(['event', goal, params]);
  });

  it('sends the order value and currency with a purchase', () => {
    defineAnalytics({ metaPixelId: PIXEL });
    window.trackGoal?.('purchase', { value: 12690, currency: 'rsd' });
    expect(fbqQueue().at(-1)).toEqual([
      'track',
      'Purchase',
      { value: 12690, currency: 'RSD' },
    ]);
  });

  it('keeps goals without a standard event off the pixel', () => {
    defineAnalytics({ metaPixelId: PIXEL });
    window.trackGoal?.('scroll_50');
    window.trackGoal?.('form_view');
    expect(fbqQueue()).toHaveLength(2);
  });
});

const AW = 'AW-123456789';
const LABELS = { form_submit: 'Lead123', contact_click: 'Contact456' };

describe('defineAnalytics with Google Ads', () => {
  it('loads the tag beside the others once the browser goes idle', () => {
    defineAnalytics({
      gaMeasurementId: GA,
      metaPixelId: PIXEL,
      googleAdsId: AW,
      googleConversionLabels: LABELS,
    });
    expect(srcs()).toEqual([]);
    runIdle();
    expect(srcs()).toEqual([FBQ, GTAG_SRC(AW)]);
  });

  it('loads the tag alone on a site with no GA4 id or pixel, preferring the Ads id for the script url', () => {
    defineAnalytics({ googleAdsId: AW, googleConversionLabels: LABELS });
    runIdle();
    expect(srcs()).toEqual([GTAG_SRC(AW)]);
    expect(window.fbq).toBeUndefined();
  });

  it('configures both the Ads id and the GA4 id on the one shared tag', () => {
    defineAnalytics({ googleAdsId: AW, gaMeasurementId: GA });
    expect(
      dataLayer().some((call) => call[0] === 'config' && call[1] === AW),
    ).toBe(true);
    expect(
      dataLayer().some((call) => call[0] === 'config' && call[1] === GA),
    ).toBe(true);
    runIdle();
    expect(srcs()).toEqual([GTAG_SRC(AW)]);
  });

  it('leaves the tag out on a site with no Google Ads id or GA4 id', () => {
    defineAnalytics({ metaPixelId: PIXEL });
    runIdle();
    expect(srcs()).toEqual([FBQ]);
    expect(window.gtag).toBeUndefined();
  });

  it('holds the tag back under the same refusal as the others', () => {
    refuse();
    defineAnalytics({ googleAdsId: AW, googleConversionLabels: LABELS });
    window.trackGoal?.('form_submit');
    runIdle();
    expect(srcs()).toEqual([]);
    expect(window.gtag).toBeUndefined();
    document.dispatchEvent(
      new CustomEvent(CONSENT_EVENT, { detail: { analytics: true } }),
    );
    runIdle();
    expect(srcs()).toEqual([GTAG_SRC(AW)]);
  });

  it('keeps an already-installed gtag/dataLayer instead of replacing it', () => {
    const existing = vi.fn();
    window.gtag = existing;
    defineAnalytics({ googleAdsId: AW, googleConversionLabels: LABELS });
    expect(window.gtag).toBe(existing);
    expect(existing).toHaveBeenCalledWith('config', AW);
  });

  it('sends the composed send_to for a form submit and a contact click', () => {
    defineAnalytics({ googleAdsId: AW, googleConversionLabels: LABELS });
    window.trackGoal?.('form_submit');
    expect(dataLayer().at(-1)).toEqual([
      'event',
      'conversion',
      { send_to: `${AW}/Lead123` },
    ]);
    window.trackGoal?.('contact_click', { channel: 'phone' });
    expect(dataLayer().at(-1)).toEqual([
      'event',
      'conversion',
      { send_to: `${AW}/Contact456` },
    ]);
  });

  it('sends value and currency alongside a conversion that carries one', () => {
    defineAnalytics({
      googleAdsId: AW,
      googleConversionLabels: { purchase: 'Buy1' },
    });
    window.trackGoal?.('purchase', { value: 12690, currency: 'rsd' });
    expect(dataLayer().at(-1)).toEqual([
      'event',
      'conversion',
      { send_to: `${AW}/Buy1`, value: 12690, currency: 'RSD' },
    ]);
  });

  it('silently skips a goal with no configured label', () => {
    defineAnalytics({ googleAdsId: AW, googleConversionLabels: LABELS });
    expect(() => window.trackGoal?.('scroll_50')).not.toThrow();
    expect(
      dataLayer().some(
        (call) => call[0] === 'event' && call[1] === 'conversion',
      ),
    ).toBe(false);
  });

  it('swallows a goal on a site with no Google Ads id instead of throwing', () => {
    defineAnalytics({});
    expect(() => window.trackGoal?.('form_submit')).not.toThrow();
  });

  it('swallows a goal when no label map was passed at all', () => {
    defineAnalytics({ googleAdsId: AW });
    expect(() => window.trackGoal?.('form_submit')).not.toThrow();
  });
});
