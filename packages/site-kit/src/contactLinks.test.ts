import { describe, it, expect } from 'vitest';
import {
  instagramLink,
  phoneLink,
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

  it('opens the Instagram profile', () => {
    expect(instagramLink('studio')).toBe('https://www.instagram.com/studio');
  });
});
