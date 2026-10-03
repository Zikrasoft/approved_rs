import { describe, it, expect } from 'vitest';
import {
  captureBotLink,
  instagramLink,
  phoneLink,
  telegramBotLink,
  telegramLink,
  viberLink,
  whatsappLink,
} from './contactLinks.ts';

describe('contact links', () => {
  it('dials a number the phone app understands', () => {
    expect(phoneLink('381641234567')).toBe('tel:+381641234567');
  });

  it('opens a WhatsApp chat with the number', () => {
    expect(whatsappLink('381641234567')).toBe('https://wa.me/381641234567');
  });

  it('escapes the plus Viber needs encoded', () => {
    expect(viberLink('381641234567')).toBe(
      'viber://chat?number=%2B381641234567',
    );
  });

  it('opens Telegram on the manager handle', () => {
    expect(telegramLink('manager')).toBe('https://t.me/manager');
  });

  it('prefills the first WhatsApp message', () => {
    expect(whatsappLink('381641234567', 'Здравствуйте! Привоз, 5W-30?')).toBe(
      'https://wa.me/381641234567?text=%D0%97%D0%B4%D1%80%D0%B0%D0%B2%D1%81%D1%82%D0%B2%D1%83%D0%B9%D1%82%D0%B5!%20%D0%9F%D1%80%D0%B8%D0%B2%D0%BE%D0%B7%2C%205W-30%3F',
    );
  });

  it('prefills the first Telegram message', () => {
    expect(telegramLink('manager', 'Здравствуйте!')).toBe(
      'https://t.me/manager?text=%D0%97%D0%B4%D1%80%D0%B0%D0%B2%D1%81%D1%82%D0%B2%D1%83%D0%B9%D1%82%D0%B5!',
    );
  });

  it('leaves the link bare when there is nothing to prefill', () => {
    expect(telegramLink('manager', '')).toBe('https://t.me/manager');
    expect(whatsappLink('381641234567', '')).toBe('https://wa.me/381641234567');
  });

  it('carries the page service and locale into the bot start payload', () => {
    expect(captureBotLink('ApprovedRsBot', 'sr', 'vehicle-sourcing')).toBe(
      'https://t.me/ApprovedRsBot?start=vehicle-sourcing_sr',
    );
  });

  it('carries the locale alone where the page has no service', () => {
    expect(captureBotLink('ApprovedRsBot', 'ru')).toBe(
      'https://t.me/ApprovedRsBot?start=ru',
    );
    expect(captureBotLink('ApprovedRsBot', 'ru', '')).toBe(
      'https://t.me/ApprovedRsBot?start=ru',
    );
  });

  it('opens the bot bare where a page only names it', () => {
    expect(telegramBotLink('ApprovedRsBot')).toBe('https://t.me/ApprovedRsBot');
  });

  it('opens the Instagram profile', () => {
    expect(instagramLink('studio')).toBe('https://www.instagram.com/studio');
  });
});
