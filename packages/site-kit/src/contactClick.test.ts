// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defineContactClickTracking } from './contactClick.ts';
import { VISITOR_ID_STORAGE_KEY } from './visitorId.ts';

const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const EARLIER_UUID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

const link = () =>
  document.querySelector<HTMLAnchorElement>(
    '[data-contact-channel="telegram"]',
  )!;

let sent: [string, FormData][];

beforeEach(() => {
  sent = [];
  localStorage.clear();
  document.body.innerHTML = `
    <div data-contact-placement="footer">
      <a data-contact-channel="telegram" href="https://t.me/Bot?start=sr">Telegram</a>
      <a data-contact-channel="callback" href="#c">Callback</a>
    </div>
    <a data-contact-channel="viber" href="#v">Viber</a>
    <a data-contact-channel="whatsapp" data-contact-placement="made-up" href="#w">
      WhatsApp
    </a>
  `;
  navigator.sendBeacon = vi.fn((url: string | URL, body?: BodyInit | null) => {
    sent.push([String(url), body as FormData]);
    return true;
  }) as unknown as typeof navigator.sendBeacon;
  window.ymReachGoal = vi.fn();
  vi.stubGlobal('crypto', { randomUUID: () => UUID });
});

const click = (channel: string) =>
  document
    .querySelector<HTMLElement>(`[data-contact-channel="${channel}"]`)
    ?.click();

describe('defineContactClickTracking', () => {
  it('beacons a tracked channel to the lead route with the page it happened on', () => {
    defineContactClickTracking();
    click('telegram');
    expect(sent).toHaveLength(1);
    const [url, body] = sent[0]!;
    expect(url).toBe('/api/contact-click');
    expect(body.get('channel')).toBe('telegram');
    expect(body.get('source_url')).toBe(location.href);
    expect(body.get('visitor_id')).toBe(UUID);
  });

  it('reuses the visitor id a previous click already minted', () => {
    localStorage.setItem(VISITOR_ID_STORAGE_KEY, EARLIER_UUID);
    defineContactClickTracking();
    click('telegram');
    expect(sent[0]![1].get('visitor_id')).toBe(EARLIER_UUID);
  });

  it('reports the same click to the analytics counter', () => {
    defineContactClickTracking();
    click('telegram');
    expect(window.ymReachGoal).toHaveBeenCalledWith('contact_click', {
      channel: 'telegram',
      placement: 'footer',
    });
  });

  it('reports the placement the tapped control sits in', () => {
    defineContactClickTracking();
    click('whatsapp');
    expect(window.ymReachGoal).toHaveBeenCalledWith('contact_click', {
      channel: 'whatsapp',
      placement: 'made-up',
    });
  });

  it('still reports a usable goal where no placement is stamped', () => {
    defineContactClickTracking();
    click('viber');
    expect(window.ymReachGoal).toHaveBeenCalledWith('contact_click', {
      channel: 'viber',
      placement: undefined,
    });
  });

  it('leaves the button that only opens the form out of the contact count', () => {
    defineContactClickTracking();
    click('callback');
    expect(sent).toEqual([]);
    expect(window.ymReachGoal).not.toHaveBeenCalled();
  });

  it('writes a lead for a Telegram tap that opens the capture bot, so the bot can pick up its page', () => {
    defineContactClickTracking();
    click('telegram');
    expect(sent).toHaveLength(1);
    expect(sent[0]![1].get('channel')).toBe('telegram');
  });

  it('fires the goal for a Telegram link to a human account but writes no lead', () => {
    document.body.innerHTML = `
      <div data-contact-placement="thanks">
        <a data-contact-channel="telegram" href="https://t.me/manager">T</a>
        <a data-contact-channel="whatsapp" href="https://wa.me/1">W</a>
      </div>`;
    defineContactClickTracking();
    click('telegram');
    expect(window.ymReachGoal).toHaveBeenCalledWith('contact_click', {
      channel: 'telegram',
      placement: 'thanks',
    });
    expect(sent).toEqual([]);
    click('whatsapp');
    expect(sent).toHaveLength(1);
    expect(sent[0]![1].get('channel')).toBe('whatsapp');
  });

  it('appends the compact visitor id to a capture-bot start payload, once', () => {
    localStorage.setItem(VISITOR_ID_STORAGE_KEY, UUID);
    document.body.innerHTML = `<a data-contact-channel="telegram" href="https://t.me/Bot?start=detailing_sr">T</a>`;
    defineContactClickTracking();
    click('telegram');
    click('telegram');
    expect(link().href).toBe(
      `https://t.me/Bot?start=detailing_sr_${UUID.replaceAll('-', '')}`,
    );
  });

  it('leaves a bot link without a start payload untouched and unbeaconed', () => {
    localStorage.setItem(VISITOR_ID_STORAGE_KEY, UUID);
    document.body.innerHTML = `<a data-contact-channel="telegram" href="https://t.me/Bot">T</a>`;
    defineContactClickTracking();
    click('telegram');
    expect(link().href).toBe('https://t.me/Bot');
    expect(sent).toEqual([]);
  });

  it.each([
    ['a visitor id that is not a uuid', 'https://t.me/Bot?start=sr', 'odd-id'],
    [
      'a payload that would outgrow 64 characters',
      `https://t.me/Bot?start=${'x'.repeat(32)}`,
      UUID,
    ],
  ])('leaves the bot to write the lead alone for %s', (_, href, visitorId) => {
    localStorage.setItem(VISITOR_ID_STORAGE_KEY, visitorId);
    document.body.innerHTML = `<a data-contact-channel="telegram" href="${href}">T</a>`;
    defineContactClickTracking();
    click('telegram');
    expect(link().href).toBe(href);
    expect(sent).toEqual([]);
    expect(window.ymReachGoal).toHaveBeenCalled();
  });

  it('still records the click on a page where analytics never loaded', () => {
    delete (window as Partial<Window>).ymReachGoal;
    defineContactClickTracking();
    expect(() => click('telegram')).not.toThrow();
    expect(sent).toHaveLength(1);
  });
});
