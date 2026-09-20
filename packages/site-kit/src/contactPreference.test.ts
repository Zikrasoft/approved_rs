// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  applyPreferredContactOrder,
  applyPrimaryContactChannel,
  detectVisitorCountry,
  preferredContactChannel,
} from './contactPreference.ts';

function stubTimeZone(timeZone: string) {
  vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
    resolvedOptions: () => ({ timeZone }) as Intl.ResolvedDateTimeFormatOptions,
  } as Intl.DateTimeFormat);
}

function render(html: string, lang = 'sr') {
  document.documentElement.lang = lang;
  document.body.innerHTML = html;
}

const order = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>('[data-channel]'),
    (el) => el.dataset.channel,
  );

describe('detectVisitorCountry', () => {
  afterEach(() => vi.restoreAllMocks());

  it('maps a known IANA zone to its country code', () => {
    stubTimeZone('Europe/Belgrade');
    expect(detectVisitorCountry()).toBe('rs');
  });

  it('maps both aliases of a zone that changed name to the same country', () => {
    stubTimeZone('Europe/Kyiv');
    expect(detectVisitorCountry()).toBe('ua');
    stubTimeZone('Europe/Kiev');
    expect(detectVisitorCountry()).toBe('ua');
  });

  it('returns undefined for a zone outside the curated list', () => {
    stubTimeZone('America/New_York');
    expect(detectVisitorCountry()).toBeUndefined();
  });

  it('returns undefined instead of throwing if Intl access fails', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('unsupported');
    });
    expect(detectVisitorCountry()).toBeUndefined();
  });
});

describe('preferredContactChannel', () => {
  it('prefers WhatsApp for the Balkans and Western/Southern Europe', () => {
    expect(preferredContactChannel('rs')).toBe('whatsapp');
    expect(preferredContactChannel('de')).toBe('whatsapp');
    expect(preferredContactChannel('it')).toBe('whatsapp');
  });

  it('prefers Telegram for Russia/CIS', () => {
    expect(preferredContactChannel('ru')).toBe('telegram');
    expect(preferredContactChannel('kz')).toBe('telegram');
  });

  it('is case-insensitive', () => {
    expect(preferredContactChannel('RS')).toBe('whatsapp');
  });

  it('defaults to Telegram for an unlisted or missing country', () => {
    expect(preferredContactChannel('gr')).toBe('telegram');
    expect(preferredContactChannel(undefined)).toBe('telegram');
  });

  it('does not hit Object.prototype members used as a country code', () => {
    expect(preferredContactChannel('constructor')).toBe('telegram');
    expect(preferredContactChannel('toString')).toBe('telegram');
  });

  it('forces Telegram for the Russian locale regardless of country', () => {
    expect(preferredContactChannel('rs', 'ru')).toBe('telegram');
  });

  it('reads the language subtag, so a BCP 47 tag counts as Russian too', () => {
    expect(preferredContactChannel('rs', 'ru-RS')).toBe('telegram');
    expect(preferredContactChannel('rs', 'RU-rs')).toBe('telegram');
  });

  it('falls back to the country lookup for any other locale', () => {
    expect(preferredContactChannel('rs', 'en')).toBe('whatsapp');
  });
});

describe('applyPrimaryContactChannel', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the channel the visitor region prefers and hides the rest', () => {
    stubTimeZone('Europe/Belgrade');
    render(`
      <div data-primary-contact>
        <a data-primary-channel="telegram"></a>
        <a data-primary-channel="whatsapp" hidden></a>
      </div>`);

    applyPrimaryContactChannel();

    expect(
      document.querySelector<HTMLElement>('[data-primary-channel="telegram"]')
        ?.hidden,
    ).toBe(true);
    expect(
      document.querySelector<HTMLElement>('[data-primary-channel="whatsapp"]')
        ?.hidden,
    ).toBe(false);
  });

  it('applies the same channel to every group on the page', () => {
    stubTimeZone('Europe/Belgrade');
    render(`
      <div data-primary-contact>
        <a data-primary-channel="telegram"></a>
        <a data-primary-channel="whatsapp" hidden></a>
      </div>
      <div data-primary-contact>
        <a data-primary-channel="telegram"></a>
        <a data-primary-channel="whatsapp" hidden></a>
      </div>`);

    applyPrimaryContactChannel();

    expect(
      Array.from(
        document.querySelectorAll<HTMLElement>('[data-primary-channel]'),
        (el) => el.hidden,
      ),
    ).toEqual([true, false, true, false]);
  });

  it('keeps the Telegram default on a Russian page whatever the region says', () => {
    stubTimeZone('Europe/Belgrade');
    render(
      `<div data-primary-contact>
        <a data-primary-channel="telegram"></a>
        <a data-primary-channel="whatsapp" hidden></a>
      </div>`,
      'ru',
    );

    applyPrimaryContactChannel();

    expect(
      document.querySelector<HTMLElement>('[data-primary-channel="telegram"]')
        ?.hidden,
    ).toBe(false);
  });
});

