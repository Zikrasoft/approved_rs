// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  detectVisitorCountry,
  preferredContactChannels,
  visitorChannel,
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

async function applyFresh() {
  vi.resetModules();
  const { applyContactPreference } = await import('./contactPreference.ts');
  applyContactPreference();
  return applyContactPreference;
}

const hidden = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>('[data-primary-channel]'),
    (el) => [el.dataset.primaryChannel, el.hidden],
  );

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

describe('preferredContactChannels', () => {
  it('ranks WhatsApp first in the Balkans and the rest of Europe', () => {
    expect(preferredContactChannels('rs')).toEqual([
      'whatsapp',
      'telegram',
      'viber',
      'phone',
    ]);
    expect(preferredContactChannels('de')[0]).toBe('whatsapp');
    expect(preferredContactChannels('it')[0]).toBe('whatsapp');
  });

  it('ranks Telegram first across the post-Soviet countries', () => {
    expect(preferredContactChannels('ru')).toEqual([
      'telegram',
      'whatsapp',
      'viber',
      'phone',
    ]);
    expect(preferredContactChannels('kz')[0]).toBe('telegram');
  });

  it('matches a country code regardless of case', () => {
    expect(preferredContactChannels('RS')[0]).toBe('whatsapp');
  });

  it('falls back to Telegram first for an unknown or missing country', () => {
    expect(preferredContactChannels('gr')[0]).toBe('telegram');
    expect(preferredContactChannels(undefined)[0]).toBe('telegram');
  });

  it('does not treat inherited object keys as a country', () => {
    expect(preferredContactChannels('constructor')[0]).toBe('telegram');
    expect(preferredContactChannels('toString')[0]).toBe('telegram');
  });

  it('ranks Telegram first for a Russian locale whatever the country', () => {
    expect(preferredContactChannels('rs', 'ru')[0]).toBe('telegram');
    expect(preferredContactChannels('rs', 'ru-RS')[0]).toBe('telegram');
    expect(preferredContactChannels('rs', 'RU-rs')[0]).toBe('telegram');
  });

  it('keeps the country ranking for any other locale', () => {
    expect(preferredContactChannels('rs', 'en')[0]).toBe('whatsapp');
  });

  it('lists every tracked channel exactly once', () => {
    for (const country of ['rs', 'ru', undefined]) {
      expect([...preferredContactChannels(country)].sort()).toEqual([
        'phone',
        'telegram',
        'viber',
        'whatsapp',
      ]);
    }
  });
});

describe('visitorChannel', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is the head of the visitor ranking', () => {
    stubTimeZone('Europe/Belgrade');
    render('');
    expect(visitorChannel()).toBe('whatsapp');
    render('', 'ru');
    expect(visitorChannel()).toBe('telegram');
  });
});

describe('applyContactPreference: show-one groups', () => {
  afterEach(() => vi.restoreAllMocks());

  const pair = `
    <div data-primary-contact>
      <a data-primary-channel="telegram"></a>
      <a data-primary-channel="whatsapp" hidden></a>
    </div>`;

  it('shows the channel the visitor region prefers and hides the rest', async () => {
    stubTimeZone('Europe/Belgrade');
    render(pair);

    await applyFresh();

    expect(hidden()).toEqual([
      ['telegram', true],
      ['whatsapp', false],
    ]);
  });

  it('applies the same ranking to every group on the page', async () => {
    stubTimeZone('Europe/Belgrade');
    render(pair + pair);

    await applyFresh();

    expect(hidden().map(([, isHidden]) => isHidden)).toEqual([
      true,
      false,
      true,
      false,
    ]);
  });

  it('keeps Telegram on a Russian page whatever the region says', async () => {
    stubTimeZone('Europe/Belgrade');
    render(pair, 'ru');

    await applyFresh();

    expect(hidden()).toEqual([
      ['telegram', false],
      ['whatsapp', true],
    ]);
  });

  it('shows the third channel of a group when it ranks highest there', async () => {
    stubTimeZone('Europe/Moscow');
    render(`
      <div data-primary-contact>
        <a data-primary-channel="phone"></a>
        <a data-primary-channel="viber" hidden></a>
        <a data-primary-channel="whatsapp" hidden></a>
      </div>`);

    await applyFresh();

    expect(hidden()).toEqual([
      ['phone', true],
      ['viber', true],
      ['whatsapp', false],
    ]);
  });

  it('falls down the ranking when the group lacks the preferred channel', async () => {
    stubTimeZone('Europe/Moscow');
    render(`
      <div data-primary-contact>
        <a data-primary-channel="phone"></a>
        <a data-primary-channel="viber" hidden></a>
      </div>`);

    await applyFresh();

    expect(hidden()).toEqual([
      ['phone', true],
      ['viber', false],
    ]);
  });

  it('leaves a group with no ranked channel as rendered', async () => {
    stubTimeZone('Europe/Moscow');
    render(`
      <div data-primary-contact>
        <a data-primary-channel="instagram"></a>
        <a data-primary-channel="email" hidden></a>
      </div>`);

    await applyFresh();

    expect(hidden()).toEqual([
      ['instagram', false],
      ['email', true],
    ]);
  });
});

