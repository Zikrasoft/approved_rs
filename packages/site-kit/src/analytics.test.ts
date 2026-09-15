// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defineAnalytics } from './analytics.ts';
import { CONSENT_EVENT, newConsent, STORAGE_KEY } from './consent.ts';

const YM = 111800377;
const GA = 'G-TEST';

const srcs = () => [...document.scripts].map((script) => script.src);
const ymQueue = () => (window.ym as unknown as { a: unknown[][] }).a;
const refuse = () =>
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(newConsent(false, '2026-09-12', new Date())),
  );

beforeEach(() => {
  document.head.innerHTML = '';
  localStorage.clear();
  delete (window as Partial<Window>).ym;
  delete (window as Partial<Window>).dataLayer;
  delete (window as Partial<Window>).loadAnalytics;
  delete (window as Partial<Window>).ymReachGoal;
});

describe('defineAnalytics', () => {
  it('loads both counters on the first page view when nothing was refused', () => {
    defineAnalytics({ ymCounterId: YM, gaMeasurementId: GA });
    expect(srcs()).toContain(`https://mc.yandex.ru/metrika/tag.js?id=${YM}`);
    expect(srcs()).toContain(
      `https://www.googletagmanager.com/gtag/js?id=${GA}`,
    );
  });

  it('holds both back when the visitor refused analytics', () => {
    refuse();
    defineAnalytics({ ymCounterId: YM, gaMeasurementId: GA });
    expect(srcs()).toEqual([]);
  });

  it('initialises Metrika with the options this site is set up for', () => {
    defineAnalytics({ ymCounterId: YM });
    expect(ymQueue()).toContainEqual([
      YM,
      'init',
      {
        ssr: true,
        webvisor: true,
        clickmap: true,
        ecommerce: 'dataLayer',
        accurateTrackBounce: true,
        trackLinks: true,
      },
    ]);
  });

  it('stamps the queue start time the Metrika tag reads back', () => {
    defineAnalytics({ ymCounterId: YM });
    expect(typeof (window.ym as unknown as { l: number }).l).toBe('number');
  });

  it('tells GA the session started before configuring it', () => {
    defineAnalytics({ gaMeasurementId: GA });
    const commands = window.dataLayer.map((call) => (call as unknown[])[0]);
    expect(commands).toEqual(['js', 'config']);
  });

  it('starts once a later acceptance answers the banner', () => {
    refuse();
    defineAnalytics({ ymCounterId: YM });
    document.dispatchEvent(
      new CustomEvent(CONSENT_EVENT, { detail: { analytics: true } }),
    );
    expect(srcs()).toHaveLength(1);
  });

  it('stays held back when the banner answer is another refusal', () => {
    refuse();
    defineAnalytics({ ymCounterId: YM });
    document.dispatchEvent(
      new CustomEvent(CONSENT_EVENT, { detail: { analytics: false } }),
    );
    expect(srcs()).toEqual([]);
  });

  it('ignores a second call rather than resetting what is already running', () => {
    defineAnalytics({ ymCounterId: YM });
    defineAnalytics({ ymCounterId: 42 });
    expect(srcs()).toEqual([`https://mc.yandex.ru/metrika/tag.js?id=${YM}`]);
  });

  it('starts when the refusal cannot be read rather than failing closed', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('private mode');
    });
    defineAnalytics({ ymCounterId: YM });
    expect(srcs()).toHaveLength(1);
    vi.restoreAllMocks();
  });

  it('lets a later acceptance start what the refusal held back', () => {
    refuse();
    defineAnalytics({ ymCounterId: YM });
    expect(srcs()).toEqual([]);
    window.loadAnalytics?.();
    expect(srcs()).toHaveLength(1);
  });

  it('initialises each counter once however often it is asked', () => {
    defineAnalytics({ ymCounterId: YM, gaMeasurementId: GA });
    window.loadAnalytics?.();
    window.loadAnalytics?.();
    expect(srcs()).toHaveLength(2);
    expect(
      window.dataLayer.filter((call) => (call as unknown[])[0] === 'config'),
    ).toHaveLength(1);
    expect(ymQueue().filter((call) => call[1] === 'init')).toHaveLength(1);
  });

  it('does not load a counter the site has not configured', () => {
    defineAnalytics({ gaMeasurementId: GA });
    expect(srcs()).toHaveLength(1);
    expect(window.ym).toBeUndefined();
  });

  it('queues a goal fired before the tag arrives, so it is not lost', () => {
    defineAnalytics({ ymCounterId: YM });
    window.ymReachGoal?.('lead_submit', { channel: 'phone' });
    expect(ymQueue().at(-1)).toEqual([
      YM,
      'reachGoal',
      'lead_submit',
      { channel: 'phone' },
    ]);
  });

  it('drops a goal fired under an active refusal instead of queueing it for later', () => {
    refuse();
    defineAnalytics({ ymCounterId: YM });
    expect(() => window.ymReachGoal?.('lead_submit')).not.toThrow();
    expect(window.ym).toBeUndefined();
  });

  it('swallows a goal on a site with no Metrika counter instead of throwing', () => {
    defineAnalytics({ gaMeasurementId: GA });
    expect(() => window.ymReachGoal?.('lead_submit')).not.toThrow();
  });

  it('keeps a dataLayer the page already had, so nothing queued is lost', () => {
    window.dataLayer = ['existing'];
    defineAnalytics({ gaMeasurementId: GA });
    expect(window.dataLayer[0]).toBe('existing');
  });

  it('feeds gtag calls into the dataLayer the tag reads', () => {
    defineAnalytics({ gaMeasurementId: GA });
    const calls = window.dataLayer.map((call) =>
      Array.from(call as ArrayLike<unknown>),
    );
    expect(calls).toContainEqual(['config', GA]);
  });

  it('pushes gtag commands as the Arguments object gtag.js looks for', () => {
    defineAnalytics({ gaMeasurementId: GA });
    expect(Array.isArray(window.dataLayer[0])).toBe(false);
    expect(Object.prototype.toString.call(window.dataLayer[0])).toBe(
      '[object Arguments]',
    );
  });

  it('keeps an already-installed ym queue instead of dropping what it holds', () => {
    const existing = vi.fn();
    window.ym = existing;
    defineAnalytics({ ymCounterId: YM });
    expect(window.ym).toBe(existing);
  });

  it('reuses a tag another script already put on the page', () => {
    const script = document.createElement('script');
    script.src = `https://mc.yandex.ru/metrika/tag.js?id=${YM}`;
    document.head.appendChild(script);
    defineAnalytics({ ymCounterId: YM });
    expect(srcs()).toHaveLength(1);
  });
});