describe('applyPreferredContactOrder', () => {
  afterEach(() => vi.restoreAllMocks());

  const list = `
    <div data-contact-order>
      <a data-channel="phone"></a>
      <a data-channel="whatsapp"></a>
      <a data-channel="viber"></a>
      <a data-channel="telegram"></a>
    </div>`;

  it('moves Telegram ahead of WhatsApp for a Russian-speaking visitor', () => {
    stubTimeZone('Europe/Moscow');
    render(list);

    applyPreferredContactOrder();

    expect(order()).toEqual(['phone', 'telegram', 'whatsapp', 'viber']);
  });

  it('promotes Telegram on a page tagged with a Russian BCP 47 locale', () => {
    stubTimeZone('Europe/Belgrade');
    render(list, 'ru-RS');

    applyPreferredContactOrder();

    expect(order()).toEqual(['phone', 'telegram', 'whatsapp', 'viber']);
  });

  it('leaves the WhatsApp-first order alone in the Balkans', () => {
    stubTimeZone('Europe/Belgrade');
    render(list);

    applyPreferredContactOrder();

    expect(order()).toEqual(['phone', 'whatsapp', 'viber', 'telegram']);
  });

  it('moves WhatsApp back ahead when it is rendered second', () => {
    stubTimeZone('Europe/Belgrade');
    render(`
      <div data-contact-order>
        <a data-channel="telegram"></a>
        <a data-channel="whatsapp"></a>
      </div>`);

    applyPreferredContactOrder();

    expect(order()).toEqual(['whatsapp', 'telegram']);
  });

  it('hands the selection over when the demoted messenger held it', () => {
    stubTimeZone('Europe/Moscow');
    render(`
      <div data-contact-order>
        <label data-channel="whatsapp"><input type="radio" name="c" checked /></label>
        <label data-channel="telegram"><input type="radio" name="c" /></label>
      </div>`);

    applyPreferredContactOrder();

    expect(
      document.querySelector<HTMLInputElement>(
        '[data-channel="telegram"] input',
      )?.checked,
    ).toBe(true);
  });

  it('leaves a form whose default is another channel alone', () => {
    stubTimeZone('Europe/Moscow');
    render(`
      <div data-contact-order>
        <label data-channel="phone"><input type="radio" name="c" checked /></label>
        <label data-channel="whatsapp"><input type="radio" name="c" /></label>
        <label data-channel="telegram"><input type="radio" name="c" /></label>
      </div>`);

    applyPreferredContactOrder();

    expect(order()).toEqual(['phone', 'telegram', 'whatsapp']);
    expect(
      document.querySelector<HTMLInputElement>('[data-channel="phone"] input')
        ?.checked,
    ).toBe(true);
  });

  it('does nothing when the preferred channel is not rendered', () => {
    stubTimeZone('Europe/Moscow');
    render(`
      <div data-contact-order>
        <a data-channel="phone"></a>
        <a data-channel="whatsapp"></a>
      </div>`);

    applyPreferredContactOrder();

    expect(order()).toEqual(['phone', 'whatsapp']);
  });

  it('does nothing when the channel it would demote is not rendered', () => {
    stubTimeZone('Europe/Belgrade');
    render(`
      <div data-contact-order>
        <a data-channel="phone"></a>
        <a data-channel="whatsapp"></a>
        <a data-channel="viber"></a>
      </div>`);

    applyPreferredContactOrder();

    expect(order()).toEqual(['phone', 'whatsapp', 'viber']);
  });
});
