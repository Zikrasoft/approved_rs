// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defineContactClickTracking } from './contactClick.ts';
import { VISITOR_ID_STORAGE_KEY } from './visitorId.ts';

const isTracked = (channel: string | undefined): channel is string =>
  channel === 'telegram';

let sent: [string, FormData][];

beforeEach(() => {
  sent = [];
  localStorage.clear();
  document.body.innerHTML = `
    <a data-contact-channel="telegram" href="#t">Telegram</a>
    <a data-contact-channel="callback" href="#c">Callback</a>
  `;
  navigator.sendBeacon = vi.fn((url: string | URL, body?: BodyInit | null) => {
    sent.push([String(url), body as FormData]);
    return true;
  }) as unknown as typeof navigator.sendBeacon;
  window.ymReachGoal = vi.fn();
  vi.stubGlobal('crypto', { randomUUID: () => 'fixed-id' });
});

const click = (channel: string) =>
  document
    .querySelector<HTMLElement>(`[data-contact-channel="${channel}"]`)
    ?.click();

describe('defineContactClickTracking', () => {
  it('beacons a tracked channel to the lead route with the page it happened on', () => {
    defineContactClickTracking(isTracked);
    click('telegram');
    expect(sent).toHaveLength(1);
    const [url, body] = sent[0]!;
    expect(url).toBe('/api/contact-click');
    expect(body.get('channel')).toBe('telegram');
    expect(body.get('source_url')).toBe(location.href);
    expect(body.get('visitor_id')).toBe('fixed-id');
  });

  it('reuses the visitor id a previous click already minted', () => {
    localStorage.setItem(VISITOR_ID_STORAGE_KEY, 'earlier-id');
    defineContactClickTracking(isTracked);
    click('telegram');
    expect(sent[0]![1].get('visitor_id')).toBe('earlier-id');
  });

  it('reports the same click to the analytics counter', () => {
    defineContactClickTracking(isTracked);
    click('telegram');
    expect(window.ymReachGoal).toHaveBeenCalledWith('contact_click', {
      channel: 'telegram',
    });
  });

  it('leaves an untracked channel alone', () => {
    defineContactClickTracking(isTracked);
    click('callback');
    expect(sent).toEqual([]);
    expect(window.ymReachGoal).not.toHaveBeenCalled();
  });

  it('still records the click on a page where analytics never loaded', () => {
    delete (window as Partial<Window>).ymReachGoal;
    defineContactClickTracking(isTracked);
    expect(() => click('telegram')).not.toThrow();
    expect(sent).toHaveLength(1);
  });
});