describe('applyContactPreference: reorder groups', () => {
  afterEach(() => vi.restoreAllMocks());

  const list = `
    <div data-contact-order>
      <a data-channel="phone"></a>
      <a data-channel="whatsapp"></a>
      <a data-channel="viber"></a>
      <a data-channel="telegram"></a>
    </div>`;

  it('moves Telegram just ahead of WhatsApp for a Russian-speaking visitor', async () => {
    stubTimeZone('Europe/Moscow');
    render(list);

    await applyFresh();

    expect(order()).toEqual(['phone', 'telegram', 'whatsapp', 'viber']);
  });

  it('promotes Telegram on a page tagged with a Russian BCP 47 locale', async () => {
    stubTimeZone('Europe/Belgrade');
    render(list, 'ru-RS');

    await applyFresh();

    expect(order()).toEqual(['phone', 'telegram', 'whatsapp', 'viber']);
  });

  it('leaves the WhatsApp-first order alone in the Balkans', async () => {
    stubTimeZone('Europe/Belgrade');
    render(list);

    await applyFresh();

    expect(order()).toEqual(['phone', 'whatsapp', 'viber', 'telegram']);
  });

  it('moves WhatsApp back ahead when it is rendered second', async () => {
    stubTimeZone('Europe/Belgrade');
    render(`
      <div data-contact-order>
        <a data-channel="telegram"></a>
        <a data-channel="whatsapp"></a>
      </div>`);

    await applyFresh();

    expect(order()).toEqual(['whatsapp', 'telegram']);
  });

  it('ranks against the next channel the group has when the runner-up is missing', async () => {
    stubTimeZone('Europe/Moscow');
    render(`
      <div data-contact-order>
        <a data-channel="viber"></a>
        <a data-channel="telegram"></a>
      </div>`);

    await applyFresh();

    expect(order()).toEqual(['telegram', 'viber']);
  });

  it('promotes the best channel the group has when it lacks the preferred one', async () => {
    stubTimeZone('Europe/Moscow');
    render(`
      <div data-contact-order>
        <a data-channel="phone"></a>
        <a data-channel="viber"></a>
        <a data-channel="whatsapp"></a>
      </div>`);

    await applyFresh();

    expect(order()).toEqual(['phone', 'whatsapp', 'viber']);
  });

  it('leaves a group with a single ranked channel alone', async () => {
    stubTimeZone('Europe/Moscow');
    render(`
      <div data-contact-order>
        <a data-channel="phone"></a>
      </div>`);

    await applyFresh();

    expect(order()).toEqual(['phone']);
  });
});

describe('applyContactPreference: arming', () => {
  afterEach(() => vi.restoreAllMocks());

  it('acts once however many times it is called', async () => {
    stubTimeZone('Europe/Moscow');
    render(`
      <div data-contact-order>
        <a data-channel="whatsapp"></a>
        <a data-channel="telegram"></a>
      </div>`);

    const apply = await applyFresh();
    document.documentElement.lang = 'sr';
    stubTimeZone('Europe/Belgrade');
    apply();

    expect(order()).toEqual(['telegram', 'whatsapp']);
  });
});
