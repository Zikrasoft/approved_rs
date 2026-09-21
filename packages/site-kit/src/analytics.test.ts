// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { defineAnalytics } from './analytics.ts';
import { CONSENT_EVENT, newConsent, STORAGE_KEY } from './consent.ts';

const YM = 111800377;
const TAG = `https://mc.yandex.ru/metrika/tag.js?id=${YM}`;

const srcs = () => [...document.scripts].map((script) => script.src);
const ymQueue = () => (window.ym as unknown as { a: unknown[][] }).a;
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
  delete (window as Partial<Window>).ym;
  delete (window as Partial<Window>).loadAnalytics;
  delete (window as Partial<Window>).ymReachGoal;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('defineAnalytics', () => {
  it('loads the counter on the first page view when nothing was refused', () => {
    defineAnalytics({ ymCounterId: YM });
    runIdle();
    expect(srcs()).toEqual([TAG]);
  });

  it('keeps the tag out of the critical path until the browser goes idle', () => {
    defineAnalytics({ ymCounterId: YM });
    expect(srcs()).toEqual([]);
    runIdle();
    expect(srcs()).toEqual([TAG]);
  });

  it('records the page view before the tag downloads, so nothing is lost', () => {
    defineAnalytics({ ymCounterId: YM });
    expect(ymQueue()).toContainEqual([
      YM,
      'init',
      {
        ssr: true,
        webvisor: true,
        clickmap: true,
        accurateTrackBounce: true,
        trackLinks: true,
      },
    ]);
  });

  it('falls back to a timer where requestIdleCallback is missing', () => {
    vi.stubGlobal('requestIdleCallback', undefined);
    vi.useFakeTimers();
    defineAnalytics({ ymCounterId: YM });
    expect(srcs()).toEqual([]);
    vi.runAllTimers();
    expect(srcs()).toEqual([TAG]);
    vi.useRealTimers();
  });

  it('waits for load before scheduling when the page is still parsing', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    defineAnalytics({ ymCounterId: YM });
    runIdle();
    expect(srcs()).toEqual([]);
    dispatchEvent(new Event('load'));
    runIdle();
    expect(srcs()).toEqual([TAG]);
  });

  it('holds the counter back when the visitor refused analytics', () => {
    refuse();
    defineAnalytics({ ymCounterId: YM });
    runIdle();
    expect(srcs()).toEqual([]);
  });

  it('stamps the queue start time the Metrika tag reads back', () => {
    defineAnalytics({ ymCounterId: YM });
    expect(typeof (window.ym as unknown as { l: number }).l).toBe('number');
  });

  it('starts once a later acceptance answers the banner', () => {
    refuse();
    defineAnalytics({ ymCounterId: YM });
    document.dispatchEvent(
      new CustomEvent(CONSENT_EVENT, { detail: { analytics: true } }),
    );
    runIdle();
    expect(srcs()).toEqual([TAG]);
  });

  it('stays held back when the banner answer is another refusal', () => {
    refuse();
    defineAnalytics({ ymCounterId: YM });
    document.dispatchEvent(
      new CustomEvent(CONSENT_EVENT, { detail: { analytics: false } }),
    );
    runIdle();
    expect(srcs()).toEqual([]);
  });

  it('ignores a second call rather than resetting what is already running', () => {
    defineAnalytics({ ymCounterId: YM });
    defineAnalytics({ ymCounterId: 42 });
    runIdle();
    expect(srcs()).toEqual([TAG]);
  });

  it('starts when the refusal cannot be read rather than failing closed', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('private mode');
    });
    defineAnalytics({ ymCounterId: YM });
    runIdle();
    expect(srcs()).toEqual([TAG]);
  });

  it('lets a later acceptance start what the refusal held back', () => {
    refuse();
    defineAnalytics({ ymCounterId: YM });
    expect(srcs()).toEqual([]);
    window.loadAnalytics?.();
    runIdle();
    expect(srcs()).toEqual([TAG]);
  });

  it('initialises the counter once however often it is asked', () => {
    defineAnalytics({ ymCounterId: YM });
    window.loadAnalytics?.();
    window.loadAnalytics?.();
    runIdle();
    expect(srcs()).toEqual([TAG]);
    expect(ymQueue().filter((call) => call[1] === 'init')).toHaveLength(1);
  });

  it('does nothing on a site with no counter configured', () => {
    defineAnalytics({});
    window.loadAnalytics?.();
    runIdle();
    expect(srcs()).toEqual([]);
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
    defineAnalytics({});
    expect(() => window.ymReachGoal?.('lead_submit')).not.toThrow();
  });

  it('keeps an already-installed ym queue instead of dropping what it holds', () => {
    const existing = vi.fn();
    window.ym = existing;
    defineAnalytics({ ymCounterId: YM });
    expect(window.ym).toBe(existing);
  });

  it('reuses a tag another script already put on the page', () => {
    const script = document.createElement('script');
    script.src = TAG;
    document.head.appendChild(script);
    defineAnalytics({ ymCounterId: YM });
    runIdle();
    expect(srcs()).toEqual([TAG]);
  });
});
