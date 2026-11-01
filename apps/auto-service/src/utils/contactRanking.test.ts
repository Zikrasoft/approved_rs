import { describe, expect, it } from 'vitest';
import { preferredContactChannels } from '@podbor/site-kit/contact-preference';
import { CONTACT_RANKING } from './contactRanking';

const first = (country: string | undefined, locale: string) =>
  preferredContactChannels(country, locale, CONTACT_RANKING)[0];

describe('the CarLab contact ranking', () => {
  it('offers a call first to a visitor in Serbia', () => {
    expect(first('rs', 'sr')).toBe('phone');
  });

  it('offers a call first when the time zone says nothing', () => {
    expect(first(undefined, 'en')).toBe('phone');
  });

  it('offers Telegram first to a visitor reading in Russian', () => {
    expect(first('rs', 'ru')).toBe('telegram');
  });

  it('offers Telegram first to a visitor from a Russian-speaking country', () => {
    expect(first('ru', 'sr')).toBe('telegram');
  });

  it('ranks every channel once in each list', () => {
    for (const ranking of [
      CONTACT_RANKING.fallback,
      ...CONTACT_RANKING.byCountry.values(),
    ])
      expect([...ranking].sort()).toEqual([
        'phone',
        'telegram',
        'viber',
        'whatsapp',
      ]);
  });
});
