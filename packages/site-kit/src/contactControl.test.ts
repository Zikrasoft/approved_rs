import { describe, expect, it } from 'vitest';
import { TRACKED_CONTACT_CHANNELS } from '@podbor/lead-crm/contact-channel';
import { CONTACT_PLACEMENTS } from './goals.ts';
import { contactRegion, createContactControls } from './contactControl.ts';

const BRAND = {
  phone: '381601234567',
  whatsapp: '381601111111',
  viber: '381602222222',
  captureBot: 'brand_capture_bot',
};

const bare = createContactControls(BRAND);
const full = createContactControls({
  ...BRAND,
  humanTelegram: 'brand_manager',
  prefill: (locale, service) => `hi ${locale} ${service ?? '-'}`,
});

describe('createContactControls', () => {
  it.each(CONTACT_PLACEMENTS)(
    'builds every channel href on %s',
    (placement) => {
      const hrefs = Object.fromEntries(
        TRACKED_CONTACT_CHANNELS.map((channel) => [
          channel,
          bare({
            channel,
            placement,
            onThanks: false,
            locale: 'sr',
            service: 'ppf',
          }).href,
        ]),
      );
      expect(hrefs).toEqual({
        phone: 'tel:+381601234567',
        whatsapp: 'https://wa.me/381601111111',
        viber: 'viber://chat?number=%2B381602222222',
        telegram: 'https://t.me/brand_capture_bot?start=ppf_sr',
      });
    },
  );

  it('opens the capture bot with the locale alone where the page has no service', () => {
    expect(
      bare({
        channel: 'telegram',
        placement: 'footer',
        onThanks: false,
        locale: 'en',
      }).href,
    ).toBe('https://t.me/brand_capture_bot?start=en');
  });

  it.each(CONTACT_PLACEMENTS)(
    'opens the human Telegram on the thanks page only when the brand has one, in the %s region too',
    (placement) => {
      const request = {
        channel: 'telegram',
        placement,
        onThanks: true,
        locale: 'ru',
      } as const;
      expect(full(request).href).toBe('https://t.me/brand_manager');
      expect(bare(request).href).toBe(
        'https://t.me/brand_capture_bot?start=ru',
      );
      expect(full({ ...request, onThanks: false }).href).toBe(
        'https://t.me/brand_capture_bot?start=ru',
      );
    },
  );

  it('prefills WhatsApp only when the brand configures a message', () => {
    const request = {
      channel: 'whatsapp',
      placement: 'bar',
      onThanks: false,
      locale: 'en',
      service: 'ppf',
    } as const;
    expect(full(request).href).toBe(
      `https://wa.me/381601111111?text=${encodeURIComponent('hi en ppf')}`,
    );
    expect(bare(request).href).toBe('https://wa.me/381601111111');
    expect(full({ ...request, channel: 'viber' }).href).toBe(
      'viber://chat?number=%2B381602222222',
    );
  });

  it('marks the phone coarse-only and every messenger any-pointer', () => {
    for (const channel of TRACKED_CONTACT_CHANNELS)
      expect(
        bare({ channel, placement: 'bar', onThanks: false, locale: 'ru' })
          .pointer,
      ).toBe(channel === 'phone' ? 'coarse-only' : 'any');
  });

  it('carries the plain number only for the phone in the thanks region', () => {
    for (const placement of CONTACT_PLACEMENTS)
      for (const channel of TRACKED_CONTACT_CHANNELS)
        expect(
          bare({ channel, placement, onThanks: true, locale: 'ru' })
            .plainNumber,
        ).toBe(
          channel === 'phone' && placement === 'thanks'
            ? '381601234567'
            : undefined,
        );
  });

  it('stamps the channel, and opens every messenger in a new tab', () => {
    expect(
      bare({
        channel: 'phone',
        placement: 'bar',
        onThanks: false,
        locale: 'ru',
      }).attrs,
    ).toEqual({ 'data-contact-channel': 'phone' });
    for (const channel of ['whatsapp', 'viber', 'telegram'] as const)
      expect(
        bare({ channel, placement: 'bar', onThanks: false, locale: 'ru' })
          .attrs,
      ).toEqual({
        'data-contact-channel': channel,
        target: '_blank',
        rel: 'noopener',
      });
  });
});

describe('contactRegion', () => {
  it('stamps the placement, and marks in-flow regions for the floating CTA to watch', () => {
    expect(contactRegion('bar')).toEqual({
      'data-contact-placement': 'bar',
      'data-contact-cta': '',
    });
    expect(contactRegion('hero')).toHaveProperty('data-contact-cta', '');
    expect(contactRegion('thanks')).toHaveProperty('data-contact-cta', '');
    for (const placement of ['floating', 'footer', 'header'] as const)
      expect(contactRegion(placement)).toEqual({
        'data-contact-placement': placement,
      });
  });
});
